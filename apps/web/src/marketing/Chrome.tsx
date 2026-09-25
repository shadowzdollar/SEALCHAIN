/** Public-site chrome: announcement bar, mega-menu header, CTA band, mega footer. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Menu as MenuIcon, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Logo } from '../components/Layout';
import { cx } from '../components/ui';
import { FOOTER, MENUS, type Menu } from './content';
import { CorridorMap, QrGlyph, Stamp } from './Illustrations';

/** Horizontal page padding shared by every public page. */
export const PAGE_X = 'px-5 sm:px-8 lg:px-12 2xl:px-16';

export const INK_BTN =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[3px] bg-navy-900 px-6 text-[14px] font-medium text-white shadow-[0_1px_0_rgba(0,0,0,0.25)] transition-colors hover:bg-navy-800';
export const PAPER_BTN =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[3px] border border-paper-rule bg-paper-card px-6 text-[14px] font-medium text-navy-900 shadow-[0_1px_0_rgba(11,31,58,0.06)] transition-colors hover:border-navy-300';

export interface StatusResponse {
  overall: 'operational' | 'degraded' | 'down';
  checkedAt: string;
  components: Array<{ id: string; name: string; state: 'operational' | 'degraded' | 'down' }>;
  anchoring: { backend: string; network: string; lastAnchoredAt: string | null; awaitingAnchor: number };
}

export function useStatus(refetchInterval?: number) {
  return useQuery({ queryKey: ['status'], queryFn: () => api.get<StatusResponse>('/status'), staleTime: 30_000, refetchInterval });
}

export const STATE_LABEL = { operational: 'All systems operational', degraded: 'Some systems degraded', down: 'Service disruption' } as const;
export const STATE_DOT = { operational: 'bg-emerald-600', degraded: 'bg-amber-500', down: 'bg-red-600' } as const;

// ------------------------------------------------------------------ helpers
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:text-[12px] sm:tracking-[0.22em]', className)}>{children}</p>;
}

export function SectionHeading({ eyebrow, title, body, className, center }: { eyebrow?: ReactNode; title: ReactNode; body?: ReactNode; className?: string; center?: boolean }) {
  return (
    <div className={cx('max-w-2xl', center && 'mx-auto text-center', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-4 font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[38px]">{title}</h2>
      {body && <p className="mt-4 text-[16px] leading-relaxed text-slate-600">{body}</p>}
    </div>
  );
}

/** Top-of-page hero used by the inner marketing pages. */
export function PageHero({ eyebrow, title, body, actions, art, grid = true }: { eyebrow: ReactNode; title: ReactNode; body?: ReactNode; actions?: ReactNode; art?: ReactNode; grid?: boolean }) {
  return (
    <section className={cx('border-b border-paper-rule', grid && 'paper-grid')}>
      <div className={cx('mx-auto grid grid-cols-1 max-w-[1680px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:px-12 2xl:px-16 lg:pb-24 lg:pt-20', !!art && 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]')}>
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 font-serif text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] sm:text-[52px]">{title}</h1>
          {body && <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-600">{body}</p>}
          {actions && <div className="mt-9 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {art && <div className="min-w-0">{art}</div>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------- announcement
function Announcement() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('sc-announce') === 'corridors-2026-09';
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <div className="bg-navy-900 text-[13px] text-slate-100">
      <div className="relative mx-auto flex max-w-[1680px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-10 py-2 text-center">
        <span className="hidden rounded-[2px] bg-stamp px-1.5 py-px font-plexmono text-[10.5px] uppercase tracking-[0.12em] text-white sm:inline">New</span>
        <span>Four EAC corridors from Rwanda are open for pilot shipments.</span>
        <Link to="/changelog" className="inline-flex items-center gap-1 font-medium text-white underline-offset-4 hover:underline">What’s new <ArrowRight className="size-3.5" /></Link>
        <button
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem('sc-announce', 'corridors-2026-09');
            } catch {
              /* ignore */
            }
          }}
          className="absolute right-3 rounded p-1 text-navy-300 hover:text-white"
          aria-label="Dismiss announcement"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- mega menu
function FeaturedArt({ art }: { art: Menu['featured']['art'] }) {
  if (art === 'map') return <CorridorMap className="h-32" />;
  if (art === 'verify') return <div className="flex h-32 items-center justify-center gap-4"><QrGlyph className="size-20" /><Stamp className="rotate-[-6deg] scale-90">Authentic</Stamp></div>;
  if (art === 'seal') return <div className="flex h-32 items-center justify-center"><Stamp className="rotate-[-5deg]">Pilot open</Stamp></div>;
  return (
    <pre className="h-32 overflow-hidden rounded-[2px] bg-navy-900 p-3 font-plexmono text-[10.5px] leading-relaxed text-slate-100">
      {`POST /api/shipments\n→ { "id": "shp_…",\n    "validation": { "status": "ready" } }\nPOST /api/shipments/shp_…/issue\n→ 201 Created`}
    </pre>
  );
}

function MegaPanel({ menu, onNavigate }: { menu: Menu; onNavigate: () => void }) {
  return (
    <div className="absolute inset-x-0 top-full border-b border-paper-rule bg-paper-card shadow-[0_24px_40px_-24px_rgba(11,31,58,0.25)]">
      <div className="mx-auto grid max-w-[1680px] gap-10 px-8 py-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className={cx('grid gap-8', menu.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {menu.groups.map((g) => (
            <div key={g.title}>
              <Eyebrow className="!text-[11px] !tracking-[0.18em]">{g.title}</Eyebrow>
              <ul className="mt-3 space-y-1">
                {g.items.map((it) => (
                  <li key={it.label}>
                    <Link to={it.to} onClick={onNavigate} className="group flex gap-3 rounded-[3px] p-2.5 -mx-2.5 transition-colors hover:bg-paper">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[3px] border border-paper-rule bg-paper text-navy-900 group-hover:border-navy-900">
                        <it.icon className="size-4" strokeWidth={1.7} />
                      </span>
                      <span>
                        <span className="block text-[14px] font-medium text-navy-900">{it.label}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{it.desc}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Link to={menu.featured.to} onClick={onNavigate} className="group block rounded-[3px] border border-paper-rule bg-paper p-4 transition-colors hover:border-navy-300">
          <FeaturedArt art={menu.featured.art} />
          <Eyebrow className="mt-4 !text-[10.5px]">{menu.featured.eyebrow}</Eyebrow>
          <p className="mt-1.5 font-serif text-[19px] font-medium text-navy-900">{menu.featured.title}</p>
          <p className="mt-1 text-[13px] leading-snug text-slate-600">{menu.featured.body}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-navy-900">{menu.featured.cta} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></p>
        </Link>
      </div>
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<string | null>(null);
  const { me } = useAuth();
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden">
      <div className="flex h-16 items-center justify-between border-b border-paper-rule px-5">
        <Link to="/" onClick={onClose}><Logo /></Link>
        <button onClick={onClose} className="rounded p-2 text-navy-900" aria-label="Close menu"><X className="size-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-5 py-3">
        {MENUS.map((m) => (
          <div key={m.id} className="border-b border-paper-rule">
            <button onClick={() => setSection((s) => (s === m.id ? null : m.id))} className="flex w-full items-center justify-between py-4 font-serif text-[20px] font-medium text-navy-900" aria-expanded={section === m.id}>
              {m.label} <ChevronDown className={cx('size-5 transition-transform', section === m.id && 'rotate-180')} />
            </button>
            {section === m.id && (
              <ul className="space-y-1 pb-4">
                {m.groups.flatMap((g) => g.items).map((it) => (
                  <li key={it.label}>
                    <Link to={it.to} onClick={onClose} className="flex items-center gap-3 py-2 text-[15px] text-slate-700">
                      <it.icon className="size-4 text-navy-900" strokeWidth={1.7} /> {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <Link to="/pricing" onClick={onClose} className="block border-b border-paper-rule py-4 font-serif text-[20px] font-medium text-navy-900">Pricing</Link>
      </nav>
      <div className="grid gap-3 border-t border-paper-rule p-5">
        {me ? (
          <Link to="/app" onClick={onClose} className={INK_BTN}>Open SealChain</Link>
        ) : (
          <>
            <Link to="/register" onClick={onClose} className={INK_BTN}>Start a shipment</Link>
            <Link to="/login" onClick={onClose} className={PAPER_BTN}>Sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { me } = useAuth();
  const location = useLocation();
  const timer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  // Hover intent: open after a short pause, close after leaving the header.
  const hover = (id: string | null) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(id), id ? 80 : 160);
  };
  const active = MENUS.find((m) => m.id === open);

  return (
    <header ref={ref} className={cx('sticky top-0 z-40 border-b bg-paper/95 backdrop-blur transition-colors', scrolled || open ? 'border-paper-rule' : 'border-transparent')} onMouseLeave={() => hover(null)}>
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12 2xl:px-16">
        <Link to="/" aria-label="SealChain home"><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {MENUS.map((m) => (
            <button
              key={m.id}
              onMouseEnter={() => hover(m.id)}
              onClick={() => setOpen((o) => (o === m.id ? null : m.id))}
              aria-expanded={open === m.id}
              className={cx('flex items-center gap-1 rounded-[3px] px-3 py-2 text-[14px] transition-colors', open === m.id ? 'bg-paper-tint text-navy-900' : 'text-slate-600 hover:text-navy-900')}
            >
              {m.label} <ChevronDown className={cx('size-3.5 transition-transform', open === m.id && 'rotate-180')} />
            </button>
          ))}
          <Link to="/pricing" onMouseEnter={() => hover(null)} className="rounded-[3px] px-3 py-2 text-[14px] text-slate-600 hover:text-navy-900">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/verify" className="hidden px-2 text-[14px] text-slate-600 hover:text-navy-900 xl:block">Verify</Link>
          {me ? (
            <Link to="/app" className="inline-flex h-9 items-center rounded-[3px] bg-navy-900 px-4 text-[13px] font-medium text-white hover:bg-navy-800">Open SealChain</Link>
          ) : (
            <>
              <Link to="/login" className="hidden px-2 text-[14px] font-medium text-navy-900 hover:text-navy-700 sm:block">Sign in</Link>
              <Link to="/register" className="hidden h-9 items-center rounded-[3px] bg-navy-900 px-4 text-[13px] font-medium text-white hover:bg-navy-800 sm:inline-flex">Start a shipment</Link>
            </>
          )}
          <button onClick={() => setMobile(true)} className="rounded p-2 text-navy-900 lg:hidden" aria-label="Open menu"><MenuIcon className="size-5" /></button>
        </div>
      </div>
      {active && (
        <div className="hidden lg:block" onMouseEnter={() => window.clearTimeout(timer.current)}>
          <MegaPanel menu={active} onNavigate={() => setOpen(null)} />
        </div>
      )}
      {/* Portalled: the header's backdrop blur would otherwise trap a fixed overlay. */}
      {mobile && createPortal(<MobileMenu onClose={() => setMobile(false)} />, document.body)}
    </header>
  );
}

// ------------------------------------------------------------ CTA band
export function CtaBand() {
  return (
    <section className="border-t border-paper-rule bg-navy-900 text-white">
      <div className="mx-auto grid max-w-[1680px] items-center gap-10 px-5 py-16 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div>
          <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-navy-300">Ready when your next container is</p>
          <h2 className="mt-4 font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[42px]">
            Ship paperwork that checks out — <em className="font-medium text-[#f3b4ad]">every time</em>.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-navy-200">Create your first shipment in minutes, or talk to us about onboarding your cooperative, agency or authority.</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link to="/register" className="inline-flex h-11 items-center gap-2 rounded-[3px] bg-paper px-6 text-[14px] font-medium text-navy-900 hover:bg-white">Start a shipment <ArrowRight className="size-4" /></Link>
          <Link to="/contact" className="inline-flex h-11 items-center rounded-[3px] border border-white/25 px-6 text-[14px] font-medium text-white hover:bg-white/10">Talk to us</Link>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------- footer
function StatusDot() {
  const q = useStatus();
  const state = q.data?.overall;
  return (
    <Link to="/status" className="inline-flex items-center gap-2 rounded-[3px] border border-paper-rule bg-paper-card px-3 py-1.5 text-[12.5px] text-slate-600 hover:border-navy-300">
      <span className={cx('size-2 rounded-full', state ? STATE_DOT[state] : 'bg-slate-300')} />
      {state ? STATE_LABEL[state] : 'Checking status…'}
    </Link>
  );
}

function Footer() {
  return (
    <footer className="bg-paper">
      <div className="mx-auto max-w-[1680px] px-5 pb-10 pt-16 sm:px-8 lg:px-12 2xl:px-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-slate-600">
              Compliant cross-border trade documents with authenticity anyone can check. Built for EAC traders, starting from Rwanda.
            </p>
            <div className="mt-6"><StatusDot /></div>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {FOOTER.map((col) => (
              <div key={col.title}>
                <p className="font-plexmono text-[11px] uppercase tracking-[0.18em] text-slate-500">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}><Link to={l.to} className="text-[14px] text-slate-700 hover:text-navy-900 hover:underline hover:underline-offset-4">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 border-t border-paper-rule pt-6 text-[12.5px] leading-relaxed text-slate-500">
          <p className="max-w-3xl">
            SealChain proves a document has not changed since issue and who issued it; authority endorsement is shown only where the issuing authority has confirmed it. Rules and tariff rates show when they were last verified. Checks support, and do not replace, your clearing agent and customs.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SealChain · Rwanda · Kenya · Uganda · Tanzania · Burundi</p>
            <div className="flex gap-5">
              <Link to="/legal/privacy" className="hover:text-navy-900">Privacy</Link>
              <Link to="/legal/terms" className="hover:text-navy-900">Terms</Link>
              <Link to="/security" className="hover:text-navy-900">Security</Link>
              <Link to="/status" className="hover:text-navy-900">Status</Link>
              <Link to="/credits" className="hover:text-navy-900">Photo credits</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ------------------------------------------------------------- layout
/** Scroll to the top on navigation, or to the #hash target when present. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/** The public site is printed paper: always light, whatever the app theme. */
function useForceLight() {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);
}

export function MarketingLayout({ cta = true }: { cta?: boolean }) {
  useForceLight();
  return (
    <div className="min-h-dvh overflow-x-clip bg-paper font-plex text-navy-900 selection:bg-navy-900 selection:text-paper">
      <ScrollManager />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-navy-900 focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <Announcement />
      <Header />
      <main id="main">
        <Outlet />
      </main>
      {cta && <CtaBand />}
      <Footer />
    </div>
  );
}
