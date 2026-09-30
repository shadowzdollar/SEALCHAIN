/**
 * Public-site header: live announcement ticker, a bar that condenses into a
 * floating glass capsule on scroll, a gliding hover indicator, animated mega
 * panels, a reading-progress hairline and a ⌘K search palette.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, BookOpen, ChevronDown, CornerDownLeft, Menu as MenuIcon, ScanLine, Search, Tag, X } from 'lucide-react';
import { useAuth } from '../auth';
import { Logo, ThemeToggle } from '../components/Layout';
import { cx } from '../components/ui';
import { GUIDES } from '../help/guides';
import { LanguageSwitcher, msg, useTr } from '../locale';
import { INK_BTN, PAPER_BTN, STATE_DOT, STATE_LABEL, useStatus } from './Chrome';
import { MENUS, type Menu } from './content';
import { CorridorMap, QrGlyph, Stamp } from './Illustrations';

// ------------------------------------------------------- announcement
const NEWS = [
  { text: msg('Four EAC corridors from Rwanda are open for pilot shipments.'), cta: msg('What’s new'), to: '/changelog' },
  { text: msg('Verification is free — scan any SealChain QR code, no account needed.'), cta: msg('Try it'), to: '/verify' },
  { text: msg('SealChain now speaks Français, Kiswahili and Ikinyarwanda.'), cta: msg('Change language'), to: '#lang' },
];
const ANNOUNCE_KEY = 'corridors-2026-09';

export function Announcement() {
  const { tr } = useTr();
  const status = useStatus().data?.overall;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('sc-announce') === ANNOUNCE_KEY; } catch { return false; }
  });
  useEffect(() => {
    if (paused || hidden) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % NEWS.length), 5200);
    return () => window.clearInterval(t);
  }, [paused, hidden]);
  if (hidden) return null;
  return (
    <div className="relative overflow-hidden bg-navy-950 text-[13px] text-slate-100" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div aria-hidden className="announce-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex h-10 max-w-[1680px] items-center gap-4 px-5 sm:px-8 lg:px-12 2xl:px-16">
        <Link to="/status" className="hidden shrink-0 items-center gap-2 font-plexmono text-[11px] uppercase tracking-[0.14em] text-navy-200 hover:text-white md:inline-flex">
          <span className="relative flex size-2">
            <span className={cx('absolute inset-0 animate-ping rounded-full opacity-60', status ? STATE_DOT[status] : 'bg-slate-400')} />
            <span className={cx('relative size-2 rounded-full', status ? STATE_DOT[status] : 'bg-slate-400')} />
          </span>
          {status ? tr(STATE_LABEL[status]) : tr('Checking status…')}
        </Link>
        <span aria-hidden className="hidden h-4 w-px bg-white/15 md:block" />
        <div className="relative h-10 min-w-0 flex-1 overflow-hidden" aria-live="polite">
          {NEWS.map((n, k) => (
            <div
              key={n.text}
              aria-hidden={k !== i}
              className={cx('absolute inset-0 flex items-center justify-center gap-3 transition-all duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] md:justify-start', k === i ? 'translate-y-0 opacity-100' : k === (i + NEWS.length - 1) % NEWS.length ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0')}
            >
              <span className="hidden rounded-full bg-stamp px-2 py-px font-plexmono text-[10px] uppercase tracking-[0.12em] text-white sm:inline">{tr('New')}</span>
              <span className="truncate">{tr(n.text)}</span>
              {n.to === '#lang' ? null : (
                <Link to={n.to} tabIndex={k === i ? 0 : -1} className="group inline-flex shrink-0 items-center gap-1 font-medium text-white">
                  {tr(n.cta)} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-1.5 sm:flex" role="tablist" aria-label={tr('Announcements')}>
          {NEWS.map((n, k) => (
            <button key={n.text} role="tab" aria-selected={k === i} aria-label={`${k + 1}`} onClick={() => setI(k)} className={cx('h-1.5 rounded-full transition-all duration-500', k === i ? 'w-5 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60')} />
          ))}
        </div>
        <button
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem('sc-announce', ANNOUNCE_KEY); } catch { /* ignore */ }
          }}
          className="shrink-0 rounded p-1 text-navy-300 hover:text-white"
          aria-label={tr('Dismiss announcement')}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- mega menu
function FeaturedArt({ art }: { art: Menu['featured']['art'] }) {
  const { tr } = useTr();
  if (art === 'map') return <CorridorMap compact className="h-36" />;
  if (art === 'verify') return <div className="flex h-36 items-center justify-center gap-5"><QrGlyph className="size-20" /><Stamp className="rotate-[-6deg] scale-90">{tr('Authentic')}</Stamp></div>;
  if (art === 'seal') return <div className="flex h-36 items-center justify-center"><Stamp className="rotate-[-5deg]">{tr('Pilot open')}</Stamp></div>;
  return (
    <pre className="h-36 overflow-hidden rounded-lg bg-navy-950 p-4 font-plexmono text-[10.5px] leading-relaxed text-slate-200">
      <span className="text-emerald-300">POST</span> /api/shipments{'\n'}→ {'{'} "id": "shp_…",{'\n'}    "validation": {'{'} "status": <span className="text-amber-200">"ready"</span> {'}'} {'}'}{'\n'}<span className="text-emerald-300">POST</span> /api/shipments/shp_…/issue{'\n'}→ <span className="text-emerald-300">201 Created</span>
    </pre>
  );
}

function MegaPanel({ menu, onNavigate }: { menu: Menu; onNavigate: () => void }) {
  const { tr } = useTr();
  return (
    <div key={menu.id} className="mega-in grid gap-8 p-7 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className={cx('grid gap-7', menu.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {menu.groups.map((g, gi) => (
          <div key={g.title} className="mega-col" style={{ ['--d' as never]: `${gi * 50}ms` }}>
            <p className="px-3 font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{tr(g.title)}</p>
            <ul className="mt-2.5 space-y-0.5">
              {g.items.map((it) => (
                <li key={it.label}>
                  <Link to={it.to} onClick={onNavigate} className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-paper">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-paper-rule bg-paper-card text-ink shadow-[0_1px_0_var(--color-paper-rule)] transition-all group-hover:-translate-y-0.5 group-hover:border-ink group-hover:bg-ink group-hover:text-ink-contrast">
                      <it.icon className="size-4" strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-[14px] font-medium text-ink">
                        {tr(it.label)}
                        <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{tr(it.desc)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link to={menu.featured.to} onClick={onNavigate} className="mega-col group relative flex flex-col overflow-hidden rounded-xl border border-paper-rule bg-paper p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(11,31,58,0.45)]" style={{ ['--d' as never]: '120ms' }}>
        <div className="paper-grid -mx-4 -mt-4 border-b border-paper-rule px-4 pt-4"><FeaturedArt art={menu.featured.art} /></div>
        <p className="mt-4 font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-stamp">{tr(menu.featured.eyebrow)}</p>
        <p className="mt-1.5 font-serif text-[19px] font-medium leading-snug text-ink">{tr(menu.featured.title)}</p>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">{tr(menu.featured.body)}</p>
        <p className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[13px] font-medium text-ink">{tr(menu.featured.cta)} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></p>
      </Link>
    </div>
  );
}

// -------------------------------------------------------- search palette
interface Hit { label: string; desc: string; to: string; group: 'pages' | 'guides'; icon: typeof Search }

function useSearchIndex(): Hit[] {
  const { tr } = useTr();
  return useMemo(() => {
    const seen = new Set<string>();
    const pages: Hit[] = [];
    for (const m of MENUS) for (const g of m.groups) for (const it of g.items) {
      if (seen.has(it.to)) continue;
      seen.add(it.to);
      pages.push({ label: tr(it.label), desc: tr(it.desc), to: it.to, group: 'pages', icon: it.icon });
    }
    pages.push({ label: tr('Pricing'), desc: tr('Plans, per-shipment fees and what’s always free'), to: '/pricing', group: 'pages', icon: Tag });
    pages.push({ label: tr('Verify a document'), desc: tr('Check any SealChain document — free, no account'), to: '/verify', group: 'pages', icon: ScanLine });
    const guides = GUIDES.map<Hit>((g) => ({ label: g.title, desc: g.summary, to: `/help/${g.slug}`, group: 'guides', icon: BookOpen }));
    return [...pages, ...guides];
  }, [tr]);
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const { tr } = useTr();
  const navigate = useNavigate();
  const index = useSearchIndex();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const hits = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = index
      .map((h) => {
        const hay = `${h.label} ${h.desc}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        return { h, score: terms.reduce((s, t) => s + (h.label.toLowerCase().includes(t) ? 2 : 1), 0) };
      })
      .filter((x): x is { h: Hit; score: number } => !!x)
      .sort((a, b) => b.score - a.score || (a.h.group === 'pages' ? -1 : 1));
    return (terms.length ? scored.map((x) => x.h) : index.filter((h) => h.group === 'pages').slice(0, 7).concat(index.filter((h) => h.group === 'guides').slice(0, 4))).slice(0, 12);
  }, [q, index]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const go = (h?: Hit) => { if (!h) return; onClose(); void navigate(h.to); };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[sel]); }
    else if (e.key === 'Escape') onClose();
  };

  let last: Hit['group'] | null = null;
  return (
    <div className="marketing fixed inset-0 z-[60] flex items-start justify-center bg-navy-950/40 px-4 pt-[12vh] font-plex text-ink backdrop-blur-sm palette-fade" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={tr('Search SealChain')} onMouseDown={(e) => e.stopPropagation()} className="palette-in w-full max-w-[640px] overflow-hidden rounded-2xl border border-paper-rule bg-paper-card shadow-[0_40px_80px_-30px_rgba(11,31,58,0.55)]">
        <div className="flex items-center gap-3 border-b border-paper-rule px-5">
          <Search className="size-[18px] text-slate-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={tr('Search pages and help guides…')}
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
            aria-controls="palette-list"
            aria-activedescendant={hits[sel] ? `hit-${sel}` : undefined}
          />
          <kbd className="rounded-md border border-paper-rule px-1.5 py-0.5 font-plexmono text-[11px] text-slate-500">esc</kbd>
        </div>
        <ul id="palette-list" ref={list} role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {hits.length === 0 && <li className="px-4 py-10 text-center text-[14px] text-slate-500">{tr('No results for “{q}”.').replace('{q}', q)}</li>}
          {hits.map((h, k) => {
            const header = h.group !== last ? (last = h.group) : null;
            return (
              <li key={h.to} role="presentation">
                {header && <p className="px-3 pb-1.5 pt-3 font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">{header === 'pages' ? tr('Pages') : tr('Help guides')}</p>}
                <button
                  id={`hit-${k}`}
                  data-i={k}
                  role="option"
                  aria-selected={k === sel}
                  onMouseMove={() => setSel(k)}
                  onClick={() => go(h)}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', k === sel ? 'bg-ink text-ink-contrast' : 'text-ink')}
                >
                  <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-lg border', k === sel ? 'border-white/20' : 'border-paper-rule bg-paper')}><h.icon className="size-4" strokeWidth={1.7} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{h.label}</span>
                    <span className={cx('block truncate text-[12.5px]', k === sel ? 'opacity-70' : 'text-slate-500')}>{h.desc}</span>
                  </span>
                  {k === sel && <CornerDownLeft className="size-4 shrink-0 opacity-70" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-paper-rule bg-paper px-5 py-2.5 text-[11.5px] text-slate-500">
          <span className="flex items-center gap-1.5"><kbd className="rounded border border-paper-rule bg-paper-card px-1 font-plexmono">↑</kbd><kbd className="rounded border border-paper-rule bg-paper-card px-1 font-plexmono">↓</kbd>{tr('to navigate')}</span>
          <span className="flex items-center gap-1.5"><kbd className="rounded border border-paper-rule bg-paper-card px-1 font-plexmono">↵</kbd>{tr('to open')}</span>
          <Link to="/help" onClick={onClose} className="ml-auto font-medium text-ink hover:underline">{tr('Help centre')} →</Link>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ mobile
function MobileMenu({ onClose, onSearch }: { onClose: () => void; onSearch: () => void }) {
  const [section, setSection] = useState<string | null>(null);
  const { me } = useAuth();
  const { tr } = useTr();
  return (
    <div className="marketing mobile-in fixed inset-0 z-50 flex flex-col bg-paper font-plex text-ink lg:hidden">
      <div className="flex h-16 items-center justify-between border-b border-paper-rule px-5">
        <Link to="/" onClick={onClose}><Logo /></Link>
        <button onClick={onClose} className="rounded-full p-2 text-ink hover:bg-paper-tint" aria-label={tr('Close menu')}><X className="size-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-5 py-3">
        <button onClick={() => { onClose(); onSearch(); }} className="my-2 flex h-12 w-full items-center gap-3 rounded-xl border border-paper-rule bg-paper-card px-4 text-[15px] text-slate-500">
          <Search className="size-4" /> {tr('Search pages and help guides…')}
        </button>
        {MENUS.map((m) => (
          <div key={m.id} className="border-b border-paper-rule">
            <button onClick={() => setSection((s) => (s === m.id ? null : m.id))} className="flex w-full items-center justify-between py-4 font-serif text-[20px] font-medium text-ink" aria-expanded={section === m.id}>
              {tr(m.label)} <ChevronDown className={cx('size-5 transition-transform duration-300', section === m.id && 'rotate-180')} />
            </button>
            <div className={cx('grid transition-[grid-template-rows] duration-300', section === m.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <ul className="space-y-1 overflow-hidden">
                {m.groups.flatMap((g) => g.items).map((it) => (
                  <li key={it.label}>
                    <Link to={it.to} onClick={onClose} className="flex items-center gap-3 py-2 text-[15px] text-slate-700 last:pb-4">
                      <span className="flex size-8 items-center justify-center rounded-lg border border-paper-rule bg-paper-card"><it.icon className="size-4 text-ink" strokeWidth={1.7} /></span> {tr(it.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
        <Link to="/pricing" onClick={onClose} className="block border-b border-paper-rule py-4 font-serif text-[20px] font-medium text-ink">{tr('Pricing')}</Link>
        <Link to="/verify" onClick={onClose} className="block border-b border-paper-rule py-4 font-serif text-[20px] font-medium text-ink">{tr('Verify')}</Link>
        <div className="flex items-center justify-between py-4"><span className="text-[14px] text-slate-600">{tr('Language')}</span><LanguageSwitcher /></div>
      </nav>
      <div className="grid gap-3 border-t border-paper-rule p-5">
        {me ? (
          <Link to="/app" onClick={onClose} className={INK_BTN}>{tr('Open SealChain')}</Link>
        ) : (
          <>
            <Link to="/register" onClick={onClose} className={INK_BTN}>{tr('Start a shipment')}</Link>
            <Link to="/login" onClick={onClose} className={PAPER_BTN}>{tr('Sign in')}</Link>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ header
export function Header() {
  const { tr } = useTr();
  const { me } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(null); setMobile(false); setSearch(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.current?.style.setProperty('--progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]');
      if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setOpen(null); setSearch(true); }
    };
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  // Hover intent: open after a short pause, close after leaving the header.
  const hover = (id: string | null) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(id), id ? 70 : 180);
  };
  const glide = (el: HTMLElement | null) => setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  const active = MENUS.find((m) => m.id === open);
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header ref={ref} className="sticky top-0 z-40 h-[72px]" onMouseLeave={() => { hover(null); glide(null); }}>
      <div className={cx('mx-auto transition-[max-width,padding] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]', scrolled || open ? 'max-w-[1360px] px-3 pt-2.5' : 'max-w-[1680px] px-0 pt-0')}>
        <div
          ref={bar}
          className={cx(
            'relative transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]',
            scrolled || open
              ? 'rounded-2xl border border-paper-rule/90 bg-paper-card/80 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_18px_40px_-22px_rgba(11,31,58,0.35)] backdrop-blur-xl backdrop-saturate-150'
              : 'rounded-none border border-transparent bg-transparent',
          )}
        >
          <div className={cx('flex items-center justify-between gap-4 transition-all duration-500', scrolled || open ? 'h-[52px] px-3 sm:px-4' : 'h-[72px] px-5 sm:px-8 lg:px-12 2xl:px-16')}>
            <Link to="/" aria-label={tr('SealChain home')} className="group shrink-0">
              <Logo className="[&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:rotate-[20deg]" />
            </Link>

            <nav ref={nav} className="relative hidden items-center lg:flex" aria-label={tr('Main')}>
              <span
                aria-hidden
                className={cx('absolute top-1/2 h-9 -translate-y-1/2 rounded-full bg-ink/[0.06] transition-all duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] dark:bg-white/10', pill ? 'opacity-100' : 'opacity-0')}
                style={{ left: pill?.x ?? 0, width: pill?.w ?? 0 }}
              />
              {MENUS.map((m) => (
                <button
                  key={m.id}
                  onMouseEnter={(e) => { hover(m.id); glide(e.currentTarget); }}
                  onFocus={(e) => glide(e.currentTarget)}
                  onClick={() => setOpen((o) => (o === m.id ? null : m.id))}
                  aria-expanded={open === m.id}
                  className={cx('relative flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium transition-colors', open === m.id ? 'text-ink' : 'text-slate-600 hover:text-ink')}
                >
                  {tr(m.label)} <ChevronDown className={cx('size-3.5 transition-transform duration-300', open === m.id && 'rotate-180')} />
                </button>
              ))}
              <Link to="/pricing" onMouseEnter={(e) => { hover(null); glide(e.currentTarget); }} className={cx('relative rounded-full px-4 py-2 text-[14px] font-medium transition-colors', location.pathname === '/pricing' ? 'text-ink' : 'text-slate-600 hover:text-ink')}>{tr('Pricing')}</Link>
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => { setOpen(null); setSearch(true); }}
                className="group hidden h-9 items-center gap-2 rounded-full border border-paper-rule bg-paper-card/70 pl-3 pr-1.5 text-[13px] text-slate-500 transition-colors hover:border-ink/40 hover:text-ink md:flex"
                aria-label={tr('Search SealChain')}
              >
                <Search className="size-4" />
                <span className={cx('overflow-hidden whitespace-nowrap transition-all duration-500', scrolled || open ? 'max-w-0 opacity-0' : 'max-w-[80px]')}>{tr('Search')}</span>
                <kbd className="whitespace-nowrap rounded-full border border-paper-rule bg-paper px-2 py-0.5 font-plexmono text-[10.5px]">{mac ? '⌘K' : 'Ctrl K'}</kbd>
              </button>
              <Link to="/verify" className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-ink/[0.06] hover:text-ink xl:inline-flex">
                <ScanLine className="size-4" /> {tr('Verify')}
              </Link>
              <LanguageSwitcher className="hidden sm:block" />
              <ThemeToggle className="rounded-full text-slate-600 hover:bg-ink/[0.06] hover:text-ink dark:text-slate-600 dark:hover:bg-white/10" />
              {me ? (
                <Link to="/app" className="btn-shine inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 text-[13px] font-medium text-ink-contrast">
                  {tr('Open SealChain')} <ArrowRight className="size-3.5" />
                </Link>
              ) : (
                <>
                  <Link to="/login" className="hidden h-9 items-center whitespace-nowrap rounded-full px-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-ink/[0.06] sm:inline-flex">{tr('Sign in')}</Link>
                  <Link to="/register" className="btn-shine group hidden h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink pl-4 pr-3 text-[13px] font-medium text-ink-contrast shadow-[0_6px_16px_-8px_rgba(11,31,58,0.8)] sm:inline-flex">
                    {tr('Start a shipment')} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </>
              )}
              <button onClick={() => setSearch(true)} className="rounded-full p-2 text-ink hover:bg-ink/[0.06] md:hidden" aria-label={tr('Search SealChain')}><Search className="size-5" /></button>
              <button onClick={() => setMobile(true)} className="rounded-full p-2 text-ink hover:bg-ink/[0.06] lg:hidden" aria-label={tr('Open menu')}><MenuIcon className="size-5" /></button>
            </div>
          </div>

          {/* reading progress */}
          <span aria-hidden className={cx('pointer-events-none absolute bottom-0 left-4 right-4 h-[2px] origin-left rounded-full bg-gradient-to-r from-stamp via-stamp to-[#e0654f] transition-opacity duration-500', scrolled && !open ? 'opacity-100' : 'opacity-0')} style={{ transform: 'scaleX(var(--progress, 0))' }} />

          {active && (
            <div className="absolute inset-x-0 top-[calc(100%+10px)] hidden lg:block" onMouseEnter={() => window.clearTimeout(timer.current)}>
              <div className="mx-auto max-w-[1360px] px-3">
                <div className="mega-shell overflow-hidden rounded-2xl border border-paper-rule bg-paper-card shadow-[0_40px_80px_-40px_rgba(11,31,58,0.5)]">
                  <MegaPanel menu={active} onNavigate={() => setOpen(null)} />
                  <div className="flex items-center justify-between border-t border-paper-rule bg-paper/70 px-7 py-3 text-[12.5px] text-slate-500">
                    <span>{tr('Not sure where to start?')} <Link to="/help" onClick={() => setOpen(null)} className="font-medium text-ink hover:underline">{tr('Browse the help centre')}</Link></span>
                    <button onClick={() => { setOpen(null); setSearch(true); }} className="inline-flex items-center gap-2 hover:text-ink"><Search className="size-3.5" /> {tr('Search everything')} <kbd className="rounded border border-paper-rule bg-paper-card px-1.5 font-plexmono text-[10.5px]">{mac ? '⌘K' : 'Ctrl K'}</kbd></button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Portalled: the header's backdrop blur would otherwise trap a fixed overlay. */}
      {mobile && createPortal(<MobileMenu onClose={() => setMobile(false)} onSearch={() => setSearch(true)} />, document.body)}
      {search && createPortal(<SearchPalette onClose={() => setSearch(false)} />, document.body)}
    </header>
  );
}
