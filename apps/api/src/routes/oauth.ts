/**
 * Sign in / sign up with Google and Apple.
 *
 *   GET  /auth/oauth/:provider/start?next=&invite=   → redirect to the provider
 *   GET|POST /auth/oauth/:provider/callback          → provider returns here
 *   GET  /auth/oauth/pending/:token                  → prefill "name your business"
 *   POST /auth/oauth/complete                        → create org + user for newcomers
 *   GET  /auth/identities, DELETE /auth/identities/:provider
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { newId, nowIso } from '../db';
import { SESSION_COOKIE, audit, createSession, newToken, requireSession, resolveSession, tokenHash } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';
import {
  PROVIDERS,
  authorizeUrl,
  emailVerified,
  enabledProviders,
  exchangeCode,
  pkcePair,
  safeNext,
  verifyIdToken,
  type ProviderId,
} from '../services/oidc';

import { createChallenge, hasTwoFactor } from '../services/twofactor';
const RATE = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };
const STATE_MINUTES = 10;

export async function oauthRoutes(api: FastifyInstance, { db, cfg }: Deps) {
  const web = cfg.publicWebUrl;

  const provider = (p: string): ProviderId => {
    if (p !== 'google' && p !== 'apple') throw new HttpError(404, 'not_found', 'Unknown sign-in provider');
    if (!enabledProviders(cfg).includes(p)) throw new HttpError(404, 'not_configured', `Sign in with ${PROVIDERS[p].name} is not enabled on this server.`);
    return p;
  };

  const signIn = (reply: FastifyReply, userId: string, userAgent?: string) => {
    const { token, expiresAt } = createSession(db, userId, cfg.sessionDays, { userAgent });
    reply.setCookie(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: cfg.isProd, expires: expiresAt });
    return token;
  };

  const fail = (reply: FastifyReply, message: string) =>
    reply.redirect(`${web}/login?oauth_error=${encodeURIComponent(message)}`, 302);

  // ----------------------------------------------------------------- start
  api.get<{ Params: { provider: string }; Querystring: { next?: string; invite?: string; link?: string } }>('/auth/oauth/:provider/start', RATE, async (req, reply) => {
    // A browser landing here for a provider we haven't configured gets sent back with a message, not an error page.
    const known = req.params.provider === 'google' || req.params.provider === 'apple';
    if (known && !enabledProviders(cfg).includes(req.params.provider as ProviderId)) {
      return fail(reply, `Sign in with ${PROVIDERS[req.params.provider as ProviderId].name} isn’t available yet. Please use your email and password for now.`);
    }
    const p = provider(req.params.provider);
    // "Connect Google" from settings: link to the signed-in user, whatever the provider email is.
    const linkUser = req.query.link === '1' && req.auth?.via === 'session' ? req.auth.user.id : null;
    const state = newToken();
    const nonce = newToken().token;
    const pkce = PROVIDERS[p].pkce ? pkcePair() : undefined;
    db.run('DELETE FROM oauth_states WHERE expires_at < ?', nowIso());
    db.insert('oauth_states', {
      state_hash: state.hash,
      provider: p,
      nonce,
      code_verifier: pkce?.verifier ?? null,
      next: safeNext(req.query.next),
      invite_hash: req.query.invite ? tokenHash(req.query.invite) : null,
      link_user_id: linkUser,
      expires_at: new Date(Date.now() + STATE_MINUTES * 60_000).toISOString(),
    });
    return reply.redirect(authorizeUrl(cfg, p, state.token, nonce, pkce?.challenge), 302);
  });

  // -------------------------------------------------------------- callback
  const callback = async (req: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    const params = { ...(req.query as Record<string, string>), ...((req.body as Record<string, string>) ?? {}) };
    let p: ProviderId;
    try {
      p = provider(req.params.provider);
    } catch (err) {
      return fail(reply, (err as Error).message);
    }
    if (params.error) return fail(reply, params.error === 'access_denied' || params.error === 'user_cancelled_authorize' ? 'Sign-in was cancelled.' : `Sign-in failed (${params.error}).`);
    if (!params.state || !params.code) return fail(reply, 'Sign-in response was incomplete. Please try again.');

    // Single-use state.
    const stateHash = tokenHash(params.state);
    const st = db.get<{ provider: string; nonce: string; code_verifier: string | null; next: string; invite_hash: string | null; link_user_id: string | null; expires_at: string }>('SELECT * FROM oauth_states WHERE state_hash = ?', stateHash);
    db.run('DELETE FROM oauth_states WHERE state_hash = ?', stateHash);
    if (!st || st.provider !== p || st.expires_at < nowIso()) return fail(reply, 'Your sign-in session expired. Please try again.');

    let claims;
    try {
      const idToken = await exchangeCode(cfg, p, params.code, st.code_verifier);
      claims = await verifyIdToken(cfg, p, idToken, st.nonce);
    } catch (err) {
      req.log.warn({ err, provider: p }, 'oauth verification failed');
      return fail(reply, `We could not verify your ${PROVIDERS[p].name} sign-in. Please try again.`);
    }

    const email = claims.email?.toLowerCase();
    const verified = !!email && emailVerified(claims);
    // Apple sends the name only on the very first authorization, as a form field.
    let name = claims.name ?? [claims.given_name, claims.family_name].filter(Boolean).join(' ');
    if (!name && params.user) {
      try {
        const u = JSON.parse(params.user) as { name?: { firstName?: string; lastName?: string } };
        name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ');
      } catch {
        /* ignore */
      }
    }
    if (!name) name = email ? email.split('@')[0]! : `${PROVIDERS[p].name} user`;

    const link = (userId: string) =>
      db.run(
        `INSERT INTO user_identities (provider, subject, user_id, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, subject) DO UPDATE SET last_login_at = excluded.last_login_at, email = excluded.email`,
        p, claims.sub, userId, email ?? null, nowIso(), nowIso(),
      );

    // 0. Explicit linking from settings.
    if (st.link_user_id) {
      const owner = db.get<{ user_id: string }>('SELECT user_id FROM user_identities WHERE provider = ? AND subject = ?', p, claims.sub);
      if (owner && owner.user_id !== st.link_user_id) {
        return reply.redirect(`${web}/app/team?oauth_error=${encodeURIComponent(`That ${PROVIDERS[p].name} account is already connected to another SealChain user.`)}`, 302);
      }
      link(st.link_user_id);
      audit(db, null, 'auth.oauth.link', 'user', st.link_user_id, { provider: p });
      return reply.redirect(`${web}/app/team?linked=${p}`, 302);
    }

    // 1. Known identity.
    const known = db.get<{ user_id: string; password_hash: string }>(
      'SELECT i.user_id, u.password_hash FROM user_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.subject = ?', p, claims.sub,
    );
    if (known) {
      if (known.password_hash === 'disabled') return fail(reply, 'This account has been removed from its organisation.');
      link(known.user_id);
      if (hasTwoFactor(db, known.user_id)) return reply.redirect(`${web}/login?challenge=${createChallenge(db, known.user_id, st.next)}`, 302);
      signIn(reply, known.user_id, req.headers['user-agent']);
      audit(db, null, 'auth.oauth.login', 'user', known.user_id, { provider: p });
      return reply.redirect(`${web}${st.next}`, 302);
    }

    // 2. Accepting an invitation.
    if (st.invite_hash) {
      const inv = db.get<{ org_id: string; email: string; role: string; expires_at: string; accepted_at: string | null }>('SELECT * FROM invites WHERE token_hash = ?', st.invite_hash);
      if (!inv || inv.accepted_at || inv.expires_at < nowIso()) return fail(reply, 'This invitation is invalid or has expired. Ask for a new one.');
      if (!verified || email !== inv.email.toLowerCase()) {
        return fail(reply, `This invitation is for ${inv.email}. Sign in with the ${PROVIDERS[p].name} account that uses that email.`);
      }
      if (db.get('SELECT 1 FROM users WHERE email = ?', email)) return fail(reply, 'That email already has a SealChain account. Sign in instead.');
      const userId = newId('usr', 16);
      db.tx(() => {
        db.insert('users', { id: userId, org_id: inv.org_id, email, name, password_hash: 'oauth', role: inv.role, created_at: nowIso() });
        db.run('UPDATE invites SET accepted_at = ? WHERE token_hash = ?', nowIso(), st.invite_hash);
        link(userId);
      });
      signIn(reply, userId, req.headers['user-agent']);
      audit(db, null, 'team.join', 'user', userId, { provider: p });
      return reply.redirect(`${web}/app`, 302);
    }

    // 3. Existing account with the same, provider-verified email → link.
    if (verified) {
      const existing = db.get<{ id: string; password_hash: string }>('SELECT id, password_hash FROM users WHERE email = ?', email);
      if (existing) {
        if (existing.password_hash === 'disabled') return fail(reply, 'This account has been removed from its organisation.');
        link(existing.id);
        if (hasTwoFactor(db, existing.id)) return reply.redirect(`${web}/login?challenge=${createChallenge(db, existing.id, st.next)}`, 302);
        signIn(reply, existing.id, req.headers['user-agent']);
        audit(db, null, 'auth.oauth.link', 'user', existing.id, { provider: p });
        return reply.redirect(`${web}${st.next}`, 302);
      }
    }

    // 4. Newcomer → name the business first.
    if (!verified) return fail(reply, `Your ${PROVIDERS[p].name} account has no verified email address, which SealChain needs.`);
    const pending = newToken();
    db.run('DELETE FROM oauth_pending WHERE expires_at < ?', nowIso());
    db.insert('oauth_pending', { token_hash: pending.hash, provider: p, subject: claims.sub, email: email!, name, next: st.next, expires_at: new Date(Date.now() + 30 * 60_000).toISOString() });
    return reply.redirect(`${web}/signup/complete?token=${pending.token}`, 302);
  };

  api.get('/auth/oauth/:provider/callback', RATE, callback);
  api.post('/auth/oauth/:provider/callback', RATE, callback); // Apple form_post

  // --------------------------------------------------- newcomer completion
  const loadPending = (token: string) => {
    const row = db.get<{ provider: ProviderId; subject: string; email: string; name: string; next: string; expires_at: string }>('SELECT * FROM oauth_pending WHERE token_hash = ?', tokenHash(token));
    if (!row || row.expires_at < nowIso()) throw new HttpError(404, 'expired', 'This sign-up link has expired. Please start again.');
    return row;
  };

  api.get<{ Params: { token: string } }>('/auth/oauth/pending/:token', RATE, async (req) => {
    const row = loadPending(req.params.token);
    return { email: row.email, name: row.name, provider: row.provider, providerName: PROVIDERS[row.provider].name };
  });

  api.post('/auth/oauth/complete', RATE, async (req, reply) => {
    const body = z.object({ token: z.string().min(20).max(100), orgName: z.string().trim().min(2).max(120), name: z.string().trim().min(2).max(120).optional() }).parse(req.body);
    const row = loadPending(body.token);
    if (db.get('SELECT 1 FROM users WHERE email = ?', row.email)) throw new HttpError(409, 'email_taken', 'An account with this email already exists — sign in instead.');
    const orgId = newId('org', 16);
    const userId = newId('usr', 16);
    const role = cfg.adminEmails.includes(row.email) ? 'compliance' : 'owner';
    db.tx(() => {
      db.insert('orgs', { id: orgId, name: body.orgName, country: 'RW', plan: 'pilot', created_at: nowIso() });
      db.insert('users', { id: userId, org_id: orgId, email: row.email, name: body.name ?? row.name, password_hash: 'oauth', role, created_at: nowIso() });
      db.insert('user_identities', { provider: row.provider, subject: row.subject, user_id: userId, email: row.email, created_at: nowIso(), last_login_at: nowIso() });
      db.run('DELETE FROM oauth_pending WHERE token_hash = ?', tokenHash(body.token));
    });
    const token = signIn(reply, userId, req.headers['user-agent']);
    const ctx = resolveSession(db, token)!;
    audit(db, ctx, 'auth.register', 'user', userId, { provider: row.provider });
    return reply.code(201).send({ ...ctx, next: row.next });
  });

  // ------------------------------------------------------ linked accounts
  api.get('/auth/identities', { preHandler: requireSession }, async (req) => {
    const user = db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.auth!.user.id)!;
    return {
      hasPassword: user.password_hash.startsWith('scrypt$'),
      available: enabledProviders(cfg),
      identities: db.all('SELECT provider, email, created_at AS createdAt, last_login_at AS lastLoginAt FROM user_identities WHERE user_id = ?', req.auth!.user.id),
    };
  });

  api.delete<{ Params: { provider: string } }>('/auth/identities/:provider', { preHandler: requireSession }, async (req) => {
    const user = db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.auth!.user.id)!;
    const others = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM user_identities WHERE user_id = ? AND provider != ?', req.auth!.user.id, req.params.provider)!.n;
    if (!user.password_hash.startsWith('scrypt$') && others === 0) {
      throw new HttpError(409, 'last_login_method', 'Set a password first (Forgot password on the sign-in page), otherwise you could not sign in any more.');
    }
    db.run('DELETE FROM user_identities WHERE user_id = ? AND provider = ?', req.auth!.user.id, req.params.provider);
    audit(db, req.auth, 'auth.oauth.unlink', 'user', req.auth!.user.id, { provider: req.params.provider });
    return { ok: true };
  });
}
