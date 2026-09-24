# SealChain

Cross-border trade compliance for small exporters. SealChain generates the
documents a shipment needs, checks them against the trade corridor's rules
before submission, and makes every document provably authentic from the
moment it is issued.

Built from the project brief in [`Trade_Compliance_SaaS.pdf`](Trade_Compliance_SaaS.pdf).
Corridors: **Rwanda → Kenya** (first), **Uganda**, **Tanzania** and **Burundi**.

| Layer | What it does | Where |
|---|---|---|
| **1. Documents & validation** | One shipment record → Commercial Invoice, EAC Certificate of Origin, Packing List (PDF). HS code suggestions, 40+ pre-submission checks, required permits, duty the certificate saves. | `packages/core`, `apps/api/src/pdf` |
| **2. Provable authenticity** | SHA-256 of each exact PDF, Ed25519 issuer signature, Merkle-batched and anchored on an EVM chain. Public verifier hashes files in the browser and can query the chain directly. | `packages/contracts`, `apps/api/src/services/anchor.ts`, `apps/web/src/pages/Verify.tsx` |
| **3. Fraud-pattern detection** | For documents received from others: altered-copy detection with a line diff, fabricated references, PDF edit traces, content contradictions, certificate ↔ invoice cross-checks, seal comparison. | `packages/core/src/forensics.ts`, `apps/api/src/services/forensics.ts` |

Plus:

- **Share links:** one expiring, revocable URL gives a buyer, bank or clearing
  agent the whole document bundle with live verification. Views and downloads
  are logged.
- **Activity feed:** exporters see when outsiders open or verify their
  documents, and get alerts when an altered copy is presented. Views by the
  exporter's own team are not counted.
- **CSV import of goods lines:** handles the comma and semicolon formats that
  Excel produces, with a downloadable template.
- **Sign in with Google or Apple** alongside email and password. The buttons
  appear once credentials are configured (see
  [`docs/SIGN_IN.md`](docs/SIGN_IN.md)).
- **Simplified Certificate of Origin:** issued automatically for EAC Simplified
  Trade Regime consignments (USD 2,000 or less). It is withdrawn if a
  correction pushes the value over the ceiling.
- **Tamper alerts:** document owners are emailed when an altered copy of their
  document is presented, whether on the public verifier or in another user's
  document check. Alerts are throttled.
- **Network fraud intelligence**, shared as counts only:
  - files another user reported as fraudulent are flagged to everyone;
  - different files carrying the same certificate number are flagged as
    conflicting copies;
  - a certificate checked by many parties over a long period is flagged as
    possibly reused.
- **Issuing-authority endorsement:** an authority's officers review
  certificates of origin in their own workspace and endorse or decline them.
  Endorsements are signed, bound to the exact document fingerprint, anchored
  on-chain, and shown to every verifier.
- **Webhooks:** signed (HMAC), retried with backoff, with a delivery log. They
  cover issued, anchored, revoked, tampered and endorsement events.
- **Verifier in four languages** (English, French, Kiswahili, Kinyarwanda),
  for border officers across the EAC. The Kiswahili and Kinyarwanda drafts
  need native-speaker review before relying on them.
- **Installable on phones:** the app has a web app manifest, so it can be
  added to the home screen.
- **Hardening:** cross-site request protection, a Content-Security-Policy and
  security headers. CI runs every test and both builds on every push.
- **REST API with API keys** for forwarders' and brokers' own systems (see
  [`docs/API.md`](docs/API.md)).
- **Pilot billing:** a monthly fee plus a per-shipment fee, charged from day one.
- **Address book** for brokers and forwarders.
- **Teams:** owner/member roles, invites shareable over WhatsApp, and password
  recovery.
- **Compliance console:**

- **Rules checklist.** All 132 facts the engine relies on (thresholds, tax-ID
  formats, border posts, permits, tariff rates) are listed for item-by-item
  confirmation, with CSV export. A confirmation reopens automatically if the
  value it was made against changes.
- **Regulation changes.** Recorded changes are shown to traders whose HS codes
  they affect, from 30 days before until 60 days after the effective date.
- **Anchoring health.** Wallet balance and authorisation, and cost per
  document.
- **Fraud-signal performance.** Users record whether a checked document turned
  out to be fraud or genuine. The console shows how well each signal predicts
  fraud across the pilot: counts only, never document content.

## Quick start

Requirements: Node ≥ 22.5 (uses the built-in `node:sqlite`), pnpm.

```bash
pnpm install
pnpm dev          # local chain :8546 + contract deploy + API :4100 + web :5174
pnpm seed         # (in another terminal) demo account and shipments
```

Open http://localhost:5174.

| Account | Email | Password |
|---|---|---|
| Exporter (demo) | `demo@sealchain.test` | `sealchain-demo-2026` |
| Compliance team | `compliance@sealchain.test` | `sealchain-compliance-2026` |
| Authority officer (demo) | `officer@rra.demo` | `sealchain-officer-2026` |

`pnpm dev --no-chain` skips the blockchain. Documents are then anchored to a
local development ledger, which is clearly labelled as not independently
verifiable.

Ports are deliberately distinct from the VUKA and Ledgerlock projects so all
three can run side by side.

### Tests

```bash
pnpm test         # core unit tests, API integration tests, contract tests
pnpm typecheck
pnpm e2e          # against a running `pnpm dev`: issue → anchor on-chain → verify → tamper
```

### Operations

```bash
pnpm backup                                   # online SQLite backup + integrity check (keeps 14)
pnpm anchor:preflight                         # before go-live: RPC, contract, wallet, fees, cost per batch
pnpm --filter @sealchain/api anchor:wallet    # generate a dedicated anchor wallet
```

### Docker

```bash
docker compose up --build    # chain + contract + app on http://localhost:4100
```

For a pilot, anchor to a public chain instead: deploy the contract with
`RPC_URL=… DEPLOYER_KEY=… pnpm --filter @sealchain/contracts deploy remote`,
then set the variables in [`.env.example`](.env.example).

## Repository layout

```
packages/core        Domain logic shared by API and browser: types, tariff catalog,
                     classifier, corridor rules, validation engine, Merkle proofs,
                     text forensics. Pure TypeScript, no I/O.
packages/contracts   SealAnchor.sol (append-only root registry), Hardhat tests, deploy script.
apps/api             Fastify + node:sqlite. Auth, shipments, PDF rendering, issuance,
                     anchoring worker, public verification, forensics, billing, admin.
apps/web             React + Vite + Tailwind. Trader app, public verifier, compliance console.
scripts/             dev orchestrator, end-to-end check.
docs/                Architecture and decisions.
```

## How verification works

1. **Issue.** All three documents are rendered from one shipment snapshot, so
   they cannot contradict each other. Each PDF gets a QR code linking to
   `/v/<document id>`. The ID is random, so documents can't be enumerated.
2. **Fingerprint and sign.** SHA-256 of the exact bytes, signed with the
   platform's Ed25519 key (published at `/api/keys`).
3. **Anchor.** Queued fingerprints are batched into a Merkle tree
   (`leaf = H(0x00‖doc)`, `node = H(0x01‖l‖r)`). Only the 32-byte root goes
   on-chain: no trade data, no personal data. A crash between sending and
   recording a transaction is recovered from the persisted tx hash.
4. **Verify.** The verifier's browser hashes the file (nothing is uploaded),
   gets the proof, recomputes the root locally, and can call
   `SealAnchor.anchoredAt(root)` over public RPC without trusting SealChain.

Verdicts: `authentic`, `authentic_pending_anchor`, `superseded` (a corrected
version exists), `revoked` (with the issuer's reason), `tampered` and
`anchor_missing`.

## Honest limits

- **Rules and rates are indicative until verified.** The tariff catalog and
  corridor requirements were compiled during planning. Each rule carries its
  source and a `lastVerifiedAt`. The compliance console records who confirmed
  what and when, and traders see a warning until that happens. This is the
  brief's compliance-research role, and it is real ongoing work.
- **Authenticity ≠ authority endorsement.** On its own, SealChain proves a
  document hasn't changed since it was issued through the platform, and who
  issued it. Authority endorsement adds the issuing authority's confirmation,
  but only once authorities are onboarded. Until then, box 14 of the printed
  certificate is still stamped the usual way.
- **Fraud detection is advisory.** Signals are explained and weighted; none
  of them alone proves forgery. The layer is meant to improve as real
  documents are observed.
- **Tariff classification is table stakes.** A transparent BM25 ranker over
  the corridor's export basket, behind a `TariffClassifier` interface so a
  licensed classifier can replace it.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/DECISIONS.md`](docs/DECISIONS.md).
