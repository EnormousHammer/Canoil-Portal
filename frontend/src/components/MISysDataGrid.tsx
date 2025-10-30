import React, { useState } from 'react';
import { GoogleDriveLoader } from './GoogleDriveLoader';
import { SmartDataTable } from './SmartDataTable';

// Map actual G: Drive file names to display names
const MISYS_TABLE_MAP = {
  'Items': { title: 'Inventory Items', fileName: 'CustomAlert5.json', keyField: 'Item No.' },  // Use CustomAlert5
  'BillsOfMaterial': { title: 'BOM Headers', fileName: 'BillsOfMaterial.json', keyField: 'Item No.' },
  'BillOfMaterialDetails': { title: 'BOM Details', fileName: 'BillOfMaterialDetails.json', keyField: 'BOM Entry' },
  'ManufacturingOrderHeaders': { title: 'Manufacturing Orders', fileName: 'ManufacturingOrderHeaders.json', keyField: 'Mfg. Order No.' },
  'ManufacturingOrderDetails': { title: 'Manufacturing Order Details', fileName: 'ManufacturingOrderDetails.json', keyField: 'Mfg. Order No.' },
  'PurchaseOrders': { title: 'Purchase Orders', fileName: 'PurchaseOrders.json', keyField: 'Purchase Order No.' },
  'PurchaseOrderDetails': { title: 'Purchase Order Details', fileName: 'PurchaseOrderDetails.json', keyField: 'Purchase Order No.' },
  'Jobs': { title: 'Job Headers', fileName: 'Jobs.json', keyField: 'Job No.' },
  'WorkOrderHeaders': { title: 'Work Order Headers', fileName: 'WorkOrderHeaders.json', keyField: 'Work Order No.' },
  'WorkOrderDetails': { title: 'Work Order Details', fileName: 'WorkOrderDetails.json', keyField: 'Work Order No.' }
};

interface MISysDataGridProps {
  dataType: keyof typeof MISYS_TABLE_MAP;
  title?: string;
}

export function MISysDataGrid({ dataType, title }: MISysDataGridProps) {
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const tableConfig = MISYS_TABLE_MAP[dataType];
  const displayTitle = title || tableConfig.title;
  const fileName = tableConfig.fileName;

  const handleDataLoaded = (loadedData: any[]) => {
    setData(loadedData);

    // Extract headers from first item
    if (loadedData.length > 0) {
      const firstItem = loadedData[0];
      setHeaders(Object.keys(firstItem));
    }
  };

  // Format field values for better display
  const formatFieldValue = (value: any, fieldName: string): string => {
    if (value === null || value === undefined) return '-';
    
    // Handle date fields (MISys uses /Date(timestamp)/ format)
    if (typeof value === 'string' && value.startsWith('/Date(') && value.endsWith(')/')) {
      try {
        const timestamp = parseInt(value.replace('/Date(', '').replace(')/', ''));
        return new Date(timestamp).toLocaleDateString();
      } catch {
        return value;
      }
    }
    
    // Handle boolean values
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    // Handle numbers
    if (typeof value === 'number') {
      if (fieldName.toLowerCase().includes('cost') || 
          fieldName.toLowerCase().includes('price') || 
          fieldName.toLowerCase().includes('amt') ||
          fieldName.toLowerCase().includes('total') ||
          fieldName.toLowerCase().includes('value')) {
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (fieldName.toLowerCase().includes('qty') || fieldName.toLowerCase().includes('q')) {
        return value.toLocaleString();
      }
      return value.toString();
    }
    
    return value.toString();
  };

  return (
    <div className="h-full flex flex-col">
      <GoogleDriveLoader
        fileName={fileName}
        onDataLoaded={handleDataLoaded}
      />
      
      {data.length > 0 ? (
        <SmartDataTable 
          data={data}
          title={displayTitle}
          keyField={tableConfig.keyField}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading {displayTitle}...</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Fetching data from MISys export files
            </p>
            <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
              Loading {fileName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
