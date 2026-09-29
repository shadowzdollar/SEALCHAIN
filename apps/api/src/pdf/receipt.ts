/** Payment receipt for a settled statement payment. */
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { ACCENT, Canvas, MARGIN, MUTED, RULE } from './layout';

export interface ReceiptData {
  receiptNo: string;
  paidAt: string;
  orgName: string;
  period: string;
  creditCents: number;
  creditCurrency: string;
  amountCharged: number | null;
  currencyCharged: string | null;
  method: string;
  reference: string | null;
  issuer: string;
}

const METHOD: Record<string, string> = { flutterwave: 'Flutterwave', sandbox: 'Test payment (no money moved)', momo: 'MTN MoMo', bank_transfer: 'Bank transfer', cash: 'Cash' };
const TYPE: Record<string, string> = { mobilemoneyrw: 'Mobile money', card: 'Card', test: '' };
function methodLabel(m: string) {
  const [provider, type] = m.split(':');
  return [METHOD[provider!] ?? provider!.replace(/_/g, ' '), type ? TYPE[type] ?? type : ''].filter(Boolean).join(' · ');
}

const money = (cents: number, cur: string) => `${cur} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function renderReceipt(r: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Receipt ${r.receiptNo}`);
  doc.setCreator('SealChain');
  doc.setCreationDate(new Date(r.paidAt));
  const c = await Canvas.create(doc);
  const seal = await doc.embedPng(new Uint8Array(fs.readFileSync(new URL('./assets/sealchain-seal.png', import.meta.url))));
  const w = c.contentWidth;

  c.rect(MARGIN, c.y, w, 3, { fill: ACCENT });
  c.y += 14;
  c.image(seal, MARGIN, c.y, 54, 54);
  c.text('PAYMENT RECEIPT', MARGIN + 66, c.y + 6, { size: 17, bold: true });
  c.text(r.issuer, MARGIN + 66, c.y + 28, { size: 9, color: MUTED });
  c.text(`Receipt No. ${r.receiptNo}`, MARGIN + w * 0.55, c.y + 6, { size: 9, bold: true, maxWidth: w * 0.45, align: 'right' });
  c.text(`Paid ${new Date(r.paidAt).toUTCString().replace(' GMT', ' UTC')}`, MARGIN + w * 0.55, c.y + 20, { size: 8.5, color: MUTED, maxWidth: w * 0.45, align: 'right' });
  c.y += 74;

  const rows: Array<[string, string]> = [
    ['Received from', r.orgName],
    ['For', `SealChain pilot — statement for ${new Date(`${r.period}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`],
    ['Amount credited', money(r.creditCents, r.creditCurrency)],
    ...(r.amountCharged !== null && r.currencyCharged ? [['Amount paid', `${r.currencyCharged} ${r.amountCharged.toLocaleString('en-US')}`] as [string, string]] : []),
    ['Method', methodLabel(r.method)],
    ['Transaction reference', r.reference ?? '—'],
  ];
  for (const [k, v] of rows) {
    c.line(MARGIN, c.y, MARGIN + w, c.y, { color: RULE });
    c.text(k, MARGIN, c.y + 8, { size: 8.5, color: MUTED });
    c.text(v, MARGIN + 150, c.y + 7, { size: 10, bold: k === 'Amount credited', maxWidth: w - 150 });
    c.y += 28;
  }
  c.line(MARGIN, c.y, MARGIN + w, c.y, { color: RULE });
  c.y += 20;
  c.text('This receipt confirms a payment recorded against your SealChain statement. Keep it with your accounting records.', MARGIN, c.y, { size: 8.5, color: MUTED, maxWidth: w });
  return doc.save();
}
