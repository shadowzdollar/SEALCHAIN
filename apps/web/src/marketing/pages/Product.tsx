import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Bell, FileSpreadsheet, Globe2, History, Languages, Link2, ListChecks, ScanLine, Share2, Stamp, Users } from 'lucide-react';
import { cx } from '../../components/ui';
import { INK_BTN, PAGE_X, PAPER_BTN, PageHero, SectionHeading } from '../Chrome';
import { Bullets } from '../Blocks';
import { AppWindow, DocumentStack, EndorsementCard, MerkleDiagram, PhoneVerifier, ScreeningCard, ValidationCard } from '../Illustrations';
import { PhotoBand, PhotoPrint } from '../Photo';
import { PHOTOS } from '../photos';
import { DocumentTrio } from '../PageExtras';

function Chapter({ id, n, eyebrow, title, body, points, art, flip, tint }: { id: string; n: string; eyebrow: string; title: string; body: ReactNode; points: ReactNode[]; art: ReactNode; flip?: boolean; tint?: boolean }) {
  return (
    <section id={id} className={cx('scroll-mt-20 border-b border-paper-rule', tint && 'bg-paper-card')}>
      <div className={cx('mx-auto grid max-w-[1680px] items-center gap-14 py-24 lg:grid-cols-2', PAGE_X)}>
        <div className={cx(flip && 'lg:order-2')}>
          <p className="font-plexmono text-[13px] text-stamp">{n}</p>
          <SectionHeading eyebrow={eyebrow} title={title} body={body} className="mt-2" />
          <div className="mt-8"><Bullets items={points} /></div>
        </div>
        <div className={cx('paper-grid flex min-h-[380px] items-center justify-center rounded-[3px] border border-paper-rule p-6 sm:p-10', flip && 'lg:order-1')}>{art}</div>
      </div>
    </section>
  );
}

export function ProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        title={<>Everything between the order and the <em className="font-medium text-stamp">border post</em>.</>}
        body="SealChain prepares compliant export documents, seals them at issue, and gives everyone downstream a way to check them — plus tools to screen the documents you receive."
        actions={<><Link to="/register" className={INK_BTN}>Start a shipment <ArrowRight className="size-4" /></Link><Link to="/contact?topic=pilot" className={PAPER_BTN}>Book a walkthrough</Link></>}
        art={<DocumentStack />}
      />

      <DocumentTrio />

      <nav className="sticky top-16 z-30 border-b border-paper-rule bg-paper/95 backdrop-blur" aria-label="On this page">
        <div className={cx('mx-auto flex max-w-[1680px] gap-6 overflow-x-auto py-3 text-[13.5px]', PAGE_X)}>
          {[['generate', 'Generate'], ['validate', 'Validate'], ['anchor', 'Anchor'], ['endorse', 'Endorse'], ['verify', 'Verify'], ['screen', 'Screen'], ['more', 'And more']].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="shrink-0 text-slate-600 hover:text-ink">{l}</a>
          ))}
        </div>
      </nav>

      <Chapter id="generate" n="01" eyebrow="Document generation" title="One record. Every document." tint
        body="Enter a shipment once and SealChain produces the commercial invoice, EAC certificate of origin and packing list — laid out the way customs officers expect, with a QR code on every page."
        points={['Import item lines from a spreadsheet (CSV)', 'Address book for exporters, consignees and notify parties', 'Simplified certificate of origin for consignments under the STR threshold', 'Duplicate last month’s shipment as a new draft']}
        art={<AppWindow className="w-full max-w-[560px]" />} />
      <Chapter id="validate" n="02" eyebrow="Pre-submission checks" title="The rule book, applied as you type." flip
        body="Every draft is checked live against the corridor’s rule set. Errors block issue; warnings must be acknowledged. Each rule says where it comes from and when it was last verified."
        points={['Tax ID formats for both sides of the border', 'HS codes compared with the goods description', 'Weights, packages, Incoterms and currency consistency', 'Rules of origin criteria and non-originating content', 'Permits and certificates the goods need, and who issues them']}
        art={<ValidationCard className="w-full max-w-[440px]" />} />
      <Chapter id="anchor" n="03" eyebrow="Blockchain anchoring" title="Sealed the moment it’s issued." tint
        body="The SHA-256 fingerprint of each exact PDF is signed with SealChain’s Ed25519 issuer key, then batched into a Merkle tree whose root is written to a public blockchain."
        points={['Any change to a file — even one character — is detectable', 'Re-issues supersede the old version; verifiers are pointed to the current one', 'Revocation with a stated reason, visible to verifiers', 'Only 32 bytes per batch go on-chain']}
        art={<MerkleDiagram className="max-w-[520px]" />} />
      <Chapter id="endorse" n="04" eyebrow="Authority endorsement" title="The authority’s stamp, on the same record." flip
        body="Where the issuing authority is on SealChain, exporters request endorsement of the certificate of origin and officers decide from their own queue. The endorsement is signed and anchored like the document itself."
        points={['A dedicated workspace for authority officers', 'Endorse or decline with a reason', 'Verifiers see the endorsement next to the document', 'Free for issuing authorities']}
        art={<EndorsementCard className="w-full max-w-[400px]" />} />
      <Chapter id="verify" n="05" eyebrow="Public verifier" title="Checked in seconds, by anyone." tint
        body="Scan the QR code or drop the PDF. The verifier compares the file with its record, checks the signature, recomputes the Merkle proof in the browser and can query the chain directly."
        points={['No account, no app to install', 'English, French, Kiswahili and Kinyarwanda', 'Identifies altered copies of issued documents', 'You see when your documents are checked, and by whom they were shared']}
        art={<PhoneVerifier />} />
      <Chapter id="screen" n="06" eyebrow="Fraud screening" title="Screen the documents you receive." flip
        body="Upload a certificate or invoice from a supplier, broker or buyer. SealChain looks for signs of alteration and fabrication and scores the risk."
        points={['Match against issued originals and conflicting copies', 'Editing traces in the PDF structure', 'Seal and stamp comparison against your references', 'Fraud reported across the SealChain network', 'The genuine issuer is alerted when an altered copy appears']}
        art={<ScreeningCard className="w-full max-w-[440px]" />} />

      <PhotoBand photo={PHOTOS.darHarbour}>
        <div className={cx('mx-auto flex min-h-[480px] max-w-[1680px] flex-col justify-center py-20', PAGE_X)}>
          <p className="font-plexmono text-[12px] uppercase tracking-[0.22em] text-navy-200">Dar es Salaam · Central Corridor</p>
          <h2 className="mt-5 max-w-2xl font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[46px]">One record follows the goods from the farm gate to the quay.</h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-navy-100">Whoever handles the consignment next — agent, officer, bank or buyer — checks the same anchored documents.</p>
        </div>
      </PhotoBand>

      <section id="more" className="scroll-mt-20">
        <div className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
          <SectionHeading eyebrow="And more" title="The details that make it work day to day." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-[3px] border border-paper-rule bg-paper-rule sm:grid-cols-2 lg:grid-cols-3">
            {[
              [<Share2 key="a" />, 'Share links', 'Send a buyer or bank one link to the whole bundle, with an expiry you choose.'],
              [<Users key="b" />, 'Teams & roles', 'Invite colleagues as owners or members; invites work over WhatsApp too.'],
              [<Bell key="c" />, 'Tamper alerts', 'Know when an altered copy of your document is presented anywhere.'],
              [<History key="d" />, 'Activity feed', 'See each time a buyer, bank or officer opens or verifies your documents.'],
              [<Link2 key="e" />, 'API & webhooks', 'Connect your ERP or TMS with API keys and signed events.'],
              [<FileSpreadsheet key="f" />, 'Billing statements', 'A clear monthly statement of shipments issued.'],
              [<ListChecks key="g" />, 'Managed rule sets', 'A compliance team keeps corridor rules and tariff notes current.'],
              [<Languages key="h" />, 'Four languages', 'Verifier in English, French, Kiswahili and Kinyarwanda.'],
              [<Globe2 key="i" />, 'Works anywhere', 'Installable on phones; light on data for border connections.'],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="bg-paper-card p-6">
                <span className="text-ink [&>svg]:size-5 [&>svg]:stroke-[1.6]">{icon}</span>
                <p className="mt-4 font-serif text-[18px] font-medium">{t}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/verify" className={PAPER_BTN}><ScanLine className="size-4" /> Try the verifier</Link>
            <Link to="/solutions/authorities" className={PAPER_BTN}><Stamp className="size-4" /> For authorities</Link>
          </div>
        </div>
      </section>
    </>
  );
}
