import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getApiUrl } from '../utils/apiConfig';

interface PurchaseRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  poNumber?: string;
  poData?: any;
  allData?: any; // Pass the full data object from parent
  preFilledItems?: SelectedItem[]; // Items pre-filled from BOM
}

interface SearchResult {
  item_no: string;
  description: string;
  unit_price: number;
  unit: string;
  current_stock: string;
  wip: string;
  reorder_quantity: number;
  preferred_supplier?: string;
}

interface SelectedItem {
  item_no: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  current_stock?: string;
}

export const PurchaseRequisitionModal: React.FC<PurchaseRequisitionModalProps> = ({ 
  isOpen, 
  onClose, 
  poNumber, 
  poData,
  allData,
  preFilledItems = []
}) => {
  // User info
  const [userName, setUserName] = useState('');
  const [department, setDepartment] = useState('');
  const [justification, setJustification] = useState('');
  const [leadTime, setLeadTime] = useState('4 weeks');
  
  // Item search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  
  // Auto-filled supplier info
  const [supplierInfo, setSupplierInfo] = useState<any>(null);
  
  // Effect to populate selectedItems when preFilledItems are provided
  useEffect(() => {
    // Only log when modal is open (not during initial loading)
    if (isOpen) {
      console.log('PR Modal - preFilledItems received:', preFilledItems);
    }
    if (preFilledItems && preFilledItems.length > 0) {
      if (isOpen) {
        console.log('PR Modal - Setting selectedItems to:', preFilledItems);
      }
      setSelectedItems(preFilledItems);
      
      // Also clear search when pre-filled items are provided
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [preFilledItems, isOpen]);

  // Reset modal when opened
  useEffect(() => {
    // Only log when modal is actually opened (not during initial render)
    if (isOpen) {
      console.log('PR Modal - isOpen changed to:', isOpen);
      console.log('PR Modal - Modal opened, clearing search');
      // Clear search when modal opens
      setSearchQuery('');
      setSearchResults([]);
      
      // Only clear selectedItems if no preFilledItems are provided
      if (!preFilledItems || preFilledItems.length === 0) {
        setSelectedItems([]);
      }
    }
  }, [isOpen, preFilledItems]);
  
  // Loading state
  const [isGenerating, setIsGenerating] = useState(false);

  // Load supplier info from PO data
  useEffect(() => {
    if (poData) {
      setSupplierInfo({
        name: poData.Supplier?.Name || '',
        contact: poData.Supplier?.Contact || '',
        email: poData.Supplier?.Email || '',
        phone: poData.Supplier?.Phone || poData.Supplier?.Phone_No || poData.Supplier?.Telephone || '',
        address: poData.Shipping_Billing?.Ship_To_Address || {}
      });
      
      // Calculate lead time from PO dates (Order Date to Close/Received Date)
      if (poData.Order_Info) {
        const orderDate = poData.Order_Info?.Order_Date;
        // Try Close_Date first, then Received_Date, then Due_Date
        const endDate = poData.Order_Info?.Close_Date || 
                       poData.Order_Info?.Received_Date || 
                       poData.Order_Info?.Due_Date;
        
        if (orderDate && endDate) {
          try {
            // Parse MISys date format: /Date(milliseconds)/
            const orderMs = parseInt(orderDate.match(/\d+/)?.[0] || '0');
            const endMs = parseInt(endDate.match(/\d+/)?.[0] || '0');
            
            if (orderMs && endMs && endMs > orderMs) {
              const diffDays = Math.abs((endMs - orderMs) / (1000 * 60 * 60 * 24));
              const weeks = Math.ceil(diffDays / 7);
              
              console.log(`📅 Lead time calculated from PO: ${weeks} weeks (${diffDays} days)`);
              
              if (weeks > 0 && weeks < 52) {
                setLeadTime(`${weeks} weeks`);
              }
            }
          } catch (e) {
            console.log('Could not calculate lead time from PO dates:', e);
          }
        }
      }
      
      // Pre-fill from PO line items
      if (poData.Line_Items && poData.Line_Items.length > 0) {
        const preFilledItems = poData.Line_Items.map((item: any) => ({
          item_no: item.Item_No,
          description: item.Description,
          quantity: item.Pricing?.Quantity_Ordered || 0,
          unit: item.Pricing?.Purchase_Unit_of_Measure || 'EA',
          unit_price: item.Item_Master?.Cost_History?.Recent_Cost || item.Pricing?.Unit_Cost || 0,
          current_stock: ''
        }));
        setSelectedItems(preFilledItems);
      }
    }
  }, [poData]);

  // Get all items from data - try ALL possible sources (MEMOIZED to prevent repeated calls)
  // Only check when modal is open AND data is loaded (not during initial loading)
  const getAllItems = useMemo(() => {
    // Don't do anything if modal is not open (saves computation during loading)
    if (!isOpen) return [];
    
    if (!allData) return [];
    
    // Check if data is actually loaded (not just empty arrays from initial state)
    const dataLoaded = allData.loaded === true || 
      (allData['CustomAlert5.json'] && Array.isArray(allData['CustomAlert5.json']) && allData['CustomAlert5.json'].length > 0) ||
      (allData['MIITEM.json'] && Array.isArray(allData['MIITEM.json']) && allData['MIITEM.json'].length > 0) ||
      (allData['Items.json'] && Array.isArray(allData['Items.json']) && allData['Items.json'].length > 0);
    
    // If data is not loaded yet (still in loading phase), return empty array silently
    // This prevents error messages during the loading screen
    if (!dataLoaded) {
      return [];
    }
    
    // Prioritize CustomAlert5.json (same as BOM) - PRIMARY SOURCE
    // Then try other sources as fallback
    const sources = [
      'CustomAlert5.json',  // PRIMARY - Same as BOM/Items
      'MIITEM.json',
      'Items.json', 
      'Items_with_stock.json',
      'Items_default_keys.json',
      'Items_union_keys.json'
    ];
    
    for (const source of sources) {
      const items = allData[source];
      if (items && Array.isArray(items) && items.length > 0) {
        // Only log once per source change
        console.log(`✅ Using ${source} with ${items.length} items`);
        return items;
      }
    }
    
    // Only log error if modal is open, data is loaded, but still no items found (actual problem)
    if (dataLoaded && isOpen) {
      console.error('❌ No items found in any source!');
    }
    return [];
  }, [allData, isOpen]); // Only recalculate when allData or isOpen changes

  // allItems is now directly memoized (getAllItems is already memoized above)
  const allItems = getAllItems;

  // Debug what we actually have (only once when modal opens)
  const [debugged, setDebugged] = React.useState(false);
  React.useEffect(() => {
    if (isOpen && allData && !debugged) {
      console.log('=== MODAL DATA CHECK ===');
      console.log('MIITEM.json type:', typeof allData['MIITEM.json']);
      console.log('MIITEM.json is array?', Array.isArray(allData['MIITEM.json']));
      console.log('MIITEM.json length:', allData['MIITEM.json']?.length);
      console.log('MIITEM.json first item:', allData['MIITEM.json']?.[0]);
      console.log('Items.json length:', allData['Items.json']?.length);
      console.log('Items.json first item:', allData['Items.json']?.[0]);
      setDebugged(true);
    }
  }, [isOpen, allData, debugged]);
  
  // Track if items are loaded (use memoized value)
  const itemsLoaded = allItems.length > 0;

  // Handle search input change - Smart search like inventory with real-time Stock & WIP
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear results if empty
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    const items = allItems;
    if (items.length === 0) return;
    
    const queryLower = query.toLowerCase();

    // Smart filter with scoring - check item number and description
    const scoredMatches = items
      .map((item: any) => {
        const itemNo = String(item['Item No.'] || item['ITEM_NO'] || item['Item_No'] || '').toLowerCase();
        const description = String(item['Description'] || item['DESCRIPTION'] || '').toLowerCase();
        
        // Calculate match score for better sorting
        let score = 0;
        if (itemNo.startsWith(queryLower)) score += 100; // Exact start match
        else if (itemNo.includes(queryLower)) score += 50; // Contains match
        if (description.includes(queryLower)) score += 25; // Description match
        
        // Check if matches
        if (itemNo.includes(queryLower) || description.includes(queryLower)) {
          // Get the most accurate recent cost
          const recentCost = parseFloat(
            String(item['Recent Cost'] || 
            item['RECENT_COST'] || 
            item['Last Cost'] ||
            item['LAST_COST'] ||
            item['Standard Cost'] || 
            item['STANDARD_COST'] || 
            0).replace(/[$,]/g, '')
          );
          
          // Get Stock - prioritize CustomAlert5.json field names
          const stock = parseFloat(
            String(item['Stock'] || 
            item['Quantity On Hand'] || 
            item['QTY_ON_HAND'] || 
            item['On_Hand'] || 
            0).replace(/,/g, '')
          );
          
          // Get WIP - from CustomAlert5.json
          const wip = parseFloat(
            String(item['WIP'] || 
            item['WIP Qty'] || 
            item['Work In Process'] || 
            0).replace(/,/g, '')
          );
          
          return {
            score,
            item_no: item['Item No.'] || item['ITEM_NO'] || item['Item_No'],
            description: item['Description'] || item['DESCRIPTION'] || 'No description',
            unit_price: recentCost,
            unit: item['Purchasing Units'] || item['PURCHASING_UNITS'] || item['Purchase_Unit'] || 'EA',
            current_stock: stock.toLocaleString(),
            wip: wip.toLocaleString(),
            reorder_quantity: parseInt(item['Reorder Quantity'] || item['REORDER_QTY'] || 1),
            preferred_supplier: item['Preferred Supplier Number'] || item['PREFERRED_SUPPLIER'] || ''
          };
        }
        return null;
      })
      .filter((match: any) => match !== null)
      .sort((a: any, b: any) => b.score - a.score) // Sort by score
      .slice(0, 20); // Top 20 results

    setSearchResults(scoredMatches);
  };

  // Add item to selected list
  const handleAddItem = async (item: SearchResult) => {
    const newItem: SelectedItem = {
      item_no: item.item_no,
      description: item.description,
      quantity: item.reorder_quantity || 1,
      unit: item.unit || 'EA',
      unit_price: item.unit_price || 0,
      current_stock: item.current_stock || ''
    };
    
    // Check BEFORE adding the item
    const isFirstItem = selectedItems.length === 0;
    
    console.log('🔍 DEBUG - Is first item?:', isFirstItem);
    console.log('🔍 DEBUG - item.preferred_supplier:', item.preferred_supplier);
    console.log('🔍 DEBUG - supplierInfo:', supplierInfo);
    
    setSelectedItems([...selectedItems, newItem]);
    setSearchQuery('');
    setSearchResults([]);
    
    // Auto-populate supplier info from first item's preferred supplier
    if (isFirstItem && item.preferred_supplier && !supplierInfo) {
      try {
        console.log(`🔍 Fetching supplier details for: ${item.preferred_supplier}`);
        const response = await fetch(getApiUrl(`/api/pr/supplier/${encodeURIComponent(item.preferred_supplier)}`));
        
        console.log('📥 Response status:', response.status);
        
        if (response.ok) {
          const supplier = await response.json();
          console.log('✅ Supplier info loaded:', supplier);
          setSupplierInfo({
            name: supplier.name || '',
            contact: supplier.contact || '',
            email: supplier.email || '',
            phone: supplier.phone || '',
            address: supplier.address || {}
          });
        } else {
          const errorText = await response.text();
          console.log('⚠️ Supplier not found:', errorText);
        }
      } catch (error) {
        console.error('❌ Error fetching supplier:', error);
        // Don't block the user, they can enter supplier manually
      }
    } else {
      console.log('⚠️ Not fetching supplier because:');
      console.log('  - Already have items:', selectedItems.length > 0);
      console.log('  - No preferred supplier:', !item.preferred_supplier);
      console.log('  - Already have supplier info:', !!supplierInfo);
    }
  };

  // Remove item from selected list
  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  // Update item quantity
  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...selectedItems];
    updated[index].quantity = quantity;
    setSelectedItems(updated);
  };


  // Generate requisition
  const handleGenerate = async () => {
    console.log('🚀 Generate clicked!');
    console.log('userName:', userName);
    console.log('department:', department);
    console.log('selectedItems:', selectedItems);
    console.log('poNumber:', poNumber);
    console.log('poData:', poData);
    
    if (!userName || !department || selectedItems.length === 0) {
      alert('Please fill in all required fields and add at least one item');
      return;
    }

    setIsGenerating(true);
    console.log('⏳ Starting generation...');
    
    try {
      const requestData = {
        user_info: {
          name: userName,
          department: department,
          justification: justification,
          lead_time: leadTime
        },
        items: selectedItems,
        supplier: supplierInfo || {}
      };

      console.log('📤 Sending request:', requestData);

      // Use /api/pr/from-po endpoint if poNumber is provided (from PO page)
      // Otherwise use /api/pr/generate (from BOM or manual entry)
      const endpoint = poNumber 
        ? `/api/pr/from-po/${poNumber}`
        : '/api/pr/generate';

      console.log(`📡 Using endpoint: ${endpoint}`);

      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      // Download file
      const blob = await response.blob();
      console.log('📄 Got blob, size:', blob.size);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `Purchase_Requisition_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      console.log('✅ File downloaded:', filename);
      alert('✅ Purchase Requisition generated successfully!');
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('❌ Generation error:', error);
      alert(`Failed to generate requisition: ${error.message}\n\nCheck console for details.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate total
  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold">Create Purchase Requisition</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* User Information Section */}
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Requestor Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Your Name *</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department *</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Sales"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lead Time</label>
                <select
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>1 week</option>
                  <option>2 weeks</option>
                  <option>4 weeks</option>
                  <option>6 weeks</option>
                  <option>8 weeks</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Justification</label>
                <select
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select justification...</option>
                  <option>Stock Replishment</option>
                  <option>Fulfilling Order</option>
                  <option>Future Order Stock</option>
                </select>
              </div>
            </div>
          </div>

          {/* Supplier Information (Auto-Filled) */}
          {supplierInfo && (
            <div className="mb-6 bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold mb-2 text-green-800">
                ✓ Supplier Info (Auto-Filled from Item)
              </h3>
              <div className="text-sm space-y-1">
                <p className="font-medium text-base">{supplierInfo.name}</p>
                {supplierInfo.contact && <p className="text-gray-600">Contact: {supplierInfo.contact}</p>}
                {supplierInfo.phone && <p className="text-gray-600">Phone: {supplierInfo.phone}</p>}
                {supplierInfo.email && <p className="text-gray-600">Email: {supplierInfo.email}</p>}
                <p className="text-xs text-gray-500 italic mt-2">
                  ℹ️ Supplier address not stored in system - will be filled from item's preferred supplier on generated PR
                </p>
              </div>
            </div>
          )}

          {/* Item Search */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Add Items</h3>
              <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                {allItems.length > 0 ? `${allItems.length} items available` : 'No items data'}
              </span>
            </div>
            <div className="relative z-10">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                disabled={!itemsLoaded}
                className={`w-full px-4 py-3 border rounded-md pl-10 ${
                  itemsLoaded 
                    ? 'border-gray-300 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                }`}
                placeholder={itemsLoaded ? "🔍 Smart search items with real-time Stock & WIP... (e.g. 'oil', 'engine', 'can')" : "⏳ Loading items data..."}
              />
              <svg className={`w-5 h-5 absolute left-3 top-3.5 ${itemsLoaded ? 'text-gray-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              
              {/* Search Results Dropdown */}
              {searchQuery && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-96 overflow-y-auto">
                  <div className="sticky top-0 bg-blue-50 px-4 py-2 flex justify-between items-center border-b border-blue-200 z-10">
                    <span className="text-xs font-semibold text-blue-700">
                      {searchResults.length} results found
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add all search results
                        searchResults.forEach(item => handleAddItem(item));
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                    >
                      + Add All ({searchResults.length})
                    </button>
                  </div>
                  {searchResults.map((item, index) => (
                    <div
                      key={`${item.item_no}-${index}`}
                      onClick={() => {
                        handleAddItem(item);
                        // Clear search after adding
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors duration-150 group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-bold text-blue-600">{item.item_no}</div>
                          <div className="text-sm text-gray-700 mt-1">{item.description}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-semibold text-green-600">${item.unit_price.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">{item.unit}</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddItem(item);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="opacity-0 group-hover:opacity-100 bg-green-500 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-green-600 transition-all"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <div className="text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded inline-block border border-blue-200">
                          <span className="font-semibold text-blue-700">Stock:</span> {item.current_stock || '0'}
                        </div>
                        <div className="text-xs text-gray-600 bg-yellow-50 px-2 py-1 rounded inline-block border border-yellow-200">
                          <span className="font-semibold text-yellow-700">WIP:</span> {item.wip || '0'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* No results message */}
              {searchQuery && searchQuery.length > 0 && searchResults.length === 0 && allItems.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3">
                  <div className="text-gray-500 text-sm">No items found for "{searchQuery}"</div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Items Table */}
          {selectedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Selected Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item #</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-4 py-3 text-sm">{item.item_no}</td>
                        <td className="px-4 py-3 text-sm">{item.description}</td>
                        <td className="px-4 py-3 text-sm">{item.unit}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded"
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ${(item.unit_price || 0).toFixed(2)}
                          <div className="text-xs text-gray-500">Recent PO Price</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right font-semibold">Total:</td>
                      <td className="px-4 py-3 font-bold text-lg">${calculateTotal().toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || selectedItems.length === 0 || !userName || !department}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Generate Purchase Requisition</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequisitionModal;

