import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

type Tab = 'adjust' | 'transfer' | 'reorder' | 'reserve' | 'allocate' | 'scrap' | 'assemble' | 'supplier' | 'ship' | 'stockcheck';

interface InventoryActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemNo?: string;
  onSuccess?: () => void;
  /** Open directly to Adjust, Transfer, Reserve, or Allocate tab */
  initialTab?: Tab;
}

export function InventoryActionsModal({ isOpen, onClose, itemNo = '', onSuccess, initialTab = 'adjust' }: InventoryActionsModalProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => { if (isOpen) setTab(initialTab); }, [isOpen, initialTab]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const REASON_CODES = [
    { value: '', label: '— Select reason (optional) —' },
    { value: 'Cycle count', label: 'Cycle count' },
    { value: 'Damage', label: 'Damage' },
    { value: 'Found', label: 'Found' },
    { value: 'Correction', label: 'Correction' },
    { value: 'Physical count', label: 'Physical count' },
    { value: 'Shrinkage', label: 'Shrinkage' },
    { value: 'Dispense', label: 'Dispense' },
    { value: 'Return', label: 'Return' },
    { value: 'Recorded movement', label: 'Recorded movement' },
    { value: 'Other', label: 'Other' },
  ];
  const [adjust, setAdjust] = useState({ location: '', delta: '', reasonCode: '', note: '' });
  const [transfer, setTransfer] = useState({ from_loc: '', to_loc: '', from_bin: '', to_bin: '', qty: '' });
  const [reorder, setReorder] = useState({ Minimum: '', Maximum: '', ReorderLevel: '', ReorderQuantity: '' });
  const [reserve, setReserve] = useState({ location: '', qty: '', action: 'reserve' as 'reserve' | 'relieve', ref: '' });
  const [allocate, setAllocate] = useState({ location: '', qty: '', ref: '', action: 'allocate' as 'allocate' | 'deallocate' });
  const [scrap, setScrap] = useState({ location: '', qty: '', action: 'scrap' as 'scrap' | 'recover', ref: '' });
  const [assemble, setAssemble] = useState({ parent_item: '', qty: '', location: '', action: 'assemble' as 'assemble' | 'disassemble', from_wip: false, to_wip: false, componentsPreview: [] as { item_no: string; required_per_unit: number; total_required: number; available: number; sufficient: boolean }[] });
  const [supplier, setSupplier] = useState({ item_no: '', qty: '', location: '', supplier: '', ref: '', action: 'receive' as 'receive' | 'return' });
  const [ship, setShip] = useState({ so_no: '', items: [{ item_no: '', qty: '' }], location: '' });
  const [stockCheck, setStockCheck] = useState({ snapshot: [] as { item_no: string; location: string; stock: number; reserved: number; allocated: number; available: number; physical?: string }[], loading: false });

  if (!isOpen) return null;

  const currentItemNo = itemNo;

  const handleAdjust = async () => {
    if (!currentItemNo || !adjust.delta) {
      setMessage({ type: 'error', text: 'Item and delta are required.' });
      return;
    }
    const delta = parseFloat(adjust.delta);
    if (isNaN(delta)) {
      setMessage({ type: 'error', text: 'Delta must be a number.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const reason = [adjust.reasonCode, adjust.note].filter(Boolean).join(': ');
      const res = await fetch(getApiUrl('/api/inventory/adjustment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_no: currentItemNo,
          location: adjust.location || undefined,
          delta,
          reason: reason || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: 'Adjustment saved. Refresh to see updated stock.' });
      setAdjust({ location: '', delta: '', reasonCode: '', note: '' });
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!currentItemNo || !transfer.from_loc || !transfer.to_loc || !transfer.qty) {
      setMessage({ type: 'error', text: 'Item, from location, to location, and qty are required.' });
      return;
    }
    const qty = parseFloat(transfer.qty);
    if (isNaN(qty) || qty <= 0) {
      setMessage({ type: 'error', text: 'Qty must be a positive number.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(getApiUrl('/api/inventory/transfer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_no: currentItemNo,
          from_loc: transfer.from_loc,
          to_loc: transfer.to_loc,
          from_bin: transfer.from_bin || undefined,
          to_bin: transfer.to_bin || undefined,
          qty,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: 'Transfer recorded. Refresh to see updated quantities.' });
      setTransfer({ from_loc: '', to_loc: '', from_bin: '', to_bin: '', qty: '' });
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async () => {
    if (!currentItemNo) {
      setMessage({ type: 'error', text: 'Item is required.' });
      return;
    }
    const payload: Record<string, number | undefined> = {};
    if (reorder.Minimum !== '') {
      const v = parseFloat(reorder.Minimum);
      if (!isNaN(v)) payload['Minimum'] = v;
    }
    if (reorder.Maximum !== '') {
      const v = parseFloat(reorder.Maximum);
      if (!isNaN(v)) payload['Maximum'] = v;
    }
    if (reorder.ReorderLevel !== '') {
      const v = parseFloat(reorder.ReorderLevel);
      if (!isNaN(v)) payload['Reorder Level'] = v;
    }
    if (reorder.ReorderQuantity !== '') {
      const v = parseFloat(reorder.ReorderQuantity);
      if (!isNaN(v)) payload['Reorder Quantity'] = v;
    }
    if (Object.keys(payload).length === 0) {
      setMessage({ type: 'error', text: 'Enter at least one value to update.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(getApiUrl(`/api/items/${encodeURIComponent(currentItemNo)}/reorder`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: 'Reorder settings updated. Refresh to see changes.' });
      setReorder({ Minimum: '', Maximum: '', ReorderLevel: '', ReorderQuantity: '' });
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async () => {
    if (!currentItemNo || !reserve.qty) {
      setMessage({ type: 'error', text: 'Item and quantity are required.' });
      return;
    }
    const qty = parseFloat(reserve.qty);
    if (isNaN(qty) || qty <= 0) {
      setMessage({ type: 'error', text: 'Quantity must be a positive number.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const endpoint = reserve.action === 'reserve' ? '/api/inventory/reserve' : '/api/inventory/relieve';
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_no: currentItemNo,
          location: reserve.location || undefined,
          qty,
          ref: reserve.ref || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: reserve.action === 'reserve' ? 'Reserve recorded. Refresh to see updated available qty.' : 'Reserve relieved. Refresh to see updated available qty.' });
      setReserve((r) => ({ location: '', qty: '', action: r.action, ref: '' }));
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async () => {
    if (!currentItemNo || !allocate.qty || !allocate.ref) {
      setMessage({ type: 'error', text: 'Item, quantity, and ref (MO/SO/Job) are required.' });
      return;
    }
    const qty = parseFloat(allocate.qty);
    if (isNaN(qty) || qty <= 0) {
      setMessage({ type: 'error', text: 'Quantity must be a positive number.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const endpoint = allocate.action === 'allocate' ? '/api/inventory/allocate' : '/api/inventory/deallocate';
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_no: currentItemNo,
          location: allocate.location || undefined,
          qty,
          ref: allocate.ref,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: allocate.action === 'allocate' ? 'Allocation recorded. Refresh to see updated available qty.' : 'Deallocation recorded. Refresh to see updated available qty.' });
      setAllocate((a) => ({ location: '', qty: '', ref: '', action: a.action }));
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleScrap = async () => {
    if (!currentItemNo || !scrap.qty) {
      setMessage({ type: 'error', text: 'Item and quantity are required.' });
      return;
    }
    const qty = parseFloat(scrap.qty);
    if (isNaN(qty) || qty <= 0) {
      setMessage({ type: 'error', text: 'Quantity must be a positive number.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const endpoint = scrap.action === 'scrap' ? '/api/inventory/scrap' : '/api/inventory/recover';
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_no: currentItemNo,
          location: scrap.location || undefined,
          qty,
          ref: scrap.ref || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: scrap.action === 'scrap' ? 'Scrap recorded. Refresh to see updated available qty.' : 'Recovery recorded. Refresh to see updated available qty.' });
      setScrap((s) => ({ location: '', qty: '', action: s.action, ref: '' }));
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssemblePreview = async () => {
    const parent = assemble.parent_item.trim();
    const qty = parseFloat(assemble.qty) || 1;
    if (!parent) {
      setAssemble((a) => ({ ...a, componentsPreview: [] }));
      return;
    }
    try {
      const params = new URLSearchParams({ parent_item: parent, qty: String(qty), action: assemble.action });
      if (assemble.action === 'assemble' && assemble.from_wip) params.set('from_wip', 'true');
      const res = await fetch(getApiUrl(`/api/inventory/assemble-preview?${params}`));
      const data = await res.json().catch(() => ({}));
      setAssemble((a) => ({ ...a, componentsPreview: data.components || [] }));
    } catch {
      setAssemble((a) => ({ ...a, componentsPreview: [] }));
    }
  };

  useEffect(() => {
    if (tab === 'assemble' && assemble.parent_item && assemble.qty) {
      const t = setTimeout(fetchAssemblePreview, 300);
      return () => clearTimeout(t);
    }
  }, [tab, assemble.parent_item, assemble.qty, assemble.action, assemble.from_wip]);

  const handleAssemble = async () => {
    const parent = assemble.parent_item.trim();
    const qty = parseFloat(assemble.qty);
    if (!parent) {
      setMessage({ type: 'error', text: 'Parent item is required.' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setMessage({ type: 'error', text: 'Quantity must be a positive number.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const endpoint = assemble.action === 'assemble' ? '/api/inventory/assemble' : '/api/inventory/disassemble';
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_item: parent,
          qty,
          location: assemble.location || undefined,
          from_wip: assemble.from_wip || undefined,
          to_wip: assemble.to_wip || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: assemble.action === 'assemble' ? 'Assembly recorded. Refresh to see updated stock.' : 'Disassembly recorded. Refresh to see updated stock.' });
      setAssemble((a) => ({ ...a, parent_item: '', qty: '', location: '', componentsPreview: [] }));
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSupplier = async () => {
    const itemNo = (supplier.item_no || currentItemNo || '').trim();
    const qty = parseFloat(supplier.qty);
    if (!itemNo) {
      setMessage({ type: 'error', text: 'Item number is required.' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setMessage({ type: 'error', text: 'Quantity must be a positive number.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const endpoint = supplier.action === 'receive' ? '/api/inventory/supplier-receive' : '/api/inventory/supplier-return';
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_no: itemNo,
          qty,
          location: supplier.location || undefined,
          supplier: supplier.supplier || undefined,
          ref: supplier.ref || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: supplier.action === 'receive' ? 'Supplier receive recorded. Refresh to see updated stock.' : 'Supplier return recorded. Refresh to see updated stock.' });
      setSupplier((s) => ({ ...s, item_no: '', qty: '', location: '', supplier: '', ref: '' }));
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleShip = async () => {
    const soNo = ship.so_no.trim();
    const items = ship.items.filter((i) => (i.item_no || currentItemNo || '').trim() && parseFloat(i.qty) > 0).map((i) => ({
      item_no: (i.item_no || currentItemNo || '').trim(),
      qty: parseFloat(i.qty),
    }));
    if (!soNo) {
      setMessage({ type: 'error', text: 'Sales order number is required.' });
      return;
    }
    if (items.length === 0) {
      setMessage({ type: 'error', text: 'At least one item with quantity is required.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(getApiUrl('/api/inventory/sales-transfer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          so_no: soNo,
          items,
          location: ship.location || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: 'Sales transfer recorded. Refresh to see updated stock.' });
      setShip({ so_no: '', items: [{ item_no: currentItemNo || '', qty: '' }], location: '' });
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStockCheck = async () => {
    setStockCheck((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(getApiUrl('/api/inventory/stock-check'));
      const data = await res.json().catch(() => ({}));
      const snap = (data.snapshot || []).slice(0, 100).map((r: { item_no: string; location: string; stock: number; reserved: number; allocated: number; available: number }) => ({
        ...r,
        physical: '',
      }));
      setStockCheck({ snapshot: snap, loading: false });
    } catch {
      setStockCheck((s) => ({ ...s, loading: false }));
    }
  };

  const setStockCheckPhysical = (idx: number, val: string) => {
    setStockCheck((s) => ({
      ...s,
      snapshot: s.snapshot.map((r, i) => (i === idx ? { ...r, physical: val } : r)),
    }));
  };

  const handleStockCheckPost = async () => {
    const variances = stockCheck.snapshot
      .filter((r) => {
        const phys = parseFloat(String(r.physical || ''));
        return !Number.isNaN(phys) && Math.abs(phys - r.stock) > 1e-9;
      })
      .map((r) => ({
        item_no: r.item_no,
        location: r.location || '',
        stock: r.stock,
        physical: parseFloat(String(r.physical || '0')),
      }));
    if (variances.length === 0) {
      setMessage({ type: 'error', text: 'Enter physical counts that differ from system to post adjustments.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(getApiUrl('/api/inventory/stock-check-post'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variances }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Failed (${res.status})` });
        return;
      }
      setMessage({ type: 'success', text: `Posted ${data.posted ?? variances.length} adjustment(s). Refresh to see updated stock.` });
      setStockCheck((s) => ({ ...s, snapshot: s.snapshot.map((r) => ({ ...r, physical: '' })) }));
      onSuccess?.();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50" style={{ zIndex: 10000 }} role="dialog" aria-labelledby="inventory-actions-title">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 id="inventory-actions-title" className="text-lg font-semibold text-slate-800">Inventory actions</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {currentItemNo && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 text-sm text-slate-600">
            Item: <strong>{currentItemNo}</strong>
          </div>
        )}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {(['adjust', 'transfer', 'reorder', 'reserve', 'allocate', 'scrap', 'assemble', 'supplier', 'ship', 'stockcheck'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setMessage(null); }}
              className={`flex-1 min-w-0 px-2 py-3 text-xs shrink-0 font-medium ${tab === t ? 'bg-violet-100 text-violet-800 border-b-2 border-violet-600' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t === 'adjust' ? 'Adjust' : t === 'transfer' ? 'Transfer' : t === 'reorder' ? 'Min/Max' : t === 'reserve' ? 'Reserve' : t === 'allocate' ? 'Allocate' : t === 'scrap' ? 'Scrap' : t === 'assemble' ? 'Assemble' : t === 'supplier' ? 'Supplier' : t === 'ship' ? 'Ship' : 'Stock Check'}
            </button>
          ))}
        </div>
        <div className="px-6 py-4 space-y-4">
          {message && (
            <div className={`text-sm px-3 py-2 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
              {message.text}
            </div>
          )}
          {tab === 'adjust' && (
            <>
              {!currentItemNo && (
                <div className="text-sm text-slate-500">Open an item from the list to prefill item number.</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delta (positive to add, negative to remove)</label>
                <input
                  type="number"
                  value={adjust.delta}
                  onChange={(e) => setAdjust((a) => ({ ...a, delta: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 10 or -5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={adjust.location}
                  onChange={(e) => setAdjust((a) => ({ ...a, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason code (optional)</label>
                <select
                  value={adjust.reasonCode}
                  onChange={(e) => setAdjust((a) => ({ ...a, reasonCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {REASON_CODES.map((rc) => (
                    <option key={rc.value || 'empty'} value={rc.value}>{rc.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={adjust.note}
                  onChange={(e) => setAdjust((a) => ({ ...a, note: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Bin A-1 count discrepancy"
                />
              </div>
              <button
                type="button"
                onClick={handleAdjust}
                disabled={loading || !currentItemNo}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Save adjustment'}
              </button>
            </>
          )}
          {tab === 'transfer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From location</label>
                <input
                  type="text"
                  value={transfer.from_loc}
                  onChange={(e) => setTransfer((t) => ({ ...t, from_loc: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To location</label>
                <input
                  type="text"
                  value={transfer.to_loc}
                  onChange={(e) => setTransfer((t) => ({ ...t, to_loc: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. HOME"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From bin (optional)</label>
                  <input
                    type="text"
                    value={transfer.from_bin}
                    onChange={(e) => setTransfer((t) => ({ ...t, from_bin: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. A-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To bin (optional)</label>
                  <input
                    type="text"
                    value={transfer.to_bin}
                    onChange={(e) => setTransfer((t) => ({ ...t, to_bin: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. B-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={transfer.qty}
                  onChange={(e) => setTransfer((t) => ({ ...t, qty: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={loading || !currentItemNo}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Record transfer'}
              </button>
            </>
          )}
          {tab === 'reorder' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reorder.Minimum}
                    onChange={(e) => setReorder((r) => ({ ...r, Minimum: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Maximum</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reorder.Maximum}
                    onChange={(e) => setReorder((r) => ({ ...r, Maximum: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reorder level</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reorder.ReorderLevel}
                    onChange={(e) => setReorder((r) => ({ ...r, ReorderLevel: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reorder quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reorder.ReorderQuantity}
                    onChange={(e) => setReorder((r) => ({ ...r, ReorderQuantity: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleReorder}
                disabled={loading || !currentItemNo}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Update reorder settings'}
              </button>
            </>
          )}
          {tab === 'reserve' && (
            <>
              {!currentItemNo && (
                <div className="text-sm text-slate-500">Open an item from the list to prefill item number.</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                <select
                  value={reserve.action}
                  onChange={(e) => setReserve((r) => ({ ...r, action: e.target.value as 'reserve' | 'relieve' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="reserve">Reserve stock</option>
                  <option value="relieve">Relieve reserve</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={reserve.qty}
                  onChange={(e) => setReserve((r) => ({ ...r, qty: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={reserve.location}
                  onChange={(e) => setReserve((r) => ({ ...r, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference (optional)</label>
                <input
                  type="text"
                  value={reserve.ref}
                  onChange={(e) => setReserve((r) => ({ ...r, ref: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. SO-1234, ASSEMBLY:FG-001, or MO-456"
                />
                <p className="text-xs text-slate-500 mt-1">For assembly: use ASSEMBLY:&lt;parent item&gt; to reserve components for a build.</p>
              </div>
              <button
                type="button"
                onClick={handleReserve}
                disabled={loading || !currentItemNo}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : reserve.action === 'reserve' ? 'Reserve stock' : 'Relieve reserve'}
              </button>
            </>
          )}
          {tab === 'allocate' && (
            <>
              {!currentItemNo && (
                <div className="text-sm text-slate-500">Open an item from the list to prefill item number.</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                <select
                  value={allocate.action}
                  onChange={(e) => setAllocate((a) => ({ ...a, action: e.target.value as 'allocate' | 'deallocate' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="allocate">Allocate stock</option>
                  <option value="deallocate">Deallocate stock</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MO/SO/Job number (required)</label>
                <input
                  type="text"
                  value={allocate.ref}
                  onChange={(e) => setAllocate((a) => ({ ...a, ref: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 3095 or SO-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={allocate.qty}
                  onChange={(e) => setAllocate((a) => ({ ...a, qty: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={allocate.location}
                  onChange={(e) => setAllocate((a) => ({ ...a, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              <button
                type="button"
                onClick={handleAllocate}
                disabled={loading || !currentItemNo}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : allocate.action === 'allocate' ? 'Allocate stock' : 'Deallocate stock'}
              </button>
            </>
          )}
          {tab === 'scrap' && (
            <>
              {!currentItemNo && (
                <div className="text-sm text-slate-500">Open an item from the list to prefill item number.</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                <select
                  value={scrap.action}
                  onChange={(e) => setScrap((s) => ({ ...s, action: e.target.value as 'scrap' | 'recover' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="scrap">Scrap stock</option>
                  <option value="recover">Recover stock</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={scrap.qty}
                  onChange={(e) => setScrap((s) => ({ ...s, qty: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={scrap.location}
                  onChange={(e) => setScrap((s) => ({ ...s, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference (optional)</label>
                <input
                  type="text"
                  value={scrap.ref}
                  onChange={(e) => setScrap((s) => ({ ...s, ref: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. WO-123"
                />
              </div>
              <button
                type="button"
                onClick={handleScrap}
                disabled={loading || !currentItemNo}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : scrap.action === 'scrap' ? 'Scrap stock' : 'Recover stock'}
              </button>
            </>
          )}
          {tab === 'assemble' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                <select
                  value={assemble.action}
                  onChange={(e) => setAssemble((a) => ({ ...a, action: e.target.value as 'assemble' | 'disassemble' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="assemble">Assemble (consume components, add finished good)</option>
                  <option value="disassemble">Disassemble (reduce finished good, add components)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent item (finished good)</label>
                <input
                  type="text"
                  value={assemble.parent_item}
                  onChange={(e) => setAssemble((a) => ({ ...a, parent_item: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. FG-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={assemble.qty}
                  onChange={(e) => setAssemble((a) => ({ ...a, qty: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={assemble.location}
                  onChange={(e) => setAssemble((a) => ({ ...a, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              {assemble.action === 'assemble' && (
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={assemble.from_wip} onChange={(e) => setAssemble((a) => ({ ...a, from_wip: e.target.checked }))} className="rounded border-slate-300" />
                    Consume components from WIP
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={assemble.to_wip} onChange={(e) => setAssemble((a) => ({ ...a, to_wip: e.target.checked }))} className="rounded border-slate-300" />
                    Add finished good to WIP
                  </label>
                </div>
              )}
              {assemble.action === 'disassemble' && (
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={assemble.from_wip} onChange={(e) => setAssemble((a) => ({ ...a, from_wip: e.target.checked }))} className="rounded border-slate-300" />
                    Consume finished good from WIP
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={assemble.to_wip} onChange={(e) => setAssemble((a) => ({ ...a, to_wip: e.target.checked }))} className="rounded border-slate-300" />
                    Add components to WIP
                  </label>
                </div>
              )}
              {assemble.componentsPreview.length > 0 && (
                <div className="text-sm border border-slate-200 rounded-lg p-2 bg-slate-50 max-h-24 overflow-y-auto">
                  <div className="font-medium text-slate-700 mb-1">BOM preview:</div>
                  {assemble.componentsPreview.map((c) => (
                    <div key={c.item_no} className={`flex justify-between ${c.sufficient ? 'text-slate-600' : 'text-red-600'}`}>
                      <span>{c.item_no}</span>
                      <span>{c.total_required} req (avail: {c.available})</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={handleAssemble}
                disabled={loading || !assemble.parent_item}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : assemble.action === 'assemble' ? 'Assemble' : 'Disassemble'}
              </button>
            </>
          )}
          {tab === 'supplier' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                <select
                  value={supplier.action}
                  onChange={(e) => setSupplier((s) => ({ ...s, action: e.target.value as 'receive' | 'return' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="receive">Receive (no PO)</option>
                  <option value="return">Return to supplier</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item number</label>
                <input
                  type="text"
                  value={supplier.item_no || currentItemNo}
                  onChange={(e) => setSupplier((s) => ({ ...s, item_no: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. RAW-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={supplier.qty}
                  onChange={(e) => setSupplier((s) => ({ ...s, qty: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={supplier.location}
                  onChange={(e) => setSupplier((s) => ({ ...s, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier (optional)</label>
                <input
                  type="text"
                  value={supplier.supplier}
                  onChange={(e) => setSupplier((s) => ({ ...s, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. SUP-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference (optional)</label>
                <input
                  type="text"
                  value={supplier.ref}
                  onChange={(e) => setSupplier((s) => ({ ...s, ref: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Invoice #"
                />
              </div>
              <button
                type="button"
                onClick={handleSupplier}
                disabled={loading}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : supplier.action === 'receive' ? 'Record receive' : 'Record return'}
              </button>
            </>
          )}
          {tab === 'ship' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sales order number</label>
                <input
                  type="text"
                  value={ship.so_no}
                  onChange={(e) => setShip((s) => ({ ...s, so_no: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. SO-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Items to ship</label>
                {ship.items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={it.item_no || currentItemNo}
                      onChange={(e) => setShip((s) => ({
                        ...s,
                        items: s.items.map((i, iidx) => iidx === idx ? { ...i, item_no: e.target.value } : i),
                      }))}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Item"
                    />
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      value={it.qty}
                      onChange={(e) => setShip((s) => ({
                        ...s,
                        items: s.items.map((i, iidx) => iidx === idx ? { ...i, qty: e.target.value } : i),
                      }))}
                      className="w-20 px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Qty"
                    />
                    {ship.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShip((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        aria-label="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setShip((s) => ({ ...s, items: [...s.items, { item_no: currentItemNo || '', qty: '' }] }))}
                  className="text-sm text-violet-600 hover:underline"
                >
                  + Add item
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={ship.location}
                  onChange={(e) => setShip((s) => ({ ...s, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. 62TODD"
                />
              </div>
              <button
                type="button"
                onClick={handleShip}
                disabled={loading || !ship.so_no}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Record sales transfer'}
              </button>
            </>
          )}
          {tab === 'stockcheck' && (
            <>
              <p className="text-sm text-slate-600">Snapshot current stock for physical count comparison.</p>
              <button
                type="button"
                onClick={fetchStockCheck}
                disabled={stockCheck.loading}
                className="w-full py-2 bg-violet-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {stockCheck.loading ? 'Loading…' : 'Get stock snapshot'}
              </button>
              {stockCheck.snapshot.length > 0 && (
                <>
                <button
                  type="button"
                  onClick={handleStockCheckPost}
                  disabled={loading || !stockCheck.snapshot.some((r) => {
                    const phys = parseFloat(String(r.physical || ''));
                    return !Number.isNaN(phys) && Math.abs(phys - r.stock) > 1e-9;
                  })}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? 'Posting…' : 'Post batch (apply adjustments)'}
                </button>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                  <table className="w-full">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="p-1 text-left">Item</th>
                        <th className="p-1 text-left">Loc</th>
                        <th className="p-1 text-right">System</th>
                        <th className="p-1 text-right">Res</th>
                        <th className="p-1 text-right">Avail</th>
                        <th className="p-1 text-right">Physical</th>
                        <th className="p-1 text-right">Var</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockCheck.snapshot.map((r, idx) => {
                        const phys = parseFloat(r.physical || '');
                        const varVal = isNaN(phys) ? null : phys - r.stock;
                        return (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="p-1">{r.item_no}</td>
                            <td className="p-1">{r.location || '-'}</td>
                            <td className="p-1 text-right">{r.stock}</td>
                            <td className="p-1 text-right">{r.reserved}</td>
                            <td className="p-1 text-right">{r.available}</td>
                            <td className="p-1">
                              <input
                                type="number"
                                value={r.physical}
                                onChange={(e) => setStockCheckPhysical(idx, e.target.value)}
                                className="w-16 px-1 py-0.5 border rounded text-right"
                                placeholder="—"
                              />
                            </td>
                            <td className={`p-1 text-right ${varVal !== null ? (varVal !== 0 ? 'text-amber-600' : 'text-emerald-600') : ''}`}>
                              {varVal !== null ? (varVal > 0 ? '+' : '') + varVal : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default InventoryActionsModal;
