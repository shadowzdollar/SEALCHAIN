/**
 * Landing hero — enterprise pattern: one clear statement, a primary and a
 * sales action, and the real product (a screenshot of a shipment in the app),
 * followed by a proof row of facts we can stand behind.
 */
import { Link } from 'react-router';
import { Anchor, ArrowRight, ShieldCheck } from 'lucide-react';
import { msg, useTr } from '../locale';
import { INK_BTN, PAPER_BTN } from './Chrome';

const PROOF = [
  msg('EAC Rules of Origin'),
  msg('EAC Common External Tariff'),
  msg('Mobile money & cards via Flutterwave'),
  msg('Independent, public verification'),
];

export function Hero() {
  const { tr } = useTr();
  return (
    <section className="no-rv relative overflow-hidden border-b border-paper-rule bg-paper">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--color-ink)_7%,transparent),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1280px] px-5 pt-14 text-center sm:px-8 lg:pt-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-paper-rule bg-paper-card px-3 py-1 text-[12.5px] text-slate-600">
          <span className="size-1.5 rounded-full bg-emerald-600" /> {tr('Pilot open for exporters in Rwanda')}
        </p>
        <h1 className="mx-auto mt-6 max-w-[20ch] font-serif text-[40px] font-semibold leading-[1.06] tracking-[-0.025em] sm:text-[56px] lg:text-[64px]">
          {tr('Export documents, checked and sealed for every EAC border.')}
        </h1>
        <p className="mx-auto mt-6 max-w-[40rem] text-[17.5px] leading-relaxed text-slate-600">
          {tr('SealChain prepares your invoice, certificate of origin and packing list from one form, checks them against each corridor’s rules, and seals them so buyers, banks and customs can verify them in seconds.')}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/register" className={INK_BTN}>{tr('Start a shipment')} <ArrowRight className="size-4" /></Link>
          <Link to="/contact" className={PAPER_BTN}>{tr('Talk to sales')}</Link>
        </div>
        <p className="mt-4 text-[13px] text-slate-500">{tr('Verification is always free — no account needed.')}</p>

        {/* the product */}
        <figure className="relative mx-auto mt-14 max-w-[1120px] lg:mt-16">
          <div className="overflow-hidden rounded-t-xl border border-b-0 border-paper-rule bg-paper-card shadow-[0_40px_90px_-40px_rgba(11,31,58,0.45)]">
            <div className="flex items-center gap-2 border-b border-paper-rule bg-paper px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-slate-300" /><span className="size-2.5 rounded-full bg-slate-300" /><span className="size-2.5 rounded-full bg-slate-300" />
              <span className="mx-auto rounded-md bg-paper-card px-3 py-0.5 font-plexmono text-[11px] text-slate-500">SealChain · {tr('Shipment')} MCT-PO-0412</span>
            </div>
            <img
              src="/images/product/shipment.webp"
              alt={tr('A shipment in SealChain: three documents issued, sealed and anchored, with the corridor checks beside them')}
              width={1912}
              height={1229}
              fetchPriority="high"
              className="block w-full"
            />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper to-transparent" />

          {/* states the product really shows (verifier result, anchoring) */}
          <div className="float-a absolute -left-6 top-[34%] hidden w-[270px] rounded-2xl border border-paper-rule bg-paper-card p-4 text-left shadow-[0_24px_50px_-24px_rgba(11,31,58,0.55)] lg:block xl:-left-14">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><ShieldCheck className="size-5" /></span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink">{tr('Authentic')}</p>
                <p className="truncate font-plexmono text-[11px] text-slate-500">SC-RWKE-CO-2026-00013</p>
              </div>
            </div>
            <p className="mt-3 border-t border-paper-rule pt-2.5 text-[12px] text-slate-600">{tr('Checked by a buyer in Mombasa · 2 s')}</p>
          </div>
          <div className="float-b absolute -right-6 top-[62%] hidden w-[250px] rounded-2xl bg-ink p-4 text-left text-ink-contrast shadow-[0_24px_50px_-24px_rgba(11,31,58,0.7)] lg:block xl:-right-14">
            <p className="flex items-center gap-2 text-[12px] opacity-70"><Anchor className="size-3.5" /> {tr('Public ledger')}</p>
            <p className="mt-1.5 font-serif text-[22px] font-semibold">{tr('3 documents anchored')}</p>
            <p className="mt-0.5 text-[12px] opacity-70">{tr('One batch · fingerprints only')}</p>
          </div>
        </figure>
      </div>

      {/* proof row: only things that are true today */}
      <div className="relative border-t border-paper-rule bg-paper-card">
        <ul className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6 text-[13px] font-medium text-slate-500 sm:px-8">
          <li className="font-plexmono text-[10.5px] uppercase tracking-[0.18em] text-slate-400">{tr('Built around')}</li>
          {PROOF.map((p) => <li key={p}>{tr(p)}</li>)}
        </ul>
      </div>
    </section>
  );
}
