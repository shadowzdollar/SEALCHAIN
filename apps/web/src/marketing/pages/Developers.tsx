import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { cx } from '../../components/ui';
import { INK_BTN, PAGE_X, PAPER_BTN, PageHero, SectionHeading } from '../Chrome';
import { Bullets } from '../Blocks';
import { CodeSheet } from '../Illustrations';

const FLOW = `KEY=sc_live_…
API=https://<your-sealchain-host>/api

# 1. (optional) find the tariff code
curl -s -H "Authorization: Bearer $KEY" "$API/tariff/search?q=green%20arabica%20coffee"

# 2. create the shipment — the response includes the validation report
curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
     -d @shipment.json "$API/shipments"       # → { "id": "shp_…", "validation": {…} }

# 3. issue: 422 = errors to fix, 409 = warnings to acknowledge
curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
     -d '{"acknowledgeWarnings": true}' "$API/shipments/shp_…/issue"

# 4. download the PDFs
curl -s -H "Authorization: Bearer $KEY" -o coo.pdf "$API/documents/doc_…/pdf"

# 5. share the bundle with the buyer or their bank
curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
     -d '{"label": "Buyer bank — LC desk", "days": 30}' "$API/shipments/shp_…/shares"`;

const WEBHOOK = `import crypto from 'node:crypto';

function verifySealChain(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret)
    .update(\`\${parts.t}.\${rawBody}\`).digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < toleranceSec;
  return fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}`;

const ENDPOINTS: Array<[string, string, string]> = [
  ['GET', '/shipments', 'List with status and anchoring state'],
  ['POST', '/shipments', 'Create a draft → {id, validation}'],
  ['POST', '/shipments/validate', 'Validate an unsaved shipment'],
  ['POST', '/shipments/:id/issue', 'Issue or re-issue'],
  ['GET', '/documents/:id/pdf', 'Download a PDF'],
  ['POST', '/documents/:id/revoke', 'Revoke with a reason'],
  ['POST', '/shipments/:id/shares', 'Create a share link'],
  ['POST', '/forensics', 'Screen a received document'],
  ['GET', '/verify/hash/:sha256', 'Public: look up by fingerprint'],
  ['POST', '/verify/file', 'Public: verify an uploaded file'],
  ['GET', '/keys', 'Public: issuer public key'],
  ['GET', '/status', 'Public: system status'],
];

const EVENTS: Array<[string, string]> = [
  ['document.issued', 'Documents issued or re-issued'],
  ['document.anchored', 'Their batch is confirmed on-chain'],
  ['document.revoked', 'A document is revoked'],
  ['document.tampered', 'An altered copy of your document was presented'],
  ['endorsement.decided', 'An authority endorsed or declined'],
  ['ping', 'You pressed “Send test”'],
];

export function DevelopersPage() {
  return (
    <>
      <PageHero
        eyebrow="Developers"
        title={<>The same engine as the app — <em className="font-medium text-stamp">as an API</em>.</>}
        body="Create shipments from your ERP, issue sealed documents, share bundles and get signed events when documents are anchored, verified or tampered with."
        actions={<><Link to="/register" className={INK_BTN}>Get an API key <ArrowRight className="size-4" /></Link><Link to="/status" className={PAPER_BTN}>System status</Link></>}
        art={<CodeSheet title="Five calls to a verified shipment" code={FLOW.split('\n').slice(5, 13).join('\n')} />}
      />

      <section className={cx('mx-auto grid max-w-[1680px] gap-12 py-24 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]', PAGE_X)}>
        <div>
          <SectionHeading eyebrow="Authentication" title="Bearer keys, scoped to your organisation." />
          <div className="mt-8">
            <Bullets items={[
              'Organisation owners create keys under Team & settings → Integrations. A key is shown once.',
              'Send it as Authorization: Bearer sc_live_…',
              'A key acts with the role of the person who created it, and cannot create keys, invite people or change passwords.',
              'Revoke a key at any time; it stops working immediately.',
            ]} />
          </div>
        </div>
        <CodeSheet title="Typical flow" code={FLOW} />
      </section>

      <section className="border-y border-paper-rule bg-paper-card">
        <div className={cx('mx-auto max-w-[1680px] py-24', PAGE_X)}>
          <SectionHeading eyebrow="Reference" title="Key endpoints." body="Paths are relative to /api. Authenticated endpoints accept an API key or a session; public endpoints are rate-limited." />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] border-t-2 border-navy-900 text-[14px]">
              <tbody className="divide-y divide-paper-rule">
                {ENDPOINTS.map(([m, p, d]) => (
                  <tr key={m + p}>
                    <td className="w-20 py-3"><span className={cx('rounded-[2px] px-1.5 py-0.5 font-plexmono text-[11px]', m === 'GET' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-brand-50 text-navy-900 ring-1 ring-brand-200')}>{m}</span></td>
                    <td className="py-3 pr-4 font-plexmono text-[13px]">{p}</td>
                    <td className="py-3 text-slate-600">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="webhooks" className={cx('mx-auto grid max-w-[1680px] scroll-mt-20 gap-12 py-24 lg:grid-cols-2', PAGE_X)}>
        <div>
          <SectionHeading eyebrow="Webhooks" title="Signed events, retried until delivered." body="Add an endpoint under Team & settings. Each request carries SealChain-Event, SealChain-Delivery and SealChain-Signature headers. Failed deliveries are retried after 1 and 5 minutes, then 30 minutes, 2 and 6 hours." />
          <ul className="mt-8 divide-y divide-paper-rule border-y border-paper-rule">
            {EVENTS.map(([e, d]) => (
              <li key={e} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <span className="font-plexmono text-[13px]">{e}</span><span className="text-[14px] text-slate-600">{d}</span>
              </li>
            ))}
          </ul>
        </div>
        <CodeSheet title="Verify a webhook signature (Node.js)" code={WEBHOOK} className="self-start" />
      </section>

      <section id="independent" className="scroll-mt-20 border-t border-paper-rule bg-paper-card">
        <div className={cx('mx-auto grid max-w-[1680px] gap-12 py-24 lg:grid-cols-2', PAGE_X)}>
          <SectionHeading eyebrow="Independent verification" title="Check a document without trusting SealChain." body="A verification response contains everything needed to check it yourself, with standard tools." />
          <Bullets items={[
            <>SHA-256 your file and compare it with <code className="font-plexmono text-[13px]">integrity.sha256</code>.</>,
            <>Recompute the Merkle root from that hash and <code className="font-plexmono text-[13px]">anchor.proof</code>: leaf = SHA256(0x00‖doc), node = SHA256(0x01‖left‖right). It must equal <code className="font-plexmono text-[13px]">anchor.root</code>.</>,
            <>Call <code className="font-plexmono text-[13px]">anchoredAt(bytes32 root)</code> on <code className="font-plexmono text-[13px]">anchor.contract</code> over any RPC. A non-zero result is the block timestamp.</>,
            <>Verify the Ed25519 signature over the canonical JSON record with the key published at <a href="/api/keys" className="underline underline-offset-4">/api/keys</a>.</>,
          ]} />
        </div>
      </section>
    </>
  );
}
