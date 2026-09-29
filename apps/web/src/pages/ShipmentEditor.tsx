import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, Copy, FileSpreadsheet, Plus, Sparkles, Trash2 } from 'lucide-react';
import { ITEMS_CSV_TEMPLATE, formatHs, parseItemsCsv, lineTotal, type Finding, type OriginCriterion, type Party, type QuantityUnit, type Shipment, type ShipmentItem } from '@sealchain/core';
import { ApiError, api, type CorridorInfo, type ShipmentDetail, type Suggestion, type ValidationReport } from '../api';
import { useAuth, useMeta } from '../auth';
import { Alert, Badge, Button, Card, Field, PageHeader, PageLoader, cx } from '../components/ui';
import { COUNTRY_NAME, money, today } from '../format';
import { ValidationPanel } from '../components/ValidationPanel';

type Draft = Omit<Shipment, 'id'>;

const UNITS: QuantityUnit[] = ['KG', 'T', 'L', 'PCS', 'PR', 'DZN', 'M', 'M2', 'HEAD', 'STEM'];
const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'] as const;
const INCOTERM_HINT: Record<string, string> = {
  EXW: 'Buyer collects from your premises',
  FCA: 'You deliver to the buyer’s carrier',
  CPT: 'You pay carriage to the named place',
  CIP: 'You pay carriage + insurance',
  DAP: 'You deliver to the buyer, not cleared',
  DPU: 'Delivered and unloaded',
  DDP: 'You pay everything incl. import duties',
  FAS: 'Sea only', FOB: 'Sea only', CFR: 'Sea only', CIF: 'Sea only',
};

/** Usual final destination per destination country. */
const DEST: Record<string, { city: string }> = {
  KE: { city: 'Nairobi' },
  UG: { city: 'Kampala' },
  TZ: { city: 'Dar es Salaam' },
  BI: { city: 'Bujumbura' },
};

let itemSeq = 0;
const newItemId = () => `l${Date.now().toString(36)}${(itemSeq++).toString(36)}`;

interface OrgProfile {
  settings: { defaultCorridor: string | null; defaultCurrency: string | null; defaultIncoterm: string | null; defaultPaymentTerms: string | null };
  exporter: { id: string; party: Party } | null;
}

function emptyItem(): ShipmentItem {
  return {
    id: newItemId(), description: '', hsCode: '', quantity: 0, unit: 'KG', unitPrice: 0, netWeightKg: 0, grossWeightKg: 0,
    packageCount: 0, packageType: '', marks: '', originCountry: 'RW', originCriterion: 'WO',
  };
}

function emptyParty(country: Party['country']): Party {
  return { name: '', address: '', city: '', country, taxId: '', phone: '', email: '' };
}

function newDraft(corridor: CorridorInfo | undefined, orgName: string): Draft {
  return {
    reference: '',
    corridorId: corridor?.id ?? 'RW-KE',
    exporter: { ...emptyParty('RW'), name: orgName, city: 'Kigali' },
    consignee: emptyParty((corridor?.destination as Party['country']) ?? 'KE'),
    currency: 'USD',
    incoterm: 'FCA',
    incotermPlace: 'Kigali',
    transportMode: 'road',
    placeOfLoading: 'Kigali',
    exitPoint: corridor?.exitPoints.road?.[0] ?? '',
    entryPoint: corridor?.entryPoints.road?.[0] ?? '',
    finalDestination: DEST[corridor?.destination ?? 'KE']?.city ?? '',
    transportRef: '',
    departureDate: '',
    invoiceNumber: '',
    invoiceDate: today(),
    buyerOrderRef: '',
    paymentTerms: '',
    freight: 0,
    insurance: 0,
    otherCharges: 0,
    items: [emptyItem()],
  };
}

// ------------------------------------------------------------ number input
function NumInput({ value, onChange, className, step = 'any', invalid, ...rest }: { value: number | undefined; onChange: (n: number) => void; className?: string; step?: string; invalid?: boolean; placeholder?: string; min?: number; max?: number }) {
  const [text, setText] = useState(value ? String(value) : '');
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value ? String(value) : '');
      last.current = value;
    }
  }, [value]);
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      step={step}
      className={cx('input tabular-nums', invalid && 'input-error', className)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.value === '' ? 0 : Number(e.target.value);
        if (!Number.isNaN(n)) {
          last.current = n;
          onChange(n);
        }
      }}
    />
  );
}

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return <Card title={title} subtitle={subtitle} action={action}>{children}</Card>;
}

// ------------------------------------------------------------------ editor
export function ShipmentEditor() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useAuth();
  const meta = useMeta();

  const existing = useQuery({ queryKey: ['shipment', id], queryFn: () => api.get<ShipmentDetail>(`/shipments/${id}`), enabled: editing });
  const parties = useQuery({ queryKey: ['parties'], queryFn: () => api.get<Array<{ id: string; role: 'exporter' | 'consignee'; party: Party }>>('/parties') });
  const org = useQuery({ queryKey: ['org'], queryFn: () => api.get<OrgProfile>('/org'), enabled: !editing });
  const [numbering, setNumbering] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(editing);
  const onBlurCapture = (e: React.FocusEvent) => {
    const path = (e.target as HTMLElement).closest<HTMLElement>('[data-path]')?.dataset.path;
    if (path && !touched.has(path)) setTouched((t) => new Set(t).add(path));
  };

  // Initialise the draft once its inputs are loaded.
  useEffect(() => {
    if (draft) return;
    if (editing) {
      if (existing.data) {
        const { id: _id, ...rest } = existing.data.data;
        setDraft(rest);
      }
    } else if (meta.data && parties.data && org.data) {
      const st = org.data.settings;
      const d = newDraft(meta.data.corridors.find((c) => c.id === st.defaultCorridor) ?? meta.data.corridors[0], me?.org.name ?? '');
      if (st.defaultCurrency) d.currency = st.defaultCurrency as Draft['currency'];
      if (st.defaultIncoterm) d.incoterm = st.defaultIncoterm as Draft['incoterm'];
      if (st.defaultPaymentTerms) d.paymentTerms = st.defaultPaymentTerms;
      // The company profile is the default exporter.
      const savedExporter = org.data.exporter?.party ?? parties.data.find((p) => p.role === 'exporter')?.party;
      if (savedExporter) d.exporter = savedExporter;
      setDraft(d);
    }
  }, [draft, editing, existing.data, meta.data, parties.data, org.data, me]);

  const corridor = meta.data?.corridors.find((c) => c.id === draft?.corridorId);

  // Debounced live validation.
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(async () => {
      setValidating(true);
      try {
        setReport(await api.post<ValidationReport>('/shipments/validate', draft));
      } catch {
        /* keep last report */
      } finally {
        setValidating(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [draft]);

  const byPath = useMemo(() => {
    const m = new Map<string, Finding>();
    for (const f of report?.findings ?? []) {
      if (!f.path || f.severity === 'info') continue;
      const cur = m.get(f.path);
      if (!cur || (cur.severity === 'warning' && f.severity === 'error')) m.set(f.path, f);
    }
    return m;
  }, [report]);
  const fnd = (path: string) => byPath.get(path);
  // Inline messages appear once a field has been touched (or after a save
  // attempt); the side panel always lists everything.
  const visible = (path: string) => showAll || touched.has(path);
  const err = (path: string) => {
    const f = fnd(path);
    return f && visible(path) ? <span className={f.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>{f.message}{f.hint ? ` ${f.hint}` : ''}</span> : undefined;
  };
  const fe = (path: string) => ({ path, error: err(path) });
  const bad = (path: string) => visible(path) && fnd(path)?.severity === 'error';

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No draft');
      setShowAll(true);
      return editing ? api.put<{ id: string }>(`/shipments/${id}`, draft) : api.post<{ id: string }>('/shipments', draft);
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['shipments'] });
      await qc.invalidateQueries({ queryKey: ['shipment', res.id] });
      navigate(`/app/shipments/${res.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save'),
  });

  if (!draft || !meta.data) return <PageLoader />;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const setParty = (role: 'exporter' | 'consignee', k: keyof Party, v: string) => setDraft((d) => (d ? { ...d, [role]: { ...d[role], [k]: v } } : d));
  const setItem = (i: number, patch: Partial<ShipmentItem>) =>
    setDraft((d) => (d ? { ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : d));

  const exits = corridor?.exitPoints[draft.transportMode] ?? [];
  const entries = corridor?.entryPoints[draft.transportMode] ?? [];

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${draft.reference || 'shipment'}` : 'New shipment'}
        subtitle="Everything on the invoice, certificate of origin and packing list comes from this one record."
        actions={
          <>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              {editing ? 'Save changes' : 'Save & review'}
            </Button>
          </>
        }
      />
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {editing && existing.data?.status === 'issued' && (
        <Alert tone="info" className="mb-4" title="Documents already issued">
          Saving changes does not alter issued documents. Re-issue from the shipment page to publish corrected versions — the old ones will verify as superseded.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6" onBlurCapture={onBlurCapture}>
          {/* ----------------------------------------------- corridor */}
          <Section title="Corridor & route">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trade corridor">
                <select
                  className="input"
                  value={draft.corridorId}
                  disabled={editing && existing.data?.status === 'issued'}
                  onChange={(e) => {
                    const c = meta.data!.corridors.find((x) => x.id === e.target.value)!;
                    setDraft({
                      ...draft,
                      corridorId: c.id,
                      consignee: { ...draft.consignee, country: c.destination as Party['country'] },
                      exitPoint: c.exitPoints[draft.transportMode]?.[0] ?? '',
                      entryPoint: c.entryPoints[draft.transportMode]?.[0] ?? '',
                      finalDestination: DEST[c.destination]?.city ?? '',
                    });
                  }}
                >
                  {meta.data.corridors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Your reference" hint="Internal name, e.g. the buyer's PO">
                <input className="input" value={draft.reference} onChange={(e) => set('reference', e.target.value)} placeholder="PO-2026-0147" />
              </Field>
              <Field label="Mode of transport">
                <select
                  className="input"
                  value={draft.transportMode}
                  onChange={(e) => {
                    const mode = e.target.value as Draft['transportMode'];
                    setDraft({ ...draft, transportMode: mode, exitPoint: corridor?.exitPoints[mode]?.[0] ?? '', entryPoint: corridor?.entryPoints[mode]?.[0] ?? '' });
                  }}
                >
                  <option value="road">Road</option>
                  <option value="air">Air</option>
                  <option value="multimodal">Multimodal</option>
                  <option value="rail">Rail</option>
                </select>
              </Field>
              <Field label="Truck / flight / AWB no." {...fe('transportRef')}>
                <input className="input" value={draft.transportRef ?? ''} onChange={(e) => set('transportRef', e.target.value)} placeholder={draft.transportMode === 'air' ? 'WB 450 / AWB 459-1234 5675' : 'RAD 123 A'} />
              </Field>
              <Field label="Place of loading">
                <input className="input" value={draft.placeOfLoading} onChange={(e) => set('placeOfLoading', e.target.value)} />
              </Field>
              <Field label="Final destination">
                <input className="input" value={draft.finalDestination} onChange={(e) => set('finalDestination', e.target.value)} />
              </Field>
              <Field label="Exit point" {...fe('exitPoint')}>
                <input className="input" list="exits" value={draft.exitPoint ?? ''} onChange={(e) => set('exitPoint', e.target.value)} />
                <datalist id="exits">{exits.map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
              <Field label="Entry point" {...fe('entryPoint')}>
                <input className="input" list="entries" value={draft.entryPoint ?? ''} onChange={(e) => set('entryPoint', e.target.value)} />
                <datalist id="entries">{entries.map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
              <Field label="Departure date" {...fe('departureDate')}>
                <input className="input" type="date" value={draft.departureDate ?? ''} onChange={(e) => set('departureDate', e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* ------------------------------------------------ parties */}
          <div className="grid gap-6 xl:grid-cols-2">
            {(['exporter', 'consignee'] as const).map((role) => (
              <PartyCard
                key={role}
                role={role}
                party={draft[role]}
                corridor={corridor}
                saved={(parties.data ?? []).filter((p) => p.role === role)}
                onPick={(p) => set(role, p)}
                onChange={(k, v) => setParty(role, k, v)}
                fe={(k) => fe(`${role}.${k}`)}
                bad={(k) => bad(`${role}.${k}`)}
                onSaved={() => qc.invalidateQueries({ queryKey: ['parties'] })}
              />
            ))}
          </div>

          {/* ------------------------------------------------ invoice */}
          <Section title="Invoice & terms">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Invoice number" required {...fe('invoiceNumber')}>
                <div className="flex gap-2">
                  <input className={cx('input', bad('invoiceNumber') && 'input-error')} value={draft.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} placeholder="INV-2026-0091" />
                  <button
                    type="button"
                    disabled={numbering}
                    title="Use the next number from your company's invoice sequence"
                    className="shrink-0 rounded-[3px] border border-slate-300 bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-200"
                    onClick={async () => {
                      setNumbering(true);
                      try {
                        set('invoiceNumber', (await api.post<{ number: string }>('/org/invoice-number', {})).number);
                      } finally {
                        setNumbering(false);
                      }
                    }}
                  >
                    Next number
                  </button>
                </div>
              </Field>
              <Field label="Invoice date" required {...fe('invoiceDate')}>
                <input className={cx('input', bad('invoiceDate') && 'input-error')} type="date" value={draft.invoiceDate} onChange={(e) => set('invoiceDate', e.target.value)} />
              </Field>
              <Field label="Buyer order ref.">
                <input className="input" value={draft.buyerOrderRef ?? ''} onChange={(e) => set('buyerOrderRef', e.target.value)} />
              </Field>
              <Field label="Currency">
                <select className="input" value={draft.currency} onChange={(e) => set('currency', e.target.value as Draft['currency'])}>
                  {meta.data.currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Incoterm (2020)" hint={INCOTERM_HINT[draft.incoterm]} {...fe('incoterm')}>
                <select className="input" value={draft.incoterm} onChange={(e) => set('incoterm', e.target.value as Draft['incoterm'])}>
                  {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Named place" required {...fe('incotermPlace')}>
                <input className={cx('input', bad('incotermPlace') && 'input-error')} value={draft.incotermPlace} onChange={(e) => set('incotermPlace', e.target.value)} placeholder="Nairobi" />
              </Field>
              <Field label={`Freight (${draft.currency})`} {...fe('freight')}>
                <NumInput value={draft.freight} onChange={(n) => set('freight', n)} min={0} />
              </Field>
              <Field label={`Insurance (${draft.currency})`} {...fe('insurance')}>
                <NumInput value={draft.insurance} onChange={(n) => set('insurance', n)} min={0} />
              </Field>
              <Field label={`Other charges (${draft.currency})`}>
                <NumInput value={draft.otherCharges} onChange={(n) => set('otherCharges', n)} min={0} />
              </Field>
              <Field label="Payment terms" className="sm:col-span-2 lg:col-span-3">
                <input className="input" value={draft.paymentTerms ?? ''} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="e.g. 50% advance, balance against documents" />
              </Field>
            </div>
          </Section>

          {/* -------------------------------------------------- goods */}
          <Section
            title="Goods"
            subtitle="One line per product. Describe goods precisely — it drives the tariff code."
            action={
              <div className="flex gap-2">
                <CsvImport onImport={(items, replace) => { set('items', replace ? items : [...draft.items.filter((i) => i.description || i.hsCode), ...items]); setShowAll(true); }} />
                <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => set('items', [...draft.items, emptyItem()])}>Add line</Button>
              </div>
            }
          >
            {err('items') && <Alert tone="error" className="mb-4">{err('items')}</Alert>}
            <div className="space-y-5">
              {draft.items.map((item, i) => (
                <ItemEditor
                  key={item.id}
                  index={i}
                  item={item}
                  currency={draft.currency}
                  corridor={corridor}
                  onChange={(patch) => setItem(i, patch)}
                  onRemove={draft.items.length > 1 ? () => set('items', draft.items.filter((_, j) => j !== i)) : undefined}
                  onDuplicate={() => set('items', [...draft.items.slice(0, i + 1), { ...item, id: newItemId() }, ...draft.items.slice(i + 1)])}
                  fe={(k) => fe(`items[${i}].${k}`)}
                  bad={(k) => bad(`items[${i}].${k}`)}
                />
              ))}
            </div>
          </Section>

          <div className="flex justify-end gap-2 pb-8">
            <Link to={editing ? `/app/shipments/${id}` : '/app/shipments'}>
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button onClick={() => save.mutate()} loading={save.isPending}>{editing ? 'Save changes' : 'Save & review'}</Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ValidationPanel report={report} loading={validating} live />
        </aside>
      </div>
    </>
  );
}

// ------------------------------------------------------------- party card
function PartyCard({
  role, party, corridor, saved, onPick, onChange, fe, bad, onSaved,
}: {
  role: 'exporter' | 'consignee';
  party: Party;
  corridor?: CorridorInfo;
  saved: Array<{ id: string; party: Party }>;
  onPick: (p: Party) => void;
  onChange: (k: keyof Party, v: string) => void;
  fe: (k: string) => { path: string; error: ReactNode };
  bad: (k: string) => boolean;
  onSaved: () => void;
}) {
  const [savedMsg, setSavedMsg] = useState(false);
  const tax = corridor?.taxId[role];
  const alreadySaved = saved.some((s) => s.party.name === party.name && s.party.taxId === party.taxId);
  return (
    <Card
      title={role === 'exporter' ? 'Exporter (seller)' : 'Consignee (buyer)'}
      subtitle={COUNTRY_NAME[party.country]}
      action={
        saved.length > 0 ? (
          <select className="input h-8 w-40 py-0 text-xs" value="" onChange={(e) => { const p = saved.find((s) => s.id === e.target.value); if (p) onPick(p.party); }}>
            <option value="">Address book…</option>
            {saved.map((s) => <option key={s.id} value={s.id}>{s.party.name}</option>)}
          </select>
        ) : undefined
      }
    >
      <div className="grid gap-3">
        <Field label="Legal name" required {...fe('name')}>
          <input className={cx('input', bad('name') && 'input-error')} value={party.name} onChange={(e) => onChange('name', e.target.value)} />
        </Field>
        <Field label="Street address" required {...fe('address')}>
          <input className={cx('input', bad('address') && 'input-error')} value={party.address} onChange={(e) => onChange('address', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" required {...fe('city')}>
            <input className={cx('input', bad('city') && 'input-error')} value={party.city} onChange={(e) => onChange('city', e.target.value)} />
          </Field>
          <Field label={tax?.label ?? 'Tax ID'} required={role === 'exporter'} {...fe('taxId')}>
            <input className={cx('input font-mono', bad('taxId') && 'input-error')} value={party.taxId ?? ''} onChange={(e) => onChange('taxId', e.target.value.toUpperCase())} placeholder={tax?.example} />
          </Field>
          <Field label="Phone">
            <input className="input" value={party.phone ?? ''} onChange={(e) => onChange('phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={party.email ?? ''} onChange={(e) => onChange('email', e.target.value)} />
          </Field>
        </div>
        {party.name && !alreadySaved && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            onClick={async () => {
              await api.post('/parties', { role, party });
              setSavedMsg(true);
              onSaved();
            }}
          >
            <BookmarkPlus className="size-3.5" /> Save to address book
          </button>
        )}
        {savedMsg && alreadySaved && <span className="text-xs text-emerald-600">Saved to address book</span>}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------- item editor
function ItemEditor({
  index, item, currency, corridor, onChange, onRemove, onDuplicate, fe, bad,
}: {
  index: number;
  item: ShipmentItem;
  currency: string;
  corridor?: CorridorInfo;
  onChange: (p: Partial<ShipmentItem>) => void;
  onRemove?: () => void;
  onDuplicate: () => void;
  fe: (k: string) => { path: string; error: ReactNode };
  bad: (k: string) => boolean;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  async function suggest() {
    const q = item.description.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const res = await api.get<{ results: Suggestion[] }>(`/tariff/search?q=${encodeURIComponent(q)}&limit=5`);
      setSuggestions(res.results);
      setOpen(true);
    } finally {
      setSearching(false);
    }
  }

  // Suggest automatically after the trader pauses typing, while no code is chosen.
  useEffect(() => {
    if (item.hsCode || item.description.trim().length < 4) return;
    const t = setTimeout(() => void suggest(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.description]);

  const total = lineTotal(item);
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line {index + 1}</span>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-sm font-medium tabular-nums">{money(total, currency)}</span>
          <button type="button" onClick={onDuplicate} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-800" title="Duplicate line">
            <Copy className="size-4" />
          </button>
          {onRemove && (
            <button type="button" onClick={onRemove} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Remove line">
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <Field label="Description of goods" required className="sm:col-span-4" {...fe('description')}>
          <input
            className={cx('input', bad('description') && 'input-error')}
            value={item.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="e.g. Green arabica coffee beans, fully washed, grade A1"
          />
        </Field>
        <Field label="HS code (EAC CET)" required className="sm:col-span-2" {...fe('hsCode')}>
          <div className="flex gap-1.5">
            <input
              className={cx('input font-mono', bad('hsCode') && 'input-error')}
              value={item.hsCode ? formatHs(item.hsCode) : ''}
              onChange={(e) => onChange({ hsCode: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              placeholder="0901.11.00"
            />
            <Button type="button" variant="secondary" className="shrink-0 px-2.5" onClick={() => void suggest()} loading={searching} title="Suggest a code" icon={<Sparkles className="size-4" />} />
          </div>
        </Field>
      </div>

      {open && suggestions && (
        <div className="mt-2 overflow-hidden rounded-lg border border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/30">
          <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600 dark:text-navy-300">
            <span>Suggested classifications — confirm the one that describes your goods</span>
            <button className="font-medium hover:underline" onClick={() => setOpen(false)}>Hide</button>
          </div>
          {suggestions.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-slate-500">No match in the corridor catalog. Enter the code from your clearing agent.</p>
          ) : (
            <ul className="divide-y divide-brand-100 dark:divide-brand-900">
              {suggestions.map((s) => (
                <li key={s.line.code}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-white dark:hover:bg-slate-900"
                    onClick={() => {
                      onChange({ hsCode: s.line.code, unit: (s.line.unit as QuantityUnit) ?? item.unit });
                      setOpen(false);
                    }}
                  >
                    <code className="mono mt-0.5 shrink-0 font-medium text-brand-800 dark:text-brand-200">{formatHs(s.line.code)}</code>
                    <span className="min-w-0 flex-1 text-sm">{s.line.description}</span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={s.confidence === 'high' ? 'green' : s.confidence === 'medium' ? 'amber' : 'neutral'}>{s.confidence}</Badge>
                      <span className="text-[11px] text-slate-500">CET {s.line.cetRate}%{s.line.verifiedAt ? '' : '*'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Field label="Quantity" {...fe('quantity')}>
          <NumInput
            value={item.quantity}
            invalid={bad('quantity')}
            onChange={(n) => onChange({ quantity: n, ...(item.unit === 'KG' && (!item.netWeightKg || item.netWeightKg === item.quantity) ? { netWeightKg: n } : {}) })}
          />
        </Field>
        <Field label="Unit">
          <select className="input" value={item.unit} onChange={(e) => onChange({ unit: e.target.value as QuantityUnit })}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label={`Unit price (${currency})`} {...fe('unitPrice')}>
          <NumInput value={item.unitPrice} invalid={bad('unitPrice')} onChange={(n) => onChange({ unitPrice: n })} />
        </Field>
        <Field label="Net weight (kg)" {...fe('netWeightKg')}>
          <NumInput value={item.netWeightKg} invalid={bad('netWeightKg')} onChange={(n) => onChange({ netWeightKg: n })} />
        </Field>
        <Field label="Gross weight (kg)" {...fe('grossWeightKg')}>
          <NumInput value={item.grossWeightKg} invalid={bad('grossWeightKg')} onChange={(n) => onChange({ grossWeightKg: n })} />
        </Field>
        <Field label="No. of packages" {...fe('packageCount')}>
          <NumInput value={item.packageCount} step="1" invalid={bad('packageCount')} onChange={(n) => onChange({ packageCount: n })} />
        </Field>
        <Field label="Kind of packages" className="col-span-2 sm:col-span-3" {...fe('packageType')}>
          <input className={cx('input', bad('packageType') && 'input-error')} value={item.packageType} onChange={(e) => onChange({ packageType: e.target.value })} placeholder="Jute bags (60 kg)" />
        </Field>
        <Field label="Marks & numbers" className="col-span-2 sm:col-span-3">
          <input className="input" value={item.marks ?? ''} onChange={(e) => onChange({ marks: e.target.value })} placeholder="BRAND / PO-123 / 1-160" />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-6 dark:bg-navy-800/40">
        <Field label="Country of origin" className="col-span-2 sm:col-span-2" {...fe('originCountry')}>
          <select className="input" value={item.originCountry} onChange={(e) => onChange({ originCountry: e.target.value as ShipmentItem['originCountry'] })}>
            {Object.entries(COUNTRY_NAME).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </Field>
        <Field label="Origin criterion" className="sm:col-span-2" {...fe('originCriterion')}>
          <select className="input" value={item.originCriterion} onChange={(e) => onChange({ originCriterion: e.target.value as OriginCriterion })}>
            <option value="WO">WO — wholly obtained / grown / mined here</option>
            <option value="PSR">PSR — made here using imported inputs</option>
          </select>
        </Field>
        {item.originCriterion === 'PSR' && (
          <>
            <Field label="Imported content %" hint={`≤ ${corridor?.params.maxNonOriginatingPct ?? 60}% of ex-works price`} {...fe('nonOriginatingPct')}>
              <NumInput value={item.nonOriginatingPct} invalid={bad('nonOriginatingPct')} min={0} max={100} onChange={(n) => onChange({ nonOriginatingPct: n })} />
            </Field>
            <Field label="Processing done in the origin country" className="col-span-2" {...fe('processingNote')}>
              <input className="input" value={item.processingNote ?? ''} onChange={(e) => onChange({ processingNote: e.target.value })} placeholder="Roasted, ground and packed in Kigali" />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- CSV import
function CsvImport({ onImport }: { onImport: (items: ShipmentItem[], replace: boolean) => void }) {
  const [result, setResult] = useState<ReturnType<typeof parseItemsCsv> | null>(null);
  const [replace, setReplace] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(ITEMS_CSV_TEMPLATE)}`;
  return (
    <>
      <Button size="sm" variant="ghost" icon={<FileSpreadsheet className="size-4" />} onClick={() => input.current?.click()}>Import CSV</Button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setResult(parseItemsCsv(await f.text()));
        }}
      />
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={() => setResult(null)}>
          <div className="card w-full max-w-lg p-5" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold">Import goods lines</h2>
            {result.items.length > 0 && <p className="mt-2 text-sm">{result.items.length} line(s) read from the file.</p>}
            {result.unknownColumns.length > 0 && <p className="mt-1 text-xs text-slate-500">Ignored columns: {result.unknownColumns.join(', ')}</p>}
            {result.errors.length > 0 && (
              <Alert tone="warning" className="mt-3" title={`${result.errors.length} problem(s)`}>
                <ul className="list-disc pl-4">{result.errors.slice(0, 8).map((er, i) => <li key={i}>{er.row ? `Row ${er.row}: ` : ''}{er.message}</li>)}</ul>
              </Alert>
            )}
            {result.items.length > 0 && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace the current lines
              </label>
            )}
            <div className="mt-4 flex items-center justify-between">
              <a href={template} download="sealchain-goods-template.csv" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">Download template</a>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setResult(null)}>Cancel</Button>
                <Button size="sm" disabled={!result.items.length} onClick={() => { onImport(result.items, replace); setResult(null); }}>Import {result.items.length} line(s)</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
