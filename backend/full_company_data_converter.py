"""
Full Company Data converter: CSV/Excel from MISys "Export All Company Data" -> app JSON shape.
Maps MIITEM, MIILOC, MIBOMH, MIBOMD, MIMOH, MIMOMD, MIPOH, MIPOD etc. to keys expected by the portal.

ROADMAP (where data goes): See FULL_COMPANY_DATA_ROADMAP.md in this folder.
- File names: Item.csv or MIITEM.csv, MIBOMD.csv, MIPOH.csv, MIPOD.csv, etc.
- Column names: matched case-insensitively to the map; export column -> app field.
"""
import os
import pandas as pd
from io import StringIO, BytesIO

# File stem -> (app keys to fill, column rename map export_name -> app_name)
FULL_COMPANY_MAPPINGS = {
    "MIITEM": (
        ["CustomAlert5.json", "Items.json"],
        {"itemId": "Item No.", "descr": "Description", "type": "Item Type", "uOfM": "Stocking Units",
         "poUOfM": "Purchasing Units", "uConvFact": "Units Conversion Factor", "revId": "Current BOM Revision",
         "totQStk": "Stock", "totQWip": "WIP", "totQRes": "Reserve", "totQOrd": "On Order",
         "minQty": "Minimum", "maxQty": "Maximum", "reordPoint": "Reorder Level", "reordQty": "Reorder Quantity",
         "stdCost": "Standard Cost", "avgCost": "Average Cost", "unitCost": "Unit Cost", "landedCost": "Landed Cost"},
    ),
    "Item": (
        ["CustomAlert5.json", "Items.json"],
        {"itemId": "Item No.", "descr": "Description", "type": "Item Type", "uOfM": "Stocking Units",
         "poUOfM": "Purchasing Units", "totQStk": "Stock", "totQWip": "WIP", "totQRes": "Reserve", "totQOrd": "On Order"},
    ),
    "MIILOC": (
        ["MIILOC.json"],
        {"itemId": "Item No.", "locId": "Location No.", "qStk": "qStk", "qWIP": "qWIP", "qRes": "qRes", "qOrd": "qOrd"},
    ),
    "MIBOMH": (
        ["MIBOMH.json", "BillsOfMaterial.json"],
        {"bomItem": "Parent Item No.", "bomRev": "Revision No.", "mult": "Build Quantity", "descr": "Description",
         "BOM Item": "Parent Item No.", "BOM Rev": "Revision No."},
    ),
    "MIBOMD": (
        ["MIBOMD.json", "BillOfMaterialDetails.json"],
        {"bomItem": "Parent Item No.", "bomRev": "Revision No.", "partId": "Component Item No.", "qty": "Required Quantity",
         "BOM Item": "Parent Item No.", "BOM Rev": "Revision No.", "Part Id": "Component Item No.", "Qty": "Required Quantity",
         "leadTime": "Lead (Days)", "Lead (Days)": "Lead (Days)", "Comment": "Comment", "operNo": "Operation No.", "Operation No.": "Operation No.",
         "srcLoc": "Source Location", "Source Location": "Source Location", "altItems": "Alternative Items", "Line": "Line", "Detail Type": "Detail Type", "Uniquifier": "Uniquifier"},
    ),
    "MIMOH": (
        ["ManufacturingOrderHeaders.json", "MIMOH.json"],
        {"mohId": "Mfg. Order No.", "buildItem": "Build Item No.", "bomItem": "BOM Item", "bomRev": "BOM Rev",
         "moStat": "Status", "ordQty": "Ordered", "relOrdQty": "Release Order Quantity", "ordDt": "Order Date",
         "startDt": "Start Date", "endDt": "Completion Date", "releaseDt": "Release Date", "closeDt": "Completion Date",
         "soShipDt": "Sales Order Ship Date", "customer": "Customer", "custId": "Customer"},
    ),
    "MIMOMD": (
        ["ManufacturingOrderDetails.json", "MIMOMD.json"],
        {"mohId": "Mfg. Order No.", "partId": "Component Item No.", "reqQty": "Required Quantity", "compQty": "Completed"},
    ),
    "MIPOH": (
        ["PurchaseOrders.json", "MIPOH.json"],
        # Export / MISys column -> app field (portal and PO details modal use these)
        {"pohId": "PO No.", "poNo": "PO No.", "supId": "Supplier No.", "supplierNo": "Supplier No.",
         "ordDt": "Order Date", "orderDate": "Order Date", "poStat": "Status", "status": "Status", "PO Status": "Status",
         "totalAmt": "Total Amount", "totalAmount": "Total Amount", "Name": "Name", "Contact": "Contact",
         "Buyer": "Buyer", "Terms": "Terms", "Ship Via": "Ship Via", "FOB": "FOB", "Freight": "Freight",
         "Close Date": "Close Date", "Source Currency": "Source Currency", "Home Currency": "Home Currency",
         "Total Ordered": "Total Ordered", "Total Received": "Total Received", "Total Additional Cost": "Total Additional Cost",
         "Total Tax Amount": "Total Tax Amount", "Total Additional Tax": "Total Additional Tax", "Location No.": "Location No.", "Expedited Date": "Expedited Date",
         "Invoiced": "Invoiced", "Invoice No.": "Invoice No.", "Rate": "Rate", "Rate Date": "Rate Date", "Tax Group": "Tax Group",
         "Bill to Location": "Bill to Location", "Invoice Distribution Code": "Invoice Distribution Code"},
    ),
    "MIPOD": (
        ["PurchaseOrderDetails.json", "MIPOD.json"],
        {"pohId": "PO No.", "poNo": "PO No.", "partId": "Item No.", "itemId": "Item No.",
         "ordQty": "Ordered", "ordered": "Ordered", "recvQty": "Received", "received": "Received",
         "unitCost": "Unit Cost", "Unit Cost": "Unit Cost", "Cost": "Unit Cost", "Price": "Unit Price",
         "lineNo": "Line No.", "Line No.": "Line No.", "PO Detail No.": "Line No.",
         "Description": "Description", "Real Due Date": "Required Date", "Initial Due Date": "Required Date",
         "Promised Date": "Required Date", "Extended Price": "Extended Price", "Location No.": "Location No.",
         "Comment": "Comment", "Additional Cost": "Additional Cost", "Job No.": "Job No.", "Last Received Date": "Last Received Date",
         "PO Revision": "PO Revision", "PO Unit of Measure": "PO Unit of Measure", "Detail Status": "Detail Status", "Invoiced": "Invoiced", "Manufacturing Order No.": "Manufacturing Order No."},
    ),
    "MIWOH": (
        ["WorkOrders.json", "MIWOH.json", "WorkOrderHeaders.json"],
        {"wohId": "Work Order No.", "jobId": "Job No.", "woStat": "Status", "releaseDt": "Release Date",
         "descr": "Description", "locId": "Location No.", "soId": "Sales Order No."},
    ),
    "MIWOD": (
        ["WorkOrderDetails.json", "MIWOD.json"],
        {"wohId": "Work Order No.", "jobId": "Job No.", "partId": "Item No.", "itemId": "Item No.",
         "ordQty": "Ordered", "compQty": "Completed", "mohId": "Manufacturing Order No.", "soId": "Sales Order No."},
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
    "MISLTH": (
        ["LotSerialHistory.json"],
        {"tranDate": "Transaction Date", "userId": "User", "itemId": "Item No.", "prntItemId": "Parent Item No.",
         "locId": "Location No.", "jobId": "Job No.", "type": "Type", "xvarMOId": "Mfg. Order No.",
         "xvarSOId": "Sales Order No.", "trnQty": "Quantity", "rdyQty": "Ready Qty", "recQty": "Received Qty"},
    ),
    "MISLTD": (
        ["LotSerialDetail.json"],
        {"lotId": "Lot No.", "serialNo": "Serial No.", "itemId": "Item No.", "qty": "Quantity"},
    ),
}


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


def load_from_folder(folder_path):
    """
    Load Full Company Data from a local folder. Returns (data_dict, None) or (None, error_message).
    data_dict has same keys as get_empty_app_data_structure() with lists filled from CSVs/Excel.
    """
    if not folder_path or not os.path.isdir(folder_path):
        return None, "Folder not found or not a directory"
    try:
        skeleton = _get_skeleton()
        files = [f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))]
        expected_stems = set(FULL_COMPANY_MAPPINGS.keys())
        for fname in files:
            stem = os.path.splitext(fname)[0]
            if stem not in FULL_COMPANY_MAPPINGS:
                if fname.lower().endswith((".csv", ".xlsx", ".xls")):
                    print(f"[full_company_data_converter] skip (no mapping): {fname} – expected one of: {sorted(expected_stems)}")
                continue
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
                    continue
            except Exception as e:
                print(f"[full_company_data_converter] skip {fname}: {e}")
                continue
            if not rows:
                continue
            keys, column_map = FULL_COMPANY_MAPPINGS[stem]
            rows = _apply_column_map(rows, column_map)
            for key in keys:
                if key in skeleton and isinstance(skeleton[key], list):
                    skeleton[key] = list(rows)
            print(f"[full_company_data_converter] loaded {fname} -> {len(rows)} rows -> {keys}")
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
        "MPS.json": {"mps_orders": [], "summary": {"total_orders": 0}},
    }


def load_from_drive_api(drive_service, drive_id, folder_path):
    """
    Load Full Company Data via Google Drive API. folder_path is the path string (e.g. MiSys/.../Full Company Data as of 02_10_2026).
    Returns (data_dict, None) or (None, error_message).
    """
    if not drive_service or not getattr(drive_service, "authenticated", False):
        return None, "Google Drive not available"
    try:
        folder_id = drive_service.find_folder_by_path(drive_id, folder_path)
        if not folder_id:
            return None, "Full Company Data folder not found"
        files = drive_service.list_all_files_in_folder(folder_id, drive_id)
        if not files:
            return _get_skeleton(), None
        skeleton = _get_skeleton()
        for finfo in files:
            fname = finfo.get("name") or finfo.get("fileName") or ""
            fid = finfo.get("id") or finfo.get("fileId")
            stem = os.path.splitext(fname)[0]
            if stem not in FULL_COMPANY_MAPPINGS or not fid:
                continue
            content = drive_service.download_file(fid, fname)
            if content is None:
                continue
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
                    continue
            else:
                continue
            if not rows:
                continue
            keys, column_map = FULL_COMPANY_MAPPINGS[stem]
            rows = _apply_column_map(rows, column_map)
            for key in keys:
                if key in skeleton and isinstance(skeleton[key], list):
                    skeleton[key] = list(rows)
        return skeleton, None
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, str(e)
