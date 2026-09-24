/**
 * Request schemas. Shipment drafts are deliberately lenient (empty strings
 * and zeros are allowed) — the validation engine, not the HTTP layer, is what
 * tells a trader what is missing, in plain language.
 */
import { z } from 'zod';
import { CORRIDORS, CURRENCIES } from '@sealchain/core';

const country = z.enum(['RW', 'KE', 'UG', 'TZ', 'BI', 'SS', 'CD', 'SO']);
const str = (max = 300) => z.string().trim().max(max).default('');
const optStr = (max = 300) => z.string().trim().max(max).optional();
const money = z.coerce.number().min(-1e12).max(1e12).default(0);
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').or(z.literal(''));

export const partySchema = z.object({
  name: str(200),
  address: str(300),
  city: str(100),
  country: country,
  taxId: optStr(40),
  phone: optStr(40),
  email: optStr(200),
});

export const itemSchema = z.object({
  id: z.string().trim().min(1).max(40),
  description: str(500),
  hsCode: z.string().trim().max(20).default('').transform((v) => v.replace(/\D/g, '')),
  quantity: money,
  unit: z.enum(['KG', 'T', 'L', 'PCS', 'PR', 'DZN', 'M', 'M2', 'HEAD', 'STEM']).default('KG'),
  unitPrice: money,
  netWeightKg: money,
  grossWeightKg: money,
  packageCount: money,
  packageType: str(120),
  marks: optStr(200),
  originCountry: country.default('RW'),
  originCriterion: z.enum(['WO', 'PSR']).default('WO'),
  nonOriginatingPct: z.coerce.number().min(0).max(100).optional(),
  processingNote: optStr(500),
});

export const shipmentSchema = z.object({
  reference: str(80),
  corridorId: z.string().refine((v) => v in CORRIDORS, 'Unknown corridor'),
  exporter: partySchema,
  consignee: partySchema,
  currency: z.enum(CURRENCIES as [string, ...string[]]).default('USD'),
  incoterm: z.enum(['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']).default('FCA'),
  incotermPlace: str(120),
  transportMode: z.enum(['road', 'air', 'rail', 'sea', 'multimodal']).default('road'),
  placeOfLoading: str(120),
  exitPoint: optStr(120),
  entryPoint: optStr(120),
  finalDestination: str(120),
  transportRef: optStr(120),
  departureDate: isoDate.optional(),
  invoiceNumber: str(60),
  invoiceDate: isoDate.default(''),
  buyerOrderRef: optStr(60),
  paymentTerms: optStr(300),
  freight: money,
  insurance: money,
  otherCharges: money,
  items: z.array(itemSchema).max(200).default([]),
});

export type ShipmentInput = z.infer<typeof shipmentSchema>;

export const registerSchema = z.object({
  orgName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
  country: country.default('RW'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const savedPartySchema = z.object({
  role: z.enum(['exporter', 'consignee']),
  party: partySchema,
});
