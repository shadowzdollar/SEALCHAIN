import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Play, Search } from 'lucide-react';
import { formatHs } from '@sealchain/core';
import { api, type CorridorInfo, type TariffLineInfo } from '../api';
import { Alert, Badge, Button, Card, Field, Hash, Modal, PageHeader, PageLoader, Tabs } from '../components/ui';
import { cents, dateTime, relative } from '../format';
import { Checklist, RuleChanges } from './ComplianceRules';

type Tab = 'checklist' | 'changes' | 'rules' | 'tariff' | 'signals' | 'authorities' | 'anchor' | 'orgs' | 'audit';

export function Compliance() {
  const [tab, setTab] = useState<Tab>('checklist');
  return (
    <>
      <PageHeader title="Compliance console" subtitle="Keep rules current, watch anchoring, run the pilot. A stale rule set is worse than none." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'checklist', label: 'Rules checklist' },
          { id: 'changes', label: 'Regulation changes' },
          { id: 'rules', label: 'Corridor sign-off' },
          { id: 'tariff', label: 'Tariff rates' },
          { id: 'signals', label: 'Fraud signals' },
          { id: 'authorities', label: 'Authorities' },
          { id: 'anchor', label: 'Anchoring' },
          { id: 'orgs', label: 'Pilot accounts' },
          { id: 'audit', label: 'Audit log' },
        ]}
      />
      <div className="mt-6">
        {tab === 'checklist' && <Checklist />}
        {tab === 'changes' && <RuleChanges />}
        {tab === 'rules' && <Rules />}
        {tab === 'tariff' && <Tariff />}
        {tab === 'signals' && <Signals />}
        {tab === 'authorities' && <Authorities />}
        {tab === 'anchor' && <Anchoring />}
        {tab === 'orgs' && <Orgs />}
        {tab === 'audit' && <Audit />}
      </div>
    </>
  );
}

type RulesResp = { corridors: Array<CorridorInfo & { lastVerification: { verified_at: string; verified_by: string; note: string | null; ruleset_version: string } | null }>; tariff: TariffLineInfo[] };

function Rules() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-rules'], queryFn: () => api.get<RulesResp>('/admin/rules') });
  const [note, setNote] = useState<Record<string, string>>({});
  const verify = useMutation({
    mutationFn: (id: string) => api.post(`/admin/rules/${id}/verify`, { note: note[id] }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-rules'] });
      void qc.invalidateQueries({ queryKey: ['meta'] });
    },
  });
  if (q.isLoading || !q.data) return <PageLoader />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {q.data.corridors.map((c) => (
        <Card key={c.id} title={c.name} subtitle={`Rule set v${c.rulesetVersion}`} action={<Badge tone={c.rulesetVerifiedAt ? 'green' : 'amber'} dot>{c.rulesetVerifiedAt ? `Verified ${relative(c.rulesetVerifiedAt)}` : 'Unverified'}</Badge>}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">STR ceiling</dt><dd>USD {c.params.strThresholdUsd.toLocaleString()}</dd></div>
            <div><dt className="text-xs text-slate-500">Max non-originating</dt><dd>{c.params.maxNonOriginatingPct}%</dd></div>
            <div><dt className="text-xs text-slate-500">Exporter tax ID</dt><dd className="mono">{c.taxId.exporter.label} /{c.taxId.exporter.pattern}/</dd></div>
            <div><dt className="text-xs text-slate-500">Consignee tax ID</dt><dd className="mono">{c.taxId.consignee.label} /{c.taxId.consignee.pattern}/</dd></div>
            <div className="col-span-2"><dt className="text-xs text-slate-500">Road borders</dt><dd>{c.exitPoints.road?.join(', ')} → {c.entryPoints.road?.join(', ')}</dd></div>
          </dl>
          {c.lastVerification && (
            <p className="mt-4 text-xs text-slate-500">
              Last verified by {c.lastVerification.verified_by} on {dateTime(c.lastVerification.verified_at)} (v{c.lastVerification.ruleset_version}){c.lastVerification.note ? ` — “${c.lastVerification.note}”` : ''}
            </p>
          )}
          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-navy-700">
            <input className="input" placeholder="What did you check? (gazette ref., broker call…)" value={note[c.id] ?? ''} onChange={(e) => setNote({ ...note, [c.id]: e.target.value })} />
            <Button icon={<CheckCircle2 className="size-4" />} loading={verify.isPending && verify.variables === c.id} onClick={() => verify.mutate(c.id)}>Mark verified</Button>
          </div>
        </Card>
      ))}
      <Alert tone="info" className="lg:col-span-2">
        Marking a rule set verified records who checked it and when. Verification applies only to the current rule-set version; when the rules change, traders see the “unverified” warning again until re-checked.
      </Alert>
    </div>
  );
}

function Tariff() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-rules'], queryFn: () => api.get<RulesResp>('/admin/rules') });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TariffLineInfo | null>(null);
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => api.put(`/admin/tariff/${editing!.code}`, { cetRate: Number(rate), note: note || undefined }),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['admin-rules'] });
    },
  });
  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data?.tariff ?? []).filter((l) => !s || l.code.includes(s.replace(/\D/g, '') || '@') || l.description.toLowerCase().includes(s) || l.keywords.some((k) => k.includes(s)));
  }, [q.data, search]);
  if (q.isLoading) return <PageLoader />;
  const verified = (q.data?.tariff ?? []).filter((l) => l.verifiedAt).length;
  return (
    <Card
      title={`Tariff catalog · ${verified}/${q.data?.tariff.length} rates verified`}
      subtitle="Indicative rates were compiled during planning. Confirm each against the gazetted EAC CET."
      padded={false}
      action={
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input h-8 pl-8 text-xs" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      }
    >
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-navy-900">
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-navy-700">
              <th className="px-5 py-2 font-medium">HS code</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">CET</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {rows.map((l) => (
              <tr key={l.code}>
                <td className="mono whitespace-nowrap px-5 py-2">{formatHs(l.code)}</td>
                <td className="px-3 py-2">{l.description}{l.sensitive && <Badge tone="violet" className="ml-2">sensitive</Badge>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{l.cetRate}%</td>
                <td className="whitespace-nowrap px-3 py-2">{l.verifiedAt ? <Badge tone="green" dot>verified {relative(l.verifiedAt)}</Badge> : <Badge tone="amber" dot>indicative</Badge>}</td>
                <td className="px-5 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setRate(String(l.cetRate)); setNote(l.note ?? ''); }}>Verify</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Verify ${editing ? formatHs(editing.code) : ''}`}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={save.isPending} disabled={rate === '' || Number.isNaN(Number(rate))} onClick={() => save.mutate()}>Save as verified</Button></>}
      >
        <p className="text-sm text-slate-600 dark:text-navy-300">{editing?.description}</p>
        <div className="mt-4 grid gap-3">
          <Field label="Confirmed CET rate (%)"><input className="input" type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
          <Field label="Note (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Source / remarks" /></Field>
        </div>
      </Modal>
    </Card>
  );
}

interface AnchorStatus {
  backend: string;
  networkName: string;
  chainId?: number;
  contract?: string;
  independentlyVerifiable: boolean;
  health: { ok: boolean; detail: string; blockNumber?: number; wallet?: { address: string; balance: string; low: boolean; authorized: boolean }; warnings?: string[] };
  cost: { batches: number; documents: number; gasUsed: number; totalNative: number; perDocumentNative: number; avgGasPerBatch: number };
  queuedDocuments: number;
  batches: Record<string, number>;
  lastRunAt: string | null;
  lastError: string | null;
  recentBatches: Array<{ id: string; root: string; leafCount: number; backend: string; status: string; txHash: string | null; blockNumber: number | null; anchoredAt: string | null; attempts: number; error: string | null; createdAt: string }>;
}

function Anchoring() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-anchor'], queryFn: () => api.get<AnchorStatus>('/admin/anchor'), refetchInterval: 5000 });
  const run = useMutation({ mutationFn: () => api.post('/admin/anchor/run'), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-anchor'] }) });
  if (q.isLoading || !q.data) return <PageLoader />;
  const a = q.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><p className="text-xs text-slate-500">Backend</p><p className="mt-1 font-semibold">{a.networkName}</p><p className="text-xs text-slate-500">{a.chainId ? `chain ${a.chainId}` : a.backend}</p></Card>
        <Card><p className="text-xs text-slate-500">Health</p><p className={`mt-1 font-semibold ${a.health.ok ? 'text-emerald-600' : 'text-red-600'}`}>{a.health.ok ? 'Healthy' : 'Down'}</p><p className="text-xs text-slate-500">{a.health.detail}{a.health.blockNumber !== undefined ? ` · block ${a.health.blockNumber}` : ''}</p></Card>
        <Card><p className="text-xs text-slate-500">Queued documents</p><p className="mt-1 text-2xl font-semibold">{a.queuedDocuments}</p></Card>
        <Card><p className="text-xs text-slate-500">Batches</p><p className="mt-1 text-sm">{Object.entries(a.batches).map(([k, v]) => `${v} ${k}`).join(' · ') || 'none'}</p><p className="text-xs text-slate-500">last run {relative(a.lastRunAt)}</p></Card>
      </div>
      {a.health.warnings?.map((w) => <Alert key={w} tone="warning">{w}</Alert>)}
      {a.lastError && <Alert tone="error" title="Last anchoring cycle failed">{a.lastError}</Alert>}
      {(a.health.wallet || a.cost.batches > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {a.health.wallet && (
            <Card title="Anchor wallet">
              <p className="text-sm"><Hash value={a.health.wallet.address} /></p>
              <p className={`mt-2 text-xl font-semibold ${a.health.wallet.low ? 'text-amber-600' : ''}`}>{Number(a.health.wallet.balance).toFixed(5)}</p>
              <p className="text-xs text-slate-500">{a.health.wallet.authorized ? 'Authorised anchorer' : 'NOT authorised on the contract'}</p>
            </Card>
          )}
          <Card title="Anchoring cost">
            <p className="text-xl font-semibold">{a.cost.perDocumentNative.toExponential(2)}</p>
            <p className="text-xs text-slate-500">native units per document · {a.cost.documents} documents in {a.cost.batches} batches · ≈{a.cost.avgGasPerBatch.toLocaleString()} gas per batch</p>
          </Card>
        </div>
      )}
      <Card title="Recent batches" action={<Button size="sm" variant="secondary" icon={<Play className="size-3.5" />} loading={run.isPending} onClick={() => run.mutate()}>Run now</Button>} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-navy-700"><th className="px-5 py-2 font-medium">Root</th><th className="px-3 py-2 font-medium">Docs</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Tx</th><th className="px-5 py-2 font-medium">Anchored</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {a.recentBatches.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-2"><Hash value={b.root} /></td>
                  <td className="px-3 py-2 tabular-nums">{b.leafCount}</td>
                  <td className="px-3 py-2"><Badge tone={b.status === 'confirmed' ? 'green' : b.status === 'failed' ? 'red' : 'blue'}>{b.status}{b.attempts > 1 ? ` · ${b.attempts} tries` : ''}</Badge>{b.error && <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={b.error}>{b.error}</p>}</td>
                  <td className="px-3 py-2">{b.txHash ? <Hash value={b.txHash} /> : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-xs text-slate-500">{dateTime(b.anchoredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

interface OrgRow { id: string; name: string; country: string; plan: string; created_at: string; users: number; shipments: number; period: string; totalCents: number; paidCents: number; balanceCents: number }

function Orgs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-orgs'], queryFn: () => api.get<OrgRow[]>('/admin/orgs') });
  const [paying, setPaying] = useState<OrgRow | null>(null);
  const [form, setForm] = useState({ amount: '', method: 'mobile_money', reference: '' });
  const pay = useMutation({
    mutationFn: () => api.post('/admin/payments', { orgId: paying!.id, period: paying!.period, amountCents: Math.round(Number(form.amount) * 100), method: form.method, reference: form.reference || undefined }),
    onSuccess: () => {
      setPaying(null);
      void qc.invalidateQueries({ queryKey: ['admin-orgs'] });
    },
  });
  if (q.isLoading) return <PageLoader />;
  return (
    <Card title="Pilot accounts" subtitle="Current month’s charges and payments" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-navy-700"><th className="px-5 py-2 font-medium">Organisation</th><th className="px-3 py-2 font-medium">Users</th><th className="px-3 py-2 font-medium">Shipments</th><th className="px-3 py-2 text-right font-medium">Due</th><th className="px-3 py-2 text-right font-medium">Balance</th><th className="px-5 py-2" /></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {(q.data ?? []).map((o) => (
              <tr key={o.id}>
                <td className="px-5 py-2.5"><p className="font-medium">{o.name}</p><p className="text-xs text-slate-500">since {relative(o.created_at)}</p></td>
                <td className="px-3 py-2.5 tabular-nums">{o.users}</td>
                <td className="px-3 py-2.5 tabular-nums">{o.shipments}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{cents(o.totalCents)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${o.balanceCents > 0 ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{cents(o.balanceCents)}</td>
                <td className="px-5 py-2.5 text-right"><Button size="sm" variant="secondary" onClick={() => { setPaying(o); setForm({ amount: (Math.max(0, o.balanceCents) / 100).toFixed(2), method: 'mobile_money', reference: '' }); }}>Record payment</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Payment from ${paying?.name}`} footer={<><Button variant="secondary" onClick={() => setPaying(null)}>Cancel</Button><Button loading={pay.isPending} disabled={!(Number(form.amount) > 0)} onClick={() => pay.mutate()}>Record</Button></>}>
        <div className="grid gap-3">
          <Field label={`Amount (USD) for ${paying?.period}`}><input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Method">
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option>
            </select>
          </Field>
          <Field label="Reference"><input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="MoMo transaction ID" /></Field>
        </div>
      </Modal>
    </Card>
  );
}

function Audit() {
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => api.get<Array<{ id: string; action: string; entity: string | null; entityId: string | null; createdAt: string; email: string | null; org: string | null }>>('/admin/audit') });
  if (q.isLoading) return <PageLoader />;
  return (
    <Card title="Audit log" subtitle="Latest 100 actions across all organisations" padded={false}>
      <ul className="divide-y divide-slate-100 dark:divide-navy-800">
        {(q.data ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
            <span><Badge>{a.action}</Badge> <span className="text-slate-600 dark:text-navy-300">{a.email ?? 'system'}</span>{a.org && <span className="text-slate-400"> · {a.org}</span>}</span>
            <span className="text-xs text-slate-500">{a.entityId && <span className="mono mr-2">{a.entityId}</span>}{dateTime(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface SignalPerf { reports: number; labelled: number; byRisk: Record<string, { fraud: number; genuine: number; unlabelled: number }>; signals: Array<{ code: string; title: string; level: string; fired: number; fraud: number; genuine: number; precision: number | null }> }

function Signals() {
  const q = useQuery({ queryKey: ['signal-perf'], queryFn: () => api.get<SignalPerf>('/admin/signal-performance') });
  if (q.isLoading || !q.data) return <PageLoader />;
  const d = q.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><p className="text-xs text-slate-500">Documents checked</p><p className="mt-1 text-2xl font-semibold">{d.reports}</p></Card>
        <Card><p className="text-xs text-slate-500">With known outcome</p><p className="mt-1 text-2xl font-semibold">{d.labelled}</p></Card>
        {(['high', 'medium'] as const).map((lvl) => (
          <Card key={lvl}><p className="text-xs text-slate-500">Rated {lvl} risk → fraud</p><p className="mt-1 text-2xl font-semibold">{d.byRisk[lvl] ? `${d.byRisk[lvl].fraud}/${d.byRisk[lvl].fraud + d.byRisk[lvl].genuine}` : '—'}</p></Card>
        ))}
      </div>
      <Card title="How well each signal predicts fraud" subtitle="Precision = share of labelled documents where the signal fired that really were fraudulent. Use it to tune weights once enough outcomes are recorded." padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-navy-700"><th className="px-5 py-2 font-medium">Signal</th><th className="px-3 py-2 font-medium">Weight</th><th className="px-3 py-2 text-right font-medium">Fired</th><th className="px-3 py-2 text-right font-medium">Fraud</th><th className="px-3 py-2 text-right font-medium">Genuine</th><th className="px-5 py-2 text-right font-medium">Precision</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {d.signals.map((s) => (
                <tr key={s.code}>
                  <td className="px-5 py-2"><p className="font-medium">{s.title}</p><p className="mono text-slate-500">{s.code}</p></td>
                  <td className="px-3 py-2"><Badge tone={s.level === 'critical' || s.level === 'high' ? 'red' : s.level === 'medium' ? 'amber' : 'neutral'}>{s.level}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.fired}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.fraud}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.genuine}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{s.precision === null ? '—' : `${Math.round(s.precision * 100)}%`}{s.fraud + s.genuine > 0 && s.fraud + s.genuine < 10 && <span className="ml-1 text-xs text-slate-400">(few)</span>}</td>
                </tr>
              ))}
              {d.signals.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No documents checked yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Authorities() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-authorities'], queryFn: () => api.get<Array<{ id: string; name: string; country: string; officers: number; pending: number; endorsed: number; createdAt: string }>>('/admin/authorities') });
  const [f, setF] = useState({ name: '', country: 'RW', officerEmail: '' });
  const [invite, setInvite] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<{ inviteUrl: string }>('/admin/authorities', f),
    onSuccess: (r) => {
      setInvite(r.inviteUrl);
      setF({ name: '', country: 'RW', officerEmail: '' });
      void qc.invalidateQueries({ queryKey: ['admin-authorities'] });
    },
  });
  if (q.isLoading) return <PageLoader />;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card title="Issuing authorities" subtitle="Organisations whose officers can endorse certificates of origin on SealChain." padded={false}>
        {(q.data ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No authorities onboarded yet.</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {q.data!.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><p className="font-medium">{a.name}</p><p className="text-xs text-slate-500">{a.country} · {a.officers} officer(s) · joined {relative(a.createdAt)}</p></div>
                <div className="flex gap-2"><Badge tone="blue">{a.pending} pending</Badge><Badge tone="green">{a.endorsed} endorsed</Badge></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Onboard an authority">
        <div className="space-y-3">
          {invite && <Alert tone="success" title="Invitation sent">Share this link with the officer if the email does not arrive:<code className="mono mt-1 block break-all">{invite}</code></Alert>}
          {create.error && <Alert tone="error">{create.error instanceof Error ? create.error.message : 'Failed'}</Alert>}
          <Field label="Authority name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Rwanda Revenue Authority — Customs" /></Field>
          <Field label="Country">
            <select className="input" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              {['RW', 'KE', 'UG', 'TZ', 'BI', 'SS', 'CD', 'SO'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="First officer's email"><input className="input" type="email" value={f.officerEmail} onChange={(e) => setF({ ...f, officerEmail: e.target.value })} /></Field>
          <Button size="sm" disabled={f.name.length < 3 || !f.officerEmail.includes('@')} loading={create.isPending} onClick={() => create.mutate()}>Create & invite</Button>
        </div>
      </Card>
    </div>
  );
}
