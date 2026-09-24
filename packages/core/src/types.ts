/**
 * Shared domain model for SealChain.
 *
 * Amounts are decimal numbers in the major unit of `Shipment.currency`
 * (e.g. 1250.50 USD). Always round with `round2` from ./money before display
 * or persistence; the validation engine compares with a 1-cent tolerance.
 */

/** EAC Partner States plus the non-EAC destinations we model for reference. */
export type CountryCode = 'RW' | 'KE' | 'UG' | 'TZ' | 'BI' | 'SS' | 'CD' | 'SO';

export type Currency = 'USD' | 'RWF' | 'KES' | 'UGX' | 'TZS' | 'EUR';

/** Incoterms® 2020 */
export type Incoterm =
  | 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP'
  | 'FAS' | 'FOB' | 'CFR' | 'CIF';

export type TransportMode = 'road' | 'air' | 'rail' | 'sea' | 'multimodal';

export type QuantityUnit = 'KG' | 'T' | 'L' | 'PCS' | 'PR' | 'DZN' | 'M' | 'M2' | 'HEAD' | 'STEM';

/**
 * EAC Rules of Origin (2015) origin criteria, simplified for the form:
 *  - WO:  wholly obtained / produced in a Partner State
 *  - PSR: produced using non-originating materials that satisfy the
 *         product-specific rule for the heading (sufficient working / processing)
 */
export type OriginCriterion = 'WO' | 'PSR';

export interface Party {
  name: string;
  address: string;
  city: string;
  country: CountryCode;
  /** Rwanda TIN (9 digits) / Kenya KRA PIN (e.g. P051234567X) etc. */
  taxId?: string;
  phone?: string;
  email?: string;
}

export interface ShipmentItem {
  id: string;
  description: string;
  /** 8-digit EAC CET code, digits only, e.g. "09011100" */
  hsCode: string;
  quantity: number;
  unit: QuantityUnit;
  unitPrice: number;
  netWeightKg: number;
  grossWeightKg: number;
  packageCount: number;
  packageType: string;
  marks?: string;
  originCountry: CountryCode;
  originCriterion: OriginCriterion;
  /** Only for PSR: share of ex-works price made up of non-originating materials. */
  nonOriginatingPct?: number;
  /** Only for PSR: short free-text statement of the processing performed. */
  processingNote?: string;
}

export interface Shipment {
  id: string;
  reference: string;
  corridorId: string;
  exporter: Party;
  consignee: Party;
  /** Notify party / buyer if different from consignee. */
  buyer?: Party;
  currency: Currency;
  incoterm: Incoterm;
  incotermPlace: string;
  transportMode: TransportMode;
  /** e.g. "Kigali" */
  placeOfLoading: string;
  /** Border post where goods exit the origin country, e.g. "Gatuna" */
  exitPoint?: string;
  /** Border post / airport where goods enter the destination, e.g. "Malaba" */
  entryPoint?: string;
  /** e.g. "Nairobi" */
  finalDestination: string;
  /** Truck plate / flight number / container number */
  transportRef?: string;
  departureDate?: string; // ISO date
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  buyerOrderRef?: string;
  paymentTerms?: string;
  freight: number;
  insurance: number;
  otherCharges: number;
  items: ShipmentItem[];
}

export type DocumentKind = 'commercial_invoice' | 'certificate_of_origin' | 'packing_list' | 'simplified_certificate_of_origin';

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  commercial_invoice: 'Commercial Invoice',
  certificate_of_origin: 'EAC Certificate of Origin',
  packing_list: 'Packing List',
  simplified_certificate_of_origin: 'EAC Simplified Certificate of Origin (STR)',
};

export type Severity = 'error' | 'warning' | 'info';

export interface RuleSource {
  /** Human-readable name of the legal / procedural source. */
  title: string;
  url?: string;
  /** ISO date the compliance team last confirmed this rule; null = never verified. */
  lastVerifiedAt: string | null;
}

export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  /** Dotted path into the shipment, e.g. "items[2].hsCode" */
  path?: string;
  documents?: DocumentKind[];
  source?: RuleSource;
  /** Suggested fix in plain language. */
  hint?: string;
}

export interface Requirement {
  id: string;
  title: string;
  /** Who has to obtain / file it. */
  responsible: 'exporter' | 'importer' | 'carrier' | 'platform';
  authority: string;
  description: string;
  /** Does the platform generate it? */
  generated: boolean;
  source: RuleSource;
}
