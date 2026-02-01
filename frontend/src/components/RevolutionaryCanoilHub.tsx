import React, { useState, useMemo, useEffect } from 'react';
import { CompactLoading, DataLoading, ToastNotification } from './LoadingComponents';
import { AICommandCenter } from './AICommandCenter';
// Production Schedule - embedded from external app
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
  ChevronRight,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  Settings,
  MoreHorizontal,
  ClipboardList,
  Wrench,
  Cog,
  Link2,
  Package,
  BarChart3 as BarChartIcon,
  Briefcase
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
  shipVia?: string;       // Ship Via method
  freight?: string;       // Freight amount/terms
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
  const [bomPRLoading, setBomPRLoading] = useState(false);
  
  // BOM Cart for multi-item PR generation
  const [bomCart, setBomCart] = useState<Array<{item_no: string; description: string; qty: number}>>([]);
  const [showBomCart, setShowBomCart] = useState(false);
  
  // BOM PR Generation Modal State
  const [showBOMPRModal, setShowBOMPRModal] = useState(false);
  const [bomPRModalData, setBOMPRModalData] = useState({
    justification: '',
    requestedBy: '',
    leadTime: 7
  });
  
  // PR History State
  const [showPRHistory, setShowPRHistory] = useState(false);
  const [prHistory, setPRHistory] = useState<any[]>([]);
  const [prHistoryLoading, setPRHistoryLoading] = useState(false);
  const [expandedPRHistory, setExpandedPRHistory] = useState<Set<string>>(new Set());
  
  // Redo PR Modal State
  const [showRedoPRModal, setShowRedoPRModal] = useState(false);
  const [redoPRData, setRedoPRData] = useState<{
    originalPR: any;
    items: Array<{item_no: string; qty: number; originalQty: number}>;
    justification: string;
    requestedBy: string;
    leadTime: number;
  } | null>(null);
  const [redoPRGenerating, setRedoPRGenerating] = useState(false);
  
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
        shipVia: po['Ship Via'] || '',
        freight: po['Freight'] || '',
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
      { key: 'Terms', label: 'Terms' },
      { key: 'Ship Via', label: 'Ship Via' },
      { key: 'FOB', label: 'FOB' },
      { key: 'Freight', label: 'Freight' },
      { key: 'Contact', label: 'Contact' },
      { key: 'Close Date', label: 'Close Date' }
    ];

    return columns.filter(col => {
      if (col.required) return true;
      if (col.calculated) return true; // Always show calculated fields
      
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
      // Handle MISys .NET JSON date format: /Date(1234567890)/
      if (typeof dateValue === 'string' && dateValue.includes('/Date(')) {
        const match = dateValue.match(/\/Date\((\d+)\)\//);
        if (match) {
          const timestamp = parseInt(match[1]);
          const converted = new Date(timestamp);
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
        getCustomerName(mo),
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

  // Function to fetch PR history
  const fetchPRHistory = async () => {
    setPRHistoryLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/pr/history'));
      if (response.ok) {
        const data = await response.json();
        setPRHistory(data.history || []);
      } else {
        console.error('Failed to fetch PR history');
        setPRHistory([]);
      }
    } catch (error) {
      console.error('Error fetching PR history:', error);
      setPRHistory([]);
    } finally {
      setPRHistoryLoading(false);
    }
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

  // Pre-compute assembled items (PERFORMANCE: do once, not in render loop)
  const assembledItemsSet = useMemo(() => {
    const bomDetails = data['BillOfMaterialDetails.json'] || [];
    const set = new Set<string>();
    bomDetails.forEach((bom: any) => {
      if (bom["Parent Item No."]) {
        set.add(bom["Parent Item No."]);
      }
    });
    return set;
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

  // SALES ORDERS - Just use loaded data directly (no calculations, no analytics)
  // OPTIMIZED: Use folder counts directly (FAST - no filtering!)
  const salesOrderAnalytics = useMemo(() => {
    const salesOrdersByStatus = data['SalesOrdersByStatus'] || {};
    const totalOrders = data['TotalOrders'] || 0;
    
    // Get counts directly from folder structure (instant!)
    const getFolderCount = (folderName: string): number => {
      // Special case: For "In Production", use "Scheduled" subfolder count (not 0 in production folder)
      if (folderName.toLowerCase() === 'in production') {
        // Try to find "Scheduled" subfolder within "In Production"
        const scheduledKey = Object.keys(salesOrdersByStatus).find(
          key => key.toLowerCase().includes('scheduled') || 
                 (key.toLowerCase().includes('production') && key.toLowerCase().includes('scheduled'))
        );
        if (scheduledKey && Array.isArray(salesOrdersByStatus[scheduledKey])) {
          return salesOrdersByStatus[scheduledKey].length;
        }
        // Fallback: try "In Production/Scheduled" or just "Scheduled"
        const inProdScheduled = Object.keys(salesOrdersByStatus).find(
          key => key.toLowerCase() === 'scheduled' || key.toLowerCase().includes('in production/scheduled')
        );
        if (inProdScheduled && Array.isArray(salesOrdersByStatus[inProdScheduled])) {
          return salesOrdersByStatus[inProdScheduled].length;
        }
      }
      
      const folderKey = Object.keys(salesOrdersByStatus).find(
        key => key.toLowerCase() === folderName.toLowerCase()
      );
      return folderKey && Array.isArray(salesOrdersByStatus[folderKey]) 
        ? salesOrdersByStatus[folderKey].length 
        : 0;
    };
    
    const getFolderData = (folderName: string): any[] => {
      // Special case: For "In Production", use "Scheduled" subfolder data
      if (folderName.toLowerCase() === 'in production') {
        const scheduledKey = Object.keys(salesOrdersByStatus).find(
          key => key.toLowerCase().includes('scheduled') || 
                 (key.toLowerCase().includes('production') && key.toLowerCase().includes('scheduled'))
        );
        if (scheduledKey && Array.isArray(salesOrdersByStatus[scheduledKey])) {
          return salesOrdersByStatus[scheduledKey];
        }
        const inProdScheduled = Object.keys(salesOrdersByStatus).find(
          key => key.toLowerCase() === 'scheduled' || key.toLowerCase().includes('in production/scheduled')
        );
        if (inProdScheduled && Array.isArray(salesOrdersByStatus[inProdScheduled])) {
          return salesOrdersByStatus[inProdScheduled];
        }
      }
      
      const folderKey = Object.keys(salesOrdersByStatus).find(
        key => key.toLowerCase() === folderName.toLowerCase()
      );
      return folderKey && Array.isArray(salesOrdersByStatus[folderKey]) 
        ? salesOrdersByStatus[folderKey] 
        : [];
    };
    
    const getLastUpdated = (orders: any[]) => {
      if (orders.length === 0) return 'No data';
      const dates = orders.map(so => {
        const dateStr = so["Order Date"] || so["Created Date"] || so["Modified Date"] || so["Last Modified"];
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
      }).filter(d => d !== null);
      
      if (dates.length === 0) return 'No date data';
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
        count: getFolderCount('New and Revised'),
        lastUpdated: getLastUpdated(getFolderData('New and Revised'))
      },
      inProduction: {
        count: getFolderCount('In Production'),
        lastUpdated: getLastUpdated(getFolderData('In Production'))
      },
      completed: {
        count: getFolderCount('Completed and Closed'),
        lastUpdated: getLastUpdated(getFolderData('Completed and Closed'))
      },
      cancelled: {
        count: getFolderCount('Cancelled'),
        lastUpdated: getLastUpdated(getFolderData('Cancelled'))
      },
      total: totalOrders
    };
  }, [data]);

  // Helper function to get customer name - always returns a value (from MO or Sales Order)
  const getCustomerName = useMemo(() => {
    const salesOrders = data['SalesOrderHeaders.json'] || data['SalesOrders.json'] || [];
    
    return (mo: any): string => {
      // First try MO's Customer field
      if (mo['Customer'] && mo['Customer'].trim()) {
        return mo['Customer'];
      }
      
      // If no customer in MO, try to find it from Sales Order
      if (mo['Sales Order No.'] || mo['Sales Order Number'] || mo['Sales Order']) {
        const soNumber = mo['Sales Order No.'] || mo['Sales Order Number'] || mo['Sales Order'];
        const relatedSO = salesOrders.find((so: any) => 
          so['Order No.'] === soNumber || 
          so['Order Number'] === soNumber ||
          so['SO Number'] === soNumber ||
          so['Sales Order No.'] === soNumber
        );
        
        if (relatedSO) {
          return relatedSO['Customer'] || 
                 relatedSO['Customer Name'] || 
                 relatedSO['customer_name'] || 
                 'Internal';
        }
      }
      
      // Fallback
      return 'Internal';
    };
  }, [data['SalesOrderHeaders.json'], data['SalesOrders.json']]);

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
      const customerName = getCustomerName(mo);
      if (!customerName || customerName.trim() === '' || customerName === 'Internal') return;
      
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
    setSoFolderData(null); // Clear previous data while loading
    try {
      // URL-encode each path segment to handle spaces and special characters
      const folderPath = path.map(segment => encodeURIComponent(segment)).join('/');
      console.log('🔄 Loading SO folder data for:', folderPath);
      console.log('🔗 API URL:', getApiUrl(`/api/sales-orders/folder/${folderPath}`));
      
      const response = await fetch(getApiUrl(`/api/sales-orders/folder/${folderPath}`));
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const folderData = await response.json();
        setSoFolderData(folderData);
        console.log('✅ Loaded SO folder data:', folderData);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to load SO folder data:', response.status, errorText);
        setSoFolderData({ error: `Failed to load: ${response.status}`, folders: [], files: [] });
      }
    } catch (error) {
      console.error('❌ Error loading SO folder data:', error);
      setSoFolderData({ error: `Network error: ${error}`, folders: [], files: [] });
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
      // Determine the correct URL based on whether it's a Google Drive file or local file
      let url: string;
      
      if (file.gdrive_id) {
        // Google Drive file - use the preview endpoint
        url = getApiUrl(`/api/gdrive/preview/${file.gdrive_id}`);
        console.log('🌐 Opening Google Drive PDF in browser:', url);
      } else if (file.path) {
        // Local file - use the existing endpoint
        const encodedPath = encodeURIComponent(file.path);
        url = getApiUrl(`/api/sales-order-pdf/${encodedPath}`);
        console.log('🌐 Opening local PDF in browser:', url);
      } else {
        console.error('❌ No valid path or gdrive_id for file:', file);
        setPdfLoading(false);
        return;
      }
      
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
      .filter((mo: any) => getCustomerName(mo) === customerName);
    
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
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 p-4 md:p-6">
        {/* Beautiful Gradient Background with subtle pattern */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-200/80 via-blue-100/60 to-indigo-200/80"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.15),transparent_50%)]"></div>
        </div>
        
        {/* PREMIUM NAVIGATION - Colorful 3D Icons Style v7.0 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 md:gap-5 max-w-7xl mx-auto mb-6 md:mb-8">
          
          {/* Dashboard - Active Blue Card Style */}
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'dashboard' 
                ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white shadow-2xl shadow-blue-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              {/* 3D-style Icon */}
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                📊
              </div>
              <div className={`text-base font-extrabold tracking-wide ${activeSection === 'dashboard' ? 'text-white' : 'text-slate-800'}`}>
                DASHBOARD
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'dashboard' ? 'text-blue-100' : 'text-blue-600'}`}>
                Enterprise Overview
              </div>
            </div>
          </button>

          {/* Inventory & BOM */}
          <button
            onClick={() => setActiveSection('inventory')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'inventory' 
                ? 'bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 text-white shadow-2xl shadow-emerald-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              {/* Badge */}
              {inventoryMetrics.lowStockCount > 0 && (
                <span className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1.5 shadow-lg ring-2 ring-white/50 animate-pulse z-10">
                  {inventoryMetrics.lowStockCount > 99 ? '99+' : inventoryMetrics.lowStockCount}
                </span>
              )}
              {/* 3D-style Icon */}
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                📦
              </div>
              <div className={`text-base font-extrabold tracking-wide text-center ${activeSection === 'inventory' ? 'text-white' : 'text-slate-800'}`}>
                INVENTORY<br/><span className="text-xs font-bold">& BOM</span>
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'inventory' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                {inventoryMetrics.totalItems.toLocaleString()} Items • Smart Planning
              </div>
            </div>
          </button>

          {/* Manufacturing */}
          <button
            onClick={() => setActiveSection('manufacturing-orders')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'manufacturing-orders' 
                ? 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white shadow-2xl shadow-violet-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              {/* Badge */}
              {manufacturingMetrics.active > 0 && (
                <span className="absolute top-3 right-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1.5 shadow-lg ring-2 ring-white/50 z-10">
                  {manufacturingMetrics.active}
                </span>
              )}
              {/* 3D-style Icon */}
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                🏭
              </div>
              <div className={`text-base font-extrabold tracking-wide ${activeSection === 'manufacturing-orders' ? 'text-white' : 'text-slate-800'}`}>
                MANUFACTURING
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'manufacturing-orders' ? 'text-violet-100' : 'text-violet-600'}`}>
                {(() => {
                  const allMOs = data?.['ManufacturingOrderHeaders.json'] || [];
                  const realMOs = allMOs.filter((mo: any) => mo['Mfg. Order No.'] && mo['Build Item No.']);
                  return `${realMOs.length} Orders`;
                })()}
              </div>
            </div>
          </button>

          {/* Purchase */}
          <button
            onClick={() => setActiveSection('purchase-orders')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'purchase-orders' 
                ? 'bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-700 text-white shadow-2xl shadow-orange-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              {/* Badge */}
              {purchaseMetrics.open > 0 && (
                <span className="absolute top-3 right-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[10px] font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1.5 shadow-lg ring-2 ring-white/50 z-10">
                  {purchaseMetrics.open > 99 ? '99+' : purchaseMetrics.open}
                </span>
              )}
              {/* 3D-style Icon - Shopping Cart with 24H */}
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                🛒
              </div>
              <div className={`text-base font-extrabold tracking-wide ${activeSection === 'purchase-orders' ? 'text-white' : 'text-slate-800'}`}>
                PURCHASE
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'purchase-orders' ? 'text-orange-100' : 'text-orange-600'}`}>
                {(data?.['PurchaseOrders.json'] || []).length} Orders
              </div>
            </div>
          </button>

          {/* Sales */}
          <button
            onClick={() => setActiveSection('orders')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'orders' 
                ? 'bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 text-white shadow-2xl shadow-cyan-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              {/* Badge */}
              {salesOrderAnalytics.newAndRevised.count > 0 && (
                <span className="absolute top-3 right-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1.5 shadow-lg ring-2 ring-white/50 animate-pulse z-10">
                  {salesOrderAnalytics.newAndRevised.count}
                </span>
              )}
              {/* 3D-style Icon */}
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                🛍️
              </div>
              <div className={`text-base font-extrabold tracking-wide ${activeSection === 'orders' ? 'text-white' : 'text-slate-800'}`}>
                SALES
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'orders' ? 'text-cyan-100' : 'text-cyan-600'}`}>
                {data['TotalOrders'] || (data['SalesOrders.json'] || []).length || 0} Orders
              </div>
            </div>
          </button>

          {/* Logistics */}
          <button
            onClick={() => setActiveSection('logistics')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'logistics' 
                ? 'bg-gradient-to-br from-teal-500 via-emerald-600 to-green-700 text-white shadow-2xl shadow-teal-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              {/* 3D-style Icon */}
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                🚚
              </div>
              <div className={`text-base font-extrabold tracking-wide ${activeSection === 'logistics' ? 'text-white' : 'text-slate-800'}`}>
                LOGISTICS
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'logistics' ? 'text-teal-100' : 'text-teal-600'}`}>
                Smart Shipping
              </div>
            </div>
          </button>

          {/* AI Command */}
          <button
            onClick={() => setActiveSection('ai-command')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'ai-command'
                ? 'bg-gradient-to-br from-fuchsia-500 via-purple-600 to-violet-700 text-white shadow-2xl shadow-fuchsia-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              {/* 3D-style Icon */}
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                🤖
              </div>
              <div className={`text-base font-extrabold tracking-wide text-center ${activeSection === 'ai-command' ? 'text-white' : 'text-slate-800'}`}>
                AI<br/>COMMAND
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'ai-command' ? 'text-fuchsia-100' : 'text-fuchsia-600'}`}>
                Intelligence Center
              </div>
            </div>
          </button>
        </div>

        {/* BREADCRUMB NAVIGATION */}
        {activeSection !== 'dashboard' && (
          <div className="max-w-7xl mx-auto mb-4">
            <nav className="flex items-center text-sm">
              <button 
                onClick={() => setActiveSection('dashboard')}
                className="flex items-center text-slate-500 hover:text-blue-600 transition-colors"
              >
                <Home className="w-4 h-4 mr-1" />
                <span>Dashboard</span>
              </button>
              <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
              <span className="font-semibold text-slate-800">
                {activeSection === 'inventory' && 'Inventory & BOM'}
                {activeSection === 'manufacturing-orders' && 'Manufacturing Orders'}
                {activeSection === 'purchase-orders' && 'Purchase Orders'}
                {activeSection === 'orders' && 'Sales Orders'}
                {activeSection === 'logistics' && 'Logistics'}
                {activeSection === 'ai-command' && 'AI Command Center'}
                {activeSection === 'report-maker' && 'Report Maker'}
                {activeSection === 'email-assistant' && 'Email Assistant'}
                {activeSection === 'work-orders' && 'Work Orders'}
                {activeSection === 'so-entry' && 'Smart SO Entry'}
                {activeSection === 'intelligence' && 'AI Intelligence'}
              </span>
            </nav>
          </div>
        )}

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
          {activeSection === 'email-assistant' && currentUser && (
            <GmailCleanEmail
              currentUser={currentUser}
              setActiveSection={setActiveSection}
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
              {/* Enhanced Manufacturing Header */}
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="relative bg-gradient-to-r from-violet-100 via-purple-50 to-indigo-100 border-b border-violet-200/50 p-6 overflow-hidden">
                  {/* Decorative background elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-200/30 to-transparent rounded-full -translate-y-32 translate-x-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-200/30 to-transparent rounded-full translate-y-24 -translate-x-24"></div>
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30 ring-4 ring-white">
                          <Factory className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center border-3 border-white shadow-lg">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Manufacturing Operations</h2>
                        <p className="text-violet-700 text-sm mt-1 font-medium">Production planning and order management</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-5 py-2.5 bg-white/80 backdrop-blur-sm text-slate-700 rounded-xl font-semibold text-sm border border-slate-200 hover:bg-white hover:shadow-md transition-all flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                      <button className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-violet-500 hover:to-purple-500 transition-all flex items-center gap-2 shadow-lg shadow-violet-500/25">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Enhanced KPI Cards Row */}
                <div className="p-6 bg-gradient-to-b from-slate-50/50 to-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Total MOs */}
                    <div className="group bg-white rounded-2xl p-5 border border-violet-200 shadow-sm hover:shadow-xl hover:border-violet-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Factory className="w-6 h-6 text-violet-600" />
                        </div>
                        <span className="text-xs font-bold text-violet-700 bg-violet-100 px-3 py-1.5 rounded-lg">TOTAL</span>
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tight">{(data?.['ManufacturingOrderHeaders.json']?.length || 0).toLocaleString()}</div>
                      <div className="text-sm text-slate-600 font-medium mt-2">Manufacturing Orders</div>
                      <div className="mt-3 h-1 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full opacity-60"></div>
                    </div>

                    {/* Active Orders */}
                    <div className="group bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Activity className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">ACTIVE</span>
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tight">{(data?.['ManufacturingOrderHeaders.json']?.filter((mo: any) => mo.Status === 1).length || 0).toLocaleString()}</div>
                      <div className="text-sm text-slate-600 font-medium mt-2">In Production</div>
                      <div className="mt-3 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full opacity-60"></div>
                    </div>

                    {/* Planned Orders */}
                    <div className="group bg-white rounded-2xl p-5 border border-amber-200 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Calendar className="w-6 h-6 text-amber-600" />
                        </div>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg">PLANNED</span>
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tight">{(data?.['ManufacturingOrderHeaders.json']?.filter((mo: any) => mo.Status === 0).length || 0).toLocaleString()}</div>
                      <div className="text-sm text-slate-600 font-medium mt-2">Awaiting Release</div>
                      <div className="mt-3 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full opacity-60"></div>
                    </div>

                    {/* Components */}
                    <div className="group bg-white rounded-2xl p-5 border border-blue-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Package2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg">PARTS</span>
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tight">{(data?.['ManufacturingOrderDetails.json']?.length || 0).toLocaleString()}</div>
                      <div className="text-sm text-slate-600 font-medium mt-2">Total Components</div>
                      <div className="mt-3 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full opacity-60"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manufacturing Orders Table */}
              {data?.['ManufacturingOrderHeaders.json'] && Array.isArray(data['ManufacturingOrderHeaders.json']) && data['ManufacturingOrderHeaders.json'].length > 0 && (
              <div className="bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-violet-50 border-b border-slate-200">
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
                                getCustomerName(mo) === moCustomerFilter
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
                            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm bg-white shadow-sm"
                          />
                        </div>
                        <select
                          value={moSortField}
                          onChange={(e) => setMoSortField(e.target.value)}
                          className="px-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm bg-white shadow-sm"
                        >
                          <option value="Mfg. Order No.">Sort by MO Number</option>
                          <option value="Customer">Sort by Customer</option>
                          <option value="Order Date">Sort by Order Date</option>
                          <option value="Cumulative Cost">Sort by Total Cost</option>
                          <option value="Ordered">Sort by Quantity</option>
                        </select>
                        <button
                          onClick={() => setMoSortDirection(moSortDirection === 'asc' ? 'desc' : 'asc')}
                          className="px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 text-sm font-semibold shadow-md transition-all"
                        >
                          {moSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                      </div>

                        {/* Filter Controls */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status:</label>
                            <select
                              value={moStatusFilter}
                              onChange={(e) => setMoStatusFilter(e.target.value)}
                              className="px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm bg-white shadow-sm"
                            >
                              <option value="all">All Status</option>
                              <option value="0">Planned</option>
                              <option value="1">Released</option>
                              <option value="2">Started</option>
                              <option value="3">Finished</option>
                              <option value="4">Closed</option>
                            </select>
                  </div>

                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer:</label>
                            <select
                              value={moCustomerFilter}
                              onChange={(e) => setMoCustomerFilter(e.target.value)}
                              className="px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm min-w-[150px] bg-white shadow-sm"
                            >
                              <option value="all">All Customers</option>
                              {(() => {
                                const uniqueCustomers = Array.from(new Set(
                                  (data['ManufacturingOrderHeaders.json'] || [])
                                    .map((mo: any) => getCustomerName(mo))
                                    .filter((name: string) => name && name !== 'Internal')
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
                            className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-semibold transition-all border border-slate-200"
                          >
                            Clear Filters
                          </button>
                        </div>
                      </div>
                  </div>
                  <div className="overflow-x-auto max-h-[700px]">
                      <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-slate-50 via-violet-50 to-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                            {/* PRIMARY COLUMNS */}
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[100px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Mfg. Order No.', 'mo')}>
                              MO # {moSortField === 'Mfg. Order No.' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[150px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Customer', 'mo')}>
                              Customer {moSortField === 'Customer' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[100px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Build Item No.', 'mo')}>
                              Build Item {moSortField === 'Build Item No.' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[200px]">Description</th>
                            
                            {/* QUANTITY & STATUS */}
                            <th className="text-right p-3 font-semibold text-slate-700 min-w-[80px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Ordered', 'mo')}>
                              Ordered {moSortField === 'Ordered' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-right p-3 font-semibold text-slate-700 min-w-[80px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Completed', 'mo')}>
                              Done {moSortField === 'Completed' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-center p-3 font-semibold text-slate-700 min-w-[80px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Status', 'mo')}>
                              Status {moSortField === 'Status' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            
                            {/* DATES */}
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[90px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Order Date', 'mo')}>
                              Order Date {moSortField === 'Order Date' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[90px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Release Date', 'mo')}>
                              Start {moSortField === 'Release Date' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[90px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Completion Date', 'mo')}>
                              Complete {moSortField === 'Completion Date' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            
                            {/* LOCATION & COST */}
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-[80px]">Location</th>
                            <th className="text-right p-3 font-semibold text-slate-700 min-w-[100px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Projected Material Cost', 'mo')}>
                              Unit Cost {moSortField === 'Projected Material Cost' && (moSortDirection === 'desc' ? '↓' : '↑')}
                            </th>
                            <th className="text-right p-3 font-semibold text-slate-700 min-w-[120px] cursor-pointer hover:bg-violet-100/50 transition-colors"
                                onClick={() => handleSort('Cumulative Cost', 'mo')}>
                              Total {moSortField === 'Cumulative Cost' && (moSortDirection === 'desc' ? '↓' : '↑')}
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
                                getCustomerName(mo) === moCustomerFilter
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
                            
                            // Get customer name - always from MO or SO
                            const customerName = getCustomerName(mo);
                            
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
                                  {customerName}
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
                                  {(mo['Completed'] || 0).toLocaleString()}
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
                          getCustomerName(mo) === moCustomerFilter
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

              {/* Production Schedule Section - v2 */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center">
                    📅 Production Schedule
                    <span className="ml-3 text-sm font-normal text-slate-600 bg-green-200 px-3 py-1 rounded-full">
                      Released MO Orders Timeline
                    </span>
                  </h3>
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
                                .filter((mo: any) => mo['Released By'] && getCustomerName(mo) !== 'Internal')
                                .map((mo: any) => getCustomerName(mo))
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
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden border-0 relative">
                {/* Decorative gradient overlay */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"></div>
                <div className="overflow-y-auto max-h-[95vh]">
                {/* Ultra Modern MO Header */}
                <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 text-white px-8 py-6 border-b-4 border-purple-800/50 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg">
                        <Factory className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-extrabold tracking-tight drop-shadow-lg">Manufacturing Order Details</h3>
                        <p className="text-purple-100 text-base mt-1.5 font-medium">
                          MO #{selectedMO['Mfg. Order No.']} - {selectedMO['Build Item No.']}
                          {selectedMO['Description'] && (
                            <span className="ml-3 text-purple-200">• {selectedMO['Description']}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMODetails(false)}
                      className="text-white/90 hover:text-white hover:bg-white/20 rounded-xl p-3 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110"
                      aria-label="Close"
                    >
                      <X className="w-7 h-7" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white">
                  {/* Modern Tabs */}
                  <div className="flex space-x-2 mb-4 border-b border-gray-200">
                    <button
                      onClick={() => setMoActiveTab('overview')}
                      className={`px-5 py-3 text-sm font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 ${
                        moActiveTab === 'overview' 
                          ? 'border-purple-600 text-purple-600 bg-purple-50/50' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4" />
                      MO Overview
                    </button>
                    <button
                      onClick={() => setMoActiveTab('details')}
                      className={`px-5 py-3 text-sm font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 ${
                        moActiveTab === 'details' 
                          ? 'border-purple-600 text-purple-600 bg-purple-50/50' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                      Components & Materials
                    </button>
                    <button
                      onClick={() => setMoActiveTab('routings')}
                      className={`px-5 py-3 text-sm font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 ${
                        moActiveTab === 'routings' 
                          ? 'border-purple-600 text-purple-600 bg-purple-50/50' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Cog className="w-4 h-4" />
                      Operations & Routing
                    </button>
                    <button
                      onClick={() => setMoActiveTab('pegged')}
                      className={`px-5 py-3 text-sm font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 ${
                        moActiveTab === 'pegged' 
                          ? 'border-purple-600 text-purple-600 bg-purple-50/50' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Link2 className="w-4 h-4" />
                      Sales Order Related
                    </button>
                  </div>

                  {/* MO Overview Tab */}
                  {moActiveTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Related Information - Sales Order, Job, Work Order */}
                      {(() => {
                        const salesOrderNo = selectedMO['Sales Order No.'];
                        const jobNo = selectedMO['Job No.'];
                        const relatedSO = salesOrderNo ? (data['SalesOrders.json'] || []).find((so: any) => 
                          so['Sales Order No.'] === salesOrderNo || so['Order No.'] === salesOrderNo
                        ) : null;
                        const relatedJob = jobNo ? (data['Jobs.json'] || []).find((job: any) => 
                          job['Job No.'] === jobNo
                        ) : null;
                        const relatedWorkOrders = jobNo ? (data['WorkOrders.json'] || []).filter((wo: any) => 
                          wo['Job No.'] === jobNo
                        ) : [];

                        if (relatedSO || relatedJob || relatedWorkOrders.length > 0) {
                          return (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 mb-3 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <Link2 className="w-4 h-4 text-blue-600" />
                                <h4 className="font-semibold text-sm text-blue-900">Related Information</h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                {relatedSO && (
                                  <div className="bg-white rounded-lg p-2.5 border border-blue-200 shadow-sm">
                                    <div className="flex items-center gap-1.5 font-medium text-blue-900 mb-1 text-xs">
                                      <FileText className="w-3 h-3" />
                                      Sales Order
                                    </div>
                                    <div className="text-blue-700 font-semibold text-sm">SO #{relatedSO['Sales Order No.'] || relatedSO['Order No.']}</div>
                                    <div className="text-gray-600 text-xs mt-0.5">
                                      {relatedSO['Customer'] || relatedSO['Customer Name'] || '—'}
                                    </div>
                                  </div>
                                )}
                                {relatedJob && (
                                  <div className="bg-white rounded-lg p-2.5 border border-indigo-200 shadow-sm">
                                    <div className="flex items-center gap-1.5 font-medium text-indigo-900 mb-1 text-xs">
                                      <Briefcase className="w-3 h-3" />
                                      Job
                                    </div>
                                    <div className="text-indigo-700 font-semibold text-sm">Job #{relatedJob['Job No.']}</div>
                                    <div className="text-gray-600 text-xs mt-0.5">
                                      {relatedJob['Status'] || '—'}
                                    </div>
                                  </div>
                                )}
                                {relatedWorkOrders.length > 0 && (
                                  <div className="bg-white rounded-lg p-2.5 border border-purple-200 shadow-sm">
                                    <div className="flex items-center gap-1.5 font-medium text-purple-900 mb-1 text-xs">
                                      <Cog className="w-3 h-3" />
                                      Work Orders
                                    </div>
                                    <div className="text-purple-700 font-semibold text-sm">{relatedWorkOrders.length} Work Order(s)</div>
                                    <div className="text-gray-600 text-xs mt-0.5">
                                      {relatedWorkOrders.map((wo: any) => wo['Work Order No.']).join(', ')}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Header Information - Compact Modern Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Status & Progress Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-purple-50/30 border-2 border-purple-200/50 rounded-xl p-4 shadow-lg">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/20 rounded-full -mr-12 -mt-12"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-purple-100 rounded-lg">
                                <BarChartIcon className="w-4 h-4 text-purple-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Status & Progress</h4>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-purple-100">
                                <span className="text-xs font-semibold text-gray-700">Status:</span>
                                <span className={`px-2 py-1 text-xs font-bold rounded-lg shadow-sm ${
                                  selectedMO['Status'] === 1 ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                                  selectedMO['Status'] === 0 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white' :
                                  selectedMO['Status'] === 2 ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                                  selectedMO['Status'] === 3 ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                                  'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                                }`}>
                                  {selectedMO['Status'] === 1 ? 'Released' :
                                   selectedMO['Status'] === 0 ? 'Planned' :
                                   selectedMO['Status'] === 2 ? 'Started' :
                                   selectedMO['Status'] === 3 ? 'Finished' : 'Unknown'}
                                </span>
                              </div>
                              {selectedMO['On Hold'] && (
                                <div className="flex items-center justify-between bg-red-50 rounded-lg p-2 border border-red-200">
                                  <span className="text-xs font-semibold text-red-700">On Hold:</span>
                                  <span className="px-2 py-1 text-xs font-bold rounded-lg bg-red-500 text-white shadow-sm">
                                    Yes
                                  </span>
                                </div>
                              )}
                              {(() => {
                                const orderedQty = parseFloat(selectedMO['Ordered'] || 0);
                                const completedQty = parseFloat(selectedMO['Completed'] || 0);
                                const wipQty = parseFloat(selectedMO['WIP'] || 0);
                                const issuedQty = parseFloat(selectedMO['Issued'] || 0);
                                const progressPercentage = orderedQty > 0 
                                  ? Math.round((completedQty / orderedQty) * 100) 
                                  : 0;
                                return (
                                  <div className="space-y-2">
                                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2.5 border border-purple-100">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-semibold text-gray-700">Progress:</span>
                                        <span className="text-sm font-bold text-purple-600">{progressPercentage}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                                        <div 
                                          className={`h-2.5 rounded-full transition-all duration-700 shadow-md ${
                                            progressPercentage >= 100 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                            progressPercentage >= 50 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                            progressPercentage > 0 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                                            'bg-gray-300'
                                          }`}
                                          style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                                        ></div>
                                      </div>
                                      <div className="mt-1 text-xs text-gray-500 flex justify-between">
                                        <span>C: {completedQty.toLocaleString()}</span>
                                        <span>O: {orderedQty.toLocaleString()}</span>
                                      </div>
                                    </div>
                                    {(wipQty > 0 || issuedQty > 0) && (
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {wipQty > 0 && (
                                          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-1.5 border border-blue-100">
                                            <div className="text-xs text-gray-600">WIP</div>
                                            <div className="text-xs font-bold text-blue-600">{wipQty.toLocaleString()}</div>
                                          </div>
                                        )}
                                        {issuedQty > 0 && (
                                          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-1.5 border border-orange-100">
                                            <div className="text-xs text-gray-600">Issued</div>
                                            <div className="text-xs font-bold text-orange-600">{issuedQty.toLocaleString()}</div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Quantities Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50/30 border-2 border-blue-200/50 rounded-xl p-4 shadow-lg">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200/20 rounded-full -mr-12 -mt-12"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-blue-100 rounded-lg">
                                <Package className="w-4 h-4 text-blue-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Quantities</h4>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100">
                                <span className="text-xs font-semibold text-gray-700">Ordered:</span>
                                <span className="font-bold text-sm text-gray-900">{selectedMO['Ordered']?.toLocaleString() || '0'}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100">
                                <span className="text-xs font-semibold text-gray-700">Release Qty:</span>
                                <span className="font-bold text-sm text-blue-600">
                                  {(() => {
                                    const releaseQty = selectedMO['Release Order Quantity'];
                                    if (releaseQty != null && releaseQty !== undefined) {
                                      return releaseQty.toLocaleString();
                                    }
                                    return (selectedMO['Ordered']?.toLocaleString() || '0');
                                  })()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-green-100">
                                <span className="text-xs font-semibold text-gray-700">Completed:</span>
                                <span className="font-bold text-sm text-green-600">{selectedMO['Completed']?.toLocaleString() || '0'}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-purple-100">
                                <span className="text-xs font-semibold text-gray-700">Allocated:</span>
                                <span className="font-bold text-sm text-purple-600">{selectedMO['Allocated']?.toLocaleString() || '0'}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-orange-100">
                                <span className="text-xs font-semibold text-gray-700">Reserved:</span>
                                <span className="font-bold text-sm text-orange-600">{selectedMO['Reserved']?.toLocaleString() || '0'}</span>
                              </div>
                              <div className="flex justify-between items-center bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg p-2.5 border-2 border-blue-300 mt-2">
                                <span className="text-xs font-bold text-blue-900">Remaining:</span>
                                <span className="font-bold text-base text-blue-700">
                                  {((selectedMO['Ordered'] || 0) - (selectedMO['Completed'] || 0)).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Costs Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-50/30 border-2 border-green-200/50 rounded-xl p-4 shadow-lg">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-green-200/20 rounded-full -mr-12 -mt-12"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-green-100 rounded-lg">
                                <DollarSign className="w-4 h-4 text-green-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Costs</h4>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                <span className="text-xs font-semibold text-gray-700">Proj Material:</span>
                                <span className="font-bold text-xs text-gray-900">
                                  ${(parseFloat(selectedMO['Projected Material Cost'] || 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-green-100">
                                <span className="text-xs font-semibold text-gray-700">Actual Material:</span>
                                <span className="font-bold text-sm text-green-600">
                                  ${(parseFloat(selectedMO['Actual Material Cost'] || selectedMO['Used Material Cost'] || 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                <span className="text-xs font-semibold text-gray-700">Proj Labor:</span>
                                <span className="font-bold text-xs text-gray-900">
                                  ${(parseFloat(selectedMO['Projected Labor Cost'] || 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-green-100">
                                <span className="text-xs font-semibold text-gray-700">Actual Labor:</span>
                                <span className="font-bold text-sm text-green-600">
                                  ${(parseFloat(selectedMO['Actual Labor Cost'] || selectedMO['Used Labor Cost'] || 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                <span className="text-xs font-semibold text-gray-700">Proj Overhead:</span>
                                <span className="font-bold text-xs text-gray-900">
                                  ${(parseFloat(selectedMO['Projected Overhead Cost'] || 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-green-100">
                                <span className="text-xs font-semibold text-gray-700">Actual Overhead:</span>
                                <span className="font-bold text-sm text-green-600">
                                  ${(parseFloat(selectedMO['Actual Overhead Cost'] || selectedMO['Used Overhead Cost'] || 0)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-gradient-to-r from-green-100 to-green-50 rounded-lg p-2.5 border-2 border-green-300 mt-2">
                                <span className="text-xs font-bold text-green-900">Total:</span>
                                <span className="font-bold text-base text-green-700">
                                  ${(parseFloat(selectedMO['Cumulative Cost'] || selectedMO['Total Material Cost'] || 0)).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dates & Timeline - Compact Card */}
                      <div className="bg-gradient-to-br from-white to-indigo-50/30 border-2 border-indigo-200/50 rounded-xl p-4 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-indigo-100 rounded-lg">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                          </div>
                          <h4 className="font-bold text-sm text-slate-900">Dates & Timeline</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {selectedMO['Order Date'] && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                              <div className="text-xs text-gray-500 mb-0.5">Order Date</div>
                              <div className="font-semibold text-xs text-gray-900">{selectedMO['Order Date']}</div>
                            </div>
                          )}
                          {selectedMO['Release Date'] && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-blue-200">
                              <div className="text-xs text-blue-600 mb-1">Release Date</div>
                              <div className="font-semibold text-blue-700">{selectedMO['Release Date']}</div>
                            </div>
                          )}
                          {selectedMO['Start Date'] && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-green-200">
                              <div className="text-xs text-green-600 mb-1">Start Date</div>
                              <div className="font-semibold text-green-700">{selectedMO['Start Date']}</div>
                            </div>
                          )}
                          {selectedMO['Completion Date'] && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-purple-200">
                              <div className="text-xs text-purple-600 mb-1">Completion Date</div>
                              <div className="font-semibold text-purple-700">{selectedMO['Completion Date']}</div>
                            </div>
                          )}
                          {selectedMO['Close Date'] && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-gray-200">
                              <div className="text-xs text-gray-600 mb-1">Close Date</div>
                              <div className="font-semibold text-gray-700">{selectedMO['Close Date']}</div>
                            </div>
                          )}
                          {selectedMO['Last Maintained'] && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-gray-200">
                              <div className="text-xs text-gray-600 mb-1">Last Maintained</div>
                              <div className="font-semibold text-gray-700">{selectedMO['Last Maintained']}</div>
                            </div>
                          )}
                          {selectedMO['Sales Order Ship Date'] && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-orange-200">
                              <div className="text-xs text-orange-600 mb-1">SO Ship Date</div>
                              <div className="font-semibold text-orange-700">{selectedMO['Sales Order Ship Date']}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Customer & Sales Information - Compact Card */}
                      {(selectedMO['Customer'] || selectedMO['Sales Order No.'] || selectedMO['Sales Item No.'] || selectedMO['Priority'] || selectedMO['Operation Count']) && (
                        <div className="bg-gradient-to-br from-white to-blue-50/30 border-2 border-blue-200/50 rounded-xl p-4 shadow-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-blue-100 rounded-lg">
                              <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <h4 className="font-bold text-sm text-slate-900">Customer & Sales Info</h4>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {selectedMO['Customer'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100">
                                <div className="text-xs text-gray-500 mb-0.5">Customer</div>
                                <div className="font-semibold text-xs text-gray-900">{selectedMO['Customer']}</div>
                              </div>
                            )}
                            {selectedMO['Sales Order No.'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-blue-200">
                                <div className="text-xs text-blue-600 mb-1">Sales Order</div>
                                <div className="font-semibold text-blue-700">#{selectedMO['Sales Order No.']}</div>
                              </div>
                            )}
                            {selectedMO['Sales Order Detail No.'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">SO Detail</div>
                                <div className="font-semibold text-gray-900">{selectedMO['Sales Order Detail No.']}</div>
                              </div>
                            )}
                            {selectedMO['Sales Item No.'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">Sales Item</div>
                                <div className="font-semibold text-gray-900">{selectedMO['Sales Item No.']}</div>
                              </div>
                            )}
                            {selectedMO['Sales Location'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">Sales Location</div>
                                <div className="font-semibold text-gray-900">{selectedMO['Sales Location']}</div>
                              </div>
                            )}
                            {selectedMO['Sales Transfer Quantity'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">Transfer Qty</div>
                                <div className="font-semibold text-gray-900">{selectedMO['Sales Transfer Quantity']?.toLocaleString()}</div>
                              </div>
                            )}
                            {selectedMO['Priority'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-orange-200">
                                <div className="text-xs text-orange-600 mb-1">Priority</div>
                                <div className="font-semibold text-orange-700">{selectedMO['Priority']}</div>
                              </div>
                            )}
                            {selectedMO['Operation Count'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-purple-200">
                                <div className="text-xs text-purple-600 mb-1">Operations</div>
                                <div className="font-semibold text-purple-700">{selectedMO['Operation Count']}</div>
                              </div>
                            )}
                            {selectedMO['Work Order Reference Count'] && (
                              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-indigo-200">
                                <div className="text-xs text-indigo-600 mb-1">Work Orders</div>
                                <div className="font-semibold text-indigo-700">{selectedMO['Work Order Reference Count']}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* R/E Fields Section */}
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <FileText className="w-5 h-5 text-gray-600" />
                          <h4 className="font-semibold text-slate-900">Manufacturing Order Fields (R/E)</h4>
                        </div>
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
                      {/* BOM Information Section */}
                      {(() => {
                        const buildItemNo = selectedMO['Build Item No.'];
                        const bomHeaders = (data['BillsOfMaterial.json'] || []).filter((bom: any) => 
                          bom['Item No.'] === buildItemNo
                        );
                        const bomDetails = (data['BillOfMaterialDetails.json'] || []).filter((bom: any) => 
                          bom['Parent Item No.'] === buildItemNo
                        );

                        if (bomHeaders.length > 0 || bomDetails.length > 0) {
                          return (
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 mb-6 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <ClipboardList className="w-5 h-5 text-indigo-600" />
                                <h4 className="font-semibold text-indigo-900">Bill of Materials (BOM) Information</h4>
                                <span className="ml-auto text-xs font-normal text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                                  Build Item: {buildItemNo}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                {bomHeaders[0] && (
                                  <>
                                    <div>
                                      <span className="text-indigo-700 font-medium">Revision:</span>
                                      <span className="ml-2 text-indigo-900">{bomHeaders[0]['Revision No.'] || '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-indigo-700 font-medium">Build Qty:</span>
                                      <span className="ml-2 text-indigo-900">{bomHeaders[0]['Build Quantity']?.toLocaleString() || '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-indigo-700 font-medium">Components:</span>
                                      <span className="ml-2 text-indigo-900">{bomDetails.length}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {(() => {
                        // Get MO Details from real data
                        const allMoDetails = (data['ManufacturingOrderDetails.json'] || []).filter((detail: any) => 
                          detail['Mfg. Order No.'] === selectedMO['Mfg. Order No.']
                        );

                        // Get inventory items for stock lookup
                        const inventoryItems = data['CustomAlert5.json'] || [];

                        console.log('🔧 MO Details for', selectedMO['Mfg. Order No.'], ':', allMoDetails);

                        if (allMoDetails.length === 0) {
                          return (
                            <div className="text-center py-12 text-gray-500">
                              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                              <div className="font-medium text-lg mb-1">No component details found</div>
                              <div className="text-sm">This MO may not have detailed component breakdown in the system</div>
                            </div>
                          );
                        }

                        // DEDUPLICATE: Group by Component Item No. and sum quantities using plain object
                        const componentMap: Record<string, any> = {};
                        
                        allMoDetails.forEach((detail: any) => {
                          const componentItemNo = detail['Component Item No.'] || detail['Item No.'] || '';
                          if (!componentItemNo) return;

                          if (componentMap[componentItemNo]) {
                            // Sum quantities for duplicate components
                            const existing = componentMap[componentItemNo];
                            existing.requiredQty += parseFloat(detail['Required Qty.'] || detail['Required Qty'] || detail['Quantity'] || 0);
                            existing.issuedQty += parseFloat(detail['Released Qty.'] || detail['Issued Qty'] || detail['Issued'] || 0);
                            existing.materialCost += parseFloat(detail['Material Cost'] || detail['Unit Cost'] || detail['Cost'] || 0);
                            existing.totalCost += (parseFloat(detail['Required Qty.'] || detail['Required Qty'] || detail['Quantity'] || 0) * 
                                                  parseFloat(detail['Material Cost'] || detail['Unit Cost'] || detail['Cost'] || 0));
                            // Keep the first location found, or combine if needed
                            if (!existing.sourceLocation && detail['Source Location']) {
                              existing.sourceLocation = detail['Source Location'];
                            } else if (detail['Source Location'] && existing.sourceLocation !== detail['Source Location']) {
                              existing.sourceLocation = `${existing.sourceLocation}, ${detail['Source Location']}`;
                            }
                            // Keep description from first entry
                            if (!existing.description) {
                              existing.description = detail['Non-stocked Item Description'] || detail['Description'] || detail['Item Description'] || '';
                            }
                          } else {
                            // First occurrence of this component
                            const requiredQty = parseFloat(detail['Required Qty.'] || detail['Required Qty'] || detail['Quantity'] || 0);
                            const issuedQty = parseFloat(detail['Released Qty.'] || detail['Issued Qty'] || detail['Issued'] || 0);
                            const unitCost = parseFloat(detail['Material Cost'] || detail['Unit Cost'] || detail['Cost'] || 0);
                            
                            componentMap[componentItemNo] = {
                              componentItemNo,
                              description: detail['Non-stocked Item Description'] || detail['Description'] || detail['Item Description'] || '',
                              requiredQty,
                              issuedQty,
                              materialCost: unitCost,
                              totalCost: requiredQty * unitCost,
                              sourceLocation: detail['Source Location'] || detail['Location'] || detail['Location No.'] || '',
                              detail // Keep reference to original detail for other fields
                            };
                          }
                        });

                        // Convert object to array for display
                        const moDetails = Object.values(componentMap);

                        return (
                          <>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Wrench className="w-5 h-5 text-blue-600" />
                                    <h4 className="font-semibold text-blue-900">Manufacturing Order Components</h4>
                                  </div>
                                  <p className="text-sm text-blue-700">
                                    Materials and components required for MO #{selectedMO['Mfg. Order No.']}
                                    {allMoDetails.length > moDetails.length && (
                                      <span className="ml-2 text-blue-600">
                                        ({allMoDetails.length} entries consolidated into {moDetails.length} unique components)
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
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
                                    <th className="text-right p-3 font-medium text-gray-700">Available Stock</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Shortage</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Unit Cost</th>
                                    <th className="text-right p-3 font-medium text-gray-700">Total Cost</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Location</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {moDetails.map((detail: any, index: number) => {
                                    const componentItemNo = detail.componentItemNo;
                                    const requiredQty = detail.requiredQty;
                                    const issuedQty = detail.issuedQty;
                                    const unitCost = detail.requiredQty > 0 ? detail.totalCost / detail.requiredQty : detail.materialCost;
                                    const remainingQty = requiredQty - issuedQty;
                                    const totalCost = detail.totalCost;

                                    // Find inventory item for stock levels
                                    const inventoryItem = inventoryItems.find((item: any) => 
                                      item['Item No.'] === componentItemNo
                                    );
                                    const availableStock = parseFloat(inventoryItem?.['Available'] || inventoryItem?.['On Hand'] || inventoryItem?.['Stock'] || 0);
                                    const shortage = Math.max(0, remainingQty - availableStock);
                                    const hasShortage = shortage > 0;
                                    const stockStatus = availableStock >= remainingQty ? 'sufficient' : 
                                                      availableStock > 0 ? 'low' : 'out';

                                    // Get description from inventory if not in detail
                                    const description = detail.description || inventoryItem?.['Description'] || '—';

                                    return (
                                      <tr key={index} className={`border-b border-gray-100 hover:bg-blue-50 ${
                                        hasShortage ? 'bg-red-50' : ''
                                      }`}>
                                        <td className="p-3 font-mono text-blue-600 font-medium">
                                          {componentItemNo || '—'}
                                        </td>
                                        <td className="p-3 text-gray-700">
                                          {description}
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
                                        <td className={`p-3 text-right font-medium ${
                                          stockStatus === 'sufficient' ? 'text-green-600' :
                                          stockStatus === 'low' ? 'text-yellow-600' :
                                          'text-red-600'
                                        }`}>
                                          {availableStock > 0 ? availableStock.toLocaleString() : '0'}
                                        </td>
                                        <td className={`p-3 text-right font-medium font-bold ${
                                          hasShortage ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                          {hasShortage ? `-${shortage.toLocaleString()}` : '✓'}
                                        </td>
                                        <td className="p-3 text-right font-mono">
                                          {unitCost > 0 ? `$${unitCost.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-green-600">
                                          {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="p-3 text-gray-600">
                                          {detail.sourceLocation || '—'}
                                        </td>
                                        <td className="p-3">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            stockStatus === 'sufficient' ? 'bg-green-100 text-green-700' :
                                            stockStatus === 'low' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {stockStatus === 'sufficient' ? '✓ In Stock' :
                                             stockStatus === 'low' ? '⚠ Low Stock' :
                                             '✗ Out of Stock'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* Enhanced Summary */}
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3">
                                {(() => {
                                  const totalComponents = moDetails.length;
                                  const totalRequiredQty = moDetails.reduce((sum: number, detail: any) => 
                                    sum + detail.requiredQty, 0);
                                  const totalIssuedQty = moDetails.reduce((sum: number, detail: any) => 
                                    sum + detail.issuedQty, 0);
                                  const totalCost = moDetails.reduce((sum: number, detail: any) => 
                                    sum + detail.totalCost, 0);

                                  // Calculate stock shortages
                                  const componentsWithShortage = moDetails.filter((detail: any) => {
                                    const componentItemNo = detail.componentItemNo;
                                    const remainingQty = detail.requiredQty - detail.issuedQty;
                                    const inventoryItem = inventoryItems.find((item: any) => item['Item No.'] === componentItemNo);
                                    const availableStock = parseFloat(inventoryItem?.['Available'] || inventoryItem?.['On Hand'] || 0);
                                    return remainingQty > availableStock;
                                  }).length;

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
                                      <div className="text-center">
                                        <div className={`font-semibold ${componentsWithShortage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {componentsWithShortage}
                                        </div>
                                        <div className="text-gray-600">Stock Shortages</div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* MO Operations & Routing Tab */}
                  {moActiveTab === 'routings' && (
                    <div className="space-y-6">
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Cog className="w-5 h-5 text-purple-600" />
                          <h4 className="font-semibold text-purple-900">Manufacturing Operations & Routing</h4>
                        </div>
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
                            <div className="text-center py-12 text-gray-500">
                              <Cog className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                              <div className="font-medium text-lg mb-1">No routing operations found</div>
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

                  {/* Sales Order Related Tab */}
                  {moActiveTab === 'pegged' && (
                    <div className="space-y-6">
                      {(() => {
                        // Extract SO number from multiple sources
                        const directSONo = selectedMO['Sales Order No.'] || selectedMO['SalesOrderNo'] || selectedMO['SO No.'];
                        const description = selectedMO['Description'] || '';
                        const moNo = selectedMO['Mfg. Order No.'] || '';
                        
                        // Try to extract SO number from description with multiple patterns
                        // Patterns: "SO 3130", "SO3130", "SO#3130", "Sales Order 3130", "S.O. 3130", "for SO 3130", etc.
                        let soFromDesc: string | null = null;
                        const patterns = [
                          /\bSO\s*#?\s*(\d{3,5})\b/i,           // SO 3130, SO#3130, SO3130
                          /\bS\.?O\.?\s*#?\s*(\d{3,5})\b/i,     // S.O. 3130, S.O.3130
                          /Sales\s*Order\s*#?\s*(\d{3,5})/i,    // Sales Order 3130
                          /for\s+SO\s*#?\s*(\d{3,5})/i,         // for SO 3130
                          /,\s*SO\s*(\d{3,5})/i,                // , SO 3130
                          /\(SO\s*(\d{3,5})\)/i,                // (SO 3130)
                          /SO:\s*(\d{3,5})/i,                   // SO: 3130
                          /#(\d{4,5})\b/,                       // #3130 (4-5 digit numbers)
                        ];
                        
                        for (const pattern of patterns) {
                          const match = description.match(pattern);
                          if (match) {
                            soFromDesc = match[1];
                            break;
                          }
                        }
                        
                        // Validate direct SO number - should be clean numeric or simple format
                        // If it contains pipes, slashes, or other separators, it's likely corrupted/combined data
                        const isDirectSOValid = directSONo && 
                          /^\d{3,6}$/.test(String(directSONo).trim()) && // Pure numeric 3-6 digits
                          !String(directSONo).includes('|') && 
                          !String(directSONo).includes('/');
                        
                        // Use validated direct SO first, then extracted from description
                        // If direct SO looks corrupted (contains | or /), prefer the description-extracted one
                        const soNumber = isDirectSOValid ? directSONo : (soFromDesc || (directSONo ? String(directSONo).split(/[|\/]/)[0].trim() : null));
                        
                        // Find the related SO in the data
                        const salesOrdersData = data['SalesOrders.json'] || data['SalesOrderHeaders.json'] || [];
                        const salesOrdersByStatus = data['SalesOrdersByStatus'] || {};
                        
                        // Combine all SOs from different sources
                        let allSOs: any[] = [...salesOrdersData];
                        Object.values(salesOrdersByStatus).forEach((statusSOs: any) => {
                          if (Array.isArray(statusSOs)) {
                            allSOs = [...allSOs, ...statusSOs];
                          }
                        });
                        
                        // Find matching SO
                        const relatedSO = soNumber ? allSOs.find((so: any) => {
                          const soNum = so['Sales Order No.'] || so['Order No.'] || so['so_number'] || so['SalesOrderNo'];
                          // Extract just the number for comparison
                          const soNumStr = String(soNum || '').replace(/\D/g, '');
                          const searchNum = String(soNumber).replace(/\D/g, '');
                          return soNumStr === searchNum || soNum === soNumber;
                        }) : null;
                        
                        // Also find SO file from folder data if available
                        const soFile = soNumber ? allSOs.find((so: any) => {
                          const fileName = so.name || so.file_name || '';
                          return fileName.toLowerCase().includes(`salesorder_${soNumber}`) ||
                                 fileName.toLowerCase().includes(`salesorder${soNumber}`);
                        }) : null;

                        return (
                          <>
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 shadow-lg">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                  <Link2 className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-lg">Sales Order Related</h4>
                                  <p className="text-blue-100 text-sm">
                                    Sales Order linked to this Manufacturing Order
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* SO Detection Info */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                              <div className="text-sm text-slate-600 mb-3 font-medium">SO Detection Sources:</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${isDirectSOValid ? 'bg-green-500' : directSONo ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                                  <span className="text-slate-600">Direct SO Field:</span>
                                  <span className={`font-medium ${isDirectSOValid ? 'text-green-700' : directSONo ? 'text-amber-600 line-through' : 'text-slate-400'}`}>
                                    {directSONo || 'Not set'}
                                  </span>
                                  {directSONo && !isDirectSOValid && (
                                    <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">invalid format</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${soFromDesc ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                  <span className="text-slate-600">From Description:</span>
                                  <span className={`font-medium ${soFromDesc ? 'text-green-700' : 'text-slate-400'}`}>
                                    {soFromDesc ? `SO ${soFromDesc}` : 'Not found'}
                                  </span>
                                  {soFromDesc && !isDirectSOValid && (
                                    <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">✓ using this</span>
                                  )}
                                </div>
                              </div>
                              {description && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <div className="text-xs text-slate-500 mb-1">MO Description:</div>
                                  <div className="text-sm text-slate-700 font-mono bg-white px-3 py-2 rounded-lg border border-slate-200">
                                    {description}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Related SO Card */}
                            {soNumber ? (
                              <div className="bg-white border-2 border-blue-200 rounded-2xl overflow-hidden shadow-lg">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-blue-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                        <FileText className="w-6 h-6 text-white" />
                                      </div>
                                      <div>
                                        <div className="text-2xl font-bold text-blue-900">SO #{soNumber}</div>
                                        <div className="text-sm text-blue-600">
                                          {relatedSO?.['Customer'] || relatedSO?.['Customer Name'] || relatedSO?.customer_name || 'Customer info loading...'}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium border border-green-200">
                                        ✓ Linked
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="p-5">
                                  {relatedSO ? (
                                    <div className="space-y-4">
                                      {/* SO Details Grid */}
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Order Date</div>
                                          <div className="font-bold text-slate-900">
                                            {relatedSO['Order Date'] || relatedSO.order_date || '—'}
                                          </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Due Date</div>
                                          <div className="font-bold text-slate-900">
                                            {relatedSO['Due Date'] || relatedSO.due_date || '—'}
                                          </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</div>
                                          <div className="font-bold text-slate-900">
                                            {relatedSO['Status'] || relatedSO.status || 'Active'}
                                          </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total</div>
                                          <div className="font-bold text-slate-900">
                                            {relatedSO['Total'] || relatedSO.total ? `$${parseFloat(relatedSO['Total'] || relatedSO.total || 0).toFixed(2)}` : '—'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                                        <button
                                          onClick={() => {
                                            // Navigate to Sales Orders section and search for this SO
                                            setActiveSection('sales');
                                            setSoSearchQuery(soNumber);
                                          }}
                                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-medium"
                                        >
                                          <Eye className="w-4 h-4" />
                                          View in Sales Orders
                                        </button>
                                        {(soFile || relatedSO?.path || relatedSO?.gdrive_id) && (
                                          <button
                                            onClick={() => {
                                              const file = soFile || relatedSO;
                                              if (file?.gdrive_id) {
                                                window.open(getApiUrl(`/api/gdrive/preview/${file.gdrive_id}`), '_blank');
                                              } else if (file?.path) {
                                                window.open(getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(file.path)}`), '_blank');
                                              }
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all text-sm font-medium"
                                          >
                                            <FileText className="w-4 h-4" />
                                            View PDF
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      {/* Basic SO Info when detailed data not available */}
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-200">
                                          <div className="text-xs text-blue-600 uppercase tracking-wider mb-1">SO Number</div>
                                          <div className="font-bold text-blue-900 text-lg">#{soNumber}</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Source</div>
                                          <div className="font-bold text-slate-900">
                                            {directSONo ? 'Direct Field' : 'Description'}
                                          </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">MO Number</div>
                                          <div className="font-bold text-slate-900">{moNo || '—'}</div>
                                        </div>
                                        <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
                                          <div className="text-xs text-green-600 uppercase tracking-wider mb-1">Status</div>
                                          <div className="font-bold text-green-700">Linked ✓</div>
                                        </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                                        <button
                                          onClick={() => {
                                            setActiveSection('sales');
                                            setSoSearchQuery(soNumber);
                                          }}
                                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-medium"
                                        >
                                          <Eye className="w-4 h-4" />
                                          View in Sales Orders
                                        </button>
                                        <button
                                          onClick={() => {
                                            // Navigate to Sales Orders and try to find the PDF
                                            setActiveSection('sales');
                                            navigateToSOFolder('In Production');
                                          }}
                                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all text-sm font-medium"
                                        >
                                          <FileText className="w-4 h-4" />
                                          Find SO PDF
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                  <Search className="w-8 h-8 text-slate-400" />
                                </div>
                                <div className="font-semibold text-slate-700 text-lg mb-2">No Sales Order Linked</div>
                                <div className="text-sm text-slate-500 max-w-md mx-auto">
                                  This Manufacturing Order doesn't have a Sales Order number in its data or description.
                                  The MO may be for stock replenishment rather than a specific customer order.
                                </div>
                              </div>
                            )}

                            {/* Search for other SOs */}
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                              <div className="text-sm font-medium text-slate-700 mb-3">Search Other Sales Orders</div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="text"
                                  placeholder="Search SO Number, Customer, or Item..."
                                  value={soSearchQuery}
                                  onChange={(e) => setSoSearchQuery(e.target.value)}
                                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                                <button
                                  onClick={() => {
                                    setActiveSection('sales');
                                  }}
                                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-medium border border-slate-200"
                                >
                                  Go to Sales Orders
                                </button>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Purchase Order Details Modal */}
          {showPODetails && selectedPO && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden border-0 relative">
                {/* Decorative gradient overlay */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600"></div>
                <div className="overflow-y-auto max-h-[95vh]">
                {/* Ultra Modern PO Header */}
                <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700 text-white px-8 py-6 border-b-4 border-blue-800/50 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg">
                        <ShoppingBag className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-extrabold tracking-tight drop-shadow-lg">Purchase Order Details</h3>
                        <p className="text-blue-100 text-base mt-1.5 font-medium">
                          PO #{selectedPO['PO No.']} - {selectedPO['Supplier No.'] || selectedPO['Name'] || selectedPO['Vendor No.'] || 'Unknown Supplier'}
                          {selectedPO['Description'] && (
                            <span className="ml-3 text-blue-200">• {selectedPO['Description']}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPODetails(false)}
                      className="text-white/90 hover:text-white hover:bg-white/20 rounded-xl p-3 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110"
                      aria-label="Close"
                    >
                      <X className="w-7 h-7" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white">
                  {/* Modern Tabs */}
                  <div className="flex space-x-2 mb-4 border-b border-gray-200">
                    <button
                      onClick={() => setPoActiveTab('overview')}
                      className={`px-5 py-3 text-sm font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 ${
                        poActiveTab === 'overview' 
                          ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4" />
                      PO Overview
                    </button>
                    <button
                      onClick={() => setPoActiveTab('lineitems')}
                      className={`px-5 py-3 text-sm font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 ${
                        poActiveTab === 'lineitems' 
                          ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      Line Items
                    </button>
                    <button
                      onClick={() => setPoActiveTab('costs')}
                      className={`px-5 py-3 text-sm font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 ${
                        poActiveTab === 'costs' 
                          ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Additional Costs
                    </button>
                  </div>

                  {/* PO Overview Tab */}
                  {poActiveTab === 'overview' && (
                    <div className="space-y-3">
                      {/* Header Information - Compact Modern Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Status Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50/30 border-2 border-blue-200/50 rounded-xl p-4 shadow-lg">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200/20 rounded-full -mr-12 -mt-12"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-blue-100 rounded-lg">
                                <BarChartIcon className="w-4 h-4 text-blue-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Status</h4>
                            </div>
                            <div className="flex items-center justify-between bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100">
                              <span className="text-xs font-semibold text-gray-700">Status:</span>
                              <span className={`px-2 py-1 text-xs font-bold rounded-lg shadow-sm ${
                                selectedPO['Status'] === 0 ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                                selectedPO['Status'] === 1 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white' :
                                selectedPO['Status'] === 2 ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white' :
                                selectedPO['Status'] === 3 ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                                'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                              }`}>
                                {selectedPO['Status'] === 0 ? 'Open' :
                                 selectedPO['Status'] === 1 ? 'Pending' :
                                 selectedPO['Status'] === 2 ? 'Closed' :
                                 selectedPO['Status'] === 3 ? 'Cancelled' : 'Unknown'}
                              </span>
                            </div>
                            {selectedPO['Revision'] && (
                              <div className="mt-2 flex items-center justify-between bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                <span className="text-xs font-semibold text-gray-700">Revision:</span>
                                <span className="font-bold text-xs text-gray-900">{selectedPO['Revision']}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Financial Summary Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-50/30 border-2 border-green-200/50 rounded-xl p-4 shadow-lg">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-green-200/20 rounded-full -mr-12 -mt-12"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-green-100 rounded-lg">
                                <DollarSign className="w-4 h-4 text-green-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Financial Summary</h4>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                <span className="text-xs font-semibold text-gray-700">Total Amount:</span>
                                <span className="font-bold text-sm text-gray-900">${(parseFloat(selectedPO['Total Amount'] || selectedPO['Total'] || 0)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-orange-100">
                                <span className="text-xs font-semibold text-gray-700">Invoiced:</span>
                                <span className="font-bold text-sm text-orange-600">${(parseFloat(selectedPO['Invoiced Amount'] || selectedPO['Total Invoiced'] || 0)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100">
                                <span className="text-xs font-semibold text-gray-700">Received:</span>
                                <span className="font-bold text-sm text-blue-600">${(parseFloat(selectedPO['Received Amount'] || selectedPO['Total Received'] || 0)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center bg-gradient-to-r from-green-100 to-green-50 rounded-lg p-2.5 border-2 border-green-300 mt-2">
                                <span className="text-xs font-bold text-green-900">Remaining:</span>
                                <span className="font-bold text-base text-green-700">
                                  ${((parseFloat(selectedPO['Total Amount'] || selectedPO['Total'] || 0)) - (parseFloat(selectedPO['Invoiced Amount'] || selectedPO['Total Invoiced'] || 0))).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Dates & Terms Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 border-2 border-indigo-200/50 rounded-xl p-4 shadow-lg">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-200/20 rounded-full -mr-12 -mt-12"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-indigo-100 rounded-lg">
                                <Calendar className="w-4 h-4 text-indigo-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Dates & Terms</h4>
                            </div>
                            <div className="space-y-1.5">
                              {selectedPO['Order Date'] && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                  <span className="text-xs font-semibold text-gray-700">Order Date:</span>
                                  <span className="font-bold text-xs text-gray-900">{selectedPO['Order Date']}</span>
                                </div>
                              )}
                              {selectedPO['Terms'] && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                  <span className="text-xs font-semibold text-gray-700">Terms:</span>
                                  <span className="font-bold text-xs text-gray-900">{selectedPO['Terms']}</span>
                                </div>
                              )}
                              {(selectedPO['Source Currency'] || selectedPO['Home Currency']) && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                  <span className="text-xs font-semibold text-gray-700">Currency:</span>
                                  <span className="font-bold text-xs text-gray-900">{selectedPO['Source Currency'] || selectedPO['Home Currency']}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional PO Fields - Compact Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Vendor Information Card */}
                        {(selectedPO['Supplier No.'] || selectedPO['Name'] || selectedPO['Buyer'] || selectedPO['Contact']) && (
                          <div className="bg-gradient-to-br from-white to-blue-50/30 border-2 border-blue-200/50 rounded-xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-blue-100 rounded-lg">
                                <Users className="w-4 h-4 text-blue-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Vendor Information</h4>
                            </div>
                            <div className="space-y-1.5">
                              {(selectedPO['Supplier No.'] || selectedPO['Name']) && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-100">
                                  <span className="text-xs font-semibold text-gray-700">Supplier:</span>
                                  <span className="font-bold text-xs text-gray-900 font-mono">{selectedPO['Supplier No.'] || selectedPO['Name'] || selectedPO['Vendor No.']}</span>
                                </div>
                              )}
                              {selectedPO['Buyer'] && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                  <span className="text-xs font-semibold text-gray-700">Buyer:</span>
                                  <span className="font-bold text-xs text-gray-900">{selectedPO['Buyer']}</span>
                                </div>
                              )}
                              {selectedPO['Contact'] && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                  <span className="text-xs font-semibold text-gray-700">Contact:</span>
                                  <span className="font-bold text-xs text-gray-900">{selectedPO['Contact']}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Shipping Information Card */}
                        {(selectedPO['Ship Via'] || selectedPO['FOB'] || selectedPO['Freight']) && (
                          <div className="bg-gradient-to-br from-white to-purple-50/30 border-2 border-purple-200/50 rounded-xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-purple-100 rounded-lg">
                                <Truck className="w-4 h-4 text-purple-600" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900">Shipping Information</h4>
                            </div>
                            <div className="space-y-1.5">
                              {selectedPO['Ship Via'] && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-purple-100">
                                  <span className="text-xs font-semibold text-gray-700">Ship Via:</span>
                                  <span className="font-bold text-xs text-gray-900">{selectedPO['Ship Via']}</span>
                                </div>
                              )}
                              {selectedPO['FOB'] && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                  <span className="text-xs font-semibold text-gray-700">FOB:</span>
                                  <span className="font-bold text-xs text-gray-900">{selectedPO['FOB']}</span>
                                </div>
                              )}
                              {selectedPO['Freight'] && (
                                <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-gray-100">
                                  <span className="text-xs font-semibold text-gray-700">Freight:</span>
                                  <span className="font-bold text-xs text-gray-900">${(parseFloat(selectedPO['Freight'] || 0)).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
            </div>
          )}

          {/* Purchase Orders */}
          {activeSection === 'purchase-orders' && (
            <div className="space-y-6">
              {/* Enhanced Purchase Orders Header */}
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="relative bg-gradient-to-r from-blue-100 via-cyan-50 to-teal-100 border-b border-blue-200/50 p-6 overflow-hidden">
                  {/* Decorative background elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/30 to-transparent rounded-full -translate-y-32 translate-x-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-cyan-200/30 to-transparent rounded-full translate-y-24 -translate-x-24"></div>
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 ring-4 ring-white">
                          <ShoppingBag className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center border-3 border-white shadow-lg">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Purchase Orders</h2>
                        <p className="text-blue-700 text-sm mt-1 font-medium">Procurement and vendor management</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowPRModal(true)}
                        className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm hover:from-orange-400 hover:to-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/25"
                      >
                        📝 Purchase Requisitions
                      </button>
                      <button className="px-5 py-2.5 bg-white/80 backdrop-blur-sm text-slate-700 rounded-xl font-semibold text-sm border border-slate-200 hover:bg-white hover:shadow-md transition-all flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                      <button className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold text-sm hover:from-blue-500 hover:to-cyan-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25">
                        <Plus className="w-4 h-4" />
                        New PO
                      </button>
                    </div>
                  </div>
                </div>

                {/* Enhanced KPI Cards Row */}
                <div className="p-6 bg-gradient-to-b from-slate-50/50 to-white">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {/* Total POs */}
                    <div className="group bg-white rounded-2xl p-5 border border-blue-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ShoppingBag className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg">TOTAL</span>
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tight">{data?.['PurchaseOrders.json']?.length || 0}</div>
                      <div className="text-sm text-slate-600 font-medium mt-2">Purchase Orders</div>
                      <div className="mt-3 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full opacity-60"></div>
                    </div>

                    {/* Line Items */}
                    <div className="group bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Package2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">ITEMS</span>
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tight">{data?.['PurchaseOrderDetails.json']?.length || 0}</div>
                      <div className="text-sm text-slate-600 font-medium mt-2">PO Line Items</div>
                      <div className="mt-3 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full opacity-60"></div>
                    </div>

                    {/* Active Vendors */}
                    <div className="group bg-white rounded-2xl p-5 border border-purple-200 shadow-sm hover:shadow-xl hover:border-purple-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-violet-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg">VENDORS</span>
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tight">{new Set(data?.['PurchaseOrders.json']?.map((po: any) => po['Supplier No.'] || po['Name'] || po['Vendor No.']).filter(Boolean)).size || 0}</div>
                      <div className="text-sm text-slate-600 font-medium mt-2">Active Suppliers</div>
                      <div className="mt-3 h-1 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full opacity-60"></div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Purchase Orders Table */}
                {data?.['PurchaseOrders.json'] && Array.isArray(data['PurchaseOrders.json']) && data['PurchaseOrders.json'].length > 0 && (
                  <div className="bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
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
                            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white shadow-sm"
                          />
                        </div>
                        <select
                          value={poSortField}
                          onChange={(e) => setPoSortField(e.target.value)}
                          className="px-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white shadow-sm"
                        >
                          <option value="PO No.">Sort by PO Number</option>
                          <option value="Supplier No.">Sort by Supplier</option>
                          <option value="Order Date">Sort by Order Date</option>
                          <option value="Total Amount">Sort by Total Amount</option>
                          <option value="Status">Sort by Status</option>
                        </select>
                        <button
                          onClick={() => setPoSortDirection(poSortDirection === 'asc' ? 'desc' : 'asc')}
                          className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-500 hover:to-cyan-500 text-sm font-semibold shadow-md transition-all"
                        >
                          {poSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[700px]">
                      <table className="w-full text-sm">
                        <thead className="bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50 sticky top-0 border-b border-slate-200">
                          <tr>
                            {getAvailablePOColumns.map((col, index) => (
                              <th 
                                key={col.key}
                                className={`p-3 font-semibold text-slate-700 min-w-[80px] ${
                                  col.key === 'Total Amount' || col.key === 'Invoiced Amount' || col.key === 'Received Amount' || col.key === 'Freight' ||
                                  col.key === 'totalOrderedQty' || col.key === 'totalReceivedQty' || col.key === 'remainingQty'
                                    ? 'text-right' : 'text-left'
                                } ${
                                  ['PO No.', 'Supplier No.', 'Buyer', 'Order Date', 'Status', 'Total Amount', 'Invoiced Amount', 'Received Amount', 'Close Date'].includes(col.key)
                                    ? 'cursor-pointer hover:bg-blue-100/50 transition-colors' : ''
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
                            
                            // Get supplier defaults from other POs (for better fallback values)
                            const getSupplierDefaults = (supplierNo: string) => {
                              if (!supplierNo) return {};
                              const allPOs = data['PurchaseOrders.json'] || [];
                              const supplierPOs = allPOs.filter((p: any) => 
                                (p['Supplier No.'] === supplierNo || p['Name'] === supplierNo) && 
                                p['PO No.'] !== po['PO No.'] // Exclude current PO
                              );
                              
                              if (supplierPOs.length === 0) return {};
                              
                              // Get most common values from supplier's other POs
                              const terms = supplierPOs.map((p: any) => p['Terms']).filter(Boolean);
                              const shipVia = supplierPOs.map((p: any) => p['Ship Via']).filter(Boolean);
                              const fob = supplierPOs.map((p: any) => p['FOB']).filter(Boolean);
                              const contact = supplierPOs.map((p: any) => p['Contact']).filter(Boolean);
                              
                              return {
                                terms: terms.length > 0 ? terms[0] : null, // Use first (most recent)
                                shipVia: shipVia.length > 0 ? shipVia[0] : null,
                                fob: fob.length > 0 ? fob[0] : null,
                                contact: contact.length > 0 ? contact[0] : null
                              };
                            };
                            
                            const supplierDefaults = getSupplierDefaults(po['Supplier No.'] || po['Name']);
                            
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
                                    
                                    // Skip rendering if value is empty/null for optional fields
                                    const isOptionalField = !col.required && !col.calculated;
                                    
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
                                      
                                      case 'Terms':
                                      case 'Ship Via':
                                      case 'FOB':
                                      case 'Contact':
                                        // Only show if there's actual data - no fake defaults
                                        const textValue = value && value.toString().trim() ? value.toString().trim() : null;
                                        if (!textValue) {
                                          // Return empty cell to maintain table structure
                                          return <td key={col.key} className="p-2"></td>;
                                        }
                                        return (
                                          <td key={col.key} className="p-2 text-gray-600">
                                            {textValue}
                                </td>
                                        );
                                      
                                      case 'Freight':
                                        // Only show if there's actual data
                                        const freightValue = value;
                                        if (freightValue && (typeof freightValue === 'number' || !isNaN(parseFloat(freightValue)))) {
                                          const freightNum = parseFloat(freightValue);
                                          if (freightNum > 0) {
                                            return (
                                              <td key={col.key} className="p-2 text-right font-mono text-gray-600">
                                                ${freightNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                            );
                                          }
                                        } else if (freightValue && freightValue.toString().trim()) {
                                          return (
                                            <td key={col.key} className="p-2 text-gray-600">
                                              {freightValue.toString().trim()}
                                </td>
                                          );
                                        }
                                        // Return empty cell to maintain table structure
                                        return <td key={col.key} className="p-2"></td>;
                                      
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
                    <button 
                      onClick={async () => {
                        try {
                          alert('🚀 Generating logistics documents...\n\nThis will create:\n• BOL\n• Commercial Invoice\n• Packing Slip\n• TSCA (if US)\n• Dangerous Goods (if DG)');
                          
                          const response = await fetch(getApiUrl('/api/logistics/generate-all-documents'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              so_number: logisticsData.soNumber,
                              po_number: logisticsData.poNumber,
                              shipment_type: logisticsData.shipmentType,
                              carrier: logisticsData.carrier,
                              destination: logisticsData.destination,
                              gross_weight: logisticsData.grossWeight,
                              pickup_date: logisticsData.pickupDate,
                              workflow: selectedWorkflow
                            })
                          });
                          
                          const responseText = await response.text();
                          let data: any = null;
                          try {
                            data = JSON.parse(responseText);
                          } catch (parseError) {
                            throw new Error(`Backend returned non-JSON response: ${responseText.substring(0, 200)}`);
                          }

                          if (!response.ok || !data.success) {
                            const errorMsg = data.error || data.summary || response.statusText || 'Failed to generate documents';
                            throw new Error(errorMsg);
                          }

                          if (!data.zip_download_url) {
                            throw new Error('ZIP download URL missing from response');
                          }

                          const zipResponse = await fetch(getApiUrl(data.zip_download_url));
                          if (!zipResponse.ok) {
                            throw new Error(`ZIP download failed: ${zipResponse.status} ${zipResponse.statusText}`);
                          }

                          const blob = await zipResponse.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                          link.download = `${data.folder_name || `Logistics_Documents_${logisticsData.soNumber || 'export'}`}.zip`;
                            link.click();
                            window.URL.revokeObjectURL(url);
                            alert('✅ Documents generated successfully!');
                        } catch (error) {
                          alert(`❌ Error: ${error.message}`);
                        }
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors"
                    >
                      📄 Generate & Download Run Sheet
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="px-6 py-4 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
                    >
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
            <div className="space-y-4">
              
              {/* STREAMLINED INVENTORY HEADER - Light Theme */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Header Bar */}
                <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b border-slate-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Inventory & BOM</h2>
                        <p className="text-slate-500 text-sm">{filteredInventory.length.toLocaleString()} items • Real-time MiSys data</p>
                      </div>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setInventoryFilter('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          inventoryFilter === 'all' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        All: {(data['CustomAlert5.json'] || []).length.toLocaleString()}
                      </button>
                      <button 
                        onClick={() => setInventoryFilter('low-stock')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          inventoryFilter === 'low-stock' 
                            ? 'bg-amber-500 text-white shadow-md' 
                            : 'bg-white text-amber-600 hover:bg-amber-50 border border-amber-200'
                        }`}
                      >
                        Low: {inventoryMetrics.lowStockCount.toLocaleString()}
                      </button>
                      <button 
                        onClick={() => setInventoryFilter('out-of-stock')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          inventoryFilter === 'out-of-stock' 
                            ? 'bg-red-500 text-white shadow-md' 
                            : 'bg-white text-red-600 hover:bg-red-50 border border-red-200'
                        }`}
                      >
                        Out: {inventoryMetrics.outOfStock.toLocaleString()}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Tools Row - BOM, Cart, History */}
                <div className="px-6 py-3 flex items-center justify-end gap-2 bg-slate-50/50 border-t border-slate-100">
                  {/* BOM Tools */}
                    <button 
                      onClick={() => setShowBOMPlanning(!showBOMPlanning)}
                      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        showBOMPlanning 
                          ? 'bg-purple-600 text-white shadow-md' 
                          : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      BOM
                    </button>
                    
                    <button 
                      onClick={() => setShowBomCart(!showBomCart)}
                      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        showBomCart 
                          ? 'bg-orange-600 text-white shadow-md' 
                          : bomCart.length > 0 
                            ? 'bg-orange-100 text-orange-600 border border-orange-300 animate-pulse' 
                            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Cart
                      {bomCart.length > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {bomCart.length}
                        </span>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setShowPRHistory(!showPRHistory);
                        if (!showPRHistory) {
                          fetchPRHistory();
                        }
                      }}
                      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        showPRHistory 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      History
                    </button>
                </div>
              </div>

              {/* COLLAPSIBLE BOM Planning Section - Only shows when toggled */}
              {showBOMPlanning && (
              <div className="bg-white rounded-2xl shadow-xl border border-purple-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    BOM Planning & Explosion
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                      {(() => {
                        const assembledItems = (data['CustomAlert5.json'] || []).filter((item: any) => 
                          (data['BillOfMaterialDetails.json'] || []).some((bom: any) => 
                            bom["Parent Item No."] === item["Item No."]
                          )
                        );
                        return `${assembledItems.length} Assembled Items`;
                      })()}
                    </span>
                    <button 
                      onClick={() => setShowBOMPlanning(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* BOM Cart Panel - Shows when cart has items or is toggled open */}
                {showBomCart && (
                  <div className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                        🛒 Batch PR Generation Cart
                        <span className="text-sm font-normal text-orange-600">
                          (Add multiple items, generate PRs grouped by supplier)
                        </span>
                      </h4>
                      {bomCart.length > 0 && (
                        <button
                          onClick={() => {
                            if (confirm('Clear all items from cart?')) {
                              setBomCart([]);
                            }
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    
                    {bomCart.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <div className="text-3xl mb-2">📦</div>
                        <div>No items in cart. Select an item below and click "Add to Cart"</div>
                      </div>
                    ) : (
                      <>
                        {/* Cart Items */}
                        <div className="space-y-2 mb-4">
                          {bomCart.map((item, index) => (
                            <div key={`${item.item_no}-${index}`} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-200">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.item_no}</div>
                                <div className="text-sm text-gray-600">{item.description}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500">Qty:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.qty}
                                    onChange={(e) => {
                                      const newQty = parseInt(e.target.value) || 1;
                                      setBomCart(prev => prev.map((c, i) => 
                                        i === index ? { ...c, qty: newQty } : c
                                      ));
                                    }}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-medium"
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    setBomCart(prev => prev.filter((_, i) => i !== index));
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Remove from cart"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Generate PRs Button - Opens Modal First */}
                        <button
                          onClick={() => {
                            if (bomCart.length === 0) {
                              alert('Please add items to the cart first');
                              return;
                            }
                            // Open the modal to collect PR details
                            setBOMPRModalData({
                              justification: '',
                              requestedBy: currentUser?.name || '',
                              leadTime: 7
                            });
                            setShowBOMPRModal(true);
                          }}
                          disabled={bomPRLoading || bomCart.length === 0}
                          className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                            bomPRLoading || bomCart.length === 0
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl'
                          }`}
                        >
                          {bomPRLoading ? (
                            <>
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating Batch PRs...
                            </>
                          ) : (
                            <>
                              🚀 Generate PRs for {bomCart.length} Item{bomCart.length !== 1 ? 's' : ''} (Grouped by Supplier)
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* PR History Panel */}
                {showPRHistory && (
                  <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200 p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
                        📋 Purchase Requisition History
                        <span className="text-sm font-normal text-indigo-600">
                          (Last 30 days)
                        </span>
                      </h4>
                      <button
                        onClick={fetchPRHistory}
                        disabled={prHistoryLoading}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
                      >
                        {prHistoryLoading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Refreshing...
                          </>
                        ) : (
                          <>🔄 Refresh</>
                        )}
                      </button>
                    </div>
                    
                    {prHistoryLoading && prHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-3xl mb-2 animate-pulse">📊</div>
                        <div>Loading PR history...</div>
                      </div>
                    ) : prHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-3xl mb-2">📭</div>
                        <div>No PRs generated in the last 30 days</div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-indigo-200">
                              <th className="text-left py-2 px-3 font-semibold text-indigo-900">Date</th>
                              <th className="text-left py-2 px-3 font-semibold text-indigo-900">Time</th>
                              <th className="text-left py-2 px-3 font-semibold text-indigo-900">User</th>
                              <th className="text-left py-2 px-3 font-semibold text-indigo-900">Justification</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">Items</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">Suppliers</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">PRs</th>
                              <th className="text-right py-2 px-3 font-semibold text-indigo-900">Value</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prHistory.map((pr: any, index: number) => {
                              const isExpanded = expandedPRHistory.has(pr.id || `pr-${index}`);
                              const toggleExpand = () => {
                                const newSet = new Set(expandedPRHistory);
                                if (isExpanded) {
                                  newSet.delete(pr.id || `pr-${index}`);
                                } else {
                                  newSet.add(pr.id || `pr-${index}`);
                                }
                                setExpandedPRHistory(newSet);
                              };
                              
                              // Get components - prioritize short_items_detail (actual PR Excel items) over component_breakdown
                              // short_items_detail = items that go on the Excel (raw materials that are SHORT)
                              // component_breakdown = all exploded components (including those in stock)
                              // items_requested = parent items selected (fallback for old PRs)
                              const hasFullData = pr.short_items_detail?.length > 0 || pr.component_breakdown?.length > 0;
                              const components = pr.short_items_detail || pr.component_breakdown || pr.items_requested || [];
                              
                              return (
                                <React.Fragment key={pr.id || index}>
                                  <tr 
                                    className="border-b border-indigo-100 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    onClick={toggleExpand}
                                  >
                                    <td className="py-3 px-3 font-medium text-gray-900">
                                      <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
                                      {pr.date}
                                    </td>
                                    <td className="py-3 px-3 text-gray-600">{pr.time}</td>
                                    <td className="py-3 px-3 text-gray-800">{pr.user}</td>
                                    <td className="py-3 px-3 text-gray-600 max-w-xs truncate" title={pr.justification}>
                                      {pr.justification?.length > 30 ? `${pr.justification.substring(0, 30)}...` : pr.justification}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                        {components.length || pr.items_requested?.length || 0}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex flex-wrap gap-1 justify-center">
                                        {pr.suppliers?.slice(0, 3).map((s: any, i: number) => (
                                          <span 
                                            key={i} 
                                            className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium"
                                            title={s.supplier_name}
                                          >
                                            {s.supplier_no?.length > 10 ? `${s.supplier_no.substring(0, 10)}...` : s.supplier_no}
                                          </span>
                                        ))}
                                        {pr.suppliers?.length > 3 && (
                                          <span className="text-gray-500 text-xs">+{pr.suppliers.length - 3}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                        {pr.total_prs_generated || 0}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-right font-medium text-gray-900">
                                      ${(pr.total_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => {
                                          // Use short_items_detail (actual PR items) or component_breakdown (all components) or fallback to items_requested
                                          const itemsToUse = pr.short_items_detail || pr.component_breakdown || pr.items_requested || [];
                                          
                                          setRedoPRData({
                                            originalPR: pr,
                                            items: itemsToUse.map((item: any) => ({
                                              item_no: item.item_no || item['Item No.'] || '',
                                              qty: item.order_qty || item.qty || item.qty_needed || 1,
                                              originalQty: item.order_qty || item.qty || item.qty_needed || 1
                                            })),
                                            justification: pr.justification || '',
                                            requestedBy: pr.user || '',
                                            leadTime: pr.lead_time || 7
                                          });
                                          setShowRedoPRModal(true);
                                        }}
                                        className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 mx-auto"
                                        title="Regenerate PRs with editable quantities"
                                      >
                                        🔄 Redo
                                      </button>
                                    </td>
                                  </tr>
                                  
                                  {/* Expanded Component Breakdown - Total Components Needed for Batch */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={9} className="bg-blue-50 px-4 py-4">
                                        {hasFullData ? (
                                          <>
                                            <div className="mb-3 flex justify-between items-center">
                                              <h5 className="font-bold text-blue-800 flex items-center gap-2">
                                                📦 Total Components Needed for This Batch
                                                <span className="text-sm font-normal text-blue-600">
                                                  ({components.length} raw materials to order)
                                                </span>
                                              </h5>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // Build tab-separated text for Excel - simple format
                                                  const headers = "Item No.\tDescription\tTotal Needed\tUnit\tIn Stock\tShort\tOrder Qty\tSupplier";
                                                  const rows = components.map((c: any) => {
                                                    const itemNo = c.item_no || '';
                                                    const desc = (c.description || '').replace(/\t/g, ' ');
                                                    const qtyNeeded = c.qty_needed ?? c.qty ?? '';
                                                    const unit = c.stocking_units || c.unit || 'EA';
                                                    const stock = c.stock ?? '';
                                                    const shortfall = c.shortfall ?? '';
                                                    const orderQty = c.order_qty ?? '';
                                                    const supplier = c.preferred_supplier || '';
                                                    return `${itemNo}\t${desc}\t${qtyNeeded}\t${unit}\t${stock}\t${shortfall}\t${orderQty}\t${supplier}`;
                                                  }).join('\n');
                                                  const text = `${headers}\n${rows}`;
                                                  navigator.clipboard.writeText(text);
                                                  alert('✅ Copied to clipboard! Paste into Excel.');
                                                }}
                                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                                              >
                                                📋 Copy for Excel
                                              </button>
                                            </div>
                                            
                                            {/* Clean Component List - What Goes on the PR Excel */}
                                            <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                                              <table className="w-full text-sm">
                                                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                                  <tr>
                                                    <th className="text-left px-3 py-2 font-semibold">Component (Raw Material)</th>
                                                    <th className="text-right px-3 py-2 font-semibold">TOTAL NEEDED</th>
                                                    <th className="text-center px-3 py-2 font-semibold">Unit</th>
                                                    <th className="text-right px-3 py-2 font-semibold">In Stock</th>
                                                    <th className="text-right px-3 py-2 font-semibold">SHORT</th>
                                                    <th className="text-right px-3 py-2 font-semibold">Order Qty</th>
                                                    <th className="text-left px-3 py-2 font-semibold">Supplier</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {components.map((comp: any, idx: number) => {
                                                    const isToteOrIBC = (comp.item_no || '').toUpperCase().includes('TOTE') || 
                                                                        (comp.item_no || '').toUpperCase().includes('IBC');
                                                    const shortfall = comp.shortfall ?? 0;
                                                    return (
                                                      <tr 
                                                        key={idx} 
                                                        className={`border-t border-gray-200 ${isToteOrIBC ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                                      >
                                                        <td className="px-3 py-2">
                                                          <div className="font-mono font-bold text-gray-900">
                                                            {isToteOrIBC && <span className="text-yellow-600">📦 </span>}
                                                            {comp.item_no}
                                                          </div>
                                                          <div className="text-xs text-gray-500 truncate max-w-xs">{comp.description || ''}</div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                          <span className="text-lg font-bold text-blue-700">
                                                            {(comp.qty_needed ?? comp.qty ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                          </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-gray-600 font-medium">
                                                          {comp.stocking_units || comp.unit || 'EA'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-gray-700">
                                                          {comp.stock !== undefined ? comp.stock.toLocaleString() : '-'}
                                                        </td>
                                                        <td className={`px-3 py-2 text-right font-bold ${shortfall > 0 ? 'text-red-600 bg-red-50' : 'text-green-600'}`}>
                                                          {shortfall > 0 ? shortfall.toLocaleString() : '✓ OK'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-bold text-green-700">
                                                          {comp.order_qty !== undefined && comp.order_qty > 0 ? comp.order_qty.toLocaleString() : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">
                                                          {comp.preferred_supplier || '-'}
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                            
                                            {/* Legend */}
                                            <div className="mt-2 flex gap-4 text-xs text-gray-600">
                                              <span className="flex items-center gap-1">
                                                <span className="w-3 h-3 bg-yellow-50 border border-yellow-300 rounded"></span> 📦 TOTE/IBC container
                                              </span>
                                              <span className="flex items-center gap-1">
                                                <span className="w-3 h-3 bg-red-50 border border-red-300 rounded"></span> Short (needs ordering)
                                              </span>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="mb-3 flex justify-between items-center">
                                              <h5 className="font-bold text-blue-800 flex items-center gap-2">
                                                📦 Items Ordered
                                                <span className="text-sm font-normal text-orange-600">
                                                  (Parent items - click Redo for full raw material breakdown)
                                                </span>
                                              </h5>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const headers = "Item No.\tQty";
                                                  const rows = components.map((c: any) => {
                                                    return `${c.item_no || ''}\t${c.qty ?? c.qty_needed ?? ''}`;
                                                  }).join('\n');
                                                  navigator.clipboard.writeText(`${headers}\n${rows}`);
                                                  alert('✅ Copied to clipboard!');
                                                }}
                                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                                              >
                                                📋 Copy for Excel
                                              </button>
                                            </div>
                                            
                                            <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                                              <table className="w-full text-sm">
                                                <thead className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                                                  <tr>
                                                    <th className="text-left px-3 py-2 font-semibold">Item No.</th>
                                                    <th className="text-right px-3 py-2 font-semibold">Qty Ordered</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {components.map((comp: any, idx: number) => (
                                                    <tr key={idx} className={`border-t border-gray-200 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                                                      <td className="px-3 py-2 font-mono font-bold text-gray-900">{comp.item_no}</td>
                                                      <td className="px-3 py-2 text-right text-lg font-bold text-blue-700">
                                                        {(comp.qty ?? comp.qty_needed ?? 0).toLocaleString()}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                            
                                            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                                              ⚠️ This is an older PR - showing parent items only. Click <strong>🔄 Redo</strong> to see full raw material component breakdown with stock levels.
                                            </div>
                                          </>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                        
                        {/* Summary Footer */}
                        <div className="mt-4 pt-3 border-t border-indigo-200 flex justify-between text-sm text-indigo-700">
                          <span>Total: {prHistory.length} PR generation{prHistory.length !== 1 ? 's' : ''}</span>
                          <span>
                            Total Value: ${prHistory.reduce((sum: number, pr: any) => sum + (pr.total_value || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BOM Planning Content */}
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
                              onClick={async () => {
                                console.log('Generate PR button clicked!');
                                console.log('Selected BOM Item:', selectedBomItem);
                                console.log('BOM Quantity:', bomQuantity);
                                
                                if (!selectedBomItem || !bomQuantity) {
                                  alert('Please select an item and enter a quantity');
                                  return;
                                }
                                
                                setBomPRLoading(true);
                                
                                try {
                                  // Call the new backend endpoint for BOM-based PR generation
                                  const response = await fetch('/api/pr/create-from-bom', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      user_info: {
                                        name: currentUser?.name || 'Unknown User',
                                        department: 'Sales',
                                        justification: `BOM Planning - ${selectedBomItem["Item No."]} x ${bomQuantity}`
                                      },
                                      selected_items: [
                                        { item_no: selectedBomItem["Item No."], qty: bomQuantity }
                                      ],
                                      location: '62TODD'
                                    })
                                  });
                                  
                                  // Check for JSON error response
                                  const contentType = response.headers.get('content-type');
                                  if (contentType && contentType.includes('application/json')) {
                                    const result = await response.json();
                                    if (result.error) {
                                      alert(`Error: ${result.error}`);
                                      return;
                                    }
                                    if (result.message) {
                                      alert(result.message);
                                      return;
                                    }
                                  }
                                  
                                  if (!response.ok) {
                                    throw new Error('Failed to generate PRs');
                                  }
                                  
                                  // Download the file
                                  const blob = await response.blob();
                                  
                                  // Get filename from response headers
                                  const contentDisposition = response.headers.get('content-disposition');
                                  let filename = 'PR-Download';
                                  if (contentDisposition) {
                                    const match = contentDisposition.match(/filename="?([^"]+)"?/);
                                    if (match) filename = match[1];
                                  }
                                  
                                  // Create download link
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = filename;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  window.URL.revokeObjectURL(url);
                                  
                                  // Show success message
                                  if (filename.endsWith('.zip')) {
                                    alert(`✅ Generated multiple PRs (grouped by supplier) - Downloaded as ${filename}`);
                                  } else {
                                    alert(`✅ Generated Purchase Requisition - Downloaded as ${filename}`);
                                  }
                                  
                                } catch (error) {
                                  console.error('PR generation error:', error);
                                  alert(`Failed to generate PRs: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                } finally {
                                  setBomPRLoading(false);
                                }
                              }}
                              disabled={bomPRLoading}
                              className={`${bomPRLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2`}
                            >
                              {bomPRLoading ? (
                                <>
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Generating PRs...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  Generate PR Now
                                </>
                              )}
                            </button>
                            
                            {/* Add to Cart Button */}
                            <button
                              onClick={() => {
                                if (!selectedBomItem || !bomQuantity) {
                                  alert('Please select an item and enter a quantity');
                                  return;
                                }
                                
                                // Check if item already in cart
                                const existingIndex = bomCart.findIndex(c => c.item_no === selectedBomItem["Item No."]);
                                if (existingIndex >= 0) {
                                  // Update quantity
                                  setBomCart(prev => prev.map((c, i) => 
                                    i === existingIndex ? { ...c, qty: c.qty + bomQuantity } : c
                                  ));
                                  alert(`Updated: ${selectedBomItem["Item No."]} - added ${bomQuantity} more (total: ${bomCart[existingIndex].qty + bomQuantity})`);
                                } else {
                                  // Add new item
                                  setBomCart(prev => [...prev, {
                                    item_no: selectedBomItem["Item No."],
                                    description: selectedBomItem["Description"] || '',
                                    qty: bomQuantity
                                  }]);
                                  alert(`Added to cart: ${selectedBomItem["Item No."]} × ${bomQuantity}`);
                                }
                                
                                // Show cart if not visible
                                setShowBomCart(true);
                              }}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Add to Cart
                              {bomCart.length > 0 && (
                                <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                  {bomCart.length}
                                </span>
                              )}
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
              </div>
              )}

              {/* Inventory Cards - Main Grid */}
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
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="text-xl text-slate-600 font-semibold">No items found</div>
                    <div className="text-sm text-slate-500 mt-2">
                      Try adjusting your search or filter criteria
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(() => {
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = itemsPerPage === 999999 ? filteredInventory.length : startIndex + itemsPerPage;
                  return filteredInventory.slice(startIndex, endIndex);
                })().map((item: any, index: number) => {
                  const stock = parseStockValue(item["Stock"]);
                  const wip = parseStockValue(item["WIP"]);
                  const onOrder = parseStockValue(item["On Order"] || item["Qty On Order"]);
                  const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
                  const cost = parseCostValue(item["Recent Cost"] || item["Standard Cost"] || item["Unit Cost"]);
                  
                  let statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  let statusText = 'In Stock';
                  let statusDot = 'bg-emerald-500';
                  if (stock <= 0) {
                    statusColor = 'bg-red-100 text-red-700 border-red-200';
                    statusText = 'Out';
                    statusDot = 'bg-red-500';
                  } else if (stock <= reorderLevel && reorderLevel > 0) {
                    statusColor = 'bg-amber-100 text-amber-700 border-amber-200';
                    statusText = 'Low';
                    statusDot = 'bg-amber-500';
                  }
                  
                  // Check if item is assembled (PERFORMANCE: using pre-computed Set)
                  const isAssembled = assembledItemsSet.has(item["Item No."]);
                  
                  // Status colors - accent on left border + stock number
                  const stockTextColor = stock <= 0 
                    ? 'text-red-600' 
                    : stock <= reorderLevel && reorderLevel > 0 
                      ? 'text-amber-600'
                      : 'text-emerald-600';
                  
                  const borderAccent = stock <= 0 
                    ? 'border-l-red-500' 
                    : stock <= reorderLevel && reorderLevel > 0 
                      ? 'border-l-amber-500'
                      : 'border-l-emerald-500';

                  // Calculate stock health percentage for visual indicator
                  const stockHealthPercent = reorderLevel > 0 ? Math.min((stock / reorderLevel) * 100, 100) : (stock > 0 ? 100 : 0);
                  const stockHealthColor = stock <= 0 ? 'bg-red-500' : stock <= reorderLevel ? 'bg-amber-500' : 'bg-emerald-500';
                  
                  return (
                    <div 
                      key={index} 
                      onClick={() => {
                        setSelectedItem(item);
                        setShowItemModal(true);
                        setShowAnalytics(false);
                        setShowBOMPlanning(false);
                      }}
                      className={`group relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 ${
                        stock <= 0 
                          ? 'bg-gradient-to-br from-red-50 via-white to-rose-50 shadow-lg shadow-red-100/50 hover:shadow-xl hover:shadow-red-200/60 ring-1 ring-red-200/60' 
                          : stock <= reorderLevel && reorderLevel > 0
                            ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-lg shadow-amber-100/50 hover:shadow-xl hover:shadow-amber-200/60 ring-1 ring-amber-200/60'
                            : 'bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-emerald-200/40 ring-1 ring-slate-200/60'
                      }`}
                    >
                      {/* Decorative corner accent */}
                      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 ${
                        stock <= 0 ? 'bg-red-400' : stock <= reorderLevel && reorderLevel > 0 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      
                      {/* Header: Item + Badge */}
                      <div className="relative flex items-start justify-between gap-2 px-4 pt-4 pb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-black text-gray-900 tracking-tight truncate">{item["Item No."]}</h3>
                          <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{item["Description"]}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm ${
                          isAssembled 
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-200' 
                            : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-sky-200'
                        }`}>
                          {isAssembled ? 'ASM' : 'RAW'}
                        </span>
                      </div>

                      {/* Stock & WIP - Modern Cards */}
                      <div className="flex gap-2 mx-3 mb-3">
                        <div className={`flex-1 py-3 px-3 rounded-xl ${
                          stock <= 0 
                            ? 'bg-gradient-to-br from-red-100 to-red-50' 
                            : stock <= reorderLevel && reorderLevel > 0
                              ? 'bg-gradient-to-br from-amber-100 to-amber-50'
                              : 'bg-gradient-to-br from-emerald-100/80 to-emerald-50/50'
                        }`}>
                          <div className={`text-2xl font-black tracking-tight ${stockTextColor}`}>{stock.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Stock</div>
                        </div>
                        <div className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50">
                          <div className="text-2xl font-black text-slate-700 tracking-tight">{wip.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">WIP</div>
                        </div>
                      </div>

                      {/* Stock Health Bar */}
                      <div className="mx-3 mb-3">
                        <div className="h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${stockHealthColor} transition-all duration-500 rounded-full`}
                            style={{ width: `${stockHealthPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer: On Order + Cost */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50/80 to-transparent border-t border-gray-100/80">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          <span className="text-xs text-gray-500">
                            <span className="font-bold text-gray-700">{onOrder.toLocaleString()}</span> on order
                          </span>
                        </div>
                        <div className="text-sm font-black text-gray-800">{formatCAD(cost)}</div>
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
            <div className="space-y-6">
              
              {/* Light Breadcrumb Navigation */}
              {soCurrentPath.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-lg">
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <button 
                      onClick={resetSONavigation}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 font-semibold transition-all shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Sales Orders
                    </button>
                    {soCurrentPath.map((folder, index) => (
                      <React.Fragment key={index}>
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <button 
                          onClick={() => {
                            const newPath = soCurrentPath.slice(0, index + 1);
                            setSoCurrentPath(newPath);
                            loadSOFolderData(newPath);
                          }}
                          className={`px-4 py-2.5 rounded-xl font-semibold transition-all ${
                            index === soCurrentPath.length - 1
                              ? 'bg-slate-100 text-slate-900 border border-slate-200'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          {folder}
                        </button>
                      </React.Fragment>
                    ))}
                    <button 
                      onClick={navigateBackSO}
                      className="ml-auto px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold flex items-center gap-2 border border-slate-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* Enhanced Light Main Navigation - Show when at root */}
              {soCurrentPath.length === 0 && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
                {/* Header Section - Enhanced Light Theme */}
                <div className="relative bg-gradient-to-r from-blue-100 via-indigo-50 to-violet-100 border-b border-blue-200/50 px-6 py-6 overflow-hidden">
                  {/* Decorative background elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/30 to-transparent rounded-full -translate-y-32 translate-x-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-200/30 to-transparent rounded-full translate-y-24 -translate-x-24"></div>
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 ring-4 ring-white">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center border-3 border-white shadow-lg">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                          Sales Orders
                        </h2>
                        <p className="text-blue-700 text-sm mt-1 font-medium">Enterprise Order Management System</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2.5 bg-white/80 backdrop-blur-sm text-slate-700 rounded-xl font-semibold text-sm border border-slate-200 flex items-center gap-2 shadow-sm">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                        </svg>
                        Google Drive
                      </div>
                      <div className="px-4 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm border border-emerald-200 shadow-sm">
                        {salesOrderAnalytics.total.toLocaleString()} Total Orders
                      </div>
                      {onRefreshData && (
                        <button
                          onClick={async () => {
                            console.log('🔄 Manual refresh requested');
                            await onRefreshData();
                          }}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
                          title="Refresh sales orders data"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Content Section - Enhanced Light Theme */}
                <div className="p-6 bg-gradient-to-b from-slate-50/50 to-white">
                  {/* Search Bar - Enhanced Light Theme */}
                  <div className="mb-8">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search for SO Number (e.g., 2961)..."
                        value={soSearchQuery}
                        onChange={(e) => setSoSearchQuery(e.target.value)}
                        className="w-full px-5 py-4 pl-14 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base shadow-sm"
                      />
                      <div className="absolute left-5 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      {soSearchQuery && (
                        <button
                          onClick={() => setSoSearchQuery('')}
                          className="absolute right-5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {soSearchQuery && (
                      <div className="mt-3 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium border border-blue-200 inline-flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Searching for: <strong>{soSearchQuery}</strong>
                      </div>
                    )}
                  </div>
                  
                  {/* Status Folders Grid - Enhanced Light Theme */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                    {/* New and Revised Card - Enhanced */}
                    <div 
                      onClick={() => navigateToSOFolder('New and Revised')}
                      className="group relative bg-white rounded-2xl p-6 border border-emerald-200 hover:border-emerald-300 hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-100/60 to-transparent rounded-full -translate-y-24 translate-x-24 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-green-100/40 to-transparent rounded-full translate-y-16 -translate-x-16"></div>
                      
                      <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30 group-hover:scale-110 transition-transform ring-4 ring-white">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-xl">New and Revised</div>
                              <div className="text-sm text-emerald-600 font-semibold">Active orders awaiting production</div>
                            </div>
                          </div>
                          <svg className="w-6 h-6 text-emerald-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 mb-5 border border-emerald-100">
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-5xl font-black text-slate-900 tracking-tight">{salesOrderAnalytics.newAndRevised.count}</div>
                              <div className="text-sm text-emerald-700 font-bold uppercase tracking-wider mt-1">Active SOs</div>
                            </div>
                            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm border border-emerald-100">
                              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                          Last updated: {salesOrderAnalytics.newAndRevised.lastUpdated}
                        </div>
                        <div className="mt-3 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full opacity-60"></div>
                      </div>
                    </div>
                    
                    {/* In Production Card - Enhanced */}
                    <div 
                      onClick={() => navigateToSOFolder('In Production')}
                      className="group relative bg-white rounded-2xl p-6 border border-orange-200 hover:border-orange-300 hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-orange-100/60 to-transparent rounded-full -translate-y-24 translate-x-24 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-amber-100/40 to-transparent rounded-full translate-y-16 -translate-x-16"></div>
                      
                      <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/30 group-hover:scale-110 transition-transform ring-4 ring-white">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-xl">In Production</div>
                              <div className="text-sm text-orange-600 font-semibold">Currently manufacturing</div>
                            </div>
                          </div>
                          <svg className="w-6 h-6 text-orange-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 mb-5 border border-orange-100">
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-5xl font-black text-slate-900 tracking-tight">{salesOrderAnalytics.inProduction.count}</div>
                              <div className="text-sm text-orange-700 font-bold uppercase tracking-wider mt-1">Scheduled SOs</div>
                            </div>
                            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm border border-orange-100">
                              <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse"></div>
                          Last updated: {salesOrderAnalytics.inProduction.lastUpdated}
                        </div>
                        <div className="mt-3 h-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full opacity-60"></div>
                      </div>
                    </div>
                    
                  </div>
                </div>
              </div>
              )}

              {/* FOLDER CONTENTS - Light Theme */}
              {soCurrentPath.length >= 1 && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
                  {/* Folder Header - Light Design */}
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 border-b border-slate-200 px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 tracking-tight">{soCurrentPath[soCurrentPath.length - 1]}</h3>
                          <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                            {soLoading ? (
                              <>
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span>Syncing with Google Drive...</span>
                              </>
                            ) : soFolderData ? (
                              <>
                                <span className="text-blue-600 font-medium">{soFolderData.total_folders}</span> folders
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                <span className="text-emerald-600 font-medium">{soFolderData.total_files}</span> files
                              </>
                            ) : (
                              <span>Loading...</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {soLoading && (
                          <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200">
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="text-sm font-medium">Syncing...</span>
                          </div>
                        )}
                        
                        {/* Refresh Button */}
                        <button
                          onClick={() => loadSOFolderData(soCurrentPath)}
                          className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-all text-slate-500 hover:text-slate-700 border border-slate-200"
                          title="Refresh folder"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {soFolderData && !soLoading && (
                      <>
                        {/* Show Subfolders - Light Cards */}
                        {soFolderData.folders && soFolderData.folders.length > 0 && (
                          <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                Subfolders
                              </h4>
                              <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                {soFolderData.folders.length} folder{soFolderData.folders.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                              {soFolderData.folders.map((folder: any, index: number) => (
                                <div 
                                  key={index}
                                  onClick={() => navigateToSOFolder(folder.name)}
                                  className="group bg-gradient-to-br from-slate-50 to-white rounded-2xl p-5 hover:from-blue-50 hover:to-indigo-50 transition-all cursor-pointer border border-slate-200 hover:border-blue-300 hover:shadow-lg"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                      </svg>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                  <div className="font-bold text-slate-900 text-base mb-2 truncate group-hover:text-blue-700 transition-colors">{folder.name}</div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="text-emerald-600 font-medium">{folder.file_count}</span> files
                                    {folder.folder_count > 0 && (
                                      <>
                                        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                        <span className="text-blue-600 font-medium">{folder.folder_count}</span> folders
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Show Actual Sales Order Files - Light Design */}
                        {soFolderData.files && soFolderData.files.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Sales Order Files
                              </h4>
                              <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                {soFolderData.files.length} file{soFolderData.files.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                              {soFolderData.files.map((file: any, index: number) => {
                                // Extract SO number from filename
                                const soMatch = file.name.match(/salesorder[_-]?(\d+)/i);
                                const soNumber = soMatch ? soMatch[1] : file.name.split('.')[0];
                                
                                return (
                                  <div 
                                    key={index}
                                    className="group bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:from-blue-50 hover:to-indigo-50 transition-all overflow-hidden hover:shadow-md"
                                  >
                                    <div className="flex items-center gap-4 p-4">
                                      {/* File Icon with Glow Effect */}
                                      <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                                        file.is_pdf ? 'bg-gradient-to-br from-red-500 to-rose-600' : 
                                        file.is_excel ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 
                                        'bg-gradient-to-br from-blue-500 to-indigo-600'
                                      }`}>
                                        {file.is_pdf ? (
                                          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13h1.5v4H8.5v-4zm3 0h1.5v4H11.5v-4zm3 0h1.5v4H14.5v-4z"/>
                                          </svg>
                                        ) : file.is_excel ? (
                                          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h2v2H8v-2zm0 3h2v2H8v-2zm3-3h2v2h-2v-2zm0 3h2v2h-2v-2zm3-3h2v2h-2v-2zm0 3h2v2h-2v-2z"/>
                                          </svg>
                                        ) : (
                                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                        )}
                                        {/* SO Number Badge */}
                                        {soNumber && (
                                          <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-slate-900 rounded-md text-[10px] font-bold text-white">
                                            #{soNumber}
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* File Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 truncate text-base group-hover:text-blue-700 transition-colors">{file.name}</div>
                                        <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                                          <span className="text-slate-600 font-medium">{(file.size / 1024).toFixed(1)} KB</span>
                                          <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                          <span className="text-slate-500">Modified: {file.modified}</span>
                                        </div>
                                      </div>
                                      
                                      {/* Action Buttons - Light Style */}
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* Quick View Button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openQuickView({...file, so_number: soNumber});
                                          }}
                                          className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-all text-sm font-medium border border-purple-200"
                                          title="Quick View PDF"
                                        >
                                          <Eye className="w-4 h-4" />
                                          <span className="hidden lg:inline">Quick View</span>
                                        </button>
                                        
                                        {/* View in Browser Button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            viewSOInBrowser({...file, so_number: soNumber});
                                          }}
                                          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-all text-sm font-medium border border-blue-200"
                                          title="View in Browser"
                                        >
                                          <Globe className="w-4 h-4" />
                                          <span className="hidden lg:inline">Browser</span>
                                        </button>
                                        
                                        {/* Download Button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const url = file.gdrive_id 
                                              ? getApiUrl(`/api/gdrive/download/${file.gdrive_id}`)
                                              : getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(file.path)}`);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = file.name;
                                            link.click();
                                          }}
                                          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-all text-sm font-medium border border-emerald-200"
                                          title="Download File"
                                        >
                                          <Download className="w-4 h-4" />
                                          <span className="hidden xl:inline">Download</span>
                                        </button>
                                        
                                        {/* View Details Arrow */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openSOViewer({...file, so_number: soNumber});
                                          }}
                                          className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-slate-200"
                                          title="View Details"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Empty Folder - Light Theme */}
                        {(!soFolderData.folders || soFolderData.folders.length === 0) && 
                         (!soFolderData.files || soFolderData.files.length === 0) && (
                          <div className="text-center py-20">
                            <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-200">
                              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                            <div className="text-xl font-bold text-slate-600">Empty Folder</div>
                            <div className="text-sm text-slate-500 mt-2 max-w-md mx-auto">No Sales Orders found in this folder. Files may have been moved or the folder is empty.</div>
                            <button 
                              onClick={() => loadSOFolderData(soCurrentPath)}
                              className="mt-6 px-6 py-2.5 bg-blue-100 text-blue-700 rounded-xl font-medium hover:bg-blue-200 transition-all border border-blue-200"
                            >
                              Refresh Folder
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Loading State - Light Theme */}
                    {!soFolderData && soLoading && (
                      <div className="text-center py-20">
                        <div className="relative w-24 h-24 mx-auto mb-6">
                          <div className="absolute inset-0 bg-blue-100 rounded-3xl animate-ping"></div>
                          <div className="relative w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center border border-blue-200">
                            <svg className="w-12 h-12 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-xl font-bold text-slate-900">Loading Sales Orders</div>
                        <div className="text-sm text-slate-500 mt-2">Fetching from Google Drive...</div>
                        <div className="flex items-center justify-center gap-1 mt-4">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Error State - Light Theme */}
                    {soFolderData?.error && !soLoading && (
                      <div className="text-center py-20">
                        <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-200">
                          <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="text-xl font-bold text-red-600">Failed to Load</div>
                        <div className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{soFolderData.error}</div>
                        <button 
                          onClick={() => loadSOFolderData(soCurrentPath)}
                          className="mt-6 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-md"
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* ITEM DETAILS MODAL - Clean Redesign */}
      {showItemModal && selectedItem && (() => {
        // Calculate key metrics
        const itemNo = selectedItem['Item No.'] || 'Unknown';
        const itemNoUpper = itemNo.toString().trim().toUpperCase();
        const description = selectedItem['Description'] || 'No description';
        const isAssembled = assembledItemsSet.has(itemNo);
        
        const currentStock = parseStockValue(selectedItem['On Hand'] || selectedItem['Stock'] || 0);
        const currentWIP = parseStockValue(selectedItem['WIP'] || 0);
        const onOrder = parseStockValue(selectedItem['On Order'] || selectedItem['Qty On Order'] || 0);
        const reorderLevel = parseStockValue(selectedItem['Reorder Level'] || selectedItem['Minimum'] || 0);
        const unitCost = parseCostValue(selectedItem['Unit Cost'] || selectedItem['Recent Cost'] || selectedItem['Standard Cost'] || 0);
        const totalValue = currentStock * unitCost;
        
        const stockStatus = currentStock <= 0 ? 'out' : currentStock <= reorderLevel ? 'low' : 'ok';
        
        // Count related records
        const poCount = (() => {
          const processedPOLines = processPurchaseOrders.lines.filter((line: any) => 
            (line.itemId || '').toString().trim().toUpperCase() === itemNoUpper
          );
          const rawPODetails = (data['PurchaseOrderDetails.json'] || []).filter((detail: any) => {
            const fields = [detail['Item No.'], detail['ItemNo'], detail['Component Item No.'], detail['Part No.']];
            return fields.some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper);
          });
          const allPOs = new Set();
          processedPOLines.forEach((l: any) => allPOs.add(l.poId));
          rawPODetails.forEach((d: any) => allPOs.add(d['PO No.']));
          return allPOs.size;
        })();
        
        const moCount = (() => {
          const moDetails = (data['ManufacturingOrderDetails.json'] || []).filter((mo: any) => {
            const fields = [mo['Component Item No.'], mo['Item No.'], mo['Part No.']];
            return fields.some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper);
          });
          const moHeaders = (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => {
            const fields = [mo['Build Item No.'], mo['Assembly No.'], mo['Item No.']];
            return fields.some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper);
          });
          const allMOs = new Set();
          moDetails.forEach((d: any) => allMOs.add(d['Mfg. Order No.']));
          moHeaders.forEach((h: any) => allMOs.add(h['Mfg. Order No.']));
          return allMOs.size;
        })();
        
        const soCount = (() => {
          const parsedSOs = data['ParsedSalesOrders.json'] || [];
          const itemName = (description || '').toLowerCase().trim();
          const matches = parsedSOs.filter((so: any) => {
            const items = so.items || [];
            return items.some((item: any) => {
              const code = (item.item_code || '').toString().trim().toUpperCase();
              const desc = (item.description || '').toString().toLowerCase();
              if (code === itemNoUpper) return true;
              if (itemName.length > 3 && (desc.includes(itemName) || itemName.includes(desc))) return true;
              return false;
            });
          });
          return matches.length;
        })();
        
        return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={closeItemModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            
            {/* Header - Minimal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  stockStatus === 'out' ? 'bg-red-100' : stockStatus === 'low' ? 'bg-amber-100' : 'bg-emerald-100'
                }`}>
                  <Package2 className={`w-5 h-5 ${
                    stockStatus === 'out' ? 'text-red-600' : stockStatus === 'low' ? 'text-amber-600' : 'text-emerald-600'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{itemNo}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAssembled ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {isAssembled ? 'ASSEMBLED' : 'RAW'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-1">{description}</p>
                </div>
              </div>
              <button onClick={closeItemModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Stats Row - Clean Grid */}
            <div className="grid grid-cols-5 border-b border-gray-100">
              <div className={`p-4 text-center ${
                stockStatus === 'out' ? 'bg-red-50' : stockStatus === 'low' ? 'bg-amber-50' : 'bg-emerald-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  stockStatus === 'out' ? 'text-red-600' : stockStatus === 'low' ? 'text-amber-600' : 'text-emerald-600'
                }`}>{currentStock.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 font-medium uppercase">Stock</div>
              </div>
              <div className="p-4 text-center bg-blue-50">
                <div className="text-2xl font-bold text-blue-600">{currentWIP.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 font-medium uppercase">WIP</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-700">{onOrder.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 font-medium uppercase">On Order</div>
              </div>
              <div className="p-4 text-center bg-gray-50">
                <div className="text-2xl font-bold text-gray-800">{(currentStock + currentWIP + onOrder).toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 font-medium uppercase">Available</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xl font-bold text-gray-700">{formatCAD(unitCost)}</div>
                <div className="text-[10px] text-gray-500 font-medium uppercase">Unit Cost</div>
              </div>
            </div>

            {/* Tab Bar - Sleek */}
            <div className="flex px-6 pt-4 gap-1">
              <button 
                onClick={() => setItemModalActiveView('po')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                  itemModalActiveView === 'po' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Purchase Orders <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{poCount}</span>
              </button>
              <button 
                onClick={() => setItemModalActiveView('mo')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                  itemModalActiveView === 'mo' 
                    ? 'border-green-500 text-green-600 bg-green-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Mfg Orders <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{moCount}</span>
              </button>
              <button 
                onClick={() => setItemModalActiveView('so')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                  itemModalActiveView === 'so' 
                    ? 'border-purple-500 text-purple-600 bg-purple-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Sales Orders <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{soCount}</span>
              </button>
              {isAssembled && (
                <button 
                  onClick={() => setItemModalActiveView('bom')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                    itemModalActiveView === 'bom' 
                      ? 'border-orange-500 text-orange-600 bg-orange-50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  BOM
                </button>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/50">

              {/* ===== PURCHASE ORDERS TAB ===== */}
              {itemModalActiveView === 'po' && (() => {
                // Get PO data for this item
                const processedPOLines = processPurchaseOrders.lines.filter((line: any) => 
                  (line.itemId || '').toString().trim().toUpperCase() === itemNoUpper
                );
                
                const rawPODetails = (data['PurchaseOrderDetails.json'] || []).filter((detail: any) => {
                  const fields = [detail['Item No.'], detail['Component Item No.'], detail['Part No.']];
                  return fields.some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper);
                });
                
                // Build PO list
                const allPOData: any[] = [];
                const seenPOs = new Set();
                
                processedPOLines.forEach((line: any) => {
                  if (seenPOs.has(line.poId)) return;
                  seenPOs.add(line.poId);
                  const header = processPurchaseOrders.headers.find((h: any) => h.poId === line.poId);
                  allPOData.push({
                    poNumber: line.poId,
                    vendor: header?.vendor || '—',
                    orderDate: header?.orderDate,
                    orderedQty: line.orderedQty,
                    receivedQty: line.receivedQty,
                    unitPrice: line.unitPrice,
                    status: header?.status
                  });
                });
                
                rawPODetails.forEach((detail: any) => {
                  const poNo = detail['PO No.'];
                  if (seenPOs.has(poNo)) return;
                  seenPOs.add(poNo);
                  const header = (data['PurchaseOrders.json'] || []).find((h: any) => h['PO No.'] === poNo);
                  allPOData.push({
                    poNumber: poNo || '—',
                    vendor: header?.['Vendor'] || header?.['Supplier'] || '—',
                    orderDate: header?.['Order Date'] || detail['Order Date'],
                    orderedQty: parseStockValue(detail['Ordered Qty'] || detail['Quantity'] || 0),
                    receivedQty: parseStockValue(detail['Received Qty'] || 0),
                    unitPrice: parseCostValue(detail['Unit Price'] || 0),
                    status: header?.['Status'] || detail['Status']
                  });
                });
                
                allPOData.sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());
                
                if (allPOData.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Package2 className="w-12 h-12 mb-3" />
                      <div className="text-lg font-medium">No Purchase Orders</div>
                      <div className="text-sm">No PO history found for this item</div>
                    </div>
                  );
                }

                // Summary stats
                const totalOrdered = allPOData.reduce((sum, po) => sum + (po.orderedQty || 0), 0);
                const totalReceived = allPOData.reduce((sum, po) => sum + (po.receivedQty || 0), 0);
                const totalValue = allPOData.reduce((sum, po) => sum + ((po.orderedQty || 0) * (po.unitPrice || 0)), 0);

                return (
                  <div>
                    {/* Summary Row */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-blue-600">{allPOData.length}</div>
                        <div className="text-xs text-gray-500">Total POs</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-gray-800">{totalOrdered.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Ordered</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-emerald-600">{totalReceived.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Received</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-gray-800">{formatCAD(totalValue)}</div>
                        <div className="text-xs text-gray-500">Total Value</div>
                      </div>
                    </div>
                    
                    {/* Table */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">PO #</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Ordered</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Received</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {allPOData.slice(0, 20).map((po, index) => {
                            const statusColor = po.status === '2' || po.status === '3' ? 'bg-green-100 text-green-700' 
                              : po.status === '1' ? 'bg-amber-100 text-amber-700' 
                              : 'bg-blue-100 text-blue-700';
                            const statusText = po.status === '2' ? 'Received' : po.status === '3' ? 'Closed' 
                              : po.status === '1' ? 'Released' : 'Open';
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-blue-600 font-medium">{po.poNumber}</td>
                                <td className="px-4 py-3 text-gray-700">{po.vendor}</td>
                                <td className="px-4 py-3 text-gray-500">{formatDisplayDate(po.orderDate) || '—'}</td>
                                <td className="px-4 py-3 text-right font-medium">{(po.orderedQty || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{(po.receivedQty || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">{formatCAD(po.unitPrice || 0)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>{statusText}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {allPOData.length > 20 && (
                        <div className="px-4 py-2 bg-gray-50 text-center text-xs text-gray-500">
                          Showing 20 of {allPOData.length} records
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ===== MANUFACTURING ORDERS TAB ===== */}
              {itemModalActiveView === 'mo' && (() => {
                // Get MO data - as component and as build item
                const moDetails = (data['ManufacturingOrderDetails.json'] || []).filter((mo: any) => {
                  const fields = [mo['Component Item No.'], mo['Item No.'], mo['Part No.']];
                  return fields.some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper);
                });
                
                const moHeaders = (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => {
                  const fields = [mo['Build Item No.'], mo['Assembly No.'], mo['Item No.']];
                  return fields.some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper);
                });
                
                // Build MO list
                const allMOData: any[] = [];
                const seenMOs = new Set();
                
                moDetails.forEach((detail: any) => {
                  const moNo = detail['Mfg. Order No.'];
                  if (seenMOs.has(moNo)) return;
                  seenMOs.add(moNo);
                  const header = (data['ManufacturingOrderHeaders.json'] || []).find((h: any) => h['Mfg. Order No.'] === moNo);
                  allMOData.push({
                    moNumber: moNo,
                    buildItem: header?.['Build Item No.'] || '—',
                    orderDate: header?.['Order Date'],
                    requiredQty: parseStockValue(detail['Required Qty.'] || 0),
                    completedQty: parseStockValue(detail['Completed'] || 0),
                    status: header?.['Status'],
                    type: 'Component'
                  });
                });
                
                moHeaders.forEach((header: any) => {
                  const moNo = header['Mfg. Order No.'];
                  if (seenMOs.has(moNo)) return;
                  seenMOs.add(moNo);
                  allMOData.push({
                    moNumber: moNo,
                    buildItem: header['Build Item No.'] || itemNoUpper,
                    orderDate: header['Order Date'],
                    requiredQty: parseStockValue(header['Ordered'] || 0),
                    completedQty: parseStockValue(header['Completed'] || 0),
                    status: header['Status'],
                    type: 'Build'
                  });
                });
                
                allMOData.sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());
                
                if (allMOData.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Factory className="w-12 h-12 mb-3" />
                      <div className="text-lg font-medium">No Manufacturing Orders</div>
                      <div className="text-sm">No MO history found for this item</div>
                    </div>
                  );
                }
                
                const totalRequired = allMOData.reduce((sum, mo) => sum + (mo.requiredQty || 0), 0);
                const totalCompleted = allMOData.reduce((sum, mo) => sum + (mo.completedQty || 0), 0);

                return (
                  <div>
                    {/* Summary Row */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-green-600">{allMOData.length}</div>
                        <div className="text-xs text-gray-500">Total MOs</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-gray-800">{totalRequired.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Required</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-emerald-600">{totalCompleted.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                    </div>
                    
                    {/* Table */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">MO #</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Build Item</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Required</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Completed</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {allMOData.slice(0, 20).map((mo, index) => {
                            const statusColor = mo.status === '3' || mo.status === '4' ? 'bg-green-100 text-green-700' 
                              : mo.status === '2' ? 'bg-orange-100 text-orange-700' 
                              : mo.status === '1' ? 'bg-amber-100 text-amber-700' 
                              : 'bg-blue-100 text-blue-700';
                            const statusText = mo.status === '3' ? 'Completed' : mo.status === '4' ? 'Closed' 
                              : mo.status === '2' ? 'In Progress' : mo.status === '1' ? 'Released' : 'Open';
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-green-600 font-medium">{mo.moNumber}</td>
                                <td className="px-4 py-3 text-gray-700">{mo.buildItem}</td>
                                <td className="px-4 py-3 text-gray-500">{formatDisplayDate(mo.orderDate) || '—'}</td>
                                <td className="px-4 py-3 text-right font-medium">{(mo.requiredQty || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{(mo.completedQty || 0).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${mo.type === 'Build' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{mo.type}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>{statusText}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {allMOData.length > 20 && (
                        <div className="px-4 py-2 bg-gray-50 text-center text-xs text-gray-500">
                          Showing 20 of {allMOData.length} records
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ===== SALES ORDERS TAB ===== */}
              {itemModalActiveView === 'so' && (() => {
                const itemName = (description || '').toLowerCase().trim();
                
                // Search ALL available SO data sources
                const parsedSOs = data['ParsedSalesOrders.json'] || [];
                const soDetails = data['SalesOrderDetails.json'] || [];
                const soHeaders = data['SalesOrderHeaders.json'] || [];
                
                // Build SO list from all sources
                const allSOData: any[] = [];
                const seenSOs = new Set();
                
                // 1. Search ParsedSalesOrders (from PDF parsing)
                parsedSOs.forEach((so: any) => {
                  const items = so.items || [];
                  const hasMatch = items.some((item: any) => {
                    const code = (item.item_code || '').toString().trim().toUpperCase();
                    const desc = (item.description || '').toString().toLowerCase();
                    // Match by item code
                    if (code === itemNoUpper) return true;
                    // Match by item code in description
                    if (desc.includes(itemNoUpper.toLowerCase())) return true;
                    // Match by description similarity
                    if (itemName.length > 5 && (desc.includes(itemName) || itemName.includes(desc))) return true;
                    return false;
                  });
                  
                  if (hasMatch) {
                    const soNo = so.so_number || so.order_number || so['Order No.'] || '';
                    if (soNo && !seenSOs.has(soNo)) {
                      seenSOs.add(soNo);
                      // Find matching item details
                      const matchingItem = items.find((item: any) => {
                        const code = (item.item_code || '').toString().trim().toUpperCase();
                        return code === itemNoUpper;
                      }) || items[0];
                      
                      allSOData.push({
                        soNumber: soNo,
                        customer: so.customer_name || so.customer || so.sold_to || '—',
                        orderDate: so.order_date || so.order_details?.order_date || '—',
                        shipDate: so.ship_date || so.order_details?.ship_date || '—',
                        quantity: parseStockValue(matchingItem?.quantity || matchingItem?.ordered || 0),
                        unitPrice: parseCostValue(matchingItem?.unit_price || matchingItem?.price || 0),
                        status: so.status || 'Active',
                        source: 'Parsed'
                      });
                    }
                  }
                });
                
                // 2. Search SalesOrderDetails
                soDetails.forEach((so: any) => {
                  const soItemNo = (so['Item No.'] || '').toString().trim().toUpperCase();
                  if (soItemNo === itemNoUpper) {
                    const soNo = so['SO No.'] || so['Order No.'] || '';
                    if (soNo && !seenSOs.has(soNo)) {
                      seenSOs.add(soNo);
                      allSOData.push({
                        soNumber: soNo,
                        customer: so['Customer'] || so['Customer No.'] || '—',
                        orderDate: so['Order Date'] || '—',
                        shipDate: so['Ship Date'] || so['Required Date'] || '—',
                        quantity: parseStockValue(so['Quantity'] || so['Ordered Qty'] || 0),
                        unitPrice: parseCostValue(so['Unit Price'] || so['Price'] || 0),
                        status: so['Status'] || 'Active',
                        source: 'Details'
                      });
                    }
                  }
                });
                
                // 3. Search SalesOrderHeaders
                soHeaders.forEach((so: any) => {
                  const soItemNo = (so['Item No.'] || so['Build Item No.'] || '').toString().trim().toUpperCase();
                  if (soItemNo === itemNoUpper) {
                    const soNo = so['SO No.'] || so['Order No.'] || '';
                    if (soNo && !seenSOs.has(soNo)) {
                      seenSOs.add(soNo);
                      allSOData.push({
                        soNumber: soNo,
                        customer: so['Customer'] || so['Customer No.'] || '—',
                        orderDate: so['Order Date'] || '—',
                        shipDate: so['Ship Date'] || so['Required Date'] || '—',
                        quantity: parseStockValue(so['Quantity'] || so['Total Qty'] || 0),
                        unitPrice: parseCostValue(so['Unit Price'] || 0),
                        status: so['Status'] || 'Active',
                        source: 'Headers'
                      });
                    }
                  }
                });
                
                // Sort by date (newest first)
                allSOData.sort((a, b) => {
                  const dateA = new Date(a.orderDate || 0).getTime();
                  const dateB = new Date(b.orderDate || 0).getTime();
                  return dateB - dateA;
                });
                
                if (allSOData.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <ShoppingBag className="w-12 h-12 mb-3" />
                      <div className="text-lg font-medium">No Sales Orders Found</div>
                      <div className="text-sm mt-1">No SO history found for this item</div>
                      <div className="text-xs mt-3 text-gray-300">
                        Searched: {parsedSOs.length} parsed SOs, {soDetails.length} SO details, {soHeaders.length} SO headers
                      </div>
                    </div>
                  );
                }
                
                const totalQty = allSOData.reduce((sum, so) => sum + (so.quantity || 0), 0);
                const totalRevenue = allSOData.reduce((sum, so) => sum + ((so.quantity || 0) * (so.unitPrice || 0)), 0);

                return (
                  <div>
                    {/* Summary Row */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-purple-600">{allSOData.length}</div>
                        <div className="text-xs text-gray-500">Total SOs</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-gray-800">{totalQty.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Total Sold</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xl font-bold text-emerald-600">{formatCAD(totalRevenue)}</div>
                        <div className="text-xs text-gray-500">Revenue</div>
                      </div>
                    </div>
                    
                    {/* Table */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">SO #</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {allSOData.slice(0, 20).map((so, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono text-purple-600 font-medium">{so.soNumber}</td>
                              <td className="px-4 py-3 text-gray-700">{so.customer}</td>
                              <td className="px-4 py-3 text-gray-500">{so.orderDate}</td>
                              <td className="px-4 py-3 text-right font-medium">{(so.quantity || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">{formatCAD(so.unitPrice || 0)}</td>
                              <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCAD((so.quantity || 0) * (so.unitPrice || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {allSOData.length > 20 && (
                        <div className="px-4 py-2 bg-gray-50 text-center text-xs text-gray-500">
                          Showing 20 of {allSOData.length} records
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ===== BOM TAB (for assembled items) ===== */}
              {itemModalActiveView === 'bom' && isAssembled && (() => {
                const bomDetails = (data['BillOfMaterialDetails.json'] || []).filter((bom: any) => 
                  (bom['Parent Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper
                );
                
                if (bomDetails.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Package2 className="w-12 h-12 mb-3" />
                      <div className="text-lg font-medium">No BOM Data</div>
                      <div className="text-sm">No bill of materials found for this item</div>
                    </div>
                  );
                }

                return (
                  <div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
                      <div className="text-xl font-bold text-orange-600">{bomDetails.length}</div>
                      <div className="text-xs text-gray-500">Components</div>
                    </div>
                    
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Component</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Qty Per</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {bomDetails.map((bom: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono text-orange-600 font-medium">{bom['Component Item No.']}</td>
                              <td className="px-4 py-3 text-gray-700">{bom['Description'] || '—'}</td>
                              <td className="px-4 py-3 text-right font-medium">{parseStockValue(bom['Quantity Per'] || bom['Qty Per'] || 1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ===== LOCATIONS TAB ===== */}
              {itemModalActiveView === 'locations' && (() => {
                const itemLocations = (data['MIILOC.json'] || []).filter((loc: any) => 
                  (loc['Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper
                );
                
                if (itemLocations.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <MapPin className="w-12 h-12 mb-3" />
                      <div className="text-lg font-medium">No Locations</div>
                      <div className="text-sm">No location records found for this item</div>
                    </div>
                  );
                }

                return (
                  <div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
                      <div className="text-xl font-bold text-amber-600">{itemLocations.length}</div>
                      <div className="text-xs text-gray-500">Locations</div>
                    </div>
                    
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">On Hand</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Allocated</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Available</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {itemLocations.map((loc: any, index: number) => {
                            const onHand = parseStockValue(loc['On Hand'] || 0);
                            const allocated = parseStockValue(loc['Allocated'] || 0);
                            const available = onHand - allocated;
                            const unitCost = parseCostValue(loc['Unit Cost'] || 0);
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-amber-600 font-medium">{loc['Location'] || '—'}</td>
                                <td className="px-4 py-3 text-right font-medium">{onHand.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-gray-500">{allocated.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{available.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">{formatCAD(onHand * unitCost)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        );
      })()}

      {/* SO VIEWER MODAL - Premium Design with Embedded PDF */}
      {showSOViewer && selectedSOFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header - Sleek Design */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Sales Order #{selectedSOFile.so_number || 'N/A'}</h2>
                    <p className="text-blue-200 text-sm mt-0.5 flex items-center gap-2">
                      <span>{selectedSOFile.name}</span>
                      {selectedSOFile.size && (
                        <>
                          <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                          <span>{(selectedSOFile.size / 1024).toFixed(1)} KB</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSOViewer(false)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openQuickView(selectedSOFile)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Quick View PDF
                </button>
                
                <button
                  onClick={() => viewSOInBrowser(selectedSOFile)}
                  disabled={pdfLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg font-medium"
                >
                  {pdfLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Opening...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      Open in New Tab
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    // Download the PDF
                    const url = selectedSOFile.gdrive_id 
                      ? getApiUrl(`/api/gdrive/download/${selectedSOFile.gdrive_id}`)
                      : getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(selectedSOFile.path)}`);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = selectedSOFile.name;
                    link.click();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all shadow-md hover:shadow-lg font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {selectedSOFile.gdrive_id ? 'Google Drive' : 'Local File'}
              </div>
            </div>

            {/* PDF Preview Area */}
            <div className="flex-1 overflow-hidden bg-slate-100 p-4">
              <div className="h-full bg-white rounded-2xl shadow-inner overflow-hidden border border-slate-200">
                {selectedSOFile.is_pdf ? (
                  <iframe
                    src={selectedSOFile.gdrive_id 
                      ? getApiUrl(`/api/gdrive/preview/${selectedSOFile.gdrive_id}`)
                      : `${getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(selectedSOFile.path)}`)}#toolbar=1&navpanes=0`}
                    className="w-full h-full min-h-[500px] border-0"
                    title={`Sales Order ${selectedSOFile.so_number}`}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
                    <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                      {selectedSOFile.is_excel ? (
                        <svg className="w-12 h-12 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h2v2H8v-2zm0 3h2v2H8v-2zm3-3h2v2h-2v-2zm0 3h2v2h-2v-2zm3-3h2v2h-2v-2zm0 3h2v2h-2v-2z"/>
                        </svg>
                      ) : (
                        <FileText className="w-12 h-12 text-slate-400" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Preview Not Available</h3>
                    <p className="text-slate-500 text-center max-w-md">
                      This file type cannot be previewed in the browser. Use the download button to open it in the appropriate application.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* File Info Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-sm text-slate-600 flex-shrink-0">
              <div className="flex items-center gap-4">
                <span className="font-medium">{selectedSOFile.name}</span>
                {selectedSOFile.modified && (
                  <span className="text-slate-400">Last modified: {selectedSOFile.modified}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  selectedSOFile.is_pdf ? 'bg-red-100 text-red-700' : 
                  selectedSOFile.is_excel ? 'bg-green-100 text-green-700' : 
                  'bg-blue-100 text-blue-700'
                }`}>
                  {selectedSOFile.is_pdf ? 'PDF' : selectedSOFile.is_excel ? 'Excel' : 'Document'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK VIEW MODAL - Full Screen PDF Viewer */}
      {showQuickView && selectedSOFile && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
          {/* Quick View Header - Floating Toolbar */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            {/* Left Side - File Info */}
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl border border-white/10">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">SO #{selectedSOFile.so_number || 'N/A'}</h2>
                <p className="text-white/60 text-xs">{selectedSOFile.name}</p>
              </div>
            </div>
            
            {/* Center - Zoom Controls */}
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-2xl border border-white/10">
              <button
                onClick={zoomOut}
                className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all text-white"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="px-4 py-1.5 bg-white/10 rounded-xl min-w-[80px] text-center">
                <span className="text-white font-bold">{pdfZoom}%</span>
              </div>
              <button
                onClick={zoomIn}
                className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all text-white"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-white/20 mx-2"></div>
              <button
                onClick={resetZoom}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm transition-all text-white font-medium"
              >
                Reset
              </button>
            </div>
            
            {/* Right Side - Actions */}
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl rounded-2xl px-3 py-2 shadow-2xl border border-white/10">
              <button
                onClick={() => viewSOInBrowser(selectedSOFile)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-sm font-medium transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                New Tab
              </button>
              <button
                onClick={() => {
                  const url = selectedSOFile.gdrive_id 
                    ? getApiUrl(`/api/gdrive/download/${selectedSOFile.gdrive_id}`)
                    : getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(selectedSOFile.path)}`);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = selectedSOFile.name;
                  link.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white text-sm font-medium transition-all"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <div className="w-px h-6 bg-white/20 mx-1"></div>
              <button
                onClick={() => setShowQuickView(false)}
                className="w-9 h-9 bg-red-500/80 hover:bg-red-600 rounded-xl flex items-center justify-center transition-all text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PDF Viewer - Full Screen */}
          <div className="flex-1 overflow-auto pt-20 pb-4 px-4">
            <div className="h-full flex justify-center">
              <iframe
                src={selectedSOFile.gdrive_id 
                  ? getApiUrl(`/api/gdrive/preview/${selectedSOFile.gdrive_id}`)
                  : `${getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(selectedSOFile.path)}`)}#zoom=${pdfZoom}&toolbar=0&navpanes=0`}
                className="w-full max-w-5xl h-full min-h-[calc(100vh-120px)] border-0 rounded-2xl shadow-2xl bg-white"
                title={`Sales Order ${selectedSOFile.so_number}`}
                style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top center' }}
              />
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
      
      {/* BOM PR Generation Modal */}
      {showBOMPRModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Generate Purchase Requisitions</h3>
              <p className="text-orange-100 text-sm mt-1">
                {bomCart.length} item{bomCart.length !== 1 ? 's' : ''} in cart
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Justification for Purchase *
                </label>
                <textarea
                  value={bomPRModalData.justification}
                  onChange={(e) => setBOMPRModalData(prev => ({ ...prev, justification: e.target.value }))}
                  placeholder="e.g., Customer Order #12345, Stock Replenishment, etc."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Requested By *
                </label>
                <input
                  type="text"
                  value={bomPRModalData.requestedBy}
                  onChange={(e) => setBOMPRModalData(prev => ({ ...prev, requestedBy: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={bomPRModalData.leadTime}
                  onChange={(e) => setBOMPRModalData(prev => ({ ...prev, leadTime: parseInt(e.target.value) || 7 }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => setShowBOMPRModal(false)}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!bomPRModalData.justification.trim()) {
                    alert('Please enter a justification for purchase');
                    return;
                  }
                  if (!bomPRModalData.requestedBy.trim()) {
                    alert('Please enter who requested this purchase');
                    return;
                  }
                  
                  setShowBOMPRModal(false);
                  setBomPRLoading(true);
                  
                  try {
                    const response = await fetch('/api/pr/create-from-bom', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_info: {
                          name: bomPRModalData.requestedBy,
                          department: 'Sales',
                          justification: bomPRModalData.justification,
                          lead_time: bomPRModalData.leadTime
                        },
                        selected_items: bomCart.map(item => ({
                          item_no: item.item_no,
                          qty: item.qty
                        })),
                        location: '62TODD'
                      })
                    });
                    
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                      const result = await response.json();
                      if (result.error) {
                        alert(`Error: ${result.error}`);
                        return;
                      }
                      if (result.message) {
                        alert(result.message);
                        return;
                      }
                    }
                    
                    if (!response.ok) {
                      throw new Error('Failed to generate PRs');
                    }
                    
                    const blob = await response.blob();
                    const contentDisposition = response.headers.get('content-disposition');
                    let filename = 'PRs-Batch';
                    if (contentDisposition) {
                      const match = contentDisposition.match(/filename="?([^"]+)"?/);
                      if (match) filename = match[1];
                    }
                    
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    if (filename.endsWith('.zip')) {
                      alert(`✅ Generated batch PRs (grouped by supplier) for ${bomCart.length} items!\nDownloaded: ${filename}`);
                    } else {
                      alert(`✅ Generated PR for ${bomCart.length} items (single supplier)\nDownloaded: ${filename}`);
                    }
                    
                    setBomCart([]);
                    
                  } catch (error) {
                    console.error('Batch PR generation error:', error);
                    alert(`Failed to generate PRs: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  } finally {
                    setBomPRLoading(false);
                  }
                }}
                disabled={bomPRLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bomPRLoading ? 'Generating...' : '🚀 Generate PRs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redo PR Modal - Regenerate PRs with editable quantities */}
      {showRedoPRModal && redoPRData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4">
              <h3 className="text-xl font-bold text-white">🔄 Regenerate Purchase Requisitions</h3>
              <p className="text-indigo-100 text-sm mt-1">
                Edit quantities and regenerate PRs from: {redoPRData.originalPR?.date} {redoPRData.originalPR?.time}
              </p>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Justification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={redoPRData.justification}
                  onChange={(e) => setRedoPRData({...redoPRData, justification: e.target.value})}
                  placeholder="e.g., Customer Order #12345, Stock Replenishment, etc."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  rows={2}
                />
              </div>
              
              {/* Requested By and Lead Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Requested By <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={redoPRData.requestedBy}
                    onChange={(e) => setRedoPRData({...redoPRData, requestedBy: e.target.value})}
                    placeholder="Your name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead Time (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={redoPRData.leadTime}
                    onChange={(e) => setRedoPRData({...redoPRData, leadTime: parseInt(e.target.value) || 7})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              
              {/* Items List - Editable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Items to Order ({redoPRData.items.length})
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Item Number</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700 w-32">Quantity</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700 w-20">Original</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {redoPRData.items.map((item, index) => (
                        <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono text-xs text-gray-800">{item.item_no}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => {
                                const newItems = [...redoPRData.items];
                                newItems[index].qty = parseInt(e.target.value) || 1;
                                setRedoPRData({...redoPRData, items: newItems});
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center text-gray-500 text-xs">
                            {item.originalQty}
                            {item.qty !== item.originalQty && (
                              <span className={`ml-1 ${item.qty > item.originalQty ? 'text-green-600' : 'text-red-600'}`}>
                                ({item.qty > item.originalQty ? '+' : ''}{item.qty - item.originalQty})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => {
                                const newItems = redoPRData.items.filter((_, i) => i !== index);
                                setRedoPRData({...redoPRData, items: newItems});
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {redoPRData.items.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No items to order. Add items or cancel.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowRedoPRModal(false);
                  setRedoPRData(null);
                }}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!redoPRData.justification.trim()) {
                    alert('Please enter a justification for purchase');
                    return;
                  }
                  if (!redoPRData.requestedBy.trim()) {
                    alert('Please enter who requested this purchase');
                    return;
                  }
                  if (redoPRData.items.length === 0) {
                    alert('No items to order');
                    return;
                  }
                  
                  setRedoPRGenerating(true);
                  
                  try {
                    const response = await fetch(getApiUrl('/api/pr/create-from-bom'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_info: {
                          name: redoPRData.requestedBy,
                          department: 'Sales',
                          justification: redoPRData.justification,
                          lead_time: redoPRData.leadTime
                        },
                        selected_items: redoPRData.items.map(item => ({
                          item_no: item.item_no,
                          qty: item.qty
                        })),
                        location: '62TODD'
                      })
                    });
                    
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                      const result = await response.json();
                      if (result.error) {
                        alert(`Error: ${result.error}`);
                        return;
                      }
                      if (result.message) {
                        alert(result.message);
                        return;
                      }
                    }
                    
                    if (!response.ok) {
                      throw new Error('Failed to generate PRs');
                    }
                    
                    const blob = await response.blob();
                    const contentDisposition = response.headers.get('content-disposition');
                    let filename = 'PRs-Batch-Redo';
                    if (contentDisposition) {
                      const match = contentDisposition.match(/filename="?([^"]+)"?/);
                      if (match) filename = match[1];
                    }
                    
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    alert(`✅ Regenerated PRs for ${redoPRData.items.length} items!\nDownloaded: ${filename}`);
                    
                    setShowRedoPRModal(false);
                    setRedoPRData(null);
                    
                    // Refresh PR history
                    fetchPRHistory();
                    
                  } catch (error) {
                    console.error('Redo PR generation error:', error);
                    alert(`Failed to generate PRs: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  } finally {
                    setRedoPRGenerating(false);
                  }
                }}
                disabled={redoPRGenerating || redoPRData.items.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-lg hover:from-indigo-700 hover:to-purple-800 font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {redoPRGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>🚀 Regenerate PRs ({redoPRData.items.length} items)</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RevolutionaryCanoilHub;