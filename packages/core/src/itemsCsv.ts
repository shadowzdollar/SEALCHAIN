/**
 * Import goods lines from a spreadsheet export. Tolerant of what Excel
 * actually produces in the region: comma or semicolon delimiters (French-locale
 * Excel uses ';'), decimal commas, quoted fields, a UTF-8 BOM, and loose
 * header names ("HS Code", "hs_code", "Tariff", …).
 */
import type { CountryCode, OriginCriterion, QuantityUnit, ShipmentItem } from './types';

export const ITEMS_CSV_TEMPLATE =
  'description,hs_code,quantity,unit,unit_price,net_kg,gross_kg,packages,package_type,marks,origin,criterion,non_originating_pct,processing\n' +
  '"Green arabica coffee beans, fully washed, grade A1",0901.11.00,9600,KG,6.40,9600,9744,160,Jute bags (60 kg),UBWIZA / 1-160,RW,WO,,\n';

type Field = keyof Pick<ShipmentItem, 'description' | 'hsCode' | 'quantity' | 'unit' | 'unitPrice' | 'netWeightKg' | 'grossWeightKg' | 'packageCount' | 'packageType' | 'marks' | 'originCountry' | 'originCriterion' | 'nonOriginatingPct' | 'processingNote'>;

const ALIASES: Record<Field, string[]> = {
  description: ['description', 'goods', 'description of goods', 'product', 'item'],
  hsCode: ['hs', 'hs code', 'hs_code', 'hscode', 'tariff', 'tariff code', 'commodity code'],
  quantity: ['quantity', 'qty'],
  unit: ['unit', 'uom', 'units'],
  unitPrice: ['unit price', 'unit_price', 'price', 'unitprice'],
  netWeightKg: ['net', 'net kg', 'net_kg', 'net weight', 'net weight kg', 'net_weight_kg'],
  grossWeightKg: ['gross', 'gross kg', 'gross_kg', 'gross weight', 'gross weight kg', 'gross_weight_kg'],
  packageCount: ['packages', 'pkgs', 'no of packages', 'number of packages', 'package count', 'package_count'],
  packageType: ['package type', 'package_type', 'packing', 'kind of packages', 'packaging'],
  marks: ['marks', 'marks and numbers', 'marks & numbers'],
  originCountry: ['origin', 'country of origin', 'origin country', 'origin_country'],
  originCriterion: ['criterion', 'origin criterion', 'origin_criterion'],
  nonOriginatingPct: ['non originating pct', 'non_originating_pct', 'non-originating %', 'imported content %', 'imported content'],
  processingNote: ['processing', 'processing note', 'processing_note'],
};

const UNITS: QuantityUnit[] = ['KG', 'T', 'L', 'PCS', 'PR', 'DZN', 'M', 'M2', 'HEAD', 'STEM'];
const COUNTRIES: CountryCode[] = ['RW', 'KE', 'UG', 'TZ', 'BI', 'SS', 'CD', 'SO'];
const COUNTRY_NAMES: Record<string, CountryCode> = { rwanda: 'RW', kenya: 'KE', uganda: 'UG', tanzania: 'TZ', burundi: 'BI', 'south sudan': 'SS', 'dr congo': 'CD', drc: 'CD', somalia: 'SO' };

export interface CsvImportResult {
  items: ShipmentItem[];
  errors: Array<{ row: number; message: string }>;
  unknownColumns: string[];
}

export function parseCsv(text: string): { rows: string[][]; delimiter: string } {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return { rows, delimiter };
}

function toNumber(raw: string, decimalComma: boolean): number | undefined {
  let v = raw.trim().replace(/\s/g, '');
  if (!v) return undefined;
  if (decimalComma) v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function parseItemsCsv(text: string): CsvImportResult {
  const { rows, delimiter } = parseCsv(text);
  const errors: CsvImportResult['errors'] = [];
  if (rows.length < 2) return { items: [], errors: [{ row: 1, message: 'The file needs a header row and at least one line of goods.' }], unknownColumns: [] };

  const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' '));
  const index = new Map<Field, number>();
  const unknownColumns: string[] = [];
  header.forEach((h, i) => {
    const field = (Object.keys(ALIASES) as Field[]).find((f) => ALIASES[f].includes(h));
    if (field && !index.has(field)) index.set(field, i);
    else if (h) unknownColumns.push(rows[0]![i]!.trim());
  });
  if (!index.has('description')) errors.push({ row: 1, message: 'Missing a "description" column.' });
  if (!index.has('quantity')) errors.push({ row: 1, message: 'Missing a "quantity" column.' });
  if (errors.length) return { items: [], errors, unknownColumns };

  const decimalComma = delimiter === ';';
  const items: ShipmentItem[] = [];
  rows.slice(1).forEach((r, k) => {
    const rowNo = k + 2;
    const get = (f: Field) => (index.has(f) ? (r[index.get(f)!] ?? '').trim() : '');
    const num = (f: Field) => {
      const n = toNumber(get(f), decimalComma);
      if (Number.isNaN(n)) errors.push({ row: rowNo, message: `"${get(f)}" in ${f} is not a number.` });
      return n === undefined || Number.isNaN(n) ? 0 : n;
    };
    const unitRaw = get('unit').toUpperCase().replace(/^KGS?$/, 'KG').replace(/^PIECES?$/, 'PCS');
    const unit = (UNITS.includes(unitRaw as QuantityUnit) ? unitRaw : unitRaw ? null : 'KG') as QuantityUnit | null;
    if (!unit) errors.push({ row: rowNo, message: `Unknown unit "${get('unit')}" (use ${UNITS.join(', ')}).` });
    const originRaw = get('originCountry');
    const origin = (COUNTRIES.includes(originRaw.toUpperCase() as CountryCode) ? originRaw.toUpperCase() : COUNTRY_NAMES[originRaw.toLowerCase()] ?? (originRaw ? null : 'RW')) as CountryCode | null;
    if (!origin) errors.push({ row: rowNo, message: `Unknown origin "${originRaw}" (use a 2-letter EAC code such as RW).` });
    const crit = get('originCriterion').toUpperCase();
    const quantity = num('quantity');
    const net = index.has('netWeightKg') ? num('netWeightKg') : unit === 'KG' ? quantity : 0;
    const nonOrig = get('nonOriginatingPct') ? num('nonOriginatingPct') : undefined;
    items.push({
      id: `csv${rowNo}_${Math.random().toString(36).slice(2, 7)}`,
      description: get('description'),
      hsCode: get('hsCode').replace(/\D/g, '').slice(0, 8),
      quantity,
      unit: unit ?? 'KG',
      unitPrice: num('unitPrice'),
      netWeightKg: net,
      grossWeightKg: index.has('grossWeightKg') ? num('grossWeightKg') : 0,
      packageCount: num('packageCount'),
      packageType: get('packageType'),
      marks: get('marks') || undefined,
      originCountry: origin ?? 'RW',
      originCriterion: (crit === 'PSR' ? 'PSR' : 'WO') as OriginCriterion,
      nonOriginatingPct: nonOrig,
      processingNote: get('processingNote') || undefined,
    });
  });
  if (items.length > 200) errors.push({ row: 0, message: 'At most 200 lines per shipment.' });
  return { items: items.slice(0, 200), errors, unknownColumns };
}
