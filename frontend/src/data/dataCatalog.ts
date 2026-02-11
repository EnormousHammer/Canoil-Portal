/**
 * DataCatalog - what data exists + counts
 * Use for: capability detection, "Not available in this snapshot", debugging
 */

import type { FullCompanyData } from "../types/fullCompanyData";

export type DataCatalogEntry = {
  key: string;
  count: number;
  available: boolean;
};

export type DataCatalog = {
  entries: DataCatalogEntry[];
  byKey: Map<string, number>;
  /** True if this dataset has MO data */
  hasMO: boolean;
  /** True if this dataset has PO data */
  hasPO: boolean;
  /** True if this dataset has BOM data */
  hasBOM: boolean;
  /** True if this dataset has lot/serial trace */
  hasLotTrace: boolean;
  /** True if this dataset has item/inventory data */
  hasItems: boolean;
  /** True if this dataset has transaction log (MILOG*) */
  hasTransactions: boolean;
};

const KNOWN_KEYS = [
  "CustomAlert5.json",
  "Items.json",
  "MIITEM.json",
  "MIILOCQT.json",
  "MIBINQ.json",
  "MILOGH.json",
  "MILOGD.json",
  "MILOGB.json",
  "LotSerialHistory.json",
  "MISLHIST.json",
  "MISLBINQ.json",
  "ManufacturingOrderHeaders.json",
  "ManufacturingOrderDetails.json",
  "MIMOH.json",
  "MIMOMD.json",
  "PurchaseOrders.json",
  "PurchaseOrderDetails.json",
  "MIPOH.json",
  "MIPOD.json",
  "BillsOfMaterial.json",
  "BillOfMaterialDetails.json",
  "MIBOMH.json",
  "MIBOMD.json",
  "MIICST.json",
  "MISUPL.json",
  "MIQSUP.json",
  "Jobs.json",
  "JobDetails.json",
  "WorkOrderDetails.json",
];

export function buildDataCatalog(data: FullCompanyData | undefined): DataCatalog {
  const byKey = new Map<string, number>();
  const entries: DataCatalogEntry[] = [];

  if (!data) {
    return {
      entries: [],
      byKey,
      hasMO: false,
      hasPO: false,
      hasBOM: false,
      hasLotTrace: false,
      hasItems: false,
      hasTransactions: false,
    };
  }

  const allKeys = new Set([...KNOWN_KEYS, ...Object.keys(data)]);
  for (const key of allKeys) {
    const arr = data[key];
    const count = Array.isArray(arr) ? arr.length : 0;
    byKey.set(key, count);
    entries.push({ key, count, available: count > 0 });
  }

  const hasMO =
    (byKey.get("ManufacturingOrderHeaders.json") ?? 0) > 0 ||
    (byKey.get("MIMOH.json") ?? 0) > 0;
  const hasPO =
    (byKey.get("PurchaseOrders.json") ?? 0) > 0 ||
    (byKey.get("MIPOH.json") ?? 0) > 0;
  const hasBOM =
    (byKey.get("BillOfMaterialDetails.json") ?? 0) > 0 ||
    (byKey.get("MIBOMD.json") ?? 0) > 0;
  const hasLotTrace =
    (byKey.get("LotSerialHistory.json") ?? 0) > 0 ||
    (byKey.get("MISLHIST.json") ?? 0) > 0 ||
    (byKey.get("MISLBINQ.json") ?? 0) > 0;
  const hasItems =
    (byKey.get("CustomAlert5.json") ?? 0) > 0 ||
    (byKey.get("Items.json") ?? 0) > 0 ||
    (byKey.get("MIITEM.json") ?? 0) > 0;
  const hasTransactions =
    (byKey.get("MILOGH.json") ?? 0) > 0 ||
    (byKey.get("MILOGD.json") ?? 0) > 0;

  return {
    entries,
    byKey,
    hasMO,
    hasPO,
    hasBOM,
    hasLotTrace,
    hasItems,
    hasTransactions,
  };
}
