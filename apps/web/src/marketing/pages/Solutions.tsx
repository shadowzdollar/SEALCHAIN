import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowRight, Banknote, Clock, FileWarning, Landmark, Package, ShieldCheck, Stamp, TrendingDown, Users } from 'lucide-react';
import { cx } from '../../components/ui';
import { INK_BTN, PAGE_X, PAPER_BTN, PageHero, SectionHeading } from '../Chrome';
import { Bullets, Feature } from '../Blocks';
import { DocumentStack, EndorsementCard, PhoneVerifier, ScreeningCard, ValidationCard } from '../Illustrations';
import { PhotoPrint } from '../Photo';
import { PHOTOS } from '../photos';
import type { Photo } from '../photos';

interface Solution {
  photo: Photo;
  eyebrow: string;
  title: ReactNode;
  body: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
  art: ReactNode;
  problems: Array<{ icon: ReactNode; t: string; d: string }>;
  how: { title: string; body: string; points: ReactNode[]; art: ReactNode };
  steps: Array<[string, string]>;
}

const SOLUTIONS: Record<string, Solution> = {
  exporters: {
    photo: PHOTOS.teaPicker,
    eyebrow: 'For exporters & SMEs',
    title: <>Clear the border <em className="font-medium text-stamp">first time</em>.</>,
    body: 'Most delays at EAC borders start with paperwork: a wrong code, a missing permit, figures that don’t match between documents. SealChain catches them at your desk, not at the barrier.',
    primary: { label: 'Start a shipment', to: '/register' },
    secondary: { label: 'Join the pilot', to: '/contact?topic=pilot' },
    art: <DocumentStack />,
    problems: [
      { icon: <Clock />, t: 'Trucks held at the border', d: 'A query on one document can hold a consignment for days, with demurrage and spoilage on perishables.' },
      { icon: <TrendingDown />, t: 'Buyers paying full duty', d: 'Without a valid certificate of origin, your buyer pays the full external tariff instead of the EAC preference.' },
      { icon: <FileWarning />, t: 'Copies no one can trust', d: 'Scans and photos of certificates circulate freely — and so do altered ones carrying your name.' },
    ],
    how: {
      title: 'Your documents, checked before they’re printed.',
      body: 'Enter the shipment once. SealChain produces the invoice, certificate of origin and packing list, checks them against the corridor’s rules and tells you exactly what to fix.',
      points: ['Tariff code suggestions for your goods', 'The permits your goods need, and who issues them', 'What the certificate saves your buyer in duty', 'A QR code on every page so anyone can verify'],
      art: <ValidationCard className="w-full max-w-[440px]" />,
    },
    steps: [['Create', 'Enter the shipment or import the lines from a spreadsheet.'], ['Fix', 'Resolve the errors and review the warnings.'], ['Issue', 'Download three consistent, sealed PDFs.'], ['Share', 'Send one link to your buyer, bank and agent.']],
  },
  authorities: {
    photo: PHOTOS.kigaliAirport,
    eyebrow: 'For issuing authorities',
    title: <>Endorse certificates <em className="font-medium text-stamp">digitally</em> — and make forgery pointless.</>,
    body: 'Certificates of origin are only as trustworthy as the stamp on them. SealChain gives officers a queue of pre-validated requests and makes every endorsement verifiable by anyone, anywhere.',
    primary: { label: 'Talk to us', to: '/contact?topic=authority' },
    secondary: { label: 'See the verifier', to: '/verify' },
    art: <EndorsementCard className="mx-auto max-w-[400px]" />,
    problems: [
      { icon: <Stamp />, t: 'Stamps are easy to copy', d: 'A scanned stamp can be pasted onto any certificate; checking one means a phone call or a letter.' },
      { icon: <FileWarning />, t: 'Incomplete applications', d: 'Officers spend time sending back certificates with wrong codes or missing details.' },
      { icon: <Users />, t: 'Queries from partner states', d: 'Destination customs query certificates they cannot verify themselves.' },
    ],
    how: {
      title: 'A review queue built for officers.',
      body: 'Requests arrive already validated against the corridor’s rules. Officers see the certificate, the exporter and the goods, and endorse or decline with a reason. Each decision is signed and anchored.',
      points: ['Separate authority workspace and accounts', 'Endorse or decline with a recorded reason', 'Endorsements shown on every verification', 'No cost to the authority'],
      art: <EndorsementCard className="w-full max-w-[400px]" />,
    },
    steps: [['Onboard', 'We set up your authority workspace and officers.'], ['Review', 'Pre-validated requests arrive in your queue.'], ['Endorse', 'Each decision is signed and anchored.'], ['Trusted', 'Destination customs verify it themselves.']],
  },
  verifiers: {
    photo: PHOTOS.containerStacks,
    eyebrow: 'For banks, buyers & insurers',
    title: <>Know the paper is <em className="font-medium text-stamp">genuine</em> before you pay.</>,
    body: 'Letters of credit, payments and claims depend on documents you receive from someone else. Check any SealChain document in seconds — and screen the ones that aren’t.',
    primary: { label: 'Verify a document', to: '/verify' },
    secondary: { label: 'Talk to us', to: '/contact?topic=verification' },
    art: <PhoneVerifier />,
    problems: [
      { icon: <Banknote />, t: 'Paying against forged documents', d: 'Altered invoices and certificates are a known route to trade-finance fraud.' },
      { icon: <Clock />, t: 'Slow manual checks', d: 'Calling an exporter or an authority to confirm a document takes days.' },
      { icon: <ShieldCheck />, t: 'No way to prove a copy', d: 'A PDF by email looks the same whether it is genuine or edited.' },
    ],
    how: {
      title: 'Verification that stands on its own.',
      body: 'The verifier compares the exact file with its record, checks the issuer’s signature and the on-chain anchor — all without an account. For documents from outside SealChain, use fraud screening.',
      points: ['Free, with no account', 'Proof you can recompute independently', 'Shows authority endorsement where given', 'Screening for documents from any source'],
      art: <ScreeningCard className="w-full max-w-[440px]" />,
    },
    steps: [['Receive', 'A document arrives by email, share link or on paper.'], ['Scan', 'Scan the QR code or drop the PDF.'], ['Check', 'See the verdict, issuer and anchor.'], ['Decide', 'Pay, finance or settle with confidence.']],
  },
};

const OTHERS: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: 'exporters', label: 'Exporters & SMEs', icon: <Package /> },
  { id: 'authorities', label: 'Issuing authorities', icon: <Landmark /> },
  { id: 'verifiers', label: 'Banks, buyers & insurers', icon: <Banknote /> },
];

export function SolutionsPage() {
  const { segment = '' } = useParams();
  const s = SOLUTIONS[segment];
  if (!s) return <Navigate to="/solutions/exporters" replace />;
  return (
    <>
      <PageHero
        eyebrow={s.eyebrow}
        title={s.title}
        body={s.body}
        actions={<><Link to={s.primary.to} className={INK_BTN}>{s.primary.label} <ArrowRight className="size-4" /></Link><Link to={s.secondary.to} className={PAPER_BTN}>{s.secondary.label}</Link></>}
        art={
          <div className="relative mx-auto w-full max-w-[620px] lg:mr-0">
            <PhotoPrint photo={s.photo} size="lg" priority tilt={-3} className="w-[78%]" />
            <div className="-mt-20 ml-auto w-full sm:-mt-36 sm:w-[78%]">{s.art}</div>
          </div>
        }
      />

      <section className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
        <SectionHeading eyebrow="The problem" title="What paper costs you today." />
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {s.problems.map((p, i) => <Feature key={p.t} n={String(i + 1).padStart(2, '0')} icon={p.icon} title={p.t}>{p.d}</Feature>)}
        </div>
      </section>

      <section className="border-y border-paper-rule bg-paper-card">
        <div className={cx('mx-auto grid max-w-[1680px] items-center gap-14 py-24 lg:grid-cols-2', PAGE_X)}>
          <div>
            <SectionHeading eyebrow="How SealChain helps" title={s.how.title} body={s.how.body} />
            <div className="mt-8"><Bullets items={s.how.points} /></div>
          </div>
          <div className="paper-grid flex min-h-[380px] items-center justify-center rounded-[3px] border border-paper-rule p-6 sm:p-10">{s.how.art}</div>
        </div>
      </section>

      <section className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
        <SectionHeading eyebrow="How it works" title="Four steps." />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[3px] border border-paper-rule bg-paper-rule sm:grid-cols-2 lg:grid-cols-4">
          {s.steps.map(([t, d], i) => (
            <li key={t} className="bg-paper-card p-6">
              <span className="font-plexmono text-[13px] text-stamp">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-3 font-serif text-[20px] font-medium">{t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-paper-rule">
        <div className={cx('mx-auto max-w-[1680px] py-14', PAGE_X)}>
          <p className="font-plexmono text-[11px] uppercase tracking-[0.18em] text-slate-500">Other solutions</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {OTHERS.map((o) => (
              <Link key={o.id} to={`/solutions/${o.id}`} className={cx('flex items-center gap-3 rounded-[3px] border p-4 text-[15px] transition-colors [&>svg]:size-[18px] [&>svg]:stroke-[1.6]', o.id === segment ? 'border-navy-900 bg-paper-card font-medium' : 'border-paper-rule hover:border-navy-300')}>
                {o.icon} {o.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
