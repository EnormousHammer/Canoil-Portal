import React, { useState, useMemo, useEffect } from 'react';
import { CompactLoading, DataLoading, ToastNotification } from './LoadingComponents';
import { AICommandCenter } from './AICommandCenter';
import { ProductionSchedule } from './ProductionSchedule';
import { CleanEnterpriseDashboard } from './CleanEnterpriseDashboard';
import LogisticsAutomation from './LogisticsAutomation';
import { parseStockValue, parseCostValue, formatCAD } from '../utils/unifiedDataAccess';

// Purchase Order Types
type AddressBlock = {
  name?: string;
  addr1?: string; 
  addr2?: string; 
  addr3?: string;
  city?: string; 
  state?: string; 
  postal?: string; 
  country?: string;
};

type PoHeader = {
  poId: string;           // "PO No."
  revision?: number;
  status: string;
  buyer?: string;
  vendor?: string;        // your Vendor field
  orderDate?: string;     // YYYY-MM-DD
  requiredDate?: string;  // header-level if present
  terms?: string;
  fob?: string;
  currency?: string;
  printStatus?: string;
  billTo?: AddressBlock;  // from Extensions
  shipTo?: AddressBlock;  // from Extensions
  totalAmount?: number;
  receivedQty?: number;
  billedQty?: number;
};

type PoLine = {
  poId: string;
  lineNo: number;
  itemId: string;         // normalized
  description?: string;
  orderedQty: number;
  unitPrice: number;
  location?: string;
  requiredDate?: string;  // per line (preferred)
  receivedQty: number;    // read-only
  billedQty: number;      // read-only
  remainingQty: number;   // computed
};

interface RevolutionaryCanoilHubProps {
  data: any;
  dataSource?: string;
  syncInfo?: { message: string; time: string; };
  onNavigate?: (section: string) => void;
}

export const RevolutionaryCanoilHub: React.FC<RevolutionaryCanoilHubProps> = ({ data, onNavigate }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [poSortField, setPoSortField] = useState<string>('Order Date');
  const [poSortDirection, setPoSortDirection] = useState<'asc' | 'desc'>('desc');
  const [moSortField, setMoSortField] = useState<string>('Order Date');
  const [moSortDirection, setMoSortDirection] = useState<'asc' | 'desc'>('desc');
  const [moStatusFilter, setMoStatusFilter] = useState<string>('all');
  const [moCustomerFilter, setMoCustomerFilter] = useState<string>('all');
  const [poStatusFilter, setPoStatusFilter] = useState<string>('all');
  const [poVendorFilter, setPoVendorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  
  
  
  // Sales Orders navigation state
  const [soCurrentPath, setSoCurrentPath] = useState<string[]>([]);
  const [soFolderData, setSoFolderData] = useState<any>(null);
  const [soLoading, setSoLoading] = useState(false);
  
  
  
  // Sales Order viewer state
  const [selectedSOFile, setSelectedSOFile] = useState<any>(null);
  const [showSOViewer, setShowSOViewer] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(100);
  
  // Customer section state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  
  // Sales Orders search state
  const [soSearchQuery, setSoSearchQuery] = useState('');
  
  // BOM Planning search state
  const [bomSearchQuery, setBomSearchQuery] = useState('');
  const [bomQuantity, setBomQuantity] = useState(0);
  const [selectedBomItem, setSelectedBomItem] = useState<any>(null);
  
  // Customer details pagination state
  const [moPageSize, setMoPageSize] = useState(25);
  const [moCurrentPage, setMoCurrentPage] = useState(1);

  // Purchase Order processing
  const processPurchaseOrders = useMemo(() => {
    if (!data?.['PurchaseOrders.json'] || !data?.['PurchaseOrderDetails.json'] || !data?.['PurchaseOrderExtensions.json']) {
      return { headers: [], lines: [] };
    }

    const headers = data['PurchaseOrders.json'].map((po: any) => {
      // Find matching extension data
      const extension = data['PurchaseOrderExtensions.json'].find((ext: any) => ext['PO No.'] === po['PO No.']);
      
      return {
        poId: po['PO No.'] || '',
        revision: po['PO Revision'] || 0,
        status: po['Status']?.toString() || '0',
        buyer: po['Buyer'] || '',
        vendor: po['Name'] || po['Supplier No.'] || '',
        orderDate: po['Order Date'] || '',
        requiredDate: po['Required Date'] || '',
        terms: po['Terms'] || '',
        fob: po['FOB'] || '',
        currency: po['Home Currency'] || po['Source Currency'] || 'CAD',
        printStatus: po['Print Status'] || '',
        totalAmount: parseCostValue(po['Total Amount'] || 0),
        receivedQty: parseStockValue(po['Received Amount'] || 0),
        billedQty: parseStockValue(po['Invoiced Amount'] || 0),
        billTo: extension ? {
          name: extension['Bill To Name'] || '',
          addr1: extension['Bill To Address 1'] || '',
          addr2: extension['Bill To Address 2'] || '',
          addr3: extension['Bill To Address 3'] || '',
          city: extension['Bill To City'] || '',
          state: extension['Bill To State'] || '',
          postal: extension['Bill To Postal'] || '',
          country: extension['Bill To Country'] || ''
        } : undefined,
        shipTo: extension ? {
          name: extension['Ship To Name'] || '',
          addr1: extension['Ship To Address 1'] || '',
          addr2: extension['Ship To Address 2'] || '',
          addr3: extension['Ship To Address 3'] || '',
          city: extension['Ship To City'] || '',
          state: extension['Ship To State'] || '',
          postal: extension['Ship To Postal'] || '',
          country: extension['Ship To Country'] || ''
        } : undefined
      } as PoHeader;
    });

    const lines = data['PurchaseOrderDetails.json'].map((line: any) => {
      return {
        poId: line['PO No.'] || '',
        lineNo: line['Line No.'] || 0,
        itemId: (line['Item No.'] || line['Part No.'] || '').toString().trim().toUpperCase(),
        description: line['Description'] || '',
        orderedQty: parseStockValue(line['Ordered Qty'] || 0),
        unitPrice: parseCostValue(line['Unit Price'] || 0),
        location: line['Location'] || '',
        requiredDate: line['Required Date'] || '',
        receivedQty: parseStockValue(line['Received Qty'] || 0),
        billedQty: parseStockValue(line['Billed Qty'] || 0),
        remainingQty: parseStockValue(line['Ordered Qty'] || 0) - parseStockValue(line['Received Qty'] || 0)
      } as PoLine;
    });

    return { headers, lines };
  }, [data]);

  // Get PO lines for a specific PO
  const getPOLines = (poId: string) => {
    return processPurchaseOrders.lines.filter((line: PoLine) => line.poId === poId);
  };

  // Listen for SO navigation messages from logistics
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NAVIGATE_TO_SALES_ORDERS') {
        const soNumber = event.data.soNumber;
        console.log('🔍 Navigating to Sales Orders for SO:', soNumber);
        
        // Navigate to sales orders section
        setActiveSection('orders');
        
        // Set search query to find the specific SO
        setSoSearchQuery(soNumber);
        
        // Reset SO navigation to show search results
        resetSONavigation();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // MO details modal state
  const [selectedMO, setSelectedMO] = useState<any>(null);
  const [showMODetails, setShowMODetails] = useState(false);
  
  // Logistics section state
  const [logisticsStep, setLogisticsStep] = useState(1);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('');
  const [logisticsData, setLogisticsData] = useState<any>({
    shipmentType: '',
    carrier: '',
    serviceLevel: 'Standard',
    destination: '',
    grossWeight: '',
    skidsPieces: '',
    dimensions: '',
    readyTime: '',
    pickupDate: new Date().toISOString().split('T')[0],
    soNumber: '',
    poNumber: '',
    batchNumber: ''
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [logisticsLoading, setLogisticsLoading] = useState(false);

  // Date conversion function for MISys data
  const convertMISysDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    try {
      // Debug: Log the original date value and its type
      console.log('🔍 Converting date:', { value: dateValue, type: typeof dateValue });
      
      // Handle MISys .NET JSON date format: /Date(1234567890)/
      if (typeof dateValue === 'string' && dateValue.includes('/Date(')) {
        const match = dateValue.match(/\/Date\((\d+)\)\//);
        if (match) {
          const timestamp = parseInt(match[1]);
          const converted = new Date(timestamp);
          console.log('✅ MISys date converted:', dateValue, '→', converted);
          return converted;
        }
      }
      
      // Handle ISO date strings (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss)
      if (typeof dateValue === 'string') {
        // Try ISO format first
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
          const parsed = new Date(dateValue);
          if (!isNaN(parsed.getTime())) {
            return parsed;
          }
        }
        
        // Try other common formats
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      
      // Handle Date objects
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      // Handle numeric timestamps (both seconds and milliseconds)
      if (typeof dateValue === 'number') {
        // If timestamp is in seconds (< year 2100), convert to milliseconds
        const timestamp = dateValue < 4102444800 ? dateValue * 1000 : dateValue;
        return new Date(timestamp);
      }
      
      return null;
    } catch (error) {
      console.warn('❌ Date conversion error:', error, 'for value:', dateValue);
      return null;
    }
  };

  // Format date for display
  const formatDisplayDate = (dateValue: any): string => {
    const date = convertMISysDate(dateValue);
    if (!date) return '—';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Sorting functions for interactive tables
  const sortData = (data: any[], field: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      
      // Handle dates with proper MISys conversion
      if (field.includes('Date') && (aVal || bVal)) {
        const aDate = convertMISysDate(aVal);
        const bDate = convertMISysDate(bVal);
        
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        
        aVal = aDate.getTime();
        bVal = bDate.getTime();
      }
      
      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      // Handle mixed/null values
      if (!aVal && bVal) return 1;
      if (aVal && !bVal) return -1;
      return 0;
    });
  };

  const handleSort = (field: string, type: 'po' | 'mo') => {
    if (type === 'po') {
      const newDirection = poSortField === field && poSortDirection === 'desc' ? 'asc' : 'desc';
      setPoSortField(field);
      setPoSortDirection(newDirection);
    } else {
      const newDirection = moSortField === field && moSortDirection === 'desc' ? 'asc' : 'desc';
      setMoSortField(field);
      setMoSortDirection(newDirection);
    }
  };
  const [emailContent, setEmailContent] = useState<string>('');
  const [aiAnalysisResults, setAiAnalysisResults] = useState<any>(null);
  const [documentsChecked, setDocumentsChecked] = useState<{ [key: string]: boolean }>({});
  const [photosChecked, setPhotosChecked] = useState<{ [key: string]: boolean }>({});
  

  
  // Modal states for clickable details
  const [selectedPO] = useState<any>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBOMPlanning, setShowBOMPlanning] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [expandedFormulas, setExpandedFormulas] = useState<Set<string>>(new Set());
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [componentUsage, setComponentUsage] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'status'>('name');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'short'>('all');

  // Function to close item modal
  const closeItemModal = () => {
    setShowItemModal(false);
    setSelectedItem(null);
    setShowAnalytics(false);
    setShowBOMPlanning(false);
    setShowFullDetails(false);
  };

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showItemModal) {
        closeItemModal();
      }
    };

    if (showItemModal) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showItemModal]);

  // Function to find where a component is used
  const findComponentUsage = (componentItemNo: string) => {
    const bomData = data['BillOfMaterialDetails.json'] || [];
    const usage = bomData
      .filter((bom: any) => bom["Component Item No."] === componentItemNo)
      .map((bom: any) => {
        const parentItem = (data['CustomAlert5.json'] || [])
          .find((item: any) => item["Item No."] === bom["Parent Item No."]);
        return {
          parentItemNo: bom["Parent Item No."],
          parentDescription: parentItem?.["Description"] || 'Unknown',
          requiredQuantity: bom["Required Quantity"],
          parentItem: parentItem
        };
      });
    setComponentUsage(usage);
    setSelectedComponent(componentItemNo);
  };

  // Enterprise-level metrics calculation
  const inventoryMetrics = useMemo(() => {
    const items = data['CustomAlert5.json'] || [];
    const totalItems = items.length;
    
    const totalValue = items.reduce((sum: number, item: any) => {
      const stock = parseStockValue(item["Stock"]);
      const cost = parseCostValue(item["Recent Cost"] || item["Unit Cost"] || item["Standard Cost"]);
      return sum + (stock * cost);
    }, 0);
    
    const lowStockItems = items.filter((item: any) => {
      const stock = parseStockValue(item["Stock"]);
      const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
      return stock <= reorderLevel && reorderLevel > 0;
    });
    
    const outOfStockItems = items.filter((item: any) => {
      const stock = parseStockValue(item["Stock"]);
      return stock === 0;
    });

    return {
      totalItems,
      totalValue,
      lowStockCount: lowStockItems.length,
      outOfStock: outOfStockItems.length,
      reorderValue: 0,
      averageValue: totalItems > 0 ? totalValue / totalItems : 0,
      lowStockItems: lowStockItems.slice(0, 20),
      outOfStockItems: outOfStockItems.slice(0, 10)
    };
  }, [data]);

  const manufacturingMetrics = useMemo(() => {
    const allMOs = data['ManufacturingOrderHeaders.json'] || [];
    const pending = allMOs.filter((mo: any) => mo["Status"] === 0).length;
    const active = allMOs.filter((mo: any) => mo["Status"] === 1).length;
    const closed = allMOs.filter((mo: any) => mo["Status"] === 2).length;
    const activeMOsList = allMOs.filter((mo: any) => mo["Status"] === 0 || mo["Status"] === 1);
    const totalValue = activeMOsList.reduce((sum: number, mo: any) => {
      const cost = parseFloat(mo["Cumulative Cost"] || mo["Total Material Cost"] || 0);
      return sum + cost;
    }, 0);
    return { pending, active, closed, total: activeMOsList.length, totalValue, totalAllMOs: allMOs.length };
  }, [data]);

  const purchaseMetrics = useMemo(() => {
    const purchaseDetails = data['PurchaseOrderDetails.json'] || [];
    const openPOs = purchaseDetails.filter((pod: any) => {
      const ordered = parseStockValue(pod["Ordered"]);
      const received = parseStockValue(pod["Received"]);
      return ordered > received;
    });
    const totalValue = purchaseDetails.reduce((sum: number, pod: any) => {
      const cost = parseCostValue(pod["Cost"]);
      const ordered = parseStockValue(pod["Ordered"]);
      return sum + (cost * ordered);
    }, 0);
    return {
      open: openPOs.length,
      totalValue,
      uniqueVendors: new Set((data['PurchaseOrderAdditionalCostsTaxes.json'] || []).map((s: any) => s.Name).filter(Boolean)).size,
      dueSoon: 0
    };
  }, [data]);

  // Filtered inventory with sorting and filtering
  const filteredInventory = useMemo(() => {
    let items = data['CustomAlert5.json'] || [];
    
    // Apply inventory filter (low-stock, out-of-stock, etc.)
    if (inventoryFilter === 'low-stock') {
      items = items.filter((item: any) => {
        const stock = parseStockValue(item["Stock"]);
        const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
        return stock <= reorderLevel && reorderLevel > 0;
      });
    } else if (inventoryFilter === 'out-of-stock') {
      items = items.filter((item: any) => {
        const stock = parseStockValue(item["Stock"]);
        return stock <= 0;
      });
    }
    
    // Apply smart search query - finds partial matches anywhere in the text
    if (searchQuery) {
      const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/); // Split by spaces for multi-word search
      
      items = items.filter((item: any) => {
        // Combine all searchable fields into one searchable text
        const searchableText = [
          item["Item No."] || '',
          item["Description"] || '',
          item["Item Type"] || '',
          item["Category"] || '',
          item["Manufacturer"] || '',
          item["Part Number"] || '',
          item["Model"] || ''
        ].join(' ').toLowerCase();
        
        // Check if ALL search terms are found anywhere in the combined text
        return searchTerms.every(term => searchableText.includes(term));
      });
    }
    
    // Apply status filter
    if (filterStatus === 'ready') {
      items = items.filter((item: any) => {
        const stock = parseStockValue(item["Stock"]);
        const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
        return stock > reorderLevel || reorderLevel <= 0;
      });
    } else if (filterStatus === 'short') {
      items = items.filter((item: any) => {
        const stock = parseStockValue(item["Stock"]);
        const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
        return stock <= reorderLevel && reorderLevel > 0;
      });
    }
    
    // Apply sorting
    items.sort((a: any, b: any) => {
      if (sortBy === 'name') {
        return (a["Item No."] || '').localeCompare(b["Item No."] || '');
      } else if (sortBy === 'quantity') {
        const stockA = parseStockValue(a["Stock"]);
        const stockB = parseStockValue(b["Stock"]);
        return stockB - stockA; // Descending order
      } else if (sortBy === 'status') {
        const stockA = parseStockValue(a["Stock"]);
        const stockB = parseStockValue(b["Stock"]);
        const reorderA = parseStockValue(a["Reorder Level"]) || parseStockValue(a["Minimum"]);
        const reorderB = parseStockValue(b["Reorder Level"]) || parseStockValue(b["Minimum"]);
        
        const statusA = stockA <= 0 ? 0 : (stockA <= reorderA && reorderA > 0 ? 1 : 2);
        const statusB = stockB <= 0 ? 0 : (stockB <= reorderB && reorderB > 0 ? 1 : 2);
        
        return statusA - statusB; // Out of stock first, then low stock, then in stock
      }
      return 0;
    });
    
    return items;
  }, [data, inventoryFilter, searchQuery, sortBy, filterStatus]);

  // REAL-TIME SALES ORDER ANALYTICS
  const salesOrderAnalytics = useMemo(() => {
    const salesOrders = data['SalesOrders.json'] || [];
    
    // Count orders by status
    const newAndRevised = salesOrders.filter((so: any) => {
      const status = (so["Status"] || '').toLowerCase();
      return status.includes('new') || status.includes('revised') || status.includes('pending') || status.includes('open');
    });
    
    const inProduction = salesOrders.filter((so: any) => {
      const status = (so["Status"] || '').toLowerCase();
      return status.includes('production') || status.includes('manufacturing') || status.includes('in progress') || status.includes('scheduled');
    });
    
    const completed = salesOrders.filter((so: any) => {
      const status = (so["Status"] || '').toLowerCase();
      return status.includes('completed') || status.includes('closed') || status.includes('shipped') || status.includes('delivered');
    });
    
    const cancelled = salesOrders.filter((so: any) => {
      const status = (so["Status"] || '').toLowerCase();
      return status.includes('cancelled') || status.includes('canceled') || status.includes('void');
    });
    
    // Get last updated dates
    const getLastUpdated = (orders: any[]) => {
      if (orders.length === 0) return 'No data';
      const dates = orders.map(so => new Date(so["Order Date"] || so["Created Date"] || Date.now()));
      const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const today = new Date();
      const diffTime = today.getTime() - latestDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return latestDate.toLocaleDateString();
    };
    
    return {
      newAndRevised: {
        count: newAndRevised.length,
        lastUpdated: getLastUpdated(newAndRevised)
      },
      inProduction: {
        count: inProduction.length,
        lastUpdated: getLastUpdated(inProduction)
      },
      completed: {
        count: completed.length,
        lastUpdated: getLastUpdated(completed)
      },
      cancelled: {
        count: cancelled.length,
        lastUpdated: getLastUpdated(cancelled)
      },
      total: salesOrders.length
    };
  }, [data]);

  // ENHANCED CUSTOMER ANALYSIS - Real business intelligence with smart name combining
  const customerAnalytics = useMemo(() => {
    const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
    const customers: { [key: string]: any } = {};

    // Smart company name normalization function
    const normalizeCompanyName = (name: string): string => {
      if (!name) return '';
      
      let normalized = name.trim();
      
      // Remove common punctuation variations
      normalized = normalized.replace(/[.,;:!?]+$/, ''); // Remove trailing punctuation
      normalized = normalized.replace(/\s+/g, ' '); // Normalize whitespace
      
      // Handle common company suffixes
      const suffixes = ['Inc', 'Inc.', 'Ltd', 'Ltd.', 'LLC', 'Corp', 'Corp.', 'Company', 'Co', 'Co.'];
      for (const suffix of suffixes) {
        if (normalized.toLowerCase().endsWith(suffix.toLowerCase())) {
          normalized = normalized.substring(0, normalized.length - suffix.length).trim() + ' ' + suffix;
        }
      }
      
      return normalized;
    };

    // Process all MOs to build comprehensive customer profiles
    moHeaders.forEach((mo: any) => {
      const customerName = mo["Customer"];
      if (!customerName || !customerName.trim()) return;
      
      const normalizedName = normalizeCompanyName(customerName);
      if (!customers[normalizedName]) {
        customers[normalizedName] = {
          name: normalizedName,
          originalNames: new Set([customerName.trim()]), // Track all original variations
          totalOrders: 0,
          totalQuantity: 0,
          totalValue: 0,
          activeOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          products: new Set(),
          lastOrderDate: null,
          urgentOrders: 0,
          manufacturingOrders: []
        };
      }
      
      const customer = customers[normalizedName];
      customer.originalNames.add(customerName.trim()); // Add this variation
      customer.manufacturingOrders.push(mo);
      customer.totalOrders++;
      
      // Better quantity parsing - try multiple fields
      const quantity = parseFloat(mo["Quantity"] || mo["Ordered Quantity"] || mo["Qty"] || 0);
      customer.totalQuantity += quantity;
      
      // Better cost parsing
      const cost = parseFloat(mo["Total Cost"] || mo["Cumulative Cost"] || mo["Order Value"] || 0);
      customer.totalValue += cost;
      
      // Status analysis
      if (mo["Status"] === 1) customer.activeOrders++;
      else if (mo["Status"] === 0) customer.pendingOrders++;
      else if (mo["Status"] === 2) customer.completedOrders++;
      
      // Product diversity
      const product = mo["Build Item No."];
      if (product && product.trim()) {
        customer.products.add(product.trim());
      }
      
      // Latest order date
      const orderDate = mo["Order Date"];
      if (orderDate && (!customer.lastOrderDate || new Date(orderDate) > new Date(customer.lastOrderDate))) {
        customer.lastOrderDate = orderDate;
      }
      
      // Urgent orders (due within 7 days)
      if (mo["Status"] === 1 && mo["Sales Order Ship Date"]) {
        try {
          const shipDate = new Date(mo["Sales Order Ship Date"]);
          const today = new Date();
          const daysUntilDue = Math.ceil((shipDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilDue <= 7) customer.urgentOrders++;
        } catch (e) {
          // Invalid date format
        }
      }
    });
    
    // Convert products Set to Array and sort manufacturing orders for each customer
    Object.values(customers).forEach((customer: any) => {
      customer.products = Array.from(customer.products);
      // Sort manufacturing orders by earliest to latest
      customer.manufacturingOrders.sort((a: any, b: any) => 
        new Date(a["Order Date"] || 0).getTime() - new Date(b["Order Date"] || 0).getTime()
      );
    });
    
    return {
      allCustomers: Object.values(customers),
      topByValue: Object.values(customers)
        .filter((c: any) => c.totalValue > 0)
        .sort((a: any, b: any) => b.totalValue - a.totalValue)
        .slice(0, 8),
      topByActive: Object.values(customers)
        .filter((c: any) => c.activeOrders > 0)
        .sort((a: any, b: any) => b.activeOrders - a.activeOrders)
        .slice(0, 8),
      recentActivity: Object.values(customers)
        .filter((c: any) => c.lastOrderDate)
        .sort((a: any, b: any) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime())
        .slice(0, 10),
      urgentCustomers: Object.values(customers)
        .filter((c: any) => c.urgentOrders > 0)
        .sort((a: any, b: any) => b.urgentOrders - a.urgentOrders),
      totalCustomers: Object.keys(customers).length,
      activeCustomers: Object.values(customers).filter((c: any) => c.activeOrders > 0).length
    };
  }, [data]);




  // Load actual folder contents from G: Drive
  const loadSOFolderData = async (path: string[]) => {
    if (path.length === 0) {
      setSoFolderData(null);
      return;
    }
    
    setSoLoading(true);
    try {
      const folderPath = path.join('/');
      console.log('🔄 Loading SO folder data for:', folderPath);
      
      const response = await fetch(`http://localhost:5002/api/sales-orders/folder/${folderPath}`);
      if (response.ok) {
        const folderData = await response.json();
        setSoFolderData(folderData);
        console.log('✅ Loaded SO folder data:', folderData);
      } else {
        console.error('❌ Failed to load SO folder data');
        setSoFolderData(null);
      }
    } catch (error) {
      console.error('❌ Error loading SO folder data:', error);
      setSoFolderData(null);
    } finally {
      setSoLoading(false);
    }
  };

  // Sales Orders navigation functions - LOADS REAL FILES
  const navigateToSOFolder = (folderName: string) => {
    const newPath = [...soCurrentPath, folderName];
    setSoCurrentPath(newPath);
    console.log('📁 Navigating to SO folder:', newPath.join(' / '));
    
    // Actually load the files from G: Drive
    loadSOFolderData(newPath);
  };

  const navigateBackSO = () => {
    if (soCurrentPath.length > 0) {
      const newPath = soCurrentPath.slice(0, -1);
      setSoCurrentPath(newPath);
      
      // Load the parent folder data
      loadSOFolderData(newPath);
    }
  };

  const resetSONavigation = () => {
    setSoCurrentPath([]);
    setSoFolderData(null);
  };

  // Sales Order viewer functions
  const openSOViewer = (file: any) => {
    setSelectedSOFile(file);
    setShowSOViewer(true);
  };

  const launchSOPDF = (file: any) => {
    // Open PDF in default application
    window.open(`file:///${file.path}`, '_blank');
  };

  const viewSOInBrowser = async (file: any) => {
    setPdfLoading(true);
    try {
      // View PDF in browser via backend using full file path
      const encodedPath = encodeURIComponent(file.path);
      const url = `http://localhost:5002/api/sales-order-pdf/${encodedPath}`;
      console.log('🌐 Opening PDF in browser:', url);
      
      // Give immediate feedback
      setTimeout(() => {
        window.open(url, '_blank');
        setPdfLoading(false);
      }, 100);
      
    } catch (error) {
      console.error('❌ Error opening PDF:', error);
      setPdfLoading(false);
    }
  };

  const openQuickView = (file: any) => {
    setSelectedSOFile(file);
    setShowQuickView(true);
    setPdfZoom(100); // Reset zoom
    setShowSOViewer(false);
  };

  const zoomIn = () => {
    setPdfZoom(prev => Math.min(prev + 25, 300));
  };

  const zoomOut = () => {
    setPdfZoom(prev => Math.max(prev - 25, 50));
  };

  const resetZoom = () => {
    setPdfZoom(100);
  };

  // Customer functions
  const openCustomerDetails = (customerName: string) => {
    // Reset pagination when opening new customer
    setMoCurrentPage(1);
    setMoPageSize(25);
    
    // Gather all data for this customer
    const customerMOs = (data['ManufacturingOrderHeaders.json'] || [])
      .filter((mo: any) => mo["Customer"] === customerName);
    
    const customerData = {
      name: customerName,
      manufacturingOrders: customerMOs,
      totalOrders: customerMOs.length,
      activeOrders: customerMOs.filter((mo: any) => mo["Status"] === 1).length,
      pendingOrders: customerMOs.filter((mo: any) => mo["Status"] === 0).length,
      completedOrders: customerMOs.filter((mo: any) => mo["Status"] === 2).length,
      totalValue: customerMOs.reduce((sum: number, mo: any) => sum + parseFloat(mo["Total Cost"] || mo["Cumulative Cost"] || 0), 0),
      totalQuantity: customerMOs.reduce((sum: number, mo: any) => sum + parseFloat(mo["Quantity"] || 0), 0),
      urgentOrders: customerMOs.filter((mo: any) => {
        if (mo["Status"] !== 1) return false;
        const shipDate = mo["Sales Order Ship Date"];
        if (!shipDate) return false;
        const dueDate = new Date(shipDate);
        const today = new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 7;
      }),
      lastOrderDate: customerMOs
        .filter((mo: any) => mo["Order Date"])
        .sort((a: any, b: any) => new Date(b["Order Date"]).getTime() - new Date(a["Order Date"]).getTime())[0]?.["Order Date"],
      products: [...new Set(customerMOs.map((mo: any) => mo["Build Item No."]).filter(Boolean))]
    };
    
    setSelectedCustomer(customerData);
    setShowCustomerDetails(true);
  };

  // MO details function
  const openMODetails = (mo: any) => {
    setSelectedMO(mo);
    setShowMODetails(true);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        
        {/* COMPACT CANOIL HEADER */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl shadow-lg overflow-hidden bg-white p-1">
              <img 
                src="/Canoil_logo.png" 
                alt="Canoil Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to the "C" if logo fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center"><span class="text-white font-black text-lg">C</span></div>';
                  }
                }}
              />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-slate-900 mb-0">CANOIL OPERATIONS</h1>
              <p className="text-xs text-blue-700 font-semibold">Manufacturing Intelligence Portal</p>
            </div>
          </div>
        </div>

        {/* ENTERPRISE NAVIGATION */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 max-w-7xl mx-auto mb-8">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border ${
              activeSection === 'dashboard' 
                ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3">📊</div>
            <div className="text-xl font-black">DASHBOARD</div>
            <div className="text-sm">Enterprise Overview</div>
          </button>

          <button
            onClick={() => setActiveSection('inventory')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border ${
              activeSection === 'inventory' 
                ? 'bg-gradient-to-br from-emerald-600 to-green-700 text-white border-emerald-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3">📦</div>
            <div className="text-xl font-black">INVENTORY & BOM</div>
            <div className="text-sm">{inventoryMetrics.totalItems.toLocaleString()} Items • Smart Planning</div>
          </button>

          <button
            onClick={() => setActiveSection('manufacturing-orders')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border text-center ${
              activeSection === 'manufacturing-orders' 
                ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-purple-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3">🏭</div>
            <div className="text-base font-black">MANUFACTURING</div>
            <div className="text-sm">
              {(() => {
                const allMOs = data?.['ManufacturingOrderHeaders.json'] || [];
                const realMOs = allMOs.filter((mo: any) => 
                  mo['Mfg. Order No.'] && mo['Build Item No.']
                );
                return `${realMOs.length} Orders`;
              })()}
            </div>
          </button>

          <button
            onClick={() => setActiveSection('vendors')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border ${
              activeSection === 'vendors' 
                ? 'bg-gradient-to-br from-orange-600 to-red-700 text-white border-orange-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3">🏪</div>
            <div className="text-xl font-black">PURCHASE</div>
            <div className="text-sm">
              {(() => {
                const allPOs = data?.['PurchaseOrders.json'] || [];
                const realPOs = allPOs.filter((po: any) => 
                  po['PO No.'] && po['Vendor']
                );
                return `${realPOs.length} Orders`;
              })()}
            </div>
          </button>

          <button
            onClick={() => setActiveSection('orders')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border ${
              activeSection === 'orders' 
                ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white border-cyan-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3">🛒</div>
            <div className="text-xl font-black">SALES</div>
            <div className="text-sm">
              {(() => {
                const realSalesOrders = data['RealSalesOrders'] || [];
                const salesOrdersByStatus = data['SalesOrdersByStatus'] || {};
                
                let totalOrders = realSalesOrders.length;
                
                if (typeof salesOrdersByStatus === 'object') {
                  Object.values(salesOrdersByStatus).forEach((orders: any) => {
                    if (Array.isArray(orders)) {
                      totalOrders += orders.length;
                    }
                  });
                }
                
                return `${totalOrders} Orders`;
              })()}
            </div>
          </button>

          <button
            onClick={() => setActiveSection('logistics')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border ${
              activeSection === 'logistics' 
                ? 'bg-gradient-to-br from-teal-600 to-green-700 text-white border-teal-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3">🚚</div>
            <div className="text-xl font-black">LOGISTICS</div>
            <div className="text-sm">Smart Shipping</div>
          </button>

          <button
            onClick={() => setActiveSection('ai-command')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border ${
              activeSection === 'ai-command'
                ? 'bg-gradient-to-br from-pink-600 to-purple-700 text-white border-pink-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3">🤖</div>
            <div className="text-xl font-black">AI COMMAND</div>
            <div className="text-sm">Intelligence Center</div>
          </button>
        </div>

        {/* CONTENT SECTIONS */}
        <div className="max-w-7xl mx-auto">
          
          {/* Dashboard */}
          {activeSection === 'dashboard' && (
            <CleanEnterpriseDashboard 
              data={data}
              inventoryMetrics={inventoryMetrics}
              manufacturingMetrics={manufacturingMetrics}
              purchaseMetrics={purchaseMetrics}
              formatCAD={formatCAD}
              onNavigate={setActiveSection}
            />
          )}


          {/* AI Command Center */}
          {activeSection === 'ai-command' && (
            <AICommandCenter
              data={data}
              onBack={() => setActiveSection('dashboard')}
              onNavigate={setActiveSection}
              onItemClick={(item) => {
                setSelectedItem(item);
                setShowItemModal(true);
                setShowAnalytics(false);
                setShowBOMPlanning(false);
              }}
            />
          )}

          {/* Production Schedule */}
          {activeSection === 'production-schedule' && (
            <ProductionSchedule
              data={data}
              onBack={() => setActiveSection('dashboard')}
            />
          )}

          {/* Logistics Automation */}
          {activeSection === 'logistics' && (
            <LogisticsAutomation />
          )}

          {/* Work Orders */}
          {activeSection === 'work-orders' && (
            <div className="space-y-6">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <h2 className="text-3xl font-bold text-slate-900 flex items-center mb-6">
                  🔧 Work Orders (Service/Maintenance)
                  <span className="ml-3 text-sm font-normal text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                    Service & Maintenance Orders
                  </span>
                </h2>
                <div className="text-center py-12">
                  <p className="text-gray-600">Work Orders (Service/Maintenance) - Coming Soon</p>
                  <p className="text-sm text-gray-500 mt-2">This is for service and maintenance work orders, NOT manufacturing production orders</p>
                </div>
              </div>
            </div>
          )}

          {/* Manufacturing Orders */}
          {activeSection === 'manufacturing-orders' && (
            <div className="space-y-6">
              {/* Manufacturing Page Header */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-3xl font-bold text-slate-900 flex items-center">
                    🏭 Manufacturing
                    <span className="ml-3 text-sm font-normal text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                      Production Performance
                    </span>
                  </h2>
                  <button
                    onClick={() => setActiveSection('production-schedule')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    📅 View Production Schedule
                  </button>
                </div>
                
                {/* Premium MO Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  
                  {/* Total MOs - Premium Card */}
                  <div className="group relative bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 rounded-2xl p-6 border border-blue-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-200/30 to-indigo-200/30 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                          <div className="text-2xl">📋</div>
                    </div>
                        <div>
                          <div className="font-bold text-blue-900 text-lg">Total MOs</div>
                          <div className="text-sm text-blue-700">All Orders</div>
                  </div>
                    </div>
                      <div className="text-3xl font-black text-blue-700">
                        {(data?.['ManufacturingOrderHeaders.json']?.length || 0).toLocaleString()}
                  </div>
                      <div className="text-xs text-blue-600 font-medium uppercase tracking-wider">
                        Manufacturing Orders
                    </div>
                  </div>
                    </div>

                  {/* Active MOs - Premium Card */}
                  <div className="group relative bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100 rounded-2xl p-6 border border-emerald-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-200/30 to-green-200/30 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                          <div className="text-2xl">⚡</div>
                        </div>
                        <div>
                          <div className="font-bold text-emerald-900 text-lg">Active MOs</div>
                          <div className="text-sm text-emerald-700">In Production</div>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-emerald-700">
                        {(data?.['ManufacturingOrderHeaders.json']?.filter((mo: any) => mo.Status === 1).length || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-emerald-600 font-medium uppercase tracking-wider">
                        Currently Running
                      </div>
                    </div>
                  </div>

                  {/* Planned MOs - Premium Card */}
                  <div className="group relative bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 rounded-2xl p-6 border border-amber-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-200/30 to-orange-200/30 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                          <div className="text-2xl">📅</div>
                        </div>
                        <div>
                          <div className="font-bold text-amber-900 text-lg">Planned MOs</div>
                          <div className="text-sm text-amber-700">Scheduled</div>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-amber-700">
                        {(data?.['ManufacturingOrderHeaders.json']?.filter((mo: any) => mo.Status === 0).length || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-amber-600 font-medium uppercase tracking-wider">
                        Ready to Start
                      </div>
                    </div>
                  </div>

                  {/* MO Details - Premium Card */}
                  <div className="group relative bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-100 rounded-2xl p-6 border border-purple-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-200/30 to-violet-200/30 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                          <div className="text-2xl">📊</div>
                        </div>
                        <div>
                          <div className="font-bold text-purple-900 text-lg">MO Details</div>
                          <div className="text-sm text-purple-700">Line Items</div>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-purple-700">
                        {(data?.['ManufacturingOrderDetails.json']?.length || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-purple-600 font-medium uppercase tracking-wider">
                        Total Components
                      </div>
                    </div>
                  </div>
                </div>

                {/* COMPREHENSIVE Manufacturing Orders Display - Only show if we have real data */}
                {data?.['ManufacturingOrderHeaders.json'] && Array.isArray(data['ManufacturingOrderHeaders.json']) && data['ManufacturingOrderHeaders.json'].length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">📋 Manufacturing Orders (Real Data)</h3>
                          <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">
                          {(() => {
                            const allMOs = data['ManufacturingOrderHeaders.json'] || [];
                            const realMOs = allMOs.filter((mo: any) => 
                              mo['Mfg. Order No.'] && mo['Build Item No.']
                            );
                                
                                // Calculate filtered count
                                let filteredMOs = realMOs;
                                if (moStatusFilter !== 'all') {
                                  filteredMOs = filteredMOs.filter((mo: any) => 
                                    mo['Status']?.toString() === moStatusFilter
                                  );
                                }
                                if (moCustomerFilter !== 'all') {
                                  filteredMOs = filteredMOs.filter((mo: any) => 
                                    mo['Customer'] === moCustomerFilter
                                  );
                                }
                                if (searchQuery.trim()) {
                                  const query = searchQuery.toLowerCase().trim();
                                  filteredMOs = filteredMOs.filter((mo: any) => 
                                    (mo['Mfg. Order No.'] && mo['Mfg. Order No.'].toString().toLowerCase().includes(query)) ||
                                    (mo['Customer'] && mo['Customer'].toLowerCase().includes(query)) ||
                                    (mo['Build Item No.'] && mo['Build Item No.'].toLowerCase().includes(query)) ||
                                    (mo['Description'] && mo['Description'].toLowerCase().includes(query)) ||
                                    (mo['Non-Stocked Build Item Description'] && mo['Non-Stocked Build Item Description'].toLowerCase().includes(query))
                                  );
                                }
                                
                                const startItem = (moCurrentPage - 1) * moPageSize + 1;
                                const endItem = Math.min(moCurrentPage * moPageSize, filteredMOs.length);
                                return `Showing ${startItem}-${endItem} of ${filteredMOs.length} Orders`;
                          })()}
                            </div>
                            
                            {/* Page Size Selector */}
                            <div className="flex items-center space-x-2">
                              <label className="text-sm text-gray-600">Show:</label>
                              <select 
                                value={moPageSize} 
                                onChange={(e) => {
                                  setMoPageSize(parseInt(e.target.value));
                                  setMoCurrentPage(1);
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                              </select>
                            </div>
                        </div>
                      </div>
                      
                      {/* Search and Filter Controls */}
                      <div className="space-y-4">
                        {/* Search Bar */}
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Search MO Number, Customer, Item, or Description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <select
                          value={moSortField}
                          onChange={(e) => setMoSortField(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="Mfg. Order No.">Sort by MO Number</option>
                          <option value="Customer">Sort by Customer</option>
                          <option value="Order Date">Sort by Order Date</option>
                          <option value="Cumulative Cost">Sort by Total Cost</option>
                          <option value="Ordered">Sort by Quantity</option>
                        </select>
                        <button
                          onClick={() => setMoSortDirection(moSortDirection === 'asc' ? 'desc' : 'asc')}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          {moSortDirection === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>

                        {/* Filter Controls */}
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium text-gray-700">Status:</label>
                            <select
                              value={moStatusFilter}
                              onChange={(e) => setMoStatusFilter(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              <option value="all">All Status</option>
                              <option value="0">Planned</option>
                              <option value="1">Released</option>
                              <option value="2">Started</option>
                              <option value="3">Finished</option>
                              <option value="4">Closed</option>
                            </select>
                  </div>

                          <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium text-gray-700">Customer:</label>
                            <select
                              value={moCustomerFilter}
                              onChange={(e) => setMoCustomerFilter(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm min-w-[150px]"
                            >
                              <option value="all">All Customers</option>
                              {(() => {
                                const uniqueCustomers = Array.from(new Set(
                                  (data['ManufacturingOrderHeaders.json'] || [])
                                    .filter((mo: any) => mo['Customer'])
                                    .map((mo: any) => mo['Customer'])
                                )).sort();
                                
                                return uniqueCustomers.map((customer: string) => (
                                  <option key={customer} value={customer}>{customer}</option>
                                ));
                              })()}
                            </select>
                          </div>

                          <button
                            onClick={() => {
                              setMoStatusFilter('all');
                              setMoCustomerFilter('all');
                              setSearchQuery('');
                            }}
                            className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                          >
                            Clear Filters
                          </button>
                        </div>
                      </div>
                  </div>
                  <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            {/* PRIMARY COLUMNS - Most Important */}
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100 bg-blue-50"
                                onClick={() => handleSort('Mfg. Order No.', 'mo')}>
                              MO Number {moSortField === 'Mfg. Order No.' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[150px] cursor-pointer hover:bg-gray-100 bg-blue-50"
                                onClick={() => handleSort('Customer', 'mo')}>
                              Customer Name {moSortField === 'Customer' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100 bg-blue-50"
                                onClick={() => handleSort('Build Item No.', 'mo')}>
                              Build Item {moSortField === 'Build Item No.' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[200px] bg-blue-50">Description</th>
                            
                            {/* QUANTITY & STATUS COLUMNS */}
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[80px] cursor-pointer hover:bg-gray-100 bg-green-50"
                                onClick={() => handleSort('Ordered', 'mo')}>
                              Ordered {moSortField === 'Ordered' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[80px] cursor-pointer hover:bg-gray-100 bg-green-50"
                                onClick={() => handleSort('Completed', 'mo')}>
                              Completed {moSortField === 'Completed' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-center p-2 font-medium text-gray-700 min-w-[80px] cursor-pointer hover:bg-gray-100 bg-green-50"
                                onClick={() => handleSort('Status', 'mo')}>
                              Status {moSortField === 'Status' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            
                            {/* DATE COLUMNS */}
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[90px] cursor-pointer hover:bg-gray-100 bg-yellow-50"
                                onClick={() => handleSort('Order Date', 'mo')}>
                              Order Date {moSortField === 'Order Date' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[90px] cursor-pointer hover:bg-gray-100 bg-yellow-50"
                                onClick={() => handleSort('Release Date', 'mo')}>
                              Start Date {moSortField === 'Release Date' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[90px] cursor-pointer hover:bg-gray-100 bg-yellow-50"
                                onClick={() => handleSort('Completion Date', 'mo')}>
                              Completion Date {moSortField === 'Completion Date' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            
                            {/* LOCATION & COST COLUMNS */}
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[80px] bg-purple-50">Location</th>
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100 bg-red-50"
                                onClick={() => handleSort('Projected Material Cost', 'mo')}>
                              Unit Cost {moSortField === 'Projected Material Cost' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[120px] cursor-pointer hover:bg-gray-100 bg-red-50"
                                onClick={() => handleSort('Cumulative Cost', 'mo')}>
                              Total Cost {moSortField === 'Cumulative Cost' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                        </tr>
                      </thead>
                      <tbody>
                          {(() => {
                            // Filter MO data with search and filter functionality
                            let filteredMOs = (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => 
                              mo['Mfg. Order No.'] && mo['Build Item No.'] // Only require MO number and item
                            );
                            
                            // Apply status filter
                            if (moStatusFilter !== 'all') {
                              filteredMOs = filteredMOs.filter((mo: any) => 
                                mo['Status']?.toString() === moStatusFilter
                              );
                            }
                            
                            // Apply customer filter
                            if (moCustomerFilter !== 'all') {
                              filteredMOs = filteredMOs.filter((mo: any) => 
                                mo['Customer'] === moCustomerFilter
                              );
                            }
                            
                            // Apply search filter
                            if (searchQuery.trim()) {
                              const query = searchQuery.toLowerCase().trim();
                              filteredMOs = filteredMOs.filter((mo: any) => 
                                (mo['Mfg. Order No.'] && mo['Mfg. Order No.'].toString().toLowerCase().includes(query)) ||
                                (mo['Customer'] && mo['Customer'].toLowerCase().includes(query)) ||
                                (mo['Build Item No.'] && mo['Build Item No.'].toLowerCase().includes(query)) ||
                                (mo['Description'] && mo['Description'].toLowerCase().includes(query)) ||
                                (mo['Non-Stocked Build Item Description'] && mo['Non-Stocked Build Item Description'].toLowerCase().includes(query))
                              );
                            }
                            
                            const sortedMOs = sortData(filteredMOs, moSortField, moSortDirection);
                            const startIndex = (moCurrentPage - 1) * moPageSize;
                            const endIndex = startIndex + moPageSize;
                            return sortedMOs.slice(startIndex, endIndex).map((mo: any, index: number) => {
                            
                            // Get status info
                            const getStatusInfo = (status: any) => {
                              switch(status) {
                                case 0: return { text: 'Planned', color: 'bg-yellow-100 text-yellow-700' };
                                case 1: return { text: 'Released', color: 'bg-green-100 text-green-700' };
                                case 2: return { text: 'Started', color: 'bg-blue-100 text-blue-700' };
                                case 3: return { text: 'Finished', color: 'bg-purple-100 text-purple-700' };
                                case 4: return { text: 'Closed', color: 'bg-gray-100 text-gray-700' };
                                default: return { text: 'Unknown', color: 'bg-red-100 text-red-700' };
                              }
                            };
                            
                            const statusInfo = getStatusInfo(mo['Status']);
                            
                            // Get item cost data from CustomAlert5.json
                            const itemData = (data['CustomAlert5.json'] || []).find((item: any) => 
                              item['Item No.'] === mo['Build Item No.']
                            );
                            
                            // Get real cost data - try multiple sources
                            const projectedMaterialCost = parseFloat(mo['Projected Material Cost'] || 0);
                            const actualMaterialCost = parseFloat(mo['Actual Material Cost'] || 0);
                            const cumulativeCost = parseFloat(mo['Cumulative Cost'] || 0);
                            const itemUnitCost = parseFloat(itemData?.['Unit Cost'] || 0);
                            
                            // Use actual cost if available, otherwise projected, otherwise item cost
                            const unitCost = actualMaterialCost > 0 ? actualMaterialCost : 
                                           projectedMaterialCost > 0 ? projectedMaterialCost : itemUnitCost;
                            
                            const totalCost = cumulativeCost > 0 ? cumulativeCost : 
                                            (projectedMaterialCost > 0 ? projectedMaterialCost : 0);
                            
                            const quantity = parseFloat(mo['Ordered'] || mo['Release Order Quantity'] || 0);
                            
                            // Get real dates - check multiple date fields
                            const orderDate = mo['Order Date'] || mo['Created Date'] || '';
                            const releaseDate = mo['Release Date'] || mo['Released Date'] || '';
                            const startDate = releaseDate || mo['Start Date'] || '';
                            const completionDate = mo['Completion Date'] || mo['Close Date'] || '';
                            
                            // Get real location data
                            const location = mo['Location No.'] || mo['Sales Location'] || mo['Work Center'] || '';
                            
                            return (
                              <tr 
                                key={index} 
                                className="border-b border-gray-100 hover:bg-purple-50 transition-colors cursor-pointer"
                                onClick={() => {
                                  setSelectedMO(mo);
                                  setShowMODetails(true);
                                  setShowFullDetails(false);
                                }}
                              >
                                {/* PRIMARY COLUMNS */}
                                <td className="p-2 font-mono text-blue-600 font-bold">
                                  {mo['Mfg. Order No.']}
                                </td>
                                <td className="p-2 text-gray-900 font-medium max-w-[150px] truncate">
                                  {mo['Customer'] || '—'}
                                </td>
                                <td className="p-2 font-mono text-gray-900">
                                  {mo['Build Item No.']}
                                </td>
                                <td className="p-2 text-gray-700 max-w-[200px] truncate">
                                  {mo['Non-Stocked Build Item Description'] && mo['Non-Stocked Build Item Description'].trim() ? mo['Non-Stocked Build Item Description'] : mo['Description'] || '—'}
                                </td>
                                
                                {/* QUANTITY & STATUS COLUMNS */}
                                <td className="p-2 text-right font-mono text-green-600 font-medium">
                                  {mo['Ordered'] > 0 ? mo['Ordered'].toLocaleString() : '—'}
                                </td>
                                <td className="p-2 text-right font-mono text-blue-600">
                                  {mo['Completed'] > 0 ? mo['Completed'].toLocaleString() : '—'}
                                </td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                    {statusInfo.text}
                              </span>
                            </td>
                                
                                {/* DATE COLUMNS - Using Real Data */}
                                <td className="p-2 text-gray-600 text-xs">
                                  {formatDisplayDate(orderDate)}
                                </td>
                                <td className="p-2 text-gray-600 text-xs">
                                  {formatDisplayDate(startDate)}
                                  {releaseDate && mo['Released By'] && (
                                    <div className="text-green-600 text-xs">Released by: {mo['Released By']}</div>
                                  )}
                                </td>
                                <td className="p-2 text-gray-600 text-xs">
                                  {formatDisplayDate(completionDate)}
                                  {mo['Completed'] > 0 && completionDate && (
                                    <div className="text-green-600 text-xs">✓ Done</div>
                                  )}
                                </td>
                                
                                {/* LOCATION & COST COLUMNS - Using Real Data */}
                                <td className="p-2 text-gray-600">
                                  {location && location.trim() ? location : '—'}
                                </td>
                                <td className="p-2 text-right font-mono text-green-600">
                                  {unitCost > 0 ? `$${unitCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'}
                                  {actualMaterialCost > 0 && (
                                    <div className="text-blue-600 text-xs">Actual</div>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono text-green-600 font-bold">
                                  {totalCost > 0 ? `$${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 
                                   (quantity > 0 && unitCost > 0) ? `$${(quantity * unitCost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'}
                                  {cumulativeCost > 0 && (
                                    <div className="text-purple-600 text-xs">Cumulative</div>
                                  )}
                                </td>
                          </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                    
                    {/* MO Summary Statistics - Only count real data */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        {(() => {
                          // Filter to only MOs with real data
                          const realMOs = (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => 
                            mo['Mfg. Order No.'] && mo['Build Item No.'] && (mo['Ordered'] > 0 || mo['Completed'] > 0)
                          );
                          
                          const totalOrdered = realMOs.reduce((sum: number, mo: any) => sum + (mo['Ordered'] || 0), 0);
                          const totalCompleted = realMOs.reduce((sum: number, mo: any) => sum + (mo['Completed'] || 0), 0);
                          const activeMOs = realMOs.filter((mo: any) => mo['Status'] === 1 || mo['Status'] === 2).length;
                          const completedMOs = realMOs.filter((mo: any) => mo['Status'] === 3 || mo['Status'] === 4).length;
                          const totalValue = realMOs.reduce((sum: number, mo: any) => sum + (mo['Cumulative Cost'] || 0), 0);
                          
                          return (
                            <>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  {totalOrdered.toLocaleString()}
                </div>
                                <div className="text-gray-600">Total Ordered</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  {totalCompleted.toLocaleString()}
                                </div>
                                <div className="text-gray-600">Total Completed</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  {activeMOs}
                                </div>
                                <div className="text-gray-600">Active MOs</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  {completedMOs}
                                </div>
                                <div className="text-gray-600">Completed MOs</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  ${totalValue.toLocaleString()}
                                </div>
                                <div className="text-gray-600">Total Value</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Production Schedule Section */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center">
                    📅 Production Schedule
                    <span className="ml-3 text-sm font-normal text-slate-600 bg-green-200 px-3 py-1 rounded-full">
                      Released MO Orders Timeline
                    </span>
                  </h3>
                  <button
                    onClick={() => setActiveSection('production-schedule')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📊 Full Schedule View
                  </button>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-800 mb-2">
                      🚀 Production Schedule Overview
                    </div>
                    <p className="text-gray-600 mb-4">
                      Timeline view of released Manufacturing Orders from MPS data and recent MO orders
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white p-3 rounded-lg border border-green-300">
                        <div className="text-xl font-bold text-green-700">
                          {(() => {
                            const releasedMOs = (data?.['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => 
                              mo['Released By'] && mo['Released By'] !== ''
                            );
                            return releasedMOs.length;
                          })()}
                        </div>
                        <div className="text-sm text-green-600">Released Orders</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-blue-300">
                        <div className="text-xl font-bold text-blue-700">
                          {(() => {
                            const activeMOs = (data?.['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => 
                              mo['Released By'] && !mo['Completed']
                            );
                            return activeMOs.length;
                          })()}
                        </div>
                        <div className="text-sm text-blue-600">In Production</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-purple-300">
                        <div className="text-xl font-bold text-purple-700">
                          {(() => {
                            const uniqueCustomers = new Set(
                              (data?.['ManufacturingOrderHeaders.json'] || [])
                                .filter((mo: any) => mo['Released By'] && mo['Customer'])
                                .map((mo: any) => mo['Customer'])
                            );
                            return uniqueCustomers.size;
                          })()}
                        </div>
                        <div className="text-sm text-purple-600">Active Customers</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveSection('production-schedule')}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all font-medium"
                    >
                      📈 View Full Production Schedule Timeline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Manufacturing Order Details Modal */}
          {showMODetails && selectedMO && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gray-200">
                {/* Professional MO Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-t-lg border-b border-purple-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">Manufacturing Order Details</h3>
                      <p className="text-purple-100">MO #{selectedMO['Mfg. Order No.']} - {selectedMO['Build Item No.']}</p>
                    </div>
                    <button
                      onClick={() => setShowMODetails(false)}
                      className="text-white/80 hover:text-white text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Tabs */}
                  <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setShowFullDetails(!showFullDetails)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        !showFullDetails ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 MO Details
                    </button>
                    <button
                      onClick={() => setShowFullDetails(true)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        showFullDetails ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🔗 Pegged SOs
                    </button>
                  </div>

                  {/* MO Details Tab */}
                  {!showFullDetails && (
                    <div className="space-y-6">
                      {/* Header Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3">📊 Status & Progress</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Status:</span>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                selectedMO['Status'] === 1 ? 'bg-green-100 text-green-800' :
                                selectedMO['Status'] === 0 ? 'bg-yellow-100 text-yellow-800' :
                                selectedMO['Status'] === 2 ? 'bg-blue-100 text-blue-800' :
                                selectedMO['Status'] === 3 ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {selectedMO['Status'] === 1 ? 'Released' :
                                 selectedMO['Status'] === 0 ? 'Planned' :
                                 selectedMO['Status'] === 2 ? 'Started' :
                                 selectedMO['Status'] === 3 ? 'Finished' : 'Unknown'}
                              </span>
                            </div>
                            
                            {selectedMO['Status'] === 1 && (() => {
                              const progressPercentage = Math.round(((parseFloat(selectedMO['Completed'] || 0) / Math.max(1, parseFloat(selectedMO['Ordered'] || 1))) * 100));
                              return (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">Progress:</span>
                                    <span className="text-sm text-gray-600">{progressPercentage}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${progressPercentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3">📦 Quantities</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Ordered:</span>
                              <span className="font-semibold">{selectedMO['Ordered']?.toLocaleString() || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Completed:</span>
                              <span className="font-semibold text-green-600">{selectedMO['Completed']?.toLocaleString() || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Remaining:</span>
                              <span className="font-semibold text-blue-600">
                                {((selectedMO['Ordered'] || 0) - (selectedMO['Completed'] || 0)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3">💰 Costs</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Unit Cost:</span>
                              <span className="font-semibold">
                                ${(selectedMO['Projected Material Cost'] || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Cost:</span>
                              <span className="font-semibold text-green-600">
                                ${(selectedMO['Cumulative Cost'] || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* R/E Fields Section */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="font-semibold text-slate-900 mb-4">📝 Manufacturing Order Fields (R/E)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Read-Only Fields */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Read-Only Fields</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">MO Number:</span>
                                <span className="font-mono">{selectedMO['Mfg. Order No.'] || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Build Item:</span>
                                <span className="font-mono">{selectedMO['Build Item No.'] || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Location:</span>
                                <span>{selectedMO['Location No.'] || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">WIP Qty:</span>
                                <span>{selectedMO['WIP']?.toLocaleString() || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Issued Qty:</span>
                                <span>{selectedMO['Issued']?.toLocaleString() || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Completed Qty:</span>
                                <span className="text-green-600">{selectedMO['Completed']?.toLocaleString() || '—'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Editable Fields */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Editable Fields</h5>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Planned Qty</label>
                                <input
                                  type="number"
                                  value={selectedMO['Ordered'] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Start</label>
                                <input
                                  type="date"
                                  value={selectedMO['Release Date'] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled End</label>
                                <input
                                  type="date"
                                  value={selectedMO['Completion Date'] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                                <input
                                  type="text"
                                  value={selectedMO['Priority'] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Job No.</label>
                                <input
                                  type="text"
                                  value={selectedMO['Job No.'] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                  readOnly
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pegged SOs Tab */}
                  {showFullDetails && (
                    <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">🔗 Pegged Sales Orders</h4>
                        <p className="text-sm text-blue-700">
                          Sales Orders that will be covered by this Manufacturing Order
                        </p>
                      </div>

                      {/* SO Search and Filter */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-4 mb-4">
                          <input
                            type="text"
                            placeholder="Search SO Number, Customer, or Item..."
                            value={soSearchQuery}
                            onChange={(e) => setSoSearchQuery(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <button
                            onClick={() => {
                              // Filter SOs that match this MO's build item
                              const matchingSOs = (data['SalesOrders.json'] || []).filter((so: any) => 
                                so.items && so.items.some((item: any) => 
                                  item.item_code === selectedMO['Build Item No.'] ||
                                  item.itemId === selectedMO['Build Item No.']
                                )
                              );
                              console.log('Matching SOs:', matchingSOs);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            🔍 Find Matching SOs
                          </button>
                        </div>

                        {/* SO Results */}
                        <div className="space-y-2">
                          {(() => {
                            const matchingSOs = (data['SalesOrders.json'] || []).filter((so: any) => {
                              if (!so.items) return false;
                              
                              const hasMatchingItem = so.items.some((item: any) => 
                                item.item_code === selectedMO['Build Item No.'] ||
                                item.itemId === selectedMO['Build Item No.']
                              );
                              
                              const matchesSearch = !soSearchQuery || 
                                so.so_number?.toLowerCase().includes(soSearchQuery.toLowerCase()) ||
                                so.customer_name?.toLowerCase().includes(soSearchQuery.toLowerCase());
                              
                              return hasMatchingItem && matchesSearch;
                            });

                            return matchingSOs.length > 0 ? (
                              matchingSOs.map((so: any, index: number) => (
                                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-semibold text-gray-900">SO #{so.so_number}</div>
                                      <div className="text-sm text-gray-600">{so.customer_name}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm text-gray-600">
                                        {so.items?.find((item: any) => 
                                          item.item_code === selectedMO['Build Item No.'] ||
                                          item.itemId === selectedMO['Build Item No.']
                                        )?.quantity || 0} units
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Due: {so.due_date || 'TBD'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <div className="text-4xl mb-2">🔍</div>
                                <div>No matching Sales Orders found</div>
                                <div className="text-sm">This MO may not be pegged to any SOs</div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vendors/Purchase Orders */}
          {activeSection === 'vendors' && (
            <div className="space-y-6">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <h2 className="text-3xl font-bold text-slate-900 flex items-center mb-6">
                  🏪 Vendors & Purchase Orders
                  <span className="ml-3 text-sm font-normal text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                    Vendor Management & POs
                  </span>
                </h2>
                
                {/* PO Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">
                      {data?.['PurchaseOrders.json']?.length || 0}
                    </div>
                    <div className="text-sm text-blue-600">Total POs</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">
                      {data?.['PurchaseOrderDetails.json']?.length || 0}
                    </div>
                    <div className="text-sm text-green-600">PO Line Items</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="text-2xl font-bold text-purple-700">
                      {new Set(data?.['PurchaseOrders.json']?.map((po: any) => po.Vendor).filter(Boolean)).size || 0}
                    </div>
                    <div className="text-sm text-purple-600">Active Vendors</div>
                  </div>
                </div>

                {/* COMPREHENSIVE Purchase Orders Display - Only show if we have real data */}
                {data?.['PurchaseOrders.json'] && Array.isArray(data['PurchaseOrders.json']) && data['PurchaseOrders.json'].length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">📋 Complete Purchase Orders Data</h3>
                        <div className="text-sm text-gray-600">
                          Total POs: {(data['PurchaseOrders.json'] || []).length}
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100" 
                                onClick={() => handleSort('PO No.', 'po')}>
                              PO Number {poSortField === 'PO No.' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[120px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Supplier No.', 'po')}>
                              Supplier {poSortField === 'Supplier No.' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Buyer', 'po')}>
                              Buyer {poSortField === 'Buyer' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[80px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Order Date', 'po')}>
                              Order Date {poSortField === 'Order Date' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[80px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Status', 'po')}>
                              Status {poSortField === 'Status' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Total Amount', 'po')}>
                              Total Amount {poSortField === 'Total Amount' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Invoiced Amount', 'po')}>
                              Invoiced Amount {poSortField === 'Invoiced Amount' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[100px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Received Amount', 'po')}>
                              Received Amount {poSortField === 'Received Amount' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[80px]">Currency</th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[100px]">Terms</th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[100px]">Ship Via</th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[80px]">FOB</th>
                            <th className="text-right p-2 font-medium text-gray-700 min-w-[80px]">Freight</th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[100px]">Contact</th>
                            <th className="text-left p-2 font-medium text-gray-700 min-w-[80px] cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('Close Date', 'po')}>
                              Close Date {poSortField === 'Close Date' && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Filter and sort PO data
                            const filteredPOs = (data['PurchaseOrders.json'] || []).filter((po: any) => 
                              po['PO No.'] && (po['Supplier No.'] || po['Name']) && 
                              (po['Total Amount'] > 0 || po['Invoiced Amount'] > 0 || po['Received Amount'] > 0)
                            );
                            const sortedPOs = sortData(filteredPOs, poSortField, poSortDirection);
                            return sortedPOs.slice(0, 100).map((po: any, index: number) => {
                            // Get status info
                            const getStatusInfo = (status: any) => {
                              switch(status) {
                                case 0: return { text: 'Open', color: 'bg-green-100 text-green-700' };
                                case 1: return { text: 'Pending', color: 'bg-yellow-100 text-yellow-700' };
                                case 2: return { text: 'Closed', color: 'bg-gray-100 text-gray-700' };
                                case 3: return { text: 'Cancelled', color: 'bg-red-100 text-red-700' };
                                default: return { text: status || 'Unknown', color: 'bg-blue-100 text-blue-700' };
                              }
                            };
                            
                            const statusInfo = getStatusInfo(po['Status']);
                            
                            // Only show rows with meaningful data
                            const hasData = po['PO No.'] && (po['Supplier No.'] || po['Name']) && 
                                          (po['Total Amount'] > 0 || po['Invoiced Amount'] > 0 || po['Received Amount'] > 0);
                            
                            if (!hasData) return null;
                            
                            return (
                              <tr key={index} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                                <td className="p-2 font-mono text-blue-600 font-medium">
                                  {po['PO No.']}
                                </td>
                                <td className="p-2 font-medium text-gray-900">
                                  {po['Supplier No.'] || po['Name']}
                                </td>
                                <td className="p-2 text-gray-700">
                                  {po['Buyer'] && po['Buyer'].trim() ? po['Buyer'] : '—'}
                                </td>
                                <td className="p-2 text-gray-600 text-xs">
                                  {formatDisplayDate(po['Order Date'])}
                                </td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                    {statusInfo.text}
                                </span>
                              </td>
                                <td className="p-2 text-right font-mono text-green-600 font-medium">
                                  {po['Total Amount'] > 0 ? 
                                    `$${po['Total Amount'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                                    '—'
                                  }
                                </td>
                                <td className="p-2 text-right font-mono text-orange-600">
                                  {po['Invoiced Amount'] > 0 ? 
                                    `$${po['Invoiced Amount'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                                    '—'
                                  }
                                </td>
                                <td className="p-2 text-right font-mono text-blue-600">
                                  {po['Received Amount'] > 0 ? 
                                    `$${po['Received Amount'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                                    '—'
                                  }
                                </td>
                                <td className="p-2 text-gray-600 font-mono">
                                  {po['Source Currency'] || po['Home Currency'] || '—'}
                                </td>
                                <td className="p-2 text-gray-600">
                                  {po['Terms'] && po['Terms'].trim() ? po['Terms'] : '—'}
                                </td>
                                <td className="p-2 text-gray-600">
                                  {po['Ship Via'] && po['Ship Via'].trim() ? po['Ship Via'] : '—'}
                                </td>
                                <td className="p-2 text-gray-600">
                                  {po['FOB'] && po['FOB'].trim() ? po['FOB'] : '—'}
                                </td>
                                <td className="p-2 text-right font-mono text-gray-600">
                                  {po['Freight'] > 0 ? 
                                    `$${po['Freight'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                                    '—'
                                  }
                                </td>
                                <td className="p-2 text-gray-600">
                                  {po['Contact'] && po['Contact'].trim() ? po['Contact'] : '—'}
                                </td>
                                <td className="p-2 text-gray-600 text-xs">
                                  {po['Close Date'] ? formatDisplayDate(po['Close Date']) : 'Open'}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* PO Summary Statistics - Only count real data */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {(() => {
                          // Filter to only POs with real data
                          const realPOs = (data['PurchaseOrders.json'] || []).filter((po: any) => 
                            po['PO No.'] && (po['Supplier No.'] || po['Name']) && 
                            (po['Total Amount'] > 0 || po['Invoiced Amount'] > 0 || po['Received Amount'] > 0)
                          );
                          
                          const totalAmount = realPOs.reduce((sum: number, po: any) => sum + (po['Total Amount'] || 0), 0);
                          const totalInvoiced = realPOs.reduce((sum: number, po: any) => sum + (po['Invoiced Amount'] || 0), 0);
                          const openPOs = realPOs.filter((po: any) => po['Status'] === 0).length;
                          const uniqueSuppliers = new Set(realPOs.map((po: any) => po['Supplier No.'] || po['Name']).filter(Boolean)).size;
                          
                          return (
                            <>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  ${totalAmount.toLocaleString()}
                                </div>
                                <div className="text-gray-600">Total Amount</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  ${totalInvoiced.toLocaleString()}
                                </div>
                                <div className="text-gray-600">Total Invoiced</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  {openPOs}
                                </div>
                                <div className="text-gray-600">Open POs</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-gray-900">
                                  {uniqueSuppliers}
                                </div>
                                <div className="text-gray-600">Active Suppliers</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Intelligence Section */}
          {activeSection === 'intelligence' && (
            <div className="space-y-6">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <h2 className="text-3xl font-bold text-slate-900 flex items-center mb-6">
                  🧠 Business Intelligence
                  <span className="ml-3 text-sm font-normal text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                    AI Analytics & Insights
                  </span>
                </h2>
                <div className="text-center py-12">
                  <p className="text-gray-600">Advanced Business Intelligence Dashboard</p>
                  <p className="text-sm text-gray-500 mt-2">AI-powered analytics and insights coming soon</p>
                  <button 
                    onClick={() => onNavigate && onNavigate('ai-command')}
                    className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Go to AI Command Center
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OLD LOGISTICS SECTION - DISABLED */}
          {false && (
            <div className="space-y-6">
              
              {/* Logistics Header with Progress */}
              <div className="bg-gradient-to-br from-cyan-50 to-teal-100 rounded-2xl shadow-xl border border-cyan-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-cyan-900 flex items-center">
                      🚚 Canoil Logistics Wizard
                      <div className="ml-4 text-sm font-normal text-cyan-600 bg-cyan-200 px-3 py-1 rounded-full">
                        AI-POWERED
                      </div>
                    </h2>
                    <p className="text-cyan-700">
                      Professional shipping workflow with PDF parsing, email analysis, and GPT-4 assistance
                    </p>
                  </div>
                  
                  {/* Progress Indicator */}
                  <div className="text-right">
                    <div className="text-sm font-medium text-cyan-800 mb-2">Progress</div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((step) => (
                        <div 
                          key={step}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            step <= logisticsStep 
                              ? 'bg-cyan-600 text-white' 
                              : 'bg-cyan-200 text-cyan-600'
                          }`}
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-cyan-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-cyan-900">
                      {(data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => mo["Status"] === 1).length}
                    </div>
                    <div className="text-xs text-cyan-700 font-medium">ORDERS IN PRODUCTION</div>
                  </div>
                  <div className="bg-teal-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-teal-900">{pdfFile ? '✅' : '📄'}</div>
                    <div className="text-xs text-teal-700 font-medium">{pdfFile ? 'PDF LOADED' : 'PDF PARSER READY'}</div>
                  </div>
                  <div className="bg-blue-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-blue-900">{aiAnalysisResults ? '✅' : '🤖'}</div>
                    <div className="text-xs text-blue-700 font-medium">{aiAnalysisResults ? 'AI ANALYZED' : 'AI READY'}</div>
                  </div>
                  <div className="bg-green-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-green-900">{selectedWorkflow ? '✅' : '⚡'}</div>
                    <div className="text-xs text-green-700 font-medium">{selectedWorkflow ? 'WORKFLOW SET' : 'SELECT WORKFLOW'}</div>
                  </div>
                </div>
              </div>

              {/* Step Navigation */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-4">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { step: 1, label: 'Workflow', icon: '📋' },
                    { step: 2, label: 'Autofill', icon: '✨' },
                    { step: 3, label: 'Details', icon: '📦' },
                    { step: 4, label: 'Documents', icon: '📄' },
                    { step: 5, label: 'Finish', icon: '🎯' }
                  ].map((stepInfo) => (
                    <button
                      key={stepInfo.step}
                      onClick={() => setLogisticsStep(stepInfo.step)}
                      className={`p-4 rounded-xl transition-all ${
                        logisticsStep === stepInfo.step
                          ? 'bg-cyan-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="text-2xl mb-1">{stepInfo.icon}</div>
                      <div className="text-sm font-medium">{stepInfo.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 1: Workflow Selection */}
              {logisticsStep === 1 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">📋 Step 1: Choose Shipping Workflow</h3>
                  <p className="text-gray-600 mb-6">Select the process that matches this shipment type</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Proforma / Company Logistics */}
                    <div 
                      onClick={() => setSelectedWorkflow('proforma')}
                      className={`group rounded-xl p-6 border transition-all cursor-pointer ${
                        selectedWorkflow === 'proforma'
                          ? 'bg-gradient-to-br from-blue-100 to-indigo-200 border-blue-400 shadow-lg scale-105'
                          : 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow">
                          📊
                        </div>
                        <div>
                          <div className="font-bold text-blue-900">Proforma / Company Logistics</div>
                          <div className="text-sm text-blue-700">US only: Smart Border</div>
                        </div>
                      </div>
                      <div className="text-xs text-blue-600 mb-3">
                        Est. freight $1200; DECLARED VALUE; check both boxes
                      </div>
                      {selectedWorkflow === 'proforma' && (
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                          ✅ SELECTED
                        </div>
                      )}
                    </div>

                    {/* UPS Customer Account */}
                    <div 
                      onClick={() => setSelectedWorkflow('ups')}
                      className={`group rounded-xl p-6 border transition-all cursor-pointer ${
                        selectedWorkflow === 'ups'
                          ? 'bg-gradient-to-br from-amber-100 to-orange-200 border-amber-400 shadow-lg scale-105'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center shadow">
                          📦
                        </div>
                        <div>
                          <div className="font-bold text-amber-900">UPS Customer Account</div>
                          <div className="text-sm text-amber-700">Label per box</div>
                        </div>
                      </div>
                      <div className="text-xs text-amber-600 mb-3">
                        UPS Create Shipment. Driver Ref=PO. Label per box.
                      </div>
                      {selectedWorkflow === 'ups' && (
                        <div className="bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                          ✅ SELECTED
                        </div>
                      )}
                    </div>

                    {/* Commercial Invoice */}
                    <div 
                      onClick={() => setSelectedWorkflow('commercial')}
                      className={`group rounded-xl p-6 border transition-all cursor-pointer ${
                        selectedWorkflow === 'commercial'
                          ? 'bg-gradient-to-br from-purple-100 to-pink-200 border-purple-400 shadow-lg scale-105'
                          : 'bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shadow">
                          📄
                        </div>
                        <div>
                          <div className="font-bold text-purple-900">Commercial Invoice</div>
                          <div className="text-sm text-purple-700">Hand-made CI</div>
                        </div>
                      </div>
                      <div className="text-xs text-purple-600 mb-3">
                        Before CI: get freight quote + waybill from carrier
                      </div>
                      {selectedWorkflow === 'commercial' && (
                        <div className="bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                          ✅ SELECTED
                        </div>
                      )}
                    </div>

                    {/* Customer Pickup */}
                    <div 
                      onClick={() => setSelectedWorkflow('pickup')}
                      className={`group rounded-xl p-6 border transition-all cursor-pointer ${
                        selectedWorkflow === 'pickup'
                          ? 'bg-gradient-to-br from-green-100 to-emerald-200 border-green-400 shadow-lg scale-105'
                          : 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-500 text-white flex items-center justify-center shadow">
                          👥
                        </div>
                        <div>
                          <div className="font-bold text-green-900">Customer Pickup</div>
                          <div className="text-sm text-green-700">Customer's driver</div>
                        </div>
                      </div>
                      <div className="text-xs text-green-600 mb-3">
                        Customer's driver picks up
                      </div>
                      {selectedWorkflow === 'pickup' && (
                        <div className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                          ✅ SELECTED
                        </div>
                      )}
                    </div>

                    {/* Dangerous Goods */}
                    <div 
                      onClick={() => setSelectedWorkflow('dangerous')}
                      className={`group rounded-xl p-6 border transition-all cursor-pointer ${
                        selectedWorkflow === 'dangerous'
                          ? 'bg-gradient-to-br from-red-100 to-rose-200 border-red-400 shadow-lg scale-105'
                          : 'bg-gradient-to-br from-red-50 to-rose-100 border-red-200 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow">
                          ⚠️
                        </div>
                        <div>
                          <div className="font-bold text-red-900">Dangerous Goods</div>
                          <div className="text-sm text-red-700">Reolube (UN 3082)</div>
                        </div>
                      </div>
                      <div className="text-xs text-red-600 mb-3">
                        Class 9. Domestic: no proforma/CI; include gross weight
                      </div>
                      {selectedWorkflow === 'dangerous' && (
                        <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                          ✅ SELECTED
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedWorkflow && (
                    <div className="mt-6 text-center">
                      <button 
                        onClick={() => setLogisticsStep(2)}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
                      >
                        Continue to Autofill →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Autofill */}
              {logisticsStep === 2 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                    ✨ Step 2: Autofill from SO PDF & Carolina's Email
                    <div className="ml-4 text-sm font-normal text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                      GPT-4 MINI
                    </div>
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Upload Sales Order PDF or paste Carolina's email. AI will extract shipping details automatically.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Enhanced PDF Upload */}
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-3xl">{pdfFile ? '✅' : '📄'}</div>
                        <div>
                          <div className="font-bold text-blue-900">Sales Order PDF</div>
                          <div className="text-sm text-blue-700">
                            {pdfFile?.name ? `Loaded: ${pdfFile?.name}` : 'AI will parse automatically'}
                          </div>
                        </div>
                      </div>
                      
                      <input 
                        type="file" 
                        accept="application/pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="w-full p-3 border border-blue-300 rounded-lg bg-white"
                      />
                      
                      {pdfFile && (
                        <button 
                          onClick={() => {
                            // Trigger AI analysis
                            console.log('Analyzing PDF with GPT-4 Mini:', pdfFile?.name);
                            setAiAnalysisResults({ source: 'pdf', extracted: true });
                          }}
                          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          🤖 Analyze with GPT-4 Mini
                        </button>
                      )}
                      
                      <div className="mt-3 text-xs text-blue-600">
                        📋 Extracts: SO #, PO #, Batch #, Destination, Weight, Dimensions
                      </div>
                    </div>

                    {/* Enhanced Email Parser */}
                    <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-3xl">{emailContent ? '✅' : '📧'}</div>
                        <div>
                          <div className="font-bold text-amber-900">Carolina's Email</div>
                          <div className="text-sm text-amber-700">
                            {emailContent ? 'Email content loaded' : 'Paste email content'}
                          </div>
                        </div>
                      </div>
                      
                      <textarea 
                        rows={6}
                        value={emailContent}
                        onChange={(e) => setEmailContent(e.target.value)}
                        placeholder="Paste Carolina's email here..."
                        className="w-full p-3 border border-amber-300 rounded-lg bg-white text-sm"
                      />
                      
                      {emailContent && (
                        <button 
                          onClick={() => {
                            // Trigger email analysis
                            console.log('Parsing email with AI');
                            setAiAnalysisResults({ source: 'email', extracted: true });
                          }}
                          className="mt-3 w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          🪄 Parse Email with AI
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* AI Analysis Results */}
                  {aiAnalysisResults && (
                    <div className="mt-6 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6 border border-green-200">
                      <h4 className="font-bold text-green-900 mb-3">🤖 AI Extraction Results</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div><span className="text-gray-600">SO Number:</span> <span className="font-bold">2979-MK</span></div>
                        <div><span className="text-gray-600">PO Number:</span> <span className="font-bold">PO-190244</span></div>
                        <div><span className="text-gray-600">Destination:</span> <span className="font-bold">Toronto, ON</span></div>
                        <div><span className="text-gray-600">Weight:</span> <span className="font-bold">1,250 kg</span></div>
                        <div><span className="text-gray-600">Skids:</span> <span className="font-bold">4 skids</span></div>
                        <div><span className="text-gray-600">Type:</span> <span className="font-bold">Domestic</span></div>
                      </div>
                      <button 
                        onClick={() => setLogisticsStep(3)}
                        className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
                      >
                        ✅ Apply Extracted Data & Continue
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Shipment Details */}
              {logisticsStep === 3 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">📦 Step 3: Review Shipment Details</h3>
                  <p className="text-sm text-indigo-700 mb-6">
                    <strong>Note:</strong> Smart Border is for US Transborder only (never domestic)
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shipment Type <span className="text-red-500">*</span>
                      </label>
                      <select 
                        value={logisticsData.shipmentType}
                        onChange={(e) => setLogisticsData({...logisticsData, shipmentType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Select...</option>
                        <option>Domestic (Canada)</option>
                        <option>US Transborder</option>
                        <option>Dangerous Goods</option>
                        <option>Customer Pickup</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Carrier <span className="text-red-500">*</span>
                      </label>
                      <select 
                        value={logisticsData.carrier}
                        onChange={(e) => setLogisticsData({...logisticsData, carrier: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Select...</option>
                        <option>Manitoulin</option>
                        <option>Gateway</option>
                        <option>Fuse</option>
                        <option>DB Schenker</option>
                        <option>Traffic Tech</option>
                        <option>UPS (Customer Account)</option>
                        <option>Customer Pickup</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Destination <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text"
                        value={logisticsData.destination}
                        onChange={(e) => setLogisticsData({...logisticsData, destination: e.target.value})}
                        placeholder="City/State or full address"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gross Weight <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text"
                        value={logisticsData.grossWeight}
                        onChange={(e) => setLogisticsData({...logisticsData, grossWeight: e.target.value})}
                        placeholder="Total gross (kg)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Skids / Pieces</label>
                      <input 
                        type="text"
                        value={logisticsData.skidsPieces}
                        onChange={(e) => setLogisticsData({...logisticsData, skidsPieces: e.target.value})}
                        placeholder="e.g., 4 skids / 22 boxes"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Date</label>
                      <input 
                        type="date"
                        value={logisticsData.pickupDate}
                        onChange={(e) => setLogisticsData({...logisticsData, pickupDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6 text-center">
                    <button 
                      onClick={() => setLogisticsStep(4)}
                      disabled={!logisticsData.shipmentType || !logisticsData.carrier || !logisticsData.destination}
                      className={`px-8 py-3 rounded-xl font-bold transition-colors ${
                        logisticsData.shipmentType && logisticsData.carrier && logisticsData.destination
                          ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Continue to Documents →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Document Pack */}
              {logisticsStep === 4 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">📋 Step 4: Document Pack & Photos</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Smart Document List */}
                    <div>
                      <h4 className="font-bold text-gray-800 mb-3">📄 Required Documents for {logisticsData.shipmentType}</h4>
                      <div className="space-y-2">
                        {(() => {
                          const getDocuments = () => {
                            switch (logisticsData.shipmentType) {
                              case 'US Transborder':
                                return ['Commercial Invoice (declares metal value)', 'Proforma (Smart Border)', 'USMCA', 'TSCA', 'BOL', 'Packing Slips (4 copies)', 'COA'];
                              case 'Dangerous Goods':
                                return ['DG Declaration', 'BOL', 'COA', 'SDS', 'Packing Slips'];
                              case 'Customer Pickup':
                                return ['BOL', 'Packing Slips (Driver + Company copies)'];
                              default:
                                return ['BOL', 'Packing Slips (4 copies)', 'COA (if applicable)'];
                            }
                          };
                          
                          return getDocuments().map((doc, index) => (
                            <label key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-white/70 hover:bg-blue-50 transition-colors">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4"
                                checked={documentsChecked[`doc_${index}`] || false}
                                onChange={(e) => setDocumentsChecked({
                                  ...documentsChecked,
                                  [`doc_${index}`]: e.target.checked
                                })}
                              />
                              <span className="text-sm text-gray-800">{doc}</span>
                            </label>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Photos & Audit */}
                    <div>
                      <h4 className="font-bold text-gray-800 mb-3">📸 Photos & Dock Audit</h4>
                      <div className="space-y-2">
                        {[
                          'Skid labels (PO, address, skid #) visible',
                          'All sides of each skid/box (damage check)',
                          'COLORED LABELS for ALCO (if applicable)',
                          'Loaded truck with CCL label visible',
                          'Paperwork set (BOL + doc pack)'
                        ].map((item, index) => (
                          <label key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-white/70 hover:bg-green-50 transition-colors">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4"
                              checked={photosChecked[`photo_${index}`] || false}
                              onChange={(e) => setPhotosChecked({
                                ...photosChecked,
                                [`photo_${index}`]: e.target.checked
                              })}
                            />
                            <span className="text-sm text-gray-800">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 text-center">
                    <button 
                      onClick={() => setLogisticsStep(5)}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
                    >
                      Generate Run Sheet →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Generate Run Sheet */}
              {logisticsStep === 5 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">🎯 Step 5: Generate Professional Run Sheet</h3>
                  
                  {/* Run Sheet Preview */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mb-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">📄 Canoil Shipment Run Sheet</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-600">Workflow:</span> <span className="font-medium">{selectedWorkflow}</span></div>
                      <div><span className="text-gray-600">Shipment Type:</span> <span className="font-medium">{logisticsData.shipmentType}</span></div>
                      <div><span className="text-gray-600">Carrier:</span> <span className="font-medium">{logisticsData.carrier}</span></div>
                      <div><span className="text-gray-600">Destination:</span> <span className="font-medium">{logisticsData.destination}</span></div>
                      <div><span className="text-gray-600">Gross Weight:</span> <span className="font-medium">{logisticsData.grossWeight}</span></div>
                      <div><span className="text-gray-600">Pickup Date:</span> <span className="font-medium">{logisticsData.pickupDate}</span></div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="text-sm">
                        <strong>Documents:</strong> {Object.values(documentsChecked).filter(Boolean).length} of {Object.keys(documentsChecked).length} checked
                      </div>
                      <div className="text-sm">
                        <strong>Photos:</strong> {Object.values(photosChecked).filter(Boolean).length} of {Object.keys(photosChecked).length} checked
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors">
                      📄 Generate & Download Run Sheet
                    </button>
                    <button className="px-6 py-4 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center gap-2 transition-colors">
                      🖨️ Print
                    </button>
                    <button 
                      onClick={() => {
                        setLogisticsStep(1);
                        setSelectedWorkflow('');
                        setLogisticsData({
                          shipmentType: '', carrier: '', serviceLevel: 'Standard', destination: '',
                          grossWeight: '', skidsPieces: '', dimensions: '', readyTime: '',
                          pickupDate: new Date().toISOString().split('T')[0],
                          soNumber: '', poNumber: '', batchNumber: ''
                        });
                        setPdfFile(null);
                        setEmailContent('');
                        setAiAnalysisResults(null);
                        setDocumentsChecked({});
                        setPhotosChecked({});
                      }}
                      className="px-6 py-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium flex items-center gap-2 transition-colors"
                    >
                      🔄 Start Over
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inventory */}
          {activeSection === 'inventory' && (
            <div className="space-y-6">
              
              
              {/* INVENTORY BROWSER */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center">
                    📦 Inventory Browser
                    <span className="ml-3 text-sm font-normal text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                      Browse & Search Items
                    </span>
                  </h3>
                  <div className="text-sm text-slate-600">
                    {filteredInventory.length} items found
                  </div>
                </div>
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Smart search: 'tx case', 'bottle 1l', 'semi synthetic'... (finds partial matches!)"
                    className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="flex items-center space-x-2">
                      <div className="text-blue-500 text-xl">⚡</div>
                      <div className="text-xs text-gray-500">SMART SEARCH</div>
                    </div>
                  </div>
                </div>
                
                {/* Premium Enterprise Filter Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* ALL ITEMS - Premium Card */}
                  <button 
                    onClick={() => setInventoryFilter('all')}
                    className={`group relative rounded-2xl p-6 transition-all duration-300 overflow-hidden ${
                      inventoryFilter === 'all' 
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-2xl scale-105' 
                        : 'bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 hover:shadow-xl hover:scale-105 border border-blue-200'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -translate-y-10 translate-x-10"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                          inventoryFilter === 'all' ? 'bg-white/20' : 'bg-blue-500 text-white'
                        }`}>
                          <div className="text-xl">📊</div>
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-lg">ALL ITEMS</div>
                          <div className="text-sm opacity-80">Complete Inventory</div>
                        </div>
                      </div>
                      <div className={`text-3xl font-black ${
                        inventoryFilter === 'all' ? 'text-white' : 'text-blue-600'
                      }`}>
                        {(data['CustomAlert5.json'] || []).length.toLocaleString()}
                      </div>
                      <div className={`text-xs font-medium uppercase tracking-wider ${
                        inventoryFilter === 'all' ? 'text-white/80' : 'text-blue-500'
                      }`}>
                        Total Items
                      </div>
                    </div>
                  </button>

                  {/* LOW STOCK - Premium Card */}
                  <button 
                    onClick={() => setInventoryFilter('low-stock')}
                    className={`group relative rounded-2xl p-6 transition-all duration-300 overflow-hidden ${
                      inventoryFilter === 'low-stock' 
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-2xl scale-105' 
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 text-amber-700 hover:shadow-xl hover:scale-105 border border-amber-200'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -translate-y-10 translate-x-10"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                          inventoryFilter === 'low-stock' ? 'bg-white/20' : 'bg-amber-500 text-white'
                        }`}>
                          <div className="text-xl">⚠️</div>
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-lg">LOW STOCK</div>
                          <div className="text-sm opacity-80">Attention Needed</div>
                        </div>
                      </div>
                      <div className={`text-3xl font-black ${
                        inventoryFilter === 'low-stock' ? 'text-white' : 'text-amber-600'
                      }`}>
                        {inventoryMetrics.lowStockCount.toLocaleString()}
                      </div>
                      <div className={`text-xs font-medium uppercase tracking-wider ${
                        inventoryFilter === 'low-stock' ? 'text-white/80' : 'text-amber-500'
                      }`}>
                        Items Low
                      </div>
                    </div>
                  </button>

                  {/* OUT OF STOCK - Premium Card */}
                  <button 
                    onClick={() => setInventoryFilter('out-of-stock')}
                    className={`group relative rounded-2xl p-6 transition-all duration-300 overflow-hidden ${
                      inventoryFilter === 'out-of-stock' 
                        ? 'bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-2xl scale-105' 
                        : 'bg-gradient-to-br from-red-50 to-pink-100 text-red-700 hover:shadow-xl hover:scale-105 border border-red-200'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -translate-y-10 translate-x-10"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                          inventoryFilter === 'out-of-stock' ? 'bg-white/20' : 'bg-red-500 text-white'
                        }`}>
                          <div className="text-xl">🚨</div>
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-lg">OUT OF STOCK</div>
                          <div className="text-sm opacity-80">Critical Alert</div>
                        </div>
                      </div>
                      <div className={`text-3xl font-black ${
                        inventoryFilter === 'out-of-stock' ? 'text-white' : 'text-red-600'
                      }`}>
                        {inventoryMetrics.outOfStock.toLocaleString()}
                      </div>
                      <div className={`text-xs font-medium uppercase tracking-wider ${
                        inventoryFilter === 'out-of-stock' ? 'text-white/80' : 'text-red-500'
                      }`}>
                        Items Empty
                      </div>
                    </div>
                  </button>
                </div>
                
                {/* Sorting Controls */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Sort by:</span>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="name">Name (A-Z)</option>
                      <option value="quantity">Stock Quantity</option>
                      <option value="status">Status</option>
                    </select>
                    <select 
                      value={filterStatus} 
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Items</option>
                      <option value="ready">In Stock Only</option>
                      <option value="short">Low/Out of Stock</option>
                    </select>
                  </div>
                  <div className="text-sm text-gray-600">
                    {searchQuery && `Filtered by: "${searchQuery}"`}
                  </div>
                </div>
                
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-lg font-bold text-gray-800">
                    📦 {filteredInventory.length.toLocaleString()} items found
                  </div>
                  {searchQuery && (
                    <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                      💡 Smart search: finds "{searchQuery}" anywhere in item details
                    </div>
                  )}
                </div>
              </div>

              {/* BOM Planning Section */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <h3 className="text-2xl font-bold text-slate-900 flex items-center mb-6">
                  🏭 BOM Planning & Explosion
                  <span className="ml-3 text-sm font-normal text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                    Search Item → Enter Quantity → See Requirements
                  </span>
                </h3>
                
                {/* BOM Planning Controls */}
                <div className="flex items-center gap-4 mb-6">
                  <button 
                    onClick={() => setShowBOMPlanning(!showBOMPlanning)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${
                      showBOMPlanning ? 'bg-purple-600 text-white shadow-xl scale-105' : 'bg-purple-100 text-purple-700 hover:bg-purple-200 hover:scale-105'
                    }`}
                  >
                    {showBOMPlanning ? '📊 Hide BOM Planning' : '📊 Show BOM Planning'}
                  </button>
                  <div className="text-sm text-slate-600">
                    {(() => {
                      const assembledItems = (data['CustomAlert5.json'] || []).filter((item: any) => 
                        (data['BillOfMaterialDetails.json'] || []).some((bom: any) => 
                          bom["Parent Item No."] === item["Item No."]
                        )
                      );
                      return `${assembledItems.length} Assembled Items Available`;
                    })()}
                  </div>
                </div>

                {/* BOM Planning Content */}
                {showBOMPlanning && (
                  <div className="space-y-6">
                    {/* Item Search and Quantity Input */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Select Item & Quantity</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Item Search */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search for Assembled Item:
                          </label>
                          <input
                            type="text"
                            value={bomSearchQuery}
                            onChange={(e) => setBomSearchQuery(e.target.value)}
                            placeholder="Type: 'TX CASE', 'BOTTLE 1L', 'SEMI SYNTHETIC'..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            💡 Searches item codes and descriptions
                          </div>
                        </div>
                        
                        {/* Quantity Input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quantity to Build:
                          </label>
                          <input
                            type="number"
                            value={bomQuantity}
                            onChange={(e) => setBomQuantity(parseInt(e.target.value) || 0)}
                            placeholder="Enter quantity (e.g., 100)"
                            min="1"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            💡 How many units do you want to build?
                          </div>
                        </div>
                      </div>
                      
                      {/* Search Results */}
                      {bomSearchQuery && (
                        <div className="mt-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">Matching Items:</div>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {(() => {
                              const items = data['CustomAlert5.json'] || [];
                              const bomDetails = data['BillOfMaterialDetails.json'] || [];
                              
                              // Filter for assembled items that match search
                              const assembledItems = items.filter((item: any) => {
                                const hasBOM = bomDetails.some((bom: any) => 
                                  bom["Parent Item No."] === item["Item No."]
                                );
                                const matchesSearch = bomSearchQuery.toLowerCase().split(' ').every((term: string) =>
                                  (item["Item No."] || '').toLowerCase().includes(term) ||
                                  (item["Description"] || '').toLowerCase().includes(term)
                                );
                                return hasBOM && matchesSearch;
                              });
                              
                              return assembledItems.slice(0, 5).map((item: any, index: number) => (
                                <div
                                  key={index}
                                  onClick={() => {
                                    setBomSearchQuery(item["Item No."]);
                                    setSelectedBomItem(item);
                                  }}
                                  className="p-2 bg-white rounded border border-gray-200 hover:bg-blue-50 cursor-pointer"
                                >
                                  <div className="font-medium text-sm">{item["Item No."]}</div>
                                  <div className="text-xs text-gray-600">{item["Description"]}</div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BOM Explosion Results */}
                    {selectedBomItem && bomQuantity > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-blue-50 border-b border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900">
                            BOM Explosion for: {selectedBomItem["Item No."]} × {bomQuantity.toLocaleString()}
                          </h4>
                          <div className="text-sm text-gray-600">{selectedBomItem["Description"]}</div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Per Case</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Required</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shortfall</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(() => {
                                const bomDetails = data['BillOfMaterialDetails.json'] || [];
                                const items = data['CustomAlert5.json'] || [];
                                
                                // Get BOM components for selected item
                                const components = bomDetails.filter((bom: any) => 
                                  bom["Parent Item No."] === selectedBomItem["Item No."]
                                );
                                
                                // Create item lookup for normalization
                                const itemLookup = new Map();
                                items.forEach((item: any) => {
                                  const normalizedId = (item["Item No."] || '').toString().trim().toUpperCase();
                                  if (normalizedId) {
                                    itemLookup.set(normalizedId, item);
                                  }
                                });
                                
                                // Function to check if an item is assembled (has BOM)
                                const isAssembled = (itemId: string) => {
                                  return bomDetails.some((bom: any) => 
                                    bom["Parent Item No."] === itemId
                                  );
                                };

                                // Function to get BOM components for an item
                                const getBOMComponents = (itemId: string) => {
                                  return bomDetails.filter((bom: any) => 
                                    bom["Parent Item No."] === itemId
                                  );
                                };

                                // Process components with multi-level explosion (avoiding duplicates)
                                const processedItems = new Set<string>();
                                
                                const processComponents = (components: any[], level = 0, parentMultiplier = 1) => {
                                  const result: any[] = [];
                                  
                                  components.forEach((bom: any, index: number) => {
                                    const componentItem = itemLookup.get((bom["Component Item No."] || '').toString().trim().toUpperCase());
                                    
                                    if (!componentItem) return;
                                    
                                    // Create unique key to avoid duplicates
                                    const itemKey = `${componentItem["Item No."]}-${level}`;
                                    if (processedItems.has(itemKey)) return;
                                    processedItems.add(itemKey);
                                    
                                    // Calculate quantities with proper multiplier
                                    const baseQuantity = parseStockValue(bom["Required Quantity"] || 0);
                                    const perUnit = baseQuantity * parentMultiplier;
                                    const totalRequired = perUnit * bomQuantity;
                                    const available = parseStockValue(componentItem["Stock"] || 0);
                                    const shortfall = Math.max(0, totalRequired - available);
                                    const status = available >= totalRequired ? 'Available' : 'Short';
                                    
                                    // Add main component
                                    result.push({
                                      item: componentItem,
                                      bom: bom,
                                      perUnit,
                                      totalRequired,
                                      available,
                                      shortfall,
                                      status,
                                      level,
                                      isAssembled: isAssembled(componentItem["Item No."])
                                    });
                                    
                                    // If this component is assembled, add its sub-components
                                    if (isAssembled(componentItem["Item No."])) {
                                      const subComponents = getBOMComponents(componentItem["Item No."]);
                                      const subResults = processComponents(subComponents, level + 1, baseQuantity);
                                      result.push(...subResults);
                                    }
                                  });
                                  
                                  return result;
                                };

                                const processedComponents = processComponents(components);
                                
                                return processedComponents.map((comp: any, index: number) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      <div className={`flex items-center ${comp.level > 0 ? 'ml-4' : ''}`}>
                                        {comp.level > 0 && (
                                          <span className="text-gray-400 mr-2">
                                            {'└─ '.repeat(comp.level)}
                                          </span>
                                        )}
                                        <span className={comp.isAssembled ? 'text-blue-600 font-semibold' : 'text-gray-900'}>
                                          {comp.item["Item No."]}
                                        </span>
                                        {comp.isAssembled && (
                                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                            ASSEMBLED
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                      <div className={comp.level > 0 ? 'ml-4' : ''}>
                                        {comp.item["Description"]}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                      <div className="flex items-center space-x-1">
                                        <span>{comp.perUnit.toLocaleString()}</span>
                                        <span className="text-gray-500 text-xs">
                                          {comp.item["Base Unit of Measure"] || comp.item["Unit of Measure"] || comp.item["Stocking Units"] || 'EA'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      <div className="flex items-center space-x-1">
                                        <span>{comp.totalRequired.toLocaleString()}</span>
                                        <span className="text-gray-500 text-xs">
                                          {comp.item["Base Unit of Measure"] || comp.item["Unit of Measure"] || comp.item["Stocking Units"] || 'EA'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                      <div className="flex items-center space-x-1">
                                        <span>{comp.available.toLocaleString()}</span>
                                        <span className="text-gray-500 text-xs">
                                          {comp.item["Base Unit of Measure"] || comp.item["Unit of Measure"] || comp.item["Stocking Units"] || 'EA'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        comp.status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {comp.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {comp.shortfall > 0 ? (
                                        <span className="text-red-600 font-medium">
                                          -{comp.shortfall.toLocaleString()}
                                        </span>
                                      ) : (
                                        <span className="text-green-600">✓</span>
                                      )}
                                    </td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Inventory Cards */}
              {!data || Object.keys(data).length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">⏳</div>
                  <div className="text-xl text-gray-600">Loading inventory data...</div>
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🔍</div>
                  <div className="text-xl text-gray-600">No items found</div>
                  <div className="text-sm text-gray-500 mt-2">
                    Try adjusting your search or filter criteria
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredInventory.slice(0, 20).map((item: any, index: number) => {
                  const stock = parseStockValue(item["Stock"]);
                  const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
                  const cost = parseCostValue(item["Recent Cost"] || item["Standard Cost"] || item["Unit Cost"]);
                  
                  let statusColor = 'bg-green-100 text-green-800 border-green-200';
                  let statusText = 'In Stock';
                  if (stock <= 0) {
                    statusColor = 'bg-red-100 text-red-800 border-red-200';
                    statusText = 'Out of Stock';
                  } else if (stock <= reorderLevel && reorderLevel > 0) {
                    statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    statusText = 'Low Stock';
                  }
                  
                  // Check if item is assembled (has BOM components)
                  const isAssembled = (data['BillOfMaterialDetails.json'] || []).some((bom: any) => 
                    bom["Parent Item No."] === item["Item No."]
                  );
                  
                  return (
                    <div 
                      key={index} 
                      onClick={() => {
                        setSelectedItem(item);
                        setShowItemModal(true);
                        setShowAnalytics(false);
                        setShowBOMPlanning(false);
                      }}
                      className="group bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/50 hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-slate-900 truncate">{item["Item No."]}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2">{item["Description"]}</p>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="text-center bg-blue-50 rounded-xl p-3">
                          <div className="text-2xl font-black text-blue-900">{stock.toLocaleString()}</div>
                          <div className="text-xs text-blue-600 font-medium">ON HAND</div>
                        </div>
                        <div className="text-center bg-green-50 rounded-xl p-3">
                          <div className="text-2xl font-black text-green-900">{formatCAD(cost)}</div>
                          <div className="text-xs text-green-600 font-medium">COST</div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-slate-200">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            {isAssembled ? (
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                🏭 ASSEMBLED
                              </span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                🔧 RAW
                              </span>
                            )}
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-600">{item["Item Type"] || item["Type"] || 'Standard'}</span>
                          </div>
                          {reorderLevel > 0 && (
                            <span className="text-slate-600">Reorder: {reorderLevel.toLocaleString()}</span>
                          )}
                        </div>
                        
                        <div className="text-center">
                          <div className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors">
                            👆 Click for details
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* Sales Orders - PREMIUM ENTERPRISE DESIGN */}
          {activeSection === 'orders' && (
            <div className="space-y-8">
              
              {/* Premium Breadcrumb Navigation */}
              {soCurrentPath.length > 0 && (
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-6 border border-slate-200 shadow-lg">
                  <div className="flex items-center gap-3 text-sm">
                    <button 
                      onClick={resetSONavigation}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-700 font-medium transition-all shadow-sm border border-slate-200"
                    >
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      Sales Orders
                    </button>
                    {soCurrentPath.map((folder, index) => (
                      <React.Fragment key={index}>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <button 
                          onClick={() => {
                            const newPath = soCurrentPath.slice(0, index + 1);
                            setSoCurrentPath(newPath);
                            loadSOFolderData(newPath);
                          }}
                          className="px-4 py-2 bg-white text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-700 font-medium transition-all shadow-sm border border-slate-200"
                        >
                          {folder}
                        </button>
                      </React.Fragment>
                    ))}
                    <button 
                      onClick={navigateBackSO}
                      className="ml-auto px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg font-medium"
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              )}

              {/* Premium Main Navigation - Show when at root */}
              {soCurrentPath.length === 0 && (
              <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 p-6">
                {/* Compact Premium Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <div className="text-xl">📊</div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-blue-900 bg-clip-text text-transparent">
                        Sales Orders
                      </h2>
                      <p className="text-slate-600 text-sm">Enterprise Order Management System</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-lg font-medium text-xs border border-blue-200">
                      G: DRIVE STRUCTURE
                  </div>
                    <div className="px-3 py-1 bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 rounded-lg font-medium text-xs border border-emerald-200">
                      {salesOrderAnalytics.total.toLocaleString()} Total Orders
                  </div>
                  </div>
                </div>
                  
                <p className="text-slate-600 mb-4 text-sm">Navigate exactly like the G: Drive folders with enterprise-grade precision</p>
                
                {/* Compact Search Bar */}
                  <div className="mb-6">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="🔍 Search for SO Number (e.g., 2961)..."
                        value={soSearchQuery}
                        onChange={(e) => setSoSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 pl-12 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-lg"
                      />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                        🔍
                      </div>
                      {soSearchQuery && (
                        <button
                          onClick={() => setSoSearchQuery('')}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    </div>
                    {soSearchQuery && (
                    <div className="mt-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200">
                        🔍 Searching for: <strong>{soSearchQuery}</strong>
                      </div>
                    )}
                  </div>
                  
                {/* Premium Status Folders Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    
                  {/* New and Revised - Premium Card */}
                    <div 
                      onClick={() => navigateToSOFolder('New and Revised')}
                    className="group relative bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 rounded-2xl p-8 border border-emerald-200 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer overflow-hidden"
                    >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-200/30 to-green-200/30 rounded-full -translate-y-16 translate-x-16"></div>
                    <div className="relative">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                        <div className="text-2xl">🆕</div>
                        </div>
                        <div>
                          <div className="font-bold text-emerald-900 text-lg">New and Revised</div>
                          <div className="text-sm text-emerald-700 font-medium">Active orders</div>
                    </div>
                      </div>
                      <div className="bg-gradient-to-r from-emerald-100 to-green-100 rounded-xl p-4 mb-4 border border-emerald-200">
                        <div className="text-3xl font-black text-emerald-900">{salesOrderAnalytics.newAndRevised.count}</div>
                        <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">ACTIVE SOs</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-emerald-600">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        Last updated: {salesOrderAnalytics.newAndRevised.lastUpdated}
                      </div>
                      </div>
                  </div>
                  
                  {/* In Production - Premium Card */}
                    <div 
                      onClick={() => navigateToSOFolder('In Production')}
                    className="group relative bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl p-8 border border-orange-200 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer overflow-hidden"
                    >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-200/30 to-amber-200/30 rounded-full -translate-y-16 translate-x-16"></div>
                    <div className="relative">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                        <div className="text-2xl">🏭</div>
                        </div>
                        <div>
                          <div className="font-bold text-orange-900 text-lg">In Production</div>
                          <div className="text-sm text-orange-700 font-medium">Manufacturing</div>
                    </div>
                      </div>
                      <div className="bg-gradient-to-r from-orange-100 to-amber-100 rounded-xl p-4 mb-4 border border-orange-200">
                        <div className="text-3xl font-black text-orange-900">{salesOrderAnalytics.inProduction.count}</div>
                        <div className="text-xs text-orange-700 font-bold uppercase tracking-wider">SCHEDULED SOs</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-orange-600">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        Last updated: {salesOrderAnalytics.inProduction.lastUpdated}
                      </div>
                      </div>
                  </div>
                  
                  {/* Completed and Closed - Premium Card */}
                    <div 
                      onClick={() => navigateToSOFolder('Completed and Closed')}
                    className="group relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 border border-blue-200 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer overflow-hidden"
                    >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/30 to-indigo-200/30 rounded-full -translate-y-16 translate-x-16"></div>
                    <div className="relative">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                        <div className="text-2xl">✅</div>
                        </div>
                        <div>
                          <div className="font-bold text-blue-900 text-lg">Completed and Closed</div>
                          <div className="text-sm text-blue-700 font-medium">Archive</div>
                    </div>
                      </div>
                      <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4 mb-4 border border-blue-200">
                        <div className="text-3xl font-black text-blue-900">{salesOrderAnalytics.completed.count.toLocaleString()}</div>
                        <div className="text-xs text-blue-700 font-bold uppercase tracking-wider">COMPLETED SOs</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        Last updated: {salesOrderAnalytics.completed.lastUpdated}
                      </div>
                      </div>
                  </div>
                  
                  {/* Cancelled - Premium Card */}
                    <div 
                      onClick={() => navigateToSOFolder('Cancelled')}
                    className="group relative bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 rounded-2xl p-8 border border-red-200 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer overflow-hidden"
                    >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-200/30 to-pink-200/30 rounded-full -translate-y-16 translate-x-16"></div>
                    <div className="relative">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                        <div className="text-2xl">❌</div>
                        </div>
                        <div>
                          <div className="font-bold text-red-900 text-lg">Cancelled</div>
                          <div className="text-sm text-red-700 font-medium">Cancelled orders</div>
                    </div>
                  </div>
                      <div className="bg-gradient-to-r from-red-100 to-pink-100 rounded-xl p-4 mb-4 border border-red-200">
                        <div className="text-3xl font-black text-red-900">{salesOrderAnalytics.cancelled.count}</div>
                        <div className="text-xs text-red-700 font-bold uppercase tracking-wider">CANCELLED SOs</div>
                </div>
                      <div className="flex items-center gap-2 text-xs text-red-600">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        Last updated: {salesOrderAnalytics.cancelled.lastUpdated}
              </div>
                    </div>
                  </div>
                  
                </div>
                </div>
              )}

              {/* ACTUAL FOLDER CONTENTS FROM G: DRIVE */}
              {soCurrentPath.length >= 1 && (
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center">
                      📁 {soCurrentPath.join(' / ')} /
                      <div className="ml-4 text-sm font-normal text-gray-600">
                        {soLoading ? 'Loading from G: Drive...' : (soFolderData ? `${soFolderData.total_folders} folders, ${soFolderData.total_files} files` : 'Loading...')}
                      </div>
                    </h3>
                    
                    {soLoading && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="animate-spin text-lg">⏳</div>
                        <span className="text-sm">Syncing with G: Drive...</span>
                      </div>
                    )}
                      </div>
                      
                  {soFolderData && !soLoading && (
                    <>
                      {/* Show Subfolders */}
                      {soFolderData.folders && soFolderData.folders.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-bold text-gray-800 mb-3">📁 Subfolders</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {soFolderData.folders.map((folder: any, index: number) => (
                              <div 
                                key={index}
                                onClick={() => navigateToSOFolder(folder.name)}
                                className="bg-blue-50 rounded-lg p-4 text-center hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
                              >
                                <div className="text-xl mb-2">📁</div>
                                <div className="font-bold text-blue-900 text-sm">{folder.name}</div>
                                <div className="text-xs text-blue-600 mt-1">
                                  {folder.file_count} files
                                  {folder.folder_count > 0 && `, ${folder.folder_count} folders`}
                        </div>
                        </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Show Actual Sales Order Files */}
                      {soFolderData.files && soFolderData.files.length > 0 && (
                        <div>
                          <h4 className="text-lg font-bold text-gray-800 mb-3">📄 Sales Order Files ({soFolderData.files.length})</h4>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {soFolderData.files.map((file: any, index: number) => (
                              <div 
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                onClick={() => openSOViewer(file)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="text-lg">
                                    {file.is_pdf ? '📄' : file.is_excel ? '📊' : '📋'}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{file.name}</div>
                                    <div className="text-xs text-gray-600">
                                      {(file.size / 1024).toFixed(1)} KB • Modified: {file.modified}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-blue-600">
                                  👆 Click to view SO
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                      )}

                      {/* Empty Folder */}
                      {(!soFolderData.folders || soFolderData.folders.length === 0) && 
                       (!soFolderData.files || soFolderData.files.length === 0) && (
                        <div className="text-center text-gray-500 py-8">
                          <div className="text-4xl mb-2">📂</div>
                          <div className="text-lg font-medium">Empty Folder</div>
                          <div className="text-sm">No Sales Orders found in this folder</div>
            </div>
                      )}
                    </>
                  )}
                  
                  {/* Loading State */}
                  {!soFolderData && soLoading && (
                    <DataLoading 
                      dataType="Sales Orders"
                      stage="Loading from G: Drive"
                      recordCount={undefined}
                    />
                  )}
                  
                  {/* Error State */}
                  {!soFolderData && !soLoading && soCurrentPath.length > 0 && (
                    <div className="text-center text-red-500 py-8">
                      <div className="text-4xl mb-4">❌</div>
                      <div className="text-lg font-medium">Failed to Load</div>
                      <div className="text-sm">Could not access G: Drive folder</div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </>
  );
};
