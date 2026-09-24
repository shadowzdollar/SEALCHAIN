/**
 * Sign in with Google / Apple (OpenID Connect, authorization-code flow).
 *
 * Security properties:
 *  - `state` (CSRF) and `nonce` (replay) are random, single-use, stored hashed
 *    server-side with a 10-minute expiry — no reliance on cross-site cookies,
 *    which matters for Apple's form_post callback.
 *  - PKCE (S256) where the provider supports it (Google).
 *  - ID tokens are verified with node:crypto against the provider's published
 *    JWKS: signature (RS256/ES256), issuer, audience, expiry, nonce.
 *  - Only provider-verified emails are trusted for linking to an existing
 *    account.
 */
import crypto from 'node:crypto';
import type { Config } from '../config';

export type ProviderId = 'google' | 'apple';

export interface ProviderDef {
  id: ProviderId;
  name: string;
  issuers: string[];
  authorizeUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  scope: string;
  pkce: boolean;
  formPost: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  google: {
    id: 'google',
    name: 'Google',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    scope: 'openid email profile',
    pkce: true,
    formPost: false,
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    issuers: ['https://appleid.apple.com'],
    authorizeUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    scope: 'name email',
    pkce: false,
    formPost: true, // required by Apple when requesting name/email
  },
};

export interface IdClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

export function enabledProviders(cfg: Config): ProviderId[] {
  return (['google', 'apple'] as const).filter((p) => !!cfg.oauth[p]);
}

export function clientId(cfg: Config, p: ProviderId): string {
  const c = cfg.oauth[p];
  if (!c) throw new Error(`${p} sign-in is not configured`);
  return c.clientId;
}

export function redirectUri(cfg: Config, p: ProviderId): string {
  return `${cfg.oauth.redirectBase}/api/auth/oauth/${p}/callback`;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) };
}

export function authorizeUrl(cfg: Config, p: ProviderId, state: string, nonce: string, challenge?: string): string {
  const def = PROVIDERS[p];
  const u = new URL(def.authorizeUrl);
  u.searchParams.set('client_id', clientId(cfg, p));
  u.searchParams.set('redirect_uri', redirectUri(cfg, p));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', def.scope);
  u.searchParams.set('state', state);
  u.searchParams.set('nonce', nonce);
  if (def.formPost) u.searchParams.set('response_mode', 'form_post');
  if (def.pkce && challenge) {
    u.searchParams.set('code_challenge', challenge);
    u.searchParams.set('code_challenge_method', 'S256');
  }
  if (p === 'google') u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

/** Apple's client secret is an ES256 JWT signed with the team's key. */
let appleSecret: { value: string; exp: number } | undefined;
function appleClientSecret(cfg: Config): string {
  const a = cfg.oauth.apple!;
  const now = Math.floor(Date.now() / 1000);
  if (appleSecret && appleSecret.exp - now > 3600) return appleSecret.value;
  const exp = now + 86_400 * 30;
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: a.keyId }));
  const payload = b64url(JSON.stringify({ iss: a.teamId, iat: now, exp, aud: 'https://appleid.apple.com', sub: a.clientId }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key: a.privateKey, dsaEncoding: 'ieee-p1363' });
  appleSecret = { value: `${header}.${payload}.${b64url(sig)}`, exp };
  return appleSecret.value;
}

export async function exchangeCode(cfg: Config, p: ProviderId, code: string, verifier?: string | null): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(cfg, p),
    client_id: clientId(cfg, p),
    client_secret: p === 'google' ? cfg.oauth.google!.clientSecret : appleClientSecret(cfg),
  });
  if (verifier) body.set('code_verifier', verifier);
  const res = await fetch(PROVIDERS[p].tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body });
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.id_token) throw new Error(`Token exchange failed: ${json.error ?? res.status}${json.error_description ? ` (${json.error_description})` : ''}`);
  return json.id_token;
}

// ------------------------------------------------------------------- JWKS
const jwksCache = new Map<string, { keys: Array<JsonWebKey & { kid?: string }>; at: number }>();

async function jwks(url: string, refresh = false) {
  const hit = jwksCache.get(url);
  if (hit && !refresh && Date.now() - hit.at < 3_600_000) return hit.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch signing keys (${res.status})`);
  const keys = ((await res.json()) as { keys: Array<JsonWebKey & { kid?: string }> }).keys;
  jwksCache.set(url, { keys, at: Date.now() });
  return keys;
}

export function clearJwksCache() {
  jwksCache.clear();
  appleSecret = undefined;
}

export async function verifyIdToken(cfg: Config, p: ProviderId, token: string, expectedNonce: string): Promise<IdClaims> {
  const def = PROVIDERS[p];
  const [h, pl, s] = token.split('.');
  if (!h || !pl || !s) throw new Error('Malformed ID token');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as { alg: string; kid?: string };
  if (header.alg !== 'RS256' && header.alg !== 'ES256') throw new Error(`Unsupported token algorithm ${header.alg}`);

  let keys = await jwks(def.jwksUrl);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await jwks(def.jwksUrl, true); // key rotation
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('Unknown token signing key');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const data = Buffer.from(`${h}.${pl}`);
  const sig = Buffer.from(s, 'base64url');
  const ok = header.alg === 'RS256'
    ? crypto.verify('RSA-SHA256', data, key, sig)
    : crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig);
  if (!ok) throw new Error('Invalid token signature');

  const claims = JSON.parse(Buffer.from(pl, 'base64url').toString()) as IdClaims;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!def.issuers.includes(claims.iss)) throw new Error('Token issuer mismatch');
  if (!aud.includes(clientId(cfg, p))) throw new Error('Token audience mismatch');
  if (claims.exp + 60 < now) throw new Error('Token expired');
  if (claims.iat - 300 > now) throw new Error('Token issued in the future');
  if (!claims.nonce || claims.nonce !== expectedNonce) throw new Error('Token nonce mismatch');
  if (!claims.sub) throw new Error('Token has no subject');
  return claims;
}

export function emailVerified(c: IdClaims): boolean {
  return c.email_verified === true || c.email_verified === 'true';
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(next) && !next.includes('\\') ? next : '/app';
}
