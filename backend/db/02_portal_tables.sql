/* ============================================================
   Canoil Portal — Additional Tables for ERP Replacement (v2)
   Extends 01_schema.sql with: Portal Users, Audit Log, Customers,
   Sales Orders, Work Orders, Shipments, Invoices, Approvals,
   Notifications, QC, MRP, Entity Mapping, Supplier Extras.
   
   HARD CONSTRAINT: Sage 50 is READ-ONLY. All portal writes go
   to these PostgreSQL tables — NEVER to Sage.
   ============================================================ */

BEGIN;

-- ============================================================
-- PORTAL USERS & AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS core.portal_users (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('viewer', 'operator', 'manager', 'admin')),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS portal_users_email_idx ON core.portal_users (email);
CREATE INDEX IF NOT EXISTS portal_users_role_idx ON core.portal_users (role);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS core.audit_log (
  id                BIGSERIAL PRIMARY KEY,
  ts                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id           BIGINT,
  user_email        TEXT,
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  before_value      JSONB,
  after_value       JSONB,
  ip_address        TEXT
);
CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON core.audit_log (ts);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON core.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON core.audit_log (user_email);

-- ============================================================
-- ENTITY MAPPING (MISys ↔ Sage key links)
-- ============================================================

CREATE TABLE IF NOT EXISTS core.entity_mapping (
  id                BIGSERIAL PRIMARY KEY,
  entity_type       TEXT NOT NULL CHECK (entity_type IN ('customer', 'item', 'supplier')),
  misys_key         TEXT NOT NULL,
  sage_key          TEXT NOT NULL,
  sage_id           BIGINT,
  confidence        TEXT NOT NULL DEFAULT 'exact'
                    CHECK (confidence IN ('exact', 'fuzzy', 'manual')),
  confirmed_by      TEXT,
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS entity_mapping_natural_idx
  ON core.entity_mapping (entity_type, misys_key);
CREATE INDEX IF NOT EXISTS entity_mapping_sage_idx ON core.entity_mapping (entity_type, sage_key);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.customers (
  id                BIGSERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  contact           TEXT,
  address           TEXT,
  city              TEXT,
  province          TEXT,
  postal_code       TEXT,
  country           TEXT DEFAULT 'Canada',
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  payment_terms     TEXT,
  credit_limit      NUMERIC(18,2),
  currency_code     TEXT DEFAULT 'CAD',
  notes             TEXT,
  sage_id           BIGINT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customers_name_trgm_idx ON core.customers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_sage_idx ON core.customers (sage_id);

CREATE TABLE IF NOT EXISTS core.customer_contacts (
  id                BIGSERIAL PRIMARY KEY,
  customer_id       BIGINT NOT NULL REFERENCES core.customers(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  role              TEXT,
  phone             TEXT,
  email             TEXT,
  is_primary        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_contacts_cust_idx ON core.customer_contacts (customer_id);

CREATE TABLE IF NOT EXISTS core.customer_pricing (
  id                BIGSERIAL PRIMARY KEY,
  customer_id       BIGINT NOT NULL REFERENCES core.customers(id) ON DELETE CASCADE,
  item_no           TEXT NOT NULL,
  price             NUMERIC(18,6) NOT NULL,
  effective_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date       DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_pricing_cust_idx ON core.customer_pricing (customer_id);
CREATE INDEX IF NOT EXISTS customer_pricing_item_idx ON core.customer_pricing (item_no);

-- ============================================================
-- SUPPLIER EXTRAS (extends core.suppliers from 01_schema.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS core.supplier_contacts (
  id                BIGSERIAL PRIMARY KEY,
  supplier_no       TEXT NOT NULL,
  name              TEXT NOT NULL,
  role              TEXT,
  phone             TEXT,
  email             TEXT,
  is_primary        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS supplier_contacts_supl_idx ON core.supplier_contacts (supplier_no);

CREATE TABLE IF NOT EXISTS core.supplier_performance (
  id                BIGSERIAL PRIMARY KEY,
  supplier_no       TEXT NOT NULL,
  po_no             TEXT,
  on_time           BOOLEAN,
  quality_score     NUMERIC(3,1) CHECK (quality_score >= 0 AND quality_score <= 10),
  notes             TEXT,
  evaluation_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  evaluated_by      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS supplier_perf_supl_idx ON core.supplier_performance (supplier_no);

-- ============================================================
-- SALES ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.sales_orders (
  id                BIGSERIAL PRIMARY KEY,
  so_no             TEXT NOT NULL UNIQUE,
  customer_id       BIGINT REFERENCES core.customers(id),
  customer_name     TEXT,
  order_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date     DATE,
  ship_date         DATE,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','confirmed','released','shipped','invoiced','closed','cancelled')),
  priority          TEXT DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent')),
  currency_code     TEXT DEFAULT 'CAD',
  subtotal          NUMERIC(18,2) DEFAULT 0,
  tax               NUMERIC(18,2) DEFAULT 0,
  total             NUMERIC(18,2) DEFAULT 0,
  notes             TEXT,
  special_instructions TEXT,
  source            TEXT NOT NULL DEFAULT 'portal'
                    CHECK (source IN ('portal', 'sage', 'misys')),
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS so_customer_idx ON core.sales_orders (customer_id);
CREATE INDEX IF NOT EXISTS so_status_idx ON core.sales_orders (status);
CREATE INDEX IF NOT EXISTS so_date_idx ON core.sales_orders (order_date);

CREATE TABLE IF NOT EXISTS core.sales_order_lines (
  id                BIGSERIAL PRIMARY KEY,
  so_id             BIGINT NOT NULL REFERENCES core.sales_orders(id) ON DELETE CASCADE,
  line_no           INTEGER NOT NULL DEFAULT 1,
  item_no           TEXT NOT NULL,
  description       TEXT,
  qty_ordered       NUMERIC(18,6) NOT NULL,
  qty_shipped       NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_price        NUMERIC(18,6) NOT NULL DEFAULT 0,
  ext_price         NUMERIC(18,2) NOT NULL DEFAULT 0,
  uom               TEXT,
  delivery_date     DATE,
  UNIQUE (so_id, line_no)
);
CREATE INDEX IF NOT EXISTS so_lines_item_idx ON core.sales_order_lines (item_no);

-- ============================================================
-- WORK ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.work_orders (
  id                BIGSERIAL PRIMARY KEY,
  wo_no             TEXT NOT NULL UNIQUE,
  mo_no             TEXT,
  item_no           TEXT,
  description       TEXT,
  status            INTEGER NOT NULL DEFAULT 0,
  qty_planned       NUMERIC(18,6),
  qty_completed     NUMERIC(18,6) DEFAULT 0,
  qty_scrap         NUMERIC(18,6) DEFAULT 0,
  release_date      DATE,
  completion_date   DATE,
  loc_id            TEXT,
  raw               JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wo_mo_idx ON core.work_orders (mo_no);

-- ============================================================
-- MO EVENTS (portal-originated MO transaction history)
-- ============================================================

CREATE TABLE IF NOT EXISTS core.mo_events (
  id                BIGSERIAL PRIMARY KEY,
  mo_no             TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  item_no           TEXT,
  qty               NUMERIC(18,6),
  location          TEXT,
  lot               TEXT,
  user_email        TEXT,
  ref               TEXT,
  ts                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data              JSONB
);
CREATE INDEX IF NOT EXISTS mo_events_mo_idx ON core.mo_events (mo_no);
CREATE INDEX IF NOT EXISTS mo_events_ts_idx ON core.mo_events (ts);

-- ============================================================
-- SHIPMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.shipments (
  id                BIGSERIAL PRIMARY KEY,
  so_no             TEXT NOT NULL,
  ship_date         DATE,
  carrier           TEXT,
  tracking_no       TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','confirmed','shipped','delivered')),
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shipments_so_idx ON core.shipments (so_no);
CREATE INDEX IF NOT EXISTS shipments_status_idx ON core.shipments (status);

CREATE TABLE IF NOT EXISTS core.shipment_lines (
  id                BIGSERIAL PRIMARY KEY,
  shipment_id       BIGINT NOT NULL REFERENCES core.shipments(id) ON DELETE CASCADE,
  so_line_id        BIGINT,
  item_no           TEXT NOT NULL,
  qty_shipped       NUMERIC(18,6) NOT NULL,
  lot_no            TEXT
);
CREATE INDEX IF NOT EXISTS shipment_lines_ship_idx ON core.shipment_lines (shipment_id);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS core.invoices (
  id                BIGSERIAL PRIMARY KEY,
  invoice_no        TEXT NOT NULL UNIQUE,
  so_no             TEXT,
  shipment_id       BIGINT REFERENCES core.shipments(id),
  customer_id       BIGINT REFERENCES core.customers(id),
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  subtotal          NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax               NUMERIC(18,2) NOT NULL DEFAULT 0,
  total             NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency_code     TEXT DEFAULT 'CAD',
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','paid','void')),
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_so_idx ON core.invoices (so_no);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON core.invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON core.invoices (status);

CREATE TABLE IF NOT EXISTS core.invoice_lines (
  id                BIGSERIAL PRIMARY KEY,
  invoice_id        BIGINT NOT NULL REFERENCES core.invoices(id) ON DELETE CASCADE,
  item_no           TEXT,
  description       TEXT,
  qty               NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_price        NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount            NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_rate          NUMERIC(6,4) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invoice_lines_inv_idx ON core.invoice_lines (invoice_id);

-- ============================================================
-- APPROVAL WORKFLOWS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.workflow_rules (
  id                BIGSERIAL PRIMARY KEY,
  entity_type       TEXT NOT NULL CHECK (entity_type IN ('PO','MO','PR','SO')),
  condition         JSONB NOT NULL DEFAULT '{}',
  approver_role     TEXT NOT NULL DEFAULT 'manager',
  sequence          INTEGER NOT NULL DEFAULT 1,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.approval_requests (
  id                BIGSERIAL PRIMARY KEY,
  entity_type       TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  rule_id           BIGINT REFERENCES core.workflow_rules(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  requested_by      TEXT,
  decided_by        TEXT,
  decided_at        TIMESTAMPTZ,
  comments          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS approval_req_entity_idx ON core.approval_requests (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS approval_req_status_idx ON core.approval_requests (status);

-- ============================================================
-- NOTIFICATIONS & ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS core.notifications (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT REFERENCES core.portal_users(id),
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  message           TEXT,
  entity_type       TEXT,
  entity_id         TEXT,
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON core.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_ts_idx ON core.notifications (created_at);

CREATE TABLE IF NOT EXISTS core.alert_rules (
  id                BIGSERIAL PRIMARY KEY,
  rule_type         TEXT NOT NULL
                    CHECK (rule_type IN ('low_stock','overdue_po','pending_approval','mrp_suggestion','custom')),
  threshold         JSONB NOT NULL DEFAULT '{}',
  notify_users      JSONB DEFAULT '[]',
  notify_email      BOOLEAN NOT NULL DEFAULT FALSE,
  escalate_after_hours INTEGER,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  description       TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUALITY CONTROL / INSPECTION
-- ============================================================

CREATE TABLE IF NOT EXISTS core.quality_specs (
  id                BIGSERIAL PRIMARY KEY,
  item_no           TEXT NOT NULL,
  spec_name         TEXT NOT NULL,
  min_value         NUMERIC(18,6),
  max_value         NUMERIC(18,6),
  unit              TEXT,
  test_method       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quality_specs_item_idx ON core.quality_specs (item_no);

CREATE TABLE IF NOT EXISTS core.inspections (
  id                BIGSERIAL PRIMARY KEY,
  po_no             TEXT,
  po_line_id        TEXT,
  item_no           TEXT NOT NULL,
  lot_no            TEXT,
  qty_inspected     NUMERIC(18,6),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','pass','fail','hold')),
  inspector_id      BIGINT REFERENCES core.portal_users(id),
  inspected_at      TIMESTAMPTZ,
  results           JSONB,
  coa_file_path     TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inspections_status_idx ON core.inspections (status);
CREATE INDEX IF NOT EXISTS inspections_item_idx ON core.inspections (item_no);
CREATE INDEX IF NOT EXISTS inspections_po_idx ON core.inspections (po_no);

-- ============================================================
-- MRP PLANNING
-- ============================================================

CREATE TABLE IF NOT EXISTS core.mrp_runs (
  id                BIGSERIAL PRIMARY KEY,
  run_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_by            TEXT,
  parameters        JSONB DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('running','completed','failed')),
  summary           JSONB,
  planned_order_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core.mrp_planned_orders (
  id                BIGSERIAL PRIMARY KEY,
  run_id            BIGINT NOT NULL REFERENCES core.mrp_runs(id) ON DELETE CASCADE,
  item_no           TEXT NOT NULL,
  qty               NUMERIC(18,6) NOT NULL,
  need_date         DATE NOT NULL,
  order_date        DATE NOT NULL,
  supplier_no       TEXT,
  status            TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','converted','cancelled')),
  converted_po_no   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mrp_planned_run_idx ON core.mrp_planned_orders (run_id);
CREATE INDEX IF NOT EXISTS mrp_planned_item_idx ON core.mrp_planned_orders (item_no);
CREATE INDEX IF NOT EXISTS mrp_planned_status_idx ON core.mrp_planned_orders (status);

-- ============================================================
-- ETL RUN TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS core.etl_runs (
  id                BIGSERIAL PRIMARY KEY,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','completed','failed')),
  source_path       TEXT,
  rows_staged       INTEGER DEFAULT 0,
  rows_core         INTEGER DEFAULT 0,
  error_message     TEXT,
  triggered_by      TEXT DEFAULT 'manual'
);

COMMIT;
