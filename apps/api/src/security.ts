/**
 * HTTP hardening.
 *
 *  - CSRF: session cookies are SameSite=Lax, which already stops cross-site
 *    POSTs in modern browsers. As defence in depth, any state-changing request
 *    authenticated by the session cookie must come from an allowed origin
 *    (checked via Origin, falling back to Referer). Bearer-token (API key)
 *    requests and requests without browser origin headers are unaffected.
 *  - Security headers on every response, plus a Content-Security-Policy for
 *    the web app's HTML.
 */
import type { FastifyInstance } from 'fastify';
import type { Config } from './config';
import { SESSION_COOKIE } from './services/auth';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function registerSecurity(app: FastifyInstance, cfg: Config) {
  const allowed = new Set([cfg.publicWebUrl, ...cfg.corsOrigins].map((o) => originOf(o)).filter(Boolean) as string[]);

  app.addHook('preHandler', async (req, reply) => {
    if (SAFE.has(req.method)) return;
    const usesCookie = !!req.cookies?.[SESSION_COOKIE] && !req.headers.authorization;
    if (!usesCookie) return;
    const origin = originOf(req.headers.origin) ?? originOf(req.headers.referer);
    if (origin && !allowed.has(origin)) {
      req.log.warn({ origin, url: req.url }, 'blocked cross-origin state-changing request');
      return reply.code(403).send({ error: 'forbidden_origin', message: 'Request blocked: it did not come from the SealChain app.' });
    }
  });

  const rpcOrigin = originOf(cfg.anchor.publicRpcUrl);
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self'${rpcOrigin ? ` ${rpcOrigin}` : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com https://appleid.apple.com",
    "object-src 'none'",
  ].join('; ');

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('x-frame-options', 'DENY');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('cross-origin-opener-policy', 'same-origin');
    if (cfg.isProd) reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    const type = String(reply.getHeader('content-type') ?? '');
    if (type.includes('text/html')) reply.header('content-security-policy', csp);
    if (req.url.startsWith('/api/') && !reply.getHeader('cache-control')) reply.header('cache-control', 'no-store');
    return payload;
  });
}
