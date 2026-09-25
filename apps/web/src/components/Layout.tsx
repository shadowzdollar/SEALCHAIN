import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  BookUser,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  ScanLine,
  Search,
  ShieldCheck,
  Stamp,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useAuth, useMeta } from '../auth';
import { cx } from './ui';

/** Circular "S" seal — the same mark as on the printed documents. */
export function LogoMark({ className = 'size-8', light }: { className?: string; light?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full border-[1.5px] font-serif text-[15px] font-semibold leading-none',
        light ? 'border-white text-white' : 'border-navy-900 text-navy-900 dark:border-slate-100 dark:text-slate-100',
        className,
      )}
    >
      S
    </span>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark light={light} />
      <span className={cx('font-serif text-[20px] font-semibold tracking-[-0.01em]', light ? 'text-white' : 'text-navy-900 dark:text-white')}>SealChain</span>
    </span>
  );
}

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('sc-theme');
      if (saved) return saved === 'dark';
    } catch {
      /* storage unavailable */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('sc-theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle} className={cx('rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-navy-300 dark:hover:bg-navy-800 dark:hover:text-white', className)} aria-label="Toggle theme">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function NavItem({ to, icon, children, end }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-3 rounded-md px-3 py-[7px] text-[13px] font-medium transition-colors',
          isActive ? 'bg-white text-navy-900 shadow-[0_1px_2px_rgba(11,31,58,0.06)] ring-1 ring-slate-200 dark:bg-white/10 dark:text-white dark:ring-0' : 'text-slate-600 hover:bg-white/70 hover:text-navy-900 dark:text-navy-200 dark:hover:bg-white/5 dark:hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r bg-stamp" />}
          <span className={cx('[&>svg]:size-[17px]', isActive ? 'text-navy-900 dark:text-slate-100' : 'text-slate-500 group-hover:text-navy-900 dark:text-navy-300 dark:group-hover:text-navy-100')}>{icon}</span>
          {children}
        </>
      )}
    </NavLink>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 pb-1.5 pt-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500 dark:text-navy-400">{label}</p>
      {children}
    </div>
  );
}

/** Network status pill for the top bar. */
export function AnchorChip() {
  const meta = useMeta();
  const a = meta.data?.anchor;
  if (!a) return null;
  const on = a.backend === 'evm';
  return (
    <span className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 md:inline-flex dark:border-navy-700 dark:bg-navy-900 dark:text-navy-200" title={a.contract ?? undefined}>
      <span className="relative flex size-2">
        {on && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cx('relative inline-flex size-2 rounded-full', on ? 'bg-emerald-500' : 'bg-amber-500')} />
      </span>
      {on ? `On-chain · ${a.chainId === 31337 ? 'local network' : a.networkName}` : 'Development ledger'}
    </span>
  );
}

const CRUMB: Record<string, string> = {
  app: 'Home', shipments: 'Shipments', new: 'New shipment', edit: 'Edit', check: 'Check a document', parties: 'Address book',
  team: 'Team & settings', billing: 'Billing', compliance: 'Compliance console', authority: 'Endorsement requests',
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts.map((p, i) => ({
    label: CRUMB[p] ?? (p.startsWith('shp_') ? 'Shipment' : p),
    to: '/' + parts.slice(0, i + 1).join('/'),
  }));
  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={c.to} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-400" />}
          {i === crumbs.length - 1 ? (
            <span className="truncate font-medium text-slate-900 dark:text-white">{c.label}</span>
          ) : (
            <Link to={c.to} className="truncate text-slate-500 hover:text-slate-900 dark:text-navy-300 dark:hover:text-white">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const initials = me?.user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-navy-800" aria-haspopup="menu" aria-expanded={open}>
        <span className="flex size-7 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-navy-900">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-36 truncate text-[13px] font-medium leading-tight text-slate-900 dark:text-white">{me?.user.name}</span>
          <span className="block text-[11px] capitalize leading-tight text-slate-500 dark:text-navy-300">{me?.user.role}</span>
        </span>
        <ChevronDown className="size-3.5 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-[3px] border border-slate-200 bg-white shadow-lg shadow-slate-900/10 dark:border-navy-700 dark:bg-navy-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-navy-700">
            <p className="truncate text-sm font-medium">{me?.user.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-navy-300">{me?.user.email}</p>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-navy-300">{me?.org.name}</p>
          </div>
          <div className="p-1">
            <Link to="/app/team" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] hover:bg-slate-100 dark:hover:bg-navy-800"><Users className="size-4 text-slate-400" /> Team & settings</Link>
            <button onClick={toggle} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] hover:bg-slate-100 dark:hover:bg-navy-800">
              {dark ? <Sun className="size-4 text-slate-400" /> : <Moon className="size-4 text-slate-400" />} {dark ? 'Light theme' : 'Dark theme'}
            </button>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/app/shipments${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };
  return (
    <form onSubmit={submit} className="relative hidden w-72 lg:block" role="search">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shipments, invoices, buyers…" aria-label="Search shipments" className="input h-8 pl-8 text-[13px] dark:bg-navy-900" />
    </form>
  );
}

export function AppLayout() {
  const { me } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);
  const authority = me?.org.kind === 'authority';

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 pb-4">
      {authority ? (
        <Section label="Authority">
          <NavItem to="/app/authority" icon={<Stamp />}>Endorsement requests</NavItem>
          <NavItem to="/app/team" icon={<Users />}>Team & settings</NavItem>
        </Section>
      ) : (
        <>
          <Section label="Operations">
            <NavItem to="/app" end icon={<LayoutDashboard />}>Dashboard</NavItem>
            <NavItem to="/app/shipments" icon={<Package />}>Shipments</NavItem>
            <NavItem to="/app/check" icon={<FileSearch />}>Check a document</NavItem>
          </Section>
          <Section label="Organisation">
            <NavItem to="/app/parties" icon={<BookUser />}>Address book</NavItem>
            <NavItem to="/app/team" icon={<Users />}>Team & settings</NavItem>
            <NavItem to="/app/billing" icon={<CreditCard />}>Billing</NavItem>
          </Section>
          {me?.user.role === 'compliance' && (
            <Section label="Administration">
              <NavItem to="/app/compliance" icon={<ShieldCheck />}>Compliance console</NavItem>
            </Section>
          )}
        </>
      )}
      <Section label="Public">
        <NavItem to="/verify" icon={<ScanLine />}>Verifier</NavItem>
      </Section>
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-slate-100 dark:border-navy-800 dark:bg-navy-950">
      <div className="flex h-14 items-center px-5">
        <Link to="/app"><Logo /></Link>
      </div>
      <div className="mx-3 mb-1 rounded-[2px] border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
        <p className="truncate font-serif text-[14px] font-medium text-navy-900 dark:text-white">{me?.org.name}</p>
        <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 dark:text-navy-300">
          {authority ? 'Issuing authority' : me?.user.role === 'compliance' ? 'Platform administration' : me?.org.plan === 'pilot' ? 'Pilot plan' : `${me?.org.plan} plan`}
        </p>
      </div>
      {nav}
      <div className="border-t border-slate-200 px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:text-navy-400">EAC trade compliance</div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-navy-950/50" />
          <div className="absolute inset-y-0 left-0 w-64" onClick={(e) => e.stopPropagation()}>
            {sidebar}
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded p-1 text-slate-600 dark:text-navy-200" aria-label="Close menu"><X className="size-5" /></button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-surface/90 px-4 backdrop-blur sm:px-6 dark:border-navy-800 dark:bg-navy-950/95">
        <button className="rounded-md p-1.5 hover:bg-slate-100 lg:hidden dark:hover:bg-navy-800" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1"><Breadcrumbs /></div>
        <TopSearch />
        <AnchorChip />
        <UserMenu />
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <Outlet />
      </main>
    </div>
  );
}
