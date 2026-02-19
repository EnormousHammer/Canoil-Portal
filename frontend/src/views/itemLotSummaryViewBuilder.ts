/**
 * Item Lot Summary View Builder - Lots for an item with qty by loc/bin, last move, expiry
 * Degrades gracefully if MISL tables are missing.
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import { getDataset } from "../data/getDataset";
import { toStr, toUpper, toNum } from "../data/utils";
import { parseDateToISO } from "../utils/dateUtils";

export type LotOnHandByLocBin = {
  location: string;
  bin: string;
  qty: number;
};

export type ItemLotSummaryRow = {
  lotNo: string;
  onHandByLocBin: LotOnHandByLocBin[];
  totalQty: number;
  lastMoveDate?: string;
  expiry?: string;
  serialCount?: number;
};

export type LotSerialDetailRow = {
  lotNo: string;
  serialNo: string;
  qty: number;
  description?: string;
  status?: string;
  expiry?: string;
  raw: any;
};

export type LotHistoryRow = {
  lotNo: string;
  date: string;
  userId?: string;
  qty: number;
  location?: string;
  raw: any;
};

export type ItemLotSummaryView = {
  itemNo: string;
  lots: ItemLotSummaryRow[];
  /** LotSerialDetail rows for serial-level table */
  serialRows: LotSerialDetailRow[];
  /** MISLHIST rows for lot history timeline */
  lotHistoryRows: LotHistoryRow[];
  hasData: boolean;
};

function matchLotSerial(r: any, itemNoUpper: string): boolean {
  const id = toUpper(r["Item No."] ?? r["itemId"] ?? "");
  const prnt = toUpper(r["Parent Item No."] ?? r["prntItemId"] ?? "");
  return id === itemNoUpper || prnt === itemNoUpper;
}

export function buildItemLotSummaryView(
  data: FullCompanyData | undefined,
  itemNoRaw: string
): ItemLotSummaryView {
  const itemNo = toStr(itemNoRaw);
  const itemNoUpper = itemNo.toUpperCase();
  if (!itemNo) return { itemNo: "", lots: [], serialRows: [], lotHistoryRows: [], hasData: false };

  const mislbinq = getDataset<any>(data, ["MISLBINQ.json"]);
  const lotHist = getDataset<any>(data, ["MISLHIST.json", "LotSerialHistory.json"]);
  const lotSerialDetail = getDataset<any>(data, [
    "LotSerialDetail.json",
    "MISLTD.json",
  ]);

  const binsByLot = new Map<string, LotOnHandByLocBin[]>();
  for (const r of mislbinq) {
    if (!matchLotSerial(r, itemNoUpper)) continue;
    const lotNo = toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]);
    if (!lotNo) continue;
    const loc = toStr(r["Location No."] ?? r["locId"] ?? "");
    const bin = toStr(r["Bin No."] ?? r["binId"] ?? "");
    const qty = toNum(r["On Hand"] ?? r["qStk"] ?? r["Quantity"] ?? r["qty"] ?? 0);
    if (!binsByLot.has(lotNo)) binsByLot.set(lotNo, []);
    binsByLot.get(lotNo)!.push({ location: loc, bin, qty });
  }

  const lastMoveByLot = new Map<string, string>();
  for (const r of lotHist) {
    if (!matchLotSerial(r, itemNoUpper)) continue;
    const lotNo = toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]);
    if (!lotNo) continue;
    const date = toStr(r["Transaction Date"] ?? r["tranDate"] ?? r["tranDt"] ?? "");
    const prev = lastMoveByLot.get(lotNo) ?? "";
    if (date > prev) lastMoveByLot.set(lotNo, date);
  }

  const expiryByLot = new Map<string, string>();
  const serialCountByLot = new Map<string, number>();
  for (const r of lotSerialDetail) {
    if (!matchLotSerial(r, itemNoUpper)) continue;
    const lotNo = toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]);
    const serial = toStr(r["Serial No."] ?? r["serialNo"] ?? "");
    const exp = toStr(r["Expiration Date"] ?? r["expDate"] ?? r["expiry"] ?? "");
    if (lotNo) {
      if (serial) serialCountByLot.set(lotNo, (serialCountByLot.get(lotNo) ?? 0) + 1);
      if (exp) expiryByLot.set(lotNo, exp);
    }
  }

  const lotNos = new Set<string>([
    ...binsByLot.keys(),
    ...lastMoveByLot.keys(),
    ...expiryByLot.keys(),
  ]);

  const lots: ItemLotSummaryRow[] = Array.from(lotNos).map((lotNo) => {
    const locBins = binsByLot.get(lotNo) ?? [];
    const totalQty = locBins.reduce((s, b) => s + b.qty, 0);
    return {
      lotNo,
      onHandByLocBin: locBins,
      totalQty,
      lastMoveDate: lastMoveByLot.get(lotNo),
      expiry: expiryByLot.get(lotNo),
      serialCount: serialCountByLot.get(lotNo),
    };
  });

  lots.sort((a, b) => (b.lastMoveDate ?? "").localeCompare(a.lastMoveDate ?? ""));

  const serialRows: LotSerialDetailRow[] = [];
  for (const r of lotSerialDetail) {
    if (!matchLotSerial(r, itemNoUpper)) continue;
    const lotNo = toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]);
    const serialNo = toStr(r["Serial No."] ?? r["serialNo"] ?? "");
    const qty = toNum(r["Quantity"] ?? r["qty"] ?? r["Quantity in Stock"] ?? 0);
    serialRows.push({
      lotNo,
      serialNo,
      qty,
      description: toStr(r["Description"] ?? r["descr"] ?? ""),
      status: toStr(r["Status"] ?? r["status"] ?? ""),
      expiry: toStr(r["Expiration Date"] ?? r["expDate"] ?? ""),
      raw: r,
    });
  }

  const lotHistoryRows: LotHistoryRow[] = lotHist
    .filter((r) => matchLotSerial(r, itemNoUpper))
    .map((r) => ({
      lotNo: toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."] ?? ""),
      date: (() => { const raw = toStr(r["Transaction Date"] ?? r["tranDate"] ?? r["tranDt"] ?? r["transDate"] ?? r["transDt"] ?? ""); return parseDateToISO(raw) || raw; })(),
      userId: toStr(r["User"] ?? r["User ID"] ?? r["userId"] ?? ""),
      qty: toNum(r["Quantity"] ?? r["qty"] ?? 0),
      location: toStr(r["Location No."] ?? r["locId"] ?? ""),
      raw: r,
    }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    itemNo,
    lots,
    serialRows,
    lotHistoryRows,
    hasData: lots.length > 0 || serialRows.length > 0 || lotHistoryRows.length > 0,
  };
}
