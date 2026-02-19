"""
Full Company Data converter: CSV/Excel from MISys "Export All Company Data" -> app JSON shape.
Maps MIITEM, MIILOC, MIBOMH, MIBOMD, MIMOH, MIMOMD, MIPOH, MIPOD etc. to keys expected by the portal.

Supports full export batches (e.g. <60MB total). All CSVs in the folder are loaded; no size limit
is applied here. GZIP on /api/data and HTTP/2 (no 32MB response cap) handle large responses.

Uses parallel file loading (ThreadPoolExecutor) to reduce load time from 1-2 min to ~10-30 sec.
"""
import os
import pandas as pd
from io import StringIO, BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed

# File stem -> (app keys to fill, column rename map export_name -> app_name)
FULL_COMPANY_MAPPINGS = {
    # MIITEM: exact columns from MISys Full Company Data export (MIITEM.CSV) – all export columns that map to app fields
    "MIITEM": (
        ["CustomAlert5.json", "Items.json"],
        {"itemId": "Item No.", "descr": "Description", "xdesc": "Extended Description", "ref": "Part No.", "type": "Item Type", "uOfM": "Stocking Units",
         "poUOfM": "Purchasing Units", "uConvFact": "Units Conversion Factor", "revId": "Current BOM Revision", "lead": "Lead (Days)",
         "totQStk": "Stock", "totQWip": "WIP", "totQRes": "Reserve", "totQOrd": "On Order",
         "minLvl": "Minimum", "maxLvl": "Maximum", "ordLvl": "Reorder Level", "ordQty": "Reorder Quantity", "lotSz": "Lot Size", "variance": "Variance",
         "minQty": "Minimum", "maxQty": "Maximum", "reordPoint": "Reorder Level", "reordQty": "Reorder Quantity",
         "cLast": "Recent Cost", "cStd": "Standard Cost", "cAvg": "Average Cost", "cLand": "Landed Cost", "itemCost": "Unit Cost",
         "stdCost": "Standard Cost", "avgCost": "Average Cost", "unitCost": "Unit Cost", "landedCost": "Landed Cost",
         "locId": "Location No.", "suplId": "Supplier No.", "mfgId": "Manufacturer No.", "status": "Status", "unitWgt": "Unit Weight",
         "pick": "Pick", "sales": "Sales", "track": "Track", "cycle": "Cycle", "lstUseDt": "Last Used Date", "lstPIDt": "Last PO Date"},
    ),
    "Item": (
        ["CustomAlert5.json", "Items.json"],
        {"itemId": "Item No.", "descr": "Description", "type": "Item Type", "uOfM": "Stocking Units",
         "poUOfM": "Purchasing Units", "totQStk": "Stock", "totQWip": "WIP", "totQRes": "Reserve", "totQOrd": "On Order"},
    ),
    # Alternate file names so export works whether you have Item.csv, Items.csv, MIITEM.csv, or CustomAlert5.csv
    "Items": (
        ["CustomAlert5.json", "Items.json"],
        {"itemId": "Item No.", "Item No": "Item No.", "Item No.": "Item No.", "Item Number": "Item No.",
         "descr": "Description", "Description": "Description", "Desc": "Description",
         "type": "Item Type", "Item Type": "Item Type", "Type": "Item Type",
         "uOfM": "Stocking Units", "Stocking Units": "Stocking Units", "Stocking Unit": "Stocking Units", "UOM": "Stocking Units",
         "poUOfM": "Purchasing Units", "Purchasing Units": "Purchasing Units", "Purchasing Unit": "Purchasing Units",
         "totQStk": "Stock", "Stock": "Stock", "On Hand": "Stock", "Qty On Hand": "Stock",
         "totQWip": "WIP", "WIP": "WIP", "totQRes": "Reserve", "Reserve": "Reserve",
         "totQOrd": "On Order", "On Order": "On Order", "Qty On Order": "On Order",
         "minLvl": "Minimum", "minQty": "Minimum", "Minimum": "Minimum", "maxLvl": "Maximum", "maxQty": "Maximum", "Maximum": "Maximum",
         "ordLvl": "Reorder Level", "reordPoint": "Reorder Level", "Reorder Level": "Reorder Level",
         "ordQty": "Reorder Quantity", "reordQty": "Reorder Quantity", "Reorder Quantity": "Reorder Quantity", "Reorder Qty": "Reorder Quantity", "lotSz": "Lot Size",
         "cLast": "Recent Cost", "cStd": "Standard Cost", "cAvg": "Average Cost", "cLand": "Landed Cost",
         "stdCost": "Standard Cost", "Standard Cost": "Standard Cost", "avgCost": "Average Cost", "Average Cost": "Average Cost",
         "unitCost": "Unit Cost", "Unit Cost": "Unit Cost", "Recent Cost": "Recent Cost", "Last Cost": "Recent Cost",
         "landedCost": "Landed Cost", "Landed Cost": "Landed Cost", "status": "Status", "locId": "Location No.", "suplId": "Supplier No.", "mfgId": "Manufacturer No."},
    ),
    "CustomAlert5": (
        ["CustomAlert5.json", "Items.json"],
        {"itemId": "Item No.", "Item No": "Item No.", "Item No.": "Item No.", "Item Number": "Item No.",
         "descr": "Description", "Description": "Description", "Desc": "Description",
         "type": "Item Type", "Item Type": "Item Type", "Type": "Item Type",
         "uOfM": "Stocking Units", "Stocking Units": "Stocking Units", "Stocking Unit": "Stocking Units", "UOM": "Stocking Units",
         "poUOfM": "Purchasing Units", "Purchasing Units": "Purchasing Units", "Purchasing Unit": "Purchasing Units",
         "uConvFact": "Units Conversion Factor", "Units Conversion Factor": "Units Conversion Factor",
         "totQStk": "Stock", "Stock": "Stock", "On Hand": "Stock", "Qty On Hand": "Stock",
         "totQWip": "WIP", "WIP": "WIP", "totQRes": "Reserve", "Reserve": "Reserve",
         "totQOrd": "On Order", "On Order": "On Order", "Qty On Order": "On Order",
         "minLvl": "Minimum", "minQty": "Minimum", "Minimum": "Minimum", "maxLvl": "Maximum", "maxQty": "Maximum", "Maximum": "Maximum",
         "ordLvl": "Reorder Level", "reordPoint": "Reorder Level", "Reorder Level": "Reorder Level",
         "ordQty": "Reorder Quantity", "reordQty": "Reorder Quantity", "Reorder Quantity": "Reorder Quantity", "Reorder Qty": "Reorder Quantity", "lotSz": "Lot Size",
         "cLast": "Recent Cost", "cStd": "Standard Cost", "cAvg": "Average Cost", "cLand": "Landed Cost",
         "stdCost": "Standard Cost", "Standard Cost": "Standard Cost", "avgCost": "Average Cost", "Average Cost": "Average Cost",
         "unitCost": "Unit Cost", "Unit Cost": "Unit Cost", "Recent Cost": "Recent Cost", "Last Cost": "Recent Cost",
         "landedCost": "Landed Cost", "Landed Cost": "Landed Cost", "status": "Status", "locId": "Location No.", "suplId": "Supplier No.", "mfgId": "Manufacturer No."},
    ),
    # MIILOC: exact columns from export (itemId, locId, pick, minLvl, maxLvl, ordLvl, ordQty, qStk, qWIP, qRes, qOrd)
    "MIILOC": (
        ["MIILOC.json"],
        {"itemId": "Item No.", "locId": "Location No.", "pick": "Pick", "minLvl": "Minimum", "maxLvl": "Maximum",
         "ordLvl": "Reorder Level", "ordQty": "Reorder Quantity", "qStk": "qStk", "qWIP": "qWIP", "qRes": "qRes", "qOrd": "qOrd"},
    ),
    "MIBOMH": (
        ["MIBOMH.json", "BillsOfMaterial.json"],
        {"bomItem": "Parent Item No.", "bomRev": "Revision No.", "mult": "Build Quantity", "descr": "Description",
         "BOM Item": "Parent Item No.", "BOM Rev": "Revision No."},
    ),
    # MIBOMD: exact columns from export (bomItem, bomRev, partId, qty, lead, cmnt, opCode, srcLoc)
    "MIBOMD": (
        ["MIBOMD.json", "BillOfMaterialDetails.json"],
        {"bomItem": "Parent Item No.", "bomRev": "Revision No.", "partId": "Component Item No.", "qty": "Required Quantity",
         "BOM Item": "Parent Item No.", "BOM Rev": "Revision No.", "Part Id": "Component Item No.", "Qty": "Required Quantity",
         "lead": "Lead (Days)", "leadTime": "Lead (Days)", "Lead (Days)": "Lead (Days)", "cmnt": "Comment", "Comment": "Comment",
         "opCode": "Operation No.", "operNo": "Operation No.", "Operation No.": "Operation No.",
         "srcLoc": "Source Location", "Source Location": "Source Location", "altItems": "Alternative Items", "lineNbr": "Line", "Line": "Line", "Detail Type": "Detail Type", "dType": "Detail Type", "Uniquifier": "Uniquifier"},
    ),
    "MIMOH": (
        ["ManufacturingOrderHeaders.json", "MIMOH.json"],
        {"mohId": "Mfg. Order No.", "buildItem": "Build Item No.", "bomItem": "BOM Item", "bomRev": "BOM Rev",
         "moStat": "Status", "ordQty": "Ordered", "relOrdQty": "Release Order Quantity", "ordDt": "Order Date",
         "startDt": "Start Date", "endDt": "Completion Date", "releaseDt": "Release Date", "closeDt": "Completion Date",
         "soShipDt": "Sales Order Ship Date", "customer": "Customer", "custId": "Customer",
         "descr": "Description", "creator": "Created By", "releaser": "Released By",
         "wipQty": "WIP", "resQty": "Reserve", "endQty": "Completed", "relQty": "Issued",
         "cumCost": "Cumulative Cost", "actMatCost": "Actual Material Cost", "actLabCost": "Actual Labor Cost",
         "actOhdCost": "Actual Overhead Cost", "totMatCost": "Total Material Cost", "totScrapCost": "Total Scrap Cost",
         "projMatCost": "Projected Material Cost", "projLabCost": "Projected Labor Cost", "projOhdCost": "Projected Overhead Cost",
         "usedMatCost": "Used Material Cost", "usedLabCost": "Used Labor Cost", "usedOhdCost": "Used Overhead Cost",
         "onHold": "On Hold", "soId": "Sales Order No.", "jobId": "Job No.", "locId": "Location No."},
    ),
    # MIMOMD: exact columns from export (mohId, partId, qty, reqQty, relQty, wipQty, resQty, endQty)
    "MIMOMD": (
        ["ManufacturingOrderDetails.json", "MIMOMD.json"],
        {"mohId": "Mfg. Order No.", "partId": "Component Item No.", "reqQty": "Required Quantity", "qty": "Quantity",
         "endQty": "Completed", "compQty": "Completed", "relQty": "Released", "wipQty": "WIP", "resQty": "Reserve"},
    ),
    # MIPOH: exact columns from export (pohId, poStatus, suplId, name, ordDt, closeDt, totOrdered, totReceived)
    "MIPOH": (
        ["PurchaseOrders.json", "MIPOH.json"],
        {"pohId": "PO No.", "poNo": "PO No.", "suplId": "Supplier No.", "supId": "Supplier No.", "supplierNo": "Supplier No.",
         "name": "Name", "Name": "Name", "ordDt": "Order Date", "orderDate": "Order Date",
         "poStatus": "Status", "poStat": "Status", "status": "Status", "PO Status": "Status",
         "totOrdered": "Total Ordered", "totReceived": "Total Received", "totInvoiced": "Total Invoiced",
         "Total Ordered": "Total Ordered", "Total Received": "Total Received",
         "totalAmt": "Total Amount", "totalAmount": "Total Amount", "totTaxAmt": "Total Tax Amount", "totAddCost": "Total Additional Cost", "totAddTax": "Total Additional Tax",
         "Contact": "Contact", "Buyer": "Buyer", "Terms": "Terms", "shpVia": "Ship Via", "Ship Via": "Ship Via", "fob": "FOB", "FOB": "FOB", "Freight": "Freight",
         "closeDt": "Close Date", "Close Date": "Close Date", "expDt": "Expedited Date", "rateDt": "Rate Date",
         "homeCur": "Home Currency", "srcCur": "Source Currency", "rate": "Rate", "invoiced": "Invoiced", "Invoiced": "Invoiced",
         "locId": "Location No.", "jobId": "Job No.", "taxGrp": "Tax Group", "bLocId": "Bill to Location"},
    ),
    # MIPOD: exact columns from export (pohId, itemId, ordered, received, price, cost, descr, initDueDt, realDueDt, mohId)
    "MIPOD": (
        ["PurchaseOrderDetails.json", "MIPOD.json"],
        {"pohId": "PO No.", "poNo": "PO No.", "partId": "Item No.", "itemId": "Item No.",
         "ordered": "Ordered", "received": "Received", "ordQty": "Ordered", "recvQty": "Received",
         "price": "Unit Cost", "cost": "Unit Cost", "unitCost": "Unit Cost", "Unit Cost": "Unit Cost", "Cost": "Unit Cost", "Price": "Unit Price",
         "descr": "Description", "Description": "Description",
         "initDueDt": "Required Date", "realDueDt": "Required Date", "promisedDt": "Required Date", "lastRecvDt": "Last Received Date",
         "Real Due Date": "Required Date", "Initial Due Date": "Required Date", "Promised Date": "Required Date",
         "lineNbr": "Line No.", "lineNo": "Line No.", "Line No.": "Line No.", "podId": "Line No.", "PO Detail No.": "Line No.",
         "Extended Price": "Extended Price", "Location No.": "Location No.", "locId": "Location No.", "jobId": "Job No.",
         "Comment": "Comment", "cmt": "Comment", "Additional Cost": "Additional Cost", "adCost": "Additional Cost",
         "Last Received Date": "Last Received Date", "mohId": "Manufacturing Order No.", "Manufacturing Order No.": "Manufacturing Order No.",
         "dStatus": "Detail Status", "Detail Status": "Detail Status", "Invoiced": "Invoiced", "invoiced": "Invoiced"},
    ),
    # MIWOH: exact columns from export (wohId, status, releaseDt, descr, locId, jobId, ...)
    "MIWOH": (
        ["WorkOrders.json", "MIWOH.json", "WorkOrderHeaders.json"],
        {"wohId": "Work Order No.", "jobId": "Job No.", "status": "Status", "woStat": "Status", "releaseDt": "Release Date",
         "descr": "Description", "locId": "Location No.", "soId": "Sales Order No.", "lstMaintDt": "Last Maint Date", "creator": "Creator", "releaser": "Releaser", "priority": "Priority"},
    ),
    # MIWOD: exact columns from export (wohId, partId, reqQty, mohId)
    "MIWOD": (
        ["WorkOrderDetails.json", "MIWOD.json"],
        {"wohId": "Work Order No.", "jobId": "Job No.", "partId": "Item No.", "itemId": "Item No.",
         "reqQty": "Required Quantity", "ordQty": "Ordered", "endQty": "Completed", "compQty": "Completed",
         "mohId": "Manufacturing Order No.", "soId": "Sales Order No."},
    ),
    # MO routings (work centers, operations)
    "MIMORD": (
        ["ManufacturingOrderRoutings.json", "MIMORD.json"],
        {"mohId": "Mfg. Order No.", "opNo": "Operation No.", "workCtr": "Work Center No.", "runTime": "Run Time",
         "setupTime": "Setup Time", "operNo": "Operation No.", "seq": "Sequence", "Operation No.": "Operation No.", "Work Center No.": "Work Center No."},
    ),
    # PO extensions (key-value extensions per PO/line)
    "MIPOC": (
        ["PurchaseOrderExtensions.json", "MIPOC.json"],
        {"pohId": "PO No.", "poNo": "PO No.", "lineNo": "Line No.", "extType": "Extension Type", "extValue": "Extension Value", "extDesc": "Extension Description",
         "PO Revision": "PO Revision", "Extension Type": "Extension Type", "Extension Value": "Extension Value", "Extension Description": "Extension Description"},
    ),
    "MIPOHX": (
        ["PurchaseOrderExtensions.json"],
        {"pohId": "PO No.", "poNo": "PO No.", "lineNo": "Line No.", "extType": "Extension Type", "extValue": "Extension Value", "extDesc": "Extension Description"},
    ),
    # PO header-level additional costs (freight, etc.)
    "MIPOCV": (
        ["PurchaseOrderAdditionalCosts.json", "MIPOCV.json"],
        {"purchaseOrderId": "PO No.", "pohId": "PO No.", "poNo": "PO No.", "Purchase Order Id": "PO No.", "addlCost": "Cost Type", "Additional Cost": "Cost Type",
         "Amount": "Amount", "Description": "Description", "Line": "Line", "Purchase Order Revision": "PO Revision", "Supplier": "Supplier",
         "A/P Invoice Account No.": "Account", "Account No.": "Account", "Comment": "Comment", "Date": "Date", "Invoice No.": "Invoice No.", "Invoiced": "Invoiced"},
    ),
    # PO line-level additional costs
    "MIPODC": (
        ["PurchaseOrderDetailAdditionalCosts.json", "MIPODC.json"],
        {"pohId": "PO No.", "poNo": "PO No.", "PO No.": "PO No.", "poLineNo": "PO Line No.", "PO Line No.": "PO Line No.", "PO Cost Line No.": "PO Cost Line No.",
         "Additional Cost": "Additional Cost", "Amount": "Amount", "Description": "Description", "Extended Price": "Extended Price", "Unit Price": "Unit Price",
         "PO Revision": "PO Revision", "Supplier": "Supplier", "Source Currency": "Source Currency", "Date": "Date", "Tax Amount": "Tax Amount"},
    ),
    # Jobs (header and detail)
    "MIJOBH": (
        ["Jobs.json", "MIJOBH.json"],
        {"jobId": "Job No.", "Job No.": "Job No.", "jobNo": "Job No.", "descr": "Description", "status": "Status", "Status": "Status",
         "custId": "Customer", "customer": "Customer", "soId": "Sales Order No.", "locId": "Location No.", "Location No.": "Location No.", "createdDt": "Created Date", "closeDt": "Close Date"},
    ),
    "MIJOBD": (
        ["JobDetails.json", "MIJOBD.json"],
        {"jobId": "Job No.", "Job No.": "Job No.", "jobItem": "Item No.", "partId": "Item No.", "itemId": "Item No.", "Item No.": "Item No.",
         "part": "Part No.", "Part No.": "Part No.", "locId": "Location No.", "Location No.": "Location No.", "type": "Type", "Type": "Type",
         "qStk": "Stock Quantity", "qWip": "WIP Qty", "qRes": "Reserve Qty", "qOrd": "On Order Qty", "qUsed": "Used Qty", "qRecd": "Received Qty",
         "Stock Quantity": "Stock Quantity", "WIP Qty": "WIP Qty", "Reserve Qty": "Reserve Qty", "On Order Qty": "On Order Qty", "Used Qty": "Used Qty", "Received Qty": "Received Qty"},
    ),
    # Lot/serial transaction history (Full Company Data export)
    # MISLTH: export columns (tranDate, userId, itemId) or UI-style (Transaction Date, User ID, Item No.)
    "MISLTH": (
        ["LotSerialHistory.json"],
        {"tranDate": "Transaction Date", "tranDt": "Transaction Date", "Transaction Date": "Transaction Date",
         "userId": "User", "User ID": "User", "User": "User",
         "itemId": "Item No.", "Item No.": "Item No.", "Item No": "Item No.",
         "prntItemId": "Parent Item No.", "locId": "Location No.", "jobId": "Job No.",
         "type": "Type", "Type": "Type", "Primary Transaction Type": "Type", "Detail Transaction Type": "Type",
         "xvarMOId": "Mfg. Order No.", "Mfg. Order No.": "Mfg. Order No.", "Transaction No.": "Transaction No.",
         "xvarSOId": "Sales Order No.", "Detail No.": "Detail No.",
         "trnQty": "Quantity", "Quantity": "Quantity", "recQty": "Received Qty", "rdyQty": "Ready Qty"},
    ),
    # MISLTD: lot/serial detail – SL No., Description, Status, Expiration Date, Quantity in Stock/Used/Received/Scrap
    "MISLTD": (
        ["LotSerialDetail.json"],
        {"prntLotId": "Lot No.", "lotId": "Lot No.", "SL No.": "Lot No.", "SL No": "Lot No.",
         "entry": "Serial No.", "detail": "Serial No.", "serialNo": "Serial No.", "Serial No.": "Serial No.",
         "itemId": "Item No.", "Item No.": "Item No.", "Item No": "Item No.", "prntItemId": "Parent Item No.",
         "trnQty": "Quantity", "recQty": "Quantity", "qty": "Quantity",
         "Description": "Description", "Status": "Status", "Expiration Date": "Expiration Date",
         "Quantity in Stock": "Quantity in Stock", "Quantity Used": "Quantity Used",
         "Quantity Received": "Quantity Received", "Scrap Quantity": "Scrap Quantity"},
    ),
    # --- Item popup: extra tables so modal has full data ---
    # MIILOCQT: on-hand by item+location (and date)
    "MIILOCQT": (
        ["MIILOCQT.json"],
        {"itemId": "Item No.", "locId": "Location No.", "dateISO": "Date ISO", "date": "Date",
         "qStk": "On Hand", "qWip": "WIP", "qRes": "Reserve", "qOrd": "On Order",
         "cStd": "Standard Cost", "cLast": "Recent Cost", "cAvg": "Average Cost"},
    ),
    # MIBINQ: on-hand by item+location+bin
    "MIBINQ": (
        ["MIBINQ.json"],
        {"itemId": "Item No.", "locId": "Location No.", "binId": "Bin No.", "qStk": "On Hand",
         "descr": "Description", "status": "Status", "createDt": "Create Date", "lstUseDt": "Last Used Date"},
    ),
    # MISLBINQ: lot/serial qty by bin
    "MISLBINQ": (
        ["MISLBINQ.json"],
        {"itemId": "Item No.", "locId": "Location No.", "binId": "Bin No.", "lotId": "Lot No.", "qStk": "On Hand"},
    ),
    # MISLHIST: lot master/history (for SL Numbers / History)
    "MISLHIST": (
        ["MISLHIST.json"],
        {"itemId": "Item No.", "prntItemId": "Parent Item No.", "lotId": "Lot No.", "tranDate": "Transaction Date",
         "userId": "User", "entry": "Entry", "detail": "Detail", "qty": "Quantity", "locId": "Location No.",
         "tranDt": "Transaction Date", "assignedDt": "Assigned Date"},
    ),
    # MISLNH: lot header definition
    "MISLNH": (
        ["MISLNH.json"],
        {"prntItemId": "Parent Item No.", "lotId": "Lot No.", "itemId": "Item No."},
    ),
    # MISLND: lot detail
    "MISLND": (
        ["MISLND.json"],
        {"prntItemId": "Parent Item No.", "lotId": "Lot No.", "itemId": "Item No."},
    ),
    # MILOGH: main inventory log (Stock Movement timeline)
    "MILOGH": (
        ["MILOGH.json"],
        {"itemId": "Item No.", "tranDate": "Transaction Date", "userId": "User", "entry": "Entry", "type": "Type",
         "comment": "Comment", "qty": "Quantity", "locId": "Location No.", "binId": "Bin No.", "jobId": "Job No.",
         "xvarPOId": "PO No.", "xvarMOId": "Mfg. Order No.", "xvarWOId": "Work Order No.", "tranDt": "Transaction Date"},
    ),
    # MILOGD: inventory log detail (lines per transaction)
    "MILOGD": (
        ["MILOGD.json"],
        {"itemId": "Item No.", "tranDate": "Transaction Date", "tranDt": "Transaction Date", "entry": "Entry", "detail": "Detail",
         "qty": "Quantity", "locId": "Location No.", "uom": "UOM"},
    ),
    # MILOGB: inventory log bin breakdown
    "MILOGB": (
        ["MILOGB.json"],
        {"itemId": "Item No.", "tranDate": "Transaction Date", "tranDt": "Transaction Date", "entry": "Entry", "detail": "Detail",
         "locId": "Location No.", "binId": "Bin No.", "lotId": "Lot No.", "qty": "Quantity"},
    ),
    # MIBINH: bin movement history
    "MIBINH": (
        ["MIBINH.json"],
        {"itemId": "Item No.", "tranDate": "Transaction Date", "userId": "User", "entry": "Entry", "detail": "Detail",
         "locId": "Location No.", "type": "Type", "trnQty": "Quantity", "recQty": "Received Qty",
         "xvarPOId": "PO No.", "xvarMOId": "Mfg. Order No.", "tranDt": "Transaction Date"},
    ),
    # MIICST: cost history (Costs tab timeline)
    "MIICST": (
        ["MIICST.json"],
        {"itemId": "Item No.", "transDate": "Transaction Date", "seqNo": "Seq No.", "locId": "Location No.",
         "type": "Type", "tranType": "Tran Type", "suplId": "Supplier No.", "poId": "PO No.", "poRev": "PO Rev", "poDtl": "PO Line",
         "reference": "Reference", "qRecd": "Qty Received", "cost": "Cost", "cLand": "Landed Cost",
         "qUsed": "Qty Used", "qWip": "WIP", "transDt": "Transaction Date", "extCost": "Extended Cost"},
    ),
    # MIITEMX: item notes, docPath, picPath (Notes tab)
    "MIITEMX": (
        ["MIITEMX.json"],
        {"itemId": "Item No.", "notes": "Notes", "docPath": "Document Path", "picPath": "Picture Path"},
    ),
    # MIITEMA: alternates (Alternates tab)
    "MIITEMA": (
        ["MIITEMA.json"],
        {"itemId": "Item No.", "altItemId": "Alternate Item No.", "uniquifier": "Uniquifier", "lineNbr": "Line No."},
    ),
    # MIQMFG: manufacturer links (Manufacturers tab)
    "MIQMFG": (
        ["MIQMFG.json"],
        {"itemId": "Item No.", "mfgId": "Manufacturer No.", "mfgName": "Manufacturer Name", "mfgProdCode": "Product Code"},
    ),
    # MISUPL: supplier master (Suppliers tab: join to PO suplId for names)
    "MISUPL": (
        ["MISUPL.json"],
        {"suplId": "Supplier No.", "shortName": "Short Name", "name": "Name", "adr1": "Address 1", "adr2": "Address 2",
         "city": "City", "state": "State", "zip": "Zip", "country": "Country", "phone": "Phone", "contact": "Contact",
         "cur": "Currency", "terms": "Terms", "email1": "Email", "website": "Website", "notes": "Notes"},
    ),
    # MIQSUP: supplier–item links (preferred supplier per item)
    "MIQSUP": (
        ["MIQSUP.json"],
        {"suplId": "Supplier No.", "itemId": "Item No.", "status": "Status", "leadTime": "Lead Time", "minQty": "Minimum Qty"},
    ),
    # MIUSER: users (audit, who did what)
    "MIUSER": (
        ["MIUSER.json"],
        {"userId": "User", "userName": "Name", "displayName": "Display Name", "email": "Email", "isActive": "Active"},
    ),
}

# Case-insensitive file stem lookup: MIITEM.CSV, miitem.csv, MiItem.Csv all use MIITEM mapping
_STEM_TO_KEY = {k.upper(): k for k in FULL_COMPANY_MAPPINGS}
# Alternate file stems so MISys exports named e.g. LotSerialHistory.csv or SLTH.csv still load
for _alt, _main in [
    ("SLTH", "MISLTH"), ("LOTSERIALHISTORY", "MISLTH"), ("SERIALLOTTRACKINGHISTORY", "MISLTH"),
    ("SLTD", "MISLTD"), ("LOTSERIALDETAIL", "MISLTD"), ("SERIALLOTTRACKINGDETAIL", "MISLTD"),
]:
    _STEM_TO_KEY[_alt] = _main


def _read_table(content, file_name, is_bytes=False):
    """Read CSV or Excel from content (str or bytes). Returns list of dicts."""
    try:
        if file_name.lower().endswith(".csv"):
            if is_bytes:
                raw = content.decode("utf-8", errors="replace")
                df = pd.read_csv(StringIO(raw), encoding="utf-8", on_bad_lines="skip")
            else:
                df = pd.read_csv(StringIO(content) if isinstance(content, str) else content, encoding="utf-8", on_bad_lines="skip")
        elif file_name.lower().endswith((".xlsx", ".xls")):
            if is_bytes:
                df = pd.read_excel(BytesIO(content), engine="openpyxl" if file_name.lower().endswith(".xlsx") else None)
            else:
                df = pd.read_excel(content, engine="openpyxl" if file_name.lower().endswith(".xlsx") else None)
        else:
            return None
        df = df.fillna("")
        # Normalize column names: strip, and try export-style (no space) vs display (with space)
        cols = {c: c.strip() for c in df.columns}
        df = df.rename(columns=cols)
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"[full_company_data_converter] read error {file_name}: {e}")
        return None


def _normalize_col(s):
    """Normalize column name for matching: strip, lower, collapse spaces."""
    if s is None or not isinstance(s, str):
        return ""
    return " ".join(s.strip().lower().split())


def _apply_column_map(rows, column_map):
    """Rename keys in each row per column_map (export -> app). Case-insensitive match so export columns find the roadmap."""
    if not rows or not column_map:
        return rows
    # Build lookup: normalized export key -> app key (first wins if multiple export keys map to same app key)
    export_to_app = {}
    for export_key, app_key in column_map.items():
        norm = _normalize_col(export_key)
        if norm and norm not in export_to_app:
            export_to_app[norm] = app_key
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        new_row = {}
        for k, v in row.items():
            app_key = column_map.get(k) or column_map.get(k.strip())
            if not app_key and k:
                app_key = export_to_app.get(_normalize_col(k))
            if app_key:
                new_row[app_key] = v
            else:
                new_row[k] = v
        out.append(new_row)
    return out


def _load_single_file_local(folder_path, fname):
    """Load one file from local folder. Returns (mapping_key, keys, rows) or None on skip/error."""
    if not fname.lower().endswith((".csv", ".xlsx", ".xls")):
        return None
    stem = os.path.splitext(fname)[0]
    mapping_key = _STEM_TO_KEY.get(stem.upper(), stem)
    if mapping_key not in FULL_COMPANY_MAPPINGS:
        return None
    path = os.path.join(folder_path, fname)
    try:
        if fname.lower().endswith(".csv"):
            with open(path, "r", encoding="utf-8", errors="replace") as fp:
                raw = fp.read()
            rows = _read_table(raw, fname, is_bytes=False)
        elif fname.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(path, engine="openpyxl" if fname.lower().endswith(".xlsx") else None)
            df = df.fillna("")
            rows = df.to_dict(orient="records")
        else:
            return None
    except Exception as e:
        print(f"[full_company_data_converter] skip {fname}: {e}")
        return None
    if not rows:
        return None
    keys, column_map = FULL_COMPANY_MAPPINGS[mapping_key]
    rows = _apply_column_map(rows, column_map)
    return (mapping_key, keys, rows, fname)


def load_from_folder(folder_path):
    """
    Load Full Company Data from a local folder. Returns (data_dict, None) or (None, error_message).
    Uses parallel file loading to reduce load time (1-2 min -> ~10-30 sec).
    """
    if not folder_path or not os.path.isdir(folder_path):
        return None, "Folder not found or not a directory"
    try:
        skeleton = _get_skeleton()
        files = [f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))]
        to_load = [f for f in files if f.lower().endswith((".csv", ".xlsx", ".xls"))]
        loaded_stems = []
        max_workers = min(8, max(1, len(to_load)))
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = {ex.submit(_load_single_file_local, folder_path, fname): fname for fname in to_load}
            for future in as_completed(futures):
                result = future.result()
                if result is None:
                    continue
                mapping_key, keys, rows, fname = result
                for key in keys:
                    if key in skeleton and isinstance(skeleton[key], list):
                        skeleton[key] = list(rows)
                loaded_stems.append(mapping_key)
                print(f"[full_company_data_converter] loaded {fname} -> {len(rows)} rows -> {keys}")
        if loaded_stems:
            print(f"[full_company_data_converter] Loaded export files: {', '.join(sorted(set(loaded_stems)))}")
        return skeleton, None
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, str(e)


def _get_skeleton():
    """Same keys as app get_empty_app_data_structure()."""
    return {
        "CustomAlert5.json": [], "Items.json": [], "MIITEM.json": [], "MIILOC.json": [],
        "BillsOfMaterial.json": [], "BillOfMaterialDetails.json": [], "MIBOMH.json": [], "MIBOMD.json": [],
        "ManufacturingOrderHeaders.json": [], "ManufacturingOrderDetails.json": [], "ManufacturingOrderRoutings.json": [],
        "MIMOH.json": [], "MIMOMD.json": [], "MIMORD.json": [], "Jobs.json": [], "JobDetails.json": [],
        "MIJOBH.json": [], "MIJOBD.json": [], "MIPOH.json": [], "MIPOD.json": [], "MIPOHX.json": [],
        "MIPOC.json": [], "MIPOCV.json": [], "MIPODC.json": [], "MIWOH.json": [], "MIWOD.json": [], "MIBORD.json": [],
        "PurchaseOrderDetails.json": [], "PurchaseOrderExtensions.json": [], "PurchaseOrders.json": [],
        "WorkOrderHeaders.json": [], "WorkOrderDetails.json": [], "WorkOrders.json": [], "ParsedSalesOrders.json": [],
        "SalesOrderHeaders.json": [], "SalesOrderDetails.json": [],
        "PurchaseOrderAdditionalCosts.json": [], "PurchaseOrderAdditionalCostsTaxes.json": [], "PurchaseOrderDetailAdditionalCosts.json": [],
        "SalesOrders.json": [], "SalesOrdersByStatus": {}, "TotalOrders": 0, "StatusFolders": [], "ScanMethod": "",
        "LotSerialHistory.json": [], "LotSerialDetail.json": [],
        "MIILOCQT.json": [], "MIBINQ.json": [], "MISLBINQ.json": [], "MISLHIST.json": [], "MISLNH.json": [], "MISLND.json": [],
        "MILOGH.json": [], "MILOGD.json": [], "MILOGB.json": [], "MIBINH.json": [], "MIICST.json": [], "MIITEMX.json": [], "MIITEMA.json": [],
        "MIQMFG.json": [], "MISUPL.json": [], "MIQSUP.json": [], "MIUSER.json": [],
        "MPS.json": {"mps_orders": [], "summary": {"total_orders": 0}},
    }


def _load_single_file_drive(drive_service, drive_id, finfo):
    """Download and parse one file from Drive. Returns (mapping_key, keys, rows, fname) or None."""
    fname = finfo.get("name") or finfo.get("fileName") or ""
    fid = finfo.get("id") or finfo.get("fileId")
    if not fname.lower().endswith((".csv", ".xlsx", ".xls")) or not fid:
        return None
    stem = os.path.splitext(fname)[0]
    mapping_key = _STEM_TO_KEY.get(stem.upper(), stem)
    if mapping_key not in FULL_COMPANY_MAPPINGS:
        return None
    content = drive_service.download_file(fid, fname)
    if content is None:
        print(f"[full_company_data_converter] skip (download failed): {fname}")
        return None
    is_bytes = isinstance(content, bytes)
    if not is_bytes and isinstance(content, str):
        rows = _read_table(content, fname, is_bytes=False)
    elif is_bytes:
        if fname.lower().endswith(".csv"):
            rows = _read_table(content, fname, is_bytes=True)
        elif fname.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(BytesIO(content), engine="openpyxl" if fname.lower().endswith(".xlsx") else None)
            df = df.fillna("")
            rows = df.to_dict(orient="records")
        else:
            return None
    else:
        return None
    if not rows:
        return None
    keys, column_map = FULL_COMPANY_MAPPINGS[mapping_key]
    rows = _apply_column_map(rows, column_map)
    return (mapping_key, keys, rows, fname)


def load_from_drive_api(drive_service, drive_id, folder_path=None, folder_id=None):
    """
    Load Full Company Data via Google Drive API.
    Either folder_id (preferred for latest-by-creation) or folder_path can be provided.
    Returns (data_dict, None) or (None, error_message).
    Uses parallel download+parse to reduce load time (1-2 min -> ~10-30 sec).
    """
    if not drive_service or not getattr(drive_service, "authenticated", False):
        return None, "Google Drive not available"
    try:
        if folder_id:
            pass  # use folder_id directly
        elif folder_path:
            folder_id = drive_service.find_folder_by_path(drive_id, folder_path)
            if not folder_id:
                return None, "Full Company Data folder not found"
        else:
            return None, "Either folder_id or folder_path required"
        files = drive_service.list_all_files_in_folder(folder_id, drive_id)
        if not files:
            print("[full_company_data_converter] Drive folder has no files")
            return _get_skeleton(), None
        skeleton = _get_skeleton()
        loaded_stems = []
        to_load = [f for f in files if (f.get("name") or f.get("fileName") or "").lower().endswith((".csv", ".xlsx", ".xls")) and (f.get("id") or f.get("fileId"))]
        max_workers = min(8, max(1, len(to_load)))
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = {ex.submit(_load_single_file_drive, drive_service, drive_id, finfo): finfo for finfo in to_load}
            for future in as_completed(futures):
                result = future.result()
                if result is None:
                    continue
                mapping_key, keys, rows, fname = result
                for key in keys:
                    if key in skeleton and isinstance(skeleton[key], list):
                        skeleton[key] = list(rows)
                loaded_stems.append(mapping_key)
                print(f"[full_company_data_converter] loaded {fname} -> {len(rows)} rows -> {keys}")
        if loaded_stems:
            print(f"[full_company_data_converter] Loaded export files: {', '.join(sorted(set(loaded_stems)))}")
        return skeleton, None
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, str(e)
