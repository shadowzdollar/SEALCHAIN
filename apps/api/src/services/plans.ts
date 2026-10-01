/**
 * Subscription plans. Prices come from configuration (env) so commercial
 * terms can change without a deploy; Pilot keeps the original pilot pricing.
 *
 * Rules: upgrades take effect immediately (the current month is billed at the
 * new monthly fee; per-shipment fees use the plan at the moment of issue).
 * Downgrades are scheduled for the first day of next month, so a customer
 * keeps what they paid for, and can be cancelled until then.
 */
import type { Config } from '../config';
import { newId, nowIso, type Db } from '../db';
import { currentPeriod } from './billing';
import { HttpError } from './documents';

export type PlanId = 'pilot' | 'growth' | 'enterprise';
export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyFeeCents: number | null; // null = priced with sales
  perShipmentCents: number | null;
  seats: number | null; // null = unlimited
  features: string[];
  selfServe: boolean;
  rank: number;
}

export function plans(cfg: Config): Plan[] {
  return [
    {
      id: 'pilot', name: 'Pilot', tagline: 'For exporters getting started', rank: 1, selfServe: true,
      monthlyFeeCents: cfg.billing.monthlyFeeCents, perShipmentCents: cfg.billing.perShipmentCents, seats: cfg.billing.plans.pilotSeats,
      features: ['All three documents from one form', 'Rule checks for every corridor', 'Sealed and anchored documents', 'Free verification for everyone', 'Email support'],
    },
    {
      id: 'growth', name: 'Growth', tagline: 'For regular shippers and cooperatives', rank: 2, selfServe: true,
      monthlyFeeCents: cfg.billing.plans.growthMonthlyCents, perShipmentCents: cfg.billing.plans.growthPerShipmentCents, seats: cfg.billing.plans.growthSeats,
      features: ['Everything in Pilot', 'Lower fee per shipment', 'Larger team', 'Fraud screening reports', 'Priority support'],
    },
    {
      id: 'enterprise', name: 'Enterprise', tagline: 'For associations, forwarders and high volumes', rank: 3, selfServe: false,
      monthlyFeeCents: null, perShipmentCents: null, seats: null,
      features: ['Everything in Growth', 'Volume pricing', 'Unlimited team', 'Member onboarding', 'Integration support'],
    },
  ];
}

export function planById(cfg: Config, id: string): Plan {
  return plans(cfg).find((p) => p.id === id) ?? plans(cfg)[0]!;
}

interface OrgPlanRow { plan: string; pending_plan: string | null; pending_from: string | null; plan_changed_at: string | null }

/** Apply a scheduled change once its month has started; returns the org's plan state. */
export function orgPlan(db: Db, orgId: string, now = new Date()): OrgPlanRow {
  const row = db.get<OrgPlanRow>('SELECT plan, pending_plan, pending_from, plan_changed_at FROM orgs WHERE id = ?', orgId)!;
  if (row.pending_plan && row.pending_from && row.pending_from <= currentPeriod(now)) {
    db.run('UPDATE orgs SET plan = ?, pending_plan = NULL, pending_from = NULL, plan_changed_at = ? WHERE id = ?', row.pending_plan, nowIso(), orgId);
    return { plan: row.pending_plan, pending_plan: null, pending_from: null, plan_changed_at: nowIso() };
  }
  return row;
}

/** The plan that governs a given billing period, from the change history. */
export function planForPeriod(db: Db, cfg: Config, orgId: string, period: string): Plan {
  const row = orgPlan(db, orgId);
  const changes = db.all<{ from_plan: string; to_plan: string; effective_from: string }>(
    'SELECT from_plan, to_plan, effective_from FROM plan_changes WHERE org_id = ? ORDER BY effective_from, created_at', orgId,
  );
  if (!changes.length) return planById(cfg, row.plan);
  let id = changes[0]!.from_plan;
  for (const c of changes) if (c.effective_from <= period) id = c.to_plan;
  return planById(cfg, id);
}

export function seatsUsed(db: Db, orgId: string): number {
  const users = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE org_id = ? AND password_hash != 'disabled'", orgId)!.n;
  const invites = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM invites WHERE org_id = ? AND accepted_at IS NULL AND expires_at > ?', orgId, nowIso())!.n;
  return users + invites;
}

export function assertSeatAvailable(db: Db, cfg: Config, orgId: string) {
  const plan = planById(cfg, orgPlan(db, orgId).plan);
  if (plan.seats !== null && seatsUsed(db, orgId) >= plan.seats) {
    throw new HttpError(402, 'plan_limit', `Your ${plan.name} plan includes ${plan.seats} team seats. Upgrade your plan to invite more people.`);
  }
}

/**
 * What an upgrade costs today: the difference between the new and the current
 * monthly fee for this month. The rest of the month's statement is billed as usual.
 */
export function upgradeQuote(db: Db, cfg: Config, orgId: string, to: string) {
  const target = plans(cfg).find((p) => p.id === to);
  if (!target) throw new HttpError(400, 'invalid_request', 'Unknown plan');
  if (!target.selfServe) throw new HttpError(400, 'contact_sales', 'Enterprise is arranged with our team — get in touch and we’ll set it up.');
  const current = planById(cfg, orgPlan(db, orgId).plan);
  if (target.rank <= current.rank) throw new HttpError(400, 'not_an_upgrade', `${target.name} is not an upgrade from ${current.name}.`);
  const amountCents = Math.max(0, (target.monthlyFeeCents ?? 0) - (current.monthlyFeeCents ?? 0));
  return { from: current, to: target, amountCents };
}

function nextPeriod(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return currentPeriod(d);
}

export function changePlan(db: Db, cfg: Config, orgId: string, userId: string, to: string, now = new Date(), opts: { paid?: boolean } = {}) {
  const target = plans(cfg).find((p) => p.id === to);
  if (!target) throw new HttpError(400, 'invalid_request', 'Unknown plan');
  if (!target.selfServe) throw new HttpError(400, 'contact_sales', 'Enterprise is arranged with our team — get in touch and we’ll set it up.');
  const row = orgPlan(db, orgId, now);
  const current = planById(cfg, row.plan);
  // Any new decision replaces a downgrade that was waiting for next month.
  const dropPending = () => {
    if (!row.pending_plan) return;
    db.run('UPDATE orgs SET pending_plan = NULL, pending_from = NULL WHERE id = ?', orgId);
    db.run("DELETE FROM plan_changes WHERE org_id = ? AND kind = 'downgrade' AND effective_from = ?", orgId, row.pending_from);
  };
  if (current.id === target.id) {
    dropPending();
    return { effective: 'now' as const, plan: current.id, pendingPlan: null, pendingFrom: null };
  }
  const upgrade = target.rank > current.rank;
  if (upgrade && !opts.paid) throw new HttpError(402, 'payment_required', `Upgrading to ${target.name} needs a payment. Continue to checkout to upgrade.`);
  dropPending();
  if (!upgrade && target.seats !== null && seatsUsed(db, orgId) > target.seats) {
    throw new HttpError(409, 'too_many_seats', `${target.name} includes ${target.seats} team seats and you use ${seatsUsed(db, orgId)}. Remove people or invites first.`);
  }
  const at = nowIso();
  if (upgrade) {
    db.run('UPDATE orgs SET plan = ?, pending_plan = NULL, pending_from = NULL, plan_changed_at = ? WHERE id = ?', target.id, at, orgId);
  } else {
    db.run('UPDATE orgs SET pending_plan = ?, pending_from = ? WHERE id = ?', target.id, nextPeriod(now), orgId);
  }
  db.insert('plan_changes', {
    id: newId('plc', 16), org_id: orgId, from_plan: current.id, to_plan: target.id, kind: upgrade ? 'upgrade' : 'downgrade',
    effective_from: upgrade ? currentPeriod(now) : nextPeriod(now), changed_by: userId, created_at: at,
  });
  return upgrade
    ? { effective: 'now' as const, plan: target.id, pendingPlan: null, pendingFrom: null }
    : { effective: 'next_period' as const, plan: current.id, pendingPlan: target.id, pendingFrom: nextPeriod(now) };
}
