import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus, Search } from 'lucide-react';
import { api, type ShipmentListItem } from '../api';
import { Badge, Button, Card, EmptyState, PageHeader, PageLoader } from '../components/ui';
import { money, relative } from '../format';

export function StatusBadge({ s }: { s: Pick<ShipmentListItem, 'status' | 'validationStatus' | 'version'> }) {
  if (s.status === 'issued') return <Badge tone="brand">Issued{s.version > 1 ? ` v${s.version}` : ''}</Badge>;
  if (s.validationStatus === 'blocked') return <Badge tone="red">Needs fixes</Badge>;
  if (s.validationStatus === 'review') return <Badge tone="amber">Review</Badge>;
  if (s.validationStatus === 'ready') return <Badge tone="green">Ready</Badge>;
  return <Badge>Draft</Badge>;
}

export function AnchorBadge({ a }: { a: ShipmentListItem['anchoring'] }) {
  if (a === 'anchored') return <Badge tone="green" dot>Anchored</Badge>;
  if (a === 'pending') return <Badge tone="blue" dot>Anchoring</Badge>;
  return null;
}

export function Shipments() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['shipments'], queryFn: () => api.get<ShipmentListItem[]>('/shipments') });
  const [filter, setFilter] = useState<'all' | 'draft' | 'issued'>('all');
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!s || [r.reference, r.consignee, r.invoiceNumber, r.corridor].some((v) => v?.toLowerCase().includes(s))),
    );
  }, [q.data, filter, search]);

  return (
    <>
      <PageHeader
        title="Shipments"
        subtitle="Each shipment produces its invoice, certificate of origin and packing list."
        actions={
          <Link to="/app/shipments/new">
            <Button icon={<Plus className="size-4" />}>New shipment</Button>
          </Link>
        }
      />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-navy-700">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-navy-800">
            {(['all', 'draft', 'issued'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${filter === f ? 'bg-white shadow-xs dark:bg-navy-900' : 'text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search reference, buyer, invoice…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {q.isLoading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Package className="size-5" />} title={q.data?.length ? 'No matching shipments' : 'No shipments yet'}>
            {q.data?.length ? 'Try a different search or filter.' : 'Create a shipment to generate your first document bundle.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ent">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Consignee</th>
                  <th className="hidden md:table-cell">Corridor</th>
                  <th className="text-right">Value</th>
                  <th>Status</th>
                  <th className="hidden text-right sm:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/app/shipments/${r.id}`)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/50">
                    <td>
                      <Link to={`/app/shipments/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700 dark:text-white" onClick={(e) => e.stopPropagation()}>
                        {r.reference}
                      </Link>
                      <div className="text-xs text-slate-500">{r.invoiceNumber || 'No invoice no.'}</div>
                    </td>
                    <td className="max-w-48 truncate">{r.consignee || <span className="text-slate-400">—</span>}</td>
                    <td className="hidden md:table-cell">{r.corridor}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{money(r.invoiceTotal, r.currency)}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <StatusBadge s={r} />
                        <AnchorBadge a={r.anchoring} />
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap text-right text-xs text-slate-500 sm:table-cell">{relative(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
