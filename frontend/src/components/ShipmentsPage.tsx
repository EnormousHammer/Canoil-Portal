import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchShipmentsData, Shipment, getShipmentStatusBadge, getDestinationBadge } from '../services/shipmentsDataService';
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
  Eye
} from 'lucide-react';

type SortField = 'so_number' | 'customer' | 'status' | 'destination' | 'shipping_terms' | 'scheduled_pickup' | 'actual_pickup' | 'invoice_date';
type SortDirection = 'asc' | 'desc';

export const ShipmentsPage: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [shippingTermsFilter, setShippingTermsFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  const [sortField, setSortField] = useState<SortField>('so_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShipmentsData();
      setShipments(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load shipments data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(shipments.map(s => s.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [shipments]);

  const uniqueDestinations = useMemo(() => {
    const destinations = new Set(shipments.map(s => s.destination).filter(Boolean));
    return Array.from(destinations).sort();
  }, [shipments]);

  const uniqueShippingTerms = useMemo(() => {
    const terms = new Set(shipments.map(s => s.shipping_terms).filter(Boolean));
    return Array.from(terms).sort();
  }, [shipments]);

  const uniqueCustomers = useMemo(() => {
    const customers = new Set(shipments.map(s => s.customer).filter(Boolean));
    return Array.from(customers).sort();
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    let result = [...shipments];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.so_number.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q) ||
        s.invoice_number.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q) ||
        s.invoice_qty.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    if (destinationFilter !== 'all') {
      result = result.filter(s => s.destination === destinationFilter);
    }
    if (shippingTermsFilter !== 'all') {
      result = result.filter(s => s.shipping_terms === shippingTermsFilter);
    }
    if (customerFilter !== 'all') {
      result = result.filter(s => s.customer === customerFilter);
    }

    result.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal.localeCompare(bVal, undefined, { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [shipments, searchQuery, statusFilter, destinationFilter, shippingTermsFilter, customerFilter, sortField, sortDirection]);

  const summaryStats = useMemo(() => {
    const total = shipments.length;
    const shipped = shipments.filter(s => s.status.toLowerCase().includes('shipped')).length;
    const domestic = shipments.filter(s => s.destination.toLowerCase().includes('domestic')).length;
    const transborder = shipments.filter(s => s.destination.toLowerCase().includes('transborder')).length;
    const international = shipments.filter(s => s.destination.toLowerCase().includes('international')).length;
    const uniqueCustomerCount = new Set(shipments.map(s => s.customer)).size;
    return { total, shipped, domestic, transborder, international, uniqueCustomerCount };
  }, [shipments]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-cyan-400" />
      : <ChevronDown className="w-3 h-3 text-cyan-400" />;
  };

  const exportCSV = () => {
    const headers = ['SO', 'Sales Location', 'Customer', 'Status', 'Shipping Terms', 'Destination', 'Invoice Qty', 'Freight Rate', 'Customs Duty', 'Order Completion', 'Scheduled Pickup', 'Actual Pickup', 'Invoice Date', 'Invoice #', 'Notes'];
    const csvRows = [headers.join(',')];
    filteredShipments.forEach(s => {
      csvRows.push([
        s.so_number, s.sales_location, `"${s.customer}"`, `"${s.status}"`, s.shipping_terms, s.destination,
        `"${s.invoice_qty}"`, s.freight_rate, s.customs_duty, s.order_completion, s.scheduled_pickup,
        s.actual_pickup, s.invoice_date, s.invoice_number, `"${s.notes}"`
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDestinationFilter('all');
    setShippingTermsFilter('all');
    setCustomerFilter('all');
  };

  const activeFilterCount = [statusFilter, destinationFilter, shippingTermsFilter, customerFilter].filter(f => f !== 'all').length + (searchQuery ? 1 : 0);

  if (loading && shipments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">Loading Shipments...</p>
          <p className="text-slate-400 text-sm mt-1">Fetching data from Google Sheets</p>
        </div>
      </div>
    );
  }

  if (error && shipments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg font-semibold mb-2">Failed to Load Shipments</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Shipments</h1>
                <p className="text-xs text-slate-400">
                  {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'} 
                  {loading && <span className="ml-2 text-cyan-400 animate-pulse">refreshing...</span>}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search SO, customer, invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-64"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-white/20 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Refresh */}
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Export */}
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
                    Clear all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg text-sm text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="all">All Statuses</option>
                    {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Destination</label>
                  <select
                    value={destinationFilter}
                    onChange={(e) => setDestinationFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg text-sm text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="all">All Destinations</option>
                    {uniqueDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Shipping Terms</label>
                  <select
                    value={shippingTermsFilter}
                    onChange={(e) => setShippingTermsFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg text-sm text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="all">All Terms</option>
                    {uniqueShippingTerms.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Customer</label>
                  <select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg text-sm text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="all">All Customers</option>
                    {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-full mx-auto px-4 py-4">
        <div className="grid grid-cols-6 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 font-medium">Total Shipments</span>
            </div>
            <p className="text-2xl font-bold text-white">{summaryStats.total}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400 font-medium">Shipped</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{summaryStats.shipped}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400 font-medium">Domestic</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{summaryStats.domestic}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-slate-400 font-medium">Transborder</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">{summaryStats.transborder}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400 font-medium">International</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{summaryStats.international}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Customers</span>
            </div>
            <p className="text-2xl font-bold text-white">{summaryStats.uniqueCustomerCount}</p>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400">
            Showing <span className="text-white font-semibold">{filteredShipments.length}</span> of {shipments.length} shipments
          </p>
        </div>

        {/* Table */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/50">
                  {[
                    { field: 'so_number' as SortField, label: 'SO #', width: 'w-24' },
                    { field: 'customer' as SortField, label: 'Customer', width: 'w-48' },
                    { field: 'status' as SortField, label: 'Status', width: 'w-40' },
                    { field: 'shipping_terms' as SortField, label: 'Terms', width: 'w-28' },
                    { field: 'destination' as SortField, label: 'Destination', width: 'w-28' },
                    { field: 'so_number' as SortField, label: 'Qty', width: 'w-32' },
                    { field: 'scheduled_pickup' as SortField, label: 'Scheduled', width: 'w-32' },
                    { field: 'actual_pickup' as SortField, label: 'Actual Pickup', width: 'w-32' },
                    { field: 'invoice_date' as SortField, label: 'Invoice', width: 'w-32' },
                  ].map(({ field, label, width }) => (
                    <th
                      key={label}
                      onClick={() => handleSort(field)}
                      className={`${width} px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white group`}
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        <SortIcon field={field} />
                      </div>
                    </th>
                  ))}
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredShipments.map((shipment, idx) => (
                  <tr
                    key={`${shipment.so_number}-${idx}`}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedShipment(shipment)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-mono font-semibold text-cyan-400">{shipment.so_number}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-white truncate block max-w-[200px]" title={shipment.customer}>
                        {shipment.customer}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getShipmentStatusBadge(shipment.status)}`}>
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-300">{shipment.shipping_terms}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getDestinationBadge(shipment.destination)}`}>
                        {shipment.destination}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-300">{shipment.invoice_qty}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-300">{shipment.scheduled_pickup}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-300">{shipment.actual_pickup}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs text-slate-300">{shipment.invoice_date}</div>
                      {shipment.invoice_number && (
                        <div className="text-xs text-slate-500 font-mono">#{shipment.invoice_number}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedShipment(shipment); }}
                        className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredShipments.length === 0 && (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No shipments found</p>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 font-medium">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedShipment(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">SO {selectedShipment.so_number}</h2>
                  <p className="text-sm text-slate-400">{selectedShipment.customer}</p>
                </div>
              </div>
              <button onClick={() => setSelectedShipment(null)} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Status" value={selectedShipment.status} badge={getShipmentStatusBadge(selectedShipment.status)} />
                <DetailField label="Destination" value={selectedShipment.destination} badge={getDestinationBadge(selectedShipment.destination)} />
                <DetailField label="Shipping Terms" value={selectedShipment.shipping_terms} />
                <DetailField label="Sales Location" value={selectedShipment.sales_location} />
                <DetailField label="Invoice Qty" value={selectedShipment.invoice_qty} />
                <DetailField label="Freight Rate" value={selectedShipment.freight_rate} />
                <DetailField label="Customs Duty" value={selectedShipment.customs_duty} />
                <DetailField label="Order Completion" value={selectedShipment.order_completion} />
                <DetailField label="Scheduled Pickup" value={selectedShipment.scheduled_pickup} />
                <DetailField label="Actual Pickup" value={selectedShipment.actual_pickup} />
                <DetailField label="Invoice Date" value={selectedShipment.invoice_date} />
                <DetailField label="Invoice #" value={selectedShipment.invoice_number} />
              </div>
              {selectedShipment.notes && (
                <div>
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Notes</span>
                  <p className="mt-1 text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    {selectedShipment.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function DetailField({ label, value, badge }: { label: string; value: string; badge?: string }) {
  if (!value) return (
    <div>
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
      <p className="text-sm text-slate-600 mt-0.5">--</p>
    </div>
  );
  return (
    <div>
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      {badge ? (
        <p className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${badge}`}>
          {value}
        </p>
      ) : (
        <p className="text-sm text-white mt-0.5">{value}</p>
      )}
    </div>
  );
}

export default ShipmentsPage;
