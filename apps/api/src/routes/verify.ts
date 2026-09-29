/**
 * Public verification — no account needed. This is what a customs officer,
 * bank or buyer uses. Browsers hash the file locally (Web Crypto) and send
 * only the hash; POST /verify/file exists for clients that cannot.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PDFDocument } from 'pdf-lib';
import { extractFields } from '@sealchain/core';
import { DOC_COLUMNS, buildVerification, recordVerification, sha256, type Deps, type DocumentRow } from '../services/documents';
import { extractPdfText } from '../services/forensics';
import { alertTampered } from '../services/alerts';

const RATE = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };
const ID_RE = /^doc_[a-z0-9]{16,40}$/;
const SHA_RE = /^[a-f0-9]{64}$/;

export async function verifyRoutes(api: FastifyInstance, deps: Deps) {
  const { db } = deps;
  const byId = (id: string) => db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ?`, id);
  /** Only count checks by outsiders — an exporter viewing their own record isn't a verification. */
  const record = (req: FastifyRequest, doc: DocumentRow | undefined, method: string, outcome: string) => {
    if (doc && req.auth?.org.id === doc.org_id) return;
    recordVerification(db, doc?.id ?? null, method, outcome, req.ip);
    if (doc && outcome !== 'tampered') {
      deps.notifications.notify(doc.org_id, 'document.verified', {
        title: `${doc.number} was verified`,
        body: `Someone outside your organisation checked ${doc.number}${method.includes('hash') || method === 'file' ? ' and compared the file' : ''}. Result: ${outcome.replace(/_/g, ' ')}.`,
        link: `/app/shipments/${doc.shipment_id}`, dedupeKey: `verified:${doc.id}`,
      });
    }
    if (doc && outcome === 'tampered') void alertTampered(deps, doc, 'public verification').catch((err) => req.log.error({ err }, 'tamper alert failed'));
  };

  api.get<{ Params: { id: string }; Querystring: { sha256?: string } }>('/verify/:id', RATE, async (req, reply) => {
    const { id } = req.params;
    const provided = req.query.sha256?.toLowerCase();
    if (!ID_RE.test(id) || (provided && !SHA_RE.test(provided))) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Malformed document id or hash' });
    }
    const doc = byId(id);
    if (!doc) {
      record(req, undefined, 'id', 'not_found');
      return reply.code(404).send({ verdict: 'not_found', message: 'No document with this id was ever issued by SealChain.' });
    }
    const result = await buildVerification(deps, doc, provided);
    record(req, doc, provided ? 'id+hash' : 'id', result.verdict);
    return result;
  });

  api.get<{ Params: { sha256: string } }>('/verify/hash/:sha256', RATE, async (req, reply) => {
    const hash = req.params.sha256.toLowerCase();
    if (!SHA_RE.test(hash)) return reply.code(400).send({ error: 'invalid_request', message: 'Expected a SHA-256 hex digest' });
    const doc = db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE sha256 = ?`, hash);
    if (!doc) {
      record(req, undefined, 'hash', 'not_found');
      return reply.code(404).send({
        verdict: 'not_found',
        message: 'This exact file was not issued by SealChain. If it claims to be a SealChain document, it has been altered or fabricated.',
      });
    }
    const result = await buildVerification(deps, doc, hash);
    record(req, doc, 'hash', result.verdict);
    return result;
  });

  /** Upload fallback. If the bytes are unknown, work out which document the file claims to be. */
  api.post('/verify/file', RATE, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'invalid_request', message: 'Attach a PDF file' });
    const bytes = new Uint8Array(await file.toBuffer());
    const hash = sha256(bytes);
    const exact = db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE sha256 = ?`, hash);
    if (exact) {
      const result = await buildVerification(deps, exact, hash);
      record(req, exact, 'file', result.verdict);
      return result;
    }
    let claimed: DocumentRow | undefined;
    try {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      const metaId = pdf.getSubject()?.match(/\b(doc_[a-z0-9]{16,})\b/)?.[1];
      const fields = extractFields((await extractPdfText(bytes)).text);
      const id = fields.verifyId ?? metaId;
      claimed = (id && byId(id)) || (fields.sealchainId ? db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE number = ?`, fields.sealchainId) : undefined);
    } catch {
      /* not a readable PDF — fall through */
    }
    if (claimed) {
      const result = await buildVerification(deps, claimed, hash);
      record(req, claimed, 'file', result.verdict);
      return result;
    }
    record(req, undefined, 'file', 'not_found');
    return reply.code(404).send({
      verdict: 'not_found',
      sha256: hash,
      message: 'This file was not issued by SealChain and does not reference a SealChain document.',
    });
  });
}
