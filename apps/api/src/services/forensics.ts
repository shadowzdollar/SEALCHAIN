/**
 * Layer 3 — fraud-pattern detection for documents received from outside the
 * platform. Combines:
 *
 *   1. Registry check      — is this exact file a SealChain-issued document?
 *   2. Claim check         — does it *claim* to be one (printed number, QR
 *                            URL, metadata) while its bytes differ? If so we
 *                            can say precisely what was changed.
 *   3. Structural checks   — incremental edits, editing-tool producers,
 *                            modification after creation, active content,
 *                            image-only pages.
 *   4. Content checks      — implausible HS codes, future dates, missing
 *                            references (core/forensics).
 *   5. Cross-document      — certificate vs invoice contradictions.
 *   6. Seal comparison     — perceptual hashes of embedded images against
 *                            the organisation's known-genuine seal references.
 *
 * Output is an explained, weighted risk score — advisory, never a verdict.
 */
import zlib from 'node:zlib';
import jpeg from 'jpeg-js';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFDict, PDFArray } from 'pdf-lib';
import {
  contentSignals,
  crossCheck,
  extractFields,
  riskScore,
  type ExtractedFields,
  type Signal,
} from '@sealchain/core';
import type { Db } from '../db';
import { DOC_COLUMNS, sha256, type DocumentRow } from './documents';

// ------------------------------------------------------------- text layer
export interface PdfText {
  pages: string[];
  text: string;
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  const pdf = await task.promise;
  const pages: string[] = [];
  try {
    for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Group glyph runs into visual lines by baseline.
      const rows = new Map<number, Array<{ x: number; s: string }>>();
      for (const item of content.items as Array<{ str: string; transform: number[] }>) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]! / 2) * 2;
        const x = item.transform[4]!;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push({ x, s: item.str });
      }
      const lines = [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim());
      pages.push(lines.join('\n'));
    }
  } finally {
    await task.destroy();
  }
  return { pages, text: pages.join('\n') };
}

// ----------------------------------------------------------- image hashing
interface RawImage {
  width: number;
  height: number;
  gray: Uint8Array;
}

function toGray(data: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (channels === 1) out[i] = data[i]!;
    else out[i] = Math.round(0.299 * data[i * channels]! + 0.587 * data[i * channels + 1]! + 0.114 * data[i * channels + 2]!);
  }
  return out;
}

/** 64-bit difference hash: robust to scaling / recompression, sensitive to shape. */
export function dHash(img: RawImage): string {
  const W = 9;
  const H = 8;
  const cells: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor((x * img.width) / W);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / W));
      const y0 = Math.floor((y * img.height) / H);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / H));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        sum += img.gray[yy * img.width + xx]!;
        n++;
      }
      cells.push(sum / n);
    }
  }
  let bits = 0n;
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) {
    bits = (bits << 1n) | (cells[y * W + x]! > cells[y * W + x + 1]! ? 1n : 0n);
  }
  return bits.toString(16).padStart(16, '0');
}

export function hamming(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Decodes JPEG / PNG / raw PDF image data into grayscale pixels. */
export function decodeImageFile(bytes: Uint8Array): RawImage {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const d = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
    return { width: d.width, height: d.height, gray: toGray(d.data, d.width, d.height, 4) };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    // PNG via pngjs (lazy import keeps startup light)
    const { PNG } = requirePng();
    const p = PNG.sync.read(Buffer.from(bytes));
    return { width: p.width, height: p.height, gray: toGray(p.data, p.width, p.height, 4) };
  }
  throw new Error('Unsupported image format (use PNG or JPEG)');
}

let pngMod: typeof import('pngjs') | undefined;
function requirePng() {
  if (!pngMod) throw new Error('pngjs not loaded');
  return pngMod;
}
export async function loadImageCodecs() {
  pngMod ??= await import('pngjs');
}

async function extractImages(doc: PDFDocument): Promise<RawImage[]> {
  const out: RawImage[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
    const width = (dict.get(PDFName.of('Width')) as PDFNumber | undefined)?.asNumber() ?? 0;
    const height = (dict.get(PDFName.of('Height')) as PDFNumber | undefined)?.asNumber() ?? 0;
    if (width < 32 || height < 32 || width * height > 25_000_000) continue;
    let filter = dict.get(PDFName.of('Filter'));
    if (filter instanceof PDFArray) filter = filter.size() === 1 ? filter.get(0) : undefined;
    try {
      if (filter === PDFName.of('DCTDecode')) {
        const img = decodeImageFile(obj.contents);
        out.push(img);
      } else if (filter === PDFName.of('FlateDecode')) {
        const bpc = (dict.get(PDFName.of('BitsPerComponent')) as PDFNumber | undefined)?.asNumber();
        const cs = dict.get(PDFName.of('ColorSpace'));
        const channels = cs === PDFName.of('DeviceRGB') ? 3 : cs === PDFName.of('DeviceGray') ? 1 : 0;
        const parms = dict.get(PDFName.of('DecodeParms'));
        if (bpc !== 8 || !channels || parms instanceof PDFDict) continue; // skip predictor-encoded
        const raw = zlib.inflateSync(obj.contents);
        if (raw.length < width * height * channels) continue;
        out.push({ width, height, gray: toGray(raw, width, height, channels) });
      }
    } catch {
      /* undecodable image — ignore */
    }
    if (out.length >= 12) break;
  }
  return out;
}

// --------------------------------------------------------------- analysis
const EDITING_TOOLS = /photoshop|gimp|canva|illustrator|inkscape|pixelmator|affinity|photopea|paint\.net|pdfescape|sejda|smallpdf|ilovepdf|pdf-xchange editor|foxit phantom|pdfelement|pdf candy|docfly|pdffiller/i;

export interface AnalysisInput {
  filename: string;
  bytes: Uint8Array;
  companion?: { filename: string; bytes: Uint8Array };
  orgId: string;
}

export interface ChangedLines {
  removed: string[];
  added: string[];
}

export interface AnalysisResult {
  sha256: string;
  filename: string;
  registered: null | { id: string; number: string; kind: string; status: string; version: number };
  claimed: null | { id: string; number: string; kind: string; status: string; issuedSha256: string; changes: ChangedLines | null };
  metadata: Record<string, string | number | null>;
  fields: ExtractedFields;
  signals: Signal[];
  risk: { score: number; level: 'high' | 'medium' | 'low' };
  summary: string;
  /** Normalised certificate number (non-SealChain documents), for cross-platform matching. */
  certNumber: string | null;
}

export function normalizeCertNumber(n: string | undefined): string | null {
  const v = n?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return v && v.length >= 4 ? v : null;
}

export async function analyzeDocument(db: Db, input: AnalysisInput): Promise<AnalysisResult> {
  await loadImageCodecs();
  const hash = sha256(input.bytes);
  const signals: Signal[] = [];

  if (!(input.bytes[0] === 0x25 && input.bytes[1] === 0x50 && input.bytes[2] === 0x44 && input.bytes[3] === 0x46)) {
    throw new Error('Not a PDF file');
  }

  // 1. Registry — exact issued file?
  const registered = db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE sha256 = ?`, hash);
  if (registered) {
    signals.push({
      code: 'REGISTERED',
      level: registered.status === 'active' ? 'pass' : 'medium',
      title: registered.status === 'active' ? 'Exact match with a SealChain-issued document' : `Genuine but ${registered.status}`,
      detail: registered.status === 'active'
        ? `Byte-for-byte identical to ${registered.number}, issued ${registered.issued_at.slice(0, 10)}.`
        : `This is ${registered.number}, which has been ${registered.status}${registered.revoked_reason ? `: ${registered.revoked_reason}` : ''}. Ask for the current version.`,
    });
  }

  // Parse structure + text.
  const raw = Buffer.from(input.bytes).toString('latin1');
  let doc: PDFDocument | undefined;
  try {
    doc = await PDFDocument.load(input.bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  } catch (err) {
    signals.push({ code: 'PDF_UNPARSEABLE', level: 'medium', title: 'Malformed PDF structure', detail: `The file could not be parsed cleanly (${(err as Error).message.slice(0, 120)}).` });
  }
  let text: PdfText = { pages: [], text: '' };
  try {
    text = await extractPdfText(input.bytes);
  } catch {
    signals.push({ code: 'TEXT_UNREADABLE', level: 'low', title: 'Text layer unreadable', detail: 'Could not extract text; content checks were skipped.' });
  }
  const fields = extractFields(text.text);

  const metadata = {
    producer: doc?.getProducer() ?? null,
    creator: doc?.getCreator() ?? null,
    subject: doc?.getSubject() ?? null,
    title: doc?.getTitle() ?? null,
    created: doc?.getCreationDate()?.toISOString() ?? null,
    modified: doc?.getModificationDate()?.toISOString() ?? null,
    pages: doc?.getPageCount() ?? text.pages.length,
    textChars: text.text.length,
    revisions: (raw.match(/%%EOF/g) ?? []).length,
  };

  // 2. Claim — does it say it is a SealChain document?
  let claimed: AnalysisResult['claimed'] = null;
  if (!registered) {
    const metaId = metadata.subject?.match(/\b(doc_[a-z0-9]{16,})\b/)?.[1];
    const claimId = fields.verifyId ?? metaId;
    let target: DocumentRow | undefined;
    if (claimId) target = db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ?`, claimId);
    if (!target && fields.sealchainId) target = db.get<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents WHERE number = ?`, fields.sealchainId);
    if (target) {
      const original = db.get<{ pdf: Uint8Array }>('SELECT pdf FROM documents WHERE id = ?', target.id)!;
      let changes: ChangedLines | null = null;
      try {
        changes = diffLines((await extractPdfText(original.pdf)).text, text.text);
      } catch {
        /* diff is best-effort */
      }
      claimed = { id: target.id, number: target.number, kind: target.kind, status: target.status, issuedSha256: target.sha256, changes };
      const what = changes && (changes.removed.length || changes.added.length)
        ? ` ${changes.removed.length} line(s) of the original were changed or removed.`
        : ' The visible text is unchanged, so the edit is in the file structure, images or metadata.';
      signals.push({
        code: 'ALTERED_AFTER_ISSUANCE',
        level: 'critical',
        title: 'Altered copy of a SealChain document',
        detail: `Presents itself as ${target.number}, but its fingerprint does not match the issued original.${what}`,
      });
    } else if (claimId || fields.sealchainId || /sealchain/i.test(metadata.subject ?? '')) {
      signals.push({
        code: 'FABRICATED_REFERENCE',
        level: 'critical',
        title: 'References a SealChain document that does not exist',
        detail: `The document shows ${fields.sealchainId ?? claimId ?? 'a SealChain reference'}, but no such document was ever issued.`,
      });
    }
  }

  // 2b. Network intelligence: what other SealChain users learned about this
  //     exact file or this certificate number (counts only — never whose).
  const certNumber = registered ? null : normalizeCertNumber(fields.certificateNumber);
  if (!registered) {
    const prior = db.all<{ outcome: string | null }>('SELECT outcome FROM forensic_reports WHERE sha256 = ?', hash);
    const fraud = prior.filter((p) => p.outcome === 'fraud').length;
    if (fraud) {
      signals.push({ code: 'KNOWN_FRAUD', level: 'critical', title: 'Previously reported as fraudulent', detail: `This exact file was checked on SealChain before and reported as fraudulent by ${fraud === 1 ? 'a user' : `${fraud} users`} after investigation.` });
    }
    if (certNumber) {
      const others = db.all<{ sha256: string; first: string; fraud: number }>(
        `SELECT sha256, MIN(created_at) AS first, SUM(CASE WHEN outcome = 'fraud' THEN 1 ELSE 0 END) AS fraud
           FROM forensic_reports WHERE cert_number = ? AND sha256 != ? GROUP BY sha256`,
        certNumber, hash,
      );
      if (others.length) {
        const since = others.map((o) => o.first).sort()[0]!.slice(0, 10);
        signals.push({
          code: 'CONFLICTING_COPIES',
          level: 'high',
          title: 'Different versions of this certificate are circulating',
          detail: `${others.length} other file(s) carrying certificate number ${fields.certificateNumber} — with different content — have been checked on SealChain since ${since}. At most one version can be genuine; confirm with the issuing authority.${others.some((o) => o.fraud) ? ' At least one of them was reported fraudulent.' : ''}`,
        });
      }
    }
  }

  // 3. Structure (skip for exact registered matches — we made those).
  if (!registered) {
    if (metadata.revisions > 1) {
      signals.push({ code: 'INCREMENTAL_UPDATE', level: 'medium', title: 'Edited after it was first saved', detail: `The file contains ${metadata.revisions} revisions (incremental updates). Legitimately signed PDFs can do this, but it is also how content is changed after the fact.` });
    }
    const tool = [metadata.producer, metadata.creator].find((v) => v && EDITING_TOOLS.test(v));
    if (tool) signals.push({ code: 'EDITING_TOOL', level: 'medium', title: 'Produced with an editing tool', detail: `Metadata names "${tool}". Official certificates are rarely produced with image or PDF editors.` });
    if (metadata.created && metadata.modified) {
      const gap = new Date(metadata.modified).getTime() - new Date(metadata.created).getTime();
      if (gap > 5 * 60_000) signals.push({ code: 'MODIFIED_AFTER_CREATION', level: 'low', title: 'Modified after creation', detail: `Created ${metadata.created.slice(0, 16).replace('T', ' ')}, last modified ${metadata.modified.slice(0, 16).replace('T', ' ')}.` });
      if (gap < -60_000) signals.push({ code: 'DATES_INCONSISTENT', level: 'medium', title: 'Inconsistent file dates', detail: 'The modification date is before the creation date — metadata has been manipulated.' });
    }
    if (/\/JavaScript|\/JS\s|\/Launch|\/EmbeddedFile/.test(raw)) {
      signals.push({ code: 'ACTIVE_CONTENT', level: 'medium', title: 'Contains active content', detail: 'The file embeds JavaScript, launch actions or attachments, which trade documents never need.' });
    }
    if (metadata.pages > 0 && metadata.textChars < 40 * metadata.pages) {
      signals.push({ code: 'IMAGE_ONLY', level: 'low', title: 'Image-only document', detail: 'There is little or no machine-readable text (a scan or a flattened image). Content could not be checked, and composites are easiest to make this way.' });
    }
    signals.push(...contentSignals(fields));
  }

  // 5. Cross-document.
  if (input.companion) {
    let companionFields: ExtractedFields | null = null;
    try {
      companionFields = extractFields((await extractPdfText(input.companion.bytes)).text);
    } catch {
      signals.push({ code: 'COMPANION_UNREADABLE', level: 'low', title: 'Companion unreadable', detail: `Could not read ${input.companion.filename}.` });
    }
    if (companionFields) {
      const [cert, other] = fields.kindGuess === 'certificate_of_origin' || companionFields.kindGuess !== 'certificate_of_origin'
        ? [fields, companionFields] : [companionFields, fields];
      signals.push(...crossCheck(cert, other));
    }
  }

  // 6. Seal comparison.
  if (doc && !registered) {
    const refs = db.all<{ authority: string; label: string; dhash: string }>('SELECT authority, label, dhash FROM seal_references WHERE org_id = ?', input.orgId);
    if (refs.length) {
      const images = await extractImages(doc);
      const hashes = images.map(dHash);
      const authority = fields.issuingAuthority?.toLowerCase();
      const relevant = refs.filter((r) => !authority || authority.includes(r.authority.toLowerCase()) || r.authority.toLowerCase().includes(authority));
      const pool = relevant.length ? relevant : refs;
      let best: { ref: (typeof refs)[number]; d: number } | null = null;
      for (const h of hashes) for (const r of pool) {
        const d = hamming(h, r.dhash);
        if (!best || d < best.d) best = { ref: r, d };
      }
      if (!images.length) {
        signals.push({ code: 'NO_SEAL_IMAGE', level: 'low', title: 'No seal image found', detail: 'No embedded stamp or seal image to compare with your known-genuine references.' });
      } else if (best && best.d <= 10) {
        signals.push({ code: 'SEAL_MATCH', level: 'pass', title: 'Seal matches a known reference', detail: `Closest to "${best.ref.label}" (${best.ref.authority}), distance ${best.d}/64.` });
      } else if (relevant.length) {
        signals.push({ code: 'SEAL_MISMATCH', level: 'high', title: 'Seal does not match known references', detail: `None of the ${images.length} embedded image(s) resemble the ${relevant.length} genuine reference seal(s) on file for ${relevant[0]!.authority}.` });
      }
    }
  }

  const risk = registered ? { score: registered.status === 'active' ? 0 : 15, level: registered.status === 'active' ? 'low' as const : 'medium' as const } : riskScore(signals);
  const summary = registered
    ? signals[0]!.detail
    : claimed
      ? `High risk: this is a modified copy of ${claimed.number}. Ask the sender for the original or verify it at the SealChain verification page.`
      : risk.level === 'high'
        ? 'High risk: several independent fabrication signals. Do not rely on this document without confirming with the issuing authority.'
        : risk.level === 'medium'
          ? 'Some warning signs. Confirm the key details with the issuer before relying on it.'
          : 'No strong fabrication signals found. This does not prove authenticity — only documents issued with verifiable anchoring can do that.';

  return {
    sha256: hash,
    filename: input.filename,
    registered: registered ? { id: registered.id, number: registered.number, kind: registered.kind, status: registered.status, version: registered.version } : null,
    claimed,
    metadata,
    fields,
    signals: signals.sort((a, b) => weight(b) - weight(a)),
    risk,
    summary,
    certNumber,
  };
}

function weight(s: Signal) {
  return { critical: 5, high: 4, medium: 3, low: 2, pass: 1 }[s.level];
}

/** Multiset line diff — which lines of the original are missing / new. */
export function diffLines(original: string, presented: string): ChangedLines {
  const norm = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);
  const a = norm(original);
  const b = norm(presented);
  const count = new Map<string, number>();
  for (const l of b) count.set(l, (count.get(l) ?? 0) + 1);
  const removed: string[] = [];
  for (const l of a) {
    const n = count.get(l) ?? 0;
    if (n > 0) count.set(l, n - 1);
    else removed.push(l);
  }
  const countA = new Map<string, number>();
  for (const l of a) countA.set(l, (countA.get(l) ?? 0) + 1);
  const added: string[] = [];
  for (const l of b) {
    const n = countA.get(l) ?? 0;
    if (n > 0) countA.set(l, n - 1);
    else added.push(l);
  }
  return { removed: removed.slice(0, 40), added: added.slice(0, 40) };
}
