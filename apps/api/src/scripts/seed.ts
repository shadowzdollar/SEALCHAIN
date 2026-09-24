/**
 * Seeds a demo pilot account so the product can be shown end-to-end:
 *
 *   exporter  demo@sealchain.test        / sealchain-demo-2026
 *   compliance compliance@sealchain.test / sealchain-compliance-2026
 *
 * Idempotent: does nothing if the demo exporter already exists. Documents it
 * issues are queued and anchored by the running API server.
 */
import { demoShipment, type Shipment } from '@sealchain/core';
import { loadConfig } from '../config';
import { buildApp } from '../app';

const DEMO = { email: 'demo@sealchain.test', password: 'sealchain-demo-2026' };
const COMPLIANCE = { email: 'compliance@sealchain.test', password: 'sealchain-compliance-2026' };
const OFFICER = { email: 'officer@rra.demo', password: 'sealchain-officer-2026' };

process.env.ADMIN_EMAILS = [process.env.ADMIN_EMAILS, COMPLIANCE.email].filter(Boolean).join(',');
const cfg = loadConfig();
const { app, deps } = await buildApp(cfg, { logger: false, startAnchoring: false });

async function call(method: string, url: string, cookie: string, payload?: unknown) {
  const res = await app.inject({ method: method as 'GET', url, headers: { cookie }, payload: payload as never });
  if (res.statusCode >= 400) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`);
  return res.json();
}

async function register(orgName: string, name: string, creds: { email: string; password: string }) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName, name, ...creds } });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  return String(res.headers['set-cookie']).split(';')[0]!;
}

async function login(creds: { email: string; password: string }) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: creds });
  if (res.statusCode !== 200) throw new Error(`login failed for ${creds.email}`);
  return String(res.headers['set-cookie']).split(';')[0]!;
}

/** Issuing authority + officer, and an endorsed demo certificate. Idempotent. */
async function seedAuthority() {
  if (deps.db.get('SELECT 1 FROM users WHERE email = ?', OFFICER.email)) return false;
  const admin = await login(COMPLIANCE);
  const created = await call('POST', '/api/admin/authorities', admin, { name: 'Rwanda Revenue Authority — Customs (Demo)', country: 'RW', officerEmail: OFFICER.email });
  const token = String(created.inviteUrl).split('/invite/')[1];
  const accept = await app.inject({ method: 'POST', url: `/api/invites/${token}/accept`, payload: { name: 'Officer Jean Mugisha', password: OFFICER.password } });
  const officer = String(accept.headers['set-cookie']).split(';')[0]!;
  const exporter = await login(DEMO);
  const coffee = (await call('GET', '/api/shipments', exporter)).find((x: { reference: string }) => x.reference === 'PO-2026-0147');
  if (coffee) {
    const detail = await call('GET', `/api/shipments/${coffee.id}`, exporter);
    const co = detail.documents.find((d: { kind: string; status: string }) => d.kind === 'certificate_of_origin' && d.status === 'active');
    await call('POST', `/api/documents/${co.id}/endorsements`, exporter, { authorityId: created.id, note: 'Truck departs Friday' });
    const queue = await call('GET', '/api/authority/queue', officer);
    await call('POST', `/api/authority/requests/${queue[0].id}/decision`, officer, { decision: 'endorse' });
  }
  // A second request left pending, so the officer has something to review.
  const tea = (await call('GET', '/api/shipments', exporter)).find((x: { reference: string }) => x.reference === 'PB-2026-022');
  if (tea) {
    const detail = await call('GET', `/api/shipments/${tea.id}`, exporter);
    const co = detail.documents.find((d: { kind: string; status: string }) => d.kind === 'certificate_of_origin' && d.status === 'active');
    await call('POST', `/api/documents/${co.id}/endorsements`, exporter, { authorityId: created.id });
  }
  return true;
}

if (deps.db.get('SELECT 1 FROM users WHERE email = ?', DEMO.email)) {
  const added = await seedAuthority();
  console.log(added ? `Added demo authority. Officer: ${OFFICER.email} / ${OFFICER.password}` : 'Demo data already present — nothing to do.');
  await app.close();
  process.exit(0);
}

const cookie = await register('Ubwiza Coffee Exporters Ltd (Demo)', 'Aline Mukamana', DEMO);
const admin = await register('SealChain Compliance', 'Compliance Team', COMPLIANCE);

const base = demoShipment();
await call('POST', '/api/parties', cookie, { role: 'exporter', party: base.exporter });
await call('POST', '/api/parties', cookie, { role: 'consignee', party: base.consignee });
const kampala = { name: 'Pearl Beverages Uganda Ltd (Demo)', address: 'Plot 4, Jinja Road', city: 'Kampala', country: 'UG', taxId: '1000123456', phone: '+256 700 000 333', email: 'procurement@pearl.example' } as const;
await call('POST', '/api/parties', cookie, { role: 'consignee', party: kampala });

const strip = ({ id: _id, ...rest }: Shipment) => rest;

// 1. Issued coffee shipment to Nairobi.
const coffee = await call('POST', '/api/shipments', cookie, strip(base));
await call('POST', `/api/shipments/${coffee.id}/issue`, cookie, { acknowledgeWarnings: true });

// 2. Issued tea shipment to Kampala.
const tea = demoShipment({
  corridorId: 'RW-UG',
  reference: 'PB-2026-022',
  consignee: kampala,
  incoterm: 'DAP',
  incotermPlace: 'Kampala',
  exitPoint: 'Gatuna',
  entryPoint: 'Katuna',
  finalDestination: 'Kampala',
  invoiceNumber: 'UCE-INV-2026-0094',
  freight: 900,
  insurance: 120,
  items: [{
    id: 't1', description: 'Black tea, CTC grade BP1, bulk in paper sacks', hsCode: '09024000', quantity: 6000, unit: 'KG', unitPrice: 2.85,
    netWeightKg: 6000, grossWeightKg: 6120, packageCount: 100, packageType: 'Multiwall paper sacks (60 kg)', marks: 'UBWIZA TEA / PB-022 / 1-100',
    originCountry: 'RW', originCriterion: 'WO',
  }],
});
const teaRes = await call('POST', '/api/shipments', cookie, strip(tea));
await call('POST', `/api/shipments/${teaRes.id}/issue`, cookie, { acknowledgeWarnings: true });

// 3. Draft with typical mistakes, to show validation.
const avocado = demoShipment({
  reference: 'Avocado trial — Nairobi',
  invoiceNumber: 'UCE-INV-2026-0097',
  incoterm: 'FOB',
  consignee: { ...base.consignee, taxId: '051234567' },
  items: [{
    id: 'a1', description: 'Fresh hass avocados, size 16-20, in cartons', hsCode: '08045000', quantity: 4000, unit: 'KG', unitPrice: 1.9,
    netWeightKg: 4200, grossWeightKg: 4000, packageCount: 1000, packageType: 'Cartons (4 kg)', marks: 'UBWIZA FRESH', originCountry: 'RW', originCriterion: 'WO',
  }],
});
await call('POST', '/api/shipments', cookie, strip(avocado));

// Compliance team confirms one tariff line so both states are visible.
await call('PUT', '/api/admin/tariff/09011100', admin, { cetRate: 35, note: 'Confirmed in demo seed' });

await seedAuthority();

await app.close();
console.log(`Seeded demo data.
  Exporter:   ${DEMO.email} / ${DEMO.password}
  Compliance: ${COMPLIANCE.email} / ${COMPLIANCE.password}
  Authority:  ${OFFICER.email} / ${OFFICER.password}
Documents will be anchored by the running API server.`);
