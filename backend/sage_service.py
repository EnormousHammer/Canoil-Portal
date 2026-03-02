"""
Sage 50 Accounting Integration Service
READ-ONLY access to Sage 50 Canadian (Quantum) MySQL database.
Database: MySQL on 192.168.1.11:13540, database 'simply'

╔══════════════════════════════════════════════════════════════════╗
║  ABSOLUTE HARD CONSTRAINT — SAGE 50 IS 100% READ-ONLY          ║
║                                                                  ║
║  WE NEVER WRITE TO SAGE. WE NEVER INSERT INTO SAGE.            ║
║  WE NEVER UPDATE SAGE. WE NEVER DELETE FROM SAGE.              ║
║  NO EXCEPTIONS. NO WORKAROUNDS. THIS IS NOT NEGOTIABLE.         ║
║                                                                  ║
║  All portal data lives in PostgreSQL. Sage is an external        ║
║  accounting system we READ from — that's it.                     ║
╚══════════════════════════════════════════════════════════════════╝

SAFETY: This module enforces read-only access at THREE levels:
  1. MySQL session is SET to READ ONLY mode on every connection
  2. A ReadOnlyCursor wrapper blocks any non-SELECT statement
  3. autocommit is disabled and commit() is NEVER called

If any code attempts INSERT/UPDATE/DELETE on Sage, it will:
  - Be blocked by ReadOnlyCursor with a PermissionError
  - Be blocked by MySQL READ ONLY transaction mode
  - Never be committed even if somehow executed
"""

import pymysql
import pymysql.cursors
import os
import re
from datetime import datetime, timedelta
from contextlib import contextmanager

SAGE_HOST = os.environ.get('SAGE_DB_HOST', '192.168.1.11')
SAGE_PORT = int(os.environ.get('SAGE_DB_PORT', '13540'))
SAGE_USER = os.environ.get('SAGE_DB_USER', 'sysadmin')
SAGE_PASSWORD = os.environ.get('SAGE_DB_PASSWORD', '')
SAGE_DATABASE = os.environ.get('SAGE_DB_NAME', 'simply')

_ALLOWED_SQL_PATTERN = re.compile(
    r'^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|SET\s+SESSION\s+TRANSACTION\s+READ\s+ONLY)\b',
    re.IGNORECASE
)


class ReadOnlyCursor:
    """Wraps a pymysql DictCursor and blocks any non-SELECT statement."""

    def __init__(self, real_cursor):
        self._cursor = real_cursor

    def execute(self, query, args=None):
        if not _ALLOWED_SQL_PATTERN.match(query):
            raise PermissionError(
                f"BLOCKED: Sage 50 connection is READ-ONLY. "
                f"Rejected query: {query[:80]}..."
            )
        return self._cursor.execute(query, args)

    def __getattr__(self, name):
        return getattr(self._cursor, name)


@contextmanager
def get_sage_connection():
    """Context manager for READ-ONLY Sage 50 MySQL connections."""
    conn = None
    try:
        conn = pymysql.connect(
            host=SAGE_HOST,
            port=SAGE_PORT,
            user=SAGE_USER,
            password=SAGE_PASSWORD,
            database=SAGE_DATABASE,
            connect_timeout=10,
            read_timeout=30,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False
        )
        # Level 1: MySQL-enforced read-only session
        raw = conn.cursor()
        raw.execute("SET SESSION TRANSACTION READ ONLY")
        raw.close()

        yield conn
    finally:
        if conn:
            conn.close()


def _cursor(conn):
    """Return a read-only-guarded cursor for the connection."""
    return ReadOnlyCursor(conn.cursor())


def test_connection():
    """Test the Sage 50 database connection and return basic info."""
    try:
        with get_sage_connection() as conn:
            cursor = _cursor(conn)
            cursor.execute("SELECT sCompName, sCity, sProvStat, sPhone1 FROM tcompany LIMIT 1")
            company = cursor.fetchone()
            cursor.execute("SELECT COUNT(*) as cnt FROM tcustomr")
            customers = cursor.fetchone()['cnt']
            cursor.execute("SELECT COUNT(*) as cnt FROM tvendor")
            vendors = cursor.fetchone()['cnt']
            cursor.execute("SELECT COUNT(*) as cnt FROM tinvent")
            inventory = cursor.fetchone()['cnt']
            cursor.execute("SELECT COUNT(*) as cnt FROM tsalordr")
            sales_orders = cursor.fetchone()['cnt']
            return {
                'connected': True,
                'company': company,
                'summary': {
                    'customers': customers,
                    'vendors': vendors,
                    'inventory_items': inventory,
                    'sales_orders': sales_orders
                }
            }
    except Exception as e:
        return {'connected': False, 'error': str(e)}


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

def get_customers(search=None, inactive=False, limit=500, offset=0):
    """Fetch customer list from Sage 50."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        where_clauses = []
        params = []

        if not inactive:
            where_clauses.append("(bInactive = 0 OR bInactive IS NULL)")
        if search:
            where_clauses.append("(sName LIKE %s OR sCntcName LIKE %s OR sEmail LIKE %s)")
            params.extend([f'%{search}%'] * 3)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        cursor.execute(f"""
            SELECT lId, sName, sCntcName, sStreet1, sStreet2, sCity, sProvState,
                   sCountry, sPostalZip, sPhone1, sPhone2, sFax, sEmail, sWebSite,
                   dCrLimit, dAmtYtd, dLastYrAmt, dAmtYtdHm, dAmtLYHm,
                   nNetDay, bInactive, dtSince, dtLastSal, lCurrncyId
            FROM tcustomr
            {where_sql}
            ORDER BY sName
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        customers = cursor.fetchall()

        cursor.execute(f"SELECT COUNT(*) as cnt FROM tcustomr {where_sql}", params)
        total = cursor.fetchone()['cnt']

        return {'customers': customers, 'total': total, 'limit': limit, 'offset': offset}


def get_customer(customer_id):
    """Fetch a single customer with their recent sales orders."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        cursor.execute("SELECT * FROM tcustomr WHERE lId = %s", (customer_id,))
        customer = cursor.fetchone()
        if not customer:
            return None

        cursor.execute("""
            SELECT so.lId, so.sSONum, so.sName, so.dtSODate, so.dtShipDate,
                   so.dTotal, so.sComment, so.sShipper, so.bQuote, so.nFilled
            FROM tsalordr so
            WHERE so.lCusId = %s
            ORDER BY so.dtASDate DESC
            LIMIT 50
        """, (customer_id,))
        orders = cursor.fetchall()

        return {'customer': customer, 'recent_orders': orders}


# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------

def get_vendors(search=None, inactive=False, limit=500, offset=0):
    """Fetch vendor list from Sage 50."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        where_clauses = []
        params = []

        if not inactive:
            where_clauses.append("(bInactive = 0 OR bInactive IS NULL)")
        if search:
            where_clauses.append("(sName LIKE %s OR sCntcName LIKE %s OR sEmail LIKE %s)")
            params.extend([f'%{search}%'] * 3)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        cursor.execute(f"""
            SELECT lId, sName, sCntcName, sStreet1, sStreet2, sCity, sProvState,
                   sCountry, sPostalZip, sPhone1, sPhone2, sFax, sEmail, sWebSite,
                   dAmtYtd, dLastYrAmt, dAmtYtdHm, dAmtLYHm,
                   nNetDay, bInactive, dtSince, dtLastPur, lCurrncyId
            FROM tvendor
            {where_sql}
            ORDER BY sName
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        vendors = cursor.fetchall()

        cursor.execute(f"SELECT COUNT(*) as cnt FROM tvendor {where_sql}", params)
        total = cursor.fetchone()['cnt']

        return {'vendors': vendors, 'total': total, 'limit': limit, 'offset': offset}


def get_vendor(vendor_id):
    """Fetch a single vendor with details."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        cursor.execute("SELECT * FROM tvendor WHERE lId = %s", (vendor_id,))
        vendor = cursor.fetchone()
        return vendor


# ---------------------------------------------------------------------------
# Inventory / Products
# ---------------------------------------------------------------------------

def get_inventory(search=None, inactive=False, limit=500, offset=0):
    """Fetch inventory items from Sage 50."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        where_clauses = []
        params = []

        if not inactive:
            where_clauses.append("(bInactive = 0 OR bInactive IS NULL)")
        if search:
            where_clauses.append("(sPartCode LIKE %s OR sName LIKE %s)")
            params.extend([f'%{search}%'] * 2)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        cursor.execute(f"""
            SELECT i.lId, i.sPartCode, i.sName, i.sSellUnit, i.sBuyUnit, i.sStockUnit,
                   i.bService, i.bInactive, i.nInvType,
                   COALESCE(bl.dInStock, 0) as dInStock,
                   COALESCE(bl.dQtyOnOrd, 0) as dQtyOnOrd,
                   COALESCE(bl.dQOnSalOrd, 0) as dQtyOnSO,
                   COALESCE(bl.dLastCost, 0) as dLastCost,
                   COALESCE(bl.dCostStk, 0) as dCostOfStock
            FROM tinvent i
            LEFT JOIN tinvbyln bl ON i.lId = bl.lInventId
            {where_sql}
            ORDER BY i.sPartCode
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        items = cursor.fetchall()

        cursor.execute(f"SELECT COUNT(*) as cnt FROM tinvent i {where_sql}", params)
        total = cursor.fetchone()['cnt']

        return {'inventory': items, 'total': total, 'limit': limit, 'offset': offset}


def get_inventory_item(item_id):
    """Fetch a single inventory item with pricing and location details."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        cursor.execute("SELECT * FROM tinvent WHERE lId = %s", (item_id,))
        item = cursor.fetchone()
        if not item:
            return None

        cursor.execute("SELECT * FROM tinvbyln WHERE lInventId = %s", (item_id,))
        locations = cursor.fetchall()

        cursor.execute("SELECT * FROM tinvprc WHERE lInventId = %s", (item_id,))
        pricing = cursor.fetchall()

        return {'item': item, 'locations': locations, 'pricing': pricing}


# ---------------------------------------------------------------------------
# Sales Orders
# ---------------------------------------------------------------------------

def get_sales_orders(search=None, customer_id=None, quote_only=False,
                     date_from=None, date_to=None, limit=100, offset=0):
    """Fetch sales orders from Sage 50."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        where_clauses = []
        params = []

        if search:
            where_clauses.append("(so.sSONum LIKE %s OR so.sName LIKE %s OR so.sComment LIKE %s)")
            params.extend([f'%{search}%'] * 3)
        if customer_id:
            where_clauses.append("so.lCusId = %s")
            params.append(customer_id)
        if quote_only:
            where_clauses.append("so.bQuote = 1")
        if date_from:
            where_clauses.append("so.dtSODate >= %s")
            params.append(date_from)
        if date_to:
            where_clauses.append("so.dtSODate <= %s")
            params.append(date_to)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        cursor.execute(f"""
            SELECT so.lId, so.sSONum, so.sName, so.lCusId, so.dtSODate, so.dtShipDate,
                   so.dTotal, so.sComment, so.sShipper, so.bQuote, so.bPrinted,
                   so.nFilled, so.bCleared, so.lCurrncyId, so.dExchRate,
                   c.sName as sCustomerName
            FROM tsalordr so
            LEFT JOIN tcustomr c ON so.lCusId = c.lId
            {where_sql}
            ORDER BY so.dtASDate DESC, so.lId DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        orders = cursor.fetchall()

        cursor.execute(f"""
            SELECT COUNT(*) as cnt FROM tsalordr so
            LEFT JOIN tcustomr c ON so.lCusId = c.lId
            {where_sql}
        """, params)
        total = cursor.fetchone()['cnt']

        return {'sales_orders': orders, 'total': total, 'limit': limit, 'offset': offset}


def get_sales_order(order_id):
    """Fetch a single sales order with line items."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        cursor.execute("""
            SELECT so.*, c.sName as sCustomerName, c.sEmail as sCustomerEmail
            FROM tsalordr so
            LEFT JOIN tcustomr c ON so.lCusId = c.lId
            WHERE so.lId = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            return None

        cursor.execute("""
            SELECT sl.*, i.sName as sItemName
            FROM tsoline sl
            LEFT JOIN tinvent i ON sl.lInventId = i.lId
            WHERE sl.lSOId = %s
            ORDER BY sl.nLineNum
        """, (order_id,))
        lines = cursor.fetchall()

        return {'order': order, 'lines': lines}


# ---------------------------------------------------------------------------
# Chart of Accounts
# ---------------------------------------------------------------------------

def get_accounts(search=None, account_type=None, inactive=False):
    """Fetch chart of accounts from Sage 50.
    account_type: H=Header, S=Subtotal, T=Total, L=Postable, R=Receivable, etc.
    """
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        where_clauses = []
        params = []

        if not inactive:
            where_clauses.append("(bInactive = 0 OR bInactive IS NULL)")
        if search:
            where_clauses.append("(sName LIKE %s OR CAST(lId AS CHAR) LIKE %s)")
            params.extend([f'%{search}%'] * 2)
        if account_type:
            where_clauses.append("cFunc = %s")
            params.append(account_type)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        cursor.execute(f"""
            SELECT lId, sName, cFunc, nAcctClass, sGifiCode,
                   dYts, dYtc, dYtsLY, dYtcLY, bInactive, lCurrncyId
            FROM taccount
            {where_sql}
            ORDER BY lId
        """, params)

        return cursor.fetchall()


# ---------------------------------------------------------------------------
# Receipts / Payments
# ---------------------------------------------------------------------------

def get_receipts(date_from=None, date_to=None, vendor_customer_id=None,
                 limit=100, offset=0):
    """Fetch receipt/payment transactions."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)
        where_clauses = []
        params = []

        if date_from:
            where_clauses.append("r.dtDate >= %s")
            params.append(date_from)
        if date_to:
            where_clauses.append("r.dtDate <= %s")
            params.append(date_to)
        if vendor_customer_id:
            where_clauses.append("r.lVenCusId = %s")
            params.append(vendor_customer_id)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        cursor.execute(f"""
            SELECT r.lChqId, r.dtDate, r.sSource, r.sName, r.sComment,
                   r.dAmount, r.dHomeAmt, r.bPrinted, r.bReversed, r.nJournal,
                   r.sChqNum, r.lVenCusId
            FROM trcpthdr r
            {where_sql}
            ORDER BY r.dtDate DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        receipts = cursor.fetchall()

        cursor.execute(f"SELECT COUNT(*) as cnt FROM trcpthdr r {where_sql}", params)
        total = cursor.fetchone()['cnt']

        return {'receipts': receipts, 'total': total, 'limit': limit, 'offset': offset}


# ---------------------------------------------------------------------------
# Dashboard / Summary
# ---------------------------------------------------------------------------

def get_dashboard_summary():
    """Get a high-level summary for the Sage 50 dashboard."""
    with get_sage_connection() as conn:
        cursor = _cursor(conn)

        cursor.execute("SELECT sCompName, sCity, sProvStat, dtSDate, dtFDate FROM tcompany LIMIT 1")
        company = cursor.fetchone()

        cursor.execute("SELECT COUNT(*) as cnt FROM tcustomr WHERE (bInactive = 0 OR bInactive IS NULL)")
        active_customers = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) as cnt FROM tvendor WHERE (bInactive = 0 OR bInactive IS NULL)")
        active_vendors = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) as cnt FROM tinvent WHERE (bInactive = 0 OR bInactive IS NULL)")
        active_items = cursor.fetchone()['cnt']

        cursor.execute("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(dTotal), 0) as total_value
            FROM tsalordr
            WHERE dtSODate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        """)
        recent_orders = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) as cnt, COALESCE(SUM(dTotal), 0) as total_value
            FROM tsalordr
            WHERE dtSODate >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
        """)
        yearly_orders = cursor.fetchone()

        cursor.execute("""
            SELECT c.lId, c.sName, SUM(so.dTotal) as total_sales
            FROM tsalordr so
            JOIN tcustomr c ON so.lCusId = c.lId
            WHERE so.dtSODate >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
            GROUP BY c.lId, c.sName
            ORDER BY total_sales DESC
            LIMIT 10
        """)
        top_customers = cursor.fetchall()

        return {
            'company': company,
            'active_customers': active_customers,
            'active_vendors': active_vendors,
            'active_inventory_items': active_items,
            'recent_orders_30d': {
                'count': recent_orders['cnt'],
                'total_value': recent_orders['total_value']
            },
            'yearly_orders': {
                'count': yearly_orders['cnt'],
                'total_value': yearly_orders['total_value']
            },
            'top_customers': top_customers
        }
