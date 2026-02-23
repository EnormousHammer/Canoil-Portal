import React, { useState } from 'react';
import { 
  ChevronLeft, 
  FileText, 
  BarChart3, 
  TrendingUp, 
  Package, 
  Factory,
  ClipboardList,
  Calendar,
  Download,
  Upload,
  Send,
  Database,
  Filter,
  Layers,
  Activity
} from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

interface ReportMakerProps {
  data: any;
  onBack: () => void;
}

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  status: 'available' | 'coming-soon';
}

export const ReportMaker: React.FC<ReportMakerProps> = ({ data, onBack }) => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [productType, setProductType] = useState<'grease' | 'oil'>('grease');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedSO, setSelectedSO] = useState<string>('');
  const [selectedMO, setSelectedMO] = useState<string>('');
  const [showSOSelector, setShowSOSelector] = useState(false);
  const [showMOSelector, setShowMOSelector] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const reportTypes: ReportType[] = [
    {
      id: 'lanxess',
      title: 'Lanxess Report Maker',
      description: 'Automated grease & oil production reports with Excel calculations and Word document generation',
      icon: <Factory className="w-8 h-8" />,
      color: 'from-purple-500 to-indigo-600',
      features: [
        'Process grease production reports automatically',
        'Find correct product page in multi-sheet Excel',
        'Auto-calculate tables with built-in formulas',
        'Generate final Word report for Lanxess',
        'Support for both grease and oil products'
      ],
      status: 'available'
    },
    {
      id: 'inventory',
      title: 'Inventory Analysis Report',
      description: 'Comprehensive inventory status with low stock alerts and reorder recommendations',
      icon: <Package className="w-8 h-8" />,
      color: 'from-blue-500 to-cyan-600',
      features: [
        'Current stock levels analysis',
        'Low stock and out-of-stock alerts',
        'Reorder point calculations',
        'Inventory turnover metrics',
        'ABC analysis by value'
      ],
      status: 'available'
    },
    {
      id: 'sales-performance',
      title: 'Sales Performance Report',
      description: 'Monthly and quarterly sales analytics with customer insights',
      icon: <TrendingUp className="w-8 h-8" />,
      color: 'from-green-500 to-emerald-600',
      features: [
        'Sales trends and patterns',
        'Top customers by revenue',
        'Product performance metrics',
        'Seasonal analysis',
        'Revenue forecasting'
      ],
      status: 'available'
    },
    {
      id: 'production-summary',
      title: 'Production Summary Report',
      description: 'Manufacturing order status and completion metrics',
      icon: <BarChart3 className="w-8 h-8" />,
      color: 'from-orange-500 to-red-600',
      features: [
        'Active manufacturing orders',
        'Production completion rates',
        'Resource utilization',
        'Schedule adherence',
        'Quality metrics'
      ],
      status: 'available'
    },
    {
      id: 'purchase-analysis',
      title: 'Purchase Order Analysis',
      description: 'Vendor performance and purchasing insights',
      icon: <ClipboardList className="w-8 h-8" />,
      color: 'from-pink-500 to-rose-600',
      features: [
        'Open PO tracking',
        'Vendor performance metrics',
        'Cost analysis by category',
        'Delivery performance',
        'Spend analytics'
      ],
      status: 'coming-soon'
    },
    {
      id: 'custom-report',
      title: 'Custom Report Builder',
      description: 'Create your own reports with drag-and-drop components',
      icon: <Layers className="w-8 h-8" />,
      color: 'from-gray-600 to-slate-700',
      features: [
        'Drag-and-drop report builder',
        'Custom data selection',
        'Multiple chart types',
        'Export to Excel/PDF',
        'Save report templates'
      ],
      status: 'coming-soon'
    }
  ];

  const handleReportSelect = (reportId: string) => {
    setSelectedReport(reportId);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setReportError(null);
    try {
      if (selectedReport === 'inventory') {
        const url = getApiUrl('/api/reports/inventory');
        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.hint || `Report failed (${res.status})`);
        }
        const blob = await res.blob();
        const disp = res.headers.get('Content-Disposition');
        const match = disp && disp.match(/filename="?([^";]+)"?/);
        const fname = match ? match[1] : `inventory_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        // Other reports: placeholder
        setTimeout(() => {
          setIsGenerating(false);
          setReportError('This report type is not yet implemented.');
        }, 1000);
        return;
      }
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  // If a report is selected, show the report generation interface
  if (selectedReport) {
    const report = reportTypes.find(r => r.id === selectedReport);
    if (!report) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setSelectedReport(null)}
              className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-black text-slate-900">{report.title}</h1>
              <p className="text-slate-600 mt-1">{report.description}</p>
            </div>
          </div>

          {/* Report Configuration */}
          <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Report Configuration</h3>
            
            {report.id === 'lanxess' && (
              <div className="space-y-6">
                {/* Product Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Product Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setProductType('grease')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        productType === 'grease' 
                          ? 'border-purple-500 bg-purple-50 text-purple-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-2xl mb-2">🛢️</div>
                      <div className="font-bold">Grease</div>
                      <div className="text-xs mt-1">Multi-page Excel workbook</div>
                    </button>
                    <button
                      onClick={() => setProductType('oil')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        productType === 'oil' 
                          ? 'border-purple-500 bg-purple-50 text-purple-700' 
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-2xl mb-2">🛢️</div>
                      <div className="font-bold">Oil</div>
                      <div className="text-xs mt-1">Coming soon</div>
                    </button>
                  </div>
                </div>

                {/* Order Linking */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link to Orders (Optional)
                  </label>
                  
                  {/* Sales Order Selection */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Sales Order</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={selectedSO}
                        onChange={(e) => setSelectedSO(e.target.value)}
                        placeholder="Enter SO number or select..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <button
                        onClick={() => setShowSOSelector(!showSOSelector)}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
                      >
                        Browse SOs
                      </button>
                    </div>
                    
                    {/* SO List (simplified for now) */}
                    {showSOSelector && (
                      <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                        {(data['SalesOrderHeaders.json'] || []).slice(0, 10).map((so: any) => (
                          <button
                            key={so['SO No.']}
                            onClick={() => {
                              setSelectedSO(so['SO No.']);
                              setShowSOSelector(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-purple-50 border-b border-gray-100 text-sm"
                          >
                            <div className="font-medium">{so['SO No.']}</div>
                            <div className="text-gray-600">{so['Customer']} - {so['Order Date']}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manufacturing Order Selection */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Factory className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Manufacturing Order</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={selectedMO}
                        onChange={(e) => setSelectedMO(e.target.value)}
                        placeholder="Enter MO number or select..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <button
                        onClick={() => setShowMOSelector(!showMOSelector)}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
                      >
                        Browse MOs
                      </button>
                    </div>
                    
                    {/* MO List (simplified for now) */}
                    {showMOSelector && (
                      <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                        {(data['ManufacturingOrderHeaders.json'] || []).slice(0, 10).map((mo: any) => (
                          <button
                            key={mo['MO No.']}
                            onClick={() => {
                              setSelectedMO(mo['MO No.']);
                              setShowMOSelector(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-purple-50 border-b border-gray-100 text-sm"
                          >
                            <div className="font-medium">{mo['MO No.']}</div>
                            <div className="text-gray-600">{mo['Item No.']} - {mo['Description']}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Workflow Steps */}
                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-blue-900">Report Workflow</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                      <div className="text-sm text-gray-700">
                        <strong>Upload production report</strong> from the production team
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                      <div className="text-sm text-gray-700">
                        <strong>Auto-fill Excel template</strong> - System finds the correct product page and fills data
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                      <div className="text-sm text-gray-700">
                        <strong>Excel formulas calculate</strong> the required table data
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                      <div className="text-sm text-gray-700">
                        <strong>Generate Word report</strong> for Lanxess with all calculated data
                      </div>
                    </div>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Production Team Report
                  </label>
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-500 transition-colors cursor-pointer bg-gray-50"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.xlsx,.xls,.csv,.pdf';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) setUploadedFile(file);
                      };
                      input.click();
                    }}
                  >
                    {uploadedFile ? (
                      <>
                        <FileText className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Click to change file</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500 mt-1">Excel, CSV, or PDF files from production team</p>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Report Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Report Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PO Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., PO-12345"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Template Information */}
                <div className="bg-gray-100 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex items-start gap-2 text-gray-600">
                    <Database className="w-4 h-4 mt-0.5" />
                    <div>
                      <strong>Excel Template:</strong> Worksheet {productType === 'grease' ? 'Grease' : 'Oil'}.xlsx
                      <br />
                      <strong>Output:</strong> PRmmxx_PO_CustomerRef_CCLSO_G-xxxx-x.docx
                    </div>
                  </div>
                  {(selectedSO || selectedMO) && (
                    <div className="pt-2 border-t border-gray-200">
                      {selectedSO && (
                        <div className="flex items-center gap-2 text-purple-700">
                          <ClipboardList className="w-3 h-3" />
                          <span>Linked to SO: {selectedSO}</span>
                        </div>
                      )}
                      {selectedMO && (
                        <div className="flex items-center gap-2 text-purple-700">
                          <Factory className="w-3 h-3" />
                          <span>Linked to MO: {selectedMO}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Inventory report - snapshot as of now */}
            {report.id === 'inventory' && (
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-900">
                <strong>Month-End Inventory Report</strong> — Generates Excel with all items, cost, location, and extended value. 
                Snapshot as of generation time. Data from Full Company Data (MIITEM, MIILOC).
              </div>
            )}

            {/* Common date range selector for other reports (not lanxess, not inventory) */}
            {report.id !== 'lanxess' && report.id !== 'inventory' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="flex flex-col gap-3 mt-6">
              {reportError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {reportError}
                </div>
              )}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => { setSelectedReport(null); setReportError(null); }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                    isGenerating 
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                      : 'bg-gradient-to-r ' + report.color + ' text-white hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Activity className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Generate Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="mt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Report Features</h3>
            <div className="grid grid-cols-2 gap-3">
              {report.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  </div>
                  <span className="text-sm text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main report selection view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={onBack}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-4xl font-black text-slate-900">Report Maker</h1>
            <p className="text-slate-600 text-lg mt-2">Select a report type to generate comprehensive analytics</p>
          </div>
        </div>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            onClick={() => report.status === 'available' && handleReportSelect(report.id)}
            className={`group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 ${
              report.status === 'available' 
                ? 'cursor-pointer hover:scale-105 hover:shadow-2xl' 
                : 'opacity-60 cursor-not-allowed'
            }`}
          >
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${report.color}`}></div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
            
            {/* Coming Soon Badge */}
            {report.status === 'coming-soon' && (
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-xs font-bold text-gray-700">COMING SOON</span>
              </div>
            )}

            {/* Content */}
            <div className="relative">
              <div className="w-16 h-16 mb-4 p-3 bg-white/20 backdrop-blur-sm rounded-2xl ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                {React.cloneElement(report.icon as React.ReactElement, { className: "w-full h-full text-white" })}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{report.title}</h3>
              <p className="text-white/80 text-sm mb-4">{report.description}</p>
              
              {/* Feature preview */}
              <div className="space-y-1">
                {report.features.slice(0, 3).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-white/70 text-xs">
                    <div className="w-1 h-1 bg-white/70 rounded-full"></div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Action indicator */}
              {report.status === 'available' && (
                <div className="mt-4 flex items-center text-white font-medium">
                  <span className="text-sm">Create Report</span>
                  <ChevronLeft className="w-4 h-4 ml-1 rotate-180" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Available Data Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {data['CustomAlert5.json']?.length || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Inventory Items</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {data['SalesOrderHeaders.json']?.length || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Sales Orders</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {data['ManufacturingOrderHeaders.json']?.length || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Manufacturing Orders</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {data['PurchaseOrders.json']?.length || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Purchase Orders</div>
          </div>
        </div>
      </div>
    </div>
  );
};
