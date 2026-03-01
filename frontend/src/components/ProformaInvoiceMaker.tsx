import React, { useState, useMemo, useCallback } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import {
  Search, FileText, Download, ChevronDown, ChevronUp, Edit, Check, X,
  Package, User, MapPin, Phone, Mail, Calendar, Truck, DollarSign, Plus, Trash2, AlertTriangle
} from 'lucide-react';

interface ProformaItem {
  product_code: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface ProformaData {
  customer_name: string;
  po_number: string;
  address: string;
  city_state_zip: string;
  country: string;
  phone: string;
  email: string;
  ship_via: string;
  ship_by_date: string;
  invoice_date: string;
  trade_terms: string;
  items: ProformaItem[];
}

interface SOOption {
  so_number: string;
  customer_name: string;
  po_number: string;
  order_date: string;
  ship_date: string;
  items: any[];
  sold_to: any;
  ship_to: any;
  source: string;
}

interface Props {
  data: any;
  onClose?: () => void;
}

function safeParseCurrency(val: any): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[$,US\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export const ProformaInvoiceMaker: React.FC<Props> = ({ data, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSO, setSelectedSO] = useState<SOOption | null>(null);
  const [formData, setFormData] = useState<ProformaData>({
    customer_name: '',
    po_number: '',
    address: '',
    city_state_zip: '',
    country: '',
    phone: '',
    email: '',
    ship_via: '',
    ship_by_date: '',
    invoice_date: new Date().toISOString().split('T')[0],
    trade_terms: 'EXW',
    items: [],
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [expandedSO, setExpandedSO] = useState<string | null>(null);

  const allSalesOrders = useMemo((): SOOption[] => {
    const result: SOOption[] = [];
    const seen = new Set<string>();

    const parsedSOs: any[] = data['ParsedSalesOrders.json'] || [];
    parsedSOs.forEach((so: any) => {
      const soNo = so.so_number || so.order_number || '';
      if (!soNo || seen.has(soNo)) return;
      seen.add(soNo);

      const soldTo = so.sold_to || so.billing_address || {};
      result.push({
        so_number: soNo,
        customer_name: so.customer_name || soldTo.company_name || soldTo.company || '',
        po_number: so.po_number || '',
        order_date: so.order_date || '',
        ship_date: so.ship_date || '',
        items: (so.items || []).map((it: any) => ({
          item_code: it.item_code || it.product_code || '',
          description: it.description || '',
          quantity: safeParseCurrency(it.quantity || it.ordered),
          unit_price: safeParseCurrency(it.unit_price || it.price),
          unit: it.unit || '',
        })),
        sold_to: soldTo,
        ship_to: so.ship_to || so.shipping_address || {},
        source: 'Parsed',
      });
    });

    const salesOrdersByStatus: Record<string, any[]> = data['SalesOrdersByStatus'] || {};
    Object.values(salesOrdersByStatus).forEach((statusSOs: any) => {
      if (!Array.isArray(statusSOs)) return;
      statusSOs.forEach((so: any) => {
        const soNo = so.so_number || so.order_number || so['Sales Order No.'] || so['SO No.'] || '';
        if (!soNo || seen.has(soNo)) return;
        seen.add(soNo);

        const soldTo = so.sold_to || so.billing_address || {};
        result.push({
          so_number: soNo,
          customer_name: so.customer_name || soldTo.company_name || soldTo.company || so['Customer Name'] || '',
          po_number: so.po_number || so['PO No.'] || '',
          order_date: so.order_date || so['Order Date'] || '',
          ship_date: so.ship_date || so['Ship Date'] || '',
          items: (so.items || []).map((it: any) => ({
            item_code: it.item_code || it.product_code || it['Item No.'] || '',
            description: it.description || it['Description'] || '',
            quantity: safeParseCurrency(it.quantity || it.ordered || it['Quantity']),
            unit_price: safeParseCurrency(it.unit_price || it.price || it['Unit Price']),
            unit: it.unit || '',
          })),
          sold_to: soldTo,
          ship_to: so.ship_to || so.shipping_address || {},
          source: 'GDrive',
        });
      });
    });

    result.sort((a, b) => {
      const numA = parseInt(a.so_number.replace(/\D/g, ''));
      const numB = parseInt(b.so_number.replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return b.so_number.localeCompare(a.so_number);
    });

    return result;
  }, [data]);

  const filteredSOs = useMemo(() => {
    if (!searchQuery.trim()) return allSalesOrders;
    const q = searchQuery.toLowerCase();
    return allSalesOrders.filter(
      (so) =>
        so.so_number.toLowerCase().includes(q) ||
        so.customer_name.toLowerCase().includes(q) ||
        so.po_number.toLowerCase().includes(q)
    );
  }, [allSalesOrders, searchQuery]);

  const parseAddress = useCallback((soldTo: any) => {
    if (!soldTo) return { address: '', city_state_zip: '', country: '', phone: '', email: '' };

    const fullAddr = soldTo.full_address || '';
    let address = soldTo.street || soldTo.street_address || soldTo.addr1 || '';
    let cityStateZip = '';
    let country = soldTo.country || '';
    const phone = soldTo.phone || soldTo.telephone || '';
    const email = soldTo.email || '';

    if (fullAddr && !address) {
      const lines = fullAddr.split(/[\n,]+/).map((l: string) => l.trim()).filter(Boolean);
      if (lines.length >= 3) {
        address = lines[0];
        cityStateZip = lines.slice(1, -1).join(', ');
        country = country || lines[lines.length - 1];
      } else if (lines.length === 2) {
        address = lines[0];
        cityStateZip = lines[1];
      } else {
        address = fullAddr;
      }
    }

    if (!cityStateZip) {
      const parts = [soldTo.city, soldTo.state, soldTo.postal_code || soldTo.postal || soldTo.zip].filter(Boolean);
      cityStateZip = parts.join(', ');
    }

    return { address, city_state_zip: cityStateZip, country, phone, email };
  }, []);

  const handleSelectSO = useCallback(
    (so: SOOption) => {
      setSelectedSO(so);
      const addr = parseAddress(so.sold_to);

      setFormData({
        customer_name: so.customer_name,
        po_number: so.po_number,
        address: addr.address,
        city_state_zip: addr.city_state_zip,
        country: addr.country,
        phone: addr.phone,
        email: addr.email,
        ship_via: '',
        ship_by_date: so.ship_date || '',
        invoice_date: new Date().toISOString().split('T')[0],
        trade_terms: 'EXW',
        items: so.items.map((it) => ({
          product_code: it.item_code || it.product_code || '',
          description: it.description || '',
          quantity: it.quantity || 0,
          unit_price: it.unit_price || 0,
        })),
      });
      setStep('edit');
      setError('');
      setSuccess('');
    },
    [parseAddress]
  );

  const updateField = (field: keyof ProformaData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof ProformaItem, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    if (formData.items.length >= 8) return;
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { product_code: '', description: '', quantity: 0, unit_price: 0 }],
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const totalAmount = formData.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  const handleGenerate = async () => {
    if (!formData.customer_name.trim()) {
      setError('Customer name is required');
      return;
    }
    if (formData.items.length === 0) {
      setError('At least one item is required');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(getApiUrl('/api/proforma-invoice/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const blob = await response.blob();
      const cd = response.headers.get('Content-Disposition');
      let filename = `Proforma Invoice_${formData.customer_name}_${formData.po_number || 'draft'}.xlsx`;
      if (cd) {
        const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) filename = match[1].replace(/['"]/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccess(`Proforma Invoice generated: ${filename}`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate proforma invoice');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-violet-100 via-purple-50 to-indigo-100 border-b border-purple-200/50 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Proforma Invoice Maker</h2>
                <p className="text-purple-700 text-sm font-medium mt-0.5">
                  Select a Sales Order to generate a Proforma Invoice
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {step === 'edit' && (
                <button
                  onClick={() => { setStep('select'); setSelectedSO(null); setError(''); setSuccess(''); }}
                  className="px-4 py-2 bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                  Back to Selection
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-semibold text-sm transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-4 text-sm">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold ${step === 'select' ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-bold">1</span>
              Select SO
            </div>
            <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold ${step === 'edit' ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-bold">2</span>
              Review & Generate
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 flex items-center gap-2 text-sm font-medium">
            <Check className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* STEP 1: SO Selection */}
        {step === 'select' && (
          <div className="p-6">
            {/* Search */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Search by SO number, customer name, or PO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-5 py-3.5 pl-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-sm shadow-sm"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 mb-3 font-medium">
              {filteredSOs.length} sales order{filteredSOs.length !== 1 ? 's' : ''} available
            </div>

            {/* SO list */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredSOs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">No sales orders found</p>
                  <p className="text-xs mt-1">Try a different search term or check if data is loaded</p>
                </div>
              ) : (
                filteredSOs.map((so) => (
                  <div key={so.so_number} className="bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-all overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedSO(expandedSO === so.so_number ? null : so.so_number)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md">
                          SO
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">SO {so.so_number}</div>
                          <div className="text-sm text-slate-500 flex items-center gap-2">
                            <User className="w-3 h-3" /> {so.customer_name || 'Unknown Customer'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          {so.po_number && (
                            <div className="text-xs text-slate-500">PO: {so.po_number}</div>
                          )}
                          <div className="text-xs text-slate-400">{so.order_date || 'No date'}</div>
                        </div>
                        <div className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">{so.items.length} item{so.items.length !== 1 ? 's' : ''}</div>
                        {expandedSO === so.so_number ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {expandedSO === so.so_number && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                        {so.items.length > 0 ? (
                          <div className="mb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                  <th className="text-left py-1 px-2">Code</th>
                                  <th className="text-left py-1 px-2">Description</th>
                                  <th className="text-right py-1 px-2">Qty</th>
                                  <th className="text-right py-1 px-2">Price</th>
                                  <th className="text-right py-1 px-2">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {so.items.slice(0, 8).map((item: any, idx: number) => (
                                  <tr key={idx} className="border-t border-slate-100">
                                    <td className="py-1.5 px-2 font-mono text-xs text-slate-700">{item.item_code || '—'}</td>
                                    <td className="py-1.5 px-2 text-slate-600 max-w-[250px] truncate">{item.description || '—'}</td>
                                    <td className="py-1.5 px-2 text-right text-slate-700">{item.quantity || 0}</td>
                                    <td className="py-1.5 px-2 text-right text-slate-700">${(item.unit_price || 0).toFixed(2)}</td>
                                    <td className="py-1.5 px-2 text-right font-semibold text-slate-800">
                                      ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500 mb-4">No item details available for this SO.</div>
                        )}

                        <button
                          onClick={() => handleSelectSO(so)}
                          className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Use this SO for Proforma Invoice
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Edit & Generate */}
        {step === 'edit' && selectedSO && (
          <div className="p-6 space-y-6">
            {/* SO Reference banner */}
            <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 rounded-xl border border-violet-200">
              <FileText className="w-5 h-5 text-violet-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-violet-800">
                Based on SO {selectedSO.so_number}
              </span>
              {selectedSO.po_number && (
                <span className="text-xs px-2 py-0.5 bg-violet-200 text-violet-800 rounded-md ml-1">PO: {selectedSO.po_number}</span>
              )}
            </div>

            {/* Buyer Information */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-800 text-sm">Buyer Information</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Customer Name *</label>
                  <input type="text" value={formData.customer_name}
                    onChange={(e) => updateField('customer_name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Ref# / PO Number</label>
                  <input type="text" value={formData.po_number}
                    onChange={(e) => updateField('po_number', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
                  <input type="text" value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">City, State, ZIP</label>
                  <input type="text" value={formData.city_state_zip}
                    onChange={(e) => updateField('city_state_zip', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Country</label>
                  <input type="text" value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Phone</label>
                  <input type="text" value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Email</label>
                  <input type="text" value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
              </div>
            </div>

            {/* Shipping & Dates */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-800 text-sm">Shipping & Dates</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Ship Via</label>
                  <input type="text" value={formData.ship_via} placeholder="e.g. AIR, SEA, GROUND"
                    onChange={(e) => updateField('ship_via', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Ship By Date</label>
                  <input type="date" value={formData.ship_by_date}
                    onChange={(e) => updateField('ship_by_date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Invoice Date</label>
                  <input type="date" value={formData.invoice_date}
                    onChange={(e) => updateField('invoice_date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Trade Terms</label>
                  <select value={formData.trade_terms}
                    onChange={(e) => updateField('trade_terms', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
                    <option value="EXW">EXW</option>
                    <option value="FOB">FOB</option>
                    <option value="CIF">CIF</option>
                    <option value="DAP">DAP</option>
                    <option value="DDP">DDP</option>
                    <option value="FCA">FCA</option>
                    <option value="CPT">CPT</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-sm">Line Items</h3>
                  <span className="text-xs text-slate-400">({formData.items.length}/8 max)</span>
                </div>
                {formData.items.length < 8 && (
                  <button onClick={addItem}
                    className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-semibold hover:bg-violet-200 transition-all flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="text-left py-2.5 px-4 w-[120px]">Product Code</th>
                      <th className="text-left py-2.5 px-4">Description</th>
                      <th className="text-right py-2.5 px-4 w-[80px]">Qty</th>
                      <th className="text-right py-2.5 px-4 w-[110px]">Unit Price</th>
                      <th className="text-right py-2.5 px-4 w-[110px]">Total</th>
                      <th className="py-2.5 px-2 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2 px-4">
                          <input type="text" value={item.product_code}
                            onChange={(e) => updateItem(idx, 'product_code', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-violet-500/20 focus:border-violet-500" />
                        </td>
                        <td className="py-2 px-4">
                          <input type="text" value={item.description}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-violet-500/20 focus:border-violet-500" />
                        </td>
                        <td className="py-2 px-4">
                          <input type="number" value={item.quantity || ''}
                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-violet-500/20 focus:border-violet-500" />
                        </td>
                        <td className="py-2 px-4">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                            <input type="number" step="0.01" value={item.unit_price || ''}
                              onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 pl-5 border border-slate-200 rounded-lg text-xs text-right focus:ring-1 focus:ring-violet-500/20 focus:border-violet-500" />
                          </div>
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-slate-800 text-xs">
                          ${(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <button onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {formData.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                          No items. Click "Add Item" to add line items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {formData.items.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={4} className="py-3 px-4 text-right font-bold text-slate-800 text-sm">
                          TOTAL (U.S. Funds):
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-base">
                          ${totalAmount.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                Output: <span className="font-mono text-slate-600">Proforma Invoice_{formData.customer_name}_{formData.po_number || 'draft'}.xlsx</span>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || formData.items.length === 0}
                className={`px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg ${
                  generating || formData.items.length === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-violet-500/25'
                }`}
              >
                {generating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate Proforma Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProformaInvoiceMaker;
