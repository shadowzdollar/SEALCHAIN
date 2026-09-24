import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { newId, nowIso } from '../db';
import { audit, requireOwner, requireSession } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';
import { WEBHOOK_EVENTS, checkWebhookUrl } from '../services/webhooks';

export async function webhookRoutes(api: FastifyInstance, { db, cfg, webhooks }: Deps) {
  const guard = { preHandler: [requireSession, requireOwner] };
  const own = (orgId: string, id: string) => {
    const w = db.get<{ id: string }>('SELECT id FROM webhooks WHERE id = ? AND org_id = ?', id, orgId);
    if (!w) throw new HttpError(404, 'not_found', 'Webhook not found');
    return w;
  };

  api.get('/webhooks', guard, async (req) =>
    db.all<{ id: string; url: string; events: string; active: number; created_at: string; delivered: number; failed: number; last_at: string | null }>(
      `SELECT w.id, w.url, w.events, w.active, w.created_at,
              (SELECT COUNT(*) FROM webhook_deliveries d WHERE d.webhook_id = w.id AND d.status = 'delivered') AS delivered,
              (SELECT COUNT(*) FROM webhook_deliveries d WHERE d.webhook_id = w.id AND d.status = 'failed') AS failed,
              (SELECT MAX(created_at) FROM webhook_deliveries d WHERE d.webhook_id = w.id) AS last_at
         FROM webhooks w WHERE w.org_id = ? ORDER BY w.created_at DESC`,
      req.auth!.org.id,
    ).map((w) => ({ id: w.id, url: w.url, events: JSON.parse(w.events), active: !!w.active, createdAt: w.created_at, delivered: w.delivered, failed: w.failed, lastDeliveryAt: w.last_at })),
  );

  api.post('/webhooks', guard, async (req, reply) => {
    const body = z.object({ url: z.string().trim().max(500), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1) }).parse(req.body);
    const bad = checkWebhookUrl(body.url, cfg);
    if (bad) throw new HttpError(400, 'invalid_url', bad);
    const id = newId('whk', 16);
    const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
    db.insert('webhooks', { id, org_id: req.auth!.org.id, url: body.url, secret, events: JSON.stringify([...new Set(body.events)]), active: 1, created_by: req.auth!.user.id, created_at: nowIso() });
    audit(db, req.auth, 'webhook.create', 'webhook', id, { url: body.url, events: body.events });
    // The signing secret is shown once.
    return reply.code(201).send({ id, url: body.url, events: body.events, secret });
  });

  api.delete<{ Params: { id: string } }>('/webhooks/:id', guard, async (req) => {
    own(req.auth!.org.id, req.params.id);
    db.tx(() => {
      db.run('DELETE FROM webhook_deliveries WHERE webhook_id = ?', req.params.id);
      db.run('DELETE FROM webhooks WHERE id = ?', req.params.id);
    });
    audit(db, req.auth, 'webhook.delete', 'webhook', req.params.id);
    return { ok: true };
  });

  api.post<{ Params: { id: string } }>('/webhooks/:id/test', guard, async (req) => {
    own(req.auth!.org.id, req.params.id);
    const id = webhooks.enqueue(req.params.id, 'ping', { message: 'Test event from SealChain', organisation: req.auth!.org.name });
    await webhooks.process();
    return db.get('SELECT id, status, response_code AS responseCode, error FROM webhook_deliveries WHERE id = ?', id);
  });

  api.get<{ Params: { id: string } }>('/webhooks/:id/deliveries', guard, async (req) => {
    own(req.auth!.org.id, req.params.id);
    return db.all(
      `SELECT id, event, status, attempts, response_code AS responseCode, error, created_at AS createdAt, delivered_at AS deliveredAt, next_attempt_at AS nextAttemptAt
         FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 50`,
      req.params.id,
    );
  });

  api.post<{ Params: { id: string } }>('/webhooks/deliveries/:id/retry', guard, async (req) => {
    const res = db.run(
      `UPDATE webhook_deliveries SET status = 'pending', next_attempt_at = ?
        WHERE id = ? AND status = 'failed' AND webhook_id IN (SELECT id FROM webhooks WHERE org_id = ?)`,
      nowIso(), req.params.id, req.auth!.org.id,
    );
    if (!res.changes) throw new HttpError(409, 'not_failed', 'Only failed deliveries can be retried.');
    await webhooks.process();
    return { ok: true };
  });
}
