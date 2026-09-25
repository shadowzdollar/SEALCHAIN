/** Public landing page — printed-document ("paper") aesthetic. */
import { Link } from 'react-router';
import { ArrowRight, Check, FileCheck2, Fingerprint, ScanSearch } from 'lucide-react';
import { useMeta } from '../auth';
import { Logo } from '../components/Layout';

const INK_BTN =
  'inline-flex h-11 items-center gap-2 rounded-[3px] bg-navy-900 px-6 text-[14px] font-medium text-white shadow-[0_1px_0_rgba(0,0,0,0.25)] transition-colors hover:bg-navy-800';
const PAPER_BTN =
  'inline-flex h-11 items-center gap-2 rounded-[3px] border border-paper-rule bg-paper-card px-6 text-[14px] font-medium text-navy-900 shadow-[0_1px_0_rgba(11,31,58,0.06)] transition-colors hover:border-navy-300';

function Wordmark() {
  return <Link to="/"><Logo /></Link>;
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[13px] text-slate-500">{k}</p>
      <p className={mono ? 'font-plexmono text-[14px] text-navy-900' : 'text-[14px] text-navy-900'}>{v}</p>
    </div>
  );
}

/** The certificate "sheet" in the hero, with an invoice peeking out behind it. */
function CertificateSheet() {
  return (
    <div className="relative mx-auto w-full max-w-[480px] lg:mx-0 lg:ml-auto">
      {/* invoice underneath */}
      <div aria-hidden className="absolute inset-x-6 -top-7 bottom-8 rotate-[2.2deg] rounded-[2px] border border-paper-rule bg-paper-card shadow-[0_1px_2px_rgba(11,31,58,0.06)]">
        <div className="flex justify-between px-5 pt-2 font-plexmono text-[10.5px] text-slate-400">
          <span>INV-2026-0387</span><span>Commercial Invoice</span>
        </div>
      </div>
      <div className="relative rounded-[2px] border border-paper-rule bg-paper-card p-6 shadow-[0_1px_2px_rgba(11,31,58,0.06),0_12px_32px_-12px_rgba(11,31,58,0.18)]">
        <div className="flex items-center justify-between border-b border-paper-rule pb-3 font-plexmono text-[12px] text-slate-500">
          <span>COO-2026-1041</span>
          <span>EAC Rules of Origin</span>
        </div>
        <h3 className="mt-5 font-serif text-[21px] font-medium text-navy-900">Certificate of Origin</h3>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3.5">
          <Field k="Exporter" v="Huye Highlands Coffee" />
          <Field k="Consignee" v="Mombasa Roasters Co." />
          <Field k="HS code" v="0901.11.00" mono />
          <Field k="Criterion" v="WO — wholly obtained" />
        </div>
        <div className="mt-5 rounded-[2px] bg-paper-tint px-3 py-2.5 font-plexmono text-[11.5px] leading-relaxed text-slate-600">
          <p>sha256 · 9f2c…a41e</p>
          <p>merkle root · anchored on-chain</p>
        </div>
      </div>
      <div className="stamp absolute -bottom-12 right-2 rotate-[-7deg] bg-paper/70 sm:-right-4">
        Anchored <Check className="size-3.5" strokeWidth={2.5} />
      </div>
    </div>
  );
}

export function Landing() {
  const billing = useMeta().data?.billing;
  const monthly = billing ? billing.monthlyFeeCents / 100 : 15;
  const perShipment = billing ? billing.perShipmentCents / 100 : 3;

  return (
    <div className="min-h-dvh bg-paper font-plex text-navy-900 selection:bg-navy-900 selection:text-paper">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-20 border-b border-paper-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <nav className="hidden items-center gap-8 text-[14px] text-slate-600 md:flex">
            <a href="#product" className="font-medium text-navy-900 hover:text-navy-700">Product</a>
            <a href="#pricing" className="hover:text-navy-900">Pricing</a>
            <Link to="/verify" className="hover:text-navy-900">Verify a document</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/login" className="px-2 text-[14px] font-medium text-navy-900 hover:text-navy-700">Sign in</Link>
            <Link to="/register" className="inline-flex h-9 items-center rounded-[3px] bg-navy-900 px-4 text-[13px] font-medium text-white hover:bg-navy-800">
              Start a shipment
            </Link>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero */}
      <section className="paper-grid border-b border-paper-rule">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pb-32 lg:pt-28">
          <div className="min-w-0">
            <p className="font-plexmono text-[11px] uppercase tracking-[0.12em] text-slate-500 sm:text-[12px] sm:tracking-[0.22em]">Rwanda · Kenya · Uganda · Tanzania · Burundi</p>
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
          </div>
          <CertificateSheet />
        </div>
      </section>

      {/* ------------------------------------------------------- features */}
      <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          {[
            { n: '01', icon: <FileCheck2 />, t: 'Generate & validate', d: 'Invoice, EAC certificate of origin and packing list from one shipment record — checked against the corridor’s rules for tax IDs, HS codes, weights, Incoterms and required permits before anything is printed.' },
            { n: '02', icon: <Fingerprint />, t: 'Anchor at issuance', d: 'Each PDF is fingerprinted, signed with our published issuer key and anchored on a public blockchain. Only a 32-byte hash leaves our servers — never your trade data.' },
            { n: '03', icon: <ScanSearch />, t: 'Screen what you receive', d: 'Drop in a certificate from a supplier or partner. We look for altered copies, fabricated references, editing traces and fraud reported across the network.' },
          ].map((f) => (
            <article key={f.n} className="border-t-2 border-navy-900 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-navy-900 [&>svg]:size-5 [&>svg]:stroke-[1.6]">{f.icon}</span>
                <span className="font-plexmono text-[12px] text-slate-500">{f.n}</span>
              </div>
              <h2 className="mt-5 font-serif text-[26px] font-medium tracking-[-0.01em]">{f.t}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{f.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- how it works */}
      <section className="border-y border-paper-rule bg-paper-card">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-slate-500">How verification works</p>
            <h2 className="mt-4 font-serif text-[38px] font-semibold leading-[1.1] tracking-[-0.02em]">Trust that doesn’t depend on trusting us.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              Customs officers, banks and buyers check a document themselves — by scanning its QR code or dropping the file — with no account and no call to the exporter.
            </p>
          </div>
          <ol className="divide-y divide-paper-rule border-y border-paper-rule">
            {[
              ['Issue', 'Documents come from one shipment record, so invoice, certificate and packing list always agree.'],
              ['Fingerprint & sign', 'The SHA-256 of each exact PDF is signed with SealChain’s published Ed25519 key.'],
              ['Anchor', 'Fingerprints are batched into a Merkle tree; only its root is written to the chain.'],
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
        </div>
      </section>

      {/* ------------------------------------------------------ corridors */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-slate-500">Schedule of corridors</p>
            <h2 className="mt-4 font-serif text-[38px] font-semibold tracking-[-0.02em]">Built for the EAC, starting from Kigali.</h2>
          </div>
        </div>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] border-t-2 border-navy-900 text-left text-[15px]">
            <thead>
              <tr className="border-b border-paper-rule font-plexmono text-[11.5px] uppercase tracking-[0.12em] text-slate-500">
                <th className="py-3 pr-4 font-normal">Corridor</th>
                <th className="py-3 pr-4 font-normal">Road border posts</th>
                <th className="py-3 pr-4 font-normal">Documents</th>
                <th className="py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-rule">
              {[
                ['Rwanda → Kenya', 'Gatuna → Malaba (transit Uganda)', 'Invoice · CoO · Packing list'],
                ['Rwanda → Uganda', 'Gatuna → Katuna', 'Invoice · CoO · Packing list'],
                ['Rwanda → Tanzania', 'Rusumo', 'Invoice · CoO · Packing list'],
                ['Rwanda → Burundi', 'Akanyaru-Haut · Nemba', 'Invoice · CoO · Packing list'],
              ].map(([c, b, d]) => (
                <tr key={c}>
                  <td className="py-4 pr-4 font-serif text-[17px] font-medium">{c}</td>
                  <td className="py-4 pr-4 text-slate-600">{b}</td>
                  <td className="py-4 pr-4 text-slate-600">{d}</td>
                  <td className="py-4 font-plexmono text-[12px] uppercase tracking-[0.12em] text-emerald-800">Pilot open</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* -------------------------------------------------------- pricing */}
      <section id="pricing" className="paper-grid scroll-mt-20 border-y border-paper-rule">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-slate-500">Pilot pricing</p>
            <h2 className="mt-4 font-serif text-[38px] font-semibold leading-[1.1] tracking-[-0.02em]">Pay for what you ship.</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
              A modest subscription plus a per-shipment fee for validation and anchoring. Corrections and re-issues are always free. Issuing authorities use SealChain at no cost.
            </p>
          </div>
          {/* receipt */}
          <div className="relative mx-auto w-full max-w-[420px] rounded-[2px] border border-paper-rule bg-paper-card p-7 shadow-[0_12px_32px_-14px_rgba(11,31,58,0.2)] lg:mx-0 lg:ml-auto">
            <div className="flex justify-between border-b border-dashed border-paper-rule pb-3 font-plexmono text-[12px] text-slate-500">
              <span>STATEMENT · PILOT</span><span>USD</span>
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
            <Link to="/register" className={`${INK_BTN} mt-6 w-full justify-center`}>Join the pilot <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- footer */}
      <footer>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-[13px] text-slate-500 sm:px-8 md:flex-row md:items-start md:justify-between">
          <Wordmark />
          <p className="max-w-xl leading-relaxed">
            SealChain proves a document has not changed since issue and who issued it; authority endorsement is shown where the issuing authority has confirmed it. Rules and tariff rates show when they were last verified.
          </p>
          <div className="flex gap-5">
            <Link to="/verify" className="hover:text-navy-900">Verify</Link>
            <Link to="/login" className="hover:text-navy-900">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
