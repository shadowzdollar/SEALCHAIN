/** Public-site chrome: announcement bar, mega-menu header, CTA band, mega footer. */
import { useEffect, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api } from '../api';
import { Logo } from '../components/Layout';
import { cx } from '../components/ui';
import { FOOTER } from './content';
import { msg, useTr } from '../locale';
import { useMarketingMotion } from './motion';
import { Announcement, Header } from './Header';

/** Horizontal page padding shared by every public page. */
export const PAGE_X = 'px-5 sm:px-8 lg:px-12 2xl:px-16';

export const INK_BTN =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[3px] bg-ink px-6 text-[14px] font-medium text-ink-contrast shadow-[0_1px_0_rgba(0,0,0,0.25)] transition-opacity hover:opacity-90';
export const PAPER_BTN =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[3px] border border-paper-rule bg-paper-card px-6 text-[14px] font-medium text-ink shadow-[0_1px_0_rgba(11,31,58,0.06)] transition-colors hover:border-navy-300';

export interface StatusResponse {
  overall: 'operational' | 'degraded' | 'down';
  checkedAt: string;
  components: Array<{ id: string; name: string; state: 'operational' | 'degraded' | 'down' }>;
  anchoring: { backend: string; network: string; lastAnchoredAt: string | null; awaitingAnchor: number };
}

export function useStatus(refetchInterval?: number) {
  return useQuery({ queryKey: ['status'], queryFn: () => api.get<StatusResponse>('/status'), staleTime: 30_000, refetchInterval });
}

export const STATE_LABEL = { operational: msg('All systems operational'), degraded: msg('Some systems degraded'), down: msg('Service disruption') } as const;
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
// ------------------------------------------------------------ CTA band
export function CtaBand() {
  const { tr, trx } = useTr();
  return (
    <section className="border-t border-paper-rule bg-navy-900 text-white">
      <div className="mx-auto grid max-w-[1680px] items-center gap-10 px-5 py-16 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div>
          <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-navy-300">{tr('Ready when your next container is')}</p>
          <h2 className="mt-4 font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[42px]">
            {trx('Ship paperwork that checks out — {em}.', { em: <em className="font-medium text-[#f3b4ad]">{tr('every time')}</em> })}
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-navy-200">{tr('Create your first shipment in minutes, or talk to us about onboarding your cooperative, agency or authority.')}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link to="/register" className="inline-flex h-11 items-center gap-2 rounded-[3px] bg-[#f8f5ee] px-6 text-[14px] font-medium text-[#0b1f3a] hover:bg-[#fffdf8]">{tr('Start a shipment')} <ArrowRight className="size-4" /></Link>
          <Link to="/contact" className="inline-flex h-11 items-center rounded-[3px] border border-white/25 px-6 text-[14px] font-medium text-white hover:bg-white/10">{tr('Talk to us')}</Link>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------- footer
function StatusDot() {
  const q = useStatus();
  const { tr } = useTr();
  const state = q.data?.overall;
  return (
    <Link to="/status" className="inline-flex items-center gap-2 rounded-[3px] border border-paper-rule bg-paper-card px-3 py-1.5 text-[12.5px] text-slate-600 hover:border-navy-300">
      <span className={cx('size-2 rounded-full', state ? STATE_DOT[state] : 'bg-slate-300')} />
      {state ? tr(STATE_LABEL[state]) : tr('Checking status…')}
    </Link>
  );
}

function Footer() {
  const { tr } = useTr();
  return (
    <footer className="bg-paper">
      <div className="mx-auto max-w-[1680px] px-5 pb-10 pt-16 sm:px-8 lg:px-12 2xl:px-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-slate-600">
              {tr('Compliant cross-border trade documents with authenticity anyone can check. Built for EAC traders, starting from Rwanda.')}
            </p>
            <div className="mt-6"><StatusDot /></div>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {FOOTER.map((col) => (
              <div key={col.title}>
                <p className="font-plexmono text-[11px] uppercase tracking-[0.18em] text-slate-500">{tr(col.title)}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}><Link to={l.to} className="text-[14px] text-slate-700 hover:text-ink hover:underline hover:underline-offset-4">{tr(l.label)}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 border-t border-paper-rule pt-6 text-[12.5px] leading-relaxed text-slate-500">
          <p className="max-w-3xl">
            {tr('SealChain proves a document has not changed since issue and who issued it; authority endorsement is shown only where the issuing authority has confirmed it. Rules and tariff rates show when they were last verified. Checks support, and do not replace, your clearing agent and customs.')}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SealChain · Rwanda · Kenya · Uganda · Tanzania · Burundi</p>
            <div className="flex gap-5">
              <Link to="/legal/privacy" className="hover:text-ink">{tr('Privacy')}</Link>
              <Link to="/legal/terms" className="hover:text-ink">{tr('Terms')}</Link>
              <Link to="/security" className="hover:text-ink">{tr('Security')}</Link>
              <Link to="/status" className="hover:text-ink">{tr('Status')}</Link>
              <Link to="/credits" className="hover:text-ink">{tr('Photo credits')}</Link>
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

export function MarketingLayout({ cta = true }: { cta?: boolean }) {
  const { tr } = useTr();
  useMarketingMotion();
  return (
    <div className="marketing min-h-dvh overflow-x-clip bg-paper font-plex text-ink selection:bg-ink selection:text-paper">
      <ScrollManager />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-navy-900 focus:px-3 focus:py-2 focus:text-white">{tr('Skip to content')}</a>
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
