/**
 * Issuing-authority endorsement.
 *
 * Anchoring proves a document has not changed since it was issued through
 * SealChain. It cannot prove the issuing authority agreed with it. This
 * workflow closes that gap: the exporter requests endorsement of a
 * certificate, an officer of the designated authority reviews and decides,
 * and an endorsement becomes a signed record bound to the exact document
 * fingerprint, anchored on-chain as its own Merkle leaf.
 *
 * Endorsements are per document version; a re-issued certificate needs a new
 * one. Only endorsed records are public; rejections are visible to the
 * requester only.
 */
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { canonicalJson, getCorridor, type Shipment, type ValidationReport } from '@sealchain/core';
import { json, newId, nowIso } from '../db';
import { audit, requireAuth, requireAuthority, requireCompliance } from '../services/auth';
import { HttpError, type Deps, type DocumentRow, DOC_COLUMNS } from '../services/documents';
import type { EndRow, EndorsementRecord } from '../services/endorsement';

export async function endorsementRoutes(api: FastifyInstance, deps: Deps) {
  const { db, signer, anchor, mailer, cfg, webhooks } = deps;
  const orgEmails = (orgId: string) =>
    db.all<{ email: string }>("SELECT email FROM users WHERE org_id = ? AND password_hash != 'disabled'", orgId).map((u) => u.email);

  // ------------------------------------------------------------- directory
  api.get<{ Querystring: { country?: string } }>('/authorities', { preHandler: requireAuth }, async (req) =>
    db.all(
      `SELECT id, name, country FROM orgs WHERE kind = 'authority' ${req.query.country ? 'AND country = ?' : ''} ORDER BY name`,
      ...(req.query.country ? [req.query.country] : []),
    ),
  );

  // Compliance team registers authorities and invites their first officer.
  api.get('/admin/authorities', { preHandler: requireCompliance }, async () =>
    db.all(
      `SELECT o.id, o.name, o.country, o.created_at AS createdAt,
              (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id AND u.password_hash != 'disabled') AS officers,
              (SELECT COUNT(*) FROM endorsements e WHERE e.authority_org_id = o.id AND e.status = 'pending') AS pending,
              (SELECT COUNT(*) FROM endorsements e WHERE e.authority_org_id = o.id AND e.status = 'endorsed') AS endorsed
         FROM orgs o WHERE o.kind = 'authority' ORDER BY o.name`,
    ),
  );

  api.post('/admin/authorities', { preHandler: requireCompliance }, async (req, reply) => {
    const body = z.object({
      name: z.string().trim().min(3).max(160),
      country: z.enum(['RW', 'KE', 'UG', 'TZ', 'BI', 'SS', 'CD', 'SO']),
      officerEmail: z.string().trim().toLowerCase().email(),
    }).parse(req.body);
    const orgId = newId('org', 16);
    const token = crypto.randomBytes(32).toString('base64url');
    db.tx(() => {
      db.insert('orgs', { id: orgId, name: body.name, country: body.country, plan: 'authority', kind: 'authority', created_at: nowIso() });
      db.insert('invites', {
        token_hash: crypto.createHash('sha256').update(token).digest('hex'), org_id: orgId, email: body.officerEmail, role: 'owner',
        invited_by: req.auth!.user.id, expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), created_at: nowIso(),
      });
    });
    const inviteUrl = `${cfg.publicWebUrl}/invite/${token}`;
    await mailer.send({
      to: body.officerEmail,
      subject: `You have been invited to endorse trade documents for ${body.name} on SealChain`,
      body: `SealChain has set up an issuing-authority workspace for ${body.name}.\n\nAccept the invitation (valid 14 days):\n${inviteUrl}\n\nFrom there you can review and endorse certificates of origin exporters submit to you.\n`,
    });
    audit(db, req.auth, 'authority.create', 'org', orgId, { name: body.name, officer: body.officerEmail });
    return reply.code(201).send({ id: orgId, name: body.name, inviteUrl });
  });

  // ------------------------------------------------------- exporter side
  api.post<{ Params: { id: string } }>('/documents/:id/endorsements', { preHandler: requireAuth }, async (req, reply) => {
    const body = z.object({ authorityId: z.string().min(1), note: z.string().trim().max(1000).optional() }).parse(req.body);
    const doc = db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ? AND org_id = ?`, req.params.id, req.auth!.org.id);
    if (!doc) throw new HttpError(404, 'not_found', 'Document not found');
    if (doc.status !== 'active') throw new HttpError(409, 'not_active', 'Only the current version of a document can be endorsed.');
    if (doc.kind !== 'certificate_of_origin' && doc.kind !== 'simplified_certificate_of_origin') throw new HttpError(409, 'not_endorsable', 'Endorsement is available for certificates of origin.');
    const authority = db.get<{ id: string; name: string }>("SELECT id, name FROM orgs WHERE id = ? AND kind = 'authority'", body.authorityId);
    if (!authority) throw new HttpError(404, 'not_found', 'Authority not found');
    if (db.get("SELECT 1 FROM endorsements WHERE document_id = ? AND authority_org_id = ? AND status IN ('pending','endorsed')", doc.id, authority.id)) {
      throw new HttpError(409, 'duplicate', `This certificate is already with ${authority.name}.`);
    }
    const id = newId('end', 16);
    db.insert('endorsements', {
      id, document_id: doc.id, shipment_id: doc.shipment_id, requester_org_id: req.auth!.org.id, authority_org_id: authority.id,
      status: 'pending', request_note: body.note ?? null, created_by: req.auth!.user.id, created_at: nowIso(),
    });
    for (const to of orgEmails(authority.id)) {
      await mailer.send({ to, subject: `Endorsement requested: ${doc.number}`, body: `${req.auth!.org.name} requests endorsement of ${doc.number}.\n\nReview it in your authority workspace:\n${cfg.publicWebUrl}/app/authority\n` });
    }
    audit(db, req.auth, 'endorsement.request', 'document', doc.id, { authority: authority.id });
    deps.notifications.notify(authority.id, 'endorsement.requested', { title: `Endorsement requested: ${doc.number}`, body: `${req.auth!.org.name} asks you to endorse ${doc.number}.`, link: '/app/authority' });
    return reply.code(201).send({ id, status: 'pending', authority: authority.name });
  });

  api.get<{ Params: { id: string } }>('/shipments/:id/endorsements', { preHandler: requireAuth }, async (req) =>
    db.all(
      `SELECT e.id, e.document_id AS documentId, d.number, d.version, o.name AS authority, e.status, e.request_note AS requestNote,
              e.decision_note AS decisionNote, e.decided_by_name AS officer, e.decided_at AS decidedAt, e.created_at AS createdAt,
              b.status AS anchorStatus
         FROM endorsements e JOIN documents d ON d.id = e.document_id JOIN orgs o ON o.id = e.authority_org_id
         LEFT JOIN anchor_batches b ON b.id = e.batch_id
        WHERE e.shipment_id = ? AND e.requester_org_id = ? ORDER BY e.created_at DESC`,
      req.params.id, req.auth!.org.id,
    ),
  );

  api.delete<{ Params: { id: string } }>('/endorsements/:id', { preHandler: requireAuth }, async (req) => {
    const res = db.run("UPDATE endorsements SET status = 'cancelled' WHERE id = ? AND requester_org_id = ? AND status = 'pending'", req.params.id, req.auth!.org.id);
    if (!res.changes) throw new HttpError(409, 'not_pending', 'Only pending requests can be withdrawn.');
    return { ok: true };
  });

  // ------------------------------------------------------- authority side
  api.get<{ Querystring: { status?: string } }>('/authority/queue', { preHandler: requireAuthority }, async (req) => {
    const status = ['pending', 'endorsed', 'rejected'].includes(req.query.status ?? '') ? req.query.status! : 'pending';
    const rows = db.all<EndRow & { number: string; doc_status: string; sha256: string; requester: string; data: string; validation: string | null; corridor_id: string }>(
      `SELECT e.*, d.number, d.status AS doc_status, d.sha256, o.name AS requester, s.data, s.validation, s.corridor_id
         FROM endorsements e JOIN documents d ON d.id = e.document_id JOIN orgs o ON o.id = e.requester_org_id JOIN shipments s ON s.id = e.shipment_id
        WHERE e.authority_org_id = ? AND e.status = ? ORDER BY e.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`,
      req.auth!.org.id, status,
    );
    return rows.map((r) => {
      const s = json<Shipment>(r.data);
      const v = r.validation ? json<ValidationReport>(r.validation) : null;
      return {
        id: r.id,
        status: r.status,
        requestedAt: r.created_at,
        requester: r.requester,
        requestNote: r.request_note,
        decisionNote: r.decision_note,
        officer: r.decided_by_name,
        decidedAt: r.decided_at,
        document: { id: r.document_id, number: r.number, status: r.doc_status, sha256: r.sha256 },
        shipment: {
          corridor: getCorridor(r.corridor_id).name,
          exporter: s.exporter,
          consignee: { name: s.consignee.name, country: s.consignee.country },
          invoiceNumber: s.invoiceNumber,
          invoiceDate: s.invoiceDate,
          items: s.items.map((i) => ({ description: i.description, hsCode: i.hsCode, quantity: i.quantity, unit: i.unit, originCountry: i.originCountry, originCriterion: i.originCriterion, nonOriginatingPct: i.nonOriginatingPct, processingNote: i.processingNote, grossWeightKg: i.grossWeightKg })),
        },
        validation: v ? { status: v.status, errors: v.counts.error, warnings: v.counts.warning, findings: v.findings.filter((f) => f.severity !== 'info').map((f) => f.message) } : null,
      };
    });
  });

  api.get<{ Params: { id: string } }>('/authority/requests/:id/pdf', { preHandler: requireAuthority }, async (req, reply) => {
    const row = db.get<{ pdf: Uint8Array; number: string }>(
      'SELECT d.pdf, d.number FROM endorsements e JOIN documents d ON d.id = e.document_id WHERE e.id = ? AND e.authority_org_id = ?',
      req.params.id, req.auth!.org.id,
    );
    if (!row) throw new HttpError(404, 'not_found', 'Request not found');
    return reply.header('content-type', 'application/pdf').header('content-disposition', `inline; filename="${row.number}.pdf"`).header('cache-control', 'private, no-store').send(Buffer.from(row.pdf));
  });

  api.post<{ Params: { id: string } }>('/authority/requests/:id/decision', { preHandler: requireAuthority }, async (req) => {
    const body = z.object({ decision: z.enum(['endorse', 'reject']), note: z.string().trim().max(1000).optional() }).parse(req.body);
    if (body.decision === 'reject' && !body.note) throw new HttpError(400, 'reason_required', 'Give the exporter a reason so they can correct the certificate.');
    const e = db.get<EndRow>('SELECT * FROM endorsements WHERE id = ? AND authority_org_id = ?', req.params.id, req.auth!.org.id);
    if (!e) throw new HttpError(404, 'not_found', 'Request not found');
    if (e.status !== 'pending') throw new HttpError(409, 'decided', 'This request has already been decided or withdrawn.');
    const doc = db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ?`, e.document_id)!;
    const decidedAt = nowIso();

    if (body.decision === 'endorse') {
      if (doc.status !== 'active') throw new HttpError(409, 'not_active', `The exporter has ${doc.status === 'revoked' ? 'revoked' : 'replaced'} this certificate; it can no longer be endorsed.`);
      const record: EndorsementRecord = {
        v: 1, type: 'endorsement', endorsementId: e.id, documentId: doc.id, documentNumber: doc.number, documentSha256: doc.sha256,
        authorityId: req.auth!.org.id, authorityName: req.auth!.org.name, officerId: req.auth!.user.id, officerName: req.auth!.user.name, decidedAt,
      };
      const recordHash = crypto.createHash('sha256').update(canonicalJson(record)).digest('hex');
      db.run(
        `UPDATE endorsements SET status = 'endorsed', decision_note = ?, decided_by = ?, decided_by_name = ?, decided_at = ?,
           record = ?, record_hash = ?, signature = ? WHERE id = ? AND status = 'pending'`,
        body.note ?? null, req.auth!.user.id, req.auth!.user.name, decidedAt, JSON.stringify(record), recordHash, signer.signRecord(record), e.id,
      );
      anchor.schedule();
    } else {
      db.run(
        "UPDATE endorsements SET status = 'rejected', decision_note = ?, decided_by = ?, decided_by_name = ?, decided_at = ? WHERE id = ? AND status = 'pending'",
        body.note!, req.auth!.user.id, req.auth!.user.name, decidedAt, e.id,
      );
    }
    for (const to of orgEmails(e.requester_org_id)) {
      await mailer.send({
        to,
        subject: `${doc.number} ${body.decision === 'endorse' ? 'endorsed' : 'not endorsed'} by ${req.auth!.org.name}`,
        body: body.decision === 'endorse'
          ? `${req.auth!.org.name} endorsed ${doc.number}. Anyone verifying the certificate now sees the endorsement.\n\n${cfg.publicWebUrl}/app/shipments/${e.shipment_id}\n`
          : `${req.auth!.org.name} did not endorse ${doc.number}.\n\nReason: ${body.note}\n\nCorrect the shipment, re-issue, and request endorsement again:\n${cfg.publicWebUrl}/app/shipments/${e.shipment_id}\n`,
      });
    }
    audit(db, req.auth, `endorsement.${body.decision}`, 'endorsement', e.id, { document: doc.number, note: body.note });
    deps.notifications.notify(e.requester_org_id, 'endorsement.decided', {
      title: `${doc.number} ${body.decision === 'endorse' ? 'endorsed' : 'not endorsed'} by ${req.auth!.org.name}`,
      body: body.decision === 'endorse' ? 'Anyone verifying the certificate now sees the endorsement.' : `Reason: ${body.note}`,
      link: `/app/shipments/${e.shipment_id}`, severity: body.decision === 'endorse' ? 'success' : 'warning',
    });
    webhooks.dispatch(e.requester_org_id, 'endorsement.decided', {
      endorsementId: e.id, documentId: doc.id, number: doc.number, shipmentId: e.shipment_id,
      authority: req.auth!.org.name, decision: body.decision === 'endorse' ? 'endorsed' : 'rejected', reason: body.decision === 'reject' ? body.note : undefined, decidedAt,
    });
    return { ok: true, status: body.decision === 'endorse' ? 'endorsed' : 'rejected' };
  });
}

