import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoShipment, verifyMerkleProof } from '@sealchain/core';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp, type App } from '../src/app';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-endorse-'));
let ctx: App;
let app: FastifyInstance;
let staff = '';
let exporter = '';
let officer = '';
let authorityId = '';
let shipmentId = '';
let coId = '';
let invId = '';

const cookieOf = (res: { headers: Record<string, unknown> }) => String(res.headers['set-cookie'] ?? '').split(';')[0]!;
const as = (cookie: string) => async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) => {
  const res = await app.inject({ method, url, payload: payload as never, headers: cookie ? { cookie } : {} });
  return { status: res.statusCode, body: res.headers['content-type']?.includes('json') ? res.json() : res.body, headers: res.headers };
};

beforeAll(async () => {
  process.env.DATA_DIR = dataDir;
  process.env.ANCHOR_MODE = 'local';
  process.env.ADMIN_EMAILS = 'staff@sealchain.test';
  delete process.env.RPC_URL;
  ctx = await buildApp(loadConfig(), { logger: false, startAnchoring: false });
  app = ctx.app;
  await app.ready();
  staff = cookieOf(await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'SealChain Compliance', name: 'Staff', email: 'staff@sealchain.test', password: 'a long enough password' } }));
  exporter = cookieOf(await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Ubwiza Coffee Exporters', name: 'Aline', email: 'aline@ubwiza.test', password: 'a long enough password' } }));
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('issuing-authority endorsement', () => {
  it('compliance registers an authority and its officer joins', async () => {
    expect((await as(exporter)('POST', '/api/admin/authorities', { name: 'x', country: 'RW', officerEmail: 'x@y.z' })).status).toBe(403);
    const created = await as(staff)('POST', '/api/admin/authorities', { name: 'Rwanda Revenue Authority — Customs', country: 'RW', officerEmail: 'officer@rra.test' });
    expect(created.status).toBe(201);
    authorityId = created.body.id;
    const token = created.body.inviteUrl.split('/invite/')[1];
    const accept = await app.inject({ method: 'POST', url: `/api/invites/${token}/accept`, payload: { name: 'Officer Mugisha', password: 'officer password 1' } });
    expect(accept.statusCode).toBe(201);
    officer = cookieOf(accept);
    expect(accept.json().org).toMatchObject({ name: 'Rwanda Revenue Authority — Customs', kind: 'authority' });
  });

  it('exporter requests endorsement of the certificate of origin', async () => {
    const { id: _id, ...draft } = demoShipment();
    shipmentId = (await as(exporter)('POST', '/api/shipments', draft)).body.id;
    const issued = await as(exporter)('POST', `/api/shipments/${shipmentId}/issue`, { acknowledgeWarnings: true });
    coId = issued.body.documents.find((d: { kind: string }) => d.kind === 'certificate_of_origin').id;
    invId = issued.body.documents.find((d: { kind: string }) => d.kind === 'commercial_invoice').id;

    const dir = (await as(exporter)('GET', '/api/authorities?country=RW')).body;
    expect(dir).toEqual([{ id: authorityId, name: 'Rwanda Revenue Authority — Customs', country: 'RW' }]);
    expect((await as(exporter)('POST', `/api/documents/${invId}/endorsements`, { authorityId })).status).toBe(409);
    const req = await as(exporter)('POST', `/api/documents/${coId}/endorsements`, { authorityId, note: 'Truck leaves Friday' });
    expect(req.status).toBe(201);
    expect((await as(exporter)('POST', `/api/documents/${coId}/endorsements`, { authorityId })).status).toBe(409); // duplicate
    // the officer was notified
    const mail = ctx.deps.db.get<{ subject: string }>("SELECT subject FROM outbox WHERE to_email = 'officer@rra.test' ORDER BY rowid DESC LIMIT 1");
    expect(mail?.subject).toContain('Endorsement requested');
  });

  it('only the authority sees its queue, with the validation summary and the PDF', async () => {
    expect((await as(exporter)('GET', '/api/authority/queue')).status).toBe(403);
    const q = (await as(officer)('GET', '/api/authority/queue')).body;
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ requester: 'Ubwiza Coffee Exporters', requestNote: 'Truck leaves Friday', document: { id: coId }, validation: { errors: 0 } });
    const pdf = await app.inject({ method: 'GET', url: `/api/authority/requests/${q[0].id}/pdf`, headers: { cookie: officer } });
    expect(pdf.headers['content-type']).toBe('application/pdf');
  });

  it('endorsement is signed, anchored and shown on public verification', async () => {
    const q = (await as(officer)('GET', '/api/authority/queue')).body;
    expect((await as(officer)('POST', `/api/authority/requests/${q[0].id}/decision`, { decision: 'endorse', note: 'Checked against RRA records' })).status).toBe(200);
    await ctx.deps.anchor.run();
    const v = (await as('')('GET', `/api/verify/${coId}`)).body;
    expect(v.endorsements).toHaveLength(1);
    const e = v.endorsements[0];
    expect(e).toMatchObject({ authority: 'Rwanda Revenue Authority — Customs', officer: 'Officer Mugisha', signatureValid: true, matchesDocument: true, proofValid: true });
    expect(e.anchor.status).toBe('confirmed');
    expect(verifyMerkleProof(e.recordHash, e.anchor.proof, e.anchor.root)).toBe(true);
    expect(e.record).not.toHaveProperty('note'); // internal notes stay private
    const mail = ctx.deps.db.get<{ subject: string }>("SELECT subject FROM outbox WHERE to_email = 'aline@ubwiza.test' ORDER BY rowid DESC LIMIT 1");
    expect(mail?.subject).toContain('endorsed');
  });

  it('rejection needs a reason and stays private', async () => {
    const other = await as(staff)('POST', '/api/admin/authorities', { name: 'RICA', country: 'RW', officerEmail: 'o2@rica.test' });
    const token = other.body.inviteUrl.split('/invite/')[1];
    const o2 = cookieOf(await app.inject({ method: 'POST', url: `/api/invites/${token}/accept`, payload: { name: 'Officer Two', password: 'officer password 2' } }));
    await as(exporter)('POST', `/api/documents/${coId}/endorsements`, { authorityId: other.body.id });
    const q = (await as(o2)('GET', '/api/authority/queue')).body;
    expect((await as(o2)('POST', `/api/authority/requests/${q[0].id}/decision`, { decision: 'reject' })).status).toBe(400);
    expect((await as(o2)('POST', `/api/authority/requests/${q[0].id}/decision`, { decision: 'reject', note: 'Origin criterion should be PSR for item 2' })).status).toBe(200);
    const mine = (await as(exporter)('GET', `/api/shipments/${shipmentId}/endorsements`)).body;
    expect(mine.find((x: { status: string }) => x.status === 'rejected').decisionNote).toContain('PSR');
    const pub = (await as('')('GET', `/api/verify/${coId}`)).body;
    expect(pub.endorsements).toHaveLength(1); // only the endorsement, not the rejection
  });

  it('a replaced certificate cannot be endorsed, and the new version starts unendorsed', async () => {
    const current = (await as(exporter)('GET', `/api/shipments/${shipmentId}`)).body;
    const data = { ...current.data, transportRef: 'RAE 222 C' };
    delete data.id;
    await as(exporter)('PUT', `/api/shipments/${shipmentId}`, data);
    const reissued = await as(exporter)('POST', `/api/shipments/${shipmentId}/issue`, { acknowledgeWarnings: true });
    const newCo = reissued.body.documents.find((d: { kind: string }) => d.kind === 'certificate_of_origin').id;
    expect((await as('')('GET', `/api/verify/${newCo}`)).body.endorsements).toEqual([]);
    // a pending request on the old version can no longer be endorsed
    const third = await as(staff)('POST', '/api/admin/authorities', { name: 'NAEB', country: 'RW', officerEmail: 'o3@naeb.test' });
    const o3 = cookieOf(await app.inject({ method: 'POST', url: `/api/invites/${third.body.inviteUrl.split('/invite/')[1]}/accept`, payload: { name: 'Officer Three', password: 'officer password 3' } }));
    ctx.deps.db.run("INSERT INTO endorsements (id, document_id, shipment_id, requester_org_id, authority_org_id, status, created_by, created_at) SELECT 'end_stale', ?, ?, requester_org_id, ?, 'pending', created_by, created_at FROM endorsements LIMIT 1", coId, shipmentId, third.body.id);
    const res = await as(o3)('POST', '/api/authority/requests/end_stale/decision', { decision: 'endorse' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('replaced');
  });

  it('authorities are not billed', async () => {
    const bill = (await as(officer)('GET', '/api/billing')).body;
    expect(bill.statement.totalCents).toBe(0);
  });
});
