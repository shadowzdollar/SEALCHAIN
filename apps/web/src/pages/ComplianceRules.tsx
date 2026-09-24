/** Compliance console: item-by-item rules checklist and managed rule changes. */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, Flag, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { ApiError, api } from '../api';
import { useMeta } from '../auth';
import { Alert, Badge, Button, Card, Field, Modal, PageLoader, cx, type Tone } from '../components/ui';
import { date, relative } from '../format';

type Status = 'open' | 'confirmed' | 'incorrect' | 'recheck';
interface Item {
  key: string;
  area: string;
  corridorId: string | null;
  subject: string;
  claim: string;
  value: string;
  sourceTitle: string;
  sourceUrl?: string;
  howToVerify: string;
  status: Status;
  note: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
}
interface ChecklistResp {
  items: Item[];
  summary: Record<Status, number> & { total: number };
}

const STATUS: Record<Status, { tone: Tone; label: string }> = {
  open: { tone: 'neutral', label: 'To check' },
  confirmed: { tone: 'green', label: 'Confirmed' },
  incorrect: { tone: 'red', label: 'Incorrect' },
  recheck: { tone: 'amber', label: 'Recheck' },
};
const AREAS: Record<string, string> = { threshold: 'Thresholds', tax_id: 'Tax IDs', border: 'Border posts', requirement: 'Permits & documents', tariff: 'Tariff rates', rule_change: 'Rule changes' };

export function Checklist() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['checklist'], queryFn: () => api.get<ChecklistResp>('/admin/checklist') });
  const [area, setArea] = useState('all');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [search, setSearch] = useState('');
  const [flagging, setFlagging] = useState<Item | null>(null);
  const [note, setNote] = useState('');

  const mark = useMutation({
    mutationFn: ({ item, s, n }: { item: Item; s: 'confirmed' | 'incorrect'; n?: string }) => api.put(`/admin/checklist/${encodeURIComponent(item.key)}`, { status: s, note: n }),
    onSuccess: () => {
      setFlagging(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['checklist'] });
    },
  });
  const reopen = useMutation({ mutationFn: (item: Item) => api.del(`/admin/checklist/${encodeURIComponent(item.key)}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }) });

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data?.items ?? []).filter((i) => (area === 'all' || i.area === area) && (status === 'all' || i.status === status) && (!s || `${i.subject} ${i.claim}`.toLowerCase().includes(s)));
  }, [q.data, area, status, search]);

  if (q.isLoading || !q.data) return <PageLoader />;
  const sm = q.data.summary;
  const pct = Math.round((sm.confirmed / sm.total) * 100);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{sm.confirmed} of {sm.total} rules confirmed ({pct}%)</p>
            <p className="mt-0.5 text-xs text-slate-500">{sm.open} to check · {sm.recheck} need rechecking · {sm.incorrect} flagged incorrect</p>
          </div>
          <a href="/api/admin/checklist?format=csv"><Button variant="secondary" size="sm" icon={<Download className="size-3.5" />}>Export CSV</Button></a>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
          <div className="bg-emerald-500" style={{ width: `${(sm.confirmed / sm.total) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(sm.recheck / sm.total) * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${(sm.incorrect / sm.total) * 100}%` }} />
        </div>
        {sm.incorrect > 0 && <Alert tone="error" className="mt-4">{sm.incorrect} rule(s) are flagged incorrect. Traders still see them until the rule data is corrected in a release — fix these first.</Alert>}
      </Card>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center dark:border-navy-700">
          <select className="input md:w-48" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">All areas</option>
            {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input md:w-40" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Any status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search rules" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <ul className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto dark:divide-navy-800">
          {rows.map((i) => (
            <li key={i.key} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
                  <span className="text-xs text-slate-500">{AREAS[i.area]}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{i.subject}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{i.claim}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Check against: {i.sourceUrl ? <a className="underline" href={i.sourceUrl} target="_blank" rel="noreferrer">{i.sourceTitle}</a> : i.sourceTitle}{i.howToVerify !== i.sourceTitle && ` — ${i.howToVerify}`}
                </p>
                {i.checkedBy && <p className={cx('mt-0.5 text-xs', i.status === 'incorrect' ? 'text-red-600' : 'text-slate-500')}>{i.status === 'recheck' ? 'Previously checked' : STATUS[i.status].label} by {i.checkedBy} {relative(i.checkedAt)}{i.note ? ` — “${i.note}”` : ''}</p>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {i.status !== 'confirmed' && <Button size="sm" variant="secondary" icon={<Check className="size-3.5" />} loading={mark.isPending && mark.variables?.item.key === i.key} onClick={() => mark.mutate({ item: i, s: 'confirmed' })}>Confirm</Button>}
                {i.status !== 'incorrect' && <Button size="sm" variant="ghost" icon={<Flag className="size-3.5" />} onClick={() => { setFlagging(i); setNote(''); }}>Flag</Button>}
                {i.status !== 'open' && <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => reopen.mutate(i)} title="Reopen" />}
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No rules match.</li>}
        </ul>
      </Card>

      <Modal
        open={!!flagging}
        onClose={() => setFlagging(null)}
        title="Flag as incorrect"
        footer={<><Button variant="secondary" onClick={() => setFlagging(null)}>Cancel</Button><Button variant="danger" disabled={note.trim().length < 3} loading={mark.isPending} onClick={() => flagging && mark.mutate({ item: flagging, s: 'incorrect', n: note })}>Flag</Button></>}
      >
        <p className="text-sm font-medium">{flagging?.subject}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-navy-300">{flagging?.claim}</p>
        <Field label="What is actually correct? (source, value)" className="mt-4">
          <textarea className="input min-h-24" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </div>
  );
}

interface ChangeRow { id: string; corridor_id: string | null; effective_from: string; title: string; description: string; hs_prefixes: string[]; source_title: string; source_url: string | null; created_by: string; created_at: string }

export function RuleChanges() {
  const qc = useQueryClient();
  const meta = useMeta();
  const q = useQuery({ queryKey: ['rule-changes'], queryFn: () => api.get<ChangeRow[]>('/admin/rule-changes') });
  const [open, setOpen] = useState(false);
  const blank = { corridorId: '', effectiveFrom: new Date().toISOString().slice(0, 10), title: '', description: '', hsPrefixes: '', sourceTitle: '', sourceUrl: '' };
  const [f, setF] = useState(blank);
  const add = useMutation({
    mutationFn: () => api.post('/admin/rule-changes', {
      corridorId: f.corridorId || null, effectiveFrom: f.effectiveFrom, title: f.title, description: f.description,
      hsPrefixes: f.hsPrefixes.split(/[\s,]+/).map((x) => x.replace(/\D/g, '')).filter(Boolean), sourceTitle: f.sourceTitle, sourceUrl: f.sourceUrl || undefined,
    }),
    onSuccess: () => {
      setOpen(false);
      setF(blank);
      void qc.invalidateQueries({ queryKey: ['rule-changes'] });
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/admin/rule-changes/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['rule-changes'] }) });
  if (q.isLoading) return <PageLoader />;
  return (
    <Card
      title="Regulation changes"
      subtitle="Traders whose goods are affected see a warning from 30 days before until 60 days after the effective date."
      action={<Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>Record change</Button>}
      padded={false}
    >
      {(q.data ?? []).length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">No changes recorded yet. Built-in changes (e.g. the 2022 CET review) are part of the rule set.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-navy-800">
          {q.data!.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={c.effective_from > new Date().toISOString().slice(0, 10) ? 'blue' : 'neutral'}>{date(c.effective_from)}</Badge>
                  <span className="text-xs text-slate-500">{c.corridor_id ?? 'All corridors'}{c.hs_prefixes.length ? ` · HS ${c.hs_prefixes.join(', ')}` : ' · all goods'}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{c.title}</p>
                <p className="text-sm text-slate-600 dark:text-navy-300">{c.description}</p>
                <p className="mt-0.5 text-xs text-slate-500">Source: {c.source_url ? <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">{c.source_title}</a> : c.source_title} · recorded by {c.created_by}</p>
              </div>
              <button className="rounded p-1.5 text-slate-400 hover:text-red-600" onClick={() => window.confirm('Delete this change?') && del.mutate(c.id)} aria-label="Delete"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record a regulation change"
        wide
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={add.isPending} disabled={f.title.length < 5 || f.description.length < 10 || f.sourceTitle.length < 3} onClick={() => add.mutate()}>Save</Button></>}
      >
        {add.error && <Alert tone="error" className="mb-3">{add.error instanceof ApiError ? add.error.message : 'Could not save'}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Corridor">
            <select className="input" value={f.corridorId} onChange={(e) => setF({ ...f, corridorId: e.target.value })}>
              <option value="">All corridors</option>
              {meta.data?.corridors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Effective from"><input className="input" type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
          <Field label="Title" className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. KEBS: new conformity requirement for processed foods" /></Field>
          <Field label="What changes for traders" className="sm:col-span-2"><textarea className="input min-h-20" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Affected HS codes (prefixes)" hint="e.g. 0804, 090111 — leave empty for all goods"><input className="input font-mono" value={f.hsPrefixes} onChange={(e) => setF({ ...f, hsPrefixes: e.target.value })} /></Field>
          <Field label="Source"><input className="input" value={f.sourceTitle} onChange={(e) => setF({ ...f, sourceTitle: e.target.value })} placeholder="Gazette / notice reference" /></Field>
          <Field label="Source URL (optional)" className="sm:col-span-2"><input className="input" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} /></Field>
        </div>
      </Modal>
    </Card>
  );
}
