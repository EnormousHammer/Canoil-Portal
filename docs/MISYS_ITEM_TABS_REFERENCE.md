# MISys Item Tabs Reference

Reference for what each tab/section in the MISys Items window contains. Use this to align the Canoil Portal item modal.

| Tab/Section | Contents & Functionality | Portal status |
|-------------|--------------------------|---------------|
| **Master** | Item No., Description, Type (Assembled/Purchased/Resource), UOM, Optional Fields (custom). Basic setup/editing. | Implemented: Item No., Description, Type (Raw/Assembled/Formula), Stocking unit, Purchasing unit, Status, Reorder level/qty, Min/Max. |
| **Stock** | Aggregated stock (On Hand/WIP/Reserve), Min/Max/Reorder/Lot Size (global). Location-specific grid: Pick (bin), Min/Max/Reorder/Order Qty. Cycle count. | Implemented: Total Stock, WIP, On Order, Available, Reorder Level. Reserve + location grid when data available (MIILOC). |
| **Costs** | Costing method (Standard/Avg/LIFO/FIFO), Current Value/Last Cost, Standard Cost, Average Cost. Roll-ups from BOM; adjustments. | Implemented: Unit, Standard, Recent cost; total value. Average Cost + costing method when available. |
| **Purchase Orders** | List of POs: PO No., Status, Order/Received/Invoiced Qty, Date, Location/Job. Drill to PO details. | Implemented. |
| **Mfg Orders** | Open MOs: MO No., Status, Qty Ordered/Completed, Due Date, Location. | Implemented. |
| **Sales Orders** | Outstanding SOs: SO No., Qty Ordered/Shipped, Customer, Due Date. Feeds MRP. | Implemented from ParsedSalesOrders/SO data. |
| **BOM** | Multi-level components: Detail Type, Qty/Scrap %, UOM, Cost. Revisions, explosion. | Implemented for assembled items. |
| **Where Used (BOM Implosion)** | Parent items/assemblies using this item (levels, Qty). | Implemented as BOM Where Used. |
| **Work Orders** | WOs: WO No., Status, Qty Issued/Completed, Dates, Costs. | Implemented from WorkOrderDetails. |
| **Stock Movement** | Transaction history: Transfers, adjustments, receipts, issues (dates, Qty, Reference). | Implemented from LotSerialHistory (MISLTH). |
| **Suppliers** | Preferred suppliers: Supplier No./Name, Lead Time, Price Breaks, Currency, Performance. | Implemented: vendor list from PO history (lead/price breaks when data available). |
| **Manufacturers** | Alternate makers/sources (OEMs). | Empty state until data source. |
| **Alternates** | Substitute items (cross-refs); for shortages/swaps. | Empty state until data source. |
| **Activity** | Summary of open activity: Orders, shortages, schedules. | Empty state until data source. |
| **Notes** | Rich text notes, attachments, custom fields. | Empty state until backend/store. |
| **History** | Full transaction log; journals/GL. | Empty state until data source. |
| **SL Numbers** | Serials/lots: No., Status, Dates, Locations. | Implemented from LotSerialDetail (MISLTD). |

**Type mapping:** MISys "Purchased" ≈ Raw (Item Type 0), "Assembled" = Assembled (1), "Resource" may map to Formula (2) or another type.

**Actions:** Edit fields, add rows (e.g. BOM), print/export. Portal supports view + Inventory actions + Add to PR Cart; edit/add rows per tab when backend supports.
