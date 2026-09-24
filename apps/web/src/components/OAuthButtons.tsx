import { useMeta } from '../auth';

export function GoogleIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function AppleIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.59 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z" />
    </svg>
  );
}

const LABEL = { google: 'Google', apple: 'Apple' } as const;

/** Full-page navigations to the API's OAuth start endpoint. */
export function OAuthButtons({ verb = 'Continue', next, invite }: { verb?: string; next?: string; invite?: string }) {
  const providers = useMeta().data?.oauthProviders ?? [];
  if (!providers.length) return null;
  const qs = (p: string) => {
    const q = new URLSearchParams();
    if (next) q.set('next', next);
    if (invite) q.set('invite', invite);
    return `/api/auth/oauth/${p}/start${q.size ? `?${q}` : ''}`;
  };
  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <a
          key={p}
          href={qs(p)}
          className={
            p === 'apple'
              ? 'flex h-10 w-full items-center justify-center gap-2 rounded-md bg-black text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200'
              : 'flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-100 dark:hover:bg-navy-800'
          }
        >
          {p === 'google' ? <GoogleIcon /> : <AppleIcon />}
          {verb} with {LABEL[p]}
        </a>
      ))}
      <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-navy-800" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-navy-800" />
      </div>
    </div>
  );
}
