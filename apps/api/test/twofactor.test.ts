import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';
import { base32Decode, base32Encode, currentStep, matchTotp, totp } from '../src/services/twofactor';
import { describeAgent } from '../src/routes/security';

describe('TOTP (RFC 6238)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));

  it('matches the RFC test vectors (6-digit truncation)', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
    expect(totp(secret, Math.floor(59 / 30))).toBe('287082');
    expect(totp(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totp(secret, Math.floor(1234567890 / 30))).toBe('005924');
  });

  it('accepts ±1 step of clock drift and nothing further', () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(matchTotp(secret, totp(secret, step), now)).toBe(step);
    expect(matchTotp(secret, totp(secret, step - 1), now)).toBe(step - 1);
    expect(matchTotp(secret, totp(secret, step + 2), now)).toBeNull();
    expect(matchTotp(secret, 'abcdef', now)).toBeNull();
  });

  it('names devices from user agents', () => {
    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBe('Chrome on Windows');
    expect(describeAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(describeAgent(null)).toBe('Unknown device');
  });
});

describe('two-step sign-in', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-2fa-'));
  let app: FastifyInstance;
  let cookie = '';
  let secret = '';
  let recovery: string[] = [];
  const creds = { email: 'aline@kivu.test', password: 'a long enough password' };
  const call = async (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown, c = cookie, ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15') => {
    const r = await app.inject({ method, url, headers: { ...(c ? { cookie: c } : {}), 'user-agent': ua }, payload: payload as never });
    return { status: r.statusCode, body: r.json(), cookie: r.headers['set-cookie'] ? String(r.headers['set-cookie']).split(';')[0]! : '' };
  };

  beforeAll(async () => {
    Object.assign(process.env, { DATA_DIR: dataDir, ANCHOR_MODE: 'local' });
    delete process.env.RPC_URL;
    app = (await buildApp(loadConfig(), { logger: false, startAnchoring: false })).app;
    await app.ready();
    cookie = (await call('POST', '/api/auth/register', { orgName: 'Kivu Fresh Ltd', name: 'Aline', ...creds }, '')).cookie;
  });
  afterAll(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('enrols only after a correct code, and returns ten recovery codes once', async () => {
    const setup = await call('POST', '/api/auth/2fa/setup');
    expect(setup.body.uri).toMatch(/^otpauth:\/\/totp\/SealChain%3Aaline%40kivu\.test\?secret=/);
    expect(setup.body.qr).toMatch(/^data:image\/png;base64,/);
    secret = setup.body.secret;
    expect((await call('POST', '/api/auth/2fa/enable', { code: '000000' })).status).toBe(400);
    const on = await call('POST', '/api/auth/2fa/enable', { code: totp(secret, currentStep()) });
    expect(on.status).toBe(200);
    recovery = on.body.recoveryCodes;
    expect(recovery).toHaveLength(10);
    expect((await call('GET', '/api/auth/2fa')).body).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });
  });

  it('a password alone no longer signs in; the code does, but never twice', async () => {
    const first = await call('POST', '/api/auth/login', creds, '');
    expect(first.body).toMatchObject({ twoFactorRequired: true });
    expect(first.cookie).toBe('');
    expect((await call('POST', '/api/auth/login/2fa', { challenge: first.body.challenge, code: '123456' }, '')).status).toBe(401);
    const code = totp(secret, currentStep() + 1);
    const ok = await call('POST', '/api/auth/login/2fa', { challenge: first.body.challenge, code }, '');
    expect(ok.status).toBe(200);
    expect(ok.cookie).toMatch(/^sc_session=/);
    // The challenge is spent, and the same code cannot be replayed on a new one.
    expect((await call('POST', '/api/auth/login/2fa', { challenge: first.body.challenge, code }, '')).status).toBe(401);
    const second = await call('POST', '/api/auth/login', creds, '');
    expect((await call('POST', '/api/auth/login/2fa', { challenge: second.body.challenge, code }, '')).status).toBe(401);
  });

  it('recovery codes work exactly once', async () => {
    const ch = (await call('POST', '/api/auth/login', creds, '')).body.challenge;
    const ok = await call('POST', '/api/auth/login/2fa', { challenge: ch, code: recovery[0]!.toLowerCase() }, '');
    expect(ok.status).toBe(200);
    expect(ok.body.recoveryCodesLeft).toBe(9);
    const again = (await call('POST', '/api/auth/login', creds, '')).body.challenge;
    expect((await call('POST', '/api/auth/login/2fa', { challenge: again, code: recovery[0] }, '')).status).toBe(401);
  });

  it('locks a challenge after five wrong codes', async () => {
    const ch = (await call('POST', '/api/auth/login', creds, '')).body.challenge;
    for (let i = 0; i < 5; i++) expect((await call('POST', '/api/auth/login/2fa', { challenge: ch, code: '000000' }, '')).status).toBe(401);
    expect((await call('POST', '/api/auth/login/2fa', { challenge: ch, code: totp(secret, currentStep()) }, '')).status).toBe(429);
  });

  it('lists sessions with devices and signs out the others', async () => {
    const ch = (await call('POST', '/api/auth/login', creds, '')).body.challenge;
    const phone = await call('POST', '/api/auth/login/2fa', { challenge: ch, code: recovery[1] }, '', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36');
    const list = (await call('GET', '/api/auth/sessions', undefined, phone.cookie)).body;
    expect(list.length).toBeGreaterThanOrEqual(2);
    const current = list.find((s: { current: boolean }) => s.current);
    expect(current.device).toBe('Chrome on Android');
    const other = list.find((s: { current: boolean }) => !s.current);
    expect((await call('DELETE', `/api/auth/sessions/${current.id}`, undefined, phone.cookie)).status).toBe(400);
    expect((await call('DELETE', `/api/auth/sessions/${other.id}`, undefined, phone.cookie)).status).toBe(200);
    const res = await call('POST', '/api/auth/sessions/revoke-others', undefined, phone.cookie);
    expect(res.status).toBe(200);
    expect((await call('GET', '/api/auth/sessions', undefined, phone.cookie)).body).toHaveLength(1);
    cookie = phone.cookie;
  });

  it('turning it off needs the password and a code', async () => {
    expect((await call('POST', '/api/auth/2fa/disable', { code: totp(secret, currentStep() + 1), password: 'wrong' })).status).toBe(400);
    expect((await call('POST', '/api/auth/2fa/disable', { code: recovery[2], password: creds.password })).status).toBe(200);
    const login = await call('POST', '/api/auth/login', creds, '');
    expect(login.status).toBe(200);
    expect(login.cookie).toMatch(/^sc_session=/);
  });
});
