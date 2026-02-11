/**
 * Full Company Data Types - Stable type for raw G: Drive dataset
 * Use these types so re-imports / column shifts don't break the UI
 */

export type FullCompanyData = Record<string, any[]>;

export type DataKey =
  | "CustomAlert5.json"
  | "Items.json"
  | "MIITEM.json"
  | "MIITEMX.json"
  | "MIITEMA.json"
  | "MIILOCQT.json"
  | "MIBINQ.json"
  | "MILOGH.json"
  | "MILOGD.json"
  | "MILOGB.json"
  | "LotSerialHistory.json"
  | "LotSerialDetail.json"
  | "MISLHIST.json"
  | "MISLNH.json"
  | "MISLND.json"
  | "MISLBINQ.json"
  | "ManufacturingOrderHeaders.json"
  | "ManufacturingOrderDetails.json"
  | "MIMOH.json"
  | "MIMOMD.json"
  | "PurchaseOrders.json"
  | "PurchaseOrderDetails.json"
  | "MIPOH.json"
  | "MIPOD.json"
  | "BillsOfMaterial.json"
  | "BillOfMaterialDetails.json"
  | "MIBOMH.json"
  | "MIBOMD.json"
  | "MIICST.json"
  | "MISUPL.json"
  | "MIQSUP.json"
  | "Jobs.json"
  | "JobDetails.json"
  | "WorkOrders.json"
  | "WorkOrderDetails.json"
  | "MIWOH.json"
  | "MIWOD.json"
  | string;

export type Dataset<T = any> = T[];
