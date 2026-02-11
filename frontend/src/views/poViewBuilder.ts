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
  itemNo: string;
  description?: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  extendedPrice: number;
  status?: string;
  requiredDate?: string;
  locationNo?: string;
  raw: any;
};

export type POView = {
  poNo: string;
  vendorNo: string;
  vendorName: string;
  orderDate?: string;
  status?: any;
  totalOrdered: number;
  totalReceived: number;
  totalValue: number;
  lines: POLineView[];
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

  const lineViews: POLineView[] = lines.map((r) => {
    const itemNo = toStr(r["Item No."] ?? r["itemId"] ?? r["partId"] ?? "");
    const ordered = toNum(r["Ordered Qty"] ?? r["Ordered"] ?? r["ordered"] ?? r["ordQty"] ?? 0);
    const received = toNum(r["Received Qty"] ?? r["Received"] ?? r["received"] ?? r["recvQty"] ?? 0);
    const unitPrice = toNum(
      r["Unit Price"] ?? r["Unit Cost"] ?? r["price"] ?? r["cost"] ?? r["unitCost"] ?? 0
    );
    const extPrice = ordered * unitPrice;

    return {
      itemNo,
      description: toStr(r["Description"] ?? r["descr"] ?? ""),
      orderedQty: ordered,
      receivedQty: received,
      unitPrice,
      extendedPrice: extPrice,
      status: toStr(r["Status"] ?? r["Detail Status"] ?? r["dStatus"] ?? ""),
      requiredDate: toStr(r["Required Date"] ?? r["initDueDt"] ?? r["realDueDt"] ?? ""),
      locationNo: toStr(r["Location No."] ?? r["locId"] ?? ""),
      raw: r,
    };
  });

  const totalOrdered = lineViews.reduce((s, l) => s + l.orderedQty, 0);
  const totalReceived = lineViews.reduce((s, l) => s + l.receivedQty, 0);
  const totalValue = lineViews.reduce((s, l) => s + l.extendedPrice, 0);

  return {
    poNo,
    vendorNo,
    vendorName,
    orderDate,
    status,
    totalOrdered,
    totalReceived,
    totalValue,
    lines: lineViews,
    rawHeader: header ?? {},
  };
}
