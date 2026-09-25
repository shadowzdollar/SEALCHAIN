/** Content blocks shared by several public pages. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import { useMeta } from '../auth';
import { cx } from '../components/ui';
import { INK_BTN } from './Chrome';
import { PhotoPrint } from './Photo';
import { PHOTOS } from './photos';

export function usePricing() {
  const billing = useMeta().data?.billing;
  return {
    monthly: billing ? billing.monthlyFeeCents / 100 : 15,
    perShipment: billing ? billing.perShipmentCents / 100 : 3,
    currency: billing?.currency ?? 'USD',
  };
}

export const FAQS: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'Does SealChain replace customs, ASYCUDA or my clearing agent?',
    a: 'No. SealChain prepares and checks the commercial documents that go into your declaration, and proves they are genuine. Your clearing agent still lodges the declaration, and customs still decides. Fewer errors means fewer queries at the border.',
  },
  {
    q: 'Is my trade data put on a blockchain?',
    a: 'Never. Only a 32-byte fingerprint of a batch of documents (a Merkle root) is written on-chain. Invoices, prices, buyers and quantities stay in SealChain, and only people you share a link with can see them.',
  },
  {
    q: 'How does a buyer or border officer check a document?',
    a: 'They scan the QR code on the PDF or drop the file on the public verifier — no account needed. The verifier shows whether the file is identical to what was issued, who issued it, and when it was anchored. The page is available in English, French, Kiswahili and Kinyarwanda.',
  },
  {
    q: 'Which documents and corridors are supported?',
    a: 'The commercial invoice, EAC certificate of origin (full or simplified for small consignments) and packing list, for shipments from Rwanda to Kenya, Uganda, Tanzania and Burundi. Each rule set shows when our compliance team last verified it.',
  },
  {
    q: 'What does the certificate of origin still need from the authority?',
    a: 'The certificate still has to be issued or endorsed by the competent authority. SealChain pre-fills it and, where the authority is on SealChain, lets their officers endorse it digitally on the same anchored record.',
  },
  {
    q: 'What if I make a mistake after issuing?',
    a: 'Correct the shipment and re-issue. The new version is anchored, the old one is marked as superseded, and anyone verifying the old copy is pointed to the current one. Corrections are free.',
  },
  {
    q: 'Can I connect my own system?',
    a: 'Yes. Organisation owners create API keys and signed webhooks under Team & settings. The API is the same engine as the web app.',
  },
];

export function Faq({ items = FAQS, className }: { items?: typeof FAQS; className?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <dl className={cx('divide-y divide-paper-rule border-y border-paper-rule', className)}>
      {items.map((f, i) => (
        <div key={f.q}>
          <dt>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left" aria-expanded={open === i}>
              <span className="font-serif text-[18px] font-medium text-navy-900">{f.q}</span>
              {open === i ? <Minus className="size-4 shrink-0 text-stamp" /> : <Plus className="size-4 shrink-0 text-slate-500" />}
            </button>
          </dt>
          {open === i && <dd className="-mt-1 max-w-3xl pb-6 text-[15px] leading-relaxed text-slate-600">{f.a}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Receipt({ className, shipments }: { className?: string; shipments?: number }) {
  const { monthly, perShipment, currency } = usePricing();
  const n = shipments ?? 0;
  const total = monthly + n * perShipment;
  return (
    <div className={cx('relative w-full max-w-[420px] rounded-[2px] border border-paper-rule bg-paper-card p-7 shadow-[0_12px_32px_-14px_rgba(11,31,58,0.3)]', className)}>
      {/* perforated top edge */}
      <div aria-hidden className="absolute inset-x-0 -top-[5px] h-[10px] bg-[radial-gradient(circle,var(--color-paper)_3px,transparent_3.5px)] bg-[length:14px_10px] bg-repeat-x" />
      <div className="flex justify-between border-b border-dashed border-paper-rule pb-3 font-plexmono text-[12px] text-slate-500">
        <span>{shipments === undefined ? 'STATEMENT · PILOT' : 'ESTIMATE · ONE MONTH'}</span><span>{currency}</span>
      </div>
      <dl className="mt-4 space-y-3 font-plexmono text-[14px]">
        <div className="flex justify-between"><dt className="text-slate-600">Monthly subscription</dt><dd>{monthly.toFixed(2)}</dd></div>
        {shipments === undefined ? (
          <div className="flex justify-between"><dt className="text-slate-600">Per shipment issued</dt><dd>{perShipment.toFixed(2)}</dd></div>
        ) : (
          <div className="flex justify-between"><dt className="text-slate-600">{n} shipment{n === 1 ? '' : 's'} × {perShipment.toFixed(2)}</dt><dd>{(n * perShipment).toFixed(2)}</dd></div>
        )}
        <div className="flex justify-between"><dt className="text-slate-600">Corrections &amp; re-issues</dt><dd>0.00</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">Verification by anyone</dt><dd>0.00</dd></div>
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t-2 border-navy-900 pt-4">
        <span className="font-serif text-[18px] font-medium">{shipments === undefined ? 'From' : 'Total'}</span>
        <span className="font-serif text-[32px] font-semibold tabular-nums">${shipments === undefined ? monthly : total.toLocaleString(undefined, { maximumFractionDigits: 2 })}<span className="text-[15px] font-normal text-slate-500"> /mo</span></span>
      </div>
      {shipments !== undefined && n > 0 && <p className="mt-1 text-right font-plexmono text-[11.5px] text-slate-500">≈ ${(total / n).toFixed(2)} per shipment, all in</p>}
      <Link to="/register" className={`${INK_BTN} mt-6 w-full`}>Join the pilot <ArrowRight className="size-4" /></Link>
    </div>
  );
}

const PRESETS = [5, 10, 25, 50];

/** Landing-page pricing: live estimator, receipt pinned over a port photo, plans. */
export function PricingShowcase() {
  const [n, setN] = useState(10);
  const { monthly, perShipment } = usePricing();
  const plans = [
    { name: 'Pilot', price: `$${monthly}`, unit: `/mo + $${perShipment}/shipment`, who: 'Exporters & SMEs', to: '/register', cta: 'Start a shipment', featured: true },
    { name: 'Authority', price: 'Free', unit: 'for issuing bodies', who: 'Customs & certificate issuers', to: '/contact?topic=authority', cta: 'Talk to us' },
    { name: 'Verifier', price: 'Free', unit: 'no account needed', who: 'Banks, buyers, insurers', to: '/verify', cta: 'Verify a document' },
    { name: 'Network', price: 'Custom', unit: 'volume & membership', who: 'Associations & forwarders', to: '/contact?topic=integration', cta: 'Talk to us' },
  ];
  return (
    <section className="paper-grid border-b border-paper-rule">
      <div className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:text-[12px] sm:tracking-[0.22em]">Pilot pricing</p>
            <h2 className="mt-4 font-serif text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[46px]">Pay for what you ship. <em className="font-medium text-stamp">Nothing</em> for fixing it.</h2>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-slate-600">A modest subscription plus a fee when a shipment’s documents are first issued. Drafts, corrections and re-issues are free, and so is verification — for everyone.</p>

            <div className="mt-10 max-w-xl rounded-[3px] border border-paper-rule bg-paper-card p-6">
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="ship-count" className="font-serif text-[19px] font-medium">Shipments per month</label>
                <span className="font-serif text-[34px] font-semibold tabular-nums leading-none">{n}</span>
              </div>
              <input id="ship-count" type="range" min={1} max={60} value={n} onChange={(e) => setN(Number(e.target.value))} className="mt-5 w-full accent-[#0b1f3a]" />
              <div className="mt-1 flex justify-between font-plexmono text-[10.5px] text-slate-400"><span>1</span><span>15</span><span>30</span><span>45</span><span>60</span></div>
              <div className="mt-5 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p} onClick={() => setN(p)} className={cx('rounded-[3px] border px-3 py-1.5 font-plexmono text-[12px] transition-colors', n === p ? 'border-navy-900 bg-navy-900 text-white' : 'border-paper-rule text-slate-600 hover:border-navy-300')}>{p} / month</button>
                ))}
              </div>
            </div>

            <ul className="mt-8 grid max-w-xl gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {['Unlimited drafts and team members', 'Free corrections and re-issues', 'Screening, share links, API', 'Mobile money or bank transfer', 'No contract, stop any time', 'Issued documents stay verifiable'].map((t) => (
                <li key={t} className="flex gap-2.5 text-[14px] text-slate-700"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[620px] pt-4 lg:mr-0">
            <PhotoPrint photo={PHOTOS.containerStacks} tilt={-4} className="w-[80%]" ratio="aspect-[4/3]" caption="Mombasa" />
            <Receipt shipments={n} className="relative z-10 -mt-40 ml-auto rotate-[1.5deg] sm:-mt-52" />
          </div>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-[3px] border border-paper-rule bg-paper-rule sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <Link key={p.name} to={p.to} className={cx('group flex flex-col p-6 transition-colors', p.featured ? 'bg-navy-900 text-white' : 'bg-paper-card hover:bg-white')}>
              <div className="flex items-center justify-between">
                <span className="font-serif text-[21px] font-semibold">{p.name}</span>
                {p.featured && <span className="rounded-[2px] bg-stamp px-1.5 py-0.5 font-plexmono text-[10px] uppercase tracking-[0.12em] text-white">Open</span>}
              </div>
              <span className={cx('mt-1 text-[13px]', p.featured ? 'text-navy-200' : 'text-slate-500')}>{p.who}</span>
              <span className="mt-6 font-serif text-[34px] font-semibold leading-none">{p.price}</span>
              <span className={cx('mt-1.5 text-[13px]', p.featured ? 'text-navy-200' : 'text-slate-600')}>{p.unit}</span>
              <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium">{p.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
        <p className="mt-5 text-[13px] text-slate-500">Full comparison and questions on the <Link to="/pricing" className="font-medium text-navy-900 underline underline-offset-4">pricing page</Link>.</p>
      </div>
    </section>
  );
}

/** Figures that come from the running product, never invented. */
export function FactsStrip() {
  const meta = useMeta().data;
  const facts = [
    { n: meta ? String(meta.corridors.length) : '4', l: 'EAC corridors with maintained rule sets' },
    { n: meta ? String(meta.catalogSize) : '—', l: 'Tariff lines in the classification catalogue' },
    { n: '4', l: 'Verifier languages: English, French, Kiswahili, Kinyarwanda' },
    { n: '32', l: 'Bytes per batch written on-chain — never your trade data' },
  ];
  return (
    <div className="grid grid-cols-2 border-y border-paper-rule lg:grid-cols-4">
      {facts.map((f, i) => (
        <div key={f.l} className={cx('px-5 py-8 sm:px-8', i % 2 === 1 && 'border-l border-paper-rule', i >= 2 && 'border-t border-paper-rule lg:border-t-0', i === 2 && 'lg:border-l')}>
          <p className="font-serif text-[44px] font-semibold leading-none tracking-[-0.02em]">{f.n}</p>
          <p className="mt-3 max-w-[16rem] text-[13.5px] leading-snug text-slate-600">{f.l}</p>
        </div>
      ))}
    </div>
  );
}

/** Icon + title + body item used in feature grids. */
export function Feature({ icon, title, children, n }: { icon: ReactNode; title: ReactNode; children: ReactNode; n?: string }) {
  return (
    <article className="border-t-2 border-navy-900 pt-5">
      <div className="flex items-center justify-between">
        <span className="text-navy-900 [&>svg]:size-5 [&>svg]:stroke-[1.6]">{icon}</span>
        {n && <span className="font-plexmono text-[12px] text-slate-500">{n}</span>}
      </div>
      <h3 className="mt-5 font-serif text-[23px] font-medium tracking-[-0.01em]">{title}</h3>
      <div className="mt-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </article>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((t, i) => (
        <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)] text-[15px] leading-relaxed text-slate-700">
          <span className="pt-[3px] font-plexmono text-[12px] text-stamp">{String(i + 1).padStart(2, '0')}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
