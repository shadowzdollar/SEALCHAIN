/**
 * Interactive landing-page sections that run the real product code in the browser:
 *  - PreflightDemo: the @sealchain/core validator on an editable sample shipment.
 *  - VerifyDrop: hashes a PDF locally and looks the fingerprint up in the public register.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowRight, FileSearch, Info, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { demoShipment, getCorridor, sha256Hex, validateShipment, type Finding } from '@sealchain/core';
import { ApiError, api, type VerificationResult } from '../api';
import { cx } from '../components/ui';
import { useTr } from '../locale';
import { SectionHeading } from './Chrome';

const CORRIDOR_IDS = ['RW-KE', 'RW-UG', 'RW-TZ', 'RW-BI'] as const;
type CorridorId = (typeof CORRIDOR_IDS)[number];

/** Findings that describe the rule set itself rather than the sample; hidden to keep the demo focused. */
const META_CODES = new Set(['RULESET_UNVERIFIED', 'TARIFF_RATE_INDICATIVE']);

const FIELD_INPUT =
  'h-10 w-full rounded-[3px] border bg-paper px-3 font-plexmono text-[13px] text-ink outline-none transition-colors focus:border-ink';

export function PreflightDemo() {
  const { tr } = useTr();
  const [corridorId, setCorridorId] = useState<CorridorId>('RW-KE');
  // Seeded with three mistakes that cost real shipments days at the border.
  const [taxId, setTaxId] = useState('P05123456');
  const [hsCode, setHsCode] = useState('0901');
  const [net, setNet] = useState('9600');
  const [gross, setGross] = useState('9400');

  const corridor = getCorridor(corridorId);
  const report = useMemo(() => {
    const base = demoShipment({ corridorId });
    const road = corridor.entryPoints.road?.[0];
    const s = {
      ...base,
      exitPoint: corridor.exitPoints.road?.[0] ?? base.exitPoint,
      entryPoint: road ?? base.entryPoint,
      consignee: { ...base.consignee, country: corridor.destination, taxId: taxId.trim() },
      items: base.items.map((it, i) => (i === 0 ? { ...it, hsCode: hsCode.replace(/\D/g, ''), netWeightKg: Number(net) || 0, grossWeightKg: Number(gross) || 0 } : it)),
    };
    return validateShipment(s, corridor);
  }, [corridor, corridorId, taxId, hsCode, net, gross]);

  const findings = report.findings.filter((f) => !META_CODES.has(f.code));
  const errors = findings.filter((f) => f.severity === 'error');
  const bad = (path: string) => errors.some((f) => f.path?.endsWith(path));
  const clean = errors.length === 0;

  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-12 2xl:px-16">
        <div className="min-w-0">
          <SectionHeading
            eyebrow={tr('Try it — no account')}
            title={tr('Catch the mistake before the border does.')}
            body={tr('This is the real SealChain rule engine, running in your browser. The sample shipment below has three errors that routinely hold trucks at the border. Fix them and watch the verdict change.')}
          />
          <p className="mt-6 font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {tr('Rule set')} {report.rulesetVersion} · {tr('sample data, fictional companies')}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 overflow-hidden rounded-[3px] border border-paper-rule bg-paper shadow-[0_1px_0_#e2dac8,0_18px_40px_-24px_rgba(11,31,58,0.35)] md:grid-cols-2">
          {/* form */}
          <div className="min-w-0 border-b border-paper-rule p-6 md:border-b-0 md:border-r">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr('Corridor')}>
              {CORRIDOR_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={id === corridorId}
                  onClick={() => setCorridorId(id)}
                  className={cx('rounded-full border px-3 py-1 text-[12px] font-medium transition-colors', id === corridorId ? 'border-ink bg-ink text-ink-contrast' : 'border-paper-rule text-slate-600 hover:border-ink')}
                >
                  {id.replace('-', ' → ')}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-4">
              <Field label={`${tr('Buyer')} ${corridor.taxId.consignee.label}`} hint={`${tr('e.g.')} ${corridor.taxId.consignee.example}`} error={bad('consignee.taxId')}>
                <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={cx(FIELD_INPUT, bad('consignee.taxId') ? 'border-stamp' : 'border-paper-rule')} spellCheck={false} />
              </Field>
              <Field label={tr('HS code — green arabica coffee')} hint={tr('8 digits in the EAC CET')} error={bad('hsCode')}>
                <input value={hsCode} onChange={(e) => setHsCode(e.target.value)} inputMode="numeric" className={cx(FIELD_INPUT, bad('hsCode') ? 'border-stamp' : 'border-paper-rule')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={tr('Net weight (kg)')} error={bad('netWeightKg')}>
                  <input value={net} onChange={(e) => setNet(e.target.value)} inputMode="decimal" className={cx(FIELD_INPUT, bad('netWeightKg') ? 'border-stamp' : 'border-paper-rule')} />
                </Field>
                <Field label={tr('Gross weight (kg)')} error={bad('netWeightKg')}>
                  <input value={gross} onChange={(e) => setGross(e.target.value)} inputMode="decimal" className={cx(FIELD_INPUT, bad('netWeightKg') ? 'border-stamp' : 'border-paper-rule')} />
                </Field>
              </div>
            </div>
          </div>

          {/* verdict */}
          <div className="flex min-w-0 flex-col p-6" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">{tr('Pre-flight check')}</span>
              <span
                key={clean ? 'ok' : 'blocked'}
                className={cx(
                  'stamp-thump -rotate-3 rounded-[3px] border-2 px-2.5 py-0.5 font-plexmono text-[12px] font-medium uppercase tracking-[0.12em] transition-colors',
                  clean ? 'border-emerald-700 text-emerald-700' : 'border-stamp text-stamp',
                )}
              >
                {clean ? tr('Ready to issue') : tr('Blocked')}
              </span>
            </div>
            <ul className="mt-5 flex-1 space-y-3">
              {findings.length === 0 && <li className="text-[14px] text-slate-600">{tr('No findings.')}</li>}
              {findings.map((f) => <FindingRow key={f.code + (f.path ?? '')} f={f} />)}
            </ul>
            {clean ? (
              <Link to="/register" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[3px] bg-ink px-5 text-[14px] font-medium text-ink-contrast hover:opacity-90">
                {tr('Issue real documents like this')} <ArrowRight className="size-4" />
              </Link>
            ) : (
              <p className="mt-6 text-[13px] text-slate-500">
                {errors.length === 1 ? tr('1 error left to fix.') : tr('{n} errors left to fix.').replace('{n}', String(errors.length))}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: boolean; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={cx('mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px] font-medium', error ? 'text-stamp' : 'text-slate-700')}>
        <span className="truncate">{label}</span>
        {hint && <span className="shrink-0 font-normal text-slate-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const Icon = f.severity === 'error' ? XCircle : f.severity === 'warning' ? AlertTriangle : Info;
  return (
    <li className="flex gap-2.5 text-[13.5px] leading-snug">
      <Icon className={cx('mt-0.5 size-4 shrink-0', f.severity === 'error' ? 'text-stamp' : f.severity === 'warning' ? 'text-amber-700' : 'text-slate-400')} />
      <span className={f.severity === 'info' ? 'text-slate-500' : 'text-ink'}>{f.message}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ verify */

async function hashFile(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Hex(buf);
}

type DropState =
  | { kind: 'idle' }
  | { kind: 'busy'; name: string }
  | { kind: 'found'; name: string; sha: string; result: VerificationResult }
  | { kind: 'unknown'; name: string; sha: string }
  | { kind: 'error'; message: string };

export function VerifyDrop() {
  const { tr } = useTr();
  const [state, setState] = useState<DropState>({ kind: 'idle' });
  const [over, setOver] = useState(false);

  async function check(file: File) {
    setState({ kind: 'busy', name: file.name });
    try {
      const sha = await hashFile(file);
      try {
        const result = await api.get<VerificationResult>(`/verify/hash/${sha}`);
        setState({ kind: 'found', name: file.name, sha, result });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) setState({ kind: 'unknown', name: file.name, sha });
        else throw e;
      }
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : tr('Verification failed') });
    }
  }

  return (
    <div className="min-w-0">
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) void check(f); }}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[3px] border-2 border-dashed px-6 py-10 text-center transition-colors',
          over ? 'border-ink bg-paper-tint' : 'border-paper-rule bg-paper hover:border-navy-300',
        )}
      >
        <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f); e.target.value = ''; }} />
        {state.kind === 'busy' ? <Loader2 className="size-7 animate-spin text-ink" /> : <FileSearch className="size-7 stroke-[1.5] text-ink" />}
        <span className="font-serif text-[20px] font-medium">{tr('Drop a trade document to check it')}</span>
        <span className="max-w-sm text-[13px] text-slate-500">{tr('The file is fingerprinted in your browser. Only its SHA-256 hash is sent — the document itself never leaves your device.')}</span>
      </label>

      <div className="mt-4 min-h-[88px]" aria-live="polite">
        {state.kind === 'found' && <FoundResult state={state} />}
        {state.kind === 'unknown' && (
          <Result tone="warn" icon={<ShieldAlert />} title={tr('Not in the SealChain register')}>
            {tr('This exact file was never issued through SealChain. If it claims to be, it may have been altered after issue.')}
            <Fingerprint sha={state.sha} />
          </Result>
        )}
        {state.kind === 'error' && <Result tone="warn" icon={<ShieldAlert />} title={tr('Could not check right now')}>{state.message}</Result>}
      </div>
    </div>
  );
}

function FoundResult({ state }: { state: Extract<DropState, { kind: 'found' }> }) {
  const { tr } = useTr();
  const { verdict, document: d } = state.result;
  const ok = verdict === 'authentic' || verdict === 'authentic_pending_anchor';
  return (
    <Result
      tone={ok ? 'ok' : 'bad'}
      icon={ok ? <ShieldCheck /> : <ShieldAlert />}
      title={ok ? tr('Authentic — issued by {issuer}').replace('{issuer}', d.issuer) : tr('Warning — this document is {verdict}').replace('{verdict}', verdict.replace(/_/g, ' '))}
    >
      {d.kindLabel} · {d.number}
      <Fingerprint sha={state.sha} />
      <Link to="/verify" className="mt-2 inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline">{tr('Open the full verification report')} <ArrowRight className="size-3.5" /></Link>
    </Result>
  );
}

function Fingerprint({ sha }: { sha: string }) {
  return <span className="mt-1.5 block truncate font-plexmono text-[11px] text-slate-400">sha256 {sha}</span>;
}

function Result({ tone, icon, title, children }: { tone: 'ok' | 'warn' | 'bad'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={cx('flex gap-3 rounded-[3px] border p-4 text-[13.5px]', tone === 'ok' ? 'border-emerald-700/40' : 'border-stamp/40')}>
      <span className={cx('mt-0.5 [&>svg]:size-5', tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-stamp')}>{icon}</span>
      <div className="min-w-0 text-slate-600">
        <p className="font-medium text-ink">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

