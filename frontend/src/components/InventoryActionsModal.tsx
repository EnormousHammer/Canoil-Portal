import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

type Tab = 'adjust' | 'transfer' | 'reorder';

interface InventoryActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemNo?: string;
  onSuccess?: () => void;
  /** Open directly to Adjust or Transfer tab */
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
    { value: 'Other', label: 'Other' },
  ];
  const [adjust, setAdjust] = useState({ location: '', delta: '', reasonCode: '', note: '' });
  const [transfer, setTransfer] = useState({ from_loc: '', to_loc: '', from_bin: '', to_bin: '', qty: '' });
  const [reorder, setReorder] = useState({ Minimum: '', Maximum: '', ReorderLevel: '', ReorderQuantity: '' });

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
        <div className="flex border-b border-slate-200">
          {(['adjust', 'transfer', 'reorder'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setMessage(null); }}
              className={`flex-1 px-4 py-3 text-sm font-medium ${tab === t ? 'bg-violet-100 text-violet-800 border-b-2 border-violet-600' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t === 'adjust' ? 'Adjust stock' : t === 'transfer' ? 'Transfer' : 'Min/Max/Reorder'}
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
        </div>
      </div>
    </div>
  );
}

export default InventoryActionsModal;
