import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

export type ExportFormat = 'xlsx' | 'csv_single' | 'csv_multiple' | 'xml_single' | 'xml_multiple';

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv_multiple', label: 'Multiple CSV files (.zip)' },
  { value: 'csv_single', label: 'Single CSV file' },
  { value: 'xml_single', label: 'XML (single file)' },
  { value: 'xml_multiple', label: 'XML (multiple files, .zip)' },
];

interface ExportAllCompanyDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportAllCompanyDataModal({ isOpen, onClose }: ExportAllCompanyDataModalProps) {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const buildExportUrl = () => {
    const params = new URLSearchParams();
    if (format === 'xlsx') {
      params.set('format', 'xlsx');
    } else if (format === 'csv_single') {
      params.set('format', 'csv');
      params.set('multiple', 'false');
    } else if (format === 'csv_multiple') {
      params.set('format', 'csv');
      params.set('multiple', 'true');
    } else if (format === 'xml_single') {
      params.set('format', 'xml');
      params.set('multiple', 'false');
    } else {
      params.set('format', 'xml');
      params.set('multiple', 'true');
    }
    return getApiUrl(`/api/export/company-data?${params.toString()}`);
  };

  const getDownloadFilename = () => {
    const base = `company_data_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'xlsx') return `${base}.xlsx`;
    if (format === 'csv_single') return `${base}.csv`;
    if (format === 'csv_multiple' || format === 'xml_multiple') return `${base}.zip`;
    return `${base}.xml`;
  };

  const handleDownload = async () => {
    setStatus('loading');
    setMessage('Preparing export…');
    try {
      const url = buildExportUrl();
      const res = await fetch(url);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = getDownloadFilename();
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) filename = match[1].replace(/['"]/g, '').trim();
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      setStatus('success');
      setMessage('Download started. Check your downloads folder.');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Export failed. Try loading the app data first, then export again.');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-labelledby="export-dialog-title" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 id="export-dialog-title" className="text-lg font-semibold text-slate-800">
            Export All Company Data
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            Exports items, orders, BOMs, and other company data in one file or a zip.
          </p>

          <div>
            <label htmlFor="export-format" className="block text-sm font-medium text-slate-700 mb-2">
              Export format
            </label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              disabled={status === 'loading'}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {message && (
            <div
              className={`text-sm px-4 py-3 rounded-xl ${
                status === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : status === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              role="status"
            >
              {message}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={status === 'loading'}
            className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {status === 'loading' ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Preparing export…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportAllCompanyDataModal;
