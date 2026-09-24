import type { Currency, Shipment, ShipmentItem } from './types';

export const CURRENCIES: Currency[] = ['USD', 'RWF', 'KES', 'UGX', 'TZS', 'EUR'];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Equal within one minor unit. */
export function moneyEq(a: number, b: number): boolean {
  return Math.abs(round2(a) - round2(b)) < 0.011;
}

/**
 * Units of `currency` per 1 USD. These are reference rates used only for
 * threshold checks (e.g. the USD 2,000 Simplified Trade Regime ceiling),
 * never for customs valuation. Deployments override them via FX_RATES_JSON.
 */
export const DEFAULT_FX_PER_USD: Record<Currency, number> = {
  USD: 1,
  RWF: 1450,
  KES: 129,
  UGX: 3650,
  TZS: 2600,
  EUR: 0.92,
};

export function toUsd(amount: number, currency: Currency, fx: Record<Currency, number> = DEFAULT_FX_PER_USD): number {
  const rate = fx[currency];
  if (!rate) throw new Error(`No FX rate for ${currency}`);
  return amount / rate;
}

export function lineTotal(item: Pick<ShipmentItem, 'quantity' | 'unitPrice'>): number {
  return round2(item.quantity * item.unitPrice);
}

export interface InvoiceTotals {
  goodsTotal: number;
  freight: number;
  insurance: number;
  otherCharges: number;
  invoiceTotal: number;
}

/**
 * Invoice total = goods + the charges the seller bears under the Incoterm.
 * Freight/insurance entered on an EXW/FCA/FOB/FAS shipment are shown for
 * information but are not added (the buyer pays them), which the
 * validation engine flags separately.
 */
export function invoiceTotals(s: Pick<Shipment, 'items' | 'freight' | 'insurance' | 'otherCharges' | 'incoterm'>): InvoiceTotals {
  const goodsTotal = round2(s.items.reduce((sum, i) => sum + lineTotal(i), 0));
  const sellerPaysFreight = !['EXW', 'FCA', 'FAS', 'FOB'].includes(s.incoterm);
  const sellerPaysInsurance = ['CIF', 'CIP', 'DAP', 'DPU', 'DDP'].includes(s.incoterm);
  const freight = sellerPaysFreight ? round2(s.freight) : 0;
  const insurance = sellerPaysInsurance ? round2(s.insurance) : 0;
  const otherCharges = round2(s.otherCharges);
  return {
    goodsTotal,
    freight,
    insurance,
    otherCharges,
    invoiceTotal: round2(goodsTotal + freight + insurance + otherCharges),
  };
}

export function formatMoney(amount: number, currency: Currency): string {
  const digits = currency === 'RWF' || currency === 'UGX' || currency === 'TZS' ? 0 : 2;
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
