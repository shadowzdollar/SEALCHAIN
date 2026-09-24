/**
 * Corridor rule sets.
 *
 * A corridor is an origin → destination trade route with its own document
 * set, border posts, regulatory requirements and validation parameters. Rules
 * are data, not code, so the compliance-research role can review and version
 * them. Every rule carries a `source` with a `lastVerifiedAt` date; `null`
 * means the rule was captured during planning and still needs confirmation —
 * the UI shows that status rather than presenting unverified rules as fact.
 */
import type { CountryCode, DocumentKind, Requirement, RuleSource, TransportMode } from './types';

export interface RuleChange {
  id: string;
  effectiveFrom: string; // ISO date
  title: string;
  description: string;
  /** HS code prefixes affected; empty = all goods on the corridor. */
  hsPrefixes: string[];
  source: RuleSource;
}

export interface Corridor {
  id: string;
  name: string;
  origin: CountryCode;
  destination: CountryCode;
  /** Partner States crossed by road. */
  roadTransit: CountryCode[];
  rulesetVersion: string;
  generatedDocuments: DocumentKind[];
  /** Requirements that apply to every shipment on the corridor. */
  baseRequirements: string[];
  /** Requirements that apply only to road shipments. */
  roadRequirements: string[];
  exitPoints: Partial<Record<TransportMode, string[]>>;
  entryPoints: Partial<Record<TransportMode, string[]>>;
  taxId: {
    exporter: { pattern: RegExp; label: string; example: string };
    consignee: { pattern: RegExp; label: string; example: string };
  };
  params: {
    /** EAC Simplified Trade Regime consignment ceiling. */
    strThresholdUsd: number;
    /** Common PSR value-content ceiling used as a first-pass check. */
    maxNonOriginatingPct: number;
    /** Warn when the certificate is presented this many days after issue. */
    cooMaxAgeDays: number;
    /** Declared value (USD) above which we suggest extra supporting evidence. */
    highValueUsd: number;
    /** A rule set not re-verified within this window is flagged as stale. */
    staleAfterDays: number;
  };
  changes: RuleChange[];
}

const unverified = (title: string, url?: string): RuleSource => ({ title, url, lastVerifiedAt: null });

const EAC_ROO = unverified('EAC Customs Union (Rules of Origin) Rules, 2015', 'https://www.eac.int/customs/rules-of-origin');
const EAC_STR = unverified('EAC Simplified Trade Regime (STR)', 'https://www.eac.int/trade/international-trade/trade-facilitation');
const EAC_CET = unverified('EAC Common External Tariff 2022', 'https://www.eac.int/customs/common-external-tariff');

export const REQUIREMENTS: Record<string, Requirement> = {
  COMMERCIAL_INVOICE: {
    id: 'COMMERCIAL_INVOICE', title: 'Commercial invoice', responsible: 'exporter', authority: 'Exporter',
    description: 'Invoice matching the consignment exactly — goods, quantities, values, currency and Incoterm.',
    generated: true, source: unverified('EAC Customs Management Act (valuation & declaration)'),
  },
  PACKING_LIST: {
    id: 'PACKING_LIST', title: 'Packing list', responsible: 'exporter', authority: 'Exporter',
    description: 'Package-level breakdown of the consignment reconciling with the invoice and certificate of origin.',
    generated: true, source: unverified('Standard customs supporting document'),
  },
  COO_EAC: {
    id: 'COO_EAC', title: 'EAC Certificate of Origin', responsible: 'exporter', authority: 'Rwanda Revenue Authority (Customs)',
    description: 'Proves the goods originate in an EAC Partner State so the consignment qualifies for 0% intra-EAC duty instead of the CET rate. Generated here; endorsed by the designated issuing authority.',
    generated: true, source: EAC_ROO,
  },
  COO_SIMPLIFIED: {
    id: 'COO_SIMPLIFIED', title: 'Simplified Certificate of Origin (STR)', responsible: 'exporter', authority: 'Customs at the border post',
    description: 'For consignments not exceeding the STR ceiling and listed on the EAC common list, a Simplified Certificate of Origin can be used instead of the full certificate. Pre-filled here; stamped by customs at the border.',
    generated: true, source: EAC_STR,
  },
  RW_EXPORT_DECLARATION: {
    id: 'RW_EXPORT_DECLARATION', title: 'Export declaration', responsible: 'exporter', authority: 'Rwanda Revenue Authority via Rwanda Electronic Single Window (ReSW)',
    description: 'Export entry lodged by the exporter or their licensed clearing agent.',
    generated: false, source: unverified('Rwanda Electronic Single Window'),
  },
  KE_IDF: {
    id: 'KE_IDF', title: 'Import Declaration Form (IDF)', responsible: 'importer', authority: 'Kenya Revenue Authority via KenTrade',
    description: 'Lodged by the Kenyan importer before the goods arrive. Share the invoice early so the IDF values match.',
    generated: false, source: unverified('Kenya National Electronic Single Window (KenTrade)'),
  },
  UG_IMPORT_ENTRY: {
    id: 'UG_IMPORT_ENTRY', title: 'Import entry', responsible: 'importer', authority: 'Uganda Revenue Authority',
    description: 'Import declaration lodged by the Ugandan importer or clearing agent through the URA customs system.',
    generated: false, source: unverified('Uganda Revenue Authority customs procedures'),
  },
  RECTS: {
    id: 'RECTS', title: 'Electronic cargo tracking seal (road transit)', responsible: 'carrier', authority: 'Partner State revenue authorities (RECTS)',
    description: 'Road cargo moving along the Northern Corridor under customs control is tracked with the Regional Electronic Cargo Tracking System.',
    generated: false, source: unverified('Regional Electronic Cargo Tracking System (Northern Corridor)'),
  },
  PHYTO: {
    id: 'PHYTO', title: 'Phytosanitary certificate', responsible: 'exporter', authority: 'Rwanda National Plant Protection Organisation',
    description: 'Required for plants and plant products (fresh produce, flowers, grains, green coffee).',
    generated: false, source: unverified('IPPC / national plant health regulations'),
  },
  KEPHIS_PERMIT: {
    id: 'KEPHIS_PERMIT', title: 'Plant import permit', responsible: 'importer', authority: 'Kenya Plant Health Inspectorate Service (KEPHIS)',
    description: 'Kenyan importer obtains the plant import permit that the phytosanitary certificate must satisfy.',
    generated: false, source: unverified('KEPHIS import requirements', 'https://www.kephis.go.ke'),
  },
  VET_CERT: {
    id: 'VET_CERT', title: 'Veterinary health certificate', responsible: 'exporter', authority: 'Rwanda Agriculture and Animal Resources Development Board (RAB)',
    description: 'Required for live animals and products of animal origin (meat, dairy, hides, honey, fish).',
    generated: false, source: unverified('Animal health regulations'),
  },
  KE_DVS_PERMIT: {
    id: 'KE_DVS_PERMIT', title: 'Veterinary import permit', responsible: 'importer', authority: 'Kenya Directorate of Veterinary Services',
    description: 'Import permit for animals and animal products entering Kenya.',
    generated: false, source: unverified('Kenya Directorate of Veterinary Services'),
  },
  NAEB_EXPORT: {
    id: 'NAEB_EXPORT', title: 'NAEB export clearance', responsible: 'exporter', authority: 'National Agricultural Export Development Board (NAEB)',
    description: 'Coffee and tea exports must be registered with and quality-cleared by NAEB.',
    generated: false, source: unverified('NAEB export procedures', 'https://www.naeb.gov.rw'),
  },
  ICGLR_RCM: {
    id: 'ICGLR_RCM', title: 'ICGLR Regional Certificate (minerals)', responsible: 'exporter', authority: 'Rwanda Mines, Petroleum and Gas Board (RMB)',
    description: 'Tin, tantalum, tungsten and gold exports require the ICGLR regional certificate and chain-of-custody traceability to the mine site.',
    generated: false, source: unverified('ICGLR Regional Certification Mechanism'),
  },
  RMB_EXPORT: {
    id: 'RMB_EXPORT', title: 'Mineral export licence', responsible: 'exporter', authority: 'Rwanda Mines, Petroleum and Gas Board (RMB)',
    description: 'Valid mineral trading/export licence for the consignment.',
    generated: false, source: unverified('Rwanda mining law'),
  },
  KE_PPB_PERMIT: {
    id: 'KE_PPB_PERMIT', title: 'Pharmaceutical import permit', responsible: 'importer', authority: 'Pharmacy and Poisons Board (Kenya)',
    description: 'Medicines require a PPB import permit and product registration in Kenya.',
    generated: false, source: unverified('Pharmacy and Poisons Board'),
  },
  KEBS_STANDARDS: {
    id: 'KEBS_STANDARDS', title: 'Standards conformity', responsible: 'exporter', authority: 'Rwanda Standards Board (S-Mark) / Kenya Bureau of Standards',
    description: 'Manufactured and processed goods may need to show conformity with EAC/Kenyan standards — a recognised quality mark from the origin standards body is usually the simplest evidence.',
    generated: false, source: unverified('EAC Standardisation, Quality Assurance, Metrology and Testing Act'),
  },
  UNBS_STANDARDS: {
    id: 'UNBS_STANDARDS', title: 'Standards conformity', responsible: 'exporter', authority: 'Rwanda Standards Board (S-Mark) / Uganda National Bureau of Standards',
    description: 'Manufactured and processed goods may need to show conformity with EAC/Ugandan standards.',
    generated: false, source: unverified('EAC Standardisation, Quality Assurance, Metrology and Testing Act'),
  },
  UG_MAAIF_PERMIT: {
    id: 'UG_MAAIF_PERMIT', title: 'Plant / animal import permit', responsible: 'importer', authority: 'Uganda Ministry of Agriculture, Animal Industry and Fisheries (MAAIF)',
    description: 'Import permit for plants, plant products, animals and animal products entering Uganda.',
    generated: false, source: unverified('MAAIF import requirements'),
  },
  TZ_IMPORT_ENTRY: {
    id: 'TZ_IMPORT_ENTRY', title: 'Import declaration', responsible: 'importer', authority: 'Tanzania Revenue Authority (TANCIS)',
    description: 'Import declaration lodged by the Tanzanian importer or clearing agent in TRA\'s customs system.',
    generated: false, source: unverified('Tanzania Revenue Authority customs procedures'),
  },
  TZ_PLANT_PERMIT: {
    id: 'TZ_PLANT_PERMIT', title: 'Plant import permit', responsible: 'importer', authority: 'Tanzania Plant Health and Pesticides Authority (TPHPA)',
    description: 'Import permit for plants and plant products entering Tanzania.',
    generated: false, source: unverified('TPHPA import requirements'),
  },
  TZ_VET_PERMIT: {
    id: 'TZ_VET_PERMIT', title: 'Veterinary import permit', responsible: 'importer', authority: 'Tanzania Ministry of Livestock and Fisheries — Veterinary Services',
    description: 'Import permit for animals and animal products entering Tanzania.',
    generated: false, source: unverified('Tanzania veterinary import requirements'),
  },
  TZ_TMDA_PERMIT: {
    id: 'TZ_TMDA_PERMIT', title: 'Medicines import permit', responsible: 'importer', authority: 'Tanzania Medicines and Medical Devices Authority (TMDA)',
    description: 'Medicines need a TMDA import permit and product registration.',
    generated: false, source: unverified('TMDA'),
  },
  TBS_STANDARDS: {
    id: 'TBS_STANDARDS', title: 'Standards conformity', responsible: 'exporter', authority: 'Rwanda Standards Board (S-Mark) / Tanzania Bureau of Standards',
    description: 'Manufactured and processed goods may need to show conformity with EAC/Tanzanian standards.',
    generated: false, source: unverified('EAC Standardisation, Quality Assurance, Metrology and Testing Act'),
  },
  BI_IMPORT_ENTRY: {
    id: 'BI_IMPORT_ENTRY', title: 'Import declaration', responsible: 'importer', authority: 'Office Burundais des Recettes (OBR)',
    description: 'Import declaration lodged by the Burundian importer or clearing agent with OBR customs.',
    generated: false, source: unverified('OBR customs procedures'),
  },
  BI_PLANT_PERMIT: {
    id: 'BI_PLANT_PERMIT', title: 'Plant import permit', responsible: 'importer', authority: 'Burundi national plant protection service',
    description: 'Import permit for plants and plant products entering Burundi.',
    generated: false, source: unverified('Burundi plant health regulations'),
  },
  BI_VET_PERMIT: {
    id: 'BI_VET_PERMIT', title: 'Veterinary import permit', responsible: 'importer', authority: 'Burundi national veterinary services',
    description: 'Import permit for animals and animal products entering Burundi.',
    generated: false, source: unverified('Burundi animal health regulations'),
  },
  BI_PHARMA_PERMIT: {
    id: 'BI_PHARMA_PERMIT', title: 'Medicines import authorisation', responsible: 'importer', authority: 'Burundi medicines regulatory authority',
    description: 'Medicines need an import authorisation in Burundi.',
    generated: false, source: unverified('Burundi medicines regulation'),
  },
  BBN_STANDARDS: {
    id: 'BBN_STANDARDS', title: 'Standards conformity', responsible: 'exporter', authority: 'Rwanda Standards Board (S-Mark) / Bureau Burundais de Normalisation',
    description: 'Manufactured and processed goods may need to show conformity with EAC/Burundian standards.',
    generated: false, source: unverified('EAC Standardisation, Quality Assurance, Metrology and Testing Act'),
  },
};

/**
 * Requirement ids in the catalog are written for Kenya; each other
 * destination maps them to its own agencies.
 */
const EQUIVALENTS: Partial<Record<CountryCode, Record<string, string>>> = {
  UG: { KEPHIS_PERMIT: 'UG_MAAIF_PERMIT', KE_DVS_PERMIT: 'UG_MAAIF_PERMIT', KE_PPB_PERMIT: 'UG_MAAIF_PERMIT', KEBS_STANDARDS: 'UNBS_STANDARDS' },
  TZ: { KEPHIS_PERMIT: 'TZ_PLANT_PERMIT', KE_DVS_PERMIT: 'TZ_VET_PERMIT', KE_PPB_PERMIT: 'TZ_TMDA_PERMIT', KEBS_STANDARDS: 'TBS_STANDARDS' },
  BI: { KEPHIS_PERMIT: 'BI_PLANT_PERMIT', KE_DVS_PERMIT: 'BI_VET_PERMIT', KE_PPB_PERMIT: 'BI_PHARMA_PERMIT', KEBS_STANDARDS: 'BBN_STANDARDS' },
};

const RW_TIN = { pattern: /^\d{9}$/, label: 'Rwanda TIN', example: '102345678' };

const COMMON_CHANGES: RuleChange[] = [
  {
    id: 'eac-cet-2022',
    effectiveFrom: '2022-07-01',
    title: 'EAC CET review: fourth 35% band introduced',
    description: 'Finished goods in selected sectors (dairy, meat, cereals, coffee, tea, textiles, iron & steel, furniture, cut flowers…) moved to the 35% band. Affects the duty an importer pays when a Certificate of Origin is missing or rejected.',
    hsPrefixes: [],
    source: EAC_CET,
  },
];

export const CORRIDORS: Record<string, Corridor> = {
  'RW-KE': {
    id: 'RW-KE',
    name: 'Rwanda → Kenya',
    origin: 'RW',
    destination: 'KE',
    roadTransit: ['UG'],
    rulesetVersion: '2026.09-draft',
    generatedDocuments: ['commercial_invoice', 'certificate_of_origin', 'packing_list'],
    baseRequirements: ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'COO_EAC', 'RW_EXPORT_DECLARATION', 'KE_IDF'],
    roadRequirements: ['RECTS'],
    exitPoints: { road: ['Gatuna', 'Kagitumba'], air: ['Kigali International Airport (KGL)'] },
    entryPoints: { road: ['Malaba', 'Busia'], air: ['Jomo Kenyatta International Airport (NBO)'] },
    taxId: {
      exporter: RW_TIN,
      consignee: { pattern: /^[AP]\d{9}[A-Z]$/, label: 'KRA PIN', example: 'P051234567X' },
    },
    params: { strThresholdUsd: 2000, maxNonOriginatingPct: 60, cooMaxAgeDays: 365, highValueUsd: 50000, staleAfterDays: 90 },
    changes: COMMON_CHANGES,
  },
  'RW-UG': {
    id: 'RW-UG',
    name: 'Rwanda → Uganda',
    origin: 'RW',
    destination: 'UG',
    roadTransit: [],
    rulesetVersion: '2026.09-draft',
    generatedDocuments: ['commercial_invoice', 'certificate_of_origin', 'packing_list'],
    baseRequirements: ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'COO_EAC', 'RW_EXPORT_DECLARATION', 'UG_IMPORT_ENTRY'],
    roadRequirements: [],
    exitPoints: { road: ['Gatuna', 'Kagitumba', 'Cyanika'], air: ['Kigali International Airport (KGL)'] },
    entryPoints: { road: ['Katuna', 'Mirama Hills', 'Bunagana'], air: ['Entebbe International Airport (EBB)'] },
    taxId: {
      exporter: RW_TIN,
      consignee: { pattern: /^\d{10}$/, label: 'URA TIN', example: '1000123456' },
    },
    params: { strThresholdUsd: 2000, maxNonOriginatingPct: 60, cooMaxAgeDays: 365, highValueUsd: 50000, staleAfterDays: 90 },
    changes: COMMON_CHANGES,
  },
  'RW-TZ': {
    id: 'RW-TZ',
    name: 'Rwanda → Tanzania',
    origin: 'RW',
    destination: 'TZ',
    roadTransit: [],
    rulesetVersion: '2026.09-draft',
    generatedDocuments: ['commercial_invoice', 'certificate_of_origin', 'packing_list'],
    baseRequirements: ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'COO_EAC', 'RW_EXPORT_DECLARATION', 'TZ_IMPORT_ENTRY'],
    roadRequirements: [],
    exitPoints: { road: ['Rusumo'], air: ['Kigali International Airport (KGL)'] },
    entryPoints: { road: ['Rusumo'], air: ['Julius Nyerere International Airport (DAR)'] },
    taxId: {
      exporter: RW_TIN,
      consignee: { pattern: /^\d{9}$/, label: 'TRA TIN', example: '123456789' },
    },
    params: { strThresholdUsd: 2000, maxNonOriginatingPct: 60, cooMaxAgeDays: 365, highValueUsd: 50000, staleAfterDays: 90 },
    changes: COMMON_CHANGES,
  },
  'RW-BI': {
    id: 'RW-BI',
    name: 'Rwanda → Burundi',
    origin: 'RW',
    destination: 'BI',
    roadTransit: [],
    rulesetVersion: '2026.09-draft',
    generatedDocuments: ['commercial_invoice', 'certificate_of_origin', 'packing_list'],
    baseRequirements: ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'COO_EAC', 'RW_EXPORT_DECLARATION', 'BI_IMPORT_ENTRY'],
    roadRequirements: [],
    exitPoints: { road: ['Akanyaru-Haut', 'Nemba'], air: ['Kigali International Airport (KGL)'] },
    entryPoints: { road: ['Kanyaru-Haut', 'Gasenyi-Nemba'], air: ['Melchior Ndadaye International Airport (BJM)'] },
    taxId: {
      exporter: RW_TIN,
      consignee: { pattern: /^\d{10}$/, label: 'Burundi NIF', example: '4000123456' },
    },
    params: { strThresholdUsd: 2000, maxNonOriginatingPct: 60, cooMaxAgeDays: 365, highValueUsd: 50000, staleAfterDays: 90 },
    changes: COMMON_CHANGES,
  },
};

export function getCorridor(id: string): Corridor {
  const c = CORRIDORS[id];
  if (!c) throw new Error(`Unknown corridor ${id}`);
  return c;
}

/** Translate a catalog requirement id into the corridor's local equivalent. */
export function localizeRequirement(corridor: Corridor, id: string): string {
  return EQUIVALENTS[corridor.destination]?.[id] ?? id;
}

export function corridorSources(corridor: Corridor): RuleSource[] {
  const ids = new Set([...corridor.baseRequirements, ...corridor.roadRequirements]);
  return [...ids].map((id) => REQUIREMENTS[id]!.source);
}
