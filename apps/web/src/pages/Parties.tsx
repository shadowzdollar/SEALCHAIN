import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookUser, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Party } from '@sealchain/core';
import { api } from '../api';
import { Button, Card, EmptyState, Field, Modal, PageHeader, PageLoader } from '../components/ui';
import { COUNTRY_FLAG, COUNTRY_NAME } from '../format';

interface Saved {
  id: string;
  role: 'exporter' | 'consignee';
  party: Party;
}

const blank = (role: Saved['role']): Saved => ({ id: '', role, party: { name: '', address: '', city: '', country: role === 'exporter' ? 'RW' : 'KE', taxId: '', phone: '', email: '' } });

export function Parties() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['parties'], queryFn: () => api.get<Saved[]>('/parties') });
  const [editing, setEditing] = useState<Saved | null>(null);

  const save = useMutation({
    mutationFn: (s: Saved) => (s.id ? api.put(`/parties/${s.id}`, { role: s.role, party: s.party }) : api.post('/parties', { role: s.role, party: s.party })),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['parties'] });
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/parties/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }) });

  if (q.isLoading) return <PageLoader />;
  const groups = (['exporter', 'consignee'] as const).map((role) => ({ role, rows: (q.data ?? []).filter((p) => p.role === role) }));
  const set = (k: keyof Party, v: string) => setEditing((e) => (e ? { ...e, party: { ...e.party, [k]: v } } : e));

  return (
    <>
      <PageHeader
        title="Address book"
        subtitle="Exporters you ship for and the buyers you ship to. Brokers and forwarders can keep many exporters here."
        actions={
          <>
            <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setEditing(blank('exporter'))}>Exporter</Button>
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing(blank('consignee'))}>Consignee</Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map(({ role, rows }) => (
          <Card key={role} title={role === 'exporter' ? 'Exporters' : 'Consignees'} padded={false}>
            {rows.length === 0 ? (
              <EmptyState icon={<BookUser className="size-5" />} title={`No ${role}s saved`}>Save parties from the shipment editor or add them here.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-navy-800">
                {rows.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-medium">{COUNTRY_FLAG[p.party.country]} {p.party.name}</p>
                      <p className="truncate text-sm text-slate-500">{p.party.address}, {p.party.city}, {COUNTRY_NAME[p.party.country]}</p>
                      {p.party.taxId && <p className="mono text-slate-500">{p.party.taxId}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-800" onClick={() => setEditing(p)} aria-label="Edit"><Pencil className="size-4" /></button>
                      <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => window.confirm(`Remove ${p.party.name}?`) && del.mutate(p.id)} aria-label="Delete"><Trash2 className="size-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit party' : `New ${editing?.role}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={!editing?.party.name} loading={save.isPending} onClick={() => editing && save.mutate(editing)}>Save</Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Legal name" className="sm:col-span-2"><input className="input" value={editing.party.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Street address" className="sm:col-span-2"><input className="input" value={editing.party.address} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="City"><input className="input" value={editing.party.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="Country">
              <select className="input" value={editing.party.country} onChange={(e) => set('country', e.target.value)}>
                {Object.entries(COUNTRY_NAME).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </Field>
            <Field label="Tax ID"><input className="input font-mono" value={editing.party.taxId ?? ''} onChange={(e) => set('taxId', e.target.value.toUpperCase())} /></Field>
            <Field label="Phone"><input className="input" value={editing.party.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Email" className="sm:col-span-2"><input className="input" type="email" value={editing.party.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
