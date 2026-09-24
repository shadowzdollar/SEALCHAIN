/**
 * Tariff classification.
 *
 * Per the project brief, classification is table-stakes functionality — not
 * the product's differentiator — so the platform talks to a `TariffClassifier`
 * interface. `LocalCatalogClassifier` ships a transparent BM25 ranker over the
 * curated catalog, good enough for a single corridor's export basket; a
 * licensed provider (Zonos, Thomson Reuters, etc.) can be dropped in behind the
 * same interface without touching the rest of the system.
 *
 * Suggestions are always shown to the trader for confirmation, with the terms
 * that produced the match, so the tool never silently picks a code.
 */
import { TARIFF_CATALOG, type TariffLine } from './catalog';
import { normalizeHs } from './format';

export type Confidence = 'high' | 'medium' | 'low';

export interface ClassificationSuggestion {
  line: TariffLine;
  score: number;
  confidence: Confidence;
  matchedTerms: string[];
}

export interface TariffClassifier {
  readonly name: string;
  classify(description: string, limit?: number): Promise<ClassificationSuggestion[]>;
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'of', 'the', 'for', 'in', 'on', 'with', 'to', 'kg', 'kgs',
  'other', 'than', 'not', 'nor', 'bag', 'bags', 'box', 'grade', 'quality', 'fresh', 'new',
]);

/** Minimal stemmer: enough to match "avocados" -> "avocado", "chillies" -> "chilli". */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && /(ches|shes|xes|oes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

interface IndexedDoc {
  line: TariffLine;
  tf: Map<string, number>;
  length: number;
  phrases: string[];
}

export class LocalCatalogClassifier implements TariffClassifier {
  readonly name = 'local-catalog-bm25';
  private docs: IndexedDoc[];
  private df = new Map<string, number>();
  private avgLen: number;

  constructor(catalog: TariffLine[] = TARIFF_CATALOG) {
    this.docs = catalog.map((line) => {
      // Keywords are the curated vocabulary traders actually use, so weight
      // them double relative to the formal HS description.
      const tokens = [...tokenize(line.description), ...line.keywords.flatMap((k) => tokenize(k)), ...line.keywords.flatMap((k) => tokenize(k))];
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      return { line, tf, length: tokens.length, phrases: line.keywords.map((k) => k.toLowerCase()) };
    });
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = this.docs.reduce((s, d) => s + d.length, 0) / Math.max(1, this.docs.length);
  }

  classifySync(description: string, limit = 5): ClassificationSuggestion[] {
    const raw = description.trim();
    if (!raw) return [];

    // A code typed directly ("0901.11", "09011100") short-circuits search.
    const digits = normalizeHs(raw);
    if (digits.length >= 4 && digits.length === raw.replace(/[\s.]/g, '').length) {
      return this.docs
        .filter((d) => d.line.code.startsWith(digits))
        .slice(0, limit)
        .map((d) => ({ line: d.line, score: 1, confidence: digits.length === 8 ? 'high' : 'medium', matchedTerms: [digits] }));
    }

    const query = [...new Set(tokenize(raw))];
    const lowered = raw.toLowerCase();
    const N = this.docs.length;
    const k1 = 1.2;
    const b = 0.75;

    const scored = this.docs.map((d) => {
      let score = 0;
      const matched: string[] = [];
      for (const q of query) {
        const f = d.tf.get(q);
        if (!f) continue;
        const df = this.df.get(q) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / this.avgLen)));
        matched.push(q);
      }
      // Multi-word trade names ("green coffee", "french beans") are strong evidence.
      for (const p of d.phrases) {
        if (p.includes(' ') && lowered.includes(p)) {
          score += 2.5;
          matched.push(p);
        }
      }
      return { line: d.line, score, matchedTerms: [...new Set(matched)] };
    });

    const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    const top = hits[0]?.score ?? 0;
    const second = hits[1]?.score ?? 0;
    return hits.map((h, i) => ({
      ...h,
      score: Math.round(h.score * 100) / 100,
      confidence: confidenceFor(i, h.score, top, second),
    }));
  }

  async classify(description: string, limit = 5): Promise<ClassificationSuggestion[]> {
    return this.classifySync(description, limit);
  }
}

function confidenceFor(rank: number, score: number, top: number, second: number): Confidence {
  if (rank === 0 && score >= 4 && (second === 0 || top / second >= 1.4)) return 'high';
  if (score >= 2.5 && score >= top * 0.7) return 'medium';
  return 'low';
}
