import { Fragment } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { cx } from '../../components/ui';
import { Eyebrow, INK_BTN, PAGE_X, PAPER_BTN, SectionHeading } from '../Chrome';
import { FAQS, Faq, usePricing } from '../Blocks';

const PRICING_FAQS = [
  { q: 'When is the per-shipment fee charged?', a: 'Once, when a shipment’s documents are first issued. Corrections and re-issues of the same shipment are free, and drafts are never charged.' },
  { q: 'How do I pay during the pilot?', a: 'By mobile money or bank transfer against a monthly statement, which you can see at any time under Billing. Card payments will follow.' },
  { q: 'Do my buyers or their banks pay to verify?', a: 'No. Verification is free for everyone and needs no account.' },
  { q: 'Is there a contract or minimum term?', a: 'Not during the pilot. You can stop at any time; your issued documents stay verifiable.' },
  ...FAQS.slice(1, 3),
];

type Cell = boolean | string;
const ROWS: Array<{ group: string; rows: Array<[string, Cell, Cell, Cell]> }> = [
  {
    group: 'Documents',
    rows: [
      ['Commercial invoice, certificate of origin, packing list', true, false, false],
      ['Simplified certificate of origin (STR)', true, false, false],
      ['Live pre-submission checks', true, 'Before endorsement', false],
      ['CSV import and address book', true, false, false],
    ],
  },
  {
    group: 'Authenticity',
    rows: [
      ['Signed, anchored documents and endorsements', true, true, false],
      ['Authority endorsement', 'Request', 'Endorse', 'View'],
      ['Public verifier', true, true, true],
      ['Tamper alerts', true, false, false],
    ],
  },
  {
    group: 'Screening & sharing',
    rows: [
      ['Fraud screening of received documents', true, false, false],
      ['Share links with expiry', true, false, false],
      ['Activity feed', true, false, false],
    ],
  },
  {
    group: 'Team & integration',
    rows: [
      ['Team members', 'Unlimited', 'Unlimited', '—'],
      ['API keys and signed webhooks', true, false, false],
    ],
  },
];

function CellView({ v }: { v: Cell }) {
  if (v === true) return <Check className="mx-auto size-4 text-emerald-700" />;
  if (v === false) return <Minus className="mx-auto size-4 text-slate-300" />;
  return <span className="text-[13px] text-slate-700">{v}</span>;
}

export function PricingPage() {
  const { monthly, perShipment, currency } = usePricing();
  const plans = [
    {
      name: 'Pilot', who: 'Exporters, cooperatives and SMEs', price: `$${monthly}`, unit: `/month + $${perShipment} per shipment`,
      points: ['Everything needed to issue compliant, sealed documents', 'Unlimited drafts, corrections and re-issues', 'Screening, share links and API access'],
      cta: { label: 'Start a shipment', to: '/register' }, featured: true,
    },
    {
      name: 'Authority', who: 'Customs and certificate-issuing bodies', price: 'Free', unit: 'for issuing authorities',
      points: ['Endorsement queue for officers', 'Signed, anchored endorsements', 'Officer accounts for your team'],
      cta: { label: 'Talk to us', to: '/contact?topic=authority' },
    },
    {
      name: 'Verifier', who: 'Buyers, banks, insurers and officers', price: 'Free', unit: 'no account needed',
      points: ['Verify any SealChain document', 'Scan the QR code or drop the file', 'Available in four languages'],
      cta: { label: 'Verify a document', to: '/verify' },
    },
  ];
  return (
    <>
      <section className="paper-grid border-b border-paper-rule">
        <div className={cx('mx-auto max-w-[1680px] pb-20 pt-16 text-center lg:pt-20', PAGE_X)}>
          <Eyebrow>Pricing · {currency}</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] sm:text-[52px]">Pay for what you ship. <em className="font-medium text-stamp">Verify</em> for free.</h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">Simple pilot pricing while we onboard exporters on EAC corridors. No contract, no minimum term.</p>

          <div className="mt-14 grid gap-6 text-left lg:grid-cols-3">
            {plans.map((p) => (
              <div key={p.name} className={cx('relative flex flex-col rounded-[3px] border bg-paper-card p-7', p.featured ? 'border-navy-900 shadow-[0_18px_40px_-24px_rgba(11,31,58,0.5)]' : 'border-paper-rule')}>
                {p.featured && <span className="absolute -top-3 left-7 rounded-[2px] bg-stamp px-2 py-0.5 font-plexmono text-[10.5px] uppercase tracking-[0.14em] text-white">Pilot open</span>}
                <p className="font-serif text-[24px] font-semibold">{p.name}</p>
                <p className="mt-1 text-[14px] text-slate-500">{p.who}</p>
                <p className="mt-6 font-serif text-[44px] font-semibold leading-none tracking-[-0.02em]">{p.price}</p>
                <p className="mt-2 text-[13.5px] text-slate-600">{p.unit}</p>
                <ul className="mt-6 flex-1 space-y-2.5 border-t border-paper-rule pt-6">
                  {p.points.map((x) => <li key={x} className="flex gap-2.5 text-[14px] text-slate-700"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />{x}</li>)}
                </ul>
                <Link to={p.cta.to} className={cx(p.featured ? INK_BTN : PAPER_BTN, 'mt-8 w-full')}>{p.cta.label}</Link>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-[3px] border border-paper-rule bg-paper-card p-6 text-left sm:flex-row sm:items-center">
            <div>
              <p className="font-serif text-[20px] font-medium">Associations, forwarders and high volumes</p>
              <p className="mt-1 text-[14px] text-slate-600">Onboarding for a whole membership, volume pricing or a deeper integration? We’ll shape a plan with you.</p>
            </div>
            <Link to="/contact?topic=integration" className={cx(PAPER_BTN, 'shrink-0')}>Talk to us <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      <section className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
        <SectionHeading eyebrow="Compare" title="What each plan includes." />
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border-t-2 border-navy-900 text-[14px]">
            <thead>
              <tr className="border-b border-paper-rule">
                <th className="w-1/2 py-4 text-left font-normal" />
                {['Pilot', 'Authority', 'Verifier'].map((h) => <th key={h} className="py-4 text-center font-serif text-[17px] font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((g) => (
                <Fragment key={g.group}>
                  <tr><td colSpan={4} className="pb-2 pt-7 font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">{g.group}</td></tr>
                  {g.rows.map(([label, a, b, c]) => (
                    <tr key={label} className="border-b border-paper-rule">
                      <td className="py-3 pr-4 text-slate-700">{label}</td>
                      <td className="py-3 text-center"><CellView v={a} /></td>
                      <td className="py-3 text-center"><CellView v={b} /></td>
                      <td className="py-3 text-center"><CellView v={c} /></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-paper-rule bg-paper-card">
        <div className={cx('mx-auto grid max-w-[1680px] gap-12 py-24 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]', PAGE_X)}>
          <SectionHeading eyebrow="Questions" title="Pricing and the pilot." body={<>Can’t find your answer? <Link to="/contact" className="font-medium text-navy-900 underline underline-offset-4">Contact us</Link>.</>} />
          <Faq items={[...PRICING_FAQS, ...FAQS.slice(3)]} />
        </div>
      </section>
    </>
  );
}
