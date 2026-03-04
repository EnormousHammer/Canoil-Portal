/**
 * ERP Portal — Unified hub for all new ERP features (Phase 1-4).
 * Customers, Sales Orders, Shipments, Invoices, Approvals, MRP,
 * QC, Financials, Sage Browser, Notifications, Audit Log.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../utils/portalApi';

type ERPSection = 'overview' | 'customers' | 'sales-orders' |
  'financials' |
  'sage-browser' | 'sage-analytics' | 'item-mapping';

interface ERPPortalProps {
  data?: any;
  currentUser?: any;
}

const SECTIONS: { id: ERPSection; label: string; icon: string; desc: string }[] = [
  { id: 'overview',       label: 'Overview',       icon: '◈',  desc: 'System status & summary' },
  { id: 'customers',      label: 'Customers',      icon: '◎',  desc: 'Sage 50 customer master' },
  { id: 'sales-orders',   label: 'Sales Orders',   icon: '▤',  desc: 'Active orders' },
  { id: 'financials',     label: 'Financials',     icon: '▤',  desc: 'AR aging, invoices, margins, GL' },
  { id: 'sage-analytics', label: 'Sage Analytics', icon: '▤',  desc: 'Revenue & customer analytics' },
  { id: 'sage-browser',   label: 'Sage Browser',   icon: '◈',  desc: 'Sage 50 live data' },
  { id: 'item-mapping',   label: 'Item Mapping',   icon: '⬡',  desc: 'MiSys ↔ Sage mapping' },
];

const NAV_GROUPS: { label: string; ids: ERPSection[] }[] = [
  { label: 'Overview',      ids: ['overview'] },
  { label: 'Operations',    ids: ['sales-orders'] },
  { label: 'CRM',           ids: ['customers'] },
  { label: 'Finance',       ids: ['financials'] },
  { label: 'Sage 50',       ids: ['sage-analytics', 'sage-browser', 'item-mapping'] },
];

export const ERPPortal: React.FC<ERPPortalProps> = ({ data, currentUser }) => {
  const [section, setSection] = useState<ERPSection>('overview');
  const active = SECTIONS.find(s => s.id === section)!;

  return (
    <div
      className="flex rounded-2xl overflow-hidden border border-slate-200 shadow-xl"
      style={{ height: 'calc(100vh - 200px)', minHeight: '640px' }}
    >
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 flex flex-col bg-slate-950 border-r border-white/5">
        {/* Brand strip */}
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">ERP Portal</p>
          <p className="text-[11px] text-slate-600 mt-0.5 tracking-tight">Enterprise System</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-enterprise py-2">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-1">
              <p className="px-5 pt-4 pb-1.5 text-[9px] font-bold tracking-[0.22em] text-slate-600 uppercase select-none">
                {group.label}
              </p>
              {group.ids.map(id => {
                const s = SECTIONS.find(x => x.id === id)!;
                const isActive = section === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSection(id)}
                    className={`w-full flex items-center gap-2.5 px-5 py-2 text-[13px] font-medium transition-all duration-100 text-left
                      ${isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                  >
                    <span className={`text-[11px] leading-none tabular-nums w-3.5 text-center flex-shrink-0 ${isActive ? 'text-blue-200' : 'text-slate-600'}`}>
                      {s.icon}
                    </span>
                    <span className="truncate tracking-[-0.01em]">{s.label}</span>
                    {isActive && <div className="ml-auto w-1 h-3.5 rounded-full bg-blue-300/60 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10">
          <p className="text-[10px] text-slate-700 tracking-tight">Sage G Drive · Read-only</p>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
        {/* Content header bar */}
        <div className="flex-shrink-0 flex items-center gap-4 px-7 py-4 border-b border-slate-100 bg-white">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight leading-tight truncate">
              {active.label}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5 tracking-tight">{active.desc}</p>
          </div>
        </div>

        {/* Scrollable section body */}
        <div className="flex-1 overflow-y-auto scrollbar-enterprise">
          <div className="p-7">
            {section === 'overview'       && <ERPOverview onNavigate={setSection} />}
            {section === 'customers'      && <CustomerSection />}
            {section === 'sales-orders'   && <SalesOrderSection data={data} />}
            {section === 'financials'     && <FinancialSection />}
            {section === 'sage-analytics' && <SageAnalyticsSection />}
            {section === 'sage-browser'   && <SageBrowserSection />}
            {section === 'item-mapping'   && <ItemMappingSection data={data} />}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// OVERVIEW
// ============================================================
const ERPOverview: React.FC<{ onNavigate: (s: ERPSection) => void }> = ({ onNavigate }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Checking data…');
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const fetchStatus = async () => {
    const r = await apiGet('/api/sage/gdrive/status');
    return r.data;
  };

  const triggerLoad = async () => {
    await apiPost('/api/sage/gdrive/load', {});
  };

  const load = async (autoLoadIfEmpty = true) => {
    setLoading(true);
    setLoadingMsg('Checking data…');
    const st = await fetchStatus();
    // If cache is empty, auto-trigger a load so user sees real numbers immediately
    if (autoLoadIfEmpty && (!st?.cache_loaded || !st?.row_counts || Object.keys(st.row_counts || {}).length === 0)) {
      setLoadingMsg('Loading Sage data from Google Drive… (first load takes ~30s)');
      await triggerLoad();
      const st2 = await fetchStatus();
      setStatus(st2);
    } else {
      setStatus(st);
    }
    setLoadedAt(new Date());
    setLoading(false);
  };

  const forceRefresh = async () => {
    setRefreshing(true);
    setLoadingMsg('Refreshing from Google Drive…');
    await triggerLoad();
    const st = await fetchStatus();
    setStatus(st);
    setLoadedAt(new Date());
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rc = status?.row_counts || {};
  const folder = status?.cache_folder || status?.latest_folder || '—';
  // Try to parse the folder name as a date (e.g. "2024-11-15" or "Nov 15 2024")
  const folderDate = folder && folder !== '—' ? (() => {
    try {
      const d = new Date(folder);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { /* ignore */ }
    return folder;
  })() : '—';

  const ageSeconds = status?.cache_age_seconds;
  const ageLabel = ageSeconds != null
    ? ageSeconds < 120 ? 'Just now'
    : ageSeconds < 3600 ? `${Math.floor(ageSeconds / 60)} min ago`
    : ageSeconds < 86400 ? `${Math.floor(ageSeconds / 3600)}h ago`
    : `${Math.floor(ageSeconds / 86400)}d ago`
    : null;

  const tables: { label: string; key: string; color: string; icon: string }[] = [
    { label: 'Customers',         key: 'tcustomr', color: 'blue',   icon: '◎' },
    { label: 'Sales Orders',      key: 'tsalordr', color: 'emerald',icon: '▤' },
    { label: 'Inventory Items',   key: 'tinvent',  color: 'violet', icon: '⬡' },
    { label: 'Vendors',           key: 'tvendor',  color: 'orange', icon: '◈' },
    { label: 'SO Line Items',     key: 'tsoline',  color: 'teal',   icon: '≡' },
    { label: 'Transactions',      key: 'titrec',   color: 'pink',   icon: '⬤' },
    { label: 'Transaction Lines', key: 'titrline', color: 'rose',   icon: '≋' },
    { label: 'AR Transactions',   key: 'tcustr',   color: 'amber',  icon: '◑' },
    { label: 'Price Records',     key: 'tinvprc',  color: 'indigo', icon: '◇' },
    { label: 'Stock by Location', key: 'tinvbyln', color: 'cyan',   icon: '◫' },
  ];

  const colorMap: Record<string, string> = {
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    violet:  'bg-violet-50 border-violet-200 text-violet-700',
    orange:  'bg-orange-50 border-orange-200 text-orange-700',
    teal:    'bg-teal-50 border-teal-200 text-teal-700',
    pink:    'bg-pink-50 border-pink-200 text-pink-700',
    rose:    'bg-rose-50 border-rose-200 text-rose-700',
    amber:   'bg-amber-50 border-amber-200 text-amber-700',
    indigo:  'bg-indigo-50 border-indigo-200 text-indigo-700',
    cyan:    'bg-cyan-50 border-cyan-200 text-cyan-700',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <svg className="w-8 h-8 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm text-slate-500 text-center max-w-xs">{loadingMsg}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Canoil Canada</h2>
          <p className="text-sm text-slate-500 mt-0.5">Sage 50 · Read-Only Data Snapshot</p>
        </div>
        <button
          onClick={forceRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh Data'}
        </button>
      </div>

      {/* Data source info bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
          <span className="font-semibold text-slate-800">Sage 50 · G Drive Export</span>
        </div>
        {folderDate !== '—' && (
          <>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Export folder:</span>
              <span className="font-medium text-slate-700">{folderDate}</span>
            </div>
          </>
        )}
        {loadedAt && (
          <>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Last loaded:</span>
              <span className="font-medium text-slate-700">
                {loadedAt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                {ageLabel && ageLabel !== 'Just now' && <span className="text-slate-400 ml-1">({ageLabel})</span>}
              </span>
            </div>
          </>
        )}
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Mode:</span>
          <span className="font-medium text-slate-700">{status?.is_cloud ? 'Cloud' : 'Local G: Drive'}</span>
        </div>
      </div>

      {/* Record counts grid */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3">Loaded Records</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {tables.map(t => {
            const count = rc[t.key];
            const cls = colorMap[t.color] || colorMap.blue;
            return (
              <div key={t.key} className={`flex flex-col gap-1 p-4 rounded-xl border ${cls}`}>
                <span className="text-lg leading-none">{t.icon}</span>
                <span className="text-2xl font-bold mt-1 tabular-nums">
                  {count != null ? count.toLocaleString() : <span className="text-slate-300 text-base">—</span>}
                </span>
                <span className="text-xs font-medium opacity-75">{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick nav */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3">Jump To</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Sales Orders', desc: `${(rc['tsalordr'] || 0).toLocaleString()} orders`, id: 'sales-orders', color: 'hover:border-emerald-400 hover:bg-emerald-50' },
            { label: 'Customers',    desc: `${(rc['tcustomr'] || 0).toLocaleString()} accounts`, id: 'customers', color: 'hover:border-blue-400 hover:bg-blue-50' },
            { label: 'Financials',   desc: 'AR aging & invoices', id: 'financials', color: 'hover:border-pink-400 hover:bg-pink-50' },
            { label: 'Sage Analytics', desc: 'Revenue & trends', id: 'sage-analytics', color: 'hover:border-violet-400 hover:bg-violet-50' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ERPSection)}
              className={`flex flex-col items-start gap-1 p-4 bg-white border-2 border-slate-100 rounded-xl transition-all ${item.color}`}
            >
              <span className="text-sm font-semibold text-slate-800">{item.label}</span>
              <span className="text-xs text-slate-500">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// CUSTOMERS (Sage G Drive CSV — read-only)
// ============================================================
const CustomerSection: React.FC = () => {
  const [all, setAll] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('');
  const [currency, setCurrency] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'ytd' | 'lastSale'>('ytd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await apiGet('/api/sage/gdrive/customers?limit=500&inactive=true');
    if (r.data?.error) { setError(r.data.error); setLoading(false); return; }
    setAll(r.data?.customers || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const provinces = [...new Set(all.map((c: any) => c.sProvState).filter(Boolean))].sort();
  const currencies = [...new Set(all.map((c: any) => c.sCurrncyId === 2 ? 'USD' : 'CAD').filter(Boolean))].sort();

  const visible = all
    .filter((c: any) => {
      if (!showInactive && c.bInactive) return false;
      if (province && c.sProvState !== province) return false;
      if (currency) {
        const cur = c.sCurrncyId === 2 ? 'USD' : 'CAD';
        if (cur !== currency) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (c.sName || '').toLowerCase().includes(q) ||
               (c.sCity || '').toLowerCase().includes(q) ||
               (c.sEmail || '').toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'ytd') return (b.dAmtYtd ?? 0) - (a.dAmtYtd ?? 0);
      if (sortBy === 'lastSale') return (b.dtLastSal ?? '') > (a.dtLastSal ?? '') ? 1 : -1;
      return (a.sName ?? '').localeCompare(b.sName ?? '');
    });

  const fmt$ = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })}` : '—';

  return (
    <div className="flex flex-col gap-4">
      {/* Filters bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, city, email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400"
          />
        </div>

        <select value={province} onChange={e => setProvince(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-700">
          <option value="">All Provinces</option>
          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={currency} onChange={e => setCurrency(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-700">
          <option value="">All Currencies</option>
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-700">
          <option value="ytd">Sort: YTD Sales ↓</option>
          <option value="name">Sort: Name A–Z</option>
          <option value="lastSale">Sort: Last Sale</option>
        </select>

        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none px-3 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-blue-600" />
          Inactive
        </label>

        <span className="ml-auto text-xs text-slate-400 whitespace-nowrap font-medium">
          {visible.length} of {all.filter((c: any) => showInactive || !c.bInactive).length}
        </span>
      </div>

      {/* Table */}
      {error ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-amber-800">
          <p className="font-semibold text-sm">Could not load Sage customers</p>
          <p className="text-xs mt-1 text-amber-600">{error}</p>
          <button onClick={load} className="mt-3 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-3 py-12 text-slate-400 text-sm">
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading customers from Sage G Drive…
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Customer', 'Location', 'Contact', 'YTD Sales', 'Prior Yr', 'Credit Limit', 'Terms', 'Last Sale', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.slice(0, 200).map((c: any, i: number) => (
                <tr key={i} className={`hover:bg-blue-50/40 transition-colors ${c.bInactive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 pl-5">
                    <p className="font-semibold text-slate-800 truncate max-w-[180px]" title={c.sName}>{c.sName}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {[c.sCity, c.sProvState].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-slate-600 truncate max-w-[160px]">{c.sPhone || '—'}</div>
                    {c.sEmail && <div className="text-slate-400 text-[11px] truncate max-w-[160px]">{c.sEmail}</div>}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-emerald-700 whitespace-nowrap">
                    {fmt$(c.dAmtYtd)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[12px]">
                    {fmt$(c.dLastYrAmt)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                    {c.dCrLimit != null && c.dCrLimit >= 0 ? fmt$(c.dCrLimit) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {c.nNetDay ? `Net ${c.nNetDay}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {c.dtLastSal ? String(c.dtLastSal).substring(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.bInactive ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {c.bInactive ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No customers match the current filters</div>
          )}
          {visible.length > 200 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
              Showing 200 of {visible.length} — refine your search to see more
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// SHARED: Coming Soon placeholder
// ============================================================
const ComingSoon: React.FC<{ feature: string; description: string; items?: string[] }> = ({ feature, description, items }) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
      <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </div>
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold uppercase tracking-widest mb-3">
      Coming Soon
    </span>
    <h3 className="text-lg font-bold text-slate-800 tracking-tight">{feature}</h3>
    <p className="text-sm text-slate-500 mt-2 max-w-md leading-relaxed">{description}</p>
    {items && items.length > 0 && (
      <ul className="mt-4 space-y-1.5 text-left max-w-xs w-full">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px] text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ============================================================
// SALES ORDERS (read from Sage G Drive — same source as Customers)
// ============================================================
const SalesOrderSection: React.FC<{ data?: any }> = () => {
  const [all, setAll] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'quote' | 'cleared'>('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await apiGet('/api/sage/gdrive/sales-orders?limit=500');
    if (r.data?.error) { setError(r.data.error); setLoading(false); return; }
    setAll(r.data?.sales_orders || []);
    setTotal(r.data?.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = all.filter((o: any) => {
    if (statusFilter === 'open' && (o.bCleared || o.bQuote)) return false;
    if (statusFilter === 'quote' && !o.bQuote) return false;
    if (statusFilter === 'cleared' && !o.bCleared) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.sSONum || '').toLowerCase().includes(q) ||
             (o.sCustomerName || '').toLowerCase().includes(q) ||
             (o.sName || '').toLowerCase().includes(q);
    }
    return true;
  });

  const fmt$ = (n: number | null | undefined, cId?: number) => {
    if (n == null) return '—';
    const cur = cId === 2 ? 'USD' : 'CAD';
    return n.toLocaleString('en-CA', { style: 'currency', currency: cur, maximumFractionDigits: 0 });
  };

  const soStatus = (o: any) => {
    if (o.bQuote) return { label: 'Quote', cls: 'bg-blue-100 text-blue-700' };
    if (o.bCleared) return { label: 'Cleared', cls: 'bg-slate-100 text-slate-500' };
    if (o.nFilled === 2) return { label: 'Filled', cls: 'bg-emerald-100 text-emerald-700' };
    if (o.nFilled === 1) return { label: 'Partial', cls: 'bg-amber-100 text-amber-700' };
    return { label: 'Open', cls: 'bg-cyan-100 text-cyan-700' };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SO#, customer…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400" />
        </div>
        {(['all', 'open', 'quote', 'cleared'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors capitalize ${
              statusFilter === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {s}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 font-medium">{visible.length} of {total}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded">
          Read-only · Sage G Drive
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded">
          Write coming soon
        </span>
      </div>

      {error ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-amber-800 text-sm">
          <p className="font-semibold">Could not load Sage sales orders</p>
          <p className="text-xs mt-1 text-amber-600">{error}</p>
          <button onClick={load} className="mt-3 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold">Retry</button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-3 py-12 text-slate-400 text-sm">
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading sales orders from Sage G Drive…
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['SO #', 'Customer', 'SO Date', 'Ship Date', 'Total', 'Status', 'Shipper'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.slice(0, 200).map((o: any, i: number) => {
                const st = soStatus(o);
                return (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 pl-5 font-mono font-semibold text-blue-700">{o.sSONum || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[180px] truncate">{o.sCustomerName || o.sName || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{o.dtSODate ? String(o.dtSODate).substring(0, 10) : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{o.dtShipDate ? String(o.dtShipDate).substring(0, 10) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-emerald-700 whitespace-nowrap">{fmt$(o.dTotal, o.lCurrncyId)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-[12px]">{o.sShipper || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No orders match the current filters</div>}
        </div>
      )}
    </div>
  );
};


// ============================================================
// INVOICES — AR Aging + Recent Invoices from Sage G Drive
// ============================================================
const InvoiceSection: React.FC = () => {
  const [arAging, setArAging] = useState<any>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'ar' | 'invoices'>('ar');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [arRes, invRes] = await Promise.all([
      apiGet('/api/sage/gdrive/analytics/ar-aging'),
      apiGet('/api/sage/gdrive/analytics/recent-invoices?limit=100'),
    ]);
    if (arRes.data?.error) { setError(arRes.data.error); }
    else { setArAging(arRes.data); }
    setRecentInvoices(invRes.data?.invoices || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtFull = (n: number | null | undefined) =>
    n != null ? n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }) : '—';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded">
          Read-only · Sage G Drive
        </span>
        <div className="flex gap-1">
          <button onClick={() => setTab('ar')} className={`px-2 py-1 text-xs font-semibold rounded ${tab === 'ar' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>AR Aging</button>
          <button onClick={() => setTab('invoices')} className={`px-2 py-1 text-xs font-semibold rounded ${tab === 'invoices' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Recent Invoices</button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-amber-800 text-sm">
          <p className="font-semibold">Could not load AR aging from Sage G Drive</p>
          <p className="text-xs mt-1 text-amber-600">{error}</p>
          <button onClick={load} className="mt-3 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold">Retry</button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-3 py-12 text-slate-400 text-sm">
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading AR aging from Sage G Drive…
        </div>
      ) : tab === 'invoices' ? (
        <div>
          <p className="text-sm text-slate-500 mb-3">Recent invoice transactions from titrec (last 100)</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.map((inv: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-slate-600">{inv.dtASDate || '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 max-w-[200px] truncate">{inv.sName || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{inv.sSource || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800">{fmtFull(inv.dInvAmt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentInvoices.length === 0 && !loading && <div className="text-center py-12 text-slate-400 text-sm">No invoice data in titrec</div>}
          </div>
        </div>
      ) : arAging ? (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl text-white">
              <p className="text-xs font-medium opacity-80">Total AR Outstanding</p>
              <p className="text-xl font-bold tabular-nums">{fmtFull(arAging.total_ar)}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-4 rounded-xl text-white">
              <p className="text-xs font-medium opacity-80">Customers with Balance</p>
              <p className="text-xl font-bold">{arAging.total_customers ?? '—'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Customer', 'Current (0–30)', '31–60 Days', '61–90 Days', '91–120 Days', '120+ Days', 'Total'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(arAging.aging || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 pl-5 font-semibold text-slate-800 max-w-[200px] truncate">{row.sName}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">{row.current ? fmtFull(row.current) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-amber-700 whitespace-nowrap">{row.d30 ? fmtFull(row.d30) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-orange-700 whitespace-nowrap">{row.d60 ? fmtFull(row.d60) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-red-600 whitespace-nowrap">{row.d90 ? fmtFull(row.d90) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-red-700 font-bold whitespace-nowrap">{row.d90plus ? fmtFull(row.d90plus) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800 whitespace-nowrap">{fmtFull(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(arAging.aging?.length) && <div className="text-center py-12 text-slate-400 text-sm">No AR data found</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
};


// ============================================================
// FINANCIALS — uses Sage G Drive for AR; rest coming soon
// ============================================================
const FinancialSection: React.FC = () => {
  const [tab, setTab] = useState<'ar' | 'margins' | 'gl' | 'reports'>('ar');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'ar', label: 'AR & Invoices', live: true },
          { id: 'margins', label: 'Margin Analysis', live: true },
          { id: 'gl', label: 'GL Summary', live: false },
          { id: 'reports', label: 'Month-End Reports', live: false },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
            {!t.live && <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Soon</span>}
          </button>
        ))}
      </div>
      {tab === 'ar' && <InvoiceSection />}
      {tab === 'margins' && <MarginAnalysisSection />}
      {tab === 'gl' && (
        <ComingSoon feature="GL Summary" description="General ledger summary pulled from Sage 50 — assets, liabilities, revenue, and expenses."
          items={['Balance sheet summary', 'Income statement view', 'Period comparisons']} />
      )}
      {tab === 'reports' && (
        <ComingSoon feature="Month-End Reports" description="Automated month-end financial packages generated from Sage 50 G Drive data."
          items={['AR/AP aging summaries', 'Revenue by month', 'Inventory valuation snapshots']} />
      )}
    </div>
  );
};


// ============================================================
// MARGIN ANALYSIS (from Sage titrline — real COGS vs Revenue)
// ============================================================
const MarginAnalysisSection: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'margin' | 'revenue' | 'cogs'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [minMargin, setMinMargin] = useState('');
  const [maxMargin, setMaxMargin] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    apiGet('/api/sage/gdrive/analytics/sales-by-product?limit=500')
      .then(r => {
        if (r.data?.error) { setError(r.data.error); setLoading(false); return; }
        setItems(r.data?.products || []);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const fmtC = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  const fmtPct = (n: number | null) => n != null ? `${n.toFixed(1)}%` : '—';

  const toggle = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const filtered = items
    .filter(i => i.estimated_margin_pct != null)
    .filter(i => !search || (i.sPartCode + ' ' + i.sName).toLowerCase().includes(search.toLowerCase()))
    .filter(i => minMargin === '' || i.estimated_margin_pct >= parseFloat(minMargin))
    .filter(i => maxMargin === '' || i.estimated_margin_pct <= parseFloat(maxMargin));

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'desc' ? -1 : 1;
    if (sortBy === 'margin') return dir * ((a.estimated_margin_pct ?? 0) - (b.estimated_margin_pct ?? 0));
    if (sortBy === 'cogs') return dir * (a.total_cogs - b.total_cogs);
    return dir * (a.total_revenue - b.total_revenue);
  });

  // Summary stats
  const withMargin = items.filter(i => i.estimated_margin_pct != null);
  const avgMargin = withMargin.length ? withMargin.reduce((s, i) => s + i.estimated_margin_pct, 0) / withMargin.length : null;
  const totalRevenue = withMargin.reduce((s, i) => s + i.total_revenue, 0);
  const totalCogs = withMargin.reduce((s, i) => s + i.total_cogs, 0);
  const blendedMargin = totalRevenue > 0 ? (totalRevenue - totalCogs) / totalRevenue * 100 : null;
  const belowTwenty = withMargin.filter(i => i.estimated_margin_pct < 20).length;
  const topItem = [...withMargin].sort((a, b) => b.estimated_margin_pct - a.estimated_margin_pct)[0];
  const bottomItem = [...withMargin].sort((a, b) => a.estimated_margin_pct - b.estimated_margin_pct)[0];

  const marginColor = (m: number | null) => {
    if (m == null) return 'text-slate-400';
    if (m >= 40) return 'text-emerald-600 font-semibold';
    if (m >= 25) return 'text-green-600 font-semibold';
    if (m >= 15) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  };
  const marginBg = (m: number | null) => {
    if (m == null) return 'bg-slate-200';
    if (m >= 40) return 'bg-emerald-500';
    if (m >= 25) return 'bg-green-500';
    if (m >= 15) return 'bg-amber-400';
    return 'bg-red-500';
  };

  if (loading) return (
    <div className="flex items-center gap-3 py-12 text-slate-500">
      <svg className="animate-spin h-5 w-5 text-pink-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Loading margin data from Sage transactions…
    </div>
  );

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-red-700 text-sm">{error}</div>
  );

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <span className={`ml-1 text-[10px] ${sortBy === col ? 'text-slate-800' : 'text-slate-300'}`}>
      {sortBy === col ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Blended Margin</p>
          <p className={`text-2xl mt-1 font-bold ${marginColor(blendedMargin)}`}>{fmtPct(blendedMargin)}</p>
          <p className="text-xs text-slate-400 mt-0.5">all-time, {withMargin.length} items</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Avg Item Margin</p>
          <p className={`text-2xl mt-1 font-bold ${marginColor(avgMargin)}`}>{fmtPct(avgMargin)}</p>
          <p className="text-xs text-slate-400 mt-0.5">per-SKU average</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Best Margin Item</p>
          <p className="text-lg mt-1 font-bold text-emerald-600 truncate">{topItem?.sPartCode || '—'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtPct(topItem?.estimated_margin_pct ?? null)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 border-l-4 border-l-red-400">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Below 20% Margin</p>
          <p className="text-2xl mt-1 font-bold text-red-600">{belowTwenty}</p>
          <p className="text-xs text-slate-400 mt-0.5">items need attention</p>
        </div>
      </div>

      {/* Top 5 & Bottom 5 visual bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top 5 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Top 5 by Margin %</p>
          <div className="flex flex-col gap-2">
            {[...withMargin].sort((a, b) => b.estimated_margin_pct - a.estimated_margin_pct).slice(0, 5).map(i => (
              <div key={i.lInventId} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-24 truncate flex-shrink-0" title={i.sName}>{i.sPartCode}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full ${marginBg(i.estimated_margin_pct)}`} style={{ width: `${Math.min(i.estimated_margin_pct, 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-emerald-600 w-10 text-right">{fmtPct(i.estimated_margin_pct)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Bottom 5 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 border-l-4 border-l-red-300">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Bottom 5 — Needs Review</p>
          <div className="flex flex-col gap-2">
            {[...withMargin].sort((a, b) => a.estimated_margin_pct - b.estimated_margin_pct).slice(0, 5).map(i => (
              <div key={i.lInventId} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-24 truncate flex-shrink-0" title={i.sName}>{i.sPartCode}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full ${marginBg(i.estimated_margin_pct)}`} style={{ width: `${Math.max(Math.min(i.estimated_margin_pct, 100), 2)}%` }} />
                </div>
                <span className={`text-xs font-semibold w-10 text-right ${marginColor(i.estimated_margin_pct)}`}>{fmtPct(i.estimated_margin_pct)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters + full table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-100 bg-slate-50">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SKU or name…"
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 w-44" />
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span>Margin</span>
            <input value={minMargin} onChange={e => setMinMargin(e.target.value)} placeholder="min %" type="number"
              className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <span>–</span>
            <input value={maxMargin} onChange={e => setMaxMargin(e.target.value)} placeholder="max %" type="number"
              className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-pink-300" />
          </div>
          <span className="ml-auto text-xs text-slate-400">{sorted.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-semibold">SKU</th>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-right font-semibold cursor-pointer select-none hover:text-slate-800" onClick={() => toggle('revenue')}>Revenue <SortIcon col="revenue" /></th>
                <th className="px-4 py-2.5 text-right font-semibold cursor-pointer select-none hover:text-slate-800" onClick={() => toggle('cogs')}>COGS <SortIcon col="cogs" /></th>
                <th className="px-4 py-2.5 text-right font-semibold">Gross Profit</th>
                <th className="px-4 py-2.5 text-right font-semibold cursor-pointer select-none hover:text-slate-800" onClick={() => toggle('margin')}>Margin % <SortIcon col="margin" /></th>
                <th className="px-4 py-2.5 text-left font-semibold w-24">Visual</th>
                <th className="px-4 py-2.5 text-right font-semibold">Qty Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.slice(0, 100).map(i => {
                const gp = i.total_revenue - i.total_cogs;
                return (
                  <tr key={i.lInventId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{i.sPartCode}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={i.sName}>{i.sName || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-800 tabular-nums">{fmtC(i.total_revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{fmtC(i.total_cogs)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-700">{fmtC(gp)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${marginColor(i.estimated_margin_pct)}`}>{fmtPct(i.estimated_margin_pct)}</td>
                    <td className="px-4 py-2.5">
                      <div className="bg-slate-100 rounded-full h-1.5 w-20 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${marginBg(i.estimated_margin_pct)}`}
                          style={{ width: `${Math.max(Math.min(i.estimated_margin_pct ?? 0, 100), 1)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{i.total_qty > 0 ? i.total_qty.toLocaleString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <p className="text-center text-slate-400 py-10 text-sm">No items match your filters.</p>
          )}
          {sorted.length > 100 && (
            <p className="text-center text-slate-400 py-3 text-xs border-t border-slate-100">Showing top 100 of {sorted.length}. Use filters to narrow.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Source: Sage 50 transaction lines (titrline) — revenue from <code>dAmt</code>, COGS from <code>dCost</code>. All-time figures.
      </p>
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
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'movers' | 'revenue' | 'products'>('overview');
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  // selectedYear: number = specific year; 0 = "All Time" (only applies to products/revenue tabs)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [kpis, setKpis] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [bestMovers, setBestMovers] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any>(null);
  const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrentYear = selectedYear === currentYear;
  // year param for API: omit for "all time" (0), otherwise pass the year
  const yearQS = (y: number) => y > 0 ? `year=${y}` : '';

  // Fetch available years once on mount (includes date_range for year-to-year debugging)
  const [yearsMeta, setYearsMeta] = useState<{ date_range?: { min: string; max: string }; note?: string } | null>(null);
  useEffect(() => {
    apiGet('/api/sage/gdrive/analytics/available-years').then(r => {
      const years: number[] = r.data?.years || [currentYear];
      setAvailableYears(years);
      setYearsMeta(r.data?.date_range || r.data?.note ? { date_range: r.data.date_range, note: r.data.note } : null);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    // For KPIs and top customers, "All Time" (y=0) defaults to current-year Sage fields
    const ky = y > 0 ? y : currentYear;
    try {
      const [kpisRes, custRes] = await Promise.all([
        apiGet(`/api/sage/gdrive/analytics/kpis?year=${ky}`),
        apiGet(`/api/sage/gdrive/analytics/top-customers?limit=25&year=${ky}`),
      ]);
      if (kpisRes.data?.error) { setError(kpisRes.data.error); setLoading(false); return; }
      setKpis(kpisRes.data);
      setTopCustomers(custRes.data?.customers || []);
      setLoading(false);
    } catch (e: any) {
      setError(String(e));
      setLoading(false);
    }
  }, [currentYear]);

  // When year changes: clear cached tab data and reload KPIs + customers
  useEffect(() => {
    setBestMovers([]);
    setMonthlyRevenue(null);
    setSalesByProduct([]);
    load(selectedYear);
  }, [selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTab = useCallback(async (tab: string, y: number) => {
    if (tab === 'movers') {
      const ky = y > 0 ? y : currentYear;
      const r = await apiGet(`/api/sage/gdrive/analytics/best-movers?limit=25&year=${ky}`);
      setBestMovers(r.data?.items || []);
    }
    if (tab === 'revenue') {
      const ky = y > 0 ? y : currentYear;
      const r = await apiGet(`/api/sage/gdrive/analytics/monthly-revenue?year=${ky}`);
      setMonthlyRevenue(r.data);
    }
    if (tab === 'products') {
      const qs = yearQS(y);
      const r = await apiGet(`/api/sage/gdrive/analytics/sales-by-product?limit=25${qs ? `&${qs}` : ''}`);
      setSalesByProduct(r.data?.products || []);
    }
  }, [currentYear]);

  useEffect(() => { loadTab(activeTab, selectedYear); }, [activeTab, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <button onClick={() => load(selectedYear)} className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">
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
    { id: 'products', label: 'Sales by Product' },
  ] as const;

  // Dynamic column header labels based on selected year
  const ytdLabel = isCurrentYear ? `${currentYear} YTD` : `${selectedYear > 0 ? selectedYear : currentYear} Total`;
  const priorLabel = isCurrentYear ? `${currentYear - 1} Total` : `${(selectedYear > 0 ? selectedYear : currentYear) - 1} Total`;

  return (
    <div>
      {/* Section header with global year picker */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h2 className="text-2xl font-bold text-slate-800">Sage Analytics</h2>
        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          READ-ONLY · G Drive CSV{kpis?.data_folder ? ` · ${kpis.data_folder}` : ''}
        </span>
        {yearsMeta?.date_range && (
          <span className="text-xs text-slate-500" title={yearsMeta.note || 'Data date range in titrec'}>
            Data: {yearsMeta.date_range.min} → {yearsMeta.date_range.max}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                selectedYear === y
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700'
              }`}
            >
              {y === currentYear ? `${y} YTD` : String(y)}
            </button>
          ))}
          <button
            onClick={() => setSelectedYear(0)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
              selectedYear === 0
                ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* KPI Header */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-xl text-white">
            <p className="text-xs font-medium opacity-80">{ytdLabel} Revenue</p>
            <p className="text-xl font-bold tabular-nums">{fmt(kpis.total_ytd_revenue)}</p>
            <p className={`text-xs font-semibold mt-1 ${(kpis.yoy_revenue_pct ?? 0) >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
              {fmtPct(kpis.yoy_revenue_pct)} vs {priorLabel}
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
            <p className="text-xs font-medium opacity-80">{priorLabel} Revenue</p>
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
          <h3 className="text-base font-bold text-slate-700 mb-3">Top 10 Customers — {ytdLabel} Revenue</h3>
          <AnalyticsTable
            data={topCustomers.slice(0, 10)}
            columns={[
              { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
              { key: 'sName', label: 'Customer', render: (v: string) => <span className="font-semibold text-slate-800">{v}</span> },
              { key: 'dAmtYtd', label: ytdLabel, render: (v: number) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v)}</span> },
              { key: 'dLastYrAmt', label: priorLabel, render: (v: number) => <span className="font-mono text-slate-600">{fmtFull(v)}</span> },
              { key: 'yoy_change_pct', label: 'YoY', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(v)}</span> },
              { key: 'credit_utilization_pct', label: 'Credit Used', render: (v: number | null) => (
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
          <h3 className="text-base font-bold text-slate-700 mb-3">All Customers — {ytdLabel} Revenue</h3>
          <AnalyticsTable
            data={topCustomers}
            columns={[
              { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
              { key: 'sName', label: 'Customer', render: (v: string) => <span className="font-semibold text-slate-800">{v}</span> },
              { key: 'sCity', label: 'City', render: (v: string, _: any, row: any) => <span className="text-slate-500">{v}{row.sProvState ? `, ${row.sProvState}` : ''}</span> },
              { key: 'currency', label: 'Currency' },
              { key: 'price_list', label: 'Price List' },
              { key: 'dAmtYtd', label: ytdLabel, render: (v: number, _: any, row: any) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v, row.currency || 'CAD')}</span> },
              { key: 'dLastYrAmt', label: priorLabel, render: (v: number, _: any, row: any) => <span className="font-mono text-slate-600">{fmtFull(v, row.currency || 'CAD')}</span> },
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
          <h3 className="text-base font-bold text-slate-700 mb-3">Best Moving Items — {ytdLabel} Units Sold</h3>
          {bestMovers.length === 0 ? <p className="text-slate-400 text-sm py-4">Loading…</p> : (
            <AnalyticsTable
              data={bestMovers}
              columns={[
                { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
                { key: 'sPartCode', label: 'Part Code', render: (v: string) => <span className="font-mono font-semibold text-blue-700">{v}</span> },
                { key: 'sName', label: 'Description', render: (v: string) => <span className="text-slate-700">{v}</span> },
                { key: 'dYTDUntSld', label: `${ytdLabel} Units`, render: (v: number, _: any, row: any) => <span className="font-mono font-bold text-slate-800">{v.toLocaleString()} {row.sSellUnit}</span> },
                { key: 'dPrUntSld', label: `${priorLabel} Units`, render: (v: number) => <span className="font-mono text-slate-500">{v.toLocaleString()}</span> },
                { key: 'units_yoy_pct', label: 'Units YoY', render: (v: number | null) => <span className={`font-semibold text-xs ${v == null ? 'text-slate-400' : v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(v)}</span> },
                { key: 'dYTDAmtSld', label: `${ytdLabel} Revenue`, render: (v: number) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v)}</span> },
                { key: 'dYTDCOGS', label: `${ytdLabel} COGS`, render: (v: number) => <span className="font-mono text-slate-600">{fmtFull(v)}</span> },
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
            <h3 className="text-base font-bold text-slate-700">
              Monthly Revenue — {selectedYear > 0 ? selectedYear : currentYear}
              {isCurrentYear && <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">YTD</span>}
            </h3>
          </div>
          {!monthlyRevenue ? <p className="text-slate-400 text-sm py-4">Loading…</p> : (
            <div>
              <div className="mb-4 text-sm text-slate-600">
                Total {monthlyRevenue.year}: <span className="font-bold text-emerald-700">{fmtFull(monthlyRevenue.total_revenue)}</span>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-end gap-1.5 h-48">
                  {(() => {
                    const maxRev = Math.max(...(monthlyRevenue.months || []).map((m: any) => m.revenue || 0), 1);
                    return (monthlyRevenue.months || []).map((m: any) => {
                      const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
                      const isCurrentMonth = m.month === new Date().getMonth() + 1 && monthlyRevenue.year === currentYear;
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

      {activeTab === 'products' && (
        <div>
          <h3 className="text-base font-bold text-slate-700 mb-3">
            Sales by Product — {selectedYear > 0 ? ytdLabel : 'All Time'}
          </h3>
          {salesByProduct.length === 0 ? <p className="text-slate-400 text-sm py-4">Loading…</p> : (
            <AnalyticsTable
              data={salesByProduct}
              columns={[
                { key: 'rank', label: '#', render: (_: any, i: number) => <span className="font-bold text-slate-500">{i + 1}</span> },
                { key: 'sPartCode', label: 'Part Code', render: (v: string) => <span className="font-mono font-semibold text-blue-700">{v}</span> },
                { key: 'sName', label: 'Description', render: (v: string) => <span className="text-slate-700">{v}</span> },
                { key: 'total_revenue', label: selectedYear > 0 ? `${ytdLabel} Revenue` : 'All-Time Revenue', render: (v: number) => <span className="font-mono font-bold text-emerald-700">{fmtFull(v)}</span> },
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
          {mappings.length === 0 && !loading && (
            <p className="text-amber-700 text-sm mt-2 font-medium">
              Mapping is empty. Click &quot;Generate Suggestions&quot; to populate. Requires: (1) Main app data loaded, (2) Sage G Drive folder with tinvent.CSV.
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={runSuggest} disabled={suggesting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
            {suggesting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            {suggesting ? 'Generating…' : '🔍 Generate Suggestions'}
          </button>
          <button onClick={bulkConfirmExact} disabled={bulkConfirming || !(stats?.suggested_count > 0)}
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

// Map Sage DB column names to display-friendly keys for grid
const SAGE_COLUMN_ALIASES: Record<string, string> = {
  sName: 'name', sPartCode: 'part_code', sDesc: 'description', sSONum: 'order_no',
  sOrderNum: 'order_no', sAcctNum: 'number', sCntcName: 'contact',
  dAmtYtd: 'ytd_sales', dCrLimit: 'credit_limit', dInStock: 'in_stock',
  dLastCost: 'last_cost', dTotal: 'total', dtOrderDate: 'date', dtSODate: 'date',
  nAcctType: 'type', dYts: 'balance', nType: 'type', dAmount: 'amount', dtDate: 'date',
};

const SageBrowserSection: React.FC = () => {
  const [tab, setTab] = useState<SageTab>('customers');
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelectedRow(null);
    setSearch('');
    setError(null);
    apiGet(SAGE_ENDPOINTS[tab]).then(r => {
      if (!r.ok || r.data?.error) {
        setError(r.data?.error || 'Sage 50 not available');
        setRawData([]);
        setLoading(false);
        return;
      }
      const d = r.data;
      const arr = Array.isArray(d) ? d : d?.data || d?.items || d?.customers || d?.vendors || d?.inventory || d?.accounts || d?.orders || d?.receipts || [];
      // Normalize keys for display (sName -> name, etc.)
      const normalized = Array.isArray(arr) ? arr.map((row: any) => {
        const out: any = { ...row };
        for (const [from, to] of Object.entries(SAGE_COLUMN_ALIASES)) {
          if (row[from] !== undefined && out[to] === undefined) out[to] = row[from];
        }
        return out;
      }) : [];
      setRawData(normalized);
      setLoading(false);
    }).catch(() => {
      setError('Could not connect to Sage 50 — check network and credentials');
      setRawData([]);
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

      {error ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-6 text-amber-800">
          <p className="font-semibold">Sage 50 Browser unavailable</p>
          <p className="text-sm mt-1 text-amber-700">{error}</p>
          <p className="text-xs mt-2 text-amber-600">Sage Browser requires a live connection to Sage 50 Quantum on 192.168.1.11. Ensure SAGE_DB_* env vars are set and the server is reachable.</p>
        </div>
      ) : loading ? (
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
