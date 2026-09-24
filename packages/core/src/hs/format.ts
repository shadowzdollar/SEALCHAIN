/** "09011100" -> "0901.11.00" */
export function formatHs(code: string): string {
  const d = code.replace(/\D/g, '');
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

/** Accepts "0901.11.00", "0901 11 00", "090111" etc. Returns digits only. */
export function normalizeHs(input: string): string {
  return input.replace(/\D/g, '');
}

export function hsChapter(code: string): number {
  return Number(normalizeHs(code).slice(0, 2));
}

export function hsHeading(code: string): string {
  return normalizeHs(code).slice(0, 4);
}
