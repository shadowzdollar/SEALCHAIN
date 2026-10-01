/** Your own profile: details, password, preferences and sign-in security. */
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, CalendarDays, Check, KeyRound, Mail, Moon, Palette, Phone, ShieldCheck, ShieldOff, Sun, UserRound } from 'lucide-react';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { SessionsCard, TwoFactorCard } from '../components/AccountSecurity';
import { useTheme } from '../components/Layout';
import { Alert, Button, PageHeader, PageLoader, cx } from '../components/ui';
import { date } from '../format';
import { LANGS } from '../i18n';
import { useLang } from '../locale';

interface Profile { name: string; email: string; role: string; jobTitle: string | null; phone: string | null; memberSince: string; twoFactor: boolean }

const ROLE: Record<string, string> = { owner: 'Owner', member: 'Member', compliance: 'Compliance', authority: 'Authority officer' };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

export function ProfilePage() {
  const { me } = useAuth();
  const q = useQuery({ queryKey: ['profile'], queryFn: () => api.get<Profile>('/auth/profile') });
  if (q.isLoading || !q.data) return <PageLoader />;
  const p = q.data;
  return (
    <div>
      <PageHeader eyebrow="Account" title="Your profile" subtitle="Your details, password, preferences and how you sign in." />

      {/* identity card */}
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-surface dark:border-navy-700">
        <div aria-hidden className="profile-banner h-28" />
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end sm:px-8">
          <span className="-mt-12 flex size-24 shrink-0 items-center justify-center rounded-3xl border-4 border-surface bg-ink font-serif text-[34px] font-semibold text-ink-contrast shadow-lg">{initials(p.name)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-[28px] font-semibold leading-tight">{p.name}</h2>
            <p className="truncate text-sm text-slate-600 dark:text-navy-200">{p.jobTitle ? `${p.jobTitle} · ` : ''}{me?.org.name}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip icon={<BadgeCheck className="size-3.5" />}>{ROLE[p.role] ?? p.role}</Chip>
            <Chip icon={<CalendarDays className="size-3.5" />}>Since {date(p.memberSince)}</Chip>
            <Chip icon={p.twoFactor ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />} tone={p.twoFactor ? 'good' : 'warn'}>{p.twoFactor ? 'Two-step on' : 'Two-step off'}</Chip>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Details profile={p} />
        <PasswordForm />
        <Preferences />
        <div className="space-y-6">
          <TwoFactorCard />
        </div>
      </div>
      <div className="mt-6"><SessionsCard /></div>
    </div>
  );
}

function Chip({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone?: 'good' | 'warn' }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium', tone === 'good' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : tone === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'border-slate-200 text-slate-600 dark:border-navy-700 dark:text-navy-200')}>{icon}{children}</span>;
}

function Panel({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-surface p-6 dark:border-navy-700">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-ink dark:bg-navy-800">{icon}</span>
        <div><h3 className="font-serif text-[20px] font-semibold">{title}</h3><p className="text-sm text-slate-500">{sub}</p></div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Details({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: profile.name, jobTitle: profile.jobTitle ?? '', phone: profile.phone ?? '' });
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm({ name: profile.name, jobTitle: profile.jobTitle ?? '', phone: profile.phone ?? '' }), [profile]);
  const save = useMutation({
    mutationFn: () => api.put<Profile>('/auth/profile', form),
    onSuccess: (p) => { qc.setQueryData(['profile'], p); void qc.invalidateQueries({ queryKey: ['me'] }); setSaved(true); window.setTimeout(() => setSaved(false), 2500); },
  });
  const dirty = form.name !== profile.name || form.jobTitle !== (profile.jobTitle ?? '') || form.phone !== (profile.phone ?? '');
  return (
    <Panel icon={<UserRound className="size-5" />} title="Your details" sub="How you appear to your team and on activity logs.">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Full name</span><input className="input w-full" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Job title</span><input className="input w-full" maxLength={80} placeholder="e.g. Export manager" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} autoComplete="organization-title" /></label>
          <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium"><Phone className="size-3.5" /> Phone</span><input className="input w-full" maxLength={32} placeholder="+250 788 000 000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} autoComplete="tel" inputMode="tel" /></label>
        </div>
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium"><Mail className="size-3.5" /> Email</span>
          <p className="flex h-9 items-center rounded-md border border-dashed border-slate-300 px-3 text-sm text-slate-600 dark:border-navy-600 dark:text-navy-200">{profile.email}</p>
          <p className="mt-1 text-xs text-slate-500">Your email is how you sign in. To change it, ask your organisation owner or contact support.</p>
        </div>
        {save.isError && <Alert tone="error">{save.error instanceof ApiError ? save.error.message : 'Could not save'}</Alert>}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={save.isPending} disabled={!dirty}>Save details</Button>
          {saved && <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400"><Check className="size-4" /> Saved</span>}
        </div>
      </form>
    </Panel>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

function PasswordForm() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [done, setDone] = useState(false);
  const change = useMutation({
    mutationFn: () => api.post('/auth/password/change', { current: f.current, next: f.next }),
    onSuccess: () => { setDone(true); setF({ current: '', next: '', confirm: '' }); },
  });
  const s = strength(f.next);
  const mismatch = f.confirm.length > 0 && f.confirm !== f.next;
  return (
    <Panel icon={<KeyRound className="size-5" />} title="Password" sub="Changing it signs you out everywhere else.">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); setDone(false); change.mutate(); }} className="space-y-4">
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Current password</span><input type="password" className="input w-full" required autoComplete="current-password" value={f.current} onChange={(e) => setF((x) => ({ ...x, current: e.target.value }))} /></label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">New password</span>
          <input type="password" className="input w-full" required minLength={10} autoComplete="new-password" value={f.next} onChange={(e) => setF((x) => ({ ...x, next: e.target.value }))} />
          <span className="mt-2 flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i < s ? (s >= 3 ? 'bg-emerald-500' : s === 2 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-200 dark:bg-navy-800')} />)}</span>
          <span className="mt-1 block text-xs text-slate-500">{f.next ? ['Too weak', 'Weak', 'Okay', 'Strong', 'Very strong'][s] : 'At least 10 characters. A short sentence works well.'}</span>
        </label>
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium">Confirm new password</span><input type="password" className={cx('input w-full', mismatch && 'border-red-400')} required autoComplete="new-password" value={f.confirm} onChange={(e) => setF((x) => ({ ...x, confirm: e.target.value }))} />{mismatch && <span className="mt-1 block text-xs text-red-600">The passwords don’t match.</span>}</label>
        {change.isError && <Alert tone="error">{change.error instanceof ApiError ? change.error.message : 'Could not change password'}</Alert>}
        {done && <Alert tone="success">Password changed. Other sessions were signed out.</Alert>}
        <Button type="submit" loading={change.isPending} disabled={!f.current || f.next.length < 10 || mismatch || !f.confirm}>Change password</Button>
      </form>
    </Panel>
  );
}

function Preferences() {
  const { lang, setLang } = useLang();
  const { dark, toggle } = useTheme();
  return (
    <Panel icon={<Palette className="size-5" />} title="Preferences" sub="Saved on this device.">
      <p className="text-[13px] font-medium">Language</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LANGS.map((l) => (
          <button key={l.id} type="button" onClick={() => setLang(l.id)} className={cx('rounded-xl border px-3 py-2.5 text-sm transition-colors', lang === l.id ? 'border-ink bg-ink text-ink-contrast' : 'border-slate-200 hover:border-ink dark:border-navy-700')}>{l.label}</button>
        ))}
      </div>
      <p className="mt-5 text-[13px] font-medium">Appearance</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[{ d: false, label: 'Light', icon: <Sun className="size-4" /> }, { d: true, label: 'Dark', icon: <Moon className="size-4" /> }].map((o) => (
          <button key={o.label} type="button" onClick={() => { if (dark !== o.d) toggle(); }} className={cx('flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm transition-colors', dark === o.d ? 'border-ink bg-ink text-ink-contrast' : 'border-slate-200 hover:border-ink dark:border-navy-700')}>{o.icon} {o.label}</button>
        ))}
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Building2 className="size-3.5" /> Company details are under Company profile.</p>
    </Panel>
  );
}
