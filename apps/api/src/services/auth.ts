import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { newId, nowIso, type Db } from '../db';

export type Role = 'owner' | 'member' | 'compliance';

export interface AuthContext {
  user: { id: string; email: string; name: string; role: Role };
  org: { id: string; name: string; country: string; plan: string; kind: 'business' | 'authority' };
  /** How the request authenticated; API keys cannot manage keys or passwords. */
  via?: 'session' | 'api_key';
}

export const API_KEY_PREFIX = 'sc_live_';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export const SESSION_COOKIE = 'sc_session';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(expected, actual);
}

export const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Random URL-safe token and the hash we store for it. */
export function newToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: tokenHash(token) };
}

export function createSession(db: Db, userId: string, days: number): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  db.insert('sessions', { token_hash: tokenHash(token), user_id: userId, expires_at: expiresAt.toISOString(), created_at: nowIso() });
  return { token, expiresAt };
}

export function destroySession(db: Db, token: string) {
  db.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash(token));
}

export function resolveSession(db: Db, token: string | undefined): AuthContext | null {
  if (!token) return null;
  if (token.startsWith(API_KEY_PREFIX)) return resolveApiKey(db, token);
  const row = db.get<Record<string, string>>(
    `SELECT u.id, u.email, u.name, u.role, o.id AS org_id, o.name AS org_name, o.country, o.plan, o.kind, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id JOIN orgs o ON o.id = u.org_id
      WHERE s.token_hash = ?`,
    tokenHash(token),
  );
  if (!row) return null;
  if (new Date(row.expires_at!).getTime() < Date.now()) {
    destroySession(db, token);
    return null;
  }
  return {
    user: { id: row.id!, email: row.email!, name: row.name!, role: row.role as Role },
    org: { id: row.org_id!, name: row.org_name!, country: row.country!, plan: row.plan!, kind: row.kind as 'business' | 'authority' },
    via: 'session',
  };
}

function resolveApiKey(db: Db, key: string): AuthContext | null {
  const row = db.get<Record<string, string>>(
    `SELECT k.id AS key_id, k.last_used_at, u.id, u.email, u.name, u.role, o.id AS org_id, o.name AS org_name, o.country, o.plan, o.kind
       FROM api_keys k JOIN users u ON u.id = k.user_id JOIN orgs o ON o.id = k.org_id
      WHERE k.key_hash = ? AND k.revoked_at IS NULL AND u.password_hash != 'disabled'`,
    tokenHash(key),
  );
  if (!row) return null;
  // Throttle last-used writes to once a minute.
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', nowIso(), row.key_id!);
  }
  return {
    user: { id: row.id!, email: row.email!, name: row.name!, role: row.role as Role },
    org: { id: row.org_id!, name: row.org_name!, country: row.country!, plan: row.plan!, kind: row.kind as 'business' | 'authority' },
    via: 'api_key',
  };
}

export async function requireSession(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to continue.' });
  if (req.auth.via === 'api_key') return reply.code(403).send({ error: 'forbidden', message: 'Not available with an API key — sign in to the web app.' });
}

export function tokenFrom(req: FastifyRequest): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[SESSION_COOKIE];
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to continue.' });
}

/** Organisation owners (and the platform's own compliance org admins). */
export async function requireOwner(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to continue.' });
  if (req.auth.user.role === 'member') return reply.code(403).send({ error: 'forbidden', message: 'Only organisation owners can do this.' });
}

export async function requireAuthority(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to continue.' });
  if (req.auth.org.kind !== 'authority') return reply.code(403).send({ error: 'forbidden', message: 'Issuing-authority accounts only.' });
}

export async function requireCompliance(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to continue.' });
  if (req.auth.user.role !== 'compliance') return reply.code(403).send({ error: 'forbidden', message: 'Compliance team access only.' });
}

export function audit(db: Db, ctx: AuthContext | null, action: string, entity?: string, entityId?: string, detail?: unknown) {
  db.insert('audit_log', {
    id: newId('aud', 16),
    org_id: ctx?.org.id ?? null,
    user_id: ctx?.user.id ?? null,
    action,
    entity: entity ?? null,
    entity_id: entityId ?? null,
    detail: detail === undefined ? null : JSON.stringify(detail),
    created_at: nowIso(),
  });
}
