/**
 * getDataset - Safe dataset access with fallback keys
 * Prevents "wrong key name" bugs when MiSys export columns/shift or file names vary
 */

import type { FullCompanyData } from "../types/fullCompanyData";

export function getDataset<T = any>(
  data: FullCompanyData | undefined,
  keys: string[]
): T[] {
  if (!data) return [];
  for (const k of keys) {
    const v = data[k];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}
