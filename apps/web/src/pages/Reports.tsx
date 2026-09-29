/** Reports: issued shipments, export value, duty protected and verifications over time, plus CSV exports. */
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, BarChart3, Download, Package, Table2, TrendingDown, Wallet } from 'lucide-react';
import { api } from '../api';
import { BarChart, RankBars } from '../components/BarChart';
import { Card, EmptyState, PageHeader, PageLoader, Stat, cx } from '../components/ui';
import { COUNTRY_NAME, num } from '../format';

interface Month { period: string; shipments: number; valueUsd: number; dutyUsd: number; verifications: number; shareViews: number }
interface Report {
  months: Month[];
  totals: { shipments: number; valueUsd: number; dutyUsd: number; verifications: number; shareViews: number };
  corridors: Array<{ corridorId: string; name: string; shipments: number; valueUsd: number }>;
  buyers: Array<{ name: string; country: string; shipments: number; valueUsd: number }>;
}

const usd = (n: number) => `USD ${num(Math.round(n))}`;
const monthLabel = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

function ChartCard({ title, subtitle, children, tableView }: { title: string; subtitle: string; children: (table: boolean) => ReactNode; tableView?: boolean }) {
  const [table, setTable] = useState(false);
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={tableView !== false && (
        <button onClick={() => setTable((t) => !t)} className="flex items-center gap-1.5 rounded p-1 text-[12px] text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-pressed={table}>
          {table ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />} {table ? 'Chart' : 'Table'}
        </button>
      )}
    >
      {children(table)}
    </Card>
  );
}

export function Reports() {
  const [months, setMonths] = useState(12);
  const q = useQuery({ queryKey: ['reports', months], queryFn: () => api.get<Report>(`/reports?months=${months}`) });
  const r = q.data;
  const series = (k: keyof Omit<Month, 'period'>) => (r?.months ?? []).map((m) => ({ key: m.period, label: monthLabel(m.period), value: m[k] }));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Shipments issued, export value, duty your buyers avoid with valid certificates, and how often your documents are checked."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-40" value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Time range">
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </select>
            <ExportMenu />
          </div>
        }
      />
      {q.isLoading || !r ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Shipments issued" value={num(r.totals.shipments)} sub={`last ${months} months`} icon={<Package className="size-4" />} />
            <Stat label="Export value" value={usd(r.totals.valueUsd)} sub="goods + freight + insurance" icon={<Wallet className="size-4" />} />
            <Stat label="Duty protected" value={usd(r.totals.dutyUsd)} sub="CET your buyers avoid" icon={<TrendingDown className="size-4" />} />
            <Stat label="Verifications" value={num(r.totals.verifications)} sub={`${num(r.totals.shareViews)} share-link views`} icon={<BadgeCheck className="size-4" />} />
          </div>

          {r.totals.shipments === 0 && r.totals.verifications === 0 ? (
            <Card className="mt-6"><EmptyState icon={<BarChart3 className="size-5" />} title="No activity in this period yet">Reports fill in as you issue shipments and buyers verify them.</EmptyState></Card>
          ) : (
            <>
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <ChartCard title="Shipments issued" subtitle="By month of first issue">{(t) => <BarChart data={series('shipments')} table={t} integer />}</ChartCard>
                <ChartCard title="Export value (USD)" subtitle="Invoice totals converted at reference rates">{(t) => <BarChart data={series('valueUsd')} format={usd} table={t} />}</ChartCard>
                <ChartCard title="Duty protected (USD)" subtitle="Common External Tariff avoided with a valid certificate of origin">{(t) => <BarChart data={series('dutyUsd')} format={usd} table={t} />}</ChartCard>
                <ChartCard title="Verifications by others" subtitle="Checks by buyers, banks and border officers">{(t) => <BarChart data={series('verifications')} table={t} integer />}</ChartCard>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Card title="By corridor" subtitle="Export value of issued shipments">
                  {r.corridors.length ? <RankBars rows={r.corridors.map((c) => ({ key: c.corridorId, label: c.name, sub: `${c.shipments} shipment${c.shipments === 1 ? '' : 's'}`, value: c.valueUsd }))} format={usd} /> : <p className="text-sm text-slate-500">No issued shipments yet.</p>}
                </Card>
                <Card title="Top buyers" subtitle="By export value" padded={false}>
                  <table className="table-ent">
                    <thead><tr><th>Buyer</th><th className="text-right">Shipments</th><th className="text-right">Value</th></tr></thead>
                    <tbody>
                      {r.buyers.map((b) => (
                        <tr key={b.name}>
                          <td><span className="font-medium">{b.name}</span><span className="block text-xs text-slate-500">{COUNTRY_NAME[b.country as keyof typeof COUNTRY_NAME] ?? b.country}</span></td>
                          <td className="text-right tabular-nums">{b.shipments}</td>
                          <td className="text-right tabular-nums">{usd(b.valueUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const items = [
    { href: '/api/reports/shipments.csv', label: 'Shipments', desc: 'Every shipment with values and duty' },
    { href: '/api/reports/documents.csv', label: 'Document register', desc: 'Numbers, fingerprints and anchors' },
    { href: '/api/reports/verifications.csv', label: 'Verifications', desc: 'Every outside check of your documents' },
  ];
  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <button onClick={() => setOpen((v) => !v)} className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-slate-200 bg-white px-3.5 text-[13px] font-medium hover:border-slate-400 dark:border-navy-600 dark:bg-navy-900" aria-expanded={open}>
        <Download className="size-4" /> Export CSV
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-72 overflow-hidden rounded-[3px] border border-slate-200 bg-white shadow-lg dark:border-navy-700 dark:bg-navy-900">
          {items.map((i) => (
            <a key={i.href} href={i.href} className={cx('block px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800')} onClick={() => setOpen(false)}>
              <span className="block text-[13px] font-medium">{i.label}</span>
              <span className="block text-[12px] text-slate-500">{i.desc}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
