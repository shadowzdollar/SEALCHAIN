import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { canonicalJson, getCorridor, toUsd, validateShipment, type Currency, type Shipment, type ValidationReport } from '@sealchain/core';
import { json, newId, nowIso } from '../db';
import { savedPartySchema, shipmentSchema } from '../schemas';
import { audit, requireAuth, requireOwner } from '../services/auth';
import { periods, statement } from '../services/billing';
import { DOC_COLUMNS, HttpError, issueShipment, revokeDocument, type Deps, type DocumentRow } from '../services/documents';
import { effectiveCorridor, validationOptions } from '../services/rules';

interface ShipmentRow {
  id: string;
  org_id: string;
  reference: string;
  corridor_id: string;
  status: 'draft' | 'issued';
  data: string;
  validation: string | null;
  issued_version: number;
  created_at: string;
  updated_at: string;
}

type DocWithAnchor = DocumentRow & { anchor_status: string | null; tx_hash: string | null; anchored_at: string | null; backend: string | null };

export async function shipmentRoutes(api: FastifyInstance, deps: Deps) {
  const { db, cfg } = deps;
  const auth = { preHandler: requireAuth };

  const load = (orgId: string, id: string) => {
    const row = db.get<ShipmentRow>('SELECT * FROM shipments WHERE id = ? AND org_id = ?', id, orgId);
    if (!row) throw new HttpError(404, 'not_found', 'Shipment not found');
    return row;
  };

  const docsFor = (shipmentId: string) =>
    db.all<DocWithAnchor>(
      `SELECT ${DOC_COLUMNS.split(', ').map((c) => `d.${c}`).join(', ')}, b.status AS anchor_status, b.tx_hash, b.anchored_at, b.backend
         FROM documents d LEFT JOIN anchor_batches b ON b.id = d.batch_id
        WHERE d.shipment_id = ? ORDER BY d.version DESC, d.kind`,
      shipmentId,
    ).map(publicDoc);

  // -------------------------------------------------------------- parties
  api.get<{ Querystring: { role?: string } }>('/parties', auth, async (req) => {
    const rows = db.all<{ id: string; role: string; name: string; data: string; updated_at: string }>(
      `SELECT id, role, name, data, updated_at FROM parties WHERE org_id = ? ${req.query.role ? 'AND role = ?' : ''} ORDER BY name`,
      ...(req.query.role ? [req.auth!.org.id, req.query.role] : [req.auth!.org.id]),
    );
    return rows.map((r) => ({ id: r.id, role: r.role, party: json(r.data), updatedAt: r.updated_at }));
  });

  api.post('/parties', auth, async (req, reply) => {
    const body = savedPartySchema.parse(req.body);
    const id = newId('pty', 16);
    db.insert('parties', { id, org_id: req.auth!.org.id, role: body.role, name: body.party.name, data: JSON.stringify(body.party), created_at: nowIso(), updated_at: nowIso() });
    return reply.code(201).send({ id, role: body.role, party: body.party });
  });

  api.put<{ Params: { id: string } }>('/parties/:id', auth, async (req) => {
    const body = savedPartySchema.parse(req.body);
    const res = db.run('UPDATE parties SET role = ?, name = ?, data = ?, updated_at = ? WHERE id = ? AND org_id = ?', body.role, body.party.name, JSON.stringify(body.party), nowIso(), req.params.id, req.auth!.org.id);
    if (!res.changes) throw new HttpError(404, 'not_found', 'Party not found');
    return { id: req.params.id, ...body };
  });

  api.delete<{ Params: { id: string } }>('/parties/:id', auth, async (req) => {
    db.run('DELETE FROM parties WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id);
    return { ok: true };
  });

  // ------------------------------------------------------------ shipments
  api.get('/shipments', auth, async (req) => {
    const rows = db.all<ShipmentRow & { docs: number; pending: number }>(
      `SELECT s.*,
              (SELECT COUNT(*) FROM documents d WHERE d.shipment_id = s.id AND d.status = 'active') AS docs,
              (SELECT COUNT(*) FROM documents d LEFT JOIN anchor_batches b ON b.id = d.batch_id
                 WHERE d.shipment_id = s.id AND d.status = 'active' AND (b.status IS NULL OR b.status != 'confirmed')) AS pending
         FROM shipments s WHERE s.org_id = ? ORDER BY s.updated_at DESC LIMIT 500`,
      req.auth!.org.id,
    );
    return rows.map((r) => {
      const data = json<Shipment>(r.data);
      const v = r.validation ? json<ValidationReport>(r.validation) : null;
      return {
        id: r.id,
        reference: r.reference,
        corridorId: r.corridor_id,
        corridor: getCorridor(r.corridor_id).name,
        status: r.status,
        consignee: data.consignee?.name ?? '',
        invoiceNumber: data.invoiceNumber,
        currency: data.currency,
        invoiceTotal: v?.totals.invoiceTotal ?? null,
        validationStatus: v?.status ?? null,
        documents: r.docs,
        anchoring: r.docs ? (r.pending ? 'pending' : 'anchored') : null,
        version: r.issued_version,
        updatedAt: r.updated_at,
      };
    });
  });

  api.post('/shipments', auth, async (req, reply) => {
    const data = shipmentSchema.parse(req.body);
    const id = newId('shp', 16);
    const ts = nowIso();
    const report = runValidation(deps, { ...(data as unknown as Shipment), id });
    db.insert('shipments', {
      id, org_id: req.auth!.org.id, reference: data.reference || data.invoiceNumber || 'Untitled shipment', corridor_id: data.corridorId,
      status: 'draft', data: JSON.stringify(data), validation: JSON.stringify(report), created_by: req.auth!.user.id, created_at: ts, updated_at: ts,
    });
    audit(db, req.auth, 'shipment.create', 'shipment', id);
    return reply.code(201).send({ id, validation: report });
  });

  api.get<{ Params: { id: string } }>('/shipments/:id', auth, async (req) => {
    const row = load(req.auth!.org.id, req.params.id);
    const data = { ...json<Shipment>(row.data), id: row.id };
    const documents = docsFor(row.id);
    const active = documents.filter((d) => d.status === 'active');
    const first = active[0];
    const outOfDate = !!first && first.dataHash !== crypto.createHash('sha256').update(canonicalJson({ kind: first.kind, shipment: data })).digest('hex');
    return {
      id: row.id,
      status: row.status,
      version: row.issued_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      data,
      validation: row.validation ? json(row.validation) : null,
      documents,
      documentsOutOfDate: outOfDate,
    };
  });

  api.put<{ Params: { id: string } }>('/shipments/:id', auth, async (req) => {
    const row = load(req.auth!.org.id, req.params.id);
    const data = shipmentSchema.parse(req.body);
    if (data.corridorId !== row.corridor_id && row.status === 'issued') {
      throw new HttpError(409, 'corridor_locked', 'The corridor cannot change after documents were issued. Duplicate the shipment instead.');
    }
    const report = runValidation(deps, { ...(data as unknown as Shipment), id: row.id });
    db.run(
      'UPDATE shipments SET data = ?, reference = ?, corridor_id = ?, validation = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(data), data.reference || data.invoiceNumber || row.reference, data.corridorId, JSON.stringify(report), nowIso(), row.id,
    );
    return { id: row.id, validation: report };
  });

  api.delete<{ Params: { id: string } }>('/shipments/:id', auth, async (req) => {
    const row = load(req.auth!.org.id, req.params.id);
    if (row.status !== 'draft') throw new HttpError(409, 'issued', 'Issued shipments are kept for the audit trail and cannot be deleted.');
    db.run('DELETE FROM shipments WHERE id = ?', row.id);
    audit(db, req.auth, 'shipment.delete', 'shipment', row.id);
    return { ok: true };
  });

  api.post<{ Params: { id: string } }>('/shipments/:id/duplicate', auth, async (req, reply) => {
    const row = load(req.auth!.org.id, req.params.id);
    const data = json<Record<string, unknown>>(row.data);
    const copy = { ...data, reference: `${row.reference} (copy)`, invoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10), departureDate: '', transportRef: '' };
    const id = newId('shp', 16);
    const ts = nowIso();
    db.insert('shipments', {
      id, org_id: req.auth!.org.id, reference: String(copy.reference), corridor_id: row.corridor_id, status: 'draft',
      data: JSON.stringify(copy), validation: null, created_by: req.auth!.user.id, created_at: ts, updated_at: ts,
    });
    return reply.code(201).send({ id });
  });

  /** Validate an unsaved draft (live feedback while typing). */
  api.post('/shipments/validate', auth, async (req) => {
    const data = shipmentSchema.parse(req.body);
    return runValidation(deps, { ...(data as unknown as Shipment), id: 'draft' });
  });

  api.post<{ Params: { id: string } }>('/shipments/:id/validate', auth, async (req) => {
    const row = load(req.auth!.org.id, req.params.id);
    const report = runValidation(deps, { ...json<Shipment>(row.data), id: row.id });
    db.run('UPDATE shipments SET validation = ? WHERE id = ?', JSON.stringify(report), row.id);
    return report;
  });

  api.post<{ Params: { id: string }; Body: { acknowledgeWarnings?: boolean } }>('/shipments/:id/issue', auth, async (req) => {
    const body = z.object({ acknowledgeWarnings: z.boolean().optional() }).parse(req.body ?? {});
    const result = await issueShipment(deps, req.auth!, req.params.id, body);
    return { version: result.version, validation: result.report, documents: docsFor(req.params.id).filter((d) => d.version === result.version) };
  });

  // ------------------------------------------------------------ documents
  api.get<{ Params: { id: string } }>('/documents/:id/pdf', auth, async (req, reply) => {
    const doc = db.get<{ pdf: Uint8Array; number: string; kind: string }>('SELECT pdf, number, kind FROM documents WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id);
    if (!doc) throw new HttpError(404, 'not_found', 'Document not found');
    audit(db, req.auth, 'document.download', 'document', req.params.id);
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${doc.number}.pdf"`)
      .header('cache-control', 'private, no-store')
      .send(Buffer.from(doc.pdf));
  });

  api.post<{ Params: { id: string } }>('/documents/:id/revoke', { preHandler: requireOwner }, async (req) => {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
    revokeDocument(deps, req.auth!, req.params.id, reason);
    return { ok: true };
  });

  // ------------------------------------------------------------ dashboard
  api.get('/dashboard', auth, async (req) => {
    const org = req.auth!.org.id;
    const byStatus = Object.fromEntries(db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM shipments WHERE org_id = ? GROUP BY status', org).map((r) => [r.status, r.n]));
    const docs = db.get<{ total: number; anchored: number }>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN b.status = 'confirmed' THEN 1 ELSE 0 END) AS anchored
         FROM documents d LEFT JOIN anchor_batches b ON b.id = d.batch_id WHERE d.org_id = ? AND d.status = 'active'`,
      org,
    )!;
    const verifications = db.get<{ n: number; recent: number }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN v.created_at >= ? THEN 1 ELSE 0 END) AS recent
         FROM verification_events v JOIN documents d ON d.id = v.document_id WHERE d.org_id = ?`,
      new Date(Date.now() - 30 * 86_400_000).toISOString(), org,
    )!;
    let savingsUsd = 0;
    for (const r of db.all<{ validation: string }>("SELECT validation FROM shipments WHERE org_id = ? AND status = 'issued' AND validation IS NOT NULL", org)) {
      const v = json<ValidationReport>(r.validation);
      savingsUsd += toUsd(v.duty.savings, v.duty.currency as Currency, cfg.fx);
    }
    const forensic = db.get<{ n: number; high: number }>("SELECT COUNT(*) AS n, SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high FROM forensic_reports WHERE org_id = ?", org)!;
    return {
      shipments: { draft: byStatus.draft ?? 0, issued: byStatus.issued ?? 0 },
      documents: { active: docs.total, anchored: docs.anchored ?? 0, pending: docs.total - (docs.anchored ?? 0) },
      verifications: { total: verifications.n, last30Days: verifications.recent ?? 0 },
      dutySavedUsd: Math.round(savingsUsd),
      forensics: { total: forensic.n, highRisk: forensic.high ?? 0 },
    };
  });

  // -------------------------------------------------------------- billing
  api.get<{ Querystring: { period?: string } }>('/billing', auth, async (req) => {
    const all = periods(db, req.auth!.org.id);
    const period = req.query.period && /^\d{4}-\d{2}$/.test(req.query.period) ? req.query.period : all[0];
    const intents = db.all<{ id: string; status: string; charge_amount: number; charge_currency: string; created_at: string; failure_reason: string | null }>(
      'SELECT id, status, charge_amount, charge_currency, created_at, failure_reason FROM payment_intents WHERE org_id = ? AND period = ? ORDER BY created_at DESC LIMIT 10', req.auth!.org.id, period ?? '',
    );
    return {
      periods: all,
      statement: statement(db, cfg, req.auth!.org.id, period),
      payment: { ...deps.payments.info(), canPay: req.auth!.user.role !== 'member' },
      attempts: intents.map((i) => ({ id: i.id, status: i.status, chargeAmount: i.charge_amount, chargeCurrency: i.charge_currency, createdAt: i.created_at, failureReason: i.failure_reason })),
    };
  });
}

export function runValidation(deps: Deps, s: Shipment): ValidationReport {
  return validateShipment(s, effectiveCorridor(deps.db, s.corridorId), validationOptions(deps.db, deps.cfg, s.corridorId));
}

function publicDoc(d: DocWithAnchor) {
  return {
    id: d.id,
    kind: d.kind,
    number: d.number,
    version: d.version,
    status: d.status,
    sha256: d.sha256,
    dataHash: d.data_hash,
    size: d.size,
    issuedAt: d.issued_at,
    supersededBy: d.superseded_by,
    revokedReason: d.revoked_reason,
    anchor: {
      status: d.anchor_status ?? 'queued',
      backend: d.backend,
      txHash: d.tx_hash,
      anchoredAt: d.anchored_at,
    },
  };
}
