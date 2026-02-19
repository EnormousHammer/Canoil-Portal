/**
 * Lot Trace View Builder - MiSys-style lot/serial traceability
 * Returns UI-ready data: lot master + timeline from LotSerialHistory + current qty by location/bin
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import { getDataset } from "../data/getDataset";
import { parseDateToISO } from "../utils/dateUtils";

function toStr(v: any): string {
  return (v ?? "").toString().trim();
}
function toNum(v: any): number {
  const n = Number((v ?? "").toString().replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export type LotMovementRow = {
  date: string;
  userId?: string;
  entry?: string;
  detail?: string;
  qty?: number;
  type?: string;
  poNo?: string;
  moNo?: string;
  locId?: string;
  raw: any;
};

export type LotQtyByBin = {
  location: string;
  bin: string;
  qty: number;
};

export type LotTraceView = {
  lotNo: string;
  parentItemNo: string;
  parentItemDesc?: string;
  /** Movements from LotSerialHistory / MISLTH - sorted by date desc */
  movements: LotMovementRow[];
  /** Current qty by location/bin from MISLBINQ */
  qtyByBin: LotQtyByBin[];
  totalQty: number;
  rawLotMaster: any;
};

export function buildLotTraceView(
  data: FullCompanyData | undefined,
  lotNoRaw: string
): LotTraceView | null {
  const lotNo = toStr(lotNoRaw);
  if (!lotNo) return null;

  const lotHist = getDataset<any>(data, ["MISLHIST.json", "LotSerialHistory.json"]);
  const lotMaster = lotHist.find(
    (r) =>
      toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]) === lotNo ||
      toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]).toUpperCase() === lotNo.toUpperCase()
  );

  const parentItemNo = toStr(
    lotMaster?.["Item No."] ?? lotMaster?.["itemId"] ?? lotMaster?.["prntItemId"] ?? lotMaster?.["Parent Item No."] ?? ""
  );

  const lotSerialHistory = getDataset<any>(data, ["LotSerialHistory.json", "MISLTH.json"]);
  const movements: LotMovementRow[] = lotSerialHistory
    .filter(
      (r) =>
        toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]) === lotNo ||
        toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]).toUpperCase() === lotNo.toUpperCase()
    )
    .map((r) => {
      const rawDate = toStr(r["Transaction Date"] ?? r["tranDate"] ?? r["transDate"] ?? r["tranDt"] ?? r["transDt"] ?? "");
      return {
        date: parseDateToISO(rawDate) || rawDate,
        userId: toStr(r["User ID"] ?? r["userId"] ?? ""),
        entry: toStr(r["Entry"] ?? r["entry"] ?? ""),
        detail: toStr(r["Detail"] ?? r["detail"] ?? ""),
        qty: toNum(r["Quantity"] ?? r["qty"] ?? 0),
        type: toStr(r["Type"] ?? r["type"] ?? ""),
        poNo: toStr(r["PO No."] ?? r["xvarPOId"] ?? r["poId"] ?? ""),
        moNo: toStr(r["Mfg. Order No."] ?? r["xvarMOId"] ?? r["mohId"] ?? ""),
        locId: toStr(r["Location No."] ?? r["locId"] ?? ""),
        raw: r,
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const mislbinq = getDataset<any>(data, ["MISLBINQ.json"]);
  const qtyByBin: LotQtyByBin[] = mislbinq
    .filter(
      (r) =>
        toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]) === lotNo ||
        toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."]).toUpperCase() === lotNo.toUpperCase()
    )
    .map((r) => ({
      location: toStr(r["Location No."] ?? r["locId"] ?? ""),
      bin: toStr(r["Bin No."] ?? r["binId"] ?? ""),
      qty: toNum(r["On Hand"] ?? r["qStk"] ?? r["Quantity"] ?? r["qty"] ?? 0),
    }));

  const totalQty = qtyByBin.reduce((s, b) => s + b.qty, 0);

  const items = getDataset<any>(data, ["CustomAlert5.json", "Items.json", "MIITEM.json"]);
  const parentItem = items.find((i) => {
    const k = toStr(i["Item No."] ?? i["itemId"] ?? "").toUpperCase();
    return k === parentItemNo.toUpperCase();
  });
  const parentItemDesc = toStr(parentItem?.["Description"] ?? parentItem?.["descr"] ?? "");

  return {
    lotNo,
    parentItemNo,
    parentItemDesc,
    movements,
    qtyByBin,
    totalQty,
    rawLotMaster: lotMaster ?? {},
  };
}
