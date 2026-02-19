# Canoil Portal – Data Mapping Map

**Source:** Full Company Data (Google Drive)  
**Last updated:** Cloud test run  
**Total files in folder:** 72 CSV/Excel

---

## 1. IN USE – CSV → App Keys → Records

| CSV File | App Key(s) | Records | Status |
|----------|------------|---------|--------|
| MIITEM.CSV | CustomAlert5.json, Items.json | 1,882 | ✅ |
| MIILOC.CSV | MIILOC.json | 2,302 | ✅ |
| MIBOMH.CSV | MIBOMH.json, BillsOfMaterial.json | 583 | ✅ |
| MIBOMD.CSV | MIBOMD.json, BillOfMaterialDetails.json | 2,967 | ✅ |
| MIMOH.CSV | ManufacturingOrderHeaders.json, MIMOH.json | 3,828 | ✅ |
| MIMOMD.CSV | ManufacturingOrderDetails.json, MIMOMD.json | 18,274 | ✅ |
| MIMORD.CSV | ManufacturingOrderRoutings.json, MIMORD.json | 0 | ⚠️ EMPTY |
| MIPOH.CSV | PurchaseOrders.json, MIPOH.json | 3,734 | ✅ |
| MIPOD.CSV | PurchaseOrderDetails.json, MIPOD.json | 7,275 | ✅ |
| MIPOHX.CSV | PurchaseOrderExtensions.json | 18 | ✅ |
| MIPOC.CSV | PurchaseOrderExtensions.json, MIPOC.json | 18 | ✅ |
| MIPOCV.CSV | PurchaseOrderAdditionalCosts.json | 17 | ✅ |
| MIPODC.CSV | PurchaseOrderDetailAdditionalCosts.json | 6 | ✅ |
| MIJOBH.CSV | Jobs.json, MIJOBH.json | 2 | ✅ |
| MIJOBD.CSV | JobDetails.json, MIJOBD.json | 1 | ✅ |
| MIWOH.CSV | WorkOrders.json, MIWOH.json, WorkOrderHeaders.json | 1 | ✅ |
| MIWOD.CSV | WorkOrderDetails.json, MIWOD.json | 1 | ✅ |
| MIILOCQT.CSV | MIILOCQT.json | 157,314 | ✅ |
| MIBINQ.CSV | MIBINQ.json | 165,935 | ✅ |
| MIBINH.CSV | MIBINH.json | 293 | ✅ |
| MILOGH.CSV | MILOGH.json | 58,372 | ✅ |
| MILOGD.CSV | MILOGD.json | 74,791 | ✅ |
| MILOGB.CSV | MILOGB.json | 2,241 | ✅ |
| MIICST.CSV | MIICST.json | 17,634 | ✅ |
| MIITEMX.CSV | MIITEMX.json | 1,863 | ✅ |
| MIITEMA.CSV | MIITEMA.json | 17 | ✅ |
| MIQMFG.CSV | MIQMFG.json | 0 | ⚠️ EMPTY |
| MISUPL.CSV | MISUPL.json | 224 | ✅ |
| MIQSUP.CSV | MIQSUP.json | 1,352 | ✅ |
| MIUSER.CSV | MIUSER.json | 12 | ✅ |
| MISLTH.CSV | LotSerialHistory.json | 23,125 | ✅ |
| MISLTD.CSV | LotSerialDetail.json | 7,120 | ✅ |
| MISLHIST.CSV | MISLHIST.json | 26,360 | ✅ |
| MISLNH.CSV | MISLNH.json | 5,827 | ✅ |
| MISLND.CSV | MISLND.json | 6,271 | ✅ |
| MISLBINQ.CSV | MISLBINQ.json | 0 | ⚠️ EMPTY |

---

## 2. NOT MAPPED – In Folder, No Converter Mapping

These 36 files exist in Full Company Data but have no mapping in the converter:

| File | File | File | File |
|------|------|------|------|
| MIACCT.CSV | MIACST.CSV | MIACSTX.CSV | MIBLOC.CSV |
| MIBOMDA.CSV | MIBORD.CSV | MICCD.CSV | MICRT.CSV |
| MICRTD.CSV | MICRTH.CSV | MIDLOC.CSV | MIDLOCA.CSV |
| MIFLDS.CSV | MIGLACCT.CSV | MIGROUP.CSV | MIITTX.CSV |
| MIMOWC.CSV | MIMOWCC.CSV | MIMOWR.CSV | MINBTD.CSV |
| MINBTH.CSV | MIPORCVR.CSV | MIQSUPD.CSV | MISCHAUT.CSV |
| MISCHID.CSV | MISCHITEM.CSV | MISCHQTY.CSV | MISHOPD.CSV |
| MISHOPH.CSV | MITOOL.CSV | MITXAUTH.CSV | MITXCLS.CSV |
| MITXGRP.CSV | MITXRATE.CSV | MIWCSD.CSV | MIWCSH.CSV |

---

## 3. EMPTY – Mapped but No Data Loaded

| CSV File | App Key(s) | Likely Cause |
|----------|------------|--------------|
| MIMORD.CSV | ManufacturingOrderRoutings.json, MIMORD.json | Column names don't match converter |
| MIQMFG.CSV | MIQMFG.json | Column names don't match converter |
| MISLBINQ.CSV | MISLBINQ.json | Column names don't match converter |

---

## 4. Summary

| Category | Count |
|----------|-------|
| **In use (OK)** | 33 |
| **In use (empty)** | 3 |
| **Not mapped** | 36 |
| **Total files** | 72 |

### Coverage

- **Used:** 36 files (33 with data + 3 empty)
- **Missing from mapping:** 36 files
- **~50%** of Full Company Data files are mapped and loaded

---

## 5. Key Datasets (Record Counts)

| Dataset | App Key | Records |
|---------|---------|---------|
| Items | CustomAlert5.json | 1,882 |
| Manufacturing Orders | ManufacturingOrderHeaders.json | 3,828 |
| Purchase Orders | PurchaseOrders.json | 3,734 |
| Stock by location | MIILOCQT.json | 157,314 |
| Transactions | MILOGH.json | 58,372 |
| Cost history | MIICST.json | 17,634 |
| Jobs | Jobs.json | 2 |
| Work orders | WorkOrders.json | 1 |
| Suppliers | MISUPL.json | 224 |
| BOM | BillOfMaterialDetails.json | 2,967 |

---

## 6. How to Fix

1. **Empty mappings (MIMORD, MIQMFG, MISLBINQ):** Check CSV column names vs `_FULL_COMPANY_CSV_MAPPINGS` in `backend/app.py` or `full_company_data_converter.py`.
2. **Not mapped (36 files):** Add mappings in the converter if those tables are needed for the app.
