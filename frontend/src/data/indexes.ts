/**
 * Data Indexes - Build once on load so UI stays fast (165k+ rows)
 * Avoids repeated .filter() over large arrays inside render
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import { getDataset } from "./getDataset";
import { toStr, toUpper, toNum } from "./utils";

export type StockByItemEntry = {
  onHand: number;
  wip: number;
  reserve: number;
  onOrder: number;
  /** available = onHand - reserve (unallocated) */
  available: number;
};

export type DataIndexes = {
  itemByNo: Map<string, any>;
  alertByItemNo: Map<string, any>;

  moHeaderByNo: Map<string, any>;
  moDetailsByNo: Map<string, any[]>;

  poHeaderByNo: Map<string, any>;
  poLinesByNo: Map<string, any[]>;

  bomHeadersByParent: Map<string, any[]>;
  bomDetailsByParent: Map<string, any[]>;
  /** BOM details where this item is the component (for Where Used) */
  bomWhereUsedByComponent: Map<string, any[]>;

  /** MIILOCQT rows per item - for Item → Locations drilldown */
  ilocqtByItemNo: Map<string, any[]>;
  /** MIBINQ rows per item - for Item → Bins drilldown */
  mibinqByItemNo: Map<string, any[]>;
  /** MILOGH rows per item - for Transaction Trace */
  miloghByItemNo: Map<string, any[]>;
  /** MIICST rows per item - for Cost History */
  miicstByItemNo: Map<string, any[]>;
  /** MISUPL supplier master by id */
  misuplById: Map<string, any>;
  /** Precomputed stock summary per item - for shortage logic, availability checks */
  stockByItem: Map<string, StockByItemEntry>;
};

export function buildIndexes(data: FullCompanyData | undefined): DataIndexes {
  const items = getDataset<any>(data, [
    "CustomAlert5.json",
    "Items.json",
    "MIITEM.json",
  ]);
  const alerts = getDataset<any>(data, ["CustomAlert5.json"]);

  const moHeaders = getDataset<any>(data, [
    "ManufacturingOrderHeaders.json",
    "MIMOH.json",
  ]);
  const moDetails = getDataset<any>(data, [
    "ManufacturingOrderDetails.json",
    "MIMOMD.json",
  ]);

  const poHeaders = getDataset<any>(data, ["MIPOH.json", "PurchaseOrders.json"]);
  const poLines = getDataset<any>(data, [
    "MIPOD.json",
    "PurchaseOrderDetails.json",
  ]);

  const bomHeaders = getDataset<any>(data, [
    "BillsOfMaterial.json",
    "MIBOMH.json",
  ]);
  const bomDetails = getDataset<any>(data, [
    "BillOfMaterialDetails.json",
    "MIBOMD.json",
  ]);

  const ilocqt = getDataset<any>(data, ["MIILOCQT.json"]);
  const mibinq = getDataset<any>(data, ["MIBINQ.json"]);
  const milogh = getDataset<any>(data, ["MILOGH.json"]);
  const miicst = getDataset<any>(data, ["MIICST.json"]);
  const misuplRows = getDataset<any>(data, ["MISUPL.json"]);

  const itemByNo = new Map<string, any>();
  for (const r of items) {
    const k = toUpper(r["Item No."] ?? r["Item"] ?? r["ItemNo"] ?? r["Item_No"]);
    if (k) itemByNo.set(k, r);
  }

  const alertByItemNo = new Map<string, any>();
  for (const r of alerts) {
    const k = toUpper(r["Item No."] ?? r["Item"] ?? r["ItemNo"]);
    if (k) alertByItemNo.set(k, r);
  }

  const moHeaderByNo = new Map<string, any>();
  for (const r of moHeaders) {
    const k = toStr(
      r["Mfg. Order No."] ?? r["MO No."] ?? r["MO"] ?? r["MfgOrderNo"] ?? r["mohId"]
    );
    if (k) moHeaderByNo.set(k, r);
  }

  const moDetailsByNo = new Map<string, any[]>();
  for (const r of moDetails) {
    const k = toStr(
      r["Mfg. Order No."] ?? r["MO No."] ?? r["MO"] ?? r["MfgOrderNo"] ?? r["mohId"]
    );
    if (!k) continue;
    if (!moDetailsByNo.has(k)) moDetailsByNo.set(k, []);
    moDetailsByNo.get(k)!.push(r);
  }

  const poHeaderByNo = new Map<string, any>();
  for (const r of poHeaders) {
    const k = toStr(
      r["PO No."] ?? r["Purchase Order No."] ?? r["PO"] ?? r["PONo"] ?? r["pohId"]
    );
    if (k) poHeaderByNo.set(k, r);
  }

  const poLinesByNo = new Map<string, any[]>();
  for (const r of poLines) {
    const k = toStr(
      r["PO No."] ?? r["Purchase Order No."] ?? r["PO"] ?? r["PONo"] ?? r["pohId"]
    );
    if (!k) continue;
    if (!poLinesByNo.has(k)) poLinesByNo.set(k, []);
    poLinesByNo.get(k)!.push(r);
  }

  const bomHeadersByParent = new Map<string, any[]>();
  for (const r of bomHeaders) {
    const parent = toUpper(
      r["Item No."] ?? r["Parent Item No."] ?? r["Parent"] ?? r["parentItem"]
    );
    if (!parent) continue;
    if (!bomHeadersByParent.has(parent)) bomHeadersByParent.set(parent, []);
    bomHeadersByParent.get(parent)!.push(r);
  }

  const bomDetailsByParent = new Map<string, any[]>();
  const bomWhereUsedByComponent = new Map<string, any[]>();
  for (const r of bomDetails) {
    const parent = toUpper(
      r["Parent Item No."] ?? r["Parent"] ?? r["Item No."] ?? r["parentItem"]
    );
    const component = toUpper(
      r["Component Item No."] ?? r["partId"] ?? r["Item No."] ?? ""
    );
    if (parent) {
      if (!bomDetailsByParent.has(parent)) bomDetailsByParent.set(parent, []);
      bomDetailsByParent.get(parent)!.push(r);
    }
    if (component) {
      if (!bomWhereUsedByComponent.has(component)) bomWhereUsedByComponent.set(component, []);
      bomWhereUsedByComponent.get(component)!.push(r);
    }
  }

  const ilocqtByItemNo = new Map<string, any[]>();
  for (const r of ilocqt) {
    const k = toUpper(r["Item No."] ?? r["itemId"] ?? r["Item"]);
    if (!k) continue;
    if (!ilocqtByItemNo.has(k)) ilocqtByItemNo.set(k, []);
    ilocqtByItemNo.get(k)!.push(r);
  }

  const mibinqByItemNo = new Map<string, any[]>();
  for (const r of mibinq) {
    const k = toUpper(r["Item No."] ?? r["itemId"] ?? r["Item"]);
    if (!k) continue;
    if (!mibinqByItemNo.has(k)) mibinqByItemNo.set(k, []);
    mibinqByItemNo.get(k)!.push(r);
  }

  const miloghByItemNo = new Map<string, any[]>();
  for (const r of milogh) {
    const k = toUpper(r["Item No."] ?? r["itemId"] ?? r["Item"]);
    if (!k) continue;
    if (!miloghByItemNo.has(k)) miloghByItemNo.set(k, []);
    miloghByItemNo.get(k)!.push(r);
  }

  const miicstByItemNo = new Map<string, any[]>();
  for (const r of miicst) {
    const k = toUpper(r["Item No."] ?? r["itemId"] ?? r["Item"]);
    if (!k) continue;
    if (!miicstByItemNo.has(k)) miicstByItemNo.set(k, []);
    miicstByItemNo.get(k)!.push(r);
  }

  const misuplById = new Map<string, any>();
  for (const r of misuplRows) {
    const k = toStr(
      r["Supplier No."] ?? r["suplId"] ?? r["Vendor No."] ?? r["Name"]
    );
    if (k) misuplById.set(k, r);
  }

  const stockByItem = new Map<string, StockByItemEntry>();
  for (const r of items) {
    const k = toUpper(r["Item No."] ?? r["Item"] ?? r["ItemNo"] ?? r["Item_No"]);
    if (!k) continue;
    const onHand = toNum(r["Stock"] ?? r["totQStk"] ?? r["On Hand"] ?? 0);
    const wip = toNum(r["WIP"] ?? r["totQWip"] ?? 0);
    const reserve = toNum(r["Reserve"] ?? r["totQRes"] ?? 0);
    const onOrder = toNum(r["On Order"] ?? r["totQOrd"] ?? 0);
    const available = Math.max(0, onHand - reserve);
    stockByItem.set(k, { onHand, wip, reserve, onOrder, available });
  }

  return {
    itemByNo,
    alertByItemNo,
    moHeaderByNo,
    moDetailsByNo,
    poHeaderByNo,
    poLinesByNo,
    bomHeadersByParent,
    bomDetailsByParent,
    bomWhereUsedByComponent,
    ilocqtByItemNo,
    mibinqByItemNo,
    miloghByItemNo,
    miicstByItemNo,
    misuplById,
    stockByItem,
  };
}
