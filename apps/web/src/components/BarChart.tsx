/**
 * Single-series column chart (one hue, no legend — the card title names it).
 * Columns ≤ 24px with a 4px rounded cap and a square baseline; hairline grid;
 * clean ticks; the latest value labelled at its cap; hover tooltip per column
 * with a full-slot hit target; and an accessible table view.
 */
import { useId, useState } from 'react';
import { cx } from './ui';

export interface BarDatum { key: string; label: string; value: number }

function niceMax(v: number, integer: boolean): { max: number; step: number } {
  if (v <= 0) return { max: 4, step: 1 };
  const rough = v / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  // Counts get whole-number ticks only.
  if (integer) step = Math.max(1, Math.round(step));
  return { max: Math.ceil(v / step) * step, step };
}

const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : Math.abs(n) >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString('en-US'));

export function BarChart({ data, format = (n) => n.toLocaleString('en-US'), height = 220, table, integer }: { data: BarDatum[]; format?: (n: number) => string; height?: number; table?: boolean; integer?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 12, t: 22, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const { max, step } = niceMax(Math.max(...data.map((d) => d.value), 0), !!integer);
  const slot = iw / Math.max(data.length, 1);
  const bw = Math.min(24, slot * 0.6);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const last = data.length - 1;

  if (table) {
    return (
      <table className="table-ent" aria-describedby={id}>
        <thead><tr><th>Month</th><th className="text-right">Value</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td><td className="text-right tabular-nums">{format(d.value)}</td></tr>)}</tbody>
      </table>
    );
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Column chart, ${data.length} months, latest ${data[last] ? format(data[last].value) : 'none'}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-navy-800" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" className="fill-slate-500 font-mono dark:fill-navy-300" fontSize={10.5}>{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx0 = pad.l + slot * i + slot / 2;
          const h = Math.max(0, (d.value / max) * ih);
          const r = Math.min(4, h, bw / 2);
          const x = cx0 - bw / 2;
          const top = pad.t + ih - h;
          // Rounded data-end, square at the baseline.
          const path = h <= 0 ? '' : `M${x},${pad.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + ih} Z`;
          const active = hover === i;
          return (
            <g key={d.key}>
              {path && <path d={path} className={cx('transition-colors', active ? 'fill-navy-900 dark:fill-slate-100' : 'fill-[#2d4468] dark:fill-[#93a6c4]')} />}
              {i === last && d.value > 0 && (
                <text x={cx0} y={top - 6} textAnchor="middle" className="fill-slate-900 font-mono dark:fill-slate-100" fontSize={11} fontWeight={500}>{format(d.value)}</text>
              )}
              {(data.length <= 12 || i % 2 === last % 2) && (
                <text x={cx0} y={H - 9} textAnchor="middle" className="fill-slate-500 dark:fill-navy-300" fontSize={10.5}>{d.label}</text>
              )}
              {/* Hit target: the whole slot, not just the column. */}
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`} />
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[3px] border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] shadow-md dark:border-navy-700 dark:bg-navy-900"
          style={{ left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%`, top: `${(Math.min(y(data[hover].value), pad.t + ih - 4) / H) * 100}%` }}
          role="tooltip"
        >
          <p className="text-slate-500 dark:text-navy-300">{data[hover].label}</p>
          <p className="font-medium tabular-nums">{format(data[hover].value)}</p>
        </div>
      )}
      <p id={id} className="sr-only">Values by month; switch to the table for exact figures.</p>
    </div>
  );
}

/** Horizontal share bars for a ranked list (single hue). */
export function RankBars({ rows, format }: { rows: Array<{ key: string; label: string; sub?: string; value: number }>; format: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium">{r.label}{r.sub && <span className="ml-1.5 font-normal text-slate-500">{r.sub}</span>}</span>
            <span className="shrink-0 tabular-nums text-slate-700 dark:text-slate-300">{format(r.value)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-navy-800">
            <div className="h-full rounded-full bg-[#2d4468] dark:bg-[#93a6c4]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
