import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoShipment } from '@sealchain/core';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp, type App } from '../src/app';
import { checkWebhookUrl, sign } from '../src/services/webhooks';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-wh-'));
let ctx: App;
let app: FastifyInstance;
let cookie = '';
let receiver: http.Server;
let port = 0;
let failNext = 0;
const received: Array<{ headers: http.IncomingHttpHeaders; body: string }> = [];

beforeAll(async () => {
  receiver = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (failNext > 0) {
        failNext--;
        res.writeHead(500).end('boom');
        return;
      }
      received.push({ headers: req.headers, body });
      res.writeHead(200).end('ok');
    });
  });
  await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', () => r()));
  port = (receiver.address() as { port: number }).port;

  process.env.DATA_DIR = dataDir;
  process.env.ANCHOR_MODE = 'local';
  delete process.env.RPC_URL;
  ctx = await buildApp(loadConfig(), { logger: false, startAnchoring: false });
  app = ctx.app;
  await app.ready();
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Forwarder Ltd', name: 'Ops', email: 'ops@fwd.test', password: 'a long enough password' } });
  cookie = String(r.headers['set-cookie']).split(';')[0]!;
});

afterAll(async () => {
  await app.close();
  receiver.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const call = async (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown, c = cookie) => {
  const res = await app.inject({ method, url, payload: payload as never, headers: { cookie: c } });
  return { status: res.statusCode, body: res.json() };
};
const events = () => received.map((r) => JSON.parse(r.body).type as string);

describe('webhooks', () => {
  let secret = '';
  let hookId = '';

  it('creates a webhook and shows the signing secret once', async () => {
    const created = await call('POST', '/api/webhooks', { url: `http://127.0.0.1:${port}/hook`, events: ['document.issued', 'document.anchored', 'document.revoked'] });
    expect(created.status).toBe(201);
    secret = created.body.secret;
    hookId = created.body.id;
    expect(secret).toMatch(/^whsec_/);
    const list = (await call('GET', '/api/webhooks')).body;
    expect(JSON.stringify(list)).not.toContain(secret);
  });

  it('test ping is delivered with a valid signature', async () => {
    const res = await call('POST', `/api/webhooks/${hookId}/test`);
    expect(res.body.status).toBe('delivered');
    const last = received.at(-1)!;
    const [t, v1] = String(last.headers['sealchain-signature']).split(',').map((p) => p.split('=')[1]!);
    expect(v1).toBe(sign(secret, Number(t), last.body));
    expect(last.headers['sealchain-event']).toBe('ping');
  });

  it('delivers issued, anchored and revoked events', async () => {
    const { id: _id, ...draft } = demoShipment();
    const s = await call('POST', '/api/shipments', draft);
    const issued = await call('POST', `/api/shipments/${s.body.id}/issue`, { acknowledgeWarnings: true });
    await ctx.deps.webhooks.process();
    await ctx.deps.anchor.run();
    await ctx.deps.webhooks.process();
    await call('POST', `/api/documents/${issued.body.documents[0].id}/revoke`, { reason: 'Cancelled' });
    await ctx.deps.webhooks.process();
    expect(events()).toEqual(expect.arrayContaining(['document.issued', 'document.anchored', 'document.revoked']));
    const issuedEvt = JSON.parse(received.find((r) => JSON.parse(r.body).type === 'document.issued')!.body);
    expect(issuedEvt.data.documents).toHaveLength(3);
    expect(issuedEvt.data.documents[0].verifyUrl).toContain('/v/doc_');
  });

  it('retries a failing receiver and records the error', async () => {
    failNext = 1;
    await call('POST', `/api/webhooks/${hookId}/test`);
    const deliveries = (await call('GET', `/api/webhooks/${hookId}/deliveries`)).body;
    expect(deliveries[0]).toMatchObject({ status: 'pending', attempts: 1, responseCode: 500 });
    // make it due now and try again
    ctx.deps.db.run("UPDATE webhook_deliveries SET next_attempt_at = '2000-01-01T00:00:00.000Z' WHERE id = ?", deliveries[0].id);
    await ctx.deps.webhooks.process();
    expect((await call('GET', `/api/webhooks/${hookId}/deliveries`)).body[0]).toMatchObject({ status: 'delivered', attempts: 2 });
  });

  it('is private to the organisation', async () => {
    const other = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Other Ltd', name: 'Other User', email: 'o@other.test', password: 'a long enough password' } });
    const oc = String(other.headers['set-cookie']).split(';')[0]!;
    expect((await call('GET', `/api/webhooks/${hookId}/deliveries`, undefined, oc)).status).toBe(404);
    expect((await call('GET', '/api/webhooks', undefined, oc)).body).toEqual([]);
  });

  it('refuses unsafe URLs in production', () => {
    const prod = { ...loadConfig(), isProd: true };
    expect(checkWebhookUrl('http://example.com/hook', prod)).toContain('https');
    expect(checkWebhookUrl('https://127.0.0.1/hook', prod)).toContain('private');
    expect(checkWebhookUrl('https://10.0.0.5/hook', prod)).toContain('private');
    expect(checkWebhookUrl('https://metadata.internal/hook', prod)).toContain('private');
    expect(checkWebhookUrl('https://user:pw@example.com/hook', prod)).toContain('credentials');
    expect(checkWebhookUrl('https://tms.example.com/sealchain', prod)).toBeNull();
  });
});
