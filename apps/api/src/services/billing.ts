/**
 * Pilot billing: a modest monthly subscription plus a per-shipment fee for
 * validation + authenticity anchoring, charged from the first shipment (the
 * brief: willingness to pay is the honest signal). Payments are recorded by
 * platform staff (mobile money / bank transfer references) until a payment
 * provider is integrated.
 */
import type { Config } from '../config';
import { newId, nowIso, type Db } from '../db';

export function currentPeriod(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function recordUsage(db: Db, cfg: Config, orgId: string, shipmentId: string) {
  db.insert('usage_events', {
    id: newId('use', 16),
    org_id: orgId,
    shipment_id: shipmentId,
    kind: 'shipment',
    amount_cents: cfg.billing.perShipmentCents,
    period: currentPeriod(),
    created_at: nowIso(),
  });
}

export function statement(db: Db, cfg: Config, orgId: string, period = currentPeriod()) {
  const org = db.get<{ created_at: string; plan: string; kind: string }>('SELECT created_at, plan, kind FROM orgs WHERE id = ?', orgId)!;
  // Issuing authorities use SealChain free of charge.
  const active = org.kind !== 'authority' && org.created_at.slice(0, 7) <= period;
  const events = db.all<{ id: string; shipment_id: string; amount_cents: number; created_at: string; reference: string | null }>(
    `SELECT u.id, u.shipment_id, u.amount_cents, u.created_at, s.reference
       FROM usage_events u LEFT JOIN shipments s ON s.id = u.shipment_id
      WHERE u.org_id = ? AND u.period = ? ORDER BY u.created_at`,
    orgId, period,
  );
  const payments = db.all<{ id: string; amount_cents: number; method: string; reference: string | null; created_at: string; currency_charged: string | null; amount_charged: number | null }>(
    'SELECT id, amount_cents, method, reference, created_at, currency_charged, amount_charged FROM payments WHERE org_id = ? AND period = ? ORDER BY created_at', orgId, period,
  );
  const subscriptionCents = active ? cfg.billing.monthlyFeeCents : 0;
  const usageCents = events.reduce((s, e) => s + e.amount_cents, 0);
  const paidCents = payments.reduce((s, p) => s + p.amount_cents, 0);
  const totalCents = subscriptionCents + usageCents;
  return {
    period,
    plan: org.plan,
    currency: cfg.billing.currency,
    pricing: { monthlyFeeCents: cfg.billing.monthlyFeeCents, perShipmentCents: cfg.billing.perShipmentCents },
    subscriptionCents,
    shipments: events.length,
    usageCents,
    totalCents,
    paidCents,
    balanceCents: totalCents - paidCents,
    events,
    payments,
  };
}

export function periods(db: Db, orgId: string): string[] {
  const org = db.get<{ created_at: string }>('SELECT created_at FROM orgs WHERE id = ?', orgId)!;
  const out: string[] = [];
  const d = new Date(`${org.created_at.slice(0, 7)}-01T00:00:00Z`);
  const end = currentPeriod();
  while (currentPeriod(d) <= end && out.length < 36) {
    out.push(currentPeriod(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out.reverse();
}
