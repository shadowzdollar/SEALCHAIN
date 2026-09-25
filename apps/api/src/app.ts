import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import type { Config } from './config';
import { Db } from './db';
import { AnchorService, createAnchorBackend } from './services/anchor';
import { resolveSession, tokenFrom } from './services/auth';
import { HttpError, type Deps } from './services/documents';
import { IssuerSigner } from './services/signing';
import { Mailer } from './services/mailer';
import { WebhookService } from './services/webhooks';
import { webhookRoutes } from './routes/webhooks';
import { teamRoutes } from './routes/team';
import { sharingRoutes } from './routes/sharing';
import { oauthRoutes } from './routes/oauth';
import { endorsementRoutes } from './routes/endorsements';
import { registerSecurity } from './security';
import { authRoutes } from './routes/auth';
import { shipmentRoutes } from './routes/shipments';
import { verifyRoutes } from './routes/verify';
import { forensicsRoutes } from './routes/forensics';
import { adminRoutes } from './routes/admin';
import { metaRoutes } from './routes/meta';
import { publicRoutes } from './routes/public';

export interface App {
  app: FastifyInstance;
  deps: Deps;
}

export async function buildApp(cfg: Config, opts: { logger?: boolean; startAnchoring?: boolean } = {}): Promise<App> {
  const db = new Db(cfg.dbFile);
  const signer = new IssuerSigner(cfg.dataDir);
  const app = Fastify({
    logger: opts.logger === false ? false : { level: cfg.isProd ? 'info' : 'info', transport: undefined },
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  });
  const anchor = new AnchorService(db, createAnchorBackend(cfg, db), cfg.anchor, app.log as never);
  const mailer = new Mailer(db, cfg.mail, app.log as never);
  const webhooks = new WebhookService(db, app.log as never);
  const deps: Deps = { db, cfg, signer, anchor, mailer, webhooks };
  // Tell each organisation when its documents are confirmed on-chain.
  anchor.onConfirmed = (batchId) => {
    const batch = db.get<{ root: string; tx_hash: string | null; chain_id: number | null; anchored_at: string; backend: string }>('SELECT root, tx_hash, chain_id, anchored_at, backend FROM anchor_batches WHERE id = ?', batchId);
    if (!batch) return;
    const byOrg = new Map<string, Array<{ id: string; number: string; kind: string }>>();
    for (const d of db.all<{ id: string; org_id: string; number: string; kind: string }>('SELECT id, org_id, number, kind FROM documents WHERE batch_id = ?', batchId)) {
      byOrg.set(d.org_id, [...(byOrg.get(d.org_id) ?? []), { id: d.id, number: d.number, kind: d.kind }]);
    }
    for (const [orgId, documents] of byOrg) {
      webhooks.dispatch(orgId, 'document.anchored', { batchId, root: batch.root, backend: batch.backend, chainId: batch.chain_id, txHash: batch.tx_hash, anchoredAt: batch.anchored_at, documents });
    }
  };

  await app.register(cookie);
  await app.register(cors, { origin: cfg.corsOrigins, credentials: true });
  await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 2, fields: 10 } });
  await app.register(rateLimit, { global: false });

  // Apple's sign-in callback is an HTML form POST.
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 64 * 1024 }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (req) => {
    req.auth = resolveSession(db, tokenFrom(req));
  });

  registerSecurity(app, cfg);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: err.code, message: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
        details: err.issues,
      });
    }
    const e = err as { statusCode?: number; message: string; code?: string };
    if (e.statusCode && e.statusCode < 500) {
      return reply.code(e.statusCode).send({ error: e.code ?? 'bad_request', message: e.message });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'internal', message: 'Something went wrong. Please try again.' });
  });

  await app.register(async (api) => {
    await metaRoutes(api, deps);
    await publicRoutes(api, deps);
    await authRoutes(api, deps);
    await teamRoutes(api, deps);
    await sharingRoutes(api, deps);
    await oauthRoutes(api, deps);
    await endorsementRoutes(api, deps);
    await webhookRoutes(api, deps);
    await shipmentRoutes(api, deps);
    await verifyRoutes(api, deps);
    await forensicsRoutes(api, deps);
    await adminRoutes(api, deps);
  }, { prefix: '/api' });

  // Production: serve the built web app with SPA fallback.
  if (fs.existsSync(cfg.webDist)) {
    await app.register(fastifyStatic, { root: cfg.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'not_found', message: 'Not found' });
    });
  }

  app.addHook('onClose', async () => {
    anchor.stop();
    webhooks.stop();
    db.close();
  });

  if (opts.startAnchoring !== false) {
    anchor.start();
    webhooks.start();
  }
  return { app, deps };
}
