/** Company profile: details printed on documents, shipment defaults, invoice numbering. */
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Hash, SlidersHorizontal } from 'lucide-react';
import type { Party } from '@sealchain/core';
import { ApiError, api } from '../api';
import { useAuth, useMeta } from '../auth';
import { Alert, Button, Card, Field, PageHeader, PageLoader } from '../components/ui';
import { COUNTRY_NAME } from '../format';

interface OrgProfile {
  org: { id: string; name: string; country: string; plan: string; kind: string; createdAt: string };
  settings: {
    invoicePrefix: string;
    invoiceNext: number;
    nextInvoiceNumber: string;
    defaultCorridor: string | null;
    defaultCurrency: string | null;
    defaultIncoterm: string | null;
    defaultPaymentTerms: string | null;
    website: string | null;
  };
  exporter: { id: string; party: Party } | null;
}

const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];

export function Company() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const meta = useMeta();
  const q = useQuery({ queryKey: ['org'], queryFn: () => api.get<OrgProfile>('/org') });
  const [name, setName] = useState('');
  const [party, setParty] = useState<Party | null>(null);
  const [s, setS] = useState<OrgProfile['settings'] | null>(null);
  const [saved, setSaved] = useState(false);
  const canEdit = me?.user.role !== 'member';

  useEffect(() => {
    if (!q.data || party) return;
    setName(q.data.org.name);
    setParty(q.data.exporter?.party ?? { name: q.data.org.name, address: '', city: '', country: 'RW', taxId: '', phone: '', email: '' });
    setS(q.data.settings);
  }, [q.data, party]);

  const save = useMutation({
    mutationFn: () => api.put<OrgProfile>('/org', {
      name,
      exporter: { ...party!, name },
      settings: {
        invoicePrefix: s!.invoicePrefix,
        invoiceNext: s!.invoiceNext,
        defaultCorridor: s!.defaultCorridor || null,
        defaultCurrency: s!.defaultCurrency || null,
        defaultIncoterm: s!.defaultIncoterm || null,
        defaultPaymentTerms: s!.defaultPaymentTerms || null,
        website: s!.website || null,
      },
    }),
    onSuccess: (data) => {
      qc.setQueryData(['org'], data);
      setS(data.settings);
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['onboarding'] });
      void qc.invalidateQueries({ queryKey: ['parties'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (q.isLoading || !party || !s) return <PageLoader />;
  const corridor = meta.data?.corridors.find((c) => c.id === (s.defaultCorridor ?? meta.data?.corridors[0]?.id));
  const setP = (k: keyof Party, v: string) => setParty((p) => (p ? { ...p, [k]: v } : p));
  const setSet = <K extends keyof OrgProfile['settings']>(k: K, v: OrgProfile['settings'][K]) => setS((x) => (x ? { ...x, [k]: v } : x));
  const year = new Date().getFullYear();
  const preview = `${s.invoicePrefix || 'INV'}-${year}-${String(s.invoiceNext || 1).padStart(4, '0')}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Company profile"
        subtitle="These details are printed as the exporter on your invoices, certificates and packing lists, and pre-fill every new shipment."
        actions={canEdit && (
          <Button type="submit" loading={save.isPending} icon={saved ? <CheckCircle2 className="size-4" /> : undefined}>{saved ? 'Saved' : 'Save changes'}</Button>
        )}
      />
      {!canEdit && <Alert tone="info" className="mb-6">Only organisation owners can change the company profile.</Alert>}
      {save.isError && <Alert tone="error" className="mb-6">{save.error instanceof ApiError ? save.error.message : 'Could not save.'}</Alert>}

      <fieldset disabled={!canEdit} className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title={<span className="flex items-center gap-2"><Building2 className="size-4" /> Company details</span>} subtitle="As registered — the name must match your RDB registration.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" required className="sm:col-span-2"><input className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Street address" required className="sm:col-span-2"><input className="input" value={party.address} onChange={(e) => setP('address', e.target.value)} placeholder="KN 5 Rd, Plot 12" /></Field>
            <Field label="City" required><input className="input" value={party.city} onChange={(e) => setP('city', e.target.value)} placeholder="Kigali" /></Field>
            <Field label="Country">
              <select className="input" value={party.country} onChange={(e) => setP('country', e.target.value)}>
                {Object.entries(COUNTRY_NAME).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </Field>
            <Field label={corridor?.taxId.exporter.label ?? 'Tax ID (TIN)'} required hint={corridor ? `e.g. ${corridor.taxId.exporter.example}` : undefined}>
              <input className="input mono" value={party.taxId ?? ''} onChange={(e) => setP('taxId', e.target.value)} />
            </Field>
            <Field label="Phone"><input className="input" value={party.phone ?? ''} onChange={(e) => setP('phone', e.target.value)} placeholder="+250 7…" /></Field>
            <Field label="Email on documents"><input className="input" type="email" value={party.email ?? ''} onChange={(e) => setP('email', e.target.value)} /></Field>
            <Field label="Website"><input className="input" value={s.website ?? ''} onChange={(e) => setSet('website', e.target.value)} placeholder="https://" /></Field>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><SlidersHorizontal className="size-4" /> Shipment defaults</span>} subtitle="Pre-selected on every new shipment; you can change them per shipment.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Usual corridor" className="sm:col-span-2">
                <select className="input" value={s.defaultCorridor ?? ''} onChange={(e) => setSet('defaultCorridor', e.target.value || null)}>
                  <option value="">First available</option>
                  {meta.data?.corridors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Invoice currency">
                <select className="input" value={s.defaultCurrency ?? ''} onChange={(e) => setSet('defaultCurrency', e.target.value || null)}>
                  <option value="">USD</option>
                  {meta.data?.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Incoterm">
                <select className="input" value={s.defaultIncoterm ?? ''} onChange={(e) => setSet('defaultIncoterm', e.target.value || null)}>
                  <option value="">FCA</option>
                  {INCOTERMS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Payment terms" className="sm:col-span-2"><input className="input" value={s.defaultPaymentTerms ?? ''} onChange={(e) => setSet('defaultPaymentTerms', e.target.value)} placeholder="e.g. 50% advance, 50% against documents" /></Field>
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Hash className="size-4" /> Invoice numbering</span>} subtitle="“Next number” in the shipment form takes numbers from this sequence, never twice.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prefix"><input className="input mono" value={s.invoicePrefix} maxLength={20} onChange={(e) => setSet('invoicePrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} /></Field>
              <Field label="Next number"><input className="input mono" type="number" min={1} value={s.invoiceNext} onChange={(e) => setSet('invoiceNext', Math.max(1, Number(e.target.value) || 1))} /></Field>
            </div>
            <p className="mt-4 rounded-[3px] bg-slate-100 px-3 py-2 font-mono text-[13px] dark:bg-navy-800">Next invoice: {preview}</p>
          </Card>
        </div>
      </fieldset>
    </form>
  );
}
