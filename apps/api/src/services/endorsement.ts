/** Endorsement records: shapes and the public view used by verification. */
import crypto from 'node:crypto';
import { canonicalJson } from '@sealchain/core';
import { json, type Db } from '../db';
import type { IssuerSigner } from './signing';

export interface EndorsementRecord {
  v: 1;
  type: 'endorsement';
  endorsementId: string;
  documentId: string;
  documentNumber: string;
  documentSha256: string;
  authorityId: string;
  authorityName: string;
  officerId: string;
  officerName: string;
  decidedAt: string;
}

export interface EndRow {
  id: string;
  document_id: string;
  shipment_id: string;
  requester_org_id: string;
  authority_org_id: string;
  status: 'pending' | 'endorsed' | 'rejected' | 'cancelled';
  request_note: string | null;
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  record: string | null;
  record_hash: string | null;
  signature: string | null;
  batch_id: string | null;
  created_at: string;
}

/** Public endorsement data for a document's verification page. */
export function publicEndorsements(deps: { db: Db; signer: IssuerSigner }, documentId: string) {
  const rows = deps.db.all<EndRow & { root: string | null; batch_status: string | null; anchored_at: string | null; tx_hash: string | null; proof: string | null }>(
    `SELECT e.*, b.root, b.status AS batch_status, b.anchored_at, b.tx_hash
       FROM endorsements e LEFT JOIN anchor_batches b ON b.id = e.batch_id
      WHERE e.document_id = ? AND e.status = 'endorsed' ORDER BY e.decided_at`,
    documentId,
  );
  return rows.map((r) => {
    const record = r.record ? json<EndorsementRecord>(r.record) : null;
    const hashOk = !!record && crypto.createHash('sha256').update(canonicalJson(record)).digest('hex') === r.record_hash;
    return {
      id: r.id,
      authority: record?.authorityName ?? '',
      officer: record?.officerName ?? r.decided_by_name,
      decidedAt: r.decided_at,
      documentSha256: record?.documentSha256,
      recordHash: r.record_hash,
      signatureValid: !!record && !!r.signature && hashOk && deps.signer.verifyRecord(record, r.signature),
      anchor: { status: r.batch_id ? r.batch_status : 'queued', root: r.root, proof: r.proof ? json(r.proof) : null, anchoredAt: r.anchored_at, txHash: r.tx_hash },
      record,
    };
  });
}

