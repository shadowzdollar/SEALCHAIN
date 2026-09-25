/**
 * Paper-style illustrations for the public site. Drawn in SVG/HTML so they
 * stay crisp, match the palette and need no external images.
 */
import { AlertTriangle, Check, CheckCircle2, FileText, ShieldCheck, XCircle } from 'lucide-react';
import { cx } from '../components/ui';

const SHEET = 'rounded-[2px] border border-paper-rule bg-paper-card shadow-[0_1px_2px_rgba(11,31,58,0.06),0_12px_32px_-12px_rgba(11,31,58,0.18)]';

export function Stamp({ children = 'Anchored', className }: { children?: string; className?: string }) {
  return (
    <div className={cx('stamp bg-paper/70', className)}>
      {children} <Check className="size-3.5" strokeWidth={2.5} />
    </div>
  );
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[12.5px] text-slate-500">{k}</p>
      <p className={mono ? 'font-plexmono text-[13.5px] text-navy-900' : 'text-[13.5px] text-navy-900'}>{v}</p>
    </div>
  );
}

/** Certificate of origin on top of an invoice, with the red stamp. */
export function DocumentStack({ className }: { className?: string }) {
  return (
    <div className={cx('relative mx-auto w-full max-w-[480px]', className)}>
      <div aria-hidden className="absolute inset-x-6 -top-7 bottom-8 rotate-[2.2deg] rounded-[2px] border border-paper-rule bg-paper-card shadow-[0_1px_2px_rgba(11,31,58,0.06)]">
        <div className="flex justify-between px-5 pt-2 font-plexmono text-[10.5px] text-slate-400">
          <span>INV-2026-0387</span><span>Commercial Invoice</span>
        </div>
      </div>
      <div className={cx('relative p-6', SHEET)}>
        <div className="flex items-center justify-between border-b border-paper-rule pb-3 font-plexmono text-[12px] text-slate-500">
          <span>COO-2026-1041</span>
          <span>EAC Rules of Origin</span>
        </div>
        <h3 className="mt-5 font-serif text-[21px] font-medium text-navy-900">Certificate of Origin</h3>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3.5">
          <Field k="Exporter" v="Huye Highlands Coffee" />
          <Field k="Consignee" v="Mombasa Roasters Co." />
          <Field k="HS code" v="0901.11.00" mono />
          <Field k="Criterion" v="WO — wholly obtained" />
        </div>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1 rounded-[2px] bg-paper-tint px-3 py-2.5 font-plexmono text-[11.5px] leading-relaxed text-slate-600">
            <p>sha256 · 9f2c…a41e</p>
            <p>merkle root · anchored on-chain</p>
          </div>
          <QrGlyph className="size-16 shrink-0" />
        </div>
      </div>
      <Stamp className="absolute -bottom-12 right-2 rotate-[-7deg] sm:-right-4" />
    </div>
  );
}

/** A deterministic, decorative QR-like glyph (not a scannable code). */
export function QrGlyph({ className }: { className?: string }) {
  const n = 21;
  const cells: Array<[number, number]> = [];
  let seed = 7;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (finder) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 5 < 2) cells.push([x, y]);
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#0b1f3a" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fffdf8" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0b1f3a" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" className={className} aria-hidden shapeRendering="crispEdges">
      <rect x="-1" y="-1" width="23" height="23" fill="#fffdf8" />
      {cells.map(([x, y]) => <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill="#0b1f3a" />)}
      {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
    </svg>
  );
}

/** Schematic route map of the EAC corridors served from Kigali. */
export function CorridorMap({ className, highlight }: { className?: string; highlight?: string }) {
  const cities = {
    kigali: { x: 150, y: 250, label: 'Kigali', anchor: 'end' as const },
    kampala: { x: 262, y: 118, label: 'Kampala', anchor: 'start' as const },
    nairobi: { x: 470, y: 180, label: 'Nairobi', anchor: 'start' as const },
    mombasa: { x: 560, y: 300, label: 'Mombasa', anchor: 'start' as const },
    dar: { x: 480, y: 420, label: 'Dar es Salaam', anchor: 'start' as const },
    bujumbura: { x: 120, y: 330, label: 'Bujumbura', anchor: 'end' as const },
  };
  const routes = [
    { id: 'RW-UG', d: 'M150 250 C 180 200, 220 150, 262 118', post: { x: 182, y: 196, label: 'Gatuna · Katuna' } },
    { id: 'RW-KE', d: 'M262 118 C 330 110, 400 140, 470 180 C 510 210, 540 260, 560 300', post: { x: 372, y: 124, label: 'Malaba · Busia' } },
    { id: 'RW-TZ', d: 'M150 250 C 210 300, 260 340, 330 370 C 390 395, 440 410, 480 420', post: { x: 232, y: 318, label: 'Rusumo' } },
    { id: 'RW-BI', d: 'M150 250 C 140 280, 130 305, 120 330', post: { x: 92, y: 292, label: 'Akanyaru · Nemba' } },
  ];
  return (
    <svg viewBox="0 0 640 480" className={cx('w-full', className)} role="img" aria-label="Map of SealChain corridors from Kigali to Kampala, Nairobi, Mombasa, Dar es Salaam and Bujumbura">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#0b1f3a" strokeOpacity="0.05" />
        </pattern>
      </defs>
      <rect width="640" height="480" fill="url(#grid)" />
      {/* Lake Victoria and Lake Tanganyika, schematic */}
      <path d="M300 180 C 330 150, 400 160, 410 200 C 420 250, 380 280, 340 270 C 300 262, 280 215, 300 180 Z" fill="#e8e1d0" />
      <text x="352" y="222" textAnchor="middle" className="fill-slate-500 font-plexmono" fontSize="10" letterSpacing="1.5">L. VICTORIA</text>
      <path d="M95 340 C 100 380, 120 430, 150 470 L 165 470 C 140 425, 118 380, 108 338 Z" fill="#e8e1d0" />
      {/* coast */}
      <path d="M600 200 C 590 260, 570 300, 545 350 C 520 400, 515 440, 520 480" fill="none" stroke="#0b1f3a" strokeOpacity="0.25" strokeDasharray="2 4" />
      <text x="600" y="400" className="fill-slate-400 font-plexmono" fontSize="10" letterSpacing="1.5">INDIAN OCEAN</text>
      {routes.map((r) => {
        const on = !highlight || highlight === r.id;
        return (
          <g key={r.id} opacity={on ? 1 : 0.25}>
            <path d={r.d} fill="none" stroke="#0b1f3a" strokeWidth="2.2" strokeDasharray="6 5" strokeLinecap="round" />
            <circle cx={r.post.x} cy={r.post.y} r="5" fill="#fffdf8" stroke="#b42318" strokeWidth="2" />
            <text x={r.post.x + 9} y={r.post.y + 4} className="fill-stamp font-plexmono" fontSize="10.5">{r.post.label}</text>
          </g>
        );
      })}
      {Object.values(cities).map((c) => (
        <g key={c.label}>
          <circle cx={c.x} cy={c.y} r={c.label === 'Kigali' ? 9 : 6} fill="#0b1f3a" />
          {c.label === 'Kigali' && <circle cx={c.x} cy={c.y} r="15" fill="none" stroke="#0b1f3a" strokeOpacity="0.35" />}
          <text x={c.x + (c.anchor === 'start' ? 12 : -12)} y={c.y + 5} textAnchor={c.anchor} className="fill-navy-900 font-serif" fontSize="16" fontWeight="600">{c.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Phone showing a verification result. */
export function PhoneVerifier({ className }: { className?: string }) {
  return (
    <div className={cx('relative mx-auto w-[260px]', className)}>
      <div className="rounded-[34px] border-[10px] border-navy-900 bg-paper-card p-4 pt-7 shadow-[0_24px_48px_-20px_rgba(11,31,58,0.45)]">
        <div className="absolute left-1/2 top-[14px] h-[6px] w-16 -translate-x-1/2 rounded-full bg-navy-700" />
        <p className="font-plexmono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Document verification</p>
        <div className="mt-3 rounded-[3px] border-2 border-emerald-300 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <ShieldCheck className="size-5" />
            <p className="font-serif text-[18px] font-semibold">Authentic</p>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-emerald-900/80">Issued through SealChain and not altered since. Anchored on-chain.</p>
        </div>
        <div className="mt-3 space-y-2 text-[11px]">
          {['File identical to record', 'Issuer signature valid', 'Merkle proof verified', 'Root confirmed on-chain'].map((t) => (
            <p key={t} className="flex items-center gap-1.5 text-navy-900"><CheckCircle2 className="size-3.5 text-emerald-600" /> {t}</p>
          ))}
        </div>
        <div className="mt-3 border-t border-paper-rule pt-2.5">
          <p className="text-[10px] text-slate-500">EAC Certificate of Origin</p>
          <p className="font-plexmono text-[11px] text-navy-900">SC-RWKE-CO-2026-00041</p>
          <p className="mt-1 text-[10px] text-slate-500">Endorsed by the issuing authority</p>
        </div>
      </div>
    </div>
  );
}

/** Browser window with a miniature of the SealChain workspace. */
export function AppWindow({ className }: { className?: string }) {
  const rows = [
    ['PO-2026-0147', 'Rwanda → Kenya', 'USD 69,090', 'Anchored'],
    ['PB-2026-022', 'Rwanda → Uganda', 'USD 18,120', 'Anchored'],
    ['Avocado trial', 'Rwanda → Kenya', 'USD 7,600', 'Needs fixes'],
  ];
  return (
    <div className={cx('overflow-hidden', SHEET, className)}>
      <div className="flex items-center gap-1.5 border-b border-paper-rule bg-paper-tint/60 px-3 py-2">
        {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full border border-slate-300 bg-paper-card" />)}
        <span className="ml-3 flex-1 truncate rounded-[2px] bg-paper-card px-2 py-0.5 font-plexmono text-[10px] text-slate-500">app.sealchain · /app/shipments</span>
      </div>
      <div className="grid grid-cols-[110px_minmax(0,1fr)]">
        <div className="space-y-1.5 border-r border-paper-rule bg-slate-100 p-3">
          <div className="mb-3 flex items-center gap-1.5"><span className="flex size-4 items-center justify-center rounded-full border border-navy-900 font-serif text-[8px] font-semibold">S</span><span className="font-serif text-[11px] font-semibold">SealChain</span></div>
          {['Dashboard', 'Shipments', 'Check', 'Address book', 'Team'].map((t, i) => (
            <p key={t} className={cx('rounded-[2px] px-1.5 py-1 text-[10px]', i === 1 ? 'bg-paper-card font-medium text-navy-900 ring-1 ring-paper-rule' : 'text-slate-500')}>{t}</p>
          ))}
        </div>
        <div className="p-4">
          <p className="font-serif text-[16px] font-semibold">Shipments</p>
          <div className="mt-3 divide-y divide-paper-rule border-y border-paper-rule">
            {rows.map(([ref, route, val, st]) => (
              <div key={ref} className="grid grid-cols-[1.2fr_1.2fr_1fr_0.9fr] items-center gap-2 py-2 text-[10.5px]">
                <span className="truncate font-medium text-navy-900">{ref}</span>
                <span className="truncate text-slate-600">{route}</span>
                <span className="text-slate-600">{val}</span>
                <span className={cx('justify-self-start rounded-[2px] px-1 py-0.5 text-[9.5px] ring-1', st === 'Anchored' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-800 ring-red-200')}>{st}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Validation report card: what the pre-submission checks look like. */
export function ValidationCard({ className }: { className?: string }) {
  const findings = [
    { tone: 'error', text: 'HS 0804.40 is avocados — description says mangoes.' },
    { tone: 'error', text: 'Consignee KRA PIN must look like P051234567X.' },
    { tone: 'warning', text: 'Net weight is above gross weight on line 2.' },
    { tone: 'ok', text: 'Rules of origin: wholly obtained (WO).' },
    { tone: 'ok', text: 'Phytosanitary certificate listed for fresh produce.' },
  ];
  return (
    <div className={cx('p-5', SHEET, className)}>
      <div className="flex items-center justify-between border-b border-paper-rule pb-3">
        <p className="font-serif text-[17px] font-medium">Pre-submission check</p>
        <span className="font-plexmono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">RW → KE</span>
      </div>
      <div className="grid grid-cols-3 border-b border-paper-rule py-3 text-center">
        {[['2', 'Errors', 'text-red-600'], ['1', 'Warning', 'text-amber-600'], ['2', 'Passed', 'text-emerald-700']].map(([n, l, c]) => (
          <div key={l}><p className={cx('font-serif text-[22px] font-semibold', c)}>{n}</p><p className="text-[10.5px] text-slate-500">{l}</p></div>
        ))}
      </div>
      <ul className="mt-2 space-y-2">
        {findings.map((f) => (
          <li key={f.text} className="flex gap-2 text-[12px] leading-snug text-navy-900">
            {f.tone === 'error' ? <XCircle className="mt-px size-3.5 shrink-0 text-red-600" /> : f.tone === 'warning' ? <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-600" />}
            {f.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Forensic screening report for a received certificate. */
export function ScreeningCard({ className }: { className?: string }) {
  const signals = [
    { level: 'high', t: 'Fingerprint differs from the issued original', d: 'Certificate number matches SC-RWUG-CO-2026-00001' },
    { level: 'medium', t: 'Edited after creation', d: 'Producer changed; incremental save detected' },
    { level: 'pass', t: 'Seal compared with reference', d: 'Perceptual hash within tolerance' },
  ];
  return (
    <div className={cx('p-5', SHEET, className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-plexmono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Screening report</p>
          <p className="mt-1 font-serif text-[18px] font-semibold text-red-700">High risk — altered copy</p>
        </div>
        <FileText className="size-6 text-slate-400" />
      </div>
      <ul className="mt-4 divide-y divide-paper-rule border-y border-paper-rule">
        {signals.map((s) => (
          <li key={s.t} className="flex gap-2.5 py-2.5">
            <span className={cx('mt-1 size-2 shrink-0 rounded-full', s.level === 'high' ? 'bg-red-600' : s.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-600')} />
            <div><p className="text-[12.5px] font-medium text-navy-900">{s.t}</p><p className="text-[11px] text-slate-500">{s.d}</p></div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500">The genuine issuer has been alerted.</p>
    </div>
  );
}

/** Merkle tree: document fingerprints batched into one on-chain root. */
export function MerkleDiagram({ className }: { className?: string }) {
  const leaves = ['Invoice', 'CoO', 'Packing', 'CoO'];
  return (
    <svg viewBox="0 0 520 300" className={cx('w-full', className)} role="img" aria-label="Four document fingerprints are hashed pairwise into a single root, which is written to a public blockchain">
      <g fontFamily="IBM Plex Mono, monospace" fontSize="11">
        {/* chain block */}
        <rect x="185" y="10" width="150" height="46" rx="2" fill="#0b1f3a" />
        <text x="260" y="30" textAnchor="middle" fill="#f8f5ee" letterSpacing="1.5">ON-CHAIN ROOT</text>
        <text x="260" y="46" textAnchor="middle" fill="#93a6c4">0xe1ac…31bd</text>
        <line x1="260" y1="56" x2="260" y2="92" stroke="#0b1f3a" strokeWidth="1.5" />
        {/* level 1 */}
        {[140, 380].map((x) => (
          <g key={x}>
            <line x1="260" y1="92" x2={x} y2="92" stroke="#0b1f3a" strokeWidth="1.5" />
            <line x1={x} y1="92" x2={x} y2="120" stroke="#0b1f3a" strokeWidth="1.5" />
            <rect x={x - 60} y="120" width="120" height="34" rx="2" fill="#fffdf8" stroke="#e2dac8" />
            <text x={x} y="141" textAnchor="middle" fill="#51565e">node · SHA-256</text>
            {[x - 60, x + 60].map((lx) => (
              <g key={lx}>
                <line x1={x} y1="154" x2={x} y2="180" stroke="#0b1f3a" strokeWidth="1.5" />
                <line x1={x} y1="180" x2={lx} y2="180" stroke="#0b1f3a" strokeWidth="1.5" />
                <line x1={lx} y1="180" x2={lx} y2="206" stroke="#0b1f3a" strokeWidth="1.5" />
              </g>
            ))}
          </g>
        ))}
        {/* leaves */}
        {[80, 200, 320, 440].map((x, i) => (
          <g key={x}>
            <rect x={x - 52} y="206" width="104" height="70" rx="2" fill="#fffdf8" stroke="#e2dac8" />
            <rect x={x - 52} y="206" width="104" height="18" fill="#eee8da" />
            <text x={x} y="219" textAnchor="middle" fill="#0b1f3a">{leaves[i]}.pdf</text>
            <text x={x} y="244" textAnchor="middle" fill="#6c6c69">sha256</text>
            <text x={x} y="262" textAnchor="middle" fill="#0b1f3a">{['9f2c…a41e', '04c8…2e3b', '0900…de0f', '70f5…79be'][i]}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Authority endorsement card with an official-looking round seal. */
export function EndorsementCard({ className }: { className?: string }) {
  return (
    <div className={cx('relative p-5', SHEET, className)}>
      <p className="font-plexmono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Endorsement request</p>
      <p className="mt-1 font-serif text-[18px] font-medium">EAC Certificate of Origin</p>
      <p className="font-plexmono text-[12px] text-slate-600">SC-RWKE-CO-2026-00041</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
        <div><dt className="text-slate-500">Exporter</dt><dd className="text-navy-900">Ubwiza Coffee Exporters</dd></div>
        <div><dt className="text-slate-500">Origin criterion</dt><dd className="text-navy-900">WO</dd></div>
        <div><dt className="text-slate-500">Requested</dt><dd className="text-navy-900">18 h ago</dd></div>
        <div><dt className="text-slate-500">Decision</dt><dd className="font-medium text-emerald-800">Endorsed</dd></div>
      </dl>
      <div className="mt-4 flex gap-2">
        <span className="rounded-[2px] bg-navy-900 px-3 py-1.5 text-[11px] font-medium text-white">Endorse</span>
        <span className="rounded-[2px] border border-paper-rule px-3 py-1.5 text-[11px] text-navy-900">Decline</span>
      </div>
      <svg viewBox="0 0 120 120" className="absolute -right-5 -top-6 size-28 rotate-[12deg]" aria-hidden>
        <defs><path id="ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
        <circle cx="60" cy="60" r="56" fill="#f8f5ee" fillOpacity="0.8" stroke="#b42318" strokeWidth="2.5" />
        <circle cx="60" cy="60" r="36" fill="none" stroke="#b42318" strokeWidth="1.2" />
        <text fill="#b42318" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="2.4"><textPath href="#ring">ISSUING AUTHORITY · ENDORSED ·</textPath></text>
        <path d="M46 61l9 9 19-21" fill="none" stroke="#b42318" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Dark code sheet. */
export function CodeSheet({ title, code, className }: { title: string; code: string; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-[3px] bg-navy-900 shadow-[0_18px_40px_-20px_rgba(11,31,58,0.6)]', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-navy-300">{title}</span>
        <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-white/15" />)}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-plexmono text-[12.5px] leading-relaxed text-slate-100"><code>{code}</code></pre>
    </div>
  );
}
