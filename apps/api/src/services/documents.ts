/**
 * Issuance and verification — the heart of the product.
 *
 * issue():   validate → render every corridor document from the same shipment
 *            snapshot → hash the exact PDF bytes → sign → store → queue for
 *            anchoring. Re-issuing creates a new version and marks the
 *            previous documents superseded (they still verify, but say so).
 *
 * verify():  given a document (by public id or by hash), report integrity,
 *            issuer signature, Merkle inclusion, and a *live* on-chain check.
 */
import crypto from 'node:crypto';
import {
  DOCUMENT_KIND_LABEL,
  canonicalJson,
  computeRootFromProof,
  validateShipment,
  type DocumentKind,
  type ProofStep,
  type Shipment,
  type ValidationReport,
} from '@sealchain/core';
import type { Config } from '../config';
import { json, newId, nowIso, type Db } from '../db';
import { KIND_CODE, documentSummary, renderDocument } from '../pdf/documents';
import { audit, type AuthContext } from './auth';
import type { AnchorService } from './anchor';
import { effectiveCorridor, validationOptions } from './rules';
import type { IssuerSigner } from './signing';
import { recordUsage } from './billing';
import type { Mailer } from './mailer';
import type { WebhookService } from './webhooks';
import { publicEndorsements } from './endorsement';

export interface Deps {
  db: Db;
  cfg: Config;
  signer: IssuerSigner;
  anchor: AnchorService;
  mailer: Mailer;
  webhooks: WebhookService;
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

export interface DocumentRow {
  id: string;
  org_id: string;
  shipment_id: string;
  kind: DocumentKind;
  number: string;
  version: number;
  status: 'active' | 'superseded' | 'revoked';
  sha256: string;
  data_hash: string;
  size: number;
  summary: string;
  signature: string;
  signing_key_id: string;
  batch_id: string | null;
  proof: string | null;
  superseded_by: string | null;
  revoked_reason: string | null;
  issued_by: string;
  issued_at: string;
}

export const DOC_COLUMNS = 'id, org_id, shipment_id, kind, number, version, status, sha256, data_hash, size, summary, signature, signing_key_id, batch_id, proof, superseded_by, revoked_reason, issued_by, issued_at';

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function verifyUrl(cfg: Config, documentId: string): string {
  return `${cfg.publicWebUrl}/v/${documentId}`;
}

export async function issueShipment(
  deps: Deps,
  ctx: AuthContext,
  shipmentId: string,
  opts: { acknowledgeWarnings?: boolean } = {},
): Promise<{ report: ValidationReport; documents: DocumentRow[]; version: number }> {
  const { db, cfg, signer, anchor } = deps;
  const row = db.get<{ data: string; issued_version: number; corridor_id: string }>(
    'SELECT data, issued_version, corridor_id FROM shipments WHERE id = ? AND org_id = ?', shipmentId, ctx.org.id,
  );
  if (!row) throw new HttpError(404, 'not_found', 'Shipment not found');
  const shipment = { ...json<Shipment>(row.data), id: shipmentId };
  const corridor = effectiveCorridor(db, row.corridor_id);
  const report = validateShipment(shipment, corridor, validationOptions(db, cfg, corridor.id));
  db.run('UPDATE shipments SET validation = ? WHERE id = ?', JSON.stringify(report), shipmentId);

  if (report.status === 'blocked') {
    throw new HttpError(422, 'validation_failed', `Fix ${report.counts.error} error(s) before issuing documents.`, report);
  }
  if (report.status === 'review' && !opts.acknowledgeWarnings) {
    throw new HttpError(409, 'warnings_unacknowledged', `Review ${report.counts.warning} warning(s) and confirm to issue.`, report);
  }

  const version = row.issued_version + 1;
  const previous = new Map(
    db.all<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE shipment_id = ? AND status = 'active'`, shipmentId).map((d) => [d.kind, d]),
  );
  const issuedAt = nowIso();
  const year = issuedAt.slice(0, 4);
  const corridorCode = corridor.id.replace('-', '');

  // Render outside the transaction (async); sequence gaps on failure are fine.
  const prepared: Array<{
    id: string; kind: DocumentKind; number: string; pdf: Uint8Array; hash: string; signature: string; dataHash: string; summary: object;
  }> = [];
  // Small consignments under the Simplified Trade Regime also get the
  // simplified certificate (the full certificate remains valid too).
  const kinds: DocumentKind[] = [...corridor.generatedDocuments, ...(report.strEligible ? (['simplified_certificate_of_origin'] as const) : [])];
  for (const kind of kinds) {
    const id = newId('doc');
    const seq = db.nextSequence(`${corridorCode}-${KIND_CODE[kind]}-${year}`);
    const number = `SC-${corridorCode}-${KIND_CODE[kind]}-${year}-${String(seq).padStart(5, '0')}`;
    const pdf = await renderDocument(kind, shipment, {
      documentId: id,
      number,
      version,
      issuedAt,
      verifyUrl: verifyUrl(cfg, id),
      issuerOrgName: ctx.org.name,
      supersedesNumber: previous.get(kind)?.number,
    });
    const hash = sha256(pdf);
    const signature = signer.sign({ v: 1, documentId: id, number, sha256: hash, issuedAt, issuer: ctx.org.id });
    prepared.push({
      id,
      kind,
      number,
      pdf,
      hash,
      signature,
      dataHash: crypto.createHash('sha256').update(canonicalJson({ kind, shipment })).digest('hex'),
      summary: documentSummary(kind, shipment),
    });
  }

  db.tx(() => {
    for (const p of prepared) {
      db.insert('documents', {
        id: p.id,
        org_id: ctx.org.id,
        shipment_id: shipmentId,
        kind: p.kind,
        number: p.number,
        version,
        status: 'active',
        sha256: p.hash,
        data_hash: p.dataHash,
        size: p.pdf.byteLength,
        pdf: p.pdf,
        summary: JSON.stringify(p.summary),
        signature: p.signature,
        signing_key_id: signer.keyId,
        issued_by: ctx.user.id,
        issued_at: issuedAt,
      });
      const prev = previous.get(p.kind);
      if (prev) db.run("UPDATE documents SET status = 'superseded', superseded_by = ? WHERE id = ?", p.id, prev.id);
    }
    // A kind no longer produced (e.g. the consignment grew past the STR ceiling)
    // must not stay valid: withdraw it without a replacement.
    for (const [kind, prev] of previous) {
      if (!kinds.includes(kind)) db.run("UPDATE documents SET status = 'superseded' WHERE id = ?", prev.id);
    }
    db.run("UPDATE shipments SET status = 'issued', issued_version = ?, updated_at = ? WHERE id = ?", version, issuedAt, shipmentId);
    // The per-shipment fee covers validation + anchoring; corrections are free.
    if (version === 1) recordUsage(db, cfg, ctx.org.id, shipmentId);
    audit(db, ctx, 'shipment.issue', 'shipment', shipmentId, { version, documents: prepared.map((p) => p.number) });
  });
  anchor.schedule();

  const documents = db.all<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE shipment_id = ? AND version = ? ORDER BY kind`, shipmentId, version);
  deps.webhooks.dispatch(ctx.org.id, 'document.issued', {
    shipmentId,
    reference: shipment.reference,
    version,
    documents: documents.map((d) => ({ id: d.id, kind: d.kind, number: d.number, sha256: d.sha256, verifyUrl: verifyUrl(cfg, d.id) })),
  });
  return { report, documents, version };
}

export function revokeDocument(deps: Deps, ctx: AuthContext, documentId: string, reason: string) {
  const doc = deps.db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ? AND org_id = ?`, documentId, ctx.org.id);
  if (!doc) throw new HttpError(404, 'not_found', 'Document not found');
  if (doc.status === 'revoked') return;
  deps.db.tx(() => {
    deps.db.run("UPDATE documents SET status = 'revoked', revoked_reason = ? WHERE id = ?", reason, documentId);
    audit(deps.db, ctx, 'document.revoke', 'document', documentId, { reason });
  });
  deps.webhooks.dispatch(ctx.org.id, 'document.revoked', { documentId, number: doc.number, shipmentId: doc.shipment_id, reason });
}

// ------------------------------------------------------------ verification
interface BatchRow {
  id: string;
  root: string;
  leaf_count: number;
  backend: 'evm' | 'local';
  status: string;
  chain_id: number | null;
  contract: string | null;
  tx_hash: string | null;
  block_number: number | null;
  anchored_at: string | null;
  entry_hash: string | null;
  prev_entry: string | null;
  error: string | null;
}

/**
 * authentic                 hash matches, signature valid, root confirmed on-chain
 * authentic_pending_anchor  genuine record, anchoring still in progress
 * superseded / revoked      genuine but no longer the valid version
 * tampered                  presented file differs from what was issued
 * anchor_missing            our record says anchored but the chain disagrees
 */
export type Verdict = 'authentic' | 'authentic_pending_anchor' | 'superseded' | 'revoked' | 'tampered' | 'anchor_missing';

export async function buildVerification(deps: Deps, doc: DocumentRow, providedSha?: string) {
  const { db, signer, anchor } = deps;
  const org = db.get<{ name: string }>('SELECT name FROM orgs WHERE id = ?', doc.org_id);
  const batch = doc.batch_id ? db.get<BatchRow>('SELECT * FROM anchor_batches WHERE id = ?', doc.batch_id) : undefined;
  const proof = doc.proof ? json<ProofStep[]>(doc.proof) : null;
  const computedRoot = proof ? computeRootFromProof(doc.sha256, proof) : null;
  const proofValid = !!(batch && computedRoot === batch.root);

  let onChain: { checked: boolean; anchoredAt: string | null; error?: string } = { checked: false, anchoredAt: null };
  if (batch?.status === 'confirmed') {
    try {
      const ts = await withTimeout(anchor.backend.lookup(batch.root), 4000);
      onChain = { checked: true, anchoredAt: ts ? new Date(ts * 1000).toISOString() : null };
    } catch (err) {
      onChain = { checked: false, anchoredAt: null, error: `Could not reach the chain: ${(err as Error).message.split('\n')[0]}` };
    }
  }

  const signatureValid = signer.verify(
    { v: 1, documentId: doc.id, number: doc.number, sha256: doc.sha256, issuedAt: doc.issued_at, issuer: doc.org_id },
    doc.signature,
  );
  const hashMatches = providedSha === undefined ? null : providedSha.toLowerCase() === doc.sha256;

  let verdict: Verdict;
  if (hashMatches === false) verdict = 'tampered';
  else if (doc.status === 'revoked') verdict = 'revoked';
  else if (doc.status === 'superseded') verdict = 'superseded';
  else if (batch?.status === 'confirmed' && (!proofValid || (onChain.checked && !onChain.anchoredAt))) verdict = 'anchor_missing';
  else if (batch?.status === 'confirmed') verdict = 'authentic';
  else verdict = 'authentic_pending_anchor';
  if (!signatureValid) verdict = 'tampered';

  const superseding = doc.superseded_by
    ? db.get<{ id: string; number: string }>('SELECT id, number FROM documents WHERE id = ?', doc.superseded_by)
    : undefined;

  const info = anchor.backend.info;
  const endorsements = publicEndorsements(deps, doc.id).map((e) => ({
    ...e,
    // An endorsement is only meaningful for the exact file it was given for.
    matchesDocument: e.documentSha256 === doc.sha256,
    proofValid: !!(e.anchor.proof && e.anchor.root && computeRootFromProof(e.recordHash!, e.anchor.proof as ProofStep[]) === e.anchor.root),
  }));
  // How many different outside parties have checked this document, and since
  // when. One certificate checked by many parties over months can indicate
  // it is being reused for several consignments.
  const checks = db.get<{ parties: number; first: string | null; last: string | null }>(
    "SELECT COUNT(DISTINCT client_hash) AS parties, MIN(created_at) AS first, MAX(created_at) AS last FROM verification_events WHERE document_id = ? AND client_hash IS NOT NULL",
    doc.id,
  )!;
  const spanDays = checks.first && checks.last ? (new Date(checks.last).getTime() - new Date(checks.first).getTime()) / 86_400_000 : 0;
  const possibleReuse = checks.parties >= 8 && spanDays >= 45;
  return {
    verdict,
    checks: { parties: checks.parties, since: checks.first, possibleReuse },
    endorsements,
    document: {
      id: doc.id,
      kind: doc.kind,
      kindLabel: DOCUMENT_KIND_LABEL[doc.kind],
      number: doc.number,
      version: doc.version,
      status: doc.status,
      issuedAt: doc.issued_at,
      issuer: org?.name ?? 'Unknown',
      summary: json<Record<string, unknown>>(doc.summary),
      supersededBy: superseding ?? null,
      revokedReason: doc.revoked_reason,
      size: doc.size,
    },
    integrity: { sha256: doc.sha256, providedSha256: providedSha ?? null, matches: hashMatches },
    signature: { algorithm: 'Ed25519', keyId: doc.signing_key_id, publicKey: signer.publicKeyRawHex, signature: doc.signature, valid: signatureValid },
    anchor: {
      status: !batch ? 'queued' : batch.status,
      backend: batch?.backend ?? info.backend,
      independentlyVerifiable: (batch?.backend ?? info.backend) === 'evm',
      networkName: info.networkName,
      chainId: batch?.chain_id ?? info.chainId ?? null,
      contract: batch?.contract ?? info.contract ?? null,
      publicRpcUrl: info.publicRpcUrl ?? null,
      root: batch?.root ?? null,
      leafCount: batch?.leaf_count ?? null,
      proof,
      computedRoot,
      proofValid,
      txHash: batch?.tx_hash ?? null,
      blockNumber: batch?.block_number ?? null,
      anchoredAt: batch?.anchored_at ?? null,
      explorerUrl: batch?.tx_hash && info.explorerTxUrl ? info.explorerTxUrl.replace('{tx}', batch.tx_hash) : null,
      ledgerEntry: batch?.entry_hash ?? null,
      onChain,
    },
  };
}

export function recordVerification(db: Db, documentId: string | null, method: string, outcome: string, clientKey?: string) {
  db.insert('verification_events', {
    id: newId('ver', 16),
    document_id: documentId,
    method,
    outcome,
    // Only a salted hash of the client — we log *that* a check happened, not who.
    client_hash: clientKey ? crypto.createHash('sha256').update(`sealchain:${clientKey}`).digest('hex').slice(0, 16) : null,
    created_at: nowIso(),
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref())]);
}
