/** Subscription plans: see what you're on, compare, upgrade or schedule a downgrade. */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit, requireAuth, requireOwner } from '../services/auth';
import type { Deps } from '../services/documents';
import { currentPeriod, statement } from '../services/billing';
import { chargeFor } from '../services/payments';
import { changePlan, orgPlan, planById, plans, seatsUsed, upgradeQuote } from '../services/plans';

const RATE = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

export async function planRoutes(api: FastifyInstance, deps: Deps) {
  const { db, cfg } = deps;

  const view = (orgId: string) => {
    const row = orgPlan(db, orgId);
    const st = statement(db, cfg, orgId, currentPeriod());
    return {
      current: row.plan,
      pending: row.pending_plan ? { plan: row.pending_plan, from: row.pending_from } : null,
      changedAt: row.plan_changed_at,
      currency: cfg.billing.currency,
      plans: plans(cfg),
      usage: { period: st.period, shipments: st.shipments, seats: seatsUsed(db, orgId), seatLimit: planById(cfg, row.plan).seats, estimateCents: st.totalCents, balanceCents: st.balanceCents },
      history: db.all(
        `SELECT p.id, p.from_plan AS "from", p.to_plan AS "to", p.kind, p.effective_from AS effectiveFrom, p.created_at AS createdAt, u.name AS byName
           FROM plan_changes p LEFT JOIN users u ON u.id = p.changed_by WHERE p.org_id = ? ORDER BY p.created_at DESC LIMIT 20`,
        orgId,
      ),
    };
  };

  api.get('/plans', { preHandler: requireAuth }, async (req) => view(req.auth!.org.id));

  /** Price of an upgrade, shown before checkout. */
  api.get<{ Querystring: { plan?: string } }>('/plans/quote', { preHandler: requireOwner }, async (req) => {
    const q = upgradeQuote(db, cfg, req.auth!.org.id, req.query.plan ?? '');
    const charge = chargeFor(cfg, q.amountCents);
    return { from: q.from.id, to: q.to.id, amountCents: q.amountCents, currency: cfg.billing.currency, chargeAmount: charge.amount, chargeCurrency: charge.currency, online: !!deps.payments.provider };
  });

  /** Upgrades are paid first: returns the provider's checkout URL; the plan changes when payment is confirmed. */
  api.post('/plans/checkout', { preHandler: requireOwner, ...RATE }, async (req) => {
    const { plan } = z.object({ plan: z.string().max(20) }).parse(req.body);
    const out = await deps.payments.checkoutPlan(req.auth!.org.id, req.auth!.user, plan);
    audit(db, req.auth, 'plan.checkout', 'payment_intent', out.id, { plan, amount: out.chargeAmount, currency: out.chargeCurrency });
    return out;
  });

  /** Downgrades (scheduled) and cancelling a scheduled change. Upgrades go through /plans/checkout. */
  api.post('/plans/change', { preHandler: requireOwner, ...RATE }, async (req) => {
    const { plan } = z.object({ plan: z.string().max(20) }).parse(req.body);
    const before = orgPlan(db, req.auth!.org.id).plan;
    const out = changePlan(db, cfg, req.auth!.org.id, req.auth!.user.id, plan);
    audit(db, req.auth, 'plan.change', 'org', req.auth!.org.id, { from: before, to: plan, effective: out.effective });
    return { ...out, ...view(req.auth!.org.id) };
  });
}
