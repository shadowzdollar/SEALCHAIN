/** Content blocks shared by several public pages. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useMeta } from '../auth';
import { cx } from '../components/ui';
import { INK_BTN } from './Chrome';

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

export function Receipt({ className }: { className?: string }) {
  const { monthly, perShipment, currency } = usePricing();
  return (
    <div className={cx('relative w-full max-w-[420px] rounded-[2px] border border-paper-rule bg-paper-card p-7 shadow-[0_12px_32px_-14px_rgba(11,31,58,0.2)]', className)}>
      <div className="flex justify-between border-b border-dashed border-paper-rule pb-3 font-plexmono text-[12px] text-slate-500">
        <span>STATEMENT · PILOT</span><span>{currency}</span>
      </div>
      <dl className="mt-4 space-y-3 font-plexmono text-[14px]">
        <div className="flex justify-between"><dt className="text-slate-600">Monthly subscription</dt><dd>{monthly.toFixed(2)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">Per shipment issued</dt><dd>{perShipment.toFixed(2)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">Corrections &amp; re-issues</dt><dd>0.00</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">Verification by anyone</dt><dd>0.00</dd></div>
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t-2 border-navy-900 pt-4">
        <span className="font-serif text-[18px] font-medium">From</span>
        <span className="font-serif text-[30px] font-semibold">${monthly}<span className="text-[15px] font-normal text-slate-500"> /mo</span></span>
      </div>
      <Link to="/register" className={`${INK_BTN} mt-6 w-full`}>Join the pilot <ArrowRight className="size-4" /></Link>
    </div>
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
