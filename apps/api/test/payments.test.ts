import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';

const dirs: string[] = [];
const apps: FastifyInstance[] = [];

async function start(env: Record<string, string | undefined>) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-pay-'));
  dirs.push(dataDir);
  const keys = ['FLW_SECRET_KEY', 'FLW_WEBHOOK_HASH', 'FLW_API_BASE', 'PAYMENT_PROVIDER', 'PAYMENT_CURRENCY'];
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dataDir, ANCHOR_MODE: 'local', PUBLIC_WEB_URL: 'http://localhost:5174' }, env);
  delete process.env.RPC_URL;
  const app = (await buildApp(loadConfig(), { logger: false, startAnchoring: false })).app;
  await app.ready();
  apps.push(app);
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Musanze Growers Ltd', name: 'Jean Uwase', email: `owner${apps.length}@growers.test`, password: 'a long enough password' } });
  return { app, cookie: String(r.headers['set-cookie']).split(';')[0]! };
}

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  for (const a of apps) await a.close();
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('sandbox payments (development)', () => {
  it('pays the statement once, however many times it is confirmed, and issues a receipt', async () => {
    const { app, cookie } = await start({});
    const billing = (await app.inject({ method: 'GET', url: '/api/billing', headers: { cookie } })).json();
    expect(billing.payment).toMatchObject({ online: true, provider: 'sandbox', test: true, currency: 'RWF', canPay: true });
    expect(billing.statement.balanceCents).toBe(1500);

    const co = await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: { cookie }, payload: {} });
    expect(co.statusCode).toBe(200);
    const { id, url, chargeAmount, chargeCurrency } = co.json();
    expect(url).toBe(`http://localhost:5174/app/billing/sandbox/${id}`);
    expect([chargeAmount, chargeCurrency]).toEqual([21750, 'RWF']); // $15 at 1450 RWF/USD

    const paid = await app.inject({ method: 'POST', url: `/api/billing/sandbox/${id}`, headers: { cookie }, payload: { outcome: 'ok' } });
    expect(paid.json()).toMatchObject({ status: 'succeeded', creditCents: 1500 });
    // A second confirmation (redirect + webhook) must not record a second payment.
    await app.inject({ method: 'POST', url: `/api/billing/sandbox/${id}`, headers: { cookie }, payload: { outcome: 'ok' } });

    const after = (await app.inject({ method: 'GET', url: '/api/billing', headers: { cookie } })).json();
    expect(after.statement.balanceCents).toBe(0);
    expect(after.statement.payments).toHaveLength(1);
    expect(after.statement.payments[0]).toMatchObject({ method: 'sandbox:test', currency_charged: 'RWF', amount_charged: 21750 });

    const receipt = await app.inject({ method: 'GET', url: `/api/billing/payments/${after.statement.payments[0].id}/receipt`, headers: { cookie } });
    expect(receipt.statusCode).toBe(200);
    expect(receipt.headers['content-type']).toBe('application/pdf');
    expect(receipt.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');

    expect((await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: { cookie }, payload: {} })).statusCode).toBe(409);
  });

  it('a declined payment leaves the balance due', async () => {
    const { app, cookie } = await start({});
    const { id } = (await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: { cookie }, payload: {} })).json();
    const res = await app.inject({ method: 'POST', url: `/api/billing/sandbox/${id}`, headers: { cookie }, payload: { outcome: 'fail' } });
    expect(res.json().status).toBe('failed');
    expect((await app.inject({ method: 'GET', url: '/api/billing', headers: { cookie } })).json().statement.balanceCents).toBe(1500);
  });
});

describe('Flutterwave', () => {
  const env = { FLW_SECRET_KEY: 'FLWSECK_TEST-abc', FLW_WEBHOOK_HASH: 'hook-secret', FLW_API_BASE: 'https://flw.test/v3' };

  function mockFlutterwave(verify: (id: string) => object) {
    const real = globalThis.fetch;
    const calls: Array<{ url: string; body: unknown; auth: string | null }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.startsWith('https://flw.test/')) return real(input, init);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null, auth: new Headers(init?.headers).get('authorization') });
      if (url.endsWith('/payments')) return Response.json({ status: 'success', data: { link: 'https://checkout.flw.test/pay/abc' } });
      const m = /transactions\/(\w+)\/verify$/.exec(url);
      if (m) return Response.json({ status: 'success', data: verify(m[1]!) });
      return Response.json({ status: 'error', message: 'not found' }, { status: 404 });
    });
    return calls;
  }

  it('creates a hosted checkout and settles from a verified webhook', async () => {
    const { app, cookie } = await start(env);
    let intentId = '';
    const calls = mockFlutterwave((id) => ({ id: Number(id), status: 'successful', tx_ref: intentId, amount: 21750, currency: 'RWF', payment_type: 'mobilemoneyrw' }));

    const co = (await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: { cookie }, payload: {} })).json();
    intentId = co.id;
    expect(co.url).toBe('https://checkout.flw.test/pay/abc');
    expect(calls[0]).toMatchObject({ auth: 'Bearer FLWSECK_TEST-abc', body: { tx_ref: intentId, amount: 21750, currency: 'RWF', redirect_url: 'http://localhost:5174/app/billing/return' } });

    const hook = (hash: string) => app.inject({ method: 'POST', url: '/api/payments/webhook/flutterwave', headers: { 'verif-hash': hash }, payload: { event: 'charge.completed', data: { id: 4242, tx_ref: intentId, status: 'successful' } } });
    expect((await hook('wrong')).statusCode).toBe(401);
    expect((await hook('hook-secret')).statusCode).toBe(200);
    await hook('hook-secret');

    const intent = (await app.inject({ method: 'GET', url: `/api/billing/intents/${intentId}`, headers: { cookie } })).json();
    expect(intent.status).toBe('succeeded');
    const st = (await app.inject({ method: 'GET', url: '/api/billing', headers: { cookie } })).json().statement;
    expect(st.balanceCents).toBe(0);
    expect(st.payments).toHaveLength(1);
    expect(st.payments[0]).toMatchObject({ method: 'flutterwave:mobilemoneyrw', reference: '4242' });
  });

  it('refuses a payment that does not cover the amount asked', async () => {
    const { app, cookie } = await start(env);
    let intentId = '';
    mockFlutterwave((id) => ({ id: Number(id), status: 'successful', tx_ref: intentId, amount: 100, currency: 'RWF' }));
    intentId = (await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: { cookie }, payload: {} })).json().id;
    const res = await app.inject({ method: 'POST', url: '/api/billing/confirm', headers: { cookie }, payload: { transactionId: '99', intentId } });
    expect(res.json()).toMatchObject({ status: 'failed' });
    expect(res.json().failureReason).toMatch(/expected 21750 RWF/);
    expect((await app.inject({ method: 'GET', url: '/api/billing', headers: { cookie } })).json().statement.balanceCents).toBe(1500);
  });
});
