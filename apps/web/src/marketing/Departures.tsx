/**
 * Corridor section as an airport-style departures board: split-flap rows for
 * each corridor out of Kigali; choosing one sends a truck along the route on
 * the real map and lists the stops and the documents that corridor needs —
 * straight from the rule sets in @sealchain/core.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, FileCheck2, FileText, MapPin } from 'lucide-react';
import { CORRIDORS, DOCUMENT_KIND_LABEL, REQUIREMENTS, localizeRequirement } from '@sealchain/core';
import { cx } from '../components/ui';
import { msg, useTr } from '../locale';
import { SectionHeading } from './Chrome';
import { CorridorMap } from './Illustrations';

const FLAG: Record<string, string> = {
  rw: 'linear-gradient(to bottom, #00a1de 0 50%, #fad201 50% 75%, #20603d 75%)',
  ke: 'linear-gradient(to bottom, #111 0 30%, #fff 30% 35%, #bb0000 35% 65%, #fff 65% 70%, #006600 70%)',
  ug: 'linear-gradient(to bottom, #111 0 16.6%, #fcdc04 16.6% 33.3%, #d90000 33.3% 50%, #111 50% 66.6%, #fcdc04 66.6% 83.3%, #d90000 83.3%)',
  tz: 'linear-gradient(to top right, #1eb53a 0 38%, #fcd116 38% 42%, #111 42% 58%, #fcd116 58% 62%, #00a3dd 62%)',
  bi: 'radial-gradient(circle, #fff 0 22%, transparent 23%), linear-gradient(to bottom right, transparent 45%, #fff 45% 55%, transparent 55%), linear-gradient(to bottom left, transparent 45%, #fff 45% 55%, transparent 55%), conic-gradient(from -45deg, #ce1126 0 90deg, #1eb53a 90deg 180deg, #ce1126 180deg 270deg, #1eb53a 270deg)',
};

const ROUTES: Array<{ id: string; gate: string; dest: string; via: string; km: string; flag: string; stops: string[] }> = [
  { id: 'RW-KE', gate: 'A1', dest: 'MOMBASA', via: 'UGANDA', km: '≈1,700 KM', flag: 'ke', stops: ['Kigali', 'Gatuna · Katuna', 'Kampala', 'Malaba', 'Nairobi', 'Mombasa'] },
  { id: 'RW-UG', gate: 'A2', dest: 'KAMPALA', via: 'GATUNA', km: '≈510 KM', flag: 'ug', stops: ['Kigali', 'Gatuna · Katuna', 'Kampala'] },
  { id: 'RW-TZ', gate: 'B1', dest: 'DAR ES SALAAM', via: 'RUSUMO', km: '≈1,450 KM', flag: 'tz', stops: ['Kigali', 'Rusumo', 'Dar es Salaam'] },
  { id: 'RW-BI', gate: 'B2', dest: 'BUJUMBURA', via: 'AKANYARU', km: '≈320 KM', flag: 'bi', stops: ['Kigali', 'Akanyaru-Haut', 'Bujumbura'] },
];
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Text that settles letter by letter like a split-flap display. */
function Flap({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(text); return; }
    let f = 0;
    const t = window.setInterval(() => {
      f += 1;
      setShown(text.split('').map((ch, i) => (ch === ' ' || f > 3 + i * 1.3 ? ch : CHARS[(Math.random() * CHARS.length) | 0])).join(''));
      if (f > 5 + text.length * 1.3) window.clearInterval(t);
    }, 45);
    return () => window.clearInterval(t);
  }, [text]);
  return (
    <span className={cx('inline-flex gap-[2px]', className)} aria-label={text}>
      {shown.split('').map((ch, i) => (
        <span key={i} aria-hidden className={cx('flap-tile', ch === ' ' && 'opacity-0')}>{ch}</span>
      ))}
    </span>
  );
}

function KigaliClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t); }, []);
  return <>{now.toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali', hour: '2-digit', minute: '2-digit' })}</>;
}

export function DeparturesSection() {
  const { tr } = useTr();
  const [sel, setSel] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = window.setInterval(() => setSel((n) => (n + 1) % ROUTES.length), 7000);
    return () => window.clearInterval(t);
  }, [auto]);
  const pick = (i: number) => { setAuto(false); setSel(i); };

  const r = ROUTES[sel]!;
  const c = CORRIDORS[r.id]!;
  const generated = c.generatedDocuments.map((k) => DOCUMENT_KIND_LABEL[k]);
  const needed = [...c.baseRequirements, ...c.roadRequirements]
    .map((id) => REQUIREMENTS[localizeRequirement(c, id)] ?? REQUIREMENTS[id])
    .filter((q): q is NonNullable<typeof q> => !!q && !q.generated);

  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow={tr('Corridors')} title={tr('Where are your goods going today?')} body={tr('Pick a destination. We’ll show you the road, the border posts — and every document that border expects.')} />

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          {/* departures board + documents */}
          <div className="flex min-w-0 flex-col gap-4">
          <div className="min-w-0 overflow-hidden rounded-3xl bg-[#0b0f18] p-4 text-[#f4c542] shadow-[0_40px_80px_-40px_rgba(11,31,58,0.7)] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="h-5 w-7 rounded-[2px]" style={{ background: FLAG.rw }} />
                <p className="font-plexmono text-[13px] font-semibold uppercase tracking-[0.24em] text-white">{tr('Departures')} · Kigali</p>
              </div>
              <p className="font-plexmono text-[18px] tabular-nums text-[#f4c542]"><KigaliClock /></p>
            </div>
            <div className="mt-3 hidden grid-cols-[2.6rem_minmax(0,1fr)_5.6rem_5.8rem_4.4rem] gap-3 px-3 font-plexmono text-[10px] uppercase tracking-[0.2em] text-white/40 sm:grid">
              <span>{tr('Gate')}</span><span>{tr('Destination')}</span><span>{tr('Via')}</span><span>{tr('Distance')}</span><span className="text-right">{tr('Status')}</span>
            </div>
            <ul className="mt-2 space-y-1.5" role="tablist" aria-label={tr('Corridors')}>
              {ROUTES.map((x, i) => (
                <li key={x.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sel === i}
                    onClick={() => pick(i)}
                    onMouseEnter={() => pick(i)}
                    className={cx('grid w-full grid-cols-[3.2rem_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors sm:grid-cols-[2.6rem_minmax(0,1fr)_5.6rem_5.8rem_4.4rem]', sel === i ? 'bg-white/[0.09] ring-1 ring-[#f4c542]/40' : 'hover:bg-white/[0.05]')}
                  >
                    <span className="font-plexmono text-[14px] text-white/70">{x.gate}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="h-3.5 w-5 shrink-0 rounded-[2px]" style={{ background: FLAG[x.flag] }} />
                      <Flap key={`${x.id}-${sel === i}`} text={x.dest} className="min-w-0 overflow-hidden text-[12px] sm:text-[13.5px]" />
                    </span>
                    <span className="hidden font-plexmono text-[12px] text-white/70 sm:block">{x.via}</span>
                    <span className="hidden font-plexmono text-[12px] text-white/70 sm:block">{x.km}</span>
                    <span className="flex items-center justify-end gap-1.5 font-plexmono text-[11px] font-semibold text-emerald-400"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />{tr('OPEN')}</span>
                  </button>
                </li>
              ))}
            </ul>

            {/* stops */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-plexmono text-[10px] uppercase tracking-[0.2em] text-white/40">{tr('Stops on the way')}</p>
              <ol key={r.id} className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
                {r.stops.map((s, i) => (
                  <li key={s} className="slide-in flex items-center gap-1" style={{ ['--delay' as never]: `${i * 0.08}s` }}>
                    <span className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px]', i === 0 || i === r.stops.length - 1 ? 'bg-[#f4c542] font-semibold text-[#0b0f18]' : s.includes('·') || ['Malaba', 'Rusumo', 'Akanyaru-Haut'].includes(s) ? 'border border-[#f87171]/50 text-[#fca5a5]' : 'border border-white/15 text-white/80')}>
                      <MapPin className="size-3" /> {s}
                    </span>
                    {i < r.stops.length - 1 && <span className="h-px w-3 bg-white/25" />}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[11.5px] text-white/45">{tr('Red stops are border posts. Distances are approximate road distances.')}</p>
            </div>
          </div>

            <div key={r.id} className="preview-in grid gap-4 rounded-3xl border border-paper-rule bg-paper p-5 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 font-plexmono text-[10.5px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400"><FileCheck2 className="size-3.5" /> {tr('We prepare for you')}</p>
                <ul className="mt-2.5 space-y-1.5">{generated.map((d) => <li key={d} className="text-[14px] text-ink">{tr(d)}</li>)}</ul>
              </div>
              <div>
                <p className="flex items-center gap-2 font-plexmono text-[10.5px] uppercase tracking-[0.16em] text-slate-500"><FileText className="size-3.5" /> {tr('Also needed at this border')}</p>
                <ul className="mt-2.5 space-y-1.5">{needed.slice(0, 4).map((q) => <li key={q.id} className="text-[14px] text-slate-600">{q.title}</li>)}</ul>
              </div>
              <Link to={`/corridors#${r.id}`} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink underline-offset-4 hover:underline sm:col-span-2">{tr('Full rules for this corridor')} <ArrowRight className="size-4" /></Link>
            </div>
          </div>

          {/* map */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="relative w-full self-start overflow-hidden rounded-3xl border border-paper-rule bg-paper lg:sticky lg:top-24">
              <CorridorMap highlight={r.id} traveller />
              <span className="absolute left-4 top-4 rounded-full bg-paper-card/90 px-3 py-1 font-plexmono text-[11px] uppercase tracking-[0.16em] text-ink shadow backdrop-blur">{tr(c.name)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const DEPARTURE_STRINGS = [msg('Commercial Invoice'), msg('EAC Certificate of Origin'), msg('Packing List'), msg('EAC Simplified Certificate of Origin (STR)')];
