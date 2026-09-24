/**
 * Merges the compliance team's work into the static rule data:
 *  - verified tariff rates (tariff_overrides)
 *  - rule-set verification dates (ruleset_verifications)
 *  - regulation changes recorded in the console (rule_changes)
 *  - item-by-item checklist confirmations (rule_checks)
 */
import {
  buildChecklist,
  findTariffLine,
  getCorridor,
  type ChecklistItem,
  type Corridor,
  type RuleChange,
  type TariffLine,
  type ValidateOptions,
} from '@sealchain/core';
import type { Config } from '../config';
import { json, type Db } from '../db';

interface OverrideRow {
  code: string;
  cet_rate: number;
  note: string | null;
  verified_at: string;
  verified_by: string;
}

export function tariffLookup(db: Db) {
  const overrides = new Map(db.all<OverrideRow>('SELECT * FROM tariff_overrides').map((o) => [o.code, o]));
  return (code: string): (TariffLine & { verifiedAt: string | null; verifiedBy?: string }) | undefined => {
    const base = findTariffLine(code);
    if (!base) return undefined;
    const o = overrides.get(base.code);
    return o
      ? { ...base, cetRate: o.cet_rate, note: o.note ?? base.note, verifiedAt: o.verified_at, verifiedBy: o.verified_by }
      : { ...base, verifiedAt: null };
  };
}

export function rulesetVerifiedAt(db: Db, corridorId: string): string | null {
  const corridor = getCorridor(corridorId);
  const row = db.get<{ verified_at: string; ruleset_version: string }>('SELECT verified_at, ruleset_version FROM ruleset_verifications WHERE corridor_id = ?', corridorId);
  // A verification only counts for the rule-set version it was made against.
  return row && row.ruleset_version === corridor.rulesetVersion ? row.verified_at : null;
}

export interface RuleChangeRow {
  id: string;
  corridor_id: string | null;
  effective_from: string;
  title: string;
  description: string;
  hs_prefixes: string;
  source_title: string;
  source_url: string | null;
  created_by: string;
  created_at: string;
}

export function managedChanges(db: Db, corridorId: string): RuleChange[] {
  return db
    .all<RuleChangeRow>('SELECT * FROM rule_changes WHERE corridor_id IS NULL OR corridor_id = ? ORDER BY effective_from', corridorId)
    .map((r) => ({
      id: r.id,
      effectiveFrom: r.effective_from,
      title: r.title,
      description: r.description,
      hsPrefixes: json<string[]>(r.hs_prefixes),
      source: { title: r.source_title, url: r.source_url ?? undefined, lastVerifiedAt: r.created_at },
    }));
}

/** The corridor as validation should see it: static rules + recorded changes. */
export function effectiveCorridor(db: Db, corridorId: string): Corridor {
  const base = getCorridor(corridorId);
  return { ...base, changes: [...base.changes, ...managedChanges(db, corridorId)] };
}

export function validationOptions(db: Db, cfg: Config, corridorId: string): ValidateOptions {
  return { fx: cfg.fx, tariffLookup: tariffLookup(db), rulesetVerifiedAt: rulesetVerifiedAt(db, corridorId) };
}

// ---------------------------------------------------------------- checklist
export type CheckStatus = 'open' | 'confirmed' | 'incorrect' | 'recheck';

export interface ChecklistRow extends ChecklistItem {
  status: CheckStatus;
  note: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
}

export function checklistState(db: Db): { items: ChecklistRow[]; summary: Record<CheckStatus, number> & { total: number } } {
  const checks = new Map(
    db.all<{ key: string; value: string; status: 'confirmed' | 'incorrect'; note: string | null; checked_by: string; checked_at: string }>('SELECT * FROM rule_checks').map((c) => [c.key, c]),
  );
  const lookup = tariffLookup(db);
  const items = buildChecklist().map((item): ChecklistRow => {
    // A verified tariff override changes the value under check.
    const value = item.area === 'tariff' ? String(lookup(item.key.slice(7))?.cetRate ?? item.value) : item.value;
    const claim = item.area === 'tariff' && value !== item.value ? item.claim.replace(/CET rate is [\d.]+%/, `CET rate is ${value}%`) : item.claim;
    const c = checks.get(item.key);
    const status: CheckStatus = !c ? 'open' : c.value !== value ? 'recheck' : c.status;
    return { ...item, value, claim, status, note: c?.note ?? null, checkedBy: c?.checked_by ?? null, checkedAt: c?.checked_at ?? null };
  });
  const summary = { total: items.length, open: 0, confirmed: 0, incorrect: 0, recheck: 0 };
  for (const i of items) summary[i.status]++;
  return { items, summary };
}
