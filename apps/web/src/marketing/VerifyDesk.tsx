/**
 * Visual pieces of the public verification page — "the inspection desk":
 * three ways in (camera QR scan, file drop, document number), an inspection
 * animation that mirrors the real checks, and a stamped verdict.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Camera, CameraOff, Check, FileSearch, FileText, Hash as HashIcon, KeyRound, Loader2, ScanLine, Search, ShieldCheck, X } from 'lucide-react';
import { ApiError, api } from '../api';
import { cx } from '../components/ui';
import { date } from '../format';
import { msg, useTr } from '../locale';
import { QrGlyph } from './Illustrations';

// ------------------------------------------------------------ methods
type Method = 'camera' | 'file' | 'number';

export function MethodPicker({ onFile }: { onFile: (f: File) => void }) {
  const { tr } = useTr();
  const hasCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const [m, setM] = useState<Method>('file');
  const tabs: Array<{ id: Method; icon: typeof Camera; t: string; d: string }> = [
    { id: 'camera', icon: Camera, t: tr('Scan the QR code'), d: tr('Use this device’s camera') },
    { id: 'file', icon: FileSearch, t: tr('Drop the PDF'), d: tr('Proves your copy is identical') },
    { id: 'number', icon: HashIcon, t: tr('Type the number'), d: tr('Confirms it was issued') },
  ];
  return (
    <div>
      <div role="tablist" className="grid grid-cols-3 gap-2 sm:gap-3">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={m === x.id}
            onClick={() => setM(x.id)}
            className={cx('group flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all sm:flex-row sm:gap-3 sm:p-4 sm:text-left', m === x.id ? 'border-white/40 bg-white/[0.12] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]')}
          >
            <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors', m === x.id ? 'bg-[#f4c542] text-[#0b1f3a]' : 'bg-white/10 text-white')}><x.icon className="size-5" /></span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-white sm:text-[14.5px]">{x.t}</span>
              <span className="hidden text-[12px] text-white/55 sm:block">{x.d}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        {m === 'file' && <ScannerBed onFile={onFile} />}
        {m === 'camera' && (hasCamera ? <CameraScanner /> : <NoCamera />)}
        {m === 'number' && <NumberLookup />}
      </div>
    </div>
  );
}

/** Drop zone styled as a lit scanner bed. */
function ScannerBed({ onFile }: { onFile: (f: File) => void }) {
  const { tr } = useTr();
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={cx('scanner-bed relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all', over ? 'border-[#f4c542] bg-[#f4c542]/10 scale-[1.01]' : 'border-white/25 bg-white/[0.04] hover:border-white/45')}
    >
      <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <span aria-hidden className="scanner-light pointer-events-none absolute inset-x-0 h-16" />
      <span className={cx('relative flex size-20 items-center justify-center rounded-2xl bg-white text-[#0b1f3a] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] transition-transform', over ? '-translate-y-1 rotate-[-4deg]' : 'float-a')}>
        <FileText className="size-10" strokeWidth={1.5} />
      </span>
      <p className="relative mt-6 font-serif text-[24px] font-semibold text-white">{over ? tr('Let go to inspect it') : tr('Drop the PDF on the scanner')}</p>
      <p className="relative mt-1.5 text-[14px] text-white/60">{tr('or tap to choose a file')}</p>
      <p className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white/70"><KeyRound className="size-3.5" /> {tr('The file never leaves your device')}</p>
    </label>
  );
}

// ------------------------------------------------------------ camera
interface Detector { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> }
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector } }

function NoCamera() {
  const { tr } = useTr();
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-white/15 bg-white/[0.04] p-8 text-center">
      <CameraOff className="size-10 text-white/60" />
      <p className="mt-4 font-serif text-[20px] font-semibold text-white">{tr('Use your phone’s camera app')}</p>
      <p className="mt-2 max-w-md text-[14px] text-white/65">{tr('Point it at the QR code printed on the document. It opens this page with the result — no app needed.')}</p>
    </div>
  );
}

function CameraScanner() {
  const { tr } = useTr();
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'denied' | 'unsupported' | 'foreign'>('idle');
  const [foreign, setForeign] = useState('');

  useEffect(() => {
    if (state !== 'starting') return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setState('live');
        if (!window.BarcodeDetector) { setState('unsupported'); return; }
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stopped) return;
          try {
            const [hit] = await det.detect(v);
            if (hit?.rawValue) {
              const url = new URL(hit.rawValue, window.location.origin);
              const m = url.pathname.match(/\/v\/(doc_[a-z0-9]+)/);
              if (m) { navigator.vibrate?.(60); void navigate(`/v/${m[1]}`); return; }
              setForeign(hit.rawValue);
              setState('foreign');
              return;
            }
          } catch { /* frame not ready */ }
          timer = window.setTimeout(() => void tick(), 220);
        };
        void tick();
      } catch {
        setState('denied');
      }
    })();
    return () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [state === 'starting', navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'idle' || state === 'denied') {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-white/15 bg-white/[0.04] p-8 text-center">
        <span className="relative flex size-20 items-center justify-center rounded-2xl bg-white p-2"><QrGlyph className="size-full" /><span className="scan-sweep absolute inset-x-1 h-[2px] bg-stamp shadow-[0_0_10px_2px_rgba(180,35,24,0.55)]" /></span>
        <p className="mt-5 font-serif text-[20px] font-semibold text-white">{state === 'denied' ? tr('Camera access was blocked') : tr('Point the camera at the QR code')}</p>
        <p className="mt-1.5 max-w-sm text-[14px] text-white/60">{state === 'denied' ? tr('Allow camera access in your browser settings, or use your phone’s camera app instead.') : tr('We read the code on this device and open the result straight away.')}</p>
        <button type="button" onClick={() => setState('starting')} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#f4c542] px-6 text-[14px] font-semibold text-[#0b1f3a]"><Camera className="size-4" /> {tr('Start the camera')}</button>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-black">
      <video ref={video} className="aspect-[4/3] w-full object-cover sm:aspect-video" muted playsInline />
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="qr-frame relative size-[58%] max-h-[260px] max-w-[260px]">
          <span className="scan-sweep absolute inset-x-2 h-[2px] bg-[#f4c542] shadow-[0_0_14px_3px_rgba(244,197,66,0.6)]" />
        </div>
      </div>
      <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center text-[13px] text-white">
        {state === 'starting' && <><Loader2 className="mr-1.5 inline size-4 animate-spin" />{tr('Starting the camera…')}</>}
        {state === 'live' && tr('Hold the QR code inside the frame')}
        {state === 'unsupported' && tr('This browser can’t read QR codes — use your phone’s camera app instead.')}
        {state === 'foreign' && <>{tr('That QR code is not a SealChain link:')} <span className="font-plexmono text-[11px] opacity-80">{foreign.slice(0, 60)}</span> · <button type="button" className="underline" onClick={() => setState('starting')}>{tr('Try again')}</button></>}
      </p>
    </div>
  );
}

// ------------------------------------------------------------ number
interface NumberResult { number: string; kind: string; kindLabel: string; version: number; status: 'active' | 'superseded' | 'revoked'; issuedAt: string }

function NumberLookup() {
  const { tr } = useTr();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; r: NumberResult } | { kind: 'missing' } | { kind: 'error'; m: string }>({ kind: 'idle' });
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setRes({ kind: 'loading' });
    try {
      setRes({ kind: 'found', r: await api.get<NumberResult>(`/verify/number/${encodeURIComponent(q.trim())}`) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setRes({ kind: 'missing' });
      else setRes({ kind: 'error', m: err instanceof Error ? err.message : tr('Something went wrong') });
    }
  }
  const STATUS: Record<string, { t: string; c: string }> = {
    active: { t: tr('Valid'), c: 'bg-emerald-500 text-white' },
    superseded: { t: tr('Replaced by a newer version'), c: 'bg-amber-400 text-[#0b1f3a]' },
    revoked: { t: tr('Revoked'), c: 'bg-red-500 text-white' },
  };
  return (
    <div className="flex min-h-[280px] flex-col justify-center rounded-3xl border border-white/15 bg-white/[0.04] p-6 sm:p-8">
      <form onSubmit={go} className="flex flex-col gap-3 sm:flex-row">
        <label className="flex h-14 flex-1 items-center gap-3 rounded-2xl border border-white/20 bg-black/30 px-4 focus-within:border-[#f4c542]">
          <HashIcon className="size-5 text-white/50" />
          <input value={q} onChange={(e) => setQ(e.target.value.toUpperCase())} placeholder="SC-RWKE-CO-2026-00012" spellCheck={false} aria-label={tr('Document number')} className="min-w-0 flex-1 bg-transparent font-plexmono text-[16px] tracking-[0.06em] text-white outline-none placeholder:text-white/30" />
        </label>
        <button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#f4c542] px-6 text-[15px] font-semibold text-[#0b1f3a]">
          {res.kind === 'loading' ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />} {tr('Look it up')}
        </button>
      </form>
      <p className="mt-3 text-[12.5px] text-white/50">{tr('The number is printed at the top of every SealChain document.')}</p>
      <div className="mt-5" aria-live="polite">
        {res.kind === 'found' && (
          <div className="pop-in rounded-2xl bg-white p-5 text-[#0b1f3a]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-emerald-600" /> {tr('Issued through SealChain')}</p>
              <span className={cx('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', STATUS[res.r.status]?.c)}>{STATUS[res.r.status]?.t}</span>
            </div>
            <p className="mt-3 font-plexmono text-[14px]">{res.r.number} · v{res.r.version}</p>
            <p className="text-[14px] text-slate-600">{tr(res.r.kindLabel)} · {tr('issued')} {date(res.r.issuedAt)}</p>
            <p className="mt-3 rounded-xl bg-[#f4c542]/20 px-3 py-2 text-[13px] leading-snug">{tr('This confirms the number exists. To see what it covers and prove your copy is genuine, scan its QR code or drop the PDF.')}</p>
          </div>
        )}
        {res.kind === 'missing' && (
          <div className="pop-in flex items-start gap-3 rounded-2xl bg-red-500/15 p-5 text-white">
            <X className="mt-0.5 size-5 shrink-0 text-red-300" />
            <div><p className="font-semibold">{tr('No document with this number was ever issued by SealChain.')}</p><p className="mt-1 text-[13px] text-white/70">{tr('Check for typing mistakes. If the number is right, treat the document with caution.')}</p></div>
          </div>
        )}
        {res.kind === 'error' && <p className="text-[13px] text-red-300">{res.m}</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ inspecting
const STEPS = [msg('Reading the document’s fingerprint'), msg('Checking SealChain’s seal'), msg('Asking the public ledger')];

export function Inspecting({ label }: { label: string }) {
  const { tr } = useTr();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 520);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="grid items-center gap-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:p-10" aria-live="polite">
      <div className="relative mx-auto h-[250px] w-[190px]">
        <div className="inspect-doc absolute inset-0 rounded-md bg-white p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
          <div className="h-2 w-2/3 rounded bg-slate-300" />
          <div className="mt-2 h-2 w-1/2 rounded bg-slate-200" />
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="mt-3 h-1.5 rounded bg-slate-200" style={{ width: `${90 - i * 9}%` }} />)}
          <div className="absolute bottom-4 right-4 size-12"><QrGlyph className="size-full" /></div>
        </div>
        <span aria-hidden className="inspect-beam absolute -inset-x-4 h-1 rounded-full bg-[#f4c542] shadow-[0_0_24px_6px_rgba(244,197,66,0.55)]" />
      </div>
      <div>
        <p className="font-plexmono text-[11px] uppercase tracking-[0.2em] text-[#f4c542]">{tr('Inspecting')}</p>
        <p className="mt-2 font-serif text-[24px] font-semibold text-white">{label}</p>
        <ul className="mt-6 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s} className={cx('flex items-center gap-3 text-[15px] transition-colors', i <= step ? 'text-white' : 'text-white/35')}>
              <span className={cx('flex size-6 items-center justify-center rounded-full transition-colors', i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[#f4c542] text-[#0b1f3a]' : 'bg-white/10')}>
                {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i === step ? <Loader2 className="size-3.5 animate-spin" /> : null}
              </span>
              {tr(s)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ verdict
export type Tone = 'good' | 'info' | 'warn' | 'bad';
const STAMP: Record<string, { word: string; tone: Tone }> = {
  authentic: { word: msg('Authentic'), tone: 'good' },
  authentic_pending_anchor: { word: msg('Genuine'), tone: 'info' },
  superseded: { word: msg('Replaced'), tone: 'warn' },
  revoked: { word: msg('Revoked'), tone: 'bad' },
  tampered: { word: msg('Altered'), tone: 'bad' },
  anchor_missing: { word: msg('Unconfirmed'), tone: 'bad' },
  not_found: { word: msg('Not issued'), tone: 'bad' },
};
const TONE: Record<Tone, { ink: string; glow: string; band: string }> = {
  good: { ink: 'border-emerald-600 text-emerald-600', glow: 'rgba(5,150,105,0.35)', band: 'from-emerald-500/25' },
  info: { ink: 'border-sky-600 text-sky-600', glow: 'rgba(2,132,199,0.35)', band: 'from-sky-500/25' },
  warn: { ink: 'border-amber-500 text-amber-600', glow: 'rgba(245,158,11,0.35)', band: 'from-amber-500/25' },
  bad: { ink: 'border-red-600 text-red-600', glow: 'rgba(220,38,38,0.4)', band: 'from-red-500/25' },
};

export function verdictTone(verdict: string): Tone { return STAMP[verdict]?.tone ?? 'info'; }

/** Paper replica of the document with the verdict stamped across it. */
export function StampedDocument({ verdict, kindLabel, number, from, to, goods, issued }: { verdict: string; kindLabel: string; number: string; from: string; to: string; goods: string; issued: string }) {
  const { tr } = useTr();
  const s = STAMP[verdict] ?? STAMP.authentic_pending_anchor!;
  const tone = TONE[s.tone];
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div aria-hidden className="absolute inset-0 -z-10 rounded-full blur-3xl" style={{ background: tone.glow }} />
      <div className="doc-in relative rotate-[-2deg] rounded-md bg-[#fffdf8] p-6 text-[#0b1f3a] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#e2dac8] pb-3">
          <div><p className="font-plexmono text-[9px] uppercase tracking-[0.18em] text-slate-500">{tr(kindLabel)}</p><p className="mt-1 font-plexmono text-[11px]">{number}</p></div>
          <QrGlyph className="size-12 shrink-0" />
        </div>
        <dl className="mt-3 space-y-2 text-[12px]">
          <div><dt className="text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{tr('From')}</dt><dd className="font-medium">{from}</dd></div>
          <div><dt className="text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{tr('To')}</dt><dd className="font-medium">{to}</dd></div>
          <div><dt className="text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{tr('Goods')}</dt><dd className="truncate font-medium">{goods}</dd></div>
          <div><dt className="text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{tr('Issued')}</dt><dd className="font-medium">{issued}</dd></div>
        </dl>
        {[0, 1, 2].map((i) => <div key={i} className="mt-2.5 h-1.5 rounded bg-slate-100" style={{ width: `${88 - i * 18}%` }} />)}
        <div className={cx('verdict-stamp absolute left-1/2 top-[46%] rounded-lg border-[5px] bg-[#fffdf8]/70 px-4 py-1.5 text-center font-plexmono text-[30px] font-bold uppercase tracking-[0.14em] mix-blend-multiply', tone.ink)}>
          {tr(s.word)}
          <span className="block text-[9px] font-semibold tracking-[0.3em] opacity-80">SealChain · {new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </div>
    </div>
  );
}

/** Four rings that light up in turn for each independent check. */
export function SealRings({ checks }: { checks: Array<{ label: string; ok: boolean | null; icon: ReactNode }> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {checks.map((c, i) => (
        <li key={c.label} className="ring-in flex flex-col items-center gap-2 text-center" style={{ ['--delay' as never]: `${0.5 + i * 0.25}s` }}>
          <span className={cx('relative flex size-16 items-center justify-center rounded-full border-[3px] [&>svg]:size-6', c.ok === null ? 'border-white/20 text-white/50' : c.ok ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-red-400 bg-red-400/15 text-red-300')}>
            {c.icon}
            <span className={cx('absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full text-white', c.ok === null ? 'bg-slate-500' : c.ok ? 'bg-emerald-500' : 'bg-red-500')}>
              {c.ok === null ? <span className="text-[11px] font-bold">?</span> : c.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
            </span>
          </span>
          <span className="text-[12.5px] font-medium leading-tight text-white/85">{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

export const VERIFY_ICONS = { file: <FileText />, seal: <ShieldCheck />, proof: <ScanLine />, ledger: <KeyRound /> };
