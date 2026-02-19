# PR Service – Data Source Audit

## Full Company Data – ALL PR DATA FROM FCD

PR service uses Full Company Data (same as app) for ALL data. On local: load_from_folder. On cloud: load_from_drive_api.

## Full Company Data Files (from converter)

| CSV | App Key(s) | PR Needs? | PR Uses? | Status |
|-----|------------|-----------|----------|--------|
| MIITEM | Items, CustomAlert5 | ✓ Items, stock, BOM rev, supplier | ✓ load_items, get_inventory_data | ✓ |
| MIILOC | MIILOC | ✓ Stock by location | ✓ _load_miiloc, get_stock_level | ✓ |
| MIBOMD | BillOfMaterialDetails | ✓ BOM explosion | ✓ load_bom_details | ✓ |
| MIPOH | PurchaseOrders | ✓ PO headers, pricing | ✓ _load_po_data_for_pricing | ✓ |
| MIPOD | PurchaseOrderDetails | ✓ PO lines, unit price | ✓ _load_po_data_for_pricing | ✓ |
| MIQSUP | MIQSUP | ✓ Preferred supplier per item | ✓ get_item_master _load_miqsup | ✓ |
| MISUPL | MISUPL | ✓ Supplier master (name, address) | ✓ get_supplier_info _load_misupl | ✓ |
| MIPOCV | PurchaseOrderAdditionalCosts | Optional (extended PO) | API Extractions fallback | ✓ |

## PR Functions – Data Source Check

| Function | Data Source | Status |
|----------|-------------|--------|
| load_items | FCD (cache → _load_full_company_data_for_pr → load_json fallback) | ✓ |
| load_bom_details | FCD | ✓ |
| get_inventory_data | FCD | ✓ |
| get_stock_level | FCD MIILOC | ✓ |
| _load_po_data_for_pricing | FCD | ✓ |
| get_supplier_info | FCD MISUPL + PO + PurchaseOrderAdditionalCostsTaxes | ✓ |
| load_po_data | FCD _load_po_data_for_pricing | ✓ |
| get_item_master preferred_supplier | MIITEM Supplier No. + MIQSUP | ✓ |
| _load_full_company_data_for_pr | Local: load_from_folder; Cloud: load_from_drive_api | ✓ |

## MIITEM Field Mapping

- MIITEM has `suplId` → mapped to `"Supplier No."`
- All endpoints use: `item.get('Preferred Supplier Number') or item.get('Supplier No.') or item.get('suplId')`
- Preferred supplier resolution: 1) MIITEM.suplId (Supplier No.) 2) MIQSUP 3) Last PO supplier
