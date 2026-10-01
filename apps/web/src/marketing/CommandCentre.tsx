/**
 * ⌘K command centre: one box that searches pages and guides, looks up HS codes
 * with the real tariff classifier, answers corridor questions and runs quick
 * actions — with a live preview pane for whatever is selected.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Check, Clock3, Copy, CornerDownLeft, Globe2, Hash, Languages, Map as MapIcon, ScanLine, Search, Sparkles, Tag, Truck, type LucideIcon } from 'lucide-react';
import { CORRIDORS, LocalCatalogClassifier, formatHs, type TariffLine } from '@sealchain/core';
import { cx } from '../components/ui';
import { GUIDES } from '../help/guides';
import { LANGS } from '../i18n';
import { msg, useLang, useTr } from '../locale';
import { MENUS } from './content';
import { CorridorMap } from './Illustrations';

type Group = 'actions' | 'pages' | 'hs' | 'corridors' | 'guides' | 'recent';
interface Hit {
  id: string;
  group: Group;
  label: string;
  desc: string;
  icon: LucideIcon;
  to?: string;
  run?: () => void;
  hs?: TariffLine;
  corridor?: string;
  keep?: boolean; // stays open after running (e.g. copy)
}

const classifier = new LocalCatalogClassifier();
const RECENT_KEY = 'sc-palette-recent';
const readRecent = (): Array<{ label: string; to: string }> => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; } };
const CORRIDOR_WORDS: Record<string, string[]> = {
  'RW-KE': ['kenya', 'nairobi', 'mombasa', 'malaba', 'busia', 'kra'],
  'RW-UG': ['uganda', 'kampala', 'katuna', 'gatuna', 'mirama', 'ura'],
  'RW-TZ': ['tanzania', 'dar', 'dar es salaam', 'rusumo', 'tra'],
  'RW-BI': ['burundi', 'bujumbura', 'akanyaru', 'nemba', 'obr'],
};
const TABS: Array<{ id: 'all' | Group; label: string }> = [
  { id: 'all', label: msg('All') }, { id: 'pages', label: msg('Pages') }, { id: 'hs', label: msg('HS codes') }, { id: 'corridors', label: msg('Corridors') }, { id: 'guides', label: msg('Help guides') },
];
const GROUP_LABEL: Record<Group, string> = { actions: msg('Quick actions'), pages: msg('Pages'), hs: msg('HS codes'), corridors: msg('Corridors'), guides: msg('Help guides'), recent: msg('Recent') };
const EXAMPLES = ['coffee', 'Kenya', 'avocado', 'verify', 'pricing', 'tea'];

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const { tr } = useTr();
  const { lang, setLang } = useLang();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | Group>('all');
  const [sel, setSel] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const pages = useMemo<Hit[]>(() => {
    const seen = new Set<string>();
    const out: Hit[] = [];
    for (const m of MENUS) for (const g of m.groups) for (const it of g.items) {
      if (seen.has(it.to)) continue;
      seen.add(it.to);
      out.push({ id: `p:${it.to}`, group: 'pages', label: tr(it.label), desc: tr(it.desc), to: it.to, icon: it.icon });
    }
    out.push({ id: 'p:/pricing', group: 'pages', label: tr('Pricing'), desc: tr('Plans, per-shipment fees and what’s always free'), to: '/pricing', icon: Tag });
    return out;
  }, [tr]);
  const guides = useMemo<Hit[]>(() => GUIDES.map((g) => ({ id: `g:${g.slug}`, group: 'guides', label: g.title, desc: g.summary, to: `/help/${g.slug}`, icon: BookOpen })), []);
  const corridors = useMemo<Hit[]>(() => Object.values(CORRIDORS).map((c) => ({
    id: `c:${c.id}`, group: 'corridors', label: tr(c.name), corridor: c.id, icon: MapIcon, to: `/corridors#${c.id}`,
    desc: `${tr('Exit')}: ${(c.exitPoints.road ?? []).join(', ')} · ${tr('Entry')}: ${(c.entryPoints.road ?? []).join(', ')}`,
  })), [tr]);
  const actions = useMemo<Hit[]>(() => [
    { id: 'a:ship', group: 'actions', label: tr('Start a new shipment'), desc: tr('Create an account and prepare your first documents'), to: '/register', icon: Truck },
    { id: 'a:verify', group: 'actions', label: tr('Verify a document'), desc: tr('Scan a QR code or drop a file — free, no account'), to: '/verify', icon: ScanLine },
    ...LANGS.filter((l) => l.id !== lang).map<Hit>((l) => ({ id: `a:lang:${l.id}`, group: 'actions', label: `${tr('Switch language to')} ${l.label}`, desc: tr('Change the language of the whole site'), icon: Languages, run: () => setLang(l.id) })),
  ], [tr, lang, setLang]);

  const hits = useMemo<Hit[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      const recent = readRecent().map<Hit>((r) => ({ id: `r:${r.to}`, group: 'recent', label: r.label, desc: r.to, to: r.to, icon: Clock3 }));
      const base = tab === 'all' ? [...recent.slice(0, 3), ...actions.slice(0, 2), ...pages.slice(0, 5), ...corridors] : tab === 'pages' ? pages : tab === 'corridors' ? corridors : tab === 'guides' ? guides : [];
      return base;
    }
    const terms = query.split(/\s+/);
    const match = (h: Hit) => terms.every((t) => `${h.label} ${h.desc}`.toLowerCase().includes(t));
    const hs: Hit[] = classifier.classifySync(query, 6).map((s) => ({
      id: `h:${s.line.code}`, group: 'hs', hs: s.line, icon: Hash, keep: true,
      label: `${formatHs(s.line.code)} · ${s.line.description}`,
      desc: `${tr('EAC duty')} ${s.line.cetRate}% · ${tr('unit')} ${s.line.unit}`,
      run: () => { void navigator.clipboard?.writeText(formatHs(s.line.code)).catch(() => undefined); setCopied(s.line.code); },
    }));
    const cor = corridors.filter((c) => match(c) || CORRIDOR_WORDS[c.corridor!]!.some((w) => w.startsWith(query) || query.includes(w)));
    const groups: Record<Group, Hit[]> = {
      actions: actions.filter(match), pages: pages.filter(match), hs, corridors: cor, guides: guides.filter(match), recent: [],
    };
    if (tab !== 'all') return groups[tab].slice(0, 20);
    return [...groups.actions.slice(0, 3), ...groups.corridors.slice(0, 2), ...groups.hs.slice(0, 4), ...groups.pages.slice(0, 5), ...groups.guides.slice(0, 4)];
  }, [q, tab, actions, pages, corridors, guides, tr]);

  useEffect(() => { setSel(0); setCopied(null); }, [q, tab]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const run = (h?: Hit) => {
    if (!h) return;
    if (h.run) { h.run(); if (!h.keep) onClose(); return; }
    if (h.to) {
      try {
        const next = [{ label: h.label, to: h.to }, ...readRecent().filter((r) => r.to !== h.to)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      onClose();
      void navigate(h.to);
    }
  };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(hits[sel]); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const i = TABS.findIndex((t) => t.id === tab);
      setTab(TABS[(i + (e.shiftKey ? TABS.length - 1 : 1)) % TABS.length]!.id);
    } else if (e.key === 'Escape') onClose();
  };

  const cur = hits[sel];
  let last: Group | null = null;
  return (
    <div className="marketing fixed inset-0 z-[60] flex items-start justify-center bg-navy-950/45 px-3 pt-[8vh] font-plex text-ink backdrop-blur-md palette-fade sm:px-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={tr('Search SealChain')} onMouseDown={(e) => e.stopPropagation()} className="palette-in palette-glow relative w-full max-w-[880px] overflow-hidden rounded-[22px] border border-paper-rule bg-paper-card shadow-[0_50px_100px_-30px_rgba(11,31,58,0.6)]">
        {/* search field */}
        <div className="flex items-center gap-3 px-5">
          <Sparkles className="size-[18px] text-stamp" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={tr('Search pages, HS codes, corridors, guides…')}
            className="h-16 min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-slate-400"
            aria-controls="palette-list"
            aria-activedescendant={cur ? `hit-${sel}` : undefined}
          />
          {q && <button type="button" onClick={() => { setQ(''); input.current?.focus(); }} className="rounded-md px-2 py-1 text-[12px] text-slate-500 hover:bg-paper">{tr('Clear')}</button>}
          <kbd className="hidden rounded-md border border-paper-rule px-1.5 py-0.5 font-plexmono text-[11px] text-slate-500 sm:block">esc</kbd>
        </div>
        {/* tabs */}
        <div className="flex gap-1 overflow-x-auto border-y border-paper-rule bg-paper/60 px-3 py-2" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); input.current?.focus(); }} className={cx('shrink-0 rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors', tab === t.id ? 'bg-ink text-ink-contrast' : 'text-slate-600 hover:bg-paper-tint')}>
              {tr(t.label)}
            </button>
          ))}
          <span className="ml-auto hidden items-center gap-1 self-center pr-1 text-[11px] text-slate-400 sm:flex"><kbd className="rounded border border-paper-rule px-1 font-plexmono">tab</kbd> {tr('to switch')}</span>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
          <ul id="palette-list" ref={list} role="listbox" className="max-h-[56vh] min-h-[320px] overflow-y-auto p-2">
            {hits.length === 0 && (
              <li className="px-4 py-12 text-center">
                <p className="text-[14px] text-slate-500">{q ? tr('No results for “{q}”.').replace('{q}', q) : tr('Type to search for HS codes and guides.')}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => setQ(x)} className="rounded-full border border-paper-rule bg-paper px-3 py-1 text-[12.5px] text-slate-600 hover:border-ink/40">{x}</button>)}
                </div>
              </li>
            )}
            {hits.map((h, k) => {
              const header = h.group !== last ? (last = h.group) : null;
              const on = k === sel;
              return (
                <li key={h.id} role="presentation">
                  {header && <p className="px-3 pb-1.5 pt-3 font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{tr(GROUP_LABEL[header])}</p>}
                  <button
                    id={`hit-${k}`}
                    data-i={k}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => setSel(k)}
                    onClick={() => run(h)}
                    className={cx('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', on ? 'bg-ink text-ink-contrast' : 'text-ink')}
                  >
                    <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-lg border', on ? 'border-white/20' : 'border-paper-rule bg-paper', h.group === 'hs' && !on && 'text-stamp')}><h.icon className="size-4" strokeWidth={1.7} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{h.label}</span>
                      <span className={cx('block truncate text-[12.5px]', on ? 'opacity-70' : 'text-slate-500')}>{h.desc}</span>
                    </span>
                    {on && (h.group === 'hs' ? (copied === h.hs?.code ? <Check className="size-4 shrink-0" /> : <Copy className="size-4 shrink-0 opacity-70" />) : <CornerDownLeft className="size-4 shrink-0 opacity-70" />)}
                  </button>
                </li>
              );
            })}
          </ul>
          <Preview hit={cur} copied={!!cur?.hs && copied === cur.hs.code} onRun={() => run(cur)} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-paper-rule bg-paper px-5 py-2.5 text-[11.5px] text-slate-500">
          <span className="flex items-center gap-1.5"><kbd className="rounded border border-paper-rule bg-paper-card px-1 font-plexmono">↑</kbd><kbd className="rounded border border-paper-rule bg-paper-card px-1 font-plexmono">↓</kbd>{tr('to navigate')}</span>
          <span className="flex items-center gap-1.5"><kbd className="rounded border border-paper-rule bg-paper-card px-1 font-plexmono">↵</kbd>{tr('to open')}</span>
          <span className="hidden items-center gap-1.5 sm:flex"><Hash className="size-3" /> {tr('Enter on an HS code copies it')}</span>
          <Link to="/help" onClick={onClose} className="ml-auto font-medium text-ink hover:underline">{tr('Help centre')} →</Link>
        </div>
      </div>
    </div>
  );
}

function Preview({ hit, copied, onRun }: { hit?: Hit; copied: boolean; onRun: () => void }) {
  const { tr } = useTr();
  if (!hit) return <aside className="hidden border-l border-paper-rule bg-paper/50 md:block" />;
  return (
    <aside key={hit.id} className="preview-in hidden flex-col border-l border-paper-rule bg-paper/50 p-5 md:flex">
      {hit.hs ? (
        <>
          <p className="font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{tr('HS code')}</p>
          <p className="mt-2 font-plexmono text-[30px] font-medium tracking-[0.02em] text-ink">{formatHs(hit.hs.code)}</p>
          <p className="mt-2 text-[14px] leading-snug text-ink">{hit.hs.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-paper-rule bg-paper-card p-3"><p className="text-[11px] text-slate-500">{tr('EAC duty')}</p><p className="font-serif text-[22px] font-semibold">{hit.hs.cetRate}%</p></div>
            <div className="rounded-xl border border-paper-rule bg-paper-card p-3"><p className="text-[11px] text-slate-500">{tr('Unit')}</p><p className="font-serif text-[22px] font-semibold">{hit.hs.unit}</p></div>
          </div>
          {hit.hs.sensitive && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-300">{tr('On the EAC Sensitive List')}</p>}
          {hit.hs.note && <p className="mt-3 text-[12px] leading-snug text-slate-500">{hit.hs.note}</p>}
          <button type="button" onClick={onRun} className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-ink-contrast">
            {copied ? <><Check className="size-4" /> {tr('Copied')}</> : <><Copy className="size-4" /> {tr('Copy code')}</>}
          </button>
          <p className="mt-2 text-center text-[10.5px] text-slate-400">{tr('Indicative — confirm with your clearing agent')}</p>
        </>
      ) : hit.corridor ? (
        <>
          <p className="font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{tr('Corridor')}</p>
          <p className="mt-2 font-serif text-[22px] font-semibold">{hit.label}</p>
          <CorridorMap compact highlight={hit.corridor} className="mt-3 rounded-xl border border-paper-rule bg-paper-card" />
          <p className="mt-3 text-[12.5px] leading-snug text-slate-600">{hit.desc}</p>
          <button type="button" onClick={onRun} className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-ink-contrast">{tr('See this corridor')} <ArrowRight className="size-4" /></button>
        </>
      ) : (
        <>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-ink text-ink-contrast"><hit.icon className="size-7" strokeWidth={1.6} /></span>
          <p className="mt-4 font-serif text-[21px] font-semibold leading-snug">{hit.label}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{hit.desc}</p>
          <p className="mt-3 font-plexmono text-[10.5px] uppercase tracking-[0.16em] text-slate-400">{tr(GROUP_LABEL[hit.group])}</p>
          <button type="button" onClick={onRun} className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-ink-contrast">
            {hit.run ? <><Globe2 className="size-4" /> {tr('Run')}</> : <>{tr('Open')} <ArrowRight className="size-4" /></>}
          </button>
        </>
      )}
    </aside>
  );
}
