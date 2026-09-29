/** Notification bell (top bar) and the full notifications page. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Anchor, Bell, CheckCheck, CheckCircle2, CreditCard, Eye, FileX2, Mail, ScanLine, Stamp, UserPlus } from 'lucide-react';
import { api } from '../api';
import { Card, EmptyState, PageHeader, PageLoader, Tabs, cx } from '../components/ui';
import { relative } from '../format';

export interface Notification {
  id: string;
  type: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  body: string | null;
  link: string | null;
  count: number;
  createdAt: string;
  read: boolean;
}

interface Pref { type: string; label: string; optional: boolean; email: boolean }

const ICON: Record<string, ReactNode> = {
  'document.verified': <ScanLine />,
  'share.viewed': <Eye />,
  'document.anchored': <Anchor />,
  'document.revoked': <FileX2 />,
  'document.tampered': <AlertOctagon />,
  'endorsement.requested': <Stamp />,
  'endorsement.decided': <Stamp />,
  'payment.succeeded': <CreditCard />,
  'team.joined': <UserPlus />,
};
const TONE: Record<Notification['severity'], string> = {
  info: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-navy-200',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  critical: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export function useNotificationCount() {
  return useQuery({ queryKey: ['notifications', 'count'], queryFn: () => api.get<{ unread: number }>('/notifications/count'), refetchInterval: 60_000 });
}

function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { all: true } | { ids: string[] }) => api.post<{ unread: number }>('/notifications/read', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

function Row({ n, compact, onOpen }: { n: Notification; compact?: boolean; onOpen: (n: Notification) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cx('flex w-full gap-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-navy-800/60', compact ? 'px-4 py-3' : 'px-5 py-4', !n.read && 'bg-brand-50/40 dark:bg-navy-800/30')}
    >
      <span className={cx('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4', TONE[n.severity])}>{ICON[n.type] ?? <Bell />}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={cx('text-[13.5px] leading-snug', n.read ? 'text-slate-700 dark:text-slate-300' : 'font-medium text-slate-900 dark:text-white')}>
            {n.title}
            {n.count > 1 && <span className="ml-1.5 rounded-[2px] bg-slate-100 px-1 font-mono text-[10.5px] text-slate-600 dark:bg-navy-800 dark:text-navy-200">×{n.count}</span>}
          </span>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-stamp" aria-label="Unread" />}
        </span>
        {n.body && <span className={cx('mt-0.5 block text-[12.5px] text-slate-500 dark:text-navy-300', compact && 'line-clamp-2')}>{n.body}</span>}
        <span className="mt-1 block text-[11.5px] text-slate-400">{relative(n.createdAt)}</span>
      </span>
    </button>
  );
}

/** Top-bar bell with the latest notifications. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const count = useNotificationCount();
  const list = useQuery({ queryKey: ['notifications', 'latest'], queryFn: () => api.get<{ unread: number; items: Notification[] }>('/notifications?limit=8'), enabled: open });
  const mark = useMarkRead();
  const unread = count.data?.unread ?? 0;

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openItem = (n: Notification) => {
    if (!n.read) mark.mutate({ ids: [n.id] });
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-navy-200 dark:hover:bg-navy-800" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-stamp px-1 text-[10px] font-semibold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[3px] border border-slate-200 bg-white shadow-lg shadow-slate-900/10 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-700">
            <p className="font-serif text-[16px] font-medium">Notifications</p>
            {unread > 0 && <button onClick={() => mark.mutate({ all: true })} className="flex items-center gap-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 dark:text-navy-200"><CheckCheck className="size-3.5" /> Mark all read</button>}
          </div>
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto dark:divide-navy-800">
            {list.isLoading && <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>}
            {list.data?.items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">You’re all caught up.</p>}
            {list.data?.items.map((n) => <Row key={n.id} n={n} compact onOpen={openItem} />)}
          </div>
          <Link to="/app/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-[13px] font-medium hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800">View all notifications</Link>
        </div>
      )}
    </div>
  );
}

/** Full page: all / unread / email settings. */
export function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'all' | 'unread' | 'settings') ?? 'all';
  const navigate = useNavigate();
  const mark = useMarkRead();
  const list = useQuery({ queryKey: ['notifications', 'page', tab], queryFn: () => api.get<{ unread: number; items: Notification[] }>(`/notifications?limit=100${tab === 'unread' ? '&unread=1' : ''}`), enabled: tab !== 'settings' });

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="What happens to your documents after they leave your desk: verifications, share views, anchoring, endorsements and alerts."
        actions={tab !== 'settings' && (list.data?.unread ?? 0) > 0 ? (
          <button onClick={() => mark.mutate({ all: true })} className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-slate-200 bg-white px-3.5 text-[13px] font-medium hover:border-slate-400 dark:border-navy-600 dark:bg-navy-900"><CheckCheck className="size-4" /> Mark all read</button>
        ) : undefined}
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams(t === 'all' ? {} : { tab: t })}
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'unread', label: `Unread${list.data?.unread ? ` (${list.data.unread})` : ''}` },
          { id: 'settings', label: 'Email settings' },
        ]}
      />
      <div className="mt-6">
        {tab === 'settings' ? (
          <EmailSettings />
        ) : list.isLoading ? (
          <PageLoader />
        ) : (
          <Card padded={false}>
            {list.data?.items.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-5" />} title={tab === 'unread' ? 'No unread notifications' : 'Nothing yet'}>
                When buyers, banks or border officers check your documents, you’ll see it here.
              </EmptyState>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-navy-800">
                {list.data?.items.map((n) => (
                  <Row key={n.id} n={n} onOpen={(x) => { if (!x.read) mark.mutate({ ids: [x.id] }); if (x.link) navigate(x.link); }} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function EmailSettings() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ['notification-prefs'], queryFn: () => api.get<Pref[]>('/notifications/prefs') });
  const save = useMutation({
    mutationFn: (p: { type: string; email: boolean }) => api.put<Pref[]>('/notifications/prefs', p),
    onSuccess: (data) => qc.setQueryData(['notification-prefs'], data),
  });
  if (prefs.isLoading || !prefs.data) return <PageLoader />;
  return (
    <Card title="Email me when…" subtitle="Everything always appears in the app. Choose which events also send you an email." padded={false}>
      <ul className="divide-y divide-slate-100 dark:divide-navy-800">
        {prefs.data.map((p) => (
          <li key={p.type} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="flex min-w-0 items-center gap-3">
              <span className="text-slate-500 [&>svg]:size-4">{ICON[p.type] ?? <Mail />}</span>
              <span className="text-[13.5px]">{p.label}</span>
            </span>
            {p.optional ? (
              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={p.email} onChange={(e) => save.mutate({ type: p.type, email: e.target.checked })} aria-label={`Email: ${p.label}`} />
                <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-navy-900 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 dark:bg-navy-700 dark:peer-checked:bg-slate-100" />
                <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4 dark:peer-checked:bg-navy-900" />
              </label>
            ) : (
              <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">Always emailed</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
