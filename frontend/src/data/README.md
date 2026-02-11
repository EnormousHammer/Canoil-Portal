# Data Access Contract

**Rule:** Components must never touch raw dataset keys directly. They only call builders.

## Foundation (Step 1)

| Piece | Location | Purpose |
|-------|----------|---------|
| `getDataset(data, keys[])` | `getDataset.ts` | Safe dataset access with fallback keys |
| `buildIndexes(data)` | `indexes.ts` | Maps for O(1) lookups (itemByNo, moHeaderByNo, etc.) |
| `toStr` / `toNum` / `toUpper` | `utils.ts` | Canonical parsing utils |
| `buildDataCatalog(data)` | `dataCatalog.ts` | What data exists + counts for capability detection |

## Indexes

- `itemByNo`, `alertByItemNo` — item master
- `moHeaderByNo`, `moDetailsByNo` — MO
- `poHeaderByNo`, `poLinesByNo` — PO
- `bomHeadersByParent`, `bomDetailsByParent`, `bomWhereUsedByComponent` — BOM
- `ilocqtByItemNo`, `mibinqByItemNo` — locations/bins
- `miloghByItemNo`, `miicstByItemNo` — transactions, cost history
- `misuplById` — vendors
- `stockByItem` — `{ onHand, wip, reserve, onOrder, available }` per item

## View Builders (in `../views/`)

| Builder | Returns | Used by |
|---------|---------|---------|
| `buildMOView(data, indexes, moNo)` | MOView | MO modal |
| `buildItemView(data, indexes, itemNo)` | ItemView | Item modal |
| `buildPOView(data, indexes, poNo)` | POView | PO modal |
| `buildBOMView(data, indexes, parentItemNo, rev?)` | BOMView | BOM tab |
| `buildLotTraceView(data, lotNo)` | LotTraceView | Lot drilldown |

## DataCatalog flags

- `hasMO`, `hasPO`, `hasBOM`, `hasLotTrace`, `hasItems`, `hasTransactions`

Use for: hide tabs when data missing, show "Not available in this snapshot".

## Next (planned)

- `buildSerialTraceView`, `buildItemLotSummary`
- `buildTransactionSearchView` (MILOGH/MILOGD filters)
- Replace remaining raw `data['X.json']` reads in UI
