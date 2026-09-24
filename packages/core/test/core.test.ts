import { describe, expect, it } from 'vitest';
import {
  CORRIDORS,
  LocalCatalogClassifier,
  anchoredAtCallData,
  buildMerkleTree,
  canonicalJson,
  computeRootFromProof,
  crossCheck,
  demoShipment,
  extractFields,
  formatHs,
  invoiceTotals,
  nameSimilarity,
  riskScore,
  sha256Hex,
  validateShipment,
  verifyMerkleProof,
  parseItemsCsv,
  ITEMS_CSV_TEMPLATE,
} from '../src';

const corridor = CORRIDORS['RW-KE']!;
const codes = (r: ReturnType<typeof validateShipment>) => r.findings.map((f) => f.code);

describe('merkle', () => {
  it('produces verifiable proofs for every leaf at many tree sizes', () => {
    for (let n = 1; n <= 33; n++) {
      const hashes = Array.from({ length: n }, (_, i) => sha256Hex(`doc-${i}`));
      const tree = buildMerkleTree(hashes);
      hashes.forEach((h, i) => {
        expect(verifyMerkleProof(h, tree.proofs[i]!, tree.root)).toBe(true);
      });
    }
  });

  it('rejects a tampered hash or a proof for another leaf', () => {
    const hashes = ['a', 'b', 'c', 'd', 'e'].map((x) => sha256Hex(x));
    const tree = buildMerkleTree(hashes);
    expect(verifyMerkleProof(sha256Hex('x'), tree.proofs[0]!, tree.root)).toBe(false);
    expect(verifyMerkleProof(hashes[1]!, tree.proofs[0]!, tree.root)).toBe(false);
  });

  it('single-leaf root is the domain-separated leaf hash', () => {
    const h = sha256Hex('only');
    const tree = buildMerkleTree([h]);
    expect(tree.proofs[0]).toEqual([]);
    expect(computeRootFromProof(h, [])).toBe(tree.root);
    expect(tree.root).not.toBe(h);
  });

  it('encodes the anchoredAt(bytes32) call', () => {
    const data = anchoredAtCallData('0x' + '11'.repeat(32));
    expect(data).toMatch(/^0x[0-9a-f]{8}(11){32}$/);
  });
});

describe('classifier', () => {
  const c = new LocalCatalogClassifier();
  const top = (q: string) => c.classifySync(q)[0]?.line.code;

  it.each([
    ['Green arabica coffee beans, fully washed', '09011100'],
    ['fresh hass avocados', '08044000'],
    ['coltan concentrate', '26159000'],
    ['cassiterite', '26090000'],
    ['dried kidney beans', '07133300'],
    ['agaseke woven baskets', '46021900'],
    ['black tea bulk CTC', '09024000'],
    ['birds eye chillies', '07096000'],
  ])('%s → %s', (q, code) => {
    expect(top(q)).toBe(code);
  });

  it('accepts a typed HS code', () => {
    expect(c.classifySync('0901.11')[0]?.line.code).toBe('09011100');
  });

  it('returns nothing for gibberish', () => {
    expect(c.classifySync('zzqx vvbn')).toEqual([]);
  });
});

describe('validation', () => {
  it('demo shipment has no errors', () => {
    const r = validateShipment(demoShipment(), corridor);
    expect(r.findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(r.status).toBe('review'); // unverified rule set is a warning
  });

  it('is ready once the rule set is verified', () => {
    const r = validateShipment(demoShipment(), corridor, { rulesetVerifiedAt: new Date().toISOString() });
    expect(r.status).toBe('ready');
  });

  it('computes totals honouring the Incoterm', () => {
    const s = demoShipment();
    const t = invoiceTotals(s);
    expect(t.goodsTotal).toBe(9600 * 6.4 + 400 * 14.5);
    expect(t.invoiceTotal).toBe(t.goodsTotal + 1850); // CPT: seller pays freight
    expect(invoiceTotals({ ...s, incoterm: 'FCA' }).invoiceTotal).toBe(t.goodsTotal);
  });

  it('estimates the duty saved by the certificate of origin', () => {
    const r = validateShipment(demoShipment(), corridor);
    expect(r.duty.withCoo).toBe(0);
    expect(r.duty.withoutCoo).toBeGreaterThan(20000); // 35% of ~USD 69k CIF
    expect(r.duty.savings).toBe(r.duty.withoutCoo);
  });

  it('flags bad tax ids, vague descriptions and weight contradictions', () => {
    const s = demoShipment();
    s.exporter.taxId = '12AB';
    s.consignee.taxId = '123';
    s.items[0]!.description = 'goods';
    s.items[0]!.netWeightKg = 10000;
    const c = codes(validateShipment(s, corridor));
    expect(c).toContain('EXPORTER_TAX_ID_FORMAT');
    expect(c).toContain('CONSIGNEE_TAX_ID_FORMAT');
    expect(c).toContain('ITEM_DESCRIPTION_VAGUE');
    expect(c).toContain('NET_EXCEEDS_GROSS');
    expect(c).toContain('QUANTITY_WEIGHT_MISMATCH');
  });

  it('catches an HS code that contradicts the description', () => {
    const s = demoShipment();
    s.items[0]!.hsCode = '08044000'; // avocados
    const r = validateShipment(s, corridor);
    const f = r.findings.find((x) => x.code === 'HS_DESCRIPTION_MISMATCH');
    expect(f?.message).toContain('0901.11.00');
  });

  it('catches a wrong subheading within the right heading (mango code for avocados)', () => {
    const s = demoShipment();
    s.items = [{ ...s.items[0]!, description: 'Fresh hass avocados, size 16-20, in cartons', hsCode: '08045000' }];
    const f = validateShipment(s, corridor).findings.find((x) => x.code === 'HS_DESCRIPTION_MISMATCH');
    expect(f?.message).toContain('0804.40.00');
  });

  it('flags sea-only Incoterms on road shipments', () => {
    const c = codes(validateShipment(demoShipment({ incoterm: 'FOB' }), corridor));
    expect(c).toContain('INCOTERM_MODE_MISMATCH');
  });

  it('enforces rules-of-origin value content', () => {
    const s = demoShipment();
    Object.assign(s.items[1]!, { originCriterion: 'PSR', nonOriginatingPct: 75, processingNote: 'Roasted' });
    const r = validateShipment(s, corridor);
    expect(codes(r)).toContain('PSR_CONTENT_EXCEEDED');
    expect(r.status).toBe('blocked');
    // a certificate that will fail means the buyer pays duty
    expect(r.duty.withCoo).toBeGreaterThan(0);
  });

  it('rejects non-EAC origin for the certificate', () => {
    const s = demoShipment();
    s.items[0]!.originCountry = 'KE';
    expect(codes(validateShipment(s, corridor))).toContain('ORIGIN_OTHER_PARTNER_STATE');
  });

  it('suggests STR for small consignments', () => {
    const s = demoShipment({ freight: 0 });
    s.items = [{ ...s.items[1]!, quantity: 100, netWeightKg: 100, grossWeightKg: 109, packageCount: 10 }];
    const r = validateShipment(s, corridor);
    expect(r.strEligible).toBe(true);
    expect(codes(r)).toContain('STR_ELIGIBLE');
  });

  it('resolves corridor + product requirements', () => {
    const s = demoShipment();
    const ids = validateShipment(s, corridor).requirements.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['COO_EAC', 'KE_IDF', 'RECTS', 'NAEB_EXPORT', 'PHYTO', 'KEPHIS_PERMIT']));
    const ug = validateShipment({ ...s, corridorId: 'RW-UG', consignee: { ...s.consignee, country: 'UG', taxId: '1000123456' } }, CORRIDORS['RW-UG']!);
    const ugIds = ug.requirements.map((r) => r.id);
    expect(ugIds).toContain('UG_MAAIF_PERMIT');
    expect(ugIds).not.toContain('KEPHIS_PERMIT');
  });

  it('maps requirements to each destination\'s agencies', () => {
    const s = demoShipment();
    const req = (id: string, country: 'TZ' | 'BI', taxId: string) =>
      validateShipment({ ...s, corridorId: id, exitPoint: undefined, entryPoint: undefined, consignee: { ...s.consignee, country, taxId } }, CORRIDORS[id]!);
    const tz = req('RW-TZ', 'TZ', '123456789');
    const tzIds = tz.requirements.map((r) => r.id);
    expect(tzIds).toEqual(expect.arrayContaining(['TZ_IMPORT_ENTRY', 'TZ_PLANT_PERMIT', 'NAEB_EXPORT']));
    expect(tzIds).not.toContain('KEPHIS_PERMIT');
    expect(tzIds).not.toContain('RECTS');
    expect(tz.findings.filter((f) => f.code.startsWith('CONSIGNEE_TAX_ID'))).toEqual([]);
    const bi = req('RW-BI', 'BI', '4000123456');
    expect(bi.requirements.map((r) => r.id)).toEqual(expect.arrayContaining(['BI_IMPORT_ENTRY', 'BI_PLANT_PERMIT']));
    expect(bi.findings.find((f) => f.code === 'CONSIGNEE_COUNTRY_MISMATCH')).toBeUndefined();
  });

  it('warns about stale rule sets', () => {
    const r = validateShipment(demoShipment(), corridor, { rulesetVerifiedAt: '2020-01-01' });
    expect(codes(r)).toContain('RULESET_STALE');
  });
});

describe('forensics', () => {
  const cert = `EAC CERTIFICATE OF ORIGIN
Certificate No: SC-RWKE-CO-2026-00012
Exporter (name, address, country)
Ubwiza Coffee Exporters Ltd, KG 9 Ave, Kigali, Rwanda
Consignee (name, address, country)
Savannah Roasters Ltd, Nairobi, Kenya
1 UBWIZA 160 Jute bags Green coffee 0901.11.00 WO 9744 kg
Invoice No: UCE-INV-2026-0091 dated 2026-09-20
Total gross weight 9,744 kg`;
  const inv = `COMMERCIAL INVOICE
Invoice No: UCE-INV-2026-0091
Date: 2026-09-20
Seller
Ubwiza Coffee Exporters Ltd
Buyer
Savannah Roasters Limited
0901.11.00 Green coffee 9600 KG
Total gross weight 9,744 kg
Invoice total USD 61,440.00`;

  it('extracts fields', () => {
    const f = extractFields(cert);
    expect(f.kindGuess).toBe('certificate_of_origin');
    expect(f.sealchainId).toBe('SC-RWKE-CO-2026-00012');
    expect(f.hsCodes).toEqual(['09011100']);
    expect(f.invoiceNumbers).toEqual(['UCE-INV-2026-0091']);
    expect(f.grossWeightKg).toBe(9744);
    const i = extractFields(inv);
    expect(i.kindGuess).toBe('commercial_invoice');
    expect(i.totalAmount).toBe(61440);
    expect(i.currency).toBe('USD');
  });

  it('cross-checks consistent documents cleanly', () => {
    const s = crossCheck(extractFields(cert), extractFields(inv));
    expect(s.filter((x) => x.level !== 'pass')).toEqual([]);
    expect(riskScore(s).level).toBe('low');
  });

  it('flags contradictions', () => {
    const forged = cert.replace('UCE-INV-2026-0091', 'UCE-INV-2026-0999').replace('0901.11.00', '2615.90.00');
    const s = crossCheck(extractFields(forged), extractFields(inv));
    const c = s.map((x) => x.code);
    expect(c).toContain('XREF_INVOICE_MISMATCH');
    expect(c).toContain('XREF_HS_MISMATCH');
    expect(riskScore(s).level).toBe('high');
  });

  it('name similarity ignores legal suffixes', () => {
    expect(nameSimilarity('Savannah Roasters Ltd', 'SAVANNAH ROASTERS LIMITED')).toBe(1);
    expect(nameSimilarity('Savannah Roasters', 'Kivu Traders')).toBe(0);
  });
});

describe('misc', () => {
  it('formats HS codes', () => {
    expect(formatHs('09011100')).toBe('0901.11.00');
  });
  it('canonical JSON sorts keys and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[2,{"y":2,"z":1}]},"b":1}');
  });
});

describe('items CSV import', () => {
  it('parses the template', () => {
    const r = parseItemsCsv(ITEMS_CSV_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ description: 'Green arabica coffee beans, fully washed, grade A1', hsCode: '09011100', quantity: 9600, unitPrice: 6.4, packageCount: 160, originCountry: 'RW' });
  });

  it('handles French-locale Excel (semicolons, decimal commas, BOM, loose headers)', () => {
    const csv = '﻿Description;HS Code;Qty;Unit;Price;Gross weight (kg);Packages;Packing;Country of origin\r\n"Avocats frais; calibre 16";0804.40.00;4000;kgs;1,90;4 400;1000;Cartons;Rwanda\r\n';
    const r = parseItemsCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.items[0]).toMatchObject({ description: 'Avocats frais; calibre 16', hsCode: '08044000', unit: 'KG', unitPrice: 1.9, grossWeightKg: 4400, netWeightKg: 4000, originCountry: 'RW' });
  });

  it('reports bad rows with row numbers and unknown columns', () => {
    const r = parseItemsCsv('description,quantity,unit,origin,colour\nBeans,abc,BOXES,Mars,red\n');
    expect(r.errors.map((e) => e.row)).toEqual([2, 2, 2]);
    expect(r.unknownColumns).toEqual(['colour']);
  });

  it('requires description and quantity columns', () => {
    expect(parseItemsCsv('hs,price\n0901,5\n').errors[0]!.message).toContain('description');
  });
});
