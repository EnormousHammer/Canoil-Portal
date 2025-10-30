import React, { useState, useEffect } from 'react';
import { GDriveDataLoader, LoadedData } from '../services/GDriveDataLoader';
import { getFieldLabel, formatValue, getFormattedStatus } from '../utils/fieldMappings';

interface DataTableProps {
  data: any[];
  tableName: string;
  title: string;
}

const DataTable: React.FC<DataTableProps> = ({ data, tableName, title }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Get all unique field names from the data
  const allFields = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => allFields.add(key));
  });
  const fields = Array.from(allFields).slice(0, 10); // Limit to first 10 fields for display

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;
    
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {title} ({data.length} records)
      </h3>
      
      {/* Field selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sort by:
        </label>
        <select
          value={sortField}
          onChange={(e) => handleSort(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          aria-label="Select field to sort by"
        >
          <option value="">No sorting</option>
          {fields.map(field => (
            <option key={field} value={field}>
              {getFieldLabel(tableName, field)}
            </option>
          ))}
        </select>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {fields.map(field => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    {getFieldLabel(tableName, field)}
                    {sortField === field && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map((item, index) => (
              <tr key={`${tableName}-${index}-${JSON.stringify(item).slice(0,50)}`} className="hover:bg-gray-50">
                {fields.map(field => (
                  <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(item[field])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ComprehensiveDataExplorerProps {
  data: any;
}

const ComprehensiveDataExplorer: React.FC<ComprehensiveDataExplorerProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<string>('workOrders');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Convert the data structure to match what the component expects
  const loadedData = {
    workOrders: data['WorkOrderHeaders.json'] || [],
    workOrderDetails: data['WorkOrderDetails.json'] || [],
    purchaseOrders: data['PurchaseOrders.json'] || [],
    purchaseOrderDetails: data['PurchaseOrderDetails.json'] || [],
    billOfMaterialDetails: data['BillsOfMaterial.json'] || [],
    purchaseOrderExtensions: data['PurchaseOrderExtensions.json'] || [],
    purchaseOrderAdditionalCosts: data['PurchaseOrderAdditionalCosts.json'] || [],
    purchaseOrderAdditionalCostsTaxes: data['PurchaseOrderAdditionalCostsTaxes.json'] || [],
    purchaseOrderDetailAdditionalCosts: data['PurchaseOrderDetailAdditionalCosts.json'] || [],
    // Use real data from G: Drive
    items: data['CustomAlert5.json'] || [],  // Use CustomAlert5 - complete item data
    itemsTechnical: data['CustomAlert5.json'] || [],  // Use CustomAlert5 for complete item data
    manufacturingOrders: data['ManufacturingOrderHeaders.json'] || [],
    bomHeaders: data['BillsOfMaterial.json'] || [],
    bomDetails: data['BillOfMaterialDetails.json'] || [],
    purchaseOrderCosts: data['MIPOCV.json'] || [],
    workOrderHeaders: data['WorkOrderHeaders.json'] || [],
    jobHeaders: data['JobHeaders.json'] || [],
    jobDetails: data['JobDetails.json'] || []
  };

  if (!loadedData || Object.keys(loadedData).length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  // Define tabs with their data and titles - focusing on 2025-08-26 data structure
  const tabs = [
    { id: 'workOrders', title: 'Work Orders (WorkOrders.json)', data: loadedData.workOrders, tableName: 'workOrders' },
    { id: 'workOrderDetails', title: 'Work Order Details (WorkOrderDetails.json)', data: loadedData.workOrderDetails, tableName: 'workOrderDetails' },
    { id: 'purchaseOrders', title: 'Purchase Orders (PurchaseOrders.json)', data: loadedData.purchaseOrders, tableName: 'purchaseOrders' },
    { id: 'purchaseOrderDetails', title: 'Purchase Order Details (PurchaseOrderDetails.json)', data: loadedData.purchaseOrderDetails, tableName: 'purchaseOrderDetails' },
    { id: 'billOfMaterialDetails', title: 'Bill of Material Details (BillOfMaterialDetails.json)', data: loadedData.billOfMaterialDetails, tableName: 'billOfMaterialDetails' },
    { id: 'purchaseOrderExtensions', title: 'Purchase Order Extensions (PurchaseOrderExtensions.json)', data: loadedData.purchaseOrderExtensions, tableName: 'purchaseOrderExtensions' },
    { id: 'purchaseOrderAdditionalCosts', title: 'Purchase Order Additional Costs (PurchaseOrderAdditionalCosts.json)', data: loadedData.purchaseOrderAdditionalCosts, tableName: 'purchaseOrderAdditionalCosts' },
    { id: 'purchaseOrderAdditionalCostsTaxes', title: 'Purchase Order Additional Costs Taxes (PurchaseOrderAdditionalCostsTaxes.json)', data: loadedData.purchaseOrderAdditionalCostsTaxes, tableName: 'purchaseOrderAdditionalCostsTaxes' },
    { id: 'purchaseOrderDetailAdditionalCosts', title: 'Purchase Order Detail Additional Costs (PurchaseOrderDetailAdditionalCosts.json)', data: loadedData.purchaseOrderDetailAdditionalCosts, tableName: 'purchaseOrderDetailAdditionalCosts' }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Comprehensive MISys Data Explorer
          </h1>
          <p className="text-gray-600">
            Explore all MISys data files with both technical and user-friendly field names
          </p>
        </div>

        {/* Data Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Data Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(loadedData).map(([key, data]) => (
              <div key={key} className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{data?.length || 0}</div>
                <div className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.title}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Search for Work Orders */}
        {activeTab === 'workOrders' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Search Work Orders</h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search by work order number, description, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Active Tab Content */}
        {activeTabData && (
          <DataTable
            data={searchQuery && activeTab === 'workOrders' 
              ? loadedData.workOrders.filter(item => 
                  item["WorkOrderNo"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item["Description"]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item["Status"]?.toLowerCase().includes(searchQuery.toLowerCase())
                )
              : activeTabData.data
            }
            tableName={activeTabData.tableName}
            title={activeTabData.title}
          />
        )}
      </div>
    </div>
  );
};

export default ComprehensiveDataExplorer;
