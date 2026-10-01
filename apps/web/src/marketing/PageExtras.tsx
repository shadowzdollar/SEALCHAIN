/**
 * Creative sections for the inner marketing pages.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, Copy, FileText, Package, Receipt, RotateCcw, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { sha256Hex } from '@sealchain/core';
import { cx } from '../components/ui';
import { msg, useTr } from '../locale';
import { SectionHeading } from './Chrome';
import { QrGlyph } from './Illustrations';
import { PHOTOS, type Photo } from './photos';

const PAGE = 'mx-auto max-w-[1680px] px-5 sm:px-8 lg:px-12 2xl:px-16';

// ------------------------------------------------------------ tamper lab (security)
const ORIGINAL = 'CERTIFICATE OF ORIGIN\nExporter: Huye Highlands Coffee\nConsignee: Mombasa Roasters Co.\nGoods: Green coffee, 9,600 kg\nValue: USD 61,440\nOrigin: Rwanda (wholly obtained)';
const fingerprint = (text: string) => sha256Hex(new TextEncoder().encode(text));

function FingerprintArt({ hex, compare }: { hex: string; compare?: string }) {
  const cells = hex.match(/../g) ?? [];
  return (
    <div className="grid grid-cols-8 gap-1">
      {cells.map((b, i) => {
        const v = parseInt(b, 16);
        const changed = compare && compare.slice(i * 2, i * 2 + 2) !== b;
        return <span key={i} className={cx('aspect-square rounded-[3px] transition-all duration-500', changed && 'scale-90')} style={{ background: `hsl(${(v * 1.4 + 200) % 360} ${45 + (v % 30)}% ${38 + (v % 22)}%)`, opacity: compare && !changed ? 0.35 : 1 }} />;
      })}
    </div>
  );
}

export function TamperLab() {
  const { tr } = useTr();
  const [text, setText] = useState(ORIGINAL);
  const orig = useMemo(() => fingerprint(ORIGINAL), []);
  const cur = useMemo(() => fingerprint(text), [text]);
  const same = cur === orig;
  const diff = (cur.match(/../g) ?? []).filter((b, i) => orig.slice(i * 2, i * 2 + 2) !== b).length;
  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className={cx(PAGE, 'grid grid-cols-1 items-start gap-12 py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]')}>
        <div className="min-w-0">
          <SectionHeading eyebrow={tr('Tamper lab')} title={tr('Go on — try to forge it.')} body={tr('Change anything in the certificate: a number, a name, even a single space. Watch what happens to its fingerprint — the thing SealChain records when a document is issued.')} />
          <div className={cx('mt-8 flex items-center gap-3 rounded-2xl p-4 transition-colors', same ? 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300' : 'bg-stamp/10 text-stamp')} aria-live="polite">
            {same ? <ShieldCheck className="size-6 shrink-0" /> : <ShieldAlert className="size-6 shrink-0" />}
            <div>
              <p className="font-semibold">{same ? tr('Seal intact — this is the original') : tr('Seal broken — this is not the document that was issued')}</p>
              <p className="text-[13px] opacity-80">{same ? tr('The fingerprint matches the one recorded at issue.') : tr('{n} of 32 fingerprint blocks changed from one small edit.').replace('{n}', String(diff))}</p>
            </div>
          </div>
          {!same && <button type="button" onClick={() => setText(ORIGINAL)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-paper-rule bg-paper px-4 py-2 text-[13.5px] font-medium text-ink hover:border-ink/40"><RotateCcw className="size-4" /> {tr('Restore the original')}</button>}
        </div>
        <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <label className="block min-w-0">
            <span className="mb-2 block font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{tr('The document — edit me')}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={8} className={cx('w-full resize-none rounded-2xl border-2 bg-[#fffdf8] p-4 font-plexmono text-[13px] leading-relaxed text-[#0b1f3a] shadow-[0_20px_40px_-28px_rgba(11,31,58,0.6)] outline-none transition-colors', same ? 'border-emerald-600/40' : 'border-stamp/60')} />
          </label>
          <div className="min-w-0">
            <p className="mb-2 font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{tr('Its fingerprint')}</p>
            <div className="rounded-2xl border border-paper-rule bg-paper p-3"><FingerprintArt hex={cur} compare={same ? undefined : orig} /></div>
            <p className="mt-2 break-all font-plexmono text-[10px] leading-snug text-slate-500">{cur}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ delay calculator (pricing)
function Slider({ label, value, set, min, max, step = 1, suffix = '', prefix = '' }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step?: number; suffix?: string; prefix?: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-[14px] text-slate-600"><span>{label}</span><span className="font-serif text-[22px] font-semibold tabular-nums text-ink">{prefix}{value}{suffix}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-ink)]" />
    </label>
  );
}

export function DelayCalculator({ monthly, perShipment }: { monthly: number; perShipment: number }) {
  const { tr } = useTr();
  const [ships, setShips] = useState(12);
  const [held, setHeld] = useState(20);
  const [hours, setHours] = useState(18);
  const [rate, setRate] = useState(25);
  const delay = Math.round(ships * (held / 100) * hours * rate);
  const fee = monthly + ships * perShipment;
  const max = Math.max(delay, fee, 1);
  return (
    <section className={cx(PAGE, 'py-24')}>
      <div className="grid grid-cols-1 items-center gap-12 rounded-[32px] border border-paper-rule bg-paper-card p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow={tr('Your numbers')} title={tr('What does waiting at the border cost you?')} body={tr('Move the sliders to match your business. Parking, demurrage, idle drivers and late deliveries add up faster than most people think.')} />
          <div className="mt-8 space-y-5">
            <Slider label={tr('Shipments per month')} value={ships} set={setShips} min={1} max={80} />
            <Slider label={tr('Shipments held for paperwork')} value={held} set={setHeld} min={0} max={60} suffix="%" />
            <Slider label={tr('Hours lost each time')} value={hours} set={setHours} min={2} max={72} suffix=" h" />
            <Slider label={tr('Cost per truck-hour (USD)')} value={rate} set={setRate} min={5} max={100} step={5} prefix="$" />
          </div>
        </div>
        <div className="rounded-3xl bg-ink p-6 text-ink-contrast sm:p-8">
          <p className="font-plexmono text-[11px] uppercase tracking-[0.18em] opacity-60">{tr('Every month')}</p>
          {[
            { k: tr('Paperwork delays'), v: delay, c: 'bg-[#f87171]' },
            { k: tr('SealChain'), v: fee, c: 'bg-emerald-400' },
          ].map((r) => (
            <div key={r.k} className="mt-6">
              <div className="flex items-baseline justify-between"><span className="text-[15px] opacity-80">{r.k}</span><span className="font-serif text-[30px] font-semibold tabular-nums">${r.v.toLocaleString('en-US')}</span></div>
              <div className="mt-2 h-4 overflow-hidden rounded-full bg-white/10"><div className={cx('h-full rounded-full transition-all duration-700 ease-out', r.c)} style={{ width: `${Math.max(3, (r.v / max) * 100)}%` }} /></div>
            </div>
          ))}
          <p className="mt-8 border-t border-white/15 pt-5 text-[15px]">
            {delay > fee
              ? tr('Avoiding even a share of those delays pays for SealChain {x}×.').replace('{x}', (delay / fee).toFixed(1))
              : tr('Even when delays are rare, verified documents protect your buyers and your name.')}
          </p>
          <p className="mt-3 text-[11.5px] opacity-50">{tr('An estimate from the numbers you entered — not a guarantee of savings.')}</p>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ three documents (product)
const TRIO: Array<{ icon: typeof FileText; title: string; body: string; tilt: number; tone: string }> = [
  { icon: Receipt, title: msg('Commercial invoice'), body: msg('What was sold, for how much, on which terms.'), tilt: -8, tone: 'border-t-[#1d4ed8]' },
  { icon: FileText, title: msg('Certificate of origin'), body: msg('Where the goods come from — so your buyer pays less duty.'), tilt: 0, tone: 'border-t-stamp' },
  { icon: Package, title: msg('Packing list'), body: msg('Every package, weight and mark on the truck.'), tilt: 8, tone: 'border-t-emerald-600' },
];

export function DocumentTrio() {
  const { tr } = useTr();
  const [hover, setHover] = useState<number | null>(null);
  return (
    <section className="overflow-hidden border-b border-paper-rule">
      <div className={cx(PAGE, 'py-24')}>
        <SectionHeading center eyebrow={tr('What you get')} title={tr('One form. Three documents. All in agreement.')} body={tr('Fill in your shipment once. SealChain writes all three — so the numbers on the invoice, certificate and packing list can never disagree.')} />
        <div className="relative mx-auto mt-16 flex h-[360px] max-w-[900px] items-end justify-center" onMouseLeave={() => setHover(null)}>
          {TRIO.map((d, i) => {
            const off = (i - 1) * 210;
            const lifted = hover === i;
            return (
              <article
                key={d.title}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                className={cx('absolute bottom-0 w-[240px] cursor-default rounded-md border-t-[6px] bg-[#fffdf8] p-5 text-[#0b1f3a] shadow-[0_30px_60px_-30px_rgba(11,31,58,0.6)] outline-none transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:w-[260px]', d.tone)}
                style={{ transform: `translateX(${off}px) translateY(${lifted ? -40 : 0}px) rotate(${lifted ? 0 : d.tilt}deg) scale(${lifted ? 1.06 : 1})`, zIndex: lifted ? 10 : i === 1 ? 2 : 1 }}
              >
                <div className="flex items-center justify-between"><d.icon className="size-6" strokeWidth={1.6} /><QrGlyph className="size-10" /></div>
                <p className="mt-4 font-serif text-[20px] font-semibold">{tr(d.title)}</p>
                <p className="mt-1.5 text-[13.5px] leading-snug text-slate-600">{tr(d.body)}</p>
                {[0, 1, 2, 3, 4].map((k) => <div key={k} className="mt-2.5 h-1.5 rounded bg-slate-100" style={{ width: `${92 - k * 12}%` }} />)}
                <span className="mt-4 inline-flex items-center gap-1 rounded-sm border-2 border-emerald-600 px-1.5 py-0.5 font-plexmono text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700"><Check className="size-3" strokeWidth={3} /> {tr('Sealed')}</span>
              </article>
            );
          })}
        </div>
        <p className="mt-8 text-center text-[13px] text-slate-500">{tr('Hover a document to pick it up.')}</p>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ API console (developers)
const CALLS = [
  { id: 'create', label: 'POST /shipments', req: `curl -X POST $API/shipments \\\n  -H "Authorization: Bearer $KEY" \\\n  -d @shipment.json`, res: `{\n  "id": "shp_8f2k…",\n  "validation": {\n    "status": "ready",\n    "counts": { "error": 0, "warning": 1 }\n  }\n}` },
  { id: 'issue', label: 'POST /shipments/:id/issue', req: `curl -X POST $API/shipments/shp_8f2k…/issue \\\n  -H "Authorization: Bearer $KEY" \\\n  -d '{"acknowledgeWarnings": true}'`, res: `{\n  "documents": [\n    { "kind": "commercial_invoice", "number": "SC-RWKE-CI-2026-00012" },\n    { "kind": "certificate_of_origin", "number": "SC-RWKE-CO-2026-00012" },\n    { "kind": "packing_list", "number": "SC-RWKE-PL-2026-00012" }\n  ]\n}` },
  { id: 'verify', label: 'GET /verify/hash/:sha256', req: `curl $API/verify/hash/9f2c…a41e`, res: `{\n  "verdict": "authentic",\n  "signature": { "valid": true },\n  "anchor": { "status": "confirmed" }\n}` },
  { id: 'hook', label: 'Webhook: document.verified', req: `POST https://your-system.example/hooks\nX-SealChain-Signature: t=…,v1=…`, res: `{\n  "type": "document.verified",\n  "data": { "number": "SC-RWKE-CO-2026-00012" }\n}` },
];

export function ApiConsole() {
  const { tr } = useTr();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState('');
  const [copied, setCopied] = useState(false);
  const c = CALLS[i]!;
  useEffect(() => {
    setShown('');
    let k = 0;
    const t = window.setInterval(() => { k += 3; setShown(c.res.slice(0, k)); if (k >= c.res.length) window.clearInterval(t); }, 16);
    return () => window.clearInterval(t);
  }, [c.res]);
  return (
    <section className={cx(PAGE, 'py-24')}>
      <SectionHeading eyebrow={tr('API console')} title={tr('Four calls cover the whole journey.')} body={tr('Create a shipment, issue its documents, verify any file and get told when someone checks yours.')} />
      <div className="mt-10 overflow-hidden rounded-3xl border border-[#1f2a3d] bg-[#0b0f18] text-white shadow-[0_40px_80px_-40px_rgba(11,31,58,0.8)]">
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 p-2">
          {CALLS.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} className={cx('shrink-0 rounded-lg px-3 py-1.5 font-plexmono text-[12px] transition-colors', i === k ? 'bg-white/10 text-[#f4c542]' : 'text-white/60 hover:text-white')}>{x.label}</button>
          ))}
        </div>
        <div className="grid lg:grid-cols-2">
          <div className="relative border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <p className="font-plexmono text-[10px] uppercase tracking-[0.2em] text-white/40">{tr('Request')}</p>
            <pre className="mt-3 overflow-x-auto font-plexmono text-[12.5px] leading-relaxed text-emerald-300">{c.req}</pre>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(c.req).catch(() => undefined); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:text-white">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? tr('Copied') : tr('Copy')}
            </button>
          </div>
          <div className="p-5">
            <p className="font-plexmono text-[10px] uppercase tracking-[0.2em] text-white/40">{tr('Response')} · <span className="text-emerald-400">200 OK</span></p>
            <pre className="mt-3 min-h-[180px] overflow-x-auto font-plexmono text-[12.5px] leading-relaxed text-[#cbd5e1]">{shown}<span className="caret">▍</span></pre>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ photo mosaic (about)
const MOSAIC: Array<{ photo: Photo; caption: string; span: string }> = [
  { photo: PHOTOS.teaFields, caption: msg('Where the goods begin'), span: 'sm:col-span-2 sm:row-span-2' },
  { photo: PHOTOS.lorryTanzania, caption: msg('The long road'), span: '' },
  { photo: PHOTOS.portTruck, caption: msg('The port'), span: '' },
  { photo: PHOTOS.kigaliSkyline, caption: msg('Home: Kigali'), span: 'sm:col-span-2' },
  { photo: PHOTOS.anaCargo, caption: msg('By air'), span: '' },
  { photo: PHOTOS.shipKoper, caption: msg('To the world'), span: '' },
];

export function PhotoMosaic() {
  const { tr } = useTr();
  return (
    <section className={cx(PAGE, 'py-24')}>
      <SectionHeading eyebrow={tr('The places we build for')} title={tr('From a hillside in Rwanda to a quay on the other side of the world.')} />
      <div className="mt-12 grid auto-rows-[200px] grid-cols-1 gap-3 sm:grid-cols-4 sm:auto-rows-[180px]">
        {MOSAIC.map((m) => (
          <figure key={m.caption} className={cx('group relative overflow-hidden rounded-2xl', m.span)}>
            <img src={m.photo.sm} alt={m.photo.alt} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
              <span className="block font-serif text-[18px] font-semibold">{tr(m.caption)}</span>
              <span className="block translate-y-2 font-plexmono text-[9.5px] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-80">{m.photo.author} · {m.photo.license}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ lost truck (404)
export function LostTruck() {
  const { tr } = useTr();
  return (
    <section className="relative overflow-hidden">
      <div className={cx(PAGE, 'flex min-h-[70vh] flex-col items-center justify-center py-20 text-center')}>
        <p className="font-plexmono text-[12px] uppercase tracking-[0.24em] text-stamp">{tr('Error 404 · page not found')}</p>
        <h1 className="mt-4 max-w-2xl font-serif text-[42px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[58px]">{tr('This truck took a wrong turn at the border.')}</h1>
        <p className="mt-4 max-w-lg text-[17px] text-slate-600">{tr('The page you were looking for isn’t here. Let’s get you back on the road.')}</p>
        <div className="lost-road relative mt-12 h-24 w-full max-w-3xl">
          <div className="absolute inset-x-0 bottom-6 h-[3px] bg-[repeating-linear-gradient(90deg,var(--color-ink)_0_24px,transparent_24px_44px)] opacity-30" />
          <div className="lost-truck absolute bottom-7 left-0 flex items-end">
            <div className="h-12 w-28 rounded-[3px] bg-stamp shadow-[inset_0_0_0_2px_rgba(0,0,0,0.2)] [background-image:repeating-linear-gradient(90deg,rgba(0,0,0,0.15)_0_2px,transparent_2px_7px)]" />
            <div className="ml-1 h-9 w-10 rounded-[3px] rounded-tr-xl bg-ink" />
            <span className="absolute -bottom-2 left-3 size-5 rounded-full border-4 border-ink bg-paper" />
            <span className="absolute -bottom-2 left-20 size-5 rounded-full border-4 border-ink bg-paper" />
            <span className="absolute -bottom-2 left-32 size-5 rounded-full border-4 border-ink bg-paper" />
          </div>
          <span className="absolute bottom-7 right-[18%] font-plexmono text-[11px] text-slate-500">?</span>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-ink-contrast">{tr('Back to the home page')} <ArrowRight className="size-4" /></Link>
          <button type="button" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))} className="inline-flex h-12 items-center gap-2 rounded-full border border-paper-rule bg-paper-card px-6 text-[15px] font-medium text-ink"><Search className="size-4" /> {tr('Search the site')}</button>
          <Link to="/verify" className="inline-flex h-12 items-center gap-2 rounded-full border border-paper-rule bg-paper-card px-6 text-[15px] font-medium text-ink">{tr('Verify a document')}</Link>
        </div>
      </div>
    </section>
  );
}
