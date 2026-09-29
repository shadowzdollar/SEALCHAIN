/** About, Changelog, Status, legal pages and 404. */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, FileCheck2, Fingerprint, RefreshCw, ScanSearch } from 'lucide-react';
import { cx } from '../../components/ui';
import { dateTime } from '../../format';
import { Eyebrow, INK_BTN, PAGE_X, PAPER_BTN, PageHero, SectionHeading, STATE_DOT, STATE_LABEL, useStatus } from '../Chrome';
import { Bullets, Feature } from '../Blocks';
import { CorridorMap, DocumentStack, Stamp } from '../Illustrations';
import { PhotoBand, PhotoPrint } from '../Photo';
import { PHOTOS, type Photo } from '../photos';

// ------------------------------------------------------------------ About
export function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About SealChain"
        title={<>Trade runs on paper. We’re making the paper <em className="font-medium text-stamp">trustworthy</em>.</>}
        body="Small and medium exporters in the East African Community lose days and money to documents: a wrong code, a missing permit, a certificate nobody can check. And forged documents cost everyone who relies on them."
        art={<DocumentStack />}
      />
      <section className={cx('mx-auto grid max-w-[1680px] gap-12 py-24 lg:grid-cols-2', PAGE_X)}>
        <SectionHeading eyebrow="Why we exist" title="The border shouldn’t be where mistakes are found." />
        <div className="space-y-5 text-[16px] leading-relaxed text-slate-700">
          <p>The EAC customs union made preferential trade possible — but the benefit depends on paperwork. A certificate of origin decides whether a buyer pays the community rate or the full external tariff. A single inconsistency between an invoice and a packing list can hold a truck at the border.</p>
          <p>Large traders have compliance teams for this. Most exporters don’t. And because documents travel as scans and photos, a genuine certificate and an edited one look exactly the same.</p>
          <p>SealChain puts the compliance check at the exporter’s desk and makes every document provable — to customs, to banks and to buyers — without anyone having to trust us.</p>
        </div>
      </section>
      <PhotoBand photo={PHOTOS.teaFields} minH="min-h-[460px]">
        <div className={cx('mx-auto flex min-h-[460px] max-w-[1680px] flex-col justify-center py-20', PAGE_X)}>
          <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-navy-200">Nyabihu · Western Rwanda</p>
          <h2 className="mt-5 max-w-2xl font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[46px]">It starts on a hillside, and it should arrive without a query.</h2>
        </div>
      </PhotoBand>
      <section className="border-y border-paper-rule bg-paper-card">
        <div className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
          <SectionHeading eyebrow="Our approach" title="Three layers of assurance." />
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            <Feature n="01" icon={<FileCheck2 />} title="Get it right">Generate documents from one record and check them against the corridor’s rules before they’re printed.</Feature>
            <Feature n="02" icon={<Fingerprint />} title="Make it provable">Sign and anchor every document at issue, so any change is detectable by anyone.</Feature>
            <Feature n="03" icon={<ScanSearch />} title="Catch the fakes">Screen documents from outside SealChain and share fraud signals across the network.</Feature>
          </div>
        </div>
      </section>
      <section className={cx('mx-auto grid max-w-[1680px] items-center gap-12 py-24 lg:grid-cols-2', PAGE_X)}>
        <div>
          <SectionHeading eyebrow="What we believe" title="Principles we build by." />
          <div className="mt-8">
            <Bullets items={[
              'Honesty over hype — we say what a proof shows, and what it doesn’t.',
              'Rules must be current. A stale rule set is worse than none, so every rule shows when it was verified.',
              'Your trade data is yours. Proof never requires publishing it.',
              'Built for the exporter with one laptop and a phone, not only for large traders.',
              'Works in the languages people at the border actually use.',
            ]} />
          </div>
        </div>
        <div className="relative">
          <PhotoPrint photo={PHOTOS.kigaliSkyline} tilt={2} className="absolute -right-2 -top-16 z-10 hidden w-56 sm:block" caption="Kigali" />
          <CorridorMap className="rounded-[3px] border border-paper-rule bg-paper-card" />
          <p className="mt-3 text-center font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">Piloting on four corridors from Rwanda</p>
        </div>
      </section>
      <section className="border-t border-paper-rule bg-paper-card">
        <div className={cx('mx-auto flex max-w-[1680px] flex-col gap-6 py-16 sm:flex-row sm:items-center sm:justify-between', PAGE_X)}>
          <SectionHeading eyebrow="Work with us" title="Exporters, authorities, banks and associations." body="We’re looking for partners to shape the pilot with us." />
          <Link to="/contact" className={cx(INK_BTN, 'shrink-0')}>Get in touch <ArrowRight className="size-4" /></Link>
        </div>
      </section>
    </>
  );
}

// -------------------------------------------------------------- Changelog
const CHANGES: Array<{ tag: 'New' | 'Improved'; title: string; body: string; to?: string }> = [
  { tag: 'New', title: 'Pay your statement online', body: 'Owners can pay the monthly statement by MTN MoMo, Airtel Money or card, in Rwandan francs, and download a PDF receipt for every payment.', to: '/help/billing-and-payment' },
  { tag: 'New', title: 'Notifications', body: 'A bell in the app tells you when buyers, banks or officers check your documents, open shared links, or when documents are anchored — with a choice of which ones also arrive by email.' },
  { tag: 'New', title: 'Two-step sign-in and device sessions', body: 'Protect your account with an authenticator app and recovery codes, and sign out devices you don’t recognise.', to: '/help/two-step-sign-in' },
  { tag: 'New', title: 'Company profile and invoice numbering', body: 'Set your company details and shipment defaults once; take invoice numbers from a sequence that never repeats.', to: '/help/set-up-your-company' },
  { tag: 'New', title: 'Reports and exports', body: 'Monthly shipments, export value, duty protected and verifications, with CSV exports of shipments, the document register and verifications.' },
  { tag: 'New', title: 'Help centre', body: 'Step-by-step guides for exporters, buyers, banks and officers.', to: '/help' },
  { tag: 'Improved', title: 'Branded emails', body: 'Invitations, alerts and receipts now arrive as clear, branded emails with a button for the next step.' },
  { tag: 'New', title: 'A new public site', body: 'Product, solutions, pricing, corridors, security and developer pages, a live status page and a contact form that reaches our team.', to: '/product' },
  { tag: 'Improved', title: 'Paper-and-ink design', body: 'The whole app now reads like the documents it produces: paper backgrounds, serif headings and a clearer layout.' },
  { tag: 'New', title: 'Rwanda → Tanzania and Rwanda → Burundi', body: 'Four corridors from Rwanda now have maintained rule sets, including border posts, tax ID formats and permits.', to: '/corridors' },
  { tag: 'New', title: 'Simplified certificate of origin', body: 'Small consignments under the STR threshold can use the simplified EAC certificate, pre-filled from the shipment.' },
  { tag: 'New', title: 'Authority endorsement', body: 'Issuing authorities review and endorse certificates in their own workspace. Endorsements are signed and anchored.', to: '/solutions/authorities' },
  { tag: 'New', title: 'API keys and signed webhooks', body: 'Connect your own systems. Events for issued, anchored, revoked and tampered documents and endorsement decisions.', to: '/developers' },
  { tag: 'New', title: 'Sign in with Google and Apple', body: 'Plus team invites, roles and password reset.' },
  { tag: 'Improved', title: 'Network fraud intelligence', body: 'Screening now flags conflicting copies and fraud reported across SealChain, and alerts the genuine issuer.' },
  { tag: 'New', title: 'Verifier in four languages', body: 'English, French, Kiswahili and Kinyarwanda. Kiswahili and Kinyarwanda texts are under native-speaker review.', to: '/verify' },
];

export function ChangelogPage() {
  return (
    <>
      <PageHero eyebrow="Changelog" title="What’s new in SealChain." body="Product updates as we build the pilot with exporters and authorities." />
      <section className={cx('mx-auto max-w-4xl py-20', PAGE_X)}>
        <div className="grid gap-8 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="sm:sticky sm:top-24 sm:self-start">
            <p className="font-serif text-[22px] font-semibold">September 2026</p>
            <p className="font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">Pilot build</p>
          </div>
          <ol className="divide-y divide-paper-rule border-y border-paper-rule">
            {CHANGES.map((c) => (
              <li key={c.title} className="py-6">
                <span className={cx('rounded-[2px] px-1.5 py-0.5 font-plexmono text-[10.5px] uppercase tracking-[0.12em]', c.tag === 'New' ? 'bg-stamp text-white' : 'border border-paper-rule text-slate-600')}>{c.tag}</span>
                <h2 className="mt-3 font-serif text-[21px] font-medium">{c.title}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{c.body}</p>
                {c.to && <Link to={c.to} className="mt-2 inline-flex items-center gap-1 text-[14px] font-medium underline-offset-4 hover:underline">Learn more <ArrowRight className="size-3.5" /></Link>}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

// ----------------------------------------------------------------- Status
export function StatusPage() {
  const q = useStatus(60_000);
  const s = q.data;
  return (
    <>
      <section className="paper-grid border-b border-paper-rule">
        <div className={cx('mx-auto max-w-4xl pb-16 pt-14', PAGE_X)}>
          <Eyebrow>System status</Eyebrow>
          <h1 className="mt-5 font-serif text-[40px] font-semibold tracking-[-0.02em] sm:text-[48px]">Is SealChain working?</h1>
          <div className={cx('mt-8 flex items-center gap-4 rounded-[3px] border-2 p-5', !s ? 'border-paper-rule bg-paper-card' : s.overall === 'operational' ? 'border-emerald-300 bg-emerald-50' : s.overall === 'degraded' ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50')}>
            <span className={cx('size-3 rounded-full', s ? STATE_DOT[s.overall] : 'bg-slate-300')} />
            <p className="font-serif text-[22px] font-semibold">{q.isError ? 'Status unavailable — the API could not be reached' : s ? STATE_LABEL[s.overall] : 'Checking…'}</p>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-500">
            <RefreshCw className={cx('size-3.5', q.isFetching && 'animate-spin')} /> {s ? `Checked ${dateTime(s.checkedAt)} · refreshes every minute` : 'Checking now'}
          </p>
        </div>
      </section>
      <section className={cx('mx-auto max-w-4xl py-16', PAGE_X)}>
        <ul className="divide-y divide-paper-rule overflow-hidden rounded-[3px] border border-paper-rule bg-paper-card">
          {(s?.components ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <span className="text-[15px] font-medium">{c.name}</span>
              <span className="flex items-center gap-2 text-[14px] capitalize text-slate-600"><span className={cx('size-2 rounded-full', STATE_DOT[c.state])} />{c.state}</span>
            </li>
          ))}
        </ul>
        {s && (
          <dl className="mt-8 grid gap-px overflow-hidden rounded-[3px] border border-paper-rule bg-paper-rule sm:grid-cols-3">
            {[
              ['Anchoring network', s.anchoring.network],
              ['Last anchored', s.anchoring.lastAnchoredAt ? dateTime(s.anchoring.lastAnchoredAt) : '—'],
              ['Awaiting anchor', String(s.anchoring.awaitingAnchor)],
            ].map(([k, v]) => (
              <div key={k} className="bg-paper-card p-5">
                <dt className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">{k}</dt>
                <dd className="mt-2 font-serif text-[20px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-12">
          <p className="font-plexmono text-[11px] uppercase tracking-[0.16em] text-slate-500">Incident history</p>
          <p className="mt-3 text-[15px] text-slate-600">Incidents and maintenance will be posted here. Documents already issued remain verifiable from their on-chain anchor even if SealChain is unavailable — see <Link to="/developers#independent" className="underline underline-offset-4">independent verification</Link>.</p>
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ Legal
function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <section className="paper-grid border-b border-paper-rule">
        <div className={cx('mx-auto max-w-3xl pb-14 pt-14', PAGE_X)}>
          <Eyebrow>Legal</Eyebrow>
          <h1 className="mt-5 font-serif text-[40px] font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-3 text-[14px] text-slate-500">Last updated {updated}</p>
        </div>
      </section>
      <article className={cx('mx-auto max-w-3xl py-14 text-[15.5px] leading-relaxed text-slate-700 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-[22px] [&_h2]:font-medium [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5', PAGE_X)}>
        <div className="rounded-[3px] border border-amber-300 bg-amber-50 p-4 text-[14px] text-amber-900">
          Pilot draft — this text is under legal review and may change before general availability. Questions? <Link to="/contact" className="underline">Contact us</Link>.
        </div>
        {children}
      </article>
    </>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy notice" updated="September 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address, organisation and role; sign-in provider identifiers if you use Google or Apple.</li>
        <li>Shipment data you enter: parties, goods, values and the documents generated from them.</li>
        <li>Documents you upload for screening, and the resulting reports.</li>
        <li>Verification events: when a document you issued is verified or a share link is opened, including the approximate source.</li>
        <li>Messages you send us through the contact form.</li>
      </ul>
      <h2>What we publish</h2>
      <p>Only a 32-byte Merkle root per batch of documents is written to a public blockchain. It cannot be reversed into document contents. Verification pages show the particulars of a document to people who hold its link or file.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To generate, validate, sign, anchor and share your documents.</li>
        <li>To detect altered or fraudulent copies and alert the genuine issuer.</li>
        <li>To bill for the service and to support you.</li>
        <li>To keep the service secure, including audit logs and rate limiting.</li>
      </ul>
      <p>We do not sell personal data or use your trade data for advertising.</p>
      <h2>Sharing</h2>
      <p>We share data with the people you choose (share links, authority endorsement requests) and with service providers that help us run SealChain, such as hosting and email delivery, under contract. We may disclose data where the law requires it.</p>
      <h2>Retention and your rights</h2>
      <p>Issued documents are kept so that they stay verifiable. You can ask for a copy of your personal data, its correction or deletion of data we are not required to keep, in line with applicable data-protection law, including Rwanda’s law on the protection of personal data and privacy.</p>
      <h2>Contact</h2>
      <p>Write to us through the <Link to="/contact" className="underline">contact page</Link>.</p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of service" updated="September 2026">
      <h2>The service</h2>
      <p>SealChain helps you prepare trade documents, checks them against maintained rule sets, and makes them verifiable. It supports, and does not replace, your clearing agent, the issuing authorities and customs, who remain responsible for their decisions.</p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>The information you enter must be true and complete; you remain the declarant of your documents.</li>
        <li>Keep your account and API keys secure, and revoke keys you no longer use.</li>
        <li>Do not use SealChain to create misleading documents or to test other people’s systems without permission.</li>
      </ul>
      <h2>Rules and checks</h2>
      <p>Rule sets and tariff notes show when they were last verified. Draft rule sets are guidance only. Checks reduce errors but cannot guarantee acceptance at the border.</p>
      <h2>Verification</h2>
      <p>A verification shows that a file is identical to what was issued through SealChain and when it was anchored. Authority endorsement is shown only where the authority confirmed it. Verification does not certify the truth of a document’s contents.</p>
      <h2>Fees</h2>
      <p>Pilot fees are shown on the pricing page and on your monthly statement. The per-shipment fee applies when a shipment’s documents are first issued.</p>
      <h2>Changes and termination</h2>
      <p>We may update these terms as the pilot progresses and will tell you about material changes. You may stop using SealChain at any time; documents already issued stay verifiable.</p>
    </LegalShell>
  );
}

// -------------------------------------------------------------------- 404
export function NotFoundPage() {
  return (
    <section className="paper-grid">
      <div className={cx('mx-auto flex max-w-3xl flex-col items-center py-28 text-center', PAGE_X)}>
        <Stamp tick={false} className="rotate-[-6deg] !text-[18px]">Not found</Stamp>
        <h1 className="mt-10 font-serif text-[40px] font-semibold tracking-[-0.02em]">This page isn’t in the file.</h1>
        <p className="mt-4 max-w-md text-[16px] text-slate-600">The link may be old or mistyped. If you were checking a document, use the verifier instead.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className={INK_BTN}>Go home</Link>
          <Link to="/verify" className={PAPER_BTN}>Verify a document</Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Credits
export function CreditsPage() {
  const list = Object.values(PHOTOS) as Photo[];
  return (
    <>
      <PageHero eyebrow="Photo credits" title="The pictures on this site." body="Photographs come from Wikimedia Commons under the licences shown. They have been resized and recompressed for the web; no other changes were made. Map geography: Natural Earth 1:50m countries and lakes (public domain, naturalearthdata.com); routes on the map are indicative." />
      <section className={cx('mx-auto grid max-w-[1680px] gap-10 py-20 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', PAGE_X)}>
        {list.map((p) => (
          <figure key={p.src}>
            <PhotoPrint photo={p} tape={false} />
            <figcaption className="mt-3 text-[13.5px] leading-snug text-slate-600">
              <p className="text-ink">{p.alt}</p>
              <p className="mt-1">{p.author} · {p.licenseUrl ? <a href={p.licenseUrl} target="_blank" rel="noreferrer" className="underline">{p.license}</a> : p.license} · <a href={p.source} target="_blank" rel="noreferrer" className="underline">Source</a></p>
            </figcaption>
          </figure>
        ))}
      </section>
    </>
  );
}
