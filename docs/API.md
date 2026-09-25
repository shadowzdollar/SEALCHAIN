# SealChain API

For forwarders, customs brokers and exporters who want to connect their own
systems (TMS, ERP, spreadsheets with scripts). Everything the web app does
goes through this API.

Base URL: `https://<your-sealchain-host>/api`. JSON in, JSON out.

## Authentication

An organisation **owner** creates a key in **Team → API keys**. The key is
shown once. Send it as a bearer token:

```bash
curl -H "Authorization: Bearer sc_live_…" https://…/api/auth/me
```

A key acts for the organisation with the role of the person who created it.
Keys cannot create other keys, invite people or change passwords. Revoke a key
at any time from the same page; it stops working immediately.

## Typical flow: issue a shipment's documents

```bash
KEY=sc_live_…
API=https://…/api

# 1. (optional) find the tariff code
curl -s -H "Authorization: Bearer $KEY" "$API/tariff/search?q=green%20arabica%20coffee"

# 2. create the shipment (a draft); the response includes the validation report
curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
     -d @shipment.json "$API/shipments"          # → { "id": "shp_…", "validation": {…} }

# 3. issue: 422 = errors to fix, 409 = warnings to acknowledge
curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
     -d '{"acknowledgeWarnings": true}' "$API/shipments/shp_…/issue"

# 4. download the PDFs
curl -s -H "Authorization: Bearer $KEY" -o coo.pdf "$API/documents/doc_…/pdf"

# 5. share the bundle with the buyer or their bank
curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
     -d '{"label": "Buyer bank — LC desk", "days": 30}' "$API/shipments/shp_…/shares"
```

`shipment.json` follows the shipment shape in
[`packages/core/src/types.ts`](../packages/core/src/types.ts). A full example is
`demoShipment()` in [`packages/core/src/fixtures.ts`](../packages/core/src/fixtures.ts).
HS codes may include dots; amounts are in the shipment's `currency`.

## Endpoints

### Shipments and documents (authenticated)

| Method | Path | |
|---|---|---|
| GET | `/shipments` | List with status and anchoring state |
| POST | `/shipments` | Create a draft → `{id, validation}` |
| GET | `/shipments/:id` | Data, validation report, documents, `documentsOutOfDate` |
| PUT | `/shipments/:id` | Replace the draft data |
| POST | `/shipments/validate` | Validate an unsaved shipment (no side effects) |
| POST | `/shipments/:id/issue` | Issue or re-issue `{acknowledgeWarnings?}` |
| POST | `/shipments/:id/duplicate` | Copy as a new draft |
| GET | `/documents/:id/pdf` | Download a PDF |
| POST | `/documents/:id/revoke` | Revoke with `{reason}` (owners) |
| GET/POST | `/shipments/:id/shares` | List or create share links `{label, days}` |
| DELETE | `/shares/:id` | Withdraw a share link |
| GET | `/activity?shipmentId=` | Verifications and share views of your documents |
| GET | `/tariff/search?q=` | Classification suggestions |
| GET | `/parties`, POST `/parties` | Address book |
| POST | `/forensics` | Multipart `document` (+ optional `companion`) → risk report |
| PUT | `/forensics/:id/outcome` | `{outcome: "fraud" \| "genuine" \| "unknown"}` |
| GET | `/billing?period=YYYY-MM` | Usage statement |

### Public (no authentication, rate-limited)

| Method | Path | |
|---|---|---|
| GET | `/verify/:documentId?sha256=` | Verification record; with `sha256`, also compares your copy |
| GET | `/verify/hash/:sha256` | Look up by file fingerprint |
| POST | `/verify/file` | Multipart `file`; identifies altered copies |
| GET | `/shares/:token` | A shared bundle |
| GET | `/keys` | SealChain issuer public key (Ed25519) |
| GET | `/meta` | Corridors, anchoring network, pricing |
| GET | `/status` | Component health and anchoring backlog (no internal detail) |
| POST | `/contact` | Public-site enquiry `{name, email, company?, country?, topic, message}` (5/hour) |

## Webhooks

An owner adds a webhook under **Team → Webhooks** (or with `POST /webhooks {url, events}`).
The signing secret (`whsec_…`) is shown once.

| Event | When | `data` |
|---|---|---|
| `document.issued` | Documents issued or re-issued | `shipmentId, reference, version, documents[{id, kind, number, sha256, verifyUrl}]` |
| `document.anchored` | Their batch is confirmed on-chain | `batchId, root, chainId, txHash, anchoredAt, documents[{id, number, kind}]` |
| `document.revoked` | A document is revoked | `documentId, number, shipmentId, reason` |
| `document.tampered` | An altered copy of your document was presented | `documentId, number, shipmentId, detectedVia` |
| `endorsement.decided` | An authority endorsed or declined | `endorsementId, documentId, number, authority, decision, reason?` |
| `ping` | You pressed **Send test** | `message` |

The body is `{"id","type","createdAt","data"}`. The headers are
`SealChain-Event`, `SealChain-Delivery` (the delivery id; use it to ignore
duplicates) and `SealChain-Signature: t=<unix>,v1=<hex>`.

Verify every request before trusting it:

```js
import crypto from 'node:crypto';

function verifySealChain(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < toleranceSec;
  return fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
```

Respond `2xx` within 10 seconds. Failed deliveries are retried after 1 minute,
5 minutes, 30 minutes, 2 hours and 6 hours, then marked failed. You can
re-send a failed delivery from the delivery log
(`POST /webhooks/deliveries/:id/retry`). In production, webhook URLs must use
`https` and may not point at private or local addresses.

## Verifying without trusting SealChain

A verification response contains everything needed to check it independently:

1. SHA-256 your file and compare it with `integrity.sha256`.
2. Recompute the Merkle root from that hash and `anchor.proof`, where each step
   is `{hash, side}` with `leaf = SHA256(0x00‖doc)` and
   `node = SHA256(0x01‖left‖right)`. It must equal `anchor.root`.
3. Call `anchoredAt(bytes32 root)` on `anchor.contract` over any RPC for
   `anchor.chainId`. A non-zero result is the block timestamp.
4. Verify `signature.signature` (Ed25519, base64) over the canonical JSON
   `{"documentId","issuedAt","issuer","number","sha256","v":1}` (keys sorted)
   with the key from `/api/keys`.

## Errors

Errors return `{error, message, details?}`, where `error` is a stable code
(`validation_failed`, `warnings_unacknowledged`, `not_found`, `forbidden`, …)
and `message` is safe to show to users. For `validation_failed` and
`warnings_unacknowledged`, `details` is the validation report.
