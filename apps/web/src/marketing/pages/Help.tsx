/** Help centre: searchable index and articles. */
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Clock, Lightbulb, Search } from 'lucide-react';
import { cx } from '../../components/ui';
import { CATEGORIES, GUIDES, guideBySlug, type Guide } from '../../help/guides';
import { Eyebrow, INK_BTN, PAGE_X } from '../Chrome';

const text = (g: Guide) => [g.title, g.summary, ...g.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.steps ?? []), s.tip ?? ''])].join(' ').toLowerCase();

export function HelpIndex() {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return null;
    return GUIDES.map((g) => ({ g, t: text(g) }))
      .filter(({ t }) => terms.every((term) => t.includes(term)))
      .map(({ g }) => g);
  }, [q]);

  return (
    <>
      <section className="paper-grid border-b border-paper-rule">
        <div className={cx('mx-auto max-w-3xl pb-16 pt-14 text-center lg:pt-20', PAGE_X)}>
          <Eyebrow>Help centre</Eyebrow>
          <h1 className="mt-5 font-serif text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] sm:text-[52px]">How can we <em className="font-medium text-stamp">help</em>?</h1>
          <label className="relative mx-auto mt-8 block max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: certificate of origin, share, two-step…"
              aria-label="Search the help centre"
              className="block h-14 w-full rounded-[3px] border border-paper-rule bg-paper-card pl-12 pr-4 text-[16px] text-ink shadow-[0_8px_24px_-14px_rgba(11,31,58,0.3)] placeholder:text-slate-400 focus:border-ink focus:outline-none"
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {['certificate of origin', 'share', 'verify', 'two-step', 'invoice', 'payment'].map((x) => (
              <button key={x} type="button" onClick={() => setQ(x)} className={cx('rounded-full border px-3.5 py-1.5 text-[13px] transition-colors', q === x ? 'border-ink bg-ink text-ink-contrast' : 'border-paper-rule bg-paper-card text-slate-600 hover:border-ink/40')}>{x}</button>
            ))}
          </div>
        </div>
      </section>

      <section className={cx('mx-auto max-w-[1680px] py-16', PAGE_X)}>
        {results ? (
          <div className="mx-auto max-w-3xl">
            <p className="font-plexmono text-[12px] uppercase tracking-[0.16em] text-slate-500">{results.length} result{results.length === 1 ? '' : 's'}</p>
            <ul className="mt-4 divide-y divide-paper-rule border-y border-paper-rule">
              {results.map((g) => <GuideRow key={g.slug} g={g} />)}
            </ul>
            {results.length === 0 && <p className="mt-6 text-[15px] text-slate-600">Nothing matched. <Link to="/contact" className="font-medium text-ink underline underline-offset-4">Ask us directly</Link>.</p>}
          </div>
        ) : (
          <div className="grid gap-x-10 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div key={c.id}>
                <div className="border-t-2 border-ink pt-4">
                  <h2 className="font-serif text-[23px] font-medium">{c.title}</h2>
                  <p className="mt-1 text-[14px] text-slate-600">{c.description}</p>
                </div>
                <ul className="mt-4 divide-y divide-paper-rule">
                  {GUIDES.filter((g) => g.category === c.id).map((g) => <GuideRow key={g.slug} g={g} compact />)}
                </ul>
              </div>
            ))}
            <div className="rounded-[3px] border border-paper-rule bg-paper-card p-7">
              <h2 className="font-serif text-[23px] font-medium">Still stuck?</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600">Tell us what you’re trying to do — every message is read by the team building SealChain.</p>
              <Link to="/contact" className={cx(INK_BTN, 'mt-6')}>Contact us <ArrowRight className="size-4" /></Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function GuideRow({ g, compact }: { g: Guide; compact?: boolean }) {
  return (
    <li>
      <Link to={`/help/${g.slug}`} className="group flex items-start justify-between gap-4 py-3.5">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">{g.title}</span>
          {!compact && <span className="mt-0.5 block text-[14px] text-slate-600">{g.summary}</span>}
        </span>
        <span className="shrink-0 font-plexmono text-[11px] text-slate-400">{g.minutes} min</span>
      </Link>
    </li>
  );
}

export function HelpArticle() {
  const { slug = '' } = useParams();
  const g = guideBySlug(slug);
  if (!g) return <Navigate to="/help" replace />;
  const cat = CATEGORIES.find((c) => c.id === g.category)!;
  const siblings = GUIDES.filter((x) => x.category === g.category);
  const i = GUIDES.indexOf(g);
  const next = GUIDES[i + 1];

  return (
    <div className={cx('mx-auto grid max-w-[1680px] gap-12 pb-24 pt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:pt-14', PAGE_X)}>
      <article className="min-w-0 max-w-3xl">
        <Link to="/help" className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-ink"><ArrowLeft className="size-3.5" /> Help centre · {cat.title}</Link>
        <h1 className="mt-5 font-serif text-[38px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">{g.title}</h1>
        <p className="mt-4 text-[18px] leading-relaxed text-slate-600">{g.summary}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 font-plexmono text-[11.5px] uppercase tracking-[0.14em] text-slate-500"><Clock className="size-3.5" /> {g.minutes} min read</p>

        <div className="mt-10 space-y-10 border-t border-paper-rule pt-10">
          {g.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-serif text-[24px] font-medium">{s.heading}</h2>
              {s.body?.map((p) => <p key={p} className="mt-3 text-[16px] leading-relaxed text-slate-700">{p}</p>)}
              {s.steps && (
                <ol className="mt-4 space-y-3">
                  {s.steps.map((st, k) => (
                    <li key={st} className="grid grid-cols-[2rem_minmax(0,1fr)] text-[16px] leading-relaxed text-slate-700">
                      <span className="pt-[3px] font-plexmono text-[13px] text-stamp">{String(k + 1).padStart(2, '0')}</span>
                      <span>{st}</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.tip && (
                <p className="mt-4 flex gap-3 rounded-[3px] border border-paper-rule bg-paper-card p-4 text-[15px] leading-relaxed text-slate-700">
                  <Lightbulb className="mt-0.5 size-5 shrink-0 text-stamp" /> {s.tip}
                </p>
              )}
            </section>
          ))}
        </div>

        {next && (
          <Link to={`/help/${next.slug}`} className="group mt-14 flex items-center justify-between gap-4 rounded-[3px] border border-paper-rule bg-paper-card p-5 hover:border-navy-300">
            <span><span className="font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">Next</span><span className="mt-1 block font-serif text-[19px] font-medium">{next.title}</span></span>
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </article>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">{cat.title}</p>
        <ul className="mt-3 space-y-1 border-l border-paper-rule">
          {siblings.map((x) => (
            <li key={x.slug}>
              <Link to={`/help/${x.slug}`} className={cx('-ml-px block border-l-2 py-1.5 pl-4 text-[14px]', x.slug === g.slug ? 'border-stamp font-medium text-ink' : 'border-transparent text-slate-600 hover:text-ink')}>{x.title}</Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 rounded-[3px] border border-paper-rule bg-paper-card p-5">
          <p className="font-serif text-[18px] font-medium">Need a hand?</p>
          <p className="mt-1 text-[14px] text-slate-600">Our team replies to every message.</p>
          <Link to="/contact" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-4 hover:underline">Contact us <ArrowRight className="size-4" /></Link>
        </div>
      </aside>
    </div>
  );
}
