/**
 * Two-step sign-in with an authenticator app (RFC 6238 TOTP: HMAC-SHA1,
 * 30-second steps, 6 digits), plus single-use recovery codes.
 *
 * A code is accepted within ±1 step of the server clock and never twice: the
 * last accepted step is stored, so an intercepted code cannot be replayed.
 */
import crypto from 'node:crypto';
import { nowIso, type Db } from '../db';
import { newToken, tokenHash } from './auth';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const CHALLENGE_MINUTES = 5;
const MAX_ATTEMPTS = 5;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totp(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(bin).padStart(6, '0');
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/** Returns the matching step, or null. Constant-time comparison per candidate. */
export function matchTotp(secret: string, code: string, now = Date.now()): number | null {
  const digits = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const step = currentStep(now);
  for (const s of [step - 1, step, step + 1]) {
    if (crypto.timingSafeEqual(Buffer.from(totp(secret, s)), Buffer.from(digits))) return s;
  }
  return null;
}

export function otpauthUri(secret: string, account: string, issuer = 'SealChain'): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// ------------------------------------------------------------ recovery codes
const codeHash = (c: string) => crypto.createHash('sha256').update(`sealchain-recovery:${c.toUpperCase().replace(/[^A-Z0-9]/g, '')}`).digest('hex');

export function newRecoveryCodes(n = 10): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: n }, () => {
    const raw = base32Encode(crypto.randomBytes(5)).slice(0, 8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { codes, hashes: codes.map(codeHash) };
}

// ---------------------------------------------------------------- per user
interface UserTotp { totp_secret: string | null; totp_last_step: number | null; recovery_codes: string | null }

/** Verifies a TOTP or recovery code for a user with 2FA on, consuming it. */
export function verifySecondFactor(db: Db, userId: string, code: string): 'totp' | 'recovery' | null {
  const u = db.get<UserTotp>('SELECT totp_secret, totp_last_step, recovery_codes FROM users WHERE id = ?', userId);
  if (!u?.totp_secret) return null;
  const step = matchTotp(u.totp_secret, code);
  if (step !== null) {
    if (u.totp_last_step !== null && step <= u.totp_last_step) return null; // replayed
    db.run('UPDATE users SET totp_last_step = ? WHERE id = ?', step, userId);
    return 'totp';
  }
  const hashes: string[] = u.recovery_codes ? JSON.parse(u.recovery_codes) : [];
  const h = codeHash(code);
  if (hashes.includes(h)) {
    db.run('UPDATE users SET recovery_codes = ? WHERE id = ?', JSON.stringify(hashes.filter((x) => x !== h)), userId);
    return 'recovery';
  }
  return null;
}

export function hasTwoFactor(db: Db, userId: string): boolean {
  return !!db.get('SELECT 1 FROM users WHERE id = ? AND totp_secret IS NOT NULL', userId);
}

// ------------------------------------------------------------ challenges
export function createChallenge(db: Db, userId: string, next?: string | null): string {
  const { token, hash } = newToken();
  db.run('DELETE FROM login_challenges WHERE expires_at < ?', nowIso());
  db.insert('login_challenges', { token_hash: hash, user_id: userId, next: next ?? null, attempts: 0, expires_at: new Date(Date.now() + CHALLENGE_MINUTES * 60_000).toISOString() });
  return token;
}

/** Counts an attempt; returns the pending challenge if still usable. */
export function useChallenge(db: Db, token: string): { userId: string; next: string | null } | 'expired' | 'locked' {
  const h = tokenHash(token);
  const row = db.get<{ user_id: string; next: string | null; attempts: number; expires_at: string }>('SELECT * FROM login_challenges WHERE token_hash = ?', h);
  if (!row || row.expires_at < nowIso()) return 'expired';
  if (row.attempts >= MAX_ATTEMPTS) return 'locked';
  db.run('UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = ?', h);
  return { userId: row.user_id, next: row.next };
}

export function finishChallenge(db: Db, token: string) {
  db.run('DELETE FROM login_challenges WHERE token_hash = ?', tokenHash(token));
}

export function recoveryCodesLeft(db: Db, userId: string): number {
  const row = db.get<{ recovery_codes: string | null }>('SELECT recovery_codes FROM users WHERE id = ?', userId);
  return row?.recovery_codes ? (JSON.parse(row.recovery_codes) as string[]).length : 0;
}
