import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Me } from '../api';
import { Logo, ThemeToggle } from '../components/Layout';
import { Alert, Button, Field } from '../components/ui';
import { useMeta } from '../auth';
import { cents } from '../format';
import { OAuthButtons } from '../components/OAuthButtons';
import { PHOTOS, type Photo } from '../marketing/photos';

const SHELL_COPY: Record<'default' | 'signup', { eyebrow: string; title: ReactNode }> = {
  default: { eyebrow: 'EAC trade compliance', title: <>Export documents that clear the border — and prove they are <em className="font-medium text-[#f3b4ad]">genuine</em>.</> },
  signup: { eyebrow: 'Join the pilot', title: <>From the hillside to the harbour, paperwork that <em className="font-medium text-[#f3b4ad]">checks out</em>.</> },
};

function Shell({ title, subtitle, children, footer, photo = PHOTOS.portCranes, copy = 'default' }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode; photo?: Photo; copy?: keyof typeof SHELL_COPY }) {
  const c = SHELL_COPY[copy];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <aside className="relative isolate hidden overflow-hidden bg-navy-900 text-white lg:flex lg:flex-col">
        <img src={photo.src} alt={photo.alt} className="absolute inset-0 -z-20 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/65 to-navy-950/35" />
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-44 bg-gradient-to-b from-navy-950/75 to-transparent" />
        <div className="flex items-center justify-between px-12 pt-10">
          <Link to="/"><Logo light /></Link>
          <div className="stamp rotate-[-6deg] !border-white/80 !text-white [box-shadow:none]">Anchored ✓</div>
        </div>
        <div className="mt-auto max-w-xl px-12 pb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-navy-200">{c.eyebrow}</p>
          <h2 className="mt-4 font-serif text-[40px] font-semibold leading-[1.08] tracking-[-0.02em]">{c.title}</h2>
          <ol className="mt-8 grid gap-4 border-t border-white/20 pt-6 text-[14px] xl:grid-cols-3">
            {[
              ['Validated', 'Codes, origin rules, tax IDs and permits checked for your corridor.'],
              ['Sealed', 'Every PDF signed and anchored on a public blockchain.'],
              ['Verifiable', 'Customs, banks and buyers check it in seconds.'],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="font-mono text-[11px] text-[#f3b4ad]">{String(i + 1).padStart(2, '0')}</span>
                <span className="mt-1 block font-serif text-[17px] font-medium">{t}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-navy-100">{d}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex items-center justify-between gap-4 font-mono text-[10.5px] text-white/60">
            <span className="shrink-0 whitespace-nowrap uppercase tracking-[0.18em]">{photo.place || 'Rwanda · Kenya · Uganda · Tanzania · Burundi'}</span>
            <a href={photo.source} target="_blank" rel="noreferrer" className="truncate hover:underline">Photo: {photo.author} · {photo.license}</a>
          </div>
        </div>
      </aside>
      <div className="flex flex-col bg-surface dark:bg-navy-950">
        {/* phones: a strip of the same photograph */}
        <div className="relative h-36 overflow-hidden lg:hidden">
          <img src={photo.sm} alt={photo.alt} className="size-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-navy-950/45" />
          <Link to="/" className="absolute left-5 top-4"><Logo light /></Link>
          <span className="absolute bottom-2 right-3 font-mono text-[9.5px] text-white/75">Photo: {photo.author} · {photo.license}</span>
        </div>
        <header className="flex items-center justify-end px-6 py-5 sm:px-10">
          <ThemeToggle />
        </header>
        <div className="flex flex-1 items-start justify-center px-6 pb-16 sm:pt-6">
          <div className="w-full max-w-[420px]">
            <h1 className="font-serif text-[32px] font-semibold tracking-[-0.02em]">{title}</h1>
            <p className="mt-1.5 text-[14px] text-slate-500 dark:text-navy-300">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <p className="mt-6 text-[13px] text-slate-500 dark:text-navy-300">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('oauth_error'));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me>('/auth/login', { email, password });
      qc.setQueryData(['me'], { user: me.user, org: me.org });
      navigate(params.get('next') || '/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Sign in" subtitle="Welcome back." footer={<>New to SealChain? <Link className="font-medium text-brand-700 hover:underline dark:text-brand-300" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <OAuthButtons next={params.get('next') ?? undefined} />
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={<span className="flex justify-between">Password <Link to="/forgot-password" className="font-normal text-brand-700 hover:underline dark:text-brand-300">Forgot password?</Link></span>}>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const billing = useMeta().data?.billing;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me>('/auth/register', { ...form, country: 'RW' });
      qc.setQueryData(['me'], { user: me.user, org: me.org });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell photo={PHOTOS.teaPicker} copy="signup" title="Join the pilot" subtitle="For exporters, freight forwarders and customs brokers." footer={<>Already have an account? <Link className="font-medium text-brand-700 hover:underline dark:text-brand-300" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <OAuthButtons verb="Sign up" />
        <Field label="Business name" required>
          <input className="input" required minLength={2} value={form.orgName} onChange={set('orgName')} placeholder="e.g. Kigali Fresh Exports Ltd" />
        </Field>
        <Field label="Your name" required>
          <input className="input" required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Work email" required>
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 10 characters." required>
          <input className="input" type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
        {billing && <p className="text-xs text-slate-500">Pilot plan: {cents(billing.monthlyFeeCents)}/month + {cents(billing.perShipmentCents)} per shipment issued. Billed monthly; you can stop any time.</p>}
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>('/auth/password/forgot', { email });
      setSent(r.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell photo={PHOTOS.shipMombasa} title="Reset your password" subtitle="We will email you a link that works for one hour." footer={<Link className="font-medium text-brand-700 hover:underline dark:text-brand-300" to="/login">Back to sign in</Link>}>
      {sent ? (
        <Alert tone="success">{sent}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me>('/auth/password/reset', { token, password });
      qc.setQueryData(['me'], { user: me.user, org: me.org });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell photo={PHOTOS.shipMombasa} title="Choose a new password" subtitle="You will be signed out on every other device." footer={<Link className="font-medium text-brand-700 hover:underline dark:text-brand-300" to="/forgot-password">Request a new link</Link>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="New password" hint="At least 10 characters."><input className="input" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Set password</Button>
      </form>
    </Shell>
  );
}

export function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['invite', token], queryFn: () => api.get<{ email: string; org: string; inviter: string; role: string }>(`/invites/${token}`), retry: false });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me>(`/invites/${token}/accept`, { name, password });
      qc.setQueryData(['me'], { user: me.user, org: me.org });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept the invitation');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell
      photo={PHOTOS.kigaliSkyline}
      title={info.data ? `Join ${info.data.org}` : 'Join your team'}
      subtitle={info.data ? `${info.data.inviter} invited ${info.data.email} as ${info.data.role}.` : 'Accept your invitation to SealChain.'}
      footer={<>Already have an account? <Link className="font-medium text-brand-700 hover:underline dark:text-brand-300" to="/login">Sign in</Link></>}
    >
      {info.isError ? (
        <Alert tone="error">{info.error instanceof ApiError ? info.error.message : 'Invitation not found'}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          {info.data && <OAuthButtons verb="Join" invite={token} />}
          <Field label="Your name"><input className="input" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Choose a password" hint="At least 10 characters."><input className="input" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!info.data}>Join team</Button>
        </form>
      )}
    </Shell>
  );
}

/** Second step for people signing up with Google/Apple: name the business. */
export function SignupComplete() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['oauth-pending', token], queryFn: () => api.get<{ email: string; name: string; providerName: string }>(`/auth/oauth/pending/${token}`), retry: false, enabled: !!token });
  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me & { next: string }>('/auth/oauth/complete', { token, orgName, name: name ?? info.data?.name });
      qc.setQueryData(['me'], { user: me.user, org: me.org });
      navigate(me.next || '/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not finish signing up');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell photo={PHOTOS.teaFields} copy="signup" title="One last step" subtitle={info.data ? `Signed in with ${info.data.providerName} as ${info.data.email}.` : 'Tell us about your business.'} footer={<Link className="font-medium text-brand-700 hover:underline dark:text-brand-300" to="/login">Cancel</Link>}>
      {info.isError || !token ? (
        <Alert tone="error">{info.error instanceof ApiError ? info.error.message : 'This sign-up link is invalid. Please start again.'}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Your name"><input className="input" required minLength={2} value={name ?? info.data?.name ?? ''} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Business name" hint="The exporter, forwarder or brokerage you work for." required>
            <input className="input" required minLength={2} autoFocus value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Kigali Fresh Exports Ltd" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!info.data}>Create my account</Button>
        </form>
      )}
    </Shell>
  );
}
