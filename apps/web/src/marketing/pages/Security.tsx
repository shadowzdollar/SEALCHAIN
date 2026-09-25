import { Link } from 'react-router';
import { ArrowRight, Eye, FileLock2, Fingerprint, KeyRound, ListChecks, Lock, ServerCog, ShieldCheck, UserCheck } from 'lucide-react';
import { useMeta } from '../../auth';
import { Hash, cx } from '../../components/ui';
import { INK_BTN, PAGE_X, PAPER_BTN, PageHero, SectionHeading } from '../Chrome';
import { Feature } from '../Blocks';
import { MerkleDiagram } from '../Illustrations';

export function SecurityPage() {
  const meta = useMeta().data;
  return (
    <>
      <PageHero
        eyebrow="Security & trust"
        title={<>Proof that never requires <em className="font-medium text-stamp">publishing</em> your trade.</>}
        body="SealChain exists so that people can trust documents without trusting a middleman. That starts with how we treat your data, our keys and the proofs we publish."
        actions={<><Link to="/developers#independent" className={INK_BTN}>Verify independently <ArrowRight className="size-4" /></Link><Link to="/contact?topic=other" className={PAPER_BTN}>Report a vulnerability</Link></>}
        art={<MerkleDiagram className="rounded-[3px] border border-paper-rule bg-paper-card p-4" />}
      />

      <section className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
        <SectionHeading eyebrow="Principles" title="What we promise, in plain words." />
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          <Feature n="01" icon={<Lock />} title="Your data stays private">
            Invoices, prices, buyers and quantities are never written to a blockchain. Only a 32-byte Merkle root per batch is public, and it reveals nothing about the documents in it.
          </Feature>
          <Feature n="02" icon={<Fingerprint />} title="Proofs you can check yourself">
            Every verification includes the file’s fingerprint, the Merkle proof, the on-chain anchor and our signature. Anyone can recompute them with open tools — no SealChain required.
          </Feature>
          <Feature n="03" icon={<Eye />} title="Honest about limits">
            We prove a document is unchanged since issue and who issued it. Authority endorsement is shown only when the authority confirmed it. Rules show when they were last verified.
          </Feature>
        </div>
      </section>

      <section className="border-y border-paper-rule bg-paper-card">
        <div className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
          <SectionHeading eyebrow="Controls" title="How the platform is protected." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-[3px] border border-paper-rule bg-paper-rule sm:grid-cols-2 lg:grid-cols-3">
            {[
              [<KeyRound key="1" />, 'Passwords & sessions', 'Passwords are hashed with scrypt. Session cookies are HttpOnly and SameSite; only token hashes are stored.'],
              [<UserCheck key="2" />, 'Sign-in', 'Email and password, or Google and Apple sign-in using OpenID Connect with PKCE, state and nonce checks.'],
              [<FileLock2 key="3" />, 'API keys & webhooks', 'API keys are stored hashed and can be revoked instantly. Webhooks are signed with HMAC-SHA256 and a timestamp against replay.'],
              [<ShieldCheck key="4" />, 'Web hardening', 'Content-Security-Policy, framing disabled, no-sniff and strict referrer headers; cross-site writes are refused.'],
              [<ServerCog key="5" />, 'Abuse protection', 'Rate limits on sign-in, verification, uploads and contact forms.'],
              [<ListChecks key="6" />, 'Audit trail', 'Issues, revocations, endorsements, rule changes and key management are written to an audit log.'],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="bg-paper-card p-6">
                <span className="text-navy-900 [&>svg]:size-5 [&>svg]:stroke-[1.6]">{icon}</span>
                <p className="mt-4 font-serif text-[18px] font-medium">{t}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cx('mx-auto grid max-w-[1680px] gap-12 py-24 lg:grid-cols-2', PAGE_X)}>
        <div>
          <SectionHeading eyebrow="Issuer key" title="Our signing key is public." body="Every document SealChain issues is signed with this Ed25519 key. Keep a copy: if a signature doesn’t verify against it, the document didn’t come from us." />
          <Link to="/developers#independent" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium underline-offset-4 hover:underline">How to check a signature <ArrowRight className="size-4" /></Link>
        </div>
        <div className="rounded-[3px] border border-paper-rule bg-paper-card p-6">
          <dl className="space-y-4 text-[14px]">
            <div><dt className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">Algorithm</dt><dd className="mt-1">{meta?.issuerKey.algorithm ?? 'Ed25519'}</dd></div>
            <div><dt className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">Key ID</dt><dd className="mt-1"><Hash value={meta?.issuerKey.keyId} full /></dd></div>
            <div><dt className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">Public key (hex)</dt><dd className="mt-1"><Hash value={meta?.issuerKey.publicKey} full /></dd></div>
            <div><dt className="font-plexmono text-[11px] uppercase tracking-[0.14em] text-slate-500">Anchoring network</dt><dd className="mt-1">{meta?.anchor.networkName ?? '—'}{meta?.anchor.contract ? <> · <Hash value={meta.anchor.contract} /></> : null}</dd></div>
          </dl>
          <a href="/api/keys" className="mt-5 inline-block font-plexmono text-[12px] text-navy-900 underline underline-offset-4">GET /api/keys</a>
        </div>
      </section>

      <section className="border-t border-paper-rule bg-paper-card">
        <div className={cx('mx-auto grid max-w-[1680px] gap-10 py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center', PAGE_X)}>
          <SectionHeading eyebrow="Responsible disclosure" title="Found a weakness? Tell us first." body="Report security issues through the contact form with the topic “Other” and the word SECURITY in your message. We’ll acknowledge promptly and credit you if you wish. Please don’t access other people’s data or disrupt the service while testing." />
          <Link to="/contact?topic=other" className={INK_BTN}>Report an issue <ArrowRight className="size-4" /></Link>
        </div>
      </section>
    </>
  );
}
