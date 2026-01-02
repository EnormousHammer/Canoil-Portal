# Data Structure Analysis - Canoil Portal

## 📊 Data Sources Overview

### Primary Data Files (Loaded from G: Drive)

The backend loads data from JSON files in the latest folder: `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\{latest_folder}`

#### Essential Files (Always Loaded)
1. **CustomAlert5.json** - PRIMARY inventory data source (32+ fields)
2. **MIILOC.json** - Inventory location data
3. **SalesOrderHeaders.json** - Sales order headers
4. **SalesOrderDetails.json** - Sales order details
5. **ManufacturingOrderHeaders.json** - MO headers (67 fields)
6. **ManufacturingOrderDetails.json** - MO component details (25 fields)
7. **BillsOfMaterial.json** - BOM headers (25 fields)
8. **BillOfMaterialDetails.json** - BOM component details (12 fields)
9. **PurchaseOrders.json** - Purchase order headers
10. **PurchaseOrderDetails.json** - Purchase order details

#### Additional Files (Initialized as Empty)
- Items.json, MIITEM.json (alternative formats)
- MIBOMH.json, MIBOMD.json (alternative BOM formats)
- ManufacturingOrderRoutings.json (EMPTY - no data)
- MIMOH.json, MIMOMD.json, MIMORD.json (alternative MO formats)
- Jobs.json, JobDetails.json, MIJOBH.json, MIJOBD.json
- MIPOH.json, MIPOD.json, MIPOHX.json, MIPOC.json, MIPOCV.json, MIPODC.json
- MIWOH.json, MIWOD.json (Work orders)
- WorkOrders.json, WorkOrderDetails.json
- PurchaseOrderExtensions.json
- PurchaseOrderAdditionalCosts.json, PurchaseOrderAdditionalCostsTaxes.json
- PurchaseOrderDetailAdditionalCosts.json

---

## 🔗 Data Relationships

### Manufacturing Order (MO) Data Flow

```
ManufacturingOrderHeaders.json
  ├── Mfg. Order No. (Primary Key)
  ├── Build Item No. → Links to:
  │   ├── BillsOfMaterial.json (Item No.)
  │   ├── BillOfMaterialDetails.json (Parent Item No.)
  │   └── CustomAlert5.json (Item No.) - for build item info
  ├── Sales Order No. → Links to:
  │   ├── SalesOrderHeaders.json
  │   └── SalesOrderDetails.json
  ├── Job No. → Links to:
  │   ├── Jobs.json
  │   └── WorkOrders.json
  └── Location No. → Links to:
      └── MIILOC.json

ManufacturingOrderDetails.json
  ├── Mfg. Order No. → Links to ManufacturingOrderHeaders.json
  ├── Component Item No. → Links to:
  │   ├── CustomAlert5.json (Item No.) - for stock levels
  │   └── BillOfMaterialDetails.json (Component Item No.)
  └── Source Location → Links to MIILOC.json
```

---

## 📋 Key Field Mappings

### ManufacturingOrderHeaders.json (67 Fields)

**Core Identification:**
- `Mfg. Order No.` - Primary key
- `Build Item No.` - Item being manufactured
- `Description` - MO description
- `Location No.` - Manufacturing location

**Status & Progress:**
- `Status` - 0=Planned, 1=Released, 2=Started, 3=Finished
- `On Hold` - Boolean flag
- `Ordered` - Total quantity ordered
- `Completed` - Quantity completed
- `Allocated` - Quantity allocated
- `Reserved` - Quantity reserved
- `Release Order Quantity` - Quantity to release

**Dates:**
- `Order Date` - When MO was created
- `Release Date` - When MO was released
- `Start Date` - When production started
- `Completion Date` - Expected/actual completion
- `Close Date` - When MO was closed
- `Last Maintained` - Last update timestamp
- `Sales Order Ship Date` - Linked SO ship date

**Costs (Projected vs Actual):**
- `Projected Material Cost` - Estimated material cost
- `Actual Material Cost` - Actual material cost
- `Projected Labor Cost` - Estimated labor cost
- `Actual Labor Cost` - Actual labor cost
- `Projected Overhead Cost` - Estimated overhead
- `Actual Overhead Cost` - Actual overhead
- `Cumulative Cost` - Total cumulative cost
- `Total Material Cost` - Total material cost
- `Total Scrap Cost` - Scrap cost
- `Used Material Cost` - Material cost used
- `Used Labor Cost` - Labor cost used
- `Used Overhead Cost` - Overhead cost used

**Sales Order Linkage:**
- `Sales Order No.` - Linked sales order
- `Sales Order Detail No.` - SO detail line
- `Sales Item No.` - Sales item number
- `Sales Location` - Sales location
- `Sales Transfer Quantity` - Quantity to transfer

**Other:**
- `Customer` - Customer name
- `Job No.` - Linked job number
- `Priority` - Priority level
- `Created By` - Creator
- `Released By` - Who released it
- `Operation Count` - Number of operations
- `Work Order Reference Count` - Number of work orders
- `Notes` - Notes field
- `Formulation` - Formulation info
- `Instructions` - Instructions
- `Label` - Label info

### ManufacturingOrderDetails.json (25 Fields)

**Core Fields:**
- `Mfg. Order No.` - Links to header
- `Component Item No.` - Component item
- `Required Qty.` - Quantity required
- `Released Qty.` - Quantity released/issued
- `Material Cost` - Material cost for this component
- `Source Location` - Where component is sourced from

**Status:**
- `Completed` - Is component completed
- `WIP` - Work in progress quantity
- `Reserve` - Reserved quantity
- `Scrapped` - Scrapped quantity
- `On Purchase Order` - Is it on a PO

**BOM Linkage:**
- `BOM Revision No.` - BOM revision used
- `Unit Required Qty.` - Unit required quantity
- `Assy. Lead (Days)` - Assembly lead time

**Other:**
- `Line` - Line number
- `Detail Type` - Type of detail
- `Non-stocked` - Is it non-stocked
- `Non-stocked Item Description` - Description if non-stocked
- `Non-stocked Item Cost` - Cost if non-stocked
- `Comment` - Comments
- `Operation No.` - Operation number
- `Child MO No.` - Child manufacturing order
- `Auto-build Override` - Auto-build override flag
- `Uniquifier` - Unique identifier
- `Scrap Cost` - Scrap cost

### BillsOfMaterial.json (25 Fields)

**Core:**
- `Item No.` - Parent item (build item)
- `Revision No.` - BOM revision
- `Build Quantity` - Quantity this BOM builds
- `Cost Rollup Enabled` - Cost rollup flag
- `Burden Rate` - Burden rate

**Dates:**
- `Last Maintained` - Last maintenance date
- `Revision Date` - Revision date
- `Effective From` - Effective from date
- `Effective To` - Effective to date

**Other:**
- `Auto-build` - Auto-build flag
- `Comment` - Comments
- `Author` - Author
- `ECO No.` - Engineering change order
- `Document Path` - Document path
- `Assembly Lead` - Assembly lead time
- `Units Per Lead` - Units per lead
- `Allocated` - Allocated quantity
- `Reserved` - Reserved quantity
- `Maximum Lead` - Maximum lead time
- `Operation Count` - Number of operations
- `Instructions` - Instructions
- `Label` - Label
- `Formulation` - Formulation

### BillOfMaterialDetails.json (12 Fields)

**Core:**
- `Parent Item No.` - Links to BillsOfMaterial.json
- `Component Item No.` - Component item
- `Required Quantity` - Quantity required
- `Revision No.` - BOM revision
- `Line` - Line number

**Other:**
- `Uniquifier` - Unique identifier
- `Detail Type` - Type of detail
- `Lead (Days)` - Lead time in days
- `Comment` - Comments
- `Operation No.` - Operation number
- `Source Location` - Source location
- `Alternative Items` - Alternative items

### CustomAlert5.json (Primary Inventory Source)

**Key Fields for MO Components:**
- `Item No.` - Item identifier (links to Component Item No.)
- `Description` - Item description
- `Available` - Available stock quantity
- `On Hand` - On hand quantity
- `Stock` - Stock quantity
- `Allocated` - Allocated quantity
- `Reserved` - Reserved quantity
- `On Order` - On order quantity
- `Reorder Level` - Reorder level
- `Minimum` - Minimum stock level
- `Maximum` - Maximum stock level
- `Standard Cost` - Standard cost
- `Recent Cost` - Recent cost
- `Average Cost` - Average cost

---

## 🔍 Data Insights

### Field Name Variations

**Important:** The data uses EXACT field names with specific punctuation:
- `Required Qty.` (with period) - NOT `Required Qty` or `Required Quantity`
- `Mfg. Order No.` (with periods) - NOT `Mfg Order No` or `Manufacturing Order No`
- `Component Item No.` - NOT `Component Item` or `Item No`

### Data Availability

1. **ManufacturingOrderRoutings.json** - EMPTY (no routing data available)
2. **MIMORD.json** - EMPTY (no alternative routing data)
3. **MIBORD.json** - EMPTY (no BOM routing data)

### Alternative Formats

Many files have "MI" prefix alternatives:
- `ManufacturingOrderHeaders.json` ↔ `MIMOH.json`
- `ManufacturingOrderDetails.json` ↔ `MIMOMD.json`
- `BillsOfMaterial.json` ↔ `MIBOMH.json`
- `BillOfMaterialDetails.json` ↔ `MIBOMD.json`

**Note:** The frontend primarily uses the non-MI versions, but MI versions may have additional fields.

---

## 🎯 Current Implementation Status

### ✅ Fully Implemented
- MO Header display (all 67 fields accessible)
- MO Details/Components display (with inventory stock levels)
- BOM information display
- Related Sales Order linkage
- Related Job/Work Order linkage
- Cost tracking (Projected vs Actual)
- Date tracking (all dates)
- Inventory stock level integration
- Stock shortage detection

### ⚠️ Partially Implemented
- ManufacturingOrderRoutings - Not available (file is empty)
- Alternative format files (MI*) - Not currently used

### 📝 Data Loading Strategy

1. **Fast Loading:** Only essential files loaded initially
2. **Lazy Loading:** Additional files can be loaded on-demand via `/api/data/lazy-load`
3. **Caching:** Data cached for 1 hour (3600 seconds)
4. **Pre-serialization:** Responses pre-serialized for faster delivery

---

## 🔄 Data Flow

```
G: Drive JSON Files
  ↓
Backend load_json_file()
  ↓
/api/data endpoint
  ↓
Frontend data prop
  ↓
Component filtering/display
```

### Key Relationships Used in MO Display

1. **MO → Components:**
   - Filter `ManufacturingOrderDetails.json` by `Mfg. Order No.`

2. **Components → Inventory:**
   - Match `Component Item No.` with `CustomAlert5.json['Item No.']`
   - Get stock levels from `Available`, `On Hand`, `Stock`

3. **MO → BOM:**
   - Match `Build Item No.` with `BillsOfMaterial.json['Item No.']`
   - Get BOM details from `BillOfMaterialDetails.json['Parent Item No.']`

4. **MO → Sales Order:**
   - Match `Sales Order No.` with `SalesOrderHeaders.json`

5. **MO → Job:**
   - Match `Job No.` with `Jobs.json`
   - Get Work Orders from `WorkOrders.json['Job No.']`

---

## 📊 Data Statistics (From Backend Logs)

Based on recent backend startup logs:
- **CustomAlert5.json:** 2,594 records
- **ManufacturingOrderHeaders.json:** 4,147 records
- **ManufacturingOrderDetails.json:** 17,778 records
- **BillsOfMaterial.json:** 721 records
- **BillOfMaterialDetails.json:** 3,684 records
- **Sales Orders:** 1,449 SOs scanned from PDFs

---

## 🚀 Recommendations

1. **Use Exact Field Names:** Always use exact field names with proper punctuation
2. **Handle Missing Data:** Many fields may be null/empty - always provide fallbacks
3. **Stock Calculations:** Use `Available` or `On Hand` for stock levels, not `Stock`
4. **Quantity Fields:** Use `Required Qty.` (with period) for MO details
5. **Cost Fields:** Distinguish between Projected and Actual costs
6. **Date Fields:** All dates are strings - may need parsing for display
7. **Alternative Formats:** Consider using MI* files if standard files are missing data

---

## 📝 Field Name Reference Quick Guide

### MO Headers
- `Mfg. Order No.` - Primary key
- `Build Item No.` - Item being built
- `Status` - 0=Planned, 1=Released, 2=Started, 3=Finished
- `Ordered` - Total quantity
- `Completed` - Completed quantity
- `Release Order Quantity` - Release quantity
- `Sales Order No.` - Linked SO
- `Job No.` - Linked job

### MO Details
- `Mfg. Order No.` - Links to header
- `Component Item No.` - Component item
- `Required Qty.` - Required quantity (with period!)
- `Released Qty.` - Released/issued quantity
- `Material Cost` - Component cost
- `Source Location` - Source location

### BOM
- `Item No.` - Parent item (in BillsOfMaterial.json)
- `Parent Item No.` - Parent item (in BillOfMaterialDetails.json)
- `Component Item No.` - Component item
- `Required Quantity` - Required quantity (no period in BOM!)

### Inventory
- `Item No.` - Item identifier
- `Available` - Available stock
- `On Hand` - On hand quantity
- `Allocated` - Allocated quantity
- `Reserved` - Reserved quantity

