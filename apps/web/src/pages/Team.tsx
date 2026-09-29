import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Code2, Copy, KeyRound, MessageCircle, Send, Trash2, UserPlus, Webhook } from 'lucide-react';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, PageLoader, Tabs } from '../components/ui';
import { date, relative } from '../format';
import { useSearchParams } from 'react-router';
import { AppleIcon, GoogleIcon } from '../components/OAuthButtons';
import { SessionsCard, TwoFactorCard } from '../components/AccountSecurity';

interface TeamResp {
  members: Array<{ id: string; name: string; email: string; role: 'owner' | 'member' | 'compliance'; createdAt: string }>;
  invites: Array<{ id: string; email: string; role: string; expiresAt: string; createdAt: string }>;
}

export function Team() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['team'], queryFn: () => api.get<TeamResp>('/team') });
  const isOwner = me?.user.role !== 'member';
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'owner'>('member');
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'members' | 'security' | 'integrations'>(params.get('linked') || params.get('oauth_error') ? 'security' : 'members');
  const refresh = () => qc.invalidateQueries({ queryKey: ['team'] });

  const invite = useMutation({
    mutationFn: () => api.post<{ inviteUrl: string; email: string }>('/team/invites', { email, role }),
    onSuccess: (r) => {
      setInviting(false);
      setEmail('');
      setLink({ email: r.email, url: r.inviteUrl });
      void refresh();
    },
  });
  const setMemberRole = useMutation({ mutationFn: ({ id, r }: { id: string; r: string }) => api.put(`/team/members/${id}`, { role: r }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/team/members/${id}`), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: (id: string) => api.del(`/team/invites/${id}`), onSuccess: refresh });
  const err = [setMemberRole.error, remove.error].find(Boolean);

  if (q.isLoading || !q.data) return <PageLoader />;
  return (
    <>
      <PageHeader
        title="Team & settings"
        subtitle={`Members, security and integrations for ${me?.org.name}.`}
        actions={isOwner && <Button icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>Invite</Button>}
      />
      {err && <Alert tone="error" className="mb-4">{err instanceof ApiError ? err.message : 'Action failed'}</Alert>}
      {link && (
        <Alert tone="success" className="mb-4" title={`Invitation sent to ${link.email}`}>
          <p>You can also share the link directly — it works once and expires in 7 days.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => void navigator.clipboard?.writeText(link.url)}>Copy link</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Join ${me?.org.name} on SealChain: ${link.url}`)}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" icon={<MessageCircle className="size-3.5" />}>Share on WhatsApp</Button>
            </a>
          </div>
        </Alert>
      )}
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'members', label: 'Members' },
            { id: 'security', label: 'Security' },
            ...(isOwner ? [{ id: 'integrations' as const, label: 'Integrations' }] : []),
          ]}
        />
      </div>

      {tab === 'members' && (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card title="Members" padded={false}>
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {q.data.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{m.name}{m.id === me?.user.id && <span className="text-slate-400"> (you)</span>}</p>
                    <p className="truncate text-sm text-slate-500">{m.email} · joined {date(m.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner && m.id !== me?.user.id && m.role !== 'compliance' ? (
                      <select className="input h-8 w-28 py-0 text-xs" value={m.role} onChange={(e) => setMemberRole.mutate({ id: m.id, r: e.target.value })}>
                        <option value="member">Member</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      <Badge tone={m.role === 'member' ? 'neutral' : 'brand'}>{m.role}</Badge>
                    )}
                    {isOwner && m.id !== me?.user.id && (
                      <button className="rounded p-1.5 text-slate-400 hover:text-red-600" onClick={() => window.confirm(`Remove ${m.name}? They will be signed out immediately.`) && remove.mutate(m.id)} aria-label="Remove"><Trash2 className="size-4" /></button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {q.data.invites.length > 0 && (
            <Card title="Pending invitations" padded={false}>
              <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                {q.data.invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>{i.email} <Badge>{i.role}</Badge></span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">expires {relative(i.expiresAt).replace(' ago', '')}
                      {isOwner && <button className="text-red-600 hover:underline" onClick={() => cancel.mutate(i.id)}>Cancel</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Roles">
            <ul className="space-y-2 text-sm text-slate-600 dark:text-navy-300">
              <li><span className="font-medium text-slate-900 dark:text-slate-100">Owner</span> — everything, including the team and revoking issued documents.</li>
              <li><span className="font-medium text-slate-900 dark:text-slate-100">Member</span> — create, edit and issue shipments; check documents.</li>
            </ul>
          </Card>
        </div>
      </div>
      )}

      {tab === 'security' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <TwoFactorCard />
            <SessionsCard />
          </div>
          <div className="space-y-6">
            <SignInMethods />
            <ChangePassword />
          </div>
        </div>
      )}

      {tab === 'integrations' && isOwner && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ApiKeys />
          <Webhooks />
        </div>
      )}

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a teammate"
        footer={<><Button variant="secondary" onClick={() => setInviting(false)}>Cancel</Button><Button loading={invite.isPending} disabled={!email.includes('@')} onClick={() => invite.mutate()}>Send invitation</Button></>}
      >
        {invite.error && <Alert tone="error" className="mb-3">{invite.error instanceof ApiError ? invite.error.message : 'Could not invite'}</Alert>}
        <div className="grid gap-3">
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Field label="Role">
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'owner')}>
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
          </Field>
        </div>
      </Modal>
    </>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const change = useMutation({
    mutationFn: () => api.post('/auth/password/change', { current, next }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
    },
  });
  return (
    <Card title="Your password">
      <div className="space-y-3">
        {change.isSuccess && <Alert tone="success">Password changed. Other devices were signed out.</Alert>}
        {change.error && <Alert tone="error">{change.error instanceof ApiError ? change.error.message : 'Could not change password'}</Alert>}
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" hint="At least 10 characters."><input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Button size="sm" variant="secondary" icon={<KeyRound className="size-3.5" />} disabled={!current || next.length < 10} loading={change.isPending} onClick={() => change.mutate()}>Change password</Button>
      </div>
    </Card>
  );
}

function ApiKeys() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['api-keys'], queryFn: () => api.get<Array<{ id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; createdBy: string }>>('/api-keys') });
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<{ key: string }>('/api-keys', { name }),
    onSuccess: (r) => { setSecret(r.key); setName(''); void qc.invalidateQueries({ queryKey: ['api-keys'] }); },
  });
  const revoke = useMutation({ mutationFn: (id: string) => api.del(`/api-keys/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }) });
  return (
    <Card title="API keys" subtitle="Connect your own systems (TMS, ERP). Keys act on behalf of this organisation.">
      <div className="space-y-3">
        {secret && (
          <Alert tone="warning" title="Copy this key now — it will not be shown again">
            <code className="mono mt-1 block break-all">{secret}</code>
            <Button size="sm" variant="secondary" className="mt-2" icon={<Copy className="size-3.5" />} onClick={() => void navigator.clipboard?.writeText(secret)}>Copy</Button>
          </Alert>
        )}
        {(q.data ?? []).map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{k.name}</p>
              <p className="mono text-slate-500">{k.prefix}… · {k.lastUsedAt ? `used ${relative(k.lastUsedAt)}` : 'never used'}</p>
            </div>
            <button className="rounded p-1.5 text-slate-400 hover:text-red-600" onClick={() => window.confirm(`Revoke "${k.name}"? Systems using it stop working immediately.`) && revoke.mutate(k.id)} aria-label="Revoke"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input className="input" placeholder="Key name, e.g. Forwarder TMS" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" variant="secondary" icon={<Code2 className="size-3.5" />} disabled={name.trim().length < 2} loading={create.isPending} onClick={() => create.mutate()}>Create</Button>
        </div>
        <p className="text-xs text-slate-500">Send as <code className="mono">Authorization: Bearer sc_live_…</code>. See docs/API.md.</p>
      </div>
    </Card>
  );
}

function SignInMethods() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const q = useQuery({ queryKey: ['identities'], queryFn: () => api.get<{ hasPassword: boolean; available: Array<'google' | 'apple'>; identities: Array<{ provider: 'google' | 'apple'; email: string | null; lastLoginAt: string | null }> }>('/auth/identities') });
  const unlink = useMutation({ mutationFn: (p: string) => api.del(`/auth/identities/${p}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['identities'] }) });
  if (!q.data || (!q.data.available.length && !q.data.identities.length)) return null;
  const linked = new Map(q.data.identities.map((i) => [i.provider, i]));
  const label = { google: 'Google', apple: 'Apple' } as const;
  return (
    <Card title="Sign-in methods">
      <div className="space-y-3">
        {params.get('linked') && <Alert tone="success">{label[params.get('linked') as 'google']} connected.</Alert>}
        {params.get('oauth_error') && <Alert tone="error">{params.get('oauth_error')}</Alert>}
        {unlink.error && <Alert tone="error">{unlink.error instanceof ApiError ? unlink.error.message : 'Could not disconnect'}</Alert>}
        <p className="text-sm text-slate-600 dark:text-navy-300">Password: {q.data.hasPassword ? 'set' : 'not set — use Forgot password to add one'}</p>
        {(['google', 'apple'] as const).filter((p) => q.data!.available.includes(p) || linked.has(p)).map((p) => {
          const id = linked.get(p);
          return (
            <div key={p} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {p === 'google' ? <GoogleIcon /> : <AppleIcon />}
                <span className="truncate">{id ? id.email ?? label[p] : label[p]}</span>
              </span>
              {id ? (
                <Button size="sm" variant="ghost" loading={unlink.isPending} onClick={() => unlink.mutate(p)}>Disconnect</Button>
              ) : (
                <a href={`/api/auth/oauth/${p}/start?link=1&next=/app/team`}><Button size="sm" variant="secondary">Connect</Button></a>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const EVENTS = ['document.issued', 'document.anchored', 'document.revoked', 'document.tampered', 'endorsement.decided'] as const;

function Webhooks() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['webhooks'], queryFn: () => api.get<Array<{ id: string; url: string; events: string[]; delivered: number; failed: number; lastDeliveryAt: string | null }>>('/webhooks') });
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([...EVENTS]);
  const [secret, setSecret] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['webhooks'] });
  const create = useMutation({
    mutationFn: () => api.post<{ secret: string }>('/webhooks', { url, events }),
    onSuccess: (r) => { setSecret(r.secret); setUrl(''); void refresh(); },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/webhooks/${id}`), onSuccess: refresh });
  const test = useMutation({
    mutationFn: (id: string) => api.post<{ status: string; responseCode: number | null; error: string | null }>(`/webhooks/${id}/test`),
    onSuccess: (r) => { setTestResult(r.status === 'delivered' ? `Delivered (HTTP ${r.responseCode})` : `Not delivered: ${r.error ?? `HTTP ${r.responseCode}`} — will retry`); void refresh(); },
  });
  return (
    <Card title="Webhooks" subtitle="Notify your systems when documents are issued, anchored, revoked, tampered with or endorsed.">
      <div className="space-y-3">
        {secret && (
          <Alert tone="warning" title="Signing secret — copy it now">
            <code className="mono mt-1 block break-all">{secret}</code>
            <p className="mt-1 text-xs">Verify the SealChain-Signature header (HMAC-SHA256 of "timestamp.body"). See docs/API.md.</p>
          </Alert>
        )}
        {testResult && <Alert tone={testResult.startsWith('Delivered') ? 'success' : 'warning'}>{testResult}</Alert>}
        {create.error && <Alert tone="error">{create.error instanceof ApiError ? create.error.message : 'Could not add'}</Alert>}
        {(q.data ?? []).map((w) => (
          <div key={w.id} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="mono min-w-0 truncate">{w.url}</p>
              <div className="flex shrink-0">
                <button className="rounded p-1.5 text-slate-400 hover:text-brand-700" title="Send test event" onClick={() => test.mutate(w.id)}><Send className="size-4" /></button>
                <button className="rounded p-1.5 text-slate-400 hover:text-red-600" title="Delete" onClick={() => window.confirm('Delete this webhook?') && del.mutate(w.id)}><Trash2 className="size-4" /></button>
              </div>
            </div>
            <p className="text-xs text-slate-500">{w.delivered} delivered · {w.failed} failed{w.lastDeliveryAt ? ` · last ${relative(w.lastDeliveryAt)}` : ''}</p>
          </div>
        ))}
        <input className="input" placeholder="https://your-system.example/sealchain" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={events.includes(ev)} onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))} />
              <span className="mono">{ev}</span>
            </label>
          ))}
        </div>
        <Button size="sm" variant="secondary" icon={<Webhook className="size-3.5" />} disabled={!url || !events.length} loading={create.isPending} onClick={() => create.mutate()}>Add webhook</Button>
      </div>
    </Card>
  );
}
