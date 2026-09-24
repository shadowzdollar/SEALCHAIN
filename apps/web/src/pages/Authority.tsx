/** Issuing-authority workspace: review and endorse certificates of origin. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, FileCheck2, Inbox, XCircle } from 'lucide-react';
import { formatHs } from '@sealchain/core';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { Alert, Badge, Button, Card, EmptyState, Field, Hash, Modal, PageHeader, PageLoader, Tabs } from '../components/ui';
import { COUNTRY_NAME, dateTime, num, relative } from '../format';

interface Req {
  id: string;
  status: string;
  requestedAt: string;
  requester: string;
  requestNote: string | null;
  decisionNote: string | null;
  officer: string | null;
  decidedAt: string | null;
  document: { id: string; number: string; status: string; sha256: string };
  shipment: {
    corridor: string;
    exporter: { name: string; address: string; city: string; country: string; taxId?: string };
    consignee: { name: string; country: string };
    invoiceNumber: string;
    invoiceDate: string;
    items: Array<{ description: string; hsCode: string; quantity: number; unit: string; originCountry: string; originCriterion: string; nonOriginatingPct?: number; processingNote?: string; grossWeightKg: number }>;
  };
  validation: { status: string; errors: number; warnings: number; findings: string[] } | null;
}

export function Authority() {
  const { me } = useAuth();
  const [tab, setTab] = useState<'pending' | 'endorsed' | 'rejected'>('pending');
  const q = useQuery({ queryKey: ['authority-queue', tab], queryFn: () => api.get<Req[]>(`/authority/queue?status=${tab}`), refetchInterval: 30_000 });
  return (
    <>
      <PageHeader eyebrow={me?.org.name} title="Endorsement requests" subtitle="Certificates of origin exporters have asked you to endorse. Your decision is signed and recorded on-chain against the exact document." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'pending', label: 'To review' }, { id: 'endorsed', label: 'Endorsed' }, { id: 'rejected', label: 'Declined' }]} />
      <div className="mt-6 space-y-5">
        {q.isLoading ? <PageLoader /> : (q.data ?? []).length === 0 ? (
          <Card><EmptyState icon={<Inbox className="size-5" />} title={tab === 'pending' ? 'Nothing waiting for review' : 'Nothing here yet'}>New requests appear here and are emailed to your team.</EmptyState></Card>
        ) : q.data!.map((r) => <RequestCard key={r.id} r={r} />)}
      </div>
    </>
  );
}

function RequestCard({ r }: { r: Req }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (decision: 'endorse' | 'reject') => api.post(`/authority/requests/${r.id}/decision`, { decision, note: note || undefined }),
    onSuccess: () => {
      setRejecting(false);
      void qc.invalidateQueries({ queryKey: ['authority-queue'] });
    },
  });
  const s = r.shipment;
  const stale = r.document.status !== 'active';
  return (
    <Card
      title={<span className="flex items-center gap-2"><FileCheck2 className="size-4 text-brand-700" /> {r.document.number}</span>}
      subtitle={`${r.requester} · ${s.corridor} · requested ${relative(r.requestedAt)}`}
      action={
        r.status === 'pending' ? <Badge tone="blue">To review</Badge>
          : r.status === 'endorsed' ? <Badge tone="green">Endorsed by {r.officer}</Badge>
            : <Badge tone="red">Declined by {r.officer}</Badge>
      }
    >
      {stale && r.status === 'pending' && <Alert tone="warning" className="mb-4">The exporter has {r.document.status === 'revoked' ? 'revoked' : 'replaced'} this certificate. It can no longer be endorsed.</Alert>}
      {r.requestNote && <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-navy-800/60"><span className="text-slate-500">Exporter's note:</span> {r.requestNote}</p>}
      <div className="grid gap-5 md:grid-cols-2">
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-slate-500">Exporter</dt><dd className="font-medium">{s.exporter.name}</dd><dd className="text-slate-500">{s.exporter.address}, {s.exporter.city} · TIN <span className="mono">{s.exporter.taxId ?? '—'}</span></dd></div>
          <div><dt className="text-xs text-slate-500">Consignee</dt><dd className="font-medium">{s.consignee.name}, {COUNTRY_NAME[s.consignee.country]}</dd></div>
          <div><dt className="text-xs text-slate-500">Invoice</dt><dd>{s.invoiceNumber} · {s.invoiceDate}</dd></div>
          <div><dt className="text-xs text-slate-500">Document fingerprint</dt><dd><Hash value={r.document.sha256} /></dd></div>
        </dl>
        <div>
          <p className="text-xs text-slate-500">Platform pre-check</p>
          {r.validation ? (
            <div className="mt-1">
              <Badge tone={r.validation.errors ? 'red' : r.validation.warnings ? 'amber' : 'green'}>{r.validation.errors} errors · {r.validation.warnings} warnings</Badge>
              {r.validation.findings.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-navy-300">{r.validation.findings.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}</ul>
              )}
            </div>
          ) : <p className="text-sm">—</p>}
        </div>
      </div>
      <div className="-mx-5 mt-5 overflow-x-auto border-t border-slate-100 dark:border-navy-700">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="px-5 py-2 font-medium">Goods</th><th className="px-3 py-2 font-medium">HS</th><th className="px-3 py-2 font-medium">Origin claim</th><th className="px-5 py-2 text-right font-medium">Quantity</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {s.items.map((it, i) => (
              <tr key={i}>
                <td className="px-5 py-2">{it.description}{it.processingNote && <span className="block text-xs text-slate-500">Processing: {it.processingNote}</span>}</td>
                <td className="mono whitespace-nowrap px-3 py-2">{formatHs(it.hsCode)}</td>
                <td className="whitespace-nowrap px-3 py-2">{it.originCountry} · {it.originCriterion}{it.nonOriginatingPct !== undefined && it.originCriterion === 'PSR' ? ` (${it.nonOriginatingPct}% imported)` : ''}</td>
                <td className="whitespace-nowrap px-5 py-2 text-right tabular-nums">{num(it.quantity)} {it.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.decisionNote && r.status !== 'pending' && <p className="mt-4 text-sm text-slate-600 dark:text-navy-300">Note: {r.decisionNote} · {dateTime(r.decidedAt)}</p>}
      {decide.error && <Alert tone="error" className="mt-4">{decide.error instanceof ApiError ? decide.error.message : 'Could not record the decision'}</Alert>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-navy-700">
        <a href={`/api/authority/requests/${r.id}/pdf`} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<ExternalLink className="size-3.5" />}>Open certificate</Button></a>
        {r.status === 'pending' && !stale && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" icon={<XCircle className="size-3.5" />} onClick={() => setRejecting(true)}>Decline</Button>
            <Button size="sm" icon={<CheckCircle2 className="size-3.5" />} loading={decide.isPending && decide.variables === 'endorse'} onClick={() => window.confirm(`Endorse ${r.document.number} on behalf of your authority? This is recorded permanently.`) && decide.mutate('endorse')}>Endorse</Button>
          </div>
        )}
      </div>
      <Modal open={rejecting} onClose={() => setRejecting(false)} title={`Decline ${r.document.number}`} footer={<><Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button><Button variant="danger" disabled={note.trim().length < 5} loading={decide.isPending} onClick={() => decide.mutate('reject')}>Decline</Button></>}>
        <Field label="Reason for the exporter" hint="They will correct the certificate and request again."><textarea className="input min-h-24" value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
      </Modal>
    </Card>
  );
}
