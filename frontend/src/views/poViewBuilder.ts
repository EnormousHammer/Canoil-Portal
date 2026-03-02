/**
 * PO View Builder - MiSys-style Purchase Order click-through
 * Returns UI-ready data: PO header + vendor join + line items + received vs ordered
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import type { DataIndexes } from "../data/indexes";

function toStr(v: any): string {
  return (v ?? "").toString().trim();
}
function toNum(v: any): number {
  const n = Number((v ?? "").toString().replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export type POLineView = {
  lineNo: string | number;
  itemNo: string;
  description?: string;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  unitPrice: number;
  itemRecentCost: number;
  extendedPrice: number;
  status?: string;
  requiredDate?: string;
  lastReceivedDate?: string;
  locationNo?: string;
  moNo?: string;
  comment?: string;
  raw: any;
};

export type POView = {
  poNo: string;
  vendorNo: string;
  vendorName: string;
  orderDate?: string;
  closeDate?: string;
  status?: any;
  buyer?: string;
  terms?: string;
  contact?: string;
  shipVia?: string;
  fob?: string;
  currency?: string;
  freight: number;
  totalOrdered: number;
  totalReceived: number;
  totalInvoiced: number;
  totalTax: number;
  totalAdditionalCost: number;
  totalValue: number;
  lines: POLineView[];
  /** Distinct MO numbers referenced by line items */
  linkedMONumbers: string[];
  /** Summary of item numbers on this PO */
  itemsSummary: string;
  rawHeader: any;
};

export function buildPOView(
  data: FullCompanyData | undefined,
  indexes: DataIndexes,
  poNoRaw: string
): POView | null {
  const poNo = toStr(poNoRaw);
  if (!poNo) return null;

  const header = indexes.poHeaderByNo.get(poNo);
  const lines = indexes.poLinesByNo.get(poNo) ?? [];

  if (!header && lines.length === 0) return null;

  const vendorNo = toStr(
    header?.["Supplier No."] ?? header?.["suplId"] ?? header?.["Vendor No."] ?? header?.["pohId"]
  );
  const vendorRow = indexes.misuplById.get(vendorNo);
  const vendorName = toStr(
    header?.["Name"] ?? header?.["Vendor"] ?? vendorRow?.["Name"] ?? vendorRow?.["descr"] ?? "—"
  );
  const orderDate = toStr(header?.["Order Date"] ?? header?.["ordDt"] ?? "");
  const status = header?.["Status"] ?? header?.["poStatus"] ?? header?.["poStat"];

  const lineViews: POLineView[] = lines.map((r, idx) => {
    const itemNo = toStr(r["Item No."] ?? r["itemId"] ?? r["partId"] ?? "");
    const ordered = toNum(r["Ordered Qty"] ?? r["Ordered"] ?? r["ordered"] ?? r["ordQty"] ?? 0);
    const received = toNum(r["Received Qty"] ?? r["Received"] ?? r["received"] ?? r["recvQty"] ?? 0);
    const billed = toNum(r["Billed Qty"] ?? r["Invoiced"] ?? r["invoiced"] ?? 0);
    const unitPrice = toNum(
      r["Unit Price"] ?? r["Unit Cost"] ?? r["price"] ?? r["cost"] ?? r["unitCost"] ?? 0
    );
    const itemRecentCost = toNum(r["Item Recent Cost"] ?? r["Recent Cost"] ?? 0);
    const extPrice = ordered * unitPrice;
    const moNo = toStr(r["Manufacturing Order No."] ?? r["mohId"] ?? r["MO No."] ?? "");

    return {
      lineNo: r["Detail No."] ?? r["Line No."] ?? r["Line"] ?? r["podId"] ?? idx + 1,
      itemNo,
      description: toStr(r["Description"] ?? r["descr"] ?? ""),
      orderedQty: ordered,
      receivedQty: received,
      billedQty: billed,
      unitPrice,
      itemRecentCost,
      extendedPrice: extPrice,
      status: toStr(r["Status"] ?? r["Detail Status"] ?? r["dStatus"] ?? ""),
      requiredDate: toStr(r["Required Date"] ?? r["initDueDt"] ?? r["realDueDt"] ?? ""),
      lastReceivedDate: toStr(r["Last Received Date"] ?? r["lastRecvDt"] ?? ""),
      locationNo: toStr(r["Location No."] ?? r["locId"] ?? ""),
      moNo: moNo || undefined,
      comment: toStr(r["Comment"] ?? r["cmt"] ?? ""),
      raw: r,
    };
  });

  const totalOrdered = lineViews.reduce((s, l) => s + l.orderedQty, 0);
  const totalReceived = lineViews.reduce((s, l) => s + l.receivedQty, 0);
  const totalValue = lineViews.reduce((s, l) => s + l.extendedPrice, 0);
  const totalInvoiced = toNum(header?.["Invoiced Amount"] ?? header?.["Total Invoiced"] ?? header?.["totInvoiced"]);
  const totalTax = toNum(header?.["Total Tax Amount"] ?? header?.["totTaxAmt"]);
  const totalAdditionalCost = toNum(header?.["Total Additional Cost"] ?? header?.["totAddCost"]);
  const freight = toNum(header?.["Freight"]);
  const linkedMONumbers = Array.from(new Set(lineViews.map(l => l.moNo).filter(Boolean) as string[]));
  const itemsSummary = lineViews.map(l => l.itemNo).filter(Boolean).slice(0, 3).join(", ") + (lineViews.length > 3 ? ` +${lineViews.length - 3} more` : "");

  return {
    poNo,
    vendorNo,
    vendorName,
    orderDate,
    closeDate: toStr(header?.["Close Date"] ?? header?.["closeDt"] ?? ""),
    status,
    buyer: toStr(header?.["Buyer"] ?? ""),
    terms: toStr(header?.["Terms"] ?? ""),
    contact: toStr(header?.["Contact"] ?? ""),
    shipVia: toStr(header?.["Ship Via"] ?? header?.["shpVia"] ?? ""),
    fob: toStr(header?.["FOB"] ?? header?.["fob"] ?? ""),
    currency: toStr(header?.["Source Currency"] ?? header?.["srcCur"] ?? header?.["Home Currency"] ?? header?.["homeCur"] ?? ""),
    freight,
    totalOrdered,
    totalReceived,
    totalInvoiced,
    totalTax,
    totalAdditionalCost,
    totalValue,
    lines: lineViews,
    linkedMONumbers,
    itemsSummary,
    rawHeader: header ?? {},
  };
}
