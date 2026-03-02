import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import {
  Search, FileText, Download, ChevronDown, Check, X,
  Package, User, Truck, Plus, Trash2, AlertTriangle, Loader2
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

interface SOResult {
  so_number: string;
  file: string;
  status: string;
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
  const [searchResults, setSearchResults] = useState<SOResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSONumber, setSelectedSONumber] = useState('');
  const [formData, setFormData] = useState<ProformaData>({
    customer_name: '', po_number: '', address: '', city_state_zip: '',
    country: '', phone: '', email: '', ship_via: '',
    ship_by_date: '', invoice_date: new Date().toISOString().split('T')[0],
    trade_terms: 'EXW', items: [],
  });
  const [generating, setGenerating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'select' | 'edit'>('select');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced real-time search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const resp = await fetch(getApiUrl(`/api/proforma-invoice/search-so?q=${encodeURIComponent(q)}`), {
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error('Search failed');
        const data = await resp.json();
        if (!controller.signal.aborted) {
          setSearchResults(data.results || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('SO search error:', err);
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

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

  const handleSelectSO = useCallback(async (soNumber: string) => {
    setParsing(true);
    setError('');
    setSuccess('');
    setSelectedSONumber(soNumber);

    try {
      const response = await fetch(getApiUrl(`/api/proforma-invoice/parse-so/${soNumber}`));
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to parse SO ${soNumber}`);
      }
      const result = await response.json();
      const so = result.so_data;
      if (!so) throw new Error('No data returned from parser');

      const soldTo = so.sold_to || so.billing_address || {};
      const addr = parseAddress(soldTo);
      const items: ProformaItem[] = (so.items || []).map((it: any) => ({
        product_code: it.item_code || it.product_code || '',
        description: it.description || '',
        quantity: safeParseCurrency(it.quantity || it.ordered),
        unit_price: safeParseCurrency(it.unit_price || it.price),
      }));

      setFormData({
        customer_name: so.customer_name || soldTo.company_name || soldTo.company || '',
        po_number: so.po_number || '',
        address: addr.address, city_state_zip: addr.city_state_zip,
        country: addr.country, phone: addr.phone, email: addr.email,
        ship_via: '', ship_by_date: so.ship_date || '',
        invoice_date: new Date().toISOString().split('T')[0],
        trade_terms: 'EXW', items,
      });
      setStep('edit');
    } catch (err: any) {
      setError(err.message || 'Failed to load SO data');
    } finally {
      setParsing(false);
    }
  }, [parseAddress]);

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
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const totalAmount = formData.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  const handleGenerate = async () => {
    if (!formData.customer_name.trim()) { setError('Customer name is required'); return; }
    if (formData.items.length === 0) { setError('At least one item is required'); return; }

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
        if (match?.[1]) filename = match[1].replace(/['"]/g, '');
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

  const statusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('new') || s.includes('revised')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s.includes('production') || s.includes('scheduled')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (s.includes('complete') || s.includes('shipped')) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-100 via-purple-50 to-indigo-100 border-b border-purple-200/50 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Proforma Invoice Maker</h2>
                <p className="text-purple-700 text-sm font-medium mt-0.5">Type an SO number to search and generate</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {step === 'edit' && (
                <button
                  onClick={() => { setStep('select'); setSelectedSONumber(''); setError(''); setSuccess(''); setSearchQuery(''); setSearchResults([]); }}
                  className="px-4 py-2 bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                  Back
                </button>
              )}
              {onClose && (
                <button onClick={onClose} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 flex items-center gap-2 text-sm font-medium">
            <Check className="w-4 h-4 flex-shrink-0" /> {success}
          </div>
        )}

        {/* Parsing loading state */}
        {parsing && (
          <div className="mx-6 mt-4 px-4 py-6 bg-violet-50 text-violet-700 rounded-xl border border-violet-200 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            <div className="font-semibold">Parsing SO {selectedSONumber} from PDF...</div>
            <div className="text-xs text-violet-500">Extracting customer, items, prices, and addresses</div>
          </div>
        )}

        {/* STEP 1: Search SO */}
        {step === 'select' && !parsing && (
          <div className="p-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Type SO number to search (e.g. 3125, 3167)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full px-5 py-4 pl-14 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-base shadow-sm"
              />
              {searching ? (
                <Loader2 className="w-5 h-5 text-violet-500 animate-spin absolute left-5 top-1/2 -translate-y-1/2" />
              ) : (
                <Search className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
              )}
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results */}
            {searchQuery.trim() && !searching && searchResults.length === 0 && (
              <div className="mt-4 text-center py-8 text-slate-500">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No sales orders matching "{searchQuery}"</p>
                <p className="text-xs mt-1 text-slate-400">Make sure the SO number exists in the Sales Orders folder</p>
              </div>
            )}

            {!searchQuery.trim() && !searching && (
              <div className="mt-4 text-center py-8 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-slate-500">Enter an SO number to get started</p>
                <p className="text-xs mt-1">Results appear as you type</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-[400px] overflow-y-auto">
                <div className="text-xs text-slate-500 font-medium mb-2">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                </div>
                {searchResults.map((so) => (
                  <div
                    key={so.so_number}
                    onClick={() => handleSelectSO(so.so_number)}
                    className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-md flex-shrink-0">
                        SO
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">SO {so.so_number}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[300px]">{so.file}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold border ${statusColor(so.status)}`}>
                        {so.status}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronDown className="w-4 h-4 text-violet-600 -rotate-90" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Edit & Generate */}
        {step === 'edit' && !parsing && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 rounded-xl border border-violet-200">
              <FileText className="w-5 h-5 text-violet-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-violet-800">Based on SO {selectedSONumber}</span>
              {formData.po_number && (
                <span className="text-xs px-2 py-0.5 bg-violet-200 text-violet-800 rounded-md">PO: {formData.po_number}</span>
              )}
            </div>

            {/* Buyer Information */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-800 text-sm">Buyer Information</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  ['customer_name', 'Customer Name *', ''],
                  ['po_number', 'Ref# / PO Number', ''],
                  ['address', 'Address', ''],
                  ['city_state_zip', 'City, State, ZIP', ''],
                  ['country', 'Country', ''],
                  ['phone', 'Phone', ''],
                ] as [keyof ProformaData, string, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
                    <input type="text" value={formData[field] as string}
                      onChange={(e) => updateField(field, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                  </div>
                ))}
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
                  <input type="text" value={formData.ship_via} placeholder="e.g. AIR, SEA"
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
                    {['EXW','FOB','CIF','DAP','DDP','FCA','CPT'].map(t => <option key={t} value={t}>{t}</option>)}
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
                  <span className="text-xs text-slate-400">({formData.items.length}/8)</span>
                </div>
                {formData.items.length < 8 && (
                  <button onClick={addItem} className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-semibold hover:bg-violet-200 transition-all flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="text-left py-2.5 px-4 w-[120px]">Code</th>
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
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">No items yet.</td></tr>
                    )}
                  </tbody>
                  {formData.items.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={4} className="py-3 px-4 text-right font-bold text-slate-800 text-sm">TOTAL (U.S. Funds):</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-base">${totalAmount.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Generate */}
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
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Download className="w-4 h-4" /> Generate Proforma Invoice</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProformaInvoiceMaker;
