/**
 * Plans & subscription: where you are, what it costs at your volume, and
 * upgrades (immediate) or downgrades (from next month, cancellable).
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Building2, CalendarClock, Check, CreditCard, Crown, Gauge, Lock, Rocket, Smartphone, Sparkles, Sprout, Users, X } from 'lucide-react';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { Alert, Button, PageHeader, PageLoader } from '../components/ui';
import { cents, date } from '../format';
import { cx } from '../components/ui';

type PlanId = 'pilot' | 'growth' | 'enterprise';
interface Plan { id: PlanId; name: string; tagline: string; monthlyFeeCents: number | null; perShipmentCents: number | null; seats: number | null; features: string[]; selfServe: boolean; rank: number }
interface PlansView {
  current: PlanId;
  pending: { plan: PlanId; from: string } | null;
  changedAt: string | null;
  currency: string;
  plans: Plan[];
  usage: { period: string; shipments: number; seats: number; seatLimit: number | null; estimateCents: number; balanceCents: number };
  history: Array<{ id: string; from: PlanId; to: PlanId; kind: 'upgrade' | 'downgrade'; effectiveFrom: string; createdAt: string; byName: string | null }>;
}

const ICON: Record<PlanId, typeof Sprout> = { pilot: Sprout, growth: Rocket, enterprise: Crown };
const TONE: Record<PlanId, string> = {
  pilot: 'from-emerald-500/15 to-transparent text-emerald-700 dark:text-emerald-300',
  growth: 'from-sky-500/15 to-transparent text-sky-700 dark:text-sky-300',
  enterprise: 'from-amber-500/20 to-transparent text-amber-700 dark:text-amber-300',
};
const monthName = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const costAt = (p: Plan, n: number) => (p.monthlyFeeCents === null || p.perShipmentCents === null ? null : p.monthlyFeeCents + n * p.perShipmentCents);

export function Plans() {
  const { me } = useAuth();
  const isOwner = me?.user.role === 'owner';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['plans'], queryFn: () => api.get<PlansView>('/plans') });
  const [confirm, setConfirm] = useState<Plan | null>(null);
  const [done, setDone] = useState<{ plan: Plan; when: 'now' | 'next_period'; from?: string | null } | null>(null);
  const navigate = useNavigate();
  const checkout = useMutation({
    mutationFn: (plan: PlanId) => api.post<{ id: string; url: string }>('/plans/checkout', { plan }),
    onSuccess: (r) => (r.url.startsWith(window.location.origin) ? navigate(r.url.slice(window.location.origin.length)) : window.location.assign(r.url)),
  });
  const change = useMutation({
    mutationFn: (plan: PlanId) => api.post<PlansView & { effective: 'now' | 'next_period'; pendingFrom: string | null }>('/plans/change', { plan }),
    onSuccess: (res, plan) => {
      qc.setQueryData(['plans'], res);
      void qc.invalidateQueries({ queryKey: ['billing'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
      const p = res.plans.find((x) => x.id === plan)!;
      setDone({ plan: p, when: res.effective, from: res.pendingFrom });
      setConfirm(null);
    },
  });

  if (q.isLoading || !q.data) return <PageLoader />;
  const v = q.data;
  const current = v.plans.find((p) => p.id === v.current)!;
  const currency = v.currency;

  return (
    <div>
      <PageHeader eyebrow="Account" title="Plans & subscription" subtitle="See what you’re on, what it costs at your volume, and change plan at any time." actions={<Link to="/app/billing" className="text-sm font-medium text-ink underline-offset-4 hover:underline">Billing & payments →</Link>} />

      {done && (
        <div className="plan-done mb-6 flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="size-5" /></span>
          <div className="flex-1">
            <p className="font-semibold">{done.when === 'now' ? `You’re now on ${done.plan.name}.` : `${done.plan.name} starts on 1 ${monthName(done.from ?? v.usage.period)}.`}</p>
            <p className="text-sm opacity-80">{done.when === 'now' ? 'The new price applies to this month and to every shipment from now on.' : 'You keep your current plan until then. You can cancel this change any time before.'}</p>
          </div>
          <button type="button" onClick={() => setDone(null)} className="rounded p-1 opacity-60 hover:opacity-100" aria-label="Dismiss"><X className="size-4" /></button>
        </div>
      )}

      {/* current plan */}
      <section className={cx('relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br p-6 sm:p-8 dark:border-navy-700', TONE[current.id])}>
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="text-ink">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Your plan</p>
            <div className="mt-3 flex items-center gap-3">
              <PlanIcon id={current.id} big />
              <div>
                <h2 className="font-serif text-[34px] font-semibold leading-none">{current.name}</h2>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-navy-200">{current.tagline}</p>
              </div>
            </div>
            <p className="mt-5 text-[15px] text-slate-700 dark:text-navy-100">
              {current.monthlyFeeCents !== null ? <><span className="font-serif text-[26px] font-semibold text-ink">{cents(current.monthlyFeeCents, currency)}</span> / month + {cents(current.perShipmentCents!, currency)} per shipment</> : 'Custom pricing'}
            </p>
            {v.pending && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <CalendarClock className="size-4" />
                <span>Switching to <b>{v.plans.find((p) => p.id === v.pending!.plan)?.name}</b> on 1 {monthName(v.pending.from)}.</span>
                {isOwner && <button type="button" onClick={() => change.mutate(v.current)} className="font-semibold underline underline-offset-2">Keep {current.name}</button>}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Meter icon={<Gauge className="size-4" />} label={`Shipments in ${monthName(v.usage.period).split(' ')[0]}`} value={String(v.usage.shipments)} />
            <Meter icon={<Users className="size-4" />} label="Team seats" value={`${v.usage.seats}${v.usage.seatLimit ? ` / ${v.usage.seatLimit}` : ''}`} fill={v.usage.seatLimit ? v.usage.seats / v.usage.seatLimit : undefined} />
            <Meter icon={<Sparkles className="size-4" />} label="This month so far" value={cents(v.usage.estimateCents, currency)} />
          </div>
        </div>
      </section>

      {!isOwner && <Alert tone="info" className="mt-6">Only an organisation owner can change the plan. Ask an owner on your team.</Alert>}
      {change.isError && <Alert tone="error" className="mt-6">{change.error instanceof ApiError ? change.error.message : 'Could not change plan'}</Alert>}
      {checkout.isError && <Alert tone="error" className="mt-6">{checkout.error instanceof ApiError ? checkout.error.message : 'Could not start the payment'}</Alert>}

      <Simulator plans={v.plans} current={v.current} currency={currency} start={Math.max(1, v.usage.shipments)} />

      {/* plan cards */}
      <h3 className="mt-10 font-serif text-[22px] font-semibold">Compare plans</h3>
      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        {v.plans.map((p) => {
          const isCurrent = p.id === v.current;
          const up = p.rank > current.rank;
          const scheduled = v.pending?.plan === p.id;
          return (
            <article key={p.id} className={cx('plan-card relative flex flex-col overflow-hidden rounded-3xl border bg-surface p-6 transition-all', isCurrent ? 'border-ink shadow-[0_24px_50px_-30px_rgba(11,31,58,0.6)]' : 'border-slate-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(11,31,58,0.45)] dark:border-navy-700')}>
              <div aria-hidden className={cx('absolute inset-x-0 top-0 h-28 bg-gradient-to-b', TONE[p.id])} />
              <div className="relative flex items-start justify-between">
                <PlanIcon id={p.id} />
                {isCurrent && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-ink-contrast">Current plan</span>}
                {scheduled && <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white">From {monthName(v.pending!.from).split(' ')[0]}</span>}
                {p.id === 'growth' && !isCurrent && !scheduled && <span className="rounded-full bg-stamp px-2.5 py-1 text-[11px] font-semibold text-white">Best value</span>}
              </div>
              <h4 className="relative mt-4 font-serif text-[24px] font-semibold">{p.name}</h4>
              <p className="relative text-sm text-slate-500">{p.tagline}</p>
              <p className="relative mt-5">
                {p.monthlyFeeCents !== null ? (
                  <><span className="font-serif text-[38px] font-semibold leading-none tracking-[-0.02em]">{cents(p.monthlyFeeCents, currency)}</span><span className="text-sm text-slate-500"> / month</span><span className="mt-1 block text-sm text-slate-600 dark:text-navy-200">+ {cents(p.perShipmentCents!, currency)} per shipment · {p.seats ? `${p.seats} seats` : 'unlimited seats'}</span></>
                ) : <span className="font-serif text-[38px] font-semibold leading-none">Let’s talk</span>}
              </p>
              <ul className="relative mt-5 flex-1 space-y-2 border-t border-slate-100 pt-5 dark:border-navy-800">
                {p.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{f}</li>)}
              </ul>
              <div className="relative mt-6">
                {isCurrent ? (
                  <p className="flex h-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-medium text-slate-600 dark:bg-navy-800 dark:text-navy-200">You’re on this plan</p>
                ) : !p.selfServe ? (
                  <Link to="/contact?topic=integration" className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-medium hover:border-ink dark:border-navy-600"><Building2 className="size-4" /> Talk to sales</Link>
                ) : scheduled ? (
                  <Button variant="secondary" className="w-full" disabled={!isOwner} loading={change.isPending} onClick={() => change.mutate(v.current)}>Cancel scheduled change</Button>
                ) : (
                  <Button variant={up ? 'primary' : 'secondary'} className="w-full" disabled={!isOwner} onClick={() => setConfirm(p)}>
                    {up ? <><ArrowUpRight className="size-4" /> Upgrade to {p.name}</> : <><ArrowDownRight className="size-4" /> Switch to {p.name}</>}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* history */}
      <h3 className="mt-10 font-serif text-[22px] font-semibold">Plan history</h3>
      {v.history.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No changes yet — you’ve been on {current.name} since you joined.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {v.history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm dark:border-navy-700">
              <span className={cx('flex size-7 items-center justify-center rounded-full text-white', h.kind === 'upgrade' ? 'bg-emerald-600' : 'bg-amber-500')}>{h.kind === 'upgrade' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}</span>
              <span className="font-medium capitalize">{h.from} → {h.to}</span>
              <span className="text-slate-500">from {monthName(h.effectiveFrom)}</span>
              <span className="ml-auto text-xs text-slate-500">{h.byName ?? 'Someone'} · {date(h.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}

      {confirm && (
        <ConfirmChange
          from={current}
          to={confirm}
          currency={currency}
          shipments={Math.max(1, v.usage.shipments)}
          busy={change.isPending || checkout.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => (confirm.rank > current.rank ? checkout.mutate(confirm.id) : change.mutate(confirm.id))}
        />
      )}
    </div>
  );
}

function PlanIcon({ id, big }: { id: PlanId; big?: boolean }) {
  const I = ICON[id];
  return <span className={cx('flex items-center justify-center rounded-2xl bg-ink text-ink-contrast shadow-sm', big ? 'size-14' : 'size-11')}><I className={big ? 'size-7' : 'size-5'} strokeWidth={1.8} /></span>;
}

function Meter({ icon, label, value, fill }: { icon: React.ReactNode; label: string; value: string; fill?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-surface/80 p-4 backdrop-blur dark:border-navy-700">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">{icon} {label}</p>
      <p className="mt-2 font-serif text-[26px] font-semibold text-ink">{value}</p>
      {fill !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800">
          <div className={cx('h-full rounded-full transition-all duration-700', fill >= 1 ? 'bg-stamp' : fill > 0.75 ? 'bg-amber-500' : 'bg-emerald-600')} style={{ width: `${Math.min(100, fill * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/** "What would I pay?" — cost of each self-serve plan at a chosen monthly volume. */
function Simulator({ plans, current, currency, start }: { plans: Plan[]; current: PlanId; currency: string; start: number }) {
  const [n, setN] = useState(Math.min(start, 80));
  const rows = plans.filter((p) => p.selfServe).map((p) => ({ p, c: costAt(p, n)! }));
  const best = rows.reduce((a, b) => (b.c < a.c ? b : a));
  const max = Math.max(...rows.map((r) => r.c));
  const breakEven = useMemo(() => {
    const [a, b] = rows.map((r) => r.p);
    if (!a || !b || a.perShipmentCents === b.perShipmentCents) return null;
    return Math.ceil((b.monthlyFeeCents! - a.monthlyFeeCents!) / (a.perShipmentCents! - b.perShipmentCents!));
  }, [rows]);
  const currentRow = rows.find((r) => r.p.id === current);
  return (
    <section className="mt-8 grid gap-6 rounded-3xl border border-slate-200 bg-surface p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] dark:border-navy-700">
      <div>
        <h3 className="font-serif text-[22px] font-semibold">What would you pay?</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-navy-200">Slide to your usual number of shipments a month.</p>
        <div className="mt-6 flex items-baseline justify-between"><span className="text-sm text-slate-500">Shipments per month</span><span className="font-serif text-[40px] font-semibold tabular-nums leading-none">{n}</span></div>
        <input type="range" min={1} max={100} value={n} onChange={(e) => setN(Number(e.target.value))} className="mt-3 w-full accent-[var(--color-ink)]" aria-label="Shipments per month" />
        {breakEven !== null && breakEven > 0 && <p className="mt-4 text-sm text-slate-600 dark:text-navy-200">Growth becomes cheaper from <b>{breakEven} shipments</b> a month.</p>}
      </div>
      <div className="space-y-4">
        {rows.map(({ p, c }) => (
          <div key={p.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium">{p.name}{p.id === best.p.id && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10.5px] font-semibold text-white">Cheapest</span>}{p.id === current && <span className="text-xs text-slate-500">(yours)</span>}</span>
              <span className="font-serif text-[22px] font-semibold tabular-nums">{cents(c, currency)}</span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800"><div className={cx('h-full rounded-full transition-all duration-500', p.id === best.p.id ? 'bg-emerald-600' : 'bg-slate-400 dark:bg-navy-500')} style={{ width: `${(c / max) * 100}%` }} /></div>
          </div>
        ))}
        {currentRow && best.p.id !== current && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">At {n} shipments, {best.p.name} would save you <b>{cents(currentRow.c - best.c, currency)}</b> a month.</p>}
      </div>
    </section>
  );
}

function ConfirmChange({ from, to, currency, shipments, busy, onCancel, onConfirm }: { from: Plan; to: Plan; currency: string; shipments: number; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const up = to.rank > from.rank;
  const quote = useQuery({ queryKey: ['plan-quote', to.id], enabled: up, queryFn: () => api.get<{ amountCents: number; currency: string; chargeAmount: number; chargeCurrency: string; online: boolean }>(`/plans/quote?plan=${to.id}`) });
  const delta = (costAt(to, shipments) ?? 0) - (costAt(from, shipments) ?? 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <div role="dialog" aria-modal aria-label={`Change plan to ${to.name}`} onMouseDown={(e) => e.stopPropagation()} className="plan-dialog w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-2xl">
        <div className={cx('bg-gradient-to-br p-6', TONE[to.id])}>
          <div className="flex items-center gap-4 text-ink">
            <PlanIcon id={from.id} />
            <ArrowRight className="size-5 text-slate-500" />
            <PlanIcon id={to.id} big />
          </div>
          <h2 className="mt-4 font-serif text-[26px] font-semibold text-ink">{up ? `Upgrade to ${to.name}` : `Switch to ${to.name}`}</h2>
        </div>
        <div className="space-y-4 p-6 text-sm">
          <p>{up ? 'Pay the difference in monthly fee for this month and your new plan starts the moment the payment is confirmed. Every shipment after that uses the new per-shipment price.' : 'Starts on the first day of next month. You keep everything in your current plan until then, and you can cancel the change before it starts. Nothing to pay now.'}</p>
          {up && (
            <div className="rounded-2xl border-2 border-ink/80 bg-slate-50 p-4 dark:bg-navy-900">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Due now</span>
                <span className="font-serif text-[30px] font-semibold tabular-nums">{quote.data ? cents(quote.data.amountCents, quote.data.currency) : '…'}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Difference between {from.name} and {to.name} for this month.{quote.data && quote.data.chargeCurrency !== quote.data.currency && ` You’ll be charged ${quote.data.chargeCurrency} ${quote.data.chargeAmount.toLocaleString('en-US')} at today’s rate.`}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-navy-200">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 dark:border-navy-700"><Smartphone className="size-3.5" /> MTN MoMo · Airtel Money</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 dark:border-navy-700"><CreditCard className="size-3.5" /> Visa · Mastercard</span>
                <span className="inline-flex items-center gap-1.5 text-slate-500"><Lock className="size-3.5" /> Secure checkout</span>
              </div>
              {quote.data && !quote.data.online && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Online payment isn’t switched on yet. <Link to="/contact?topic=billing" className="font-semibold underline">Contact us</Link> to upgrade by invoice.</p>}
            </div>
          )}
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-navy-700"><dt className="text-xs text-slate-500">Monthly fee</dt><dd className="mt-1 font-medium">{cents(from.monthlyFeeCents ?? 0, currency)} → <b>{cents(to.monthlyFeeCents ?? 0, currency)}</b></dd></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-navy-700"><dt className="text-xs text-slate-500">Per shipment</dt><dd className="mt-1 font-medium">{cents(from.perShipmentCents ?? 0, currency)} → <b>{cents(to.perShipmentCents ?? 0, currency)}</b></dd></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-navy-700"><dt className="text-xs text-slate-500">Team seats</dt><dd className="mt-1 font-medium">{from.seats ?? '∞'} → <b>{to.seats ?? '∞'}</b></dd></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-navy-700"><dt className="text-xs text-slate-500">At {shipments} shipments / month</dt><dd className={cx('mt-1 font-medium', delta > 0 ? 'text-slate-700 dark:text-navy-100' : 'text-emerald-700 dark:text-emerald-400')}>{delta > 0 ? '+' : '−'}{cents(Math.abs(delta), currency)} a month</dd></div>
          </dl>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-navy-800 dark:bg-navy-900">
          <Button variant="secondary" onClick={onCancel}>Not now</Button>
          <Button loading={busy} disabled={up && (!quote.data || !quote.data.online)} onClick={onConfirm}>{up ? <><Lock className="size-4" /> Continue to secure payment</> : 'Schedule the switch'}</Button>
        </div>
      </div>
    </div>
  );
}
