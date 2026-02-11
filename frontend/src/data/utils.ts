/**
 * Data layer utils - canonical toStr/toNum for consistent parsing
 * All view builders and indexes should use these
 */

export function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function toUpper(v: unknown): string {
  return toStr(v).toUpperCase();
}

export function toNum(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).replace(/[$,]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
