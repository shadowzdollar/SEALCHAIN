import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { demoShipment } from '@sealchain/core';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';
import { defaultInvoicePrefix } from '../src/routes/org';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-org-'));
let app: FastifyInstance;
let owner = '';
let member = '';

const as = (cookie: string) => async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, headers: cookie ? { cookie } : {}, payload: payload as never });
  return { status: r.statusCode, body: r.json() };
};
const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers['set-cookie']).split(';')[0]!;

beforeAll(async () => {
  Object.assign(process.env, { DATA_DIR: dataDir, ANCHOR_MODE: 'local' });
  delete process.env.RPC_URL;
  app = (await buildApp(loadConfig(), { logger: false, startAnchoring: false })).app;
  await app.ready();
  owner = cookieOf(await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Huye Highlands Coffee Ltd', name: 'Aline', email: 'aline@huye.test', password: 'a long enough password' } }));
  const inv = await as(owner)('POST', '/api/team/invites', { email: 'clerk@huye.test', role: 'member' });
  member = cookieOf(await app.inject({ method: 'POST', url: `/api/invites/${inv.body.inviteUrl.split('/invite/')[1]}/accept`, payload: { name: 'Clerk', password: 'clerk password 123' } }));
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('organisation profile', () => {
  it('derives a sensible invoice prefix', () => {
    expect(defaultInvoicePrefix('Ubwiza Coffee Exporters Ltd (Demo)')).toBe('UCE-INV');
    expect(defaultInvoicePrefix('The Tea Co.')).toBe('T-INV');
    expect(defaultInvoicePrefix('***')).toBe('SC-INV');
  });

  it('owners save company details, defaults and numbering; members cannot', async () => {
    const exporter = { name: 'Huye Highlands Coffee Ltd', address: 'KN 5 Rd, Plot 9', city: 'Huye', country: 'RW', taxId: '102345678', phone: '+250 788 000 000' };
    const res = await as(owner)('PUT', '/api/org', { settings: { invoicePrefix: 'HHC', invoiceNext: 41, defaultCorridor: 'RW-KE', defaultCurrency: 'USD', defaultIncoterm: 'DAP', defaultPaymentTerms: '30 days' }, exporter });
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({ invoicePrefix: 'HHC', defaultCorridor: 'RW-KE', defaultIncoterm: 'DAP' });
    expect(res.body.settings.nextInvoiceNumber).toMatch(/^HHC-\d{4}-0041$/);
    expect(res.body.exporter.party).toMatchObject({ taxId: '102345678', city: 'Huye' });
    // The company is the default exporter in the address book.
    const parties = (await as(owner)('GET', '/api/parties?role=exporter')).body;
    expect(parties).toHaveLength(1);

    expect((await as(member)('PUT', '/api/org', { name: 'Hijacked' })).status).toBe(403);
    expect((await as(owner)('PUT', '/api/org', { settings: { defaultCorridor: 'XX-YY' } })).status).toBe(400);
    expect((await as(owner)('PUT', '/api/org', { settings: { invoicePrefix: 'bad prefix!' } })).status).toBe(400);
  });

  it('hands out invoice numbers in sequence, never twice', async () => {
    const [a, b] = await Promise.all([as(member)('POST', '/api/org/invoice-number'), as(owner)('POST', '/api/org/invoice-number')]);
    const numbers = [a.body.number, b.body.number].sort();
    expect(numbers[0]).toMatch(/-0041$/);
    expect(numbers[1]).toMatch(/-0042$/);
    expect((await as(owner)('GET', '/api/org')).body.settings.nextInvoiceNumber).toMatch(/-0043$/);
  });
});

describe('onboarding checklist', () => {
  it('ticks steps off from real activity and can be dismissed', async () => {
    let ob = (await as(owner)('GET', '/api/onboarding')).body;
    const done = (id: string) => ob.steps.find((s: { id: string }) => s.id === id).done;
    expect(done('profile')).toBe(true);
    expect(done('team')).toBe(true);
    expect(done('shipment')).toBe(false);

    const { id: _id, ...draft } = demoShipment();
    const created = await as(owner)('POST', '/api/shipments', draft);
    await as(owner)('POST', `/api/shipments/${created.body.id}/issue`, { acknowledgeWarnings: true });
    ob = (await as(owner)('GET', '/api/onboarding')).body;
    expect(done('shipment')).toBe(true);
    expect(done('issue')).toBe(true);
    expect(ob.complete).toBe(false);

    await as(owner)('POST', '/api/onboarding/dismiss');
    expect((await as(owner)('GET', '/api/onboarding')).body.dismissed).toBe(true);
  });
});
