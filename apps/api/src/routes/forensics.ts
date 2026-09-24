import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { json, newId, nowIso } from '../db';
import { audit, requireAuth } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';
import { analyzeDocument, dHash, decodeImageFile, loadImageCodecs } from '../services/forensics';
import { alertTampered } from '../services/alerts';

async function readParts(req: FastifyRequest) {
  const files: Record<string, { filename: string; bytes: Uint8Array }> = {};
  const fields: Record<string, string> = {};
  for await (const part of req.parts()) {
    if (part.type === 'file') files[part.fieldname] = { filename: part.filename, bytes: new Uint8Array(await part.toBuffer()) };
    else fields[part.fieldname] = String(part.value ?? '');
  }
  return { files, fields };
}

export async function forensicsRoutes(api: FastifyInstance, deps: Deps) {
  const { db } = deps;
  const auth = { preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  api.post('/forensics', auth, async (req, reply) => {
    const { files } = await readParts(req);
    const document = files.document;
    if (!document) throw new HttpError(400, 'invalid_request', 'Attach the document to check as "document".');
    let result;
    try {
      result = await analyzeDocument(db, { ...document, companion: files.companion, orgId: req.auth!.org.id });
    } catch (err) {
      throw new HttpError(422, 'unreadable', (err as Error).message);
    }
    const id = newId('frn', 16);
    db.insert('forensic_reports', {
      id, org_id: req.auth!.org.id, user_id: req.auth!.user.id, filename: document.filename.slice(0, 200), sha256: result.sha256,
      risk_level: result.risk.level, risk_score: result.risk.score, result: JSON.stringify(result), cert_number: result.certNumber, created_at: nowIso(),
    });
    // Tell the real issuer that an altered copy of their document is circulating.
    if (result.claimed) {
      const original = db.get<{ id: string; org_id: string; number: string; shipment_id: string }>('SELECT id, org_id, number, shipment_id FROM documents WHERE id = ?', result.claimed.id);
      if (original && original.org_id !== req.auth!.org.id) {
        void alertTampered(deps, original, 'a document check by another SealChain user').catch((err) => req.log.error({ err }, 'tamper alert failed'));
      }
    }
    audit(db, req.auth, 'forensics.analyze', 'forensic_report', id, { risk: result.risk });
    return reply.code(201).send({ id, ...result });
  });

  api.get('/forensics', { preHandler: requireAuth }, async (req) =>
    db.all('SELECT id, filename, sha256, risk_level AS riskLevel, risk_score AS riskScore, outcome, created_at AS createdAt FROM forensic_reports WHERE org_id = ? ORDER BY created_at DESC LIMIT 100', req.auth!.org.id),
  );

  api.get<{ Params: { id: string } }>('/forensics/:id', { preHandler: requireAuth }, async (req) => {
    const row = db.get<{ id: string; result: string; created_at: string; outcome: string | null; outcome_note: string | null }>('SELECT id, result, created_at, outcome, outcome_note FROM forensic_reports WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id);
    if (!row) throw new HttpError(404, 'not_found', 'Report not found');
    return { id: row.id, createdAt: row.created_at, ...json<object>(row.result), outcome: row.outcome, outcomeNote: row.outcome_note };
  });

  /** What the document turned out to be — feeds signal performance. */
  api.put<{ Params: { id: string } }>('/forensics/:id/outcome', { preHandler: requireAuth }, async (req) => {
    const body = z.object({ outcome: z.enum(['fraud', 'genuine', 'unknown']), note: z.string().trim().max(1000).optional() }).parse(req.body);
    const res = db.run(
      'UPDATE forensic_reports SET outcome = ?, outcome_note = ?, outcome_by = ?, outcome_at = ? WHERE id = ? AND org_id = ?',
      body.outcome === 'unknown' ? null : body.outcome, body.note ?? null, req.auth!.user.email, nowIso(), req.params.id, req.auth!.org.id,
    );
    if (!res.changes) throw new HttpError(404, 'not_found', 'Report not found');
    audit(db, req.auth, 'forensics.outcome', 'forensic_report', req.params.id, body);
    return { ok: true };
  });

  // Known-genuine seal / stamp references used by the seal comparison check.
  api.get('/seals', { preHandler: requireAuth }, async (req) =>
    db.all('SELECT id, authority, label, dhash, created_at AS createdAt FROM seal_references WHERE org_id = ? ORDER BY authority, label', req.auth!.org.id),
  );

  api.post('/seals', auth, async (req, reply) => {
    await loadImageCodecs();
    const { files, fields } = await readParts(req);
    const image = files.image;
    const authority = fields.authority?.trim();
    const label = fields.label?.trim() || image?.filename || 'Seal';
    if (!image || !authority) throw new HttpError(400, 'invalid_request', 'Provide an "image" (PNG/JPEG) and the issuing "authority".');
    let hash: string;
    try {
      hash = dHash(decodeImageFile(image.bytes));
    } catch (err) {
      throw new HttpError(422, 'unreadable', (err as Error).message);
    }
    const id = newId('sea', 16);
    db.insert('seal_references', { id, org_id: req.auth!.org.id, authority: authority.slice(0, 120), label: label.slice(0, 120), dhash: hash, created_by: req.auth!.user.id, created_at: nowIso() });
    return reply.code(201).send({ id, authority, label, dhash: hash });
  });

  api.delete<{ Params: { id: string } }>('/seals/:id', { preHandler: requireAuth }, async (req) => {
    db.run('DELETE FROM seal_references WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id);
    return { ok: true };
  });
}
