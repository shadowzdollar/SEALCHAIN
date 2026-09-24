# Architecture

```
            ┌──────────────── apps/web (React) ────────────────┐
 trader ───▶│ editor · shipment · check · billing · compliance │
            └──────────────┬───────────────────────────────────┘
 verifier ──▶ /verify, /v/:id ── hashes file locally ──┐
            (no account)   │ /api                      │ eth_call anchoredAt(root)
                           ▼                           ▼
            ┌──────────── apps/api (Fastify) ─────┐   ┌──────────────────┐
            │ routes: auth, shipments, verify,    │   │ EVM chain        │
            │         forensics, admin, meta      │   │ SealAnchor.sol   │
            │ services: issuance ─ pdf ─ signing  │──▶│ root → timestamp │
            │           anchor worker (batches)   │   └──────────────────┘
            │           forensics · billing       │
            │ node:sqlite (data/sealchain.sqlite) │
            └──────────────┬──────────────────────┘
                           │ imports
            ┌──────────────▼──────────────────────┐
            │ packages/core (pure TS, isomorphic) │
            │ catalog · classifier · corridors ·  │
            │ validation · merkle · forensics     │
            └─────────────────────────────────────┘
```

## Issuance

`POST /api/shipments/:id/issue` runs these steps (`services/documents.ts`):

1. Validate with the corridor rule set and compliance overrides
   (`services/rules.ts`). Any error returns **422**. Unacknowledged warnings
   return **409**.
2. For each corridor document: allocate `SC-{CORRIDOR}-{CI|CO|PL}-{YYYY}-{seq}`,
   render the PDF (`pdf/documents.ts`), SHA-256 the bytes, and sign
   `{documentId, number, sha256, issuedAt, issuer}` with Ed25519.
3. In one transaction: insert the documents (PDF stored as a BLOB), mark the
   previous version superseded, and record the usage fee on first issue.
4. Nudge the anchor worker.

## Anchoring (`services/anchor.ts`)

A single-flight worker runs on an interval and shortly after each issue:

1. **Resume** `submitted` batches from their persisted tx hash.
2. **Retry** `pending`/`failed` batches with exponential backoff, using the
   same root. Proofs are written once and never change.
3. **Batch** queued documents: build the Merkle tree, store each proof, insert
   the batch, then submit.

`EvmAnchorBackend` persists the tx hash *before* waiting for the receipt, and
checks `anchoredAt(root)` before sending, so a crash never double-anchors. On
the development chain (31337) only, roots lost to a Hardhat restart are
re-queued. `LocalLedgerBackend` is a hash-chained ledger used when no chain is
configured; it is labelled as not independently verifiable everywhere.

## Verification (`GET /api/verify/:id`, `/verify/hash/:sha`, `POST /verify/file`)

A verification response reports four things:

- **Integrity:** whether the provided hash equals the stored one.
- **Issuer signature:** checked against the published key.
- **Merkle inclusion:** the proof recomputes the batch root.
- **Live chain lookup:** `anchoredAt(root)`, with a 4 s timeout.

The web verifier recomputes the root in the browser and offers a direct
`eth_call` to `publicRpcUrl`. Each check is logged in `verification_events`
with only a salted client hash, which powers the "verified by others" count.

## Forensics (`services/forensics.ts`)

1. **Registry lookup:** is this file byte-identical to one we issued?
2. **Claim detection:** a printed number, QR URL or PDF subject that names a
   SealChain document whose hash differs means an *altered copy*. We diff the
   visible text against the original.
3. **Structural signals:** incremental updates, editing-tool producers, date
   inconsistencies, active content, image-only pages.
4. **Content signals** (core): future dates, implausible HS codes, missing
   references, high-risk commodities.
5. **Cross-check** of a certificate against its companion invoice.
6. **Seal comparison:** a 64-bit dHash of embedded JPEG and Flate images
   against the organisation's reference seals.

Signals are weighted into a 0–100 score with a plain-language summary.

## Sharing and activity (`routes/sharing.ts`)

A share link is a random token, stored hashed and bound to one shipment. The
public `/api/shares/:token` returns the current version's documents and
their anchor state. PDFs are served only if they belong to that shipment.

Views and downloads go to `share_views`; verifications go to
`verification_events`. Both skip requests from the issuing organisation, so
the activity feed shows outside activity only. The feed merges both logs,
and a `tampered` verification is surfaced as an alert.

## Learning loop

`forensic_reports.outcome` (`fraud` / `genuine`) is recorded by the user who
ran the check. `/admin/signal-performance` aggregates across organisations,
per signal code, into: times fired, confirmed frauds, genuine documents, and
precision. It exposes counts only.

## API keys

A key looks like `sc_live_…` and only its SHA-256 is stored. It acts as the
user who created it, and the request context is marked `via: 'api_key'`.
`requireSession` blocks key-authenticated requests from managing keys,
invites and passwords.

## Data model (SQLite)

| Table | Holds |
|---|---|
| `orgs`, `users`, `sessions` | Session tokens are stored hashed. |
| `parties` | The address book. |
| `shipments` | JSON snapshot plus the last validation report. |
| `documents` | PDF, sha256, signature, proof, batch id, lifecycle status. |
| `anchor_batches` | Root, backend, tx and status. |
| `verification_events`, `forensic_reports`, `seal_references` | Verification log, forensics results and reference seals. |
| `usage_events`, `payments` | Billing. |
| `tariff_overrides`, `ruleset_verifications` | Compliance team confirmations. |
| `rule_checks`, `rule_changes` | The rules checklist and recorded regulation changes. |
| `invites`, `password_resets`, `outbox` | Invites, password resets and outgoing mail. |
| `share_links`, `share_views` | Share links and their access log. |
| `api_keys` | API keys (stored hashed). |
| `audit_log` | Audit trail. |

## Security notes

- Passwords are hashed with scrypt. Session cookies are httpOnly and SameSite=Lax.
- Verification and auth endpoints are rate-limited.
- Document IDs are 20 characters from a 32-symbol alphabet (100 bits), so they
  cannot be enumerated. PDFs download only for the owning organisation.
- The public Hardhat key is refused on any chain other than 31337. Production
  keys come from the environment.
- Nothing but Merkle roots goes on-chain.
