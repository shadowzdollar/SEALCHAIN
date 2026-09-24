/**
 * Engine features added after the first build: rules checklist, managed rule
 * changes, team invites and roles, password recovery.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoShipment } from '@sealchain/core';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp, type App } from '../src/app';

let ctx: App;
let app: FastifyInstance;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-engine-'));
let owner = '';
let admin = '';

async function register(email: string, orgName = 'Kivu Fresh Ltd') {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName, name: 'Test User', email, password: 'a long enough password' } });
  expect(res.statusCode).toBe(201);
  return String(res.headers['set-cookie']).split(';')[0]!;
}

function as(cookie: string) {
  return async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) => {
    const res = await app.inject({ method, url, payload: payload as never, headers: cookie ? { cookie } : {} });
    return { status: res.statusCode, body: res.headers['content-type']?.includes('json') ? res.json() : res.body, headers: res.headers };
  };
}

/** Pulls the newest link for `to` out of the mail outbox. */
function lastLink(to: string, pattern: RegExp): string {
  const row = ctx.deps.db.get<{ body: string }>('SELECT body FROM outbox WHERE to_email = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', to);
  const m = row?.body.match(pattern);
  if (!m) throw new Error(`no link for ${to}`);
  return m[1]!;
}

beforeAll(async () => {
  process.env.DATA_DIR = dataDir;
  process.env.ANCHOR_MODE = 'local';
  process.env.ADMIN_EMAILS = 'staff@sealchain.test';
  delete process.env.RPC_URL;
  ctx = await buildApp(loadConfig(), { logger: false, startAnchoring: false });
  app = ctx.app;
  await app.ready();
  owner = await register('owner@kivu.test');
  admin = await register('staff@sealchain.test', 'SealChain Compliance');
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('rules checklist', () => {
  it('lists every rule with progress', async () => {
    const res = await as(admin)('GET', '/api/admin/checklist');
    expect(res.body.summary.total).toBeGreaterThan(100);
    expect(res.body.summary.open).toBe(res.body.summary.total);
    expect(res.body.items.find((i: { key: string }) => i.key === 'RW-KE:param:strThresholdUsd').claim).toContain('2,000');
  });

  it('records confirmations and reopens them when the value changes', async () => {
    const call = as(admin);
    const confirmed = await call('PUT', '/api/admin/checklist/tariff:09011100', { status: 'confirmed', note: 'Gazette 2022 p.14' });
    expect(confirmed.body.status).toBe('confirmed');
    // A different verified rate changes the value under check → recheck.
    await call('PUT', '/api/admin/tariff/09011100', { cetRate: 25 });
    const after = (await call('GET', '/api/admin/checklist')).body.items.find((i: { key: string }) => i.key === 'tariff:09011100');
    expect(after.status).toBe('recheck');
    expect(after.claim).toContain('25%');
  });

  it('requires a note when flagging an item as incorrect', async () => {
    const res = await as(admin)('PUT', '/api/admin/checklist/RW-KE:border:exit:road', { status: 'incorrect' });
    expect(res.status).toBe(400);
  });

  it('exports CSV', async () => {
    const res = await as(admin)('GET', '/api/admin/checklist?format=csv');
    expect(res.headers['content-type']).toContain('text/csv');
    expect(String(res.body).split('\n')[0]).toBe('key,area,corridorId,subject,claim,value,sourceTitle,sourceUrl,howToVerify,status,note,checkedBy,checkedAt');
  });

  it('is compliance-only', async () => {
    expect((await as(owner)('GET', '/api/admin/checklist')).status).toBe(403);
  });
});

describe('managed rule changes', () => {
  it('a recorded change reaches affected shipments only', async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const add = await as(admin)('POST', '/api/admin/rule-changes', {
      corridorId: 'RW-KE', effectiveFrom: soon, title: 'KEPHIS new avocado import protocol',
      description: 'Avocado consignments need pre-shipment inspection certificates.', hsPrefixes: ['080440'], sourceTitle: 'KEPHIS notice',
    });
    expect(add.status).toBe(201);
    const { id: _id, ...coffee } = demoShipment();
    const unaffected = (await as(owner)('POST', '/api/shipments/validate', coffee)).body;
    expect(unaffected.findings.map((f: { code: string }) => f.code)).not.toContain('RECENT_RULE_CHANGE');
    const avocado = { ...coffee, items: [{ ...coffee.items[0]!, description: 'Fresh hass avocados in cartons', hsCode: '08044000' }] };
    const affected = (await as(owner)('POST', '/api/shipments/validate', avocado)).body;
    const f = affected.findings.find((x: { code: string }) => x.code === 'RECENT_RULE_CHANGE');
    expect(f.message).toContain('Upcoming');
    expect(f.message).toContain('KEPHIS');
  });
});

describe('team', () => {
  let memberCookie = '';

  it('owner invites a member who accepts via the link', async () => {
    const inv = await as(owner)('POST', '/api/team/invites', { email: 'clerk@kivu.test', role: 'member' });
    expect(inv.status).toBe(201);
    const token = inv.body.inviteUrl.split('/invite/')[1];
    expect(lastLink('clerk@kivu.test', /\/invite\/(\S+)/)).toBe(token);
    const info = await as('')('GET', `/api/invites/${token}`);
    expect(info.body.org).toBe('Kivu Fresh Ltd');
    const accept = await app.inject({ method: 'POST', url: `/api/invites/${token}/accept`, payload: { name: 'Clerk', password: 'clerk password 123' } });
    expect(accept.statusCode).toBe(201);
    memberCookie = String(accept.headers['set-cookie']).split(';')[0]!;
    expect(accept.json().org.name).toBe('Kivu Fresh Ltd');
    // single use
    expect((await as('')('GET', `/api/invites/${token}`)).status).toBe(404);
  });

  it('members share shipments but cannot manage the team or revoke', async () => {
    const member = as(memberCookie);
    const { id: _id, ...draft } = demoShipment();
    const created = await member('POST', '/api/shipments', draft);
    expect(created.status).toBe(201);
    const list = (await as(owner)('GET', '/api/shipments')).body;
    expect(list.some((s: { id: string }) => s.id === created.body.id)).toBe(true);
    expect((await member('POST', '/api/team/invites', { email: 'x@kivu.test' })).status).toBe(403);
    const issued = await member('POST', `/api/shipments/${created.body.id}/issue`, { acknowledgeWarnings: true });
    const docId = issued.body.documents[0].id;
    expect((await member('POST', `/api/documents/${docId}/revoke`, { reason: 'test' })).status).toBe(403);
    expect((await as(owner)('POST', `/api/documents/${docId}/revoke`, { reason: 'test run' })).status).toBe(200);
  });

  it('protects the last owner and removes members cleanly', async () => {
    const team = (await as(owner)('GET', '/api/team')).body;
    const me = team.members.find((m: { email: string }) => m.email === 'owner@kivu.test');
    const clerk = team.members.find((m: { email: string }) => m.email === 'clerk@kivu.test');
    expect((await as(owner)('DELETE', `/api/team/members/${me.id}`)).status).toBe(409);
    expect((await as(owner)('PUT', `/api/team/members/${me.id}`, { role: 'member' })).status).toBe(409);
    expect((await as(owner)('DELETE', `/api/team/members/${clerk.id}`)).status).toBe(200);
    expect((await as(memberCookie)('GET', '/api/auth/me')).status).toBe(401); // session revoked
    const after = (await as(owner)('GET', '/api/team')).body.members;
    expect(after.map((m: { email: string }) => m.email)).toEqual(['owner@kivu.test']);
  });
});

describe('passwords', () => {
  it('forgot/reset works, is single-use and signs out other sessions', async () => {
    const other = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'owner@kivu.test', password: 'a long enough password' } });
    const otherCookie = String(other.headers['set-cookie']).split(';')[0]!;
    const unknown = await as('')('POST', '/api/auth/password/forgot', { email: 'nobody@kivu.test' });
    const known = await as('')('POST', '/api/auth/password/forgot', { email: 'owner@kivu.test' });
    expect(unknown.body).toEqual(known.body); // no account enumeration
    const token = lastLink('owner@kivu.test', /\/reset-password\/(\S+)/);
    const reset = await as('')('POST', '/api/auth/password/reset', { token, password: 'a brand new password' });
    expect(reset.status).toBe(200);
    expect((await as(otherCookie)('GET', '/api/auth/me')).status).toBe(401);
    expect((await as('')('POST', '/api/auth/password/reset', { token, password: 'another new password' })).status).toBe(400);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'owner@kivu.test', password: 'a brand new password' } });
    expect(login.statusCode).toBe(200);
    owner = String(login.headers['set-cookie']).split(';')[0]!;
  });

  it('change password needs the current one and keeps only this session', async () => {
    const second = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'owner@kivu.test', password: 'a brand new password' } });
    const secondCookie = String(second.headers['set-cookie']).split(';')[0]!;
    expect((await as(owner)('POST', '/api/auth/password/change', { current: 'wrong', next: 'yet another password' })).status).toBe(400);
    expect((await as(owner)('POST', '/api/auth/password/change', { current: 'a brand new password', next: 'yet another password' })).status).toBe(200);
    expect((await as(owner)('GET', '/api/auth/me')).status).toBe(200);
    expect((await as(secondCookie)('GET', '/api/auth/me')).status).toBe(401);
  });
});

describe('anchoring status', () => {
  it('reports cost accounting', async () => {
    await ctx.deps.anchor.run();
    const res = await as(admin)('GET', '/api/admin/anchor');
    expect(res.body.cost).toMatchObject({ batches: expect.any(Number), perDocumentNative: expect.any(Number) });
  });
});

describe('share links', () => {
  let shipmentId = '';
  let url = '';
  let shareId = '';

  it('shares an issued bundle and logs views and downloads', async () => {
    const { id: _id, ...draft } = demoShipment();
    const created = await as(owner)('POST', '/api/shipments', draft);
    shipmentId = created.body.id;
    expect((await as(owner)('POST', `/api/shipments/${shipmentId}/shares`, { label: 'Savannah Roasters' })).status).toBe(409); // not issued yet
    await as(owner)('POST', `/api/shipments/${shipmentId}/issue`, { acknowledgeWarnings: true });
    const share = await as(owner)('POST', `/api/shipments/${shipmentId}/shares`, { label: 'Savannah Roasters', days: 14 });
    expect(share.status).toBe(201);
    url = share.body.url;
    shareId = share.body.id;
    const token = url.split('/s/')[1];

    const pub = await as('')('GET', `/api/shares/${token}`);
    expect(pub.body.sharedBy).toBe('Kivu Fresh Ltd');
    expect(pub.body.documents).toHaveLength(3);
    expect(JSON.stringify(pub.body)).not.toContain('unitPrice'); // no commercial terms beyond the documents
    const pdf = await app.inject({ method: 'GET', url: `/api/shares/${token}/documents/${pub.body.documents[0].id}/pdf` });
    expect(pdf.headers['content-type']).toBe('application/pdf');
    // documents of other shipments are not reachable through this link
    const other = ctx.deps.db.get<{ id: string }>('SELECT id FROM documents WHERE shipment_id != ? LIMIT 1', shipmentId);
    if (other) expect((await app.inject({ method: 'GET', url: `/api/shares/${token}/documents/${other.id}/pdf` })).statusCode).toBe(404);

    const list = (await as(owner)('GET', `/api/shipments/${shipmentId}/shares`)).body;
    expect(list[0]).toMatchObject({ label: 'Savannah Roasters', views: 1, downloads: 1 });
  });

  it('activity feed shows share views and verifications', async () => {
    const shipment = (await as(owner)('GET', `/api/shipments/${shipmentId}`)).body;
    await as('')('GET', `/api/verify/${shipment.documents[0].id}`);
    const feed = (await as(owner)('GET', '/api/activity')).body;
    const texts = feed.map((e: { text: string }) => e.text).join('\n');
    expect(texts).toContain('Savannah Roasters opened the shared documents');
    expect(texts).toContain('was verified');
  });

  it('the exporter viewing their own documents is not counted as outside activity', async () => {
    const shipment = (await as(owner)('GET', `/api/shipments/${shipmentId}`)).body;
    const count = () => ctx.deps.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM verification_events WHERE document_id = ?', shipment.documents[0].id)!.n;
    const before = count();
    await as(owner)('GET', `/api/verify/${shipment.documents[0].id}`);
    expect(count()).toBe(before);
    await as('')('GET', `/api/verify/${shipment.documents[0].id}`);
    expect(count()).toBe(before + 1);
  });

  it('revoked links stop working', async () => {
    await as(owner)('DELETE', `/api/shares/${shareId}`);
    expect((await as('')('GET', `/api/shares/${url.split('/s/')[1]}`)).status).toBe(404);
  });
});

describe('API keys', () => {
  it('create, use as Bearer, cannot manage keys, revoke', async () => {
    const created = await as(owner)('POST', '/api/api-keys', { name: 'Forwarder TMS' });
    expect(created.status).toBe(201);
    const key: string = created.body.key;
    expect(key.startsWith('sc_live_')).toBe(true);
    const bearer = { authorization: `Bearer ${key}` };
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer });
    expect(me.json()).toMatchObject({ org: { name: 'Kivu Fresh Ltd' }, via: 'api_key' });
    const { id: _id, ...draft } = demoShipment();
    expect((await app.inject({ method: 'POST', url: '/api/shipments', headers: bearer, payload: draft })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/api/api-keys', headers: bearer, payload: { name: 'x' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/auth/password/change', headers: bearer, payload: { current: 'x', next: 'yyyyyyyyyyyy' } })).statusCode).toBe(403);
    const listed = (await as(owner)('GET', '/api/api-keys')).body;
    expect(listed[0].prefix).toBe(key.slice(0, 14));
    expect(JSON.stringify(listed)).not.toContain(key);
    await as(owner)('DELETE', `/api/api-keys/${created.body.id}`);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer })).statusCode).toBe(401);
  });
});

describe('fraud signal learning loop', () => {
  it('records outcomes and reports signal precision', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const make = async (lines: string[], producer: string) => {
      const d = await PDFDocument.create();
      const p = d.addPage();
      const f = await d.embedFont(StandardFonts.Helvetica);
      lines.forEach((l, i) => p.drawText(l, { x: 40, y: 760 - i * 16, size: 11, font: f }));
      d.setProducer(producer);
      return d.save();
    };
    const post = async (bytes: Uint8Array, name: string) => {
      const boundary = '----t' + Math.random().toString(16).slice(2);
      const payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${name}"\r\nContent-Type: application/pdf\r\n\r\n`),
        Buffer.from(bytes),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return (await app.inject({ method: 'POST', url: '/api/forensics', headers: { cookie: owner, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload })).json();
    };
    const fake = await post(await make(['EAC CERTIFICATE OF ORIGIN', 'Coltan 2615.90.00'], 'Canva'), 'fake.pdf');
    const okDoc = await post(await make(['COMMERCIAL INVOICE', 'Invoice No: A-1', 'Coffee 0901.11.00'], 'Canva'), 'ok.pdf');
    expect((await as(owner)('PUT', `/api/forensics/${fake.id}/outcome`, { outcome: 'fraud', note: 'Chamber confirmed forgery' })).status).toBe(200);
    await as(owner)('PUT', `/api/forensics/${okDoc.id}/outcome`, { outcome: 'genuine' });
    const perf = (await as(admin)('GET', '/api/admin/signal-performance')).body;
    expect(perf.labelled).toBe(2);
    const editing = perf.signals.find((s: { code: string }) => s.code === 'EDITING_TOOL');
    expect(editing).toMatchObject({ fired: 2, fraud: 1, genuine: 1, precision: 0.5 });
    expect((await as(owner)('GET', '/api/admin/signal-performance')).status).toBe(403);
  });
});

describe('simplified certificate of origin (STR)', () => {
  it('is issued for small consignments and withdrawn when the value grows past the ceiling', async () => {
    const { id: _id, ...base } = demoShipment({ freight: 0 });
    const small = { ...base, items: [{ ...base.items[1]!, quantity: 100, netWeightKg: 100, grossWeightKg: 109, packageCount: 10 }] };
    const created = await as(owner)('POST', '/api/shipments', small);
    const issued = await as(owner)('POST', `/api/shipments/${created.body.id}/issue`, { acknowledgeWarnings: true });
    const kinds = issued.body.documents.map((d: { kind: string }) => d.kind).sort();
    expect(kinds).toEqual(['certificate_of_origin', 'commercial_invoice', 'packing_list', 'simplified_certificate_of_origin']);
    const scoo = issued.body.documents.find((d: { kind: string }) => d.kind === 'simplified_certificate_of_origin');
    expect(scoo.number).toMatch(/^SC-RWKE-SC-\d{4}-\d{5}$/);

    const bigger = { ...small, items: [{ ...small.items[0]!, quantity: 1000, netWeightKg: 1000, grossWeightKg: 1090, packageCount: 100 }] };
    await as(owner)('PUT', `/api/shipments/${created.body.id}`, bigger);
    const v2 = await as(owner)('POST', `/api/shipments/${created.body.id}/issue`, { acknowledgeWarnings: true });
    expect(v2.body.documents.map((d: { kind: string }) => d.kind)).not.toContain('simplified_certificate_of_origin');
    const old = (await as('')('GET', `/api/verify/${scoo.id}`)).body;
    expect(old.verdict).toBe('superseded');
    expect(old.document.supersededBy).toBeNull();
  });
});

describe('tamper alerts and network fraud intelligence', () => {
  let buyer = '';
  const upload = async (cookie: string, bytes: Uint8Array, name = 'doc.pdf') => {
    const boundary = '----n' + Math.random().toString(16).slice(2);
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${name}"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from(bytes),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return (await app.inject({ method: 'POST', url: '/api/forensics', headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload })).json();
  };
  const pdf = async (lines: string[]) => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const d = await PDFDocument.create();
    const p = d.addPage();
    const f = await d.embedFont(StandardFonts.Helvetica);
    lines.forEach((l, i) => p.drawText(l, { x: 40, y: 760 - i * 16, size: 11, font: f }));
    return d.save();
  };
  const outboxCount = (to: string, like: string) =>
    ctx.deps.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM outbox WHERE to_email = ? AND subject LIKE ?', to, like)!.n;

  beforeAll(async () => {
    buyer = await register('bank@buyer.test', 'Buyer Bank Ltd');
  });

  it('emails the issuer once when an altered copy is presented publicly', async () => {
    const { id: _id, ...draft } = demoShipment();
    const s = await as(owner)('POST', '/api/shipments', draft);
    const issued = await as(owner)('POST', `/api/shipments/${s.body.id}/issue`, { acknowledgeWarnings: true });
    const doc = issued.body.documents[0];
    const before = outboxCount('owner@kivu.test', 'Alert:%');
    for (let i = 0; i < 3; i++) await as('')('GET', `/api/verify/${doc.id}?sha256=${'ab'.repeat(32)}`);
    expect(outboxCount('owner@kivu.test', 'Alert:%')).toBe(before + 1); // throttled
  });

  it('warns every user about a file someone else reported as fraud', async () => {
    const fake = await pdf(['CERTIFICATE OF ORIGIN', 'Certificate No: RRA/CO/2026/1111', 'Coltan 2615.90.00']);
    const first = await upload(buyer, fake);
    expect(first.signals.map((x: { code: string }) => x.code)).not.toContain('KNOWN_FRAUD');
    await as(buyer)('PUT', `/api/forensics/${first.id}/outcome`, { outcome: 'fraud' });
    const second = await upload(owner, fake);
    expect(second.signals[0]).toMatchObject({ code: 'KNOWN_FRAUD', level: 'critical' });
    expect(JSON.stringify(second)).not.toContain('Buyer Bank'); // no leak of who reported it
  });

  it('detects different versions of the same certificate number across users', async () => {
    const a = await pdf(['CERTIFICATE OF ORIGIN', 'Certificate No: RRA/CO/2026/7788', 'Coffee 0901.11.00 9600 kg']);
    const b = await pdf(['CERTIFICATE OF ORIGIN', 'Certificate No: RRA-CO-2026-7788', 'Coffee 0901.11.00 19600 kg']);
    await upload(buyer, a);
    const res = await upload(owner, b);
    const sig = res.signals.find((x: { code: string }) => x.code === 'CONFLICTING_COPIES');
    expect(sig.level).toBe('high');
    expect(res.risk.level).not.toBe('low');
  });

  it('alerts the issuer when another user checks an altered copy of their document', async () => {
    const { id: _id, ...draft } = demoShipment();
    const s = await as(owner)('POST', '/api/shipments', { ...draft, invoiceNumber: 'KIVU-ALERT-1' });
    const issued = await as(owner)('POST', `/api/shipments/${s.body.id}/issue`, { acknowledgeWarnings: true });
    const co = issued.body.documents.find((d: { kind: string }) => d.kind === 'certificate_of_origin');
    const original = new Uint8Array((await app.inject({ method: 'GET', url: `/api/documents/${co.id}/pdf`, headers: { cookie: owner } })).rawPayload);
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const d = await PDFDocument.load(original);
    d.getPage(0).drawText('Quantity 19,600 KG', { x: 300, y: 500, size: 9, font: await d.embedFont(StandardFonts.Helvetica) });
    const before = outboxCount('owner@kivu.test', `Alert: an altered copy of ${co.number}%`);
    const res = await upload(buyer, await d.save());
    expect(res.claimed.number).toBe(co.number);
    expect(outboxCount('owner@kivu.test', `Alert: an altered copy of ${co.number}%`)).toBe(before + 1);
  });

  it('verification reports how many parties have checked a document', async () => {
    const list = (await as(owner)('GET', '/api/shipments')).body;
    const detail = (await as(owner)('GET', `/api/shipments/${list[0].id}`)).body;
    await as('')('GET', `/api/verify/${detail.documents[0].id}`); // an earlier outside check
    const v = (await as('')('GET', `/api/verify/${detail.documents[0].id}`)).body;
    expect(v.checks).toMatchObject({ parties: expect.any(Number), possibleReuse: false });
    expect(v.checks.parties).toBeGreaterThanOrEqual(1);
  });
});
