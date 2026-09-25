/** Public page behind a share link: the shipment's documents with verification. */
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { formatHs } from '@sealchain/core';
import { ApiError, api } from '../api';
import { Logo, ThemeToggle } from '../components/Layout';
import { Alert, Badge, Button, PageLoader } from '../components/ui';
import { bytes, date, dateTime, num } from '../format';

interface Bundle {
  sharedBy: string;
  recipient: string;
  expiresAt: string;
  shipment: { reference: string; corridor: string; exporter: string; consignee: string; invoiceNumber: string; invoiceDate: string; route: string; border: string; transport: string; items: Array<{ description: string; hsCode: string; quantity: number; unit: string }> };
  documents: Array<{ id: string; kind: string; kindLabel: string; number: string; version: number; status: string; sha256: string; size: number; issuedAt: string; anchored: boolean; anchoredAt: string | null }>;
}

export function SharedBundle() {
  const { token } = useParams();
  const q = useQuery({ queryKey: ['bundle', token], queryFn: () => api.get<Bundle>(`/shares/${token}`), retry: false, refetchOnMount: false });

  return (
    <div className="paper-grid min-h-dvh">
      <header className="border-b border-slate-200 bg-surface/90 dark:border-navy-800 dark:bg-navy-950">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/"><Logo /></Link>
            <span className="hidden h-5 w-px bg-slate-300 sm:block dark:bg-white/20" />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500 sm:block dark:text-navy-300">Shared trade documents</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {q.isLoading && <PageLoader />}
        {q.isError && <Alert tone="error" title="Link not available">{q.error instanceof ApiError ? q.error.message : 'Could not load the documents.'}</Alert>}
        {q.data && <BundleView b={q.data} token={token!} />}
      </main>
    </div>
  );
}

function BundleView({ b, token }: { b: Bundle; token: string }) {
  const s = b.shipment;
  const allAnchored = b.documents.every((d) => d.anchored);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{b.sharedBy} shared these documents with <span className="font-medium text-slate-700 dark:text-slate-300">{b.recipient}</span></p>
        <h1 className="mt-1 font-serif text-[30px] font-semibold tracking-[-0.02em]">{s.reference || s.invoiceNumber}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-navy-300">{s.corridor} · {s.route}{s.border ? ` · via ${s.border}` : ''} · {s.transport}</p>
      </div>

      <div className={`flex items-center gap-3 rounded-[3px] border-2 p-4 ${allAnchored ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40'}`}>
        {allAnchored ? <ShieldCheck className="size-7 text-emerald-600" /> : <Clock className="size-7 text-sky-600" />}
        <p className="text-sm">
          {allAnchored
            ? 'Every document below is registered and anchored on a public blockchain. Downloaded files can be checked against their record at any time.'
            : 'These documents are registered; their blockchain anchor is being written.'}
        </p>
      </div>

      <section className="card divide-y divide-slate-100 dark:divide-navy-800">
        {b.documents.map((d) => (
          <div key={d.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <FileCheck2 className="mt-0.5 size-5 shrink-0 text-brand-700 dark:text-brand-300" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{d.kindLabel}</p>
                  {d.status !== 'active' ? <Badge tone="red">{d.status}</Badge> : d.anchored ? <Badge tone="green" dot>Anchored</Badge> : <Badge tone="blue" dot>Anchoring</Badge>}
                </div>
                <p className="mono text-slate-500">{d.number} · v{d.version} · {bytes(d.size)}</p>
                <p className="text-xs text-slate-500">Issued {dateTime(d.issuedAt)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={`/api/shares/${token}/documents/${d.id}/pdf`}><Button size="sm" icon={<Download className="size-3.5" />}>Download</Button></a>
              <Link to={`/v/${d.id}`} target="_blank"><Button size="sm" variant="secondary" icon={<CheckCircle2 className="size-3.5" />}>Verify</Button></Link>
            </div>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Exporter</dt><dd className="font-medium">{s.exporter}</dd></div>
          <div><dt className="text-xs text-slate-500">Consignee</dt><dd className="font-medium">{s.consignee}</dd></div>
          <div><dt className="text-xs text-slate-500">Invoice</dt><dd className="font-medium">{s.invoiceNumber} · {date(s.invoiceDate)}</dd></div>
          <div><dt className="text-xs text-slate-500">Link expires</dt><dd className="font-medium">{date(b.expiresAt)}</dd></div>
        </dl>
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm dark:divide-navy-800 dark:border-navy-700">
          {s.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-3 py-2">
              <span>{i.description}</span>
              <span className="whitespace-nowrap text-slate-500"><span className="mono">{formatHs(i.hsCode)}</span> · {num(i.quantity)} {i.unit}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-center text-xs text-slate-500">After downloading, drop any file on <Link to="/verify" className="underline">the SealChain verifier</Link> to confirm it is identical to what was issued.</p>
    </div>
  );
}
