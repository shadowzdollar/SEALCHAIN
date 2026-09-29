/** Public home page — printed-document ("paper") aesthetic. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Banknote, FileCheck2, Fingerprint, KeyRound, Landmark, Lock, Package, ScanSearch, ShieldCheck, Webhook } from 'lucide-react';
import { cx } from '../components/ui';
import { msg, useTr } from '../locale';
import { Eyebrow, INK_BTN, PAPER_BTN, SectionHeading } from '../marketing/Chrome';
import { FactsStrip, Faq, FAQS, Feature, PricingShowcase } from '../marketing/Blocks';
import { Credit, PhotoBand, PhotoPrint } from '../marketing/Photo';
import { PHOTOS } from '../marketing/photos';
import { AppWindow, CodeSheet, CorridorMap, DocumentStack, EndorsementCard, MerkleDiagram, PhoneVerifier, ScreeningCard, ValidationCard } from '../marketing/Illustrations';

const TOUR: Array<{ id: string; label: string; title: string; body: string; points: string[]; art: ReactNode; to: string }> = [
  {
    id: 'generate', label: msg('Generate'), title: msg('One record, every document'),
    body: msg('Enter the shipment once — or import the lines from a spreadsheet. The commercial invoice, EAC certificate of origin and packing list are produced from the same data, so they always agree.'),
    points: [msg('Address book for exporters and buyers'), msg('Tariff suggestions from the EAC CET'), msg('Simplified certificate for small consignments')],
    art: <AppWindow className="w-full max-w-[560px]" />, to: '/product#generate',
  },
  {
    id: 'validate', label: msg('Validate'), title: msg('Catch the errors that stop trucks'),
    body: msg('Every draft is checked live against the corridor’s rules: tax ID formats, HS codes against descriptions, weights, Incoterms, origin criteria and the permits your goods need.'),
    points: [msg('Errors block issue; warnings need acknowledgement'), msg('Each rule cites its source and review date'), msg('Duty your buyer saves with a valid certificate')],
    art: <ValidationCard className="w-full max-w-[440px]" />, to: '/product#validate',
  },
  {
    id: 'anchor', label: msg('Anchor'), title: msg('Sealed the moment it’s issued'),
    body: msg('Each PDF is fingerprinted and signed with SealChain’s published key. Fingerprints are batched into a Merkle tree and only the root is written to a public blockchain.'),
    points: [msg('Any change to the file is detectable'), msg('Re-issues supersede — never silently replace'), msg('Proof you can check without trusting us')],
    art: <MerkleDiagram className="max-w-[520px]" />, to: '/product#anchor',
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
        <SectionHeading eyebrow={tr('Product tour')} title={tr('From draft to border post — and back.')} body={tr('Five steps, one record. Follow a consignment through SealChain.')} />
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

const CORRIDOR_ROWS: Array<[string, string, string]> = [
  [msg('Rwanda → Kenya'), msg('Gatuna → Malaba (transit Uganda)'), 'RW-KE'],
  [msg('Rwanda → Uganda'), 'Gatuna → Katuna', 'RW-UG'],
  [msg('Rwanda → Tanzania'), 'Rusumo', 'RW-TZ'],
  [msg('Rwanda → Burundi'), 'Akanyaru-Haut · Nemba', 'RW-BI'],
];

/** Corridor list beside the real map; hovering a corridor traces its route. */
function CorridorsSection() {
  const { tr } = useTr();
  const [hl, setHl] = useState<string | null>(null);
  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className="mx-auto grid max-w-[1680px] items-center gap-12 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <SectionHeading eyebrow={tr('Corridors')} title={tr('Built for the EAC, starting from Kigali.')} body={tr('Each corridor carries its own rule set — border posts, tax ID formats, required permits and the simplified-certificate threshold — and shows when our compliance team last verified it.')} />
          <ul className="mt-8 divide-y divide-paper-rule border-y border-paper-rule" onMouseLeave={() => setHl(null)}>
            {CORRIDOR_ROWS.map(([c, b, id]) => (
              <li key={c}>
                <Link to={`/corridors#${id}`} onMouseEnter={() => setHl(id)} onFocus={() => setHl(id)} className={cx('flex items-center justify-between gap-4 px-2 py-3.5 transition-colors', hl === id ? 'bg-paper-tint' : 'hover:bg-paper-tint')}>
                  <span className="font-serif text-[17px] font-medium">{tr(c)}</span>
                  <span className="text-right text-[13.5px] text-slate-500">{tr(b)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-slate-500">{tr('Hover a corridor to trace its road route.')}</p>
        </div>
        <CorridorMap highlight={hl} className="rounded-[3px] border border-paper-rule" />
      </div>
    </section>
  );
}

const BUILT_ON = [msg('EAC Rules of Origin'), msg('EAC Common External Tariff'), msg('Ed25519 signatures'), msg('SHA-256 Merkle proofs'), msg('Public blockchain anchoring')];

const MODES = [
  { photo: PHOTOS.truckNileBridge, n: '01', t: msg('By road'), d: msg('Through Gatuna, Kagitumba, Rusumo, Akanyaru-Haut and Nemba. Border posts, transit countries and cargo-tracking requirements are checked for each corridor.'), tilt: -1.5 },
  { photo: PHOTOS.freighter, n: '02', t: msg('By air'), d: msg('Perishables and high-value goods out of Kigali International Airport, with air exit and entry points on every rule set.'), tilt: 1 },
  { photo: PHOTOS.shipMombasa, n: '03', t: msg('Onward by sea'), d: msg('Through Mombasa and Dar es Salaam. Sea-only Incoterms such as FOB and CIF are flagged when goods don’t actually travel by sea.'), tilt: -1 },
];

const AUDIENCES = [
  { icon: <Package />, t: msg('Exporters & SMEs'), d: msg('Get documents right first time, avoid penalties and demurrage, and give buyers proof they can trust.'), to: '/solutions/exporters', photo: PHOTOS.teaPicker },
  { icon: <Landmark />, t: msg('Issuing authorities'), d: msg('Review certificate requests in a queue and endorse them digitally — endorsements are signed and anchored too.'), to: '/solutions/authorities', photo: PHOTOS.kigaliAirport },
  { icon: <Banknote />, t: msg('Banks, buyers & insurers'), d: msg('Confirm the certificate behind a payment, letter of credit or claim is genuine — in seconds, for free.'), to: '/solutions/verifiers', photo: PHOTOS.kigaliSkyline },
];

const STEPS: Array<[string, string]> = [
  [msg('Issue'), msg('Documents come from one shipment record, so invoice, certificate and packing list always agree.')],
  [msg('Fingerprint & sign'), msg('The SHA-256 of each exact PDF is signed with SealChain’s published Ed25519 key.')],
  [msg('Anchor'), msg('Fingerprints are batched into a Merkle tree; only its root is written to the chain.')],
  [msg('Endorse'), msg('Where the issuing authority is on SealChain, its officers endorse the certificate — and that endorsement is anchored too.')],
  [msg('Verify'), msg('The verifier recomputes the proof in the browser and can query the chain directly.')],
];

const SECURITY = [
  { icon: <Lock />, t: msg('Nothing sensitive on-chain'), d: msg('Only batch fingerprints are public.') },
  { icon: <KeyRound />, t: msg('Published issuer key'), d: msg('Signatures anyone can check.') },
  { icon: <ShieldCheck />, t: msg('Hardened by default'), d: msg('Strict headers, rate limits, hashed keys.') },
  { icon: <Webhook />, t: msg('Signed webhooks'), d: msg('HMAC signatures with replay protection.') },
];

export function Landing() {
  const { tr, trx } = useTr();
  return (
    <>
      {/* ----------------------------------------------------------- hero */}
      <section className="paper-grid border-b border-paper-rule">
        <div className="mx-auto grid grid-cols-1 max-w-[1680px] items-center gap-16 px-5 pb-24 pt-16 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pb-32 lg:pt-24">
          <div className="min-w-0">
            <Eyebrow>{tr('Rwanda · Kenya · Uganda · Tanzania · Burundi')}</Eyebrow>
            <h1 className="mt-5 font-serif text-[44px] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[60px] lg:text-[66px]">
              {trx('Your container shouldn’t wait at the border for a {typo}.', { typo: <em className="font-medium text-stamp">{tr('typo')}</em> })}
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-600">
              {tr('SealChain builds the export documents your shipment needs, catches errors while they’re cheap to fix, and seals each one with proof that it hasn’t been altered since issue.')}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/register" className={INK_BTN}>{tr('Start your first shipment')} <ArrowRight className="size-4" /></Link>
              <Link to="/verify" className={PAPER_BTN}>{tr('Verify a document')}</Link>
            </div>
            <p className="mt-6 text-[13px] text-slate-500">{tr('Verification is always free — no account needed.')}</p>
          </div>
          <div className="relative mx-auto w-full min-w-0 max-w-[640px] lg:ml-auto lg:mr-0">
            <PhotoPrint photo={PHOTOS.portCranes} size="lg" priority tilt={-4} className="w-[74%]" caption={tr('Port of Mombasa')} />
            <DocumentStack className="-mt-40 mr-0 w-[86%] sm:-mt-52 lg:ml-auto" />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- built on */}
      <div className="border-b border-paper-rule">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6 font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500 sm:px-8 lg:px-12 2xl:px-16">
          {BUILT_ON.map((t) => <span key={t}>{tr(t)}</span>)}
        </div>
      </div>

      {/* ------------------------------------------------------ pillars */}
      <section id="product" className="mx-auto max-w-[1680px] scroll-mt-20 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          <Feature n="01" icon={<FileCheck2 />} title={tr('Generate & validate')}>
            {tr('Invoice, EAC certificate of origin and packing list from one shipment record — checked against the corridor’s rules for tax IDs, HS codes, weights, Incoterms and required permits before anything is printed.')}
          </Feature>
          <Feature n="02" icon={<Fingerprint />} title={tr('Anchor at issuance')}>
            {tr('Each PDF is fingerprinted, signed with our published issuer key and anchored on a public blockchain. Only a 32-byte hash leaves our servers — never your trade data.')}
          </Feature>
          <Feature n="03" icon={<ScanSearch />} title={tr('Screen what you receive')}>
            {tr('Drop in a certificate from a supplier or partner. We look for altered copies, fabricated references, editing traces and fraud reported across the network.')}
          </Feature>
        </div>
      </section>

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

      <ProductTour />

      <section className="mx-auto max-w-[1680px] px-5 pt-24 sm:px-8 lg:px-12 2xl:px-16">
        <FactsStrip />
      </section>

      {/* --------------------------------------------------- audiences */}
      <section className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow={tr('Who it’s for')} title={tr('One record, three kinds of trust.')} body={tr('Exporters prepare, authorities endorse, and everyone downstream verifies — all against the same anchored document.')} />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <Link key={a.t} to={a.to} className="group flex flex-col overflow-hidden rounded-[3px] border border-paper-rule bg-paper-card transition-colors hover:border-navy-300">
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

      <CorridorsSection />

      {/* ------------------------------------------------ how it works */}
      <section className="mx-auto grid max-w-[1680px] gap-12 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <SectionHeading eyebrow={tr('How verification works')} title={tr('Trust that doesn’t depend on trusting us.')} body={tr('Customs officers, banks and buyers check a document themselves — by scanning its QR code or dropping the file — with no account and no call to the exporter.')} />
          <EndorsementCard className="mt-12 max-w-[380px]" />
        </div>
        <ol className="divide-y divide-paper-rule self-start border-y border-paper-rule">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 py-5">
              <span className="font-plexmono text-[13px] text-stamp">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="font-serif text-[19px] font-medium">{tr(t)}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{tr(d)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------- security + developers */}
      <section className="border-y border-paper-rule bg-paper-card">
        <div className="mx-auto grid max-w-[1680px] gap-16 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow={tr('Security')} title={tr('Private by design.')} body={tr('Your commercial terms are yours. We designed SealChain so that proving a document is genuine never requires publishing it.')} />
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {SECURITY.map((x) => (
                <li key={x.t} className="flex gap-3">
                  <span className="mt-0.5 text-ink [&>svg]:size-[18px] [&>svg]:stroke-[1.6]">{x.icon}</span>
                  <div><p className="font-medium">{tr(x.t)}</p><p className="mt-0.5 text-[14px] text-slate-600">{tr(x.d)}</p></div>
                </li>
              ))}
            </ul>
            <Link to="/security" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-4 hover:underline">{tr('Security & trust')} <ArrowRight className="size-4" /></Link>
          </div>
          <div>
            <SectionHeading eyebrow={tr('Developers')} title={tr('The same engine, as an API.')} />
            <CodeSheet
              className="mt-8"
              title={tr('Issue a shipment’s documents')}
              code={`curl -H "Authorization: Bearer $KEY" \\
     -d @shipment.json $API/shipments
# → { "id": "shp_…", "validation": { … } }

curl -H "Authorization: Bearer $KEY" \\
     -d '{"acknowledgeWarnings": true}' \\
     $API/shipments/shp_…/issue`}
            />
            <Link to="/developers" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-4 hover:underline">{tr('Developer guide')} <ArrowRight className="size-4" /></Link>
          </div>
        </div>
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
