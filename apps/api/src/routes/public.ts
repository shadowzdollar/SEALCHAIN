/**
 * Public-site endpoints: "talk to us" requests and the system status page.
 * Status is deliberately coarse — it never exposes wallet addresses, balances
 * or internal error text.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { newId, nowIso } from '../db';
import { audit, requireCompliance } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';

export const CONTACT_TOPICS = ['pilot', 'authority', 'verification', 'integration', 'press', 'other'] as const;

const ContactBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  company: z.string().trim().max(160).optional(),
  country: z.string().trim().max(80).optional(),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10).max(4000),
  /** Honeypot: real people never fill this hidden field. */
  website: z.string().max(0).optional(),
});

type ComponentState = 'operational' | 'degraded' | 'down';

export async function publicRoutes(api: FastifyInstance, deps: Deps) {
  const { db, cfg, anchor, mailer } = deps;

  api.post('/contact', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
    const body = ContactBody.parse(req.body);
    const id = newId('ctr', 16);
    db.insert('contact_requests', {
      id, name: body.name, email: body.email, company: body.company || null, country: body.country || null,
      topic: body.topic, message: body.message, created_at: nowIso(),
    });
    void mailer
      .send({
        to: cfg.contactEmail,
        subject: `[SealChain] ${body.topic} request from ${body.name}${body.company ? ` (${body.company})` : ''}`,
        body: `${body.name} <${body.email}>\n${[body.company, body.country].filter(Boolean).join(' · ')}\nTopic: ${body.topic}\n\n${body.message}\n\nReference: ${id}`,
      })
      .catch((err) => req.log.error({ err }, 'contact mail failed'));
    return reply.code(201).send({ id });
  });

  api.get('/status', async () => {
    const checkedAt = nowIso();
    let database: ComponentState = 'operational';
    try {
      db.get('SELECT 1');
    } catch {
      database = 'down';
    }

    let anchoring: ComponentState = 'operational';
    try {
      const h = await anchor.backend.health();
      if (!h.ok) anchoring = 'down';
    } catch {
      anchoring = 'down';
    }
    const pending = db.get<{ n: number; oldest: string | null }>(
      `SELECT COUNT(*) AS n, MIN(d.issued_at) AS oldest FROM documents d LEFT JOIN anchor_batches b ON b.id = d.batch_id
        WHERE d.batch_id IS NULL OR b.status != 'confirmed'`,
    ) ?? { n: 0, oldest: null };
    // Documents normally anchor within minutes; an hour-old backlog is a degradation.
    if (anchoring === 'operational' && pending.oldest && Date.now() - new Date(pending.oldest).getTime() > 60 * 60_000) anchoring = 'degraded';
    const lastBatch = db.get<{ anchored_at: string | null }>("SELECT anchored_at FROM anchor_batches WHERE status = 'confirmed' ORDER BY anchored_at DESC LIMIT 1");

    const failedMail = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed' AND created_at > ?", new Date(Date.now() - 86_400_000).toISOString())?.n ?? 0;
    const email: ComponentState = failedMail > 5 ? 'degraded' : 'operational';

    const components = [
      { id: 'web', name: 'Web app & API', state: database === 'down' ? 'down' : 'operational' },
      { id: 'verification', name: 'Public verification', state: database },
      { id: 'anchoring', name: 'Blockchain anchoring', state: anchoring },
      { id: 'email', name: 'Email notifications', state: email },
    ] satisfies Array<{ id: string; name: string; state: ComponentState }>;
    const overall: ComponentState = components.some((c) => c.state === 'down') ? 'down' : components.some((c) => c.state === 'degraded') ? 'degraded' : 'operational';

    return {
      overall,
      checkedAt,
      components,
      anchoring: {
        backend: anchor.backend.info.backend,
        network: anchor.backend.info.networkName,
        lastAnchoredAt: lastBatch?.anchored_at ?? null,
        awaitingAnchor: pending.n,
      },
    };
  });

  // ---- compliance console: work the inbox
  api.get('/admin/contact-requests', { preHandler: requireCompliance }, async () =>
    db.all(
      `SELECT id, name, email, company, country, topic, message, created_at AS createdAt, handled_at AS handledAt, handled_by AS handledBy
         FROM contact_requests ORDER BY handled_at IS NOT NULL, created_at DESC LIMIT 200`,
    ),
  );

  api.post<{ Params: { id: string } }>('/admin/contact-requests/:id/handled', { preHandler: requireCompliance }, async (req) => {
    const res = db.run('UPDATE contact_requests SET handled_at = ?, handled_by = ? WHERE id = ? AND handled_at IS NULL', nowIso(), req.auth!.user.email, req.params.id);
    if (!res.changes) throw new HttpError(404, 'not_found', 'Request not found or already handled');
    audit(db, req.auth, 'contact.handled', 'contact_request', req.params.id);
    return { ok: true };
  });
}
