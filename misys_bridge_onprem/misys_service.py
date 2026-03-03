"""
MISys SQL Server Live Integration Service
READ-ONLY access to MISys SBM SQL Server database (CANOILCA).
Replaces manual CSV export with real-time sync data.

╔══════════════════════════════════════════════════════════════════╗
║  MISYS SQL IS 100% READ-ONLY                                   ║
║  WE NEVER WRITE TO MISYS. SELECT ONLY.                         ║
╚══════════════════════════════════════════════════════════════════╝

Connection: 192.168.1.11, database CANOILCA (SQL Server 2014 Express)
Uses pyodbc (SQL Server Native Client 11.0) — pymssql/FreeTDS fails TLS negotiation
with this server. pyodbc with native driver works correctly.
Credentials from environment or defaults in MISYS_SQL_CONNECTION_DETAILS.txt
"""

import os
import re
from datetime import datetime, date
from decimal import Decimal
from contextlib import contextmanager

# Try pyodbc first (works with TLS on this SQL Server), fall back to pymssql
try:
    import pyodbc
    PYODBC_AVAILABLE = True
except ImportError:
    pyodbc = None
    PYODBC_AVAILABLE = False

try:
    import pymssql
    PYMSSQL_AVAILABLE = True
except ImportError:
    pymssql = None
    PYMSSQL_AVAILABLE = False

# Use pyodbc if available, otherwise pymssql
PYMSSQL_AVAILABLE = PYODBC_AVAILABLE or PYMSSQL_AVAILABLE  # bridge checks this flag

# Connection config - from env or defaults (MISYS_SQL_CONNECTION_DETAILS.txt)
MISYS_SQL_HOST = os.environ.get('MISYS_SQL_HOST', '192.168.1.11')
MISYS_SQL_USER = os.environ.get('MISYS_SQL_USER', 'sa')
MISYS_SQL_PASSWORD = os.environ.get('MISYS_SQL_PASSWORD', 'MISys_SBM1')
MISYS_SQL_DATABASE = os.environ.get('MISYS_SQL_DATABASE', 'CANOILCA')

# pyodbc driver preference order (first one found is used)
_ODBC_DRIVERS = [
    'SQL Server Native Client 11.0',
    'ODBC Driver 17 for SQL Server',
    'ODBC Driver 13 for SQL Server',
    'ODBC Driver 11 for SQL Server',
    'SQL Server',
]

def _get_odbc_driver():
    """Return the first available ODBC SQL Server driver."""
    if not PYODBC_AVAILABLE:
        return None
    available = pyodbc.drivers()
    for drv in _ODBC_DRIVERS:
        if drv in available:
            return drv
    return None

_ALLOWED_SQL_PATTERN = re.compile(r'^\s*SELECT\b', re.IGNORECASE)


def _json_serial(obj):
    """Convert non-JSON-serializable SQL types to safe Python types."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        # rowversion/timestamp columns — not needed by the app, discard
        return None
    if obj is None:
        return None
    return obj


def _row_to_dict(row, column_map):
    """Map SQL row keys to app keys per column_map. Serialize dates/decimals."""
    if not row or not isinstance(row, dict):
        return {}
    out = {}
    for k, v in row.items():
        app_key = column_map.get(k) if k in column_map else column_map.get(k.strip()) if k else None
        if app_key:
            out[app_key] = _json_serial(v)
        else:
            out[k] = _json_serial(v)
    return out


# Table -> (app keys to fill, sql_column -> app_key map)
# Uses same app keys as full_company_data_converter. SQL column names from MISYS_SQL_CONNECTION_DETAILS.txt
_MISYS_TABLE_MAPPINGS = {
    'MIITEM': (
        ['Items.json', 'MIITEM.json'],
        {
            'itemId': 'Item No.', 'descr': 'Description', 'xdesc': 'Extended Description', 'ref': 'Part No.',
            'type': 'Item Type', 'uOfM': 'Stocking Units', 'poUOfM': 'Purchasing Units', 'uConvFact': 'Units Conversion Factor',
            'revId': 'Current BOM Revision', 'lead': 'Lead (Days)', 'minLvl': 'Minimum', 'maxLvl': 'Maximum',
            'ordLvl': 'Reorder Level', 'ordQty': 'Reorder Quantity', 'lotSz': 'Lot Size', 'variance': 'Variance',
            'cLast': 'Recent Cost', 'cStd': 'Standard Cost', 'cAvg': 'Average Cost', 'cLand': 'Landed Cost',
            'locId': 'Location No.', 'suplId': 'Supplier No.', 'mfgId': 'Manufacturer No.', 'status': 'Status',
            'unitWgt': 'Unit Weight', 'pick': 'Pick', 'sales': 'Sales', 'track': 'Track', 'cycle': 'Cycle',
            'lstUseDt': 'Last Used Date', 'lstPIDt': 'Last PO Date', 'lstUseDate': 'Last Used Date', 'lstPIDate': 'Last PO Date',
        },
    ),
    'MIILOC': (
        ['MIILOC.json'],
        {
            'itemId': 'Item No.', 'locId': 'Location No.', 'pick': 'Pick', 'minLvl': 'Minimum', 'maxLvl': 'Maximum',
            'ordLvl': 'Reorder Level', 'ordQty': 'Reorder Quantity',
            'qtyOnHand': 'qStk', 'qStk': 'qStk', 'qtyAlloc': 'qRes', 'qRes': 'qRes',
            'qtyOnOrder': 'qOrd', 'qOrd': 'qOrd', 'qWIP': 'qWIP', 'qWip': 'qWIP',
        },
    ),
    'MIBOMH': (
        ['MIBOMH.json', 'BillsOfMaterial.json'],
        {'bomItem': 'Parent Item No.', 'itemId': 'Parent Item No.', 'bomRev': 'Revision No.', 'mult': 'Build Quantity', 'descr': 'Description'},
    ),
    'MIBOMD': (
        ['MIBOMD.json', 'BillOfMaterialDetails.json'],
        {
            'bomItem': 'Parent Item No.', 'parentId': 'Parent Item No.', 'bomRev': 'Revision No.',
            'partId': 'Component Item No.', 'itemId': 'Component Item No.', 'qty': 'Required Quantity', 'qtyPer': 'Required Quantity',
            'lead': 'Lead (Days)', 'cmnt': 'Comment', 'opCode': 'Operation No.', 'srcLoc': 'Source Location',
            'lineNbr': 'Line', 'dType': 'Detail Type', 'altItems': 'Alternative Items',
        },
    ),
    'MIMOH': (
        ['ManufacturingOrderHeaders.json', 'MIMOH.json'],
        {
            'mohId': 'Mfg. Order No.', 'moNum': 'Mfg. Order No.', 'buildItem': 'Build Item No.', 'itemId': 'Build Item No.',
            'bomItem': 'BOM Item', 'bomRev': 'BOM Rev', 'moStat': 'Status', 'status': 'Status',
            'ordQty': 'Ordered', 'relOrdQty': 'Release Order Quantity', 'ordDt': 'Order Date', 'ordDate': 'Order Date',
            'startDt': 'Start Date', 'endDt': 'Completion Date', 'releaseDt': 'Release Date', 'closeDt': 'Completion Date',
            'dueDate': 'Completion Date', 'soShipDt': 'Sales Order Ship Date', 'customer': 'Customer', 'custId': 'Customer',
            'descr': 'Description', 'creator': 'Created By', 'releaser': 'Released By',
            'wipQty': 'WIP', 'resQty': 'Reserve', 'endQty': 'Completed', 'relQty': 'Issued', 'qtyCplt': 'Completed',
            'cumCost': 'Cumulative Cost', 'actMatCost': 'Actual Material Cost', 'actLabCost': 'Actual Labor Cost',
            'actOhdCost': 'Actual Overhead Cost', 'totMatCost': 'Total Material Cost', 'totScrapCost': 'Total Scrap Cost',
            'projMatCost': 'Projected Material Cost', 'projLabCost': 'Projected Labor Cost', 'projOhdCost': 'Projected Overhead Cost',
            'usedMatCost': 'Used Material Cost', 'usedLabCost': 'Used Labor Cost', 'usedOhdCost': 'Used Overhead Cost',
            'onHold': 'On Hold', 'soId': 'Sales Order No.', 'jobId': 'Job No.', 'locId': 'Location No.',
        },
    ),
    'MIMOMD': (
        ['ManufacturingOrderDetails.json', 'MIMOMD.json'],
        {
            'mohId': 'Mfg. Order No.', 'partId': 'Component Item No.', 'itemId': 'Component Item No.',
            'reqQty': 'Required Quantity', 'qty': 'Quantity', 'endQty': 'Completed', 'compQty': 'Completed',
            'relQty': 'Released', 'wipQty': 'WIP', 'resQty': 'Reserve',
            'matCost': 'Material Cost', 'srcLoc': 'Source Location', 'lineNbr': 'Line', 'opCode': 'Operation No.',
            'dType': 'Detail Type', 'scrapCost': 'Scrap Cost', 'scrapQty': 'Scrapped',
            'nonItem': 'Non-stocked', 'nonItemCost': 'Non-stocked Item Cost', 'nonItemDesc': 'Non-stocked Item Description',
            'cmnt': 'Comment', 'childOrdId': 'Child MO No.', 'bomRev': 'BOM Revision No.',
            'podQty': 'On Purchase Order', 'momdId': 'Detail No.', 'overRide': 'Auto-build Override', 'lead': 'Assy. Lead (Days)',
        },
    ),
    'MIPOH': (
        ['PurchaseOrders.json', 'MIPOH.json'],
        {
            'pohId': 'PO No.', 'poNum': 'PO No.', 'poNo': 'PO No.', 'suplId': 'Supplier No.', 'supId': 'Supplier No.',
            'name': 'Name', 'ordDt': 'Order Date', 'ordDate': 'Order Date',
            'poStatus': 'Status', 'poStat': 'Status', 'status': 'Status',
            'totOrdered': 'Total Ordered', 'totReceived': 'Total Received', 'totInvoiced': 'Total Invoiced',
            'totalAmt': 'Total Amount', 'totalAmount': 'Total Amount', 'totTaxAmt': 'Total Tax Amount',
            'totAddCost': 'Total Additional Cost', 'totAddTax': 'Total Additional Tax',
            'closeDt': 'Close Date', 'expDt': 'Expedited Date', 'rateDt': 'Rate Date',
            'homeCur': 'Home Currency', 'srcCur': 'Source Currency', 'rate': 'Rate', 'invoiced': 'Invoiced',
            'locId': 'Location No.', 'jobId': 'Job No.', 'taxGrp': 'Tax Group', 'bLocId': 'Bill to Location',
            'shpVia': 'Ship Via', 'fob': 'FOB', 'contact': 'Contact', 'buyer': 'Buyer', 'terms': 'Terms',
        },
    ),
    'MIPOD': (
        ['PurchaseOrderDetails.json', 'MIPOD.json'],
        {
            'pohId': 'PO No.', 'poNo': 'PO No.', 'partId': 'Item No.', 'itemId': 'Item No.',
            'ordered': 'Ordered', 'received': 'Received', 'ordQty': 'Ordered', 'recvQty': 'Received',
            'price': 'Unit Cost', 'cost': 'Unit Cost', 'unitCost': 'Unit Cost',
            'descr': 'Description',
            'initDueDt': 'Required Date', 'realDueDt': 'Required Date', 'promisedDt': 'Required Date', 'lastRecvDt': 'Last Received Date',
            'lineNbr': 'Line No.', 'lineNo': 'Line No.', 'podId': 'Line No.',
            'locId': 'Location No.', 'jobId': 'Job No.', 'cmt': 'Comment', 'cmnt': 'Comment',
            'adCost': 'Additional Cost', 'dStatus': 'Detail Status', 'invoiced': 'Invoiced',
            'mohId': 'Manufacturing Order No.',
        },
    ),
    'MISUPL': (
        ['MISUPL.json'],
        {
            'suplId': 'Supplier No.', 'shortName': 'Short Name', 'name': 'Name', 'adr1': 'Address 1', 'adr2': 'Address 2',
            'city': 'City', 'state': 'State', 'zip': 'Zip', 'country': 'Country', 'phone': 'Phone', 'contact': 'Contact',
            'cur': 'Currency', 'terms': 'Terms', 'email1': 'Email', 'website': 'Website', 'notes': 'Notes',
        },
    ),
    'MIJOBH': (
        ['Jobs.json', 'MIJOBH.json'],
        {'jobId': 'Job No.', 'descr': 'Description', 'status': 'Status', 'custId': 'Customer', 'soId': 'Sales Order No.', 'locId': 'Location No.', 'createdDt': 'Created Date', 'closeDt': 'Close Date'},
    ),
    'MIJOBD': (
        ['JobDetails.json', 'MIJOBD.json'],
        {'jobId': 'Job No.', 'jobItem': 'Item No.', 'partId': 'Item No.', 'itemId': 'Item No.', 'locId': 'Location No.',
         'type': 'Type', 'qStk': 'Stock Quantity', 'qWip': 'WIP Qty', 'qRes': 'Reserve Qty', 'qOrd': 'On Order Qty', 'qUsed': 'Used Qty', 'qRecd': 'Received Qty'},
    ),
    'MIWOH': (
        ['WorkOrders.json', 'MIWOH.json', 'WorkOrderHeaders.json'],
        {'wohId': 'Work Order No.', 'jobId': 'Job No.', 'status': 'Status', 'woStat': 'Status', 'releaseDt': 'Release Date',
         'descr': 'Description', 'locId': 'Location No.', 'soId': 'Sales Order No.', 'lstMaintDt': 'Last Maint Date', 'creator': 'Creator', 'releaser': 'Releaser', 'priority': 'Priority'},
    ),
    'MIWOD': (
        ['WorkOrderDetails.json', 'MIWOD.json'],
        {'wohId': 'Work Order No.', 'jobId': 'Job No.', 'partId': 'Item No.', 'itemId': 'Item No.',
         'reqQty': 'Required Quantity', 'ordQty': 'Ordered', 'endQty': 'Completed', 'compQty': 'Completed',
         'mohId': 'Manufacturing Order No.', 'soId': 'Sales Order No.'},
    ),
    'MIMORD': (
        ['ManufacturingOrderRoutings.json', 'MIMORD.json'],
        {'mohId': 'Mfg. Order No.', 'opNo': 'Operation No.', 'operNo': 'Operation No.', 'workCtr': 'Work Center No.', 'runTime': 'Run Time', 'setupTime': 'Setup Time', 'seq': 'Sequence'},
    ),
    'MIPOC': (
        ['PurchaseOrderExtensions.json', 'MIPOC.json'],
        {'pohId': 'PO No.', 'poNo': 'PO No.', 'lineNo': 'Line No.', 'extType': 'Extension Type', 'extValue': 'Extension Value', 'extDesc': 'Extension Description'},
    ),
    'MIPOCV': (
        ['PurchaseOrderAdditionalCosts.json', 'MIPOCV.json'],
        {'pohId': 'PO No.', 'purchaseOrderId': 'PO No.', 'poNo': 'PO No.', 'addlCost': 'Cost Type', 'Amount': 'Amount', 'Description': 'Description', 'Line': 'Line'},
    ),
    'MIPODC': (
        ['PurchaseOrderDetailAdditionalCosts.json', 'MIPODC.json'],
        {'pohId': 'PO No.', 'poNo': 'PO No.', 'poLineNo': 'PO Line No.', 'Additional Cost': 'Additional Cost', 'Amount': 'Amount', 'Description': 'Description'},
    ),
    'MIITEMX': (['MIITEMX.json'], {'itemId': 'Item No.', 'notes': 'Notes', 'docPath': 'Document Path', 'picPath': 'Picture Path'}),
    'MIITEMA': (['MIITEMA.json'], {'itemId': 'Item No.', 'altItemId': 'Alternate Item No.', 'uniquifier': 'Uniquifier', 'lineNbr': 'Line No.'}),
    'MIQMFG': (['MIQMFG.json'], {'itemId': 'Item No.', 'mfgId': 'Manufacturer No.', 'mfgName': 'Manufacturer Name', 'mfgProdCode': 'Product Code'}),
    'MIQSUP': (['MIQSUP.json'], {'suplId': 'Supplier No.', 'itemId': 'Item No.', 'status': 'Status', 'leadTime': 'Lead Time', 'minQty': 'Minimum Qty'}),
    'MIUSER': (['MIUSER.json'], {'userId': 'User', 'userName': 'Name', 'displayName': 'Display Name', 'email': 'Email', 'isActive': 'Active'}),
    'MILOGH': (
        ['MILOGH.json'],
        {'itemId': 'Item No.', 'tranDate': 'Transaction Date', 'tranDt': 'Transaction Date', 'userId': 'User', 'entry': 'Entry', 'type': 'Type',
         'comment': 'Comment', 'qty': 'Quantity', 'locId': 'Location No.', 'binId': 'Bin No.', 'jobId': 'Job No.',
         'xvarPOId': 'PO No.', 'xvarMOId': 'Mfg. Order No.', 'xvarWOId': 'Work Order No.'},
    ),
    'MILOGD': (['MILOGD.json'], {'itemId': 'Item No.', 'tranDate': 'Transaction Date', 'tranDt': 'Transaction Date', 'entry': 'Entry', 'detail': 'Detail', 'qty': 'Quantity', 'locId': 'Location No.', 'uom': 'UOM'}),
    'MILOGB': (['MILOGB.json'], {'itemId': 'Item No.', 'tranDate': 'Transaction Date', 'tranDt': 'Transaction Date', 'entry': 'Entry', 'detail': 'Detail', 'locId': 'Location No.', 'binId': 'Bin No.', 'lotId': 'Lot No.', 'qty': 'Quantity'}),
    'MIBINH': (['MIBINH.json'], {'itemId': 'Item No.', 'tranDate': 'Transaction Date', 'tranDt': 'Transaction Date', 'userId': 'User', 'entry': 'Entry', 'detail': 'Detail', 'locId': 'Location No.', 'type': 'Type', 'trnQty': 'Quantity', 'recQty': 'Received Qty', 'xvarPOId': 'PO No.', 'xvarMOId': 'Mfg. Order No.'}),
    'MIICST': (['MIICST.json'], {'itemId': 'Item No.', 'transDate': 'Transaction Date', 'transDt': 'Transaction Date', 'seqNo': 'Seq No.', 'locId': 'Location No.', 'type': 'Type', 'tranType': 'Tran Type', 'suplId': 'Supplier No.', 'poId': 'PO No.', 'poRev': 'PO Rev', 'poDtl': 'PO Line', 'reference': 'Reference', 'qRecd': 'Qty Received', 'cost': 'Cost', 'cLand': 'Landed Cost', 'qUsed': 'Qty Used', 'qWip': 'WIP', 'extCost': 'Extended Cost'}),
    'MISLTH': (['LotSerialHistory.json'], {'tranDate': 'Transaction Date', 'tranDt': 'Transaction Date', 'userId': 'User', 'itemId': 'Item No.', 'prntItemId': 'Parent Item No.', 'locId': 'Location No.', 'jobId': 'Job No.', 'type': 'Type', 'xvarMOId': 'Mfg. Order No.', 'xvarSOId': 'Sales Order No.', 'trnQty': 'Quantity', 'recQty': 'Received Qty', 'rdyQty': 'Ready Qty'}),
    'MISLTD': (['LotSerialDetail.json'], {'prntLotId': 'Lot No.', 'lotId': 'Lot No.', 'itemId': 'Item No.', 'prntItemId': 'Parent Item No.', 'trnQty': 'Quantity', 'recQty': 'Quantity', 'qty': 'Quantity', 'entry': 'Serial No.', 'detail': 'Serial No.'}),
    'MISLHIST': (['MISLHIST.json'], {'itemId': 'Item No.', 'prntItemId': 'Parent Item No.', 'lotId': 'Lot No.', 'tranDate': 'Transaction Date', 'tranDt': 'Transaction Date', 'userId': 'User', 'entry': 'Entry', 'detail': 'Detail', 'qty': 'Quantity', 'locId': 'Location No.', 'assignedDt': 'Assigned Date'}),
    'MISLNH': (['MISLNH.json'], {'prntItemId': 'Parent Item No.', 'lotId': 'Lot No.', 'itemId': 'Item No.'}),
    'MISLND': (['MISLND.json'], {'prntItemId': 'Parent Item No.', 'lotId': 'Lot No.', 'itemId': 'Item No.'}),
    'MIILOCQT': (['MIILOCQT.json'], {'itemId': 'Item No.', 'locId': 'Location No.', 'dateISO': 'Date ISO', 'date': 'Date', 'qStk': 'On Hand', 'qWip': 'WIP', 'qRes': 'Reserve', 'qOrd': 'On Order', 'cStd': 'Standard Cost', 'cLast': 'Recent Cost', 'cAvg': 'Average Cost'}),
    'MIBINQ': (['MIBINQ.json'], {'itemId': 'Item No.', 'locId': 'Location No.', 'binId': 'Bin No.', 'qStk': 'On Hand', 'descr': 'Description', 'status': 'Status', 'createDt': 'Create Date', 'lstUseDt': 'Last Used Date'}),
    'MISLBINQ': (['MISLBINQ.json'], {'itemId': 'Item No.', 'locId': 'Location No.', 'binId': 'Bin No.', 'lotId': 'Lot No.', 'qStk': 'On Hand'}),
}


def _get_skeleton():
    """Same keys as app get_empty_app_data_structure()."""
    return {
        "Items.json": [], "MIITEM.json": [], "MIILOC.json": [],
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


@contextmanager
def get_misys_connection():
    """Context manager for READ-ONLY MISys SQL Server connections.
    Uses pyodbc (SQL Server Native Client) — pymssql/FreeTDS fails TLS on this server.
    """
    if not PYODBC_AVAILABLE and not PYMSSQL_AVAILABLE:
        raise RuntimeError("No SQL driver available. Run: pip install pyodbc")
    conn = None
    try:
        if PYODBC_AVAILABLE:
            driver = _get_odbc_driver()
            if not driver:
                raise RuntimeError("No ODBC SQL Server driver found on this machine.")
            cs = (
                f"DRIVER={{{driver}}};"
                f"SERVER={MISYS_SQL_HOST};"
                f"DATABASE={MISYS_SQL_DATABASE};"
                f"UID={MISYS_SQL_USER};"
                f"PWD={MISYS_SQL_PASSWORD};"
                "TrustServerCertificate=yes;"
                "Encrypt=no;"
            )
            conn = pyodbc.connect(cs, timeout=10)
        else:
            conn = pymssql.connect(
                server=MISYS_SQL_HOST,
                user=MISYS_SQL_USER,
                password=MISYS_SQL_PASSWORD,
                database=MISYS_SQL_DATABASE,
                login_timeout=10,
            )
        yield conn
    finally:
        if conn:
            conn.close()


def _execute_readonly(conn, query):
    """Execute SELECT only. Blocks any write operations."""
    if not _ALLOWED_SQL_PATTERN.match(query.strip()):
        raise PermissionError("MISys SQL is READ-ONLY. Only SELECT queries allowed.")
    cur = conn.cursor()
    try:
        cur.execute(query)
        columns = [col[0] for col in cur.description] if cur.description else []
        rows = cur.fetchall()
        # Return list of dicts (same as pymssql as_dict=True)
        return [dict(zip(columns, row)) for row in rows]
    finally:
        cur.close()


def test_connection():
    """Test the MISys SQL connection. Returns (success: bool, message: str)."""
    if not PYODBC_AVAILABLE and not PYMSSQL_AVAILABLE:
        return False, "No SQL driver available. Run: pip install pyodbc"
    try:
        with get_misys_connection() as conn:
            rows = _execute_readonly(conn, "SELECT COUNT(*) AS cnt FROM MIITEM")
            cnt = rows[0]['cnt'] if rows else 0
        driver = _get_odbc_driver() if PYODBC_AVAILABLE else 'pymssql'
        return True, f"Connected via {driver}. MIITEM has {cnt} rows."
    except Exception as e:
        return False, str(e)


def load_all_data():
    """
    Load all MISys data from SQL Server into the app data format.
    Returns (data_dict, None) on success, (None, error_message) on failure.
    Same structure as full_company_data_converter.load_from_folder().
    """
    if not PYMSSQL_AVAILABLE:
        return None, "pymssql not installed. Run: pip install pymssql"

    skeleton = _get_skeleton()

    try:
        with get_misys_connection() as conn:
            for table_name, (app_keys, column_map) in _MISYS_TABLE_MAPPINGS.items():
                try:
                    # Use SELECT * - pymssql returns column names from result set
                    query = f"SELECT * FROM {table_name}"
                    rows = _execute_readonly(conn, query)
                    if not rows:
                        continue
                    # Convert to list of dicts with app keys
                    mapped = []
                    for row in rows:
                        d = _row_to_dict(row, column_map)
                        if d:
                            mapped.append(d)
                    if mapped:
                        for key in app_keys:
                            if key in skeleton and isinstance(skeleton[key], list):
                                skeleton[key] = list(mapped)
                        print(f"[misys_service] loaded {table_name} -> {len(mapped)} rows -> {app_keys}")
                except Exception as e:
                    print(f"[misys_service] skip {table_name}: {e}")
                    continue

        # Add item totals (totQStk, totQWip, totQRes, totQOrd) from MIILOC aggregation if Items.json has data
        if skeleton.get("Items.json") and skeleton.get("MIILOC.json"):
            _enrich_items_with_totals(skeleton)

        return skeleton, None
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, str(e)


def _enrich_items_with_totals(skeleton):
    """Aggregate MIILOC by item and add totQStk, totQWip, totQRes, totQOrd to Items.json."""
    try:
        iloc = skeleton.get("MIILOC.json") or []
        items = skeleton.get("Items.json") or []
        if not items or not iloc:
            return
        # Build totals by item: { itemNo: {totQStk, totQWip, totQRes, totQOrd} }
        totals = {}
        for row in iloc:
            item_no = row.get("Item No.") or row.get("itemId")
            if not item_no:
                continue
            if item_no not in totals:
                totals[item_no] = {"totQStk": 0, "totQWip": 0, "totQRes": 0, "totQOrd": 0}
            qstk = row.get("qStk") or row.get("qtyOnHand")
            qwip = row.get("qWIP") or row.get("qWip")
            qres = row.get("qRes") or row.get("qtyAlloc")
            qord = row.get("qOrd") or row.get("qtyOnOrder")
            try:
                totals[item_no]["totQStk"] += float(qstk or 0)
                totals[item_no]["totQWip"] += float(qwip or 0)
                totals[item_no]["totQRes"] += float(qres or 0)
                totals[item_no]["totQOrd"] += float(qord or 0)
            except (TypeError, ValueError):
                pass
        # Enrich each item
        for item in items:
            item_no = item.get("Item No.") or item.get("itemId")
            if item_no and item_no in totals:
                t = totals[item_no]
                item["Stock"] = t["totQStk"]
                item["WIP"] = t["totQWip"]
                item["Reserve"] = t["totQRes"]
                item["On Order"] = t["totQOrd"]
    except Exception as e:
        print(f"[misys_service] _enrich_items_with_totals: {e}")
