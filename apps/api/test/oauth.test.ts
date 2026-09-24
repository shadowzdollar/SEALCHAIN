/**
 * Sign in with Google / Apple against a simulated provider that signs real
 * RS256 (Google) and ES256 (Apple) ID tokens and serves a JWKS.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp, type App } from '../src/app';
import { clearJwksCache } from '../src/services/oidc';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-oauth-'));
const WEB = 'http://localhost:5174';
let ctx: App;
let app: FastifyInstance;

// ---------------------------------------------------------- fake providers
const googleKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const appleKey = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const appleTeamKey = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }); // our Apple client-secret key
const jwk = (k: crypto.KeyObject, kid: string) => ({ ...k.export({ format: 'jwk' }), kid });
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sign(provider: 'google' | 'apple', claims: object, opts: { kid?: string; tamper?: boolean } = {}) {
  const alg = provider === 'google' ? 'RS256' : 'ES256';
  const head = b64({ alg, kid: opts.kid ?? `${provider}-1`, typ: 'JWT' });
  const body = b64(claims);
  const data = Buffer.from(`${head}.${body}`);
  const sig = provider === 'google'
    ? crypto.sign('RSA-SHA256', data, googleKey.privateKey)
    : crypto.sign('sha256', data, { key: appleKey.privateKey, dsaEncoding: 'ieee-p1363' });
  if (opts.tamper) sig[5] = sig[5]! ^ 0xff;
  return `${head}.${body}.${sig.toString('base64url')}`;
}

let nextClaims: Record<string, unknown> = {};
let nextOpts: { kid?: string; tamper?: boolean } = {};
let lastTokenRequest: URLSearchParams | null = null;

beforeAll(async () => {
  process.env.DATA_DIR = dataDir;
  process.env.ANCHOR_MODE = 'local';
  process.env.PUBLIC_WEB_URL = WEB;
  process.env.GOOGLE_CLIENT_ID = 'google-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
  process.env.APPLE_CLIENT_ID = 'com.sealchain.web';
  process.env.APPLE_TEAM_ID = 'TEAM123456';
  process.env.APPLE_KEY_ID = 'KEY1234567';
  process.env.APPLE_PRIVATE_KEY = appleTeamKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  delete process.env.RPC_URL;
  clearJwksCache();
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('googleapis.com/oauth2/v3/certs')) return Response.json({ keys: [jwk(googleKey.publicKey, 'google-1')] });
    if (u.includes('appleid.apple.com/auth/keys')) return Response.json({ keys: [jwk(appleKey.publicKey, 'apple-1')] });
    if (u.includes('oauth2.googleapis.com/token') || u.includes('appleid.apple.com/auth/token')) {
      lastTokenRequest = new URLSearchParams(String(init?.body));
      if (lastTokenRequest.get('code') === 'bad-code') return Response.json({ error: 'invalid_grant' }, { status: 400 });
      const provider = u.includes('google') ? 'google' : 'apple';
      return Response.json({ id_token: sign(provider, nextClaims, nextOpts) });
    }
    throw new Error(`unexpected fetch ${u}`);
  });
  ctx = await buildApp(loadConfig(), { logger: false, startAnchoring: false });
  app = ctx.app;
  await app.ready();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'PUBLIC_WEB_URL']) delete process.env[k];
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const now = () => Math.floor(Date.now() / 1000);
const cookieOf = (res: { headers: Record<string, unknown> }) => String(res.headers['set-cookie'] ?? '').split(';')[0];

/** Runs start → provider → callback. Returns the final redirect and cookie. */
async function signInWith(provider: 'google' | 'apple', claims: Record<string, unknown>, opts: { next?: string; invite?: string; link?: boolean; cookie?: string; mutate?: (c: Record<string, unknown>) => void; code?: string; user?: object; tokenOpts?: { kid?: string; tamper?: boolean } } = {}) {
  const qs = new URLSearchParams();
  if (opts.next) qs.set('next', opts.next);
  if (opts.invite) qs.set('invite', opts.invite);
  if (opts.link) qs.set('link', '1');
  const start = await app.inject({ method: 'GET', url: `/api/auth/oauth/${provider}/start?${qs}`, headers: opts.cookie ? { cookie: opts.cookie } : {} });
  expect(start.statusCode).toBe(302);
  const auth = new URL(String(start.headers.location));
  const state = auth.searchParams.get('state')!;
  const nonce = auth.searchParams.get('nonce')!;
  nextClaims = {
    iss: provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com',
    aud: provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.APPLE_CLIENT_ID,
    iat: now(), exp: now() + 600, nonce, ...claims,
  };
  opts.mutate?.(nextClaims);
  nextOpts = opts.tokenOpts ?? {};
  const code = opts.code ?? 'good-code';
  const res = provider === 'google'
    ? await app.inject({ method: 'GET', url: `/api/auth/oauth/google/callback?state=${encodeURIComponent(state)}&code=${code}` })
    : await app.inject({
      method: 'POST', url: '/api/auth/oauth/apple/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ state, code, ...(opts.user ? { user: JSON.stringify(opts.user) } : {}) }).toString(),
    });
  return { res, location: String(res.headers.location ?? ''), cookie: cookieOf(res), auth, state };
}

describe('Sign in with Google', () => {
  it('advertises configured providers', async () => {
    const meta = (await app.inject({ method: 'GET', url: '/api/meta' })).json();
    expect(meta.oauthProviders).toEqual(['google', 'apple']);
  });

  it('start uses PKCE, state and nonce', async () => {
    const start = await app.inject({ method: 'GET', url: '/api/auth/oauth/google/start' });
    const u = new URL(String(start.headers.location));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('redirect_uri')).toBe(`${WEB}/api/auth/oauth/google/callback`);
    expect(u.searchParams.get('state')!.length).toBeGreaterThan(30);
  });

  it('newcomer names their business, then is signed in', async () => {
    const { location, res } = await signInWith('google', { sub: 'g-100', email: 'Amina@Example.com', email_verified: true, name: 'Amina Uwase' }, { next: '/app/shipments/new' });
    expect(lastTokenRequest!.get('code_verifier')).toBeTruthy(); // PKCE verifier sent
    expect(location.startsWith(`${WEB}/signup/complete?token=`)).toBe(true);
    expect(cookieOf(res)).toBe(''); // not signed in yet
    const token = new URL(location).searchParams.get('token')!;
    const pending = (await app.inject({ method: 'GET', url: `/api/auth/oauth/pending/${token}` })).json();
    expect(pending).toMatchObject({ email: 'amina@example.com', name: 'Amina Uwase', providerName: 'Google' });
    const done = await app.inject({ method: 'POST', url: '/api/auth/oauth/complete', payload: { token, orgName: 'Amina Fresh Produce Ltd' } });
    expect(done.statusCode).toBe(201);
    expect(done.json()).toMatchObject({ org: { name: 'Amina Fresh Produce Ltd' }, user: { role: 'owner' }, next: '/app/shipments/new' });
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieOf(done) } });
    expect(me.json().user.email).toBe('amina@example.com');
    // the pending token is single-use
    expect((await app.inject({ method: 'POST', url: '/api/auth/oauth/complete', payload: { token, orgName: 'Again' } })).statusCode).toBe(404);
  });

  it('returning user goes straight in, to a safe next path only', async () => {
    const ok = await signInWith('google', { sub: 'g-100', email: 'amina@example.com', email_verified: true }, { next: '/app/billing' });
    expect(ok.location).toBe(`${WEB}/app/billing`);
    expect(ok.cookie).toMatch(/^sc_session=/);
    const evil = await signInWith('google', { sub: 'g-100', email: 'amina@example.com', email_verified: true }, { next: '//evil.example/steal' });
    expect(evil.location).toBe(`${WEB}/app`);
  });

  it('links to an existing password account only when the email is verified', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Kivu Traders', name: 'Jean', email: 'jean@kivu.test', password: 'a long enough password' } });
    const unverified = await signInWith('google', { sub: 'g-200', email: 'jean@kivu.test', email_verified: false });
    expect(unverified.location).toContain('/login?oauth_error=');
    const verified = await signInWith('google', { sub: 'g-200', email: 'jean@kivu.test', email_verified: true });
    expect(verified.location).toBe(`${WEB}/app`);
    const me = (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: verified.cookie } })).json();
    expect(me.org.name).toBe('Kivu Traders');
    const ids = (await app.inject({ method: 'GET', url: '/api/auth/identities', headers: { cookie: verified.cookie } })).json();
    expect(ids).toMatchObject({ hasPassword: true, identities: [{ provider: 'google', email: 'jean@kivu.test' }] });
  });

  it.each([
    ['tampered signature', { tokenOpts: { tamper: true } }],
    ['unknown signing key', { tokenOpts: { kid: 'rotated-away' } }],
    ['wrong audience', { mutate: (c: Record<string, unknown>) => { c.aud = 'someone-else'; } }],
    ['wrong issuer', { mutate: (c: Record<string, unknown>) => { c.iss = 'https://evil.example'; } }],
    ['wrong nonce', { mutate: (c: Record<string, unknown>) => { c.nonce = 'replayed'; } }],
    ['expired token', { mutate: (c: Record<string, unknown>) => { c.exp = now() - 3600; } }],
    ['failed code exchange', { code: 'bad-code' }],
  ])('rejects %s', async (_label, opts) => {
    const r = await signInWith('google', { sub: 'g-300', email: 'x@example.com', email_verified: true }, opts as never);
    expect(r.location).toContain('/login?oauth_error=');
    expect(r.cookie).toBe('');
  });

  it('state is single-use', async () => {
    const first = await signInWith('google', { sub: 'g-100', email: 'amina@example.com', email_verified: true });
    expect(first.location).toBe(`${WEB}/app`);
    const replay = await app.inject({ method: 'GET', url: `/api/auth/oauth/google/callback?state=${encodeURIComponent(first.state)}&code=good-code` });
    expect(String(replay.headers.location)).toContain('oauth_error=');
  });

  it('provider-cancelled sign-in shows a friendly message', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/auth/oauth/google/callback?error=access_denied' });
    expect(decodeURIComponent(String(r.headers.location))).toContain('Sign-in was cancelled.');
  });
});

describe('Sign in with Apple', () => {
  it('form_post callback, ES256 token, name from the first authorization', async () => {
    const start = await app.inject({ method: 'GET', url: '/api/auth/oauth/apple/start' });
    expect(new URL(String(start.headers.location)).searchParams.get('response_mode')).toBe('form_post');
    const r = await signInWith('apple', { sub: 'a-001.xyz', email: 'abc123@privaterelay.appleid.com', email_verified: 'true' }, { user: { name: { firstName: 'Claudine', lastName: 'Ingabire' } } });
    expect(r.location.startsWith(`${WEB}/signup/complete?token=`)).toBe(true);
    // The client secret we sent Apple is a valid ES256 JWT from our team key.
    const secret = lastTokenRequest!.get('client_secret')!;
    const [h, p, s] = secret.split('.');
    expect(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: appleTeamKey.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s!, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toMatchObject({ iss: 'TEAM123456', sub: 'com.sealchain.web', aud: 'https://appleid.apple.com' });
    const pending = (await app.inject({ method: 'GET', url: `/api/auth/oauth/pending/${new URL(r.location).searchParams.get('token')}` })).json();
    expect(pending.name).toBe('Claudine Ingabire');
  });
});

describe('invites and linked accounts', () => {
  it('accepts an invitation only with the invited email', async () => {
    const owner = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'jean@kivu.test', password: 'a long enough password' } });
    const inv = await app.inject({ method: 'POST', url: '/api/team/invites', headers: { cookie: cookieOf(owner) }, payload: { email: 'clerk@kivu.test' } });
    const inviteToken = inv.json().inviteUrl.split('/invite/')[1];
    const wrong = await signInWith('google', { sub: 'g-400', email: 'other@kivu.test', email_verified: true }, { invite: inviteToken });
    expect(decodeURIComponent(wrong.location)).toContain('This invitation is for clerk@kivu.test');
    const right = await signInWith('google', { sub: 'g-401', email: 'clerk@kivu.test', email_verified: true, name: 'Clerk' }, { invite: inviteToken });
    expect(right.location).toBe(`${WEB}/app`);
    const me = (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: right.cookie } })).json();
    expect(me).toMatchObject({ org: { name: 'Kivu Traders' }, user: { role: 'member' } });
  });

  it('connects a provider with a different email to the signed-in account', async () => {
    const owner = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'jean@kivu.test', password: 'a long enough password' } });
    const r = await signInWith('apple', { sub: 'a-jean', email: 'jean.personal@icloud.com', email_verified: 'true' }, { link: true, cookie: cookieOf(owner) });
    expect(r.location).toBe(`${WEB}/app/team?linked=apple`);
    const back = await signInWith('apple', { sub: 'a-jean', email: 'jean.personal@icloud.com', email_verified: 'true' });
    const me = (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: back.cookie } })).json();
    expect(me.user.email).toBe('jean@kivu.test');
    // an identity owned by someone else cannot be hijacked
    const steal = await signInWith('google', { sub: 'g-100', email: 'amina@example.com', email_verified: true }, { link: true, cookie: cookieOf(owner) });
    expect(decodeURIComponent(steal.location)).toContain('already connected to another SealChain user');
  });

  it('cannot unlink the only way to sign in', async () => {
    const r = await signInWith('google', { sub: 'g-401', email: 'clerk@kivu.test', email_verified: true });
    const del = await app.inject({ method: 'DELETE', url: '/api/auth/identities/google', headers: { cookie: r.cookie } });
    expect(del.statusCode).toBe(409);
    // password login is impossible for an OAuth-only user
    const pw = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'clerk@kivu.test', password: 'oauth' } });
    expect(pw.statusCode).toBe(401);
  });
});
