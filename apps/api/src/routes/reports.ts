/** Organisation reports and CSV exports. */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { CORRIDORS, DOCUMENT_KIND_LABEL, toUsd, type Currency, type DocumentKind, type Shipment, type ValidationReport } from '@sealchain/core';
import { json } from '../db';
import { audit, requireAuth } from '../services/auth';
import type { Deps } from '../services/documents';

/**
 * One CSV cell. Quotes when needed, and neutralises leading = + - @ so a
 * buyer name like "=HYPERLINK(...)" can't run as a formula in Excel.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? String(v) : String(v);
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function sendCsv(reply: FastifyReply, name: string, csv: string) {
  return reply
    .type('text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`)
    .send(`﻿${csv}`); // BOM so Excel reads UTF-8 names correctly
}

/** The last `n` calendar months, oldest first, as YYYY-MM. */
export function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 0; i < n; i++) {
    out.unshift(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

interface IssuedRow { id: string; reference: string; corridor_id: string; status: string; data: string; validation: string | null; created_at: string; first_issued: string | null; docs: number }

export async function reportRoutes(api: FastifyInstance, { db, cfg }: Deps) {
  const shipmentsOf = (orgId: string) =>
    db.all<IssuedRow>(
      `SELECT s.id, s.reference, s.corridor_id, s.status, s.data, s.validation, s.created_at,
              MIN(d.issued_at) AS first_issued, COUNT(d.id) AS docs
         FROM shipments s LEFT JOIN documents d ON d.shipment_id = s.id AND d.status = 'active'
        WHERE s.org_id = ? GROUP BY s.id ORDER BY s.created_at DESC`,
      orgId,
    );

  const figures = (r: IssuedRow) => {
    const v = r.validation ? json<ValidationReport>(r.validation) : null;
    return {
      valueUsd: v ? Math.round(v.valueUsd) : 0,
      dutyUsd: v ? Math.round(toUsd(v.duty.savings, v.duty.currency as Currency, cfg.fx)) : 0,
      invoiceTotal: v?.totals.invoiceTotal ?? 0,
      currency: v?.duty.currency ?? '',
    };
  };

  api.get<{ Querystring: { months?: string } }>('/reports', { preHandler: requireAuth }, async (req) => {
    const orgId = req.auth!.org.id;
    const n = Math.min(Math.max(Number(req.query.months) || 12, 3), 24);
    const months = lastMonths(n);
    const bucket = new Map(months.map((m) => [m, { period: m, shipments: 0, valueUsd: 0, dutyUsd: 0, verifications: 0, shareViews: 0 }]));
    const corridors = new Map<string, { corridorId: string; name: string; shipments: number; valueUsd: number }>();
    const buyers = new Map<string, { name: string; country: string; shipments: number; valueUsd: number }>();

    for (const r of shipmentsOf(orgId).filter((x) => x.first_issued)) {
      const f = figures(r);
      const b = bucket.get(r.first_issued!.slice(0, 7));
      if (b) {
        b.shipments += 1;
        b.valueUsd += f.valueUsd;
        b.dutyUsd += f.dutyUsd;
      }
      const c = corridors.get(r.corridor_id) ?? { corridorId: r.corridor_id, name: CORRIDORS[r.corridor_id]?.name ?? r.corridor_id, shipments: 0, valueUsd: 0 };
      c.shipments += 1;
      c.valueUsd += f.valueUsd;
      corridors.set(r.corridor_id, c);
      const consignee = json<Shipment>(r.data).consignee;
      const key = consignee.name.trim().toLowerCase();
      const byer = buyers.get(key) ?? { name: consignee.name, country: consignee.country, shipments: 0, valueUsd: 0 };
      byer.shipments += 1;
      byer.valueUsd += f.valueUsd;
      buyers.set(key, byer);
    }
    const since = `${months[0]}-01`;
    for (const v of db.all<{ m: string; n: number }>(
      `SELECT substr(v.created_at, 1, 7) AS m, COUNT(*) AS n FROM verification_events v JOIN documents d ON d.id = v.document_id
        WHERE d.org_id = ? AND v.created_at >= ? GROUP BY m`, orgId, since,
    )) { const b = bucket.get(v.m); if (b) b.verifications = v.n; }
    for (const v of db.all<{ m: string; n: number }>(
      `SELECT substr(sv.created_at, 1, 7) AS m, COUNT(*) AS n FROM share_views sv JOIN share_links l ON l.id = sv.link_id
        WHERE l.org_id = ? AND sv.created_at >= ? GROUP BY m`, orgId, since,
    )) { const b = bucket.get(v.m); if (b) b.shareViews = v.n; }

    const series = [...bucket.values()];
    const sum = (k: 'shipments' | 'valueUsd' | 'dutyUsd' | 'verifications' | 'shareViews') => series.reduce((a, b) => a + b[k], 0);
    return {
      months: series,
      totals: { shipments: sum('shipments'), valueUsd: sum('valueUsd'), dutyUsd: sum('dutyUsd'), verifications: sum('verifications'), shareViews: sum('shareViews') },
      corridors: [...corridors.values()].sort((a, b) => b.valueUsd - a.valueUsd),
      buyers: [...buyers.values()].sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 8),
    };
  });

  // ---------------------------------------------------------------- CSV
  api.get('/reports/shipments.csv', { preHandler: requireAuth }, async (req, reply) => {
    const rows = shipmentsOf(req.auth!.org.id).map((r) => {
      const s = json<Shipment>(r.data);
      const f = figures(r);
      return [r.reference, r.status, CORRIDORS[r.corridor_id]?.name ?? r.corridor_id, s.consignee.name, s.consignee.country, s.invoiceNumber, s.invoiceDate, s.incoterm,
        s.transportMode, f.currency || s.currency, f.invoiceTotal, f.valueUsd, f.dutyUsd, r.docs, r.first_issued ?? '', r.created_at];
    });
    audit(db, req.auth, 'report.export', 'org', req.auth!.org.id, { report: 'shipments', rows: rows.length });
    return sendCsv(reply, 'sealchain-shipments', toCsv(
      ['Reference', 'Status', 'Corridor', 'Consignee', 'Consignee country', 'Invoice number', 'Invoice date', 'Incoterm', 'Transport', 'Currency', 'Invoice total', 'Value (USD)', 'Duty protected (USD)', 'Active documents', 'First issued', 'Created'],
      rows,
    ));
  });

  api.get('/reports/documents.csv', { preHandler: requireAuth }, async (req, reply) => {
    const rows = db.all<{ id: string; number: string; kind: DocumentKind; version: number; status: string; sha256: string; issued_at: string; reference: string; anchored_at: string | null; tx_hash: string | null; chain_id: number | null }>(
      `SELECT d.id, d.number, d.kind, d.version, d.status, d.sha256, d.issued_at, s.reference, b.anchored_at, b.tx_hash, b.chain_id
         FROM documents d JOIN shipments s ON s.id = d.shipment_id LEFT JOIN anchor_batches b ON b.id = d.batch_id AND b.status = 'confirmed'
        WHERE d.org_id = ? ORDER BY d.issued_at DESC`,
      req.auth!.org.id,
    ).map((d) => [d.number, DOCUMENT_KIND_LABEL[d.kind] ?? d.kind, d.version, d.status, d.reference, d.issued_at, d.sha256, d.anchored_at ?? '', d.tx_hash ?? '', d.chain_id ?? '', `${cfg.publicWebUrl}/v/${d.id}`]);
    audit(db, req.auth, 'report.export', 'org', req.auth!.org.id, { report: 'documents', rows: rows.length });
    return sendCsv(reply, 'sealchain-document-register', toCsv(
      ['Document number', 'Type', 'Version', 'Status', 'Shipment', 'Issued', 'SHA-256', 'Anchored', 'Transaction', 'Chain ID', 'Verify at'],
      rows,
    ));
  });

  api.get('/reports/verifications.csv', { preHandler: requireAuth }, async (req, reply) => {
    const rows = db.all<{ created_at: string; number: string; method: string; outcome: string; reference: string }>(
      `SELECT v.created_at, d.number, v.method, v.outcome, s.reference FROM verification_events v
         JOIN documents d ON d.id = v.document_id JOIN shipments s ON s.id = d.shipment_id
        WHERE d.org_id = ? ORDER BY v.created_at DESC LIMIT 20000`,
      req.auth!.org.id,
    ).map((v) => [v.created_at, v.number, v.reference, v.method, v.outcome]);
    audit(db, req.auth, 'report.export', 'org', req.auth!.org.id, { report: 'verifications', rows: rows.length });
    return sendCsv(reply, 'sealchain-verifications', toCsv(['When (UTC)', 'Document', 'Shipment', 'How it was checked', 'Result'], rows));
  });
}
