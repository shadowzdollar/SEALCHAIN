import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock, CreditCard, Download, FlaskConical, Receipt, Smartphone, XCircle } from 'lucide-react';
import { ApiError, api } from '../api';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, PageLoader, Spinner, Stat } from '../components/ui';
import { cents, date, dateTime } from '../format';

interface Statement {
  period: string;
  plan: string;
  currency: string;
  pricing: { monthlyFeeCents: number; perShipmentCents: number };
  subscriptionCents: number;
  shipments: number;
  usageCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  events: Array<{ id: string; shipment_id: string; amount_cents: number; created_at: string; reference: string | null }>;
  payments: Array<{ id: string; amount_cents: number; method: string; reference: string | null; created_at: string; currency_charged: string | null; amount_charged: number | null }>;
}

interface PaymentInfo {
  online: boolean;
  provider: 'flutterwave' | 'sandbox' | null;
  providerName: string | null;
  currency: string;
  test: boolean;
  manualInstructions: string | null;
  canPay: boolean;
}

interface Attempt { id: string; status: 'pending' | 'succeeded' | 'failed' | 'cancelled'; chargeAmount: number; chargeCurrency: string; createdAt: string; failureReason: string | null }

interface Intent { id: string; period: string; status: Attempt['status']; provider: string; chargeAmount: number; chargeCurrency: string; creditCents: number; failureReason: string | null; createdAt: string; completedAt: string | null; paymentId: string | null ; purpose?: 'statement' | 'plan_upgrade'; targetPlan?: string | null }

const planName = (t: string | null | undefined) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
const monthName = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const major = (amount: number, currency: string) => `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const methodLabel = (m: string) => {
  const [provider, type] = m.split(':');
  const names: Record<string, string> = { flutterwave: 'Flutterwave', sandbox: 'Test payment', momo: 'MTN MoMo', bank_transfer: 'Bank transfer', cash: 'Cash' };
  const types: Record<string, string> = { mobilemoneyrw: 'mobile money', card: 'card', test: '' };
  return [names[provider!] ?? provider!.replace(/_/g, ' '), type ? types[type] ?? type : ''].filter(Boolean).join(' · ');
};

export function Billing() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string | undefined>(params.get('period') ?? undefined);
  const q = useQuery({ queryKey: ['billing', period], queryFn: () => api.get<{ periods: string[]; statement: Statement; payment: PaymentInfo; attempts: Attempt[] }>(`/billing${period ? `?period=${period}` : ''}`) });
  const pay = useMutation({
    mutationFn: (p: string) => api.post<{ id: string; url: string }>('/billing/checkout', { period: p }),
    // The test checkout is a page of this app; real providers are external.
    onSuccess: (r) => (r.url.startsWith(window.location.origin) ? navigate(r.url.slice(window.location.origin.length)) : window.location.assign(r.url)),
  });
  if (q.isLoading || !q.data) return <PageLoader />;
  const { statement: s, payment, attempts } = q.data;
  const due = s.balanceCents > 0;

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={`${s.plan.charAt(0).toUpperCase()}${s.plan.slice(1)} plan · ${cents(s.pricing.monthlyFeeCents)} per month + ${cents(s.pricing.perShipmentCents)} per shipment issued`}
        actions={
          <div className="flex items-center gap-2">
          <Link to="/app/plans" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-[13px] font-medium hover:border-ink dark:border-navy-600">Change plan <ArrowRight className="size-3.5" /></Link>
          <select className="input w-48" value={s.period} onChange={(e) => setPeriod(e.target.value)} aria-label="Statement month">
            {q.data.periods.map((p) => <option key={p} value={p}>{monthName(p)}</option>)}
          </select>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Subscription" value={cents(s.subscriptionCents)} sub={monthName(s.period)} />
        <Stat label="Shipments" value={s.shipments} sub={`${cents(s.usageCents)} usage`} />
        <Stat label="Total" value={cents(s.totalCents)} />
        <Stat label="Balance" value={cents(s.balanceCents)} sub={s.paidCents ? `${cents(s.paidCents)} received` : 'No payment yet'} />
      </div>

      {/* ------------------------------------------------------------ pay */}
      <section className="card mt-6 overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="eyebrow">{monthName(s.period)} statement</p>
            {due ? (
              <>
                <p className="mt-2 font-serif text-[30px] font-semibold leading-none">{cents(s.balanceCents)} <span className="text-[15px] font-normal text-slate-500">due</span></p>
                <p className="mt-2 text-[13px] text-slate-600 dark:text-navy-300">
                  {payment.online
                    ? `Pay with MTN MoMo, Airtel Money or card. You are charged in ${payment.currency} at today’s reference rate; the statement is credited in ${s.currency}.`
                    : 'Online payment is not switched on yet. Pay by transfer using the details below; our team records it and it appears here.'}
                </p>
              </>
            ) : (
              <p className="mt-2 flex items-center gap-2 font-serif text-[24px] font-semibold text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="size-6" /> Paid in full</p>
            )}
          </div>
          {due && payment.online && (
            <div className="flex flex-col items-start gap-2 lg:items-end">
              {payment.test && <Badge tone="amber"><FlaskConical className="size-3" /> Test mode — no real money</Badge>}
              <Button size="lg" loading={pay.isPending} disabled={!payment.canPay} onClick={() => pay.mutate(s.period)} icon={<Smartphone className="size-4" />}>
                Pay {cents(s.balanceCents)} now
              </Button>
              {!payment.canPay && <p className="text-[12px] text-slate-500">Only organisation owners can pay.</p>}
            </div>
          )}
        </div>
        {pay.isError && <div className="px-6 pb-4"><Alert tone="error">{pay.error instanceof ApiError ? pay.error.message : 'Could not start the payment.'}</Alert></div>}
        {(payment.manualInstructions || !payment.online) && due && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-[13px] dark:border-navy-700 dark:bg-navy-900/60">
            <p className="font-medium">{payment.online ? 'Prefer to pay by transfer?' : 'How to pay'}</p>
            <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-navy-300">{payment.manualInstructions ?? 'Pay by MTN MoMo or bank transfer and quote your organisation name. Contact us for the payment details.'}</p>
          </div>
        )}
      </section>

      {attempts.some((a) => a.status === 'pending' || a.status === 'failed') && (
        <Card title="Payment attempts" className="mt-6" padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {attempts.filter((a) => a.status === 'pending' || a.status === 'failed').map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  {a.status === 'pending' ? <Clock className="size-4 text-amber-600" /> : <XCircle className="size-4 text-red-600" />}
                  {major(a.chargeAmount, a.chargeCurrency)} · <span className="text-slate-500">{dateTime(a.createdAt)}</span>
                </span>
                <span className="text-xs text-slate-500">{a.status === 'pending' ? 'Awaiting confirmation' : a.failureReason ?? 'Not completed'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Shipments charged" padded={false}>
          {s.events.length === 0 ? (
            <EmptyState icon={<Receipt className="size-5" />} title="No shipments this month" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {s.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>
                    <Link to={`/app/shipments/${e.shipment_id}`} className="font-medium hover:underline">{e.reference ?? e.shipment_id}</Link>
                    <span className="block text-xs text-slate-500">{date(e.created_at)}</span>
                  </span>
                  <span className="tabular-nums">{cents(e.amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Payments received" padded={false}>
          {s.payments.length === 0 ? (
            <EmptyState icon={<CreditCard className="size-5" />} title="No payments yet" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {s.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <Badge>{methodLabel(p.method)}</Badge> <span className="mono text-slate-500">{p.reference}</span>
                    <span className="block text-xs text-slate-500">{date(p.created_at)}{p.amount_charged !== null && p.currency_charged ? ` · paid ${major(p.amount_charged, p.currency_charged)}` : ''}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums">{cents(p.amount_cents)}</span>
                    <a href={`/api/billing/payments/${p.id}/receipt`} className="text-slate-500 hover:text-slate-900 dark:hover:text-white" title="Download receipt" aria-label="Download receipt"><Download className="size-4" /></a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------ test checkout
/** Development stand-in for the payment provider's hosted checkout. */
export function SandboxCheckout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['intent', id], queryFn: () => api.get<Intent>(`/billing/intents/${id}`) });
  const decide = useMutation({
    mutationFn: (outcome: 'ok' | 'fail') => api.post<Intent>(`/billing/sandbox/${id}`, { outcome }),
    onSuccess: (i) => navigate(`/app/billing/return?intent=${i.id}`, { replace: true }),
  });
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <Alert tone="error">Payment not found.</Alert>;
  const i = q.data;
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-7">
        <Badge tone="amber"><FlaskConical className="size-3" /> Test checkout — no real money moves</Badge>
        <p className="eyebrow mt-6">Pay SealChain</p>
        <p className="mt-2 font-serif text-[34px] font-semibold leading-none">{major(i.chargeAmount, i.chargeCurrency)}</p>
        <p className="mt-2 text-sm text-slate-500">{i.purpose === 'plan_upgrade' ? `Upgrade to ${planName(i.targetPlan)} · ${monthName(i.period)}` : `Statement for ${monthName(i.period)} · credits ${cents(i.creditCents)}`}</p>
        {i.status !== 'pending' ? (
          <Alert tone="info" className="mt-6">This payment is already {i.status}.</Alert>
        ) : (
          <div className="mt-8 grid gap-2">
            <Button size="lg" loading={decide.isPending && decide.variables === 'ok'} onClick={() => decide.mutate('ok')} icon={<CheckCircle2 className="size-4" />}>Approve test payment</Button>
            <Button size="lg" variant="secondary" loading={decide.isPending && decide.variables === 'fail'} onClick={() => decide.mutate('fail')}>Decline</Button>
          </div>
        )}
        <p className="mt-6 text-xs text-slate-500">In production this step is Flutterwave’s secure page, where the payer approves on their phone (MTN MoMo, Airtel Money) or enters a card.</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- return page
/** Where the provider sends the payer back. Confirms server-to-server. */
export function PaymentReturn() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const txRef = params.get('tx_ref') ?? params.get('intent');
  const txId = params.get('transaction_id');
  const cancelled = params.get('status') === 'cancelled';
  const [intent, setIntent] = useState<Intent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !txRef) return;
    started.current = true;
    const run = async () => {
      try {
        const i = txId && !cancelled ? await api.post<Intent>('/billing/confirm', { transactionId: txId, intentId: txRef }) : await api.get<Intent>(`/billing/intents/${txRef}`);
        setIntent(i);
        void qc.invalidateQueries({ queryKey: ['billing'] });
        void qc.invalidateQueries({ queryKey: ['plans'] });
        void qc.invalidateQueries({ queryKey: ['me'] });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not confirm the payment.');
      }
    };
    void run();
  }, [txRef, txId, cancelled, qc]);

  const status = cancelled ? 'cancelled' : intent?.status;
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-8 text-center">
        {!txRef ? (
          <p className="text-sm text-slate-600">No payment to confirm.</p>
        ) : error ? (
          <Alert tone="error" title="Payment not confirmed">{error}</Alert>
        ) : !status ? (
          <div className="flex flex-col items-center gap-3 py-6"><Spinner /><p className="text-sm text-slate-600">Confirming your payment with the provider…</p></div>
        ) : status === 'succeeded' ? (
          <>
            <div className="stamp mx-auto rotate-[-4deg]">Paid ✓</div>
            <h1 className="mt-6 font-serif text-[28px] font-semibold">Thank you</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-navy-300">{intent && (intent.purpose === 'plan_upgrade' ? `${major(intent.chargeAmount, intent.chargeCurrency)} received — you’re now on ${planName(intent.targetPlan)}. A receipt is in your email.` : `${major(intent.chargeAmount, intent.chargeCurrency)} received for ${monthName(intent.period)}. A receipt is on the billing page and in your email.`)}</p>
          </>
        ) : status === 'pending' ? (
          <>
            <Clock className="mx-auto size-10 text-amber-600" />
            <h1 className="mt-4 font-serif text-[26px] font-semibold">Waiting for confirmation</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-navy-300">Mobile money can take a minute. We’ll update your statement as soon as the provider confirms.</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto size-10 text-red-600" />
            <h1 className="mt-4 font-serif text-[26px] font-semibold">Payment {status === 'cancelled' ? 'cancelled' : 'not completed'}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-navy-300">{intent?.failureReason ?? 'No money was taken. You can try again from the billing page.'}</p>
          </>
        )}
        {intent?.purpose === 'plan_upgrade' ? (
          <Link to="/app/plans" className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">Back to plans <ArrowRight className="size-4" /></Link>
        ) : (
          <Link to={intent ? `/app/billing?period=${intent.period}` : '/app/billing'} className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">Back to billing <ArrowRight className="size-4" /></Link>
        )}
      </div>
    </div>
  );
}
