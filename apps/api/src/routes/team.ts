/**
 * Team management (invites, roles) and password recovery.
 *
 * Roles inside an organisation:
 *   owner   everything, incl. team, revocation
 *   member  create/edit/issue shipments, check documents
 * (`compliance` is the platform's own staff role and acts as owner of its org.)
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { newId, nowIso } from '../db';
import {
  SESSION_COOKIE,
  audit,
  createSession,
  hashPassword,
  newToken,
  requireAuth,
  requireOwner,
  requireSession,
  resolveSession,
  tokenFrom,
  tokenHash,
  verifyPassword,
} from '../services/auth';
import { HttpError, type Deps } from '../services/documents';

import { createChallenge, hasTwoFactor } from '../services/twofactor';
const RATE = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
const INVITE_DAYS = 7;
const RESET_MINUTES = 60;
const password = z.string().min(10, 'Use at least 10 characters').max(200);

export async function teamRoutes(api: FastifyInstance, deps: Deps) {
  const { db, cfg, mailer } = deps;
  const setCookie = (reply: FastifyReply, token: string, expires: Date) =>
    reply.setCookie(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: cfg.isProd, expires });

  const ownerCount = (orgId: string) =>
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE org_id = ? AND role IN ('owner','compliance')", orgId)!.n;

  // ---------------------------------------------------------------- team
  api.get('/team', { preHandler: requireAuth }, async (req) => ({
    members: db.all("SELECT id, name, email, role, created_at AS createdAt FROM users WHERE org_id = ? AND password_hash != 'disabled' ORDER BY created_at", req.auth!.org.id),
    invites: db.all(
      'SELECT substr(token_hash, 1, 16) AS id, email, role, expires_at AS expiresAt, created_at AS createdAt FROM invites WHERE org_id = ? AND accepted_at IS NULL AND expires_at > ? ORDER BY created_at DESC',
      req.auth!.org.id, nowIso(),
    ),
  }));

  api.post('/team/invites', { preHandler: [requireSession, requireOwner], ...RATE }, async (req, reply) => {
    const body = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(['owner', 'member']).default('member') }).parse(req.body);
    if (db.get('SELECT 1 FROM users WHERE email = ?', body.email)) {
      throw new HttpError(409, 'email_taken', 'That email already has a SealChain account.');
    }
    // Replace any earlier pending invite for the same email.
    db.run('DELETE FROM invites WHERE org_id = ? AND email = ? AND accepted_at IS NULL', req.auth!.org.id, body.email);
    const { token, hash } = newToken();
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
    db.insert('invites', { token_hash: hash, org_id: req.auth!.org.id, email: body.email, role: body.role, invited_by: req.auth!.user.id, expires_at: expiresAt, created_at: nowIso() });
    const inviteUrl = `${cfg.publicWebUrl}/invite/${token}`;
    await mailer.send({
      to: body.email,
      subject: `${req.auth!.user.name} invited you to ${req.auth!.org.name} on SealChain`,
      body: `${req.auth!.user.name} has invited you to join ${req.auth!.org.name} on SealChain.\n\nAccept the invitation (valid ${INVITE_DAYS} days):\n${inviteUrl}\n`,
    });
    audit(db, req.auth, 'team.invite', 'user', body.email, { role: body.role });
    return reply.code(201).send({ email: body.email, role: body.role, expiresAt, inviteUrl });
  });

  api.delete<{ Params: { id: string } }>('/team/invites/:id', { preHandler: requireOwner }, async (req) => {
    db.run('DELETE FROM invites WHERE org_id = ? AND substr(token_hash, 1, 16) = ? AND accepted_at IS NULL', req.auth!.org.id, req.params.id);
    return { ok: true };
  });

  api.put<{ Params: { id: string } }>('/team/members/:id', { preHandler: requireOwner }, async (req) => {
    const { role } = z.object({ role: z.enum(['owner', 'member']) }).parse(req.body);
    const target = db.get<{ role: string }>('SELECT role FROM users WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id);
    if (!target) throw new HttpError(404, 'not_found', 'Member not found');
    if (target.role === 'compliance') throw new HttpError(409, 'protected', 'Platform staff roles are managed separately.');
    if (target.role === 'owner' && role === 'member' && ownerCount(req.auth!.org.id) <= 1) {
      throw new HttpError(409, 'last_owner', 'An organisation needs at least one owner.');
    }
    db.run('UPDATE users SET role = ? WHERE id = ?', role, req.params.id);
    audit(db, req.auth, 'team.role', 'user', req.params.id, { role });
    return { ok: true };
  });

  api.delete<{ Params: { id: string } }>('/team/members/:id', { preHandler: requireOwner }, async (req) => {
    if (req.params.id === req.auth!.user.id) throw new HttpError(409, 'self', 'You cannot remove yourself.');
    const target = db.get<{ role: string }>('SELECT role FROM users WHERE id = ? AND org_id = ?', req.params.id, req.auth!.org.id);
    if (!target) throw new HttpError(404, 'not_found', 'Member not found');
    if (target.role !== 'member' && ownerCount(req.auth!.org.id) <= 1) throw new HttpError(409, 'last_owner', 'An organisation needs at least one owner.');
    db.tx(() => {
      db.run('DELETE FROM sessions WHERE user_id = ?', req.params.id);
      // Keep the row for the audit trail (issued_by references); disable login.
      db.run("UPDATE users SET role = 'member', password_hash = 'disabled', email = email || '#removed-' || ? WHERE id = ?", Date.now(), req.params.id);
    });
    audit(db, req.auth, 'team.remove', 'user', req.params.id);
    return { ok: true };
  });

  // -------------------------------------------------------------- invites
  api.get<{ Params: { token: string } }>('/invites/:token', RATE, async (req) => {
    const inv = db.get<{ email: string; role: string; expires_at: string; accepted_at: string | null; org: string; inviter: string }>(
      `SELECT i.email, i.role, i.expires_at, i.accepted_at, o.name AS org, u.name AS inviter
         FROM invites i JOIN orgs o ON o.id = i.org_id JOIN users u ON u.id = i.invited_by WHERE i.token_hash = ?`,
      tokenHash(req.params.token),
    );
    if (!inv || inv.accepted_at || inv.expires_at < nowIso()) throw new HttpError(404, 'invalid_invite', 'This invitation is invalid or has expired. Ask for a new one.');
    return { email: inv.email, role: inv.role, org: inv.org, inviter: inv.inviter, expiresAt: inv.expires_at };
  });

  api.post<{ Params: { token: string } }>('/invites/:token/accept', RATE, async (req, reply) => {
    const body = z.object({ name: z.string().trim().min(2).max(120), password }).parse(req.body);
    const hash = tokenHash(req.params.token);
    const inv = db.get<{ org_id: string; email: string; role: string; expires_at: string; accepted_at: string | null }>('SELECT * FROM invites WHERE token_hash = ?', hash);
    if (!inv || inv.accepted_at || inv.expires_at < nowIso()) throw new HttpError(404, 'invalid_invite', 'This invitation is invalid or has expired. Ask for a new one.');
    if (db.get('SELECT 1 FROM users WHERE email = ?', inv.email)) throw new HttpError(409, 'email_taken', 'That email already has a SealChain account.');
    const userId = newId('usr', 16);
    db.tx(() => {
      db.insert('users', { id: userId, org_id: inv.org_id, email: inv.email, name: body.name, password_hash: hashPassword(body.password), role: inv.role, created_at: nowIso() });
      db.run('UPDATE invites SET accepted_at = ? WHERE token_hash = ?', nowIso(), hash);
    });
    const { token, expiresAt } = createSession(db, userId, cfg.sessionDays, { userAgent: req.headers['user-agent'] });
    setCookie(reply, token, expiresAt);
    const ctx = resolveSession(db, token)!;
    audit(db, ctx, 'team.join', 'user', userId);
    deps.notifications.notify(inv.org_id, 'team.joined', { title: `${body.name} joined your team`, body: `${body.name} (${inv.email}) accepted the invitation as ${inv.role}.`, link: '/app/team', actorUserId: userId });
    return reply.code(201).send({ ...ctx, token });
  });

  // ------------------------------------------------------------ passwords
  api.post('/auth/password/forgot', RATE, async (req) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = db.get<{ id: string; name: string }>("SELECT id, name FROM users WHERE email = ? AND password_hash != 'disabled'", email);
    if (user) {
      db.run('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL', user.id);
      const { token, hash } = newToken();
      db.insert('password_resets', { token_hash: hash, user_id: user.id, expires_at: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString(), created_at: nowIso() });
      await mailer.send({
        to: email,
        subject: 'Reset your SealChain password',
        body: `Hello ${user.name},\n\nUse this link within ${RESET_MINUTES} minutes to choose a new password:\n${cfg.publicWebUrl}/reset-password/${token}\n\nIf you did not ask for this, ignore this email — your password is unchanged.\n`,
      });
      audit(db, null, 'auth.password.forgot', 'user', user.id);
    }
    // Same answer whether or not the account exists.
    return { ok: true, message: 'If that email has an account, a reset link is on its way.' };
  });

  api.post('/auth/password/reset', RATE, async (req, reply) => {
    const body = z.object({ token: z.string().min(20).max(100), password }).parse(req.body);
    const hash = tokenHash(body.token);
    const row = db.get<{ user_id: string; expires_at: string; used_at: string | null }>('SELECT * FROM password_resets WHERE token_hash = ?', hash);
    if (!row || row.used_at || row.expires_at < nowIso()) throw new HttpError(400, 'invalid_token', 'This reset link is invalid or has expired. Request a new one.');
    db.tx(() => {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(body.password), row.user_id);
      db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', nowIso(), hash);
      db.run('DELETE FROM sessions WHERE user_id = ?', row.user_id); // sign out everywhere
    });
    // A reset proves control of the mailbox, not of the authenticator.
    if (hasTwoFactor(db, row.user_id)) {
      audit(db, null, 'auth.password.reset', 'user', row.user_id);
      return { twoFactorRequired: true, challenge: createChallenge(db, row.user_id, '/app') };
    }
    const { token, expiresAt } = createSession(db, row.user_id, cfg.sessionDays, { userAgent: req.headers['user-agent'] });
    setCookie(reply, token, expiresAt);
    const ctx = resolveSession(db, token)!;
    audit(db, ctx, 'auth.password.reset', 'user', row.user_id);
    return { ...ctx, token };
  });

  api.post('/auth/password/change', { preHandler: requireSession, ...RATE }, async (req) => {
    const body = z.object({ current: z.string().min(1).max(200), next: password }).parse(req.body);
    const user = db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.auth!.user.id)!;
    if (!verifyPassword(body.current, user.password_hash)) throw new HttpError(400, 'wrong_password', 'Your current password is incorrect.');
    const current = tokenFrom(req)!;
    db.tx(() => {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(body.next), req.auth!.user.id);
      // Keep this session, revoke all others.
      db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', req.auth!.user.id, tokenHash(current));
    });
    audit(db, req.auth, 'auth.password.change', 'user', req.auth!.user.id);
    return { ok: true };
  });
}
