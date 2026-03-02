import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchShipmentsData, Shipment, YEAR_TABS, categorizeStatus, statusPriority } from '../services/shipmentsDataService';
import {
  Search, RefreshCw, Download, Filter, ChevronDown, ChevronUp,
  Truck, Globe, MapPin, CheckCircle, AlertTriangle,
  X, Eye, Clock, Users, FileText, Package, ArrowRight
} from 'lucide-react';

type SortField = keyof Shipment;
type SortDir = 'asc' | 'desc';

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes('shipped') && s.includes('invoiced')) return 'bg-green-50 text-green-700 border border-green-200';
  if (s.includes('shipped')) return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (s.includes('ready')) return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
  if (s.includes('very late')) return 'bg-red-50 text-red-700 border border-red-200';
  if (s.includes('late')) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (s.includes('on schedule')) return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (s.includes('unscheduled')) return 'bg-gray-50 text-gray-600 border border-gray-200';
  return 'bg-gray-50 text-gray-600 border border-gray-200';
}

function getDestBadge(dest: string) {
  const d = dest.toLowerCase();
  if (d.includes('domestic')) return 'bg-sky-50 text-sky-700 border border-sky-200';
  if (d.includes('transborder')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  if (d.includes('international')) return 'bg-violet-50 text-violet-700 border border-violet-200';
  return 'bg-gray-50 text-gray-600 border border-gray-200';
}

export const ShipmentsPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const defaultTab = YEAR_TABS.find(t => t.year === currentYear) || YEAR_TABS[0];

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsSince, setSecondsSince] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [destFilter, setDestFilter] = useState('');
  const [termsFilter, setTermsFilter] = useState('');
  const [custFilter, setCustFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Shipment | null>(null);

  const loadData = useCallback(async (tab = activeTab) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShipmentsData(tab.gid);
      setShipments(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdated) setSecondsSince(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  const switchTab = (tab: typeof YEAR_TABS[0]) => {
    setActiveTab(tab);
    setShipments([]);
    clearFilters();
  };

  useEffect(() => {
    if (shipments.length === 0 && !loading && !error) loadData(activeTab);
  }, [activeTab]);

  const uniqueStatuses = useMemo(() => Array.from(new Set(shipments.map(s => s.status).filter(Boolean))).sort(), [shipments]);
  const uniqueDests = useMemo(() => Array.from(new Set(shipments.map(s => s.destination).filter(Boolean))).sort(), [shipments]);
  const uniqueTerms = useMemo(() => Array.from(new Set(shipments.map(s => s.shipping_terms).filter(Boolean))).sort(), [shipments]);
  const uniqueCustomers = useMemo(() => {
    const m = new Map<string, number>();
    shipments.forEach(s => { if (s.customer) m.set(s.customer, (m.get(s.customer) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [shipments]);

  const filtered = useMemo(() => {
    let r = [...shipments];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(s => s.so_number.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q) || s.invoice_number.toLowerCase().includes(q) || s.notes.toLowerCase().includes(q) || s.invoice_qty.toLowerCase().includes(q));
    }
    if (statusFilter) {
      const sf = statusFilter.toLowerCase();
      r = r.filter(s => s.status.toLowerCase().includes(sf) || s.status === statusFilter);
    }
    if (destFilter) r = r.filter(s => s.destination === destFilter);
    if (termsFilter) r = r.filter(s => s.shipping_terms === termsFilter);
    if (custFilter) r = r.filter(s => s.customer === custFilter);
    r.sort((a, b) => {
      if (sortField === 'status') {
        const pa = statusPriority(a.status);
        const pb = statusPriority(b.status);
        if (pa !== pb) return sortDir === 'asc' ? pa - pb : pb - pa;
        return b.so_number.localeCompare(a.so_number, undefined, { numeric: true });
      }
      const cmp = String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [shipments, search, statusFilter, destFilter, termsFilter, custFilter, sortField, sortDir]);

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const cats = { shipped: 0, ready: 0, scheduled: 0, late: 0, unscheduled: 0, other: 0 };
    shipments.forEach(s => { cats[categorizeStatus(s.status)]++; });
    return cats;
  }, [shipments]);

  const destBreakdown = useMemo(() => {
    const d = { domestic: 0, transborder: 0, international: 0 };
    shipments.forEach(s => {
      const dest = s.destination.toLowerCase();
      if (dest.includes('domestic')) d.domestic++;
      else if (dest.includes('transborder')) d.transborder++;
      else if (dest.includes('international')) d.international++;
    });
    return d;
  }, [shipments]);

  // Active/pending shipments (not yet shipped & invoiced)
  const pendingShipments = useMemo(() => {
    return shipments.filter(s => {
      const cat = categorizeStatus(s.status);
      return cat !== 'shipped';
    });
  }, [shipments]);

  const lateShipments = useMemo(() => shipments.filter(s => categorizeStatus(s.status) === 'late'), [shipments]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const hasFilters = !!(statusFilter || destFilter || termsFilter || custFilter || search.trim());
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setDestFilter(''); setTermsFilter(''); setCustFilter(''); };

  const exportCSV = () => {
    const h = ['SO','Customer','Status','Terms','Destination','Qty','Freight Rate','Customs Duty','Order Completion','Scheduled Pickup','Days Left','Actual Pickup','Invoice Date','Invoice #','Notes'];
    const rows = [h.join(','), ...filtered.map(s => [
      s.so_number, `"${s.customer}"`, `"${s.status}"`, s.shipping_terms, s.destination,
      `"${s.invoice_qty}"`, s.freight_rate, s.customs_duty, s.order_completion, s.scheduled_pickup,
      s.days_left ?? '', s.actual_pickup, s.invoice_date, s.invoice_number, `"${s.notes}"`
    ].join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `canoil_shipments_${activeTab.year}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading && !shipments.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Truck className="w-16 h-16 text-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-slate-700 text-xl font-medium">Loading {activeTab.year} Shipments...</p>
          <p className="text-slate-400 text-sm mt-2">Fetching live data from Canoil Central</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ── Header ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Truck className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Shipments</h1>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500">
                  {filtered.length === shipments.length
                    ? <><span className="text-slate-800 font-semibold">{shipments.length}</span> shipments in {activeTab.year}</>
                    : <><span className="text-slate-800 font-semibold">{filtered.length}</span> of {shipments.length} shipments</>}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-green-600 text-xs font-medium">LIVE</span>
                  <span className="text-slate-400 text-xs">
                    {loading ? 'Syncing...' : secondsSince < 3 ? 'Just updated' : `${secondsSince}s ago`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Year Tabs */}
            <div className="flex bg-gray-100 rounded-lg border border-gray-200 p-0.5">
              {YEAR_TABS.map(tab => (
                <button
                  key={tab.year}
                  onClick={() => switchTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab.year === tab.year
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.year}
                </button>
              ))}
            </div>
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button onClick={() => loadData()} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg" title="Refresh now">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Overview Cards ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="grid grid-cols-7 gap-3">
          <StatCard label="Total" value={shipments.length} icon={<Package className="w-4 h-4" />} color="text-slate-700" />
          <StatCard label="Shipped & Invoiced" value={statusBreakdown.shipped} icon={<CheckCircle className="w-4 h-4" />} color="text-green-600" />
          <StatCard
            label="Pending / Active"
            value={pendingShipments.length}
            icon={<Clock className="w-4 h-4" />}
            color="text-amber-600"
            highlight={pendingShipments.length > 0}
          />
          <StatCard label="Late" value={lateShipments.length} icon={<AlertTriangle className="w-4 h-4" />} color="text-red-600" highlight={lateShipments.length > 0} />
          <StatCard label="Domestic" value={destBreakdown.domestic} icon={<MapPin className="w-4 h-4" />} color="text-sky-600" />
          <StatCard label="Transborder" value={destBreakdown.transborder} icon={<Truck className="w-4 h-4" />} color="text-orange-600" />
          <StatCard label="International" value={destBreakdown.international} icon={<Globe className="w-4 h-4" />} color="text-violet-600" />
        </div>
      </div>

      {/* ── Pending/Active Section (only if there are pending items) ─── */}
      {pendingShipments.length > 0 && !hasFilters && (
        <div className="px-6 pt-5 pb-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-bold text-amber-800">Requires Attention ({pendingShipments.length})</h2>
              </div>
              <button
                onClick={() => setStatusFilter(pendingShipments[0]?.status || '')}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
              >
                Filter to these <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-amber-200/60">
                    <th className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase">SO #</th>
                    <th className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Customer</th>
                    <th className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Status</th>
                    <th className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Destination</th>
                    <th className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Qty</th>
                    <th className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Scheduled</th>
                    <th className="px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Days Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {pendingShipments.slice(0, 10).map((s, i) => (
                    <tr key={`pending-${i}`} className="hover:bg-amber-100/50 cursor-pointer" onClick={() => setSelected(s)}>
                      <td className="px-3 py-2 text-sm font-mono font-semibold text-blue-600">{s.so_number}</td>
                      <td className="px-3 py-2 text-sm text-slate-800 truncate max-w-[200px]">{s.customer}</td>
                      <td className="px-3 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getStatusBadge(s.status)}`}>{s.status}</span></td>
                      <td className="px-3 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getDestBadge(s.destination)}`}>{s.destination}</span></td>
                      <td className="px-3 py-2 text-sm text-slate-700">{s.invoice_qty}</td>
                      <td className="px-3 py-2 text-sm text-slate-500">{s.scheduled_pickup || '--'}</td>
                      <td className="px-3 py-2">
                        {s.days_left !== null ? (
                          <span className={`text-sm font-bold font-mono ${s.days_left < 0 ? 'text-red-600' : s.days_left <= 3 ? 'text-amber-600' : 'text-green-600'}`}>{s.days_left}</span>
                        ) : <span className="text-sm text-slate-400">--</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingShipments.length > 10 && (
                <p className="text-xs text-amber-600 mt-2 px-3">+ {pendingShipments.length - 10} more pending shipments</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Status Filters ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: '', label: 'All', color: 'bg-gray-100 text-slate-700 border-gray-300' },
            { value: 'Late', label: 'Late / Overdue', color: 'bg-red-50 text-red-700 border-red-200' },
            { value: 'Unscheduled', label: 'Unscheduled', color: 'bg-orange-50 text-orange-700 border-orange-200' },
            { value: 'Ready', label: 'Ready to Ship', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { value: 'On Schedule', label: 'On Schedule', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { value: 'Shipped', label: 'Shipped / Invoiced', color: 'bg-slate-50 text-slate-600 border-slate-200' },
          ].map(btn => {
            const isActive = statusFilter.toLowerCase().includes(btn.value.toLowerCase()) || (btn.value === '' && !statusFilter);
            const count = btn.value === ''
              ? shipments.length
              : shipments.filter(s => s.status.toLowerCase().includes(btn.value.toLowerCase())).length;
            return (
              <button
                key={btn.value}
                onClick={() => setStatusFilter(btn.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  isActive
                    ? btn.color + ' ring-2 ring-offset-1 ring-blue-400'
                    : 'bg-white text-slate-500 border-gray-200 hover:border-gray-300 hover:text-slate-700'
                }`}
              >
                {btn.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/60' : 'bg-gray-100'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filters ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search SO, customer, invoice..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 text-sm w-64 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={destFilter} onChange={e => setDestFilter(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm">
              <option value="">All destinations</option>
              {uniqueDests.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={termsFilter} onChange={e => setTermsFilter(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm">
              <option value="">All terms</option>
              {uniqueTerms.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={custFilter} onChange={e => setCustFilter(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm max-w-[180px]">
              <option value="">All customers</option>
              {uniqueCustomers.map(c => <option key={c} value={c}>{c.length > 22 ? c.slice(0, 22) + '\u2026' : c}</option>)}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="px-2 py-1 text-slate-400 hover:text-slate-700 text-sm">Clear</button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Main Table ─── */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Filter className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium text-slate-700">No shipments match</p>
            <p className="text-sm mt-1">Try changing your filters or search query.</p>
            {hasFilters && <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg text-sm">Clear filters</button>}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <TH field="so_number" label="SO #" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="customer" label="Customer" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="status" label="Status" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="shipping_terms" label="Terms" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="destination" label="Destination" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="invoice_qty" label="Quantity" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="order_completion" label="Completed" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="scheduled_pickup" label="Scheduled" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="actual_pickup" label="Picked Up" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <TH field="invoice_number" label="Invoice" cur={sortField} dir={sortDir} onSort={toggleSort} />
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const prevStatus = i > 0 ? filtered[i - 1].status : null;
                    const showGroupHeader = sortField === 'status' && s.status !== prevStatus;
                    const groupCount = showGroupHeader ? filtered.filter(x => x.status === s.status).length : 0;
                    return (
                      <React.Fragment key={`${s.so_number}-${i}`}>
                        {showGroupHeader && (
                          <tr className="bg-gray-50 border-y border-gray-200">
                            <td colSpan={11} className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getStatusBadge(s.status)}`}>{s.status}</span>
                                <span className="text-xs text-slate-500 font-medium">{groupCount} shipment{groupCount !== 1 ? 's' : ''}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr onClick={() => setSelected(s)} className="hover:bg-blue-50/50 transition-colors cursor-pointer group border-b border-gray-100">
                          <td className="px-4 py-3"><span className="text-sm font-semibold text-blue-600 font-mono">{s.so_number}</span></td>
                          <td className="px-4 py-3"><span className="text-sm text-slate-800 block truncate max-w-[220px]" title={s.customer}>{s.customer || <span className="text-slate-400 italic">--</span>}</span></td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getStatusBadge(s.status)}`}>{s.status}</span></td>
                          <td className="px-4 py-3"><span className="text-sm text-slate-600">{s.shipping_terms}</span></td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getDestBadge(s.destination)}`}>{s.destination}</span></td>
                          <td className="px-4 py-3"><span className="text-sm text-slate-700">{s.invoice_qty}</span></td>
                          <td className="px-4 py-3"><span className="text-sm text-slate-500">{s.order_completion || '--'}</span></td>
                          <td className="px-4 py-3"><span className="text-sm text-slate-500">{s.scheduled_pickup || '--'}</span></td>
                          <td className="px-4 py-3"><span className="text-sm text-slate-500">{s.actual_pickup && s.actual_pickup.toLowerCase() !== 'leave empty' ? s.actual_pickup : '--'}</span></td>
                          <td className="px-4 py-3">
                            {s.invoice_number ? (
                              <div><span className="text-sm font-mono font-medium text-slate-800">#{s.invoice_number}</span>{s.invoice_date && <p className="text-xs text-slate-400 mt-0.5">{s.invoice_date}</p>}</div>
                            ) : <span className="text-sm text-slate-400">--</span>}
                          </td>
                          <td className="px-3 py-3">
                            <button onClick={e => { e.stopPropagation(); setSelected(s); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100">
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Side Panel ─── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto border-l border-gray-200 animate-slide-in">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-800">SO {selected.so_number}</h2>
                  <p className="text-sm text-slate-500 truncate">{selected.customer}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100 text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(selected.status)}`}>{selected.status}</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getDestBadge(selected.destination)}`}>{selected.destination}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Shipping Terms" value={selected.shipping_terms} />
                <Field label="Sales Location" value={selected.sales_location} />
                <Field label="Invoice Qty" value={selected.invoice_qty} />
                <Field label="Freight Rate" value={selected.freight_rate} />
                <Field label="Customs Duty" value={selected.customs_duty} />
                <Field label="Invoice #" value={selected.invoice_number} mono />
              </div>
              <hr className="border-gray-200" />
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
                <div className="space-y-2">
                  <DateRow label="Order Completion" value={selected.order_completion} />
                  <DateRow label="Scheduled Pickup" value={selected.scheduled_pickup} />
                  <DateRow label="Actual Pickup" value={selected.actual_pickup} />
                  <DateRow label="Invoice Date" value={selected.invoice_date} />
                </div>
                {selected.days_left !== null && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Days Left</span>
                    <span className={`text-sm font-bold font-mono ml-auto ${(selected.days_left ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{selected.days_left}</span>
                  </div>
                )}
              </div>
              {selected.notes && (
                <>
                  <hr className="border-gray-200" />
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h3>
                    <p className="text-sm text-slate-700 bg-gray-50 rounded-lg p-3 border border-gray-200 leading-relaxed">{selected.notes}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
      `}</style>
    </div>
  );
};

function StatCard({ label, value, icon, color, highlight }: { label: string; value: number; icon: React.ReactNode; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={color}>{icon}</span>
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TH({ field, label, cur, dir, onSort }: { field: SortField; label: string; cur: SortField; dir: SortDir; onSort: (f: SortField) => void }) {
  const active = cur === field;
  return (
    <th onClick={() => onSort(field)} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
      <div className="flex items-center gap-1">{label}{active && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
    </th>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm ${value ? 'text-slate-800' : 'text-slate-400'} ${mono ? 'font-mono' : ''}`}>{value || '--'}</p>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  const hasVal = !!value && value.toLowerCase() !== 'leave empty';
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${hasVal ? 'text-slate-800' : 'text-slate-400'}`}>{hasVal ? value : '--'}</span>
    </div>
  );
}

export default ShipmentsPage;
