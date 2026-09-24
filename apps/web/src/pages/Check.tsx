import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, CheckCircle2, FileSearch, Info, Minus, Plus, ShieldAlert, Stamp, Trash2 } from 'lucide-react';
import { formatHs } from '@sealchain/core';
import { ApiError, api, type ForensicReport, type Signal } from '../api';
import { Alert, Badge, Button, Card, Dropzone, EmptyState, Field, Hash, PageHeader, cx, type Tone } from '../components/ui';
import { dateTime, relative } from '../format';

const LEVEL: Record<Signal['level'], { tone: Tone; label: string }> = {
  critical: { tone: 'red', label: 'Critical' },
  high: { tone: 'red', label: 'High' },
  medium: { tone: 'amber', label: 'Medium' },
  low: { tone: 'neutral', label: 'Low' },
  pass: { tone: 'green', label: 'Pass' },
};

const RISK = {
  high: { cls: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40', bar: 'bg-red-500', label: 'High risk' },
  medium: { cls: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40', bar: 'bg-amber-500', label: 'Some warning signs' },
  low: { cls: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40', bar: 'bg-emerald-500', label: 'Low risk' },
};

export function Check() {
  const qc = useQueryClient();
  const [doc, setDoc] = useState<File | null>(null);
  const [companion, setCompanion] = useState<File | null>(null);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const history = useQuery({ queryKey: ['forensics'], queryFn: () => api.get<Array<{ id: string; filename: string; riskLevel: string; riskScore: number; createdAt: string }>>('/forensics') });

  const analyze = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('document', doc!);
      if (companion) fd.append('companion', companion);
      return api.post<ForensicReport>('/forensics', fd);
    },
    onSuccess: (r) => {
      setReport(r);
      void qc.invalidateQueries({ queryKey: ['forensics'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const open = async (id: string) => setReport(await api.get<ForensicReport>(`/forensics/${id}`));

  return (
    <>
      <PageHeader
        title="Check a document"
        subtitle="For certificates and invoices you receive from suppliers, brokers or buyers — including ones not issued with SealChain."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="label">Document to check <span className="text-red-500">*</span></p>
                <Dropzone onFile={setDoc} file={doc} compact label="Drop the PDF" sub="Certificate of origin, invoice…" />
              </div>
              <div>
                <p className="label">Matching invoice or packing list (optional)</p>
                <Dropzone onFile={setCompanion} file={companion} compact label="Drop a companion PDF" sub="We cross-check the two for contradictions" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Files are analysed on SealChain’s servers and a report is kept for your team.</p>
              <div className="flex gap-2">
                {(doc || companion) && <Button variant="ghost" onClick={() => { setDoc(null); setCompanion(null); setReport(null); }}>Clear</Button>}
                <Button disabled={!doc} loading={analyze.isPending} icon={<FileSearch className="size-4" />} onClick={() => analyze.mutate()}>Analyse</Button>
              </div>
            </div>
            {analyze.error && <Alert tone="error" className="mt-4">{analyze.error instanceof ApiError ? analyze.error.message : 'Analysis failed'}</Alert>}
          </Card>

          {report && <ReportView report={report} />}
          {report?.id && <Outcome key={report.id} id={report.id} initial={(report as ForensicReport & { outcome?: string | null }).outcome ?? null} />}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Recent checks" padded={false}>
            {(history.data ?? []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No checks yet.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-navy-800">
                {history.data!.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => void open(h.id)} className="flex w-full items-center justify-between gap-2 px-5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy-800/40">
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{h.filename}</span>
                        <span className="text-xs text-slate-500">{relative(h.createdAt)}</span>
                      </span>
                      <Badge tone={h.riskLevel === 'high' ? 'red' : h.riskLevel === 'medium' ? 'amber' : 'green'}>{h.riskScore}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <SealReferences />
        </div>
      </div>
    </>
  );
}

function ReportView({ report }: { report: ForensicReport }) {
  const r = RISK[report.risk.level];
  const f = report.fields;
  const passes = report.signals.filter((s) => s.level === 'pass');
  const issues = report.signals.filter((s) => s.level !== 'pass');
  return (
    <div className="space-y-6">
      <div className={cx('rounded-xl border-2 p-5', r.cls)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {report.risk.level === 'high' ? <AlertOctagon className="size-7 text-red-600" /> : report.risk.level === 'medium' ? <ShieldAlert className="size-7 text-amber-600" /> : <CheckCircle2 className="size-7 text-emerald-600" />}
            <div>
              <p className="text-lg font-semibold">{r.label}</p>
              <p className="text-xs text-slate-600 dark:text-navy-300">{report.filename}</p>
            </div>
          </div>
          <div className="w-40">
            <div className="flex justify-between text-xs"><span>Risk score</span><span className="font-semibold tabular-nums">{report.risk.score}/100</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-navy-800"><div className={cx('h-full rounded-full', r.bar)} style={{ width: `${Math.max(4, report.risk.score)}%` }} /></div>
          </div>
        </div>
        <p className="mt-3 text-sm">{report.summary}</p>
        {report.registered && (
          <p className="mt-2 text-sm">
            Matches <Link to={`/v/${report.registered.id}`} className="font-medium underline">{report.registered.number}</Link> ({report.registered.status}).
          </p>
        )}
      </div>

      {report.claimed && (
        <Card title={`Changes compared with the issued ${report.claimed.number}`} subtitle="Lines of visible text that differ between the original and this file.">
          {report.claimed.changes && (report.claimed.changes.removed.length || report.claimed.changes.added.length) ? (
            <div className="mono overflow-x-auto rounded-lg border border-slate-200 dark:border-navy-700">
              {report.claimed.changes.removed.map((l, i) => (
                <div key={`r${i}`} className="flex gap-2 bg-red-50 px-3 py-1 text-red-900 dark:bg-red-950/40 dark:text-red-200"><Minus className="mt-0.5 size-3 shrink-0" />{l}</div>
              ))}
              {report.claimed.changes.added.map((l, i) => (
                <div key={`a${i}`} className="flex gap-2 bg-emerald-50 px-3 py-1 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><Plus className="mt-0.5 size-3 shrink-0" />{l}</div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-navy-300">The visible text is identical — the modification is in images, layout or hidden structure.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Issued fingerprint <Hash value={report.claimed.issuedSha256} /> · this file <Hash value={report.sha256} /> ·{' '}
            <Link to={`/v/${report.claimed.id}`} className="underline">see the genuine record</Link>
          </p>
        </Card>
      )}

      <Card title="Signals" subtitle="Each signal is explained; together they make the score. Signals are advisory — confirm with the issuer before acting." padded={false}>
        <ul className="divide-y divide-slate-100 dark:divide-navy-800">
          {issues.map((s, i) => (
            <li key={i} className="flex gap-3 px-5 py-3">
              <Badge tone={LEVEL[s.level].tone} className="mt-0.5 w-16 justify-center">{LEVEL[s.level].label}</Badge>
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-sm text-slate-600 dark:text-navy-300">{s.detail}</p>
              </div>
            </li>
          ))}
          {passes.map((s, i) => (
            <li key={`p${i}`} className="flex gap-3 px-5 py-2.5">
              <Badge tone="green" className="mt-0.5 w-16 justify-center">Pass</Badge>
              <p className="text-sm"><span className="font-medium">{s.title}</span> <span className="text-slate-500">— {s.detail}</span></p>
            </li>
          ))}
          {report.signals.length === 0 && <li className="flex items-center gap-2 px-5 py-4 text-sm text-slate-600"><Info className="size-4" /> No signals raised.</li>}
        </ul>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="What we read">
          <dl className="space-y-2 text-sm">
            <Row k="Looks like" v={String(f.kindGuess).replace(/_/g, ' ')} />
            <Row k="Document no." v={(f.sealchainId as string) ?? (f.certificateNumber as string) ?? '—'} />
            <Row k="Invoice no." v={f.invoiceNumbers.join(', ') || '—'} />
            <Row k="Exporter" v={(f.exporterName as string) ?? '—'} />
            <Row k="Consignee" v={(f.consigneeName as string) ?? '—'} />
            <Row k="HS codes" v={f.hsCodes.map((c) => formatHs(c)).join(', ') || '—'} />
            <Row k="Dates" v={f.dates.join(', ') || '—'} />
          </dl>
        </Card>
        <Card title="File">
          <dl className="space-y-2 text-sm">
            <Row k="SHA-256" v={<Hash value={report.sha256} />} />
            <Row k="Producer" v={(report.metadata.producer as string) ?? '—'} />
            <Row k="Creator" v={(report.metadata.creator as string) ?? '—'} />
            <Row k="Created" v={dateTime(report.metadata.created as string)} />
            <Row k="Modified" v={dateTime(report.metadata.modified as string)} />
            <Row k="Pages · revisions" v={`${report.metadata.pages} · ${report.metadata.revisions}`} />
            <Row k="Text characters" v={String(report.metadata.textChars)} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-xs text-slate-500">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}

function SealReferences() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['seals'], queryFn: () => api.get<Array<{ id: string; authority: string; label: string; dhash: string }>>('/seals') });
  const [image, setImage] = useState<File | null>(null);
  const [authority, setAuthority] = useState('Rwanda Revenue Authority');
  const [label, setLabel] = useState('');
  const add = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('authority', authority);
      fd.append('label', label || image!.name);
      fd.append('image', image!);
      return api.post('/seals', fd);
    },
    onSuccess: () => {
      setImage(null);
      setLabel('');
      void qc.invalidateQueries({ queryKey: ['seals'] });
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/seals/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['seals'] }) });

  return (
    <Card title="Known-genuine seals" subtitle="Stamps from documents you trust. Checked documents are compared against them.">
      {(list.data ?? []).length === 0 ? (
        <EmptyState icon={<Stamp className="size-5" />} title="No references yet">Add a clean image of a genuine stamp.</EmptyState>
      ) : (
        <ul className="mb-4 space-y-2">
          {list.data!.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.label}</span>
                <span className="block truncate text-xs text-slate-500">{s.authority}</span>
              </span>
              <button className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => del.mutate(s.id)} aria-label="Remove"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-navy-700">
        <Dropzone onFile={setImage} file={image} accept="image/png,image/jpeg" compact label="Seal image" sub="PNG or JPEG" />
        <Field label="Issuing authority">
          <input className="input" value={authority} onChange={(e) => setAuthority(e.target.value)} />
        </Field>
        <Field label="Label">
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="RRA Customs stamp — Kigali" />
        </Field>
        {add.error && <Alert tone="error">{add.error instanceof ApiError ? add.error.message : 'Could not add'}</Alert>}
        <Button size="sm" variant="secondary" disabled={!image || !authority} loading={add.isPending} onClick={() => add.mutate()}>Add reference</Button>
      </div>
    </Card>
  );
}

function Outcome({ id, initial }: { id: string; initial: string | null }) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<string | null>(initial);
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: (o: string) => api.put(`/forensics/${id}/outcome`, { outcome: o, note: note || undefined }),
    onSuccess: (_r, o) => {
      setOutcome(o === 'unknown' ? null : o);
      void qc.invalidateQueries({ queryKey: ['forensics'] });
    },
  });
  return (
    <Card title="What did it turn out to be?" subtitle="Telling us improves the fraud signals for every pilot user. Only the outcome is shared — never the document.">
      {outcome ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">Recorded as <Badge tone={outcome === 'fraud' ? 'red' : 'green'}>{outcome === 'fraud' ? 'Fraudulent / altered' : 'Genuine'}</Badge></p>
          <Button size="sm" variant="ghost" onClick={() => save.mutate('unknown')}>Undo</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <input className="input" placeholder="Optional note (e.g. confirmed with the chamber)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={save.isPending && save.variables === 'fraud'} onClick={() => save.mutate('fraud')}>It was fraudulent / altered</Button>
            <Button size="sm" variant="secondary" loading={save.isPending && save.variables === 'genuine'} onClick={() => save.mutate('genuine')}>It was genuine</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
