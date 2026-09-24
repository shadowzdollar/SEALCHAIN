/**
 * Pre-submission validation.
 *
 * Catches the mechanical errors that hold consignments at the border while
 * they are still cheap to fix: missing fields, bad tax ids, arithmetic that
 * doesn't add up, weights that contradict each other, vague descriptions,
 * HS codes that don't match the goods, origin claims that can't hold, and
 * Incoterms that don't fit the transport mode. It also resolves which
 * permits/certificates the consignment needs and estimates the duty the
 * Certificate of Origin saves the buyer.
 *
 * Pure function of (shipment, corridor, options) → report, so it runs
 * identically in the API, the browser and tests.
 */
import { LocalCatalogClassifier } from './hs/classifier';
import { CATALOG_SOURCE, findTariffLine, type TariffLine } from './hs/catalog';
import { formatHs, hsChapter, hsHeading } from './hs/format';
import { REQUIREMENTS, localizeRequirement, type Corridor } from './corridors';
import { DEFAULT_FX_PER_USD, invoiceTotals, lineTotal, round2, toUsd, type InvoiceTotals } from './money';
import type { Currency, Finding, Party, Requirement, Shipment, ShipmentItem } from './types';

export const EAC_PARTNER_STATES = ['RW', 'KE', 'UG', 'TZ', 'BI', 'SS', 'CD', 'SO'] as const;

const SEA_ONLY_INCOTERMS = ['FAS', 'FOB', 'CFR', 'CIF'];
const VAGUE_DESCRIPTIONS = /^(goods|various|assorted|misc(ellaneous)?|samples?|general (merchandise|cargo)|items?|products?|stuff|parts|spares)$/i;

/** Chapters where "wholly obtained" is the normal origin claim. */
const RAW_CHAPTERS = new Set([1, 3, 6, 7, 8, 9, 10, 12, 13, 25, 26, 41]);
/** Chapters of manufactured / processed goods subject to standards conformity. */
function isManufactured(ch: number): boolean {
  return (ch >= 15 && ch <= 24) || (ch >= 27 && ch <= 96 && ch !== 41 && ch !== 71);
}

export interface AppliedRequirement extends Requirement {
  triggeredBy: string[];
}

export interface DutyLine {
  itemId: string;
  hsCode: string;
  customsValue: number;
  cetRate: number | null;
  dutyWithoutCoo: number | null;
  dutyWithCoo: number;
}

export interface DutyEstimate {
  currency: Currency;
  lines: DutyLine[];
  withoutCoo: number;
  withCoo: number;
  savings: number;
  /** True when some line's rate is unknown so the total is a lower bound. */
  incomplete: boolean;
}

export type ValidationStatus = 'ready' | 'review' | 'blocked';

export interface ValidationReport {
  status: ValidationStatus;
  corridorId: string;
  rulesetVersion: string;
  findings: Finding[];
  counts: Record<'error' | 'warning' | 'info', number>;
  totals: InvoiceTotals;
  valueUsd: number;
  strEligible: boolean;
  requirements: AppliedRequirement[];
  duty: DutyEstimate;
  checkedAt: string;
}

export interface ValidateOptions {
  now?: Date;
  fx?: Record<Currency, number>;
  /** Compliance-team overrides to the catalog (verified rates, etc.). */
  tariffLookup?: (code: string) => (TariffLine & { verifiedAt?: string | null }) | undefined;
  /** When the corridor rule set was last verified; null = never. */
  rulesetVerifiedAt?: string | null;
}

const classifier = new LocalCatalogClassifier();

export function validateShipment(s: Shipment, corridor: Corridor, opts: ValidateOptions = {}): ValidationReport {
  const now = opts.now ?? new Date();
  const fx = opts.fx ?? DEFAULT_FX_PER_USD;
  const lookup = opts.tariffLookup ?? findTariffLine;
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  // ---------------------------------------------------------------- parties
  checkParty(s.exporter, 'exporter', corridor.origin, corridor.taxId.exporter, add);
  checkParty(s.consignee, 'consignee', corridor.destination, corridor.taxId.consignee, add);

  // --------------------------------------------------------------- header
  if (!s.invoiceNumber?.trim()) {
    add({ code: 'INVOICE_NUMBER_MISSING', severity: 'error', message: 'Invoice number is required and is quoted on the certificate of origin.', path: 'invoiceNumber', documents: ['commercial_invoice', 'certificate_of_origin'] });
  }
  const invoiceDate = parseDate(s.invoiceDate);
  if (!invoiceDate) {
    add({ code: 'INVOICE_DATE_INVALID', severity: 'error', message: 'Invoice date is missing or not a valid date.', path: 'invoiceDate', documents: ['commercial_invoice'] });
  } else if (invoiceDate.getTime() > endOfDay(now).getTime()) {
    add({ code: 'INVOICE_DATE_FUTURE', severity: 'error', message: 'Invoice date is in the future. Customs rejects post-dated invoices.', path: 'invoiceDate', documents: ['commercial_invoice'] });
  } else if (daysBetween(invoiceDate, now) > corridor.params.cooMaxAgeDays) {
    add({ code: 'INVOICE_TOO_OLD', severity: 'warning', message: `Invoice is more than ${corridor.params.cooMaxAgeDays} days old; the certificate of origin may be questioned.`, path: 'invoiceDate' });
  }
  const departure = parseDate(s.departureDate);
  if (departure && invoiceDate && departure < invoiceDate) {
    add({ code: 'DEPARTURE_BEFORE_INVOICE', severity: 'warning', message: 'Departure date is before the invoice date. Check both dates — mismatched dates are a common reason documents are queried.', path: 'departureDate' });
  }

  if (!s.incotermPlace?.trim()) {
    add({ code: 'INCOTERM_PLACE_MISSING', severity: 'error', message: `Incoterm ${s.incoterm} must name a place (e.g. "${s.incoterm} Nairobi").`, path: 'incotermPlace', documents: ['commercial_invoice'] });
  }
  if (SEA_ONLY_INCOTERMS.includes(s.incoterm) && s.transportMode !== 'sea') {
    const alt = ({ FAS: 'FCA', FOB: 'FCA', CFR: 'CPT', CIF: 'CIP' } as Record<string, string>)[s.incoterm];
    add({ code: 'INCOTERM_MODE_MISMATCH', severity: 'warning', message: `${s.incoterm} is a sea/inland-waterway term but this shipment moves by ${s.transportMode}.`, hint: `Use ${alt} instead — it allocates cost and risk correctly for ${s.transportMode} transport.`, path: 'incoterm', documents: ['commercial_invoice'] });
  }
  if (['CIF', 'CIP'].includes(s.incoterm) && !(s.insurance > 0)) {
    add({ code: 'INSURANCE_MISSING', severity: 'warning', message: `${s.incoterm} obliges the seller to insure the goods, but insurance is 0.`, path: 'insurance', documents: ['commercial_invoice'] });
  }
  if (['EXW', 'FCA', 'FAS', 'FOB'].includes(s.incoterm) && (s.freight > 0 || s.insurance > 0)) {
    add({ code: 'CHARGES_NOT_ON_INVOICE', severity: 'info', message: `Under ${s.incoterm} the buyer pays main carriage, so freight/insurance are shown for reference but not added to the invoice total.`, path: 'freight' });
  }
  if (s.freight < 0 || s.insurance < 0 || s.otherCharges < 0) {
    add({ code: 'NEGATIVE_CHARGES', severity: 'error', message: 'Freight, insurance and other charges cannot be negative.', path: 'freight' });
  }

  const exits = corridor.exitPoints[s.transportMode] ?? [];
  const entries = corridor.entryPoints[s.transportMode] ?? [];
  if (s.transportMode === 'road' || s.transportMode === 'air') {
    if (!s.exitPoint) add({ code: 'EXIT_POINT_MISSING', severity: 'warning', message: `Name the exit point (e.g. ${exits.join(' / ')}).`, path: 'exitPoint', documents: ['certificate_of_origin'] });
    else if (exits.length && !exits.includes(s.exitPoint)) add({ code: 'EXIT_POINT_UNUSUAL', severity: 'info', message: `${s.exitPoint} is not a usual ${s.transportMode} exit on ${corridor.name} (expected ${exits.join(', ')}).`, path: 'exitPoint' });
    if (!s.entryPoint) add({ code: 'ENTRY_POINT_MISSING', severity: 'warning', message: `Name the entry point (e.g. ${entries.join(' / ')}).`, path: 'entryPoint', documents: ['certificate_of_origin'] });
    else if (entries.length && !entries.includes(s.entryPoint)) add({ code: 'ENTRY_POINT_UNUSUAL', severity: 'info', message: `${s.entryPoint} is not a usual ${s.transportMode} entry on ${corridor.name} (expected ${entries.join(', ')}).`, path: 'entryPoint' });
  }
  if (!s.transportRef?.trim()) {
    add({ code: 'TRANSPORT_REF_MISSING', severity: 'info', message: 'Add the truck registration / flight / AWB number once known — it appears in the certificate’s transport particulars.', path: 'transportRef', documents: ['certificate_of_origin'] });
  }

  // ------------------------------------------------------------------ items
  if (!s.items.length) {
    add({ code: 'NO_ITEMS', severity: 'error', message: 'Add at least one line item.', path: 'items' });
  }
  const seenCatalogUnverified = new Set<string>();
  s.items.forEach((item, i) => checkItem(item, i, s, corridor, lookup, add, seenCatalogUnverified));

  // ----------------------------------------------------------------- totals
  const totals = invoiceTotals(s);
  const valueUsd = round2(toUsd(totals.invoiceTotal, s.currency, fx));
  if (s.items.length && totals.goodsTotal <= 0) {
    add({ code: 'ZERO_VALUE', severity: 'error', message: 'The goods total is zero. Customs requires a transaction value even for samples.', path: 'items' });
  }
  const strEligible = valueUsd > 0 && valueUsd <= corridor.params.strThresholdUsd;
  if (strEligible) {
    add({ code: 'STR_ELIGIBLE', severity: 'info', message: `Consignment value ≈ USD ${valueUsd.toLocaleString()} is within the EAC Simplified Trade Regime ceiling (USD ${corridor.params.strThresholdUsd.toLocaleString()}). If the goods are on the EAC common list you can use a Simplified Certificate of Origin at the border instead of the full certificate.`, source: REQUIREMENTS.COO_SIMPLIFIED!.source });
  }
  if (valueUsd > corridor.params.highValueUsd) {
    add({ code: 'HIGH_VALUE', severity: 'info', message: `Declared value ≈ USD ${valueUsd.toLocaleString()}. Keep the sales contract and proof of payment ready — high-value consignments are more likely to be selected for documentary checks.` });
  }

  // ------------------------------------------------------ rule-set freshness
  const verifiedAt = opts.rulesetVerifiedAt === undefined ? null : opts.rulesetVerifiedAt;
  const verifiedDate = parseDate(verifiedAt ?? undefined);
  if (!verifiedDate) {
    add({ code: 'RULESET_UNVERIFIED', severity: 'warning', message: `The ${corridor.name} rule set (v${corridor.rulesetVersion}) has not yet been confirmed by the compliance team. Treat requirements and rates as guidance and confirm with your clearing agent.` });
  } else if (daysBetween(verifiedDate, now) > corridor.params.staleAfterDays) {
    add({ code: 'RULESET_STALE', severity: 'warning', message: `The ${corridor.name} rule set was last verified ${daysBetween(verifiedDate, now)} days ago. Regulations may have changed since.` });
  }
  for (const change of corridor.changes) {
    const eff = parseDate(change.effectiveFrom);
    if (!eff) continue;
    const age = daysBetween(eff, now);
    const affects = change.hsPrefixes.length === 0 || s.items.some((it) => change.hsPrefixes.some((p) => it.hsCode.startsWith(p)));
    if (affects && age >= -30 && age <= 60) {
      add({ code: 'RECENT_RULE_CHANGE', severity: 'warning', message: `${age < 0 ? 'Upcoming' : 'Recent'} change (${change.effectiveFrom}): ${change.title}. ${change.description}`, source: change.source });
    }
  }

  const requirements = resolveRequirements(s, corridor, lookup);
  const duty = estimateDuty(s, lookup, findings);

  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  const status: ValidationStatus = counts.error > 0 ? 'blocked' : counts.warning > 0 ? 'review' : 'ready';

  return {
    status,
    corridorId: corridor.id,
    rulesetVersion: corridor.rulesetVersion,
    findings: findings.sort((a, b) => sevRank(a.severity) - sevRank(b.severity)),
    counts,
    totals,
    valueUsd,
    strEligible,
    requirements,
    duty,
    checkedAt: now.toISOString(),
  };
}

function checkParty(
  p: Party | undefined,
  role: 'exporter' | 'consignee',
  expectedCountry: string,
  taxId: { pattern: RegExp; label: string; example: string },
  add: (f: Finding) => void,
) {
  const docs = ['commercial_invoice', 'certificate_of_origin', 'packing_list'] as const;
  if (!p) {
    add({ code: `${role.toUpperCase()}_MISSING`, severity: 'error', message: `The ${role} is required.`, path: role, documents: [...docs] });
    return;
  }
  for (const field of ['name', 'address', 'city'] as const) {
    if (!p[field]?.trim()) {
      add({ code: `${role.toUpperCase()}_${field.toUpperCase()}_MISSING`, severity: 'error', message: `The ${role}'s ${field} is required on every document.`, path: `${role}.${field}`, documents: [...docs] });
    }
  }
  if (p.country !== expectedCountry) {
    add({ code: `${role.toUpperCase()}_COUNTRY_MISMATCH`, severity: 'error', message: `The ${role} must be in ${expectedCountry} for this corridor (found ${p.country}).`, path: `${role}.country` });
  }
  if (!p.taxId?.trim()) {
    add({ code: `${role.toUpperCase()}_TAX_ID_MISSING`, severity: role === 'exporter' ? 'error' : 'warning', message: `${taxId.label} for the ${role} is missing.`, hint: `Format: ${taxId.example}`, path: `${role}.taxId` });
  } else if (!taxId.pattern.test(p.taxId.replace(/\s/g, '').toUpperCase())) {
    add({ code: `${role.toUpperCase()}_TAX_ID_FORMAT`, severity: 'error', message: `"${p.taxId}" does not look like a valid ${taxId.label}.`, hint: `Expected format: ${taxId.example}`, path: `${role}.taxId` });
  }
}

function checkItem(
  item: ShipmentItem,
  i: number,
  s: Shipment,
  corridor: Corridor,
  lookup: NonNullable<ValidateOptions['tariffLookup']>,
  add: (f: Finding) => void,
  seenUnverified: Set<string>,
) {
  const at = (field: string) => `items[${i}].${field}`;
  const label = `Line ${i + 1}${item.description ? ` (${truncate(item.description, 30)})` : ''}`;
  const desc = item.description?.trim() ?? '';

  if (!desc) {
    add({ code: 'ITEM_DESCRIPTION_MISSING', severity: 'error', message: `${label}: description is required.`, path: at('description') });
  } else if (VAGUE_DESCRIPTIONS.test(desc) || desc.split(/\s+/).length < 2) {
    add({ code: 'ITEM_DESCRIPTION_VAGUE', severity: 'error', message: `${label}: "${desc}" is too vague. Customs requires a description specific enough to confirm the HS code.`, hint: 'Say what the goods are, what they are made of and their state, e.g. "Green arabica coffee beans, fully washed, grade A".', path: at('description'), documents: ['commercial_invoice', 'certificate_of_origin'] });
  }

  const code = item.hsCode?.replace(/\D/g, '') ?? '';
  let line: ReturnType<typeof lookup>;
  if (code.length !== 8) {
    add({ code: 'HS_FORMAT', severity: 'error', message: `${label}: HS code must have 8 digits in the EAC CET (got "${item.hsCode || '—'}").`, path: at('hsCode'), documents: ['commercial_invoice', 'certificate_of_origin'] });
  } else {
    line = lookup(code);
    if (!line) {
      add({ code: 'HS_NOT_IN_CATALOG', severity: 'warning', message: `${label}: ${formatHs(code)} is not in the platform's verified tariff catalog, so its duty rate and permit requirements could not be checked.`, path: at('hsCode') });
    } else {
      if (!line.verifiedAt && !seenUnverified.has('catalog')) {
        seenUnverified.add('catalog');
        add({ code: 'TARIFF_RATE_INDICATIVE', severity: 'info', message: 'Duty rates shown are indicative until confirmed by the compliance team.', source: CATALOG_SOURCE });
      }
      if (desc) {
        const suggestions = classifier.classifySync(desc, 5);
        const top = suggestions[0];
        // Accept if a reasonably strong suggestion shares the 6-digit subheading;
        // otherwise flag when the classifier is confident, or nothing even shares the heading.
        const sameSub = suggestions.some((sg) => sg.line.code.slice(0, 6) === code.slice(0, 6) && sg.score >= (top?.score ?? 0) * 0.5);
        const sameHeading = suggestions.some((sg) => hsHeading(sg.line.code) === hsHeading(code));
        const plausible = !top || sameSub || (top.confidence !== 'high' && sameHeading);
        if (!plausible) {
          const best = suggestions[0]!;
          add({ code: 'HS_DESCRIPTION_MISMATCH', severity: 'warning', message: `${label}: the description does not look like ${formatHs(code)} (${line.description}). It reads more like ${formatHs(best.line.code)} — ${best.line.description}.`, hint: 'A code that does not match the description is the most common reason for reclassification and delay.', path: at('hsCode'), documents: ['commercial_invoice', 'certificate_of_origin'] });
        }
      }
      if (line.sensitive) {
        add({ code: 'SENSITIVE_ITEM', severity: 'info', message: `${label}: ${formatHs(code)} is on the EAC Sensitive List (CET ${line.cetRate}%). The certificate of origin is what keeps the buyer's duty at 0% — make sure it is presented at entry.`, path: at('hsCode') });
      }
      if (line.note && !line.sensitive) {
        add({ code: 'TARIFF_NOTE', severity: 'info', message: `${label}: ${line.note}`, path: at('hsCode') });
      }
    }
  }

  if (!(item.quantity > 0)) add({ code: 'QUANTITY_INVALID', severity: 'error', message: `${label}: quantity must be greater than zero.`, path: at('quantity') });
  if (!(item.unitPrice >= 0)) add({ code: 'UNIT_PRICE_INVALID', severity: 'error', message: `${label}: unit price cannot be negative.`, path: at('unitPrice') });
  else if (item.unitPrice === 0) add({ code: 'UNIT_PRICE_ZERO', severity: 'warning', message: `${label}: unit price is zero. Even free samples need a value for customs.`, path: at('unitPrice') });

  if (!(item.grossWeightKg > 0)) {
    add({ code: 'GROSS_WEIGHT_MISSING', severity: 'error', message: `${label}: gross weight is required on the packing list and certificate of origin.`, path: at('grossWeightKg'), documents: ['packing_list', 'certificate_of_origin'] });
  }
  if (!(item.netWeightKg > 0)) {
    add({ code: 'NET_WEIGHT_MISSING', severity: 'error', message: `${label}: net weight is required.`, path: at('netWeightKg'), documents: ['packing_list'] });
  }
  if (item.netWeightKg > item.grossWeightKg + 1e-9) {
    add({ code: 'NET_EXCEEDS_GROSS', severity: 'error', message: `${label}: net weight (${item.netWeightKg} kg) exceeds gross weight (${item.grossWeightKg} kg).`, path: at('netWeightKg'), documents: ['packing_list'] });
  } else if (item.netWeightKg > 0 && item.grossWeightKg / item.netWeightKg > 1.5) {
    add({ code: 'PACKAGING_WEIGHT_HIGH', severity: 'warning', message: `${label}: packaging adds ${Math.round((item.grossWeightKg / item.netWeightKg - 1) * 100)}% to the net weight. Check the weights — officers compare them against the weighbridge.`, path: at('grossWeightKg') });
  }
  if ((item.unit === 'KG' && Math.abs(item.quantity - item.netWeightKg) > 0.01) || (item.unit === 'T' && Math.abs(item.quantity * 1000 - item.netWeightKg) > 1)) {
    add({ code: 'QUANTITY_WEIGHT_MISMATCH', severity: 'error', message: `${label}: quantity is ${item.quantity} ${item.unit} but net weight is ${item.netWeightKg} kg. The invoice and packing list will contradict each other.`, path: at('quantity'), documents: ['commercial_invoice', 'packing_list'] });
  }
  if (!(item.packageCount >= 1) || !Number.isInteger(item.packageCount)) {
    add({ code: 'PACKAGE_COUNT_INVALID', severity: 'error', message: `${label}: number of packages must be a whole number of at least 1.`, path: at('packageCount'), documents: ['packing_list', 'certificate_of_origin'] });
  }
  if (!item.packageType?.trim()) {
    add({ code: 'PACKAGE_TYPE_MISSING', severity: 'error', message: `${label}: kind of packages (bags, cartons, pallets…) is required.`, path: at('packageType'), documents: ['packing_list', 'certificate_of_origin'] });
  }

  // ------------------------------------------------------------- origin
  const eac = (EAC_PARTNER_STATES as readonly string[]).includes(item.originCountry);
  if (!eac) {
    add({ code: 'ORIGIN_NOT_EAC', severity: 'error', message: `${label}: goods originating in ${item.originCountry} do not qualify for an EAC Certificate of Origin; the buyer will pay the full CET rate.`, path: at('originCountry'), documents: ['certificate_of_origin'] });
  } else if (item.originCountry !== corridor.origin) {
    add({ code: 'ORIGIN_OTHER_PARTNER_STATE', severity: 'warning', message: `${label}: goods originate in ${item.originCountry}, not ${corridor.origin}. Re-exported EAC goods should travel on the certificate issued in the country of origin.`, path: at('originCountry') });
  }

  const ch = code.length >= 2 ? hsChapter(code) : 0;
  if (item.originCriterion === 'PSR') {
    if (item.nonOriginatingPct === undefined || item.nonOriginatingPct === null || Number.isNaN(item.nonOriginatingPct)) {
      add({ code: 'PSR_CONTENT_MISSING', severity: 'error', message: `${label}: state the share of non-originating (imported) materials to support the processing claim.`, path: at('nonOriginatingPct'), documents: ['certificate_of_origin'] });
    } else if (item.nonOriginatingPct > corridor.params.maxNonOriginatingPct) {
      add({ code: 'PSR_CONTENT_EXCEEDED', severity: 'error', message: `${label}: non-originating materials are ${item.nonOriginatingPct}% of the ex-works price, above the ${corridor.params.maxNonOriginatingPct}% ceiling. The goods are unlikely to qualify as EAC-originating.`, hint: 'Check the product-specific rule for this heading — some headings allow a change of tariff heading instead of a value test.', path: at('nonOriginatingPct'), documents: ['certificate_of_origin'] });
    }
    if (!item.processingNote?.trim()) {
      add({ code: 'PSR_PROCESSING_MISSING', severity: 'warning', message: `${label}: describe the processing done in ${corridor.origin} (e.g. "roasted and ground from imported green beans") — issuing authorities ask for it.`, path: at('processingNote'), documents: ['certificate_of_origin'] });
    }
    if (RAW_CHAPTERS.has(ch)) {
      add({ code: 'PSR_ON_RAW_PRODUCT', severity: 'info', message: `${label}: raw agricultural/mineral products are normally claimed as wholly obtained (WO). Use PSR only if imported materials were used.`, path: at('originCriterion') });
    }
  } else if (item.originCriterion === 'WO' && ch && isManufactured(ch)) {
    add({ code: 'WO_ON_MANUFACTURED', severity: 'warning', message: `${label}: "wholly obtained" is unusual for manufactured goods (chapter ${ch}). If any imported input was used, the claim must be PSR — a wrong criterion invalidates the certificate.`, path: at('originCriterion'), documents: ['certificate_of_origin'] });
  }

  if (ch === 26 || code.startsWith('7108')) {
    add({ code: 'MINERALS_TRACEABILITY', severity: 'info', message: `${label}: 3T minerals and gold are high-risk for origin fraud. Keep mine-site traceability and the ICGLR certificate with the consignment; buyers and banks will ask.`, path: at('hsCode') });
  }

  void s;
}

export function resolveRequirements(
  s: Shipment,
  corridor: Corridor,
  lookup: NonNullable<ValidateOptions['tariffLookup']> = findTariffLine,
): AppliedRequirement[] {
  const map = new Map<string, AppliedRequirement>();
  const addReq = (id: string, trigger: string) => {
    const localId = localizeRequirement(corridor, id);
    const req = REQUIREMENTS[localId];
    if (!req) return;
    const existing = map.get(localId);
    if (existing) {
      if (!existing.triggeredBy.includes(trigger)) existing.triggeredBy.push(trigger);
    } else {
      map.set(localId, { ...req, triggeredBy: [trigger] });
    }
  };
  for (const id of corridor.baseRequirements) addReq(id, corridor.name);
  if (s.transportMode === 'road') for (const id of corridor.roadRequirements) addReq(id, 'Road transport');
  for (const item of s.items) {
    const line = lookup(item.hsCode);
    const name = truncate(item.description || formatHs(item.hsCode), 40);
    for (const id of line?.requirements ?? []) addReq(id, name);
    const ch = hsChapter(item.hsCode);
    if (ch && isManufactured(ch)) addReq('KEBS_STANDARDS', name);
  }
  return [...map.values()];
}

function estimateDuty(
  s: Shipment,
  lookup: NonNullable<ValidateOptions['tariffLookup']>,
  findings: Finding[],
): DutyEstimate {
  // Destination customs values goods on a CIF basis, so apportion the actual
  // freight and insurance across lines by value regardless of the Incoterm.
  const goods = s.items.reduce((sum, i) => sum + lineTotal(i), 0);
  const extra = Math.max(0, s.freight) + Math.max(0, s.insurance);
  const cooValid = !findings.some((f) => f.severity === 'error' && f.documents?.includes('certificate_of_origin'));
  let incomplete = false;
  const lines: DutyLine[] = s.items.map((item) => {
    const lt = lineTotal(item);
    const customsValue = round2(lt + (goods > 0 ? (extra * lt) / goods : 0));
    const line = lookup(item.hsCode);
    const rate = line?.cetRate ?? null;
    if (rate === null) incomplete = true;
    const without = rate === null ? null : round2((customsValue * rate) / 100);
    const eac = (EAC_PARTNER_STATES as readonly string[]).includes(item.originCountry);
    return {
      itemId: item.id,
      hsCode: item.hsCode,
      customsValue,
      cetRate: rate,
      dutyWithoutCoo: without,
      dutyWithCoo: eac && cooValid ? 0 : (without ?? 0),
    };
  });
  const withoutCoo = round2(lines.reduce((sum, l) => sum + (l.dutyWithoutCoo ?? 0), 0));
  const withCoo = round2(lines.reduce((sum, l) => sum + l.dutyWithCoo, 0));
  return { currency: s.currency, lines, withoutCoo, withCoo, savings: round2(withoutCoo - withCoo), incomplete };
}

// ---------------------------------------------------------------- helpers
function sevRank(s: Finding['severity']): number {
  return s === 'error' ? 0 : s === 'warning' ? 1 : 2;
}

function parseDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setUTCHours(23, 59, 59, 999);
  return e;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
