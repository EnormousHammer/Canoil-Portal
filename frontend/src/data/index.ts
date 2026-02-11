/**
 * Data layer - canonical access for Full Company Data
 * Rule: Components must never touch raw dataset keys directly. They only call builders.
 */

export { getDataset } from "./getDataset";
export { buildIndexes, type DataIndexes, type StockByItemEntry } from "./indexes";
export { buildDataCatalog, type DataCatalog, type DataCatalogEntry } from "./dataCatalog";
export { buildTransactionIndexes, type TransactionIndexes, type TxView } from "./transactionIndexes";
export { toStr, toNum, toUpper } from "./utils";
