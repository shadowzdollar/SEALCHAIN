import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, FileSearch, Link2, Package, Plus, ScanLine, TrendingDown } from 'lucide-react';
import { api, type ShipmentListItem } from '../api';
import { useAuth, useMeta } from '../auth';
import { Badge, Button, Card, EmptyState, PageHeader, PageLoader, Stat } from '../components/ui';
import { StatusBadge, AnchorBadge } from './Shipments';
import { money, num, relative } from '../format';
import { ActivityFeed } from '../components/Sharing';
import { OnboardingCard } from '../components/Onboarding';

interface Dash {
  shipments: { draft: number; issued: number };
  documents: { active: number; anchored: number; pending: number };
  verifications: { total: number; last30Days: number };
  dutySavedUsd: number;
  forensics: { total: number; highRisk: number };
}

export function Dashboard() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const meta = useMeta();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dash>('/dashboard') });
  const list = useQuery({ queryKey: ['shipments'], queryFn: () => api.get<ShipmentListItem[]>('/shipments') });

  if (dash.isLoading) return <PageLoader />;
  const d = dash.data;
  const recent = (list.data ?? []).slice(0, 6);
  const corridor = meta.data?.corridors[0];

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title="Overview"
        subtitle={`${me?.org.name} — shipments, document integrity and verification activity.`}
        actions={
          <Link to="/app/shipments/new">
            <Button icon={<Plus className="size-4" />}>New shipment</Button>
          </Link>
        }
      />

      <OnboardingCard />

      {d && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Shipments issued" value={num(d.shipments.issued)} sub={`${d.shipments.draft} draft${d.shipments.draft === 1 ? '' : 's'}`} icon={<Package className="size-4" />} />
          <Stat label="Documents anchored" value={`${num(d.documents.anchored)}/${num(d.documents.active)}`} sub={d.documents.pending ? `${d.documents.pending} anchoring now` : 'All current documents anchored'} icon={<Link2 className="size-4" />} />
          <Stat label="Verified by others" value={num(d.verifications.total)} sub={`${d.verifications.last30Days} in the last 30 days`} icon={<BadgeCheck className="size-4" />} />
          <Stat label="Duty protected" value={`USD ${num(d.dutySavedUsd)}`} sub="CET your buyers avoid with valid certificates" icon={<TrendingDown className="size-4" />} />
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <Card
          className="min-w-0 lg:col-span-2"
          title="Recent shipments"
          action={<Link to="/app/shipments" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">View all</Link>}
          padded={false}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon={<Package className="size-5" />}
              title="No shipments yet"
              action={
                <Link to="/app/shipments/new">
                  <Button icon={<Plus className="size-4" />}>Create your first shipment</Button>
                </Link>
              }
            >
              Enter what you are shipping and where; SealChain suggests the tariff code, checks everything and issues the full document set.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-ent">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th className="hidden md:table-cell">Route</th>
                    <th className="text-right">Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/50" onClick={() => navigate(`/app/shipments/${s.id}`)}>
                      <td className="max-w-56">
                        <Link to={`/app/shipments/${s.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700 dark:text-white" onClick={(e) => e.stopPropagation()}>{s.reference}</Link>
                        <span className="block truncate text-xs text-slate-500">{s.consignee || 'No consignee yet'}</span>
                      </td>
                      <td className="hidden whitespace-nowrap text-slate-600 md:table-cell dark:text-navy-200">{s.corridor}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{money(s.invoiceTotal, s.currency)}</td>
                      <td><div className="flex flex-wrap gap-1.5"><StatusBadge s={s} /><AnchorBadge a={s.anchoring} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="min-w-0 space-y-6">
          <Card title="Received a document?">
            <p className="text-sm text-slate-600 dark:text-navy-300">Check a certificate or invoice from a supplier, broker or buyer for signs of alteration or fabrication.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/app/check">
                <Button variant="secondary" size="sm" icon={<FileSearch className="size-4" />}>Check a document</Button>
              </Link>
              <Link to="/verify">
                <Button variant="ghost" size="sm" icon={<ScanLine className="size-4" />}>Public verifier</Button>
              </Link>
            </div>
            {d && d.forensics.total > 0 && (
              <p className="mt-3 text-xs text-slate-500">{d.forensics.total} checked · <span className={d.forensics.highRisk ? 'font-medium text-red-600' : ''}>{d.forensics.highRisk} high risk</span></p>
            )}
          </Card>
          <ActivityFeed limit={6} />
          {corridor && (
            <Card title="Your corridor">
              <div className="flex items-center justify-between">
                <p className="font-medium">{corridor.name}</p>
                <Badge tone={corridor.rulesetVerifiedAt ? 'green' : 'amber'} dot>
                  {corridor.rulesetVerifiedAt ? 'Rules verified' : 'Rules pending review'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Rule set v{corridor.rulesetVersion}
                {corridor.rulesetVerifiedAt ? ` · verified ${relative(corridor.rulesetVerifiedAt)}` : ' · treat as guidance and confirm with your clearing agent'}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Road via {corridor.roadTransit.length ? corridor.roadTransit.join(', ') : 'direct'} · exits {corridor.exitPoints.road?.join(' / ')} · entries {corridor.entryPoints.road?.join(' / ')}
              </p>
              <Link to="/app/shipments/new" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                Start a shipment <ArrowRight className="size-3" />
              </Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
