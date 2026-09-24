import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CopyPlus, Download, ExternalLink, FileCheck2, History, Link2, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';
import { DOCUMENT_KIND_LABEL, formatHs, lineTotal, type ValidationReport } from '@sealchain/core';
import { ApiError, api, type DocSummary, type ShipmentDetail } from '../api';
import { useAuth, useMeta } from '../auth';
import { Alert, Badge, Button, Card, Hash, Modal, PageHeader, PageLoader, type Tone } from '../components/ui';
import { ValidationPanel } from '../components/ValidationPanel';
import { ActivityFeed, SharePanel } from '../components/Sharing';
import { EndorsementPanel } from '../components/Endorsement';
import { COUNTRY_FLAG, COUNTRY_NAME, bytes, date, dateTime, money, num, relative } from '../format';

const ANCHOR_BADGE: Record<string, { tone: Tone; label: string }> = {
  queued: { tone: 'blue', label: 'Queued for anchoring' },
  pending: { tone: 'blue', label: 'Anchoring…' },
  submitted: { tone: 'blue', label: 'Awaiting confirmation' },
  confirmed: { tone: 'green', label: 'Anchored' },
  failed: { tone: 'amber', label: 'Retrying anchor' },
};

export function ShipmentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = useMeta();
  const { me } = useAuth();
  const canRevoke = me?.user.role !== 'member';
  const [confirm, setConfirm] = useState<ValidationReport | null>(null);
  const [issueError, setIssueError] = useState<ValidationReport | null>(null);
  const [revoking, setRevoking] = useState<DocSummary | null>(null);
  const [reason, setReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const q = useQuery({
    queryKey: ['shipment', id],
    queryFn: () => api.get<ShipmentDetail>(`/shipments/${id}`),
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.documents.some((x) => x.status === 'active' && x.anchor.status !== 'confirmed') ? 2500 : false;
    },
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['shipment', id] });
    await qc.invalidateQueries({ queryKey: ['shipments'] });
    await qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const issue = useMutation({
    mutationFn: (ack: boolean) => api.post(`/shipments/${id}/issue`, { acknowledgeWarnings: ack }),
    onSuccess: async () => {
      setConfirm(null);
      setIssueError(null);
      await refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setConfirm(e.details as ValidationReport);
      else if (e instanceof ApiError && e.status === 422) setIssueError(e.details as ValidationReport);
    },
  });

  const revoke = useMutation({
    mutationFn: () => api.post(`/documents/${revoking!.id}/revoke`, { reason }),
    onSuccess: async () => {
      setRevoking(null);
      setReason('');
      await refresh();
    },
  });

  const duplicate = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/shipments/${id}/duplicate`),
    onSuccess: (r) => navigate(`/app/shipments/${r.id}/edit`),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/shipments/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['shipments'] });
      navigate('/app/shipments');
    },
  });

  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <Alert tone="error">Shipment not found.</Alert>;
  const s = q.data;
  const d = s.data;
  const active = s.documents.filter((x) => x.status === 'active' || (x.status === 'revoked' && x.version === s.version));
  const older = s.documents.filter((x) => !active.includes(x));
  const corridorName = meta.data?.corridors.find((c) => c.id === d.corridorId)?.name ?? d.corridorId;
  const pkgs = d.items.reduce((n, i) => n + i.packageCount, 0);
  const gross = d.items.reduce((n, i) => n + i.grossWeightKg, 0);

  return (
    <>
      <PageHeader
        eyebrow={`${COUNTRY_FLAG[d.exporter.country] ?? ''} ${corridorName} ${COUNTRY_FLAG[d.consignee.country] ?? ''}`}
        title={d.reference || d.invoiceNumber || 'Shipment'}
        subtitle={<>Invoice {d.invoiceNumber || '—'} · {d.consignee.name || 'no consignee'} · updated {relative(s.updatedAt)}</>}
        actions={
          <>
            <Link to={`/app/shipments/${id}/edit`}>
              <Button variant="secondary" icon={<Pencil className="size-4" />}>Edit</Button>
            </Link>
            <Button variant="ghost" icon={<CopyPlus className="size-4" />} onClick={() => duplicate.mutate()} loading={duplicate.isPending}>Duplicate</Button>
            {s.status === 'draft' && (
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => confirm_('Delete this draft?') && remove.mutate()}>Delete</Button>
            )}
            {(s.status === 'draft' || s.documentsOutOfDate) && (
              <Button icon={s.status === 'draft' ? <Send className="size-4" /> : <RefreshCw className="size-4" />} loading={issue.isPending} onClick={() => issue.mutate(false)}>
                {s.status === 'draft' ? 'Issue documents' : `Re-issue as v${s.version + 1}`}
              </Button>
            )}
          </>
        }
      />

      {issueError && (
        <Alert tone="error" className="mb-5" title={`${issueError.counts.error} error(s) must be fixed before issuing`}>
          <ul className="mt-1 list-disc pl-5">
            {issueError.findings.filter((f) => f.severity === 'error').slice(0, 6).map((f, i) => <li key={i}>{f.message}</li>)}
          </ul>
          <Link to={`/app/shipments/${id}/edit`} className="mt-2 inline-block font-medium underline">Fix in the editor</Link>
        </Alert>
      )}
      {s.documentsOutOfDate && (
        <Alert tone="warning" className="mb-5" title="The shipment changed after its documents were issued">
          The issued documents no longer match this record. Re-issue to publish version {s.version + 1}; the current documents will then verify as <em>superseded</em>.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card
            title={s.status === 'issued' ? `Documents · version ${s.version}` : 'Documents'}
            subtitle={s.status === 'issued' ? 'Each file is fingerprinted, signed and anchored. Share the PDF — anyone can verify it.' : 'Issue to generate the corridor document set.'}
            padded={active.length === 0}
          >
            {active.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <FileCheck2 className="mb-3 size-8 text-slate-300" />
                <p className="text-sm text-slate-600 dark:text-navy-300">Commercial invoice, EAC certificate of origin and packing list will be generated from this record.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                {active.map((doc) => <DocRow key={doc.id} doc={doc} onRevoke={canRevoke ? () => setRevoking(doc) : undefined} />)}
              </ul>
            )}
          </Card>

          {s.status === 'issued' && (
            <EndorsementPanel
              shipmentId={s.id}
              certificate={s.documents.find((x) => x.kind === 'certificate_of_origin' && x.status === 'active')}
              originCountry={d.exporter.country}
            />
          )}
          <SharePanel shipmentId={s.id} issued={s.status === 'issued'} />
          {s.status === 'issued' && <ActivityFeed shipmentId={s.id} title="Who has checked these documents" />}

          {older.length > 0 && (
            <Card
              title="Earlier versions"
              action={<button onClick={() => setShowHistory((v) => !v)} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">{showHistory ? 'Hide' : `Show ${older.length}`}</button>}
              padded={false}
            >
              {showHistory && (
                <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                  {older.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <History className="size-4 text-slate-400" />
                        {DOCUMENT_KIND_LABEL[doc.kind]} <span className="mono text-slate-500">{doc.number}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={doc.status === 'revoked' ? 'red' : 'neutral'}>{doc.status} · v{doc.version}</Badge>
                        <Link to={`/v/${doc.id}`} className="text-xs text-brand-700 hover:underline dark:text-brand-300">Verification</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title="Consignment">
            <div className="grid gap-5 sm:grid-cols-2">
              {(['exporter', 'consignee'] as const).map((r) => (
                <div key={r}>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{r}</p>
                  <p className="mt-1 font-medium">{d[r].name || '—'}</p>
                  <p className="text-sm text-slate-600 dark:text-navy-300">{d[r].address}{d[r].address && ', '}{d[r].city}, {COUNTRY_NAME[d[r].country]}</p>
                  {d[r].taxId && <p className="mono mt-0.5 text-slate-500">{d[r].taxId}</p>}
                </div>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4 dark:border-navy-700">
              {[
                ['Route', `${d.placeOfLoading} → ${d.finalDestination}`],
                ['Border', [d.exitPoint, d.entryPoint].filter(Boolean).join(' → ') || '—'],
                ['Transport', `${d.transportMode}${d.transportRef ? ` · ${d.transportRef}` : ''}`],
                ['Terms', `${d.incoterm} ${d.incotermPlace}`],
                ['Invoice date', date(d.invoiceDate)],
                ['Departure', date(d.departureDate)],
                ['Packages', num(pkgs)],
                ['Gross weight', `${num(gross, 0)} kg`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="truncate font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="-mx-5 mt-5 overflow-x-auto border-t border-slate-100 dark:border-navy-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-5 py-2 font-medium">Goods</th>
                    <th className="px-3 py-2 font-medium">HS</th>
                    <th className="px-3 py-2 font-medium">Origin</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-5 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {d.items.map((it) => (
                    <tr key={it.id}>
                      <td className="max-w-72 px-5 py-2.5">{it.description}</td>
                      <td className="mono whitespace-nowrap px-3 py-2.5">{it.hsCode ? formatHs(it.hsCode) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{it.originCountry} · {it.originCriterion}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{num(it.quantity)} {it.unit}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">{money(lineTotal(it), d.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ValidationPanel report={s.validation} />
        </aside>
      </div>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Review before issuing"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Go back</Button>
            <Button onClick={() => issue.mutate(true)} loading={issue.isPending}>I’ve reviewed these — issue</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-navy-300">These warnings won’t stop the documents being issued, but each is a common reason for delay at the border.</p>
        <ul className="mt-3 space-y-2">
          {confirm?.findings.filter((f) => f.severity === 'warning').map((f, i) => (
            <li key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">{f.message}</li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={`Revoke ${revoking?.number}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)}>Cancel</Button>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={revoke.isPending} onClick={() => revoke.mutate()}>Revoke document</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-navy-300">
          Anyone verifying this document will see it is revoked and why. The anchor stays on-chain — revocation is recorded, not erased.
        </p>
        <label className="mt-4 block">
          <span className="label">Reason (shown to verifiers)</span>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Order cancelled by buyer" autoFocus />
        </label>
      </Modal>
    </>
  );
}

function confirm_(msg: string) {
  return window.confirm(msg);
}

function DocRow({ doc, onRevoke }: { doc: DocSummary; onRevoke?: () => void }) {
  const [copied, setCopied] = useState(false);
  const badge = doc.status === 'revoked' ? { tone: 'red' as Tone, label: 'Revoked' } : ANCHOR_BADGE[doc.anchor.status] ?? { tone: 'neutral' as Tone, label: doc.anchor.status };
  const verifyUrl = `${window.location.origin}/v/${doc.id}`;
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <FileCheck2 className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{DOCUMENT_KIND_LABEL[doc.kind]}</p>
            <Badge tone={badge.tone} dot>{badge.label}</Badge>
            {doc.anchor.backend === 'local' && doc.anchor.status === 'confirmed' && <Badge tone="amber">dev ledger</Badge>}
          </div>
          <p className="mono mt-0.5 text-slate-500">{doc.number}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>SHA-256 <Hash value={doc.sha256} /></span>
            <span>{bytes(doc.size)}</span>
            <span>{doc.anchor.anchoredAt ? `anchored ${dateTime(doc.anchor.anchoredAt)}` : `issued ${dateTime(doc.issuedAt)}`}</span>
          </p>
          {doc.revokedReason && <p className="mt-1 text-xs text-red-600">Revoked: {doc.revokedReason}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        <a href={`/api/documents/${doc.id}/pdf`}>
          <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />}>PDF</Button>
        </a>
        <Link to={`/v/${doc.id}`} target="_blank">
          <Button size="sm" variant="ghost" icon={<ExternalLink className="size-3.5" />}>Verify</Button>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          icon={<Link2 className="size-3.5" />}
          onClick={() => {
            void navigator.clipboard?.writeText(verifyUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Link'}
        </Button>
        {doc.status === 'active' && onRevoke && (
          <Button size="sm" variant="ghost" icon={<Ban className="size-3.5" />} onClick={onRevoke} title="Revoke" />
        )}
      </div>
    </li>
  );
}
