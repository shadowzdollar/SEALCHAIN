/**
 * Sharing and activity.
 *
 *  - Share links: one URL that gives a buyer, bank or border officer the
 *    shipment's current documents with live verification status — instead of
 *    loose email attachments. Expiring, revocable, and every view/download is
 *    logged so the exporter knows the documents were received.
 *  - Activity feed: who has verified or opened the organisation's documents.
 *  - API keys: for forwarders' and brokers' own systems.
 */
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DOCUMENT_KIND_LABEL, getCorridor, type Shipment } from '@sealchain/core';
import { json, newId, nowIso } from '../db';
import { API_KEY_PREFIX, audit, newToken, requireAuth, requireOwner, requireSession, tokenHash } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';

const PUBLIC_RATE = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

interface LinkRow {
  id: string;
  org_id: string;
  shipment_id: string;
  label: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export async function sharingRoutes(api: FastifyInstance, { db, cfg }: Deps) {
  const clientHash = (ip: string) => crypto.createHash('sha256').update(`sealchain-share:${ip}`).digest('hex').slice(0, 16);

  const activeLink = (token: string) => {
    const link = db.get<LinkRow>('SELECT * FROM share_links WHERE token_hash = ?', tokenHash(token));
    if (!link || link.revoked_at || link.expires_at < nowIso()) {
      throw new HttpError(404, 'invalid_link', 'This link is invalid, expired or was withdrawn by the sender.');
    }
    return link;
  };

  // ------------------------------------------------------------ owner side
  api.post<{ Params: { id: string } }>('/shipments/:id/shares', { preHandler: requireAuth }, async (req, reply) => {
    const body = z.object({ label: z.string().trim().min(2).max(120), days: z.coerce.number().int().min(1).max(180).default(30) }).parse(req.body);
    const shipment = db.get<{ status: string }>('SELECT status FROM shipments WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id);
    if (!shipment) throw new HttpError(404, 'not_found', 'Shipment not found');
    if (shipment.status !== 'issued') throw new HttpError(409, 'not_issued', 'Issue the documents before sharing them.');
    const { token, hash } = newToken();
    const id = newId('shr', 16);
    const expiresAt = new Date(Date.now() + body.days * 86_400_000).toISOString();
    db.insert('share_links', { id, token_hash: hash, org_id: req.auth!.org.id, shipment_id: req.params.id, label: body.label, expires_at: expiresAt, created_by: req.auth!.user.id, created_at: nowIso() });
    audit(db, req.auth, 'share.create', 'shipment', req.params.id, { label: body.label, days: body.days });
    return reply.code(201).send({ id, label: body.label, expiresAt, url: `${cfg.publicWebUrl}/s/${token}` });
  });

  api.get<{ Params: { id: string } }>('/shipments/:id/shares', { preHandler: requireAuth }, async (req) =>
    db.all(
      `SELECT l.id, l.label, l.expires_at AS expiresAt, l.revoked_at AS revokedAt, l.created_at AS createdAt,
              (SELECT COUNT(*) FROM share_views v WHERE v.link_id = l.id AND v.action = 'view') AS views,
              (SELECT COUNT(*) FROM share_views v WHERE v.link_id = l.id AND v.action = 'download') AS downloads,
              (SELECT MAX(created_at) FROM share_views v WHERE v.link_id = l.id) AS lastSeenAt
         FROM share_links l WHERE l.shipment_id = ? AND l.org_id = ? ORDER BY l.created_at DESC`,
      req.params.id, req.auth!.org.id,
    ),
  );

  api.delete<{ Params: { id: string } }>('/shares/:id', { preHandler: requireAuth }, async (req) => {
    const res = db.run('UPDATE share_links SET revoked_at = ? WHERE id = ? AND org_id = ? AND revoked_at IS NULL', nowIso(), req.params.id, req.auth!.org.id);
    if (res.changes) audit(db, req.auth, 'share.revoke', 'share', req.params.id);
    return { ok: true };
  });

  // ----------------------------------------------------------- public side
  api.get<{ Params: { token: string } }>('/shares/:token', PUBLIC_RATE, async (req) => {
    const link = activeLink(req.params.token);
    const row = db.get<{ data: string; corridor_id: string; issued_version: number }>('SELECT data, corridor_id, issued_version FROM shipments WHERE id = ?', link.shipment_id)!;
    const org = db.get<{ name: string }>('SELECT name FROM orgs WHERE id = ?', link.org_id)!;
    const s = json<Shipment>(row.data);
    const docs = db.all<{ id: string; kind: keyof typeof DOCUMENT_KIND_LABEL; number: string; version: number; status: string; sha256: string; size: number; issued_at: string; anchor_status: string | null; anchored_at: string | null }>(
      `SELECT d.id, d.kind, d.number, d.version, d.status, d.sha256, d.size, d.issued_at, b.status AS anchor_status, b.anchored_at
         FROM documents d LEFT JOIN anchor_batches b ON b.id = d.batch_id
        WHERE d.shipment_id = ? AND d.version = ? ORDER BY d.kind`,
      link.shipment_id, row.issued_version,
    );
    if (req.auth?.org.id !== link.org_id) db.insert('share_views', { id: newId('shv', 16), link_id: link.id, action: 'view', client_hash: clientHash(req.ip), created_at: nowIso() });
    return {
      sharedBy: org.name,
      recipient: link.label,
      expiresAt: link.expires_at,
      shipment: {
        reference: s.reference,
        corridor: getCorridor(row.corridor_id).name,
        exporter: s.exporter.name,
        consignee: s.consignee.name,
        invoiceNumber: s.invoiceNumber,
        invoiceDate: s.invoiceDate,
        route: `${s.placeOfLoading} → ${s.finalDestination}`,
        border: [s.exitPoint, s.entryPoint].filter(Boolean).join(' → '),
        transport: `${s.transportMode}${s.transportRef ? ` · ${s.transportRef}` : ''}`,
        items: s.items.map((i) => ({ description: i.description, hsCode: i.hsCode, quantity: i.quantity, unit: i.unit })),
      },
      documents: docs.map((d) => ({
        id: d.id,
        kind: d.kind,
        kindLabel: DOCUMENT_KIND_LABEL[d.kind],
        number: d.number,
        version: d.version,
        status: d.status,
        sha256: d.sha256,
        size: d.size,
        issuedAt: d.issued_at,
        anchored: d.anchor_status === 'confirmed',
        anchoredAt: d.anchored_at,
      })),
    };
  });

  api.get<{ Params: { token: string; docId: string } }>('/shares/:token/documents/:docId/pdf', PUBLIC_RATE, async (req, reply) => {
    const link = activeLink(req.params.token);
    const doc = db.get<{ pdf: Uint8Array; number: string }>('SELECT pdf, number FROM documents WHERE id = ? AND shipment_id = ?', req.params.docId, link.shipment_id);
    if (!doc) throw new HttpError(404, 'not_found', 'Document not found');
    if (req.auth?.org.id !== link.org_id) db.insert('share_views', { id: newId('shv', 16), link_id: link.id, action: 'download', document_id: req.params.docId, client_hash: clientHash(req.ip), created_at: nowIso() });
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${doc.number}.pdf"`)
      .header('cache-control', 'private, no-store')
      .send(Buffer.from(doc.pdf));
  });

  // ------------------------------------------------------------- activity
  api.get<{ Querystring: { shipmentId?: string; limit?: string } }>('/activity', { preHandler: requireAuth }, async (req) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30)));
    const filter = req.query.shipmentId ? 'AND d.shipment_id = ?' : '';
    const args = req.query.shipmentId ? [req.auth!.org.id, req.query.shipmentId] : [req.auth!.org.id];
    const verifications = db.all<{ at: string; outcome: string; method: string; number: string; kind: string; shipment_id: string; reference: string; client_hash: string | null }>(
      `SELECT v.created_at AS at, v.outcome, v.method, d.number, d.kind, d.shipment_id, s.reference, v.client_hash
         FROM verification_events v JOIN documents d ON d.id = v.document_id JOIN shipments s ON s.id = d.shipment_id
        WHERE d.org_id = ? ${filter} ORDER BY v.created_at DESC LIMIT ${limit}`,
      ...args,
    );
    const shareFilter = req.query.shipmentId ? 'AND l.shipment_id = ?' : '';
    const shares = db.all<{ at: string; action: string; label: string; shipment_id: string; reference: string; number: string | null }>(
      `SELECT v.created_at AS at, v.action, l.label, l.shipment_id, s.reference, d.number
         FROM share_views v JOIN share_links l ON l.id = v.link_id JOIN shipments s ON s.id = l.shipment_id
         LEFT JOIN documents d ON d.id = v.document_id
        WHERE l.org_id = ? ${shareFilter} ORDER BY v.created_at DESC LIMIT ${limit}`,
      ...args,
    );
    const events = [
      ...verifications.map((v) => ({
        at: v.at, type: 'verification' as const, shipmentId: v.shipment_id, reference: v.reference,
        text: `${v.number} ${v.outcome === 'tampered' ? 'was presented ALTERED' : `was verified (${v.outcome.replace(/_/g, ' ')})`}${v.method.includes('hash') || v.method === 'file' ? ' — file compared' : ''}`,
        alert: v.outcome === 'tampered',
      })),
      ...shares.map((s) => ({
        at: s.at, type: 'share' as const, shipmentId: s.shipment_id, reference: s.reference,
        text: s.action === 'download' ? `${s.label} downloaded ${s.number}` : `${s.label} opened the shared documents`,
        alert: false,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
    return events;
  });

  // ------------------------------------------------------------- API keys
  api.get('/api-keys', { preHandler: requireSession }, async (req) =>
    db.all(
      `SELECT k.id, k.name, k.prefix, k.created_at AS createdAt, k.last_used_at AS lastUsedAt, u.name AS createdBy
         FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.org_id = ? AND k.revoked_at IS NULL ORDER BY k.created_at DESC`,
      req.auth!.org.id,
    ),
  );

  api.post('/api-keys', { preHandler: [requireSession, requireOwner] }, async (req, reply) => {
    const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(req.body);
    const secret = `${API_KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
    const id = newId('key', 16);
    db.insert('api_keys', { id, org_id: req.auth!.org.id, user_id: req.auth!.user.id, name, prefix: secret.slice(0, API_KEY_PREFIX.length + 6), key_hash: tokenHash(secret), created_at: nowIso() });
    audit(db, req.auth, 'apikey.create', 'api_key', id, { name });
    // The secret is shown exactly once.
    return reply.code(201).send({ id, name, key: secret });
  });

  api.delete<{ Params: { id: string } }>('/api-keys/:id', { preHandler: [requireSession, requireOwner] }, async (req) => {
    db.run('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND org_id = ?', nowIso(), req.params.id, req.auth!.org.id);
    audit(db, req.auth, 'apikey.revoke', 'api_key', req.params.id);
    return { ok: true };
  });
}
