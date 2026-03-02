import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchShipmentsData, Shipment, getStatusCategory, getDestinationType } from '../services/shipmentsDataService';
import {
  Search, RefreshCw, Download, Filter, ChevronDown, ChevronUp,
  Package, Truck, Globe, MapPin, CheckCircle, AlertTriangle,
  X, Eye, Clock, ArrowUpDown, Users, FileText, ExternalLink
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

  const [sortField, setSortField] = useState<SortField>('so_number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selected, setSelected] = useState<Shipment | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShipmentsData();
      setShipments(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdated) setSecondsSince(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  const uniqueStatuses = useMemo(() => Array.from(new Set(shipments.map(s => s.status).filter(Boolean))).sort(), [shipments]);
  const uniqueDests = useMemo(() => Array.from(new Set(shipments.map(s => s.destination).filter(Boolean))).sort(), [shipments]);
  const uniqueTerms = useMemo(() => Array.from(new Set(shipments.map(s => s.shipping_terms).filter(Boolean))).sort(), [shipments]);
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, number>();
    shipments.forEach(s => { if (s.customer) map.set(s.customer, (map.get(s.customer) || 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [shipments]);

  const filtered = useMemo(() => {
    let r = [...shipments];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(s =>
        s.so_number.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q) ||
        s.invoice_number.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q) ||
        s.invoice_qty.toLowerCase().includes(q)
      );
    }
    if (statusFilter) r = r.filter(s => s.status === statusFilter);
    if (destFilter) r = r.filter(s => s.destination === destFilter);
    if (termsFilter) r = r.filter(s => s.shipping_terms === termsFilter);
    if (custFilter) r = r.filter(s => s.customer === custFilter);

    r.sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [shipments, search, statusFilter, destFilter, termsFilter, custFilter, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = shipments.length;
    const shipped = shipments.filter(s => s.status.toLowerCase().includes('shipped')).length;
    const domestic = shipments.filter(s => getDestinationType(s.destination) === 'domestic').length;
    const transborder = shipments.filter(s => getDestinationType(s.destination) === 'transborder').length;
    const intl = shipments.filter(s => getDestinationType(s.destination) === 'international').length;
    return { total, shipped, domestic, transborder, international: intl };
  }, [shipments]);

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
    a.download = `canoil_shipments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading && !shipments.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Truck className="w-16 h-16 text-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-slate-700 text-xl font-medium">Loading Shipments...</p>
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
                    ? <><span className="text-slate-800 font-semibold">{shipments.length}</span> shipments</>
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
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              title="Refresh now"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI + Filters ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          {/* Quick stats */}
          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm">
              <span className="text-slate-800 font-semibold">{stats.total}</span> total
            </span>
            <span className="text-green-600 text-sm font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {stats.shipped} shipped
            </span>
            <span className="text-sky-600 text-sm flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {stats.domestic} domestic
            </span>
            <span className="text-orange-600 text-sm flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              {stats.transborder} transborder
            </span>
            <span className="text-violet-600 text-sm flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              {stats.international} intl
            </span>
          </div>

          <div className="h-4 w-px bg-gray-300" />

          {/* Search */}
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

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm">
              <option value="">All statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
              <button onClick={clearFilters} className="px-2 py-1 text-slate-400 hover:text-slate-700 text-sm" title="Clear filters">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ─── */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Filter className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium text-slate-700">No shipments match the current filters</p>
            <p className="text-sm mt-1">Try clearing filters or search to see all shipments.</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg text-sm">
                Clear filters
              </button>
            )}
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
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s, i) => (
                    <tr
                      key={`${s.so_number}-${i}`}
                      onClick={() => setSelected(s)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-blue-600 font-mono">{s.so_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-800 block truncate max-w-[220px]" title={s.customer}>
                          {s.customer || <span className="text-slate-400 italic">--</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getStatusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{s.shipping_terms}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getDestBadge(s.destination)}`}>
                          {s.destination}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700">{s.invoice_qty}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">{s.order_completion || '--'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">{s.scheduled_pickup || '--'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">{s.actual_pickup && s.actual_pickup.toLowerCase() !== 'leave empty' ? s.actual_pickup : '--'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.invoice_number ? (
                          <div>
                            <span className="text-sm font-mono font-medium text-slate-800">#{s.invoice_number}</span>
                            {s.invoice_date && <p className="text-xs text-slate-400 mt-0.5">{s.invoice_date}</p>}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(s); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
            {/* Panel header */}
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

            {/* Panel body */}
            <div className="px-5 py-5 space-y-5">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(selected.status)}`}>
                  {selected.status}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getDestBadge(selected.destination)}`}>
                  {selected.destination}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Shipping Terms" value={selected.shipping_terms} />
                <Field label="Sales Location" value={selected.sales_location} />
                <Field label="Invoice Qty" value={selected.invoice_qty} />
                <Field label="Freight Rate" value={selected.freight_rate} />
                <Field label="Customs Duty" value={selected.customs_duty} />
                <Field label="Invoice #" value={selected.invoice_number} mono />
              </div>

              <hr className="border-gray-200" />

              {/* Dates */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
                <div className="space-y-3">
                  <DateRow label="Order Completion" value={selected.order_completion} />
                  <DateRow label="Scheduled Pickup" value={selected.scheduled_pickup} />
                  <DateRow label="Actual Pickup" value={selected.actual_pickup} />
                  <DateRow label="Invoice Date" value={selected.invoice_date} />
                </div>
                {selected.days_left !== null && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Days Left</span>
                    <span className={`text-sm font-bold font-mono ml-auto ${(selected.days_left ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {selected.days_left}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selected.notes && (
                <>
                  <hr className="border-gray-200" />
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h3>
                    <p className="text-sm text-slate-700 bg-gray-50 rounded-lg p-3 border border-gray-200 leading-relaxed">
                      {selected.notes}
                    </p>
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

function TH({ field, label, cur, dir, onSort }: { field: SortField; label: string; cur: SortField; dir: SortDir; onSort: (f: SortField) => void }) {
  const active = cur === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${
        active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <div className="flex items-center gap-1">
        {label}
        {active && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </div>
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
