import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-public-'));
let app: FastifyInstance;
let staff = '';
let owner = '';

const register = async (email: string) => {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: `${email} Ltd`, name: 'Test User', email, password: 'a long enough password' } });
  return String(r.headers['set-cookie']).split(';')[0]!;
};

beforeAll(async () => {
  process.env.DATA_DIR = dataDir;
  process.env.ANCHOR_MODE = 'local';
  process.env.ADMIN_EMAILS = 'staff@sealchain.test';
  delete process.env.RPC_URL;
  app = (await buildApp(loadConfig(), { logger: false, startAnchoring: false })).app;
  await app.ready();
  staff = await register('staff@sealchain.test');
  owner = await register('owner@exporter.test');
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const request = { name: 'Jean Uwase', email: 'Jean@Coop.test', company: 'Musanze Growers', country: 'Rwanda', topic: 'pilot', message: 'We export potatoes to Uganda and want to join the pilot.' };

describe('contact requests', () => {
  it('stores a request, emails the team and lets compliance close it', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/contact', payload: request });
    expect(res.statusCode).toBe(201);
    const { id } = res.json();

    expect((await app.inject({ method: 'GET', url: '/api/admin/contact-requests', headers: { cookie: owner } })).statusCode).toBe(403);
    const list = (await app.inject({ method: 'GET', url: '/api/admin/contact-requests', headers: { cookie: staff } })).json();
    expect(list[0]).toMatchObject({ id, email: 'jean@coop.test', topic: 'pilot', handledAt: null });

    const handled = await app.inject({ method: 'POST', url: `/api/admin/contact-requests/${id}/handled`, headers: { cookie: staff } });
    expect(handled.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/admin/contact-requests/${id}/handled`, headers: { cookie: staff } })).statusCode).toBe(404);
  });

  it('rejects incomplete requests and bots filling the honeypot', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/contact', payload: { ...request, message: 'hi' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/contact', payload: { ...request, topic: 'spam' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/contact', payload: { ...request, website: 'http://spam.example' } })).statusCode).toBe(400);
  });
});

describe('social sign-in before it is configured', () => {
  it('sends the browser back to sign-in with a message instead of an error page', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/oauth/google/start' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/\/login\?oauth_error=.*Google/);
    expect((await app.inject({ method: 'GET', url: '/api/auth/oauth/facebook/start' })).statusCode).toBe(404);
  });
});

describe('status', () => {
  it('reports each component without internal detail', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.overall).toBe('operational');
    expect(body.components.map((c: { id: string }) => c.id)).toEqual(['web', 'verification', 'anchoring', 'email']);
    expect(body.anchoring).toMatchObject({ backend: 'local', awaitingAnchor: 0 });
    expect(JSON.stringify(body)).not.toMatch(/0x[0-9a-f]{40}/i);
  });
});
