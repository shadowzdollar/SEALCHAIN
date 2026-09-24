/**
 * The rules checklist: every fact the platform relies on, flattened into
 * individually checkable items for the compliance-research role. Generated
 * from the same data the validation engine uses, so it can never drift from
 * what traders are actually told.
 *
 * Keys are stable ("RW-KE:param:strThresholdUsd", "tariff:09011100") so a
 * confirmation recorded against an item survives releases; `value` is
 * included in the confirmation so a changed value re-opens the item.
 */
import { CATALOG_SOURCE, TARIFF_CATALOG } from './hs/catalog';
import { formatHs } from './hs/format';
import { CORRIDORS, REQUIREMENTS, localizeRequirement, type Corridor } from './corridors';

export type ChecklistArea = 'threshold' | 'tax_id' | 'border' | 'requirement' | 'tariff' | 'rule_change';

export interface ChecklistItem {
  key: string;
  area: ChecklistArea;
  corridorId: string | null;
  subject: string;
  /** The exact claim to confirm, in plain language. */
  claim: string;
  /** Current machine value; a confirmation is only valid for this value. */
  value: string;
  sourceTitle: string;
  sourceUrl?: string;
  /** What to check it against. */
  howToVerify: string;
}

const PARAM_LABEL: Record<keyof Corridor['params'], [string, (v: number) => string, string]> = {
  strThresholdUsd: ['Simplified Trade Regime ceiling', (v) => `Consignments up to USD ${v.toLocaleString()} may use the Simplified Certificate of Origin`, 'EAC STR guidelines / RRA border office'],
  maxNonOriginatingPct: ['Rules of origin value ceiling', (v) => `Goods qualify under PSR if non-originating materials are at most ${v}% of ex-works price (first-pass check)`, 'EAC Rules of Origin 2015, Annex (product-specific rules)'],
  cooMaxAgeDays: ['Certificate age warning', (v) => `Warn when the invoice is older than ${v} days`, 'EAC Rules of Origin (validity of proof of origin)'],
  highValueUsd: ['High-value advisory', (v) => `Advise extra evidence above USD ${v.toLocaleString()}`, 'Internal policy — confirm with clearing agents'],
  staleAfterDays: ['Rule-set freshness', (v) => `Rule set counts as stale ${v} days after verification`, 'Internal policy'],
};

export function buildChecklist(corridors: Corridor[] = Object.values(CORRIDORS)): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  for (const c of corridors) {
    for (const [param, value] of Object.entries(c.params) as Array<[keyof Corridor['params'], number]>) {
      const [subject, claim, how] = PARAM_LABEL[param];
      items.push({ key: `${c.id}:param:${param}`, area: 'threshold', corridorId: c.id, subject: `${c.name}: ${subject}`, claim: claim(value), value: String(value), sourceTitle: how, howToVerify: how });
    }
    for (const role of ['exporter', 'consignee'] as const) {
      const t = c.taxId[role];
      items.push({
        key: `${c.id}:taxid:${role}`, area: 'tax_id', corridorId: c.id, subject: `${c.name}: ${role} ${t.label}`,
        claim: `${t.label} must match /${t.pattern.source}/ (e.g. ${t.example})`, value: t.pattern.source,
        sourceTitle: role === 'exporter' ? 'Rwanda Revenue Authority TIN format' : `${t.label} format`,
        howToVerify: 'Compare against 3–5 real identifiers from current customers',
      });
    }
    for (const [dir, points] of [['exit', c.exitPoints], ['entry', c.entryPoints]] as const) {
      for (const [mode, list] of Object.entries(points)) {
        items.push({
          key: `${c.id}:border:${dir}:${mode}`, area: 'border', corridorId: c.id, subject: `${c.name}: ${mode} ${dir} points`,
          claim: `Usual ${mode} ${dir} points are ${list!.join(', ')}`, value: list!.join('|'),
          sourceTitle: 'Revenue authority customs stations', howToVerify: 'Confirm with a licensed clearing agent on the route',
        });
      }
    }
    const reqIds = new Set<string>([...c.baseRequirements, ...c.roadRequirements]);
    for (const line of TARIFF_CATALOG) for (const r of line.requirements ?? []) reqIds.add(localizeRequirement(c, r));
    reqIds.add(localizeRequirement(c, 'KEBS_STANDARDS'));
    for (const id of reqIds) {
      const r = REQUIREMENTS[id];
      if (!r) continue;
      const when = c.baseRequirements.includes(id) ? 'every shipment' : c.roadRequirements.includes(id) ? 'road shipments' : 'the product lines that trigger it';
      items.push({
        key: `${c.id}:req:${id}`, area: 'requirement', corridorId: c.id, subject: `${c.name}: ${r.title}`,
        claim: `${r.title} is required for ${when}; obtained by the ${r.responsible} from ${r.authority}`,
        value: `${r.title}|${r.authority}|${r.responsible}`, sourceTitle: r.source.title, sourceUrl: r.source.url,
        howToVerify: 'Confirm the document, the issuing body and who is responsible',
      });
    }
    for (const ch of c.changes) {
      items.push({
        key: `${c.id}:change:${ch.id}`, area: 'rule_change', corridorId: c.id, subject: `${c.name}: ${ch.title}`,
        claim: `${ch.description} Effective ${ch.effectiveFrom}.`, value: ch.effectiveFrom,
        sourceTitle: ch.source.title, sourceUrl: ch.source.url, howToVerify: 'Confirm the effective date and scope',
      });
    }
  }

  for (const line of TARIFF_CATALOG) {
    items.push({
      key: `tariff:${line.code}`, area: 'tariff', corridorId: null, subject: `${formatHs(line.code)} ${line.description}`,
      claim: `CET rate is ${line.cetRate}%${line.sensitive ? ' (Sensitive List)' : ''}`, value: String(line.cetRate),
      sourceTitle: CATALOG_SOURCE.title, sourceUrl: CATALOG_SOURCE.url,
      howToVerify: 'Look up the 8-digit line in the gazetted EAC CET (and any stay of application for the destination)',
    });
  }
  return items;
}

export function checklistCsv(rows: Array<ChecklistItem & { status?: string; note?: string | null; checkedBy?: string | null; checkedAt?: string | null }>): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cols = ['key', 'area', 'corridorId', 'subject', 'claim', 'value', 'sourceTitle', 'sourceUrl', 'howToVerify', 'status', 'note', 'checkedBy', 'checkedAt'] as const;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}
