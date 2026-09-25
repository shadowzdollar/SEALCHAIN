/** Public home page — printed-document ("paper") aesthetic. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Banknote, FileCheck2, Fingerprint, KeyRound, Landmark, Lock, Package, ScanSearch, ShieldCheck, Webhook } from 'lucide-react';
import { cx } from '../components/ui';
import { Eyebrow, INK_BTN, PAPER_BTN, SectionHeading } from '../marketing/Chrome';
import { FactsStrip, Faq, FAQS, Feature, PricingShowcase } from '../marketing/Blocks';
import { Credit, PhotoBand, PhotoPrint } from '../marketing/Photo';
import { PHOTOS } from '../marketing/photos';
import { AppWindow, CodeSheet, CorridorMap, DocumentStack, EndorsementCard, MerkleDiagram, PhoneVerifier, ScreeningCard, ValidationCard } from '../marketing/Illustrations';

const TOUR: Array<{ id: string; label: string; title: string; body: string; points: string[]; art: ReactNode; to: string }> = [
  {
    id: 'generate', label: 'Generate', title: 'One record, every document',
    body: 'Enter the shipment once — or import the lines from a spreadsheet. The commercial invoice, EAC certificate of origin and packing list are produced from the same data, so they always agree.',
    points: ['Address book for exporters and buyers', 'Tariff suggestions from the EAC CET', 'Simplified certificate for small consignments'],
    art: <AppWindow className="w-full max-w-[560px]" />, to: '/product#generate',
  },
  {
    id: 'validate', label: 'Validate', title: 'Catch the errors that stop trucks',
    body: 'Every draft is checked live against the corridor’s rules: tax ID formats, HS codes against descriptions, weights, Incoterms, origin criteria and the permits your goods need.',
    points: ['Errors block issue; warnings need acknowledgement', 'Each rule cites its source and review date', 'Duty your buyer saves with a valid certificate'],
    art: <ValidationCard className="w-full max-w-[440px]" />, to: '/product#validate',
  },
  {
    id: 'anchor', label: 'Anchor', title: 'Sealed the moment it’s issued',
    body: 'Each PDF is fingerprinted and signed with SealChain’s published key. Fingerprints are batched into a Merkle tree and only the root is written to a public blockchain.',
    points: ['Any change to the file is detectable', 'Re-issues supersede — never silently replace', 'Proof you can check without trusting us'],
    art: <MerkleDiagram className="max-w-[520px]" />, to: '/product#anchor',
  },
  {
    id: 'verify', label: 'Verify', title: 'Checked in seconds, by anyone',
    body: 'A border officer, bank or buyer scans the QR code or drops the file. No account, no phone call to the exporter — and a page in their own language.',
    points: ['English, French, Kiswahili and Kinyarwanda', 'Shows authority endorsement where given', 'You see who checked your documents'],
    art: <PhoneVerifier />, to: '/verify',
  },
  {
    id: 'screen', label: 'Screen', title: 'Screen what you receive',
    body: 'Received a certificate from a supplier or partner? SealChain looks for altered copies, fabricated references, editing traces and fraud reported across the network.',
    points: ['Matches against issued originals', 'Seal comparison with known references', 'The genuine issuer is alerted automatically'],
    art: <ScreeningCard className="w-full max-w-[440px]" />, to: '/product#screen',
  },
];

function ProductTour() {
  const [tab, setTab] = useState(TOUR[0]!.id);
  const t = TOUR.find((x) => x.id === tab)!;
  return (
    <section className="border-y border-paper-rule bg-paper-card">
      <div className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow="Product tour" title="From draft to border post — and back." body="Five steps, one record. Follow a consignment through SealChain." />
        <div role="tablist" className="mt-10 flex gap-1 overflow-x-auto border-b border-paper-rule">
          {TOUR.map((x, i) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={cx('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[14px] transition-colors', tab === x.id ? 'border-stamp font-medium text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-900')}
            >
              <span className="font-plexmono text-[11px] text-stamp">{String(i + 1).padStart(2, '0')}</span> {x.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="grid items-center gap-12 pt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <h3 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em]">{t.title}</h3>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-600">{t.body}</p>
            <ul className="mt-6 space-y-2.5">
              {t.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[15px] text-slate-700"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-stamp" />{p}</li>
              ))}
            </ul>
            <Link to={t.to} className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-navy-900 underline-offset-4 hover:underline">Learn more <ArrowRight className="size-4" /></Link>
          </div>
          <div className="paper-grid flex min-h-[400px] items-center justify-center rounded-[3px] border border-paper-rule p-6 sm:p-10">{t.art}</div>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <>
      {/* ----------------------------------------------------------- hero */}
      <section className="paper-grid border-b border-paper-rule">
        <div className="mx-auto grid grid-cols-1 max-w-[1680px] items-center gap-16 px-5 pb-24 pt-16 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pb-32 lg:pt-24">
          <div className="min-w-0">
            <Eyebrow>Rwanda · Kenya · Uganda · Tanzania · Burundi</Eyebrow>
            <h1 className="mt-5 font-serif text-[44px] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[60px] lg:text-[66px]">
              Your container shouldn’t wait at the border for a <em className="font-medium text-stamp">typo</em>.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-600">
              SealChain builds the export documents your shipment needs, catches errors while they’re cheap to fix, and seals each one with proof that it hasn’t been altered since issue.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/register" className={INK_BTN}>Start your first shipment <ArrowRight className="size-4" /></Link>
              <Link to="/verify" className={PAPER_BTN}>Verify a document</Link>
            </div>
            <p className="mt-6 text-[13px] text-slate-500">Verification is always free — no account needed.</p>
          </div>
          <div className="relative mx-auto w-full min-w-0 max-w-[640px] lg:ml-auto lg:mr-0">
            <PhotoPrint photo={PHOTOS.portCranes} size="lg" priority tilt={-4} className="w-[74%]" caption="Port of Mombasa" />
            <DocumentStack className="-mt-40 mr-0 w-[86%] sm:-mt-52 lg:ml-auto" />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- built on */}
      <div className="border-b border-paper-rule">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6 font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500 sm:px-8 lg:px-12 2xl:px-16">
          {['EAC Rules of Origin', 'EAC Common External Tariff', 'Ed25519 signatures', 'SHA-256 Merkle proofs', 'Public blockchain anchoring'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ pillars */}
      <section id="product" className="mx-auto max-w-[1680px] scroll-mt-20 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          <Feature n="01" icon={<FileCheck2 />} title="Generate & validate">
            Invoice, EAC certificate of origin and packing list from one shipment record — checked against the corridor’s rules for tax IDs, HS codes, weights, Incoterms and required permits before anything is printed.
          </Feature>
          <Feature n="02" icon={<Fingerprint />} title="Anchor at issuance">
            Each PDF is fingerprinted, signed with our published issuer key and anchored on a public blockchain. Only a 32-byte hash leaves our servers — never your trade data.
          </Feature>
          <Feature n="03" icon={<ScanSearch />} title="Screen what you receive">
            Drop in a certificate from a supplier or partner. We look for altered copies, fabricated references, editing traces and fraud reported across the network.
          </Feature>
        </div>
      </section>

      <PhotoBand photo={PHOTOS.portTruck}>
        <div className="mx-auto flex min-h-[520px] max-w-[1680px] flex-col justify-center px-5 py-20 sm:px-8 lg:px-12 2xl:px-16">
          <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-navy-200">Port of Mombasa · Northern Corridor</p>
          <h2 className="mt-5 max-w-2xl font-serif text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[52px]">
            Every container that crosses a border travels on <em className="font-medium text-[#f3b4ad]">paper</em>.
          </h2>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-navy-100">
            Invoices, certificates and packing lists decide how fast goods move and what duty is paid. SealChain makes sure they’re right — and that anyone can prove they’re real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/product" className="inline-flex h-11 items-center gap-2 rounded-[3px] bg-paper px-6 text-[14px] font-medium text-navy-900 hover:bg-white">See the product <ArrowRight className="size-4" /></Link>
            <Link to="/corridors" className="inline-flex h-11 items-center rounded-[3px] border border-white/30 px-6 text-[14px] font-medium text-white hover:bg-white/10">Our corridors</Link>
          </div>
        </div>
      </PhotoBand>

      {/* -------------------------------------------------------- modes */}
      <section className="mx-auto max-w-[1680px] px-5 py-24 sm:px-8 lg:px-12 2xl:px-16">
        <SectionHeading eyebrow="Road · Air · Sea" title="However your goods travel, the paperwork goes with them." body="Each shipment records its mode of transport, exit point and entry point — and the checks change with them." />
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            { photo: PHOTOS.truckNileBridge, n: '01', t: 'By road', d: 'Through Gatuna, Kagitumba, Rusumo, Akanyaru-Haut and Nemba. Border posts, transit countries and cargo-tracking requirements are checked for each corridor.', tilt: -1.5 },
            { photo: PHOTOS.freighter, n: '02', t: 'By air', d: 'Perishables and high-value goods out of Kigali International Airport, with air exit and entry points on every rule set.', tilt: 1 },
            { photo: PHOTOS.shipMombasa, n: '03', t: 'Onward by sea', d: 'Through Mombasa and Dar es Salaam. Sea-only Incoterms such as FOB and CIF are flagged when goods don’t actually travel by sea.', tilt: -1 },
          ].map((m) => (
            <article key={m.t}>
              <PhotoPrint photo={m.photo} tilt={m.tilt} ratio="aspect-[4/3]" />
              <div className="mt-8 flex items-baseline justify-between border-t-2 border-navy-900 pt-4">
                <h3 className="font-serif text-[24px] font-medium">{m.t}</h3>
                <span className="font-plexmono text-[12px] text-stamp">{m.n}</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{m.d}</p>
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
        <SectionHeading eyebrow="Who it’s for" title="One record, three kinds of trust." body="Exporters prepare, authorities endorse, and everyone downstream verifies — all against the same anchored document." />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {[
            { icon: <Package />, t: 'Exporters & SMEs', d: 'Get documents right first time, avoid penalties and demurrage, and give buyers proof they can trust.', to: '/solutions/exporters', photo: PHOTOS.teaPicker },
            { icon: <Landmark />, t: 'Issuing authorities', d: 'Review certificate requests in a queue and endorse them digitally — endorsements are signed and anchored too.', to: '/solutions/authorities', photo: PHOTOS.kigaliAirport },
            { icon: <Banknote />, t: 'Banks, buyers & insurers', d: 'Confirm the certificate behind a payment, letter of credit or claim is genuine — in seconds, for free.', to: '/solutions/verifiers', photo: PHOTOS.kigaliSkyline },
          ].map((a) => (
            <Link key={a.t} to={a.to} className="group flex flex-col overflow-hidden rounded-[3px] border border-paper-rule bg-paper-card transition-colors hover:border-navy-300">
              <div className="relative aspect-[16/10] overflow-hidden border-b border-paper-rule">
                <img src={a.photo.sm} alt={a.photo.alt} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] [filter:saturate(0.92)]" />
                <Credit photo={a.photo} light plain className="absolute bottom-2 right-3 max-w-[60%] truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]" />
                <span className="absolute bottom-3 left-3 flex size-10 items-center justify-center rounded-full bg-paper-card text-navy-900 shadow [&>svg]:size-[18px] [&>svg]:stroke-[1.6]">{a.icon}</span>
              </div>
              <div className="flex flex-1 flex-col p-7">
              <h3 className="font-serif text-[22px] font-medium">{a.t}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-slate-600">{a.d}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium">Explore <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- corridors */}
      <section className="border-y border-paper-rule bg-paper-card">
        <div className="mx-auto grid max-w-[1680px] items-center gap-12 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Corridors" title="Built for the EAC, starting from Kigali." body="Each corridor carries its own rule set — border posts, tax ID formats, required permits and the simplified-certificate threshold — and shows when our compliance team last verified it." />
            <ul className="mt-8 divide-y divide-paper-rule border-y border-paper-rule">
              {[
                ['Rwanda → Kenya', 'Gatuna → Malaba (transit Uganda)', 'RW-KE'],
                ['Rwanda → Uganda', 'Gatuna → Katuna', 'RW-UG'],
                ['Rwanda → Tanzania', 'Rusumo', 'RW-TZ'],
                ['Rwanda → Burundi', 'Akanyaru-Haut · Nemba', 'RW-BI'],
              ].map(([c, b, id]) => (
                <li key={c}>
                  <Link to={`/corridors#${id}`} className="flex items-center justify-between gap-4 py-3.5 hover:text-navy-700">
                    <span className="font-serif text-[17px] font-medium">{c}</span>
                    <span className="text-right text-[13.5px] text-slate-500">{b}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <CorridorMap className="rounded-[3px] border border-paper-rule bg-paper" />
        </div>
      </section>

      {/* ------------------------------------------------ how it works */}
      <section className="mx-auto grid max-w-[1680px] gap-12 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <SectionHeading eyebrow="How verification works" title="Trust that doesn’t depend on trusting us." body="Customs officers, banks and buyers check a document themselves — by scanning its QR code or dropping the file — with no account and no call to the exporter." />
          <EndorsementCard className="mt-12 max-w-[380px]" />
        </div>
        <ol className="divide-y divide-paper-rule self-start border-y border-paper-rule">
          {[
            ['Issue', 'Documents come from one shipment record, so invoice, certificate and packing list always agree.'],
            ['Fingerprint & sign', 'The SHA-256 of each exact PDF is signed with SealChain’s published Ed25519 key.'],
            ['Anchor', 'Fingerprints are batched into a Merkle tree; only its root is written to the chain.'],
            ['Endorse', 'Where the issuing authority is on SealChain, its officers endorse the certificate — and that endorsement is anchored too.'],
            ['Verify', 'The verifier recomputes the proof in the browser and can query the chain directly.'],
          ].map(([t, d], i) => (
            <li key={t} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 py-5">
              <span className="font-plexmono text-[13px] text-stamp">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="font-serif text-[19px] font-medium">{t}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------- security + developers */}
      <section className="border-y border-paper-rule bg-paper-card">
        <div className="mx-auto grid max-w-[1680px] gap-16 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Security" title="Private by design." body="Your commercial terms are yours. We designed SealChain so that proving a document is genuine never requires publishing it." />
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {[
                { icon: <Lock />, t: 'Nothing sensitive on-chain', d: 'Only batch fingerprints are public.' },
                { icon: <KeyRound />, t: 'Published issuer key', d: 'Signatures anyone can check.' },
                { icon: <ShieldCheck />, t: 'Hardened by default', d: 'Strict headers, rate limits, hashed keys.' },
                { icon: <Webhook />, t: 'Signed webhooks', d: 'HMAC signatures with replay protection.' },
              ].map((x) => (
                <li key={x.t} className="flex gap-3">
                  <span className="mt-0.5 text-navy-900 [&>svg]:size-[18px] [&>svg]:stroke-[1.6]">{x.icon}</span>
                  <div><p className="font-medium">{x.t}</p><p className="mt-0.5 text-[14px] text-slate-600">{x.d}</p></div>
                </li>
              ))}
            </ul>
            <Link to="/security" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-4 hover:underline">Security & trust <ArrowRight className="size-4" /></Link>
          </div>
          <div>
            <SectionHeading eyebrow="Developers" title="The same engine, as an API." />
            <CodeSheet
              className="mt-8"
              title="Issue a shipment’s documents"
              code={`curl -H "Authorization: Bearer $KEY" \\
     -d @shipment.json $API/shipments
# → { "id": "shp_…", "validation": { … } }

curl -H "Authorization: Bearer $KEY" \\
     -d '{"acknowledgeWarnings": true}' \\
     $API/shipments/shp_…/issue`}
            />
            <Link to="/developers" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-4 hover:underline">Developer guide <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      <PricingShowcase />

      {/* ---------------------------------------------------------- faq */}
      <section className="mx-auto grid max-w-[1680px] gap-12 px-5 py-24 sm:px-8 lg:px-12 2xl:px-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <SectionHeading eyebrow="Questions" title="Asked at the border, answered here." body={<>Something else? <Link to="/contact" className="font-medium text-navy-900 underline underline-offset-4">Ask us directly</Link>.</>} />
        <Faq items={FAQS.slice(0, 5)} />
      </section>
    </>
  );
}
