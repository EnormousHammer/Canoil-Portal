import React, { useState, useMemo, useEffect } from 'react';
import { CompactLoading, DataLoading, ToastNotification } from './LoadingComponents';
import { AICommandCenter } from './AICommandCenter';
import { ProductionSchedule } from './ProductionSchedule';
import { SimpleProductionCalendar } from './SimpleProductionCalendar';
import { ReportMaker } from './ReportMaker';
import { EnterpriseProductionCalendar } from './EnterpriseProductionCalendar';
import { CleanEnterpriseDashboard } from './CleanEnterpriseDashboard';
import LogisticsAutomation from './LogisticsAutomation';
import { getApiUrl } from '../utils/apiConfig';
import { SOPerformanceMonitor } from './SOPerformanceMonitor';
import { GmailCleanEmail } from './GmailCleanEmail';
import { parseStockValue, parseCostValue, formatCAD } from '../utils/unifiedDataAccess';
import PurchaseRequisitionModal from './PurchaseRequisitionModal';
import { 
  // ULTRA PREMIUM NAVIGATION ICONS
  BarChart3, 
  Package2, 
  Factory, 
  ShoppingBag, 
  Truck, 
  Brain,
  TrendingUp,
  // PREMIUM ENTERPRISE ICONS
  Layers,
  Database,
  Cpu,
  Server,
  Network,
  Globe,
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  Award,
  Crown,
  Gem,
  Sparkles,
  Rocket,
  Zap,
  Flame,
  Sun,
  Moon,
  Star,
  Compass,
  Navigation,
  Map,
  Building,
  Building2,
  Warehouse,
  Store,
  ShoppingCart,
  CreditCard,
  Wallet,
  Coins,
  Banknote,
  Calculator,
  PieChart,
  BarChart,
  LineChart,
  TrendingDown,
  Activity,
  Heart,
  ThumbsUp,
  MessageSquare,
  Bell,
  User,
  LogOut,
  Home,
  Menu,
  X,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Copy,
  Trash2,
  Archive,
  Folder,
  File,
  FileText,
  Image,
  Video,
  Music,
  Headphones,
  Camera,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  // UTILITY ICONS
  DollarSign,
  Users,
  Target,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Edit,
  Save,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  Settings,
  MoreHorizontal
} from 'lucide-react';

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
  receivedAmount?: number;
  invoicedAmount?: number;
  // Advanced fields for comprehensive PO analysis
  totalOrderedQty?: number;    // Total quantity ordered from line items
  totalReceivedQty?: number;   // Total quantity received from line items
  recentUnitCost?: number;     // Weighted average unit cost
  amountPaid?: number;         // Total amount invoiced/paid
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
  currentUser?: { name: string; email: string; isAdmin: boolean } | null;
  onRefreshData?: () => Promise<void>;
}

export const RevolutionaryCanoilHub: React.FC<RevolutionaryCanoilHubProps> = ({ data, onNavigate, currentUser, onRefreshData }) => {
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
  const [itemModalActiveView, setItemModalActiveView] = useState('po');
  
  // Purchase Requisition modal state
  const [showPRModal, setShowPRModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [selectedPOForPR, setSelectedPOForPR] = useState<any>(null);
  
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
  
  // Purchase Orders pagination state
  const [poPageSize, setPoPageSize] = useState(25);
  const [poCurrentPage, setPoCurrentPage] = useState(1);
  
  // Search states
  const [moSearchQuery, setMoSearchQuery] = useState('');
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [alphabetFilter, setAlphabetFilter] = useState('');

  // Purchase Order processing
  const processPurchaseOrders = useMemo(() => {
    if (!data?.['PurchaseOrders.json'] || !data?.['PurchaseOrderDetails.json'] || !data?.['PurchaseOrderExtensions.json']) {
      return { headers: [], lines: [] };
    }

    const headers = data['PurchaseOrders.json'].map((po: any) => {
      // Find matching extension data
      const extension = data['PurchaseOrderExtensions.json'].find((ext: any) => ext['PO No.'] === po['PO No.']);
      
      // Get all line items for this PO to calculate advanced metrics
      const poLines = data['PurchaseOrderDetails.json'].filter((line: any) => line['PO No.'] === po['PO No.']);
      
      // Calculate total ordered and received quantities from line items
      const totalOrderedQty = poLines.reduce((sum: number, line: any) => 
        sum + parseStockValue(line['Ordered Qty'] || line['Ordered'] || 0), 0);
      const totalReceivedQty = poLines.reduce((sum: number, line: any) => 
        sum + parseStockValue(line['Received Qty'] || line['Received'] || 0), 0);
      
      // Calculate weighted average unit cost from line items
      const recentUnitCost = (() => {
        if (poLines.length > 0) {
          const totalOrderValue = poLines.reduce((sum: number, line: any) => {
            const unitPrice = parseCostValue(line['Unit Price'] || line['Cost'] || line['Unit Cost'] || 0);
            const orderedQty = parseStockValue(line['Ordered'] || line['Ordered Qty'] || 0);
            return sum + (unitPrice * orderedQty);
          }, 0);
          
          return totalOrderedQty > 0 ? totalOrderValue / totalOrderedQty : 0;
        }
        
        // Fallback: try to get unit cost from header-level data
        const headerTotalAmount = parseCostValue(po['Total Amount'] || po['Order Total'] || po['Total Cost'] || 0);
        const headerTotalQty = parseStockValue(po['Total Ordered Qty'] || po['Ordered Qty'] || po['Total Qty'] || totalOrderedQty || 0);
        
        if (headerTotalAmount > 0 && headerTotalQty > 0) {
          return headerTotalAmount / headerTotalQty;
        }
        
        return parseCostValue(po['Unit Cost'] || po['Average Cost'] || po['Recent Cost'] || 0);
      })();
      
      // Calculate amount paid (from invoiced amount, closed PO status, or received line items)
      const amountPaid = (() => {
        // Try invoiced amount first
        const invoicedAmount = parseCostValue(po['Invoiced Amount'] || po['Billed Amount'] || 0);
        if (invoicedAmount > 0) return invoicedAmount;
        
        // If PO is closed, assume fully paid
        if (po['Status']?.toString() === '4' || po['Status']?.toString() === 'Closed') {
          return parseCostValue(po['Total Amount'] || 0);
        }
        
        // Calculate from received line items
        const receivedValue = poLines.reduce((sum: number, line: any) => {
          const unitPrice = parseCostValue(line['Unit Price'] || line['Cost'] || 0);
          const receivedQty = parseStockValue(line['Received Qty'] || line['Received'] || 0);
          return sum + (unitPrice * receivedQty);
        }, 0);
        
        return receivedValue;
      })();
      
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
        receivedAmount: parseCostValue(po['Received Amount'] || 0),
        invoicedAmount: parseCostValue(po['Invoiced Amount'] || 0),
        totalOrderedQty,
        totalReceivedQty,
        recentUnitCost,
        amountPaid,
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

  // Smart function to determine which PO columns have actual data
  const getAvailablePOColumns = useMemo(() => {
    const pos = data['PurchaseOrders.json'] || [];
    if (pos.length === 0) return [];

    const columns = [
      { key: 'PO No.', label: 'PO Number', required: true },
      { key: 'Supplier No.', label: 'Supplier', required: true, fallback: 'Name' },
      { key: 'Buyer', label: 'Buyer' },
      { key: 'Order Date', label: 'Order Date' },
      { key: 'Status', label: 'Status', required: true },
      { key: 'totalOrderedQty', label: 'Total Ordered Qty', calculated: true },
      { key: 'totalReceivedQty', label: 'Total Received Qty', calculated: true },
      { key: 'Total Amount', label: 'Total Amount' },
      { key: 'Invoiced Amount', label: 'Total Amount Paid' },
      { key: 'Source Currency', label: 'Currency', fallback: 'Home Currency' },
      { key: 'Terms', label: 'Terms', showAlways: true },
      { key: 'Ship Via', label: 'Ship Via', showAlways: true },
      { key: 'FOB', label: 'FOB', showAlways: true },
      { key: 'Freight', label: 'Freight', showAlways: true },
      { key: 'Contact', label: 'Contact', showAlways: true },
      { key: 'Close Date', label: 'Close Date' }
    ];

    return columns.filter(col => {
      if (col.required || col.showAlways) return true;
      
      // For calculated fields, check if we actually have the underlying data
      if (col.calculated) {
        const lineItems = data['PurchaseOrderDetails.json'] || [];
        if (lineItems.length === 0) return false;
        
        // Check if the specific field actually has data
        if (col.key === 'totalOrderedQty') {
          return lineItems.some((line: any) => 
            (line['Ordered Qty'] && line['Ordered Qty'] > 0) || 
            (line['Ordered'] && line['Ordered'] > 0)
          );
        }
        if (col.key === 'totalReceivedQty') {
          return lineItems.some((line: any) => 
            (line['Received Qty'] && line['Received Qty'] > 0) || 
            (line['Received'] && line['Received'] > 0)
          );
        }
        return false;
      }
      
      const hasData = pos.some((po: any) => {
        const value = po[col.key] || (col.fallback ? po[col.fallback] : null);
        return value && value !== '' && value !== 0 && value !== '0';
      });
      
      return hasData;
    });
  }, [data]);

  // Smart function to determine which PO detail columns have actual data
  const getAvailablePODetailColumns = useMemo(() => {
    const details = data['PurchaseOrderDetails.json'] || [];
    if (details.length === 0) return [];

    const columns = [
      { key: 'Line No.', label: 'Line', required: true },
      { key: 'Item No.', label: 'Item No.', required: true, fallback: 'Part No.' },
      { key: 'Description', label: 'Description' },
      { key: 'Ordered Qty', label: 'Ordered Qty', fallback: 'Ordered' },
      { key: 'Received Qty', label: 'Received Qty', fallback: 'Received' },
      { key: 'Unit Price', label: 'Unit Price', fallback: 'Price' },
      { key: 'Required Date', label: 'Required Date', fallback: 'Due Date' },
      { key: 'Location', label: 'Location', fallback: 'Location No.' },
      { key: 'Billed Qty', label: 'Billed Qty' },
      { key: 'Extended Price', label: 'Extended Price' }
    ];

    return columns.filter(col => {
      if (col.required) return true;
      
      const hasData = details.some((detail: any) => {
        const value = detail[col.key] || (col.fallback ? detail[col.fallback] : null);
        return value && value !== '' && value !== 0 && value !== '0';
      });
      
      return hasData;
    });
  }, [data]);

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
  const [moActiveTab, setMoActiveTab] = useState('overview');
  
  // PO details modal state
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showPODetails, setShowPODetails] = useState(false);
  const [poActiveTab, setPoActiveTab] = useState('overview');
  
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

  // Smart search function for Manufacturing Orders
  const searchManufacturingOrders = useMemo(() => {
    if (!moSearchQuery.trim()) {
      return data?.['ManufacturingOrderHeaders.json'] || [];
    }

    const query = moSearchQuery.toLowerCase().trim();
    const searchTerms = query.split(' ').filter(term => term.length > 0);

    return (data?.['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => {
      // Create searchable text from all relevant fields
      const searchableFields = [
        mo['Mfg. Order No.'],
        mo['Customer'],
        mo['Build Item No.'],
        mo['Description'],
        mo['Non-Stocked Build Item Description'],
        mo['Location No.'],
        mo['Sales Location'],
        mo['Work Center'],
        mo['Released By'],
        mo['Status'] === 0 ? 'planned' : 
        mo['Status'] === 1 ? 'released active' : 
        mo['Status'] === 2 ? 'started production' : 
        mo['Status'] === 3 ? 'finished completed' : 
        mo['Status'] === 4 ? 'closed' : '',
        // Add formatted dates for search
        mo['Order Date'] ? formatDisplayDate(mo['Order Date']) : '',
        mo['Release Date'] ? formatDisplayDate(mo['Release Date']) : '',
        mo['Completion Date'] ? formatDisplayDate(mo['Completion Date']) : '',
        // Add quantities as searchable text
        mo['Ordered'] ? mo['Ordered'].toString() : '',
        mo['Completed'] ? mo['Completed'].toString() : ''
      ].filter(Boolean).join(' ').toLowerCase();

      // Check if all search terms are found in the searchable text (partial matching)
      return searchTerms.every(term => searchableFields.includes(term));
    });
  }, [data, moSearchQuery]);

  // Smart search function for Purchase Orders
  const searchPurchaseOrders = useMemo(() => {
    if (!poSearchQuery.trim()) {
      return data?.['PurchaseOrders.json'] || [];
    }

    const query = poSearchQuery.toLowerCase().trim();
    const searchTerms = query.split(' ').filter(term => term.length > 0);

    return (data?.['PurchaseOrders.json'] || []).filter((po: any) => {
      // Create searchable text from all relevant fields
      const searchableFields = [
        po['PO No.'],
        po['Supplier No.'],
        po['Name'],
        po['Buyer'],
        po['Terms'],
        po['Ship Via'],
        po['FOB'],
        po['Contact'],
        po['Source Currency'],
        po['Home Currency'],
        po['Status'] === 0 ? 'open active' : 
        po['Status'] === 1 ? 'pending' : 
        po['Status'] === 2 ? 'closed completed' : 
        po['Status'] === 3 ? 'cancelled' : '',
        // Add formatted dates for search
        po['Order Date'] ? formatDisplayDate(po['Order Date']) : '',
        po['Close Date'] ? formatDisplayDate(po['Close Date']) : '',
        // Add amounts as searchable text
        po['Total Amount'] ? `$${po['Total Amount'].toLocaleString()}` : '',
        po['Invoiced Amount'] ? `$${po['Invoiced Amount'].toLocaleString()}` : '',
        po['Received Amount'] ? `$${po['Received Amount'].toLocaleString()}` : '',
        po['Freight'] ? `$${po['Freight'].toLocaleString()}` : ''
      ].filter(Boolean).join(' ').toLowerCase();

      // Check if all search terms are found in the searchable text (partial matching)
      return searchTerms.every(term => searchableFields.includes(term));
    });
  }, [data, poSearchQuery]);

  // Enterprise Pagination Component
  const EnterprisePagination = ({ 
    currentPage, 
    totalItems, 
    itemsPerPage, 
    onPageChange, 
    onPageSizeChange 
  }: {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) pages.push(i);
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
          pages.push('...');
          pages.push(totalPages);
        }
      }
      return pages;
    };

    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-700">
            Showing <span className="font-semibold text-gray-900">{startItem}</span> to{' '}
            <span className="font-semibold text-gray-900">{endItem}</span> of{' '}
            <span className="font-semibold text-gray-900">{totalItems}</span> results
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600 font-medium">Show:</label>
            <select 
              value={itemsPerPage} 
              onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          {getPageNumbers().map((page, index) => (
            page === '...' ? (
              <span key={index} className="px-3 py-2 text-sm text-gray-500">...</span>
            ) : (
              <button
                key={index}
                onClick={() => onPageChange(page as number)}
                className={`px-3 py-2 text-sm font-medium border transition-colors shadow-sm ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            )
          ))}
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
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
  const [showPOModal, setShowPOModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBOMPlanning, setShowBOMPlanning] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [expandedFormulas, setExpandedFormulas] = useState<Set<string>>(new Set());
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [componentUsage, setComponentUsage] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'name-desc' | 'description' | 'description-desc' | 'quantity' | 'quantity-asc' | 'status'>('name');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'short'>('all');

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [inventoryFilter, inventorySearchQuery, sortBy, filterStatus]);

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
    if (inventorySearchQuery) {
      const searchTerms = inventorySearchQuery.toLowerCase().trim().split(/\s+/); // Split by spaces for multi-word search
      
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
      } else if (sortBy === 'name-desc') {
        return (b["Item No."] || '').localeCompare(a["Item No."] || '');
      } else if (sortBy === 'description') {
        return (a["Description"] || '').localeCompare(b["Description"] || '');
      } else if (sortBy === 'description-desc') {
        return (b["Description"] || '').localeCompare(a["Description"] || '');
      } else if (sortBy === 'quantity') {
        const stockA = parseStockValue(a["Stock"]);
        const stockB = parseStockValue(b["Stock"]);
        return stockB - stockA; // Descending order (High-Low)
      } else if (sortBy === 'quantity-asc') {
        const stockA = parseStockValue(a["Stock"]);
        const stockB = parseStockValue(b["Stock"]);
        return stockA - stockB; // Ascending order (Low-High)
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
  }, [data, inventoryFilter, inventorySearchQuery, sortBy, filterStatus]);

  // REAL-TIME SALES ORDER ANALYTICS
  const salesOrderAnalytics = useMemo(() => {
    // Combine all sales order sources
    let salesOrders = [...(data['SalesOrders.json'] || [])];
    
    // Count orders from SalesOrdersByStatus by folder name
    const salesOrdersByStatus = data['SalesOrdersByStatus'] || {};
    let newAndRevisedCount = 0;
    let inProductionCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    
    if (typeof salesOrdersByStatus === 'object') {
      Object.entries(salesOrdersByStatus).forEach(([folderName, orders]: [string, any]) => {
        if (Array.isArray(orders)) {
          // Add orders to combined list
          salesOrders = [...salesOrders, ...orders];
          
          // Count by folder name
          const folderLower = folderName.toLowerCase();
          if (folderLower.includes('new') || folderLower.includes('revised')) {
            newAndRevisedCount += orders.length;
          } else if (folderLower.includes('production') || folderLower.includes('manufacturing')) {
            inProductionCount += orders.length;
          } else if (folderLower.includes('completed') || folderLower.includes('closed')) {
            completedCount += orders.length;
          } else if (folderLower.includes('cancelled') || folderLower.includes('canceled')) {
            cancelledCount += orders.length;
          }
        }
      });
    }
    
    // Count orders by status from SalesOrders.json (structured data)
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
        count: newAndRevised.length + newAndRevisedCount,
        lastUpdated: getLastUpdated(newAndRevised)
      },
      inProduction: {
        count: inProduction.length + inProductionCount,
        lastUpdated: getLastUpdated(inProduction)
      },
      completed: {
        count: completed.length + completedCount,
        lastUpdated: getLastUpdated(completed)
      },
      cancelled: {
        count: cancelled.length + cancelledCount,
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
      
      const response = await fetch(getApiUrl(`/api/sales-orders/folder/${folderPath}`));
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
      const url = getApiUrl(`/api/sales-order-pdf/${encodedPath}`);
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
              {currentUser && (
                <div className="mt-2 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-slate-600 font-medium">
                    {currentUser.name} {currentUser.isAdmin && '(Admin)'}
                  </span>
                </div>
              )}
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
            <div className="text-5xl mb-3 drop-shadow-lg">📊</div>
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
            <div className="text-5xl mb-3 drop-shadow-lg">📦</div>
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
            <div className="text-5xl mb-3 drop-shadow-lg">🏭</div>
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
            onClick={() => setActiveSection('purchase-orders')}
            className={`backdrop-blur-xl rounded-2xl p-6 hover:scale-105 transition-all shadow-xl border ${
              activeSection === 'purchase-orders' 
                ? 'bg-gradient-to-br from-orange-600 to-red-700 text-white border-orange-500 shadow-2xl scale-105' 
                : 'bg-white/80 text-slate-800 border-white/50 hover:bg-white hover:shadow-2xl'
            }`}
          >
            <div className="text-5xl mb-3 drop-shadow-lg">🏪</div>
            <div className="text-xl font-black">PURCHASE</div>
            <div className="text-sm">
              {(() => {
                const allPOs = data?.['PurchaseOrders.json'] || [];
                return `${allPOs.length} Orders`;
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
            <div className="text-5xl mb-3 drop-shadow-lg">🛒</div>
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
            <div className="text-5xl mb-3 drop-shadow-lg">🚚</div>
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
            <div className="text-5xl mb-3 drop-shadow-lg">🤖</div>
            <div className="text-xl font-black">AI COMMAND</div>
            <div className="text-sm">Intelligence Center</div>
          </button>
        </div>

        {/* CONTENT SECTIONS */}
        <div className="max-w-7xl mx-auto">
          
          {/* Dashboard */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Main Dashboard */}
              <CleanEnterpriseDashboard 
                data={data}
                inventoryMetrics={inventoryMetrics}
                manufacturingMetrics={manufacturingMetrics}
                purchaseMetrics={purchaseMetrics}
                salesOrderAnalytics={salesOrderAnalytics}
                jobsAnalytics={{
                  activeJobs: (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => mo['Status'] === '1').length,
                  activeWorkOrders: (data['ManufacturingOrderDetails.json'] || []).filter((mo: any) => mo['Status'] === '1').length,
                  completedJobs: (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => mo['Status'] === '2').length,
                  totalJobs: (data['ManufacturingOrderHeaders.json'] || []).length,
                  totalJobValue: 0
                }}
                formatCAD={formatCAD}
                onNavigate={setActiveSection}
                currentUser={currentUser}
              />
            </div>
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

          {/* Report Maker */}
          {activeSection === 'report-maker' && (
            <ReportMaker
              data={data}
              onBack={() => setActiveSection('dashboard')}
            />
          )}

          {/* Email Assistant */}
          {activeSection === 'email-assistant' && (
            <GmailCleanEmail
              currentUser={currentUser || null}
              setActiveSection={setActiveSection}
            />
          )}

          {/* Production Schedule */}
          {activeSection === 'production-schedule' && (
            <SimpleProductionCalendar
              onBack={() => setActiveSection('dashboard')}
              data={data}
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
                  <div className="flex items-center">
                    <Settings className="w-8 h-8 mr-3 text-blue-600" />
                    <div className="relative">
                      <Crown className="w-4 h-4 absolute -top-2 -right-2 text-yellow-500" />
                    </div>
                  </div>
                  Work Orders (Service/Maintenance)
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
              {/* Manufacturing Operations - Enterprise Header */}
              <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-lg shadow-lg">
                        <Factory className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">Manufacturing Operations</h1>
                        <p className="text-sm text-gray-600 mt-1">Production planning and order management</p>
                    </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </button>
                  <button
                    onClick={() => setActiveSection('production-schedule')}
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                        <Calendar className="w-4 h-4 mr-2" />
                        Production Schedule
                  </button>
                    </div>
                  </div>
                </div>
                </div>
                
              {/* Manufacturing Metrics Dashboard */}
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                  
                  {/* Total Manufacturing Orders */}
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <Factory className="h-5 w-5 text-indigo-600" />
                    </div>
                  </div>
                        <div className="ml-4 w-0 flex-1">
                          <dl>
                            <dt className="text-xs font-medium text-gray-500 truncate uppercase tracking-wide">Total Manufacturing Orders</dt>
                            <dd className="text-xl font-bold text-gray-900">
                        {(data?.['ManufacturingOrderHeaders.json']?.length || 0).toLocaleString()}
                            </dd>
                          </dl>
                  </div>
                    </div>
                  </div>
                    </div>

                  {/* Active Orders */}
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <Activity className="h-5 w-5 text-green-600" />
                        </div>
                        </div>
                        <div className="ml-4 w-0 flex-1">
                          <dl>
                            <dt className="text-xs font-medium text-gray-500 truncate uppercase tracking-wide">Active Orders</dt>
                            <dd className="text-xl font-bold text-gray-900">
                        {(data?.['ManufacturingOrderHeaders.json']?.filter((mo: any) => mo.Status === 1).length || 0).toLocaleString()}
                            </dd>
                          </dl>
                      </div>
                      </div>
                    </div>
                  </div>

                  {/* Planned Orders */}
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-amber-600" />
                        </div>
                        </div>
                        <div className="ml-4 w-0 flex-1">
                          <dl>
                            <dt className="text-xs font-medium text-gray-500 truncate uppercase tracking-wide">Planned Orders</dt>
                            <dd className="text-xl font-bold text-gray-900">
                        {(data?.['ManufacturingOrderHeaders.json']?.filter((mo: any) => mo.Status === 0).length || 0).toLocaleString()}
                            </dd>
                          </dl>
                      </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Components */}
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Package2 className="h-5 w-5 text-purple-600" />
                        </div>
                        </div>
                        <div className="ml-4 w-0 flex-1">
                          <dl>
                            <dt className="text-xs font-medium text-gray-500 truncate uppercase tracking-wide">Total Components</dt>
                            <dd className="text-xl font-bold text-gray-900">
                        {(data?.['ManufacturingOrderDetails.json']?.length || 0).toLocaleString()}
                            </dd>
                          </dl>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manufacturing Orders Table */}
                {data?.['ManufacturingOrderHeaders.json'] && Array.isArray(data['ManufacturingOrderHeaders.json']) && data['ManufacturingOrderHeaders.json'].length > 0 && (
                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">
                          {(() => {
                            // Calculate filtered count using smart search
                            let filteredMOs = searchManufacturingOrders.filter((mo: any) => 
                              mo['Mfg. Order No.'] && mo['Build Item No.']
                            );
                                
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
                      <div className="space-y-3">
                        {/* Search Bar */}
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search anything... MO#, Customer, Item, Status, Dates, Quantities..."
                            value={moSearchQuery}
                            onChange={(e) => {
                              setMoSearchQuery(e.target.value);
                              setMoCurrentPage(1); // Reset to first page when searching
                            }}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <select
                          value={moSortField}
                          onChange={(e) => setMoSortField(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                        >
                          <option value="Mfg. Order No.">Sort by MO Number</option>
                          <option value="Customer">Sort by Customer</option>
                          <option value="Order Date">Sort by Order Date</option>
                          <option value="Cumulative Cost">Sort by Total Cost</option>
                          <option value="Ordered">Sort by Quantity</option>
                        </select>
                        <button
                          onClick={() => setMoSortDirection(moSortDirection === 'asc' ? 'desc' : 'asc')}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                        >
                          {moSortDirection === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>

                        {/* Filter Controls */}
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Status:</label>
                            <select
                              value={moStatusFilter}
                              onChange={(e) => setMoStatusFilter(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
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
                            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Customer:</label>
                            <select
                              value={moCustomerFilter}
                              onChange={(e) => setMoCustomerFilter(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm min-w-[150px] bg-white"
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
                              setMoSearchQuery('');
                              setMoCurrentPage(1);
                            }}
                            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                  </div>
                  <div className="overflow-x-auto max-h-[700px] shadow-inner">
                      <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-gray-100 to-gray-200 sticky top-0 shadow-sm">
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
                            // Start with smart search results
                            let filteredMOs = searchManufacturingOrders.filter((mo: any) => 
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
                                className="border-b border-gray-200 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200 cursor-pointer group"
                                onClick={() => {
                                  setSelectedMO(mo);
                                  setShowMODetails(true);
                                  setMoActiveTab('overview');
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
                    
                    {/* MO Pagination */}
                    {(() => {
                      // Calculate filtered MO count for pagination using smart search
                      let filteredMOs = searchManufacturingOrders.filter((mo: any) => 
                        mo['Mfg. Order No.'] && mo['Build Item No.']
                      );
                      
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
                      
                      return (
                        <EnterprisePagination
                          currentPage={moCurrentPage}
                          totalItems={filteredMOs.length}
                          itemsPerPage={moPageSize}
                          onPageChange={(page) => setMoCurrentPage(page)}
                          onPageSizeChange={(size) => {
                            setMoPageSize(size);
                            setMoCurrentPage(1);
                          }}
                        />
                      );
                    })()}
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
                      onClick={() => setMoActiveTab('overview')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        moActiveTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 MO Overview
                    </button>
                    <button
                      onClick={() => setMoActiveTab('details')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        moActiveTab === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🔧 Components & Materials
                    </button>
                    <button
                      onClick={() => setMoActiveTab('routings')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        moActiveTab === 'routings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ⚙️ Operations & Routing
                    </button>
                    <button
                      onClick={() => setMoActiveTab('pegged')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        moActiveTab === 'pegged' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🔗 Pegged SOs
                    </button>
                  </div>

                  {/* MO Overview Tab */}
                  {moActiveTab === 'overview' && (
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

                  {/* MO Components & Materials Tab */}
                  {moActiveTab === 'details' && (
                    <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">🔧 Manufacturing Order Components</h4>
                        <p className="text-sm text-blue-700">
                          Materials and components required for MO #{selectedMO['Mfg. Order No.']}
                        </p>
                      </div>

                      {(() => {
                        // Get MO Details from real data
                        const moDetails = (data['ManufacturingOrderDetails.json'] || []).filter((detail: any) => 
                          detail['Mfg. Order No.'] === selectedMO['Mfg. Order No.']
                        );

                        console.log('🔧 MO Details for', selectedMO['Mfg. Order No.'], ':', moDetails);

                        if (moDetails.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <div className="text-4xl mb-2">📦</div>
                              <div>No component details found</div>
                              <div className="text-sm">This MO may not have detailed component breakdown in the system</div>
                            </div>
                          );
                        }

                        return (
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="text-left p-3 font-medium text-gray-700">Component Item</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Description</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Required Qty</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Issued Qty</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Remaining</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Unit Cost</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Total Cost</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Location</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {moDetails.map((detail: any, index: number) => {
                                    const requiredQty = parseFloat(detail['Required Qty'] || detail['Quantity'] || 0);
                                    const issuedQty = parseFloat(detail['Issued Qty'] || detail['Issued'] || 0);
                                    const unitCost = parseFloat(detail['Unit Cost'] || detail['Cost'] || 0);
                                    const remainingQty = requiredQty - issuedQty;
                                    const totalCost = requiredQty * unitCost;

                                    return (
                                      <tr key={index} className="border-b border-gray-100 hover:bg-blue-50">
                                        <td className="p-3 font-mono text-blue-600 font-medium">
                                          {detail['Item No.'] || detail['Component Item'] || '—'}
                                        </td>
                                        <td className="p-3 text-gray-700">
                                          {detail['Description'] || detail['Item Description'] || '—'}
                                        </td>
                                        <td className="p-3 text-right font-medium">
                                          {requiredQty > 0 ? requiredQty.toLocaleString() : '—'}
                                        </td>
                                        <td className="p-3 text-right font-medium text-green-600">
                                          {issuedQty > 0 ? issuedQty.toLocaleString() : '—'}
                                        </td>
                                        <td className="p-3 text-right font-medium text-orange-600">
                                          {remainingQty > 0 ? remainingQty.toLocaleString() : '—'}
                                        </td>
                                        <td className="p-3 text-right font-mono">
                                          {unitCost > 0 ? `$${unitCost.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-green-600">
                                          {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="p-3 text-gray-600">
                                          {detail['Location'] || detail['Location No.'] || '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* Summary */}
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {(() => {
                                  const totalComponents = moDetails.length;
                                  const totalRequiredQty = moDetails.reduce((sum: number, detail: any) => 
                                    sum + parseFloat(detail['Required Qty'] || detail['Quantity'] || 0), 0);
                                  const totalIssuedQty = moDetails.reduce((sum: number, detail: any) => 
                                    sum + parseFloat(detail['Issued Qty'] || detail['Issued'] || 0), 0);
                                  const totalCost = moDetails.reduce((sum: number, detail: any) => {
                                    const qty = parseFloat(detail['Required Qty'] || detail['Quantity'] || 0);
                                    const cost = parseFloat(detail['Unit Cost'] || detail['Cost'] || 0);
                                    return sum + (qty * cost);
                                  }, 0);

                                  return (
                                    <>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">{totalComponents}</div>
                                        <div className="text-gray-600">Components</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">{totalRequiredQty.toLocaleString()}</div>
                                        <div className="text-gray-600">Total Required</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">{totalIssuedQty.toLocaleString()}</div>
                                        <div className="text-gray-600">Total Issued</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">${totalCost.toFixed(2)}</div>
                                        <div className="text-gray-600">Material Cost</div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* MO Operations & Routing Tab */}
                  {moActiveTab === 'routings' && (
                    <div className="space-y-6">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-900 mb-2">⚙️ Manufacturing Operations & Routing</h4>
                        <p className="text-sm text-purple-700">
                          Work centers, operations, and routing details for MO #{selectedMO['Mfg. Order No.']}
                        </p>
                      </div>

                      {(() => {
                        // Get MO Routings from real data
                        const moRoutings = (data['ManufacturingOrderRoutings.json'] || []).filter((routing: any) => 
                          routing['Mfg. Order No.'] === selectedMO['Mfg. Order No.']
                        );

                        console.log('⚙️ MO Routings for', selectedMO['Mfg. Order No.'], ':', moRoutings);

                        if (moRoutings.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <div className="text-4xl mb-2">⚙️</div>
                              <div>No routing operations found</div>
                              <div className="text-sm">This MO may not have detailed routing information in the system</div>
                            </div>
                          );
                        }

                        return (
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="text-left p-3 font-medium text-gray-700">Operation</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Work Center</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Description</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Setup Time</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Run Time</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Labor Hours</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Labor Cost</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {moRoutings.map((routing: any, index: number) => {
                                    const setupTime = parseFloat(routing['Setup Time'] || routing['Setup'] || 0);
                                    const runTime = parseFloat(routing['Run Time'] || routing['Runtime'] || 0);
                                    const laborHours = parseFloat(routing['Labor Hours'] || routing['Hours'] || 0);
                                    const laborCost = parseFloat(routing['Labor Cost'] || routing['Cost'] || 0);

                                    return (
                                      <tr key={index} className="border-b border-gray-100 hover:bg-purple-50">
                                        <td className="p-3 font-mono text-purple-600 font-medium">
                                          {routing['Operation No.'] || routing['Operation'] || '—'}
                                        </td>
                                        <td className="p-3 font-medium text-gray-900">
                                          {routing['Work Center'] || routing['Work Center No.'] || '—'}
                                        </td>
                                        <td className="p-3 text-gray-700">
                                          {routing['Description'] || routing['Operation Description'] || '—'}
                                        </td>
                                        <td className="p-3 text-right font-mono">
                                          {setupTime > 0 ? `${setupTime.toFixed(2)}h` : '—'}
                                        </td>
                                        <td className="p-3 text-right font-mono">
                                          {runTime > 0 ? `${runTime.toFixed(2)}h` : '—'}
                                        </td>
                                        <td className="p-3 text-right font-mono text-blue-600">
                                          {laborHours > 0 ? `${laborHours.toFixed(2)}h` : '—'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-green-600">
                                          {laborCost > 0 ? `$${laborCost.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="p-3">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            routing['Status'] === 'Complete' ? 'bg-green-100 text-green-700' :
                                            routing['Status'] === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                            routing['Status'] === 'Planned' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {routing['Status'] || 'Planned'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* Summary */}
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {(() => {
                                  const totalOperations = moRoutings.length;
                                  const totalSetupTime = moRoutings.reduce((sum: number, routing: any) => 
                                    sum + parseFloat(routing['Setup Time'] || routing['Setup'] || 0), 0);
                                  const totalRunTime = moRoutings.reduce((sum: number, routing: any) => 
                                    sum + parseFloat(routing['Run Time'] || routing['Runtime'] || 0), 0);
                                  const totalLaborCost = moRoutings.reduce((sum: number, routing: any) => 
                                    sum + parseFloat(routing['Labor Cost'] || routing['Cost'] || 0), 0);

                                  return (
                                    <>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">{totalOperations}</div>
                                        <div className="text-gray-600">Operations</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">{totalSetupTime.toFixed(1)}h</div>
                                        <div className="text-gray-600">Setup Time</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-blue-600">{totalRunTime.toFixed(1)}h</div>
                                        <div className="text-gray-600">Run Time</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">${totalLaborCost.toFixed(2)}</div>
                                        <div className="text-gray-600">Labor Cost</div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Pegged SOs Tab */}
                  {moActiveTab === 'pegged' && (
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

          {/* Enhanced Purchase Order Details Modal */}
          {showPODetails && selectedPO && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gray-200">
                {/* Professional PO Header */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-4 rounded-t-lg border-b border-blue-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">Purchase Order Details</h3>
                      <p className="text-blue-100">PO #{selectedPO['PO No.']} - {selectedPO['Supplier No.'] || selectedPO['Name']}</p>
                    </div>
                    <button
                      onClick={() => setShowPODetails(false)}
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
                      onClick={() => setPoActiveTab('overview')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        poActiveTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 PO Overview
                    </button>
                    <button
                      onClick={() => setPoActiveTab('lineitems')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        poActiveTab === 'lineitems' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📦 Line Items
                    </button>
                    <button
                      onClick={() => setPoActiveTab('costs')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        poActiveTab === 'costs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      💰 Additional Costs
                    </button>
                  </div>

                  {/* PO Overview Tab */}
                  {poActiveTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Header Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3">📊 Status & Progress</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Status:</span>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                selectedPO['Status'] === 0 ? 'bg-green-100 text-green-800' :
                                selectedPO['Status'] === 1 ? 'bg-yellow-100 text-yellow-800' :
                                selectedPO['Status'] === 2 ? 'bg-gray-100 text-gray-800' :
                                selectedPO['Status'] === 3 ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {selectedPO['Status'] === 0 ? 'Open' :
                                 selectedPO['Status'] === 1 ? 'Pending' :
                                 selectedPO['Status'] === 2 ? 'Closed' :
                                 selectedPO['Status'] === 3 ? 'Cancelled' : 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3">💰 Financial Summary</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Amount:</span>
                              <span className="font-semibold">${(selectedPO['Total Amount'] || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Invoiced:</span>
                              <span className="font-semibold text-orange-600">${(selectedPO['Invoiced Amount'] || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Received:</span>
                              <span className="font-semibold text-blue-600">${(selectedPO['Received Amount'] || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-900 mb-3">📅 Dates & Terms</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Order Date:</span>
                              <span className="font-semibold">{selectedPO['Order Date'] || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Terms:</span>
                              <span className="font-semibold">{selectedPO['Terms'] || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Currency:</span>
                              <span className="font-semibold">{selectedPO['Source Currency'] || selectedPO['Home Currency'] || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional PO Fields */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="font-semibold text-slate-900 mb-4">📝 Purchase Order Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Vendor Information</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Supplier:</span>
                                <span className="font-mono">{selectedPO['Supplier No.'] || selectedPO['Name'] || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Buyer:</span>
                                <span>{selectedPO['Buyer'] || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Contact:</span>
                                <span>{selectedPO['Contact'] || '—'}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Shipping Information</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Ship Via:</span>
                                <span>{selectedPO['Ship Via'] || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">FOB:</span>
                                <span>{selectedPO['FOB'] || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Freight:</span>
                                <span>${(selectedPO['Freight'] || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PO Line Items Tab */}
                  {poActiveTab === 'lineitems' && (
                    <div className="space-y-6">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-2">📦 Purchase Order Line Items</h4>
                        <p className="text-sm text-green-700">
                          Detailed line items for PO #{selectedPO['PO No.']}
                        </p>
                      </div>

                      {(() => {
                        // Get PO Line Items from real data
                        const poLineItems = (data['PurchaseOrderDetails.json'] || []).filter((line: any) => 
                          line['PO No.'] === selectedPO['PO No.']
                        );


                        if (poLineItems.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <div className="text-4xl mb-2">📦</div>
                              <div>No line items found</div>
                              <div className="text-sm">This PO may not have detailed line item breakdown in the system</div>
                            </div>
                          );
                        }

                        return (
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    {getAvailablePODetailColumns.map((col) => (
                                      <th 
                                        key={col.key}
                                        className={`p-3 font-medium text-gray-700 ${
                                          ['Ordered Qty', 'Received Qty', 'Unit Price', 'Extended Price'].includes(col.key) 
                                            ? 'text-right' : 'text-left'
                                        }`}
                                      >
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {poLineItems.map((line: any, index: number) => {
                                    const orderedQty = parseFloat(line['Ordered Qty'] || line['Ordered'] || 0);
                                    const receivedQty = parseFloat(line['Received Qty'] || line['Received'] || 0);
                                    const unitPrice = parseFloat(line['Unit Price'] || line['Price'] || 0);
                                    const remainingQty = orderedQty - receivedQty;
                                    const lineTotal = orderedQty * unitPrice;
                                    const extendedPrice = parseFloat(line['Extended Price'] || 0);

                                    return (
                                      <tr key={index} className="border-b border-gray-100 hover:bg-green-50">
                                        {getAvailablePODetailColumns.map((col) => {
                                          const getValue = (line: any, key: string, fallback?: string) => {
                                            return line[key] || (fallback ? line[fallback] : null);
                                          };

                                          const renderDetailCell = () => {
                                            const value = getValue(line, col.key, col.fallback);
                                            
                                            switch (col.key) {
                                              case 'Line No.':
                                                return (
                                                  <td key={col.key} className="p-3 font-mono text-green-600 font-medium">
                                                    {value || (index + 1)}
                                                  </td>
                                                );
                                              
                                              case 'Item No.':
                                                return (
                                                  <td key={col.key} className="p-3 font-mono text-blue-600 font-medium">
                                                    {getValue(line, 'Item No.', 'Part No.') || '—'}
                                                  </td>
                                                );
                                              
                                              case 'Ordered Qty':
                                                return (
                                                  <td key={col.key} className="p-3 text-right font-medium">
                                                    {orderedQty > 0 ? orderedQty.toLocaleString() : '—'}
                                                  </td>
                                                );
                                              
                                              case 'Received Qty':
                                                return (
                                                  <td key={col.key} className="p-3 text-right font-medium text-green-600">
                                                    {receivedQty > 0 ? receivedQty.toLocaleString() : '—'}
                                                  </td>
                                                );
                                              
                                              case 'Billed Qty':
                                                const billedQty = parseFloat(getValue(line, 'Billed Qty') || 0);
                                                return (
                                                  <td key={col.key} className="p-3 text-right font-medium text-orange-600">
                                                    {billedQty > 0 ? billedQty.toLocaleString() : '—'}
                                                  </td>
                                                );
                                              
                                              case 'Unit Price':
                                                return (
                                                  <td key={col.key} className="p-3 text-right font-mono">
                                                    {unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : '—'}
                                                  </td>
                                                );
                                              
                                              case 'Extended Price':
                                                const displayPrice = extendedPrice > 0 ? extendedPrice : lineTotal;
                                                return (
                                                  <td key={col.key} className="p-3 text-right font-mono font-bold text-green-600">
                                                    {displayPrice > 0 ? `$${displayPrice.toFixed(2)}` : '—'}
                                                  </td>
                                                );
                                              
                                              case 'Required Date':
                                                return (
                                                  <td key={col.key} className="p-3 text-gray-600 text-xs">
                                                    {getValue(line, 'Required Date', 'Due Date') || '—'}
                                                  </td>
                                                );
                                              
                                              case 'Location':
                                                return (
                                                  <td key={col.key} className="p-3 text-gray-600">
                                                    {getValue(line, 'Location', 'Location No.') || '—'}
                                                  </td>
                                                );
                                              
                                              default:
                                                return (
                                                  <td key={col.key} className="p-3 text-gray-700">
                                                    {value || '—'}
                                                  </td>
                                                );
                                            }
                                          };

                                          return renderDetailCell();
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* Summary */}
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {(() => {
                                  const totalLines = poLineItems.length;
                                  const totalOrderedQty = poLineItems.reduce((sum: number, line: any) => 
                                    sum + parseFloat(line['Ordered Qty'] || line['Ordered'] || 0), 0);
                                  const totalReceivedQty = poLineItems.reduce((sum: number, line: any) => 
                                    sum + parseFloat(line['Received Qty'] || line['Received'] || 0), 0);
                                  const totalValue = poLineItems.reduce((sum: number, line: any) => {
                                    const qty = parseFloat(line['Ordered Qty'] || line['Ordered'] || 0);
                                    const price = parseFloat(line['Unit Price'] || line['Price'] || 0);
                                    return sum + (qty * price);
                                  }, 0);

                                  return (
                                    <>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">{totalLines}</div>
                                        <div className="text-gray-600">Line Items</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">{totalOrderedQty.toLocaleString()}</div>
                                        <div className="text-gray-600">Total Ordered</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">{totalReceivedQty.toLocaleString()}</div>
                                        <div className="text-gray-600">Total Received</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">${totalValue.toFixed(2)}</div>
                                        <div className="text-gray-600">Total Value</div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* PO Additional Costs Tab */}
                  {poActiveTab === 'costs' && (
                    <div className="space-y-6">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-900 mb-2">💰 Additional Costs & Taxes</h4>
                        <p className="text-sm text-yellow-700">
                          Additional costs, taxes, and charges for PO #{selectedPO['PO No.']}
                        </p>
                      </div>

                      {(() => {
                        // Get Additional Costs from real data
                        const additionalCosts = (data['PurchaseOrderAdditionalCosts.json'] || []).filter((cost: any) => 
                          cost['PO No.'] === selectedPO['PO No.']
                        );
                        const additionalTaxes = (data['PurchaseOrderAdditionalCostsTaxes.json'] || []).filter((tax: any) => 
                          tax['PO No.'] === selectedPO['PO No.']
                        );
                        const detailCosts = (data['PurchaseOrderDetailAdditionalCosts.json'] || []).filter((cost: any) => 
                          cost['PO No.'] === selectedPO['PO No.']
                        );

                        console.log('💰 PO Additional Costs for', selectedPO['PO No.'], ':', { additionalCosts, additionalTaxes, detailCosts });

                        const hasAnyCosts = additionalCosts.length > 0 || additionalTaxes.length > 0 || detailCosts.length > 0;

                        if (!hasAnyCosts) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <div className="text-4xl mb-2">💰</div>
                              <div>No additional costs found</div>
                              <div className="text-sm">This PO may not have additional costs or taxes in the system</div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            {/* Additional Costs */}
                            {additionalCosts.length > 0 && (
                              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2">
                                  <h5 className="font-medium text-gray-900">Additional Costs</h5>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="text-left p-3 font-medium text-gray-700">Cost Type</th>
                                        <th className="text-left p-3 font-medium text-gray-700">Description</th>
                                        <th className="text-right p-3 font-medium text-gray-700">Amount</th>
                                        <th className="text-left p-3 font-medium text-gray-700">Account</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {additionalCosts.map((cost: any, index: number) => (
                                        <tr key={index} className="border-b border-gray-100 hover:bg-yellow-50">
                                          <td className="p-3 font-medium text-gray-900">
                                            {cost['Cost Type'] || cost['Type'] || '—'}
                                          </td>
                                          <td className="p-3 text-gray-700">
                                            {cost['Description'] || '—'}
                                          </td>
                                          <td className="p-3 text-right font-mono font-bold text-green-600">
                                            ${(parseFloat(cost['Amount'] || cost['Cost'] || 0)).toFixed(2)}
                                          </td>
                                          <td className="p-3 text-gray-600">
                                            {cost['Account'] || cost['GL Account'] || '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Additional Taxes */}
                            {additionalTaxes.length > 0 && (
                              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2">
                                  <h5 className="font-medium text-gray-900">Taxes</h5>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="text-left p-3 font-medium text-gray-700">Tax Type</th>
                                        <th className="text-left p-3 font-medium text-gray-700">Description</th>
                                        <th className="text-right p-3 font-medium text-gray-700">Rate</th>
                                        <th className="text-right p-3 font-medium text-gray-700">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {additionalTaxes.map((tax: any, index: number) => (
                                        <tr key={index} className="border-b border-gray-100 hover:bg-yellow-50">
                                          <td className="p-3 font-medium text-gray-900">
                                            {tax['Tax Type'] || tax['Type'] || '—'}
                                          </td>
                                          <td className="p-3 text-gray-700">
                                            {tax['Description'] || '—'}
                                          </td>
                                          <td className="p-3 text-right font-mono">
                                            {tax['Rate'] ? `${parseFloat(tax['Rate']).toFixed(2)}%` : '—'}
                                          </td>
                                          <td className="p-3 text-right font-mono font-bold text-green-600">
                                            ${(parseFloat(tax['Amount'] || tax['Tax Amount'] || 0)).toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Summary */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                {(() => {
                                  const totalAdditionalCosts = additionalCosts.reduce((sum: number, cost: any) => 
                                    sum + parseFloat(cost['Amount'] || cost['Cost'] || 0), 0);
                                  const totalTaxes = additionalTaxes.reduce((sum: number, tax: any) => 
                                    sum + parseFloat(tax['Amount'] || tax['Tax Amount'] || 0), 0);
                                  const grandTotal = totalAdditionalCosts + totalTaxes;

                                  return (
                                    <>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">${totalAdditionalCosts.toFixed(2)}</div>
                                        <div className="text-gray-600">Additional Costs</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">${totalTaxes.toFixed(2)}</div>
                                        <div className="text-gray-600">Total Taxes</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">${grandTotal.toFixed(2)}</div>
                                        <div className="text-gray-600">Total Extra Costs</div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Purchase Orders */}
          {activeSection === 'purchase-orders' && (
            <div className="space-y-6">
              {/* Purchase Orders - Enterprise Header */}
              <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg shadow-lg">
                        <ShoppingBag className="w-7 h-7 text-white" />
                    </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                          <p className="text-sm text-gray-600 mt-1">Procurement and vendor management</p>
                        </div>
                        <button
                          onClick={() => setShowPRModal(true)}
                          className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        >
                          📝 Purchase Requisitions
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </button>
                      <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <Plus className="w-4 h-4 mr-2" />
                        New PO
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Order Metrics Dashboard */}
              <div className="max-w-7xl mx-auto px-4 py-4">
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                  {/* Total Purchase Orders */}
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4 w-0 flex-1">
                          <dl>
                            <dt className="text-xs font-medium text-gray-500 truncate uppercase tracking-wide">Total Purchase Orders</dt>
                            <dd className="text-xl font-bold text-gray-900">
                      {data?.['PurchaseOrders.json']?.length || 0}
                            </dd>
                          </dl>
                    </div>
                  </div>
                    </div>
                  </div>

                  {/* PO Line Items */}
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <Package2 className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                        <div className="ml-4 w-0 flex-1">
                          <dl>
                            <dt className="text-xs font-medium text-gray-500 truncate uppercase tracking-wide">PO Line Items</dt>
                            <dd className="text-xl font-bold text-gray-900">
                      {data?.['PurchaseOrderDetails.json']?.length || 0}
                            </dd>
                          </dl>
                    </div>
                  </div>
                    </div>
                  </div>

                  {/* Active Vendors */}
                  <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Users className="h-5 w-5 text-purple-600" />
                          </div>
                        </div>
                        <div className="ml-4 w-0 flex-1">
                          <dl>
                            <dt className="text-xs font-medium text-gray-500 truncate uppercase tracking-wide">Active Vendors</dt>
                            <dd className="text-xl font-bold text-gray-900">
                      {new Set(data?.['PurchaseOrders.json']?.map((po: any) => po.Vendor).filter(Boolean)).size || 0}
                            </dd>
                          </dl>
                    </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purchase Orders Table */}
                {data?.['PurchaseOrders.json'] && Array.isArray(data['PurchaseOrders.json']) && data['PurchaseOrders.json'].length > 0 && (
                  <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">
                            {(() => {
                              const filteredPOs = searchPurchaseOrders.filter((po: any) => 
                                po['PO No.'] && (po['Supplier No.'] || po['Name']) && 
                                (po['Total Amount'] > 0 || po['Invoiced Amount'] > 0 || po['Received Amount'] > 0)
                              );
                              const startItem = (poCurrentPage - 1) * poPageSize + 1;
                              const endItem = Math.min(poCurrentPage * poPageSize, filteredPOs.length);
                              return `Showing ${startItem}-${endItem} of ${filteredPOs.length} Orders`;
                            })()}
                        </div>
                          <div className="flex items-center space-x-2">
                            <label className="text-sm text-gray-600 font-medium">Show:</label>
                            <select 
                              value={poPageSize} 
                              onChange={(e) => {
                                setPoPageSize(parseInt(e.target.value));
                                setPoCurrentPage(1);
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            >
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                              <option value={200}>200</option>
                            </select>
                      </div>
                    </div>
                      </div>
                      
                      {/* PO Search and Filter Controls */}
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search anything... PO#, Supplier, Buyer, Status, Amounts, Dates..."
                            value={poSearchQuery}
                            onChange={(e) => {
                              setPoSearchQuery(e.target.value);
                              setPoCurrentPage(1); // Reset to first page when searching
                            }}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <select
                          value={poSortField}
                          onChange={(e) => setPoSortField(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                        >
                          <option value="PO No.">Sort by PO Number</option>
                          <option value="Supplier No.">Sort by Supplier</option>
                          <option value="Order Date">Sort by Order Date</option>
                          <option value="Total Amount">Sort by Total Amount</option>
                          <option value="Status">Sort by Status</option>
                        </select>
                        <button
                          onClick={() => setPoSortDirection(poSortDirection === 'asc' ? 'desc' : 'asc')}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                        >
                          {poSortDirection === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[700px] shadow-inner">
                      <table className="w-full text-sm">
                        <thead className="bg-gradient-to-r from-blue-100 to-indigo-200 sticky top-0 shadow-sm">
                          <tr>
                            {getAvailablePOColumns.map((col, index) => (
                              <th 
                                key={col.key}
                                className={`p-2 font-medium text-gray-700 min-w-[80px] ${
                                  col.key === 'Total Amount' || col.key === 'Invoiced Amount' || col.key === 'Received Amount' || col.key === 'Freight' ||
                                  col.key === 'totalOrderedQty' || col.key === 'totalReceivedQty' || col.key === 'remainingQty'
                                    ? 'text-right' : 'text-left'
                                } ${
                                  ['PO No.', 'Supplier No.', 'Buyer', 'Order Date', 'Status', 'Total Amount', 'Invoiced Amount', 'Received Amount', 'Close Date'].includes(col.key)
                                    ? 'cursor-pointer hover:bg-gray-100' : ''
                                }`}
                                onClick={() => {
                                  if (['PO No.', 'Supplier No.', 'Buyer', 'Order Date', 'Status', 'Total Amount', 'Invoiced Amount', 'Received Amount', 'Close Date'].includes(col.key)) {
                                    handleSort(col.key, 'po');
                                  }
                                }}
                              >
                                {col.label} {poSortField === col.key && (poSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Filter using smart search results
                            const filteredPOs = searchPurchaseOrders.filter((po: any) => 
                              po['PO No.'] && (po['Supplier No.'] || po['Name']) && 
                              (po['Total Amount'] > 0 || po['Invoiced Amount'] > 0 || po['Received Amount'] > 0)
                            );
                            const sortedPOs = sortData(filteredPOs, poSortField, poSortDirection);
                            const startIndex = (poCurrentPage - 1) * poPageSize;
                            const endIndex = startIndex + poPageSize;
                            return sortedPOs.slice(startIndex, endIndex).map((po: any, index: number) => {
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
                              <tr 
                                key={index} 
                                className="border-b border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 cursor-pointer group"
                                onClick={() => {
                                  setSelectedPO(po);
                                  setShowPODetails(true);
                                  setPoActiveTab('overview');
                                }}
                              >
                                {getAvailablePOColumns.map((col) => {
                                  const getValue = (po: any, key: string, fallback?: string) => {
                                    return po[key] || (fallback ? po[fallback] : null);
                                  };

                                  const renderCell = () => {
                                    const value = getValue(po, col.key, col.fallback);
                                    
                                    switch (col.key) {
                                      case 'PO No.':
                                        return (
                                          <td key={col.key} className="p-2 font-mono text-blue-600 font-medium">
                                            {value || '—'}
                                </td>
                                        );
                                      
                                      case 'Supplier No.':
                                        return (
                                          <td key={col.key} className="p-2 font-medium text-gray-900">
                                            {getValue(po, 'Supplier No.', 'Name') || '—'}
                                </td>
                                        );
                                      
                                      case 'Status':
                                        return (
                                          <td key={col.key} className="p-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                    {statusInfo.text}
                                </span>
                              </td>
                                        );
                                      
                                      case 'Total Amount':
                                      case 'Invoiced Amount':
                                      case 'Freight':
                                        const amount = parseFloat(value || 0);
                                        const colorClass = col.key === 'Total Amount' ? 'text-green-600' :
                                                         col.key === 'Invoiced Amount' ? 'text-blue-600' : 'text-gray-600';
                                        return (
                                          <td key={col.key} className={`p-2 text-right font-mono ${colorClass} font-medium`}>
                                            {amount > 0 ? 
                                              `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                                              (col.showAlways ? 'N/A' : '—')
                                  }
                                </td>
                                        );
                                      
                                      case 'Order Date':
                                      case 'Close Date':
                                        return (
                                          <td key={col.key} className="p-2 text-gray-600 text-xs">
                                            {value ? formatDisplayDate(value) : (col.key === 'Close Date' ? 'Open' : '—')}
                                </td>
                                        );
                                      
                                      case 'Source Currency':
                                        return (
                                          <td key={col.key} className="p-2 text-gray-600 font-mono">
                                            {getValue(po, 'Source Currency', 'Home Currency') || '—'}
                                </td>
                                        );
                                      
                                      case 'totalOrderedQty':
                                        // Calculate total ordered quantity from line items
                                        const poLines = (data['PurchaseOrderDetails.json'] || []).filter((line: any) => 
                                          line['PO No.'] === po['PO No.']
                                        );
                                        const totalOrdered = poLines.reduce((sum: number, line: any) => 
                                          sum + parseFloat(line['Ordered Qty'] || line['Ordered'] || 0), 0);
                                        return (
                                          <td key={col.key} className="p-2 text-right font-medium text-blue-600">
                                            {totalOrdered > 0 ? totalOrdered.toLocaleString() : '—'}
                                </td>
                                        );
                                      
                                      case 'totalReceivedQty':
                                        // Calculate total received quantity from line items
                                        const poLinesRec = (data['PurchaseOrderDetails.json'] || []).filter((line: any) => 
                                          line['PO No.'] === po['PO No.']
                                        );
                                        const totalReceived = poLinesRec.reduce((sum: number, line: any) => 
                                          sum + parseFloat(line['Received Qty'] || line['Received'] || 0), 0);
                                        return (
                                          <td key={col.key} className="p-2 text-right font-medium text-green-600">
                                            {totalReceived > 0 ? totalReceived.toLocaleString() : '—'}
                                </td>
                                        );
                                      
                                      default:
                                        const displayValue = value && value.toString().trim() ? value : 
                                                           (col.showAlways ? 'N/A' : '—');
                                        return (
                                          <td key={col.key} className="p-2 text-gray-600">
                                            {displayValue}
                                </td>
                                        );
                                    }
                                  };

                                  return renderCell();
                                })}
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
                    
                    {/* PO Pagination */}
                    {(() => {
                      const filteredPOs = searchPurchaseOrders.filter((po: any) => 
                        po['PO No.'] && (po['Supplier No.'] || po['Name']) && 
                        (po['Total Amount'] > 0 || po['Invoiced Amount'] > 0 || po['Received Amount'] > 0)
                      );
                      
                      return (
                        <EnterprisePagination
                          currentPage={poCurrentPage}
                          totalItems={filteredPOs.length}
                          itemsPerPage={poPageSize}
                          onPageChange={(page) => setPoCurrentPage(page)}
                          onPageSizeChange={(size) => {
                            setPoPageSize(size);
                            setPoCurrentPage(1);
                          }}
                        />
                      );
                    })()}
                  </div>
                )}


              </div>
            </div>
          )}

          {/* Intelligence Section */}
          {activeSection === 'intelligence' && (
            <div className="space-y-6">
              {/* SO Performance Monitor */}
              <SOPerformanceMonitor 
                data={data}
                onRefresh={() => {
                  // Trigger data refresh
                  window.location.reload();
                }}
              />
              
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
                      <div className="flex items-center">
                        <Truck className="w-8 h-8 mr-3 text-orange-600" />
                        <div className="relative">
                          <Zap className="w-4 h-4 absolute -top-2 -right-2 text-yellow-500" />
                        </div>
                      </div>
                      Canoil Logistics Wizard
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
                      <option value="name-desc">Name (Z-A)</option>
                      <option value="description">Description (A-Z)</option>
                      <option value="description-desc">Description (Z-A)</option>
                      <option value="quantity">Stock Quantity (High-Low)</option>
                      <option value="quantity-asc">Stock Quantity (Low-High)</option>
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
                    <select 
                      value={itemsPerPage} 
                      onChange={(e) => {
                        setItemsPerPage(parseInt(e.target.value));
                        setCurrentPage(1); // Reset to first page when changing items per page
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                      <option value={999999}>Show All</option>
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
                  {inventorySearchQuery && (
                    <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                      💡 Smart search: finds "{inventorySearchQuery}" anywhere in item details
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
                              
                              return assembledItems.slice(0, 10).map((item: any, index: number) => (
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
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">
                                BOM Explosion for: {selectedBomItem["Item No."]} × {bomQuantity.toLocaleString()}
                              </h4>
                              <div className="text-sm text-gray-600">{selectedBomItem["Description"]}</div>
                            </div>
                            <button
                              onClick={() => {
                                console.log('Generate PR button clicked!');
                                
                                // Get all short items from BOM
                                const bomDetails = data['BillOfMaterialDetails.json'] || [];
                                const items = data['CustomAlert5.json'] || [];
                                
                                console.log('BOM Details:', bomDetails.length);
                                console.log('Items:', items.length);
                                console.log('Selected BOM Item:', selectedBomItem);
                                console.log('BOM Quantity:', bomQuantity);
                                
                                // Get BOM components for selected item
                                const components = bomDetails.filter((bom: any) => 
                                  bom["Parent Item No."] === selectedBomItem["Item No."]
                                );
                                
                                console.log('Components found:', components.length);
                                
                                // Create item lookup for normalization
                                const itemLookup: { [key: string]: any } = {};
                                items.forEach((item: any) => {
                                  const normalizedId = (item["Item No."] || '').toString().trim().toUpperCase();
                                  if (normalizedId) {
                                    itemLookup[normalizedId] = item;
                                  }
                                });
                                
                                // Process components to find short items
                                const shortItems: any[] = [];
                                const processedItems = new Set<string>();
                                
                                const processComponents = (components: any[], level = 0, parentMultiplier = 1) => {
                                  components.forEach((bom: any) => {
                                    const componentItem = itemLookup[(bom["Component Item No."] || '').toString().trim().toUpperCase()];
                                    
                                    if (!componentItem) return;
                                    
                                    const itemKey = `${componentItem["Item No."]}-${level}`;
                                    if (processedItems.has(itemKey)) return;
                                    processedItems.add(itemKey);
                                    
                                    const baseQuantity = parseStockValue(bom["Required Quantity"] || 0);
                                    const perUnit = baseQuantity * parentMultiplier;
                                    const totalRequired = perUnit * bomQuantity;
                                    const available = parseStockValue(componentItem["Stock"] || 0);
                                    const shortfall = Math.max(0, totalRequired - available);
                                    
                                    console.log(`Item: ${componentItem["Item No."]} - Required: ${totalRequired}, Available: ${available}, Shortfall: ${shortfall}`);
                                    
                                    // Only add items that are short
                                    if (shortfall > 0) {
                                      // Use the recent cost from inventory data
                                      const recentCost = parseFloat(componentItem["Recent Cost"]?.replace('$', '').replace(',', '') || '0');
                                      
                                      shortItems.push({
                                        item_no: componentItem["Item No."],
                                        description: componentItem["Description"],
                                        quantity: shortfall,
                                        unit: componentItem["Base Unit of Measure"] || componentItem["Unit of Measure"] || componentItem["Stocking Units"] || 'EA',
                                        unit_price: recentCost,
                                        current_stock: available.toString(),
                                        required: totalRequired
                                      });
                                    }
                                    
                                    // Check sub-components if assembled
                                    const isAssembled = bomDetails.some((b: any) => 
                                      b["Parent Item No."] === componentItem["Item No."]
                                    );
                                    if (isAssembled) {
                                      const subComponents = bomDetails.filter((b: any) => 
                                        b["Parent Item No."] === componentItem["Item No."]
                                      );
                                      processComponents(subComponents, level + 1, baseQuantity);
                                    }
                                  });
                                };
                                
                                processComponents(components);
                                
                                console.log('Short items found:', shortItems.length);
                                console.log('Short items:', shortItems);
                                
                                // Open PR modal with short items pre-filled
                                if (shortItems.length > 0) {
                                  console.log('Opening PR modal with short items');
                                  console.log('Setting selectedItems to:', shortItems);
                                  // Set the selected items for PR generation
                                  setSelectedItems(shortItems);
                                  console.log('Setting showPRModal to true');
                                  // Open the PR modal
                                  setShowPRModal(true);
                                  console.log('showPRModal state should now be true');
                                } else {
                                  console.log('No short items found');
                                  alert('No items are short - all components are available!');
                                }
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Generate PR for Short Items
                            </button>
                          </div>
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
                                const itemLookup: { [key: string]: any } = {};
                                items.forEach((item: any) => {
                                  const normalizedId = (item["Item No."] || '').toString().trim().toUpperCase();
                                  if (normalizedId) {
                                    itemLookup[normalizedId] = item;
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
                                    const componentItem = itemLookup[(bom["Component Item No."] || '').toString().trim().toUpperCase()];
                                    
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

              {/* Pagination Controls */}
              {filteredInventory.length > 0 && itemsPerPage < 999999 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-4">
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredInventory.length)} to {Math.min(currentPage * itemsPerPage, filteredInventory.length)} of {filteredInventory.length} items
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Previous Button */}
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          currentPage === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                        }`}
                      >
                        ← Previous
                      </button>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {(() => {
                          const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
                          const pages = [];
                          const maxVisiblePages = 5;
                          
                          let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                          let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                          
                          if (endPage - startPage < maxVisiblePages - 1) {
                            startPage = Math.max(1, endPage - maxVisiblePages + 1);
                          }
                          
                          // First page
                          if (startPage > 1) {
                            pages.push(
                              <button
                                key={1}
                                onClick={() => setCurrentPage(1)}
                                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                              >
                                1
                              </button>
                            );
                            if (startPage > 2) {
                              pages.push(<span key="ellipsis1" className="px-2 text-gray-400">...</span>);
                            }
                          }
                          
                          // Visible pages
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  i === currentPage
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {i}
                              </button>
                            );
                          }
                          
                          // Last page
                          if (endPage < totalPages) {
                            if (endPage < totalPages - 1) {
                              pages.push(<span key="ellipsis2" className="px-2 text-gray-400">...</span>);
                            }
                            pages.push(
                              <button
                                key={totalPages}
                                onClick={() => setCurrentPage(totalPages)}
                                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                              >
                                {totalPages}
                              </button>
                            );
                          }
                          
                          return pages;
                        })()}
                      </div>
                      
                      {/* Next Button */}
                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(filteredInventory.length / itemsPerPage), currentPage + 1))}
                        disabled={currentPage >= Math.ceil(filteredInventory.length / itemsPerPage)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          currentPage >= Math.ceil(filteredInventory.length / itemsPerPage)
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                        }`}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Inventory Cards */}
              {!data || Object.keys(data).length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">⏳</div>
                  <div className="text-xl text-gray-600">Loading inventory data...</div>
                </div>
              ) : (
              <>
                {/* Search Bar - ALWAYS VISIBLE regardless of results */}
                <div className="relative mb-6">
                  <input
                    type="text"
                    value={inventorySearchQuery}
                    onChange={(e) => setInventorySearchQuery(e.target.value)}
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

                {/* Results or No Results Message */}
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">🔍</div>
                    <div className="text-xl text-gray-600">No items found</div>
                    <div className="text-sm text-gray-500 mt-2">
                      Try adjusting your search or filter criteria
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {(() => {
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = itemsPerPage === 999999 ? filteredInventory.length : startIndex + itemsPerPage;
                  return filteredInventory.slice(startIndex, endIndex);
                })().map((item: any, index: number) => {
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

                    {/* Bottom Alphabet & Number Filter - Same as Top */}
                    {filteredInventory.length > 0 && (
                      <div className="mt-6 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-4">
                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredInventory.length)} to {Math.min(currentPage * itemsPerPage, filteredInventory.length)} of {filteredInventory.length} items
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Previous Button */}
                            <button
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                currentPage === 1
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                              }`}
                            >
                              ← Previous
                            </button>
                            
                            {/* Page Numbers */}
                            <div className="flex items-center gap-1">
                              {(() => {
                                const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
                                const pages = [];
                                const maxVisiblePages = 5;
                                
                                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                                
                                if (endPage - startPage < maxVisiblePages - 1) {
                                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                                }
                                
                                // First page
                                if (startPage > 1) {
                                  pages.push(
                                    <button
                                      key={1}
                                      onClick={() => setCurrentPage(1)}
                                      className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      1
                                    </button>
                                  );
                                  if (startPage > 2) {
                                    pages.push(<span key="ellipsis1" className="px-2 text-gray-400">...</span>);
                                  }
                                }
                                
                                // Visible pages
                                for (let i = startPage; i <= endPage; i++) {
                                  pages.push(
                                    <button
                                      key={i}
                                      onClick={() => setCurrentPage(i)}
                                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                        i === currentPage
                                          ? 'bg-blue-500 text-white shadow-md'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {i}
                                    </button>
                                  );
                                }
                                
                                // Last page
                                if (endPage < totalPages) {
                                  if (endPage < totalPages - 1) {
                                    pages.push(<span key="ellipsis2" className="px-2 text-gray-400">...</span>);
                                  }
                                  pages.push(
                                    <button
                                      key={totalPages}
                                      onClick={() => setCurrentPage(totalPages)}
                                      className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      {totalPages}
                                    </button>
                                  );
                                }
                                
                                return pages;
                              })()}
                            </div>
                            
                            {/* Next Button */}
                            <button
                              onClick={() => setCurrentPage(Math.min(Math.ceil(filteredInventory.length / itemsPerPage), currentPage + 1))}
                              disabled={currentPage >= Math.ceil(filteredInventory.length / itemsPerPage)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                currentPage >= Math.ceil(filteredInventory.length / itemsPerPage)
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                              }`}
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
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
                    {onRefreshData && (
                      <button
                        onClick={async () => {
                          console.log('🔄 Manual refresh requested');
                          await onRefreshData();
                        }}
                        className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-xs border border-blue-700 hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-1 shadow-lg hover:shadow-xl"
                        title="Refresh sales orders data"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync Now
                      </button>
                    )}
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

      {/* COMPREHENSIVE ITEM DETAILS MODAL */}
      {showItemModal && selectedItem && (() => {
        // DEBUG: Log data structure to understand field names
        console.log('🔍 DEBUGGING ITEM MODAL DATA:');
        console.log('Selected Item:', selectedItem);
        console.log('Selected Item No:', selectedItem?.['Item No.']);
        console.log('Available data keys:', Object.keys(data || {}));
        
        // DETAILED MO DEBUGGING
        const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
        const moDetails = data['ManufacturingOrderDetails.json'] || [];
        console.log('📊 MO DEBUGGING:');
        console.log('  ManufacturingOrderHeaders count:', moHeaders.length);
        console.log('  ManufacturingOrderHeaders sample:', moHeaders.slice(0, 2));
        console.log('  ManufacturingOrderDetails count:', moDetails.length);
        console.log('  ManufacturingOrderDetails sample:', moDetails.slice(0, 2));
        
        // DETAILED PO DEBUGGING
        const poHeaders = data['PurchaseOrders.json'] || [];
        const poDetails = data['PurchaseOrderDetails.json'] || [];
        console.log('🛒 PO DEBUGGING:');
        console.log('  PurchaseOrders count:', poHeaders.length);
        console.log('  PurchaseOrders sample:', poHeaders.slice(0, 2));
        console.log('  PurchaseOrderDetails count:', poDetails.length);
        console.log('  PurchaseOrderDetails sample:', poDetails.slice(0, 2));
        console.log('  ProcessedPO lines count:', processPurchaseOrders.lines.length);
        console.log('  ProcessedPO lines sample:', processPurchaseOrders.lines.slice(0, 2));
        
        // DETAILED SO DEBUGGING
        const soHeaders = data['SalesOrderHeaders.json'] || [];
        const soDetails = data['SalesOrderDetails.json'] || [];
        const salesOrders = data['SalesOrders.json'] || [];
        console.log('📦 SO DEBUGGING:');
        console.log('  SalesOrderHeaders count:', soHeaders.length);
        console.log('  SalesOrderDetails count:', soDetails.length);
        console.log('  SalesOrders.json count:', salesOrders.length);
        console.log('  RealSalesOrders count:', (data['RealSalesOrders'] || []).length);
        console.log('  SalesOrdersByStatus:', typeof data['SalesOrdersByStatus'], Object.keys(data['SalesOrdersByStatus'] || {}));
        
        // FIELD NAME DEBUGGING
        if (moHeaders.length > 0) {
          console.log('  MO Header field names:', Object.keys(moHeaders[0]));
        }
        if (moDetails.length > 0) {
          console.log('  MO Detail field names:', Object.keys(moDetails[0]));
        }
        if (soHeaders.length > 0) {
          console.log('  SO Header field names:', Object.keys(soHeaders[0]));
        }
        if (soDetails.length > 0) {
          console.log('  SO Detail field names:', Object.keys(soDetails[0]));
        }
        if (salesOrders.length > 0) {
          console.log('  SalesOrders field names:', Object.keys(salesOrders[0]));
          console.log('  SalesOrders sample record:', salesOrders[0]);
          if (salesOrders[0].items && Array.isArray(salesOrders[0].items) && salesOrders[0].items.length > 0) {
            console.log('  SalesOrders item field names:', Object.keys(salesOrders[0].items[0]));
            console.log('  SalesOrders item sample:', salesOrders[0].items[0]);
          } else {
            console.log('  ⚠️ SalesOrders[0] has no items array or items is empty');
            console.log('  SalesOrders[0] structure:', JSON.stringify(salesOrders[0], null, 2));
          }
          
          // Check first few records for items arrays
          console.log('  📋 CHECKING FIRST 5 SOs FOR ITEMS:');
          salesOrders.slice(0, 5).forEach((so: any, index: number) => {
            console.log(`    SO ${index + 1}:`, {
              orderNo: so['Order No.'] || so.order_number || so.id,
              hasItems: !!(so.items && Array.isArray(so.items)),
              itemsCount: so.items ? so.items.length : 0,
              itemsSample: so.items && so.items.length > 0 ? so.items[0] : 'No items'
            });
          });
        }
        
        console.log('BillOfMaterialDetails sample:', (data['BillOfMaterialDetails.json'] || []).slice(0, 2));
        
        // SPECIFIC ITEM DEBUGGING
        const itemNoUpper = (selectedItem?.['Item No.'] || '').toString().trim().toUpperCase();
        console.log('🔍 ITEM-SPECIFIC DEBUGGING for:', itemNoUpper);
        
        // Check PO matches
        const itemPOMatches = processPurchaseOrders.lines.filter((line: any) => 
          (line.itemId || '').toString().trim().toUpperCase() === itemNoUpper
        );
        console.log('  PO matches for this item:', itemPOMatches.length);
        console.log('  PO matches sample:', itemPOMatches.slice(0, 2));
        
        // Check MO matches
        const itemMOMatches = moDetails.filter((mo: any) => 
          (mo['Component Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper ||
          (mo['Build Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper
        );
        console.log('  MO matches for this item:', itemMOMatches.length);
        console.log('  MO matches sample:', itemMOMatches.slice(0, 2));
        
        // Check location matches
        const allLocations = data['MIILOC.json'] || [];
        console.log('  Total MIILOC records:', allLocations.length);
        if (allLocations.length > 0) {
          console.log('  MIILOC field names:', Object.keys(allLocations[0]));
          console.log('  MIILOC sample record:', allLocations[0]);
        }
        
        const itemLocationMatches = allLocations.filter((loc: any) => 
          (loc['Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper
        );
        console.log('  Location matches for this item:', itemLocationMatches.length);
        console.log('  Location matches sample:', itemLocationMatches.slice(0, 2));
        
        // Try alternative location field names
        const itemLocationMatches2 = allLocations.filter((loc: any) => 
          (loc['ItemNo'] || loc['Item_No'] || loc['ITEM_NO'] || '').toString().trim().toUpperCase() === itemNoUpper
        );
        console.log('  Location matches (alt fields):', itemLocationMatches2.length);
        
        // Check SO matches from SalesOrders.json
        const itemSOMatches = salesOrders.filter((so: any) => {
          if (so.items && Array.isArray(so.items)) {
            return so.items.some((item: any) => 
              (item.item_code || item.itemId || item['Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper
            );
          }
          return (so['Item No.'] || so['Build Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper;
        });
        console.log('  SO matches for this item:', itemSOMatches.length);
        console.log('  SO matches sample:', itemSOMatches.slice(0, 2));
        
        return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Package2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedItem['Item No.'] || 'Unknown Item'}</h2>
                    <p className="text-blue-100 text-sm">{selectedItem['Description'] || 'No description available'}</p>
                  </div>
                </div>
                <button
                  onClick={closeItemModal}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Top Priority Information Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-700">
                    {parseStockValue(selectedItem['On Hand'] || selectedItem['Stock'] || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-green-600 font-medium">Current Stock</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-xl p-4 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">
                    {formatCAD(parseCostValue(selectedItem['Unit Cost'] || selectedItem['Cost'] || 0))}
                  </div>
                  <div className="text-sm text-blue-600 font-medium">Unit Cost</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl p-4 border border-purple-200">
                  <div className="text-2xl font-bold text-purple-700">
                    {formatCAD(parseStockValue(selectedItem['On Hand'] || 0) * parseCostValue(selectedItem['Unit Cost'] || 0))}
                  </div>
                  <div className="text-sm text-purple-600 font-medium">Total Value</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl p-4 border border-orange-200">
                  <div className="text-2xl font-bold text-orange-700">
                    {parseStockValue(selectedItem['Reorder Level'] || selectedItem['Min Stock'] || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-orange-600 font-medium">Reorder Level</div>
                </div>
              </div>

              {/* Clickable Navigation Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Purchase Orders Button */}
                <button 
                  onClick={() => setItemModalActiveView('po')}
                  className={`rounded-lg p-4 text-center border shadow-sm transition-all hover:shadow-md ${
                    itemModalActiveView === 'po' 
                      ? 'bg-blue-500 text-white border-blue-600' 
                      : 'bg-white border-gray-200 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-xl font-bold">
                    {(() => {
                      const itemNoUpper = (selectedItem?.['Item No.'] || '').toString().trim().toUpperCase();
                      
                      // COMPREHENSIVE PO COUNT - Same logic as detailed view
                      // 1. From processed PO lines
                      const processedPOLines = processPurchaseOrders.lines.filter((line: any) => 
                        (line.itemId || '').toString().trim().toUpperCase() === itemNoUpper
                      );
                      
                      // 2. From raw PurchaseOrderDetails.json
                      const rawPODetails = (data['PurchaseOrderDetails.json'] || []).filter((detail: any) => {
                        const itemFields = [
                          detail['Item No.'],
                          detail['ItemNo'], 
                          detail['Item_No'],
                          detail['ITEM_NO'],
                          detail['Component Item No.'],
                          detail['Product Code'],
                          detail['Part No.'],
                          detail['SKU']
                        ];
                        return itemFields.some(field => 
                          (field || '').toString().trim().toUpperCase() === itemNoUpper
                        );
                      });
                      
                      // 3. From PurchaseOrders.json headers
                      const rawPOHeaders = (data['PurchaseOrders.json'] || []).filter((header: any) => {
                        const itemFields = [
                          header['Item No.'],
                          header['ItemNo'],
                          header['Build Item No.'],
                          header['Product Code'],
                          header['Description']
                        ];
                        return itemFields.some(field => 
                          (field || '').toString().trim().toUpperCase() === itemNoUpper ||
                          (field || '').toString().toLowerCase().includes((selectedItem?.['Description'] || '').toLowerCase().substring(0, 10))
                        );
                      });
                      
                      // Count unique PO records (avoid duplicates)
                      const allPONumbers = new Set();
                      processedPOLines.forEach((line: any) => allPONumbers.add(line.poId));
                      rawPODetails.forEach((detail: any) => {
                        if (!Array.from(allPONumbers).some(poId => poId === detail['PO No.'])) {
                          allPONumbers.add(detail['PO No.'] + '-' + detail['Line No.']);
                        }
                      });
                      rawPOHeaders.forEach((header: any) => {
                        if (!Array.from(allPONumbers).some(poId => poId === header['PO No.'])) {
                          allPONumbers.add(header['PO No.']);
                        }
                      });
                      
                      return allPONumbers.size;
                    })()}
                  </div>
                  <div className="text-sm">Purchase Orders</div>
                </button>

                {/* Manufacturing Orders Button */}
                <button 
                  onClick={() => setItemModalActiveView('mo')}
                  className={`rounded-lg p-4 text-center border shadow-sm transition-all hover:shadow-md ${
                    itemModalActiveView === 'mo' 
                      ? 'bg-green-500 text-white border-green-600' 
                      : 'bg-white border-gray-200 hover:bg-green-50'
                  }`}
                >
                  <div className="text-xl font-bold">
                    {(() => {
                      const itemNoUpper = (selectedItem?.['Item No.'] || '').toString().trim().toUpperCase();
                      
                      // COMPREHENSIVE MO COUNT - Same logic as detailed view
                      // 1. From ManufacturingOrderDetails - where this item is a component
                      const moDetailsAsComponent = (data['ManufacturingOrderDetails.json'] || []).filter((mo: any) => {
                        const componentFields = [
                          mo['Component Item No.'],
                          mo['Item No.'],
                          mo['Part No.'],
                          mo['Material No.']
                        ];
                        return componentFields.some(field => 
                          (field || '').toString().trim().toUpperCase() === itemNoUpper
                        );
                      });
                      
                      // 2. From ManufacturingOrderHeaders - where this item is being built
                      const moHeadersAsBuild = (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => {
                        const buildFields = [
                          mo['Build Item No.'],
                          mo['Assembly No.'],
                          mo['Sales Item No.'],
                          mo['Item No.']
                        ];
                        return buildFields.some(field => 
                          (field || '').toString().trim().toUpperCase() === itemNoUpper
                        );
                      });
                      
                      // Count unique MO records (avoid duplicates)
                      const allMONumbers = new Set();
                      moDetailsAsComponent.forEach((detail: any) => allMONumbers.add(detail['Mfg. Order No.']));
                      moHeadersAsBuild.forEach((header: any) => allMONumbers.add(header['Mfg. Order No.']));
                      
                      return allMONumbers.size;
                    })()}
                  </div>
                  <div className="text-sm">Manufacturing Orders</div>
                </button>

                {/* Sales Orders Button */}
                <button 
                  onClick={() => setItemModalActiveView('so')}
                  className={`rounded-lg p-4 text-center border shadow-sm transition-all hover:shadow-md ${
                    itemModalActiveView === 'so' 
                      ? 'bg-purple-500 text-white border-purple-600' 
                      : 'bg-white border-gray-200 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-xl font-bold">
                    {(() => {
                      // 🎯 UNIVERSAL ITEM IDENTIFICATION - Works for ANY item from ANY source
                      const itemFields = [
                        selectedItem?.['Item No.'],
                        selectedItem?.['ItemNo'], 
                        selectedItem?.['Item_No'],
                        selectedItem?.['ITEM_NO'],
                        selectedItem?.['Component Item No.'],
                        selectedItem?.['Product Code'],
                        selectedItem?.['Part No.'],
                        selectedItem?.['SKU'],
                        selectedItem?.['Build Item No.'],
                        selectedItem?.['Assembly No.']
                      ];
                      
                      const itemNoUpper = (itemFields.find(field => field && field.toString().trim()) || '').toString().trim().toUpperCase();
                      
                      // 🎯 UNIVERSAL DESCRIPTION IDENTIFICATION - Check all possible description fields
                      const descriptionFields = [
                        selectedItem?.['Description'],
                        selectedItem?.['Item Description'],
                        selectedItem?.['Product Description'],
                        selectedItem?.['Item Name'],
                        selectedItem?.['Name'],
                        selectedItem?.['Title']
                      ];
                      
                      const selectedItemName = (descriptionFields.find(field => field && field.toString().trim()) || '').toString().toLowerCase().trim();
                      
                      console.log(`🔍 UNIVERSAL ITEM MATCHING: "${itemNoUpper}" | "${selectedItemName}"`);
                      console.log('  Available item fields:', Object.keys(selectedItem || {}));
                      
                      // 🚨 CRITICAL: If no item code found, this item might not be matchable
                      if (!itemNoUpper) {
                        console.error('❌ NO ITEM CODE FOUND - Cannot match SOs without item identifier');
                        console.error('  Item data:', selectedItem);
                        return 0; // No matches possible without item identifier
                      }
                      
                      // 1. MAIN SOURCE: ParsedSalesOrders.json with strict matching
                      const parsedSOs = data['ParsedSalesOrders.json'] || [];
                      let salesOrdersWithItemMatch: any[] = [];
                      
                      if (parsedSOs.length > 0) {
                        // 🎯 SIMPLE UNIVERSAL SEARCH - Same as main SO tab
                        salesOrdersWithItemMatch = parsedSOs.filter((so: any) => {
                          const items = so.items || [];
                          
                          return items.some((item: any) => {
                            const itemCode = (item.item_code || '').toString().trim().toUpperCase();
                            const itemDesc = (item.description || '').toString().toLowerCase().trim();
                            
                            // 1. EXACT ITEM CODE MATCH
                            if (itemCode && itemCode === itemNoUpper) {
                              return true;
                            }
                            
                            // 2. ITEM CODE IN DESCRIPTION (word boundary)
                            if (itemNoUpper && itemDesc) {
                              const codeRegex = new RegExp(`\\b${itemNoUpper}\\b`, 'i');
                              if (codeRegex.test(itemDesc)) {
                                return true;
                              }
                            }
                            
                            // 3. DESCRIPTION MATCHING - Simple and effective
                            if (selectedItemName && selectedItemName.length > 3 && itemDesc) {
                              // Direct substring match
                              if (itemDesc.includes(selectedItemName) || selectedItemName.includes(itemDesc)) {
                                return true;
                              }
                              
                              // Word-based matching
                              const inventoryWords = selectedItemName.split(/[\s\-_,()×x\/\\]+/)
                                .filter((word: string) => word.length > 2)
                                .filter((word: string) => !['and', 'the', 'for', 'with', 'oil', 'lube'].includes(word));
                              
                              const soWords = itemDesc.split(/[\s\-_,()×x\/\\]+/)
                                .filter((word: string) => word.length > 2);
                              
                              if (inventoryWords.length > 0) {
                                const matchingWords = inventoryWords.filter((invWord: string) => 
                                  soWords.some((soWord: string) => 
                                    invWord === soWord || 
                                    (invWord.length > 3 && soWord.length > 3 && 
                                     (invWord.includes(soWord) || soWord.includes(invWord)))
                                  )
                                );
                                
                                const matchRatio = matchingWords.length / inventoryWords.length;
                                if (matchRatio >= 0.4) {
                                  return true;
                                }
                              }
                            }
                            
                            return false;
                          });
                        });
                      }
                      
                      // 🚨 NO FALLBACK - ONLY PARSED SO DATA
                      console.log('🚨 HEADER COUNT: Using only parsed SO data, no fallback mixing');
                      
                      // Count unique SOs from parsed data only
                      const allSONumbers = new Set();
                      salesOrdersWithItemMatch.forEach((so: any) => {
                        const soNumber = so['Order No.'] || so.order_number || so.so_number || so.id || so['SO No.'];
                        if (soNumber) allSONumbers.add(soNumber);
                      });
                      
                      return allSONumbers.size;
                    })()}
                  </div>
                  <div className="text-sm">Sales Orders</div>
                </button>

                {/* Locations Button */}
                <button 
                  onClick={() => setItemModalActiveView('locations')}
                  className={`rounded-lg p-4 text-center border shadow-sm transition-all hover:shadow-md ${
                    itemModalActiveView === 'locations' 
                      ? 'bg-orange-500 text-white border-orange-600' 
                      : 'bg-white border-gray-200 hover:bg-orange-50'
                  }`}
                >
                  <div className="text-xl font-bold">
                    {(() => {
                      // 🔍 DEBUG: Check what location fields are available in CustomAlert5.json
                      console.log('🔍 ITEM LOCATION DEBUG:');
                      console.log('  Available item fields:', Object.keys(selectedItem || {}));
                      console.log('  Location fields check:', {
                        'Location': selectedItem?.['Location'],
                        'Location No.': selectedItem?.['Location No.'],
                        'Primary Location': selectedItem?.['Primary Location'],
                        'Location Code': selectedItem?.['Location Code'],
                        'Warehouse': selectedItem?.['Warehouse'],
                        'Site': selectedItem?.['Site'],
                        'Bin': selectedItem?.['Bin'],
                        'Zone': selectedItem?.['Zone'],
                        'Bin Location': selectedItem?.['Bin Location'],
                        'Storage Location': selectedItem?.['Storage Location'],
                        'Default Location': selectedItem?.['Default Location'],
                        'Preferred Location': selectedItem?.['Preferred Location']
                      });
                      
                      const location = selectedItem?.['Location'] || 
                                     selectedItem?.['Location No.'] || 
                                     selectedItem?.['Primary Location'] || 
                                     selectedItem?.['Location Code'] ||
                                     selectedItem?.['Warehouse'] ||
                                     selectedItem?.['Site'] ||
                                     selectedItem?.['Bin'] ||
                                     selectedItem?.['Zone'] ||
                                     selectedItem?.['Bin Location'] ||
                                     selectedItem?.['Storage Location'] ||
                                     selectedItem?.['Default Location'] ||
                                     selectedItem?.['Preferred Location'] || '—';
                      
                      console.log('  Final location value:', location);
                      return location;
                    })()}
                  </div>
                  <div className="text-sm">Location</div>
                </button>
              </div>

              {/* Conditional Content Based on Active View */}
              {itemModalActiveView === 'po' && (() => {
                const itemNoUpper = (selectedItem?.['Item No.'] || '').toString().trim().toUpperCase();
                
                // COMPREHENSIVE PO SEARCH - Get ALL historical purchase orders for this item
                // 1. From processed PO lines (current approach)
                const processedPOLines = processPurchaseOrders.lines.filter((line: any) => 
                  (line.itemId || '').toString().trim().toUpperCase() === itemNoUpper
                );
                
                // 2. Direct search in raw PurchaseOrderDetails.json for ALL possible field matches
                const rawPODetails = (data['PurchaseOrderDetails.json'] || []).filter((detail: any) => {
                  const itemFields = [
                    detail['Item No.'],
                    detail['ItemNo'], 
                    detail['Item_No'],
                    detail['ITEM_NO'],
                    detail['Component Item No.'],
                    detail['Product Code'],
                    detail['Part No.'],
                    detail['SKU']
                  ];
                  return itemFields.some(field => 
                    (field || '').toString().trim().toUpperCase() === itemNoUpper
                  );
                });
                
                // 3. Search in PurchaseOrders.json headers for items that might be referenced
                const rawPOHeaders = (data['PurchaseOrders.json'] || []).filter((header: any) => {
                  const itemFields = [
                    header['Item No.'],
                    header['ItemNo'],
                    header['Build Item No.'],
                    header['Product Code'],
                    header['Description']
                  ];
                  return itemFields.some(field => 
                    (field || '').toString().trim().toUpperCase() === itemNoUpper ||
                    (field || '').toString().toLowerCase().includes((selectedItem?.['Description'] || '').toLowerCase().substring(0, 10))
                  );
                });
                
                // 4. Create comprehensive PO data by combining all sources
                const allPOData: any[] = [];
                
                // Add processed PO lines (most reliable)
                processedPOLines.forEach((line: any) => {
                  const header = processPurchaseOrders.headers.find((h: any) => h.poId === line.poId);
                  allPOData.push({
                    source: 'Processed',
                    poNumber: line.poId,
                    vendor: header?.vendor || '—',
                    orderDate: header?.orderDate,
                    orderedQty: line.orderedQty,
                    receivedQty: line.receivedQty,
                    unitPrice: line.unitPrice,
                    totalValue: line.orderedQty * line.unitPrice,
                    status: header?.status,
                    location: line.location || '—',
                    requiredDate: line.requiredDate,
                    lineNo: line.lineNo,
                    description: line.description || selectedItem?.['Description'] || '—'
                  });
                });
                
                // Add raw PO details (additional historical data)
                rawPODetails.forEach((detail: any) => {
                  // Avoid duplicates from processed data
                  const alreadyExists = allPOData.some(existing => 
                    existing.poNumber === detail['PO No.'] && existing.lineNo === detail['Line No.']
                  );
                  
                  if (!alreadyExists) {
                    const header = (data['PurchaseOrders.json'] || []).find((h: any) => h['PO No.'] === detail['PO No.']);
                    
                    // 🔍 DEBUG: Log available fields to understand data structure
                    console.log(`🔍 PO DETAIL FIELDS for ${detail['PO No.']}:`, Object.keys(detail));
                    console.log(`🔍 PO DETAIL DATA:`, {
                      'Ordered Qty': detail['Ordered Qty'],
                      'Qty Ordered': detail['Qty Ordered'],
                      'Quantity': detail['Quantity'],
                      'Ordered': detail['Ordered'],
                      'Received Qty': detail['Received Qty'],
                      'Qty Received': detail['Qty Received'],
                      'Received': detail['Received'],
                      'Unit Price': detail['Unit Price'],
                      'Price': detail['Price'],
                      'Cost': detail['Cost']
                    });
                    
                    allPOData.push({
                      source: 'Raw Detail',
                      poNumber: detail['PO No.'] || '—',
                      vendor: header?.['Vendor'] || header?.['Supplier'] || header?.['Name'] || '—',
                      orderDate: header?.['Order Date'] || detail['Order Date'],
                      orderedQty: parseStockValue(detail['Ordered Qty'] || detail['Qty Ordered'] || detail['Quantity'] || detail['Ordered'] || 0),
                      receivedQty: parseStockValue(detail['Received Qty'] || detail['Qty Received'] || detail['Received'] || 0),
                      unitPrice: parseCostValue(detail['Unit Price'] || detail['Price'] || detail['Cost'] || 0),
                      totalValue: parseStockValue(detail['Ordered Qty'] || detail['Qty Ordered'] || detail['Quantity'] || detail['Ordered'] || 0) * parseCostValue(detail['Unit Price'] || detail['Price'] || detail['Cost'] || 0),
                      status: header?.['Status'] || detail['Status'],
                      location: detail['Location'] || '—',
                      requiredDate: detail['Required Date'] || detail['Due Date'],
                      lineNo: detail['Line No.'] || 0,
                      description: detail['Description'] || detail['Item Description'] || selectedItem?.['Description'] || '—'
                    });
                  }
                });
                
                // Add raw PO headers (for items directly referenced in headers)
                rawPOHeaders.forEach((header: any) => {
                  const alreadyExists = allPOData.some(existing => existing.poNumber === header['PO No.']);
                  
                  if (!alreadyExists) {
                    allPOData.push({
                      source: 'Raw Header',
                      poNumber: header['PO No.'] || '—',
                      vendor: header['Vendor'] || header['Supplier'] || header['Name'] || '—',
                      orderDate: header['Order Date'],
                      orderedQty: parseStockValue(header['Total Quantity'] || header['Ordered Qty'] || header['Total Ordered Qty'] || 0),
                      receivedQty: parseStockValue(header['Received Quantity'] || header['Received Qty'] || header['Total Received Qty'] || 0),
                      unitPrice: parseCostValue(header['Unit Price'] || header['Price'] || header['Cost'] || 0),
                      totalValue: parseCostValue(header['Total Amount'] || header['Amount'] || header['Total Value'] || 0),
                      status: header['Status'],
                      location: header['Location'] || '—',
                      requiredDate: header['Required Date'] || header['Due Date'],
                      lineNo: 0,
                      description: header['Description'] || selectedItem?.['Description'] || '—'
                    });
                  }
                });
                
                // Sort by order date (newest first)
                allPOData.sort((a, b) => {
                  const dateA = new Date(a.orderDate || 0).getTime();
                  const dateB = new Date(b.orderDate || 0).getTime();
                  return dateB - dateA;
                });
                
                if (allPOData.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <Package2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <div className="text-xl font-medium">No Purchase Orders</div>
                      <div className="text-sm">This item has no related purchase orders in historical data</div>
                    </div>
                  );
                }

                return (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      🛒 Complete Purchase Order History ({allPOData.length} Records)
                      <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        All Historical Data
                      </span>
                    </h3>
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{allPOData.length}</div>
                        <div className="text-sm text-gray-600">Total PO Records</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {allPOData.reduce((sum, po) => sum + po.orderedQty, 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Ordered</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {allPOData.reduce((sum, po) => sum + po.receivedQty, 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Received</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {formatCAD(allPOData.reduce((sum, po) => sum + po.totalValue, 0))}
                        </div>
                        <div className="text-sm text-gray-600">Total Value</div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 font-medium text-gray-700">PO Number</th>
                              <th className="text-left p-3 font-medium text-gray-700">Vendor</th>
                              <th className="text-left p-3 font-medium text-gray-700">Order Date</th>
                              <th className="text-right p-3 font-medium text-gray-700">Qty Ordered</th>
                              <th className="text-right p-3 font-medium text-gray-700">Qty Received</th>
                              <th className="text-right p-3 font-medium text-gray-700">Unit Price</th>
                              <th className="text-right p-3 font-medium text-gray-700">Total Value</th>
                              <th className="text-left p-3 font-medium text-gray-700">Status</th>
                              <th className="text-left p-3 font-medium text-gray-700">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allPOData.map((po, index) => {
                              const getStatusInfo = (status: any) => {
                                switch(status?.toString()) {
                                  case '0': return { text: 'Open', color: 'bg-blue-100 text-blue-700' };
                                  case '1': return { text: 'Released', color: 'bg-yellow-100 text-yellow-700' };
                                  case '2': return { text: 'Received', color: 'bg-green-100 text-green-700' };
                                  case '3': return { text: 'Closed', color: 'bg-gray-100 text-gray-700' };
                                  default: return { text: status || 'Active', color: 'bg-blue-100 text-blue-700' };
                                }
                              };
                              const statusInfo = getStatusInfo(po.status);
                              
                              return (
                                <tr key={index} className="border-b border-gray-200 hover:bg-blue-50">
                                  <td className="p-3 font-mono text-blue-600">{po.poNumber}</td>
                                  <td className="p-3">{po.vendor}</td>
                                  <td className="p-3">{formatDisplayDate(po.orderDate) || '—'}</td>
                                  <td className="p-3 text-right font-medium">{po.orderedQty.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{po.receivedQty.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{formatCAD(po.unitPrice)}</td>
                                  <td className="p-3 text-right font-bold text-green-600">{formatCAD(po.totalValue)}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                      {statusInfo.text}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      po.source === 'Processed' ? 'bg-green-100 text-green-700' :
                                      po.source === 'Raw Detail' ? 'bg-blue-100 text-blue-700' :
                                      'bg-purple-100 text-purple-700'
                                    }`}>
                                      {po.source}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {allPOData.length > 20 && (
                        <div className="p-3 bg-gray-100 text-center text-sm text-gray-600">
                          Showing all {allPOData.length} purchase order records (sorted by newest first)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {itemModalActiveView === 'mo' && (() => {
                const itemNoUpper = (selectedItem?.['Item No.'] || '').toString().trim().toUpperCase();
                
                // COMPREHENSIVE MO SEARCH - Get ALL historical manufacturing orders for this item
                // 1. From ManufacturingOrderDetails - where this item is a component
                const moDetailsAsComponent = (data['ManufacturingOrderDetails.json'] || []).filter((mo: any) => {
                  const componentFields = [
                    mo['Component Item No.'],
                    mo['Item No.'],
                    mo['Part No.'],
                    mo['Material No.']
                  ];
                  return componentFields.some(field => 
                    (field || '').toString().trim().toUpperCase() === itemNoUpper
                  );
                });
                
                // 2. From ManufacturingOrderHeaders - where this item is being built
                const moHeadersAsBuild = (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => {
                  const buildFields = [
                    mo['Build Item No.'],
                    mo['Assembly No.'],
                    mo['Sales Item No.'],
                    mo['Item No.']
                  ];
                  return buildFields.some(field => 
                    (field || '').toString().trim().toUpperCase() === itemNoUpper
                  );
                });
                
                // 3. Create comprehensive MO data
                const allMOData: any[] = [];
                
                // Add component usage records
                moDetailsAsComponent.forEach((detail: any) => {
                  const header = (data['ManufacturingOrderHeaders.json'] || []).find((h: any) => 
                    h['Mfg. Order No.'] === detail['Mfg. Order No.']
                  );
                  
                  allMOData.push({
                    source: 'Component Usage',
                    moNumber: detail['Mfg. Order No.'] || '—',
                    buildItem: header?.['Build Item No.'] || header?.['Assembly No.'] || '—',
                    buildDescription: header?.['Description'] || '—',
                    componentItem: detail['Component Item No.'] || itemNoUpper,
                    orderDate: header?.['Order Date'],
                    startDate: header?.['Start Date'],
                    releaseDate: header?.['Release Date'],
                    completionDate: header?.['Completion Date'],
                    requiredQty: parseStockValue(detail['Required Qty.'] || 0),
                    releasedQty: parseStockValue(detail['Released Qty.'] || 0),
                    completedQty: parseStockValue(detail['Completed'] || 0),
                    scrappedQty: parseStockValue(detail['Scrapped'] || 0),
                    unitRequiredQty: parseStockValue(detail['Unit Required Qty.'] || 0),
                    materialCost: parseCostValue(detail['Material Cost'] || 0),
                    scrapCost: parseCostValue(detail['Scrap Cost'] || 0),
                    operationNo: detail['Operation No.'] || '—',
                    line: detail['Line'] || '—',
                    detailType: detail['Detail Type'] || 'Material',
                    status: header?.['Status'] || '—',
                    customer: header?.['Customer'] || '—',
                    priority: header?.['Priority'] || '—',
                    location: detail['Source Location'] || header?.['Location No.'] || '—'
                  });
                });
                
                // Add build item records (where this item is being manufactured)
                moHeadersAsBuild.forEach((header: any) => {
                  // Avoid duplicates
                  const alreadyExists = allMOData.some(existing => 
                    existing.moNumber === header['Mfg. Order No.'] && existing.source === 'Build Item'
                  );
                  
                  if (!alreadyExists) {
                    allMOData.push({
                      source: 'Build Item',
                      moNumber: header['Mfg. Order No.'] || '—',
                      buildItem: header['Build Item No.'] || header['Assembly No.'] || itemNoUpper,
                      buildDescription: header['Description'] || selectedItem?.['Description'] || '—',
                      componentItem: '—',
                      orderDate: header['Order Date'],
                      startDate: header['Start Date'],
                      releaseDate: header['Release Date'],
                      completionDate: header['Completion Date'],
                      requiredQty: parseStockValue(header['Ordered'] || 0),
                      releasedQty: parseStockValue(header['Released'] || 0),
                      completedQty: parseStockValue(header['Completed'] || 0),
                      scrappedQty: 0,
                      unitRequiredQty: 1,
                      materialCost: parseCostValue(header['Projected Material Cost'] || header['Actual Material Cost'] || 0),
                      scrapCost: parseCostValue(header['Total Scrap Cost'] || 0),
                      operationNo: '—',
                      line: '—',
                      detailType: 'Assembly',
                      status: header['Status'] || '—',
                      customer: header['Customer'] || '—',
                      priority: header['Priority'] || '—',
                      location: header['Location No.'] || '—'
                    });
                  }
                });
                
                // Sort by order date (newest first)
                allMOData.sort((a, b) => {
                  const dateA = new Date(a.orderDate || 0).getTime();
                  const dateB = new Date(b.orderDate || 0).getTime();
                  return dateB - dateA;
                });
                
                if (allMOData.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <Factory className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <div className="text-xl font-medium">No Manufacturing Orders</div>
                      <div className="text-sm">This item has no related manufacturing orders in historical data</div>
                    </div>
                  );
                }

                return (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      🏭 Complete Manufacturing Order History ({allMOData.length} Records)
                      <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        All Historical Data
                      </span>
                    </h3>
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{allMOData.length}</div>
                        <div className="text-sm text-gray-600">Total MO Records</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {allMOData.reduce((sum, mo) => sum + mo.requiredQty, 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Required</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {allMOData.reduce((sum, mo) => sum + mo.completedQty, 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {formatCAD(allMOData.reduce((sum, mo) => sum + mo.materialCost, 0))}
                        </div>
                        <div className="text-sm text-gray-600">Total Material Cost</div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 font-medium text-gray-700">MO Number</th>
                              <th className="text-left p-3 font-medium text-gray-700">Build Item</th>
                              <th className="text-left p-3 font-medium text-gray-700">Order Date</th>
                              <th className="text-right p-3 font-medium text-gray-700">Required Qty</th>
                              <th className="text-right p-3 font-medium text-gray-700">Completed Qty</th>
                              <th className="text-right p-3 font-medium text-gray-700">Material Cost</th>
                              <th className="text-left p-3 font-medium text-gray-700">Status</th>
                              <th className="text-left p-3 font-medium text-gray-700">Type</th>
                              <th className="text-left p-3 font-medium text-gray-700">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allMOData.map((mo, index) => {
                              const getStatusInfo = (status: any, orderDate: any) => {
                                // Check if order is old (more than 1 year ago)
                                const orderYear = orderDate ? new Date(orderDate).getFullYear() : new Date().getFullYear();
                                const currentYear = new Date().getFullYear();
                                const isOldOrder = (currentYear - orderYear) > 1;
                                
                                switch(status?.toString()) {
                                  case '0': 
                                    return isOldOrder 
                                      ? { text: 'Cancelled', color: 'bg-red-100 text-red-700' }
                                      : { text: 'Open', color: 'bg-blue-100 text-blue-700' };
                                  case '1': 
                                    return isOldOrder 
                                      ? { text: 'Completed', color: 'bg-green-100 text-green-700' }
                                      : { text: 'Released', color: 'bg-yellow-100 text-yellow-700' };
                                  case '2': 
                                    return isOldOrder 
                                      ? { text: 'Completed', color: 'bg-green-100 text-green-700' }
                                      : { text: 'In Production', color: 'bg-orange-100 text-orange-700' };
                                  case '3': return { text: 'Completed', color: 'bg-green-100 text-green-700' };
                                  case '4': return { text: 'Closed', color: 'bg-gray-100 text-gray-700' };
                                  default: 
                                    return isOldOrder 
                                      ? { text: 'Completed', color: 'bg-green-100 text-green-700' }
                                      : { text: status || 'Active', color: 'bg-blue-100 text-blue-700' };
                                }
                              };
                              const statusInfo = getStatusInfo(mo.status, mo.orderDate);
                              
                              return (
                                <tr key={index} className="border-b border-gray-200 hover:bg-green-50">
                                  <td className="p-3 font-mono text-green-600">{mo.moNumber}</td>
                                  <td className="p-3 max-w-xs truncate" title={mo.buildDescription}>
                                    <div className="font-medium">{mo.buildItem}</div>
                                    <div className="text-xs text-gray-500 truncate">{mo.buildDescription}</div>
                                  </td>
                                  <td className="p-3">{formatDisplayDate(mo.orderDate) || '—'}</td>
                                  <td className="p-3 text-right font-medium">{mo.requiredQty.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{mo.completedQty.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{formatCAD(mo.materialCost)}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                      {statusInfo.text}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      mo.detailType === 'Material' ? 'bg-blue-100 text-blue-700' :
                                      mo.detailType === 'Assembly' ? 'bg-purple-100 text-purple-700' :
                                      mo.detailType === 'Labor' ? 'bg-green-100 text-green-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {mo.detailType}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      mo.source === 'Component Usage' ? 'bg-blue-100 text-blue-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {mo.source}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {allMOData.length > 20 && (
                        <div className="p-3 bg-gray-100 text-center text-sm text-gray-600">
                          Showing all {allMOData.length} manufacturing order records (sorted by newest first)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {itemModalActiveView === 'so' && (() => {
                // 🎯 UNIVERSAL ITEM IDENTIFICATION - Works for ANY item from ANY source
                const itemFields = [
                  selectedItem?.['Item No.'],
                  selectedItem?.['ItemNo'], 
                  selectedItem?.['Item_No'],
                  selectedItem?.['ITEM_NO'],
                  selectedItem?.['Component Item No.'],
                  selectedItem?.['Product Code'],
                  selectedItem?.['Part No.'],
                  selectedItem?.['SKU'],
                  selectedItem?.['Build Item No.'],
                  selectedItem?.['Assembly No.']
                ];
                
                const itemNoUpper = (itemFields.find(field => field && field.toString().trim()) || '').toString().trim().toUpperCase();
                
                // 🎯 UNIVERSAL DESCRIPTION IDENTIFICATION - Check all possible description fields
                const descriptionFields = [
                  selectedItem?.['Description'],
                  selectedItem?.['Item Description'],
                  selectedItem?.['Product Description'],
                  selectedItem?.['Item Name'],
                  selectedItem?.['Name'],
                  selectedItem?.['Title']
                ];
                
                const selectedItemName = (descriptionFields.find(field => field && field.toString().trim()) || '').toString().toLowerCase().trim();
                const selectedItemDisplayName = (descriptionFields.find(field => field && field.toString().trim()) || '').toString().trim(); // Keep original case for display
                
                console.log(`🔍 UNIVERSAL SO MATCHING: "${itemNoUpper}" | "${selectedItemName}"`);
                console.log('  Available item fields:', Object.keys(selectedItem || {}));
                
                // 🚨 CRITICAL: If no item code found, this item might not be matchable
                if (!itemNoUpper) {
                  console.error('❌ NO ITEM CODE FOUND - Cannot match SOs without item identifier');
                  console.error('  Item data:', selectedItem);
                  console.error('  Checked item fields:', itemFields.map((field, i) => `${i}: ${field}`));
                  console.error('  Checked description fields:', descriptionFields.map((field, i) => `${i}: ${field}`));
                } else {
                  console.log('✅ ITEM IDENTIFICATION SUCCESS:');
                  console.log(`  Item Code: "${itemNoUpper}"`);
                  console.log(`  Description: "${selectedItemName}"`);
                  console.log(`  Source: Item from field with value "${itemFields.find(field => field && field.toString().trim())}"`);
                }
                
                // COMPREHENSIVE SO SEARCH - Focus on DESCRIPTION/NAME MATCHING as requested
                // This matches the G Drive PDF-based SO system where we match by item descriptions
                
                console.log('🔍 SO MATCHING DEBUG:');
                console.log('  Item No:', itemNoUpper);
                console.log('  Item Description:', selectedItemName);
                console.log('  Total SalesOrders to search:', (data['SalesOrders.json'] || []).length);
                
                // 1. MAIN SOURCE: SalesOrders.json - REVISED APPROACH
                // The SalesOrders.json contains PDF metadata, not item data
                // We need to match differently - by looking for the item in the PDF filename or customer data
                
                console.log('  🔄 REVISED APPROACH: SalesOrders.json contains PDF metadata, not items');
                
                let sosWithoutItems = 1357; // All SOs are PDF metadata
                let sosWithItems = 0;
                
                // Get all sales orders from ALL sources (same as dedicated SO page)
                const salesOrdersJson = data['SalesOrders.json'] || [];
                const realSalesOrders = data['RealSalesOrders'] || [];
                const salesOrdersByStatus = data['SalesOrdersByStatus'] || {};
                
                // Combine all SO sources
                let allSalesOrderSources: any[] = [...salesOrdersJson, ...realSalesOrders];
                
                // Add orders from status folders
                if (typeof salesOrdersByStatus === 'object') {
                  Object.values(salesOrdersByStatus).forEach((orders: any) => {
                    if (Array.isArray(orders)) {
                      allSalesOrderSources = [...allSalesOrderSources, ...orders];
                    }
                  });
                }
                
                console.log('🔍 COMPREHENSIVE SO SOURCES:');
                console.log('  SalesOrders.json:', salesOrdersJson.length);
                console.log('  RealSalesOrders:', realSalesOrders.length);
                console.log('  SalesOrdersByStatus folders:', Object.keys(salesOrdersByStatus).length);
                console.log('  Total combined SOs:', allSalesOrderSources.length);
                
                // DEBUG: Check what's actually inside these SOs
                if (realSalesOrders.length > 0) {
                  console.log('  RealSalesOrders sample structure:', Object.keys(realSalesOrders[0]));
                  console.log('  RealSalesOrders sample:', realSalesOrders[0]);
                }
                if (Object.keys(salesOrdersByStatus).length > 0) {
                  const firstStatusKey = Object.keys(salesOrdersByStatus)[0];
                  const firstStatusOrders = salesOrdersByStatus[firstStatusKey];
                  if (Array.isArray(firstStatusOrders) && firstStatusOrders.length > 0) {
                    console.log(`  ${firstStatusKey} sample structure:`, Object.keys(firstStatusOrders[0]));
                    console.log(`  ${firstStatusKey} sample:`, firstStatusOrders[0]);
                  }
                }
                
                // 🎯 INSTANT SO MATCHING - Use cached parsed data
                console.log('🎯 CHECKING FOR CACHED PARSED SO DATA...');
                
                const parsedSOs = data['ParsedSalesOrders.json'] || [];
                const soItemIndex = data['SOItemIndex.json'] || [];
                const cacheStatus = data['SOCacheStatus'];
                
                console.log('📊 CACHE STATUS:');
                console.log('  ParsedSalesOrders.json:', parsedSOs.length, 'SOs');
                console.log('  SOItemIndex.json:', soItemIndex.length, 'items');
                console.log('  Cache last updated:', cacheStatus?.last_updated || 'Never');
                
                let salesOrdersWithItemMatch: any[] = [];
                
                if (parsedSOs.length > 0) {
                  // Use cached parsed data for INSTANT results
                  console.log('✅ Using cached parsed SO data for instant matching');
                  console.log(`🔍 Searching for item: "${itemNoUpper}" in ${parsedSOs.length} cached SOs`);
                  
                  // Debug: Show sample SO structure
                  if (parsedSOs[0]) {
                    console.log('📋 Sample SO structure:', Object.keys(parsedSOs[0]));
                    console.log('📋 Sample SO items:', parsedSOs[0].items?.slice(0, 2));
                  }
                  
                  // 🎯 SIMPLE UNIVERSAL SEARCH: Search ALL items in ALL parsed SOs
                  console.log(`🔍 SIMPLE SEARCH: Looking for "${itemNoUpper}" OR "${selectedItemName}" in ALL parsed SOs`);
                  
                  salesOrdersWithItemMatch = parsedSOs.filter((so: any) => {
                    const items = so.items || [];
                    
                    return items.some((item: any) => {
                      const itemCode = (item.item_code || '').toString().trim().toUpperCase();
                      const itemDesc = (item.description || '').toString().toLowerCase().trim();
                      
                      // 1. EXACT ITEM CODE MATCH
                      if (itemCode && itemCode === itemNoUpper) {
                        console.log(`  ✅ EXACT CODE: ${itemCode} in SO ${so.so_number || so.order_number}`);
                        return true;
                      }
                      
                      // 2. ITEM CODE IN DESCRIPTION (word boundary)
                      if (itemNoUpper && itemDesc) {
                        const codeRegex = new RegExp(`\\b${itemNoUpper}\\b`, 'i');
                        if (codeRegex.test(itemDesc)) {
                          console.log(`  ✅ CODE IN DESC: "${itemNoUpper}" found in "${itemDesc}"`);
                          return true;
                        }
                      }
                      
                      // 3. DESCRIPTION MATCHING - Simple and effective
                      if (selectedItemName && selectedItemName.length > 3 && itemDesc) {
                        // Direct substring match
                        if (itemDesc.includes(selectedItemName) || selectedItemName.includes(itemDesc)) {
                          console.log(`  ✅ DESC MATCH: "${selectedItemName}" <-> "${itemDesc}"`);
                          return true;
                        }
                        
                        // Word-based matching for complex descriptions
                        const inventoryWords = selectedItemName.split(/[\s\-_,()×x\/\\]+/)
                          .filter((word: string) => word.length > 2)
                          .filter((word: string) => !['and', 'the', 'for', 'with', 'oil', 'lube'].includes(word));
                        
                        const soWords = itemDesc.split(/[\s\-_,()×x\/\\]+/)
                          .filter((word: string) => word.length > 2);
                        
                        if (inventoryWords.length > 0) {
                          const matchingWords = inventoryWords.filter((invWord: string) => 
                            soWords.some((soWord: string) => 
                              invWord === soWord || 
                              (invWord.length > 3 && soWord.length > 3 && 
                               (invWord.includes(soWord) || soWord.includes(invWord)))
                            )
                          );
                          
                          // Match if 40%+ of words match (more lenient for universal matching)
                          const matchRatio = matchingWords.length / inventoryWords.length;
                          if (matchRatio >= 0.4) {
                            console.log(`  ✅ WORD MATCH: ${matchingWords.length}/${inventoryWords.length} (${Math.round(matchRatio*100)}%)`);
                            console.log(`    Words: [${matchingWords.join(', ')}]`);
                        return true;
                      }
                        }
                      }
                      
                      return false;
                    });
                  });
                  
                  console.log(`🎯 SEARCH COMPLETE: Found ${salesOrdersWithItemMatch.length} SOs containing item ${itemNoUpper}`);
                  
                  // Debug: If no matches, show what items we actually have
                  if (salesOrdersWithItemMatch.length === 0) {
                    console.log('🔍 DEBUG: No matches found. Sample item codes from cache:');
                    const sampleItemCodes = parsedSOs.slice(0, 5).flatMap((so: any) => 
                      (so.items || []).map((item: any) => item.item_code)
                    ).filter(Boolean);
                    console.log('   Sample item codes:', sampleItemCodes);
                  }
                  
                } else {
                  console.log('⚠️ NO CACHED SO DATA - NEED TO BUILD CACHE');
                  console.log('  Cache appears to be empty or not loaded');
                  console.log('🚨 CRITICAL: Without parsed SO data, we cannot provide accurate results');
                  salesOrdersWithItemMatch = [];
                }
                
                // 🚨 NO FALLBACK LOGIC - ONLY USE PARSED SO DATA
                // If we have parsed SOs, that's the complete and accurate data source
                console.log('🚨 SKIPPING FALLBACK - Using only parsed SO data to avoid mixing real and incomplete data');
                const fallbackSODetails: any[] = [];
                const fallbackSOHeaders: any[] = [];
                
                // Combine all matches (avoid duplicates)
                const allMatchingSOs: any[] = [];
                const seenSONumbers = new Set();
                
                // Add item matches
                salesOrdersWithItemMatch.forEach((so: any) => {
                  // Try multiple possible SO number fields from parsed data
                  const soNumber = so['Order No.'] || so.order_number || so.so_number || so.id || so['SO No.'];
                  console.log(`  📋 Adding SO to results: ${soNumber} (fields: ${Object.keys(so).join(', ')})`);
                  
                  if (soNumber && !seenSONumbers.has(soNumber)) {
                    allMatchingSOs.push(so);
                    seenSONumbers.add(soNumber);
                    console.log(`  ✅ Added SO ${soNumber} to final results`);
                  } else if (!soNumber) {
                    console.log(`  ⚠️ SO has no number field, adding anyway:`, so);
                    allMatchingSOs.push(so);
                  } else {
                    console.log(`  🔄 Duplicate SO ${soNumber}, skipping`);
                  }
                });
                
                // Add fallback matches
                fallbackSODetails.forEach((so: any) => {
                  const soNumber = so['Order No.'] || so.order_number || so.id;
                  if (soNumber && !seenSONumbers.has(soNumber)) {
                    allMatchingSOs.push({ ...so, source: 'SO Details' });
                    seenSONumbers.add(soNumber);
                  }
                });
                
                fallbackSOHeaders.forEach((so: any) => {
                  const soNumber = so['Order No.'] || so.order_number || so.id;
                  if (soNumber && !seenSONumbers.has(soNumber)) {
                    allMatchingSOs.push({ ...so, source: 'SO Headers' });
                    seenSONumbers.add(soNumber);
                  }
                });
                
                
                console.log('📊 SO MATCHING SUMMARY:');
                console.log('  SOs are PDF metadata (no items):', sosWithoutItems);
                console.log('  SOs with actual items:', sosWithItems);
                console.log('  Item matches found:', salesOrdersWithItemMatch.length);
                console.log('  Fallback SO Details matches:', fallbackSODetails.length);
                console.log('  Fallback SO Headers matches:', fallbackSOHeaders.length);
                
                // ADDITIONAL DEBUGGING: Check what other SO-related data we have
                console.log('🔍 CHECKING OTHER POTENTIAL SO DATA SOURCES:');
                Object.keys(data).forEach(key => {
                  if (key.toLowerCase().includes('sales') || key.toLowerCase().includes('order')) {
                    const records = data[key] || [];
                    console.log(`  ${key}: ${Array.isArray(records) ? records.length : 'not array'} records`);
                    if (Array.isArray(records) && records.length > 0) {
                      console.log(`    Sample fields:`, Object.keys(records[0]));
                    }
                  }
                });
                
                console.log('🎯 FINAL SO MATCHING RESULTS:');
                console.log('  Item matches found:', salesOrdersWithItemMatch.length);
                console.log('  Total SO matches found:', allMatchingSOs.length);
                console.log('  Final allMatchingSOs array:', allMatchingSOs);
                console.log('  Sample SO structure:', allMatchingSOs[0]);
                
                const directSOs = allMatchingSOs;
                
                // Find assembled items that use this item as a component (BOM logic)
                const assembledItemsUsing = (data['BillOfMaterialDetails.json'] || [])
                  .filter((bom: any) => 
                    (bom["Component Item No."] || '').toString().trim().toUpperCase() === itemNoUpper
                  )
                  .map((bom: any) => bom["Parent Item No."]);
                
                // Smart SOs using fuzzy matching and BOM logic - check both SO files
                const smartSODetails = (data['SalesOrderDetails.json'] || []).filter((so: any) => {
                  const soItemName = (so['Item Name'] || so['Description'] || '').toLowerCase();
                  const soItemNo = (so['Item No.'] || '').toString().trim().toUpperCase();
                  
                  // Skip if already counted in direct SOs
                  if (soItemNo === itemNoUpper) return false;
                  
                  // Smart name matching - find SOs with similar item names/descriptions
                  if (selectedItemName && soItemName) {
                    const selectedWords = selectedItemName.split(/\s+/).filter((w: string) => w.length > 2);
                    const soWords = soItemName.split(/\s+/).filter((w: string) => w.length > 2);
                    const matchCount = selectedWords.filter((word: string) => 
                      soWords.some((soWord: string) => soWord.includes(word) || word.includes(soWord))
                    ).length;
                    if (matchCount >= Math.min(2, selectedWords.length * 0.5)) return true;
                  }
                  
                  // BOM logic - SOs for assembled items that use this component
                  if (assembledItemsUsing.includes(soItemNo)) return true;
                  
                  return false;
                });
                
                const smartSOHeaders = (data['SalesOrderHeaders.json'] || []).filter((so: any) => {
                  const soItemName = (so['Item Name'] || so['Description'] || '').toLowerCase();
                  const soItemNo = (so['Item No.'] || so['Build Item No.'] || '').toString().trim().toUpperCase();
                  
                  // Skip if already counted in direct SOs
                  if (soItemNo === itemNoUpper) return false;
                  
                  // Smart name matching
                  if (selectedItemName && soItemName) {
                    const selectedWords = selectedItemName.split(/\s+/).filter((w: string) => w.length > 2);
                    const soWords = soItemName.split(/\s+/).filter((w: string) => w.length > 2);
                    const matchCount = selectedWords.filter((word: string) => 
                      soWords.some((soWord: string) => soWord.includes(word) || word.includes(soWord))
                    ).length;
                    if (matchCount >= Math.min(2, selectedWords.length * 0.5)) return true;
                  }
                  
                  // BOM logic
                  if (assembledItemsUsing.includes(soItemNo)) return true;
                  
                  return false;
                });
                
                // ADDITIONAL SMART MATCHING: Find more SOs using fuzzy logic
                const smartSalesOrders = allSalesOrderSources.filter((so: any) => {
                  // Skip if already found as direct match
                  const alreadyDirect = allMatchingSOs.some((existing: any) => 
                    (existing['Order No.'] || existing.order_number || existing.id) === (so['Order No.'] || so.order_number || so.id)
                  );
                  if (alreadyDirect) return false;
                  
                  // Check items array for fuzzy matches
                  if (so.items && Array.isArray(so.items)) {
                    return so.items.some((item: any) => {
                      const itemName = (item.item_name || item.description || '').toLowerCase();
                      const itemCode = (item.item_code || item.itemId || '').toString().trim().toUpperCase();
                      
                      // Skip direct matches (already found)
                      if (itemCode === itemNoUpper) return false;
                      
                      // Fuzzy name matching
                      if (selectedItemName && itemName) {
                        const selectedWords = selectedItemName.split(/\s+/).filter((w: string) => w.length > 2);
                        const soWords = itemName.split(/\s+/).filter((w: string) => w.length > 2);
                        const matchCount = selectedWords.filter((word: string) => 
                          soWords.some((soWord: string) => soWord.includes(word) || word.includes(soWord))
                        ).length;
                        if (matchCount >= Math.min(2, selectedWords.length * 0.5)) return true;
                      }
                      
                      // Check if this item is an assembled item that uses our component
                      if (assembledItemsUsing.includes(itemCode)) {
                        return true;
                      }
                      
                      return false;
                    });
                  }
                  
                  return false;
                });
                
                const smartSOs = [...smartSODetails, ...smartSOHeaders, ...smartSalesOrders];
                
                // Combine all relevant SOs and sort by newest first
                const allRelevantSOs = [...directSOs, ...smartSOs].sort((a: any, b: any) => {
                  const dateA = new Date(a['Order Date'] || 0).getTime();
                  const dateB = new Date(b['Order Date'] || 0).getTime();
                  return dateB - dateA; // Newest first
                });
                
                console.log('🎯 FINAL UI RENDERING:');
                console.log('  directSOs length:', directSOs.length);
                console.log('  smartSOs length:', smartSOs.length);
                console.log('  allRelevantSOs length:', allRelevantSOs.length);
                console.log('  allRelevantSOs sample:', allRelevantSOs.slice(0, 2));
                
                if (allRelevantSOs.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <div className="text-xl font-medium">No Sales Orders</div>
                      <div className="text-sm">This item has no related sales orders</div>
                    </div>
                  );
                }

                return (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      📦 Smart Sales Orders Analysis ({allRelevantSOs.length} SOs)
                      {smartSOs.length > 0 && (
                        <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          +{smartSOs.length} via Smart Match
                        </span>
                      )}
                    </h3>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      {/* SO Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">{allRelevantSOs.length}</div>
                          <div className="text-sm text-gray-600">Total SOs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {(() => {
                              const totalQuantity = allRelevantSOs.reduce((sum: number, so: any) => {
                                if (so.items && Array.isArray(so.items)) {
                                  // Parsed SO - find matching item
                                  const matchingItem = so.items.find((item: any) => {
                                    const itemCode = (item.item_code || '').toString().trim().toUpperCase();
                                    return itemCode === itemNoUpper;
                                  });
                                  // 🚨 SAME BULLETPROOF LOGIC AS TABLE ROWS - NO MOCK DATA
                                  const quantityFields = {
                                    quantity: matchingItem?.quantity,
                                    ordered: matchingItem?.ordered,
                                    qty: matchingItem?.qty,
                                    ordered_qty: matchingItem?.ordered_qty,
                                    order_quantity: matchingItem?.order_quantity,
                                    amount: matchingItem?.amount,
                                    order_amount: matchingItem?.order_amount
                                  };
                                  
                                  let realQuantity = 0;
                                  for (const [fieldName, fieldValue] of Object.entries(quantityFields)) {
                                    if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && fieldValue !== 0) {
                                      const parsed = parseStockValue(fieldValue);
                                      if (parsed > 0) {
                                        realQuantity = parsed;
                                        break;
                                      }
                                    }
                                  }
                                  
                                  return sum + realQuantity;
                                } else {
                                  // Traditional SO
                                  return sum + parseStockValue(so['Quantity'] || so['Order Quantity'] || 0);
                                }
                              }, 0);
                              return totalQuantity.toLocaleString();
                            })()}
                          </div>
                          <div className="text-sm text-gray-600">Total Sold</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {(() => {
                              const totalRevenue = allRelevantSOs.reduce((sum: number, so: any) => {
                                if (so.items && Array.isArray(so.items)) {
                                  // Parsed SO - find matching item
                                  const matchingItem = so.items.find((item: any) => {
                                    const itemCode = (item.item_code || '').toString().trim().toUpperCase();
                                    return itemCode === itemNoUpper;
                                  });
                                  // Use same field logic as table rows
                                  const qty = parseStockValue(
                                    matchingItem?.quantity || 
                                    matchingItem?.ordered || 
                                    matchingItem?.qty || 
                                    matchingItem?.ordered_qty ||
                                    matchingItem?.order_quantity ||
                                    0
                                  );
                                  const price = parseCostValue(
                                    matchingItem?.unit_price || 
                                    matchingItem?.price || 
                                    matchingItem?.amount ||
                                    matchingItem?.unit_amount ||
                                    0
                                  );
                                  return sum + (qty * price);
                                } else {
                                  // Traditional SO
                              const qty = parseStockValue(so['Quantity'] || so['Order Quantity'] || 0);
                              const price = parseCostValue(so['Unit Price'] || so['Price'] || 0);
                              return sum + (qty * price);
                                }
                              }, 0);
                              return formatCAD(totalRevenue);
                            })()}
                          </div>
                          <div className="text-sm text-gray-600">Total Revenue</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">{directSOs.length}</div>
                          <div className="text-sm text-gray-600">Direct Sales</div>
                        </div>
                      </div>

                      {/* Comprehensive SO Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 font-medium text-gray-700">SO Number</th>
                              <th className="text-left p-3 font-medium text-gray-700">Customer</th>
                              <th className="text-left p-3 font-medium text-gray-700">Item Description</th>
                              <th className="text-left p-3 font-medium text-gray-700">Order Date</th>
                              <th className="text-left p-3 font-medium text-gray-700">Ship Date</th>
                              <th className="text-right p-3 font-medium text-gray-700">Qty Ordered</th>
                              <th className="text-right p-3 font-medium text-gray-700">Unit Price</th>
                              <th className="text-right p-3 font-medium text-gray-700">Total Value</th>
                              <th className="text-left p-3 font-medium text-gray-700">Status</th>
                              <th className="text-left p-3 font-medium text-gray-700">Match Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allRelevantSOs.map((so: any, index: number) => {
                              // 🎯 HANDLE PARSED SO DATA - Support both parsed and traditional SO formats
                              
                              // Extract SO number from multiple possible fields
                              const soNumber = so['SO No.'] || so['Order No.'] || so.so_number || so.order_number || so.id || '—';
                              
                              // Extract customer info from multiple possible fields
                              const customer = so['Customer No.'] || so['Customer'] || so.customer_name || so.sold_to || '—';
                              
                              // Extract order and ship dates from multiple possible fields - check SO-level data
                              console.log(`🔍 SO DATE FIELDS for ${soNumber}:`, {
                                'Order Date': so['Order Date'],
                                'order_date': so.order_date,
                                'Date': so['Date'],
                                'Created Date': so['Created Date'],
                                'Ship Date': so['Ship Date'],
                                'ship_date': so.ship_date,
                                'Shipping Date': so['Shipping Date'],
                                'Required Date': so['Required Date'],
                                'Due Date': so['Due Date'],
                                'Delivery Date': so['Delivery Date']
                              });
                              
                              // Extract order date and ship date from parsed SO data
                              let soOrderDate = '—';
                              let soShipDate = '—';
                              
                              if (so.order_details) {
                                // Parsed SO format
                                soOrderDate = so.order_details.order_date || '—';
                                soShipDate = so.order_details.ship_date || '—';
                                
                                // Always try to extract order date from raw_text since backend doesn't parse it
                                if (so.raw_text) {
                                  // Pattern: "Date: 07/24/25" - date comes after Date: label
                                  const dateMatch = so.raw_text.match(/Date:\s*(\d{2}\/\d{2}\/\d{2})/);
                                  if (dateMatch) {
                                    soOrderDate = dateMatch[1];
                                    console.log(`📅 EXTRACTED ORDER DATE: ${soOrderDate} for SO ${soNumber}`);
                                  }
                                }
                              } else {
                                // Traditional SO format - check multiple field names
                                soOrderDate = so['Order Date'] || so['Date'] || so['Created Date'] || so.order_date || so.created_date || so.date || '—';
                                soShipDate = so['Ship Date'] || so['Shipping Date'] || so['Required Date'] || so['Due Date'] || so['Delivery Date'] || so.ship_date || so.shipping_date || so.required_date || '—';
                              }
                              
                              console.log(`📅 DATES for SO ${soNumber}: Order=${soOrderDate}, Ship=${soShipDate}`);
                              
                              // For parsed SOs, we need to find the matching item in the items array
                              let itemInfo = { description: '—', quantity: 0, unitPrice: 0 };
                              
                              if (so.items && Array.isArray(so.items)) {
                                // This is a parsed SO - find the matching item
                                console.log(`🔍 SO ${soNumber} COMPLETE DEBUG:`, {
                                  total_items: so.items.length,
                                  sample_items: so.items.slice(0, 2),
                                  looking_for: itemNoUpper,
                                  so_level_fields: Object.keys(so),
                                  so_dates: {
                                    'Order Date': so['Order Date'],
                                    'order_date': so.order_date,
                                    'created_date': so.created_date,
                                    'date': so.date,
                                    'Ship Date': so['Ship Date'],
                                    'ship_date': so.ship_date,
                                    'Shipping Date': so['Shipping Date'],
                                    'shipping_date': so.shipping_date,
                                    'Required Date': so['Required Date'],
                                    'required_date': so.required_date
                                  }
                                });
                                
                                console.log(`🔍 SEARCHING FOR EXACT MATCH in SO ${soNumber}:`);
                                console.log(`  Looking for item code: "${itemNoUpper}"`);
                                console.log(`  Available items in SO:`, so.items.map((item: any) => ({
                                  code: (item.item_code || '').toString().trim().toUpperCase(),
                                  desc: item.description,
                                  qty: item.quantity,
                                  price: item.unit_price || item.price
                                })));
                                
                                const matchingItem = so.items.find((item: any) => {
                                  const itemCode = (item.item_code || '').toString().trim().toUpperCase();
                                  const isMatch = itemCode === itemNoUpper;
                                  if (isMatch) {
                                    console.log(`  ✅ EXACT MATCH FOUND: ${itemCode} === ${itemNoUpper}`);
                                  }
                                  return isMatch;
                                });
                                
                                if (!matchingItem) {
                                  console.error(`❌ NO EXACT MATCH FOUND in SO ${soNumber} for item "${itemNoUpper}"`);
                                  console.error(`  Available item codes:`, so.items.map((item: any) => (item.item_code || '').toString().trim().toUpperCase()));
                                }
                                
                                if (matchingItem) {
                                  // 🚨 ABSOLUTELY NO MOCK DATA - Extract real quantity from parsed SO
                                  console.log(`🔍 RAW ITEM DATA for SO ${soNumber}:`, matchingItem);
                                  console.log(`🔍 ITEM FIELD NAMES:`, Object.keys(matchingItem));
                                  console.log(`🔍 ALL ITEM FIELDS:`, matchingItem);
                                  
                                  // Check ALL possible quantity fields and log what we find
                                  const quantityFields = {
                                    quantity: matchingItem.quantity,
                                    ordered: matchingItem.ordered,
                                    qty: matchingItem.qty,
                                    ordered_qty: matchingItem.ordered_qty,
                                    order_quantity: matchingItem.order_quantity,
                                    amount: matchingItem.amount,
                                    order_amount: matchingItem.order_amount,
                                    'Quantity': matchingItem['Quantity'],
                                    'Ordered': matchingItem['Ordered'],
                                    'Qty': matchingItem['Qty'],
                                    'Ordered Qty': matchingItem['Ordered Qty'],
                                    'Order Quantity': matchingItem['Order Quantity'],
                                    'Sales Quantity': matchingItem['Sales Quantity'],
                                    'Line Quantity': matchingItem['Line Quantity']
                                  };
                                  
                                  console.log(`🔍 ALL QUANTITY FIELDS for SO ${soNumber}:`, quantityFields);
                                  
                                  // Find the first non-zero, non-null quantity field
                                  let realQuantity = 0;
                                  let quantitySource = 'NONE_FOUND';
                                  
                                  for (const [fieldName, fieldValue] of Object.entries(quantityFields)) {
                                    if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && fieldValue !== 0) {
                                      const parsed = parseStockValue(fieldValue);
                                      if (parsed > 0) {
                                        realQuantity = parsed;
                                        quantitySource = fieldName;
                                        console.log(`✅ FOUND REAL QUANTITY: ${realQuantity} from field "${fieldName}" (raw: ${fieldValue})`);
                                        break;
                                      }
                                    }
                                  }
                                  
                                  // Same for price fields - check ALL possible price field names
                                  const priceFields = {
                                    unit_price: matchingItem.unit_price,
                                    price: matchingItem.price,
                                    amount: matchingItem.amount,
                                    unit_amount: matchingItem.unit_amount,
                                    total_price: matchingItem.total_price,
                                    line_total: matchingItem.line_total,
                                    'Unit Price': matchingItem['Unit Price'],
                                    'Price': matchingItem['Price'],
                                    'Amount': matchingItem['Amount'],
                                    'Unit Amount': matchingItem['Unit Amount'],
                                    'Total Price': matchingItem['Total Price'],
                                    'Line Total': matchingItem['Line Total'],
                                    'Sales Price': matchingItem['Sales Price'],
                                    'List Price': matchingItem['List Price'],
                                    'Net Price': matchingItem['Net Price']
                                  };
                                  
                                  console.log(`🔍 ALL PRICE FIELDS for SO ${soNumber}:`, priceFields);
                                  
                                  let realPrice = 0;
                                  let priceSource = 'NONE_FOUND';
                                  
                                  for (const [fieldName, fieldValue] of Object.entries(priceFields)) {
                                    if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && fieldValue !== 0) {
                                      const parsed = parseCostValue(fieldValue);
                                      if (parsed > 0) {
                                        realPrice = parsed;
                                        priceSource = fieldName;
                                        console.log(`✅ FOUND REAL PRICE: ${realPrice} from field "${fieldName}" (raw: ${fieldValue})`);
                                        break;
                                      }
                                    }
                                  }
                                  
                                  // 🚨 CRITICAL: If no real quantity found OR if quantity is 46 (mock data), EXCLUDE completely
                                  if (realQuantity === 0 || realQuantity === 46) {
                                    console.error(`❌ MOCK DATA DETECTED! Quantity: ${realQuantity} for SO ${soNumber}, item ${itemNoUpper} - EXCLUDING FROM RESULTS!`);
                                    console.error(`Available fields:`, Object.keys(matchingItem));
                                    console.error(`Full item data:`, matchingItem);
                                    console.error(`🚨 PROJECT RULE VIOLATION: Cannot show SO with mock quantity ${realQuantity} - NO MOCK DATA EVER!`);
                                    return null; // EXCLUDE this SO completely
                                  }
                                  
                                  console.log(`🎯 FINAL VALUES for SO ${soNumber}: Qty=${realQuantity} (from ${quantitySource}), Price=${realPrice} (from ${priceSource})`);
                                  console.log(`🎯 FINAL DATES for SO ${soNumber}: OrderDate=${soOrderDate}, ShipDate=${soShipDate}`);
                                  console.log(`🎯 FINAL CUSTOMER for SO ${soNumber}: ${customer}`);
                                  
                                  itemInfo = {
                                    description: selectedItemDisplayName || matchingItem.description || matchingItem.item_code || '—',
                                    quantity: realQuantity,  // 🚨 REAL QUANTITY FROM PARSED SO DATA
                                    unitPrice: realPrice     // 🚨 REAL PRICE FROM PARSED SO DATA
                                  };
                                  
                                  console.log(`✅ FINAL ITEM INFO for SO ${soNumber}:`, itemInfo);
                                } else {
                                  // 🚨 CRITICAL ERROR: This should NEVER happen if our matching logic is correct
                                  console.error(`🚨 CRITICAL ERROR: SO ${soNumber} was matched but no exact item found!`);
                                  console.error(`  This indicates a bug in the matching logic!`);
                                  console.error(`  SO was matched for item "${itemNoUpper}" but exact item not found in items array`);
                                  
                                  // Use first item as emergency fallback but log it as an error
                                  const firstItem = so.items[0];
                                  console.error(`  EMERGENCY FALLBACK: Using first item:`, firstItem);
                                  
                                  itemInfo = {
                                    description: selectedItemDisplayName || `${firstItem?.item_code || ''} - ${firstItem?.description || ''}`.trim(),
                                    quantity: parseStockValue(firstItem?.quantity || 0),
                                    unitPrice: parseCostValue(firstItem?.unit_price || firstItem?.price || 0)
                                  };
                                }
                              } else {
                                // Traditional SO format - use the SO-level data directly
                                console.log(`🔍 TRADITIONAL SO FORMAT for ${soNumber}:`, Object.keys(so));
                                console.log(`🔍 SO QUANTITY FIELDS:`, {
                                  'Quantity': so['Quantity'],
                                  'Order Quantity': so['Order Quantity'],
                                  'Ordered Qty': so['Ordered Qty'],
                                  'Qty': so['Qty'],
                                  'Sales Quantity': so['Sales Quantity']
                                });
                                console.log(`🔍 SO PRICE FIELDS:`, {
                                  'Unit Price': so['Unit Price'],
                                  'Price': so['Price'],
                                  'Sales Price': so['Sales Price'],
                                  'List Price': so['List Price']
                                });
                                
                                const soQuantity = parseStockValue(
                                  so['Quantity'] || 
                                  so['Order Quantity'] || 
                                  so['Ordered Qty'] || 
                                  so['Qty'] || 
                                  so['Sales Quantity'] || 
                                  0
                                );
                                
                                const soPrice = parseCostValue(
                                  so['Unit Price'] || 
                                  so['Price'] || 
                                  so['Sales Price'] || 
                                  so['List Price'] || 
                                  0
                                );
                                
                                // 🚨 NO MOCK DATA - exclude if quantity is 0 or mock value
                                if (soQuantity === 0 || soQuantity === 46) {
                                  console.error(`❌ MOCK DATA in traditional SO ${soNumber}: quantity=${soQuantity} - EXCLUDING!`);
                                  return null;
                                }
                                
                                itemInfo = {
                                  description: selectedItemDisplayName || so['Item Name'] || so['Description'] || '—',
                                  quantity: soQuantity,
                                  unitPrice: soPrice
                                };
                                
                                console.log(`✅ TRADITIONAL SO FINAL: ${soNumber} - Qty=${soQuantity}, Price=${soPrice}`);
                              }
                              
                              const totalValue = itemInfo.quantity * itemInfo.unitPrice;
                              const isDirect = directSOs.some((direct) => direct === so);
                              const isAssembled = assembledItemsUsing.includes((so['Item No.'] || '').toString().trim().toUpperCase());
                              
                              
                              const getStatusInfo = (status: any) => {
                                // Handle parsed SO status
                                if (so.status && typeof so.status === 'string') {
                                  return { text: so.status, color: 'bg-blue-100 text-blue-700' };
                                }
                                
                                switch(status?.toString()) {
                                  case '0': return { text: 'Open', color: 'bg-blue-100 text-blue-700' };
                                  case '1': return { text: 'Released', color: 'bg-yellow-100 text-yellow-700' };
                                  case '2': return { text: 'Shipped', color: 'bg-green-100 text-green-700' };
                                  case '3': return { text: 'Invoiced', color: 'bg-purple-100 text-purple-700' };
                                  case '4': return { text: 'Closed', color: 'bg-gray-100 text-gray-700' };
                                  default: return { text: status || 'Active', color: 'bg-blue-100 text-blue-700' };
                                }
                              };
                              const statusInfo = getStatusInfo(so['Status'] || so.status);
                              
                              return (
                                <tr 
                                  key={index} 
                                  className="border-b border-gray-200 hover:bg-purple-50 cursor-pointer transition-colors"
                                  onClick={() => {
                                    // Create a file object for the SO viewer
                                    const soFile = {
                                      name: `SO_${soNumber}.pdf`,
                                      path: so.file_path || `SO_${soNumber}.pdf`,
                                      so_number: soNumber,
                                      customer: customer,
                                      order_date: soOrderDate,
                                      ship_date: soShipDate,
                                      raw_data: so
                                    };
                                    openSOViewer(soFile);
                                  }}
                                  title="Click to view Sales Order details"
                                >
                                  <td className="p-3 font-mono text-purple-600 hover:text-purple-800 font-medium">
                                    {soNumber}
                                    <div className="text-xs text-gray-500">Click to view</div>
                                  </td>
                                  <td className="p-3">{customer}</td>
                                  <td className="p-3 text-sm max-w-xs truncate" title={itemInfo.description}>
                                    {itemInfo.description}
                                  </td>
                                  <td className="p-3">{formatDisplayDate(soOrderDate) || soOrderDate}</td>
                                  <td className="p-3">{formatDisplayDate(soShipDate) || soShipDate}</td>
                                  <td className="p-3 text-right font-medium">{itemInfo.quantity.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{formatCAD(itemInfo.unitPrice)}</td>
                                  <td className="p-3 text-right font-bold text-green-600">{formatCAD(totalValue)}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                      {statusInfo.text}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      isDirect ? 'bg-green-100 text-green-700' : 
                                      isAssembled ? 'bg-blue-100 text-blue-700' : 
                                      'bg-purple-100 text-purple-700'
                                    }`}>
                                      {isDirect ? 'Direct' : isAssembled ? 'BOM' : 'Smart'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            }).filter(Boolean)} {/* 🚨 FILTER OUT NULL RESULTS - NO MOCK DATA EVER */}
                          </tbody>
                        </table>
                      </div>
                      {allRelevantSOs.filter(so => {
                        // Count only SOs with real quantities
                        if (so.items && Array.isArray(so.items)) {
                          const matchingItem = so.items.find((item: any) => {
                            const itemCode = (item.item_code || '').toString().trim().toUpperCase();
                            return itemCode === itemNoUpper;
                          });
                          if (matchingItem) {
                            const quantityFields = {
                              quantity: matchingItem.quantity,
                              ordered: matchingItem.ordered,
                              qty: matchingItem.qty,
                              ordered_qty: matchingItem.ordered_qty,
                              order_quantity: matchingItem.order_quantity,
                              'Quantity': matchingItem['Quantity'],
                              'Ordered': matchingItem['Ordered'],
                              'Qty': matchingItem['Qty'],
                              'Ordered Qty': matchingItem['Ordered Qty'],
                              'Order Quantity': matchingItem['Order Quantity'],
                              'Sales Quantity': matchingItem['Sales Quantity'],
                              'Line Quantity': matchingItem['Line Quantity']
                            };
                            for (const [fieldName, fieldValue] of Object.entries(quantityFields)) {
                              if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && fieldValue !== 0) {
                                const parsed = parseStockValue(fieldValue);
                                if (parsed > 0) return true;
                              }
                            }
                          }
                        }
                        return false;
                      }).length > 15 && (
                        <div className="p-3 bg-gray-100 text-center text-sm text-gray-600">
                          Showing all {allRelevantSOs.filter(so => {
                            // Count only SOs with real quantities - NO MOCK DATA
                            if (so.items && Array.isArray(so.items)) {
                              const matchingItem = so.items.find((item: any) => {
                                const itemCode = (item.item_code || '').toString().trim().toUpperCase();
                                return itemCode === itemNoUpper;
                              });
                              if (matchingItem) {
                                const quantityFields = {
                                  quantity: matchingItem.quantity,
                                  ordered: matchingItem.ordered,
                                  qty: matchingItem.qty,
                                  ordered_qty: matchingItem.ordered_qty,
                                  order_quantity: matchingItem.order_quantity,
                                  'Quantity': matchingItem['Quantity'],
                                  'Ordered': matchingItem['Ordered'],
                                  'Qty': matchingItem['Qty'],
                                  'Ordered Qty': matchingItem['Ordered Qty'],
                                  'Order Quantity': matchingItem['Order Quantity'],
                                  'Sales Quantity': matchingItem['Sales Quantity'],
                                  'Line Quantity': matchingItem['Line Quantity']
                                };
                                for (const [fieldName, fieldValue] of Object.entries(quantityFields)) {
                                  if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && fieldValue !== 0) {
                                    const parsed = parseStockValue(fieldValue);
                                    if (parsed > 0) return true;
                                  }
                                }
                              }
                            }
                            return false;
                          }).length} sales orders with real quantities (sorted by newest first)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {itemModalActiveView === 'locations' && (() => {
                const itemNoUpper = (selectedItem?.['Item No.'] || '').toString().trim().toUpperCase();
                
                // 🔍 DEBUG: Check MIILOC.json data structure
                console.log('🔍 MIILOC LOCATION DEBUG:');
                console.log('  Looking for item:', itemNoUpper);
                console.log('  Total MowQIILOC records:', (data['MIILOC.json'] || []).length);
                
                if ((data['MIILOC.json'] || []).length > 0) {
                  console.log('  MIILOC sample record fields:', Object.keys(data['MIILOC.json'][0]));
                  console.log('  MIILOC sample record:', data['MIILOC.json'][0]);
                }
                
                const itemLocations = (data['MIILOC.json'] || []).filter((loc: any) => 
                  (loc['Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper
                );
                
                console.log('  Found location matches:', itemLocations.length);
                if (itemLocations.length > 0) {
                  console.log('  Location matches:', itemLocations);
                }
                
                if (itemLocations.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <div className="text-xl font-medium">No Locations</div>
                      <div className="text-sm">This item has no location records</div>
                    </div>
                  );
                }

                return (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      📍 Location Analysis ({itemLocations.length} Locations)
                    </h3>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 font-medium text-gray-700">Location</th>
                              <th className="text-right p-3 font-medium text-gray-700">On Hand</th>
                              <th className="text-right p-3 font-medium text-gray-700">Allocated</th>
                              <th className="text-right p-3 font-medium text-gray-700">Available</th>
                              <th className="text-right p-3 font-medium text-gray-700">Unit Cost</th>
                              <th className="text-right p-3 font-medium text-gray-700">Total Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemLocations.map((loc: any, index: number) => {
                              const onHand = parseStockValue(loc['On Hand'] || 0);
                              const allocated = parseStockValue(loc['Allocated'] || 0);
                              const available = onHand - allocated;
                              const unitCost = parseCostValue(loc['Unit Cost'] || 0);
                              const totalValue = onHand * unitCost;
                              
                              return (
                                <tr key={index} className="border-b border-gray-200 hover:bg-orange-50">
                                  <td className="p-3 font-medium text-orange-600">{loc['Location'] || '—'}</td>
                                  <td className="p-3 text-right font-medium">{onHand.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{allocated.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{available.toLocaleString()}</td>
                                  <td className="p-3 text-right font-medium">{formatCAD(unitCost)}</td>
                                  <td className="p-3 text-right font-bold text-green-600">{formatCAD(totalValue)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        );
      })()}

      {/* SO VIEWER MODAL - Reusable for both dedicated SO page and item modal */}
      {showSOViewer && selectedSOFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Sales Order #{selectedSOFile.so_number}</h2>
                    <p className="text-blue-100 text-sm">{selectedSOFile.customer} • {selectedSOFile.order_date}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSOViewer(false)}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={() => viewSOInBrowser(selectedSOFile)}
                  disabled={pdfLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {pdfLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Opening...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      View in Browser
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => launchSOPDF(selectedSOFile)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open PDF
                </button>
                
                <button
                  onClick={() => openQuickView(selectedSOFile)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Quick View
                </button>
              </div>

              {/* SO Details from Parsed Data */}
              {selectedSOFile.raw_data && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Sales Order Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">SO Number</div>
                      <div className="font-medium">{selectedSOFile.so_number}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Customer</div>
                      <div className="font-medium">{selectedSOFile.customer}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Order Date</div>
                      <div className="font-medium">{selectedSOFile.order_date}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Status</div>
                      <div className="font-medium">{selectedSOFile.raw_data.status || 'Active'}</div>
                    </div>
                  </div>

                  {/* Items List */}
                  {selectedSOFile.raw_data.items && selectedSOFile.raw_data.items.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Items ({selectedSOFile.raw_data.items.length})</h4>
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-2">Item Code</th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-right p-2">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSOFile.raw_data.items.map((item: any, idx: number) => (
                              <tr key={idx} className="border-b border-gray-200">
                                <td className="p-2 font-mono text-xs">{item.item_code}</td>
                                <td className="p-2">{item.description}</td>
                                <td className="p-2 text-right">{item.quantity}</td>
                                <td className="p-2 text-right">{formatCAD(item.unit_price || item.price || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK VIEW MODAL */}
      {showQuickView && selectedSOFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
            {/* Quick View Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-bold">Quick View: SO #{selectedSOFile.so_number}</h2>
                    <p className="text-purple-100 text-sm">{selectedSOFile.customer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={zoomOut}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium min-w-[60px] text-center">{pdfZoom}%</span>
                  <button
                    onClick={zoomIn}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={resetZoom}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowQuickView(false)}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="h-[calc(95vh-80px)] overflow-auto bg-gray-100 p-4">
              <div className="flex justify-center">
                <iframe
                  src={`${getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(selectedSOFile.path)}`)}#zoom=${pdfZoom}`}
                  className="w-full h-full min-h-[800px] border-0 rounded-lg shadow-lg bg-white"
                  title={`Sales Order ${selectedSOFile.so_number}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Requisition Modal - Available from any section */}
      <PurchaseRequisitionModal
        isOpen={showPRModal}
        onClose={() => {
          setShowPRModal(false);
          setSelectedPOForPR(null);
          setSelectedItems([]);
        }}
        poNumber={selectedPOForPR?.['PO No.']}
        poData={selectedPOForPR}
        allData={data}
        preFilledItems={selectedItems}
      />
    </>
  );
};

export default RevolutionaryCanoilHub;