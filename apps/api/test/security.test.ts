import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-sec-'));
let app: FastifyInstance;
let cookie = '';

beforeAll(async () => {
  process.env.DATA_DIR = dataDir;
  process.env.ANCHOR_MODE = 'local';
  process.env.PUBLIC_WEB_URL = 'http://localhost:5174';
  delete process.env.RPC_URL;
  app = (await buildApp(loadConfig(), { logger: false, startAnchoring: false })).app;
  await app.ready();
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Sec Test Ltd', name: 'Sec', email: 'sec@test.test', password: 'a long enough password' } });
  cookie = String(r.headers['set-cookie']).split(';')[0]!;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('HTTP hardening', () => {
  it('blocks cookie-authenticated writes from other origins', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/parties', headers: { cookie, origin: 'https://evil.example' }, payload: { role: 'exporter', party: { name: 'X', address: 'Y', city: 'Z', country: 'RW' } } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('forbidden_origin');
    const viaReferer = await app.inject({ method: 'POST', url: '/api/parties', headers: { cookie, referer: 'https://evil.example/page' }, payload: {} });
    expect(viaReferer.statusCode).toBe(403);
  });

  it('allows the app origin, origin-less clients and API keys', async () => {
    const party = { role: 'exporter', party: { name: 'X Ltd', address: 'Y', city: 'Z', country: 'RW' } };
    expect((await app.inject({ method: 'POST', url: '/api/parties', headers: { cookie, origin: 'http://localhost:5174' }, payload: party })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/api/parties', headers: { cookie }, payload: party })).statusCode).toBe(201);
    const created = await app.inject({ method: 'POST', url: '/api/api-keys', headers: { cookie }, payload: { name: 'Integration key' } });
    const key = created.json().key;
    expect((await app.inject({ method: 'POST', url: '/api/parties', headers: { authorization: `Bearer ${key}`, origin: 'https://integrator.example' }, payload: party })).statusCode).toBe(201);
  });

  it('reads are never blocked and responses carry security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta', headers: { origin: 'https://evil.example' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
