import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Receipt } from 'lucide-react';
import { api } from '../api';
import { Alert, Badge, Card, EmptyState, PageHeader, PageLoader, Stat } from '../components/ui';
import { cents, date } from '../format';

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
  payments: Array<{ id: string; amount_cents: number; method: string; reference: string | null; created_at: string }>;
}

const monthName = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function Billing() {
  const [period, setPeriod] = useState<string | undefined>();
  const q = useQuery({ queryKey: ['billing', period], queryFn: () => api.get<{ periods: string[]; statement: Statement }>(`/billing${period ? `?period=${period}` : ''}`) });
  if (q.isLoading || !q.data) return <PageLoader />;
  const s = q.data.statement;

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={`Pilot plan · ${cents(s.pricing.monthlyFeeCents)} per month + ${cents(s.pricing.perShipmentCents)} per shipment issued`}
        actions={
          <select className="input w-48" value={s.period} onChange={(e) => setPeriod(e.target.value)}>
            {q.data.periods.map((p) => <option key={p} value={p}>{monthName(p)}</option>)}
          </select>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Subscription" value={cents(s.subscriptionCents)} sub={monthName(s.period)} />
        <Stat label="Shipments" value={s.shipments} sub={`${cents(s.usageCents)} usage`} />
        <Stat label="Total due" value={cents(s.totalCents)} />
        <Stat label="Balance" value={cents(s.balanceCents)} sub={s.paidCents ? `${cents(s.paidCents)} received` : 'No payment recorded yet'} />
      </div>
      <Alert tone="info" className="mt-6" title="How to pay during the pilot">
        Pay by MTN MoMo or bank transfer and quote your organisation name. Our team records the payment and it appears here. Re-issuing corrected documents never adds a charge.
      </Alert>
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
            <EmptyState icon={<CreditCard className="size-5" />} title="No payments recorded" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {s.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>
                    <Badge>{p.method.replace('_', ' ')}</Badge> <span className="mono text-slate-500">{p.reference}</span>
                    <span className="block text-xs text-slate-500">{date(p.created_at)}</span>
                  </span>
                  <span className="tabular-nums">{cents(p.amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
