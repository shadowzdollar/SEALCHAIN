import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, HelpCircle, Stamp, XCircle } from 'lucide-react';
import { ApiError, api, type DocSummary, type PublicEndorsement } from '../api';
import { Alert, Badge, Button, Card, Field, Modal, cx, type Tone } from './ui';
import { dateTime, relative } from '../format';
import { useT } from '../i18n';

interface Row { id: string; documentId: string; number: string; version: number; authority: string; status: string; requestNote: string | null; decisionNote: string | null; officer: string | null; decidedAt: string | null; createdAt: string; anchorStatus: string | null }

const TONE: Record<string, Tone> = { pending: 'blue', endorsed: 'green', rejected: 'red', cancelled: 'neutral' };
const LABEL: Record<string, string> = { pending: 'Awaiting authority', endorsed: 'Endorsed', rejected: 'Declined', cancelled: 'Withdrawn' };

/** Exporter side: request and follow issuing-authority endorsement. */
export function EndorsementPanel({ shipmentId, certificate, originCountry }: { shipmentId: string; certificate?: DocSummary; originCountry: string }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['endorsements', shipmentId], queryFn: () => api.get<Row[]>(`/shipments/${shipmentId}/endorsements`), refetchInterval: 30_000 });
  const authorities = useQuery({ queryKey: ['authorities', originCountry], queryFn: () => api.get<Array<{ id: string; name: string }>>(`/authorities?country=${originCountry}`) });
  const [open, setOpen] = useState(false);
  const [authorityId, setAuthorityId] = useState('');
  const [note, setNote] = useState('');
  const request = useMutation({
    mutationFn: () => api.post(`/documents/${certificate!.id}/endorsements`, { authorityId: authorityId || authorities.data?.[0]?.id, note: note || undefined }),
    onSuccess: () => {
      setOpen(false);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['endorsements', shipmentId] });
    },
  });
  const withdraw = useMutation({ mutationFn: (id: string) => api.del(`/endorsements/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['endorsements', shipmentId] }) });

  if (!certificate || (authorities.data ?? []).length === 0) return null;
  const rows = (list.data ?? []).filter((r) => r.status !== 'cancelled');
  const current = rows.filter((r) => r.documentId === certificate.id);
  const canRequest = certificate.status === 'active' && !current.some((r) => r.status === 'pending' || r.status === 'endorsed');

  return (
    <Card
      title="Issuing-authority endorsement"
      subtitle="Anchoring proves the certificate hasn't changed. Endorsement proves the authority agrees with it."
      action={canRequest && <Button size="sm" icon={<Stamp className="size-3.5" />} onClick={() => setOpen(true)}>Request endorsement</Button>}
      padded={rows.length === 0}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Not requested yet for {certificate.number}.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-navy-800">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{r.authority} <span className="mono font-normal text-slate-500">· {r.number}</span></p>
                <p className="text-xs text-slate-500">
                  {r.status === 'pending' ? `Requested ${relative(r.createdAt)}` : `${LABEL[r.status]} by ${r.officer} · ${dateTime(r.decidedAt)}`}
                  {r.status === 'endorsed' && (r.anchorStatus === 'confirmed' ? ' · anchored' : ' · anchoring…')}
                  {r.documentId !== certificate.id && ' · earlier version'}
                </p>
                {r.status === 'rejected' && r.decisionNote && <p className="mt-1 text-sm text-red-700 dark:text-red-400">Reason: {r.decisionNote}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={TONE[r.status] ?? 'neutral'}>{LABEL[r.status] ?? r.status}</Badge>
                {r.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => withdraw.mutate(r.id)}>Withdraw</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Request endorsement of ${certificate.number}`} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={request.isPending} onClick={() => request.mutate()}>Send request</Button></>}>
        {request.error && <Alert tone="error" className="mb-3">{request.error instanceof ApiError ? request.error.message : 'Could not send'}</Alert>}
        <div className="grid gap-3">
          <Field label="Authority">
            <select className="input" value={authorityId || authorities.data?.[0]?.id} onChange={(e) => setAuthorityId(e.target.value)}>
              {authorities.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Note to the officer (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Truck departs Friday morning" /></Field>
          <p className="text-xs text-slate-500">The officer sees the certificate, the goods and SealChain's pre-check. If they endorse it, anyone verifying the certificate sees the endorsement.</p>
        </div>
      </Modal>
    </Card>
  );
}

/** Public side: what verifiers see. */
export function EndorsementsView({ endorsements }: { endorsements: PublicEndorsement[] }) {
  const { t } = useT();
  if (!endorsements.length) {
    return (
      <section className="card flex items-center gap-3 p-5 text-sm text-slate-600 dark:text-navy-300">
        <HelpCircle className="size-5 shrink-0 text-slate-400" />
        {t('notEndorsed')}
      </section>
    );
  }
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Stamp className="size-4 text-brand-700 dark:text-brand-300" /> {t('endorsedTitle')}</h2>
      <ul className="mt-3 space-y-4">
        {endorsements.map((e) => {
          const ok = e.signatureValid && e.matchesDocument;
          return (
            <li key={e.id}>
              <p className="font-medium">{e.authority}</p>
              <p className="text-sm text-slate-600 dark:text-navy-300">{t('signedBy')} {e.officer} · {dateTime(e.decidedAt)}</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <Check ok={ok} label={ok ? t('boundOk') : t('boundBad')} />
                <Check ok={e.anchor.status === 'confirmed' ? e.proofValid : null} label={e.anchor.status === 'confirmed' ? (e.proofValid ? t('anchoredOnChain') : t('anchorInvalid')) : t('anchoring')} />
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <li className={cx('flex items-center gap-1', ok === false && 'text-red-600')}>
      {ok === null ? <HelpCircle className="size-3.5 text-slate-400" /> : ok ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <XCircle className="size-3.5" />}
      {label}
    </li>
  );
}
