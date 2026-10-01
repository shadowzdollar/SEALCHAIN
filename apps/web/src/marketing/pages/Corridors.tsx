import { Link } from 'react-router';
import { ArrowRight, CircleAlert, CircleCheck } from 'lucide-react';
import { useMeta } from '../../auth';
import { PageLoader, cx } from '../../components/ui';
import { date } from '../../format';
import { INK_BTN, PAGE_X, PageHero } from '../Chrome';
import { CorridorMap } from '../Illustrations';
import { PhotoPrint } from '../Photo';
import { PHOTOS } from '../photos';
import { DeparturesSection } from '../Departures';

const COUNTRY: Record<string, string> = { RW: 'Rwanda', KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', BI: 'Burundi' };

export function CorridorsPage() {
  const meta = useMeta();
  return (
    <>
      <PageHero
        eyebrow="Corridors"
        title={<>Rule sets for the roads your goods <em className="font-medium text-stamp">actually</em> take.</>}
        body="Each corridor carries its own rules — border posts, tax ID formats, the documents and permits required, and the threshold for the simplified certificate. Every rule set shows when our compliance team last verified it."
        actions={<Link to="/register" className={INK_BTN}>Start a shipment <ArrowRight className="size-4" /></Link>}
        art={<CorridorMap className="rounded-[3px] border border-paper-rule bg-paper-card" />}
      />

      <DeparturesSection />
      <section className={cx('mx-auto grid max-w-[1680px] gap-10 pt-20 sm:grid-cols-3', PAGE_X)}>
        <PhotoPrint photo={PHOTOS.truckNileBridge} tilt={-1.5} caption="Road · Northern Uganda" />
        <PhotoPrint photo={PHOTOS.shipMombasa} tilt={1} caption="Sea · Mombasa" />
        <PhotoPrint photo={PHOTOS.darHarbour} tilt={-1} caption="Sea · Dar es Salaam" />
      </section>
      <section className={cx('mx-auto max-w-[1680px] space-y-8 py-24', PAGE_X)}>
        {meta.isLoading && <PageLoader />}
        {meta.data?.corridors.map((c) => (
          <article key={c.id} id={c.id} className="scroll-mt-24 overflow-hidden rounded-[3px] border border-paper-rule bg-paper-card">
            <header className="flex flex-col gap-4 border-b border-paper-rule p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">{c.id} · rule set {c.rulesetVersion}</p>
                <h2 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.015em]">{COUNTRY[c.origin] ?? c.origin} → {COUNTRY[c.destination] ?? c.destination}</h2>
              </div>
              {c.rulesetVerifiedAt ? (
                <span className="inline-flex items-center gap-2 text-[13px] text-emerald-800"><CircleCheck className="size-4" /> Verified {date(c.rulesetVerifiedAt)}</span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px] text-amber-700"><CircleAlert className="size-4" /> Draft — pending compliance review</span>
              )}
            </header>
            <dl className="grid gap-px bg-paper-rule sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Exit points', Object.entries(c.exitPoints).map(([m, v]) => `${m}: ${v.join(', ')}`)],
                ['Entry points', Object.entries(c.entryPoints).map(([m, v]) => `${m}: ${v.join(', ')}`)],
                ['Tax IDs', [`Exporter: ${c.taxId.exporter.label} (e.g. ${c.taxId.exporter.example})`, `Consignee: ${c.taxId.consignee.label} (e.g. ${c.taxId.consignee.example})`]],
                ['Parameters', [
                  `Simplified certificate up to USD ${c.params.strThresholdUsd.toLocaleString()}`,
                  `Non-originating content up to ${c.params.maxNonOriginatingPct}%`,
                  c.roadTransit.length ? `Road transit via ${c.roadTransit.map((x) => COUNTRY[x] ?? x).join(', ')}` : 'Direct road route',
                ]],
              ].map(([k, lines]) => (
                <div key={k as string} className="bg-paper-card p-6">
                  <dt className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">{k}</dt>
                  <dd className="mt-3 space-y-1.5 text-[14px] text-slate-700">
                    {(lines as string[]).map((l) => <p key={l}>{l}</p>)}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
        <p className="text-[13px] leading-relaxed text-slate-500">
          Rule sets support, and do not replace, your clearing agent and the customs authorities. Where a rule set is marked as draft, treat its requirements as guidance and confirm with your agent.
        </p>
      </section>
    </>
  );
}
