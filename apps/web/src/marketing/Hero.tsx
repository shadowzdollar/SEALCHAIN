/**
 * Landing hero: "the journey of a document".
 *
 * The right-hand stage plays SealChain's whole story on the real East Africa
 * map in one loop: documents are issued and anchored in Kigali, a truck drives
 * the Northern Corridor, each border post scans the QR seal and stamps it
 * authentic, and the consignment clears in Mombasa. The headline proofreads
 * its own typo. Everything runs off a single rAF clock that writes to the DOM
 * directly, so React only re-renders when the story changes chapter.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, FileCheck2, Fingerprint, Globe2, Lock, ScanLine, ShieldCheck, Truck } from 'lucide-react';
import { msg, useTr } from '../locale';
import { MAP } from './eastAfricaMap';
import { QrGlyph } from './Illustrations';
import { Credit } from './Photo';
import { GalleryChannel, ReelChannel } from './TvChannels';
import { PHOTOS, type Photo } from './photos';

// ------------------------------------------------------------ geometry
const VB = { x: 88, y: 118, w: 624, h: 344 }; // crop of the 800×700 map around the Northern Corridor
const ROUTE = MAP.routes['RW-KE'] as string;
const pct = ([x, y]: readonly number[]): CSSProperties => ({ left: `${((x! - VB.x) / VB.w) * 100}%`, top: `${((y! - VB.y) / VB.h) * 100}%` });
const POSTS = [
  { id: 'gatuna', name: 'Gatuna', authority: 'RRA · Rwanda exit', at: MAP.posts.gatuna.at, card: 'right' as const },
  { id: 'malaba', name: 'Malaba', authority: 'KRA · Kenya entry', at: MAP.posts.malaba.at, card: 'below' as const },
];
const CITIES = [
  { id: 'kigali', ...MAP.places.kigali, major: true },
  { id: 'kampala', ...MAP.places.kampala, major: false },
  { id: 'nairobi', ...MAP.places.nairobi, major: false },
  { id: 'mombasa', ...MAP.places.mombasa, major: true },
];

// ------------------------------------------------------------ timeline (ms)
const T_ISSUE = 2600; // documents issued & anchored in Kigali
const T_SCAN = 2000; // pause at each border post
const T_DRIVE = 9000; // total driving time across the corridor
const T_CLEAR = 3600; // hold on the cleared stamp
type Chapter = 'issue' | 'drive' | 'scan' | 'cleared';
interface Frame { chapter: Chapter; post: string | null; done: string[]; progress: number }

function buildTimeline(fractions: number[]) {
  // Legs between stops, each with a duration proportional to its length.
  const stops = [0, ...fractions, 1];
  const legs: Array<{ from: number; to: number; start: number; end: number; post: string | null }> = [];
  let t = T_ISSUE;
  for (let i = 0; i < stops.length - 1; i++) {
    const d = T_DRIVE * (stops[i + 1]! - stops[i]!);
    legs.push({ from: stops[i]!, to: stops[i + 1]!, start: t, end: t + d, post: null });
    t += d;
    if (i < fractions.length) {
      legs.push({ from: stops[i + 1]!, to: stops[i + 1]!, start: t, end: t + T_SCAN, post: POSTS[i]!.id });
      t += T_SCAN;
    }
  }
  return { legs, total: t + T_CLEAR };
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

function frameAt(ms: number, tl: ReturnType<typeof buildTimeline>): Frame {
  if (ms < T_ISSUE) return { chapter: 'issue', post: null, done: [], progress: 0 };
  const done: string[] = [];
  for (const leg of tl.legs) {
    if (ms >= leg.end) { if (leg.post) done.push(leg.post); continue; }
    if (ms < leg.start) break;
    const p = leg.post ? leg.from : leg.from + (leg.to - leg.from) * ease((ms - leg.start) / (leg.end - leg.start));
    return { chapter: leg.post ? 'scan' : 'drive', post: leg.post, done, progress: p };
  }
  return { chapter: 'cleared', post: null, done, progress: 1 };
}

// ------------------------------------------------------------ headline
/** A word that arrives misspelt (two letters transposed), gets proofread, and swaps itself right. */
function Proofread({ word }: { word: string }) {
  const chars = [...word];
  const ok = chars.length >= 4;
  const [fixed, setFixed] = useState(!ok);
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ok || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setFixed(true); return; }
    setFixed(false);
    const t = window.setTimeout(() => {
      const ea = a.current, eb = b.current;
      if (!ea || !eb) return setFixed(true);
      const wa = ea.getBoundingClientRect().width, wb = eb.getBoundingClientRect().width;
      const opts = { duration: 750, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' as const };
      ea.animate([{ transform: 'none' }, { transform: `translate(${wb / 2}px, -0.42em) rotate(8deg)` }, { transform: `translate(${wb}px, 0)` }], opts);
      const anim = eb.animate([{ transform: 'none' }, { transform: `translate(${-wa / 2}px, 0.3em) rotate(-8deg)` }, { transform: `translate(${-wa}px, 0)` }], opts);
      anim.onfinish = () => setFixed(true);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [word, ok]);

  if (!ok) return <em className="font-medium text-stamp">{word}</em>;
  // Wrong order first: letters 1 and 2 swapped.
  const [c0, c1, c2, ...rest] = chars;
  return (
    <em className={cx2('proofread relative inline-block whitespace-nowrap font-medium text-stamp', fixed ? 'is-fixed' : 'is-typo')} aria-label={word}>
      <span aria-hidden>
        {c0}
        {fixed ? <>{c1}{c2}</> : <><span ref={a} className="inline-block">{c2}</span><span ref={b} className="inline-block">{c1}</span></>}
        {rest.join('')}
      </span>
      <span aria-hidden className="proof-check absolute -right-[0.55em] -top-[0.1em] flex size-[0.42em] items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check className="size-[0.3em]" strokeWidth={3.5} />
      </span>
    </em>
  );
}
const cx2 = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------ photo reel
/** Real places for each chapter of the journey, dealt onto the stage like prints. */
const REEL: Record<'origin' | 'road' | 'port', { photo: Photo; caption: string }> = {
  origin: { photo: PHOTOS.teaFields, caption: msg('Packed at origin · Nyabihu, Rwanda') },
  road: { photo: PHOTOS.truckNileBridge, caption: msg('On the road · Northern Corridor') },
  port: { photo: PHOTOS.portCranes, caption: msg('Cleared · Port of Mombasa') },
};
const TILTS = [-7, 5, -3];

function PhotoReel({ scene }: { scene: keyof typeof REEL }) {
  const { tr } = useTr();
  // The last three prints dealt, newest on top.
  const [stack, setStack] = useState<Array<{ id: number; scene: keyof typeof REEL }>>([{ id: 0, scene }]);
  useEffect(() => {
    setStack((s) => (s[s.length - 1]?.scene === scene ? s : [...s.slice(-2), { id: (s[s.length - 1]?.id ?? 0) + 1, scene }]));
  }, [scene]);
  return (
    <div className="pointer-events-none absolute bottom-2 -left-3 z-20 w-[30%] min-w-[140px] max-w-[230px] sm:-left-8 lg:bottom-4 lg:-left-10">
      {stack.map((it, i) => {
        const top = i === stack.length - 1;
        const { photo, caption } = REEL[it.scene];
        return (
          <figure
            key={it.id}
            className={cx2('absolute bottom-0 left-0 w-full rounded-[3px] bg-[#fffdf8] p-2 pb-0 shadow-[0_24px_40px_-18px_rgba(11,31,58,0.55),0_2px_4px_rgba(11,31,58,0.12)] transition-transform duration-700', top && 'deal-in pointer-events-auto')}
            style={{ transform: `rotate(${TILTS[(it.id) % 3]}deg) translate(${(stack.length - 1 - i) * -10}px, ${(stack.length - 1 - i) * -6}px)`, zIndex: i }}
          >
            <span aria-hidden className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-3deg] bg-[#efe6cf]/85 shadow-sm" />
            <img src={photo.sm} alt={photo.alt} loading="eager" decoding="async" className="aspect-[4/3] w-full object-cover [filter:saturate(0.95)_contrast(1.03)]" />
            <figcaption className="px-0.5 py-1.5">
              <span className="block truncate font-plexmono text-[9.5px] uppercase tracking-[0.12em] text-[#0b1f3a]">{tr(caption)}</span>
              {top && <Credit photo={photo} className="block truncate !text-[8.5px] !text-[#6c6c69]" />}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ stage
type Channel = 1 | 2 | 3;

function Stage() {
  const { tr } = useTr();
  const wrap = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const truck = useRef<SVGGElement>(null);
  const day = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = useState<Frame>({ chapter: 'issue', post: null, done: [], progress: 0 });
  const [loop, setLoop] = useState(0);
  const [channel, setChannel] = useState<Channel>(1);
  const [glitch, setGlitch] = useState(0);
  const live = useRef({ channel: 1 as Channel, restart: false });
  const tune = useCallback((ch: Channel) => {
    if (live.current.channel === ch) return;
    live.current.channel = ch;
    if (ch === 3) live.current.restart = true;
    setChannel(ch);
    setGlitch((n) => n + 1);
  }, []);
  const toGallery = useCallback(() => tune(2), [tune]);
  const toTracker = useCallback(() => tune(3), [tune]);
  const [still, setStill] = useState(false);

  useLayoutEffect(() => {
    const p = path.current;
    if (!p) return;
    const len = p.getTotalLength();
    // Where along the route each border post sits (nearest sampled point).
    const fractions = POSTS.map(({ at }) => {
      let best = 0, bestD = Infinity;
      for (let i = 0; i <= 400; i++) {
        const pt = p.getPointAtLength((len * i) / 400);
        const d = (pt.x - at[0]!) ** 2 + (pt.y - at[1]!) ** 2;
        if (d < bestD) { bestD = d; best = i / 400; }
      }
      return best;
    });
    const tl = buildTimeline(fractions);
    if (trail.current) { trail.current.style.strokeDasharray = `${len}`; trail.current.style.strokeDashoffset = `${len}`; }

    const place = (progress: number) => {
      const pt = p.getPointAtLength(len * progress);
      truck.current?.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
      if (trail.current) trail.current.style.strokeDashoffset = `${len * (1 - progress)}`;
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      live.current.channel = 3;
      setChannel(3);
      place(1);
      setFrame({ chapter: 'cleared', post: null, done: POSTS.map((x) => x.id), progress: 1 });
      return;
    }

    let raf = 0, last = performance.now(), clock = 0, visible = true, key = '';
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    if (wrap.current) io.observe(wrap.current);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last);
      last = now;
      if (!visible || live.current.channel !== 3) return;
      if (live.current.restart) { live.current.restart = false; clock = 0; }
      clock += dt;
      if (clock >= tl.total) { clock = 0; setLoop((n) => n + 1); tune(1); }
      const f = frameAt(clock, tl);
      place(f.progress);
      if (day.current) day.current.textContent = String(Math.min(3, 1 + Math.floor(f.progress * 3)));
      if (bar.current) bar.current.style.transform = `scaleX(${clock / tl.total})`;
      const k = `${f.chapter}|${f.post}|${f.done.join()}`;
      if (k !== key) { key = k; setFrame(f); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  // Pointer parallax: the stage leans toward the cursor.
  useEffect(() => {
    const el = wrap.current, t = tilt.current;
    if (!el || !t || window.matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      t.style.transform = `rotateY(${x * 6}deg)`; // it stands on the floor: turn, don't tip
      t.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
      t.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    };
    const leave = () => { t.style.transform = ''; };
    const zone = el.closest('section') ?? el;
    zone.addEventListener('pointermove', move as EventListener);
    zone.addEventListener('pointerleave', leave);
    return () => { zone.removeEventListener('pointermove', move as EventListener); zone.removeEventListener('pointerleave', leave); };
  }, []);

  const block = 48213 + loop;
  const issuedShown = frame.chapter === 'issue' || (frame.chapter === 'drive' && frame.done.length === 0 && frame.progress < 0.08);
  const anchored = frame.chapter !== 'issue' || still;

  return (
    <div ref={wrap} className="relative [perspective:1600px]" aria-hidden>
      <div ref={tilt} className="stage-tilt tv-reflect relative flex flex-col items-center transition-transform duration-500 ease-out [transform-origin:50%_100%] [transform-style:preserve-3d]">
        {/* bezel */}
        <div className="tv-bezel relative w-full rounded-[20px] p-[9px] pb-[9px]">
          <div className="relative overflow-hidden rounded-[11px] bg-paper-card p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35),inset_0_0_30px_rgba(11,31,58,0.12)]">
            <div aria-hidden className="stage-glare pointer-events-none absolute inset-0 z-30" />
            <div aria-hidden className="tv-reflection pointer-events-none absolute inset-0 z-30" />
            {!still && <ReelChannel on={channel === 1} onEnd={toGallery} />}
            {!still && <GalleryChannel on={channel === 2} onEnd={toTracker} />}
            {glitch > 0 && <div key={glitch} aria-hidden className="tv-static pointer-events-none absolute inset-0 z-[25]" />}

        {/* HUD */}
        <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative size-2 rounded-full bg-emerald-500" /></span>
            <span className="truncate font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">KTG-2026-0147 · {tr('Kigali → Mombasa')}</span>
          </div>
          <span className="shrink-0 font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">{tr('Day')} <span ref={day}>1</span> / 3</span>
        </div>

        {/* Map */}
        <div className="relative overflow-hidden rounded-[14px] border border-paper-rule bg-[var(--color-sea)]" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
          <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="absolute inset-0 size-full">
            <defs>
              <filter id="hero-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
            </defs>
            {MAP.countries.map((c) => (
              <path key={c.code} d={c.d} className={c.eac ? 'fill-paper-card stroke-[var(--color-border-strong)]' : 'fill-paper-tint stroke-[var(--color-border-strong)]'} strokeWidth={0.7} strokeLinejoin="round" />
            ))}
            {MAP.lakes.map((l) => <path key={l.name} d={l.d} className="fill-[var(--color-sea)] stroke-[var(--color-border-strong)]" strokeWidth={0.4} />)}
            {MAP.countries.filter((c) => c.label && ['RW', 'UG', 'KE', 'TZ'].includes(c.code)).map((c) => (
              <text key={c.code} x={c.label![0]} y={c.label![1]} textAnchor="middle" className="fill-ink font-plexmono uppercase" fontSize={10} letterSpacing={2.4} opacity={0.35}>{c.name}</text>
            ))}
            {/* road ahead (dashed) and the trail already driven (solid, glowing) */}
            <path ref={path} d={ROUTE} fill="none" className="stroke-ink" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path ref={trail} d={ROUTE} fill="none" className="stroke-ink" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {CITIES.map((c) => (
              <g key={c.id}>
                {c.major && <circle cx={c.at[0]} cy={c.at[1]} r={11} fill="none" className="stroke-ink" strokeOpacity={0.3} />}
                <circle cx={c.at[0]} cy={c.at[1]} r={c.major ? 5.5 : 3.8} className="fill-ink" />
                <text x={c.at[0] + (c.id === 'mombasa' ? -12 : 10)} y={c.at[1] + (c.id === 'kigali' ? 18 : -9)} textAnchor={c.id === 'mombasa' ? 'end' : 'start'} className="fill-ink font-serif" fontSize={c.major ? 14 : 12} fontWeight={c.major ? 600 : 500} style={{ paintOrder: 'stroke', stroke: 'var(--color-paper-card)', strokeWidth: 4 }}>{c.name}</text>
              </g>
            ))}
            {POSTS.map((p) => {
              const done = frame.done.includes(p.id), live = frame.post === p.id;
              return (
                <g key={p.id} transform={`translate(${p.at[0]} ${p.at[1]})`}>
                  {live && <circle r={8} className="scan-ring fill-none stroke-stamp" strokeWidth={2} />}
                  <circle r={7} className={done ? 'fill-emerald-600 stroke-paper-card' : 'fill-paper-card stroke-stamp'} strokeWidth={2.2} style={{ transition: 'fill .3s' }} />
                  {done && <path d="M-3 0.2 L-1 2.3 L3.2 -2.2" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
                </g>
              );
            })}
            <g ref={truck}>
              <circle r={22} className="fill-stamp" opacity={0.14} filter="url(#hero-soft)" />
              <circle r={13} className="fill-ink stroke-paper-card" strokeWidth={2.5} />
              <Truck x={-7} y={-7} width={14} height={14} color="white" strokeWidth={2.2} />
            </g>
          </svg>

          {/* Kigali: issue & anchor */}
          <div className={cx2('stage-card absolute w-[46%] max-w-[250px] -translate-y-[112%] translate-x-[6%]', issuedShown ? 'is-on' : '')} style={pct(MAP.places.kigali.at)}>
            <div className="rounded-xl border border-paper-rule bg-paper-card/95 p-3 shadow-[0_18px_40px_-20px_rgba(11,31,58,0.5)] backdrop-blur">
              <p className="font-plexmono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">{tr('Issued in Kigali')}</p>
              <ul className="mt-2 space-y-1.5 text-[11.5px] text-ink">
                {[tr('Commercial invoice'), tr('Certificate of origin'), tr('Packing list')].map((d, i) => (
                  <li key={d} className="doc-line flex items-center gap-2" style={{ animationDelay: `${250 + i * 220}ms` }}>
                    <FileCheck2 className="size-3.5 shrink-0 text-emerald-600" /> <span className="truncate">{d}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex items-center gap-2 border-t border-paper-rule pt-2 font-plexmono text-[10px] text-slate-500">
                <Fingerprint className="size-3.5 text-stamp" />
                <span className="hash-type truncate">sha256 9f2c…a41e</span>
              </div>
            </div>
          </div>

          {/* Border posts: scan & verify */}
          {POSTS.map((p) => {
            const on = frame.post === p.id;
            return (
              <div key={p.id} className={cx2('stage-card absolute w-[44%] max-w-[240px]', p.card === 'right' ? '-translate-y-[108%] translate-x-[8%]' : 'translate-x-[-30%] translate-y-[26%]', on ? 'is-on' : '')} style={pct(p.at)}>
                <div className="relative overflow-hidden rounded-xl border border-paper-rule bg-paper-card/95 p-3 shadow-[0_18px_40px_-20px_rgba(11,31,58,0.5)] backdrop-blur">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0 overflow-hidden rounded-md border border-paper-rule bg-white p-1">
                      <QrGlyph className="size-11" />
                      {on && <span className="scan-beam absolute inset-x-0 h-[2px] bg-stamp shadow-[0_0_10px_2px_rgba(180,35,24,0.6)]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-serif text-[14px] font-semibold text-ink"><ScanLine className="size-3.5 text-stamp" />{p.name}</p>
                      <p className="font-plexmono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">{p.authority}</p>
                      <p className="mt-1 truncate font-plexmono text-[10px] text-slate-500">SC-RWKE-CO-00147</p>
                    </div>
                  </div>
                  {on && (
                    <div className="verdict-in mt-2.5 flex items-center justify-between rounded-md bg-emerald-600/10 px-2 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> {tr('Authentic · unaltered')}</span>
                      <span className="font-plexmono text-[10px] opacity-80">0.4s</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Mombasa: cleared */}
          <div className={cx2('absolute -translate-x-[108%] -translate-y-[130%]', frame.chapter === 'cleared' ? 'block' : 'hidden')} style={pct(MAP.places.mombasa.at)}>
            <div key={loop} className="stamp-thump rounded-md border-[3px] border-emerald-700 bg-paper-card/85 px-3 py-1.5 text-center font-plexmono uppercase text-emerald-700 shadow-[0_10px_30px_-12px_rgba(4,120,87,0.6)] backdrop-blur dark:text-emerald-400">
              <p className="whitespace-nowrap text-[15px] font-semibold tracking-[0.16em]">{tr('Cleared')}</p>
              <p className="whitespace-nowrap text-[9.5px] tracking-[0.12em] opacity-80">{tr('0 hours held for paperwork')}</p>
            </div>
          </div>
        </div>

        {/* Ledger ribbon */}
        <div className="mt-3 flex items-center gap-3 px-2 pb-1">
          <span className="shrink-0 font-plexmono text-[10px] uppercase tracking-[0.16em] text-slate-500">{tr('Public ledger')}</span>
          <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%)]">
            {[4, 3, 2, 1].map((k) => (
              <LedgerBlock key={block - k} n={block - k} />
            ))}
            <LedgerBlock key={block} n={block} fresh={anchored} pending={!anchored} />
          </div>
        </div>
        <span className="absolute inset-x-6 bottom-0 z-30 h-[2px] overflow-hidden rounded-full"><span ref={bar} className="block h-full origin-left bg-ink/15" /></span>
          </div>
          {/* chin */}
          <div className="flex h-[22px] items-center justify-between px-4 pt-[7px]">
            <span className="font-plexmono text-[8.5px] uppercase tracking-[0.3em] text-white/30">SealChain</span>
            <span className="flex items-center gap-1.5">
              {!still && ([1, 2, 3] as const).map((ch) => (
                <button key={ch} type="button" tabIndex={-1} onClick={() => tune(ch)} className={cx2('rounded-[3px] px-1.5 font-plexmono text-[8.5px] tracking-[0.14em] transition-colors', channel === ch ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/70')}>CH{ch}</button>
              ))}
              <span className="ml-1 size-[5px] rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.8)]" />
            </span>
          </div>
        </div>
        <Pedestal />
      </div>
      {/* contact shadow on the floor */}
      <div aria-hidden className="pointer-events-none absolute -bottom-3 left-1/2 -z-10 h-8 w-[62%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(5,7,12,0.45),transparent)] blur-[3px]" />
      <ContainerStack />
      {channel === 3 && <PhotoReel scene={frame.chapter === 'issue' ? 'origin' : frame.chapter === 'cleared' ? 'port' : 'road'} />}
    </div>
  );
}

/** Brushed-metal pedestal: a tapered neck rising from an elliptical plate seen in perspective. */
function Pedestal() {
  return (
    <svg aria-hidden data-tv-foot viewBox="0 0 400 74" className="-mt-px w-[46%] min-w-[200px] overflow-visible">
      <defs>
        <linearGradient id="ped-neck" x1="0" x2="1">
          <stop offset="0" stopColor="#151b27" /><stop offset="0.35" stopColor="#4a5468" /><stop offset="0.55" stopColor="#2c3445" /><stop offset="1" stopColor="#11161f" />
        </linearGradient>
        <radialGradient id="ped-top" cx="0.42" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#6b778d" /><stop offset="0.45" stopColor="#353e50" /><stop offset="1" stopColor="#141923" />
        </radialGradient>
        <linearGradient id="ped-edge" x1="0" x2="1">
          <stop offset="0" stopColor="#0b0f18" /><stop offset="0.5" stopColor="#2a3242" /><stop offset="1" stopColor="#0b0f18" />
        </linearGradient>
      </defs>
      {/* neck */}
      <path d="M172 0 H228 L240 46 H160 Z" fill="url(#ped-neck)" />
      <path d="M186 0 H192 L189 44 H183 Z" fill="white" opacity="0.12" />
      {/* plate: edge then top surface */}
      <path d="M40 52 A160 16 0 0 0 360 52 V60 A160 16 0 0 1 40 60 Z" fill="url(#ped-edge)" />
      <ellipse cx="200" cy="52" rx="160" ry="16" fill="url(#ped-top)" />
      <ellipse cx="200" cy="50.5" rx="150" ry="12" fill="none" stroke="white" strokeOpacity="0.14" />
      <ellipse cx="200" cy="47" rx="40" ry="4" fill="#05070c" opacity="0.55" />
    </svg>
  );
}

/** A little stack of shipping containers beside the TV, built from CSS boxes. */
function ContainerStack() {
  const boxes = [
    { c: '#b42318', x: 0, y: 0, label: 'SEALCHAIN' },
    { c: '#0b1f3a', x: 100, y: 0, label: '' },
    { c: '#2f6f4f', x: 48, y: -40, label: 'EAC' },
  ];
  return (
    <div aria-hidden className="container-stack pointer-events-none absolute -bottom-1 right-[-3%] hidden h-[82px] w-[200px] sm:block lg:right-[-6%]">
      <div className="absolute bottom-0 left-0 [transform:rotateX(-14deg)_rotateY(-32deg)] [transform-style:preserve-3d]">
        {boxes.map((b, i) => (
          <div key={i} className="box3d absolute" style={{ left: b.x, bottom: -b.y, ['--c' as never]: b.c }}>
            <span className="box3d-front">{b.label && <em>{b.label}</em>}</span>
            <span className="box3d-side" />
            <span className="box3d-top" />
          </div>
        ))}
      </div>
      <div className="absolute -bottom-2 left-[-6%] h-6 w-[115%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(5,7,12,0.4),transparent)] blur-[3px]" />
    </div>
  );
}

function LedgerBlock({ n, fresh, pending }: { n: number; fresh?: boolean; pending?: boolean }) {
  const hex = ((n * 2654435761) >>> 0).toString(16).padStart(8, '0');
  return (
    <>
      <span className="h-px w-3 shrink-0 bg-[var(--color-border-strong)]" />
      <span className={cx2('flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 font-plexmono text-[10px] transition-all duration-500', fresh ? 'block-in border-stamp/50 bg-stamp/[0.07] text-stamp' : pending ? 'border-dashed border-[var(--color-border-strong)] text-slate-400' : 'border-paper-rule text-slate-500')}>
        {fresh && <Lock className="size-3" />}#{n} <span className="opacity-60">{hex.slice(0, 4)}…</span>
      </span>
    </>
  );
}

// ------------------------------------------------------------ hero
function Proof({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <li className="flex items-center gap-2 [&>svg]:size-4 [&>svg]:text-stamp">{icon}<span>{children}</span></li>;
}

export function Hero() {
  const { tr, trx } = useTr();
  const section = useRef<HTMLElement>(null);

  // Cursor spotlight on the paper grid.
  useEffect(() => {
    const el = section.current;
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.style.setProperty('--nx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      el.style.setProperty('--ny', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    el.addEventListener('pointermove', move);
    return () => el.removeEventListener('pointermove', move);
  }, []);

  // The floor line follows the TV's foot, whatever the layout.
  useLayoutEffect(() => {
    const el = section.current;
    if (!el) return;
    const place = () => {
      const foot = el.querySelector('[data-tv-foot]');
      if (!foot) return;
      const r = el.getBoundingClientRect(), f = foot.getBoundingClientRect();
      el.style.setProperty('--floor', `${Math.round(f.bottom - r.top - f.height * 0.55)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section ref={section} className="hero-stage hero-room no-rv relative isolate overflow-hidden border-b border-paper-rule">
      {/* the room: wall, window onto the port, skirting, floor */}
      <div aria-hidden className="room-wall absolute inset-0 -z-30" />
      <div aria-hidden className="room-window absolute -z-20 hidden lg:block">
        <img src={PHOTOS.containerStacks.src} alt="" className="room-view absolute inset-[-6%] size-[112%] max-w-none object-cover" />
        <span className="room-sash absolute inset-0" />
      </div>
      <div aria-hidden className="room-floor absolute inset-x-0 bottom-0 -z-20 overflow-hidden"><div className="room-floor-plane" /></div>
      <div aria-hidden className="room-skirting absolute inset-x-0 -z-10" />
      <div aria-hidden className="hero-spot pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-[1680px] grid-cols-1 items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12 lg:px-12 lg:pb-24 lg:pt-14 2xl:px-16">
        <div className="hero-in min-w-0">
          <Link to="/corridors" className="group inline-flex items-center gap-2.5 rounded-full border border-paper-rule bg-paper-card/80 py-1 pl-1 pr-3 text-[12.5px] text-slate-600 shadow-[0_1px_0_var(--color-paper-rule)] backdrop-blur transition-colors hover:border-ink/30">
            <span className="rounded-full bg-ink px-2 py-0.5 font-plexmono text-[10px] uppercase tracking-[0.12em] text-ink-contrast">{tr('Live')}</span>
            {tr('Rwanda · Kenya · Uganda · Tanzania · Burundi')}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <h1 className="mt-6 font-serif text-[44px] font-semibold leading-[1.02] tracking-[-0.025em] sm:text-[60px] xl:text-[68px]">
            {trx('Your container shouldn’t wait at the border for a {typo}.', { typo: <Proofread word={tr('typo')} /> })}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[18px] leading-relaxed text-slate-600">
            {tr('Export documents that are right the first time — and that anyone can prove are real, in seconds, at any border.')}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/register" className="btn-shine group inline-flex h-12 items-center gap-2 rounded-full bg-ink pl-6 pr-5 text-[15px] font-medium text-ink-contrast shadow-[0_14px_30px_-14px_rgba(11,31,58,0.9)]">
              {tr('Start your first shipment')} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/verify" className="inline-flex h-12 items-center gap-2 rounded-full border border-paper-rule bg-paper-card/80 px-6 text-[15px] font-medium text-ink backdrop-blur transition-colors hover:border-ink/40">
              <ScanLine className="size-4" /> {tr('Verify a document')}
            </Link>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] text-slate-600">
            <Proof icon={<ShieldCheck />}>{tr('Verification is always free')}</Proof>
            <Proof icon={<Lock />}>{tr('Trade data never goes on-chain')}</Proof>
            <Proof icon={<Globe2 />}>{tr('English, Français, Kiswahili, Ikinyarwanda')}</Proof>
          </ul>
        </div>
        <div className="drop-in min-w-0">
          <Stage />

        </div>
      </div>
    </section>
  );
}
