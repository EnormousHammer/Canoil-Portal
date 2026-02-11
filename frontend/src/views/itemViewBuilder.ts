/**
 * Item View Builder - MiSys-style Item master click-through
 * Returns UI-ready data: item master + stock (MIILOCQT + MIBINQ) + transactions (MILOG*) + cost history + lots
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import type { DataIndexes } from "../data/indexes";
import { getDataset } from "../data/getDataset";

function toStr(v: any): string {
  return (v ?? "").toString().trim();
}
function toUpper(v: any): string {
  return toStr(v).toUpperCase();
}
function toNum(v: any): number {
  const n = Number((v ?? "").toString().replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export type ItemStockByLocation = {
  location: string;
  onHand: number;
  wip: number;
  reserve: number;
  onOrder: number;
};

export type ItemBinRow = {
  location: string;
  bin: string;
  onHand: number;
};

export type ItemTransactionRow = {
  date: string;
  userId?: string;
  qty?: number;
  locId?: string;
  type?: string;
  entry?: string;
  comment?: string;
  poNo?: string;
  moNo?: string;
  raw: any;
};

export type ItemCostHistoryRow = {
  date: string;
  location?: string;
  cost: number;
  poNo?: string;
  qtyReceived?: number;
  raw: any;
};

export type ItemView = {
  itemNo: string;
  description: string;
  /** From CustomAlert5/Items - build item desc when modal shows build item */
  stock: number;
  wip: number;
  reserve: number;
  onOrder: number;
  recentCost: number;
  standardCost: number;
  unitCost: number;
  reorderLevel: number;
  reorderQuantity: number;
  itemType?: string;
  stockingUnit?: string;
  /** By location (MIILOCQT) - latest per loc */
  stockByLocation: ItemStockByLocation[];
  /** By bin (MIBINQ) */
  bins: ItemBinRow[];
  /** Transactions (MILOGH) - sorted by date desc */
  transactions: ItemTransactionRow[];
  /** Cost history (MIICST) */
  costHistory: ItemCostHistoryRow[];
  /** Lot/serial summary count - from MISLHIST/LotSerialHistory */
  lotCount: number;
  /** LotSerialHistory rows for this item (for History tab merge) */
  lotHistory: any[];
  /** Merged MILOGH + LotSerialHistory for History tab (with _src) */
  mergedHistory: Array<{ date: string; userId?: string; type?: string; qty?: number; locId?: string; moNo?: string; poNo?: string; _src: string; raw: any }>;
  rawItem: any;
};

export function buildItemView(
  data: FullCompanyData | undefined,
  indexes: DataIndexes,
  itemNoRaw: string
): ItemView | null {
  const itemNo = toStr(itemNoRaw);
  const itemNoUpper = toUpper(itemNo);
  if (!itemNo) return null;

  const item = indexes.alertByItemNo.get(itemNoUpper) ?? indexes.itemByNo.get(itemNoUpper);
  if (!item) return null;

  const stock = toNum(item["Stock"] ?? item["totQStk"] ?? item["On Hand"] ?? 0);
  const wip = toNum(item["WIP"] ?? item["totQWip"] ?? 0);
  const reserve = toNum(item["Reserve"] ?? item["totQRes"] ?? 0);
  const onOrder = toNum(item["On Order"] ?? item["totQOrd"] ?? 0);
  const recentCost = toNum(
    String(item["Recent Cost"] ?? item["cLast"] ?? item["Last Cost"] ?? 0).replace(/[$,]/g, "")
  );
  const standardCost = toNum(
    String(item["Standard Cost"] ?? item["cStd"] ?? 0).replace(/[$,]/g, "")
  );
  const unitCost = toNum(
    String(item["Unit Cost"] ?? item["itemCost"] ?? 0).replace(/[$,]/g, "")
  );
  const reorderLevel = toNum(item["Reorder Level"] ?? item["ordLvl"] ?? 0);
  const reorderQuantity = toNum(item["Reorder Quantity"] ?? item["ordQty"] ?? 0);
  const description = toStr(item["Description"] ?? item["descr"] ?? "—");
  const itemType = toStr(item["Item Type"] ?? item["type"] ?? "");
  const stockingUnit = toStr(item["Stocking Units"] ?? item["uOfM"] ?? "EA");

  const ilocqt = indexes.ilocqtByItemNo.get(itemNoUpper) ?? [];
  const latestByLoc: Record<string, { onHand: number; wip: number; reserve: number; onOrder: number; _date: string }> = {};
  for (const r of ilocqt) {
    const loc = toStr(r["Location No."] ?? r["locId"] ?? "");
    if (!loc) continue;
    const dateKey = toStr(r["Date ISO"] ?? r["dateISO"] ?? r["Date"] ?? "");
    const onHand = toNum(r["On Hand"] ?? r["qStk"] ?? 0);
    const w = toNum(r["WIP"] ?? r["qWip"] ?? 0);
    const res = toNum(r["Reserve"] ?? r["qRes"] ?? 0);
    const ord = toNum(r["On Order"] ?? r["qOrd"] ?? 0);
    if (!latestByLoc[loc] || dateKey > (latestByLoc[loc]._date ?? "")) {
      latestByLoc[loc] = { onHand, wip: w, reserve: res, onOrder: ord, _date: dateKey };
    }
  }
  const stockByLocation: ItemStockByLocation[] = Object.entries(latestByLoc).map(([loc, v]) => ({
    location: loc,
    onHand: v.onHand,
    wip: v.wip,
    reserve: v.reserve,
    onOrder: v.onOrder,
  }));

  const mibinq = indexes.mibinqByItemNo.get(itemNoUpper) ?? [];
  const bins: ItemBinRow[] = mibinq.map((r) => ({
    location: toStr(r["Location No."] ?? r["locId"] ?? ""),
    bin: toStr(r["Bin No."] ?? r["binId"] ?? ""),
    onHand: toNum(r["On Hand"] ?? r["qStk"] ?? 0),
  }));

  const milogh = indexes.miloghByItemNo.get(itemNoUpper) ?? [];
  const transactions: ItemTransactionRow[] = milogh
    .map((r) => ({
      date: toStr(r["Transaction Date"] ?? r["tranDate"] ?? r["transDate"] ?? ""),
      userId: toStr(r["User ID"] ?? r["userId"] ?? ""),
      qty: toNum(r["Quantity"] ?? r["qty"] ?? r["trnQty"] ?? 0),
      locId: toStr(r["Location No."] ?? r["locId"] ?? ""),
      type: toStr(r["Type"] ?? r["type"] ?? ""),
      entry: toStr(r["Entry"] ?? r["entry"] ?? ""),
      comment: toStr(r["Comment"] ?? r["comment"] ?? ""),
      poNo: toStr(r["PO No."] ?? r["xvarPOId"] ?? r["poId"] ?? ""),
      moNo: toStr(r["Mfg. Order No."] ?? r["xvarMOId"] ?? r["mohId"] ?? ""),
      raw: r,
    }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const miicst = indexes.miicstByItemNo.get(itemNoUpper) ?? [];
  const costHistory: ItemCostHistoryRow[] = miicst
    .map((r) => ({
      date: toStr(r["Transaction Date"] ?? r["transDate"] ?? r["transDt"] ?? ""),
      location: toStr(r["Location No."] ?? r["locId"] ?? ""),
      cost: toNum(String(r["Cost"] ?? r["cost"] ?? 0).replace(/[$,]/g, "")),
      poNo: toStr(r["PO No."] ?? r["poId"] ?? ""),
      qtyReceived: toNum(r["Qty Received"] ?? r["qRecd"] ?? 0),
      raw: r,
    }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const lotHist = getDataset<any>(data, ["MISLHIST.json", "LotSerialHistory.json"]);
  const lotSerialHistory = getDataset<any>(data, ["LotSerialHistory.json", "MISLTH.json"]);
  const lotCount = lotHist.filter(
    (r) => toUpper(r["Item No."] ?? r["itemId"] ?? r["prntItemId"] ?? "") === itemNoUpper
  ).length;
  const lotHistory = lotSerialHistory.filter(
    (r) => toUpper(r["Item No."] ?? r["itemId"] ?? r["prntItemId"] ?? "") === itemNoUpper
  );

  const mergedHistory = [
    ...transactions.map((t) => ({ ...t, _src: "MILOGH" as const })),
    ...lotHistory.map((r) => ({
      date: toStr(r["Transaction Date"] ?? r["tranDate"] ?? r["transDate"] ?? ""),
      userId: toStr(r["User ID"] ?? r["userId"] ?? ""),
      type: toStr(r["Type"] ?? r["type"] ?? ""),
      qty: toNum(r["Quantity"] ?? r["qty"] ?? r["trnQty"] ?? 0),
      locId: toStr(r["Location No."] ?? r["locId"] ?? ""),
      moNo: toStr(r["Mfg. Order No."] ?? r["xvarMOId"] ?? r["mohId"] ?? ""),
      poNo: toStr(r["PO No."] ?? r["xvarPOId"] ?? r["poId"] ?? ""),
      _src: "MISLTH" as const,
      raw: r,
    })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    itemNo,
    description,
    stock,
    wip,
    reserve,
    onOrder,
    recentCost,
    standardCost,
    unitCost,
    reorderLevel,
    reorderQuantity,
    itemType,
    stockingUnit,
    stockByLocation,
    bins,
    transactions,
    costHistory,
    lotCount,
    lotHistory,
    mergedHistory,
    rawItem: item,
  };
}
