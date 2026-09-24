/**
 * Renders the corridor's compliance documents from a single shipment record,
 * so the invoice, certificate of origin and packing list can never disagree
 * with one another. Every page carries a verification footer with a QR code
 * pointing at the public verification page for that exact document.
 */
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import {
  DOCUMENT_KIND_LABEL,
  formatHs,
  formatMoney,
  getCorridor,
  invoiceTotals,
  lineTotal,
  round2,
  type CountryCode,
  type DocumentKind,
  type Shipment,
} from '@sealchain/core';
import { ACCENT, Canvas, FOOTER_H, INK, MARGIN, MUTED, RULE, TINT, cols, safe } from './layout';

export const COUNTRY_NAME: Record<CountryCode, string> = {
  RW: 'Rwanda', KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', BI: 'Burundi', SS: 'South Sudan', CD: 'DR Congo', SO: 'Somalia',
};

const MODE_LABEL = { road: 'Road', air: 'Air', rail: 'Rail', sea: 'Sea', multimodal: 'Multimodal' } as const;

export interface IssueMeta {
  documentId: string;
  number: string;
  version: number;
  issuedAt: string;
  verifyUrl: string;
  issuerOrgName: string;
  supersedesNumber?: string;
}

export const KIND_CODE: Record<DocumentKind, string> = {
  commercial_invoice: 'CI',
  certificate_of_origin: 'CO',
  packing_list: 'PL',
  simplified_certificate_of_origin: 'SC',
};

export async function renderDocument(kind: DocumentKind, s: Shipment, meta: IssueMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const issued = new Date(meta.issuedAt);
  doc.setTitle(`${DOCUMENT_KIND_LABEL[kind]} ${meta.number}`);
  doc.setSubject(`SealChain ${meta.number} ${meta.documentId}`);
  doc.setKeywords(['SealChain', meta.number, meta.documentId, s.corridorId, kind]);
  doc.setAuthor(safe(s.exporter.name));
  doc.setCreator('SealChain');
  doc.setProducer('SealChain document service');
  doc.setCreationDate(issued);
  doc.setModificationDate(issued);

  const qrPng = await QRCode.toBuffer(meta.verifyUrl, { type: 'png', margin: 1, width: 240, errorCorrectionLevel: 'M' });
  const qr = await doc.embedPng(qrPng);

  const c = await Canvas.create(doc);
  switch (kind) {
    case 'commercial_invoice':
      drawInvoice(c, s, meta);
      break;
    case 'certificate_of_origin':
      drawCertificate(c, s, meta);
      break;
    case 'packing_list':
      drawPackingList(c, s, meta);
      break;
    case 'simplified_certificate_of_origin':
      drawSimplified(c, s, meta);
      break;
  }

  // Footers last, once the page count is known.
  c.pages.forEach((page, i) => {
    c.page = page;
    const top = c.height - FOOTER_H;
    c.line(MARGIN, top, c.width - MARGIN, top, { color: RULE });
    c.image(qr, MARGIN, top + 8, 58, 58);
    const x = MARGIN + 68;
    c.text('SEALCHAIN VERIFIED DOCUMENT', x, top + 9, { size: 7, bold: true, color: ACCENT });
    c.text(`Document ${meta.number}  ·  version ${meta.version}  ·  issued ${fmtDateTime(issued)} UTC`, x, top + 20, { size: 7.5 });
    c.text(`Verify authenticity: scan the QR code or visit ${meta.verifyUrl}`, x, top + 31, { size: 7.5, maxWidth: c.width - x - MARGIN - 60 });
    c.text('The SHA-256 fingerprint of this file is anchored on a public blockchain at issuance. Any alteration after issuance makes verification fail.', x, top + 43, { size: 6.5, color: MUTED, maxWidth: c.width - x - MARGIN - 60 });
    c.text(`Page ${i + 1} of ${c.pages.length}`, c.width - MARGIN - 60, top + 9, { size: 7, color: MUTED, maxWidth: 60, align: 'right' });
  });

  return doc.save();
}

// ------------------------------------------------------------ shared parts
function partyLines(p: Shipment['exporter'], taxLabel: string): string[] {
  return [
    p.address,
    `${p.city}, ${COUNTRY_NAME[p.country] ?? p.country}`,
    p.taxId ? `${taxLabel}: ${p.taxId}` : '',
    [p.phone, p.email].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
}

function header(c: Canvas, title: string, subtitle: string, meta: IssueMeta, extra: Array<[string, string]>) {
  const w = c.contentWidth;
  c.rect(MARGIN, c.y, w, 3, { fill: ACCENT });
  c.y += 12;
  c.text(title, MARGIN, c.y, { size: 17, bold: true });
  c.text(subtitle, MARGIN, c.y + 21, { size: 8, color: MUTED, maxWidth: w * 0.55 });
  const rows: Array<[string, string]> = [['Document No.', meta.number], ...extra];
  let yy = c.y;
  const kx = MARGIN + w * 0.58;
  for (const [k, v] of rows) {
    c.text(k, kx, yy, { size: 7.5, color: MUTED });
    const h = c.text(v, kx + 82, yy, { size: 8.5, bold: k === 'Document No.', maxWidth: w * 0.42 - 82 });
    yy += Math.max(11, h);
  }
  c.y = Math.max(c.y + 44, yy) + 8;
  if (meta.supersedesNumber) {
    c.rect(MARGIN, c.y, w, 16, { fill: TINT });
    c.text(`This version replaces document ${meta.supersedesNumber}, which is no longer valid.`, MARGIN + 6, c.y + 4, { size: 7.5, bold: true, color: INK });
    c.y += 22;
  }
}

function shippingRow(c: Canvas, s: Shipment) {
  const w = c.contentWidth;
  const cells: Array<[string, string]> = [
    ['Mode of transport', MODE_LABEL[s.transportMode]],
    ['Place of loading', s.placeOfLoading],
    ['Exit / entry point', [s.exitPoint, s.entryPoint].filter(Boolean).join(' -> ') || '-'],
    ['Final destination', `${s.finalDestination}, ${COUNTRY_NAME[s.consignee.country] ?? s.consignee.country}`],
    ['Vehicle / flight', s.transportRef || '-'],
    ['Departure', s.departureDate ? fmtDate(s.departureDate) : '-'],
  ];
  const cw = w / 3;
  let maxH = 0;
  cells.forEach(([k, v], i) => {
    const x = MARGIN + (i % 3) * cw;
    const top = c.y + Math.floor(i / 3) * 26;
    c.text(k, x + 5, top + 4, { size: 6.5, bold: true, color: MUTED });
    c.text(v, x + 5, top + 13, { size: 8.5, maxWidth: cw - 10 });
    maxH = Math.max(maxH, Math.floor(i / 3) * 26 + 26);
  });
  c.rect(MARGIN, c.y, w, maxH, { stroke: RULE });
  c.y += maxH + 10;
}

function signature(c: Canvas, s: Shipment, meta: IssueMeta, declaration: string) {
  const w = c.contentWidth;
  const h = c.textHeight(declaration, w - 12, { size: 8 }) + 58;
  c.ensure(h);
  c.rect(MARGIN, c.y, w, h, { stroke: RULE });
  c.text(declaration, MARGIN + 6, c.y + 6, { size: 8, maxWidth: w - 12 });
  const top = c.y + h - 34;
  c.line(MARGIN + 6, top + 16, MARGIN + 200, top + 16, { color: INK });
  c.text(`For and on behalf of ${s.exporter.name}`, MARGIN + 6, top + 19, { size: 7, color: MUTED, maxWidth: 260 });
  c.text(`${s.placeOfLoading}, ${fmtDate(meta.issuedAt)}`, MARGIN + w - 200, top + 6, { size: 8.5, maxWidth: 194, align: 'right' });
  c.text('Place and date', MARGIN + w - 200, top + 19, { size: 7, color: MUTED, maxWidth: 194, align: 'right' });
  c.y += h + 8;
}

// ------------------------------------------------------ commercial invoice
function drawInvoice(c: Canvas, s: Shipment, meta: IssueMeta) {
  const corridor = getCorridor(s.corridorId);
  const totals = invoiceTotals(s);
  header(c, 'COMMERCIAL INVOICE', `${corridor.name} · Incoterms® 2020 ${s.incoterm} ${s.incotermPlace}`, meta, [
    ['Invoice No.', s.invoiceNumber],
    ['Invoice date', fmtDate(s.invoiceDate)],
    ['Buyer order ref.', s.buyerOrderRef || '-'],
    ['Currency', s.currency],
  ]);

  const w = c.contentWidth;
  const half = (w - 8) / 2;
  c.y += c.boxRow(c.y, [
    { x: MARGIN, w: half, label: 'SELLER / EXPORTER', body: [{ text: s.exporter.name, bold: true }, ...partyLines(s.exporter, corridor.taxId.exporter.label)] },
    { x: MARGIN + half + 8, w: half, label: 'BUYER / CONSIGNEE', body: [{ text: s.consignee.name, bold: true }, ...partyLines(s.consignee, corridor.taxId.consignee.label)] },
  ]) + 8;
  shippingRow(c, s);

  const columns = cols([
    ['#', 3, 'center'], ['Description of goods', 24], ['HS code', 9], ['Origin', 6, 'center'],
    ['Quantity', 9, 'right'], ['Unit', 5, 'center'], [`Unit price (${s.currency})`, 10, 'right'], [`Amount (${s.currency})`, 11, 'right'],
  ], w);
  c.table(columns, s.items.map((it, i) => [
    String(i + 1),
    it.description,
    formatHs(it.hsCode),
    it.originCountry,
    fmtNum(it.quantity),
    it.unit,
    fmtNum(it.unitPrice, 2),
    fmtNum(lineTotal(it), 2),
  ]), { zebra: true });

  // Totals
  const lines: Array<[string, number, boolean?]> = [['Goods total', totals.goodsTotal]];
  if (totals.freight) lines.push(['Freight', totals.freight]);
  if (totals.insurance) lines.push(['Insurance', totals.insurance]);
  if (totals.otherCharges) lines.push(['Other charges', totals.otherCharges]);
  lines.push([`TOTAL ${s.incoterm} ${s.incotermPlace}`, totals.invoiceTotal, true]);
  c.ensure(lines.length * 14 + 70);
  c.y += 6;
  const tx = MARGIN + w * 0.55;
  for (const [label, amount, strong] of lines) {
    if (strong) c.rect(tx, c.y - 2, w * 0.45, 16, { fill: TINT });
    c.text(label, tx + 6, c.y + 1, { size: strong ? 9 : 8.5, bold: strong });
    c.text(formatMoney(amount, s.currency), tx, c.y + 1, { size: strong ? 9 : 8.5, bold: strong, maxWidth: w * 0.45 - 6, align: 'right' });
    c.y += 15;
  }
  const words = amountInWords(totals.invoiceTotal, s.currency);
  c.y += 2;
  c.y += c.text(`Amount in words: ${words}`, MARGIN, c.y, { size: 8, italic: true, maxWidth: w });

  const pk = packageTotals(s);
  c.y += 4;
  c.y += c.text(`Total packages: ${pk.packages}   ·   Net weight: ${fmtNum(pk.net, 2)} kg   ·   Gross weight: ${fmtNum(pk.gross, 2)} kg`, MARGIN, c.y, { size: 8.5 });
  if (s.paymentTerms) c.y += c.text(`Payment terms: ${s.paymentTerms}`, MARGIN, c.y + 2, { size: 8.5, maxWidth: w }) + 2;
  if (['EXW', 'FCA', 'FAS', 'FOB'].includes(s.incoterm) && (s.freight || s.insurance)) {
    c.y += c.text(`For information (payable by buyer): freight ${formatMoney(s.freight, s.currency)}, insurance ${formatMoney(s.insurance, s.currency)}.`, MARGIN, c.y + 2, { size: 7.5, color: MUTED, maxWidth: w }) + 2;
  }
  c.y += 8;
  const origins = [...new Set(s.items.map((i) => COUNTRY_NAME[i.originCountry] ?? i.originCountry))].join(', ');
  signature(c, s, meta, `We certify that this invoice shows the actual price of the goods described, that all particulars are true and correct, and that the goods are of ${origins} origin.`);
}

// ---------------------------------------------------- certificate of origin
function drawCertificate(c: Canvas, s: Shipment, meta: IssueMeta) {
  const corridor = getCorridor(s.corridorId);
  const w = c.contentWidth;
  c.rect(MARGIN, c.y, w, 3, { fill: ACCENT });
  c.y += 10;
  c.text('EAST AFRICAN COMMUNITY', MARGIN, c.y, { size: 9, bold: true, color: MUTED, maxWidth: w, align: 'center' });
  c.text('CERTIFICATE OF ORIGIN', MARGIN, c.y + 13, { size: 17, bold: true, maxWidth: w, align: 'center' });
  c.text('Issued under the EAC Customs Union (Rules of Origin) Rules', MARGIN, c.y + 34, { size: 8, color: MUTED, maxWidth: w, align: 'center' });
  c.y += 52;
  if (meta.supersedesNumber) {
    c.rect(MARGIN, c.y, w, 16, { fill: TINT });
    c.text(`This certificate replaces ${meta.supersedesNumber}, which is no longer valid.`, MARGIN + 6, c.y + 4, { size: 7.5, bold: true });
    c.y += 22;
  }

  const left = w * 0.58;
  const right = w - left;
  const origins = [...new Set(s.items.map((i) => COUNTRY_NAME[i.originCountry] ?? i.originCountry))];

  const exporterBody = [{ text: s.exporter.name, bold: true }, ...partyLines(s.exporter, corridor.taxId.exporter.label)];
  const consigneeBody = [{ text: s.consignee.name, bold: true }, ...partyLines(s.consignee, corridor.taxId.consignee.label)];
  const certBody = [
    { text: meta.number, bold: true, size: 11 },
    { text: `Country of origin: ${origins.join(', ').toUpperCase()}`, bold: true },
    `Country of destination: ${(COUNTRY_NAME[s.consignee.country] ?? s.consignee.country).toUpperCase()}`,
  ];
  c.y += c.boxRow(c.y, [
    { x: MARGIN, w: left, label: '1. EXPORTER (NAME, ADDRESS, COUNTRY)', body: exporterBody },
    { x: MARGIN + left, w: right, label: '2. CERTIFICATE No.', body: certBody },
  ]);

  const officialBody = [{ text: 'Reserved for the issuing authority', color: MUTED, size: 7.5 }];
  c.y += c.boxRow(c.y, [
    { x: MARGIN, w: left, label: '3. CONSIGNEE (NAME, ADDRESS, COUNTRY)', body: consigneeBody, minHeight: 48 },
    { x: MARGIN + left, w: right, label: '4. FOR OFFICIAL USE', body: officialBody },
  ]);

  const transport = [
    `${MODE_LABEL[s.transportMode]} from ${s.placeOfLoading} to ${s.finalDestination}`,
    [s.exitPoint && `exit ${s.exitPoint}`, s.entryPoint && `entry ${s.entryPoint}`].filter(Boolean).join(', '),
    [s.transportRef && `Vehicle/flight: ${s.transportRef}`, s.departureDate && `Departure: ${fmtDate(s.departureDate)}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
  const invoiceBody = [{ text: s.invoiceNumber, bold: true }, `dated ${fmtDate(s.invoiceDate)}`];
  c.y += c.boxRow(c.y, [
    { x: MARGIN, w: left, label: '5. MEANS OF TRANSPORT AND ROUTE', body: transport },
    { x: MARGIN + left, w: right, label: '6. INVOICE No. AND DATE', body: invoiceBody },
  ]) + 8;

  const columns = cols([
    ['7. Item', 4, 'center'], ['8. Marks and numbers', 13], ['9. Number and kind of packages; description of goods', 30],
    ['10. HS code', 10], ['11. Origin criterion', 9, 'center'], ['12. Gross weight / quantity', 12, 'right'],
  ], w);
  c.table(columns, s.items.map((it, i) => [
    String(i + 1),
    it.marks || 'N/M',
    `${it.packageCount} x ${it.packageType}: ${it.description}`,
    formatHs(it.hsCode),
    it.originCriterion === 'PSR' ? `PSR${it.nonOriginatingPct !== undefined ? ` (${it.nonOriginatingPct}% non-orig.)` : ''}` : 'WO',
    `${fmtNum(it.grossWeightKg, 2)} kg\n${fmtNum(it.quantity)} ${it.unit}`,
  ]), { zebra: true });

  const pk = packageTotals(s);
  c.y += 4;
  c.y += c.text(`Total: ${pk.packages} packages, gross weight ${fmtNum(pk.gross, 2)} kg. ${s.items.length} item(s). No further entries below this line.`, MARGIN, c.y, { size: 8, bold: true, maxWidth: w });
  const psr = s.items.filter((i) => i.originCriterion === 'PSR' && i.processingNote);
  if (psr.length) {
    c.y += 3;
    for (const it of psr) c.y += c.text(`Processing (item ${s.items.indexOf(it) + 1}): ${it.processingNote}`, MARGIN, c.y, { size: 7.5, color: MUTED, maxWidth: w });
  }
  c.y += 3;
  c.y += c.text('Origin criteria: WO = wholly obtained in a Partner State; PSR = sufficiently worked or processed in accordance with the product-specific rule for the heading.', MARGIN, c.y, { size: 7, color: MUTED, maxWidth: w });
  c.y += 8;

  // Declaration + certification side by side.
  const half = (w - 8) / 2;
  const declaration = `The undersigned hereby declares that the above details and statements are correct, that all the goods were produced in ${origins.join(', ')} and that they comply with the origin requirements specified for those goods in the EAC Customs Union (Rules of Origin) Rules for goods exported to ${COUNTRY_NAME[s.consignee.country] ?? s.consignee.country}.`;
  const certification = 'It is hereby certified, on the basis of control carried out, that the declaration by the exporter is correct.';
  const dh = c.textHeight(declaration, half - 12, { size: 7.5 });
  const ch = c.textHeight(certification, half - 12, { size: 7.5 });
  const bh = Math.max(dh, ch) + 78;
  c.ensure(bh);
  c.box(MARGIN, c.y, half, '13. DECLARATION BY THE EXPORTER', [], bh);
  c.text(declaration, MARGIN + 6, c.y + 16, { size: 7.5, maxWidth: half - 12 });
  c.text(`${s.placeOfLoading}, ${fmtDate(meta.issuedAt)}`, MARGIN + 6, c.y + bh - 40, { size: 8.5 });
  c.line(MARGIN + 6, c.y + bh - 16, MARGIN + half - 6, c.y + bh - 16, { color: INK });
  c.text('Place and date; signature of authorised signatory', MARGIN + 6, c.y + bh - 13, { size: 6.5, color: MUTED, maxWidth: half - 12 });

  const ax = MARGIN + half + 8;
  c.box(ax, c.y, half, '14. CERTIFICATION BY THE ISSUING AUTHORITY', [], bh);
  c.text(certification, ax + 6, c.y + 16, { size: 7.5, maxWidth: half - 12 });
  c.text(REQUIREMENT_AUTHORITY(corridor.origin), ax + 6, c.y + 18 + ch, { size: 7, color: MUTED, maxWidth: half - 12 });
  c.line(ax + 6, c.y + bh - 16, ax + half - 6, c.y + bh - 16, { color: INK });
  c.text('Stamp, place, date and signature', ax + 6, c.y + bh - 13, { size: 6.5, color: MUTED, maxWidth: half - 12 });
  c.y += bh + 6;
}

function REQUIREMENT_AUTHORITY(origin: CountryCode): string {
  return origin === 'RW' ? 'Issuing authority: Rwanda Revenue Authority (Customs Services Department)' : 'Issuing authority: designated national authority';
}

// ------------------------------------------- simplified certificate (STR)
function drawSimplified(c: Canvas, s: Shipment, meta: IssueMeta) {
  const corridor = getCorridor(s.corridorId);
  const w = c.contentWidth;
  const totals = invoiceTotals(s);
  c.rect(MARGIN, c.y, w, 3, { fill: ACCENT });
  c.y += 10;
  c.text('EAST AFRICAN COMMUNITY — SIMPLIFIED TRADE REGIME', MARGIN, c.y, { size: 9, bold: true, color: MUTED, maxWidth: w, align: 'center' });
  c.text('SIMPLIFIED CERTIFICATE OF ORIGIN', MARGIN, c.y + 13, { size: 16, bold: true, maxWidth: w, align: 'center' });
  c.text(`For consignments not exceeding USD ${corridor.params.strThresholdUsd.toLocaleString('en-US')} of goods on the EAC Common List`, MARGIN, c.y + 33, { size: 8, color: MUTED, maxWidth: w, align: 'center' });
  c.y += 52;
  if (meta.supersedesNumber) {
    c.rect(MARGIN, c.y, w, 16, { fill: TINT });
    c.text(`This certificate replaces ${meta.supersedesNumber}, which is no longer valid.`, MARGIN + 6, c.y + 4, { size: 7.5, bold: true });
    c.y += 22;
  }
  const half = (w - 8) / 2;
  const origins = [...new Set(s.items.map((i) => COUNTRY_NAME[i.originCountry] ?? i.originCountry))];
  c.y += c.boxRow(c.y, [
    { x: MARGIN, w: half, label: '1. EXPORTER / TRADER', body: [{ text: s.exporter.name, bold: true }, ...partyLines(s.exporter, corridor.taxId.exporter.label)] },
    { x: MARGIN + half + 8, w: half, label: '2. CONSIGNEE', body: [{ text: s.consignee.name, bold: true }, ...partyLines(s.consignee, corridor.taxId.consignee.label)] },
  ]) + 6;
  c.y += c.boxRow(c.y, [
    { x: MARGIN, w: half, label: '3. CERTIFICATE No. / DATE', body: [{ text: meta.number, bold: true }, fmtDate(meta.issuedAt)] },
    { x: MARGIN + half + 8, w: half, label: '4. BORDER POST', body: [[s.exitPoint, s.entryPoint].filter(Boolean).join(' -> ') || '-', `${MODE_LABEL[s.transportMode]}${s.transportRef ? ` · ${s.transportRef}` : ''}`] },
  ]) + 8;

  const columns = cols([
    ['5. Description of goods', 30], ['6. HS code', 10], ['7. Quantity', 10, 'right'], ['8. Value (' + s.currency + ')', 11, 'right'], ['9. Origin', 8, 'center'],
  ], w);
  c.table(columns, s.items.map((it) => [
    `${it.packageCount} x ${it.packageType}: ${it.description}`,
    formatHs(it.hsCode),
    `${fmtNum(it.quantity)} ${it.unit}`,
    fmtNum(lineTotal(it), 2),
    it.originCountry,
  ]), { zebra: true });
  c.y += 4;
  c.y += c.text(`Total value ${formatMoney(totals.goodsTotal, s.currency)} (goods, excluding transport). Invoice ${s.invoiceNumber} of ${fmtDate(s.invoiceDate)}.`, MARGIN, c.y, { size: 8.5, bold: true, maxWidth: w });
  c.y += 3;
  c.y += c.text('Valid only for goods on the EAC Common List of products eligible under the Simplified Trade Regime. Goods not on the list require the full EAC Certificate of Origin.', MARGIN, c.y, { size: 7, color: MUTED, maxWidth: w });
  c.y += 8;

  const declaration = `I declare that the goods described above were produced in ${origins.join(', ')}, that they are eligible for the EAC Simplified Trade Regime, and that the value of this consignment does not exceed USD ${corridor.params.strThresholdUsd.toLocaleString('en-US')}.`;
  const bh = c.textHeight(declaration, half - 12, { size: 7.5 }) + 60;
  c.ensure(bh);
  c.box(MARGIN, c.y, half, '10. DECLARATION BY THE TRADER', [], bh);
  c.text(declaration, MARGIN + 6, c.y + 16, { size: 7.5, maxWidth: half - 12 });
  c.line(MARGIN + 6, c.y + bh - 16, MARGIN + half - 6, c.y + bh - 16, { color: INK });
  c.text('Signature and date', MARGIN + 6, c.y + bh - 13, { size: 6.5, color: MUTED });
  const ax = MARGIN + half + 8;
  c.box(ax, c.y, half, '11. CUSTOMS CERTIFICATION AT THE BORDER', [], bh);
  c.text('Certified that the goods originate in the Partner State stated and qualify under the Simplified Trade Regime.', ax + 6, c.y + 16, { size: 7.5, maxWidth: half - 12 });
  c.line(ax + 6, c.y + bh - 16, ax + half - 6, c.y + bh - 16, { color: INK });
  c.text('Customs stamp, officer and date', ax + 6, c.y + bh - 13, { size: 6.5, color: MUTED });
  c.y += bh + 6;
}

// ------------------------------------------------------------ packing list
function drawPackingList(c: Canvas, s: Shipment, meta: IssueMeta) {
  const corridor = getCorridor(s.corridorId);
  header(c, 'PACKING LIST', `${corridor.name} · accompanies invoice ${s.invoiceNumber}`, meta, [
    ['Invoice No.', s.invoiceNumber],
    ['Invoice date', fmtDate(s.invoiceDate)],
    ['Buyer order ref.', s.buyerOrderRef || '-'],
  ]);
  const w = c.contentWidth;
  const half = (w - 8) / 2;
  const a = [{ text: s.exporter.name, bold: true }, ...partyLines(s.exporter, corridor.taxId.exporter.label)];
  const b = [{ text: s.consignee.name, bold: true }, ...partyLines(s.consignee, corridor.taxId.consignee.label)];
  c.y += c.boxRow(c.y, [
    { x: MARGIN, w: half, label: 'CONSIGNOR / EXPORTER', body: a },
    { x: MARGIN + half + 8, w: half, label: 'CONSIGNEE', body: b },
  ]) + 8;
  shippingRow(c, s);

  const columns = cols([
    ['#', 3, 'center'], ['Marks and numbers', 12], ['Packages', 13], ['Description of goods', 20], ['HS code', 9],
    ['Quantity', 9, 'right'], ['Net (kg)', 8, 'right'], ['Gross (kg)', 8, 'right'],
  ], w);
  c.table(columns, s.items.map((it, i) => [
    String(i + 1),
    it.marks || 'N/M',
    `${it.packageCount} x ${it.packageType}`,
    it.description,
    formatHs(it.hsCode),
    `${fmtNum(it.quantity)} ${it.unit}`,
    fmtNum(it.netWeightKg, 2),
    fmtNum(it.grossWeightKg, 2),
  ]), { zebra: true });

  const pk = packageTotals(s);
  c.ensure(40);
  c.y += 2;
  c.rect(MARGIN, c.y, w, 18, { fill: TINT });
  c.text(`TOTAL: ${pk.packages} packages`, MARGIN + 6, c.y + 5, { size: 9, bold: true });
  c.text(`Net ${fmtNum(pk.net, 2)} kg   ·   Gross ${fmtNum(pk.gross, 2)} kg`, MARGIN, c.y + 5, { size: 9, bold: true, maxWidth: w - 6, align: 'right' });
  c.y += 26;
  c.y += c.text('Average weight per package (kg, net / gross): ' + s.items.map((it, i) => `item ${i + 1}: ${fmtNum(it.netWeightKg / Math.max(1, it.packageCount), 2)} / ${fmtNum(it.grossWeightKg / Math.max(1, it.packageCount), 2)}`).join('; '), MARGIN, c.y, { size: 7.5, color: MUTED, maxWidth: w });
  c.y += 8;
  signature(c, s, meta, 'We certify that the goods described above are packed and marked as shown and that the weights and quantities are correct.');
}

// ---------------------------------------------------------------- helpers
export function packageTotals(s: Shipment) {
  return {
    packages: s.items.reduce((n, i) => n + i.packageCount, 0),
    net: round2(s.items.reduce((n, i) => n + i.netWeightKg, 0)),
    gross: round2(s.items.reduce((n, i) => n + i.grossWeightKg, 0)),
  };
}

function fmtNum(n: number, digits = 0): string {
  const d = Number.isInteger(n) && digits === 0 ? 0 : Math.max(digits, 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 3) });
}

function fmtDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function fmtDateTime(d: Date): string {
  return `${fmtDate(d.toISOString())} ${d.toISOString().slice(11, 16)}`;
}

const CURRENCY_WORDS: Record<string, [string, string]> = {
  USD: ['US dollars', 'cents'], EUR: ['euros', 'cents'], KES: ['Kenya shillings', 'cents'],
  RWF: ['Rwanda francs', 'centimes'], UGX: ['Uganda shillings', 'cents'], TZS: ['Tanzania shillings', 'cents'],
};

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberToWords(n: number): string {
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numberToWords(n % 100)}` : ''}`;
  for (const [size, word] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) {
    if (n >= size) {
      const rest = n % size;
      return `${numberToWords(Math.floor(n / size))} ${word}${rest ? (rest < 100 ? ' and ' : ' ') + numberToWords(rest) : ''}`;
    }
  }
  return String(n);
}

export function amountInWords(amount: number, currency: string): string {
  const [major, minor] = CURRENCY_WORDS[currency] ?? [currency, 'cents'];
  const whole = Math.floor(amount + 1e-9);
  const cents = Math.round((amount - whole) * 100);
  const text = `${numberToWords(whole)} ${major}${cents ? ` and ${numberToWords(cents)} ${minor}` : ''} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What the public verification page may show about a document. */
export function documentSummary(kind: DocumentKind, s: Shipment) {
  const pk = packageTotals(s);
  const base = {
    corridor: getCorridor(s.corridorId).name,
    exporterName: s.exporter.name,
    exporterCountry: s.exporter.country,
    consigneeName: s.consignee.name,
    consigneeCountry: s.consignee.country,
    invoiceNumber: s.invoiceNumber,
    invoiceDate: s.invoiceDate,
    items: s.items.map((i) => ({
      description: i.description,
      hsCode: i.hsCode,
      quantity: i.quantity,
      unit: i.unit,
      grossWeightKg: i.grossWeightKg,
      packageCount: i.packageCount,
      originCountry: i.originCountry,
      originCriterion: i.originCriterion,
    })),
    packages: pk.packages,
    grossWeightKg: pk.gross,
  };
  if (kind === 'commercial_invoice') {
    return { ...base, currency: s.currency, invoiceTotal: invoiceTotals(s).invoiceTotal, incoterm: `${s.incoterm} ${s.incotermPlace}` };
  }
  return base;
}
