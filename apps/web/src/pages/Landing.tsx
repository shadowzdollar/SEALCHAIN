import { Link } from 'react-router';
import { ArrowRight, CheckCircle2, FileCheck2, Fingerprint, Globe2, Lock, ScanSearch, ShieldCheck, Stamp, Workflow } from 'lucide-react';
import { Logo, ThemeToggle } from '../components/Layout';
import { Button } from '../components/ui';
import { useMeta } from '../auth';

export function Landing() {
  const billing = useMeta().data?.billing;
  const monthly = billing ? billing.monthlyFeeCents / 100 : 15;
  const perShipment = billing ? billing.perShipmentCents / 100 : 3;
  return (
    <div className="min-h-dvh bg-white dark:bg-navy-950">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-brand-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-56 left-1/4 size-[30rem] rounded-full bg-accent-500/10 blur-3xl" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Logo light />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/verify" className="hidden rounded-md px-3 py-2 text-[13px] font-medium text-navy-200 hover:text-white sm:block">Verify a document</Link>
            <Link to="/login" className="rounded-md px-3 py-2 text-[13px] font-medium text-navy-200 hover:text-white">Sign in</Link>
            <Link to="/register"><Button size="sm">Start pilot</Button></Link>
          </nav>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pb-28 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium text-navy-100">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Piloting on EAC corridors from Rwanda
            </p>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-[52px]">
              Trade documents that clear the border — and prove they’re genuine.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-navy-200">
              SealChain prepares your commercial invoice, EAC certificate of origin and packing list from a single record, validates them against the corridor’s rules, and anchors every document on a public blockchain so customs, banks and buyers can verify it in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register"><Button size="lg" icon={<ArrowRight className="size-4" />}>Create your first shipment</Button></Link>
              <Link to="/verify">
                <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 text-sm font-medium text-white hover:bg-white/10">
                  <ScanSearch className="size-4" /> Verify a document
                </button>
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-navy-300">
              {['No trade data on-chain', 'Verifiable without an account', 'Built for EAC rules of origin'].map((t) => (
                <span key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400" /> {t}</span>
              ))}
            </div>
          </div>

          {/* product preview */}
          <div className="relative">
            <div className="rounded-xl border border-white/10 bg-white p-5 text-slate-900 shadow-2xl shadow-navy-950/50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Verification result</p>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">Authentic</span>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <ShieldCheck className="size-9 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">EAC Certificate of Origin</p>
                  <p className="font-mono text-[12px] text-slate-500">SC-RWKE-CO-2026-00041</p>
                  <p className="mt-1 text-[13px] text-slate-600">Endorsed by Rwanda Revenue Authority — Customs</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-[13px]">
                {['File identical to what was issued', 'Issuer signature valid · Ed25519', 'Merkle proof reproduces the anchored root', 'Root confirmed on-chain · block time recorded'].map((x) => (
                  <li key={x} className="flex items-center gap-2 text-slate-700"><CheckCircle2 className="size-4 text-emerald-600" /> {x}</li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center">
                {[['Exporter', 'Kigali'], ['Consignee', 'Nairobi'], ['Duty protected', 'USD 24,181']].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">{k}</p>
                    <p className="mt-0.5 text-[13px] font-medium">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ corridors */}
      <section className="border-b border-slate-200 bg-white dark:border-navy-800 dark:bg-navy-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-6 sm:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500">Corridors supported</p>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[14px] font-medium text-slate-700 dark:text-navy-200">
            {['Rwanda → Kenya', 'Rwanda → Uganda', 'Rwanda → Tanzania', 'Rwanda → Burundi'].map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- features */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="eyebrow text-brand-700 dark:text-brand-300">Platform</p>
          <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.02em]">Three layers of assurance for every consignment</h2>
          <p className="mt-3 text-slate-600 dark:text-navy-300">From the first draft to the border post — and for documents your partners send you.</p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3 dark:border-navy-700 dark:bg-navy-700">
          {[
            { icon: <FileCheck2 />, title: 'Compliant documents', body: 'Tariff suggestions, pre-filled EAC forms and 40+ pre-submission checks — tax IDs, weights, Incoterms, rules of origin and required permits for the corridor.' },
            { icon: <Fingerprint />, title: 'Provable authenticity', body: 'Every PDF is fingerprinted, signed and anchored on a public blockchain. Issuing authorities can endorse certificates on the same record.' },
            { icon: <ScanSearch />, title: 'Fraud detection', body: 'Check certificates you receive for altered copies, fabricated references, editing traces, conflicting versions and known fraud reported across the network.' },
          ].map((f) => (
            <div key={f.title} className="bg-white p-7 dark:bg-navy-900">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-navy-800 dark:text-brand-300 [&>svg]:size-5">{f.icon}</div>
              <h3 className="mt-5 text-[16px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-navy-300">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Stamp />, t: 'Authority endorsement', d: 'Officers endorse certificates in their own workspace.' },
            { icon: <Workflow />, t: 'API & webhooks', d: 'Connect your TMS or ERP with signed events.' },
            { icon: <Globe2 />, t: 'Four languages', d: 'Verifier in English, French, Kiswahili, Kinyarwanda.' },
            { icon: <Lock />, t: 'Private by design', d: 'Only 32-byte fingerprints go on-chain.' },
          ].map((x) => (
            <div key={x.t} className="flex gap-3 rounded-lg border border-slate-200 p-4 dark:border-navy-700">
              <span className="text-brand-700 dark:text-brand-300 [&>svg]:size-5">{x.icon}</span>
              <div><p className="text-[14px] font-medium">{x.t}</p><p className="mt-0.5 text-[13px] text-slate-500 dark:text-navy-300">{x.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- how it works */}
      <section className="border-y border-slate-200 bg-surface dark:border-navy-800 dark:bg-navy-900/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <p className="eyebrow text-brand-700 dark:text-brand-300">How verification works</p>
          <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.02em]">Trust that doesn’t depend on trusting us</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              ['Issue', 'Documents are generated from one shipment record, so invoice, certificate and packing list always agree.'],
              ['Fingerprint & sign', 'The SHA-256 of each exact PDF is signed with SealChain’s published issuer key.'],
              ['Anchor', 'Fingerprints are batched into a Merkle tree; only the root is written to a public blockchain.'],
              ['Verify', 'Anyone scans the QR code or drops the file. The browser recomputes the proof and can query the chain directly.'],
            ].map(([t, d], i) => (
              <li key={t} className="relative">
                <span className="flex size-8 items-center justify-center rounded-full bg-navy-900 text-[13px] font-semibold text-white dark:bg-brand-700">{i + 1}</span>
                <p className="mt-4 font-semibold">{t}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600 dark:text-navy-300">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- pricing */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid items-center gap-10 rounded-2xl bg-navy-900 px-8 py-10 text-white md:grid-cols-[1.2fr_1fr] md:px-12">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">Pilot pricing</p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">Pay for what you ship</h2>
            <p className="mt-3 text-navy-200">A modest subscription plus a per-shipment fee for validation and anchoring. Corrections and re-issues are always free.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-end justify-between gap-6">
              <div><p className="text-[32px] font-semibold leading-none">${monthly}</p><p className="mt-1.5 text-[13px] text-navy-300">per month</p></div>
              <div className="text-navy-400">+</div>
              <div><p className="text-[32px] font-semibold leading-none">${perShipment}</p><p className="mt-1.5 text-[13px] text-navy-300">per shipment</p></div>
            </div>
            <Link to="/register" className="mt-6 block"><Button size="lg" className="w-full" icon={<ArrowRight className="size-4" />}>Join the pilot</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-navy-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-[13px] text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between dark:text-navy-300">
          <Logo />
          <p className="max-w-2xl">SealChain proves a document has not changed since issue and who issued it; authority endorsement is shown where the issuing authority has confirmed it. Rules and tariff rates show when they were last verified.</p>
          <ThemeToggle />
        </div>
      </footer>
    </div>
  );
}
