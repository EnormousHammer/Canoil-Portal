/**
 * ERP Portal — Unified hub for all new ERP features (Phase 1-4).
 * Customers, Sales Orders, Shipments, Invoices, Approvals, MRP,
 * QC, Financials, Sage Browser, Notifications, Audit Log.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../utils/portalApi';

type ERPSection = 'overview' | 'customers' | 'sales-orders' | 'shipments' |
  'invoices' | 'approvals' | 'mrp' | 'qc' | 'financials' |
  'sage-browser' | 'sage-analytics' | 'item-mapping' |
  'notifications' | 'audit-log' | 'admin';

interface ERPPortalProps {
  data?: any;
  currentUser?: any;
}

const SECTIONS: { id: ERPSection; label: string; icon: string; color: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊', color: 'blue' },
  { id: 'customers', label: 'Customers', icon: '👥', color: 'indigo' },
  { id: 'sales-orders', label: 'Sales Orders', icon: '📋', color: 'cyan' },
  { id: 'shipments', label: 'Shipments', icon: '🚚', color: 'teal' },
  { id: 'invoices', label: 'Invoices', icon: '💰', color: 'green' },
  { id: 'approvals', label: 'Approvals', icon: '✅', color: 'amber' },
  { id: 'mrp', label: 'MRP', icon: '🔧', color: 'violet' },
  { id: 'qc', label: 'Quality', icon: '🔬', color: 'rose' },
  { id: 'financials', label: 'Financials', icon: '📈', color: 'emerald' },
  { id: 'sage-browser', label: 'Sage Browser', icon: '🏦', color: 'orange' },
  { id: 'sage-analytics', label: 'Sage Analytics', icon: '📊', color: 'amber' },
  { id: 'item-mapping', label: 'Item Mapping', icon: '🔗', color: 'teal' },
  { id: 'notifications', label: 'Alerts', icon: '🔔', color: 'yellow' },
  { id: 'audit-log', label: 'Audit Log', icon: '📜', color: 'slate' },
  { id: 'admin', label: 'Admin', icon: '⚙️', color: 'gray' },
];

export const ERPPortal: React.FC<ERPPortalProps> = ({ data, currentUser }) => {
  const [section, setSection] = useState<ERPSection>('overview');

  return (
    <div className="space-y-4">
      {/* Section Nav */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all
              ${section === s.id
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <span className="mr-1">{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
        {section === 'overview' && <ERPOverview />}
        {section === 'customers' && <CustomerSection />}
        {section === 'sales-orders' && <SalesOrderSection data={data} />}
        {section === 'shipments' && <ShipmentSection />}
        {section === 'invoices' && <InvoiceSection />}
        {section === 'approvals' && <ApprovalSection />}
        {section === 'mrp' && <MRPSection />}
        {section === 'qc' && <QCSection />}
        {section === 'financials' && <FinancialSection />}
        {section === 'sage-browser' && <SageBrowserSection />}
        {section === 'sage-analytics' && <SageAnalyticsSection />}
        {section === 'item-mapping' && <ItemMappingSection data={data} />}
        {section === 'notifications' && <NotificationSection />}
        {section === 'audit-log' && <AuditLogSection />}
        {section === 'admin' && <AdminSection />}
      </div>
    </div>
  );
};

// ============================================================
// OVERVIEW
// ============================================================
const ERPOverview: React.FC = () => {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    apiGet('/api/db/status').then(r => setStatus(r.data));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">ERP Portal Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard title="Database" value={status?.connected ? 'Connected' : 'Not Connected'}
          color={status?.connected ? 'green' : 'red'} />
        <StatusCard title="Sage 50" value="Read-Only" color="blue" />
        <StatusCard title="Auth" value="JWT Active" color="indigo" />
      </div>
      <p className="mt-4 text-sm text-slate-500">
        All portal data is written to PostgreSQL. Sage 50 is strictly read-only.
      </p>
    </div>
  );
};

// ============================================================
// CUSTOMERS (read from Sage G Drive CSV — same source as Sage Analytics)
// ============================================================
const CustomerSection: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await apiGet(`/api/sage/gdrive/customers?search=${encodeURIComponent(search)}&limit=100`);
    if (r.data?.error) { setError(r.data.error); setLoading(false); return; }
    setCustomers(r.data?.customers || []);
    setTotal(r.data?.total ?? (r.data?.customers?.length ?? 0));
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Customers</h2>
          <p className="text-xs text-slate-500 mt-0.5">READ-ONLY · Sage 50 G Drive export · {total} customers</p>
        </div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, city..."
        className="w-full mb-4 px-4 py-2 border border-slate-200 rounded-xl text-sm" />
      {error ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
          <p className="font-semibold">Could not load Sage customers</p>
          <p className="text-xs mt-1">{error}</p>
          <button onClick={load} className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold">Retry</button>
        </div>
      ) : loading ? <p className="text-slate-500">Loading...</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Customer', 'City', 'Province', 'Phone', 'Email', 'YTD Sales', 'Credit Limit', 'Terms', 'Last Sale'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800 max-w-[180px] truncate">{c.sName}</td>
                  <td className="px-3 py-2 text-slate-600">{c.sCity || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{c.sProvState || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{c.sPhone || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{c.sEmail || '—'}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-emerald-700">
                    {c.dAmtYtd != null ? `$${Number(c.dAmtYtd).toLocaleString('en-CA', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600">
                    {c.dCrLimit != null && c.dCrLimit >= 0 ? `$${Number(c.dCrLimit).toLocaleString('en-CA', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{c.nNetDay ? `Net ${c.nNetDay}` : '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{c.dtLastSal ? String(c.dtLastSal).substring(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No customers found</p>}
        </div>
      )}
    </div>
  );
};

// ============================================================
// SALES ORDERS
// ============================================================
const SalesOrderSection: React.FC<{ data?: any }> = ({ data }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: '', notes: '', lines: [{ item_no: '', qty_ordered: 1, unit_price: 0 }] });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiGet('/api/sales-orders?limit=50');
    setOrders(r.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const payload = {
      ...form,
      lines: form.lines.map((l, i) => ({
        ...l,
        line_no: i + 1,
        ext_price: Number(l.qty_ordered) * Number(l.unit_price),
      })),
      subtotal: form.lines.reduce((s, l) => s + Number(l.qty_ordered) * Number(l.unit_price), 0),
      total: form.lines.reduce((s, l) => s + Number(l.qty_ordered) * Number(l.unit_price), 0),
    };
    await apiPost('/api/sales-orders', payload);
    setShowForm(false);
    load();
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { item_no: '', qty_ordered: 1, unit_price: 0 }] });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Sales Orders</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-500">
          + New SO
        </button>
      </div>
      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3">
          <input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
            placeholder="Customer Name" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Lines:</p>
            {form.lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input value={l.item_no} onChange={e => { const nl = [...form.lines]; nl[i] = { ...l, item_no: e.target.value }; setForm({ ...form, lines: nl }); }}
                  placeholder="Item No." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input type="number" value={l.qty_ordered} onChange={e => { const nl = [...form.lines]; nl[i] = { ...l, qty_ordered: +e.target.value }; setForm({ ...form, lines: nl }); }}
                  placeholder="Qty" className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input type="number" value={l.unit_price} onChange={e => { const nl = [...form.lines]; nl[i] = { ...l, unit_price: +e.target.value }; setForm({ ...form, lines: nl }); }}
                  placeholder="Price" className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            ))}
            <button onClick={addLine} className="text-sm text-blue-600 hover:underline">+ Add Line</button>
          </div>
          <button onClick={handleCreate} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">Create SO</button>
        </div>
      )}
      {loading ? <p className="text-slate-500">Loading...</p> :
        <DataTable data={orders} columns={['so_no', 'customer_name', 'status', 'total', 'order_date', 'source']} />
      }
    </div>
  );
};

// ============================================================
// SHIPMENTS
// ============================================================
const ShipmentSection: React.FC = () => {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGet('/api/shipments?limit=50').then(r => { setShipments(r.data || []); setLoading(false); });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Shipments</h2>
      {loading ? <p className="text-slate-500">Loading...</p> :
        <DataTable data={shipments} columns={['id', 'so_no', 'status', 'carrier', 'tracking_no', 'ship_date']} />
      }
    </div>
  );
};

// ============================================================
// INVOICES
// ============================================================
const InvoiceSection: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGet('/api/invoices?limit=50').then(r => { setInvoices(r.data || []); setLoading(false); });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Invoices</h2>
      {loading ? <p className="text-slate-500">Loading...</p> :
        <DataTable data={invoices} columns={['invoice_no', 'so_no', 'status', 'total', 'invoice_date', 'due_date']} />
      }
    </div>
  );
};

// ============================================================
// APPROVALS
// ============================================================
const ApprovalSection: React.FC = () => {
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    apiGet('/api/approvals/pending').then(r => setPending(r.data || []));
    apiGet('/api/approvals/history?limit=20').then(r => setHistory(r.data || []));
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    await apiPost(`/api/approvals/${id}/${action}`, { comments: '' });
    const r = await apiGet('/api/approvals/pending');
    setPending(r.data || []);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Approval Inbox</h2>
      {pending.length === 0 ? (
        <p className="text-slate-500">No pending approvals</p>
      ) : (
        <div className="space-y-2">
          {pending.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
              <div>
                <span className="font-semibold text-sm">{a.entity_type} {a.entity_id}</span>
                <span className="ml-2 text-xs text-slate-500">{a.rule_description || ''}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(a.id, 'approve')} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold">Approve</button>
                <button onClick={() => handleAction(a.id, 'reject')} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 className="text-lg font-bold text-slate-700 mt-6 mb-2">History</h3>
      <DataTable data={history} columns={['entity_type', 'entity_id', 'status', 'decided_by', 'decided_at']} />
    </div>
  );
};

// ============================================================
// MRP
// ============================================================
const MRPSection: React.FC = () => {
  const [latestRun, setLatestRun] = useState<any>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiGet('/api/mrp/latest').then(r => setLatestRun(r.data || null));
  }, []);

  const runMRP = async () => {
    setRunning(true);
    const r = await apiPost('/api/mrp/run');
    setLatestRun(r.data);
    setRunning(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Material Requirements Planning</h2>
        <button onClick={runMRP} disabled={running}
          className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
          {running ? 'Running...' : 'Run MRP'}
        </button>
      </div>
      {latestRun ? (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatusCard title="Run ID" value={`#${latestRun.id || '?'}`} color="violet" />
            <StatusCard title="Status" value={latestRun.status || 'N/A'} color="green" />
            <StatusCard title="Planned Orders" value={String(latestRun.planned_order_count || 0)} color="blue" />
          </div>
          {latestRun.planned_orders && (
            <DataTable data={latestRun.planned_orders}
              columns={['item_no', 'qty', 'need_date', 'order_date', 'supplier_no', 'status']} />
          )}
        </div>
      ) : <p className="text-slate-500">No MRP runs yet. Click "Run MRP" to generate planned orders.</p>}
    </div>
  );
};

// ============================================================
// QC
// ============================================================
const QCSection: React.FC = () => {
  const [inspections, setInspections] = useState<any[]>([]);

  useEffect(() => {
    apiGet('/api/inspections/pending').then(r => setInspections(r.data || []));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Quality Control</h2>
      {inspections.length === 0 ? (
        <p className="text-slate-500">No pending inspections</p>
      ) : (
        <DataTable data={inspections} columns={['id', 'item_no', 'po_no', 'lot_no', 'status', 'created_at']} />
      )}
    </div>
  );
};

// ============================================================
// FINANCIALS
// ============================================================
const FinancialSection: React.FC = () => {
  const [arData, setArData] = useState<any>(null);
  const [apData, setApData] = useState<any>(null);
  const [tab, setTab] = useState<'ar' | 'ap' | 'gl' | 'margins' | 'reports'>('ar');

  useEffect(() => {
    apiGet('/api/financial/ar-aging').then(r => setArData(r.data));
    apiGet('/api/financial/ap-aging').then(r => setApData(r.data));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Financial Views</h2>
      <div className="flex gap-2 mb-4">
        {(['ar', 'ap', 'gl', 'margins', 'reports'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {t === 'margins' ? 'Margin Analysis' : t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'ar' && arData && (
        <div>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {Object.entries(arData.buckets || {}).map(([k, v]) => (
              <StatusCard key={k} title={k === '120_plus' ? '120+' : k === 'current' ? 'Current' : `${k} days`}
                value={`$${(Number(v) || 0).toLocaleString()}`} color="green" />
            ))}
          </div>
          <p className="text-sm text-slate-600">Total Outstanding: <strong>${(arData.total_outstanding || 0).toLocaleString()}</strong></p>
        </div>
      )}
      {tab === 'ap' && apData && (
        <div>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {Object.entries(apData.buckets || {}).map(([k, v]) => (
              <StatusCard key={k} title={k === '120_plus' ? '120+' : k === 'current' ? 'Current' : `${k} days`}
                value={`$${(Number(v) || 0).toLocaleString()}`} color="orange" />
            ))}
          </div>
          <p className="text-sm text-slate-600">Total Outstanding: <strong>${(apData.total_outstanding || 0).toLocaleString()}</strong></p>
        </div>
      )}
      {tab === 'gl' && <GLView />}
      {tab === 'margins' && <MarginDashboard />}
      {tab === 'reports' && <ReportsView />}
    </div>
  );
};

const MarginDashboard: React.FC = () => {
  const [view, setView] = useState<'by-order' | 'by-product' | 'by-customer'>('by-order');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const ep = view === 'by-customer' ? '/api/costing/margin/customer' : `/api/costing/margin/${view}`;
    apiGet(ep).then(r => { setData(r.data); setLoading(false); });
  }, [view]);

  const items = view === 'by-order' ? (data?.orders || [])
    : view === 'by-product' ? (data?.products || [])
    : (data?.customers || []);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['by-order', 'by-product', 'by-customer'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${
              view === v ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {v.replace('-', ' ')}
          </button>
        ))}
      </div>
      {loading ? <p className="text-slate-500">Loading margin data...</p> : (
        <div>
          <p className="text-xs text-slate-500 mb-3">{items.length} records</p>
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">No margin data available yet. Create Sales Orders first.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {view === 'by-order' && <><th className="px-3 py-2 text-left text-xs font-semibold">SO#</th><th className="px-3 py-2 text-left text-xs font-semibold">Customer</th><th className="px-3 py-2 text-right text-xs font-semibold">Revenue</th><th className="px-3 py-2 text-right text-xs font-semibold">COGS</th><th className="px-3 py-2 text-right text-xs font-semibold">Margin</th><th className="px-3 py-2 text-right text-xs font-semibold">Margin %</th></>}
                    {view === 'by-product' && <><th className="px-3 py-2 text-left text-xs font-semibold">Item</th><th className="px-3 py-2 text-right text-xs font-semibold">Revenue</th><th className="px-3 py-2 text-right text-xs font-semibold">Shipped</th><th className="px-3 py-2 text-right text-xs font-semibold">Unit Cost</th><th className="px-3 py-2 text-right text-xs font-semibold">COGS</th><th className="px-3 py-2 text-right text-xs font-semibold">Margin</th><th className="px-3 py-2 text-right text-xs font-semibold">Margin %</th></>}
                    {view === 'by-customer' && <><th className="px-3 py-2 text-left text-xs font-semibold">Customer</th><th className="px-3 py-2 text-right text-xs font-semibold">Orders</th><th className="px-3 py-2 text-right text-xs font-semibold">Revenue</th></>}
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 50).map((row: any, i: number) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                      {view === 'by-order' && <>
                        <td className="px-3 py-2 text-xs font-mono">{row.so_no}</td>
                        <td className="px-3 py-2 text-xs">{row.customer_name}</td>
                        <td className="px-3 py-2 text-xs text-right">${(row.revenue || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right">${(row.cogs || 0).toLocaleString()}</td>
                        <td className={`px-3 py-2 text-xs text-right font-semibold ${(row.margin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${(row.margin || 0).toLocaleString()}</td>
                        <td className={`px-3 py-2 text-xs text-right ${(row.margin_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.margin_pct}%</td>
                      </>}
                      {view === 'by-product' && <>
                        <td className="px-3 py-2 text-xs font-mono">{row.item_no}</td>
                        <td className="px-3 py-2 text-xs text-right">${(row.total_revenue || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right">{row.total_shipped}</td>
                        <td className="px-3 py-2 text-xs text-right">${(row.unit_cost || 0).toFixed(4)}</td>
                        <td className="px-3 py-2 text-xs text-right">${(row.cogs || 0).toLocaleString()}</td>
                        <td className={`px-3 py-2 text-xs text-right font-semibold ${(row.margin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${(row.margin || 0).toLocaleString()}</td>
                        <td className={`px-3 py-2 text-xs text-right ${(row.margin_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.margin_pct}%</td>
                      </>}
                      {view === 'by-customer' && <>
                        <td className="px-3 py-2 text-xs">{row.customer_name}</td>
                        <td className="px-3 py-2 text-xs text-right">{row.order_count}</td>
                        <td className="px-3 py-2 text-xs text-right">${(row.total_revenue || 0).toLocaleString()}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const GLView: React.FC = () => {
  const [gl, setGl] = useState<any>(null);
  useEffect(() => { apiGet('/api/financial/gl-summary').then(r => setGl(r.data)); }, []);
  if (!gl) return <p className="text-slate-500">Loading GL...</p>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatusCard title="Total Assets" value={`$${(gl.total_assets || 0).toLocaleString()}`} color="green" />
        <StatusCard title="Total Liabilities" value={`$${(gl.total_liabilities || 0).toLocaleString()}`} color="red" />
        <StatusCard title="Total Revenue" value={`$${(gl.total_revenue || 0).toLocaleString()}`} color="blue" />
        <StatusCard title="Total Expenses" value={`$${(gl.total_expenses || 0).toLocaleString()}`} color="amber" />
      </div>
    </div>
  );
};

const ReportsView: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  const loadMonthEnd = async () => {
    const r = await apiGet(`/api/reports/month-end?year=${year}&month=${month}`);
    setReport(r.data);
  };

  return (
    <div>
      <button onClick={loadMonthEnd} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold mb-4">
        Generate Month-End Package ({year}-{String(month).padStart(2, '0')})
      </button>
      {report && (
        <div className="space-y-3">
          {Object.entries(report.sections || {}).map(([k, v]) => (
            <div key={k} className="p-3 bg-slate-50 rounded-xl">
              <h4 className="text-sm font-bold text-slate-700 mb-1">{k.replace(/_/g, ' ').toUpperCase()}</h4>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// SAGE ANALYTICS (from G Drive CSV export)
// ============================================================

const fmt = (n: number | null | undefined, currency = 'CAD') =>
  n != null ? n.toLocaleString('en-CA', { style: 'currency', currency, maximumFractionDigits: 0 }) : '—';

const fmtFull = (n: number | null | undefined, currency = 'CAD') =>
  n != null ? n.toLocaleString('en-CA', { style: 'currency', currency, minimumFractionDigits: 2 }) : '—';

const fmtPct = (n: number | null | undefined) =>
  n != null ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—';

const SageAnalyticsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'movers' | 'revenue' | 'ar-aging' | 'products'>('overview');
  const [kpis, setKpis] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [bestMovers, setBestMovers] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any>(null);
  const [arAging, setArAging] = useState<any>(null);
  const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, custRes] = await Promise.all([
        apiGet('/api/sage/gdrive/analytics/kpis'),
        apiGet('/api/sage/gdrive/analytics/top-customers?limit=25'),
      ]);
      if (kpisRes.data?.error) { setError(kpisRes.data.error); setLoading(false); return; }
      setKpis(kpisRes.data);
      setTopCustomers(custRes.data?.customers || []);
      setLoading(false);
    } catch (e: any) {
      setError(String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadTab = useCallback(async (tab: string) => {
    if (tab === 'movers' && bestMovers.length === 0) {
      const r = await apiGet('/api/sage/gdrive/analytics/best-movers?limit=25');
      setBestMovers(r.data?.items || []);
    }
    if (tab === 'revenue') {
      const r = await apiGet(`/api/sage/gdrive/analytics/monthly-revenue?year=${selectedYear}`);
      setMonthlyRevenue(r.data);
    }
    if (tab === 'ar-aging' && !arAging) {
      const r = await apiGet('/api/sage/gdrive/analytics/ar-aging');
      setArAging(r.data);
    }
    if (tab === 'products' && salesByProduct.length === 0) {
      const r = await apiGet('/api/sage/gdrive/analytics/sales-by-product?limit=25');
      setSalesByProduct(r.data?.products || []);
    }
  }, [bestMovers, arAging, salesByProduct, selectedYear]);

  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

  if (loading) return (
    <div className="flex items-center gap-3 py-12 text-slate-500">
      <svg className="animate-spin h-5 w-5 text-amber-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Loading Sage analytics from G Drive…
    </div>
  );

  if (error) return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Sage Analytics</h2>
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-amber-800">
        <p className="font-semibold mb-1">Sage G Drive data not available</p>
        <p className="text-sm">{error}</p>
        <p className="text-xs mt-2 text-amber-600">Ensure the Sage CSV export is synced to: …/Full Company Data From SAGE/</p>
        <button onClick={load} className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">
          Retry
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'customers', label: 'Top Customers' },
    { id: 'movers', label: 'Best Movers' },
    { id: 'revenue', label: 'Monthly Revenue' },
    { id: 'ar-aging', label: 'AR Aging' },
    { id: 'products', label: 'Sales by Product' },
  ] as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-2xl font-bold text-slate-800">Sage Analytics</h2>
        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">READ-ONLY · G Drive CSV {kpis?.data_folder ? `· ${kpis.data_folder}` : ''}</span>
      </div>

      {/* KPI Header */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-xl text-white">
            <p className="text-xs font-medium opacity-80">YTD Revenue</p>
            <p className="text-xl font-bold tabular-nums">{fmt(kpis.total_ytd_revenue)}</p>
            <p className={`text-xs font-semibold mt-1 ${(kpis.yoy_revenue_pct ?? 0) >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
              {fmtPct(kpis.yoy_revenue_pct)} vs last yr
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl text-white">
            <p className="text-xs font-medium opacity-80">Active Customers</p>
            <p className="text-xl font-bold">{kpis.active_customers?.toLocaleString() ?? '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl text-white">
            <p className="text-xs font-medium opacity-80">Open Sales Orders</p>
            <p className="text-xl font-bold">{kpis.open_sales_orders?.toLocaleString() ?? '—'}</p>
            <p className="text-xs opacity-80">{fmt(kpis.open_so_value)} value</p>
          </div>
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-4 rounded-xl text-white">
            <p className="text-xs font-medium opacity-80">Prior Year Revenue</p>
            <p className="text-xl font-bold tabular-nums">{fmt(kpis.total_ly_revenue)}</p>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div>
          <h3 className="text-base font-bold text-slate-700 mb-3">Top 10 Customers by YTD Revenue</h3>
          <AnalyticsTable
            data={topCustomers.slice(0, 10)}
            columns={[
              { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
              { key: 'sName', label: 'Customer', render: (v: string) => <span className="font-semibold text-slate-800">{v}</span> },
              { key: 'dAmtYtd', label: 'YTD Sales', render: (v: number) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v)}</span> },
              { key: 'dLastYrAmt', label: 'Prior Year', render: (v: number) => <span className="font-mono text-slate-600">{fmtFull(v)}</span> },
              { key: 'yoy_change_pct', label: 'YoY', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(v)}</span> },
              { key: 'credit_utilization_pct', label: 'Credit Used', render: (v: number | null, _: any, row: any) => (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${(v ?? 0) >= 90 ? 'bg-red-500' : (v ?? 0) >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(v ?? 0, 100)}%` }} />
                  </div>
                  <span className="text-xs text-slate-600">{v != null ? `${v.toFixed(0)}%` : '—'}</span>
                </div>
              )},
            ]}
          />
        </div>
      )}

      {activeTab === 'customers' && (
        <div>
          <h3 className="text-base font-bold text-slate-700 mb-3">All Customers by YTD Revenue</h3>
          <AnalyticsTable
            data={topCustomers}
            columns={[
              { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
              { key: 'sName', label: 'Customer', render: (v: string) => <span className="font-semibold text-slate-800">{v}</span> },
              { key: 'sCity', label: 'City', render: (v: string, _: any, row: any) => <span className="text-slate-500">{v}{row.sProvState ? `, ${row.sProvState}` : ''}</span> },
              { key: 'currency', label: 'Currency' },
              { key: 'price_list', label: 'Price List' },
              { key: 'dAmtYtd', label: 'YTD Sales', render: (v: number, _: any, row: any) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v, row.currency || 'CAD')}</span> },
              { key: 'dLastYrAmt', label: 'Prior Year', render: (v: number, _: any, row: any) => <span className="font-mono text-slate-600">{fmtFull(v, row.currency || 'CAD')}</span> },
              { key: 'yoy_change_pct', label: 'YoY %', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(v)}</span> },
              { key: 'dCrLimit', label: 'Credit Limit', render: (v: number, _: any, row: any) => <span className="font-mono text-slate-600">{fmtFull(v, row.currency || 'CAD')}</span> },
              { key: 'credit_utilization_pct', label: 'Utilization', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : (v ?? 0) >= 90 ? 'text-red-600' : (v ?? 0) >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>{v != null ? `${v.toFixed(1)}%` : '—'}</span> },
              { key: 'nNetDay', label: 'Terms', render: (v: number) => v ? `Net ${v}` : '—' },
              { key: 'dtLastSal', label: 'Last Sale' },
            ]}
          />
        </div>
      )}

      {activeTab === 'movers' && (
        <div>
          <h3 className="text-base font-bold text-slate-700 mb-3">Best Moving Items — YTD Units Sold</h3>
          {bestMovers.length === 0 ? <p className="text-slate-400 text-sm py-4">Loading…</p> : (
            <AnalyticsTable
              data={bestMovers}
              columns={[
                { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
                { key: 'sPartCode', label: 'Part Code', render: (v: string) => <span className="font-mono font-semibold text-blue-700">{v}</span> },
                { key: 'sName', label: 'Description', render: (v: string) => <span className="text-slate-700">{v}</span> },
                { key: 'dYTDUntSld', label: 'YTD Units', render: (v: number, _: any, row: any) => <span className="font-mono font-bold text-slate-800">{v.toLocaleString()} {row.sSellUnit}</span> },
                { key: 'dPrUntSld', label: 'Prior Yr Units', render: (v: number) => <span className="font-mono text-slate-500">{v.toLocaleString()}</span> },
                { key: 'units_yoy_pct', label: 'Units YoY', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(v)}</span> },
                { key: 'dYTDAmtSld', label: 'YTD Revenue', render: (v: number) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v)}</span> },
                { key: 'dYTDCOGS', label: 'YTD COGS', render: (v: number) => <span className="font-mono text-slate-600">{fmtFull(v)}</span> },
                { key: 'estimated_margin_pct', label: 'Est. Margin', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : v >= 30 ? 'text-emerald-600' : v >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{v != null ? `${v.toFixed(1)}%` : '—'}</span> },
                { key: 'dtLastSold', label: 'Last Sold' },
              ]}
            />
          )}
        </div>
      )}

      {activeTab === 'revenue' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-base font-bold text-slate-700">Monthly Revenue</h3>
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(Number(e.target.value)); setMonthlyRevenue(null); }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {!monthlyRevenue ? <p className="text-slate-400 text-sm py-4">Loading…</p> : (
            <div>
              <div className="mb-4 text-sm text-slate-600">
                Total {monthlyRevenue.year}: <span className="font-bold text-emerald-700">{fmtFull(monthlyRevenue.total_revenue)}</span>
              </div>
              {/* Bar chart using CSS */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-end gap-1.5 h-48">
                  {(() => {
                    const maxRev = Math.max(...(monthlyRevenue.months || []).map((m: any) => m.revenue || 0), 1);
                    return (monthlyRevenue.months || []).map((m: any) => {
                      const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
                      const isCurrentMonth = m.month === new Date().getMonth() + 1 && monthlyRevenue.year === new Date().getFullYear();
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
                          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                            {m.month_name}: {fmtFull(m.revenue)}<br/>{m.order_count} txns
                          </div>
                          <div className="w-full flex items-end" style={{ height: '160px' }}>
                            <div
                              className={`w-full rounded-t-md transition-all ${isCurrentMonth ? 'bg-amber-500' : m.revenue > 0 ? 'bg-blue-500 hover:bg-blue-400' : 'bg-slate-200'}`}
                              style={{ height: `${pct}%`, minHeight: m.revenue > 0 ? '4px' : '2px' }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 truncate w-full text-center">{m.month_name}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              {/* Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Month', 'Revenue', 'Transactions'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(monthlyRevenue.months || []).map((m: any) => (
                      <tr key={m.month} className={`border-t border-slate-100 ${m.revenue > 0 ? 'hover:bg-amber-50/30' : ''}`}>
                        <td className="px-3 py-2 font-semibold text-slate-700">{m.month_name} {monthlyRevenue.year}</td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-700">{m.revenue > 0 ? fmtFull(m.revenue) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-slate-600">{m.order_count > 0 ? m.order_count : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ar-aging' && (
        <div>
          <h3 className="text-base font-bold text-slate-700 mb-1">AR Aging</h3>
          {!arAging ? <p className="text-slate-400 text-sm py-4">Loading…</p> : (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Total AR: <span className="font-bold text-slate-800">{fmtFull(arAging.total_ar)}</span> across {arAging.total_customers} customers
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Customer', 'Current (0-30)', '31-60 Days', '61-90 Days', '91-120 Days', '120+ Days', 'Total'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(arAging.aging || []).map((row: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-800">{row.sName}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{row.current ? fmtFull(row.current) : '—'}</td>
                        <td className="px-3 py-2 font-mono text-amber-700">{row.d30 ? fmtFull(row.d30) : '—'}</td>
                        <td className="px-3 py-2 font-mono text-orange-700">{row.d60 ? fmtFull(row.d60) : '—'}</td>
                        <td className="px-3 py-2 font-mono text-red-600">{row.d90 ? fmtFull(row.d90) : '—'}</td>
                        <td className="px-3 py-2 font-mono text-red-700 font-bold">{row.d90plus ? fmtFull(row.d90plus) : '—'}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-800">{fmtFull(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div>
          <h3 className="text-base font-bold text-slate-700 mb-3">Sales by Product — from Invoiced Transaction Lines</h3>
          {salesByProduct.length === 0 ? <p className="text-slate-400 text-sm py-4">Loading…</p> : (
            <AnalyticsTable
              data={salesByProduct}
              columns={[
                { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
                { key: 'sPartCode', label: 'Part Code', render: (v: string) => <span className="font-mono font-semibold text-blue-700">{v}</span> },
                { key: 'sName', label: 'Description', render: (v: string) => <span className="text-slate-700">{v}</span> },
                { key: 'total_revenue', label: 'Revenue', render: (v: number) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v)}</span> },
                { key: 'total_qty', label: 'Qty Sold', render: (v: number) => <span className="font-mono">{v.toLocaleString()}</span> },
                { key: 'total_cogs', label: 'COGS', render: (v: number) => <span className="font-mono text-slate-600">{fmtFull(v)}</span> },
                { key: 'estimated_margin_pct', label: 'Est. Margin', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : v >= 30 ? 'text-emerald-600' : v >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{v != null ? `${v.toFixed(1)}%` : '—'}</span> },
                { key: 'txn_count', label: 'Transactions' },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
};

// Shared analytics table component
const AnalyticsTable: React.FC<{
  data: any[];
  columns: { key: string; label: string; render?: (v: any, i?: number, row?: any) => React.ReactNode }[];
}> = ({ data, columns }) => {
  if (!data.length) return <p className="text-slate-400 text-sm py-4">No data</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map(c => (
              <th key={c.key} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-amber-50/20">
              {columns.map(c => (
                <td key={c.key} className="px-3 py-2 text-slate-700 max-w-[200px] truncate whitespace-nowrap">
                  {c.render ? c.render(row[c.key], i, row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


// ============================================================
// ITEM MAPPING (MiSys ↔ Sage — 100% manual confirmation)
// ============================================================
const ItemMappingSection: React.FC<{ data?: any }> = ({ data }) => {
  const [mappings, setMappings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'suggested' | 'unmatched' | 'rejected'>('suggested');
  const [search, setSearch] = useState('');
  const [sageSuggestion, setSageSuggestion] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    const r = await apiGet('/api/sage/item-mapping');
    setMappings(r.data?.mappings || []);
    setStats(r.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  const runSuggest = async () => {
    setSuggesting(true);
    setMsg(null);
    const r = await apiPost('/api/sage/item-mapping/suggest', {});
    if (r.data?.error) {
      setMsg({ type: 'err', text: r.data.error });
    } else {
      setMsg({ type: 'ok', text: `Suggestions generated: ${r.data?.stats?.exact_matches ?? 0} exact, ${r.data?.stats?.fuzzy_suggestions ?? 0} fuzzy, ${r.data?.stats?.unmatched ?? 0} unmatched` });
      await loadMappings();
    }
    setSuggesting(false);
  };

  const bulkConfirmExact = async () => {
    setBulkConfirming(true);
    setMsg(null);
    const r = await apiPost('/api/sage/item-mapping/bulk-confirm-exact', {});
    setMsg({ type: 'ok', text: `${r.data?.confirmed_count ?? 0} exact matches confirmed` });
    await loadMappings();
    setBulkConfirming(false);
  };

  const confirmMapping = async (misysId: string, sageCode: string) => {
    setActionLoading(misysId);
    const r = await apiPost('/api/sage/item-mapping/confirm', { misys_item_id: misysId, sage_part_code: sageCode });
    if (r.data?.error) setMsg({ type: 'err', text: r.data.error });
    else setMsg({ type: 'ok', text: `Confirmed: ${misysId} → ${sageCode}` });
    await loadMappings();
    setActionLoading(null);
  };

  const rejectMapping = async (misysId: string) => {
    setActionLoading(misysId);
    await apiPost('/api/sage/item-mapping/reject', { misys_item_id: misysId });
    setMsg({ type: 'ok', text: `Rejected mapping for ${misysId}` });
    await loadMappings();
    setActionLoading(null);
  };

  const filtered = mappings.filter(m => {
    const matchFilter =
      filter === 'all' ||
      (filter === 'confirmed' && m.confirmed) ||
      (filter === 'suggested' && !m.confirmed && m.sage_part_code && m.confidence !== 'rejected') ||
      (filter === 'unmatched' && !m.sage_part_code && m.confidence !== 'rejected') ||
      (filter === 'rejected' && m.confidence === 'rejected');
    if (!matchFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.misys_item_id || '').toLowerCase().includes(q) ||
      (m.misys_description || '').toLowerCase().includes(q) ||
      (m.sage_part_code || '').toLowerCase().includes(q) ||
      (m.sage_description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Item Mapping</h2>
          <p className="text-xs text-slate-500">Link MiSys items to Sage part codes. Every match requires manual confirmation for 100% accuracy.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={runSuggest} disabled={suggesting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
            {suggesting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            {suggesting ? 'Generating…' : '🔍 Generate Suggestions'}
          </button>
          <button onClick={bulkConfirmExact} disabled={bulkConfirming || !stats?.confirmed_count !== undefined}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
            {bulkConfirming && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            ✓ Bulk Confirm Exact Matches
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-3 text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Items', value: stats.total, color: 'slate' },
            { label: 'Confirmed', value: stats.confirmed_count, color: 'emerald' },
            { label: 'Needs Review', value: stats.suggested_count, color: 'amber' },
            { label: 'Unmatched', value: stats.unmatched_count, color: 'red' },
          ].map(s => (
            <div key={s.label} className={`p-3 rounded-xl border ${s.color === 'emerald' ? 'bg-emerald-50 border-emerald-200' : s.color === 'amber' ? 'bg-amber-50 border-amber-200' : s.color === 'red' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color === 'emerald' ? 'text-emerald-700' : s.color === 'amber' ? 'text-amber-700' : s.color === 'red' ? 'text-red-700' : 'text-slate-700'}`}>{s.value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {(['all', 'confirmed', 'suggested', 'unmatched', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f
                ? f === 'confirmed' ? 'bg-emerald-600 text-white'
                  : f === 'suggested' ? 'bg-amber-500 text-white'
                  : f === 'unmatched' ? 'bg-red-500 text-white'
                  : f === 'rejected' ? 'bg-slate-500 text-white'
                  : 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search MiSys ID, description, Sage code…"
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        <span className="text-xs text-slate-400">{filtered.length} items</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-slate-500 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Loading mappings…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {mappings.length === 0 ? (
            <div>
              <p className="text-base font-medium text-slate-600 mb-2">No mappings yet</p>
              <p className="text-sm mb-4">Click "Generate Suggestions" to run the matching algorithm against your MiSys items and Sage inventory.</p>
            </div>
          ) : <p>No items match the current filter.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">MiSys Item ID</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">MiSys Description</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Sage Part Code</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Sage Description</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Confidence</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Score</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((m: any) => {
                const isLoading = actionLoading === m.misys_item_id;
                return (
                  <tr key={m.misys_item_id} className={`border-t border-slate-100 ${m.confirmed ? 'bg-emerald-50/30' : m.confidence === 'rejected' ? 'bg-slate-50 opacity-60' : m.sage_part_code ? 'bg-amber-50/30' : 'bg-red-50/20'}`}>
                    <td className="px-3 py-2 font-mono text-blue-700 font-semibold text-xs whitespace-nowrap">{m.misys_item_id}</td>
                    <td className="px-3 py-2 text-slate-700 text-xs max-w-[180px] truncate" title={m.misys_description}>{m.misys_description || '—'}</td>
                    <td className="px-3 py-2">
                      {m.confirmed ? (
                        <span className="font-mono font-bold text-emerald-700 text-xs">{m.sage_part_code}</span>
                      ) : m.sage_part_code ? (
                        <input
                          defaultValue={m.sage_part_code}
                          onChange={e => setSageSuggestion(prev => ({ ...prev, [m.misys_item_id]: e.target.value }))}
                          className="font-mono text-xs border border-amber-300 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          title="Edit Sage part code before confirming"
                        />
                      ) : (
                        <input
                          placeholder="Enter Sage code…"
                          onChange={e => setSageSuggestion(prev => ({ ...prev, [m.misys_item_id]: e.target.value }))}
                          className="font-mono text-xs border border-slate-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-teal-400"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs max-w-[160px] truncate">{m.sage_description || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        m.confidence === 'exact' ? 'bg-emerald-100 text-emerald-700' :
                        m.confidence === 'manual' ? 'bg-blue-100 text-blue-700' :
                        m.confidence === 'suggested' ? 'bg-amber-100 text-amber-700' :
                        m.confidence === 'rejected' ? 'bg-slate-200 text-slate-500' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {m.confidence}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">
                      {m.score > 0 ? `${Math.round(m.score * 100)}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {m.confirmed ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">✓ Confirmed</span>
                      ) : m.confidence === 'rejected' ? (
                        <span className="text-[10px] text-slate-400">Rejected</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">⚠ Needs review</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!m.confirmed && m.confidence !== 'rejected' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => confirmMapping(m.misys_item_id, sageSuggestion[m.misys_item_id] ?? m.sage_part_code ?? '')}
                            disabled={isLoading || !(sageSuggestion[m.misys_item_id] ?? m.sage_part_code)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-40 whitespace-nowrap"
                          >
                            {isLoading ? '…' : '✓ Confirm'}
                          </button>
                          <button
                            onClick={() => rejectMapping(m.misys_item_id)}
                            disabled={isLoading}
                            className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[11px] font-bold hover:bg-slate-300 disabled:opacity-40"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {m.confirmed && (
                        <button
                          onClick={() => rejectMapping(m.misys_item_id)}
                          disabled={isLoading}
                          className="px-2 py-1 text-red-600 border border-red-200 rounded text-[11px] font-bold hover:bg-red-50 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p className="text-xs text-slate-400 text-center py-2 bg-slate-50 border-t border-slate-100">
              Showing 100 of {filtered.length}. Refine your search to see more.
            </p>
          )}
        </div>
      )}

      {stats?.last_run && (
        <p className="mt-3 text-xs text-slate-400">Last suggestion run: {stats.last_run}</p>
      )}
    </div>
  );
};


// ============================================================
// SAGE BROWSER (all data READ-ONLY from Sage)
// Plan 4.1: search, detail views, linked orders, sub-tabs
// ============================================================
type SageTab = 'customers' | 'vendors' | 'inventory' | 'accounts' | 'orders' | 'receipts';

const SAGE_ENDPOINTS: Record<SageTab, string> = {
  customers: '/api/sage/customers',
  vendors: '/api/sage/vendors',
  inventory: '/api/sage/inventory',
  accounts: '/api/sage/accounts',
  orders: '/api/sage/sales-orders',
  receipts: '/api/sage/receipts',
};

const SAGE_COLUMNS: Record<SageTab, string[]> = {
  customers: ['name', 'sName', 'city', 'phone', 'ytd_sales', 'dAmtYtd', 'credit_limit', 'dCrLimit'],
  vendors: ['name', 'sName', 'city', 'phone', 'ytd_purchases', 'dAmtYtd'],
  inventory: ['part_code', 'sPartCode', 'description', 'sDesc', 'in_stock', 'dInStock', 'last_cost', 'dLastCost'],
  accounts: ['name', 'sName', 'type', 'nAcctType', 'balance', 'dYts'],
  orders: ['order_no', 'sOrderNum', 'customer', 'sName', 'total', 'dTotal', 'date', 'dtOrderDate'],
  receipts: ['id', 'lId', 'type', 'nType', 'amount', 'dTotal', 'date', 'dtDate'],
};

const SAGE_SEARCH_FIELDS: Record<SageTab, string[]> = {
  customers: ['name', 'sName', 'city', 'phone', 'email'],
  vendors: ['name', 'sName', 'city', 'phone'],
  inventory: ['part_code', 'sPartCode', 'description', 'sDesc'],
  accounts: ['name', 'sName', 'number', 'sAcctNum'],
  orders: ['order_no', 'sOrderNum', 'customer', 'sName'],
  receipts: ['id', 'lId'],
};

const SAGE_TAB_COUNTS: Record<SageTab, string> = {
  customers: '353',
  vendors: '478',
  inventory: '616',
  accounts: '278',
  orders: '4,734',
  receipts: '5,433',
};

const SageBrowserSection: React.FC = () => {
  const [tab, setTab] = useState<SageTab>('customers');
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    setSelectedRow(null);
    setSearch('');
    apiGet(SAGE_ENDPOINTS[tab]).then(r => {
      const d = r.data;
      const arr = Array.isArray(d) ? d : d?.data || d?.items || d?.customers || d?.vendors || d?.inventory || d?.accounts || d?.orders || d?.receipts || [];
      setRawData(arr);
      setLoading(false);
    });
  }, [tab]);

  const filtered = search.trim()
    ? rawData.filter(row => {
        const q = search.toLowerCase();
        return SAGE_SEARCH_FIELDS[tab].some(f => {
          const v = row[f];
          return v && String(v).toLowerCase().includes(q);
        });
      })
    : rawData;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Sage 50 Browser</h2>
      <p className="text-xs text-amber-600 font-medium mb-4">
        READ-ONLY — All data displayed from Sage 50 Quantum Accounting on 192.168.1.11
      </p>

      {/* Sub-tabs with record counts */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(SAGE_ENDPOINTS) as SageTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
              tab === t ? 'bg-orange-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {t} <span className="text-xs opacity-70">({SAGE_TAB_COUNTS[t]})</span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setSelectedRow(null); }}
          placeholder={`Search ${tab} by name, code, or ID...`}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Loading from Sage...
        </div>
      ) : selectedRow ? (
        /* Detail View */
        <SageDetailView record={selectedRow} tab={tab} onBack={() => setSelectedRow(null)} />
      ) : (
        <div>
          <p className="mb-2 text-xs text-slate-500">
            {filtered.length} of {rawData.length} records {search && `matching "${search}"`}
          </p>
          <SageDataGrid data={filtered.slice(0, 100)} columns={SAGE_COLUMNS[tab]} onRowClick={setSelectedRow} />
          {filtered.length > 100 && (
            <p className="text-xs text-slate-400 mt-2">Showing first 100 results. Refine your search to see more.</p>
          )}
        </div>
      )}
    </div>
  );
};

const SageDataGrid: React.FC<{ data: any[]; columns: string[]; onRowClick: (row: any) => void }> = ({ data, columns, onRowClick }) => {
  if (!data.length) return <p className="text-slate-400 text-sm py-4">No records found</p>;

  const effectiveCols = columns.filter(c => data.some(r => r[c] !== undefined && r[c] !== null));
  if (!effectiveCols.length) {
    effectiveCols.push(...Object.keys(data[0] || {}).slice(0, 6));
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {effectiveCols.map(c => (
              <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {c.replace(/^[sd](?=[A-Z])/, '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}
              onClick={() => onRowClick(row)}
              className="border-t border-slate-100 hover:bg-orange-50 cursor-pointer transition-colors">
              {effectiveCols.map(c => (
                <td key={c} className="px-3 py-2 text-slate-700 text-xs max-w-[200px] truncate">
                  {formatSageValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SageDetailView: React.FC<{ record: any; tab: SageTab; onBack: () => void }> = ({ record, tab, onBack }) => {
  const title = record.name || record.sName || record.part_code || record.sPartCode || record.order_no || record.sOrderNum || `Record #${record.id || record.lId || '?'}`;

  const importantFields = Object.entries(record).filter(([k, v]) => v !== null && v !== undefined && v !== '');
  const topFields = importantFields.slice(0, 12);
  const restFields = importantFields.slice(12);

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-semibold">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        Back to {tab} list
      </button>

      <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 rounded-t-xl text-white">
        <p className="text-xs font-medium uppercase opacity-80">{tab.slice(0, -1)} detail — READ-ONLY</p>
        <h3 className="text-xl font-bold mt-1">{title}</h3>
      </div>

      <div className="border border-t-0 border-slate-200 rounded-b-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topFields.map(([k, v]) => (
            <div key={k} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 font-medium">
                {k.replace(/^[sd](?=[A-Z])/, '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5 break-words">{formatSageValue(v)}</p>
            </div>
          ))}
        </div>

        {restFields.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 font-medium">
              Show all {importantFields.length} fields
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {restFields.map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium">
                    {k.replace(/^[sd](?=[A-Z])/, '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                  </p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 break-words">{formatSageValue(v)}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

function formatSageValue(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1 && v % 1 !== 0) return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return v.toLocaleString();
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ============================================================
// NOTIFICATIONS
// ============================================================
const NotificationSection: React.FC = () => {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => {
    apiGet('/api/notifications?unread_only=true').then(r => setNotifs(r.data || []));
    apiGet('/api/alert-rules').then(r => setRules(r.data || []));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Notifications & Alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Unread ({notifs.length})</h3>
          {notifs.length === 0 ? <p className="text-slate-500 text-sm">All caught up!</p> :
            notifs.map((n: any) => (
              <div key={n.id} className="p-3 mb-2 bg-yellow-50 rounded-xl border border-yellow-200">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-xs text-slate-600">{n.message}</p>
              </div>
            ))
          }
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Alert Rules ({rules.length})</h3>
          <DataTable data={rules} columns={['id', 'rule_type', 'description', 'is_active']} />
        </div>
      </div>
    </div>
  );
};

// ============================================================
// AUDIT LOG
// ============================================================
const AuditLogSection: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGet('/api/audit-log?limit=50').then(r => {
      const d = r.data;
      setEntries(d?.entries || d || []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Audit Log</h2>
      {loading ? <p className="text-slate-500">Loading...</p> :
        <DataTable data={entries} columns={['ts', 'user_email', 'action', 'entity_type', 'entity_id']} />
      }
    </div>
  );
};

// ============================================================
// ADMIN
// ============================================================
const AdminSection: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [etlStatus, setEtlStatus] = useState<any>(null);

  useEffect(() => {
    apiGet('/api/admin/users').then(r => setUsers(r.data || []));
    apiGet('/api/admin/etl/status').then(r => setEtlStatus(r.data));
  }, []);

  const triggerETL = async () => {
    await apiPost('/api/admin/etl/run');
    setTimeout(() => apiGet('/api/admin/etl/status').then(r => setEtlStatus(r.data)), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Administration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Portal Users</h3>
          <DataTable data={users} columns={['id', 'email', 'display_name', 'role', 'is_active']} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">ETL Status</h3>
          <pre className="text-xs bg-slate-50 p-3 rounded-xl whitespace-pre-wrap">{JSON.stringify(etlStatus, null, 2)}</pre>
          <button onClick={triggerETL} className="mt-3 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold">
            Trigger ETL Run
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

const StatusCard: React.FC<{ title: string; value: string; color: string }> = ({ title, value, color }) => {
  const colorMap: Record<string, string> = {
    green: 'from-green-500 to-emerald-600',
    red: 'from-red-500 to-rose-600',
    blue: 'from-blue-500 to-indigo-600',
    indigo: 'from-indigo-500 to-violet-600',
    amber: 'from-amber-500 to-orange-600',
    orange: 'from-orange-500 to-red-500',
    violet: 'from-violet-500 to-purple-600',
    gray: 'from-slate-500 to-gray-600',
    slate: 'from-slate-500 to-gray-600',
  };
  const bg = colorMap[color] || colorMap['blue'];
  return (
    <div className={`bg-gradient-to-br ${bg} p-4 rounded-xl text-white`}>
      <p className="text-xs font-medium opacity-80">{title}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
};

const DataTable: React.FC<{ data: any[]; columns: string[] }> = ({ data, columns }) => {
  if (!data || data.length === 0) return <p className="text-slate-400 text-sm">No data</p>;

  const effectiveCols = columns.filter(c => data.some(r => r[c] !== undefined && r[c] !== null));
  if (effectiveCols.length === 0) {
    const sampleKeys = Object.keys(data[0] || {}).slice(0, 6);
    effectiveCols.push(...sampleKeys);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            {effectiveCols.map(c => (
              <th key={c} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">{c.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-blue-50/30">
              {effectiveCols.map(c => (
                <td key={c} className="px-3 py-2 text-slate-700 text-xs max-w-[200px] truncate">
                  {typeof row[c] === 'boolean' ? (row[c] ? 'Yes' : 'No') :
                   typeof row[c] === 'object' ? JSON.stringify(row[c]) :
                   String(row[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 50 && <p className="text-xs text-slate-400 mt-2">Showing 50 of {data.length}</p>}
    </div>
  );
};

export default ERPPortal;
