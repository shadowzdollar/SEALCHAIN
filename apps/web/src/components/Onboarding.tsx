/** "Getting started" checklist, computed from what the organisation has actually done. */
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, X } from 'lucide-react';
import { api } from '../api';
import { cx } from './ui';

interface Onboarding {
  steps: Array<{ id: string; title: string; description: string; done: boolean; href: string }>;
  done: number;
  total: number;
  complete: boolean;
  dismissed: boolean;
}

export function OnboardingCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['onboarding'], queryFn: () => api.get<Onboarding>('/onboarding') });
  const dismiss = useMutation({ mutationFn: () => api.post('/onboarding/dismiss', {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }) });
  const o = q.data;
  if (!o || o.complete || o.dismissed) return null;
  const next = o.steps.find((s) => !s.done);
  const pct = Math.round((o.done / o.total) * 100);

  return (
    <section className="card mb-6 overflow-hidden" aria-label="Getting started">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-navy-700">
        <div>
          <p className="eyebrow">Getting started · {o.done} of {o.total}</p>
          <h2 className="mt-1 font-serif text-[20px] font-medium">Set up SealChain for your first consignment</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-40">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800">
              <div className="h-full rounded-full bg-navy-900 transition-all dark:bg-slate-100" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-right font-mono text-[10.5px] text-slate-500">{pct}%</p>
          </div>
          <button onClick={() => dismiss.mutate()} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-800" aria-label="Hide checklist" title="Hide checklist"><X className="size-4" /></button>
        </div>
      </div>
      <ol className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 dark:bg-navy-800">
        {o.steps.map((s, i) => (
          <li key={s.id} className={cx('bg-white dark:bg-navy-900', s.id === next?.id && 'bg-brand-50/50 dark:bg-navy-800/60')}>
            <Link to={s.href} className="group flex h-full gap-3 px-5 py-4">
              <span className={cx('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono', s.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 text-slate-500 dark:border-navy-600')}>
                {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cx('block text-[13.5px] font-medium', s.done && 'text-slate-500 line-through decoration-slate-300 dark:text-navy-300')}>{s.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500 dark:text-navy-300">{s.description}</span>
                {s.id === next?.id && <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium">Start <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
