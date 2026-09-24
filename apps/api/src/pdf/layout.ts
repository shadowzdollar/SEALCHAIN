/**
 * Tiny layout toolkit over pdf-lib: top-down coordinates, word wrapping,
 * numbered form boxes, and tables that break across pages.
 */
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib';

export const A4: [number, number] = [595.28, 841.89];
export const MARGIN = 36;
export const FOOTER_H = 74;

export const INK = rgb(0.1, 0.12, 0.16);
export const MUTED = rgb(0.4, 0.43, 0.48);
export const RULE = rgb(0.72, 0.74, 0.78);
export const TINT = rgb(0.95, 0.96, 0.97);
export const ACCENT = rgb(0.043, 0.122, 0.227); // navy #0B1F3A

/** Standard PDF fonts only cover WinAnsi; map everything else to safe ASCII. */
const REPLACEMENTS: Record<string, string> = {
  '→': '->', '←': '<-', '≤': '<=', '≥': '>=', '≈': '~', '✓': 'v', '✔': 'v', '✗': 'x',
  ' ': ' ', ' ': ' ', ' ': ' ', '−': '-', '‑': '-',
};
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

export function safe(input: string | undefined | null): string {
  if (!input) return '';
  let out = '';
  for (const ch of input.normalize('NFC')) {
    const r = REPLACEMENTS[ch];
    if (r !== undefined) out += r;
    else {
      const c = ch.codePointAt(0)!;
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.has(ch)) out += ch;
      else if (ch === '\n' || ch === '\t') out += ' ';
      else out += '?';
    }
  }
  return out;
}

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  oblique: PDFFont;
}

export interface TextOpts {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: RGB;
  maxWidth?: number;
  align?: 'left' | 'right' | 'center';
  lineGap?: number;
}

export type BoxBody = Array<string | { text: string; bold?: boolean; size?: number; color?: RGB }>;

export interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export class Canvas {
  page!: PDFPage;
  pages: PDFPage[] = [];
  /** Distance from the top of the page. */
  y = MARGIN;

  private constructor(readonly doc: PDFDocument, readonly fonts: Fonts, private onNewPage?: (c: Canvas) => void) {}

  static async create(doc: PDFDocument, onNewPage?: (c: Canvas) => void): Promise<Canvas> {
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
    };
    const c = new Canvas(doc, fonts, onNewPage);
    c.addPage();
    return c;
  }

  get width() {
    return A4[0];
  }
  get height() {
    return A4[1];
  }
  get contentWidth() {
    return A4[0] - MARGIN * 2;
  }
  /** Lowest y (from top) content may reach before the footer. */
  get limit() {
    return A4[1] - FOOTER_H - 8;
  }

  addPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = MARGIN;
    this.onNewPage?.(this);
  }

  ensure(space: number) {
    if (this.y + space > this.limit) this.addPage();
  }

  font(o: TextOpts = {}): PDFFont {
    return o.bold ? this.fonts.bold : o.italic ? this.fonts.oblique : this.fonts.regular;
  }

  measure(text: string, o: TextOpts = {}): number {
    return this.font(o).widthOfTextAtSize(safe(text), o.size ?? 9);
  }

  wrap(text: string, width: number, o: TextOpts = {}): string[] {
    const font = this.font(o);
    const size = o.size ?? 9;
    const lines: string[] = [];
    for (const para of text.split(/\r?\n/).map(safe)) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const candidate = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        // Hard-break words longer than the column.
        let word = w;
        while (font.widthOfTextAtSize(word, size) > width && word.length > 1) {
          let cut = word.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > width) cut--;
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        line = word;
      }
      lines.push(line);
    }
    return lines;
  }

  /** Draws (wrapped) text with its top at `top`; returns the height used. */
  text(str: string, x: number, top: number, o: TextOpts = {}): number {
    const size = o.size ?? 9;
    const lh = size * 1.22 + (o.lineGap ?? 0);
    const lines = o.maxWidth ? this.wrap(str, o.maxWidth, o) : [safe(str)];
    const font = this.font(o);
    lines.forEach((line, i) => {
      let dx = 0;
      if (o.align && o.align !== 'left' && o.maxWidth) {
        const w = font.widthOfTextAtSize(line, size);
        dx = o.align === 'right' ? o.maxWidth - w : (o.maxWidth - w) / 2;
      }
      this.page.drawText(line, { x: x + dx, y: this.height - top - size * 0.86 - i * lh, size, font, color: o.color ?? INK });
    });
    return lines.length * lh;
  }

  textHeight(str: string, width: number, o: TextOpts = {}): number {
    const size = o.size ?? 9;
    return this.wrap(str, width, o).length * (size * 1.22 + (o.lineGap ?? 0));
  }

  rect(x: number, top: number, w: number, h: number, o: { fill?: RGB; stroke?: RGB; width?: number } = {}) {
    this.page.drawRectangle({
      x,
      y: this.height - top - h,
      width: w,
      height: h,
      color: o.fill,
      borderColor: o.stroke,
      borderWidth: o.stroke ? (o.width ?? 0.6) : 0,
    });
  }

  line(x1: number, top1: number, x2: number, top2: number, o: { color?: RGB; width?: number } = {}) {
    this.page.drawLine({
      start: { x: x1, y: this.height - top1 },
      end: { x: x2, y: this.height - top2 },
      thickness: o.width ?? 0.6,
      color: o.color ?? RULE,
    });
  }

  image(img: PDFImage, x: number, top: number, w: number, h: number) {
    this.page.drawImage(img, { x, y: this.height - top - h, width: w, height: h });
  }

  measureBox(w: number, body: BoxBody): number {
    const pad = 5;
    let h = pad + 9 + pad;
    for (const b of body) {
      const it = typeof b === 'string' ? { text: b } : b;
      h += this.textHeight(it.text, w - pad * 2, { size: it.size ?? 9, bold: it.bold });
    }
    return h;
  }

  /** Draws boxes side by side at equal height; returns that height. */
  boxRow(top: number, specs: Array<{ x: number; w: number; label: string; body: BoxBody; minHeight?: number }>): number {
    const h = Math.max(...specs.map((s) => Math.max(s.minHeight ?? 0, this.measureBox(s.w, s.body))));
    for (const s of specs) this.box(s.x, top, s.w, s.label, s.body, h);
    return h;
  }

  /**
   * A labelled form box ("1. Exporter") whose body is a list of lines.
   * Returns the box height actually needed; pass `height` to force one.
   */
  box(x: number, top: number, w: number, label: string, body: BoxBody, height?: number): number {
    const pad = 5;
    const items = body.map((b) => (typeof b === 'string' ? { text: b } : b));
    const H = Math.max(height ?? 0, this.measureBox(w, body));
    this.rect(x, top, w, H, { stroke: RULE });
    this.text(label, x + pad, top + pad - 1, { size: 6.5, color: MUTED, bold: true });
    let yy = top + pad + 9;
    for (const it of items) {
      yy += this.text(it.text, x + pad, yy, { size: it.size ?? 9, bold: it.bold, color: it.color, maxWidth: w - pad * 2 });
    }
    return H;
  }

  /** Table with repeated header row on page breaks. Moves `y` below it. */
  table(columns: Column[], rows: string[][], o: { size?: number; zebra?: boolean; headerFill?: RGB } = {}) {
    const size = o.size ?? 8.5;
    const pad = 4;
    const x0 = MARGIN;
    const drawHeader = () => {
      const hh = Math.max(...columns.map((c) => this.textHeight(c.header, c.width - pad * 2, { size: 7, bold: true }))) + pad * 2;
      this.rect(x0, this.y, sum(columns.map((c) => c.width)), hh, { fill: o.headerFill ?? TINT, stroke: RULE });
      let x = x0;
      for (const c of columns) {
        this.text(c.header, x + pad, this.y + pad, { size: 7, bold: true, color: MUTED, maxWidth: c.width - pad * 2, align: c.align });
        x += c.width;
      }
      this.y += hh;
    };
    drawHeader();
    rows.forEach((row, ri) => {
      const rh = Math.max(...row.map((cell, i) => this.textHeight(cell, columns[i]!.width - pad * 2, { size }))) + pad * 2;
      if (this.y + rh > this.limit) {
        this.addPage();
        drawHeader();
      }
      if (o.zebra && ri % 2 === 1) this.rect(x0, this.y, sum(columns.map((c) => c.width)), rh, { fill: rgb(0.985, 0.985, 0.99) });
      let x = x0;
      row.forEach((cell, i) => {
        const c = columns[i]!;
        this.text(cell, x + pad, this.y + pad, { size, maxWidth: c.width - pad * 2, align: c.align });
        x += c.width;
      });
      this.line(x0, this.y + rh, x0 + sum(columns.map((c) => c.width)), this.y + rh);
      this.y += rh;
    });
  }
}

export function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

/** Scales column weights to the content width. */
export function cols(spec: Array<[string, number, Column['align']?]>, total: number): Column[] {
  const weight = sum(spec.map((s) => s[1]));
  return spec.map(([header, w, align]) => ({ header, width: (w / weight) * total, align }));
}
