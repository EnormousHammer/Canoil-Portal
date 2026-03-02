# Sage 50 Accounting Integration - Canoil Portal

**Date:** March 1, 2026  
**Status:** Active  
**Access Mode:** READ-ONLY  

---

## Overview

The Canoil Portal connects to the live Sage 50 Quantum Accounting 2026 database for **Canoil Canada Ltd.** to display accounting data in the portal. The connection is strictly **read-only** — the portal cannot create, modify, or delete any data in Sage 50.

### Connection Details

| Setting | Value |
|---------|-------|
| Database Engine | MySQL (bundled with Sage 50 Canadian Edition) |
| Server | 192.168.1.11 |
| Port | 13540 |
| Database Name | simply |
| Company | Canoil Canada Ltd. |
| Location | Georgetown, Ontario |
| Fiscal Year | April 1, 2025 – March 31, 2026 |

### Data Available

| Data | Record Count | Table |
|------|-------------|-------|
| Customers | 353 | tcustomr |
| Vendors | 478 | tvendor |
| Inventory / Products | 616 | tinvent |
| Chart of Accounts | 278 | taccount |
| Sales Orders | 4,734 | tsalordr |
| Sales Order Lines | 12,737 | tsoline |
| Sales Transactions | 332 | trcsal |
| Purchase Transactions | 63 | trcpur |
| Receipts / Payments | 5,433 | trcpthdr |
| Journal Entries | 3,122 | tjourent |

---

## API Endpoints

All endpoints are GET requests (read-only). No POST, PUT, PATCH, or DELETE endpoints exist.

| Endpoint | Description | Query Parameters |
|----------|-------------|-----------------|
| `GET /api/sage/status` | Test connection, return summary counts | — |
| `GET /api/sage/dashboard` | Dashboard with top customers, order totals | — |
| `GET /api/sage/customers` | List/search customers | `search`, `inactive`, `limit`, `offset` |
| `GET /api/sage/customers/:id` | Single customer + recent orders | — |
| `GET /api/sage/vendors` | List/search vendors | `search`, `inactive`, `limit`, `offset` |
| `GET /api/sage/vendors/:id` | Single vendor detail | — |
| `GET /api/sage/inventory` | List/search inventory with stock levels | `search`, `inactive`, `limit`, `offset` |
| `GET /api/sage/inventory/:id` | Single item with pricing and locations | — |
| `GET /api/sage/sales-orders` | List/filter sales orders | `search`, `customer_id`, `quotes`, `date_from`, `date_to`, `limit`, `offset` |
| `GET /api/sage/sales-orders/:id` | Single order with line items | — |
| `GET /api/sage/accounts` | Chart of accounts | `search`, `type`, `inactive` |
| `GET /api/sage/receipts` | Receipts and payments | `date_from`, `date_to`, `entity_id`, `limit`, `offset` |

---

## Write Protection (3 Independent Layers)

Writing to Sage 50 is blocked at three independent levels. All three would have to fail simultaneously for any write to reach the database, which is not possible with the current implementation.

### Layer 1: MySQL Server-Side Read-Only Session

Every connection executes this as its very first command:

```sql
SET SESSION TRANSACTION READ ONLY
```

This tells the MySQL database engine itself (running on 192.168.1.11) that this session is read-only. Even if a write statement somehow reached the server, MySQL would reject it with an `OperationalError`. This protection is enforced by the **Sage server**, not by our application code.

**File:** `backend/sage_service.py`, line 67-68

### Layer 2: Python SQL Guard (ReadOnlyCursor)

Before any SQL leaves the portal machine, a `ReadOnlyCursor` wrapper inspects every query. Only these statement types are allowed:

- `SELECT` — reading data
- `SHOW` — viewing table structure
- `DESCRIBE` / `DESC` — viewing column definitions
- `EXPLAIN` — query analysis

Any other statement — `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE` — is immediately rejected with a `PermissionError` before it ever reaches the network.

**File:** `backend/sage_service.py`, lines 25-46

### Layer 3: No Commit Path (Transaction-Level)

The connection is opened with `autocommit=False`, and the `commit()` function is never called anywhere in the codebase. When a connection closes, any uncommitted transaction is automatically rolled back by MySQL. So even if a write somehow bypassed both Layer 1 and Layer 2, it would never be persisted.

**File:** `backend/sage_service.py`, line 64

### Test Results (Verified Against Live Server)

| Test | Result |
|------|--------|
| `SELECT` (normal read) | Allowed |
| `INSERT` via ReadOnlyCursor | **BLOCKED** — Python PermissionError |
| `UPDATE` via ReadOnlyCursor | **BLOCKED** — Python PermissionError |
| `DELETE` via ReadOnlyCursor | **BLOCKED** — Python PermissionError |
| `DROP TABLE` via ReadOnlyCursor | **BLOCKED** — Python PermissionError |
| `INSERT` bypassing Python guard (raw cursor) | **BLOCKED** — MySQL OperationalError (read-only session) |

---

## Files

| File | Purpose |
|------|---------|
| `backend/sage_service.py` | Sage 50 service module — connection handling, read-only guards, all query functions |
| `backend/app.py` | Flask API endpoints under `/api/sage/*` (lines 7676-7862) |
| `backend/.env` | Database credentials (`SAGE_DB_HOST`, `SAGE_DB_PORT`, `SAGE_DB_USER`, `SAGE_DB_PASSWORD`, `SAGE_DB_NAME`) |
| `backend/requirements.txt` | `PyMySQL>=1.1.0` dependency |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| PyMySQL | 1.1.2 | Pure Python MySQL client for connecting to Sage 50's MySQL database |

No ODBC drivers or additional software installation required. Sage 50 Canadian Edition uses MySQL (not Pervasive PSQL like the US edition), and the connection is made directly over TCP on port 13540.

---

## Important Notes

1. **This is READ-ONLY.** The portal displays Sage 50 data but cannot modify it. All data entry must continue to be done through Sage 50 directly.
2. **Network dependency.** The portal machine must be on the same LAN as 192.168.1.11 (or have network access to port 13540 on that server).
3. **Live data.** The portal reads directly from the active Sage 50 database. Data shown is always current — no caching or syncing involved.
4. **Sage 50 must be running.** The MySQL database engine runs as part of the Sage 50 Database Connection Manager service on the server. If that service is stopped, the portal will show a connection error.
5. **Credentials are stored in `.env`.** The `SAGE_DB_PASSWORD` is stored in the backend `.env` file, which is not committed to git.
