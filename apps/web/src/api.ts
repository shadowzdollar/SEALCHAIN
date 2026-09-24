import type { DocumentKind, Finding, Shipment, ValidationReport } from '@sealchain/core';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'include',
    headers: body && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string; details?: unknown; verdict?: string };
    throw new ApiError(res.status, d.error ?? d.verdict ?? 'error', d.message ?? res.statusText, d.details ?? data);
  }
  return data as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

// ------------------------------------------------------------------ types
export interface Me {
  user: { id: string; email: string; name: string; role: 'owner' | 'member' | 'compliance' };
  org: { id: string; name: string; country: string; plan: string; kind: 'business' | 'authority' };
}

export interface CorridorInfo {
  id: string;
  name: string;
  origin: string;
  destination: string;
  roadTransit: string[];
  rulesetVersion: string;
  rulesetVerifiedAt: string | null;
  exitPoints: Record<string, string[]>;
  entryPoints: Record<string, string[]>;
  taxId: { exporter: { label: string; example: string; pattern: string }; consignee: { label: string; example: string; pattern: string } };
  params: { strThresholdUsd: number; maxNonOriginatingPct: number };
}

export interface AnchorInfo {
  backend: 'evm' | 'local';
  networkName: string;
  chainId?: number;
  contract?: string;
  publicRpcUrl?: string;
  explorerTxUrl?: string;
  independentlyVerifiable: boolean;
}

export interface Meta {
  corridors: CorridorInfo[];
  currencies: string[];
  catalogSize: number;
  anchor: AnchorInfo;
  billing: { currency: string; monthlyFeeCents: number; perShipmentCents: number };
  publicWebUrl: string;
  oauthProviders: Array<'google' | 'apple'>;
  issuerKey: { keyId: string; algorithm: string; publicKey: string };
}

export interface TariffLineInfo {
  code: string;
  description: string;
  cetRate: number;
  sensitive?: boolean;
  unit: string;
  requirements?: string[];
  note?: string;
  verifiedAt?: string | null;
  verifiedBy?: string;
  keywords: string[];
}

export interface Suggestion {
  line: TariffLineInfo;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: string[];
}

export interface DocSummary {
  id: string;
  kind: DocumentKind;
  number: string;
  version: number;
  status: 'active' | 'superseded' | 'revoked';
  sha256: string;
  size: number;
  issuedAt: string;
  supersededBy: string | null;
  revokedReason: string | null;
  anchor: { status: string; backend: string | null; txHash: string | null; anchoredAt: string | null };
}

export interface ShipmentListItem {
  id: string;
  reference: string;
  corridorId: string;
  corridor: string;
  status: 'draft' | 'issued';
  consignee: string;
  invoiceNumber: string;
  currency: string;
  invoiceTotal: number | null;
  validationStatus: 'ready' | 'review' | 'blocked' | null;
  documents: number;
  anchoring: 'pending' | 'anchored' | null;
  version: number;
  updatedAt: string;
}

export interface ShipmentDetail {
  id: string;
  status: 'draft' | 'issued';
  version: number;
  createdAt: string;
  updatedAt: string;
  data: Shipment;
  validation: ValidationReport | null;
  documents: DocSummary[];
  documentsOutOfDate: boolean;
}

export type Verdict = 'authentic' | 'authentic_pending_anchor' | 'superseded' | 'revoked' | 'tampered' | 'anchor_missing';

export interface PublicEndorsement {
  id: string;
  authority: string;
  officer: string | null;
  decidedAt: string | null;
  recordHash: string | null;
  signatureValid: boolean;
  matchesDocument: boolean;
  proofValid: boolean;
  anchor: { status: string | null; root: string | null; anchoredAt: string | null; txHash: string | null };
}

export interface VerificationResult {
  verdict: Verdict;
  checks: { parties: number; since: string | null; possibleReuse: boolean };
  endorsements: PublicEndorsement[];
  document: {
    id: string;
    kind: DocumentKind;
    kindLabel: string;
    number: string;
    version: number;
    status: string;
    issuedAt: string;
    issuer: string;
    summary: {
      corridor: string;
      exporterName: string;
      consigneeName: string;
      invoiceNumber: string;
      invoiceDate: string;
      items: Array<{ description: string; hsCode: string; quantity: number; unit: string; grossWeightKg: number; packageCount: number; originCountry: string; originCriterion: string }>;
      packages: number;
      grossWeightKg: number;
      currency?: string;
      invoiceTotal?: number;
      incoterm?: string;
    };
    supersededBy: { id: string; number: string } | null;
    revokedReason: string | null;
    size: number;
  };
  integrity: { sha256: string; providedSha256: string | null; matches: boolean | null };
  signature: { algorithm: string; keyId: string; publicKey: string; signature: string; valid: boolean };
  anchor: {
    status: string;
    backend: 'evm' | 'local';
    independentlyVerifiable: boolean;
    networkName: string;
    chainId: number | null;
    contract: string | null;
    publicRpcUrl: string | null;
    root: string | null;
    leafCount: number | null;
    proof: Array<{ hash: string; side: 'L' | 'R' }> | null;
    computedRoot: string | null;
    proofValid: boolean;
    txHash: string | null;
    blockNumber: number | null;
    anchoredAt: string | null;
    explorerUrl: string | null;
    ledgerEntry: string | null;
    onChain: { checked: boolean; anchoredAt: string | null; error?: string };
  };
}

export interface Signal {
  code: string;
  level: 'critical' | 'high' | 'medium' | 'low' | 'pass';
  title: string;
  detail: string;
}

export interface ForensicReport {
  id: string;
  sha256: string;
  filename: string;
  registered: null | { id: string; number: string; kind: string; status: string; version: number };
  claimed: null | { id: string; number: string; kind: string; status: string; issuedSha256: string; changes: { removed: string[]; added: string[] } | null };
  metadata: Record<string, string | number | null>;
  fields: Record<string, unknown> & { kindGuess: string; hsCodes: string[]; invoiceNumbers: string[]; dates: string[] };
  signals: Signal[];
  risk: { score: number; level: 'high' | 'medium' | 'low' };
  summary: string;
  createdAt?: string;
}

export type { Finding, Shipment, ValidationReport };
