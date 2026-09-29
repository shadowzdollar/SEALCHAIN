/**
 * Paper-style illustrations for the public site. Drawn in SVG/HTML so they
 * stay crisp, match the palette and need no external images.
 */
import { AlertTriangle, Check, CheckCircle2, FileText, ShieldCheck, XCircle } from 'lucide-react';
import { cx } from '../components/ui';
import { MAP } from './eastAfricaMap';

const SHEET = 'rounded-[2px] border border-paper-rule bg-paper-card shadow-[0_1px_2px_rgba(11,31,58,0.06),0_12px_32px_-12px_rgba(11,31,58,0.18)]';

export function Stamp({ children = 'Anchored', className, tick = true }: { children?: string; className?: string; tick?: boolean }) {
  return (
    <div className={cx('stamp bg-paper/70', className)}>
      {children} {tick && <Check className="size-3.5" strokeWidth={2.5} />}
    </div>
  );
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[12.5px] text-slate-500">{k}</p>
      <p className={mono ? 'font-plexmono text-[13.5px] text-ink' : 'text-[13.5px] text-ink'}>{v}</p>
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
        <h3 className="mt-5 font-serif text-[21px] font-medium text-ink">Certificate of Origin</h3>
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

/**
 * East Africa corridor map: real borders, lakes and coastline (Natural Earth,
 * public domain), with indicative road routes from Kigali and border posts.
 * Colours come from theme tokens, so it follows light and dark mode.
 */
export function CorridorMap({ className, highlight, compact }: { className?: string; highlight?: string | null; compact?: boolean }) {
  const { width, height, countries, lakes, places, posts, routes } = MAP;
  const LABEL_SIDE: Record<string, 'start' | 'end'> = { kigali: 'end', bujumbura: 'end', akanyaru: 'end', gatuna: 'end' };
  const halo = 'paint-order:stroke;stroke:var(--color-paper-card);stroke-width:3.5px;stroke-linejoin:round';
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cx('w-full', className)} role="img" aria-label="Map of East Africa showing SealChain's road corridors from Kigali to Kampala, Nairobi, Mombasa, Dar es Salaam and Bujumbura">
      <rect width={width} height={height} className="fill-[var(--color-sea)]" />
      {countries.map((c) => (
        <path key={c.code} d={c.d} className={cx(c.eac ? 'fill-paper-card' : 'fill-paper-tint', c.code === 'RW' ? 'stroke-ink' : 'stroke-[var(--color-border-strong)]')} strokeWidth={c.code === 'RW' ? 1.4 : 0.8} strokeLinejoin="round" />
      ))}
      {lakes.map((l) => <path key={l.name} d={l.d} className="fill-[var(--color-sea)] stroke-[var(--color-border-strong)]" strokeWidth={0.4} />)}
      {!compact && countries.filter((c) => c.label).map((c) => (
        <text key={c.code} x={c.label![0]} y={c.label![1]} textAnchor="middle" className={cx('font-plexmono uppercase', c.eac ? 'fill-ink' : 'fill-slate-400')} fontSize={c.eac ? 11.5 : 10} letterSpacing={2.2} style={{ opacity: c.eac ? 0.75 : 0.9 }}>{c.name}</text>
      ))}
      {!compact && lakes.filter((l) => l.label).map((l) => (
        <text key={l.name} x={l.label![0]} y={l.label![1]} textAnchor="middle" className="fill-[var(--color-sea-ink)] font-serif italic" fontSize={12}>{l.name}</text>
      ))}
      {Object.entries(routes).map(([id, d]) => (
        <path key={id} d={d} fill="none" className="stroke-ink transition-opacity" strokeWidth={2.4} strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: !highlight || highlight === id ? 1 : 0.18 }} />
      ))}
      {Object.entries(posts).map(([k, p]) => (
        <g key={k} style={{ opacity: !highlight || ROUTE_POSTS[highlight]?.includes(k) ? 1 : 0.25 }}>
          <circle cx={p.at[0]} cy={p.at[1]} r={4.5} className="fill-paper-card stroke-stamp" strokeWidth={2} />
          {!compact && <text x={p.at[0] + (LABEL_SIDE[k] === 'end' ? -8 : 8)} y={p.at[1] + 4} textAnchor={LABEL_SIDE[k] ?? 'start'} className="fill-stamp font-plexmono" fontSize={10.5} style={{ cssText: halo } as never}>{p.name}</text>}
        </g>
      ))}
      {Object.entries(places).map(([k, p]) => (
        <g key={k}>
          {k === 'kigali' && <circle cx={p.at[0]} cy={p.at[1]} r={13} fill="none" className="stroke-ink" strokeOpacity={0.35} />}
          <circle cx={p.at[0]} cy={p.at[1]} r={k === 'kigali' ? 6.5 : 4.5} className="fill-ink" />
          {!compact && <text x={p.at[0] + (LABEL_SIDE[k] === 'end' ? -12 : 10)} y={p.at[1] + (k === 'kigali' ? -10 : 5)} textAnchor={LABEL_SIDE[k] ?? 'start'} className="fill-ink font-serif" fontSize={k === 'kigali' ? 17 : 15} fontWeight={600} style={{ cssText: halo } as never}>{p.name}</text>}
        </g>
      ))}
      {!compact && <text x={width - 10} y={height - 10} textAnchor="end" className="fill-slate-500 font-plexmono" fontSize={9.5}>Map data: Natural Earth (public domain) · routes indicative</text>}
      {!compact && <text x={width - 62} y={height * 0.78} textAnchor="middle" className="fill-[var(--color-sea-ink)] font-serif italic" fontSize={13} letterSpacing={1}>Indian Ocean</text>}
    </svg>
  );
}

/** Border posts on each corridor's route (for highlighting). */
export const ROUTE_POSTS: Record<string, string[]> = {
  'RW-KE': ['gatuna', 'malaba'],
  'RW-UG': ['gatuna'],
  'RW-TZ': ['rusumo'],
  'RW-BI': ['akanyaru'],
};

/** Phone showing a verification result. */
export function PhoneVerifier({ className }: { className?: string }) {
  return (
    <div className={cx('relative mx-auto w-[260px]', className)}>
      <div className="rounded-[34px] border-[10px] border-ink bg-paper-card p-4 pt-7 shadow-[0_24px_48px_-20px_rgba(11,31,58,0.45)]">
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
            <p key={t} className="flex items-center gap-1.5 text-ink"><CheckCircle2 className="size-3.5 text-emerald-600" /> {t}</p>
          ))}
        </div>
        <div className="mt-3 border-t border-paper-rule pt-2.5">
          <p className="text-[10px] text-slate-500">EAC Certificate of Origin</p>
          <p className="font-plexmono text-[11px] text-ink">SC-RWKE-CO-2026-00041</p>
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
        <div className="space-y-1.5 border-r border-paper-rule bg-paper-tint p-3">
          <div className="mb-3 flex items-center gap-1.5"><img src="/brand/sealchain-seal-64.png" alt="" className="size-5" /><span className="font-serif text-[11px] font-semibold">SealChain</span></div>
          {['Dashboard', 'Shipments', 'Check', 'Address book', 'Team'].map((t, i) => (
            <p key={t} className={cx('rounded-[2px] px-1.5 py-1 text-[10px]', i === 1 ? 'bg-paper-card font-medium text-ink ring-1 ring-paper-rule' : 'text-slate-500')}>{t}</p>
          ))}
        </div>
        <div className="p-4">
          <p className="font-serif text-[16px] font-semibold">Shipments</p>
          <div className="mt-3 divide-y divide-paper-rule border-y border-paper-rule">
            {rows.map(([ref, route, val, st]) => (
              <div key={ref} className="grid grid-cols-[1.2fr_1.2fr_1fr_0.9fr] items-center gap-2 py-2 text-[10.5px]">
                <span className="truncate font-medium text-ink">{ref}</span>
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
          <li key={f.text} className="flex gap-2 text-[12px] leading-snug text-ink">
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
            <div><p className="text-[12.5px] font-medium text-ink">{s.t}</p><p className="text-[11px] text-slate-500">{s.d}</p></div>
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
        <rect x="185" y="10" width="150" height="46" rx="2" fill="var(--color-ink)" />
        <text x="260" y="30" textAnchor="middle" fill="var(--color-ink-contrast)" letterSpacing="1.5">ON-CHAIN ROOT</text>
        <text x="260" y="46" textAnchor="middle" fill="var(--color-ink-contrast)" fillOpacity={0.7}>0xe1ac…31bd</text>
        <line x1="260" y1="56" x2="260" y2="92" stroke="var(--color-ink)" strokeWidth="1.5" />
        {/* level 1 */}
        {[140, 380].map((x) => (
          <g key={x}>
            <line x1="260" y1="92" x2={x} y2="92" stroke="var(--color-ink)" strokeWidth="1.5" />
            <line x1={x} y1="92" x2={x} y2="120" stroke="var(--color-ink)" strokeWidth="1.5" />
            <rect x={x - 60} y="120" width="120" height="34" rx="2" fill="var(--color-paper-card)" stroke="var(--color-paper-rule)" />
            <text x={x} y="141" textAnchor="middle" fill="var(--color-slate-600)">node · SHA-256</text>
            {[x - 60, x + 60].map((lx) => (
              <g key={lx}>
                <line x1={x} y1="154" x2={x} y2="180" stroke="var(--color-ink)" strokeWidth="1.5" />
                <line x1={x} y1="180" x2={lx} y2="180" stroke="var(--color-ink)" strokeWidth="1.5" />
                <line x1={lx} y1="180" x2={lx} y2="206" stroke="var(--color-ink)" strokeWidth="1.5" />
              </g>
            ))}
          </g>
        ))}
        {/* leaves */}
        {[80, 200, 320, 440].map((x, i) => (
          <g key={x}>
            <rect x={x - 52} y="206" width="104" height="70" rx="2" fill="var(--color-paper-card)" stroke="var(--color-paper-rule)" />
            <rect x={x - 52} y="206" width="104" height="18" fill="var(--color-paper-tint)" />
            <text x={x} y="219" textAnchor="middle" fill="var(--color-ink)">{leaves[i]}.pdf</text>
            <text x={x} y="244" textAnchor="middle" fill="var(--color-slate-500)">sha256</text>
            <text x={x} y="262" textAnchor="middle" fill="var(--color-ink)">{['9f2c…a41e', '04c8…2e3b', '0900…de0f', '70f5…79be'][i]}</text>
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
        <div><dt className="text-slate-500">Exporter</dt><dd className="text-ink">Ubwiza Coffee Exporters</dd></div>
        <div><dt className="text-slate-500">Origin criterion</dt><dd className="text-ink">WO</dd></div>
        <div><dt className="text-slate-500">Requested</dt><dd className="text-ink">18 h ago</dd></div>
        <div><dt className="text-slate-500">Decision</dt><dd className="font-medium text-emerald-800">Endorsed</dd></div>
      </dl>
      <div className="mt-4 flex gap-2">
        <span className="rounded-[2px] bg-ink px-3 py-1.5 text-[11px] font-medium text-ink-contrast">Endorse</span>
        <span className="rounded-[2px] border border-paper-rule px-3 py-1.5 text-[11px] text-ink">Decline</span>
      </div>
      <svg viewBox="0 0 120 120" className="absolute -right-5 -top-6 size-28 rotate-[12deg]" aria-hidden>
        <defs><path id="ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
        <circle cx="60" cy="60" r="56" fill="var(--color-paper)" fillOpacity="0.8" stroke="var(--color-stamp)" strokeWidth="2.5" />
        <circle cx="60" cy="60" r="36" fill="none" stroke="var(--color-stamp)" strokeWidth="1.2" />
        <text fill="var(--color-stamp)" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="2.4"><textPath href="#ring">ISSUING AUTHORITY · ENDORSED ·</textPath></text>
        <path d="M46 61l9 9 19-21" fill="none" stroke="var(--color-stamp)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
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
