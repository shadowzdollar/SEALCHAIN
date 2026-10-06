/**
 * Landing hero — deliberately minimal: one message, two actions, and one
 * realistic picture of what SealChain does (a real port, a real verification
 * result). The earlier animated "TV" hero is in git history (b0f49ab).
 */
import { Link } from 'react-router';
import { ArrowRight, Globe2, Lock, ScanLine, ShieldCheck } from 'lucide-react';
import { useTr } from '../locale';
import { PHOTOS } from './photos';

const photo = PHOTOS.portCranes;

export function Hero() {
  const { tr, trx } = useTr();
  return (
    <section className="no-rv border-b border-paper-rule bg-paper">
      <div className="mx-auto grid max-w-[1680px] grid-cols-1 items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:px-12 lg:pb-24 lg:pt-20 2xl:px-16">
        <div className="min-w-0">
          <p className="font-plexmono text-[11.5px] uppercase tracking-[0.18em] text-slate-500">{tr('Rwanda · Kenya · Uganda · Tanzania · Burundi')}</p>
          <h1 className="mt-5 max-w-[15ch] font-serif text-[42px] font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[56px] xl:text-[64px]">
            {trx('Your container shouldn’t wait at the border for a {typo}.', { typo: <em className="font-medium text-stamp">{tr('typo')}</em> })}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[18px] leading-relaxed text-slate-600">
            {tr('Export documents that are right the first time — and that anyone can prove are real, in seconds, at any border.')}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/register" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink pl-6 pr-5 text-[15px] font-medium text-ink-contrast transition-opacity hover:opacity-90">
              {tr('Start your first shipment')} <ArrowRight className="size-4" />
            </Link>
            <Link to="/verify" className="inline-flex h-12 items-center gap-2 rounded-full border border-paper-rule bg-paper-card px-6 text-[15px] font-medium text-ink transition-colors hover:border-ink/40">
              <ScanLine className="size-4" /> {tr('Verify a document')}
            </Link>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] text-slate-600">
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-slate-400" />{tr('Verification is always free')}</li>
            <li className="flex items-center gap-2"><Lock className="size-4 text-slate-400" />{tr('Trade data never goes on-chain')}</li>
            <li className="flex items-center gap-2"><Globe2 className="size-4 text-slate-400" />{tr('English, Français, Kiswahili, Ikinyarwanda')}</li>
          </ul>
        </div>

        <figure className="relative min-w-0 pb-10 sm:pb-12">
          <img
            src={photo.src}
            alt={photo.alt}
            fetchPriority="high"
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_30px_60px_-35px_rgba(11,31,58,0.55)]"
          />
          {/* What a buyer or officer actually sees after scanning the QR code. */}
          <div className="absolute bottom-0 left-4 right-4 rounded-xl border border-paper-rule bg-paper-card p-4 shadow-[0_20px_40px_-24px_rgba(11,31,58,0.5)] sm:left-auto sm:right-6 sm:w-[340px]">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><ShieldCheck className="size-5" /></span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink">{tr('Authentic')}</p>
                <p className="truncate text-[12.5px] text-slate-500">{tr('EAC Certificate of Origin')} · SC-RWKE-CO-2026-00012</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-paper-rule pt-3 text-[12px]">
              <dt className="text-slate-500">{tr('Exporter')}</dt><dd className="truncate text-right text-ink">Huye Highlands Coffee</dd>
              <dt className="text-slate-500">{tr('Issued')}</dt><dd className="text-right text-ink">29 Sept 2026</dd>
            </dl>
          </div>
          <figcaption className="mt-3 hidden font-plexmono text-[10px] text-slate-400 sm:block">
            {photo.place} · {photo.author} · {photo.license}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
