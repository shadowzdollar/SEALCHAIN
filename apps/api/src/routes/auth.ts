import type { FastifyInstance, FastifyReply } from 'fastify';
import { newId, nowIso } from '../db';
import { loginSchema, registerSchema } from '../schemas';
import {
  SESSION_COOKIE,
  audit,
  createSession,
  destroySession,
  hashPassword,
  requireAuth,
  resolveSession,
  tokenFrom,
  verifyPassword,
} from '../services/auth';
import type { Deps } from '../services/documents';
import { z } from 'zod';
import { createChallenge, finishChallenge, hasTwoFactor, recoveryCodesLeft, useChallenge, verifySecondFactor } from '../services/twofactor';

const RATE = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

export async function authRoutes(api: FastifyInstance, { db, cfg }: Deps) {
  const setCookie = (reply: FastifyReply, token: string, expires: Date) =>
    reply.setCookie(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: cfg.isProd, expires });

  api.post('/auth/register', RATE, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    if (db.get('SELECT 1 FROM users WHERE email = ?', body.email)) {
      return reply.code(409).send({ error: 'email_taken', message: 'An account with this email already exists.' });
    }
    const orgId = newId('org', 16);
    const userId = newId('usr', 16);
    const role = cfg.adminEmails.includes(body.email) ? 'compliance' : 'owner';
    db.tx(() => {
      db.insert('orgs', { id: orgId, name: body.orgName, country: body.country, plan: 'pilot', created_at: nowIso() });
      db.insert('users', { id: userId, org_id: orgId, email: body.email, name: body.name, password_hash: hashPassword(body.password), role, created_at: nowIso() });
    });
    const { token, expiresAt } = createSession(db, userId, cfg.sessionDays, { userAgent: req.headers['user-agent'] });
    setCookie(reply, token, expiresAt);
    const ctx = resolveSession(db, token)!;
    audit(db, ctx, 'auth.register', 'user', userId);
    return reply.code(201).send({ ...ctx, token });
  });

  api.post('/auth/login', RATE, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = db.get<{ id: string; password_hash: string }>('SELECT id, password_hash FROM users WHERE email = ?', body.email);
    // Same response for unknown email and wrong password.
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Email or password is incorrect.' });
    }
    // Two-step sign-in: the password alone only earns a short-lived challenge.
    if (hasTwoFactor(db, user.id)) return { twoFactorRequired: true, challenge: createChallenge(db, user.id) };
    const { token, expiresAt } = createSession(db, user.id, cfg.sessionDays, { userAgent: req.headers['user-agent'] });
    setCookie(reply, token, expiresAt);
    const ctx = resolveSession(db, token)!;
    audit(db, ctx, 'auth.login', 'user', user.id);
    return { ...ctx, token };
  });

  /** Second step: exchange a challenge and an authenticator (or recovery) code for a session. */
  api.post('/auth/login/2fa', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ challenge: z.string().min(20).max(100), code: z.string().trim().min(6).max(20) }).parse(req.body);
    const ch = useChallenge(db, body.challenge);
    if (ch === 'expired') return reply.code(401).send({ error: 'challenge_expired', message: 'This sign-in has expired. Please sign in again.' });
    if (ch === 'locked') return reply.code(429).send({ error: 'too_many_attempts', message: 'Too many wrong codes. Please sign in again.' });
    const method = verifySecondFactor(db, ch.userId, body.code);
    if (!method) return reply.code(401).send({ error: 'invalid_code', message: 'That code is not valid. Use the current code from your authenticator app, or a recovery code.' });
    finishChallenge(db, body.challenge);
    const { token, expiresAt } = createSession(db, ch.userId, cfg.sessionDays, { userAgent: req.headers['user-agent'] });
    setCookie(reply, token, expiresAt);
    const ctx = resolveSession(db, token)!;
    audit(db, ctx, 'auth.login', 'user', ch.userId, { secondFactor: method });
    const left = method === 'recovery' ? recoveryCodesLeft(db, ch.userId) : undefined;
    return { ...ctx, token, next: ch.next, recoveryCodesLeft: left };
  });

  api.post('/auth/logout', async (req, reply) => {
    const token = tokenFrom(req);
    if (token) destroySession(db, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  api.get('/auth/me', { preHandler: requireAuth }, async (req) => req.auth);
}
