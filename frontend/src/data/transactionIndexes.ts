/**
 * Transaction Indexes - for Inventory Log / Transaction Explorer
 * Indexed search by item, doc ref (MO/PO), lot, date - no filtering arrays in render
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import { getDataset } from "./getDataset";
import { toStr, toUpper, toNum } from "./utils";
import { parseDateToISO } from "../utils/dateUtils";

export type TxView = {
  date: string;
  type: string;
  itemNo: string;
  desc?: string;
  qty: number;
  uom?: string;
  location?: string;
  bin?: string;
  lot?: string;
  serial?: string;
  reference?: string;
  user?: string;
  cost?: number;
  _src: "MILOGH" | "MISLTH";
  raw: any;
};

function normTx(r: any, src: "MILOGH" | "MISLTH"): TxView {
  const rawDate = toStr(r["Transaction Date"] ?? r["tranDate"] ?? r["transDate"] ?? r["tranDt"] ?? r["transDt"] ?? "");
  const date = parseDateToISO(rawDate) || rawDate;
  const type = toStr(r["Type"] ?? r["type"] ?? "");
  const itemNo = toStr(r["Item No."] ?? r["itemId"] ?? r["partId"] ?? r["prntItemId"] ?? "");
  const qty = toNum(r["Quantity"] ?? r["qty"] ?? r["trnQty"] ?? 0);
  const loc = toStr(r["Location No."] ?? r["locId"] ?? "");
  const bin = toStr(r["Bin No."] ?? r["binId"] ?? "");
  const lot = toStr(r["Lot No."] ?? r["lotId"] ?? r["SL No."] ?? "");
  const serial = toStr(r["Serial No."] ?? r["serialNo"] ?? "");
  const user = toStr(r["User"] ?? r["User ID"] ?? r["userId"] ?? "");
  const ref =
    toStr(r["Mfg. Order No."] ?? r["xvarMOId"] ?? r["mohId"] ?? "") ||
    toStr(r["PO No."] ?? r["xvarPOId"] ?? r["poId"] ?? "") ||
    toStr(r["Job No."] ?? r["jobId"] ?? "") ||
    toStr(r["Work Order No."] ?? r["xvarWOId"] ?? "") ||
    toStr(r["Entry"] ?? r["entry"] ?? "");
  const desc = toStr(r["Detail"] ?? r["detail"] ?? r["Comment"] ?? r["comment"] ?? "");
  const uom = toStr(r["UOM"] ?? r["uom"] ?? "");
  const cost = toNum(r["Cost"] ?? r["cost"] ?? 0);

  return {
    date,
    type,
    itemNo,
    desc: desc || undefined,
    qty,
    uom: uom || undefined,
    location: loc || undefined,
    bin: bin || undefined,
    lot: lot || undefined,
    serial: serial || undefined,
    reference: ref || undefined,
    user: user || undefined,
    cost: cost || undefined,
    _src: src,
    raw: r,
  };
}

export type TransactionIndexes = {
  txByItemNo: Map<string, TxView[]>;
  txByDocRef: Map<string, TxView[]>;
  txByLot: Map<string, TxView[]>;
  txBySerial: Map<string, TxView[]>;
  txByDateBucket: Map<string, TxView[]>;
  allTx: TxView[];
};

function addToMap<K>(m: Map<K, TxView[]>, k: K, tx: TxView) {
  if (!k) return;
  const key = typeof k === "string" ? (k as string).trim() : k;
  if (!key) return;
  if (!m.has(key)) m.set(key, []);
  m.get(key)!.push(tx);
}

function dateBucket(date: string): string {
  if (!date) return "";
  const d = date.slice(0, 10);
  return d.replace(/-/g, "") || "";
}

export function buildTransactionIndexes(
  data: FullCompanyData | undefined
): TransactionIndexes {
  const txByItemNo = new Map<string, TxView[]>();
  const txByDocRef = new Map<string, TxView[]>();
  const txByLot = new Map<string, TxView[]>();
  const txBySerial = new Map<string, TxView[]>();
  const txByDateBucket = new Map<string, TxView[]>();
  const allTx: TxView[] = [];

  const milogh = getDataset<any>(data, ["MILOGH.json"]);
  const lotSerialHistory = getDataset<any>(data, [
    "LotSerialHistory.json",
    "MISLTH.json",
  ]);

  for (const r of milogh) {
    const tx = normTx(r, "MILOGH");
    allTx.push(tx);
    addToMap(txByItemNo, toUpper(tx.itemNo), tx);
    addToMap(txByDocRef, toStr(tx.reference), tx);
    addToMap(txByLot, toUpper(tx.lot ?? ""), tx);
    addToMap(txBySerial, toUpper(tx.serial ?? ""), tx);
    addToMap(txByDateBucket, dateBucket(tx.date), tx);
  }

  for (const r of lotSerialHistory) {
    const tx = normTx(r, "MISLTH");
    allTx.push(tx);
    const itemKey = toUpper(tx.itemNo);
    if (itemKey) addToMap(txByItemNo, itemKey, tx);
    addToMap(txByLot, toUpper(tx.lot ?? ""), tx);
    addToMap(txBySerial, toUpper(tx.serial ?? ""), tx);
    addToMap(txByDateBucket, dateBucket(tx.date), tx);
  }

  allTx.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    txByItemNo,
    txByDocRef,
    txByLot,
    txBySerial,
    txByDateBucket,
    allTx,
  };
}
