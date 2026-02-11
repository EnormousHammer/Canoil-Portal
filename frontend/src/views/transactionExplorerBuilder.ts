/**
 * Transaction Explorer Builder - Inventory Log search
 * Uses indexed search, not filtering arrays in render.
 * Answers: movements for item X, MO ####, lot L####, date range, location/bin
 */

import type { TransactionIndexes, TxView } from "../data/transactionIndexes";

export type TransactionExplorerFilters = {
  itemNo?: string;
  docRef?: string;
  lot?: string;
  serial?: string;
  dateFrom?: string;
  dateTo?: string;
  location?: string;
  bin?: string;
  type?: string;
  limit?: number;
};

export type TransactionExplorerView = {
  rows: TxView[];
  totalCount: number;
  filters: TransactionExplorerFilters;
  hasData: boolean;
};

function inDateRange(date: string, from?: string, to?: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  if (from && d < from.slice(0, 10)) return false;
  if (to && d > to.slice(0, 10)) return false;
  return true;
}

function matchesLocBin(tx: TxView, location?: string, bin?: string): boolean {
  if (location && tx.location?.toUpperCase() !== location.toUpperCase())
    return false;
  if (bin && tx.bin?.toUpperCase() !== bin.toUpperCase()) return false;
  return true;
}

export function buildTransactionSearchView(
  txIndexes: TransactionIndexes | undefined,
  filters: TransactionExplorerFilters
): TransactionExplorerView {
  if (!txIndexes) {
    return {
      rows: [],
      totalCount: 0,
      filters,
      hasData: false,
    };
  }

  let candidate: TxView[] = [];

  if (filters.itemNo) {
    const byItem = txIndexes.txByItemNo.get(
      filters.itemNo.toString().trim().toUpperCase()
    );
    candidate = byItem ?? [];
  } else if (filters.docRef) {
    const byRef = txIndexes.txByDocRef.get(
      filters.docRef.toString().trim()
    );
    candidate = byRef ?? [];
  } else if (filters.lot) {
    const byLot = txIndexes.txByLot.get(
      filters.lot.toString().trim().toUpperCase()
    );
    candidate = byLot ?? [];
  } else if (filters.serial) {
    const bySerial = txIndexes.txBySerial.get(
      filters.serial.toString().trim().toUpperCase()
    );
    candidate = bySerial ?? [];
  } else {
    candidate = [...txIndexes.allTx];
  }

  let filtered = candidate.filter((tx) => {
    if (filters.dateFrom || filters.dateTo) {
      if (!inDateRange(tx.date, filters.dateFrom, filters.dateTo)) return false;
    }
    if (filters.location || filters.bin) {
      if (!matchesLocBin(tx, filters.location, filters.bin)) return false;
    }
    if (filters.type) {
      if (tx.type?.toUpperCase() !== filters.type.toUpperCase()) return false;
    }
    return true;
  });

  const totalCount = filtered.length;
  const limit = filters.limit ?? 200;
  const rows = filtered.slice(0, limit);

  return {
    rows,
    totalCount,
    filters,
    hasData: totalCount > 0,
  };
}
