/**
 * Online payment of the monthly statement.
 *
 * A payment intent records what we asked the payer to pay (in the charge
 * currency — RWF for mobile money in Rwanda) and what it settles (USD cents on
 * the statement). An intent only becomes a payment after the provider confirms
 * it server-to-server, never on the strength of a browser redirect, and it can
 * complete at most once however many times the redirect or webhook arrives.
 *
 * Providers:
 *   flutterwave  hosted checkout (MTN MoMo, Airtel Money, cards); set FLW_SECRET_KEY
 *   sandbox      development only: a SealChain page that approves or declines
 *   none         online payment off; the billing page shows manual instructions
 */
import type { Config } from '../config';
import { newId, nowIso, type Db } from '../db';
import { HttpError } from './documents';
import type { Mailer } from './mailer';
import { statement } from './billing';
import type { NotificationService } from './notifications';

export interface Intent {
  id: string;
  org_id: string;
  period: string;
  provider: string;
  credit_cents: number;
  charge_amount: number;
  charge_currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  checkout_url: string | null;
  provider_tx_id: string | null;
  payment_type: string | null;
  failure_reason: string | null;
  payment_id: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

interface Verified {
  status: 'successful' | 'failed' | 'pending';
  txRef: string;
  txId: string;
  amount: number;
  currency: string;
  paymentType?: string;
}

export interface PaymentProvider {
  id: 'flutterwave' | 'sandbox';
  name: string;
  createCheckout(intent: Intent, payer: { email: string; name: string; org: string }, returnUrl: string): Promise<string>;
  verify(txId: string): Promise<Verified>;
}

class FlutterwaveProvider implements PaymentProvider {
  readonly id = 'flutterwave' as const;
  readonly name = 'Flutterwave';
  constructor(private c: NonNullable<Config['payments']['flutterwave']>, private webUrl: string) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.c.apiBase}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.c.secretKey}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string; message?: string; data?: T };
    if (!res.ok || json.status !== 'success') throw new HttpError(502, 'payment_provider', `Flutterwave: ${json.message ?? `HTTP ${res.status}`}`);
    return json.data as T;
  }

  async createCheckout(intent: Intent, payer: { email: string; name: string; org: string }, returnUrl: string) {
    const data = await this.call<{ link: string }>('POST', '/payments', {
      tx_ref: intent.id,
      amount: intent.charge_amount,
      currency: intent.charge_currency,
      redirect_url: returnUrl,
      payment_options: this.c.paymentOptions,
      customer: { email: payer.email, name: payer.name },
      customizations: { title: 'SealChain', description: `Statement ${intent.period} — ${payer.org}`, logo: `${this.webUrl}/brand/sealchain-seal-256.png` },
      meta: { org_id: intent.org_id, period: intent.period },
    });
    return data.link;
  }

  async verify(txId: string): Promise<Verified> {
    const d = await this.call<{ id: number; status: string; tx_ref: string; amount: number; currency: string; payment_type?: string }>('GET', `/transactions/${encodeURIComponent(txId)}/verify`);
    return {
      status: d.status === 'successful' ? 'successful' : d.status === 'failed' ? 'failed' : 'pending',
      txRef: d.tx_ref,
      txId: String(d.id),
      amount: Number(d.amount),
      currency: d.currency,
      paymentType: d.payment_type,
    };
  }

  /** Flutterwave sends the secret hash chosen in its dashboard as `verif-hash`. */
  webhookTrusted(header: string | undefined): boolean {
    return !!this.c.webhookHash && header === this.c.webhookHash;
  }
}

/** Development stand-in: "checkout" is a SealChain page with Approve / Decline. */
class SandboxProvider implements PaymentProvider {
  readonly id = 'sandbox' as const;
  readonly name = 'Test payments';
  constructor(private db: Db, private webUrl: string) {}
  async createCheckout(intent: Intent) {
    return `${this.webUrl}/app/billing/sandbox/${intent.id}`;
  }
  async verify(txId: string): Promise<Verified> {
    // Sandbox transaction ids are `sbx_<intent id>_<outcome>`.
    const m = /^sbx_(.+)_(ok|fail)$/.exec(txId);
    if (!m) throw new HttpError(400, 'invalid_request', 'Unknown test transaction');
    const intent = this.db.get<Intent>('SELECT * FROM payment_intents WHERE id = ?', m[1]!);
    if (!intent) throw new HttpError(404, 'not_found', 'Payment not found');
    return { status: m[2] === 'ok' ? 'successful' : 'failed', txRef: intent.id, txId, amount: intent.charge_amount, currency: intent.charge_currency, paymentType: 'test' };
  }
}

export function createProvider(cfg: Config, db: Db): PaymentProvider | null {
  const p = cfg.payments;
  if (p.provider === 'flutterwave' && p.flutterwave) return new FlutterwaveProvider(p.flutterwave, cfg.publicWebUrl);
  if (p.provider === 'sandbox' && !cfg.isProd) return new SandboxProvider(db, cfg.publicWebUrl);
  return null;
}

/** Converts the USD statement balance into the charge currency (whole units for RWF-like currencies). */
export function chargeFor(cfg: Config, creditCents: number): { amount: number; currency: string } {
  const currency = cfg.payments.currency;
  const rate = cfg.fx[currency] ?? 1;
  const major = (creditCents / 100) * rate;
  const whole = ['RWF', 'UGX', 'TZS', 'BIF', 'KES'].includes(currency);
  return { currency, amount: whole ? Math.ceil(major) : Math.ceil(major * 100) / 100 };
}

export class PaymentService {
  readonly provider: PaymentProvider | null;
  constructor(private db: Db, private cfg: Config, private mailer: Mailer, private notifications?: NotificationService) {
    this.provider = createProvider(cfg, db);
  }

  get(id: string) {
    return this.db.get<Intent>('SELECT * FROM payment_intents WHERE id = ?', id);
  }

  async checkout(orgId: string, user: { id: string; email: string; name: string }, period: string) {
    if (!this.provider) throw new HttpError(409, 'payments_off', 'Online payment is not available yet. Please pay by transfer as shown on the billing page.');
    const st = statement(this.db, this.cfg, orgId, period);
    if (st.balanceCents <= 0) throw new HttpError(409, 'nothing_due', 'Nothing is due for this period.');
    const org = this.db.get<{ name: string }>('SELECT name FROM orgs WHERE id = ?', orgId)!;
    const charge = chargeFor(this.cfg, st.balanceCents);
    const intent: Intent = {
      id: newId('pay', 16), org_id: orgId, period, provider: this.provider.id, credit_cents: st.balanceCents,
      charge_amount: charge.amount, charge_currency: charge.currency, status: 'pending', checkout_url: null,
      provider_tx_id: null, payment_type: null, failure_reason: null, payment_id: null, created_by: user.email, created_at: nowIso(), completed_at: null,
    };
    // A new attempt replaces any unfinished one for the same statement.
    this.db.run(
      "UPDATE payment_intents SET status = 'cancelled', failure_reason = 'Replaced by a newer attempt', completed_at = ? WHERE org_id = ? AND period = ? AND status = 'pending'",
      nowIso(), orgId, period,
    );
    this.db.insert('payment_intents', { ...intent });
    try {
      const url = await this.provider.createCheckout(intent, { email: user.email, name: user.name, org: org.name }, `${this.cfg.publicWebUrl}/app/billing/return`);
      this.db.run('UPDATE payment_intents SET checkout_url = ? WHERE id = ?', url, intent.id);
      return { id: intent.id, url, chargeAmount: charge.amount, chargeCurrency: charge.currency };
    } catch (err) {
      this.db.run("UPDATE payment_intents SET status = 'failed', failure_reason = ?, completed_at = ? WHERE id = ?", (err as Error).message.slice(0, 300), nowIso(), intent.id);
      throw err;
    }
  }

  /**
   * Confirms a transaction with the provider and settles the intent. Safe to
   * call repeatedly (redirect + webhook): only the first success records a payment.
   */
  async confirm(txId: string, expectedIntentId?: string): Promise<Intent> {
    if (!this.provider) throw new HttpError(409, 'payments_off', 'Online payment is not enabled.');
    const v = await this.provider.verify(txId);
    const intent = this.get(v.txRef);
    if (!intent || (expectedIntentId && intent.id !== expectedIntentId)) throw new HttpError(404, 'not_found', 'Payment not found');
    if (intent.status !== 'pending') return intent;

    if (v.status === 'pending') return intent;
    if (v.status === 'failed') {
      this.db.run("UPDATE payment_intents SET status = 'failed', provider_tx_id = ?, failure_reason = ?, completed_at = ? WHERE id = ? AND status = 'pending'", v.txId, 'Declined or cancelled', nowIso(), intent.id);
      return this.get(intent.id)!;
    }
    if (v.currency !== intent.charge_currency || v.amount + 1e-9 < intent.charge_amount) {
      this.db.run("UPDATE payment_intents SET status = 'failed', provider_tx_id = ?, failure_reason = ?, completed_at = ? WHERE id = ? AND status = 'pending'",
        v.txId, `Paid ${v.amount} ${v.currency}, expected ${intent.charge_amount} ${intent.charge_currency}`, nowIso(), intent.id);
      return this.get(intent.id)!;
    }

    const paymentId = newId('pmt', 16);
    const settled = this.db.tx(() => {
      const res = this.db.run(
        "UPDATE payment_intents SET status = 'succeeded', provider_tx_id = ?, payment_type = ?, payment_id = ?, completed_at = ? WHERE id = ? AND status = 'pending'",
        v.txId, v.paymentType ?? null, paymentId, nowIso(), intent.id,
      );
      if (!res.changes) return false;
      this.db.insert('payments', {
        id: paymentId, org_id: intent.org_id, period: intent.period, amount_cents: intent.credit_cents,
        method: `${intent.provider}${v.paymentType ? `:${v.paymentType}` : ''}`, reference: v.txId,
        recorded_by: 'system', created_at: nowIso(), currency_charged: intent.charge_currency, amount_charged: v.amount,
      });
      return true;
    });
    const done = this.get(intent.id)!;
    if (settled) {
      void this.receiptMail(done).catch(() => undefined);
      this.notifications?.notify(done.org_id, 'payment.succeeded', {
        title: `Payment received: ${done.charge_amount.toLocaleString('en-US')} ${done.charge_currency}`,
        body: `Statement for ${done.period} credited. The receipt is on the billing page.`, link: `/app/billing?period=${done.period}`, severity: 'success',
      });
    }
    return done;
  }

  private async receiptMail(i: Intent) {
    const org = this.db.get<{ name: string }>('SELECT name FROM orgs WHERE id = ?', i.org_id);
    await this.mailer.send({
      to: i.created_by,
      subject: `Payment received — SealChain statement ${i.period}`,
      body:
        `Thank you. We received ${i.charge_amount.toLocaleString('en-US')} ${i.charge_currency} for ${org?.name ?? 'your organisation'}'s statement for ${i.period}.\n\n` +
        `Reference: ${i.provider_tx_id}\n` +
        `Your receipt is on the billing page:\n${this.cfg.publicWebUrl}/app/billing?period=${i.period}\n`,
    });
  }

  webhookTrusted(header: string | undefined): boolean {
    return this.provider instanceof FlutterwaveProvider && this.provider.webhookTrusted(header);
  }

  info() {
    return {
      online: !!this.provider,
      provider: this.provider?.id ?? null,
      providerName: this.provider?.name ?? null,
      currency: this.cfg.payments.currency,
      test: this.provider?.id === 'sandbox',
      manualInstructions: this.cfg.payments.manualInstructions ?? null,
    };
  }
}
