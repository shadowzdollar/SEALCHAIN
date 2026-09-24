/**
 * Compliance-team console: keep rules current (the brief's "a stale rule set
 * is worse than no automation"), watch anchoring health, manage pilot billing.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CORRIDORS, TARIFF_CATALOG, checklistCsv, getCorridor } from '@sealchain/core';
import { newId, nowIso } from '../db';
import { audit, requireCompliance } from '../services/auth';
import { currentPeriod, statement } from '../services/billing';
import { HttpError, type Deps } from '../services/documents';
import { checklistState, rulesetVerifiedAt, tariffLookup, type RuleChangeRow } from '../services/rules';
import { publicCorridor } from './meta';

export async function adminRoutes(api: FastifyInstance, deps: Deps) {
  const { db, cfg, anchor } = deps;
  const guard = { preHandler: requireCompliance };

  api.get('/admin/rules', guard, async () => {
    const lookup = tariffLookup(db);
    const verifications = db.all<{ corridor_id: string; ruleset_version: string; verified_at: string; verified_by: string; note: string | null }>('SELECT * FROM ruleset_verifications');
    return {
      corridors: Object.values(CORRIDORS).map((c) => ({
        ...publicCorridor(c, rulesetVerifiedAt(db, c.id)),
        lastVerification: verifications.find((v) => v.corridor_id === c.id) ?? null,
      })),
      tariff: TARIFF_CATALOG.map((l) => lookup(l.code)!),
    };
  });

  api.post<{ Params: { corridorId: string } }>('/admin/rules/:corridorId/verify', guard, async (req) => {
    const { note } = z.object({ note: z.string().trim().max(1000).optional() }).parse(req.body ?? {});
    const corridor = getCorridor(req.params.corridorId);
    db.run(
      `INSERT INTO ruleset_verifications (corridor_id, ruleset_version, verified_at, verified_by, note) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(corridor_id) DO UPDATE SET ruleset_version = excluded.ruleset_version, verified_at = excluded.verified_at, verified_by = excluded.verified_by, note = excluded.note`,
      corridor.id, corridor.rulesetVersion, nowIso(), req.auth!.user.email, note ?? null,
    );
    audit(db, req.auth, 'rules.verify', 'corridor', corridor.id, { version: corridor.rulesetVersion, note });
    return { ok: true, verifiedAt: rulesetVerifiedAt(db, corridor.id) };
  });

  api.put<{ Params: { code: string } }>('/admin/tariff/:code', guard, async (req) => {
    const body = z.object({ cetRate: z.coerce.number().min(0).max(200), note: z.string().trim().max(500).optional() }).parse(req.body);
    const line = tariffLookup(db)(req.params.code);
    if (!line) throw new HttpError(404, 'not_found', 'HS code not in catalog');
    db.run(
      `INSERT INTO tariff_overrides (code, cet_rate, note, verified_at, verified_by) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET cet_rate = excluded.cet_rate, note = excluded.note, verified_at = excluded.verified_at, verified_by = excluded.verified_by`,
      line.code, body.cetRate, body.note ?? null, nowIso(), req.auth!.user.email,
    );
    audit(db, req.auth, 'tariff.verify', 'tariff', line.code, { from: line.cetRate, to: body.cetRate });
    return tariffLookup(db)(line.code);
  });

  // --------------------------------------------------- rules checklist
  api.get<{ Querystring: { format?: string } }>('/admin/checklist', guard, async (req, reply) => {
    const state = checklistState(db);
    if (req.query.format === 'csv') {
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="sealchain-rules-checklist-${nowIso().slice(0, 10)}.csv"`)
        .send(checklistCsv(state.items));
    }
    return state;
  });

  api.put<{ Params: { key: string } }>('/admin/checklist/:key', guard, async (req) => {
    const body = z.object({ status: z.enum(['confirmed', 'incorrect']), note: z.string().trim().max(1000).optional() }).parse(req.body);
    const item = checklistState(db).items.find((i) => i.key === req.params.key);
    if (!item) throw new HttpError(404, 'not_found', 'Unknown checklist item');
    if (body.status === 'incorrect' && !body.note) throw new HttpError(400, 'note_required', 'Say what is wrong so it can be fixed.');
    db.run(
      `INSERT INTO rule_checks (key, value, status, note, checked_by, checked_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, status = excluded.status, note = excluded.note, checked_by = excluded.checked_by, checked_at = excluded.checked_at`,
      item.key, item.value, body.status, body.note ?? null, req.auth!.user.email, nowIso(),
    );
    audit(db, req.auth, `checklist.${body.status}`, 'rule', item.key, { value: item.value, note: body.note });
    return checklistState(db).items.find((i) => i.key === item.key);
  });

  api.delete<{ Params: { key: string } }>('/admin/checklist/:key', guard, async (req) => {
    db.run('DELETE FROM rule_checks WHERE key = ?', req.params.key);
    audit(db, req.auth, 'checklist.reopen', 'rule', req.params.key);
    return { ok: true };
  });

  // ---------------------------------------------------- rule changes
  api.get('/admin/rule-changes', guard, async () =>
    db.all<RuleChangeRow>('SELECT * FROM rule_changes ORDER BY effective_from DESC').map((r) => ({ ...r, hs_prefixes: JSON.parse(r.hs_prefixes) })),
  );

  api.post('/admin/rule-changes', guard, async (req, reply) => {
    const body = z.object({
      corridorId: z.string().refine((v) => v in CORRIDORS, 'Unknown corridor').nullable().default(null),
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      title: z.string().trim().min(5).max(200),
      description: z.string().trim().min(10).max(2000),
      hsPrefixes: z.array(z.string().regex(/^\d{2,8}$/)).max(50).default([]),
      sourceTitle: z.string().trim().min(3).max(300),
      sourceUrl: z.string().url().max(500).optional(),
    }).parse(req.body);
    const id = newId('chg', 16);
    db.insert('rule_changes', {
      id, corridor_id: body.corridorId, effective_from: body.effectiveFrom, title: body.title, description: body.description,
      hs_prefixes: JSON.stringify(body.hsPrefixes), source_title: body.sourceTitle, source_url: body.sourceUrl ?? null,
      created_by: req.auth!.user.email, created_at: nowIso(),
    });
    audit(db, req.auth, 'rules.change.add', 'rule_change', id, body);
    return reply.code(201).send({ id });
  });

  api.delete<{ Params: { id: string } }>('/admin/rule-changes/:id', guard, async (req) => {
    db.run('DELETE FROM rule_changes WHERE id = ?', req.params.id);
    audit(db, req.auth, 'rules.change.delete', 'rule_change', req.params.id);
    return { ok: true };
  });

  /**
   * How well each fraud signal predicts real outcomes, across all pilot
   * organisations (counts only — no document content leaves an org).
   */
  api.get('/admin/signal-performance', guard, async () => {
    const rows = db.all<{ result: string; outcome: string | null; risk_level: string }>('SELECT result, outcome, risk_level FROM forensic_reports');
    const stats = new Map<string, { code: string; title: string; level: string; fired: number; fraud: number; genuine: number }>();
    const byRisk: Record<string, { fraud: number; genuine: number; unlabelled: number }> = {};
    for (const r of rows) {
      const result = JSON.parse(r.result) as { signals: Array<{ code: string; title: string; level: string }> };
      const risk = (byRisk[r.risk_level] ??= { fraud: 0, genuine: 0, unlabelled: 0 });
      if (r.outcome === 'fraud') risk.fraud++;
      else if (r.outcome === 'genuine') risk.genuine++;
      else risk.unlabelled++;
      for (const sig of new Map(result.signals.filter((x) => x.level !== 'pass').map((x) => [x.code, x])).values()) {
        const s = stats.get(sig.code) ?? { code: sig.code, title: sig.title, level: sig.level, fired: 0, fraud: 0, genuine: 0 };
        s.fired++;
        if (r.outcome === 'fraud') s.fraud++;
        if (r.outcome === 'genuine') s.genuine++;
        stats.set(sig.code, s);
      }
    }
    return {
      reports: rows.length,
      labelled: rows.filter((r) => r.outcome).length,
      byRisk,
      signals: [...stats.values()]
        .map((s) => ({ ...s, precision: s.fraud + s.genuine ? s.fraud / (s.fraud + s.genuine) : null }))
        .sort((a, b) => b.fired - a.fired),
    };
  });

  api.get('/admin/anchor', guard, async () => ({
    ...(await anchor.status()),
    recentBatches: db.all(
      'SELECT id, root, leaf_count AS leafCount, backend, status, tx_hash AS txHash, block_number AS blockNumber, anchored_at AS anchoredAt, attempts, error, created_at AS createdAt FROM anchor_batches ORDER BY created_at DESC LIMIT 25',
    ),
  }));

  api.post('/admin/anchor/run', guard, async () => {
    await anchor.run();
    return anchor.status();
  });

  api.get('/admin/orgs', guard, async () => {
    const period = currentPeriod();
    return db.all<{ id: string; name: string; country: string; plan: string; created_at: string; users: number; shipments: number }>(
      `SELECT o.id, o.name, o.country, o.plan, o.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) AS users,
              (SELECT COUNT(*) FROM shipments s WHERE s.org_id = o.id AND s.status = 'issued') AS shipments
         FROM orgs o WHERE o.kind = 'business' ORDER BY o.created_at DESC`,
    ).map((o) => {
      const st = statement(db, cfg, o.id, period);
      return { ...o, period, totalCents: st.totalCents, paidCents: st.paidCents, balanceCents: st.balanceCents };
    });
  });

  api.post('/admin/payments', guard, async (req, reply) => {
    const body = z.object({
      orgId: z.string().min(1),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      amountCents: z.coerce.number().int().positive().max(100_000_000),
      method: z.enum(['mobile_money', 'bank_transfer', 'card', 'cash', 'other']),
      reference: z.string().trim().max(120).optional(),
    }).parse(req.body);
    if (!db.get('SELECT 1 FROM orgs WHERE id = ?', body.orgId)) throw new HttpError(404, 'not_found', 'Organisation not found');
    const id = newId('pay', 16);
    db.insert('payments', { id, org_id: body.orgId, period: body.period, amount_cents: body.amountCents, method: body.method, reference: body.reference ?? null, recorded_by: req.auth!.user.email, created_at: nowIso() });
    audit(db, req.auth, 'billing.payment', 'org', body.orgId, body);
    return reply.code(201).send({ id });
  });

  api.get('/admin/audit', guard, async () =>
    db.all(
      `SELECT a.id, a.action, a.entity, a.entity_id AS entityId, a.detail, a.created_at AS createdAt, u.email, o.name AS org
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN orgs o ON o.id = a.org_id
        ORDER BY a.created_at DESC LIMIT 100`,
    ),
  );
}
