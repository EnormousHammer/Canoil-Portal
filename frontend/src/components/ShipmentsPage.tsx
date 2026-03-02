import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchShipmentsData, Shipment, getStatusCategory, getDestinationType } from '../services/shipmentsDataService';
import {
  Search,
  RefreshCw,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  Globe,
  MapPin,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  Eye,
  Clock,
  ArrowUpDown,
  Users
} from 'lucide-react';

type SortField = keyof Shipment;
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  'shipped':      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  'ready':        { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    dot: 'bg-cyan-400' },
  'on-schedule':  { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  'late':         { bg: 'bg-amber-500/10',    text: 'text-amber-400',   dot: 'bg-amber-400' },
  'very-late':    { bg: 'bg-red-500/10',      text: 'text-red-400',     dot: 'bg-red-400' },
  'unscheduled':  { bg: 'bg-slate-500/10',    text: 'text-slate-400',   dot: 'bg-slate-400' },
  'other':        { bg: 'bg-slate-500/10',    text: 'text-slate-400',   dot: 'bg-slate-400' },
};

const DEST_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'domestic':      { bg: 'bg-sky-500/8',     text: 'text-sky-300',     border: 'border-sky-500/20',     label: 'Domestic' },
  'transborder':   { bg: 'bg-orange-500/8',  text: 'text-orange-300',  border: 'border-orange-500/20',  label: 'Transborder' },
  'international': { bg: 'bg-violet-500/8',  text: 'text-violet-300',  border: 'border-violet-500/20',  label: 'Intl' },
  'other':         { bg: 'bg-slate-500/8',   text: 'text-slate-400',   border: 'border-slate-500/20',   label: 'Other' },
};

export const ShipmentsPage: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [destFilter, setDestFilter] = useState('all');
  const [termsFilter, setTermsFilter] = useState('all');
  const [custFilter, setCustFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

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

  const uniqueStatuses = useMemo(() => Array.from(new Set(shipments.map(s => s.status).filter(Boolean))).sort(), [shipments]);
  const uniqueDests = useMemo(() => Array.from(new Set(shipments.map(s => s.destination).filter(Boolean))).sort(), [shipments]);
  const uniqueTerms = useMemo(() => Array.from(new Set(shipments.map(s => s.shipping_terms).filter(Boolean))).sort(), [shipments]);
  const uniqueCustomers = useMemo(() => Array.from(new Set(shipments.map(s => s.customer).filter(Boolean))).sort(), [shipments]);

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
    if (statusFilter !== 'all') r = r.filter(s => s.status === statusFilter);
    if (destFilter !== 'all') r = r.filter(s => s.destination === destFilter);
    if (termsFilter !== 'all') r = r.filter(s => s.shipping_terms === termsFilter);
    if (custFilter !== 'all') r = r.filter(s => s.customer === custFilter);

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
    const pending = total - shipped;
    const domestic = shipments.filter(s => getDestinationType(s.destination) === 'domestic').length;
    const transborder = shipments.filter(s => getDestinationType(s.destination) === 'transborder').length;
    const international = shipments.filter(s => getDestinationType(s.destination) === 'international').length;
    const customers = new Set(shipments.map(s => s.customer).filter(Boolean)).size;
    return { total, shipped, pending, domestic, transborder, international, customers };
  }, [shipments]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const activeFilters = [statusFilter, destFilter, termsFilter, custFilter].filter(f => f !== 'all').length + (search ? 1 : 0);

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setDestFilter('all'); setTermsFilter('all'); setCustFilter('all'); };

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

  // Loading state
  if (loading && !shipments.length) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
            <Truck className="absolute inset-0 m-auto w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Loading Shipments</p>
            <p className="text-slate-500 text-sm">Connecting to Canoil Central...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !shipments.length) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="bg-slate-900/80 border border-red-500/20 rounded-2xl p-8 max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-white font-semibold text-lg">Connection Error</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button onClick={loadData} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* ─── Header Bar ─── */}
      <header className="sticky top-0 z-40 bg-[#0B1120]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Truck className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-white leading-tight truncate">Shipments</h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                {lastUpdated && <span>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                {loading && <span className="ml-1.5 text-cyan-400">syncing...</span>}
              </p>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by SO, customer, invoice..."
                className="w-full pl-9 pr-8 py-[7px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.06] transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12px] font-medium transition-all ${
                showFilters || activeFilters
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilters > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-cyan-500 text-[10px] text-white font-bold flex items-center justify-center">{activeFilters}</span>
              )}
            </button>
            <button onClick={loadData} disabled={loading} className="p-[7px] bg-white/[0.04] border border-white/[0.06] text-slate-400 rounded-lg hover:bg-white/[0.06] transition-all" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-[7px] bg-white/[0.04] border border-white/[0.06] text-slate-400 rounded-lg hover:bg-white/[0.06] text-[12px] font-medium transition-all">
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* ─── Filter Row ─── */}
        {showFilters && (
          <div className="px-6 pb-3 pt-0">
            <div className="flex items-center gap-3">
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={uniqueStatuses} />
              <FilterSelect label="Destination" value={destFilter} onChange={setDestFilter} options={uniqueDests} />
              <FilterSelect label="Terms" value={termsFilter} onChange={setTermsFilter} options={uniqueTerms} />
              <FilterSelect label="Customer" value={custFilter} onChange={setCustFilter} options={uniqueCustomers} />
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium whitespace-nowrap ml-auto">Clear all</button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─── KPI Cards ─── */}
      <div className="px-6 pt-4 pb-2">
        <div className="grid grid-cols-7 gap-2.5">
          <KpiCard icon={<Package className="w-4 h-4" />} label="Total" value={stats.total} color="slate" />
          <KpiCard icon={<CheckCircle className="w-4 h-4" />} label="Shipped" value={stats.shipped} color="emerald" />
          <KpiCard icon={<Clock className="w-4 h-4" />} label="Pending" value={stats.pending} color="amber" />
          <KpiCard icon={<MapPin className="w-4 h-4" />} label="Domestic" value={stats.domestic} color="sky" />
          <KpiCard icon={<Truck className="w-4 h-4" />} label="Transborder" value={stats.transborder} color="orange" />
          <KpiCard icon={<Globe className="w-4 h-4" />} label="International" value={stats.international} color="violet" />
          <KpiCard icon={<Users className="w-4 h-4" />} label="Customers" value={stats.customers} color="cyan" />
        </div>
      </div>

      {/* ─── Result count ─── */}
      <div className="px-6 py-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          {filtered.length === shipments.length
            ? <><span className="text-slate-300 font-medium">{shipments.length}</span> shipments</>
            : <><span className="text-slate-300 font-medium">{filtered.length}</span> of {shipments.length} shipments</>}
        </span>
      </div>

      {/* ─── Table ─── */}
      <div className="px-6 pb-6">
        <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#0d1526]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <TH field="so_number" label="SO #" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[90px]" />
                  <TH field="customer" label="Customer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="min-w-[180px]" />
                  <TH field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[170px]" />
                  <TH field="shipping_terms" label="Terms" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[110px]" />
                  <TH field="destination" label="Destination" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[120px]" />
                  <TH field="invoice_qty" label="Quantity" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[120px]" />
                  <TH field="order_completion" label="Completed" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[130px]" />
                  <TH field="scheduled_pickup" label="Scheduled" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[130px]" />
                  <TH field="actual_pickup" label="Picked Up" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[130px]" />
                  <TH field="invoice_number" label="Invoice" sortField={sortField} sortDir={sortDir} onSort={toggleSort} w="w-[130px]" />
                  <th className="w-[40px] px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const sc = STATUS_CONFIG[getStatusCategory(s.status)] || STATUS_CONFIG.other;
                  const dc = DEST_CONFIG[getDestinationType(s.destination)] || DEST_CONFIG.other;
                  return (
                    <tr
                      key={`${s.so_number}-${i}`}
                      onClick={() => setSelected(s)}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-[13px] font-mono font-semibold text-cyan-400">{s.so_number}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[13px] text-slate-200 block truncate max-w-[220px]" title={s.customer}>{s.customer || <span className="text-slate-600 italic">--</span>}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[11px] font-medium ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[12px] text-slate-400">{s.shipping_terms}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-[2px] rounded text-[11px] font-medium border ${dc.bg} ${dc.text} ${dc.border}`}>
                          {s.destination}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[12px] text-slate-300">{s.invoice_qty}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[12px] text-slate-400">{s.order_completion || '--'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[12px] text-slate-400">{s.scheduled_pickup || '--'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[12px] text-slate-400">{s.actual_pickup || '--'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {s.invoice_number ? (
                          <div>
                            <span className="text-[12px] font-mono text-slate-300">#{s.invoice_number}</span>
                            {s.invoice_date && <p className="text-[10px] text-slate-500 mt-0.5">{s.invoice_date}</p>}
                          </div>
                        ) : (
                          <span className="text-[12px] text-slate-600">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Eye className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length && (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No shipments match your criteria</p>
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="mt-2 text-[12px] text-cyan-400 hover:text-cyan-300 font-medium">Clear filters</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Detail Drawer ─── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div
            className="relative w-full max-w-md bg-[#0d1526] border-l border-white/[0.06] shadow-2xl h-full overflow-y-auto animate-slide-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="sticky top-0 bg-[#0d1526]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-white">SO {selected.so_number}</h2>
                  <p className="text-[12px] text-slate-400 truncate">{selected.customer}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="px-5 py-5 space-y-5">
              {/* Status + Destination row */}
              <div className="flex gap-2">
                {(() => {
                  const sc = STATUS_CONFIG[getStatusCategory(selected.status)] || STATUS_CONFIG.other;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {selected.status}
                    </span>
                  );
                })()}
                {(() => {
                  const dc = DEST_CONFIG[getDestinationType(selected.destination)] || DEST_CONFIG.other;
                  return (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[12px] font-medium border ${dc.bg} ${dc.text} ${dc.border}`}>
                      {selected.destination}
                    </span>
                  );
                })()}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Shipping Terms" value={selected.shipping_terms} />
                <Field label="Sales Location" value={selected.sales_location} />
                <Field label="Invoice Qty" value={selected.invoice_qty} />
                <Field label="Freight Rate" value={selected.freight_rate} />
                <Field label="Customs Duty" value={selected.customs_duty} />
                <Field label="Invoice #" value={selected.invoice_number} mono />
              </div>

              <hr className="border-white/[0.06]" />

              {/* Timeline */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Timeline</h3>
                <div className="space-y-2.5">
                  <TimelineItem label="Order Completion" value={selected.order_completion} />
                  <TimelineItem label="Scheduled Pickup" value={selected.scheduled_pickup} />
                  <TimelineItem label="Actual Pickup" value={selected.actual_pickup} />
                  <TimelineItem label="Invoice Date" value={selected.invoice_date} />
                </div>
                {selected.days_left !== null && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[12px] text-slate-400">Days Left:</span>
                    <span className={`text-[13px] font-semibold font-mono ${(selected.days_left ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {selected.days_left}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selected.notes && (
                <>
                  <hr className="border-white/[0.06]" />
                  <div>
                    <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                    <p className="text-[13px] text-slate-300 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
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
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
      `}</style>
    </div>
  );
};

/* ─── Sub-components ─── */

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    slate:   'text-slate-400',
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    sky:     'text-sky-400',
    orange:  'text-orange-400',
    violet:  'text-violet-400',
    cyan:    'text-cyan-400',
  };
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={colors[color] || 'text-slate-400'}>{icon}</span>
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${colors[color] || 'text-slate-400'}`}>{value}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider whitespace-nowrap">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-slate-300 pl-2 pr-6 py-1.5 focus:outline-none focus:border-cyan-500/40 appearance-none cursor-pointer max-w-[160px] truncate"
      >
        <option value="all">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TH({ field, label, sortField, sortDir, onSort, w }: { field: SortField; label: string; sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void; w?: string }) {
  const active = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`${w || ''} px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
        active ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
          : <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />}
      </div>
    </th>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[13px] ${value ? 'text-slate-200' : 'text-slate-600'} ${mono ? 'font-mono' : ''}`}>{value || '--'}</p>
    </div>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  const hasValue = !!value && value.toLowerCase() !== 'leave empty';
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center mt-1">
        <div className={`w-2 h-2 rounded-full ${hasValue ? 'bg-cyan-400' : 'bg-slate-700'}`} />
        <div className="w-px h-4 bg-white/[0.06]" />
      </div>
      <div className="flex-1 -mt-0.5">
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className={`text-[13px] ${hasValue ? 'text-slate-200' : 'text-slate-600'}`}>{hasValue ? value : '--'}</p>
      </div>
    </div>
  );
}

export default ShipmentsPage;
