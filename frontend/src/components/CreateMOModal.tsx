/**
 * Create Manufacturing Order Modal – Enterprise, smart-fill, easy to use.
 * - Create from Sales Order (auto-fill item, qty, due date, customer)
 * - Create from recent MO (template)
 * - Searchable Build Item (assembled items with BOMs only)
 * - Smart defaults (due date, batch format)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Search,
  ShoppingCart,
  FileText,
  Sparkles,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export interface CreateMOFormState {
  build_item_no: string;
  quantity: string;
  due_date: string;
  batch_number: string;
  lot_number: string;
  expiry_date: string;
  sales_order_no: string;
  description: string;
}

export interface CreateMOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: CreateMOFormState) => Promise<void>;
  data: any;
  isSubmitting?: boolean;
}

// Build items = items that have BOMs (assembled/finished goods). Fallback to all items if no BOM data.
function getBuildItems(data: any): { itemNo: string; desc: string }[] {
  const items = data?.['Items.json'] || [];
  const bomDetails = data?.['BillOfMaterialDetails.json'] || data?.['MIBOMD.json'] || [];
  const bomHeaders = data?.['BillsOfMaterial.json'] || data?.['MIBOMH.json'] || [];
  const parentSet = new Set<string>();
  bomDetails.forEach((b: any) => {
    const p = (b['Parent Item No.'] || b['BOM Item No.'] || b['parentId'] || '').toString().trim();
    if (p) parentSet.add(p.toUpperCase());
  });
  bomHeaders.forEach((b: any) => {
    const p = (b['Item No.'] || b['Parent Item No.'] || b['itemId'] || '').toString().trim();
    if (p) parentSet.add(p.toUpperCase());
  });
  const hasBomData = parentSet.size > 0;
  const filtered = hasBomData
    ? items.filter((i: any) => {
        const no = (i['Item No.'] || i['Item_No'] || '').toString().trim().toUpperCase();
        return no && parentSet.has(no);
      })
    : items;
  return filtered
    .filter((i: any) => (i['Item No.'] || i['Item_No'] || '').toString().trim())
    .map((i: any) => ({
      itemNo: i['Item No.'] || i['Item_No'] || '',
      desc: (i['Description'] || i['Item Description'] || '').toString().slice(0, 60),
    }))
    .sort((a: any, b: any) => (a.itemNo || '').localeCompare(b.itemNo || ''));
}

// Sales orders with line items for "Create from SO"
function getSOsWithItems(data: any): { soNo: string; customer: string; shipDate: string; batch_number?: string; items: { itemNo: string; qty: number; desc: string }[] }[] {
  const result: { soNo: string; customer: string; shipDate: string; items: { itemNo: string; qty: number; desc: string }[] }[] = [];
  const parsed = data?.['ParsedSalesOrders.json'] || [];
  const soHeaders = data?.['SalesOrderHeaders.json'] || [];
  const soDetails = data?.['SalesOrderDetails.json'] || [];
  const seen = new Set<string>();

  parsed.forEach((so: any) => {
    const soNo = (so.so_number || so.order_number || so['Order No.'] || '').toString().trim();
    if (!soNo || seen.has(soNo)) return;
    seen.add(soNo);
    const items = (so.items || []).map((it: any) => ({
      itemNo: (it.item_code || it.itemCode || it['Item No.'] || '').toString().trim(),
      qty: parseFloat(it.quantity || it.qty || it['Quantity'] || 0) || 0,
      desc: (it.description || '').toString().slice(0, 40),
    })).filter((it: any) => it.itemNo && it.qty > 0);
    if (items.length === 0) return;
    result.push({
      soNo,
      customer: (so.customer_name || so.customer || so.sold_to || '').toString(),
      shipDate: (so.ship_date || so.order_details?.ship_date || so.order_date || '').toString(),
      batch_number: (so.batch_number || so.batchNumber || '').toString().trim() || undefined,
      items,
    });
  });

  soHeaders.forEach((h: any) => {
    const soNo = (h['Sales Order No.'] || h['Order No.'] || h['soId'] || '').toString().trim();
    if (!soNo || seen.has(soNo)) return;
    const lines = soDetails.filter((d: any) => (d['Sales Order No.'] || d['Order No.'] || '').toString().trim() === soNo);
    if (lines.length === 0) return;
    seen.add(soNo);
    const items = lines.map((d: any) => ({
      itemNo: (d['Item No.'] || d['Part No.'] || d['itemId'] || '').toString().trim(),
      qty: parseFloat(d['Quantity'] || d['Ordered'] || d['reqQty'] || 0) || 0,
      desc: (d['Description'] || '').toString().slice(0, 40),
    })).filter((it: any) => it.itemNo && it.qty > 0);
    if (items.length === 0) return;
    result.push({
      soNo,
      customer: (h['Customer'] || h['Customer Name'] || '').toString(),
      shipDate: (h['Ship Date'] || h['Required Date'] || h['Order Date'] || '').toString(),
      batch_number: (h['Batch No.'] || h['Batch Number'] || '').toString().trim() || undefined,
      items,
    });
  });

  return result.sort((a, b) => (b.soNo || '').localeCompare(a.soNo || '')).slice(0, 20);
}

// Recent MOs for template
function getRecentMOs(data: any, limit = 5): { moNo: string; buildItem: string; qty: number; customer: string; soNo: string; batch_number?: string }[] {
  const headers = data?.['ManufacturingOrderHeaders.json'] || data?.['MIMOH.json'] || [];
  return headers
    .filter((m: any) => m['Build Item No.'] && (m['Ordered'] || 0) > 0)
    .sort((a: any, b: any) => {
      const da = (a['Order Date'] || a['ordDt'] || '').toString();
      const db = (b['Order Date'] || b['ordDt'] || '').toString();
      return db.localeCompare(da);
    })
    .slice(0, limit)
    .map((m: any) => ({
      moNo: (m['Mfg. Order No.'] || m['mohId'] || '').toString(),
      buildItem: (m['Build Item No.'] || '').toString(),
      qty: parseFloat(m['Ordered'] || m['ordQty'] || 0) || 0,
      customer: (m['Customer'] || m['Description'] || '').toString(),
      soNo: (m['Sales Order No.'] || m['SO No.'] || '').toString(),
      batch_number: (m['Batch No.'] || m['Batch Number'] || '').toString().trim() || undefined,
    }));
}

function toDateInputValue(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const emptyForm: CreateMOFormState = {
  build_item_no: '',
  quantity: '',
  due_date: '',
  batch_number: '',
  lot_number: '',
  expiry_date: '',
  sales_order_no: '',
  description: '',
};

export const CreateMOModal: React.FC<CreateMOModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  data,
  isSubmitting = false,
}) => {
  const [form, setForm] = useState<CreateMOFormState>(emptyForm);
  const [buildItemSearch, setBuildItemSearch] = useState('');
  const [showBuildItemDropdown, setShowBuildItemDropdown] = useState(false);
  const [createMode, setCreateMode] = useState<'manual' | 'from-so' | 'from-recent'>('manual');

  const buildItems = useMemo(() => getBuildItems(data), [data]);
  const soList = useMemo(() => getSOsWithItems(data), [data]);
  const recentMOs = useMemo(() => getRecentMOs(data), [data]);

  const filteredBuildItems = useMemo(() => {
    const q = buildItemSearch.toLowerCase().trim();
    if (!q) return buildItems.slice(0, 50);
    return buildItems.filter(
      (i) =>
        (i.itemNo || '').toLowerCase().includes(q) ||
        (i.desc || '').toLowerCase().includes(q)
    ).slice(0, 30);
  }, [buildItems, buildItemSearch]);

  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const fillFromSO = useCallback((so: { soNo: string; customer: string; shipDate: string; batch_number?: string; items: { itemNo: string; qty: number; desc: string }[] }) => {
    const first = so.items[0];
    if (!first) return;
    const batch = so.batch_number || '';
    setForm({
      build_item_no: first.itemNo,
      quantity: String(first.qty),
      due_date: toDateInputValue(so.shipDate) || defaultDueDate,
      batch_number: batch,
      lot_number: batch,
      expiry_date: '',
      sales_order_no: so.soNo,
      description: so.customer || `SO ${so.soNo}`,
    });
    setCreateMode('from-so');
    setBuildItemSearch(first.itemNo);
  }, [defaultDueDate]);

  const fillFromRecentMO = useCallback((mo: { moNo: string; buildItem: string; qty: number; customer: string; soNo: string; batch_number?: string }) => {
    const batch = mo.batch_number || '';
    setForm({
      build_item_no: mo.buildItem,
      quantity: String(mo.qty),
      due_date: defaultDueDate,
      batch_number: batch,
      lot_number: batch,
      expiry_date: '',
      sales_order_no: mo.soNo,
      description: mo.customer || `Like MO ${mo.moNo}`,
    });
    setCreateMode('from-recent');
    setBuildItemSearch(mo.buildItem);
  }, [defaultDueDate]);

  const handleSubmit = useCallback(async () => {
    const toSubmit = {
      ...form,
      due_date: form.due_date || defaultDueDate,
    };
    try {
      await onSubmit(toSubmit);
      setForm(emptyForm);
      setBuildItemSearch('');
      setCreateMode('manual');
      onClose();
    } catch {
      // Parent shows toast; keep modal open for retry
    }
  }, [form, defaultDueDate, onSubmit, onClose]);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setBuildItemSearch('');
    setCreateMode('manual');
  }, []);

  if (!isOpen) return null;

  const canSubmit = form.build_item_no && form.quantity && parseFloat(form.quantity) > 0;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
      onClick={() => !isSubmitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-mo-title"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h2 id="create-mo-title" className="text-xl font-bold tracking-tight">
                Create Manufacturing Order
              </h2>
              <p className="text-violet-200 text-sm mt-0.5">
                Smart fill from SO or recent MO · Enterprise ready
              </p>
            </div>
          </div>
          <button
            onClick={() => !isSubmitting && onClose()}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick start: Create from SO | Create from recent */}
        <div className="flex-shrink-0 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick start</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {soList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 self-center">From Sales Order:</span>
                {soList.slice(0, 5).map((so) => (
                  <button
                    key={so.soNo}
                    type="button"
                    onClick={() => fillFromSO(so)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-sm font-medium transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    SO {so.soNo}
                  </button>
                ))}
              </div>
            )}
            {recentMOs.length > 0 && (
              <div className="flex flex-wrap gap-2 ml-2">
                <span className="text-xs text-slate-500 self-center">From recent:</span>
                {recentMOs.map((mo) => (
                  <button
                    key={mo.moNo}
                    type="button"
                    onClick={() => fillFromRecentMO(mo)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-sm font-medium transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {mo.buildItem} ({mo.qty})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Build Item - searchable */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Build Item *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={buildItemSearch || form.build_item_no}
                onChange={(e) => {
                  setBuildItemSearch(e.target.value);
                  setShowBuildItemDropdown(true);
                  if (!e.target.value) setForm((f) => ({ ...f, build_item_no: '' }));
                }}
                onFocus={() => setShowBuildItemDropdown(true)}
                onBlur={() => setTimeout(() => setShowBuildItemDropdown(false), 150)}
                placeholder="Search item (assembled with BOM)..."
                className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
              />
              {showBuildItemDropdown && filteredBuildItems.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-white border-2 border-slate-200 rounded-xl shadow-lg">
                  {filteredBuildItems.map((i) => (
                    <button
                      key={i.itemNo}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, build_item_no: i.itemNo }));
                        setBuildItemSearch(i.itemNo);
                        setShowBuildItemDropdown(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-violet-50 flex justify-between gap-2"
                    >
                      <span className="font-mono font-semibold text-slate-800">{i.itemNo}</span>
                      <span className="text-slate-500 text-sm truncate">{i.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {buildItems.length === 0 && (
              <p className="text-amber-600 text-xs mt-1">No items found. Ensure Items.json (and optionally BillOfMaterialDetails) is loaded.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                min="0.000001"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Due Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={form.due_date || defaultDueDate}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Batch Number</label>
              <input
                type="text"
                value={form.batch_number}
                onChange={(e) => setForm((f) => ({ ...f, batch_number: e.target.value }))}
                placeholder="e.g. WH5H01G002"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-0.5">Traceability · auto-filled from SO/recent</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Lot Number</label>
              <input
                type="text"
                value={form.lot_number}
                onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
                placeholder="e.g. LOT-2025-001"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-0.5">Optional · for lot traceability</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Expiry Date (optional)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">For lot/serial traceability</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Sales Order # (optional, for Sage link)</label>
            <input
              type="text"
              value={form.sales_order_no}
              onChange={(e) => setForm((f) => ({ ...f, sales_order_no: e.target.value }))}
              placeholder="e.g. 2707"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Customer or notes"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-800 text-sm font-medium"
          >
            Reset
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => !isSubmitting && onClose()}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit || isSubmitting}
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2"
            >
              {isSubmitting ? (
                <>Creating…</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Create MO
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
