/** Public home page — printed-document ("paper") aesthetic. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Banknote, Landmark, Package } from 'lucide-react';
import { cx } from '../components/ui';
import { msg, useTr } from '../locale';
import { SectionHeading } from '../marketing/Chrome';
import { Faq, FAQS, PricingShowcase } from '../marketing/Blocks';
import { Credit, PhotoBand, PhotoPrint } from '../marketing/Photo';
import { PHOTOS } from '../marketing/photos';
import { PreflightDemo, VerifyDrop } from '../marketing/LiveDemos';
import { Hero } from '../marketing/Hero';
import { DeparturesSection } from '../marketing/Departures';
import { BorderDay, EasySteps, FriendlyStats, GoodsMarquee, MobileSection, TrustSection } from '../marketing/Sections';
import { AppWindow, DocumentStack, PhoneVerifier, ScreeningCard, ValidationCard } from '../marketing/Illustrations';

const TOUR: Array<{ id: string; label: string; title: string; body: string; points: string[]; art: ReactNode; to: string }> = [
  {
    id: 'generate', label: msg('Generate'), title: msg('One record, every document'),
    body: msg('Enter the shipment once — or import the lines from a spreadsheet. The commercial invoice, EAC certificate of origin and packing list are produced from the same data, so they always agree.'),
    points: [msg('Address book for exporters and buyers'), msg('Tariff suggestions from the EAC CET'), msg('Simplified certificate for small consignments')],
    art: <AppWindow className="w-full max-w-[560px]" />, to: '/product#generate',
  },
  {
    id: 'validate', label: msg('Validate'), title: msg('Catch the errors that stop trucks'),
    body: msg('While you type, every detail is checked against the rules of the border you’ll cross — tax numbers, product codes, weights and the permits your goods need.'),
    points: [msg('Errors block issue; warnings need acknowledgement'), msg('Each rule cites its source and review date'), msg('Duty your buyer saves with a valid certificate')],
    art: <ValidationCard className="w-full max-w-[440px]" />, to: '/product#validate',
  },
  {
    id: 'anchor', label: msg('Seal'), title: msg('Sealed the moment it’s issued'),
    body: msg('The moment you issue, each document gets a digital seal. If anyone changes even one character later, the seal breaks — and everyone can see it.'),
    points: [msg('Any change to the file is detectable'), msg('Corrections replace the old copy openly'), msg('Proof you can check without trusting us')],
    art: <DocumentStack className="max-w-[440px]" />, to: '/product#anchor',
  },
  {
    id: 'verify', label: msg('Verify'), title: msg('Checked in seconds, by anyone'),
    body: msg('A border officer, bank or buyer scans the QR code or drops the file. No account, no phone call to the exporter — and a page in their own language.'),
    points: [msg('English, French, Kiswahili and Kinyarwanda'), msg('Shows authority endorsement where given'), msg('You see who checked your documents')],
    art: <PhoneVerifier />, to: '/verify',
  },
  {
    id: 'screen', label: msg('Screen'), title: msg('Screen what you receive'),
    body: msg('Received a certificate from a supplier or partner? SealChain looks for altered copies, fabricated references, editing traces and fraud reported across the network.'),
    points: [msg('Matches against issued originals'), msg('Seal comparison with known references'), msg('The genuine issuer is alerted automatically')],
    art: <ScreeningCard className="w-full max-w-[440px]" />, to: '/product#screen',
  },
];

function ProductTour() {
  const { tr } = useTr();
  const [tab, setTab] = useState(TOUR[0]!.id);
  const t = TOUR.find((x) => x.id === tab)!;
  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow={tr('Product tour')} title={tr('Take a closer look.')} body={tr('Five things SealChain does for every shipment.')} />
        <div role="tablist" className="mt-10 flex gap-1 overflow-x-auto border-b border-paper-rule">
          {TOUR.map((x, i) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={cx('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[14px] transition-colors', tab === x.id ? 'border-stamp font-medium text-ink' : 'border-transparent text-slate-500 hover:text-ink')}
            >
              <span className="font-plexmono text-[11px] text-stamp">{String(i + 1).padStart(2, '0')}</span> {tr(x.label)}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="grid items-center gap-12 pt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <h3 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em]">{tr(t.title)}</h3>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-600">{tr(t.body)}</p>
            <ul className="mt-6 space-y-2.5">
              {t.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[15px] text-slate-700"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-stamp" />{tr(p)}</li>
              ))}
            </ul>
            <Link to={t.to} className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink underline-offset-4 hover:underline">{tr('Learn more')} <ArrowRight className="size-4" /></Link>
          </div>
          <div className="paper-grid flex min-h-[400px] items-center justify-center rounded-[3px] border border-paper-rule p-6 sm:p-10">{t.art}</div>
        </div>
      </div>
    </section>
  );
}


const MODES = [
  { photo: PHOTOS.truckNileBridge, n: '01', t: msg('By road'), d: msg('Through Gatuna, Kagitumba, Rusumo, Akanyaru-Haut and Nemba. Border posts, transit countries and cargo-tracking requirements are checked for each corridor.'), tilt: -1.5 },
  { photo: PHOTOS.freighter, n: '02', t: msg('By air'), d: msg('Perishables and high-value goods out of Kigali International Airport, with air exit and entry points on every rule set.'), tilt: 1 },
  { photo: PHOTOS.shipMombasa, n: '03', t: msg('Onward by sea'), d: msg('Through Mombasa and Dar es Salaam to the rest of the world — with the right terms for goods that travel by ship.'), tilt: -1 },
];

const AUDIENCES = [
  { icon: <Package />, t: msg('Exporters & SMEs'), d: msg('Get documents right first time, avoid penalties and demurrage, and give buyers proof they can trust.'), to: '/solutions/exporters', photo: PHOTOS.teaPicker },
  { icon: <Landmark />, t: msg('Issuing authorities'), d: msg('Review certificate requests in a queue and endorse them digitally — endorsements are signed and anchored too.'), to: '/solutions/authorities', photo: PHOTOS.kigaliAirport },
  { icon: <Banknote />, t: msg('Banks, buyers & insurers'), d: msg('Confirm the certificate behind a payment, letter of credit or claim is genuine — in seconds, for free.'), to: '/solutions/verifiers', photo: PHOTOS.kigaliSkyline },
];



export function Landing() {
  const { tr, trx } = useTr();
  return (
    <>
      <Hero />

      <GoodsMarquee />

      <EasySteps />

      <PreflightDemo />

      <BorderDay />

      <PhotoBand photo={PHOTOS.portTruck}>
        <div className="mx-auto flex min-h-[520px] max-w-[1680px] flex-col justify-center px-5 py-20 sm:px-8 lg:px-12 2xl:px-16">
          <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-navy-200">{tr('Port of Mombasa · Northern Corridor')}</p>
          <h2 className="mt-5 max-w-2xl font-serif text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[52px]">
            {trx('Every container that crosses a border travels on {paper}.', { paper: <em className="font-medium text-[#f3b4ad]">{tr('paper')}</em> })}
          </h2>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-navy-100">
            {tr('Invoices, certificates and packing lists decide how fast goods move and what duty is paid. SealChain makes sure they’re right — and that anyone can prove they’re real.')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/product" className="inline-flex h-11 items-center gap-2 rounded-[3px] bg-[#f8f5ee] px-6 text-[14px] font-medium text-[#0b1f3a] hover:bg-[#fffdf8]">{tr('See the product')} <ArrowRight className="size-4" /></Link>
            <Link to="/corridors" className="inline-flex h-11 items-center rounded-[3px] border border-white/30 px-6 text-[14px] font-medium text-white hover:bg-white/10">{tr('Our corridors')}</Link>
          </div>
        </div>
      </PhotoBand>

      {/* -------------------------------------------------------- modes */}
      <section className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow={tr('Road · Air · Sea')} title={tr('However your goods travel, the paperwork goes with them.')} body={tr('Each shipment records its mode of transport, exit point and entry point — and the checks change with them.')} />
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {MODES.map((m) => (
            <article key={m.t}>
              <PhotoPrint photo={m.photo} tilt={m.tilt} ratio="aspect-[4/3]" />
              <div className="mt-8 flex items-baseline justify-between border-t-2 border-ink pt-4">
                <h3 className="font-serif text-[24px] font-medium">{tr(m.t)}</h3>
                <span className="font-plexmono text-[12px] text-stamp">{m.n}</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{tr(m.d)}</p>
            </article>
          ))}
        </div>
      </section>

      <MobileSection />

      <ProductTour />

      <FriendlyStats />

      {/* --------------------------------------------------- audiences */}
      <section className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow={tr('Who it’s for')} title={tr('One record, three kinds of trust.')} body={tr('Exporters prepare, authorities approve, and everyone down the line checks — all looking at the same sealed document.')} />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <Link key={a.t} to={a.to} className="lift group flex flex-col overflow-hidden rounded-[3px] border border-paper-rule bg-paper-card transition-colors hover:border-navy-300">
              <div className="relative aspect-[16/10] overflow-hidden border-b border-paper-rule">
                <img src={a.photo.sm} alt={a.photo.alt} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] [filter:saturate(0.92)]" />
                <Credit photo={a.photo} light plain className="absolute bottom-2 right-3 max-w-[60%] truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]" />
                <span className="absolute bottom-3 left-3 flex size-10 items-center justify-center rounded-full bg-paper-card text-ink shadow [&>svg]:size-[18px] [&>svg]:stroke-[1.6]">{a.icon}</span>
              </div>
              <div className="flex flex-1 flex-col p-7">
                <h3 className="font-serif text-[22px] font-medium">{tr(a.t)}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-slate-600">{tr(a.d)}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium">{tr('Explore')} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <DeparturesSection />

      <TrustSection />

      {/* ------------------------------------------------ verify drop */}
      <section className="mx-auto grid max-w-[1680px] grid-cols-1 items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:px-12 2xl:px-16">
        <div className="min-w-0">
          <SectionHeading
            eyebrow={tr('For buyers, banks and border officers')}
            title={tr('Received a certificate? Check it in two seconds.')}
            body={tr('Anyone can check a SealChain document — free, with no account. If even one character was changed, you’ll know.')}
          />
          <Link to="/verify" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-4 hover:underline">{tr('Scan a QR code or enter a document number instead')} <ArrowRight className="size-4" /></Link>
        </div>
        <VerifyDrop />
      </section>

      <PricingShowcase />

      {/* ---------------------------------------------------------- faq */}
      <section className="mx-auto grid max-w-[1680px] gap-12 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <SectionHeading
          eyebrow={tr('Questions')}
          title={tr('Asked at the border, answered here.')}
          body={trx('Something else? {link}.', { link: <Link to="/contact" className="font-medium text-ink underline underline-offset-4">{tr('Ask us directly')}</Link> })}
        />
        <Faq items={FAQS.slice(0, 5)} />
      </section>
    </>
  );
}
