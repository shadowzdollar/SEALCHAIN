import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { demoShipment } from '@sealchain/core';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';
import type { Deps } from '../src/services/documents';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-ntf-'));
let app: FastifyInstance;
let deps: Deps;
let owner = '';
let member = '';
let outsider = '';
let docId = '';

const as = (cookie: string) => async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, headers: cookie ? { cookie } : {}, payload: payload as never });
  return { status: r.statusCode, body: r.json() };
};
const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers['set-cookie']).split(';')[0]!;
const outbox = (to: string, like: string) => deps.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM outbox WHERE to_email = ? AND subject LIKE ?', to, like)!.n;

beforeAll(async () => {
  Object.assign(process.env, { DATA_DIR: dataDir, ANCHOR_MODE: 'local', PUBLIC_WEB_URL: 'http://localhost:5174' });
  delete process.env.RPC_URL;
  ({ app, deps } = await buildApp(loadConfig(), { logger: false, startAnchoring: false }));
  await app.ready();
  owner = cookieOf(await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Kivu Fresh Ltd', name: 'Aline', email: 'owner@kivu.test', password: 'a long enough password' } }));
  outsider = cookieOf(await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Nairobi Bank', name: 'Otieno', email: 'lc@bank.test', password: 'a long enough password' } }));
  const inv = await as(owner)('POST', '/api/team/invites', { email: 'clerk@kivu.test', role: 'member' });
  const token = inv.body.inviteUrl.split('/invite/')[1];
  member = cookieOf(await app.inject({ method: 'POST', url: `/api/invites/${token}/accept`, payload: { name: 'Clerk', password: 'clerk password 123' } }));

  const { id: _id, ...draft } = demoShipment();
  const created = await as(owner)('POST', '/api/shipments', draft);
  const issued = await as(owner)('POST', `/api/shipments/${created.body.id}/issue`, { acknowledgeWarnings: true });
  docId = issued.body.documents[0].id;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('notifications', () => {
  it('tells the owner a teammate joined, and emails them by default', async () => {
    const list = (await as(owner)('GET', '/api/notifications')).body;
    expect(list.items.map((n: { type: string }) => n.type)).toContain('team.joined');
    expect(outbox('owner@kivu.test', '%joined your team%')).toBe(1);
    // The person who joined is not told about themselves.
    expect((await as(member)('GET', '/api/notifications')).body.items.some((n: { type: string }) => n.type === 'team.joined')).toBe(false);
  });

  it('collapses repeated outside verifications into one notification with a count', async () => {
    for (let i = 0; i < 3; i++) await as(outsider)('GET', `/api/verify/${docId}`);
    await as('')('GET', `/api/verify/${docId}`);
    // The exporter checking their own document is not a verification.
    await as(owner)('GET', `/api/verify/${docId}`);
    const items = (await as(owner)('GET', '/api/notifications')).body.items.filter((n: { type: string }) => n.type === 'document.verified');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ count: 4, read: false });
    expect(items[0].link).toMatch(/^\/app\/shipments\/shp_/);
    // Optional and noisy: no email unless asked for.
    expect(outbox('owner@kivu.test', '%was verified%')).toBe(0);
  });

  it('keeps read state per user and supports mark-all', async () => {
    const before = (await as(owner)('GET', '/api/notifications/count')).body.unread;
    expect(before).toBeGreaterThan(0);
    const memberBefore = (await as(member)('GET', '/api/notifications/count')).body.unread;
    const res = await as(owner)('POST', '/api/notifications/read', { all: true });
    expect(res.body.unread).toBe(0);
    expect((await as(member)('GET', '/api/notifications/count')).body.unread).toBe(memberBefore);
    // A new burst makes the collapsed notification unread again.
    await as(outsider)('GET', `/api/verify/${docId}`);
    expect((await as(owner)('GET', '/api/notifications/count')).body.unread).toBe(1);
  });

  it('emails an optional type once the user turns it on', async () => {
    const prefs = (await as(owner)('PUT', '/api/notifications/prefs', { type: 'share.viewed', email: true })).body;
    expect(prefs.find((p: { type: string }) => p.type === 'share.viewed').email).toBe(true);
    // Mandatory types cannot be switched off.
    const locked = (await as(owner)('PUT', '/api/notifications/prefs', { type: 'document.tampered', email: false })).body;
    expect(locked.find((p: { type: string }) => p.type === 'document.tampered').email).toBe(true);

    const shipmentId = deps.db.get<{ shipment_id: string }>('SELECT shipment_id FROM documents WHERE id = ?', docId)!.shipment_id;
    const share = await as(owner)('POST', `/api/shipments/${shipmentId}/shares`, { label: 'Buyer bank', days: 7 });
    const token = share.body.url.split('/s/')[1];
    await as('')('GET', `/api/shares/${token}`);
    await as('')('GET', `/api/shares/${token}`);
    expect(outbox('owner@kivu.test', '%opened your shared documents%')).toBe(1);
    expect(outbox('clerk@kivu.test', '%opened your shared documents%')).toBe(0);
  });

  it("does not leak another organisation's notifications", async () => {
    const ids = (await as(owner)('GET', '/api/notifications')).body.items.map((n: { id: string }) => n.id);
    const res = await as(outsider)('POST', '/api/notifications/read', { ids });
    expect(res.body.marked).toBe(0);
    expect((await as(outsider)('GET', '/api/notifications')).body.items).toHaveLength(0);
  });
});
