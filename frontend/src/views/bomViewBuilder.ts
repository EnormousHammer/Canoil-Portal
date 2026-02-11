/**
 * BOM View Builder - MiSys-style Bill of Materials click-through (revision aware)
 * Returns UI-ready data: parent header + components with qty per
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import type { DataIndexes } from "../data/indexes";

function toStr(v: any): string {
  return (v ?? "").toString().trim();
}
function toNum(v: any): number {
  const n = Number((v ?? "").toString().replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export type BOMComponentView = {
  componentItemNo: string;
  requiredQty: number;
  leadDays?: number;
  operationNo?: string;
  sourceLocation?: string;
  comment?: string;
  revision?: string;
  raw: any;
};

export type BOMView = {
  parentItemNo: string;
  revision?: string;
  buildQuantity?: number;
  description?: string;
  components: BOMComponentView[];
  rawHeader: any;
};

export function buildBOMView(
  data: FullCompanyData | undefined,
  indexes: DataIndexes,
  parentItemNoRaw: string,
  revision?: string
): BOMView | null {
  const parentItemNo = toStr(parentItemNoRaw);
  if (!parentItemNo) return null;
  const parentKey = parentItemNo.toUpperCase();

  const headers = indexes.bomHeadersByParent.get(parentKey) ?? [];
  const details = indexes.bomDetailsByParent.get(parentKey) ?? [];

  const header = revision
    ? headers.find((h) => toStr(h["Revision No."] ?? h["bomRev"] ?? h["Revision"]) === revision)
    : headers[0];

  const components: BOMComponentView[] = details.map((r) => ({
    componentItemNo: toStr(r["Component Item No."] ?? r["partId"] ?? r["Item No."] ?? ""),
    requiredQty: toNum(r["Required Quantity"] ?? r["Quantity Per"] ?? r["Qty Per"] ?? r["qty"] ?? r["reqQty"] ?? 0),
    leadDays: toNum(r["Lead (Days)"] ?? r["lead"] ?? r["leadTime"] ?? 0) || undefined,
    operationNo: toStr(r["Operation No."] ?? r["opCode"] ?? r["operNo"] ?? "") || undefined,
    sourceLocation: toStr(r["Source Location"] ?? r["srcLoc"] ?? "") || undefined,
    comment: toStr(r["Comment"] ?? r["cmnt"] ?? "") || undefined,
    revision: toStr(r["Revision No."] ?? r["bomRev"] ?? "") || undefined,
    raw: r,
  }));

  return {
    parentItemNo,
    revision: toStr(header?.["Revision No."] ?? header?.["bomRev"] ?? header?.["Revision"] ?? ""),
    buildQuantity: toNum(header?.["Build Quantity"] ?? header?.["mult"] ?? 0) || undefined,
    description: toStr(header?.["Description"] ?? header?.["descr"] ?? ""),
    components,
    rawHeader: header ?? {},
  };
}
