# Decisions and open questions

The brief's roadmap starts with a decision, not code: which corridor and which
documents come first. This file records that decision and the other choices
made while building the first version, so they can be revisited as pilot
evidence comes in.

## Step 0: focus

| Decision | Choice | Why |
|---|---|---|
| First corridor | **Rwanda → Kenya** | Named in the brief; highest-volume EAC route for Rwandan exporters; road via Uganda (Northern Corridor) exercises transit requirements. |
| Second corridor | **Rwanda → Uganda** | Also named; shares most rules, proves the rule set is data rather than hard-coded. |
| First documents | **Certificate of Origin + Commercial Invoice**, plus **Packing List** | The brief names CoO + invoice as the most error-prone. The packing list costs little extra because it comes from the same record, and customs cross-checks all three. |
| Sample export basket | Coffee, tea, horticulture, pulses, minerals, dairy, processed foods, handicrafts | Rwanda's actual export mix; each triggers different permits (NAEB, phytosanitary, veterinary, ICGLR). |

## Product choices

- **One shipment record → all documents.** Contradictions between documents
  are a top cause of holds, so the documents can't be edited separately.
  Corrections re-issue a new version, and the old one verifies as
  *superseded*.
- **Warnings don't block, errors do.** Issuing with warnings requires an
  explicit acknowledgement that is recorded in the audit log.
- **Duty estimate front and centre.** Showing "your buyer pays USD X without
  this certificate" makes the certificate's value, and the cost of getting it
  wrong, concrete.
- **Billing from day one.** A USD 15/month + USD 3/shipment pilot price
  (configurable), per the brief's "willingness to pay is the honest signal".
  Re-issues are free so traders are never penalised for correcting mistakes.
  Payments are recorded manually (MoMo / bank) until usage justifies a payment
  provider.

## Technical choices

- **Merkle batching** keeps the per-shipment fee independent of gas prices;
  one transaction anchors any number of documents.
- **EVM, contract-agnostic chain.** `SealAnchor` is 60 lines and deploys to
  any EVM chain. Pick a low-fee public chain for the pilot (e.g. a Polygon or
  Base testnet, then mainnet L2). The `publicRpcUrl` lets verifiers check the
  chain themselves.
- **Ed25519 issuer signature alongside the anchor.** The anchor proves *when*
  a hash existed; the signature proves *who* issued it, and it can be checked
  offline.
- **SQLite (`node:sqlite`)** is ample for a pilot and has zero native
  dependencies. All SQL sits behind `Db`, so moving to Postgres is contained.
- **Unguessable public document IDs.** Verification pages show consignment
  particulars (needed to compare against paper), so IDs are random and not
  enumerable. Invoice values are shown only on the invoice's own page.
- **Browser-side hashing** means documents are never uploaded for ordinary
  verification.

## Open questions (from the brief, still open)

1. **Bluno's EAC depth.** Someone should trial their product on RW→KE before
   the regional wedge is finalised.
2. **Machine-readable rules.** Do RRA, KRA and URA publish tariffs and
   document requirements in structured form, or will rule tracking be manual?
   This sizes the compliance-research role. The console currently supports
   manual verification.
3. **Price point.** The pilot price is a starting hypothesis to test with
   real exporters.
4. **Authority endorsement.** *Built.* An issuing authority (onboarded by
   the compliance team) can endorse a certificate of origin. The endorsement
   is a signed record bound to the exact document hash and anchored on-chain,
   and verifiers see it. Still open: whether RRA and other authorities will
   adopt it, and whether they want their own signing keys (the pilot uses
   SealChain's platform key to attest the officer's authenticated
   decision).
5. **Chain for production.** Choose a chain the target banks and customs
   officers will accept, and decide how many confirmations to wait for.
