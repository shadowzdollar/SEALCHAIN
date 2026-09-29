/** Account security: two-step sign-in (authenticator app) and active sessions. */
import type { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { z } from 'zod';
import { nowIso } from '../db';
import { audit, requireSession, sessionId, tokenFrom, tokenHash, verifyPassword } from '../services/auth';
import { HttpError, type Deps } from '../services/documents';
import { matchTotp, newRecoveryCodes, newTotpSecret, otpauthUri, recoveryCodesLeft, verifySecondFactor } from '../services/twofactor';

const RATE = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

/** "Chrome on Windows" from a user-agent string — enough to recognise a device. */
export function describeAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/SealChain|curl|node|python|axios|okhttp/i.test(ua)) return 'API client';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown system';
  return `${browser} on ${os}`;
}

export async function securityRoutes(api: FastifyInstance, { db }: Deps) {
  const guard = { preHandler: requireSession };
  const user = (id: string) => db.get<{ email: string; password_hash: string; totp_secret: string | null; totp_pending_secret: string | null; totp_enabled_at: string | null }>(
    'SELECT email, password_hash, totp_secret, totp_pending_secret, totp_enabled_at FROM users WHERE id = ?', id,
  )!;

  // --------------------------------------------------------------- 2FA
  api.get('/auth/2fa', guard, async (req) => {
    const u = user(req.auth!.user.id);
    return { enabled: !!u.totp_secret, enabledAt: u.totp_enabled_at, recoveryCodesLeft: recoveryCodesLeft(db, req.auth!.user.id) };
  });

  /** Starts enrolment: a new secret to scan; not active until confirmed with a code. */
  api.post('/auth/2fa/setup', { ...guard, ...RATE }, async (req) => {
    const u = user(req.auth!.user.id);
    if (u.totp_secret) throw new HttpError(409, 'already_enabled', 'Two-step sign-in is already on.');
    const secret = newTotpSecret();
    db.run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', secret, req.auth!.user.id);
    const uri = otpauthUri(secret, u.email);
    return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }) };
  });

  api.post('/auth/2fa/enable', { ...guard, ...RATE }, async (req) => {
    const { code } = z.object({ code: z.string().trim().min(6).max(10) }).parse(req.body);
    const u = user(req.auth!.user.id);
    if (u.totp_secret) throw new HttpError(409, 'already_enabled', 'Two-step sign-in is already on.');
    if (!u.totp_pending_secret) throw new HttpError(400, 'no_setup', 'Start the setup first.');
    const step = matchTotp(u.totp_pending_secret, code);
    if (step === null) throw new HttpError(400, 'invalid_code', 'That code does not match. Check the time on your phone and try the newest code.');
    const { codes, hashes } = newRecoveryCodes();
    db.run(
      'UPDATE users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled_at = ?, totp_last_step = ?, recovery_codes = ? WHERE id = ?',
      nowIso(), step, JSON.stringify(hashes), req.auth!.user.id,
    );
    // Other devices must prove the second factor too: sign them out.
    const current = tokenFrom(req);
    db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', req.auth!.user.id, current ? tokenHash(current) : '');
    audit(db, req.auth, 'auth.2fa.enable', 'user', req.auth!.user.id);
    return { enabled: true, recoveryCodes: codes };
  });

  /** Turning it off needs the password (if the account has one) and a current code. */
  api.post('/auth/2fa/disable', { ...guard, ...RATE }, async (req) => {
    const body = z.object({ code: z.string().trim().min(6).max(20), password: z.string().max(200).optional() }).parse(req.body);
    const u = user(req.auth!.user.id);
    if (!u.totp_secret) return { enabled: false };
    const hasPassword = !['oauth', 'disabled'].includes(u.password_hash);
    if (hasPassword && (!body.password || !verifyPassword(body.password, u.password_hash))) throw new HttpError(400, 'invalid_password', 'Your password is incorrect.');
    if (!verifySecondFactor(db, req.auth!.user.id, body.code)) throw new HttpError(400, 'invalid_code', 'That code is not valid.');
    db.run('UPDATE users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL, recovery_codes = NULL WHERE id = ?', req.auth!.user.id);
    audit(db, req.auth, 'auth.2fa.disable', 'user', req.auth!.user.id);
    return { enabled: false };
  });

  api.post('/auth/2fa/recovery-codes', { ...guard, ...RATE }, async (req) => {
    const { code } = z.object({ code: z.string().trim().min(6).max(20) }).parse(req.body);
    if (!user(req.auth!.user.id).totp_secret) throw new HttpError(400, 'not_enabled', 'Two-step sign-in is off.');
    if (!verifySecondFactor(db, req.auth!.user.id, code)) throw new HttpError(400, 'invalid_code', 'That code is not valid.');
    const { codes, hashes } = newRecoveryCodes();
    db.run('UPDATE users SET recovery_codes = ? WHERE id = ?', JSON.stringify(hashes), req.auth!.user.id);
    audit(db, req.auth, 'auth.2fa.recovery_codes', 'user', req.auth!.user.id);
    return { recoveryCodes: codes };
  });

  // ------------------------------------------------------------ sessions
  api.get('/auth/sessions', guard, async (req) => {
    const current = sessionId(tokenFrom(req)!);
    const rows = db.all<{ token_hash: string; created_at: string; last_seen_at: string | null; user_agent: string | null; expires_at: string }>(
      'SELECT token_hash, created_at, last_seen_at, user_agent, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY COALESCE(last_seen_at, created_at) DESC',
      req.auth!.user.id, nowIso(),
    );
    return rows.map((r) => ({
      id: r.token_hash.slice(0, 16), device: describeAgent(r.user_agent), createdAt: r.created_at, lastSeenAt: r.last_seen_at ?? r.created_at,
      expiresAt: r.expires_at, current: r.token_hash.startsWith(current),
    }));
  });

  api.delete<{ Params: { id: string } }>('/auth/sessions/:id', guard, async (req) => {
    if (!/^[a-f0-9]{16}$/.test(req.params.id)) throw new HttpError(400, 'invalid_request', 'Bad session id');
    if (sessionId(tokenFrom(req)!) === req.params.id) throw new HttpError(400, 'current_session', 'Use “Sign out” to end this session.');
    const res = db.run("DELETE FROM sessions WHERE user_id = ? AND substr(token_hash, 1, 16) = ?", req.auth!.user.id, req.params.id);
    if (!res.changes) throw new HttpError(404, 'not_found', 'Session not found');
    audit(db, req.auth, 'auth.session.revoke', 'user', req.auth!.user.id);
    return { ok: true };
  });

  api.post('/auth/sessions/revoke-others', guard, async (req) => {
    const res = db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', req.auth!.user.id, tokenHash(tokenFrom(req)!));
    audit(db, req.auth, 'auth.session.revoke_others', 'user', req.auth!.user.id, { count: res.changes });
    return { revoked: Number(res.changes) };
  });
}
