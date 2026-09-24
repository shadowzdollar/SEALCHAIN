export const COUNTRY_NAME: Record<string, string> = {
  RW: 'Rwanda', KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', BI: 'Burundi', SS: 'South Sudan', CD: 'DR Congo', SO: 'Somalia',
};

export const COUNTRY_FLAG: Record<string, string> = {
  RW: '🇷🇼', KE: '🇰🇪', UG: '🇺🇬', TZ: '🇹🇿', BI: '🇧🇮', SS: '🇸🇸', CD: '🇨🇩', SO: '🇸🇴',
};

export function money(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const digits = ['RWF', 'UGX', 'TZS'].includes(currency) ? 0 : 2;
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function cents(c: number, currency = 'USD'): string {
  return money(c / 100, currency);
}

export function num(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 3) });
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: iso.length === 10 ? 'UTC' : undefined });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return date(iso);
}

export function shortHash(h: string | null | undefined, n = 10): string {
  if (!h) return '—';
  const x = h.startsWith('0x') ? h.slice(2) : h;
  return `${x.slice(0, n)}…${x.slice(-6)}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
