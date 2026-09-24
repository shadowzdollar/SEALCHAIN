import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, BadgeCheck, Copy, Eye, MessageCircle, Share2, X } from 'lucide-react';
import { ApiError, api } from '../api';
import { Alert, Badge, Button, Card, Field, Modal } from './ui';
import { date, relative } from '../format';

interface ShareRow { id: string; label: string; expiresAt: string; revokedAt: string | null; createdAt: string; views: number; downloads: number; lastSeenAt: string | null }

export function SharePanel({ shipmentId, issued }: { shipmentId: string; issued: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['shares', shipmentId], queryFn: () => api.get<ShareRow[]>(`/shipments/${shipmentId}/shares`), enabled: issued });
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(30);
  const [created, setCreated] = useState<{ url: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => api.post<{ url: string; label: string }>(`/shipments/${shipmentId}/shares`, { label, days }),
    onSuccess: (r) => {
      setCreated(r);
      setLabel('');
      void qc.invalidateQueries({ queryKey: ['shares', shipmentId] });
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => api.del(`/shares/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['shares', shipmentId] }) });
  if (!issued) return null;
  const active = (q.data ?? []).filter((s) => !s.revokedAt && s.expiresAt > new Date().toISOString());

  return (
    <Card
      title="Shared with"
      subtitle="Send one link instead of attachments — recipients get every document with live verification."
      action={<Button size="sm" icon={<Share2 className="size-3.5" />} onClick={() => { setOpen(true); setCreated(null); }}>Share documents</Button>}
      padded={active.length === 0}
    >
      {active.length === 0 ? (
        <p className="text-sm text-slate-500">Not shared yet. Create a link for your buyer, their bank or clearing agent.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-navy-800">
          {active.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{s.label}</p>
                <p className="text-xs text-slate-500">
                  {s.views ? <><Eye className="inline size-3" /> opened {s.views}× · {s.downloads} download{s.downloads === 1 ? '' : 's'} · last {relative(s.lastSeenAt)}</> : 'Not opened yet'} · expires {date(s.expiresAt)}
                </p>
              </div>
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => window.confirm(`Withdraw the link shared with ${s.label}?`) && revoke.mutate(s.id)}>Withdraw</Button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={created ? `Link for ${created.label}` : 'Share documents'}
        footer={created ? <Button onClick={() => setOpen(false)}>Done</Button> : <><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} disabled={label.trim().length < 2} onClick={() => create.mutate()}>Create link</Button></>}
      >
        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-navy-300">Anyone with this link can view and download the documents until it expires or you withdraw it. You will see when it is opened.</p>
            <code className="mono block break-all rounded-lg bg-slate-100 p-3 dark:bg-navy-800">{created.url}</code>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => { void navigator.clipboard?.writeText(created.url); setCopied(true); }}>{copied ? 'Copied' : 'Copy link'}</Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Shipment documents (verifiable): ${created.url}`)}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" icon={<MessageCircle className="size-3.5" />}>Send on WhatsApp</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {create.error && <Alert tone="error">{create.error instanceof ApiError ? create.error.message : 'Could not create the link'}</Alert>}
            <Field label="Who is it for?" hint="Shown in your activity feed when they open it."><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Savannah Roasters — buying team" autoFocus /></Field>
            <Field label="Valid for">
              <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[7, 14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}

interface Activity { at: string; type: 'verification' | 'share'; shipmentId: string; reference: string; text: string; alert: boolean }

export function ActivityFeed({ shipmentId, limit = 12, title = 'Recent activity' }: { shipmentId?: string; limit?: number; title?: string }) {
  const q = useQuery({
    queryKey: ['activity', shipmentId ?? 'all'],
    queryFn: () => api.get<Activity[]>(`/activity?limit=${limit}${shipmentId ? `&shipmentId=${shipmentId}` : ''}`),
    refetchInterval: 30_000,
  });
  // Collapse repeated identical events (e.g. one document checked several times) into one row.
  const rows = (q.data ?? []).reduce<Array<Activity & { count: number }>>((acc, e) => {
    const same = acc.find((a) => a.text === e.text && a.shipmentId === e.shipmentId);
    if (same) same.count++;
    else acc.push({ ...e, count: 1 });
    return acc;
  }, []);
  return (
    <Card title={title} subtitle="When buyers, banks or border officers open or verify your documents." padded={rows.length === 0}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing yet. Activity appears when someone scans a QR code, verifies a file or opens a shared link.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-navy-800">
          {rows.map((e, i) => (
            <li key={i} className="flex gap-3 px-5 py-2.5 text-sm">
              {e.alert ? <AlertOctagon className="mt-0.5 size-4 shrink-0 text-red-600" /> : e.type === 'verification' ? <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Eye className="mt-0.5 size-4 shrink-0 text-sky-600" />}
              <div className="min-w-0 flex-1">
                <p className={e.alert ? 'font-medium text-red-700 dark:text-red-400' : ''}>{e.text}{e.count > 1 && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-navy-800 dark:text-navy-200">×{e.count}</span>}</p>
                <p className="text-xs text-slate-500">
                  {!shipmentId && <><Link to={`/app/shipments/${e.shipmentId}`} className="hover:underline">{e.reference}</Link> · </>}
                  {e.count > 1 ? `latest ${relative(e.at)}` : relative(e.at)}
                </p>
              </div>
              {e.alert && <Badge tone="red">Alert</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
