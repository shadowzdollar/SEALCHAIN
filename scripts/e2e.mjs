#!/usr/bin/env node
/**
 * End-to-end check against a running stack (`pnpm dev`):
 * register → draft → validate → issue → wait for the on-chain anchor →
 * verify by hash → query the chain directly over JSON-RPC → tamper → detect.
 *
 *   API_URL=http://127.0.0.1:4100 pnpm e2e
 */
import crypto from 'node:crypto';

const API = (process.env.API_URL ?? 'http://127.0.0.1:4100').replace(/\/$/, '');
let cookie = '';
let step = 0;

async function call(method, path, body, raw = false) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body && !isForm ? { 'content-type': 'application/json' } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  if (raw) return res;
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function ok(cond, msg) {
  step++;
  if (!cond) {
    console.error(`  ✗ ${step}. ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${step}. ${msg}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

console.log(`SealChain end-to-end against ${API}\n`);

const meta = (await call('GET', '/meta')).data;
ok(meta?.corridors?.length >= 1, `API up; anchoring backend: ${meta.anchor.networkName}`);

const email = `e2e-${Date.now()}@sealchain.test`;
const reg = await call('POST', '/auth/register', { orgName: 'E2E Exports Ltd', name: 'E2E Runner', email, password: 'e2e-password-123' });
ok(reg.status === 201, `registered ${email}`);

const suggest = (await call('GET', '/tariff/search?q=fresh%20hass%20avocados')).data;
ok(suggest.results[0]?.line.code === '08044000', `tariff suggestion for avocados → ${suggest.results[0]?.line.code}`);

const shipment = {
  reference: 'E2E avocado run',
  corridorId: 'RW-KE',
  exporter: { name: 'E2E Exports Ltd', address: 'KK 15 Rd', city: 'Kigali', country: 'RW', taxId: '109876543' },
  consignee: { name: 'Nairobi Fresh Markets Ltd', address: 'Wakulima Market', city: 'Nairobi', country: 'KE', taxId: 'P051111111Z' },
  currency: 'USD', incoterm: 'CPT', incotermPlace: 'Nairobi', transportMode: 'road', placeOfLoading: 'Kigali',
  exitPoint: 'Gatuna', entryPoint: 'Malaba', finalDestination: 'Nairobi', transportRef: 'RAE 001 E', departureDate: today,
  invoiceNumber: `E2E-${Date.now()}`, invoiceDate: today, freight: 1200, insurance: 0, otherCharges: 0,
  items: [{ id: 'x1', description: 'Fresh hass avocados, size 16-20', hsCode: '08044000', quantity: 5000, unit: 'KG', unitPrice: 1.8, netWeightKg: 5000, grossWeightKg: 5400, packageCount: 1250, packageType: 'Cartons (4 kg)', marks: 'E2E', originCountry: 'RW', originCriterion: 'WO' }],
};
const created = await call('POST', '/shipments', shipment);
ok(created.status === 201 && created.data.validation.counts.error === 0, `draft created, ${created.data.validation.counts.warning} warning(s), duty protected ${created.data.validation.duty.savings} USD`);

const blocked = await call('POST', `/shipments/${created.data.id}/issue`, {});
ok(blocked.status === 409, 'issuing without acknowledging warnings is refused');

const issued = await call('POST', `/shipments/${created.data.id}/issue`, { acknowledgeWarnings: true });
ok(issued.status === 200 && issued.data.documents.length === 3, `issued ${issued.data.documents.map((d) => d.number).join(', ')}`);
const co = issued.data.documents.find((d) => d.kind === 'certificate_of_origin');

let verification;
for (let i = 0; i < 60; i++) {
  verification = (await call('GET', `/verify/${co.id}`)).data;
  if (verification.verdict === 'authentic') break;
  await sleep(1000);
}
ok(verification.verdict === 'authentic', `certificate anchored (${verification.anchor.backend}, batch of ${verification.anchor.leafCount}, tx ${verification.anchor.txHash?.slice(0, 12) ?? '—'}…)`);

const pdf = new Uint8Array(await (await call('GET', `/documents/${co.id}/pdf`, undefined, true)).arrayBuffer());
const sha = crypto.createHash('sha256').update(pdf).digest('hex');
ok(sha === co.sha256, `downloaded PDF (${pdf.length} bytes) hashes to the registered fingerprint`);

cookie = '';
const byHash = (await call('GET', `/verify/hash/${sha}`)).data;
ok(byHash.verdict === 'authentic' && byHash.signature.valid, 'anonymous verification by hash: authentic, signature valid');

if (verification.anchor.backend === 'evm' && verification.anchor.publicRpcUrl) {
  // anchoredAt(bytes32) selector = first 4 bytes of keccak256 of the signature.
  const { keccak_256 } = await import('../packages/core/node_modules/@noble/hashes/sha3.js');
  const sel = Buffer.from(keccak_256(new TextEncoder().encode('anchoredAt(bytes32)'))).toString('hex').slice(0, 8);
  const res = await fetch(verification.anchor.publicRpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: verification.anchor.contract, data: `0x${sel}${verification.anchor.root}` }, 'latest'] }),
  });
  const ts = Number(BigInt((await res.json()).result));
  ok(ts > 0, `chain queried directly (no SealChain server): root anchored at ${new Date(ts * 1000).toISOString()}`);
}

const tampered = new Uint8Array(pdf);
const idx = Buffer.from(tampered).indexOf('/Producer');
tampered[idx + 12] ^= 0x01; // flip one bit inside the metadata
const form = new FormData();
form.append('file', new Blob([tampered], { type: 'application/pdf' }), 'tampered.pdf');
const tamperRes = (await call('POST', '/verify/file', form)).data;
ok(tamperRes.verdict === 'tampered', 'one flipped bit → verdict "tampered"');

console.log(`\nAll ${step} checks passed.`);
