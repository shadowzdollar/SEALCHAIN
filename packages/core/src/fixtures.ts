/**
 * Demo data used by the seed script, the end-to-end test and unit tests.
 * All companies and identifiers are fictional.
 */
import type { Shipment } from './types';

export function demoShipment(overrides: Partial<Shipment> = {}): Shipment {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: 'demo',
    reference: 'PO-2026-0147',
    corridorId: 'RW-KE',
    exporter: {
      name: 'Ubwiza Coffee Exporters Ltd (Demo)',
      address: 'KG 9 Ave, Plot 12, Gasabo',
      city: 'Kigali',
      country: 'RW',
      taxId: '102345678',
      phone: '+250 788 000 111',
      email: 'exports@ubwiza.example',
    },
    consignee: {
      name: 'Savannah Roasters Ltd (Demo)',
      address: 'Enterprise Road, Industrial Area',
      city: 'Nairobi',
      country: 'KE',
      taxId: 'P051234567X',
      phone: '+254 700 000 222',
      email: 'buying@savannah.example',
    },
    currency: 'USD',
    incoterm: 'CPT',
    incotermPlace: 'Nairobi',
    transportMode: 'road',
    placeOfLoading: 'Kigali',
    exitPoint: 'Gatuna',
    entryPoint: 'Malaba',
    finalDestination: 'Nairobi',
    transportRef: 'RAD 123 A / RL 4567',
    departureDate: today,
    invoiceNumber: 'UCE-INV-2026-0091',
    invoiceDate: today,
    buyerOrderRef: 'SR-PO-7781',
    paymentTerms: '50% advance, 50% against documents',
    freight: 1850,
    insurance: 0,
    otherCharges: 0,
    items: [
      {
        id: 'l1',
        description: 'Green arabica coffee beans, fully washed, grade A1',
        hsCode: '09011100',
        quantity: 9600,
        unit: 'KG',
        unitPrice: 6.4,
        netWeightKg: 9600,
        grossWeightKg: 9744,
        packageCount: 160,
        packageType: 'Jute bags (60 kg) with GrainPro liners',
        marks: 'UBWIZA / SR-PO-7781 / 1-160',
        originCountry: 'RW',
        originCriterion: 'WO',
      },
      {
        id: 'l2',
        description: 'Roasted arabica coffee, whole bean, 1 kg retail bags',
        hsCode: '09012100',
        quantity: 400,
        unit: 'KG',
        unitPrice: 14.5,
        netWeightKg: 400,
        grossWeightKg: 436,
        packageCount: 40,
        packageType: 'Cartons (10 x 1 kg)',
        marks: 'UBWIZA ROAST / 161-200',
        originCountry: 'RW',
        originCriterion: 'WO',
      },
    ],
    ...overrides,
  };
}
