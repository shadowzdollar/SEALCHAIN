import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';
import { changePlan, orgPlan, planForPeriod } from '../src/services/plans';
import type { Db } from '../src/db';
import type { Config } from '../src/config';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-plans-'));
let app: FastifyInstance;
let db: Db;
let cfg: Config;
let owner = '';
let member = '';
let orgId = '';
let ownerId = '';

const as = (cookie: string) => async (method: 'GET' | 'POST', url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, headers: cookie ? { cookie } : {}, payload: payload as never });
  return { status: r.statusCode, body: r.json() };
};
const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers['set-cookie']).split(';')[0]!;

beforeAll(async () => {
  Object.assign(process.env, { DATA_DIR: dataDir, ANCHOR_MODE: 'local', PLAN_PILOT_SEATS: '2' });
  delete process.env.RPC_URL;
  cfg = loadConfig();
  const built = await buildApp(cfg, { logger: false, startAnchoring: false });
  app = built.app;
  db = built.deps.db;
  await app.ready();
  owner = cookieOf(await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Kivu Tea Growers', name: 'Jean', email: 'jean@kivu.test', password: 'a long enough password' } }));
  const me = await as(owner)('GET', '/api/auth/me');
  orgId = me.body.org.id;
  ownerId = me.body.user.id;
  const inv = await as(owner)('POST', '/api/team/invites', { email: 'clerk@kivu.test', role: 'member' });
  member = cookieOf(await app.inject({ method: 'POST', url: `/api/invites/${inv.body.inviteUrl.split('/invite/')[1]}/accept`, payload: { name: 'Clerk', password: 'clerk password 123' } }));
});

afterAll(async () => {
  await app.close();
  delete process.env.PLAN_PILOT_SEATS;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('subscription plans', () => {
  it('lists plans with the org on Pilot by default', async () => {
    const r = await as(owner)('GET', '/api/plans');
    expect(r.status).toBe(200);
    expect(r.body.current).toBe('pilot');
    expect(r.body.plans.map((p: { id: string }) => p.id)).toEqual(['pilot', 'growth', 'enterprise']);
    expect(r.body.usage).toMatchObject({ seats: 2, seatLimit: 2 });
  });

  it('enforces team seats on invites', async () => {
    const r = await as(owner)('POST', '/api/team/invites', { email: 'third@kivu.test', role: 'member' });
    expect(r.status).toBe(402);
    expect(r.body.error).toBe('plan_limit');
  });

  it('only owners can change plans, and Enterprise goes through sales', async () => {
    expect((await as(member)('POST', '/api/plans/change', { plan: 'growth' })).status).toBe(403);
    const ent = await as(owner)('POST', '/api/plans/change', { plan: 'enterprise' });
    expect(ent.status).toBe(400);
    expect(ent.body.error).toBe('contact_sales');
  });

  it('will not upgrade without a payment', async () => {
    const r = await as(owner)('POST', '/api/plans/change', { plan: 'growth' });
    expect(r.status).toBe(402);
    expect(r.body.error).toBe('payment_required');
    const quote = await as(owner)('GET', '/api/plans/quote?plan=growth');
    expect(quote.body.amountCents).toBe(cfg.billing.plans.growthMonthlyCents - cfg.billing.monthlyFeeCents);
  });

  it('a declined payment leaves the plan unchanged', async () => {
    const co = await as(owner)('POST', '/api/plans/checkout', { plan: 'growth' });
    expect(co.status).toBe(200);
    expect(co.body.url).toContain('/app/billing/sandbox/');
    const failed = await as(owner)('POST', `/api/billing/sandbox/${co.body.id}`, { outcome: 'fail' });
    expect(failed.body).toMatchObject({ status: 'failed', purpose: 'plan_upgrade', targetPlan: 'growth' });
    expect((await as(owner)('GET', '/api/plans')).body.current).toBe('pilot');
  });

  it('upgrades once the payment is confirmed, and lifts the seat limit', async () => {
    const co = await as(owner)('POST', '/api/plans/checkout', { plan: 'growth' });
    const paid = await as(owner)('POST', `/api/billing/sandbox/${co.body.id}`, { outcome: 'ok' });
    expect(paid.body.status).toBe('succeeded');
    const r = await as(owner)('GET', '/api/plans');
    expect(r.body).toMatchObject({ current: 'growth', pending: null });
    expect((await as(owner)('POST', '/api/team/invites', { email: 'third@kivu.test', role: 'member' })).status).toBe(201);
    const bill = await as(owner)('GET', '/api/billing');
    expect(bill.body.statement.plan).toBe('growth');
    expect(bill.body.statement.pricing.monthlyFeeCents).toBe(cfg.billing.plans.growthMonthlyCents);
  });

  it('refuses a downgrade that would leave too many seats in use', async () => {
    const r = await as(owner)('POST', '/api/plans/change', { plan: 'pilot' });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('too_many_seats');
  });

  it('schedules downgrades for next month, can cancel them, and applies them when the month starts', () => {
    db.run('DELETE FROM invites WHERE org_id = ?', orgId);
    const now = new Date('2026-10-15T10:00:00Z');
    const out = changePlan(db, cfg, orgId, ownerId, 'pilot', now);
    expect(out).toMatchObject({ effective: 'next_period', plan: 'growth', pendingPlan: 'pilot', pendingFrom: '2026-11' });
    // Cancelling keeps Growth and forgets the scheduled change.
    changePlan(db, cfg, orgId, ownerId, 'growth', now);
    expect(orgPlan(db, orgId, now)).toMatchObject({ plan: 'growth', pending_plan: null });
    expect(db.get("SELECT COUNT(*) AS n FROM plan_changes WHERE org_id = ? AND kind = 'downgrade'", orgId)).toMatchObject({ n: 0 });
    // Schedule again; once November starts the downgrade takes effect.
    changePlan(db, cfg, orgId, ownerId, 'pilot', now);
    expect(orgPlan(db, orgId, new Date('2026-11-01T00:05:00Z')).plan).toBe('pilot');
  });

  it('bills each month at the plan that was in force then', () => {
    const history = db.all<{ effective_from: string; to_plan: string }>('SELECT effective_from, to_plan FROM plan_changes WHERE org_id = ? ORDER BY effective_from', orgId);
    const upgradeMonth = history[0]!.effective_from;
    expect(planForPeriod(db, cfg, orgId, '2000-01').id).toBe('pilot');
    expect(planForPeriod(db, cfg, orgId, upgradeMonth).id).toBe('growth');
    expect(planForPeriod(db, cfg, orgId, '2026-11').id).toBe('pilot');
  });
});

describe('personal profile', () => {
  it('reads and updates your own name, job title and phone', async () => {
    const before = await as(owner)('GET', '/api/auth/profile');
    expect(before.body).toMatchObject({ name: 'Jean', email: 'jean@kivu.test', role: 'owner', jobTitle: null });
    const put = await app.inject({ method: 'PUT', url: '/api/auth/profile', headers: { cookie: owner }, payload: { name: 'Jean Uwase', jobTitle: 'Export manager', phone: '+250 788 123 456' } });
    expect(put.json()).toMatchObject({ name: 'Jean Uwase', jobTitle: 'Export manager', phone: '+250 788 123 456' });
    expect((await as(owner)('GET', '/api/auth/me')).body.user.name).toBe('Jean Uwase');
    const bad = await app.inject({ method: 'PUT', url: '/api/auth/profile', headers: { cookie: owner }, payload: { name: 'J', phone: '<script>' } });
    expect(bad.statusCode).toBe(400);
  });
});
