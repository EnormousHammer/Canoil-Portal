/**
 * MO View Builder - MiSys-style Manufacturing Order adapter
 * Returns UI-ready data so components never read raw fields directly
 */

import type { FullCompanyData } from "../types/fullCompanyData";
import type { DataIndexes } from "../data/indexes";

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

export type MOComponentView = {
  itemNo: string;
  desc?: string;
  requiredQty: number;
  releasedQty: number;
  wipQty: number;
  reserveQty: number;
  completedQty: number;
  shortageQty: number;
  /** Available stock from CustomAlert5 / Items */
  availableStock: number;
  /** Shortage vs available: max(0, remaining - availableStock) */
  shortage: number;
  materialCost: number;
  totalCost: number;
  /** Planned extended cost = requiredQty * unitCost */
  plannedExt: number;
  /** Actual extended cost = issuedQty * unitCost */
  actualExt: number;
  sourceLocation?: string;
  /** "—" when mixed sources; single location otherwise */
  sourceLocationDisplay?: string;
};

/** Exact MISys line - one row per MIMOMD detail (no grouping) */
export type MOExactLineView = {
  lineNo: string | number;
  opSeq: string | number;
  plannedItemNo: string;
  issuedItemNo: string;
  desc?: string;
  requiredQty: number;
  issuedQty: number;
  remainingQty: number;
  unitCost: number;
  plannedExt: number;
  actualExt: number;
  sourceLoc: string;
  issueType: string;
};

export type MOView = {
  moNo: string;
  status?: any;
  buildItemNo?: string;
  buildItemDesc?: string;

  orderedQty: number;
  releasedQty: number;
  wipQty: number;
  completedQty: number;

  dates: {
    order?: string;
    start?: string;
    release?: string;
    completion?: string;
    close?: string;
    lastMaintained?: string;
  };

  customer?: string;
  bomItem?: string;
  bomRev?: string;
  salesOrderNo?: string;
  jobNo?: string;
  locationNo?: string;
  onHold?: boolean;
  /** Raw header for fields not yet in MOView (costs, etc.) */
  rawHeader?: any;
  /** Release Order Quantity - from header */
  releaseOrderQty?: number;

  components: MOComponentView[];
};

export function buildMOView(
  data: FullCompanyData | undefined,
  indexes: DataIndexes,
  moNoRaw: string
): MOView | null {
  const moNo = toStr(moNoRaw);
  if (!moNo) return null;

  const header = indexes.moHeaderByNo.get(moNo);
  const details = indexes.moDetailsByNo.get(moNo) ?? [];

  if (!header && details.length === 0) return null;

  const buildItemNo = toStr(
    header?.["Build Item No."] ?? header?.["Build Item"] ?? header?.["BOM Item"] ?? header?.["buildItem"]
  );
  const buildItemDesc =
    indexes.alertByItemNo.get(toUpper(buildItemNo))?.["Description"] ??
    indexes.itemByNo.get(toUpper(buildItemNo))?.["Description"] ??
    indexes.itemByNo.get(toUpper(buildItemNo))?.["Item Description"] ??
    undefined;

  const orderedQty = toNum(
    header?.["Ordered"] ?? header?.["Order Qty"] ?? header?.["Order Quantity"]
  );

  let releasedQty = 0;
  let wipQty = 0;
  let completedQty = 0;

  const byItem = new Map<string, MOComponentView>();

  for (const d of details) {
    const compNo = toStr(
      d["Component Item No."] ??
        d["Component"] ??
        d["Item No."] ??
        d["Item"] ??
        d["partId"]
    );
    if (!compNo) continue;

    const required = toNum(
      d["Required Quantity"] ??
        d["Required Qty."] ??
        d["Required Qty"] ??
        d["Required"] ??
        d["Quantity"]
    );
    const released = toNum(
      d["Released"] ?? d["Released Qty."] ?? d["Released Qty"] ?? d["Issued"] ?? d["Issued Qty"] ?? d["Release"]
    );
    const wip = toNum(d["WIP"]);
    const reserve = toNum(d["Reserve"]);
    const completed = toNum(d["Completed"] ?? d["Completed Qty"]);
    const unitCost = toNum(
      d["Material Cost"] ?? d["Unit Cost"] ?? d["Cost"]
    );
    const sourceLocation = toStr(
      d["Source Location"] ?? d["Location"] ?? d["Location No."]
    );

    releasedQty += released;
    wipQty += wip;
    completedQty += completed;

    const alertRow = indexes.alertByItemNo.get(toUpper(compNo)) ?? indexes.itemByNo.get(toUpper(compNo));
    const availableStock = toNum(
      alertRow?.["Stock"] ?? alertRow?.["Available"] ?? alertRow?.["On Hand"] ?? 0
    );

    const plannedExtLine = required * unitCost;
    const actualExtLine = released * unitCost;

    const existing = byItem.get(compNo);
    if (existing) {
      existing.requiredQty += required;
      existing.releasedQty += released;
      existing.wipQty += wip;
      existing.reserveQty += reserve;
      existing.completedQty += completed;
      existing.totalCost += plannedExtLine;
      existing.plannedExt += plannedExtLine;
      existing.actualExt += actualExtLine;
      if (sourceLocation && !existing.sourceLocation) {
        existing.sourceLocation = sourceLocation;
        existing.sourceLocationDisplay = sourceLocation;
      } else if (sourceLocation && existing.sourceLocation !== sourceLocation) {
        existing.sourceLocation = `${existing.sourceLocation}, ${sourceLocation}`;
        existing.sourceLocationDisplay = "Mixed";
      }
    } else {
      const desc =
        d["Non-stocked Item Description"] ??
        d["Description"] ??
        d["Item Description"] ??
        alertRow?.["Description"] ??
        undefined;
      const remaining = required - released;
      const shortage = Math.max(0, remaining - availableStock);

      byItem.set(compNo, {
        itemNo: compNo,
        desc,
        requiredQty: required,
        releasedQty: released,
        wipQty: wip,
        reserveQty: reserve,
        completedQty: completed,
        shortageQty: Math.max(0, required - released),
        availableStock,
        shortage,
        materialCost: unitCost,
        totalCost: plannedExtLine,
        plannedExt: plannedExtLine,
        actualExt: actualExtLine,
        sourceLocation: sourceLocation || undefined,
        sourceLocationDisplay: sourceLocation || undefined,
      });
    }
  }

  for (const c of byItem.values()) {
    c.shortageQty = Math.max(0, c.requiredQty - c.releasedQty);
    const remaining = c.requiredQty - c.releasedQty;
    c.shortage = Math.max(0, remaining - c.availableStock);
    c.materialCost =
      c.requiredQty > 0 ? c.totalCost / c.requiredQty : c.materialCost;
  }

  const components = Array.from(byItem.values()).sort((a, b) =>
    a.itemNo.localeCompare(b.itemNo)
  );

  return {
    moNo,
    status: header?.["Status"],
    buildItemNo,
    buildItemDesc,
    orderedQty,
    releasedQty,
    wipQty,
    completedQty,
    dates: {
      order: header?.["Order Date"] ?? header?.["ordDt"],
      start: header?.["Start Date"] ?? header?.["startDt"],
      release: header?.["Release Date"] ?? header?.["relDt"],
      completion: header?.["Completion Date"] ?? header?.["Close Date"] ?? header?.["closeDt"],
      close: header?.["Close Date"] ?? header?.["closeDt"],
      lastMaintained: header?.["Last Maintained"],
    },
    customer: header?.["Customer"],
    bomItem: header?.["BOM Item"] ?? header?.["BOM Item No."],
    bomRev: header?.["BOM Rev"] ?? header?.["BOM Revision"] ?? header?.["Revision No."],
    salesOrderNo: header?.["Sales Order No."],
    jobNo: header?.["Job No."],
    locationNo: header?.["Location No."] ?? header?.["locId"],
    onHold: !!header?.["On Hold"],
    rawHeader: header,
    releaseOrderQty: toNum(header?.["Release Order Quantity"] ?? header?.["Release Qty"]),
    components,
  };
}

/** Build exact MISys lines (no grouping) for Components tab Exact view */
export function buildMOExactLines(
  indexes: DataIndexes,
  moNoRaw: string
): MOExactLineView[] {
  const moNo = toStr(moNoRaw);
  if (!moNo) return [];

  const details = indexes.moDetailsByNo.get(moNo) ?? [];
  const lines: MOExactLineView[] = [];

  for (const d of details) {
    const plannedItemNo = toStr(
      d["Component Item No."] ??
        d["Component"] ??
        d["Item No."] ??
        d["Item"] ??
        d["partId"]
    );
    if (!plannedItemNo) continue;

    const requiredQty = toNum(
      d["Required Quantity"] ??
        d["Required Qty."] ??
        d["Required Qty"] ??
        d["Required"] ??
        d["Quantity"]
    );
    const issuedQty = toNum(
      d["Released"] ?? d["Released Qty."] ?? d["Released Qty"] ?? d["Issued"] ?? d["Issued Qty"] ?? d["Release"]
    );
    const unitCost = toNum(
      d["Material Cost"] ?? d["Unit Cost"] ?? d["Cost"]
    );
    const sourceLoc = toStr(
      d["Source Location"] ?? d["Location"] ?? d["Location No."]
    );
    const issueType = toStr(
      d["Issue Type"] ?? d["Issue Method"] ?? d["Backflush"] ?? ""
    );

    const lineNo = d["Detail No."] ?? d["Line No."] ?? d["Line"] ?? d["podId"] ?? lines.length + 1;
    const opSeq = d["Operation No."] ?? d["Operation"] ?? d["operNo"] ?? "—";
    const issuedItemNo = toStr(d["Issued Item No."] ?? d["Alternate Item No."]) || plannedItemNo;

    const alertRow = indexes.alertByItemNo.get(toUpper(plannedItemNo)) ?? indexes.itemByNo.get(toUpper(plannedItemNo));
    const desc =
      d["Non-stocked Item Description"] ??
      d["Description"] ??
      d["Item Description"] ??
      alertRow?.["Description"] ??
      undefined;

    lines.push({
      lineNo,
      opSeq,
      plannedItemNo,
      issuedItemNo,
      desc,
      requiredQty,
      issuedQty,
      remainingQty: requiredQty - issuedQty,
      unitCost,
      plannedExt: requiredQty * unitCost,
      actualExt: issuedQty * unitCost,
      sourceLoc: sourceLoc || "—",
      issueType: issueType || "—",
    });
  }

  return lines.sort((a, b) => {
    const lnA = typeof a.lineNo === "number" ? a.lineNo : parseInt(String(a.lineNo), 10) || 0;
    const lnB = typeof b.lineNo === "number" ? b.lineNo : parseInt(String(b.lineNo), 10) || 0;
    return lnA - lnB;
  });
}
