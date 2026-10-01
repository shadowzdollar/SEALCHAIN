/** Online payment of statements, receipts and the payment provider's webhook. */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit, requireAuth, requireOwner } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';
import { currentPeriod } from '../services/billing';
import { renderReceipt } from '../pdf/receipt';

const RATE = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

const publicIntent = (i: { id: string; period: string; status: string; charge_amount: number; charge_currency: string; credit_cents: number; failure_reason: string | null; created_at: string; completed_at: string | null; provider: string; payment_id: string | null; purpose?: string; target_plan?: string | null }) => ({
  purpose: i.purpose ?? 'statement', targetPlan: i.target_plan ?? null,
  id: i.id, period: i.period, status: i.status, provider: i.provider, chargeAmount: i.charge_amount, chargeCurrency: i.charge_currency,
  creditCents: i.credit_cents, failureReason: i.failure_reason, createdAt: i.created_at, completedAt: i.completed_at, paymentId: i.payment_id,
});

export async function billingRoutes(api: FastifyInstance, deps: Deps) {
  const { db, payments } = deps;

  const ownIntent = (id: string, orgId: string) => {
    const i = payments.get(id);
    if (!i || i.org_id !== orgId) throw new HttpError(404, 'not_found', 'Payment not found');
    return i;
  };

  /** Start paying the balance of a period; returns the provider's checkout URL. */
  api.post('/billing/checkout', { preHandler: requireOwner, ...RATE }, async (req) => {
    const { period } = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).default(currentPeriod()) }).parse(req.body ?? {});
    const out = await payments.checkout(req.auth!.org.id, req.auth!.user, period);
    audit(db, req.auth, 'billing.checkout', 'payment_intent', out.id, { period, amount: out.chargeAmount, currency: out.chargeCurrency });
    return out;
  });

  /** The browser came back from the provider: confirm server-to-server. */
  api.post('/billing/confirm', { preHandler: requireAuth, ...RATE }, async (req) => {
    const body = z.object({ transactionId: z.string().min(1).max(100), intentId: z.string().max(40).optional() }).parse(req.body);
    if (body.intentId) ownIntent(body.intentId, req.auth!.org.id);
    const intent = await payments.confirm(body.transactionId, body.intentId);
    if (intent.org_id !== req.auth!.org.id) throw new HttpError(404, 'not_found', 'Payment not found');
    return publicIntent(intent);
  });

  api.get<{ Params: { id: string } }>('/billing/intents/:id', { preHandler: requireAuth }, async (req) => publicIntent(ownIntent(req.params.id, req.auth!.org.id)));

  /** Development only: approve or decline a test payment. */
  api.post<{ Params: { id: string } }>('/billing/sandbox/:id', { preHandler: requireAuth, ...RATE }, async (req) => {
    if (payments.provider?.id !== 'sandbox') throw new HttpError(404, 'not_found', 'Not available');
    const { outcome } = z.object({ outcome: z.enum(['ok', 'fail']) }).parse(req.body);
    const intent = ownIntent(req.params.id, req.auth!.org.id);
    return publicIntent(await payments.confirm(`sbx_${intent.id}_${outcome}`, intent.id));
  });

  /** Flutterwave webhook: trust nothing in the body, re-verify with the API. */
  api.post('/payments/webhook/flutterwave', RATE, async (req, reply) => {
    if (!payments.webhookTrusted(req.headers['verif-hash'] as string | undefined)) return reply.code(401).send({ error: 'unauthorized' });
    const body = req.body as { event?: string; data?: { id?: number | string; tx_ref?: string } } | undefined;
    const txId = body?.data?.id;
    if (txId !== undefined && String(body?.data?.tx_ref ?? '').startsWith('pay_')) {
      try {
        await payments.confirm(String(txId));
      } catch (err) {
        req.log.warn({ err, txId }, 'payment webhook could not be confirmed');
      }
    }
    return { received: true };
  });

  /** PDF receipt for a payment received by this organisation. */
  api.get<{ Params: { id: string } }>('/billing/payments/:id/receipt', { preHandler: requireAuth }, async (req, reply) => {
    const p = db.get<{ id: string; org_id: string; period: string; amount_cents: number; method: string; reference: string | null; created_at: string; currency_charged: string | null; amount_charged: number | null }>(
      'SELECT * FROM payments WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id,
    );
    if (!p) throw new HttpError(404, 'not_found', 'Payment not found');
    const pdf = await renderReceipt({
      receiptNo: `R-${p.period.replace('-', '')}-${p.id.slice(-6).toUpperCase()}`,
      paidAt: p.created_at,
      orgName: req.auth!.org.name,
      period: p.period,
      creditCents: p.amount_cents,
      creditCurrency: deps.cfg.billing.currency,
      amountCharged: p.amount_charged,
      currencyCharged: p.currency_charged,
      method: p.method,
      reference: p.reference,
      issuer: 'SealChain — cross-border trade documents',
    });
    return reply.type('application/pdf').header('content-disposition', `attachment; filename="sealchain-receipt-${p.period}.pdf"`).send(Buffer.from(pdf));
  });
}
