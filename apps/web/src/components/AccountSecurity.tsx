/** Two-step sign-in and active sessions (Team & settings → Security). */
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Laptop, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { ApiError, api } from '../api';
import { Alert, Badge, Button, Card, Field, Modal } from './ui';
import { date, relative } from '../format';

interface TwoFactorStatus { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number }
interface SessionRow { id: string; device: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean }

function RecoveryCodes({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const download = () => {
    const blob = new Blob([`SealChain recovery codes\nEach code works once.\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sealchain-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Modal open onClose={onClose} title="Save your recovery codes" footer={<><Button variant="secondary" onClick={download} icon={<Download className="size-4" />}>Download</Button><Button onClick={onClose}>I saved them</Button></>}>
      <p className="text-sm text-slate-600 dark:text-navy-300">If you lose your phone, each of these codes signs you in once. They are shown only now — store them in a password manager or print them.</p>
      <ol className="mt-4 grid grid-cols-2 gap-2 rounded-[3px] bg-slate-100 p-4 font-mono text-[15px] dark:bg-navy-800">
        {codes.map((c) => <li key={c} className="text-center tracking-wider">{c}</li>)}
      </ol>
    </Modal>
  );
}

export function TwoFactorCard() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['2fa'], queryFn: () => api.get<TwoFactorStatus>('/auth/2fa') });
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'disable' | 'regenerate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['2fa'] });

  const start = useMutation({ mutationFn: () => api.post<{ secret: string; qr: string }>('/auth/2fa/setup', {}), onSuccess: (r) => { setSetup(r); setCode(''); setError(null); } });
  const enable = useMutation({
    mutationFn: () => api.post<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code }),
    onSuccess: (r) => { setSetup(null); setCodes(r.recoveryCodes); void refresh(); void qc.invalidateQueries({ queryKey: ['sessions'] }); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not verify the code'),
  });
  const act = useMutation({
    mutationFn: () => (mode === 'disable' ? api.post('/auth/2fa/disable', { code, password: password || undefined }) : api.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { code })),
    onSuccess: (r) => { if (mode === 'regenerate') setCodes((r as { recoveryCodes: string[] }).recoveryCodes); setMode(null); setCode(''); setPassword(''); void refresh(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not complete that'),
  });

  const s = status.data;
  const submitEnable = (e: FormEvent) => { e.preventDefault(); setError(null); enable.mutate(); };
  const submitAct = (e: FormEvent) => { e.preventDefault(); setError(null); act.mutate(); };

  return (
    <Card
      title={<span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Two-step sign-in</span>}
      subtitle="After your password, confirm with a 6-digit code from an authenticator app such as Google Authenticator, Microsoft Authenticator or Authy."
      action={s && (s.enabled ? <Badge tone="green" dot>On</Badge> : <Badge>Off</Badge>)}
    >
      {!s ? null : s.enabled ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-navy-300">
            On since {date(s.enabledAt)}. {s.recoveryCodesLeft} recovery code{s.recoveryCodesLeft === 1 ? '' : 's'} left.
          </p>
          {s.recoveryCodesLeft <= 3 && <Alert tone="warning">You are running out of recovery codes. Create a new set.</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setMode('regenerate'); setError(null); }}>New recovery codes</Button>
            <Button variant="ghost" size="sm" onClick={() => { setMode('disable'); setError(null); }}>Turn off</Button>
          </div>
        </div>
      ) : setup ? (
        <form onSubmit={submitEnable} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-navy-300">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan this QR code, or type the key.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-5">
            <img src={setup.qr} alt="QR code for your authenticator app" className="size-44 rounded-[3px] border border-slate-200 bg-white p-2" />
            <div className="min-w-0">
              <p className="eyebrow">Setup key</p>
              <p className="mono mt-1 break-all text-[13px]">{setup.secret.match(/.{1,4}/g)?.join(' ')}</p>
            </div>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Code from the app">
            <input className="input w-40 text-center font-mono tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={enable.isPending}>Turn on</Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-navy-300">Recommended for owners: it stops anyone who learns your password from issuing or revoking documents in your name.</p>
          <Button size="sm" loading={start.isPending} onClick={() => start.mutate()} icon={<Smartphone className="size-4" />}>Set up</Button>
        </div>
      )}

      <Modal
        open={!!mode}
        onClose={() => setMode(null)}
        title={mode === 'disable' ? 'Turn off two-step sign-in' : 'Create new recovery codes'}
        footer={<><Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button><Button variant={mode === 'disable' ? 'danger' : 'primary'} loading={act.isPending} onClick={() => act.mutate()}>{mode === 'disable' ? 'Turn off' : 'Create codes'}</Button></>}
      >
        <form onSubmit={submitAct} className="space-y-4">
          {mode === 'regenerate' && <p className="text-sm text-slate-600 dark:text-navy-300">Your old recovery codes stop working.</p>}
          {error && <Alert tone="error">{error}</Alert>}
          {mode === 'disable' && (
            <Field label="Password" hint="Leave empty if you only sign in with Google or Apple.">
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          <Field label="Authenticator or recovery code">
            <input className="input font-mono" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </form>
      </Modal>
      {codes && <RecoveryCodes codes={codes} onClose={() => setCodes(null)} />}
    </Card>
  );
}

export function SessionsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<SessionRow[]>('/auth/sessions') });
  const revoke = useMutation({ mutationFn: (id: string) => api.del(`/auth/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }) });
  const others = useMutation({ mutationFn: () => api.post<{ revoked: number }>('/auth/sessions/revoke-others', {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }) });
  const list = q.data ?? [];
  return (
    <Card
      title={<span className="flex items-center gap-2"><Laptop className="size-4" /> Where you’re signed in</span>}
      subtitle="Sign out any device you don’t recognise, then change your password."
      action={list.length > 1 ? <Button size="sm" variant="secondary" loading={others.isPending} onClick={() => others.mutate()} icon={<LogOut className="size-3.5" />}>Sign out others</Button> : undefined}
      padded={false}
    >
      <ul className="divide-y divide-slate-100 dark:divide-navy-800">
        {list.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="flex min-w-0 items-center gap-3">
              {/Android|iOS/.test(s.device) ? <Smartphone className="size-4 shrink-0 text-slate-400" /> : <Laptop className="size-4 shrink-0 text-slate-400" />}
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.device} {s.current && <Badge tone="green" className="ml-1">This device</Badge>}</span>
                <span className="block text-xs text-slate-500">Active {relative(s.lastSeenAt)} · signed in {date(s.createdAt)}</span>
              </span>
            </span>
            {!s.current && <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>Sign out</Button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
