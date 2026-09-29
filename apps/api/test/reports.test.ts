import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { demoShipment } from '@sealchain/core';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';
import { csvCell, lastMonths, toCsv } from '../src/routes/reports';

describe('CSV helpers', () => {
  it('quotes, escapes and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('Kivu, Ltd')).toBe('"Kivu, Ltd"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+250 788')).toBe("'+250 788");
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell(null)).toBe('');
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });

  it('lists the last months oldest first', () => {
    expect(lastMonths(3, new Date('2026-01-15T00:00:00Z'))).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('reports', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sealchain-rep-'));
  let app: FastifyInstance;
  let cookie = '';
  let docId = '';
  const get = (url: string, c = cookie) => app.inject({ method: 'GET', url, headers: c ? { cookie: c } : {} });

  beforeAll(async () => {
    Object.assign(process.env, { DATA_DIR: dataDir, ANCHOR_MODE: 'local' });
    delete process.env.RPC_URL;
    app = (await buildApp(loadConfig(), { logger: false, startAnchoring: false })).app;
    await app.ready();
    const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { orgName: 'Kivu Fresh Ltd', name: 'Aline', email: 'aline@kivu.test', password: 'a long enough password' } });
    cookie = String(r.headers['set-cookie']).split(';')[0]!;
    const { id: _id, ...draft } = demoShipment();
    const created = (await app.inject({ method: 'POST', url: '/api/shipments', headers: { cookie }, payload: draft })).json();
    const issued = (await app.inject({ method: 'POST', url: `/api/shipments/${created.id}/issue`, headers: { cookie }, payload: { acknowledgeWarnings: true } })).json();
    docId = issued.documents[0].id;
    await app.inject({ method: 'POST', url: '/api/shipments', headers: { cookie }, payload: draft }); // a draft: not counted as issued
    await get(`/api/verify/${docId}`, '');
    await get(`/api/verify/${docId}`, '');
  });
  afterAll(async () => {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('aggregates issued shipments, value, duty and verifications by month', async () => {
    const rep = (await get('/api/reports?months=6')).json();
    expect(rep.months).toHaveLength(6);
    const current = rep.months.at(-1);
    expect(current).toMatchObject({ shipments: 1, verifications: 2 });
    expect(current.valueUsd).toBeGreaterThan(0);
    expect(rep.totals.shipments).toBe(1);
    expect(rep.corridors).toHaveLength(1);
    expect(rep.corridors[0].corridorId).toBe(demoShipment().corridorId);
    expect(rep.buyers[0]).toMatchObject({ name: demoShipment().consignee.name, shipments: 1 });
  });

  it('exports CSVs of shipments, the document register and verifications', async () => {
    const ships = await get('/api/reports/shipments.csv');
    expect(ships.headers['content-type']).toMatch(/text\/csv/);
    expect(ships.headers['content-disposition']).toMatch(/sealchain-shipments-\d{4}-\d{2}-\d{2}\.csv/);
    const lines = ships.body.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toMatch(/^Reference,Status,Corridor/);
    expect(lines).toHaveLength(3); // header + issued + draft

    const docs = (await get('/api/reports/documents.csv')).body;
    expect(docs).toContain(`/v/${docId}`);
    expect(docs.split('\r\n')[1]).toMatch(/[a-f0-9]{64}/);

    const ver = (await get('/api/reports/verifications.csv')).body.trim().split('\r\n');
    expect(ver).toHaveLength(3);

    expect((await get('/api/reports/shipments.csv', '')).statusCode).toBe(401);
  });
});
