/**
 * End-to-end API tests on an isolated data directory with the local ledger
 * backend (the EVM backend is exercised by scripts/e2e.mjs against a chain).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { demoShipment, verifyMerkleProof } from '@sealchain/core';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp, type App } from '../src/app';

let ctx: App;
let app: FastifyInstance;
let cookie = '';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-test-'));

function multipart(files: Record<string, { filename: string; bytes: Uint8Array; type?: string }>, fields: Record<string, string> = {}) {
  const boundary = `----sealchain${crypto.randomBytes(8).toString('hex')}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const [name, f] of Object.entries(files)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${f.filename}"\r\nContent-Type: ${f.type ?? 'application/pdf'}\r\n\r\n`));
    chunks.push(Buffer.from(f.bytes));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown, extraHeaders: Record<string, string> = {}) => {
  const res = await app.inject({ method, url, payload: body as never, headers: { cookie, ...extraHeaders } });
  return { status: res.statusCode, body: res.headers['content-type']?.includes('json') ? res.json() : res.rawPayload, headers: res.headers };
};

beforeAll(async () => {
  process.env.DATA_DIR = dataDir;
  process.env.ANCHOR_MODE = 'local';
  process.env.ADMIN_EMAILS = 'compliance@sealchain.test';
  process.env.ANCHOR_INTERVAL_MS = '3600000';
  delete process.env.RPC_URL;
  ctx = await buildApp(loadConfig(), { logger: false, startAnchoring: false });
  app = ctx.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('SealChain API', () => {
  let shipmentId = '';
  let docs: Array<{ id: string; kind: string; number: string; sha256: string }> = [];
  let coPdf: Uint8Array;

  it('registers an exporter organisation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Ubwiza Coffee Exporters', name: 'Aline M.', email: 'aline@ubwiza.test', password: 'correct horse battery' },
    });
    expect(res.statusCode).toBe(201);
    cookie = String(res.headers['set-cookie']).split(';')[0]!;
    const me = await call('GET', '/api/auth/me');
    expect(me.body.org.name).toBe('Ubwiza Coffee Exporters');
  });

  it('rejects bad credentials without revealing which part was wrong', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nobody@x.test', password: 'whatever' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe('Email or password is incorrect.');
  });

  it('suggests tariff codes', async () => {
    const res = await call('GET', '/api/tariff/search?q=green%20coffee%20beans');
    expect(res.body.results[0].line.code).toBe('09011100');
  });

  it('creates a draft and validates it', async () => {
    const { id: _id, ...draft } = demoShipment();
    const res = await call('POST', '/api/shipments', draft);
    expect(res.status).toBe(201);
    shipmentId = res.body.id;
    expect(res.body.validation.counts.error).toBe(0);
    expect(res.body.validation.status).toBe('review');
  });

  it('blocks issuance while there are errors', async () => {
    const { id: _id, ...draft } = demoShipment();
    const bad = { ...draft, exporter: { ...draft.exporter, taxId: 'nope' } };
    const created = await call('POST', '/api/shipments', bad);
    const res = await call('POST', `/api/shipments/${created.body.id}/issue`, {});
    expect(res.status).toBe(422);
    expect(res.body.details.findings.map((f: { code: string }) => f.code)).toContain('EXPORTER_TAX_ID_FORMAT');
  });

  it('requires warnings to be acknowledged', async () => {
    const res = await call('POST', `/api/shipments/${shipmentId}/issue`, {});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('warnings_unacknowledged');
  });

  it('issues the corridor document bundle', async () => {
    const res = await call('POST', `/api/shipments/${shipmentId}/issue`, { acknowledgeWarnings: true });
    expect(res.status).toBe(200);
    docs = res.body.documents;
    expect(docs.map((d) => d.kind).sort()).toEqual(['certificate_of_origin', 'commercial_invoice', 'packing_list']);
    expect(docs.every((d) => /^SC-RWKE-(CI|CO|PL)-\d{4}-\d{5}$/.test(d.number))).toBe(true);
  });

  it('serves PDFs whose hash matches the registry', async () => {
    const co = docs.find((d) => d.kind === 'certificate_of_origin')!;
    const res = await app.inject({ method: 'GET', url: `/api/documents/${co.id}/pdf`, headers: { cookie } });
    expect(res.headers['content-type']).toBe('application/pdf');
    coPdf = new Uint8Array(res.rawPayload);
    expect(crypto.createHash('sha256').update(coPdf).digest('hex')).toBe(co.sha256);
    // other orgs cannot download it
    const anon = await app.inject({ method: 'GET', url: `/api/documents/${co.id}/pdf` });
    expect(anon.statusCode).toBe(401);
  });

  it('reports pending anchoring before the batch runs', async () => {
    const co = docs.find((d) => d.kind === 'certificate_of_origin')!;
    const res = await call('GET', `/api/verify/${co.id}`);
    expect(res.body.verdict).toBe('authentic_pending_anchor');
    expect(res.body.anchor.status).toBe('queued');
  });

  it('anchors the batch and verifies publicly', async () => {
    await ctx.deps.anchor.run();
    const co = docs.find((d) => d.kind === 'certificate_of_origin')!;
    const res = await app.inject({ method: 'GET', url: `/api/verify/${co.id}?sha256=${co.sha256}` });
    const v = res.json();
    expect(v.verdict).toBe('authentic');
    expect(v.integrity.matches).toBe(true);
    expect(v.signature.valid).toBe(true);
    expect(v.anchor.status).toBe('confirmed');
    expect(v.anchor.leafCount).toBe(3);
    expect(v.anchor.onChain.anchoredAt).toBeTruthy();
    // proof is independently checkable
    expect(verifyMerkleProof(co.sha256, v.anchor.proof, v.anchor.root)).toBe(true);
    expect(v.document.summary.items[0].hsCode).toBe('09011100');
    expect(v.document.summary.invoiceTotal).toBeUndefined(); // CoO does not leak invoice values
  });

  it('verifies by hash and by file upload', async () => {
    const co = docs.find((d) => d.kind === 'certificate_of_origin')!;
    const byHash = await app.inject({ method: 'GET', url: `/api/verify/hash/${co.sha256}` });
    expect(byHash.json().verdict).toBe('authentic');
    const up = multipart({ file: { filename: 'coo.pdf', bytes: coPdf } });
    const byFile = await app.inject({ method: 'POST', url: '/api/verify/file', ...up });
    expect(byFile.json().verdict).toBe('authentic');
  });

  it('detects a tampered copy and pinpoints the change', async () => {
    const doc = await PDFDocument.load(coPdf);
    const page = doc.getPage(0);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Country of origin: KENYA', { x: 330, y: 700, size: 9, font });
    const forged = await doc.save();

    const up = multipart({ file: { filename: 'coo-edited.pdf', bytes: forged } });
    const pub = (await app.inject({ method: 'POST', url: '/api/verify/file', ...up })).json();
    expect(pub.verdict).toBe('tampered');
    expect(pub.integrity.matches).toBe(false);

    const fr = multipart({ document: { filename: 'coo-edited.pdf', bytes: forged } });
    const analysis = (await app.inject({ method: 'POST', url: '/api/forensics', headers: { cookie, ...fr.headers }, payload: fr.payload })).json();
    expect(analysis.risk.level).toBe('high');
    expect(analysis.signals[0].code).toBe('ALTERED_AFTER_ISSUANCE');
    expect(analysis.claimed.changes.added.join(' ')).toContain('KENYA');
  });

  it('flags fabricated SealChain references', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = ['EAC CERTIFICATE OF ORIGIN', 'Certificate No: SC-RWKE-CO-2026-99999', 'Exporter', 'Fake Minerals Ltd', 'Coltan 2615.90.00 WO 5000 kg', 'Invoice No: FM-001'];
    lines.forEach((l, i) => page.drawText(l, { x: 50, y: 750 - i * 16, size: 11, font }));
    doc.setProducer('Canva');
    const bytes = await doc.save();
    const fr = multipart({ document: { filename: 'fake.pdf', bytes } });
    const analysis = (await app.inject({ method: 'POST', url: '/api/forensics', headers: { cookie, ...fr.headers }, payload: fr.payload })).json();
    const codes = analysis.signals.map((s: { code: string }) => s.code);
    expect(codes).toContain('FABRICATED_REFERENCE');
    expect(codes).toContain('EDITING_TOOL');
    expect(codes).toContain('HIGH_RISK_COMMODITY');
    expect(analysis.risk.level).toBe('high');
  });

  it('recognises an exact registered document in forensics', async () => {
    const fr = multipart({ document: { filename: 'coo.pdf', bytes: coPdf } });
    const analysis = (await app.inject({ method: 'POST', url: '/api/forensics', headers: { cookie, ...fr.headers }, payload: fr.payload })).json();
    expect(analysis.registered.number).toMatch(/^SC-RWKE-CO/);
    expect(analysis.risk.level).toBe('low');
  });

  it('re-issuing supersedes the previous version', async () => {
    const current = await call('GET', `/api/shipments/${shipmentId}`);
    const data = { ...current.body.data, transportRef: 'RAE 555 B' };
    delete data.id;
    await call('PUT', `/api/shipments/${shipmentId}`, data);
    const stale = await call('GET', `/api/shipments/${shipmentId}`);
    expect(stale.body.documentsOutOfDate).toBe(true);
    const res = await call('POST', `/api/shipments/${shipmentId}/issue`, { acknowledgeWarnings: true });
    expect(res.body.version).toBe(2);
    const oldCo = docs.find((d) => d.kind === 'certificate_of_origin')!;
    const v = (await app.inject({ method: 'GET', url: `/api/verify/${oldCo.id}` })).json();
    expect(v.verdict).toBe('superseded');
    expect(v.document.supersededBy.number).toMatch(/^SC-RWKE-CO/);
  });

  it('revocation is reflected in verification', async () => {
    const shipment = await call('GET', `/api/shipments/${shipmentId}`);
    const inv = shipment.body.documents.find((d: { kind: string; status: string }) => d.kind === 'commercial_invoice' && d.status === 'active');
    await call('POST', `/api/documents/${inv.id}/revoke`, { reason: 'Buyer cancelled order' });
    const v = (await app.inject({ method: 'GET', url: `/api/verify/${inv.id}` })).json();
    expect(v.verdict).toBe('revoked');
    expect(v.document.revokedReason).toBe('Buyer cancelled order');
  });

  it('meters the per-shipment fee once per shipment', async () => {
    const res = await call('GET', '/api/billing');
    expect(res.body.statement.shipments).toBe(1); // re-issue was free
    expect(res.body.statement.totalCents).toBe(1500 + 300);
  });

  it('dashboard aggregates activity', async () => {
    const res = await call('GET', '/api/dashboard');
    expect(res.body.shipments.issued).toBe(1);
    expect(res.body.verifications.total).toBeGreaterThan(0);
    expect(res.body.dutySavedUsd).toBeGreaterThan(20000);
  });

  it('compliance team verifies rules and turns warnings off', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'SealChain Compliance', name: 'Compliance', email: 'compliance@sealchain.test', password: 'another long password' },
    });
    const adminCookie = String(reg.headers['set-cookie']).split(';')[0]!;
    const forbidden = await call('GET', '/api/admin/rules');
    expect(forbidden.status).toBe(403);
    const ok = await app.inject({ method: 'POST', url: '/api/admin/rules/RW-KE/verify', headers: { cookie: adminCookie }, payload: { note: 'Checked against gazette' } });
    expect(ok.statusCode).toBe(200);
    await app.inject({ method: 'PUT', url: '/api/admin/tariff/09011100', headers: { cookie: adminCookie }, payload: { cetRate: 35 } });
    const { id: _id, ...draft } = demoShipment();
    const v = await call('POST', '/api/shipments/validate', draft);
    expect(v.body.findings.map((f: { code: string }) => f.code)).not.toContain('RULESET_UNVERIFIED');
  });

  it('rejects malformed verification requests', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/verify/not-an-id' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: `/api/verify/doc_${'a'.repeat(20)}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/verify/hash/${'0'.repeat(64)}` })).json().verdict).toBe('not_found');
  });
});
