/**
 * Layer 3 — content-level fraud signals for documents the platform did NOT
 * generate (received from a supplier, broker or counterparty).
 *
 * The API extracts text from an uploaded PDF and runs structural forensics
 * (see apps/api/src/forensics). This module holds the pure, testable parts:
 * pulling key fields out of free text and cross-checking a certificate of
 * origin against the invoice / packing list it claims to correspond to.
 *
 * Signals are advisory. They explain *why* something looks wrong so a human
 * can decide; they never declare a document forged on their own.
 */
import { normalizeHs } from './hs/format';
import { findTariffLine } from './hs/catalog';

export type SignalLevel = 'critical' | 'high' | 'medium' | 'low' | 'pass';

export interface Signal {
  code: string;
  level: SignalLevel;
  title: string;
  detail: string;
}

/** Human-facing document number, e.g. SC-RWKE-CO-2026-00012 (corridor, kind, year, sequence). */
export const SEALCHAIN_NUMBER_RE = /\bSC-[A-Z]{4}-(?:CI|CO|PL|SC)-\d{4}-\d{5,}\b/;

export interface ExtractedFields {
  kindGuess: 'certificate_of_origin' | 'commercial_invoice' | 'packing_list' | 'unknown';
  /** SealChain document number printed on the document. */
  sealchainId?: string;
  /** Public verification id taken from the printed verification URL. */
  verifyId?: string;
  certificateNumber?: string;
  invoiceNumbers: string[];
  exporterName?: string;
  consigneeName?: string;
  hsCodes: string[];
  dates: string[];
  totalAmount?: number;
  currency?: string;
  grossWeightKg?: number;
  packageCount?: number;
  issuingAuthority?: string;
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function num(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** Extracts the value on the same line as, or the line after, a label. */
function labelled(lines: string[], label: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(label);
    if (!m) continue;
    const rest = line.slice((m.index ?? 0) + m[0].length).replace(/^[\s:.\-#]+/, '').trim();
    if (rest) return rest;
    const next = lines[i + 1]?.trim();
    if (next) return next;
  }
  return undefined;
}

export function extractFields(text: string): ExtractedFields {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const flat = lines.join('\n');
  const lower = flat.toLowerCase();

  const kindGuess: ExtractedFields['kindGuess'] = /certificate of origin/.test(lower)
    ? 'certificate_of_origin'
    : /packing list/.test(lower)
      ? 'packing_list'
      : /(commercial )?invoice/.test(lower)
        ? 'commercial_invoice'
        : 'unknown';

  const sealchainId = flat.match(SEALCHAIN_NUMBER_RE)?.[0];
  const verifyId = flat.match(/\/v\/(doc_[a-z0-9]{16,})/)?.[1];

  const hsCodes = [...new Set(
    [...flat.matchAll(/\b(\d{4})[.\s](\d{2})(?:[.\s](\d{2}))?\b/g)]
      .map((m) => `${m[1]}${m[2]}${m[3] ?? '00'}`)
      .filter((c) => Number(c.slice(0, 2)) >= 1 && Number(c.slice(0, 2)) <= 97),
  )];

  const dates = new Set<string>();
  for (const m of flat.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) dates.add(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of flat.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/g)) dates.add(`${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`);
  for (const m of flat.matchAll(/\b(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (20\d{2})\b/gi)) {
    dates.add(`${m[3]}-${MONTHS[m[2]!.toLowerCase().slice(0, 3)]}-${m[1]!.padStart(2, '0')}`);
  }

  const invoiceNumbers = [...new Set(
    [...flat.matchAll(/invoice\s*(?:no\.?|number|#)\s*[:.]?\s*([A-Z0-9][A-Z0-9/\-]{2,})/gi)].map((m) => m[1]!.toUpperCase()),
  )];

  const certificateNumber = flat.match(/certificate\s*(?:no\.?|number)\s*[:.]?\s*([A-Z0-9][A-Z0-9/\-]{3,})/i)?.[1];

  const totalMatch = flat.match(/(?:invoice total|total amount|grand total|total)\s*[:.]?\s*(USD|RWF|KES|UGX|TZS|EUR)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const grossMatch = flat.match(/(?:total )?gross weight[^\d\n]*([\d,]+(?:\.\d+)?)\s*kg/i);
  const pkgMatch = flat.match(/(?:total )?(?:number of )?packages\s*[:.]?\s*(\d+)/i);

  const exporterName = labelled(lines, /\bexporter\b(?: \(name, address, country\))?|\bseller\b|\bconsignor\b/i)?.split(',')[0];
  const consigneeName = labelled(lines, /\bconsignee\b(?: \(name, address, country\))?|\bbuyer\b/i)?.split(',')[0];
  const issuingAuthority = lines.find((l) => /revenue authority|chamber of commerce|customs/i.test(l) && l.length < 90);

  return {
    kindGuess,
    sealchainId,
    verifyId,
    certificateNumber,
    invoiceNumbers,
    exporterName,
    consigneeName,
    hsCodes,
    dates: [...dates].sort(),
    totalAmount: num(totalMatch?.[2]),
    currency: totalMatch?.[1]?.toUpperCase(),
    grossWeightKg: num(grossMatch?.[1]),
    packageCount: num(pkgMatch?.[1]),
    issuingAuthority,
  };
}

/** Token-set similarity of two organisation names, 0..1. */
export function nameSimilarity(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const norm = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/\b(ltd|limited|co|company|plc|sarl|inc|llc|the)\b/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
  const A = norm(a);
  const B = norm(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Content signals within a single document. */
export function contentSignals(f: ExtractedFields, now: Date = new Date()): Signal[] {
  const out: Signal[] = [];
  const today = now.toISOString().slice(0, 10);

  const future = f.dates.filter((d) => d > today);
  if (future.length) {
    out.push({ code: 'FUTURE_DATE', level: 'high', title: 'Date in the future', detail: `The document carries ${future.join(', ')}, which is after today.` });
  }

  const unknown = f.hsCodes.filter((c) => {
    const heading = Number(c.slice(0, 4));
    return heading < 101 || c.slice(2, 4) === '00';
  });
  if (unknown.length) {
    out.push({ code: 'HS_IMPLAUSIBLE', level: 'medium', title: 'Implausible HS codes', detail: `These codes are not valid HS headings: ${unknown.map(fmt).join(', ')}.` });
  }

  if (f.kindGuess === 'certificate_of_origin') {
    if (!f.hsCodes.length) out.push({ code: 'COO_NO_HS', level: 'medium', title: 'No HS codes', detail: 'A certificate of origin normally lists the tariff classification of each item.' });
    if (!f.invoiceNumbers.length) out.push({ code: 'COO_NO_INVOICE_REF', level: 'medium', title: 'No invoice reference', detail: 'The certificate does not reference the commercial invoice it covers.' });
    if (!f.certificateNumber && !f.sealchainId) out.push({ code: 'COO_NO_NUMBER', level: 'medium', title: 'No certificate number', detail: 'Genuine certificates carry a serial number assigned by the issuing authority.' });
  }
  if (f.kindGuess === 'unknown') {
    out.push({ code: 'KIND_UNKNOWN', level: 'low', title: 'Unrecognised document', detail: 'Could not tell what kind of trade document this is; content checks are limited.' });
  }
  const minerals = f.hsCodes.filter((c) => c.startsWith('26') || c.startsWith('7108'));
  if (minerals.length) {
    out.push({ code: 'HIGH_RISK_COMMODITY', level: 'low', title: 'High-risk commodity', detail: `${minerals.map(fmt).join(', ')} (minerals/gold) are frequent targets of origin misdeclaration. Ask for the ICGLR certificate and mine-site traceability.` });
  }
  return out;
}

/**
 * Cross-checks a certificate of origin against the invoice (or packing list)
 * it should correspond to. Contradictions between documents that are meant to
 * describe the same consignment are one of the clearest fabrication signals.
 */
export function crossCheck(certificate: ExtractedFields, invoice: ExtractedFields): Signal[] {
  const out: Signal[] = [];

  if (certificate.invoiceNumbers.length && invoice.invoiceNumbers.length) {
    const overlap = certificate.invoiceNumbers.some((n) => invoice.invoiceNumbers.includes(n));
    out.push(overlap
      ? { code: 'XREF_INVOICE_OK', level: 'pass', title: 'Invoice number matches', detail: `Both documents reference ${certificate.invoiceNumbers.find((n) => invoice.invoiceNumbers.includes(n))}.` }
      : { code: 'XREF_INVOICE_MISMATCH', level: 'high', title: 'Invoice number mismatch', detail: `Certificate references ${certificate.invoiceNumbers.join(', ')} but the invoice is ${invoice.invoiceNumbers.join(', ')}.` });
  }

  for (const [role, a, b] of [
    ['Exporter', certificate.exporterName, invoice.exporterName],
    ['Consignee', certificate.consigneeName, invoice.consigneeName],
  ] as const) {
    if (!a || !b) continue;
    const sim = nameSimilarity(a, b);
    if (sim < 0.5) out.push({ code: `XREF_${role.toUpperCase()}_MISMATCH`, level: 'high', title: `${role} differs`, detail: `"${a}" on the certificate vs "${b}" on the invoice.` });
    else out.push({ code: `XREF_${role.toUpperCase()}_OK`, level: 'pass', title: `${role} matches`, detail: a });
  }

  if (certificate.hsCodes.length && invoice.hsCodes.length) {
    const inv = new Set(invoice.hsCodes.map((c) => c.slice(0, 6)));
    const missing = certificate.hsCodes.filter((c) => !inv.has(c.slice(0, 6)));
    out.push(missing.length
      ? { code: 'XREF_HS_MISMATCH', level: 'high', title: 'HS codes not on invoice', detail: `The certificate covers ${missing.map(fmt).join(', ')} which the invoice does not list.` }
      : { code: 'XREF_HS_OK', level: 'pass', title: 'HS codes consistent', detail: `${certificate.hsCodes.length} code(s) reconcile.` });
  }

  if (certificate.grossWeightKg && invoice.grossWeightKg) {
    const diff = Math.abs(certificate.grossWeightKg - invoice.grossWeightKg) / Math.max(certificate.grossWeightKg, invoice.grossWeightKg);
    out.push(diff > 0.02
      ? { code: 'XREF_WEIGHT_MISMATCH', level: 'medium', title: 'Gross weight differs', detail: `${certificate.grossWeightKg} kg vs ${invoice.grossWeightKg} kg.` }
      : { code: 'XREF_WEIGHT_OK', level: 'pass', title: 'Gross weight consistent', detail: `${certificate.grossWeightKg} kg.` });
  }

  if (certificate.packageCount && invoice.packageCount && certificate.packageCount !== invoice.packageCount) {
    out.push({ code: 'XREF_PACKAGES_MISMATCH', level: 'medium', title: 'Package count differs', detail: `${certificate.packageCount} vs ${invoice.packageCount} packages.` });
  }

  const certDate = certificate.dates[0];
  const invDate = invoice.dates[0];
  if (certDate && invDate && certDate < invDate) {
    out.push({ code: 'XREF_DATE_ORDER', level: 'medium', title: 'Certificate predates invoice', detail: `The certificate is dated ${certDate}, before the invoice (${invDate}).` });
  }
  return out;
}

export function describeHs(code: string): string | undefined {
  return findTariffLine(normalizeHs(code))?.description;
}

function fmt(c: string) {
  return `${c.slice(0, 4)}.${c.slice(4, 6)}`;
}

export const LEVEL_WEIGHT: Record<SignalLevel, number> = { critical: 100, high: 35, medium: 15, low: 5, pass: 0 };

export function riskScore(signals: Signal[]): { score: number; level: 'high' | 'medium' | 'low' } {
  const score = Math.min(100, signals.reduce((s, x) => s + LEVEL_WEIGHT[x.level], 0));
  return { score, level: score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low' };
}
