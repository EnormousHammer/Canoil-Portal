/**
 * Serial Trace View Builder - MiSys-style serial traceability
 * Returns UI-ready data: serial master + timeline + current location
 * Degrades gracefully if MISL tables are missing.
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import { getDataset } from "../data/getDataset";
import { toStr, toUpper, toNum } from "../data/utils";

export type SerialTimelineRow = {
  date: string;
  userId?: string;
  type?: string;
  qty?: number;
  location?: string;
  lot?: string;
  raw: any;
};

export type SerialTraceView = {
  serialNo: string;
  itemNo: string;
  itemDesc?: string;
  lotNo?: string;
  currentLocation?: string;
  currentBin?: string;
  timeline: SerialTimelineRow[];
  rawMaster: any;
};

export function buildSerialTraceView(
  data: FullCompanyData | undefined,
  serialNoRaw: string
): SerialTraceView | null {
  const serialNo = toStr(serialNoRaw);
  if (!serialNo) return null;

  const lotSerialDetail = getDataset<any>(data, [
    "LotSerialDetail.json",
    "MISLTD.json",
  ]);
  const master = lotSerialDetail.find(
    (r) =>
      toStr(r["Serial No."] ?? r["serialNo"] ?? r["SL No."]).toUpperCase() ===
      serialNo.toUpperCase()
  );

  const itemNo = toStr(
    master?.["Item No."] ?? master?.["itemId"] ?? master?.["Parent Item No."] ?? master?.["prntItemId"] ?? ""
  );

  const lotSerialHistory = getDataset<any>(data, [
    "LotSerialHistory.json",
    "MISLTH.json",
  ]);
  const timeline: SerialTimelineRow[] = lotSerialHistory
    .filter(
      (r) =>
        toStr(r["Serial No."] ?? r["serialNo"] ?? r["SL No."]).toUpperCase() === serialNo.toUpperCase()
    )
    .map((r) => ({
      date: toStr(r["Transaction Date"] ?? r["tranDate"] ?? r["transDate"] ?? ""),
      userId: toStr(r["User ID"] ?? r["userId"] ?? ""),
      type: toStr(r["Type"] ?? r["type"] ?? ""),
      qty: toNum(r["Quantity"] ?? r["qty"] ?? 0),
      location: toStr(r["Location No."] ?? r["locId"] ?? ""),
      lot: toStr(r["Lot No."] ?? r["lotId"] ?? ""),
      raw: r,
    }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const mislbinq = getDataset<any>(data, ["MISLBINQ.json"]);
  const binRow = mislbinq.find(
    (r) =>
      toStr(r["Serial No."] ?? r["serialNo"] ?? r["SL No."]).toUpperCase() === serialNo.toUpperCase()
  );
  const currentLocation = toStr(binRow?.["Location No."] ?? binRow?.["locId"] ?? "");
  const currentBin = toStr(binRow?.["Bin No."] ?? binRow?.["binId"] ?? "");
  const lotNo = toStr(master?.["Lot No."] ?? master?.["lotId"] ?? binRow?.["Lot No."] ?? "");

  const items = getDataset<any>(data, [
    "CustomAlert5.json",
    "Items.json",
    "MIITEM.json",
  ]);
  const item = items.find(
    (i) => toUpper(i["Item No."] ?? i["itemId"] ?? "") === itemNo.toUpperCase()
  );
  const itemDesc = toStr(item?.["Description"] ?? item?.["descr"] ?? "");

  return {
    serialNo,
    itemNo,
    itemDesc,
    lotNo: lotNo || undefined,
    currentLocation: currentLocation || undefined,
    currentBin: currentBin || undefined,
    timeline,
    rawMaster: master ?? {},
  };
}
