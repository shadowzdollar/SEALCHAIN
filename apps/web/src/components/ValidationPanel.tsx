import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, Info, ShieldAlert, XCircle } from 'lucide-react';
import type { Finding, ValidationReport } from '@sealchain/core';
import { Badge, Spinner, cx } from './ui';
import { money } from '../format';

const STATUS = {
  ready: { label: 'Ready to issue', tone: 'green' as const, icon: CheckCircle2, cls: 'text-emerald-600' },
  review: { label: 'Review warnings', tone: 'amber' as const, icon: AlertTriangle, cls: 'text-amber-600' },
  blocked: { label: 'Action required', tone: 'red' as const, icon: XCircle, cls: 'text-red-600' },
};

function FindingRow({ f }: { f: Finding }) {
  const Icon = f.severity === 'error' ? XCircle : f.severity === 'warning' ? AlertTriangle : Info;
  const color = f.severity === 'error' ? 'text-red-600' : f.severity === 'warning' ? 'text-amber-600' : 'text-sky-600';
  return (
    <li className="flex gap-2.5 py-2">
      <Icon className={cx('mt-0.5 size-4 shrink-0', color)} />
      <div className="min-w-0 text-[13px] leading-snug">
        <p className="text-slate-800 dark:text-slate-200">{f.message}</p>
        {f.hint && <p className="mt-0.5 text-slate-500">{f.hint}</p>}
        {f.source && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            Source: {f.source.url ? <a href={f.source.url} target="_blank" rel="noreferrer" className="underline">{f.source.title}</a> : f.source.title}
            {f.source.lastVerifiedAt ? '' : ' · pending verification'}
          </p>
        )}
      </div>
    </li>
  );
}

export function ValidationPanel({ report, loading, live }: { report: ValidationReport | null; loading?: boolean; live?: boolean }) {
  const [showInfo, setShowInfo] = useState(false);
  const [showReqs, setShowReqs] = useState(!live);
  if (!report) {
    return (
      <div className="card flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  const st = STATUS[report.status];
  const errors = report.findings.filter((f) => f.severity === 'error');
  const warnings = report.findings.filter((f) => f.severity === 'warning');
  const infos = report.findings.filter((f) => f.severity === 'info');
  const cur = report.totals && report.duty.currency;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <st.icon className={cx('size-5', st.cls)} />
          <span className="text-sm font-semibold">{st.label}</span>
        </div>
        {loading ? <Spinner className="size-4" /> : live && <span className="text-[11px] text-slate-400">live check</span>}
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center dark:divide-navy-800 dark:border-navy-700">
        {[
          ['Errors', report.counts.error, 'text-red-600'],
          ['Warnings', report.counts.warning, 'text-amber-600'],
          ['Notes', report.counts.info, 'text-sky-600'],
        ].map(([l, n, c]) => (
          <div key={l as string} className="py-2.5">
            <p className={cx('text-lg font-semibold tabular-nums', (n as number) > 0 ? (c as string) : 'text-slate-300 dark:text-slate-600')}>{n}</p>
            <p className="text-[11px] text-slate-500">{l}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1 border-b border-slate-100 px-4 py-3 text-sm dark:border-navy-700">
        <div className="flex justify-between"><span className="text-slate-500">Goods</span><span className="tabular-nums">{money(report.totals.goodsTotal, cur)}</span></div>
        {report.totals.freight > 0 && <div className="flex justify-between"><span className="text-slate-500">Freight</span><span className="tabular-nums">{money(report.totals.freight, cur)}</span></div>}
        {report.totals.insurance > 0 && <div className="flex justify-between"><span className="text-slate-500">Insurance</span><span className="tabular-nums">{money(report.totals.insurance, cur)}</span></div>}
        <div className="flex justify-between font-semibold"><span>Invoice total</span><span className="tabular-nums">{money(report.totals.invoiceTotal, cur)}</span></div>
        {cur !== 'USD' && <div className="flex justify-between text-xs text-slate-500"><span>≈ USD</span><span className="tabular-nums">{money(report.valueUsd, 'USD')}</span></div>}
      </div>

      {report.duty.withoutCoo > 0 && (
        <div className="border-b border-slate-100 bg-brand-50/60 px-4 py-3 dark:border-navy-700 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-800 dark:text-brand-200">
            <ShieldAlert className="size-4" /> What the certificate of origin is worth
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-slate-500">Buyer's duty without it</p>
              <p className="text-base font-semibold tabular-nums">{money(report.duty.withoutCoo, cur)}</p>
            </div>
            <div>
              <p className="text-slate-500">With a valid certificate</p>
              <p className={cx('text-base font-semibold tabular-nums', report.duty.withCoo === 0 && 'text-emerald-700 dark:text-emerald-400')}>{money(report.duty.withCoo, cur)}</p>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">Estimate at CET rates on CIF value; excludes VAT, excise and fees{report.duty.incomplete ? '; some rates unknown' : ''}.</p>
        </div>
      )}

      <div className="max-h-[48vh] overflow-y-auto px-4 py-2">
        {errors.length + warnings.length === 0 && (
          <p className="flex items-center gap-2 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> No errors or warnings.
          </p>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-navy-800">
          {[...errors, ...warnings].map((f, i) => <FindingRow key={`${f.code}-${i}`} f={f} />)}
        </ul>
        {infos.length > 0 && (
          <>
            <button onClick={() => setShowInfo((v) => !v)} className="flex w-full items-center justify-between py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
              {infos.length} note{infos.length === 1 ? '' : 's'} <ChevronDown className={cx('size-4 transition-transform', showInfo && 'rotate-180')} />
            </button>
            {showInfo && <ul className="divide-y divide-slate-100 dark:divide-navy-800">{infos.map((f, i) => <FindingRow key={`${f.code}-i${i}`} f={f} />)}</ul>}
          </>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2 dark:border-navy-700">
        <button onClick={() => setShowReqs((v) => !v)} className="flex w-full items-center justify-between py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-navy-300 dark:hover:text-slate-200">
          <span className="flex items-center gap-1.5"><FileText className="size-3.5" /> {report.requirements.length} documents & permits for this consignment</span>
          <ChevronDown className={cx('size-4 transition-transform', showReqs && 'rotate-180')} />
        </button>
        {showReqs && (
          <ul className="space-y-2 pb-2 pt-1">
            {report.requirements.map((r) => (
              <li key={r.id} className="text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.title}</span>
                  {r.generated ? <Badge tone="brand">Generated</Badge> : <Badge>{r.responsible}</Badge>}
                </div>
                <p className="text-xs text-slate-500">{r.authority}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-navy-700">
        Rule set {report.corridorId} v{report.rulesetVersion}
      </div>
    </div>
  );
}
