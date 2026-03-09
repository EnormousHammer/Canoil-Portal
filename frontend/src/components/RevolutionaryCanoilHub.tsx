import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CompactLoading, DataLoading } from './LoadingComponents';
import { ToastNotification, useToasts } from './ToastNotification';
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
import { parseMISysDate, formatDisplayDate } from '../utils/dateUtils';
import { buildIndexes, buildDataCatalog, buildTransactionIndexes } from '../data';
import { buildMOView, buildMOExactLines, buildItemView, buildPOView, buildLotTraceView, buildBOMView, buildItemLotSummaryView, buildTransactionSearchView } from '../views';
import { getStockByOwnership, getCanoilStock, isCanoilLocation, CANOIL_LOCATIONS } from '../utils/stockUtils';
import PurchaseRequisitionModal from './PurchaseRequisitionModal';
import ExportAllCompanyDataModal from './ExportAllCompanyDataModal';
import InventoryActionsModal from './InventoryActionsModal';
import { ProformaInvoiceMaker } from './ProformaInvoiceMaker';
import { ERPPortal } from './ERPPortal';
import { CleanIntelligentSOEntry } from './CleanIntelligentSOEntry';
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
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Edit,
  Save,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
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
  Hash,
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
  /** When set, "Open Production Schedule" opens the full Production Schedule app instead of a dead section */
  onOpenProductionSchedule?: () => void;
}

export const RevolutionaryCanoilHub: React.FC<RevolutionaryCanoilHubProps> = ({ data, onNavigate, currentUser, onRefreshData, onOpenProductionSchedule }) => {
  // Toast notification system
  const { toasts, dismissToast, addToast, success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useToasts();
  
  const [activeSection, setActiveSection] = useState('dashboard');
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSection !== 'dashboard') {
      const navBottom = navRef.current
        ? navRef.current.getBoundingClientRect().bottom + window.scrollY
        : 0;
      window.scrollTo({ top: navBottom, behavior: 'instant' as ScrollBehavior });
    }
  }, [activeSection]);

  const [poSortField, setPoSortField] = useState<string>('PO No.');
  const [poSortDirection, setPoSortDirection] = useState<'asc' | 'desc'>('desc');
  const [moSortField, setMoSortField] = useState<string>('Mfg. Order No.');
  const [moSortDirection, setMoSortDirection] = useState<'asc' | 'desc'>('desc');
  const [moStatusFilter, setMoStatusFilter] = useState<string>('all');
  const [moCustomerFilter, setMoCustomerFilter] = useState<string>('all');
  const [poStatusFilter, setPoStatusFilter] = useState<string>('all');
  const [poSupplierFilter, setPoSupplierFilter] = useState<string>('all');
  const [showCreateMOModal, setShowCreateMOModal] = useState(false);
  const [createMOForm, setCreateMOForm] = useState({
    build_item_no: '',
    quantity: '',
    due_date: '',
    batch_number: '',
    sales_order_no: '',
    description: ''
  });
  const [createMOSubmitting, setCreateMOSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemModalActiveView, setItemModalActiveView] = useState('master');
  const [itemSageMapping, setItemSageMapping] = useState<{ sage_part_code?: string; sage_description?: string; confirmed?: boolean } | null>(null);
  
  // Purchase Requisition modal state
  const [showPRModal, setShowPRModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [selectedPOForPR, setSelectedPOForPR] = useState<any>(null);
  // Create PO modal state (Phase 4) – full header + lines
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [createPOForm, setCreatePOForm] = useState({
    supplier_no: '', supplier_name: '',
    order_date: new Date().toISOString().slice(0, 10), requested_date: '',
    terms: '', ship_via: '', fob: '', contact: '', buyer: '', freight: '', currency: 'USD', description: '',
    lines: [{ item_no: '', description: '', qty: '', unit_cost: '', required_date: '' }]
  });
  const [createPOSubmitting, setCreatePOSubmitting] = useState(false);
  const [shortageList, setShortageList] = useState<any[]>([]);
  const [shortageLoading, setShortageLoading] = useState(false);
  const [autoCreatePOLoading, setAutoCreatePOLoading] = useState(false);
  // Lot history (portal-recorded + optional Full Company Data)
  const [showLotHistory, setShowLotHistory] = useState(false);
  const [showTransactionExplorer, setShowTransactionExplorer] = useState(false);
  const [txExplorerFilters, setTxExplorerFilters] = useState<{ itemNo?: string; docRef?: string; lot?: string; serial?: string; dateFrom?: string; dateTo?: string }>({});
  const [lotHistoryList, setLotHistoryList] = useState<any[]>([]);
  const [inventoryByLotList, setInventoryByLotList] = useState<any[]>([]);
  const [lotHistoryLoading, setLotHistoryLoading] = useState(false);
  
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
  const [soSearchResults, setSoSearchResults] = useState<Array<{so_number: string; file: string; status: string}>>([]);
  const [soSearching, setSoSearching] = useState(false);
  const soSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soSearchAbortRef = useRef<AbortController | null>(null);
  
  // Proforma Invoice maker state
  const [showProformaInvoice, setShowProformaInvoice] = useState(false);
  
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
  
  // Quick Add to Cart Popup State
  const [showQuickAddPopup, setShowQuickAddPopup] = useState(false);
  const [quickAddItem, setQuickAddItem] = useState<any>(null);
  const [quickAddQty, setQuickAddQty] = useState(1);
  
  // PR History State
  const [showPRHistory, setShowPRHistory] = useState(false);
  const [prHistory, setPRHistory] = useState<any[]>([]);
  const [prHistoryLoading, setPRHistoryLoading] = useState(false);
  const [expandedPRHistory, setExpandedPRHistory] = useState<Set<string>>(new Set());
  const [prHistorySearch, setPrHistorySearch] = useState('');
  const [prHistoryStatusFilter, setPrHistoryStatusFilter] = useState<'all' | 'completed' | 'ordered' | 'received'>('all');
  const [editingPRId, setEditingPRId] = useState<string | null>(null);
  const [editPRNotes, setEditPRNotes] = useState('');
  const [editPRPoNumber, setEditPRPoNumber] = useState('');
  
  // Export All Company Data modal
  const [showExportAllCompanyDataModal, setShowExportAllCompanyDataModal] = useState(false);
  // Inventory actions (B4 B5 B6)
  const [showInventoryActionsModal, setShowInventoryActionsModal] = useState(false);
  const [inventoryActionsInitialTab, setInventoryActionsInitialTab] = useState<'adjust' | 'transfer' | 'reorder' | 'reserve' | 'allocate' | 'scrap' | 'assemble' | 'supplier' | 'ship' | 'stockcheck'>('adjust');
  const [planningTab, setPlanningTab] = useState<'bom' | 'shortages' | 'whatif'>('bom');
  // MiSys Capabilities panel (collapsible info)
  const [showMISysCapabilities, setShowMISysCapabilities] = useState(false);

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

  // Single source for PO data (same as MO: Full Company Data · MIPOH/MIPOD with legacy fallback)
  const poHeadersSource = useMemo(() => (data?.['MIPOH.json'] ?? data?.['PurchaseOrders.json'] ?? []) as any[], [data]);
  const poDetailsSource = useMemo(() => (data?.['MIPOD.json'] ?? data?.['PurchaseOrderDetails.json'] ?? []) as any[], [data]);

  // Data indexes built once on load (avoids repeated .filter over 165k+ rows)
  const indexes = useMemo(() => buildIndexes(data), [data]);
  const dataCatalog = useMemo(() => buildDataCatalog(data), [data]);
  const txIndexes = useMemo(() => buildTransactionIndexes(data), [data]);
  const txExplorerView = useMemo(() => buildTransactionSearchView(txIndexes, {
    ...txExplorerFilters,
    limit: 300,
  }), [txIndexes, txExplorerFilters]);

  // Purchase Order processing (works with or without PurchaseOrderExtensions)
  const processPurchaseOrders = useMemo(() => {
    if (!poHeadersSource.length && !poDetailsSource.length) {
      return { headers: [], lines: [] };
    }
    const extensions = data?.['PurchaseOrderExtensions.json'] || data?.['MIPOHX.json'] || [];

    const headers = poHeadersSource.map((po: any) => {
      const poKey = (po['PO No.'] ?? po['pohId'] ?? '').toString().trim();
      // Find matching extension data (optional)
      const extension = extensions.find((ext: any) => (ext['PO No.'] ?? ext['pohId'] ?? '').toString().trim() === poKey);
      
      // Get all line items for this PO to calculate advanced metrics
      const poLines = poDetailsSource.filter((line: any) => (line['PO No.'] ?? line['pohId'] ?? '').toString().trim() === poKey);
      
      // Calculate total ordered and received quantities from line items
      const totalOrderedQty = poLines.reduce((sum: number, line: any) => 
        sum + parseStockValue(line['Ordered Qty'] ?? line['Ordered'] ?? line['ordered'] ?? line['ordQty'] ?? 0), 0);
      const totalReceivedQty = poLines.reduce((sum: number, line: any) => 
        sum + parseStockValue(line['Received Qty'] ?? line['Received'] ?? line['received'] ?? line['recvQty'] ?? 0), 0);
      
      // Calculate weighted average unit cost from line items (use Item Recent Cost when PO line has no price)
      const recentUnitCost = (() => {
        if (poLines.length > 0) {
          const items = (data?.['Items.json'] ?? data?.['MIITEM.json'] ?? []) as any[];
          const itemByNo: Record<string, any> = {};
          items.forEach((r: any) => {
            const k = (r['Item No.'] ?? r['Item'] ?? r['ItemNo'] ?? '').toString().trim().toUpperCase();
            if (k) itemByNo[k] = r;
          });
          const totalOrderValue = poLines.reduce((sum: number, line: any) => {
            let unitPrice = parseCostValue(line['Unit Price'] || line['Cost'] || line['Unit Cost'] || 0);
            if (unitPrice <= 0) {
              const ino = (line['Item No.'] ?? line['Part No.'] ?? line['itemId'] ?? '').toString().trim().toUpperCase();
              const itemRow = ino ? itemByNo[ino] : null;
              unitPrice = itemRow ? parseCostValue(itemRow['Recent Cost'] ?? itemRow['cLast'] ?? itemRow['Last Cost'] ?? 0) : 0;
            }
            const orderedQty = parseStockValue(line['Ordered Qty'] ?? line['Ordered'] ?? line['ordered'] ?? line['ordQty'] ?? 0);
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
          const receivedQty = parseStockValue(line['Received Qty'] ?? line['Received'] ?? line['received'] ?? line['recvQty'] ?? 0);
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
        orderDate: po['Order Date'] ?? po['ordDt'] ?? '',
        requiredDate: po['Required Date'] ?? po['reqDt'] ?? '',
        terms: po['Terms'] || '',
        fob: po['FOB'] || '',
        shipVia: po['Ship Via'] || '',
        freight: po['Freight'] || '',
        currency: po['Home Currency'] || po['Source Currency'] || 'CAD',
        printStatus: po['Print Status'] || '',
        totalAmount: parseCostValue(po['Total Amount'] || 0),
        receivedAmount: parseCostValue(po['Received Amount'] || po['Total Received'] || 0),
        invoicedAmount: parseCostValue(po['Invoiced Amount'] || po['Total Invoiced'] || po['Billed Amount'] || 0),
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

    const lines = poDetailsSource.map((line: any) => {
      const ordered = parseStockValue(line['Ordered Qty'] ?? line['Ordered'] ?? line['ordered'] ?? line['ordQty'] ?? 0);
      const received = parseStockValue(line['Received Qty'] ?? line['Received'] ?? line['received'] ?? line['recvQty'] ?? 0);
      const unitPrice = parseCostValue(line['Unit Price'] ?? line['Unit Cost'] ?? line['Cost'] ?? 0);
      return {
        poId: line['PO No.'] || '',
        lineNo: Number(line['Line No.']) || 0,
        itemId: (line['Item No.'] || line['Part No.'] || '').toString().trim().toUpperCase(),
        description: line['Description'] || '',
        orderedQty: ordered,
        unitPrice,
        location: line['Location No.'] ?? line['Location'] ?? '',
        requiredDate: line['Required Date'] || '',
        receivedQty: received,
        billedQty: parseStockValue(line['Billed Qty'] ?? 0),
        remainingQty: ordered - received
      } as PoLine;
    });

    return { headers, lines };
  }, [data, poHeadersSource, poDetailsSource]);

  // Get PO lines for a specific PO
  const getPOLines = (poId: string) => {
    return processPurchaseOrders.lines.filter((line: PoLine) => line.poId === poId);
  };

  // Smart function to determine which PO columns have actual data
  const getAvailablePOColumns = useMemo(() => {
    const pos = poHeadersSource;
    if (pos.length === 0) return [];

    const columns = [
      { key: 'PO No.', label: 'PO Number', required: true, fallback: 'pohId' },
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
        const lineItems = poDetailsSource;
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
        let value = po[col.key] || (col.fallback ? po[col.fallback] : null);
        if (col.key === 'PO No.' && !value) value = po['pohId'];
        if (col.key === 'Supplier No.' && !value) value = po['suplId'] || po['Vendor No.'];
        if (col.key === 'Total Amount' && value == null) value = po['totalAmt'] || po['Total'];
        if (col.key === 'Invoiced Amount' && value == null) value = po['Total Invoiced'] || po['totInvoiced'];
        if (col.key === 'Order Date' && !value) value = po['ordDt'];
        if (col.key === 'Close Date' && !value) value = po['closeDt'];
        return value && value !== '' && value !== 0 && value !== '0';
      });
      
      return hasData;
    });
  }, [data, poHeadersSource, poDetailsSource]);

  // Smart function to determine which PO detail columns have actual data
  const getAvailablePODetailColumns = useMemo(() => {
    const details = poDetailsSource;
    if (details.length === 0) return [];

    const columns = [
      { key: 'Line No.', label: 'Line', required: true },
      { key: 'Item No.', label: 'Item No.', required: true, fallback: 'Part No.' },
      { key: 'Description', label: 'Description' },
      { key: 'Ordered Qty', label: 'Ordered Qty', fallback: 'Ordered' },
      { key: 'Received Qty', label: 'Received Qty', fallback: 'Received' },
      { key: 'Unit Price', label: 'Unit Price', fallback: 'Price' },
      { key: '_ItemRecentCost', label: 'Item Recent Cost', required: true },
      { key: 'Required Date', label: 'Required Date', fallback: 'Due Date' },
      { key: 'Location', label: 'Location', fallback: 'Location No.' },
      { key: 'Billed Qty', label: 'Billed Qty' },
      { key: 'Extended Price', label: 'Extended Price' },
      { key: 'Manufacturing Order No.', label: 'MO Ref', fallback: 'mohId' },
    ];

    return columns.filter(col => {
      if (col.required) return true;
      
      const hasData = details.some((detail: any) => {
        const value = detail[col.key] || (col.fallback ? detail[col.fallback] : null);
        return value && value !== '' && value !== 0 && value !== '0';
      });
      
      return hasData;
    });
  }, [data, poDetailsSource]);

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

  // Debounced real-time SO search (same API as Proforma Invoice search)
  React.useEffect(() => {
    if (soSearchDebounceRef.current) clearTimeout(soSearchDebounceRef.current);
    if (soSearchAbortRef.current) soSearchAbortRef.current.abort();

    const q = soSearchQuery.trim();
    if (!q) {
      setSoSearchResults([]);
      setSoSearching(false);
      return;
    }

    setSoSearching(true);
    soSearchDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      soSearchAbortRef.current = controller;
      try {
        const resp = await fetch(getApiUrl(`/api/proforma-invoice/search-so?q=${encodeURIComponent(q)}`), {
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error('Search failed');
        const json = await resp.json();
        setSoSearchResults(json.results || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('SO search error:', err);
          setSoSearchResults([]);
        }
      } finally {
        setSoSearching(false);
      }
    }, 300);

    return () => {
      if (soSearchDebounceRef.current) clearTimeout(soSearchDebounceRef.current);
    };
  }, [soSearchQuery]);
  
  // MO details modal state
  const [selectedMO, setSelectedMO] = useState<any>(null);
  const [showMODetails, setShowMODetails] = useState(false);
  const [moActiveTab, setMoActiveTab] = useState('overview');
  const [moComponentsView, setMoComponentsView] = useState<'grouped' | 'exact'>('grouped');
  // Full SO details fetched from the PDF parser when the pegged tab is active
  const [moParsedSO, setMoParsedSO] = useState<any>(null);
  const [moParsedSOLoading, setMoParsedSOLoading] = useState(false);
  const [moParsedSOError, setMoParsedSOError] = useState('');
  const [moTxTypeFilter, setMoTxTypeFilter] = useState<string>('');
  const [moTxItemFilter, setMoTxItemFilter] = useState<string>('');

  // MO view for modal (MiSys-style UI-ready data, derived from selectedMO)
  const selectedMoNo = (selectedMO?.['Mfg. Order No.'] ?? selectedMO?.['MO No.'] ?? selectedMO?.['MO'] ?? selectedMO?.['mohId'] ?? '').toString().trim();
  const moView = useMemo(() => {
    if (!selectedMoNo) return null;
    return buildMOView(data, indexes, selectedMoNo);
  }, [data, indexes, selectedMoNo]);

  const moExactLines = useMemo(() => {
    if (!selectedMoNo || !indexes) return [];
    return buildMOExactLines(indexes, selectedMoNo);
  }, [indexes, selectedMoNo]);

  const selectedItemNo = (selectedItem?.['Item No.'] ?? selectedItem?.['itemId'] ?? '').toString().trim();
  const itemView = useMemo(() => {
    if (!selectedItemNo) return null;
    const fromIndexes = buildItemView(data, indexes, selectedItemNo);
    if (fromIndexes) return fromIndexes;
    if (selectedItem && (selectedItem['Item No.'] || selectedItem.itemId)) return buildItemView(data, indexes, selectedItemNo, selectedItem);
    return null;
  }, [data, indexes, selectedItemNo, selectedItem]);

  const bomView = useMemo(() => {
    if (!selectedItemNo) return null;
    return buildBOMView(data, indexes, selectedItemNo);
  }, [data, indexes, selectedItemNo]);

  const itemLotSummaryView = useMemo(() => {
    if (!selectedItemNo) return { itemNo: '', lots: [], serialRows: [], lotHistoryRows: [], hasData: false };
    return buildItemLotSummaryView(data, selectedItemNo);
  }, [data, selectedItemNo]);

  // Fetch Sage item mapping when item modal opens (for display in header)
  useEffect(() => {
    if (!showItemModal || !selectedItemNo) {
      setItemSageMapping(null);
      return;
    }
    fetch(getApiUrl(`/api/sage/item-mapping?misys_item_id=${encodeURIComponent(selectedItemNo)}`))
      .then((r) => r.json())
      .then((res) => {
        const m = res?.mapping;
        setItemSageMapping(m && (m.sage_part_code || m.sage_item_id) ? m : null);
      })
      .catch(() => setItemSageMapping(null));
  }, [showItemModal, selectedItemNo]);

  const moTransactionView = useMemo(() => {
    if (!moView?.moNo) return { rows: [], totalCount: 0, filters: {}, hasData: false };
    return buildTransactionSearchView(txIndexes, { docRef: moView.moNo, limit: 200 });
  }, [txIndexes, moView?.moNo]);

  /** MO overlay events (portal_store) + ledger rows, combined and sorted by date */
  const moTransactionRows = useMemo(() => {
    if (!moView?.moNo) return [];
    const moNo = moView.moNo.toString().trim();
    const overlay: any[] = (data?.['moEvents'] || []).filter((e: any) => (e.moNo || e.mo_no || '').toString().trim() === moNo);
    const ledger = moTransactionView.rows || [];
    const combined = [
      ...overlay.map((e) => ({
        date: e.ts || e.date || '',
        type: e.type || 'MO_EVENT',
        itemNo: e.itemNo || e.item_no || '',
        qtyIn: (e.qty || 0) > 0 ? e.qty : null,
        qtyOut: (e.qty || 0) < 0 ? Math.abs(e.qty) : null,
        location: e.location || '',
        lotNo: e.lotNo || e.lot_no || '',
        user: e.user || '',
        ref: e.ref || '',
        source: 'overlay' as const,
      })),
      ...ledger.map((r) => ({
        date: r.date || '',
        type: r.type || '—',
        itemNo: r.itemNo || '',
        qtyIn: r.qty != null && r.qty > 0 ? r.qty : null,
        qtyOut: r.qty != null && r.qty < 0 ? Math.abs(r.qty) : null,
        location: r.location || '',
        lotNo: r.lot || '',
        user: r.user || '',
        ref: r.reference || '',
        source: 'ledger' as const,
      })),
    ];
    return combined.sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return db.localeCompare(da);
    });
  }, [data, moView?.moNo, moTransactionView.rows]);

  const filteredMoTransactionRows = useMemo(() => {
    let rows = moTransactionRows;
    if (moTxTypeFilter) {
      rows = rows.filter((r) => (r.type || '').toLowerCase().includes(moTxTypeFilter.toLowerCase()));
    }
    if (moTxItemFilter) {
      rows = rows.filter((r) => (r.itemNo || '').toLowerCase().includes(moTxItemFilter.toLowerCase()));
    }
    return rows;
  }, [moTransactionRows, moTxTypeFilter, moTxItemFilter]);

  const moItemLotSummaryView = useMemo(() => {
    if (!moView?.buildItemNo) return { itemNo: '', lots: [], serialRows: [], lotHistoryRows: [], hasData: false };
    return buildItemLotSummaryView(data, moView.buildItemNo);
  }, [data, moView?.buildItemNo]);
  
  // PO details modal state
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showPODetails, setShowPODetails] = useState(false);
  const [poActiveTab, setPoActiveTab] = useState('overview');
  
  // Drilldown "See more" modals (Lot, Supplier, Location, Bin, WO)
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [showLotDetail, setShowLotDetail] = useState(false);
  const [selectedSuplId, setSelectedSuplId] = useState<string | null>(null);
  const [showSupplierDetail, setShowSupplierDetail] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [showLocationDetail, setShowLocationDetail] = useState(false);
  const [selectedBinLocId, setSelectedBinLocId] = useState<string | null>(null);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [showBinDetail, setShowBinDetail] = useState(false);
  const [selectedWOHId, setSelectedWOHId] = useState<string | null>(null);
  const [showWODetail, setShowWODetail] = useState(false);

  const selectedPONo = (selectedPO?.['PO No.'] ?? selectedPO?.['pohId'] ?? selectedPO?.['Purchase Order No.'] ?? '').toString().trim();
  const poView = useMemo(() => {
    if (!selectedPONo) return null;
    return buildPOView(data, indexes, selectedPONo);
  }, [data, indexes, selectedPONo]);

  const lotTraceView = useMemo(() => {
    if (!selectedLotId) return null;
    return buildLotTraceView(data, selectedLotId);
  }, [data, selectedLotId]);
  
  // Helpers: open PO/MO/Item by id (for clickable keys in tables)
  const openPOById = (poId: string) => {
    if (!poId || !data) return;
    const raw = poHeadersSource.find((h: any) => (h['PO No.'] ?? h['pohId'] ?? '').toString().trim() === (poId || '').toString().trim());
    const fromProcessed = processPurchaseOrders.headers.find((h: any) => (h.poId ?? '').toString().trim() === (poId || '').toString().trim());
    const header = raw || (fromProcessed ? { 'PO No.': fromProcessed.poId, 'Supplier No.': fromProcessed.vendor, 'Name': fromProcessed.vendor, 'Order Date': fromProcessed.orderDate, 'Status': fromProcessed.status } : null);
    if (header) { setSelectedPO(header); setShowPODetails(true); }
  };
  const openMOById = (mohId: string) => {
    if (!mohId || !data) return;
    const raw = (data['ManufacturingOrderHeaders.json'] || data['MIMOH.json'] || []).find((h: any) => (h['Mfg. Order No.'] ?? h['mohId'] ?? '').toString().trim() === (mohId || '').toString().trim());
    if (raw) { setSelectedMO(raw); setShowMODetails(true); }
  };
  const openItemById = (itemId: string) => {
    if (!itemId || !data) return;
    const items = data['Items.json'] || data['MIITEM.json'] || [];
    const upper = (itemId || '').toString().trim().toUpperCase();
    const item = (items as any[]).find((i: any) => (i['Item No.'] || i['itemId'] || '').toString().trim().toUpperCase() === upper);
    const toOpen = item || { 'Item No.': itemId, itemId, 'Description': 'Item not in master' };
    setSelectedItem(toOpen);
    setShowItemModal(true);
  };
  const transactionExplorerRef = React.useRef<HTMLDivElement>(null);
  const openTransactionExplorerWithFilters = (filters: { itemNo?: string; docRef?: string }) => {
    setTxExplorerFilters((prev) => ({ ...prev, ...filters }));
    setShowTransactionExplorer(true);
    setActiveSection('inventory');
    setShowItemModal(false);
    setShowPODetails(false);
    setShowMODetails(false);
    setTimeout(() => transactionExplorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  };
  
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

  // Sorting functions for interactive tables
  const sortData = (data: any[], field: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      // Fallback keys for MO/PO numbers
      if (field === 'Mfg. Order No.' && (aVal == null || bVal == null)) {
        aVal = aVal ?? a['mohId'] ?? a['MO No.'];
        bVal = bVal ?? b['mohId'] ?? b['MO No.'];
      }
      if (field === 'PO No.' && (aVal == null || bVal == null)) {
        aVal = aVal ?? a['pohId'] ?? a['Purchase Order No.'];
        bVal = bVal ?? b['pohId'] ?? b['Purchase Order No.'];
      }
      // Handle MO/PO number fields - coerce to number for proper numeric sort (latest first when desc)
      if ((field === 'Mfg. Order No.' || field === 'PO No.') && (aVal != null || bVal != null)) {
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return direction === 'asc' ? aNum - bNum : bNum - aNum;
        }
      }
      // Handle dates with proper MISys conversion
      if (field.includes('Date') && (aVal || bVal)) {
        const aDate = parseMISysDate(aVal);
        const bDate = parseMISysDate(bVal);
        
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
        mo['Batch No.'],
        mo['Batch Number'],
        getCustomerName(mo),
        mo['Build Item No.'],
        mo['Description'],
        mo['Non-Stocked Build Item Description'],
        mo['Location No.'],
        mo['Sales Location'],
        mo['Work Center'],
        mo['Sales Order No.'],
        mo['SO No.'],
        mo['Job No.'],
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

  // Unique suppliers from existing POs (for Create PO dropdown)
  const poSuppliersList = useMemo(() => {
    const pos = poHeadersSource;
    const seen = new Set<string>();
    const out: { supplier_no: string; supplier_name: string }[] = [];
    pos.forEach((po: any) => {
      const no = (po['Supplier No.'] || po['Name'] || po['Vendor No.'] || '').toString().trim();
      if (!no || seen.has(no)) return;
      seen.add(no);
      out.push({
        supplier_no: no,
        supplier_name: (po['Name'] || po['Supplier No.'] || no).toString().trim()
      });
    });
    return out.sort((a, b) => a.supplier_no.localeCompare(b.supplier_no));
  }, [data]);

  // Smart search function for Purchase Orders
  const searchPurchaseOrders = useMemo(() => {
    if (!poSearchQuery.trim()) {
      return poHeadersSource;
    }

    const query = poSearchQuery.toLowerCase().trim();
    const searchTerms = query.split(' ').filter(term => term.length > 0);

    return poHeadersSource.filter((po: any) => {
      // Create searchable text from all relevant fields
      const searchableFields = [
        po['PO No.'],
        po['pohId'],
        po['Supplier No.'],
        po['Name'],
        po['suplId'],
        po['Vendor No.'],
        po['Buyer'],
        po['Terms'],
        po['Ship Via'],
        po['FOB'],
        po['Contact'],
        po['Source Currency'],
        po['Home Currency'],
        ((po['Status'] ?? po['poStatus']) === 0 || (po['Status'] ?? po['poStatus']) === '0') ? 'open active' : 
        ((po['Status'] ?? po['poStatus']) === 1 || (po['Status'] ?? po['poStatus']) === '1') ? 'pending' : 
        ((po['Status'] ?? po['poStatus']) === 2 || (po['Status'] ?? po['poStatus']) === '2') ? 'closed completed' : 
        ((po['Status'] ?? po['poStatus']) === 3 || (po['Status'] ?? po['poStatus']) === '3') ? 'cancelled' : '',
        // Add formatted dates for search
        (po['Order Date'] ?? po['ordDt']) ? formatDisplayDate(po['Order Date'] ?? po['ordDt']) : '',
        (po['Close Date'] ?? po['closeDt']) ? formatDisplayDate(po['Close Date'] ?? po['closeDt']) : '',
        // Add amounts as searchable text
        (po['Total Amount'] ?? po['totalAmt'] ?? po['Total']) ? `$${Number(po['Total Amount'] ?? po['totalAmt'] ?? po['Total']).toLocaleString()}` : '',
        (po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced']) ? `$${Number(po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced']).toLocaleString()}` : '',
        (po['Received Amount'] ?? po['Total Received'] ?? po['totReceived']) ? `$${Number(po['Received Amount'] ?? po['Total Received'] ?? po['totReceived']).toLocaleString()}` : '',
        po['Freight'] ? `$${Number(po['Freight']).toLocaleString()}` : ''
      ].filter(Boolean).join(' ').toLowerCase();

      // Check if all search terms are found in the searchable text (partial matching)
      return searchTerms.every(term => searchableFields.includes(term));
    });
  }, [data, poSearchQuery, poHeadersSource]);

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
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{startItem}</span>–<span className="font-semibold text-slate-900">{endItem}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalItems}</span>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-500 font-medium">Per page:</label>
            <select 
              value={itemsPerPage} 
              onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 bg-white font-medium"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          {getPageNumbers().map((page, index) => (
            page === '...' ? (
              <span key={index} className="px-3 py-2 text-sm text-slate-500">...</span>
            ) : (
              <button
                key={index}
                onClick={() => onPageChange(page as number)}
                className={`px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
                  currentPage === page
                    ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            )
          ))}
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

  // Function to delete PR history entry
  const deletePRHistory = async (prId: string) => {
    if (!confirm(`Are you sure you want to delete PR ${prId}?`)) return;
    
    try {
      const response = await fetch(getApiUrl(`/api/pr/history/${prId}`), {
        method: 'DELETE'
      });
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Deleted', message: `PR ${prId} deleted successfully` });
        // Remove from local state immediately for snappy UI
        setPRHistory(prev => prev.filter(pr => pr.id !== prId));
      } else {
        addToast({ type: 'error', title: 'Error', message: 'Failed to delete PR' });
      }
    } catch (error) {
      console.error('Error deleting PR:', error);
      addToast({ type: 'error', title: 'Error', message: 'Error deleting PR' });
    }
  };

  // Function to update PR history entry (status, notes, PO number)
  const updatePRHistory = async (prId: string, updates: { status?: string; notes?: string; po_number?: string }) => {
    try {
      const response = await fetch(getApiUrl(`/api/pr/history/${prId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Updated', message: `PR updated: ${updates.status || 'saved'}` });
        // Update local state immediately
        setPRHistory(prev => prev.map(pr => 
          pr.id === prId ? { ...pr, ...updates, updated_at: new Date().toISOString() } : pr
        ));
        setEditingPRId(null);
      } else {
        addToast({ type: 'error', title: 'Error', message: 'Failed to update PR' });
      }
    } catch (error) {
      console.error('Error updating PR:', error);
      addToast({ type: 'error', title: 'Error', message: 'Error updating PR' });
    }
  };

  // Function to add PR items to BOM cart
  const addPRItemsToCart = (prItems: any[]) => {
    const newCartItems: Array<{ item_no: string; description: string; qty: number }> = prItems.map((item: any) => ({
      item_no: item.item_no || '',
      description: item.description || '',
      qty: item.order_qty || item.qty || item.qty_needed || 1
    }));
    
    setBomCart(prev => {
      const updated = [...prev];
      newCartItems.forEach(newItem => {
        const existing = updated.find(i => i.item_no === newItem.item_no);
        if (existing) {
          existing.qty += newItem.qty;
        } else {
          updated.push(newItem);
        }
      });
      return updated;
    });
    
    addToast({ 
      type: 'success', 
      title: 'Cart',
      message: `Added ${newCartItems.length} items to cart`,
      action: { label: 'View Cart', onClick: () => setShowBomCart(true) }
    });
  };

  // Filtered PR history based on search and status
  const filteredPRHistory = useMemo(() => {
    let filtered = prHistory;
    
    // Apply status filter
    if (prHistoryStatusFilter !== 'all') {
      filtered = filtered.filter(pr => pr.status === prHistoryStatusFilter);
    }
    
    // Apply search filter
    if (prHistorySearch.trim()) {
      const search = prHistorySearch.toLowerCase();
      filtered = filtered.filter(pr => 
        pr.id?.toLowerCase().includes(search) ||
        pr.user?.toLowerCase().includes(search) ||
        pr.justification?.toLowerCase().includes(search) ||
        pr.po_number?.toLowerCase().includes(search) ||
        pr.notes?.toLowerCase().includes(search) ||
        pr.short_items_detail?.some((item: any) => item.item_no?.toLowerCase().includes(search)) ||
        pr.suppliers?.some((s: any) => s.supplier_name?.toLowerCase().includes(search) || s.supplier_no?.toLowerCase().includes(search))
      );
    }
    
    return filtered;
  }, [prHistory, prHistorySearch, prHistoryStatusFilter]);

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
        const parentItem = (data['Items.json'] || [])
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

  // Enterprise-level metrics calculation - CANOIL STOCK ONLY (excludes customer stock)
  const inventoryMetrics = useMemo(() => {
    const items = data['Items.json'] || [];
    const totalItems = items.length;
    
    // Calculate total value using CANOIL stock only
    const totalValue = items.reduce((sum: number, item: any) => {
      const canoilStock = getCanoilStock(item["Item No."], data);
      const cost = parseCostValue(item["Recent Cost"] || item["Unit Cost"] || item["Standard Cost"]);
      return sum + (canoilStock * cost);
    }, 0);
    
    // Low stock based on CANOIL stock only
    const lowStockItems = items.filter((item: any) => {
      const canoilStock = getCanoilStock(item["Item No."], data);
      const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
      return canoilStock <= reorderLevel && reorderLevel > 0 && canoilStock > 0;
    });
    
    // Out of stock based on CANOIL stock only (Canoil has 0, regardless of customer stock)
    const outOfStockItems = items.filter((item: any) => {
      const canoilStock = getCanoilStock(item["Item No."], data);
      return canoilStock === 0;
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
    // Status comes as strings: '0' = Open, '1' = Released/Active, '2' = Closed/Completed
    const pending = allMOs.filter((mo: any) => String(mo["Status"]) === '0').length;
    const active = allMOs.filter((mo: any) => String(mo["Status"]) === '1').length;
    const closed = allMOs.filter((mo: any) => String(mo["Status"]) === '2').length;
    const activeMOsList = allMOs.filter((mo: any) => String(mo["Status"]) === '0' || String(mo["Status"]) === '1');
    const totalValue = activeMOsList.reduce((sum: number, mo: any) => {
      const cost = parseFloat(mo["Cumulative Cost"] || mo["Total Material Cost"] || 0);
      return sum + cost;
    }, 0);
    return { pending, active, closed, total: activeMOsList.length, totalValue, totalAllMOs: allMOs.length };
  }, [data]);

  const purchaseMetrics = useMemo(() => {
    const purchaseDetails = poDetailsSource;
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

  // Pre-compute assembled items (PERFORMANCE: do once, not in render loop) - uses indexes
  const assembledItemsSet = useMemo(() => {
    const set = new Set<string>();
    indexes.bomDetailsByParent.forEach((_, parent) => {
      if (parent) set.add(parent);
    });
    return set;
  }, [indexes]);

  // Filtered inventory with sorting and filtering - Uses CANOIL STOCK ONLY
  const filteredInventory = useMemo(() => {
    let items = data['Items.json'] || [];
    
    // Apply inventory filter (low-stock, out-of-stock, raw/assembled/formula) - CANOIL STOCK ONLY
    if (inventoryFilter === 'low-stock') {
      items = items.filter((item: any) => {
        const canoilStock = getCanoilStock(item["Item No."], data);
        const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
        return canoilStock <= reorderLevel && reorderLevel > 0 && canoilStock > 0;
      });
    } else if (inventoryFilter === 'out-of-stock') {
      items = items.filter((item: any) => {
        const canoilStock = getCanoilStock(item["Item No."], data);
        return canoilStock === 0;
      });
    } else if (inventoryFilter === 'raw') {
      items = items.filter((item: any) => String(item["Item Type"] ?? '') === '0' || item["Item Type"] === 0);
    } else if (inventoryFilter === 'assembled') {
      items = items.filter((item: any) => String(item["Item Type"] ?? '') === '1' || item["Item Type"] === 1);
    } else if (inventoryFilter === 'formula') {
      items = items.filter((item: any) => String(item["Item Type"] ?? '') === '2' || item["Item Type"] === 2);
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

  // Helper function to get customer name - always returns a string (from MO or Sales Order)
  // MISys data may have Customer as numeric ID - always coerce to string before .trim()
  const getCustomerName = useMemo(() => {
    const salesOrders = [
      ...(data['SalesOrderHeaders.json'] || []),
      ...(data['SalesOrders.json'] || []),
    ];

    // Build a fast lookup: SO number (digits only) → customer name
    const soCustomerMap = new Map<string, string>();
    for (const so of salesOrders) {
      const num = String(so['Order No.'] || so['Sales Order No.'] || so['SO Number'] || so['Order Number'] || '').trim();
      if (!num) continue;
      const customer = String(so['Customer'] || so['Customer Name'] || so['customer_name'] || '').trim();
      if (customer) soCustomerMap.set(num.replace(/\D/g, ''), customer);
    }

    const soPatterns = [
      /\bSO\s*#?\s*(\d{3,6})\b/i,
      /\bS\.?O\.?\s*#?\s*(\d{3,6})\b/i,
      /Sales\s*Order\s*#?\s*(\d{3,6})/i,
      /SO:\s*(\d{3,6})/i,
    ];

    return (mo: any): string => {
      // 1. MO's own Customer field (most reliable)
      const moCustomer = String(mo['Customer'] || '').trim();
      if (moCustomer) return moCustomer;

      // 2. Dedicated Sales Order No. field
      const directSO = String(mo['Sales Order No.'] || mo['Sales Order Number'] || mo['Sales Order'] || '').trim();
      if (directSO) {
        const hit = soCustomerMap.get(directSO.replace(/\D/g, ''));
        if (hit) return hit;
      }

      // 3. SO number extracted from the MO description text
      const desc = String(mo['Description'] || '').trim();
      if (desc) {
        for (const p of soPatterns) {
          const m = desc.match(p);
          if (m) {
            const hit = soCustomerMap.get(m[1]);
            if (hit) return hit;
          }
        }
      }

      return 'Internal';
    };
  }, [data['SalesOrderHeaders.json'], data['SalesOrders.json']]);

  // ENHANCED CUSTOMER ANALYSIS - Real business intelligence with smart name combining
  const customerAnalytics = useMemo(() => {
    const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
    const customers: { [key: string]: any } = {};

    // Smart company name normalization function (name may be number from MISys)
    const normalizeCompanyName = (name: string | number | null | undefined): string => {
      if (name == null) return '';
      let normalized = String(name).trim();
      
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
      
      // Product diversity (Build Item No. may be numeric in MISys)
      const product = mo["Build Item No."];
      if (product != null) {
        const p = String(product).trim();
        if (p) customer.products.add(p);
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

  const MONTH_NAMES: Record<string, string> = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December',
  };
  const displayFolderName = (name: string) => MONTH_NAMES[name] || name;

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
        <div ref={navRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5 max-w-7xl mx-auto mb-6 md:mb-8">
          
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
                {poHeadersSource.length} Orders
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

          {/* ERP PORTAL - Full ERP system (Phase 1-4) */}
          <button 
            onClick={() => setActiveSection('erp-portal')}
            className={`group relative rounded-3xl border-2 border-transparent transition-all duration-500 cursor-pointer overflow-hidden ${
              activeSection === 'erp-portal'
                ? 'bg-gradient-to-br from-rose-500 via-pink-600 to-red-700 text-white shadow-2xl shadow-rose-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                🏢
              </div>
              <div className={`text-base font-extrabold tracking-wide text-center ${activeSection === 'erp-portal' ? 'text-white' : 'text-slate-800'}`}>
                ERP<br/>PORTAL
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'erp-portal' ? 'text-rose-100' : 'text-rose-600'}`}>
                Full Enterprise System
              </div>
            </div>
          </button>

          {/* Reports */}
          <button
            onClick={() => setActiveSection('report-maker')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'report-maker'
                ? 'bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 text-white shadow-2xl shadow-blue-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                📋
              </div>
              <div className={`text-base font-extrabold tracking-wide ${activeSection === 'report-maker' ? 'text-white' : 'text-slate-800'}`}>
                REPORTS
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'report-maker' ? 'text-blue-100' : 'text-blue-600'}`}>
                Smart Analytics
              </div>
            </div>
          </button>

          {/* Production Schedule */}
          <button
            onClick={() => onOpenProductionSchedule ? onOpenProductionSchedule() : setActiveSection('production-schedule')}
            className={`group relative rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden ${
              activeSection === 'production-schedule'
                ? 'bg-gradient-to-br from-emerald-500 via-cyan-600 to-teal-700 text-white shadow-2xl shadow-emerald-500/40 scale-[1.02]' 
                : 'bg-white/90 backdrop-blur-sm text-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:bg-white'
            }`}
            style={{ minHeight: '160px' }}
          >
            <div className="relative flex flex-col items-center justify-center h-full p-5">
              <span className="absolute top-3 right-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1.5 shadow-lg ring-2 ring-white/50 z-10">
                LIVE
              </span>
              <div className="text-5xl mb-3 transform transition-transform duration-300 group-hover:scale-110 drop-shadow-lg">
                📅
              </div>
              <div className={`text-base font-extrabold tracking-wide text-center ${activeSection === 'production-schedule' ? 'text-white' : 'text-slate-800'}`}>
                PRODUCTION<br/><span className="text-xs font-bold">SCHEDULE</span>
              </div>
              <div className={`text-xs mt-1 font-medium ${activeSection === 'production-schedule' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                MPS & Gantt
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
                {activeSection === 'report-maker' && 'Reports'}
                {activeSection === 'email-assistant' && 'Email Assistant'}
                {activeSection === 'work-orders' && 'Work Orders'}
                {activeSection === 'production-schedule' && 'Production Schedule'}
                {activeSection === 'intelligence' && 'AI Intelligence'}
                {activeSection === 'erp-portal' && 'ERP Portal'}
              </span>
            </nav>
          </div>
        )}

        {/* CONTENT SECTIONS */}
        <div className="max-w-7xl mx-auto" ref={contentRef}>
          
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
                  activeJobs: (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => String(mo['Status']) !== '2').length,
                  activeWorkOrders: (data['ManufacturingOrderDetails.json'] || []).filter((mo: any) => String(mo['Status']) === '1').length,
                  completedJobs: (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => String(mo['Status']) === '2').length,
                  totalJobs: (data['ManufacturingOrderHeaders.json'] || []).filter((mo: any) => String(mo['Status']) !== '2').length,
                  totalJobValue: 0
                }}
                formatCAD={formatCAD}
                onNavigate={setActiveSection}
                currentUser={currentUser}
              />
            </div>
          )}

          {/* Production Schedule: redirect to full app (no embedded section) */}
          {activeSection === 'production-schedule' && (
            <div className="p-6 max-w-2xl mx-auto">
              <div className="rounded-2xl bg-slate-800/50 border border-white/10 p-8 text-center">
                <h3 className="text-lg font-bold text-white mb-2">Production Schedule</h3>
                <p className="text-slate-400 text-sm mb-6">Open the full Production Schedule for the Gantt chart and scheduling.</p>
                <button
                  onClick={() => onOpenProductionSchedule?.()}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-xl font-bold text-sm"
                >
                  Open full Production Schedule
                </button>
              </div>
            </div>
          )}

          {/* ERP Portal */}
          {activeSection === 'erp-portal' && (
            <ERPPortal data={data} currentUser={currentUser} />
          )}

          {/* AI Command Center */}
          {activeSection === 'ai-command' && (
            <AICommandCenter
              data={data}
              onBack={() => setActiveSection('dashboard')}
              onNavigate={setActiveSection}
              onItemClick={(item) => {
                setSelectedItem(item);
                setItemModalActiveView('master');
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
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-slate-50/80 border-b border-slate-100 px-6 py-5">
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <Settings className="w-8 h-8 text-blue-600" />
                    Work Orders (Service/Maintenance)
                    <span className="text-sm font-medium text-slate-600 bg-slate-100/80 px-3 py-1 rounded-full">
                      {(data?.['WorkOrders.json'] || []).length} orders
                    </span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Release and report completion for work orders. Data from backend.</p>
                </div>
                {(!data?.['WorkOrders.json'] || data['WorkOrders.json'].length === 0) ? (
                  <div className="p-8 text-center text-slate-500">
                    <p>No work orders in data. Ensure your MISys Full Company Data export includes MIWOH/MIWOD and the data folder is loaded.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto px-6 pb-6 bg-slate-50/30 rounded-b-2xl">
                    <div className="data-list data-list-wo">
                      <div className="data-list-header sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 -mx-5 px-5">
                        <span className="w-[72px] shrink-0">WO #</span>
                        <span className="flex-1 min-w-0">Order</span>
                        <span className="w-24 shrink-0">Status</span>
                        <span className="w-28 shrink-0">Date</span>
                        <span className="w-20 shrink-0 text-right">Done</span>
                        <span className="w-28 shrink-0 text-right">Actions</span>
                      </div>
                        {(data['WorkOrders.json'] || []).map((wo: any, idx: number) => {
                          const woNo = (wo['Work Order No.'] || wo['Job No.'] || '').toString().trim();
                          const status = wo['Status'] ?? wo['status'];
                          const statusInfo = status === 0 || status === '0' ? { text: 'Planned', color: 'bg-yellow-100 text-yellow-700' } :
                            status === 1 || status === '1' ? { text: 'Released', color: 'bg-green-100 text-green-700' } :
                            status === 2 || status === '2' ? { text: 'Complete', color: 'bg-gray-100 text-gray-700' } :
                            { text: 'Unknown', color: 'bg-slate-100 text-slate-600' };
                          return (
                            <div key={woNo || idx} className="data-list-card" onClick={() => {}}>
                              <div className="wo-id shrink-0">{woNo || '—'}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 truncate">{wo['Job No.'] || '—'}</div>
                                <div className="text-sm text-slate-500 truncate">{wo['Description'] || '—'}</div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold w-24 text-center shrink-0 ${statusInfo.color}`}>{statusInfo.text}</span>
                              <div className="w-28 text-sm text-slate-600 tabular-nums shrink-0">{wo['Release Date'] ? new Date(wo['Release Date']).toLocaleDateString() : '—'}</div>
                              <div className="w-20 text-right font-mono text-sm font-semibold text-emerald-600 tabular-nums shrink-0">{(wo['Completed'] ?? 0).toLocaleString()}</div>
                              <div className="w-28 flex justify-end gap-1 shrink-0">
                                {(status === 0 || status === '0') && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(getApiUrl(`/api/work-orders/${encodeURIComponent(woNo)}/release`), { method: 'POST' });
                                        if (res.ok) onRefreshData?.();
                                      } catch (_) {}
                                    }}
                                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200"
                                  >
                                    Release
                                  </button>
                                )}
                                {(status === 1 || status === '1' || status === 0 || status === '0') && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const qtyStr = prompt('Completed quantity?', '1');
                                      if (qtyStr == null) return;
                                      const qty = parseFloat(qtyStr);
                                      if (isNaN(qty) || qty <= 0) return;
                                      const scrapStr = prompt('Scrap (optional)', '0');
                                      const scrap = scrapStr != null && scrapStr !== '' ? parseFloat(scrapStr) : 0;
                                      try {
                                        const res = await fetch(getApiUrl(`/api/work-orders/${encodeURIComponent(woNo)}/complete`), {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ completed_qty: qty, scrap: isNaN(scrap) ? 0 : scrap }),
                                        });
                                        if (res.ok) onRefreshData?.();
                                      } catch (_) {}
                                    }}
                                    className="ml-1 px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium hover:bg-violet-200"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manufacturing Orders - Modern list style */}
          {activeSection === 'manufacturing-orders' && (
            <div className="space-y-6">
              {/* Enterprise Manufacturing Header - Dark Premium (vibrant, not faded) */}
              <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-slate-600/60">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/25 via-transparent to-transparent"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-500/25 via-transparent to-transparent"></div>
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                  backgroundSize: '32px 32px'
                }}></div>
                
                <div className="relative p-6 lg:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                          <Factory className="w-7 h-7 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Manufacturing Operations</h2>
                        <p className="text-slate-400 text-sm font-medium mt-0.5 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 text-slate-400 text-xs">MIMOH / MIMOMD</span>
                          Full Company Data · Same source as Items &amp; PO
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        LIVE
                      </span>
                      <button
                        onClick={() => setShowExportAllCompanyDataModal(true)}
                        className="px-4 py-2.5 bg-white/10 backdrop-blur-sm text-slate-200 rounded-lg font-medium text-sm border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
                        title="Export all company data"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                      <button
                        onClick={async () => { await onRefreshData?.(); }}
                        className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-lg font-semibold text-sm hover:from-violet-600 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-violet-500/25"
                        title="Refresh data from backend"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                    </div>
                  </div>
                  
                  {/* Enterprise KPI Bar - Clickable to filter */}
                  {(() => {
                    const allMOs = data?.['ManufacturingOrderHeaders.json'] || [];
                    const totalCount = allMOs.length;
                    const releasedCount = allMOs.filter((mo: any) => mo.Status === 1).length;
                    const plannedCount = allMOs.filter((mo: any) => mo.Status === 0).length;
                    const completedCount = allMOs.filter((mo: any) => mo.Status === 3 || mo.Status === 4).length;
                    const now = new Date();
                    const pastDueCount = allMOs.filter((mo: any) => {
                      if (mo.Status !== 1 && mo.Status !== 2) return false;
                      const compDate = mo['Completion Date'] || mo['Close Date'];
                      if (!compDate) return false;
                      try { return new Date(compDate) < now; } catch { return false; }
                    }).length;
                    return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-slate-700/50">
                    <button type="button" onClick={() => { setMoStatusFilter('all'); setMoCustomerFilter('all'); setMoSearchQuery(''); setMoCurrentPage(1); }} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${moStatusFilter === 'all' && !moSearchQuery ? 'bg-violet-500/20 border-violet-400/40' : 'bg-white/10 border-white/10 hover:border-violet-400/40'}`}>
                      <div className="w-11 h-11 rounded-xl bg-violet-500/30 flex items-center justify-center">
                        <Factory className="w-5 h-5 text-violet-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{totalCount.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">Total Orders</div>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setMoStatusFilter('1'); setMoCustomerFilter('all'); setMoCurrentPage(1); }} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${moStatusFilter === '1' ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-white/10 border-white/10 hover:border-emerald-400/40'}`}>
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-emerald-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{releasedCount.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">In Production</div>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setMoStatusFilter('0'); setMoCustomerFilter('all'); setMoCurrentPage(1); }} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${moStatusFilter === '0' ? 'bg-amber-500/20 border-amber-400/40' : 'bg-white/10 border-white/10 hover:border-amber-400/40'}`}>
                      <div className="w-11 h-11 rounded-xl bg-amber-500/30 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{plannedCount.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">Awaiting Release</div>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setMoStatusFilter('3'); setMoCustomerFilter('all'); setMoCurrentPage(1); }} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${moStatusFilter === '3' || moStatusFilter === '4' ? 'bg-blue-500/20 border-blue-400/40' : 'bg-white/10 border-white/10 hover:border-blue-400/40'}`}>
                      <div className="w-11 h-11 rounded-xl bg-blue-500/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-blue-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{completedCount.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">Completed</div>
                      </div>
                    </button>
                    {pastDueCount > 0 && (
                    <button type="button" onClick={() => { setMoStatusFilter('all'); setMoCustomerFilter('all'); setMoSearchQuery('overdue'); setMoCurrentPage(1); }} className="flex items-center gap-4 p-4 rounded-xl bg-red-500/15 border border-red-400/30 hover:border-red-400/50 transition-colors text-left">
                      <div className="w-11 h-11 rounded-xl bg-red-500/30 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-300">{pastDueCount}</div>
                        <div className="text-red-300/80 text-xs font-semibold">Past Due</div>
                      </div>
                    </button>
                    )}
                  </div>
                    );
                  })()}
                </div>
              </div>

              {/* Manufacturing Orders Table - Enterprise */}
              {data?.['ManufacturingOrderHeaders.json'] && Array.isArray(data['ManufacturingOrderHeaders.json']) && data['ManufacturingOrderHeaders.json'].length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08), 0 8px 48px -12px rgba(0,0,0,0.04)' }}>
                    <div className="px-6 py-5 bg-slate-50/50">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex-1 min-w-[280px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search MO#, Customer, Item, Status, Dates..."
                              value={moSearchQuery}
                              onChange={(e) => { setMoSearchQuery(e.target.value); setMoCurrentPage(1); }}
                              className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-lg font-semibold text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 text-sm bg-white"
                            />
                          </div>
                          <select
                            value={moStatusFilter}
                            onChange={(e) => setMoStatusFilter(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 focus:ring-2 focus:ring-violet-500/20"
                          >
                            {(() => {
                              const allMOs = data?.['ManufacturingOrderHeaders.json'] || [];
                              const counts = { all: allMOs.length, '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 } as Record<string, number>;
                              allMOs.forEach((mo: any) => { const s = String(mo.Status ?? ''); if (counts[s] !== undefined) counts[s]++; });
                              return (
                                <>
                                  <option value="all">All Status ({counts.all})</option>
                                  <option value="0">Planned ({counts['0']})</option>
                                  <option value="1">Released ({counts['1']})</option>
                                  <option value="2">Started ({counts['2']})</option>
                                  <option value="3">Finished ({counts['3']})</option>
                                  <option value="4">Closed ({counts['4']})</option>
                                </>
                              );
                            })()}
                          </select>
                          <select
                            value={moCustomerFilter}
                            onChange={(e) => setMoCustomerFilter(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 min-w-[140px] focus:ring-2 focus:ring-violet-500/20"
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
                          <select
                            value={moSortField}
                            onChange={(e) => setMoSortField(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 focus:ring-2 focus:ring-violet-500/20"
                          >
                            <option value="Mfg. Order No.">Sort: MO #</option>
                            <option value="Customer">Sort: Customer</option>
                            <option value="Order Date">Sort: Date</option>
                            <option value="Cumulative Cost">Sort: Cost</option>
                            <option value="Ordered">Sort: Qty</option>
                          </select>
                          <button
                            onClick={() => setMoSortDirection(moSortDirection === 'asc' ? 'desc' : 'asc')}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold bg-white hover:bg-slate-50 transition-colors"
                          >
                            {moSortDirection === 'asc' ? '↑' : '↓'}
                          </button>
                          <button
                            onClick={() => { setMoStatusFilter('all'); setMoCustomerFilter('all'); setMoSearchQuery(''); setMoCurrentPage(1); }}
                            className="px-3 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {(() => {
                              let filteredMOs = searchManufacturingOrders.filter((mo: any) => mo['Mfg. Order No.'] && mo['Build Item No.']);
                              if (moStatusFilter !== 'all') filteredMOs = filteredMOs.filter((mo: any) => mo['Status']?.toString() === moStatusFilter);
                              if (moCustomerFilter !== 'all') filteredMOs = filteredMOs.filter((mo: any) => getCustomerName(mo) === moCustomerFilter);
                              const startItem = (moCurrentPage - 1) * moPageSize + 1;
                              const endItem = Math.min(moCurrentPage * moPageSize, filteredMOs.length);
                              return `${startItem}-${endItem} of ${filteredMOs.length}`;
                            })()}
                          </span>
                          <select
                            value={moPageSize}
                            onChange={(e) => { setMoPageSize(parseInt(e.target.value)); setMoCurrentPage(1); }}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                          >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                          </select>
                          <button
                            onClick={() => setShowCreateMOModal(true)}
                            className="px-4 py-2.5 bg-violet-600 text-white rounded-lg font-semibold text-sm hover:bg-violet-700 transition-all flex items-center gap-2 shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                            Create MO
                          </button>
                        </div>
                      </div>
                  </div>
                  <div className="px-6 pb-6 bg-slate-50/30 rounded-b-2xl">
                      <div className="space-y-2">
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
                            
                            // Get item cost data from Items.json
                            const itemData = (data['Items.json'] || []).find((item: any) => 
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
                            
                            const completed = mo['Completed'] || 0;
                            const ordered = mo['Ordered'] || 0;

                            const progressPct = ordered > 0 ? Math.round((completed / ordered) * 100) : 0;
                            const isOverdue = (() => {
                              if (mo['Status'] !== 1 && mo['Status'] !== 2) return false;
                              const cd = mo['Completion Date'] || mo['Close Date'];
                              if (!cd) return false;
                              try { return new Date(cd) < new Date(); } catch { return false; }
                            })();
                            const progressBarColor = isOverdue ? 'bg-red-500' : progressPct >= 100 ? 'bg-emerald-500' : progressPct > 50 ? 'bg-blue-500' : 'bg-amber-500';
                            const isClosed = mo['Status'] === 3 || mo['Status'] === 4;

                            return (
                              <div 
                                key={index} 
                                className={`group rounded-xl border bg-white hover:shadow-lg hover:border-violet-300 transition-all duration-200 cursor-pointer ${isClosed ? 'opacity-60 hover:opacity-100' : ''} ${isOverdue ? 'border-l-4 border-l-red-400 border-red-200' : 'border-slate-200'}`}
                                onClick={() => {
                                  setSelectedMO(mo);
                                  setShowMODetails(true);
                                  setMoActiveTab('overview');
                                  setMoParsedSO(null);
                                  setMoParsedSOError('');
                                }}
                              >
                                <div className="px-4 py-3">
                                  {/* Row 1: MO# + Status + Date + Cost */}
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs font-bold text-violet-700 shrink-0">#{mo['Mfg. Order No.']}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${statusInfo.color}`}>{statusInfo.text}</span>
                                    <div className="ml-auto flex items-center gap-3 shrink-0">
                                      <span className="text-xs text-slate-400 tabular-nums">{formatDisplayDate(orderDate)}</span>
                                      {totalCost > 0 && (
                                        <span className="font-mono text-xs font-bold text-emerald-600 tabular-nums">${totalCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Row 2: Company name — the main title */}
                                  <div className="font-semibold text-slate-900 text-sm leading-tight mb-1">{customerName}</div>
                                  {/* Row 3: Item code + product description from item master */}
                                  {(() => {
                                    const buildItemNo = (mo['Build Item No.'] || '').toString().trim().toUpperCase();
                                    const itemRow = indexes.itemByNo.get(buildItemNo) ?? indexes.alertByItemNo.get(buildItemNo);
                                    const itemDesc = itemRow?.['Description'] || itemRow?.['Item Description'] || mo['Non-Stocked Build Item Description'] || '';
                                    return (
                                      <div className="flex items-center gap-2 text-xs mb-1 flex-wrap">
                                        <span className="font-mono text-slate-500 shrink-0">{mo['Build Item No.']}</span>
                                        {itemDesc && <span className="text-slate-600 font-medium">{itemDesc}</span>}
                                      </div>
                                    );
                                  })()}
                                  {/* Row 4: SO badge, Batch, Location */}
                                  <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
                                    {(() => {
                                      const desc = (mo['Description'] || '').toString();
                                      let soNum: string | null = null;
                                      if (desc) {
                                        const soPatterns = [/\bSO\s*#?\s*(\d{3,6})\b/i, /\bS\.?O\.?\s*#?\s*(\d{3,6})\b/i, /Sales\s*Order\s*#?\s*(\d{3,6})/i, /SO:\s*(\d{3,6})/i];
                                        for (const p of soPatterns) { const m = desc.match(p); if (m) { soNum = m[1]; break; } }
                                      }
                                      if (!soNum) {
                                        const directSO = mo['Sales Order No.'] || mo['SO No.'];
                                        if (directSO && /^\d{3,6}$/.test(String(directSO).trim())) soNum = String(directSO).trim();
                                      }
                                      return soNum ? (
                                        <span className="inline-flex items-center cursor-pointer group/so" onClick={(e) => { e.stopPropagation(); setSelectedMO(mo); setShowMODetails(true); setMoActiveTab('pegged'); setMoParsedSO(null); setMoParsedSOError(''); }}>
                                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold group-hover/so:bg-blue-100 transition-colors">SO {soNum}</span>
                                        </span>
                                      ) : null;
                                    })()}
                                    {(mo['Batch No.'] || mo['Batch Number']) && (
                                      <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-mono font-semibold">{mo['Batch No.'] || mo['Batch Number']}</span>
                                    )}
                                    {location && <span className="text-slate-400">{location}</span>}
                                  </div>
                                  {/* Row 5: Progress bar */}
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`} style={{ width: `${Math.min(progressPct, 100)}%` }}></div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 text-xs tabular-nums">
                                      <span className="font-bold text-slate-700">{completed.toLocaleString()}</span>
                                      <span className="text-slate-400">/</span>
                                      <span className="font-medium text-slate-500">{ordered.toLocaleString()}</span>
                                      <span className={`font-bold ml-1 ${progressPct >= 100 ? 'text-emerald-600' : isOverdue ? 'text-red-600' : 'text-slate-600'}`}>{progressPct}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                  </div>
                    
                    {/* MO Summary Statistics - Enterprise footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-sm">
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
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-200/50 flex items-center justify-center">
                                  <Package2 className="w-4 h-4 text-slate-600" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{totalOrdered.toLocaleString()}</div>
                                  <div className="text-slate-500 text-xs font-medium">Total Ordered</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                  <Activity className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{totalCompleted.toLocaleString()}</div>
                                  <div className="text-slate-500 text-xs font-medium">Total Completed</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                                  <Factory className="w-4 h-4 text-violet-600" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{activeMOs}</div>
                                  <div className="text-slate-500 text-xs font-medium">Active MOs</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <Calendar className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{completedMOs}</div>
                                  <div className="text-slate-500 text-xs font-medium">Completed MOs</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                                  <span className="text-amber-600 font-bold text-xs">$</span>
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">${totalValue.toLocaleString()}</div>
                                  <div className="text-slate-500 text-xs font-medium">Total Value</div>
                                </div>
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

            </div>
          )}

          {/* MO Details Modal - Enterprise layout (portal so it appears on top) */}
          {showMODetails && selectedMoNo && createPortal(
            <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-lg" onClick={() => setShowMODetails(false)} role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
              <div className="w-full max-w-6xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl ring-2 ring-violet-500 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Enterprise header bar - gradient */}
                <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-slate-800 via-violet-900/90 to-slate-800 text-white rounded-t-2xl border-b border-violet-400/30">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500/30 text-white shadow-lg">
                      <Factory className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl font-bold tracking-tight text-white truncate">MO #{moView?.moNo ?? selectedMoNo}</h1>
                      <p className="text-slate-300 text-sm mt-0.5 max-w-2xl">
                        {(moView?.buildItemNo ?? selectedMO?.['Build Item No.']) ? (
                          <span className="text-white cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); openItemById(moView?.buildItemNo ?? selectedMO?.['Build Item No.'] ?? ''); }}>{moView?.buildItemNo ?? selectedMO?.['Build Item No.']}</span>
                        ) : '—'}
                        {(moView?.rawHeader?.['Description'] ?? selectedMO?.['Description']) && <span className="ml-2 text-slate-300">• {moView?.rawHeader?.['Description'] ?? selectedMO?.['Description']}</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200">
                          {(moView?.status ?? selectedMO?.['Status']) === 0 ? 'Planned' : (moView?.status ?? selectedMO?.['Status']) === 1 ? 'Released' : (moView?.status ?? selectedMO?.['Status']) === 2 ? 'Started' : (moView?.status ?? selectedMO?.['Status']) === 3 ? 'Finished' : (moView?.status ?? selectedMO?.['Status']) === 4 ? 'Closed' : 'Unknown'}
                        </span>
                        <span className="text-slate-400 text-xs">Ordered {(moView?.orderedQty ?? selectedMO?.['Ordered'])?.toLocaleString() ?? '—'}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400 text-xs">WIP {(moView?.wipQty ?? selectedMO?.['WIP'])?.toLocaleString() ?? '—'}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400 text-xs">Completed {(moView?.completedQty ?? selectedMO?.['Completed'])?.toLocaleString() ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {dataCatalog.hasTransactions && (moView?.moNo ?? selectedMoNo) && (
                    <button onClick={() => openTransactionExplorerWithFilters({ docRef: moView?.moNo ?? selectedMoNo })} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white border border-violet-400/50 transition-colors font-medium">
                      <Activity className="w-5 h-5" /><span className="text-sm">View in Ledger</span>
                    </button>
                    )}
                    <button onClick={() => setShowMODetails(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors font-medium" title="Back"><ArrowLeft className="w-5 h-5" /><span className="text-sm">Back</span></button>
                    <button onClick={() => setShowMODetails(false)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" aria-label="Close"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* Body: sidebar + content */}
                <div className="flex-1 flex min-h-0 bg-slate-50">
                  {!moView ? (
                    <div className="flex-1 flex items-center justify-center p-12">
                      <div className="text-center">
                        <p className="text-slate-600 font-medium">MO #{selectedMoNo}</p>
                        <p className="text-slate-500 text-sm mt-2">Minimal view — full details require MIMOH/MIMOMD in Full Company Data.</p>
                        <button onClick={() => openTransactionExplorerWithFilters({ docRef: selectedMoNo })} className="mt-4 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium">View in Ledger</button>
                      </div>
                    </div>
                  ) : (
                  <>
                  {/* Left sidebar nav */}
                  {(() => {
                    const moNavSections = [
                      { title: 'Order', items: [
                        { id: 'overview', label: 'Overview', icon: <ClipboardList className="w-4 h-4" /> },
                        { id: 'details', label: 'Components & Materials', icon: <Wrench className="w-4 h-4" /> },
                        { id: 'routings', label: 'Operations & Routing', icon: <Cog className="w-4 h-4" /> },
                      ]},
                      { title: 'Related', items: [
                        { id: 'pegged', label: 'Sales Order Related', icon: <Link2 className="w-4 h-4" /> },
                        { id: 'transactions', label: 'Transactions', icon: <Activity className="w-4 h-4" /> },
                        ...(dataCatalog.hasLotTrace && moView?.buildItemNo ? [{ id: 'lots', label: 'Lots', icon: <Hash className="w-4 h-4" /> }] : []),
                      ]},
                      { title: 'Accounting', items: [
                        { id: 'sage', label: 'Sage Accounting', icon: <span className="text-[13px]">🏦</span> },
                      ]},
                    ];
                    const moAllTabIds = moNavSections.flatMap((s) => s.items.map((i) => i.id));
                    const moCurrentIdx = moAllTabIds.indexOf(moActiveTab);
                    const moGoPrev = () => { const i = moCurrentIdx <= 0 ? moAllTabIds.length - 1 : moCurrentIdx - 1; setMoActiveTab(moAllTabIds[i]); };
                    const moGoNext = () => { const i = moCurrentIdx >= moAllTabIds.length - 1 ? 0 : moCurrentIdx + 1; setMoActiveTab(moAllTabIds[i]); };
                    const moCurrentLabel = moNavSections.flatMap((s) => s.items).find((i) => i.id === moActiveTab)?.label ?? moActiveTab;
                    return (
                  <aside className="flex-shrink-0 w-56 bg-white border-r-2 border-slate-200 flex flex-col overflow-y-auto">
                    {/* MO Summary - persistent context */}
                    <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-violet-50 to-white">
                      <div className="font-mono text-xs font-bold text-violet-600 mb-1">MO #{moView.moNo}</div>
                      <div className="text-sm font-semibold text-slate-900 truncate">{moView.customer || '—'}</div>
                      <div className="text-xs text-slate-500 mt-0.5 break-words">{moView.buildItemNo}{moView.rawHeader?.['Description'] ? ` · ${moView.rawHeader['Description']}` : moView.buildItemDesc ? ` · ${moView.buildItemDesc}` : ''}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          moView.status === 0 ? 'bg-amber-100 text-amber-800' :
                          moView.status === 1 ? 'bg-emerald-100 text-emerald-800' :
                          moView.status === 2 ? 'bg-blue-100 text-blue-800' :
                          moView.status === 3 ? 'bg-violet-100 text-violet-800' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {moView.status === 0 ? 'Planned' : moView.status === 1 ? 'Released' : moView.status === 2 ? 'Started' : moView.status === 3 ? 'Finished' : moView.status === 4 ? 'Closed' : '?'}
                        </span>
                        {moView.orderedQty > 0 && (
                          <span className="text-[10px] font-bold text-slate-500">{Math.round(((moView.completedQty || 0) / moView.orderedQty) * 100)}%</span>
                        )}
                      </div>
                      {moView.orderedQty > 0 && (
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                          <div className={`h-full rounded-full ${
                            (moView.completedQty || 0) >= moView.orderedQty ? 'bg-emerald-500' : 'bg-violet-500'
                          }`} style={{ width: `${Math.min(Math.round(((moView.completedQty || 0) / moView.orderedQty) * 100), 100)}%` }}></div>
                        </div>
                      )}
                    </div>
                    {moNavSections.map((section) => (
                      <div key={section.title} className="py-2">
                        <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</div>
                        {section.items.map(({ id, label, icon }) => (
                          <button
                            key={id}
                            onClick={() => setMoActiveTab(id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors border-l-2 ${
                              moActiveTab === id ? 'bg-slate-100 border-slate-800 text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                          >
                            <span className="text-slate-400 flex-shrink-0">{icon}</span>
                            <span className="truncate flex-1">{label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </aside>
                    );
                  })()}

                  {/* Main content area */}
                  <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6">
                      {(() => {
                        const moNavSections = [
                          { title: 'Order', items: [
                            { id: 'overview', label: 'Overview' },
                            { id: 'details', label: 'Components & Materials' },
                            { id: 'routings', label: 'Operations & Routing' },
                          ]},
                          { title: 'Related', items: [
                            { id: 'pegged', label: 'Sales Order Related' },
                            { id: 'transactions', label: 'Transactions' },
                            ...(dataCatalog.hasLotTrace && moView?.buildItemNo ? [{ id: 'lots', label: 'Lots' }] : []),
                          ]},
                          { title: 'Accounting', items: [
                            { id: 'sage', label: 'Sage Accounting' },
                          ]},
                        ];
                        const moAllTabIds = moNavSections.flatMap((s) => s.items.map((i) => i.id));
                        const moCurrentIdx = moAllTabIds.indexOf(moActiveTab);
                        const moGoPrev = () => { const i = moCurrentIdx <= 0 ? moAllTabIds.length - 1 : moCurrentIdx - 1; setMoActiveTab(moAllTabIds[i]); };
                        const moGoNext = () => { const i = moCurrentIdx >= moAllTabIds.length - 1 ? 0 : moCurrentIdx + 1; setMoActiveTab(moAllTabIds[i]); };
                        const moCurrentLabel = moNavSections.flatMap((s) => s.items).find((i) => i.id === moActiveTab)?.label ?? moActiveTab;
                        return (
                        <>
                      <div className="flex items-center justify-between gap-4 mb-4 py-2 px-3 bg-slate-100/80 rounded-xl border border-slate-200">
                        <button onClick={moGoPrev} className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors font-medium text-sm" title="Previous section">
                          <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <span className="text-sm font-semibold text-slate-700">{moCurrentLabel}</span>
                        <button onClick={moGoNext} className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors font-medium text-sm" title="Next section">
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="bg-white rounded-xl border-2 border-violet-200 shadow-md overflow-hidden">
                        <div className="p-6">
                  {/* MO Overview Tab - Compact */}
                  {moActiveTab === 'overview' && (
                    <div className="space-y-4">
                      {/* Single card: Header + Quantities + Costs */}
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="p-4">
                          {/* Row 1: Status badges + info grid */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                              moView.status === 0 ? 'bg-amber-100 text-amber-800' :
                              moView.status === 1 ? 'bg-emerald-100 text-emerald-800' :
                              moView.status === 2 ? 'bg-blue-100 text-blue-800' :
                              moView.status === 3 ? 'bg-violet-100 text-violet-800' :
                              moView.status === 4 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600'
                            }`}>{moView.status === 0 ? 'Planned' : moView.status === 1 ? 'Released' : moView.status === 2 ? 'Started' : moView.status === 3 ? 'Finished' : moView.status === 4 ? 'Closed' : 'Unknown'}</span>
                            {moView.onHold && <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-700">On Hold</span>}
                            {(moView.rawHeader?.['Batch No.'] ?? moView.rawHeader?.['Batch Number']) && (
                              <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-violet-50 text-violet-700">Batch: {moView.rawHeader?.['Batch No.'] ?? moView.rawHeader?.['Batch Number']}</span>
                            )}
                            <span className="ml-auto text-xs text-slate-500">{moView.customer || ''}</span>
                          </div>
                          {/* Build item + Description */}
                          <div className="flex items-baseline gap-2 mb-3">
                            {moView.buildItemNo && <span className="font-mono text-sm font-semibold text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded px-0.5 shrink-0" onClick={() => openItemById(moView.buildItemNo!)}>{moView.buildItemNo}</span>}
                            {moView.rawHeader?.['Description'] && <span className="text-sm text-slate-600">{moView.rawHeader['Description']}</span>}
                          </div>
                          {/* Quantity row - inline */}
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            <div className="text-center p-2 rounded-lg bg-slate-50">
                              <div className="text-lg font-bold text-slate-900 tabular-nums">{(moView.orderedQty || 0).toLocaleString()}</div>
                              <div className="text-[10px] font-medium text-slate-500">Ordered</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-blue-50">
                              <div className="text-lg font-bold text-blue-700 tabular-nums">{(moView.wipQty || 0).toLocaleString()}</div>
                              <div className="text-[10px] font-medium text-blue-600">WIP</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-emerald-50">
                              <div className="text-lg font-bold text-emerald-700 tabular-nums">{(moView.completedQty || 0).toLocaleString()}</div>
                              <div className="text-[10px] font-medium text-emerald-600">Completed</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-amber-50">
                              <div className="text-lg font-bold text-amber-700 tabular-nums">{((moView.orderedQty || 0) - (moView.completedQty || 0)).toLocaleString()}</div>
                              <div className="text-[10px] font-medium text-amber-600">Remaining</div>
                            </div>
                          </div>
                          {/* Progress bar */}
                          {(() => {
                            const pct = moView.orderedQty > 0 ? Math.round(((moView.completedQty || 0) / moView.orderedQty) * 100) : 0;
                            const barColor = pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300';
                            return (
                              <div className="mb-3">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-medium text-slate-500">Progress</span>
                                  <span className="font-bold text-slate-700 tabular-nums">{pct}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* MPS Status */}
                          {(() => {
                            const mpsOrders = data?.['MPS.json']?.mps_orders || [];
                            const mpsMatch = mpsOrders.find((m: any) => (m.mo_number || '').toString().trim() === (moView.moNo || '').toString().trim());
                            if (!mpsMatch) return null;
                            return (
                              <div className="mb-3 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">MPS</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                  <div><span className="text-indigo-600">Status</span> <span className="font-semibold text-indigo-900 ml-1">{mpsMatch.status || '—'}</span></div>
                                  <div><span className="text-indigo-600">WC</span> <span className="font-semibold text-indigo-900 ml-1">{mpsMatch.work_center || '—'}</span></div>
                                  {mpsMatch.start_date && <div><span className="text-indigo-600">Start</span> <span className="font-semibold text-indigo-900 ml-1 tabular-nums">{mpsMatch.start_date}</span></div>}
                                  {mpsMatch.end_date && <div><span className="text-indigo-600">End</span> <span className="font-semibold text-indigo-900 ml-1 tabular-nums">{mpsMatch.end_date}</span></div>}
                                  {mpsMatch.promised && <div><span className="text-indigo-600">Promised</span> <span className="font-semibold text-indigo-900 ml-1 tabular-nums">{mpsMatch.promised}</span></div>}
                                  {mpsMatch.action_items && <div className="col-span-2 md:col-span-4"><span className="text-indigo-600">Action</span> <span className="font-medium text-indigo-900 ml-1">{mpsMatch.action_items}</span></div>}
                                </div>
                              </div>
                            );
                          })()}
                          {/* Dates row */}
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mb-3 pb-3 border-b border-slate-100">
                            {moView.dates.order && <div><span className="text-slate-400">Order</span> <span className="font-medium tabular-nums ml-1">{moView.dates.order}</span></div>}
                            {moView.dates.release && <div><span className="text-slate-400">Release</span> <span className="font-medium tabular-nums ml-1">{moView.dates.release}</span></div>}
                            {moView.dates.completion && <div><span className="text-slate-400">Completion</span> <span className="font-medium tabular-nums ml-1">{moView.dates.completion}</span></div>}
                            {moView.dates.close && <div><span className="text-slate-400">Close</span> <span className="font-medium tabular-nums ml-1">{moView.dates.close}</span></div>}
                            {moView.rawHeader?.['Sales Order Ship Date'] && <div><span className="text-slate-400">SO Ship</span> <span className="font-medium tabular-nums ml-1">{moView.rawHeader['Sales Order Ship Date']}</span></div>}
                          </div>
                          {/* Costs: compact two-column */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-slate-200 p-3">
                              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Projected</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-600">Material</span><span className="font-mono">${(parseFloat(moView.rawHeader?.['Projected Material Cost'] || 0)).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Labor</span><span className="font-mono">${(parseFloat(moView.rawHeader?.['Projected Labor Cost'] || 0)).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Overhead</span><span className="font-mono">${(parseFloat(moView.rawHeader?.['Projected Overhead Cost'] || 0)).toFixed(2)}</span></div>
                              </div>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
                              <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">Actual</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-600">Material</span><span className="font-mono font-semibold text-emerald-700">${(parseFloat(moView.rawHeader?.['Actual Material Cost'] || moView.rawHeader?.['Used Material Cost'] || 0)).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Labor</span><span className="font-mono font-semibold text-emerald-700">${(parseFloat(moView.rawHeader?.['Actual Labor Cost'] || moView.rawHeader?.['Used Labor Cost'] || 0)).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Overhead</span><span className="font-mono font-semibold text-emerald-700">${(parseFloat(moView.rawHeader?.['Actual Overhead Cost'] || moView.rawHeader?.['Used Overhead Cost'] || 0)).toFixed(2)}</span></div>
                                <div className="flex justify-between pt-1.5 border-t border-emerald-200"><span className="font-semibold text-slate-700">Total</span><span className="font-mono font-bold text-emerald-800">${(parseFloat(moView.rawHeader?.['Cumulative Cost'] || moView.rawHeader?.['Total Material Cost'] || 0)).toFixed(2)}</span></div>
                              </div>
                            </div>
                          </div>
                          {/* MO Actions: Release, Issue, Complete */}
                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200">
                            {(moView.status === 0 || moView.status === '0') && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(getApiUrl(`/api/manufacturing-orders/${encodeURIComponent(moView.moNo!)}/release`), { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                                    if (res.ok) onRefreshData?.();
                                  } catch (_) {}
                                }}
                                className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200"
                              >
                                Release
                              </button>
                            )}
                            {(moView.status === 1 || moView.status === '1') && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(getApiUrl(`/api/manufacturing-orders/${encodeURIComponent(moView.moNo!)}/issue`), {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ issue_qty: moView.orderedQty || undefined }),
                                    });
                                    if (res.ok) onRefreshData?.();
                                  } catch (_) {}
                                }}
                                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
                              >
                                Issue materials
                              </button>
                            )}
                            {(moView.status === 1 || moView.status === '1' || moView.status === 2 || moView.status === '2') && (moView.orderedQty || 0) > (moView.completedQty || 0) && (
                              <button
                                onClick={async () => {
                                  const qtyStr = prompt('Completed quantity?', String((moView.orderedQty || 0) - (moView.completedQty || 0)));
                                  if (qtyStr == null) return;
                                  const qty = parseFloat(qtyStr);
                                  if (isNaN(qty) || qty <= 0) return;
                                  const lotStr = prompt('Lot number (optional)?', '');
                                  try {
                                    const res = await fetch(getApiUrl(`/api/manufacturing-orders/${encodeURIComponent(moView.moNo!)}/complete`), {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ completed_qty: qty, lot: lotStr || undefined }),
                                    });
                                    if (res.ok) onRefreshData?.();
                                  } catch (_) {}
                                }}
                                className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-200"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                          {/* Audit inline */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                            {moView.rawHeader?.['Created By'] && <span>Created by <strong className="text-slate-600">{moView.rawHeader['Created By']}</strong></span>}
                            {moView.rawHeader?.['Released By'] && <span>Released by <strong className="text-slate-600">{moView.rawHeader['Released By']}</strong></span>}
                            {moView.rawHeader?.['Closed By'] && <span>Closed by <strong className="text-slate-600">{moView.rawHeader['Closed By']}</strong></span>}
                            {moView.locationNo && <span>Location: <strong className="text-slate-600">{moView.locationNo}</strong></span>}
                            {moView.bomRev && <span>BOM Rev: <strong className="text-slate-600">{moView.bomRev}</strong></span>}
                          </div>
                        </div>
                      </div>

                      {/* CARD 3: Related Orders */}
                      {(() => {
                        const salesOrderNo = moView.salesOrderNo;
                        const jobNo = moView.jobNo;
                        const allSOSources = [...(data['SalesOrders.json'] || []), ...(data['ParsedSalesOrders.json'] || []), ...(data['SalesOrderHeaders.json'] || [])];
                        Object.values(data['SalesOrdersByStatus'] || {}).forEach((arr: any) => { if (Array.isArray(arr)) allSOSources.push(...arr); });
                        const soDigits = salesOrderNo ? String(salesOrderNo).replace(/\D/g, '') : '';
                        const relatedSO = salesOrderNo ? allSOSources.find((so: any) => {
                          const num = so['Sales Order No.'] || so['Order No.'] || so['so_number'] || so['SalesOrderNo'] || so['SO No.'];
                          return String(num || '').replace(/\D/g, '') === soDigits || num === salesOrderNo;
                        }) : null;
                        const relatedJob = jobNo ? (data['Jobs.json'] || []).find((job: any) => job['Job No.'] === jobNo) : null;
                        const relatedWorkOrders = jobNo ? (data['WorkOrders.json'] || []).filter((wo: any) => wo['Job No.'] === jobNo) : [];
                        const linkedPOs = (data?.['MIPOD.json'] || data?.['PurchaseOrderDetails.json'] || []).filter((pd: any) => (pd['Manufacturing Order No.'] || pd['mohId'] || '').toString().trim() === (moView.moNo || '').toString().trim());
                        const linkedPONumbers = Array.from(new Set<string>(linkedPOs.map((pd: any) => (pd['PO No.'] || pd['pohId'] || '').toString().trim()).filter(Boolean)));
                        if (!relatedSO && !salesOrderNo && !relatedJob && relatedWorkOrders.length === 0 && linkedPONumbers.length === 0) return null;
                        return (
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-slate-600" />
                          <h4 className="font-semibold text-slate-800 text-sm">Related Orders</h4>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {(relatedSO || salesOrderNo) && (
                            <div className="rounded-lg border border-blue-200 p-4 bg-gradient-to-br from-blue-50 to-white cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group/socard" onClick={() => setMoActiveTab('pegged')}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Sales Order</span>
                                <span className="text-[10px] text-blue-400 group-hover/socard:text-blue-600">Click to view details →</span>
                              </div>
                              <div className="font-mono text-lg font-bold text-blue-700 group-hover/socard:text-blue-800">SO #{salesOrderNo}</div>
                              {relatedSO && <div className="text-xs text-slate-600 mt-1">{relatedSO['Customer'] || relatedSO['Customer Name'] || ''}</div>}
                              {relatedSO?.['Total'] && <div className="text-xs font-mono font-semibold text-blue-600 mt-1">${parseFloat(relatedSO['Total'] || 0).toFixed(2)}</div>}
                            </div>
                          )}
                          {linkedPONumbers.length > 0 && (
                            <div className="rounded-lg border border-orange-200 p-4 bg-gradient-to-br from-orange-50 to-white">
                              <div className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-2">Purchase Orders</div>
                              <div className="flex flex-wrap gap-2">
                                {linkedPONumbers.map((poNo: string) => (
                                  <button key={poNo} onClick={() => { openPOById(poNo); }} className="px-2.5 py-1.5 rounded-lg bg-orange-100 text-orange-800 font-mono text-sm font-semibold hover:bg-orange-200 transition-colors">
                                    PO #{poNo}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {relatedJob && (
                            <div className="rounded-lg border border-slate-200 p-4 bg-white">
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Job</div>
                              <div className="font-mono text-lg font-bold text-slate-800">#{relatedJob['Job No.']}</div>
                              <div className="text-xs text-slate-600 mt-1">{relatedJob['Status'] || '—'}</div>
                            </div>
                          )}
                          {relatedWorkOrders.length > 0 && (
                            <div className="rounded-lg border border-slate-200 p-4 bg-white">
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Work Orders</div>
                              <div className="font-mono font-bold text-slate-800">{relatedWorkOrders.length} WO(s)</div>
                              <div className="text-xs text-slate-600 mt-1">{relatedWorkOrders.map((wo: any) => wo['Work Order No.']).join(', ')}</div>
                            </div>
                          )}
                        </div>
                      </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* MO Components & Materials Tab */}
                  {moActiveTab === 'details' && (
                    <div className="space-y-6">
                      {/* BOM Information Section */}
                      {(() => {
                        const buildItemNo = moView.buildItemNo;
                        const bomHeaders = indexes.bomHeadersByParent.get(buildItemNo || '') ?? [];
                        const bomDetails = indexes.bomDetailsByParent.get(buildItemNo || '') ?? [];

                        if (bomHeaders.length > 0 || bomDetails.length > 0) {
                          return (
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 mb-6 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <ClipboardList className="w-5 h-5 text-indigo-600" />
                                <h4 className="font-semibold text-indigo-900">Bill of Materials (BOM) Information</h4>
                                <span className="ml-auto text-xs font-normal text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                                  Build Item: {buildItemNo ? <span className="underline cursor-pointer hover:bg-indigo-200 rounded px-0.5" onClick={() => openItemById(buildItemNo)}>{buildItemNo}</span> : '—'}
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

                      {moView.components.length === 0 && moExactLines.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                          <div className="font-medium text-slate-700 mb-1">No component details found</div>
                          <div className="text-sm">MIMOMD has no records for this MO</div>
                        </div>
                      ) : (
                        <>
                          {/* Shortage Summary Banner */}
                          {(() => {
                            const shortageComponents = moView.components.filter((c) => c.shortage > 0);
                            if (shortageComponents.length === 0) return null;
                            return (
                              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="w-5 h-5 text-red-600" />
                                  <span className="font-semibold text-red-800">{shortageComponents.length} Component{shortageComponents.length > 1 ? 's' : ''} with Shortages</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {shortageComponents.slice(0, 10).map((c, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-800 text-xs font-medium">
                                      <span className="font-mono font-bold">{c.itemNo}</span>
                                      <span className="text-red-600">short {c.shortage.toLocaleString()}</span>
                                    </span>
                                  ))}
                                  {shortageComponents.length > 10 && <span className="text-xs text-red-600 self-center">+{shortageComponents.length - 10} more</span>}
                                </div>
                              </div>
                            );
                          })()}
                          {/* Exact / Grouped toggle */}
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-medium text-slate-600">View:</span>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                              <button
                                onClick={() => setMoComponentsView('grouped')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                  moComponentsView === 'grouped' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Grouped (Summary)
                              </button>
                              <button
                                onClick={() => setMoComponentsView('exact')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                  moComponentsView === 'exact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Exact MISys Lines
                              </button>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                              <Wrench className="w-4 h-4 text-slate-600" />
                              <h4 className="font-semibold text-slate-800 text-sm">MIMOMD · Components & Materials</h4>
                              <span className="text-xs text-slate-500 ml-auto">
                                Showing {moComponentsView === 'grouped' ? moView.components.length : moExactLines.length} {moComponentsView === 'grouped' ? 'components' : 'lines'}
                              </span>
                            </div>
                          <div className="overflow-x-auto">
                            {moComponentsView === 'grouped' ? (
                              <table className="w-full text-sm min-w-[980px]">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[130px]">Item</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[200px]">Description</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[72px]">Required</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[72px]">Issued</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[80px]">Remaining</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[76px]">Unit Cost</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[80px]">Planned Cost</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[80px]">Actual Cost</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[90px]">Source Loc</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[100px]">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {moView.components.map((c, index) => {
                                    const remainingQty = c.requiredQty - c.releasedQty;
                                    const hasShortage = c.shortage > 0;
                                    const stockStatus = c.availableStock >= remainingQty ? 'sufficient' :
                                                      c.availableStock > 0 ? 'low' : 'out';
                                    const compPOLines = (data?.['MIPOD.json'] || data?.['PurchaseOrderDetails.json'] || []).filter((pd: any) => {
                                      const pdMO = (pd['Manufacturing Order No.'] || pd['mohId'] || '').toString().trim();
                                      const pdItem = (pd['Item No.'] || pd['Planned Item No.'] || '').toString().trim();
                                      return pdMO === (moView.moNo || '').toString().trim() && pdItem === (c.itemNo || '').toString().trim();
                                    });
                                    const compPONos = Array.from(new Set<string>(compPOLines.map((pd: any) => (pd['PO No.'] || pd['pohId'] || '').toString().trim()).filter(Boolean)));

                                    return (
                                      <tr key={index} className={`border-b border-slate-100 tabular-nums ${
                                        hasShortage ? 'bg-red-50/50' : 'bg-white'
                                      } hover:bg-slate-50`}>
                                        <td className="px-4 py-3 font-mono text-blue-600 font-medium whitespace-nowrap">
                                          <div className="flex items-center gap-1.5">
                                            {c.itemNo ? <span className="underline cursor-pointer hover:bg-blue-100 rounded px-1" onClick={(e) => { e.stopPropagation(); openItemById(c.itemNo); }}>{c.itemNo}</span> : '—'}
                                            {compPONos.map((poNo: string) => (
                                              <button key={poNo} onClick={(e) => { e.stopPropagation(); openPOById(poNo); }} className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold hover:bg-orange-200 transition-colors" title={`PO #${poNo}`}>PO</button>
                                            ))}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 break-words">
                                          {c.desc || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                                          {c.requiredQty > 0 ? c.requiredQty.toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-green-600 whitespace-nowrap">
                                          {c.releasedQty > 0 ? c.releasedQty.toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-orange-600 whitespace-nowrap">
                                          {remainingQty > 0 ? remainingQty.toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                          {c.sourceLocationDisplay === 'Mixed' ? 'Mixed' : (c.materialCost > 0 ? `$${c.materialCost.toFixed(2)}` : '—')}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                          {(c.plannedExt ?? c.totalCost) > 0 ? `$${(c.plannedExt ?? c.totalCost).toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                          {(c.actualExt ?? 0) > 0 ? `$${(c.actualExt ?? 0).toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                          {c.sourceLocationDisplay && c.sourceLocationDisplay !== 'Mixed' ? (
                                            <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded px-1" onClick={(e) => { e.stopPropagation(); setSelectedLocId(c.sourceLocation!); setShowLocationDetail(true); }}>{c.sourceLocationDisplay}</span>
                                          ) : c.sourceLocationDisplay ? (
                                            <span>{c.sourceLocationDisplay}</span>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                              stockStatus === 'sufficient' ? 'bg-emerald-500' :
                                              stockStatus === 'low' ? 'bg-amber-500' : 'bg-red-500'
                                            }`}></span>
                                            <span className={`text-xs font-semibold ${
                                              stockStatus === 'sufficient' ? 'text-emerald-700' :
                                              stockStatus === 'low' ? 'text-amber-700' : 'text-red-700'
                                            }`}>
                                              {stockStatus === 'sufficient' ? 'In Stock' :
                                               stockStatus === 'low' ? 'Low' : 'Out'}
                                            </span>
                                            {hasShortage && <span className="text-[10px] font-bold text-red-600">({c.shortage.toLocaleString()})</span>}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            ) : (
                              <table className="w-full text-sm min-w-[1100px]">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[60px]">Line #</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[70px]">Op Seq</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[110px]">Planned Item</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[110px]">Issued Item</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[180px]">Description</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[72px]">Required</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[72px]">Issued</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[80px]">Remaining</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[76px]">Unit Cost</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[80px]">Planned Cost</th>
                                    <th className="text-right px-4 py-3 font-medium text-slate-600 tabular-nums min-w-[80px]">Actual Cost</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[90px]">Source Loc</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[90px]">Issue Type</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {moExactLines.map((line, index) => (
                                    <tr key={index} className="border-b border-slate-100 tabular-nums bg-white hover:bg-slate-50">
                                      <td className="px-4 py-3 font-mono text-slate-600">{line.lineNo}</td>
                                      <td className="px-4 py-3 font-mono text-slate-600">{line.opSeq}</td>
                                      <td className="px-4 py-3 font-mono text-blue-600 font-medium">
                                        <span className="underline cursor-pointer hover:bg-blue-100 rounded px-1" onClick={(e) => { e.stopPropagation(); openItemById(line.plannedItemNo); }}>{line.plannedItemNo}</span>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-slate-700">
                                        {line.issuedItemNo !== line.plannedItemNo ? (
                                          <span className="underline cursor-pointer hover:bg-blue-100 rounded px-1" onClick={(e) => { e.stopPropagation(); openItemById(line.issuedItemNo); }}>{line.issuedItemNo}</span>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-slate-700 break-words">{line.desc || '—'}</td>
                                      <td className="px-4 py-3 text-right font-medium">{line.requiredQty > 0 ? line.requiredQty.toLocaleString() : '—'}</td>
                                      <td className="px-4 py-3 text-right font-medium text-green-600">{line.issuedQty > 0 ? line.issuedQty.toLocaleString() : '—'}</td>
                                      <td className="px-4 py-3 text-right font-medium text-orange-600">{line.remainingQty > 0 ? line.remainingQty.toLocaleString() : '—'}</td>
                                      <td className="px-4 py-3 text-right font-mono">{line.unitCost > 0 ? `$${line.unitCost.toFixed(2)}` : '—'}</td>
                                      <td className="px-4 py-3 text-right font-mono">{line.plannedExt > 0 ? `$${line.plannedExt.toFixed(2)}` : '—'}</td>
                                      <td className="px-4 py-3 text-right font-mono">{line.actualExt > 0 ? `$${line.actualExt.toFixed(2)}` : '—'}</td>
                                      <td className="px-4 py-3 text-slate-600">
                                        {line.sourceLoc !== '—' ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded px-1" onClick={(e) => { e.stopPropagation(); setSelectedLocId(line.sourceLoc); setShowLocationDetail(true); }}>{line.sourceLoc}</span> : '—'}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600">{line.issueType}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                            
                            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
                              <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-sm">
                                {(() => {
                                  const totalComponents = moComponentsView === 'grouped' ? moView.components.length : moExactLines.length;
                                  const totalRequiredQty = moComponentsView === 'grouped'
                                    ? moView.components.reduce((sum, c) => sum + c.requiredQty, 0)
                                    : moExactLines.reduce((sum, l) => sum + l.requiredQty, 0);
                                  const totalIssuedQty = moComponentsView === 'grouped'
                                    ? moView.components.reduce((sum, c) => sum + c.releasedQty, 0)
                                    : moExactLines.reduce((sum, l) => sum + l.issuedQty, 0);
                                  const totalPlannedCost = moComponentsView === 'grouped'
                                    ? moView.components.reduce((sum, c) => sum + (c.plannedExt ?? c.totalCost ?? 0), 0)
                                    : moExactLines.reduce((sum, l) => sum + l.plannedExt, 0);
                                  const totalActualCost = moComponentsView === 'grouped'
                                    ? moView.components.reduce((sum, c) => sum + (c.actualExt ?? 0), 0)
                                    : moExactLines.reduce((sum, l) => sum + l.actualExt, 0);
                                  const componentsWithShortage = moView.components.filter((c) => c.shortage > 0).length;

                                  return (
                                    <>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">{totalComponents}</div>
                                        <div className="text-gray-600">{moComponentsView === 'grouped' ? 'Components' : 'Lines'}</div>
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
                                        <div className="font-semibold text-slate-700">${totalPlannedCost.toFixed(2)}</div>
                                        <div className="text-gray-600">Planned Cost</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">${totalActualCost.toFixed(2)}</div>
                                        <div className="text-gray-600">Actual Cost</div>
                                      </div>
                                      {moComponentsView === 'grouped' && (
                                        <div className="text-center">
                                          <div className={`font-semibold ${componentsWithShortage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {componentsWithShortage}
                                          </div>
                                          <div className="text-gray-600">Stock Shortages</div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                          </>
                        )}
                    </div>
                  )}

                  {/* MO Operations & Routing Tab - MIMORD */}
                  {moActiveTab === 'routings' && (
                    <div className="space-y-6">
                      {(() => {
                        const moRoutings = (data['ManufacturingOrderRoutings.json'] || data['MIMORD.json'] || []).filter((routing: any) => 
                          (routing['Mfg. Order No.'] ?? routing['mohId']) === moView.moNo
                        );

                        if (moRoutings.length === 0) {
                          return (
                            <div className="text-center py-12 text-slate-500">
                              <Cog className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                              <div className="font-medium text-slate-700 mb-1">No routing operations found</div>
                              <div className="text-sm">MIMORD has no records for this MO</div>
                            </div>
                          );
                        }

                        return (
                          <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                              <Cog className="w-4 h-4 text-slate-600" />
                              <h4 className="font-semibold text-slate-800 text-sm">MIMORD · Operations & Routing</h4>
                              <span className="text-xs text-slate-500 ml-auto">Showing {moRoutings.length} of {moRoutings.length}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="text-left p-3 font-medium text-slate-600">Operation</th>
                                    <th className="text-left p-3 font-medium text-slate-600">Work Center</th>
                                    <th className="text-left p-3 font-medium text-slate-600">Description</th>
                                    <th className="text-right p-3 font-medium text-slate-600 tabular-nums">Setup</th>
                                    <th className="text-right p-3 font-medium text-slate-600 tabular-nums">Run</th>
                                    <th className="text-right p-3 font-medium text-slate-600 tabular-nums">Labor Hrs</th>
                                    <th className="text-right p-3 font-medium text-slate-600 tabular-nums">Cost</th>
                                    <th className="text-left p-3 font-medium text-slate-600">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {moRoutings.map((routing: any, index: number) => {
                                    const setupTime = parseFloat(routing['Setup Time'] || routing['Setup'] || 0);
                                    const runTime = parseFloat(routing['Run Time'] || routing['Runtime'] || 0);
                                    const laborHours = parseFloat(routing['Labor Hours'] || routing['Hours'] || 0);
                                    const laborCost = parseFloat(routing['Labor Cost'] || routing['Cost'] || 0);

                                    return (
                                      <tr key={index} className="border-b border-slate-100 tabular-nums bg-white hover:bg-slate-50/80">
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

                  {/* MO Sales Order Related Tab */}
                  {moActiveTab === 'pegged' && (
                    <div className="space-y-4">
                      {(() => {
                        const directSONo = moView.salesOrderNo || moView.rawHeader?.['SalesOrderNo'] || moView.rawHeader?.['SO No.'];
                        const description = moView.rawHeader?.['Description'] || moView.buildItemDesc || '';
                        let soFromDesc: string | null = null;
                        const soPatterns = [/\bSO\s*#?\s*(\d{3,5})\b/i, /\bS\.?O\.?\s*#?\s*(\d{3,5})\b/i, /Sales\s*Order\s*#?\s*(\d{3,5})/i, /for\s+SO\s*#?\s*(\d{3,5})/i, /,\s*SO\s*(\d{3,5})/i, /\(SO\s*(\d{3,5})\)/i, /SO:\s*(\d{3,5})/i];
                        for (const p of soPatterns) { const m = description.match(p); if (m) { soFromDesc = m[1]; break; } }
                        const isDirectSOValid = directSONo && /^\d{3,6}$/.test(String(directSONo).trim());
                        const soNumber = isDirectSOValid ? directSONo : (soFromDesc || (directSONo ? String(directSONo).split(/[|\/]/)[0].trim() : null));

                        // Fetch full SO details from the PDF parser (real data from G Drive SO PDF)
                        if (soNumber && !moParsedSO && !moParsedSOLoading && !moParsedSOError) {
                          setMoParsedSOLoading(true);
                          fetch(getApiUrl(`/api/proforma-invoice/parse-so/${encodeURIComponent(soNumber)}`))
                            .then(r => r.json())
                            .then(result => {
                              if (result.so_data) setMoParsedSO(result.so_data);
                              else setMoParsedSOError(result.error || 'Could not parse SO PDF');
                            })
                            .catch(() => setMoParsedSOError('Could not reach server'))
                            .finally(() => setMoParsedSOLoading(false));
                        }

                        // Derive customer name from parsed PDF, MO header, or header data
                        const soCustomer = moParsedSO?.customer_name || moView.customer || '';
                        const soShipDate = moParsedSO?.ship_date || moView.rawHeader?.['Sales Order Ship Date'] || '';
                        const soItems: any[] = moParsedSO?.items || [];

                        return (
                          <>
                            {/* MO Description */}
                            {description && (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">MO Description</span>
                                <div className="text-sm font-mono text-slate-800 mt-1">{description}</div>
                              </div>
                            )}

                            {soNumber ? (
                              <div className="bg-white border border-blue-200 rounded-xl overflow-hidden">
                                {/* Header bar */}
                                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                      <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                      <div className="text-xl font-bold text-blue-900">SO #{soNumber}</div>
                                      <div className="text-sm text-blue-600">{soCustomer}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={async () => {
                                      try {
                                        const resp = await fetch(getApiUrl(`/api/sales-orders/find/${encodeURIComponent(soNumber)}`));
                                        const result = await resp.json();
                                        if (result.found && result.filePath) {
                                          window.open(getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(result.filePath)}`), '_blank');
                                        } else {
                                          setActiveSection('orders'); setSoSearchQuery(String(soNumber)); resetSONavigation(); setShowMODetails(false);
                                        }
                                      } catch {
                                        setActiveSection('orders'); setSoSearchQuery(String(soNumber)); resetSONavigation(); setShowMODetails(false);
                                      }
                                    }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                                      <ExternalLink className="w-4 h-4" /> View PDF
                                    </button>
                                    <button onClick={() => { setActiveSection('orders'); setSoSearchQuery(String(soNumber)); resetSONavigation(); setShowMODetails(false); }} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">
                                      <Search className="w-4 h-4" /> Sales Orders
                                    </button>
                                  </div>
                                </div>

                                {/* Loading / error states */}
                                {moParsedSOLoading && (
                                  <div className="flex items-center gap-3 px-5 py-6 text-blue-600">
                                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm">Loading SO details from G Drive…</span>
                                  </div>
                                )}
                                {moParsedSOError && !moParsedSO && (
                                  <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 text-amber-700 text-sm">
                                    Could not load SO PDF: {moParsedSOError}. Showing available data from MO record.
                                  </div>
                                )}

                                {moParsedSO && (
                                  <div className="p-5 space-y-4">
                                    {/* KPI tiles */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                      {moParsedSO.po_number && (
                                        <div className="rounded-lg bg-slate-50 p-3 text-center">
                                          <div className="text-[10px] text-slate-400 mb-1 uppercase">Customer PO</div>
                                          <div className="text-sm font-semibold font-mono">{moParsedSO.po_number}</div>
                                        </div>
                                      )}
                                      {(moParsedSO.ship_date || moParsedSO.required_date) && (
                                        <div className="rounded-lg bg-slate-50 p-3 text-center">
                                          <div className="text-[10px] text-slate-400 mb-1 uppercase">Ship By</div>
                                          <div className="text-sm font-semibold tabular-nums">{formatDisplayDate(moParsedSO.ship_date || moParsedSO.required_date) || moParsedSO.ship_date || moParsedSO.required_date}</div>
                                        </div>
                                      )}
                                      {moParsedSO.terms && (
                                        <div className="rounded-lg bg-slate-50 p-3 text-center">
                                          <div className="text-[10px] text-slate-400 mb-1 uppercase">Terms</div>
                                          <div className="text-sm font-semibold">{moParsedSO.terms}</div>
                                        </div>
                                      )}
                                      {moParsedSO.ship_via && (
                                        <div className="rounded-lg bg-sky-50 p-3 text-center">
                                          <div className="text-[10px] text-sky-500 mb-1 uppercase">Ship Via</div>
                                          <div className="text-sm font-semibold text-sky-800">{moParsedSO.ship_via}</div>
                                        </div>
                                      )}
                                      <div className="rounded-lg bg-emerald-50 p-3 text-center">
                                        <div className="text-[10px] text-emerald-500 mb-1 uppercase">SO Total</div>
                                        <div className="text-sm font-bold text-emerald-700 font-mono">
                                          {(moParsedSO.currency || moParsedSO.source_currency) && (
                                            <span className="text-[10px] font-semibold text-emerald-600 mr-1">{moParsedSO.currency || moParsedSO.source_currency}</span>
                                          )}
                                          {(moParsedSO.total_amount || moParsedSO.total) > 0
                                            ? `$${parseFloat(moParsedSO.total_amount || moParsedSO.total || 0).toFixed(2)}`
                                            : '—'}
                                        </div>
                                        {(moParsedSO.currency || moParsedSO.source_currency) && (
                                          <div className="text-[10px] text-emerald-600 mt-0.5">{moParsedSO.currency || moParsedSO.source_currency}</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Bill To / Ship To addresses */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {(() => {
                                        const ba = moParsedSO.billing_address || moParsedSO.sold_to || {};
                                        const lines = [
                                          ba.company || ba.company_name || moParsedSO.customer_name,
                                          ba.full_address || [ba.street || ba.street_address || ba.address, ba.city, [ba.province, ba.postal_code].filter(Boolean).join(' '), ba.country].filter(Boolean).join(', '),
                                          ba.phone && `Tel: ${ba.phone}`,
                                          ba.email,
                                        ].filter(Boolean);
                                        if (!lines.length) return null;
                                        return (
                                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">Bill To</div>
                                            <div className="p-3 text-sm space-y-0.5">
                                              {lines.map((l, i) => <div key={i} className={i === 0 ? 'font-semibold text-slate-800' : 'text-slate-600 text-xs'}>{l}</div>)}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      {(() => {
                                        const sa = moParsedSO.shipping_address || moParsedSO.ship_to || {};
                                        const lines = [
                                          sa.company || sa.company_name,
                                          sa.full_address || [sa.street || sa.street_address || sa.address, sa.city, [sa.province, sa.postal_code].filter(Boolean).join(' '), sa.country].filter(Boolean).join(', '),
                                          sa.phone && `Tel: ${sa.phone}`,
                                          sa.email,
                                        ].filter(Boolean);
                                        if (!lines.length) return null;
                                        return (
                                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">Ship To</div>
                                            <div className="p-3 text-sm space-y-0.5">
                                              {lines.map((l, i) => <div key={i} className={i === 0 ? 'font-semibold text-slate-800' : 'text-slate-600 text-xs'}>{l}</div>)}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    {/* All line items — products AND charges (Pallet, Freight, Brokerage) */}
                                    {soItems.length > 0 && (() => {
                                      const productLines = soItems.filter((it: any) => !it.is_charge);
                                      const chargeLines  = soItems.filter((it: any) =>  it.is_charge);
                                      const subtotal = parseFloat(moParsedSO.subtotal || 0);
                                      const tax      = parseFloat(moParsedSO.tax || 0);
                                      const totalAmt = parseFloat(moParsedSO.total_amount || moParsedSO.total || 0);
                                      const computedSubtotal = productLines.reduce((s: number, it: any) => {
                                        const qty = parseFloat(it.quantity || it.ordered || 0);
                                        const price = parseFloat(it.unit_price || it.price || 0);
                                        return s + parseFloat(it.amount || it.total_price || (qty * price) || 0);
                                      }, 0);
                                      const displaySubtotal = subtotal > 0 ? subtotal : computedSubtotal;
                                      const renderRow = (it: any, idx: number, isCharge: boolean) => {
                                        const itemCode = it.item_code || it.product_code || '';
                                        const qty = parseFloat(it.quantity || it.ordered || 0);
                                        const price = parseFloat(it.unit_price || it.price || 0);
                                        const amount = parseFloat(it.amount || it.total_price || (qty * price) || 0);
                                        return (
                                          <tr key={idx} className={isCharge ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50/50'}>
                                            <td className={`p-2.5 font-mono text-xs ${isCharge ? 'text-amber-700' : 'text-blue-600 cursor-pointer hover:underline'}`} onClick={() => !isCharge && itemCode && openItemById(itemCode)}>
                                              {itemCode || '—'}
                                            </td>
                                            <td className="p-2.5 text-slate-700 text-xs">{it.description || '—'}</td>
                                            <td className="p-2.5 text-right tabular-nums text-xs">{qty > 0 ? qty.toLocaleString() : '—'}</td>
                                            <td className="p-2.5 text-right text-xs text-slate-500 font-mono">{it.unit || '—'}</td>
                                            <td className="p-2.5 text-right font-mono tabular-nums text-xs">{price > 0 ? `$${price.toFixed(2)}` : '—'}</td>
                                            <td className={`p-2.5 text-right font-mono font-semibold tabular-nums text-xs ${isCharge ? 'text-amber-700' : 'text-emerald-700'}`}>
                                              {amount > 0 ? `$${amount.toFixed(2)}` : '—'}
                                            </td>
                                          </tr>
                                        );
                                      };
                                      return (
                                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                                          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                                            <h5 className="font-semibold text-slate-700 text-xs uppercase tracking-wider">Order Lines</h5>
                                            <span className="text-xs text-slate-500">{productLines.length} product{productLines.length !== 1 ? 's' : ''}{chargeLines.length > 0 ? ` + ${chargeLines.length} charge${chargeLines.length !== 1 ? 's' : ''}` : ''}</span>
                                          </div>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs min-w-[540px]">
                                              <thead className="bg-slate-50/80">
                                                <tr>
                                                  <th className="text-left p-2.5 font-medium text-slate-500">Item Code</th>
                                                  <th className="text-left p-2.5 font-medium text-slate-500">Description</th>
                                                  <th className="text-right p-2.5 font-medium text-slate-500">Qty</th>
                                                  <th className="text-right p-2.5 font-medium text-slate-500">Unit</th>
                                                  <th className="text-right p-2.5 font-medium text-slate-500">Unit Price</th>
                                                  <th className="text-right p-2.5 font-medium text-slate-500">Amount</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                {productLines.map((it: any, i: number) => renderRow(it, i, false))}
                                                {chargeLines.length > 0 && (
                                                  <>
                                                    <tr className="bg-amber-50">
                                                      <td colSpan={6} className="px-3 py-1 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Charges</td>
                                                    </tr>
                                                    {chargeLines.map((it: any, i: number) => renderRow(it, i + productLines.length, true))}
                                                  </>
                                                )}
                                              </tbody>
                                              <tfoot className="border-t border-slate-200 bg-slate-50">
                                                {chargeLines.length > 0 && (
                                                  <tr>
                                                    <td colSpan={5} className="px-3 py-1.5 text-right text-xs text-slate-500">Products Subtotal</td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-700">${displaySubtotal.toFixed(2)}</td>
                                                  </tr>
                                                )}
                                                {tax > 0 && (
                                                  <tr>
                                                    <td colSpan={5} className="px-3 py-1 text-right text-xs text-slate-500">Tax</td>
                                                    <td className="px-3 py-1 text-right font-mono text-slate-600">${tax.toFixed(2)}</td>
                                                  </tr>
                                                )}
                                                <tr className="border-t border-slate-300">
                                                  <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold text-slate-700 uppercase">
                                                    Order Total
                                                    {moParsedSO.currency && <span className="ml-1.5 text-[10px] font-semibold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">{moParsedSO.currency}</span>}
                                                  </td>
                                                  <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 text-sm">
                                                    ${totalAmt > 0 ? totalAmt.toFixed(2) : soItems.reduce((s: number, it: any) => {
                                                      const qty = parseFloat(it.quantity || it.ordered || 0);
                                                      const price = parseFloat(it.unit_price || it.price || 0);
                                                      return s + parseFloat(it.amount || it.total_price || (qty * price) || 0);
                                                    }, 0).toFixed(2)}
                                                  </td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Special instructions */}
                                    {moParsedSO.special_instructions && (
                                      <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
                                        <div className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">Special Instructions</div>
                                        <div className="text-sm text-yellow-900 whitespace-pre-wrap">{moParsedSO.special_instructions}</div>
                                      </div>
                                    )}

                                    {/* Brokerage / carrier info */}
                                    {moParsedSO.brokerage?.broker_name && (
                                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                                        <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Carrier / Customs Broker</div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <span className="font-semibold text-amber-900">{moParsedSO.brokerage.broker_name}</span>
                                          {moParsedSO.brokerage.account_number && (
                                            <span className="text-amber-700 font-mono">Acct: {moParsedSO.brokerage.account_number}</span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Linkage note */}
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs text-blue-600 font-medium">
                                      Linked to MO #{moView.moNo} · Source: Sales Order PDF (G Drive)
                                      {moView.rawHeader?.['Sales Order Ship Date'] && (
                                        <span className="ml-2">· MO Ship Date: <span className="font-bold tabular-nums">{formatDisplayDate(moView.rawHeader['Sales Order Ship Date'])}</span></span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Fallback when PDF not yet loaded and no parse error */}
                                {!moParsedSO && !moParsedSOLoading && (
                                  <div className="p-5 space-y-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      <div className="rounded-lg bg-slate-50 p-3 text-center">
                                        <div className="text-xs text-slate-500 mb-1">Customer</div>
                                        <div className="text-sm font-semibold">{moView.customer || '—'}</div>
                                      </div>
                                      {soShipDate && (
                                        <div className="rounded-lg bg-slate-50 p-3 text-center">
                                          <div className="text-xs text-slate-500 mb-1">Ship Date</div>
                                          <div className="text-sm font-semibold tabular-nums">{formatDisplayDate(soShipDate)}</div>
                                        </div>
                                      )}
                                    </div>
                                    {/* Try to find and embed SO PDF even without header data */}
                                    {(() => {
                                      const soPdfSource = (data['SalesOrders.json'] || []).find((so: any) => {
                                        const fn = (so.name || so.file_name || so.filename || '').toLowerCase();
                                        return fn.includes(`salesorder_${soNumber}`) || fn.includes(`${soNumber}.pdf`);
                                      });
                                      const hasPdf = soPdfSource?.gdrive_id || soPdfSource?.path;
                                      if (!hasPdf) return (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                                          <div className="text-xs text-blue-700">SO #{soNumber} found {soFromDesc ? 'in MO description' : 'in Sales Order No. field'}</div>
                                          <div className="flex items-center gap-2">
                                            <button onClick={async () => {
                                              try {
                                                const resp = await fetch(getApiUrl(`/api/sales-orders/find/${encodeURIComponent(soNumber)}`));
                                                const result = await resp.json();
                                                if (result.found && result.filePath) {
                                                  window.open(getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(result.filePath)}`), '_blank');
                                                } else {
                                                  setActiveSection('orders'); setSoSearchQuery(String(soNumber)); resetSONavigation(); setShowMODetails(false);
                                                }
                                              } catch { setActiveSection('orders'); setSoSearchQuery(String(soNumber)); resetSONavigation(); setShowMODetails(false); }
                                            }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium">
                                              <ExternalLink className="w-3.5 h-3.5" /> View PDF
                                            </button>
                                            <button onClick={() => { setActiveSection('orders'); setSoSearchQuery(String(soNumber)); resetSONavigation(); setShowMODetails(false); }} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-medium">
                                              <Search className="w-3.5 h-3.5" /> Sales Orders
                                            </button>
                                          </div>
                                        </div>
                                      );
                                      const pdfUrl = soPdfSource.gdrive_id
                                        ? getApiUrl(`/api/gdrive/preview/${soPdfSource.gdrive_id}`)
                                        : getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(soPdfSource.path)}#toolbar=1&navpanes=0`);
                                      return (
                                        <div className="rounded-lg border border-blue-200 overflow-hidden">
                                          <div className="px-4 py-2 bg-blue-50/50 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">SO Document</span>
                                            <span className="text-[10px] text-blue-500">{soPdfSource.name || `SO_${soNumber}`}</span>
                                          </div>
                                          <div className="bg-slate-100 p-2">
                                            <iframe
                                              src={pdfUrl}
                                              className="w-full rounded-lg border border-slate-200 bg-white"
                                              style={{ height: '400px', minHeight: '300px' }}
                                              title={`Sales Order ${soNumber}`}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                                <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <div className="font-semibold text-slate-700 mb-1">No Sales Order Linked</div>
                                <div className="text-sm text-slate-500">No SO number found in the MO data or description. This MO may be for stock replenishment.</div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* MO Transactions Tab - overlay events + ledger */}
                  {moActiveTab === 'transactions' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="text-sm text-slate-600">Transactions for MO #{moView.moNo}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={moTxTypeFilter}
                            onChange={(e) => setMoTxTypeFilter(e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                          >
                            <option value="">All Types</option>
                            <option value="MO_ISSUE">MO_ISSUE</option>
                            <option value="MO_COMPLETE">MO_COMPLETE</option>
                            <option value="MO_RELEASE">MO_RELEASE</option>
                            <option value="MO_ADJUST">MO_ADJUST</option>
                            <option value="MO_UNISSUE">MO_UNISSUE</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Filter by item..."
                            value={moTxItemFilter}
                            onChange={(e) => setMoTxItemFilter(e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-40"
                          />
                        </div>
                      </div>
                      {filteredMoTransactionRows.length === 0 ? (
                        <p className="p-4 text-slate-500 text-sm">
                          No transactions for this MO. Overlay events (MO complete, component issue) appear here when recorded via the portal. Ledger events from MILOG appear when available.
                        </p>
                      ) : (
                        <div className="rounded-xl border border-slate-100 overflow-hidden">
                          <table className="w-full text-sm min-w-[900px]">
                            <thead className="bg-slate-100">
                              <tr>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Date/Time</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Type</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Item</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty In</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty Out</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Location</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Lot/Serial</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">User</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Reference</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredMoTransactionRows.map((tx, i) => (
                                <tr key={i} className="bg-white hover:bg-slate-50">
                                  <td className="px-4 py-2 text-slate-800 font-mono text-xs">{formatDisplayDate(tx.date) || tx.date || '—'}</td>
                                  <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tx.source === 'overlay' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>{tx.type || '—'}</span></td>
                                  <td className="px-4 py-2 font-mono text-blue-600 cursor-pointer hover:underline" onClick={() => tx.itemNo && openItemById(tx.itemNo)}>{tx.itemNo || '—'}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-green-600">{tx.qtyIn != null ? tx.qtyIn.toLocaleString() : '—'}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-orange-600">{tx.qtyOut != null ? tx.qtyOut.toLocaleString() : '—'}</td>
                                  <td className="px-4 py-2 font-mono text-slate-600">{tx.location || '—'}</td>
                                  <td className="px-4 py-2 font-mono text-slate-600">{tx.lotNo || '—'}</td>
                                  <td className="px-4 py-2 text-slate-600">{tx.user || '—'}</td>
                                  <td className="px-4 py-2 text-slate-600">{tx.ref || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {filteredMoTransactionRows.length > 200 && <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 text-center">Showing {filteredMoTransactionRows.length} transactions</div>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MO Lots Tab (build item lots) */}
                  {/* MO Sage Accounting Tab */}
                  {moActiveTab === 'sage' && (
                    <MOSageTab
                      moNo={moView.moNo ?? selectedMoNo}
                      customerName={moView.customer ?? (selectedMO ? getCustomerName(selectedMO) : '') ?? ''}
                    />
                  )}

                  {moActiveTab === 'lots' && (
                    <div className="space-y-6">
                      <div className="text-sm text-slate-600">Lots for build item {moView.buildItemNo}</div>
                      {!moItemLotSummaryView.hasData ? (
                        <p className="p-4 text-slate-500 text-sm">No lot/serial records for this build item.</p>
                      ) : (
                        <>
                          {moItemLotSummaryView.lots.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Lot summary</h4>
                              <div className="rounded-xl border border-slate-100 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-100"><tr><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Lot No.</th><th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Total Qty</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Last Move</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Expiry</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100">{moItemLotSummaryView.lots.map((l, i) => (
                                    <tr key={i} className={`bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors`} onClick={() => { setSelectedLotId(l.lotNo); setShowLotDetail(true); }}>
                                      <td className="px-4 py-2 font-mono text-blue-600 underline decoration-blue-600/50">{l.lotNo}</td>
                                      <td className="px-4 py-2 text-right tabular-nums">{l.totalQty.toLocaleString()}</td>
                                      <td className="px-4 py-2 text-slate-800">{formatDisplayDate(l.lastMoveDate) || '—'}</td>
                                      <td className="px-4 py-2 text-slate-700">{l.expiry || '—'}</td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {moItemLotSummaryView.serialRows.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Serial/Lot detail</h4>
                              <div className="rounded-xl border border-slate-100 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-100"><tr><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Lot No.</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Serial No.</th><th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100">{moItemLotSummaryView.serialRows.slice(0, 50).map((r, i) => (
                                    <tr key={i} className={`bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors`} onClick={() => { if (r.lotNo) { setSelectedLotId(r.lotNo); setShowLotDetail(true); } }}>
                                      <td className="px-4 py-2 font-mono text-blue-600 underline decoration-blue-600/50">{r.lotNo || '—'}</td>
                                      <td className="px-4 py-2 font-mono text-slate-800">{r.serialNo || '—'}</td>
                                      <td className="px-4 py-2 text-right tabular-nums">{r.qty.toLocaleString()}</td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                                {moItemLotSummaryView.serialRows.length > 50 && <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 text-center">Showing 50 of {moItemLotSummaryView.serialRows.length}</div>}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                        </div>
                      </div>
                    </>
                  ); })()}
                </div>
              </main>
              </>
                  )}
                </div>
              </div>
            </div>
          , document.body)}

          {/* PO Details Modal - Enterprise layout (portal so it appears on top) */}
          {showPODetails && (selectedPONo || selectedPO) && createPortal(
            <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-lg" onClick={() => setShowPODetails(false)} role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
              <div className="w-full max-w-6xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl ring-2 ring-blue-500 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Enterprise header bar - gradient */}
                <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-slate-800 via-blue-900/90 to-slate-800 text-white rounded-t-2xl border-b border-blue-400/30">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500/30 text-white shadow-lg">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl font-bold tracking-tight text-white truncate">PO #{poView?.poNo ?? selectedPO?.['PO No.'] ?? selectedPO?.['pohId']}</h1>
                      <p className="text-slate-300 text-sm truncate mt-0.5">
                        {(() => { const supl = (poView?.vendorNo ?? poView?.vendorName ?? selectedPO?.['Supplier No.'] ?? selectedPO?.['Name'] ?? selectedPO?.['suplId'] ?? selectedPO?.['Vendor No.'] ?? '').toString(); return supl ? <span className="text-white cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedSuplId(supl); setShowSupplierDetail(true); }}>{supl}</span> : 'Unknown Supplier'; })()}
                        {poView?.vendorName && poView?.vendorNo && (poView.vendorName !== poView.vendorNo) && <span className="ml-2 text-slate-300">• {poView.vendorName}</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {(() => {
                          const hdrStat = Number(poView?.status ?? selectedPO?.['Status'] ?? -1);
                          const hdrRecvPct = (poView && poView.totalOrdered > 0) ? Math.round((poView.totalReceived / poView.totalOrdered) * 100) : 0;
                          if (hdrStat === 3) return <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-500/30 text-red-200">Cancelled</span>;
                          if (hdrStat === 2) return <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-500/30 text-slate-300">Closed</span>;
                          if (hdrRecvPct >= 100) return <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200">Fully Received</span>;
                          if (hdrRecvPct > 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-200">Partial Recv ({hdrRecvPct}%)</span>;
                          if (hdrStat === 1) return <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-200">Pending</span>;
                          if (hdrStat === 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-green-500/30 text-green-200">Open</span>;
                          return <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-200">Unknown</span>;
                        })()}
                        <span className="text-slate-400 text-xs">{(poView?.totalValue ?? parseFloat(selectedPO?.['Total Amount'] || selectedPO?.['Total'] || 0)).toLocaleString(undefined, { style: 'currency', currency: 'CAD' })}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400 text-xs">{formatDisplayDate(poView?.orderDate ?? selectedPO?.['Order Date'] ?? selectedPO?.['ordDt']) || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {dataCatalog.hasTransactions && selectedPONo && (
                    <button onClick={() => openTransactionExplorerWithFilters({ docRef: selectedPONo })} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white border border-violet-400/50 transition-colors font-medium">
                      <Activity className="w-5 h-5" /><span className="text-sm">View in Ledger</span>
                    </button>
                    )}
                    <button onClick={() => setShowPODetails(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors font-medium" title="Back"><ArrowLeft className="w-5 h-5" /><span className="text-sm">Back</span></button>
                    <button onClick={() => setShowPODetails(false)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" aria-label="Close"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* Body: sidebar + content */}
                <div className="flex-1 flex min-h-0 bg-slate-50">
                  {/* Left sidebar nav */}
                  <aside className="flex-shrink-0 w-56 bg-white border-r-2 border-slate-200 flex flex-col overflow-y-auto">
                    {/* PO Summary - persistent context (like MO sidebar) */}
                    {(() => {
                      const sidebarTotal = poView?.totalValue ?? (parseFloat(selectedPO?.['Total Amount'] || selectedPO?.['Total'] || '0') || 0);
                      const sidebarStatus = poView?.status ?? selectedPO?.['Status'];
                      const sidebarLines = poView?.lines ?? [];
                      const sidebarTotalOrdered = sidebarLines.reduce((s: number, l: any) => s + (l.orderedQty ?? 0), 0);
                      const sidebarTotalReceived = sidebarLines.reduce((s: number, l: any) => s + (l.receivedQty ?? 0), 0);
                      const sidebarRecvPct = sidebarTotalOrdered > 0 ? Math.round((sidebarTotalReceived / sidebarTotalOrdered) * 100) : 0;
                      return (
                        <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-blue-50 to-white">
                          <div className="font-mono text-xs font-bold text-blue-600 mb-1">PO #{poView?.poNo ?? selectedPONo}</div>
                          <div className="text-sm font-semibold text-slate-900 truncate">{poView?.vendorName || poView?.vendorNo || '—'}</div>
                          {poView?.vendorName && poView?.vendorNo && poView.vendorName !== poView.vendorNo && (
                            <div className="text-xs text-slate-500 mt-0.5 truncate">{poView.vendorNo}</div>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {(() => {
                              const sstat = Number(sidebarStatus ?? -1);
                              if (sstat === 3) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700">Cancelled</span>;
                              if (sstat === 2) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700">Closed</span>;
                              if (sidebarRecvPct >= 100) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">Fully Received</span>;
                              if (sidebarRecvPct > 0) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700">Partial Recv</span>;
                              if (sstat === 1) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">Pending</span>;
                              if (sstat === 0) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">Open</span>;
                              return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700">?</span>;
                            })()}
                            {sidebarTotal > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600 font-mono">${sidebarTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            )}
                            {sidebarTotalOrdered > 0 && (
                              <span className="text-[10px] font-bold text-slate-500">{sidebarRecvPct}% recv</span>
                            )}
                          </div>
                          {sidebarTotalOrdered > 0 && (
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                              <div className={`h-full rounded-full ${
                                sidebarRecvPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                              }`} style={{ width: `${Math.min(sidebarRecvPct, 100)}%` }}></div>
                            </div>
                          )}
                          {sidebarLines.length > 0 && (
                            <div className="text-[10px] text-slate-400 mt-1.5">{sidebarLines.length} line items · {poView?.linkedMONumbers?.length || 0} MOs linked</div>
                          )}
                        </div>
                      );
                    })()}
                    {[
                      { title: 'Order', items: [
                        { id: 'overview', label: 'Overview', icon: <ClipboardList className="w-4 h-4" /> },
                        { id: 'lineitems', label: 'Line Items', icon: <Package className="w-4 h-4" /> },
                        { id: 'receiving', label: 'Receiving Status', icon: <CheckCircle2 className="w-4 h-4" /> },
                        { id: 'costs', label: 'Additional Costs', icon: <DollarSign className="w-4 h-4" /> },
                        { id: 'costhistory', label: 'Cost History', icon: <TrendingUp className="w-4 h-4" /> },
                      ]},
                      { title: 'Related', items: [
                        { id: 'related', label: 'Related MOs', icon: <Link2 className="w-4 h-4" /> },
                        ...(dataCatalog.hasTransactions && selectedPONo ? [{ id: 'transactions', label: 'Transactions', icon: <Activity className="w-4 h-4" /> }] : []),
                      ]},
                    ].map((section) => (
                      <div key={section.title} className="py-2">
                        <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</div>
                        {section.items.map(({ id, label, icon }) => (
                          <button
                            key={id}
                            onClick={() => setPoActiveTab(id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors border-l-2 ${
                              poActiveTab === id ? 'bg-slate-100 border-slate-800 text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                          >
                            <span className="text-slate-400 flex-shrink-0">{icon}</span>
                            <span className="truncate flex-1">{label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </aside>

                  {/* Main content area */}
                  <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6">
                      {(() => {
                        const poNavSections = [
                          { title: 'Order', items: [
                            { id: 'overview', label: 'Overview' },
                            { id: 'lineitems', label: 'Line Items' },
                            { id: 'receiving', label: 'Receiving Status' },
                            { id: 'costs', label: 'Additional Costs' },
                            { id: 'costhistory', label: 'Cost History' },
                          ]},
                          { title: 'Related', items: [
                            { id: 'related', label: 'Related MOs' },
                            ...(dataCatalog.hasTransactions && selectedPONo ? [{ id: 'transactions', label: 'Transactions' }] : []),
                          ]},
                        ];
                        const poAllTabIds = poNavSections.flatMap((s) => s.items.map((i) => i.id));
                        const poCurrentIdx = poAllTabIds.indexOf(poActiveTab);
                        const poGoPrev = () => { const i = poCurrentIdx <= 0 ? poAllTabIds.length - 1 : poCurrentIdx - 1; setPoActiveTab(poAllTabIds[i]); };
                        const poGoNext = () => { const i = poCurrentIdx >= poAllTabIds.length - 1 ? 0 : poCurrentIdx + 1; setPoActiveTab(poAllTabIds[i]); };
                        const poCurrentLabel = poNavSections.flatMap((s) => s.items).find((i) => i.id === poActiveTab)?.label ?? poActiveTab;
                        return (
                        <>
                      <div className="flex items-center justify-between gap-4 mb-4 py-2 px-3 bg-slate-100/80 rounded-xl border border-slate-200">
                        <button onClick={poGoPrev} className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors font-medium text-sm" title="Previous section">
                          <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <span className="text-sm font-semibold text-slate-700">{poCurrentLabel}</span>
                        <button onClick={poGoNext} className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors font-medium text-sm" title="Next section">
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="bg-white rounded-xl border-2 border-blue-200 shadow-md overflow-hidden">
                        <div className="p-6">
                  {/* PO Overview Tab - Enterprise (matches MO style) */}
                  {poActiveTab === 'overview' && (
                    <div className="space-y-4">
                      {(() => {
                        const h = poView?.rawHeader ?? selectedPO ?? {};
                        const status = (poView?.status ?? h['Status']) as number;
                        const totalAmt = poView?.totalValue ?? parseFloat(h['Total Amount'] || h['Total'] || 0);
                        const invoicedAmt = parseFloat(h['Invoiced Amount'] || h['Total Invoiced'] || 0);
                        const receivedAmt = parseFloat(h['Received Amount'] || h['Total Received'] || 0);
                        const suplId = (poView?.vendorNo ?? h['Supplier No.'] ?? h['Name'] ?? h['suplId'] ?? h['Vendor No.'] ?? '').toString();
                        const suplName = poView?.vendorName ?? '';
                        const poLines = poView?.lines ?? [];
                        const totalOrderedQty = poLines.reduce((s: number, l: any) => s + (l.orderedQty ?? 0), 0);
                        const totalReceivedQty = poLines.reduce((s: number, l: any) => s + (l.receivedQty ?? 0), 0);
                        const totalBilledQty = poLines.reduce((s: number, l: any) => s + (l.billedQty ?? 0), 0);
                        const remainingQty = totalOrderedQty - totalReceivedQty;
                        const recvPct = totalOrderedQty > 0 ? Math.round((totalReceivedQty / totalOrderedQty) * 100) : 0;
                        const poIdForAvg = (poView?.poNo ?? h['PO No.'] ?? h['pohId'] ?? '').toString();
                        const procHdr = processPurchaseOrders.headers.find((ph: any) => (ph.poId ?? '').toString() === poIdForAvg);
                        const extensionData = procHdr;
                        return (
                          <>
                            {/* CARD 1: Status + Supplier + Quantities */}
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                              <div className="p-4">
                                {/* Status badges */}
                                <div className="flex items-center gap-2 mb-3">
                                {(() => {
                                    const nStat = Number(status ?? -1);
                                    if (nStat === 3) return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-700">Cancelled</span>;
                                    if (nStat === 2) return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 text-slate-700">Closed</span>;
                                    if (recvPct >= 100) return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800">Fully Received</span>;
                                    if (recvPct > 0) return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-700">Partial Recv ({recvPct}%)</span>;
                                    if (nStat === 1) return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-800">Pending</span>;
                                    if (nStat === 0) return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800">Open</span>;
                                    return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-600">Unknown</span>;
                                })()}
                                  {(h['Revision'] != null && h['Revision'] !== '' && h['Revision'] !== '0' && h['Revision'] !== 0) && (
                                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-blue-50 text-blue-700">Rev. {h['Revision']}</span>
                                  )}
                                  {poView?.currency && poView.currency !== 'CAD' && (
                                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-amber-50 text-amber-700">{poView.currency}</span>
                                  )}
                                  <span className="ml-auto text-xs text-slate-500">{poLines.length} line items</span>
                              </div>

                                {/* Supplier clickable */}
                                <div className="flex items-baseline gap-2 mb-3">
                                  {suplId && (
                                    <span className="font-mono text-sm font-semibold text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded px-0.5 shrink-0" onClick={() => { setSelectedSuplId(suplId); setShowSupplierDetail(true); }}>{suplId}</span>
                                  )}
                                  {suplName && suplName !== suplId && (
                                    <span className="text-sm text-slate-600">{suplName}</span>
                                  )}
                                  {!suplId && <span className="text-sm text-slate-400">No supplier</span>}
                            </div>

                                {/* Quantity row - 4-cell grid (like MO) */}
                                <div className="grid grid-cols-4 gap-2 mb-3">
                                  <div className="text-center p-2 rounded-lg bg-slate-50">
                                    <div className="text-lg font-bold text-slate-900 tabular-nums">{totalOrderedQty.toLocaleString()}</div>
                                    <div className="text-[10px] font-medium text-slate-500">Ordered</div>
                              </div>
                                  <div className="text-center p-2 rounded-lg bg-blue-50">
                                    <div className="text-lg font-bold text-blue-700 tabular-nums">{totalReceivedQty.toLocaleString()}</div>
                                    <div className="text-[10px] font-medium text-blue-600">Received</div>
                                  </div>
                                  <div className="text-center p-2 rounded-lg bg-emerald-50">
                                    <div className="text-lg font-bold text-emerald-700 tabular-nums">{totalBilledQty.toLocaleString()}</div>
                                    <div className="text-[10px] font-medium text-emerald-600">Billed</div>
                                  </div>
                                  <div className="text-center p-2 rounded-lg bg-amber-50">
                                    <div className="text-lg font-bold text-amber-700 tabular-nums">{remainingQty.toLocaleString()}</div>
                                    <div className="text-[10px] font-medium text-amber-600">Remaining</div>
                              </div>
                            </div>

                                {/* Receiving progress bar */}
                                {totalOrderedQty > 0 && (() => {
                                  const barColor = recvPct >= 100 ? 'bg-emerald-500' : recvPct > 50 ? 'bg-blue-500' : recvPct > 0 ? 'bg-amber-500' : 'bg-slate-300';
                              return (
                                    <div className="mb-3">
                                      <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="font-medium text-slate-500">Receiving Progress</span>
                                        <span className="font-bold text-slate-700 tabular-nums">{recvPct}%</span>
                                  </div>
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(recvPct, 100)}%` }}></div>
                                    </div>
                                      </div>
                                  );
                                })()}

                                {/* Dates row (compact, like MO) */}
                                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mb-3 pb-3 border-b border-slate-100">
                                  {(poView?.orderDate ?? h['Order Date'] ?? h['ordDt']) && (
                                    <div><span className="text-slate-400">Order</span> <span className="font-medium tabular-nums ml-1">{formatDisplayDate(poView?.orderDate ?? h['Order Date'] ?? h['ordDt'])}</span></div>
                                  )}
                                  {h['Required Date'] && (
                                    <div><span className="text-slate-400">Required</span> <span className="font-medium tabular-nums ml-1">{formatDisplayDate(h['Required Date'])}</span></div>
                                  )}
                                  {(poView?.closeDate ?? h['Close Date'] ?? h['closeDt']) && (
                                    <div><span className="text-slate-400">Close</span> <span className="font-medium tabular-nums ml-1">{formatDisplayDate(poView?.closeDate ?? h['Close Date'] ?? h['closeDt'])}</span></div>
                                  )}
                                  {h['Print Date'] && (
                                    <div><span className="text-slate-400">Printed</span> <span className="font-medium tabular-nums ml-1">{formatDisplayDate(h['Print Date'])}</span></div>
                                  )}
                                  {h['Last Maintained'] && (
                                    <div><span className="text-slate-400">Last Updated</span> <span className="font-medium tabular-nums ml-1">{formatDisplayDate(h['Last Maintained'])}</span></div>
                                  )}
                                      </div>

                                {/* Financial: two-column like MO Projected/Actual */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="rounded-lg border border-slate-200 p-3">
                                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Order Value</div>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-600">Total</span><span className="font-mono font-semibold">${totalAmt.toFixed(2)}</span></div>
                                      {poView?.freight != null && poView.freight > 0 && (
                                        <div className="flex justify-between"><span className="text-slate-600">Freight</span><span className="font-mono">${poView.freight.toFixed(2)}</span></div>
                                      )}
                                      {poView?.totalTax != null && poView.totalTax > 0 && (
                                        <div className="flex justify-between"><span className="text-slate-600">Tax</span><span className="font-mono">${poView.totalTax.toFixed(2)}</span></div>
                                      )}
                                      {poView?.totalAdditionalCost != null && poView.totalAdditionalCost > 0 && (
                                        <div className="flex justify-between"><span className="text-slate-600">Add'l Costs</span><span className="font-mono">${poView.totalAdditionalCost.toFixed(2)}</span></div>
                                      )}
                                      {procHdr?.recentUnitCost != null && procHdr.recentUnitCost > 0 && (
                                        <div className="flex justify-between pt-1.5 border-t border-slate-100"><span className="text-slate-600">Avg Unit Cost</span><span className="font-mono font-semibold">${procHdr.recentUnitCost.toFixed(2)}</span></div>
                                      )}
                                      </div>
                                  </div>
                                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
                                    <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">Payment Status</div>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-600">Invoiced</span><span className="font-mono font-semibold text-emerald-700">${invoicedAmt.toFixed(2)}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-600">Received Value</span><span className="font-mono font-semibold text-emerald-700">${receivedAmt.toFixed(2)}</span></div>
                                      {procHdr?.amountPaid != null && procHdr.amountPaid > 0 && (
                                        <div className="flex justify-between"><span className="text-slate-600">Amount Paid</span><span className="font-mono font-semibold text-emerald-700">${procHdr.amountPaid.toFixed(2)}</span></div>
                                      )}
                                      <div className="flex justify-between pt-1.5 border-t border-emerald-200"><span className="font-semibold text-slate-700">Remaining</span><span className="font-mono font-bold text-emerald-800">${(totalAmt - invoicedAmt).toFixed(2)}</span></div>
                                      </div>
                                  </div>
                                </div>

                                {/* Shipping & Terms inline */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                                  {h['Buyer'] && <span>Buyer: <strong className="text-slate-600">{h['Buyer']}</strong></span>}
                                  {h['Terms'] && <span>Terms: <strong className="text-slate-600">{h['Terms']}</strong></span>}
                                  {h['Contact'] && <span>Contact: <strong className="text-slate-600">{h['Contact']}</strong></span>}
                                  {(h['Ship Via'] || h['shpVia']) && <span>Ship Via: <strong className="text-slate-600">{h['Ship Via'] || h['shpVia']}</strong></span>}
                                  {(h['FOB'] || h['fob']) && <span>FOB: <strong className="text-slate-600">{h['FOB'] || h['fob']}</strong></span>}
                                  {(h['Source Currency'] || h['Home Currency']) && <span>Currency: <strong className="text-slate-600">{h['Source Currency'] || h['Home Currency']}</strong></span>}
                                </div>
                              </div>
                            </div>

                            {/* CARD 2: Ship To / Bill To addresses (from extensions) */}
                            {extensionData?.shipTo && (extensionData.shipTo.name || extensionData.shipTo.addr1) && (
                              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-slate-600" />
                                  <h4 className="font-semibold text-slate-800 text-sm">Shipping & Billing</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-4 p-4">
                                  {extensionData?.shipTo && (extensionData.shipTo.name || extensionData.shipTo.addr1) && (
                                    <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-3">
                                      <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1.5">Ship To</div>
                                      <div className="text-sm space-y-0.5">
                                        {extensionData.shipTo.name && <div className="font-semibold text-slate-900">{extensionData.shipTo.name}</div>}
                                        {extensionData.shipTo.addr1 && <div className="text-slate-600">{extensionData.shipTo.addr1}</div>}
                                        {extensionData.shipTo.addr2 && <div className="text-slate-600">{extensionData.shipTo.addr2}</div>}
                                        {(extensionData.shipTo.city || extensionData.shipTo.state || extensionData.shipTo.postal) && (
                                          <div className="text-slate-600">{[extensionData.shipTo.city, extensionData.shipTo.state, extensionData.shipTo.postal].filter(Boolean).join(', ')}</div>
                                        )}
                                        {extensionData.shipTo.country && <div className="text-slate-500 text-xs">{extensionData.shipTo.country}</div>}
                                  </div>
                                </div>
                                  )}
                                  {extensionData?.billTo && (extensionData.billTo.name || extensionData.billTo.addr1) && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-3">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Bill To</div>
                                      <div className="text-sm space-y-0.5">
                                        {extensionData.billTo.name && <div className="font-semibold text-slate-900">{extensionData.billTo.name}</div>}
                                        {extensionData.billTo.addr1 && <div className="text-slate-600">{extensionData.billTo.addr1}</div>}
                                        {extensionData.billTo.addr2 && <div className="text-slate-600">{extensionData.billTo.addr2}</div>}
                                        {(extensionData.billTo.city || extensionData.billTo.state || extensionData.billTo.postal) && (
                                          <div className="text-slate-600">{[extensionData.billTo.city, extensionData.billTo.state, extensionData.billTo.postal].filter(Boolean).join(', ')}</div>
                                        )}
                                        {extensionData.billTo.country && <div className="text-slate-500 text-xs">{extensionData.billTo.country}</div>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* CARD 3: Related Orders (quick links) */}
                            {(() => {
                              const poId = (poView?.poNo ?? h['PO No.'] ?? h['pohId'] ?? '').toString();
                              const moNos = poView?.linkedMONumbers ?? Array.from(new Set(
                                poDetailsSource
                                  .filter((line: any) => (line['PO No.'] ?? line['pohId']) == poId)
                                  .map((line: any) => (line['Manufacturing Order No.'] ?? line['mohId'] ?? '').toString().trim())
                                  .filter(Boolean)
                              ));
                              if (moNos.length === 0) return null;
                              const moHeaders = (data['ManufacturingOrderHeaders.json'] || []) as any[];
                              return (
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                  <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-slate-600" />
                                    <h4 className="font-semibold text-slate-800 text-sm">Related Orders</h4>
                                  </div>
                                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {moNos.length > 0 && (
                                      <div className="rounded-lg border border-violet-200 p-4 bg-gradient-to-br from-violet-50 to-white">
                                        <div className="text-xs font-semibold text-violet-500 uppercase tracking-wider mb-2">Manufacturing Orders</div>
                                        <div className="flex flex-wrap gap-2">
                                          {moNos.map((moNo: string) => {
                                            const moHeader = moHeaders.find((mo: any) => (mo['Mfg. Order No.'] ?? '').toString() === moNo);
                                      return (
                                              <button key={moNo} onClick={() => { if (moHeader) { setSelectedMO(moHeader); setShowMODetails(true); setMoActiveTab('overview'); } }} className="px-2.5 py-1.5 rounded-lg bg-violet-100 text-violet-800 font-mono text-sm font-semibold hover:bg-violet-200 transition-colors">
                                                MO #{moNo}
                                        </button>
                                      );
                                    })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* CARD 4: Line Items Preview (top 5) */}
                            {poLines.length > 0 && (
                              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-slate-600" />
                                    <h4 className="font-semibold text-slate-800 text-sm">Line Items Preview</h4>
                                    <span className="text-xs text-slate-500">{poLines.length} items</span>
                                  </div>
                                  <button onClick={() => setPoActiveTab('lineitems')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View All →</button>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-100">
                                      <tr>
                                        <th className="text-left p-2.5 font-medium text-slate-600">Item No.</th>
                                        <th className="text-left p-2.5 font-medium text-slate-600">Description</th>
                                        <th className="text-right p-2.5 font-medium text-slate-600">Ordered</th>
                                        <th className="text-right p-2.5 font-medium text-slate-600">Received</th>
                                        <th className="text-right p-2.5 font-medium text-slate-600">Unit Price</th>
                                        <th className="text-right p-2.5 font-medium text-slate-600">Extended</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {poLines.slice(0, 5).map((line: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                          <td className="p-2.5 font-mono text-blue-600 font-medium">
                                            {line.itemNo ? <span className="underline cursor-pointer hover:bg-blue-50 rounded px-0.5" onClick={(e) => { e.stopPropagation(); openItemById(line.itemNo); }}>{line.itemNo}</span> : '—'}
                                          </td>
                                          <td className="p-2.5 text-slate-600 truncate max-w-[200px]">{line.description || '—'}</td>
                                          <td className="p-2.5 text-right font-medium tabular-nums">{(line.orderedQty ?? 0).toLocaleString()}</td>
                                          <td className="p-2.5 text-right font-medium text-emerald-600 tabular-nums">{(line.receivedQty ?? 0).toLocaleString()}</td>
                                          <td className="p-2.5 text-right font-mono tabular-nums">{(line.unitPrice ?? 0) > 0 ? `$${line.unitPrice.toFixed(2)}` : '—'}</td>
                                          <td className="p-2.5 text-right font-mono font-semibold text-emerald-700 tabular-nums">{(line.extendedPrice ?? 0) > 0 ? `$${line.extendedPrice.toFixed(2)}` : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {poLines.length > 5 && (
                                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
                                      <button onClick={() => setPoActiveTab('lineitems')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                        View all {poLines.length} items →
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* PO Line Items Tab - MIPOD */}
                  {poActiveTab === 'lineitems' && (
                    <div className="space-y-6">
                      {(() => {
                        const poId = (poView?.poNo ?? selectedPO?.['PO No.'] ?? selectedPO?.['pohId'] ?? '').toString();
                        const poLineItems = poDetailsSource.filter((line: any) => 
                          (line['PO No.'] ?? line['pohId']) == poId
                        );


                        if (poLineItems.length === 0) {
                          return (
                            <div className="text-center py-12 text-slate-500">
                              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                              <div className="font-medium text-slate-700 mb-1">No line items found</div>
                              <div className="text-sm">MIPOD has no records for this PO</div>
                            </div>
                          );
                        }

                        return (
                          <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-600" />
                              <h4 className="font-semibold text-slate-800 text-sm">MIPOD · Line Items</h4>
                              <span className="text-xs text-slate-500 ml-auto">Showing {poLineItems.length} of {poLineItems.length}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100">
                                  <tr>
                                    {getAvailablePODetailColumns.map((col) => (
                                      <th 
                                        key={col.key}
                                        className={`p-3 font-medium text-slate-600 ${
                                          ['Ordered Qty', 'Received Qty', 'Unit Price', 'Extended Price'].includes(col.key) 
                                            ? 'text-right tabular-nums' : 'text-left'
                                        }`}
                                      >
                                        {col.label}
                                      </th>
                                    ))}
                                    <th className="p-3 font-medium text-slate-600 text-center min-w-[100px]">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {poLineItems.map((line: any, index: number) => {
                                    const orderedQty = parseFloat(line['Ordered Qty'] || line['Ordered'] || 0);
                                    const receivedQty = parseFloat(line['Received Qty'] || line['Received'] || 0);
                                    let unitPrice = parseFloat(line['Unit Price'] || line['Price'] || line['Unit Cost'] || line['Cost'] || 0);
                                    const itemNo = (line['Item No.'] ?? line['Part No.'] ?? line['itemId'] ?? '').toString().trim().toUpperCase();
                                    const itemData = itemNo ? (indexes.alertByItemNo.get(itemNo) ?? indexes.itemByNo.get(itemNo)) : null;
                                    const itemRecentCost = itemData ? parseCostValue(itemData['Recent Cost'] ?? itemData['cLast'] ?? itemData['Last Cost'] ?? 0) : 0;
                                    if (unitPrice <= 0 && itemRecentCost > 0) unitPrice = itemRecentCost;
                                    const fromItemFallback = unitPrice > 0 && parseFloat(line['Unit Price'] || line['Price'] || line['Unit Cost'] || line['Cost'] || 0) <= 0;
                                    const remainingQty = orderedQty - receivedQty;
                                    const lineTotal = orderedQty * unitPrice;
                                    const extendedPrice = parseFloat(line['Extended Price'] || 0);

                                    return (
                                      <tr key={index} className="border-b border-slate-100 tabular-nums bg-white hover:bg-slate-50/80">
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
                                                const itemNo = (getValue(line, 'Item No.', 'Part No.') ?? line['itemId'] ?? '').toString().trim();
                                                return (
                                                  <td key={col.key} className="p-3 font-mono text-blue-600 font-medium">
                                                    {itemNo ? <span className="underline cursor-pointer hover:bg-blue-50 rounded px-0.5" onClick={(e) => { e.stopPropagation(); openItemById(itemNo); }}>{itemNo}</span> : '—'}
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
                                                  <td key={col.key} className="px-5 py-4 text-right font-mono">
                                                    {unitPrice > 0 ? (
                                                      <span title={fromItemFallback ? 'From Item Recent Cost (PO line had no price)' : ''}>
                                                        ${unitPrice.toFixed(2)}
                                                        {fromItemFallback && <span className="text-xs text-slate-500 ml-1">(from Item)</span>}
                                                      </span>
                                                    ) : itemRecentCost > 0 ? (
                                                      <span className="text-amber-600" title="Item has Recent Cost but PO line has no price - consider updating PO">—</span>
                                                    ) : '—'}
                                                  </td>
                                                );
                                              
                                              case '_ItemRecentCost':
                                                return (
                                                  <td key={col.key} className="px-5 py-4 text-right font-mono text-slate-600">
                                                    {itemRecentCost > 0 ? `$${itemRecentCost.toFixed(2)}` : '—'}
                                                  </td>
                                                );
                                              
                                              case 'Extended Price':
                                                const displayPrice = extendedPrice > 0 ? extendedPrice : lineTotal;
                                                return (
                                                  <td key={col.key} className="px-5 py-4 text-right font-mono font-bold text-green-600">
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
                                                const locVal = getValue(line, 'Location', 'Location No.') || '';
                                                return (
                                                  <td key={col.key} className="p-3 text-gray-600">
                                                    {locVal ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded px-0.5" onClick={(e) => { e.stopPropagation(); setSelectedLocId(locVal.toString()); setShowLocationDetail(true); }}>{locVal}</span> : '—'}
                                                  </td>
                                                );

                                              case 'Manufacturing Order No.': {
                                                const moRefVal = (getValue(line, 'Manufacturing Order No.', 'mohId') ?? '').toString().trim();
                                                if (!moRefVal) return <td key={col.key} className="p-3 text-gray-400">—</td>;
                                                const moHeaderRef = (data['ManufacturingOrderHeaders.json'] || []).find((mo: any) => (mo['Mfg. Order No.'] ?? '').toString() === moRefVal);
                                                return (
                                                  <td key={col.key} className="p-3">
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); if (moHeaderRef) { setSelectedMO(moHeaderRef); setShowMODetails(true); setMoActiveTab('overview'); } }}
                                                      className="inline-flex items-center gap-1 font-mono text-violet-600 hover:text-violet-800 hover:underline font-medium text-xs"
                                                      title={moHeaderRef ? `Open MO #${moRefVal}` : `MO #${moRefVal} (not in data)`}
                                                    >
                                                      <Factory className="w-3 h-3" />
                                                      {moRefVal}
                                                    </button>
                                                  </td>
                                                );
                                              }
                                              
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
                                        <td className="p-3 text-center">
                                          {remainingQty > 0 && (
                                            <button
                                              type="button"
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const qtyStr = prompt('Quantity to receive?', String(remainingQty));
                                                if (qtyStr == null) return;
                                                const qty = parseFloat(qtyStr);
                                                if (isNaN(qty) || qty <= 0) return;
                                                const location = prompt('Location (optional)', '') || '';
                                                const lot = prompt('Lot/Batch (optional)', '') || '';
                                                try {
                                                  const res = await fetch(getApiUrl(`/api/purchase-orders/${encodeURIComponent(poId)}/receive`), {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                      item_no: line['Item No.'] || line['Part No.'],
                                                      qty,
                                                      location: location || undefined,
                                                      lot: lot || undefined,
                                                    }),
                                                  });
                                                  if (res.ok) onRefreshData?.();
                                                } catch (_) {}
                                              }}
                                              className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200"
                                            >
                                              Receive
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {(() => {
                                  const totalLines = poLineItems.length;
                                  const totalOrderedQty = poLineItems.reduce((sum: number, line: any) => 
                                    sum + parseFloat(line['Ordered Qty'] || line['Ordered'] || 0), 0);
                                  const totalReceivedQty = poLineItems.reduce((sum: number, line: any) => 
                                    sum + parseFloat(line['Received Qty'] || line['Received'] || 0), 0);
                                  const totalValue = poLineItems.reduce((sum: number, line: any) => {
                                    const qty = parseFloat(line['Ordered Qty'] || line['Ordered'] || 0);
                                    let price = parseFloat(line['Unit Price'] || line['Price'] || line['Unit Cost'] || line['Cost'] || 0);
                                    if (price <= 0) {
                                      const ino = (line['Item No.'] ?? line['Part No.'] ?? line['itemId'] ?? '').toString().trim().toUpperCase();
                                      const idata = ino ? (indexes.alertByItemNo.get(ino) ?? indexes.itemByNo.get(ino)) : null;
                                      price = idata ? parseCostValue(idata['Recent Cost'] ?? idata['cLast'] ?? 0) : 0;
                                    }
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

                  {/* PO Additional Costs Tab - MIPOCV, MIPODC */}
                  {poActiveTab === 'costs' && (
                    <div className="space-y-6">
                      {(() => {
                        const poId = (poView?.poNo ?? selectedPO?.['PO No.'] ?? selectedPO?.['pohId'] ?? '').toString();
                        const additionalCosts = (data['PurchaseOrderAdditionalCosts.json'] || []).filter((cost: any) => 
                          (cost['PO No.'] ?? cost['pohId']) == poId
                        );
                        const additionalTaxes = (data['PurchaseOrderAdditionalCostsTaxes.json'] || []).filter((tax: any) => 
                          (tax['PO No.'] ?? tax['pohId']) == poId
                        );
                        const detailCosts = (data['PurchaseOrderDetailAdditionalCosts.json'] || []).filter((cost: any) => 
                          (cost['PO No.'] ?? cost['pohId']) == poId
                        );

                        const hasAnyCosts = additionalCosts.length > 0 || additionalTaxes.length > 0 || detailCosts.length > 0;

                        if (!hasAnyCosts) {
                          return (
                            <div className="text-center py-12 text-slate-500">
                              <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                              <div className="font-medium text-slate-700 mb-1">No additional costs found</div>
                              <div className="text-sm">MIPOCV / MIPODC have no records for this PO</div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            {additionalCosts.length > 0 && (
                              <div className="rounded-xl border border-slate-100 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                                  <h5 className="font-semibold text-slate-800 text-sm">MIPOCV · Additional Costs</h5>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-100">
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

                            {detailCosts.length > 0 && (
                              <div className="rounded-xl border border-slate-100 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                                  <h5 className="font-semibold text-slate-800 text-sm">MIPODC · Line-level additional costs</h5>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-100">
                                      <tr>
                                        <th className="text-left p-3 font-medium text-slate-600">PO Line</th>
                                        <th className="text-left p-3 font-medium text-slate-600">Cost type</th>
                                        <th className="text-left p-3 font-medium text-slate-600">Description</th>
                                        <th className="text-right p-3 font-medium text-slate-600 tabular-nums">Amount</th>
                                        <th className="text-right p-3 font-medium text-slate-600 tabular-nums">Unit price</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detailCosts.map((cost: any, index: number) => (
                                        <tr key={index} className="border-b border-slate-100 bg-white hover:bg-slate-50/80">
                                          <td className="p-3 font-mono text-gray-700">{cost['PO Line No.'] ?? cost['PO Line'] ?? '—'}</td>
                                          <td className="p-3 font-medium text-gray-900">{cost['Additional Cost'] || cost['Cost Type'] || '—'}</td>
                                          <td className="p-3 text-gray-700">{cost['Description'] || '—'}</td>
                                          <td className="p-3 text-right font-mono font-bold text-green-600">
                                            ${(parseFloat(cost['Amount'] || cost['Extended Price'] || 0)).toFixed(2)}
                                          </td>
                                          <td className="p-3 text-right font-mono">{cost['Unit Price'] != null ? `$${Number(cost['Unit Price']).toFixed(2)}` : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {additionalTaxes.length > 0 && (
                              <div className="rounded-xl border border-slate-100 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                                  <h5 className="font-semibold text-slate-800 text-sm">Taxes</h5>
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

                            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                {(() => {
                                  const totalAdditionalCosts = additionalCosts.reduce((sum: number, cost: any) => 
                                    sum + parseFloat(cost['Amount'] || cost['Cost'] || 0), 0);
                                  const totalDetailCosts = detailCosts.reduce((sum: number, cost: any) => 
                                    sum + parseFloat(cost['Amount'] || cost['Extended Price'] || 0), 0);
                                  const totalTaxes = additionalTaxes.reduce((sum: number, tax: any) => 
                                    sum + parseFloat(tax['Amount'] || tax['Tax Amount'] || 0), 0);
                                  const grandTotal = totalAdditionalCosts + totalDetailCosts + totalTaxes;

                                  return (
                                    <>
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">${totalAdditionalCosts.toFixed(2)}</div>
                                        <div className="text-gray-600">Header costs</div>
                                      </div>
                                      {totalDetailCosts > 0 && (
                                        <div className="text-center">
                                          <div className="font-semibold text-gray-900">${totalDetailCosts.toFixed(2)}</div>
                                          <div className="text-gray-600">Line costs</div>
                                        </div>
                                      )}
                                      <div className="text-center">
                                        <div className="font-semibold text-gray-900">${totalTaxes.toFixed(2)}</div>
                                        <div className="text-gray-600">Taxes</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="font-semibold text-green-600">${grandTotal.toFixed(2)}</div>
                                        <div className="text-gray-600">Total extra</div>
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

                  {/* PO Cost History Tab - MIICST for items on this PO */}
                  {poActiveTab === 'costhistory' && (() => {
                    const poId = (poView?.poNo ?? selectedPO?.['PO No.'] ?? selectedPO?.['pohId'] ?? '').toString();
                    const poLines = poDetailsSource.filter((line: any) => (line['PO No.'] ?? line['pohId']) == poId);
                    const itemNos = [...new Set(poLines.map((l: any) => (l['Item No.'] ?? l['Part No.'] ?? l['itemId'] ?? '').toString().trim().toUpperCase()).filter(Boolean))];
                    const allCostHistory: Array<{ itemNo: string; date: string; location: string; cost: number; poNo: string; qtyReceived: number }> = [];
                    itemNos.forEach((itemNoUpper: string) => {
                      const rows = indexes.miicstByItemNo.get(itemNoUpper) ?? [];
                      rows.forEach((r: any) => {
                        allCostHistory.push({
                          itemNo: itemNoUpper,
                          date: (r['Transaction Date'] ?? r['transDate'] ?? r['transDt'] ?? '').toString(),
                          location: (r['Location No.'] ?? r['locId'] ?? '').toString(),
                          cost: parseCostValue(r['Cost'] ?? r['cost'] ?? 0),
                          poNo: (r['PO No.'] ?? r['poId'] ?? '').toString(),
                          qtyReceived: parseStockValue(r['Qty Received'] ?? r['qRecd'] ?? 0),
                        });
                      });
                    });
                    const sorted = [...allCostHistory].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    const hasData = sorted.length > 0;
                    return (
                      <div className="space-y-6">
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <h4 className="font-semibold text-slate-800 text-sm mb-2">Cost History (MIICST) · Items on this PO</h4>
                          <p className="text-xs text-slate-600 mb-4">Purchase cost history for items on PO #{poId}. Shows when each item was last purchased, at what cost, and on which PO.</p>
                          {!hasData ? (
                            <p className="p-4 text-slate-500 text-sm">No cost history (MIICST) for items on this PO. Include MIICST.CSV in Full Company Data for cost history.</p>
                          ) : (
                            <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                              <table className="w-full text-sm">
                                <thead className="bg-white/95 border-b border-slate-200">
                                  <tr>
                                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Item</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Cost</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">PO No.</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Qty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {sorted.slice(0, 100).map((r, i) => (
                                    <tr key={i} className="bg-white">
                                      <td className="px-4 py-3 font-mono text-blue-600"><span className="underline cursor-pointer hover:bg-blue-50" onClick={() => { openItemById(r.itemNo); }}>{r.itemNo}</span></td>
                                      <td className="px-4 py-3 text-slate-800">{formatDisplayDate(r.date) || '—'}</td>
                                      <td className="px-4 py-3 font-mono text-slate-700">{r.location ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50" onClick={() => { setSelectedLocId(r.location); setShowLocationDetail(true); }}>{r.location}</span> : '—'}</td>
                                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCAD(r.cost)}</td>
                                      <td className="px-4 py-3 font-mono text-slate-600">{r.poNo ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50" onClick={() => { if (r.poNo !== poId) openPOById(r.poNo); }}>{r.poNo}</span> : '—'}</td>
                                      <td className="px-4 py-3 text-right tabular-nums">{(r.qtyReceived ?? 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {sorted.length > 100 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 100 of {sorted.length}</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* PO Receiving Status Tab - per-line receiving detail */}
                  {poActiveTab === 'receiving' && (() => {
                    const poId = (poView?.poNo ?? selectedPO?.['PO No.'] ?? selectedPO?.['pohId'] ?? '').toString();
                    const poLineItems = poDetailsSource.filter((line: any) => (line['PO No.'] ?? line['pohId']) == poId);
                    if (poLineItems.length === 0) {
                      return (
                        <div className="text-center py-12 text-slate-500">
                          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                          <div className="font-medium text-slate-700 mb-1">No line items to track</div>
                          <div className="text-sm">MIPOD has no records for this PO</div>
                        </div>
                      );
                    }
                    const totalOrdered = poLineItems.reduce((s: number, l: any) => s + (parseFloat(l['Ordered Qty'] || l['Ordered'] || 0) || 0), 0);
                    const totalReceived = poLineItems.reduce((s: number, l: any) => s + (parseFloat(l['Received Qty'] || l['Received'] || 0) || 0), 0);
                    const totalBilled = poLineItems.reduce((s: number, l: any) => s + (parseFloat(l['Billed Qty'] || l['Invoiced'] || 0) || 0), 0);
                    const overallPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                    const fullyReceivedCount = poLineItems.filter((l: any) => {
                      const ord = parseFloat(l['Ordered Qty'] || l['Ordered'] || 0) || 0;
                      const rcv = parseFloat(l['Received Qty'] || l['Received'] || 0) || 0;
                      return ord > 0 && rcv >= ord;
                    }).length;
                    const partialCount = poLineItems.filter((l: any) => {
                      const ord = parseFloat(l['Ordered Qty'] || l['Ordered'] || 0) || 0;
                      const rcv = parseFloat(l['Received Qty'] || l['Received'] || 0) || 0;
                      return ord > 0 && rcv > 0 && rcv < ord;
                    }).length;
                    const pendingCount = poLineItems.filter((l: any) => {
                      const ord = parseFloat(l['Ordered Qty'] || l['Ordered'] || 0) || 0;
                      const rcv = parseFloat(l['Received Qty'] || l['Received'] || 0) || 0;
                      return ord > 0 && rcv === 0;
                    }).length;

                    return (
                      <div className="space-y-4">
                        {/* Overall receiving KPI */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                            <div className="text-2xl font-bold text-slate-900 tabular-nums">{overallPct}%</div>
                            <div className="text-[10px] font-medium text-slate-500 uppercase">Overall Received</div>
                          </div>
                          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{fullyReceivedCount}</div>
                            <div className="text-[10px] font-medium text-emerald-600 uppercase">Fully Received</div>
                          </div>
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                            <div className="text-2xl font-bold text-amber-700 tabular-nums">{partialCount}</div>
                            <div className="text-[10px] font-medium text-amber-600 uppercase">Partial</div>
                          </div>
                          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center">
                            <div className="text-2xl font-bold text-red-700 tabular-nums">{pendingCount}</div>
                            <div className="text-[10px] font-medium text-red-600 uppercase">Not Received</div>
                          </div>
                          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
                            <div className="text-2xl font-bold text-blue-700 tabular-nums">{totalBilled.toLocaleString()}</div>
                            <div className="text-[10px] font-medium text-blue-600 uppercase">Total Billed</div>
                          </div>
                        </div>

                        {/* Overall progress bar */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="font-medium text-slate-700">Overall Receiving Progress</span>
                            <span className="font-bold text-slate-900 tabular-nums">{totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()} units</span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${overallPct >= 100 ? 'bg-emerald-500' : overallPct > 50 ? 'bg-blue-500' : overallPct > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} style={{ width: `${Math.min(overallPct, 100)}%` }}></div>
                          </div>
                        </div>

                        {/* Per-line receiving detail */}
                        <div className="rounded-xl border border-slate-100 overflow-hidden">
                          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-slate-600" />
                            <h4 className="font-semibold text-slate-800 text-sm">Per-Line Receiving Status</h4>
                          </div>
                          <div className="divide-y divide-slate-50">
                            {poLineItems.map((line: any, idx: number) => {
                              const itemNo = (line['Item No.'] ?? line['Part No.'] ?? line['itemId'] ?? '').toString().trim();
                              const desc = (line['Description'] ?? line['descr'] ?? '').toString();
                              const ord = parseFloat(line['Ordered Qty'] || line['Ordered'] || 0) || 0;
                              const rcv = parseFloat(line['Received Qty'] || line['Received'] || 0) || 0;
                              const billed = parseFloat(line['Billed Qty'] || line['Invoiced'] || 0) || 0;
                              const pct = ord > 0 ? Math.round((rcv / ord) * 100) : 0;
                              const isFull = pct >= 100;
                              const lastRecv = (line['Last Received Date'] ?? line['lastRecvDt'] ?? '').toString();
                              const reqDate = (line['Required Date'] ?? line['initDueDt'] ?? line['realDueDt'] ?? '').toString();
                              const barColor = isFull ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300';
                              return (
                                <div key={idx} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                                  <div className="flex items-center gap-3 mb-1.5">
                                    <span className="font-mono text-xs font-semibold text-slate-500 w-6 shrink-0">#{idx + 1}</span>
                                    {itemNo && <span className="font-mono text-sm font-semibold text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded px-0.5" onClick={() => openItemById(itemNo)}>{itemNo}</span>}
                                    {desc && <span className="text-xs text-slate-500 truncate">{desc}</span>}
                                    <div className="ml-auto flex items-center gap-3 shrink-0 text-xs">
                                      {reqDate && <span className="text-slate-400">Due: <span className="tabular-nums">{formatDisplayDate(reqDate)}</span></span>}
                                      {lastRecv && <span className="text-emerald-600">Last recv: <span className="tabular-nums">{formatDisplayDate(lastRecv)}</span></span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 text-xs tabular-nums">
                                      <span className="font-bold text-slate-700">{rcv.toLocaleString()}</span>
                                      <span className="text-slate-400">/</span>
                                      <span className="font-medium text-slate-500">{ord.toLocaleString()}</span>
                                      {billed > 0 && <span className="text-blue-500 ml-1">(billed: {billed.toLocaleString()})</span>}
                                      <span className={`font-bold ml-1 ${isFull ? 'text-emerald-600' : 'text-slate-600'}`}>{pct}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* PO Related Tab - Manufacturing Orders */}
                  {poActiveTab === 'related' && (() => {
                    const poId = (poView?.poNo ?? selectedPO?.['PO No.'] ?? selectedPO?.['pohId'] ?? '').toString();
                    const poLines = poDetailsSource.filter((line: any) => (line['PO No.'] ?? line['pohId']) == poId);
                    const moNos = Array.from(new Set(
                      poLines.map((line: any) => (line['Manufacturing Order No.'] ?? line['mohId'] ?? '').toString().trim()).filter(Boolean)
                    ));
                    const moHeaders = (data['ManufacturingOrderHeaders.json'] || []) as any[];
                    const linkedMOs = moNos.map((moNo) => {
                      const hdr = moHeaders.find((mo: any) => (mo['Mfg. Order No.'] ?? '').toString() === moNo);
                      return { moNo, header: hdr };
                    });

                    return (
                      <div className="space-y-6">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-5 shadow-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                              <Link2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-lg">Related Manufacturing Orders</h4>
                              <p className="text-violet-100 text-sm">MOs linked to this PO via line item references (MIPOD)</p>
                            </div>
                          </div>
                        </div>

                        {/* Linked Manufacturing Orders */}
                        <div className="rounded-xl border border-violet-200 overflow-hidden">
                          <div className="px-4 py-3 bg-violet-50/80 border-b border-violet-100 flex items-center gap-2">
                            <Factory className="w-4 h-4 text-violet-600" />
                            <h4 className="font-semibold text-violet-800 text-sm">Linked Manufacturing Orders</h4>
                            <span className="ml-auto text-xs text-violet-500">{linkedMOs.length} MO{linkedMOs.length !== 1 ? 's' : ''} found via MIPOD</span>
                          </div>
                          {linkedMOs.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                              <Factory className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                              <div className="font-medium text-slate-700 mb-1">No Manufacturing Orders Linked</div>
                              <div className="text-sm">None of this PO's line items reference a Manufacturing Order (MIPOD mohId is empty).</div>
                            </div>
                          ) : (
                            <div className="divide-y divide-violet-100">
                              {linkedMOs.map(({ moNo, header: moHdr }) => {
                                const moStatus = moHdr?.['Status'];
                                const statusLabel = moStatus === 0 ? 'Planned' : moStatus === 1 ? 'Released' : moStatus === 2 ? 'Started' : moStatus === 3 ? 'Finished' : moStatus === 4 ? 'Closed' : 'Unknown';
                                const statusColor = moStatus === 0 ? 'bg-amber-100 text-amber-700' : moStatus === 1 ? 'bg-emerald-100 text-emerald-700' : moStatus === 2 ? 'bg-blue-100 text-blue-700' : moStatus === 3 ? 'bg-violet-100 text-violet-700' : moStatus === 4 ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-600';
                                const itemsOnThisMO = poLines.filter((l: any) => (l['Manufacturing Order No.'] ?? l['mohId'] ?? '').toString().trim() === moNo);
                                return (
                                  <div key={moNo} className="p-4 hover:bg-violet-50/50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => { if (moHdr) { setSelectedMO(moHdr); setShowMODetails(true); setMoActiveTab('overview'); } }}
                                          className="font-mono font-bold text-violet-700 hover:text-violet-900 hover:underline text-base"
                                        >
                                          MO #{moNo}
                                        </button>
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">{itemsOnThisMO.length} line{itemsOnThisMO.length !== 1 ? 's' : ''} on this PO</span>
                                        {moHdr && (
                                          <button onClick={() => { setSelectedMO(moHdr); setShowMODetails(true); setMoActiveTab('overview'); }} className="p-1 rounded hover:bg-violet-100 text-violet-400 hover:text-violet-600 transition-colors" title="Open MO Details">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {moHdr && (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                                        <div><span className="text-xs text-slate-500">Build Item</span><div className="font-mono text-sm font-medium">{moHdr['Build Item No.'] || '—'}</div></div>
                                        <div><span className="text-xs text-slate-500">Customer</span><div className="text-sm font-medium">{moHdr['Customer'] || '—'}</div></div>
                                        <div><span className="text-xs text-slate-500">Ordered</span><div className="text-sm font-medium tabular-nums">{(moHdr['Ordered'] ?? 0).toLocaleString()}</div></div>
                                        <div><span className="text-xs text-slate-500">Completed</span><div className="text-sm font-medium tabular-nums">{(moHdr['Completed'] ?? 0).toLocaleString()}</div></div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Traceability summary */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Order Linkage</div>
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="font-mono font-semibold bg-blue-50 px-2 py-1 rounded border border-blue-100">PO #{poId}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-mono font-semibold bg-violet-50 px-2 py-1 rounded border border-violet-100">{linkedMOs.length} MO{linkedMOs.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* PO Transactions Tab - Ledger entries for this PO */}
                  {poActiveTab === 'transactions' && (() => {
                    const poId = (poView?.poNo ?? selectedPO?.['PO No.'] ?? selectedPO?.['pohId'] ?? '').toString();
                    return (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl p-5 shadow-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                              <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-lg">Transaction Ledger</h4>
                              <p className="text-blue-100 text-sm">All ledger transactions referencing PO #{poId}</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                          <Activity className="w-12 h-12 mx-auto mb-3 text-violet-400" />
                          <div className="font-medium text-slate-700 mb-2">View Transactions in Ledger</div>
                          <p className="text-sm text-slate-500 mb-4">Open the Transaction Explorer filtered to this PO for a full ledger view.</p>
                          <button
                            onClick={() => openTransactionExplorerWithFilters({ docRef: poId })}
                            className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-blue-600 text-white rounded-lg font-semibold text-sm hover:from-violet-600 hover:to-blue-700 transition-all shadow-lg shadow-violet-500/25 inline-flex items-center gap-2"
                          >
                            <Activity className="w-4 h-4" />
                            Open Transaction Explorer
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                    </div>
                  </div>
                    </>
                  ); })()}
                </div>
              </main>
                </div>
              </div>
            </div>
          , document.body)}

          {/* Lot detail drilldown - uses lotTraceView - portal */}
          {showLotDetail && selectedLotId && createPortal(lotTraceView ? (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => { setShowLotDetail(false); setSelectedLotId(null); }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setShowLotDetail(false); setSelectedLotId(null); }} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors" title="Back">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold text-slate-800">Lot: {lotTraceView.lotNo}</h3>
                  </div>
                  <button onClick={() => { setShowLotDetail(false); setSelectedLotId(null); }} className="p-2 rounded-lg hover:bg-slate-200"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 flex-1">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 cursor-pointer hover:bg-blue-50" onClick={() => { if (lotTraceView.parentItemNo) { openItemById(lotTraceView.parentItemNo); setShowLotDetail(false); setSelectedLotId(null); } }}><div className="text-xs font-semibold text-slate-500 uppercase">Parent Item</div><div className="font-mono font-medium text-blue-600 underline">{lotTraceView.parentItemNo ?? '—'}</div></div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><div className="text-xs font-semibold text-slate-500 uppercase">Parent desc</div><div className="text-slate-800 truncate">{lotTraceView.parentItemDesc ?? '—'}</div></div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><div className="text-xs font-semibold text-slate-500 uppercase">First movement</div><div className="text-slate-800">{formatDisplayDate(lotTraceView.movements[lotTraceView.movements.length - 1]?.date) || '—'}</div></div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><div className="text-xs font-semibold text-slate-500 uppercase">Current qty (bins)</div><div className="font-medium tabular-nums">{lotTraceView.totalQty.toLocaleString()}</div></div>
                    </div>
                    {lotTraceView.qtyByBin.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Qty by location/bin</h4>
                        <div className="rounded-xl border border-slate-100 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100"><tr><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Location</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Bin</th><th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{lotTraceView.qtyByBin.map((r, i) => (
                              <tr key={i} className={'bg-white'}><td className="px-4 py-2 font-mono">{r.location || '—'}</td><td className="px-4 py-2 font-mono">{r.bin || '—'}</td><td className="px-4 py-2 text-right tabular-nums">{r.qty.toLocaleString()}</td></tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {lotTraceView.movements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Lot ledger · Movement history</h4>
                        <div className="rounded-xl border border-slate-100 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100"><tr><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Date</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">User</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Type</th><th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">PO No.</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">MO No.</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Location</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{lotTraceView.movements.slice(0, 100).map((r, i) => (
                              <tr key={i} className={'bg-white'}>
                                <td className="px-4 py-2 text-slate-800">{formatDisplayDate(r.date) || '—'}</td>
                                <td className="px-4 py-2 font-mono">{r.userId ?? '—'}</td>
                                <td className="px-4 py-2 text-slate-700">{r.type ?? '—'}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{(r.qty ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-2 font-mono">{r.poNo ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); openPOById(r.poNo!); }}>{r.poNo}</span> : '—'}</td>
                                <td className="px-4 py-2 font-mono">{r.moNo ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); openMOById(r.moNo!); }}>{r.moNo}</span> : '—'}</td>
                                <td className="px-4 py-2 font-mono">{r.locId ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); setSelectedLocId(r.locId!); setShowLocationDetail(true); }}>{r.locId}</span> : '—'}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                          {lotTraceView.movements.length > 100 && <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 text-center">Showing 100 of {lotTraceView.movements.length}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => { setShowLotDetail(false); setSelectedLotId(null); }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setShowLotDetail(false); setSelectedLotId(null); }} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600" title="Back"><ArrowLeft className="w-5 h-5" /></button>
                    <h3 className="text-lg font-bold text-slate-800">Lot: {selectedLotId}</h3>
                  </div>
                  <button onClick={() => { setShowLotDetail(false); setSelectedLotId(null); }} className="p-2 rounded-lg hover:bg-slate-200"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 flex-1">
                  <div className="text-center py-12 text-slate-500">No lot data found for this lot number.</div>
                </div>
              </div>
            </div>
          ),
          document.body
          )}

          {/* Supplier detail drilldown (MISUPL + POs by suplId) - portal */}
          {showSupplierDetail && selectedSuplId && createPortal(
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => { setShowSupplierDetail(false); setSelectedSuplId(null); }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setShowSupplierDetail(false); setSelectedSuplId(null); }} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors" title="Back">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold text-slate-800">Supplier: {selectedSuplId}</h3>
                  </div>
                  <button onClick={() => { setShowSupplierDetail(false); setSelectedSuplId(null); }} className="p-2 rounded-lg hover:bg-slate-200"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 flex-1">
                  {(() => {
                    const supl = (data['MISUPL.json'] || []).find((s: any) => (s['Supplier No.'] ?? s['suplId'] ?? '').toString().trim() === (selectedSuplId || '').toString().trim());
                    const pos = poHeadersSource.filter((p: any) => (p['Supplier No.'] ?? p['suplId'] ?? p['Name'] ?? '').toString().trim() === (selectedSuplId || '').toString().trim());
                    return (
                      <div className="space-y-6">
                        {supl && (
                          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Supplier info (MISUPL)</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm"><div className="font-medium text-slate-700">Name</div><div>{supl['Name'] ?? supl['name'] ?? '—'}</div><div className="font-medium text-slate-700">Contact</div><div>{supl['Contact'] ?? supl['contact'] ?? '—'}</div><div className="font-medium text-slate-700">Phone</div><div>{supl['Phone'] ?? supl['phone'] ?? '—'}</div></div>
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">Purchase orders ({pos.length})</h4>
                          <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-100"><tr><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">PO No.</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Order Date</th><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Status</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{pos.slice(0, 50).map((p: any, i: number) => (
                                <tr key={i} className="cursor-pointer hover:bg-blue-50" onClick={() => { setSelectedPO(p); setShowPODetails(true); setShowSupplierDetail(false); setSelectedSuplId(null); }}>
                                  <td className="px-4 py-2 font-mono text-blue-600 underline">{p['PO No.'] ?? p['pohId'] ?? '—'}</td>
                                  <td className="px-4 py-2">{formatDisplayDate(p['Order Date'] ?? p['ordDt']) || '—'}</td>
                                  <td className="px-4 py-2">{(() => { const s = Number(p['Status'] ?? p['poStatus'] ?? -1); return s === 0 ? 'Open' : s === 1 ? 'Pending' : s === 2 ? 'Closed' : s === 3 ? 'Cancelled' : '—'; })()}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                            {pos.length > 50 && <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 text-center">Showing 50 of {pos.length}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Location detail drilldown (MIILOCQT by locId) - modern card layout - portal for reliable stacking */}
          {showLocationDetail && selectedLocId && createPortal(
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => { setShowLocationDetail(false); setSelectedLocId(null); }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setShowLocationDetail(false); setSelectedLocId(null); }} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors" title="Back">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-indigo-500" />
                      <h3 className="text-lg font-bold text-slate-800">Location: {selectedLocId}</h3>
                    </div>
                  </div>
                  <button onClick={() => { setShowLocationDetail(false); setSelectedLocId(null); }} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors" title="Close"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 flex-1">
                  {(() => {
                    const locRows = (data['MIILOCQT.json'] || []).filter((r: any) => (r['Location No.'] ?? r['locId'] ?? '').toString().trim() === (selectedLocId || '').toString().trim());
                    const byItem: Record<string, { onHand: number; wip: number }> = {};
                    locRows.forEach((r: any) => {
                      const item = (r['Item No.'] ?? r['itemId'] ?? '').toString();
                      if (!item) return;
                      const onHand = parseStockValue(r['On Hand'] ?? r['qStk'] ?? 0);
                      const wip = parseStockValue(r['WIP'] ?? r['qWip'] ?? 0);
                      if (!byItem[item]) byItem[item] = { onHand: 0, wip: 0 };
                      byItem[item].onHand += onHand;
                      byItem[item].wip += wip;
                    });
                    const rows = Object.entries(byItem).map(([item, v]) => ({ item, ...v })).sort((a, b) => (b.onHand + b.wip) - (a.onHand + a.wip));
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-4">Items at this location ({rows.length})</h4>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {rows.slice(0, 100).map((r: any, i: number) => (
                            <div key={i} onClick={() => { openItemById(r.item); setShowLocationDetail(false); setSelectedLocId(null); }} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 transition-all cursor-pointer group">
                              <span className="font-mono font-semibold text-slate-800 group-hover:text-indigo-600">{r.item}</span>
                              <div className="flex gap-4 text-sm tabular-nums">
                                <span className="text-slate-600"><span className="text-slate-400 text-xs">On hand</span> {r.onHand.toLocaleString()}</span>
                                <span className="text-slate-600"><span className="text-slate-400 text-xs">WIP</span> {r.wip.toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {rows.length > 100 && <div className="mt-4 px-4 py-2 bg-slate-50 rounded-lg text-xs text-slate-500 text-center">Showing 100 of {rows.length}</div>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Bin detail drilldown (MIBINQ by locId + binId) - modern card layout - portal */}
          {showBinDetail && selectedBinLocId && selectedBinId && createPortal(
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => { setShowBinDetail(false); setSelectedBinLocId(null); setSelectedBinId(null); }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setShowBinDetail(false); setSelectedBinLocId(null); setSelectedBinId(null); }} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors" title="Back">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold text-slate-800">Bin: {selectedBinLocId} / {selectedBinId}</h3>
                  </div>
                  <button onClick={() => { setShowBinDetail(false); setSelectedBinLocId(null); setSelectedBinId(null); }} className="p-2 rounded-lg hover:bg-slate-200"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 flex-1">
                  {(() => {
                    const binRows = (data['MIBINQ.json'] || []).filter((r: any) =>
                      (r['Location No.'] ?? r['locId'] ?? '').toString().trim() === (selectedBinLocId || '').toString().trim() &&
                      (r['Bin No.'] ?? r['binId'] ?? '').toString().trim() === (selectedBinId || '').toString().trim()
                    );
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-4">Items in this bin ({binRows.length})</h4>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {binRows.map((r: any, i: number) => (
                            <div key={i} onClick={() => { openItemById((r['Item No.'] ?? r['itemId'] ?? '').toString()); setShowBinDetail(false); setSelectedBinLocId(null); setSelectedBinId(null); }} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 transition-all cursor-pointer group">
                              <span className="font-mono font-semibold text-slate-800 group-hover:text-indigo-600">{r['Item No.'] ?? r['itemId'] ?? '—'}</span>
                              <span className="text-sm tabular-nums text-slate-600">{parseStockValue(r['On Hand'] ?? r['qStk'] ?? 0).toLocaleString()} on hand</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Work Order detail drilldown (MIWOH, MIWOD) - portal */}
          {showWODetail && selectedWOHId && createPortal(
            <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => { setShowWODetail(false); setSelectedWOHId(null); }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setShowWODetail(false); setSelectedWOHId(null); }} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors" title="Back">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold text-slate-800">Work Order: {selectedWOHId}</h3>
                  </div>
                  <button onClick={() => { setShowWODetail(false); setSelectedWOHId(null); }} className="p-2 rounded-lg hover:bg-slate-200"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 flex-1">
                  {(() => {
                    const woHeader = (data['MIWOH.json'] || data['WorkOrders.json'] || []).find((h: any) => (h['WO No.'] ?? h['Work Order No.'] ?? h['wohId'] ?? '').toString().trim() === (selectedWOHId || '').toString().trim());
                    const woDetails = (data['MIWOD.json'] || data['WorkOrderDetails.json'] || []).filter((d: any) => (d['WO No.'] ?? d['Work Order No.'] ?? '').toString().trim() === (selectedWOHId || '').toString().trim());
                    return (
                      <div className="space-y-4">
                        {woHeader && (
                          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="font-medium text-slate-700">Build Item</div><div className="font-mono">{(woHeader as any)['Build Item No.'] ?? (woHeader as any)['Item No.'] ?? '—'}</div>
                              <div className="font-medium text-slate-700">Status</div><div>{(woHeader as any)['Status'] ?? '—'}</div>
                              <div className="font-medium text-slate-700">Ordered</div><div>{(woHeader as any)['Ordered'] ?? (woHeader as any)['Quantity'] ?? '—'}</div>
                              <div className="font-medium text-slate-700">Completed</div><div>{(woHeader as any)['Completed'] ?? '—'}</div>
                            </div>
                          </div>
                        )}
                        {woDetails.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Details</h4>
                            <div className="rounded-xl border border-slate-100 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100"><tr><th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Component</th><th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Qty</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">{woDetails.map((d: any, i: number) => (
                                  <tr key={i} className="cursor-pointer hover:bg-blue-50" onClick={() => openItemById((d['Component Item No.'] ?? d['Item No.'] ?? d['partId'] ?? '').toString())}>
                                    <td className="px-4 py-2 font-mono text-blue-600 underline">{d['Component Item No.'] ?? d['Item No.'] ?? '—'}</td>
                                    <td className="px-4 py-2 text-right tabular-nums">{parseStockValue(d['Required Quantity'] ?? d['Quantity'] ?? 0).toLocaleString()}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Purchase Orders */}
          {activeSection === 'purchase-orders' && (
            <div className="space-y-6">
              {/* Enterprise Purchase Orders Header - Dark Premium (vibrant, matches MO) */}
              <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-slate-600/60">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/25 via-transparent to-transparent"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-500/25 via-transparent to-transparent"></div>
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                  backgroundSize: '32px 32px'
                }}></div>
                
                <div className="relative p-6 lg:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                          <ShoppingBag className="w-7 h-7 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Purchase Orders</h2>
                        <p className="text-slate-400 text-sm font-medium mt-0.5 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 text-slate-400 text-xs">MIPOH / MIPOD</span>
                          Full Company Data · Same source as Items &amp; MO
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        LIVE
                      </span>
                      <button
                        onClick={() => setShowExportAllCompanyDataModal(true)}
                        className="px-4 py-2.5 bg-white/10 backdrop-blur-sm text-slate-200 rounded-lg font-medium text-sm border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
                        title="Export all company data"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                      <button
                        onClick={() => setShowPRModal(true)}
                        className="px-4 py-2.5 bg-amber-500/20 text-amber-300 rounded-lg font-medium text-sm border border-amber-500/30 hover:bg-amber-500/30 transition-all flex items-center gap-2"
                      >
                        📝 Requisitions
                      </button>
                      <button
                        onClick={() => setShowCreatePOModal(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg font-semibold text-sm hover:from-blue-600 hover:to-cyan-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
                      >
                        <Plus className="w-4 h-4" />
                        New PO
                      </button>
                      <button
                        onClick={async () => { await onRefreshData?.(); }}
                        className="px-4 py-2.5 bg-white/10 backdrop-blur-sm text-slate-200 rounded-lg font-medium text-sm border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
                        title="Refresh data from backend"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                    </div>
                  </div>
                  
                  {/* Enterprise KPI Bar - Clickable to filter */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-700/50">
                    <button type="button" onClick={() => { setPoStatusFilter('all'); setPoSupplierFilter('all'); setPoSearchQuery(''); setPoCurrentPage(1); }} className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/10 hover:border-blue-400/40 transition-colors text-left">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/30 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-blue-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{poHeadersSource.length.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">Total Orders</div>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setPoStatusFilter('open-pending'); setPoSupplierFilter('all'); setPoCurrentPage(1); }} className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/10 hover:border-emerald-400/40 transition-colors text-left">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-emerald-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{poHeadersSource.filter((po: any) => ['0', '1', 0, 1].includes(po['Status'] as any)).length.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">Open / Pending</div>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setPoStatusFilter('all'); setPoSupplierFilter('all'); setPoSearchQuery(''); setPoCurrentPage(1); }} className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/10 hover:border-amber-400/40 transition-colors text-left">
                      <div className="w-11 h-11 rounded-xl bg-amber-500/30 flex items-center justify-center">
                        <Package2 className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{poDetailsSource.length.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">Line Items</div>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setPoStatusFilter('all'); setPoSupplierFilter('all'); setPoSearchQuery(''); setPoCurrentPage(1); }} className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/10 hover:border-purple-400/40 transition-colors text-left">
                      <div className="w-11 h-11 rounded-xl bg-purple-500/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-300" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{(new Set(poHeadersSource.map((po: any) => po['Supplier No.'] || po['Name'] || po['suplId'] || po['Vendor No.']).filter(Boolean)).size || 0).toLocaleString()}</div>
                        <div className="text-slate-300 text-xs font-semibold">Suppliers</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

                {/* Purchase Orders Table - Enterprise (premium card-style, matches MO) */}
                {poHeadersSource.length > 0 && (
                  <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08), 0 8px 48px -12px rgba(0,0,0,0.04)' }}>
                    <div className="px-6 py-5 bg-slate-50/50">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex-1 min-w-[280px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search PO#, Supplier, Buyer, Status, Amounts..."
                              value={poSearchQuery}
                              onChange={(e) => { setPoSearchQuery(e.target.value); setPoCurrentPage(1); }}
                              className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-lg font-semibold text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm bg-white"
                            />
                          </div>
                          <select
                            value={poStatusFilter}
                            onChange={(e) => { setPoStatusFilter(e.target.value); setPoCurrentPage(1); }}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="all">All Status</option>
                            <option value="open-pending">Open / Pending</option>
                            <option value="0">Open</option>
                            <option value="1">Pending</option>
                            <option value="2">Closed</option>
                            <option value="3">Cancelled</option>
                          </select>
                          <select
                            value={poSupplierFilter}
                            onChange={(e) => { setPoSupplierFilter(e.target.value); setPoCurrentPage(1); }}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 min-w-[140px] focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="all">All Suppliers</option>
                            {(() => {
                              const uniqueSuppliers = Array.from(new Set(
                                poHeadersSource.map((po: any) => (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim()).filter(Boolean)
                              )).sort();
                              return uniqueSuppliers.map((supplier: string) => (
                                <option key={supplier} value={supplier}>{supplier}</option>
                              ));
                            })()}
                          </select>
                          <select
                            value={poSortField}
                            onChange={(e) => setPoSortField(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="PO No.">Sort: PO #</option>
                            <option value="Supplier No.">Sort: Supplier</option>
                            <option value="Order Date">Sort: Date</option>
                            <option value="Total Amount">Sort: Amount</option>
                            <option value="Status">Sort: Status</option>
                          </select>
                          <button
                            onClick={() => setPoSortDirection(poSortDirection === 'asc' ? 'desc' : 'asc')}
                            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold bg-white hover:bg-slate-50 transition-colors"
                          >
                            {poSortDirection === 'asc' ? '↑' : '↓'}
                          </button>
                          <button
                            onClick={() => { setPoSearchQuery(''); setPoStatusFilter('all'); setPoSupplierFilter('all'); setPoCurrentPage(1); }}
                            className="px-3 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {(() => {
                              let filteredPOs = searchPurchaseOrders.filter((po: any) => {
                                const poId = (po['PO No.'] ?? po['pohId'] ?? '').toString().trim();
                                if (!poId) return false;
                                const supl = (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim();
                                const tot = parseFloat(po['Total Amount'] ?? po['totalAmt'] ?? po['Total'] ?? 0) || 0;
                                const inv = parseFloat(po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced'] ?? 0) || 0;
                                const recv = parseFloat(po['Received Amount'] ?? po['Total Received'] ?? po['totReceived'] ?? 0) || 0;
                                return !!supl || tot > 0 || inv > 0 || recv > 0;
                              });
                              if (poStatusFilter !== 'all') {
                                if (poStatusFilter === 'open-pending') {
                                  filteredPOs = filteredPOs.filter((po: any) => ['0', '1', 0, 1].includes((po['Status'] ?? po['poStatus']) as any));
                                } else {
                                  filteredPOs = filteredPOs.filter((po: any) => (po['Status'] ?? po['poStatus'])?.toString() === poStatusFilter);
                                }
                              }
                              if (poSupplierFilter !== 'all') filteredPOs = filteredPOs.filter((po: any) => (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim() === poSupplierFilter);
                              const startItem = (poCurrentPage - 1) * poPageSize + 1;
                              const endItem = Math.min(poCurrentPage * poPageSize, filteredPOs.length);
                              return `${startItem}-${endItem} of ${filteredPOs.length}`;
                            })()}
                          </span>
                          <select
                            value={poPageSize}
                            onChange={(e) => { setPoPageSize(parseInt(e.target.value)); setPoCurrentPage(1); }}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                          >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                          </select>
                          <button
                            onClick={() => setShowCreatePOModal(true)}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                            New PO
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 pb-6 bg-slate-50/30 rounded-b-2xl">
                      <div className="space-y-2">
                          {(() => {
                            let filteredPOs = searchPurchaseOrders.filter((po: any) => {
                              const poId = (po['PO No.'] ?? po['pohId'] ?? '').toString().trim();
                              if (!poId) return false;
                              const supl = (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim();
                              const tot = parseFloat(po['Total Amount'] ?? po['totalAmt'] ?? po['Total'] ?? 0) || 0;
                              const inv = parseFloat(po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced'] ?? 0) || 0;
                              const recv = parseFloat(po['Received Amount'] ?? po['Total Received'] ?? po['totReceived'] ?? 0) || 0;
                              return !!supl || tot > 0 || inv > 0 || recv > 0;
                            });
                            if (poStatusFilter !== 'all') {
                              if (poStatusFilter === 'open-pending') {
                                filteredPOs = filteredPOs.filter((po: any) => ['0', '1', 0, 1].includes((po['Status'] ?? po['poStatus']) as any));
                              } else {
                                filteredPOs = filteredPOs.filter((po: any) => (po['Status'] ?? po['poStatus'])?.toString() === poStatusFilter);
                              }
                            }
                            if (poSupplierFilter !== 'all') filteredPOs = filteredPOs.filter((po: any) => (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim() === poSupplierFilter);
                            const sortedPOs = sortData(filteredPOs, poSortField, poSortDirection);
                            const startIndex = (poCurrentPage - 1) * poPageSize;
                            const endIndex = startIndex + poPageSize;
                            return sortedPOs.slice(startIndex, endIndex).map((po: any, index: number) => {
                            const poId = (po['PO No.'] ?? po['pohId'] ?? '').toString().trim();
                            const supl = (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim();
                            const tot = parseFloat(po['Total Amount'] ?? po['totalAmt'] ?? po['Total'] ?? 0) || 0;
                            const inv = parseFloat(po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced'] ?? 0) || 0;
                            const recv = parseFloat(po['Received Amount'] ?? po['Total Received'] ?? po['totReceived'] ?? 0) || 0;
                            const hasData = !!poId && (!!supl || tot > 0 || inv > 0 || recv > 0);
                            if (!hasData) return null;
                            const poTotal = parseFloat(po['Total Amount'] ?? po['totalAmt'] ?? po['Total'] ?? 0) || 0;
                            const supplierName = (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim();
                            const orderDateVal = po['Order Date'] ?? po['ordDt'] ?? '';

                            const poLines = poDetailsSource.filter((line: any) => (line['PO No.'] ?? line['pohId']) == poId);
                            const lineCount = poLines.length;
                            const totalOrdered = poLines.reduce((s: number, l: any) => s + (parseFloat(l['Ordered Qty'] ?? l['Ordered'] ?? l['ordered'] ?? l['ordQty'] ?? 0) || 0), 0);
                            const totalReceived = poLines.reduce((s: number, l: any) => s + (parseFloat(l['Received Qty'] ?? l['Received'] ?? l['received'] ?? l['recvQty'] ?? 0) || 0), 0);
                            const linePct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : -1;
                            const recvPct = linePct >= 0 ? linePct : (() => {
                              const hdrOrdered = parseFloat(po['Total Ordered'] ?? po['totOrdered'] ?? 0) || 0;
                              const hdrReceived = parseFloat(po['Total Received'] ?? po['totReceived'] ?? 0) || 0;
                              return hdrOrdered > 0 ? Math.round((hdrReceived / hdrOrdered) * 100) : 0;
                            })();
                            const rawStatus = Number(po['Status'] ?? po['poStatus'] ?? -1);
                            const isClosed = rawStatus === 2 || rawStatus === 3;
                            const isFullyReceived = recvPct >= 100;

                            const getStatusInfo = (stat: number, recPct: number): { text: string; color: string } => {
                              if (stat === 3) return { text: 'Cancelled', color: 'bg-red-100 text-red-700' };
                              if (stat === 2) return { text: 'Closed', color: 'bg-gray-200 text-gray-700' };
                              if (recPct >= 100) return { text: 'Fully Received', color: 'bg-emerald-100 text-emerald-700' };
                              if (recPct > 0 && stat <= 1) return { text: 'Partial Recv', color: 'bg-blue-100 text-blue-700' };
                              if (stat === 1) return { text: 'Pending', color: 'bg-yellow-100 text-yellow-700' };
                              if (stat === 0) return { text: 'Open', color: 'bg-green-100 text-green-700' };
                              return { text: 'Unknown', color: 'bg-slate-100 text-slate-600' };
                            };
                            const statusInfo = getStatusInfo(rawStatus, recvPct);
                            const recvBarColor = isFullyReceived ? 'bg-emerald-500' : recvPct > 50 ? 'bg-blue-500' : recvPct > 0 ? 'bg-amber-500' : 'bg-slate-300';

                            const moNos = Array.from(new Set(
                              poLines.map((line: any) => (line['Manufacturing Order No.'] ?? line['mohId'] ?? '').toString().trim()).filter(Boolean)
                            ));

                            const vendorRow = indexes.misuplById.get(supl);
                            const vendorDisplayName = vendorRow?.['Name'] ?? vendorRow?.['descr'] ?? '';
                            const supplierDisplay = vendorDisplayName && vendorDisplayName !== supl ? `${supl} · ${vendorDisplayName}` : supl;

                            return (
                              <div 
                                key={index} 
                                className={`group rounded-xl border bg-white hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer ${isClosed ? 'opacity-60 hover:opacity-100' : ''} ${isClosed ? 'border-slate-200' : 'border-slate-200'}`}
                                onClick={() => {
                                  setSelectedPO(po);
                                  setShowPODetails(true);
                                  setPoActiveTab('overview');
                                }}
                              >
                                <div className="px-4 py-3">
                                  {/* Row 1: PO#, Status, Supplier, Date, Amount */}
                                  <div className="flex items-center gap-3 mb-1.5">
                                    <span className="font-mono text-sm font-bold text-blue-700 shrink-0">#{poId}</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${statusInfo.color}`}>
                                      {statusInfo.text}
                                    </span>
                                    <span className="font-semibold text-slate-900 text-sm truncate">{supplierDisplay || '—'}</span>
                                    <div className="ml-auto flex items-center gap-4 shrink-0">
                                      <span className="text-xs text-slate-500 tabular-nums">{formatDisplayDate(orderDateVal)}</span>
                                      {poTotal > 0 && (
                                        <span className="font-mono text-sm font-bold text-emerald-600 tabular-nums">${poTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                      )}
                                  </div>
                                  </div>
                                  {/* Row 2: Buyer, Terms, Items */}
                                  <div className="flex items-start gap-2 text-xs flex-wrap">
                                    {po['Buyer'] && <span className="text-slate-600">Buyer: <span className="font-semibold text-slate-700">{po['Buyer']}</span></span>}
                                    {po['Buyer'] && po['Terms'] && <span className="text-slate-300">·</span>}
                                    {po['Terms'] && <span className="text-slate-600">Terms: <span className="font-medium">{po['Terms']}</span></span>}
                                    {(po['Buyer'] || po['Terms']) && lineCount > 0 && <span className="text-slate-300">·</span>}
                                    {lineCount > 0 && <span className="text-slate-500">{lineCount} line item{lineCount !== 1 ? 's' : ''}</span>}
                                  </div>
                                  {/* Row 3: Badges - MOs, Ship Via, Currency */}
                                  <div className="flex items-center gap-2 mt-1 text-xs">
                                    {moNos.length > 0 && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold">
                                          <Factory className="w-3 h-3 text-violet-400" />
                                            MO: {moNos.slice(0, 2).join(', ')}{moNos.length > 2 ? ` +${moNos.length - 2}` : ''}
                                          </span>
                                    )}
                                    {po['Ship Via'] && (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{po['Ship Via']}</span>
                                    )}
                                    {(po['Source Currency'] || po['Home Currency']) && (po['Source Currency'] || po['Home Currency']) !== 'CAD' && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono font-semibold">{po['Source Currency'] || po['Home Currency']}</span>
                                    )}
                                    {inv > 0 && (
                                      <span className="text-slate-500">Invoiced: <span className="font-mono font-semibold text-slate-700">${inv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
                                    )}
                                  </div>
                                  {/* Row 4: Receiving progress bar */}
                                  {lineCount > 0 && (
                                  <div className="flex items-center gap-3 mt-2">
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-500 ${recvBarColor}`} style={{ width: `${Math.min(recvPct, 100)}%` }}></div>
                                </div>
                                    <div className="flex items-center gap-1.5 shrink-0 text-xs tabular-nums">
                                      <span className="font-bold text-slate-700">{totalReceived.toLocaleString()}</span>
                                      <span className="text-slate-400">/</span>
                                      <span className="font-medium text-slate-500">{totalOrdered.toLocaleString()}</span>
                                      <span className="text-slate-400 text-[10px]">recv</span>
                                      <span className={`font-bold ml-1 ${isFullyReceived ? 'text-emerald-600' : 'text-slate-600'}`}>{recvPct}%</span>
                                </div>
                                  </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                    
                    {/* PO Summary Statistics - Enterprise footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                        {(() => {
                          const realPOs = poHeadersSource.filter((po: any) => {
                            const poId = (po['PO No.'] ?? po['pohId'] ?? '').toString().trim();
                            if (!poId) return false;
                            const supl = (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim();
                            const tot = parseFloat(po['Total Amount'] ?? po['totalAmt'] ?? po['Total'] ?? 0) || 0;
                            const inv = parseFloat(po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced'] ?? 0) || 0;
                            const recv = parseFloat(po['Received Amount'] ?? po['Total Received'] ?? po['totReceived'] ?? 0) || 0;
                            return !!supl || tot > 0 || inv > 0 || recv > 0;
                          });
                          const totalAmount = realPOs.reduce((sum: number, po: any) => sum + (parseFloat(po['Total Amount'] ?? po['totalAmt'] ?? po['Total'] ?? 0) || 0), 0);
                          const totalInvoiced = realPOs.reduce((sum: number, po: any) => sum + (parseFloat(po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced'] ?? 0) || 0), 0);
                          const openPOs = realPOs.filter((po: any) => (po['Status'] ?? po['poStatus']) === 0 || (po['Status'] ?? po['poStatus']) === '0').length;
                          const uniqueSuppliers = new Set(realPOs.map((po: any) => po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.']).filter(Boolean)).size;
                          
                          return (
                            <>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                  <span className="text-emerald-600 font-bold text-xs">$</span>
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">${totalAmount.toLocaleString()}</div>
                                  <div className="text-slate-500 text-xs font-medium">Total Amount</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <span className="text-blue-600 font-bold text-xs">$</span>
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">${totalInvoiced.toLocaleString()}</div>
                                  <div className="text-slate-500 text-xs font-medium">Total Invoiced</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                                  <Activity className="w-4 h-4 text-amber-600" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{openPOs}</div>
                                  <div className="text-slate-500 text-xs font-medium">Open POs</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                  <Users className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{uniqueSuppliers}</div>
                                  <div className="text-slate-500 text-xs font-medium">Active Suppliers</div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* PO Pagination */}
                    {(() => {
                      const filteredPOs = searchPurchaseOrders.filter((po: any) => {
                        const poId = (po['PO No.'] ?? po['pohId'] ?? '').toString().trim();
                        if (!poId) return false;
                        const supl = (po['Supplier No.'] ?? po['Name'] ?? po['suplId'] ?? po['Vendor No.'] ?? '').toString().trim();
                        const tot = parseFloat(po['Total Amount'] ?? po['totalAmt'] ?? po['Total'] ?? 0) || 0;
                        const inv = parseFloat(po['Invoiced Amount'] ?? po['Total Invoiced'] ?? po['totInvoiced'] ?? 0) || 0;
                        const recv = parseFloat(po['Received Amount'] ?? po['Total Received'] ?? po['totReceived'] ?? 0) || 0;
                        return !!supl || tot > 0 || inv > 0 || recv > 0;
                      });
                      
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
          {activeSection === 'intelligence' && (() => { setActiveSection('ai-command'); return null; })()}

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
                          alert(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
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
              {/* STREAMLINED INVENTORY HEADER - Light Theme (BOM + Shortage in same section) */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Header Bar */}
                <div className="bg-gradient-to-r from-emerald-50/80 via-green-50/80 to-teal-50/80 border-b border-slate-100 px-6 py-4">
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
                    
                    {/* MiSys Capabilities toggle */}
                    <button
                      onClick={() => setShowMISysCapabilities(!showMISysCapabilities)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        showMISysCapabilities 
                          ? 'bg-slate-700 text-white shadow-md' 
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                      title="What MiSys Manufacturing can do"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {showMISysCapabilities ? 'Hide' : 'What MiSys Can Do'}
                    </button>
                  </div>
                  
                  {/* Quick Stats - Compact pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
                      <button 
                        onClick={() => setInventoryFilter('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          inventoryFilter === 'all' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        All: {(data['Items.json'] || []).length.toLocaleString()}
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
                      <button 
                        onClick={() => setInventoryFilter('raw')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          inventoryFilter === 'raw' ? 'bg-slate-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                        title="Raw / purchased (Item Type 0)"
                      >
                        Raw: {(data['Items.json'] || []).filter((i: any) => String(i['Item Type'] ?? '') === '0' || i['Item Type'] === 0).length}
                      </button>
                      <button 
                        onClick={() => setInventoryFilter('assembled')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          inventoryFilter === 'assembled' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                        }`}
                        title="Assembled (Item Type 1)"
                      >
                        Assembled: {(data['Items.json'] || []).filter((i: any) => String(i['Item Type'] ?? '') === '1' || i['Item Type'] === 1).length}
                      </button>
                      <button 
                        onClick={() => setInventoryFilter('formula')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          inventoryFilter === 'formula' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-teal-600 hover:bg-teal-50 border border-teal-200'
                        }`}
                        title="Formula / blend (Item Type 2)"
                      >
                        Formula: {(data['Items.json'] || []).filter((i: any) => String(i['Item Type'] ?? '') === '2' || i['Item Type'] === 2).length}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* MiSys Capabilities Panel - Collapsible */}
                {showMISysCapabilities && (
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      MiSys Manufacturing Capabilities
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Planning & MRP</div>
                        <ul className="text-slate-600 space-y-0.5 text-xs">
                          <li>• Shortages Today / Future Shortages</li>
                          <li>• What If Today / Future What If</li>
                          <li>• Buyer&apos;s Advice → MRP → Purchase Orders</li>
                          <li>• MRP → Work Orders / Mfg. Orders</li>
                        </ul>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Item Transfers</div>
                        <ul className="text-slate-600 space-y-0.5 text-xs">
                          <li>• Dispense/Return Stock</li>
                          <li>• Allocate/Deallocate Stock</li>
                          <li>• Reserve/Relieve Stock</li>
                          <li>• Move Stock, Scrap/Recover</li>
                        </ul>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Assembly & BOM</div>
                        <ul className="text-slate-600 space-y-0.5 text-xs">
                          <li>• Assemble/Disassemble Stock</li>
                          <li>• Assemble/Disassemble WIP</li>
                          <li>• Reserve/Relieve Assembly</li>
                          <li>• BOM explosion & Where Used</li>
                        </ul>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Supplier & Sales</div>
                        <ul className="text-slate-600 space-y-0.5 text-xs">
                          <li>• Receive/Return from Supplier</li>
                          <li>• Receive/Return on PO</li>
                          <li>• Sales Transfers (Item, Assembly, Range)</li>
                        </ul>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Stock Control</div>
                        <ul className="text-slate-600 space-y-0.5 text-xs">
                          <li>• Stock Check & Stock Status</li>
                          <li>• Batch Check (Edit/Check Batch)</li>
                          <li>• Lot/Serial tracking</li>
                        </ul>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Portal Integration</div>
                        <ul className="text-slate-600 space-y-0.5 text-xs">
                          <li>• BOM Planning & Explosion</li>
                          <li>• Shortage (MRP) & Auto-create PO</li>
                          <li>• Lot history & Inventory Log</li>
                          <li>• Adjust, Transfer, Reorder (via Actions)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Tools Row - BOM, Shortage, Lot history, Cart, History, Actions */}
                <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                  {/* Planning - BOM Explosion, Shortages, What If */}
                    <button 
                      onClick={() => { setPlanningTab('bom'); setShowBOMPlanning(!showBOMPlanning); }}
                      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        showBOMPlanning 
                          ? 'bg-purple-600 text-white shadow-md' 
                          : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'
                      }`}
                      title="Inventory Planning - BOM explosion, shortages, what-if"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Planning
                    </button>
                  {/* Shortage (MRP) - same Inventory section */}
                    <button
                      type="button"
                      disabled={shortageLoading}
                      onClick={async () => {
                        setShortageLoading(true);
                        try {
                          const res = await fetch(getApiUrl('/api/shortage'));
                          const j = await res.json();
                          setShortageList(j.shortage || []);
                          setPlanningTab('shortages');
                          setShowBOMPlanning(true);
                        } finally {
                          setShortageLoading(false);
                        }
                      }}
                      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        shortageList.length > 0 ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-amber-600 hover:bg-amber-50 border border-amber-200'
                      }`}
                      title="Load shortages and open Planning"
                    >
                      {shortageLoading ? '…' : 'Shortage'}
                      {shortageList.length > 0 && <span className="bg-white/90 text-amber-700 px-1.5 py-0.5 rounded text-xs font-bold">{shortageList.length}</span>}
                    </button>
                    {shortageList.length > 0 && (
                      <button
                        type="button"
                        disabled={autoCreatePOLoading}
                        onClick={async () => {
                          setAutoCreatePOLoading(true);
                          try {
                            const res = await fetch(getApiUrl('/api/mrp/auto-create-po'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                            const j = await res.json();
                            if (j.po_no) {
                              setShortageList([]);
                              onRefreshData?.();
                            }
                          } finally {
                            setAutoCreatePOLoading(false);
                          }
                        }}
                        className="px-4 py-3 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {autoCreatePOLoading ? 'Creating…' : 'Auto-create PO'}
                      </button>
                    )}
                  {/* Lot history - portal + optional Full Company Data */}
                    {dataCatalog.hasLotTrace && (
                    <button
                      type="button"
                      disabled={lotHistoryLoading}
                      onClick={async () => {
                        const next = !showLotHistory;
                        setShowLotHistory(next);
                        if (next) {
                          setLotHistoryLoading(true);
                          try {
                            const [histRes, byLotRes] = await Promise.all([
                              fetch(getApiUrl('/api/lot-history')).then(r => r.json()).catch(() => ({ history: [] })),
                              fetch(getApiUrl('/api/inventory/by-lot')).then(r => r.json()).catch(() => ({ by_lot: [] }))
                            ]);
                            const apiHistory = histRes.history ?? histRes.lotHistory ?? [];
                            const fromData = data['LotSerialHistory.json'] || [];
                            setLotHistoryList(Array.isArray(fromData) ? [...apiHistory, ...fromData] : apiHistory);
                            setInventoryByLotList(byLotRes.by_lot ?? byLotRes.inventoryByLot ?? []);
                          } finally {
                            setLotHistoryLoading(false);
                          }
                        }
                      }}
                      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        showLotHistory ? 'bg-cyan-600 text-white shadow-md' : 'bg-white text-cyan-600 hover:bg-cyan-50 border border-cyan-200'
                      }`}
                      title="Lot/serial history and inventory by lot"
                    >
                      {lotHistoryLoading ? '…' : 'Lot history'}
                    </button>
                    )}
                    {dataCatalog.hasTransactions && (
                    <button
                      onClick={() => setShowTransactionExplorer(!showTransactionExplorer)}
                      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                        showTransactionExplorer ? 'bg-violet-600 text-white shadow-md' : 'bg-white text-violet-600 hover:bg-violet-50 border border-violet-200'
                      }`}
                      title="Inventory Log - search by item, MO, lot, date"
                    >
                      <Activity className="w-4 h-4" />
                      Inventory Log
                    </button>
                    )}
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
                  {/* Inventory Actions - Adjust, Transfer, Reorder */}
                  <button
                    onClick={() => { setInventoryActionsInitialTab('adjust'); setShowInventoryActionsModal(true); }}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-2"
                    title="Adjust stock (add/remove)"
                  >
                    <Edit className="w-4 h-4" /> Actions
                  </button>
                </div>
                {/* Shortage table (below reorder level) - inline in same Inventory card when loaded */}
                {shortageList.length > 0 && (
                  <div className="px-6 py-3 border-t border-amber-200 bg-amber-50/50">
                    <div className="text-sm font-semibold text-amber-800 mb-2">Items below reorder level</div>
                    <div className="overflow-x-auto max-h-28 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead><tr><th className="text-left p-1 font-medium text-slate-600">Item</th><th className="text-right p-1 font-medium text-slate-600">Shortage</th><th className="text-right p-1 font-medium text-slate-600">On hand</th><th className="text-right p-1 font-medium text-slate-600">Open PO</th></tr></thead>
                        <tbody>
                          {shortageList.slice(0, 15).map((s: any, i: number) => (
                            <tr key={i} className="border-t border-amber-100"><td className="p-1 font-mono text-red-600">{s.item_no}</td><td className="p-1 text-right font-medium text-red-600">{Number(s.shortage_qty).toLocaleString()}</td><td className="p-1 text-right text-slate-600">{Number(s.on_hand).toLocaleString()}</td><td className="p-1 text-right text-slate-600">{Number(s.open_po).toLocaleString()}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      {shortageList.length > 15 && <p className="text-xs text-slate-500 mt-1">+ {shortageList.length - 15} more</p>}
                    </div>
                  </div>
                )}
                {/* Lot history panel - portal-recorded + Full Company Data when present */}
                {showLotHistory && (
                  <div className="px-6 py-3 border-t border-cyan-200 bg-cyan-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-cyan-800">Lot / serial history &amp; inventory by lot</span>
                      <button type="button" onClick={() => setShowLotHistory(false)} className="text-cyan-600 hover:text-cyan-800 text-sm font-medium">Close</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">History (receives, production)</div>
                        <div className="overflow-x-auto max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                          {(lotHistoryList.length === 0) ? (
                            <p className="p-2 text-slate-500 text-sm">No lot history recorded yet.</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead><tr><th className="text-left p-1 font-medium text-slate-600">Item</th><th className="text-left p-1 font-medium text-slate-600">Lot</th><th className="text-right p-1 font-medium text-slate-600">Qty</th><th className="text-left p-1 font-medium text-slate-600">Type</th></tr></thead>
                              <tbody>
                                {lotHistoryList.slice(0, 50).map((h: any, i: number) => (
                                  <tr key={i} className="border-t border-slate-100">
                                    <td className="p-1 font-mono">{h.item_no ?? h['Item No.'] ?? h.itemNo ?? '-'}</td>
                                    <td className="p-1">{h.lot_no ?? h.lot ?? h['Lot No.'] ?? '-'}</td>
                                    <td className="p-1 text-right">{Number(h.qty ?? h.quantity ?? 0).toLocaleString()}</td>
                                    <td className="p-1">{h.type ?? h.transaction_type ?? 'receive'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {lotHistoryList.length > 50 && <p className="text-xs text-slate-500 p-1">+ {lotHistoryList.length - 50} more</p>}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Inventory by lot</div>
                        <div className="overflow-x-auto max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                          {(inventoryByLotList.length === 0) ? (
                            <p className="p-2 text-slate-500 text-sm">No lot-level inventory.</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead><tr><th className="text-left p-1 font-medium text-slate-600">Item</th><th className="text-left p-1 font-medium text-slate-600">Lot</th><th className="text-right p-1 font-medium text-slate-600">Qty</th></tr></thead>
                              <tbody>
                                {inventoryByLotList.slice(0, 50).map((b: any, i: number) => (
                                  <tr key={i} className="border-t border-slate-100">
                                    <td className="p-1 font-mono">{b.item_no ?? b['Item No.'] ?? b.itemNo ?? '-'}</td>
                                    <td className="p-1">{b.lot_no ?? b.lot ?? b['Lot No.'] ?? '-'}</td>
                                    <td className="p-1 text-right">{Number(b.qty ?? b.quantity ?? b.on_hand ?? 0).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {inventoryByLotList.length > 50 && <p className="text-xs text-slate-500 p-1">+ {inventoryByLotList.length - 50} more</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Transaction Explorer (Inventory Log) - indexed search */}
                {showTransactionExplorer && (
                  <div ref={transactionExplorerRef} className="px-6 py-3 border-t border-violet-200 bg-violet-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-violet-800">Inventory Log</span>
                      <button type="button" onClick={() => setShowTransactionExplorer(false)} className="text-violet-600 hover:text-violet-800 text-sm font-medium">Close</button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3 items-center">
                      <input type="text" placeholder="Item No." className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg w-28" value={txExplorerFilters.itemNo ?? ''} onChange={(e) => setTxExplorerFilters((f) => ({ ...f, itemNo: e.target.value || undefined }))} />
                      <input type="text" placeholder="MO/PO ref" className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg w-28" value={txExplorerFilters.docRef ?? ''} onChange={(e) => setTxExplorerFilters((f) => ({ ...f, docRef: e.target.value || undefined }))} />
                      <input type="text" placeholder="Lot No." className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg w-24" value={txExplorerFilters.lot ?? ''} onChange={(e) => setTxExplorerFilters((f) => ({ ...f, lot: e.target.value || undefined }))} />
                      <input type="text" placeholder="Serial No." className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg w-24" value={txExplorerFilters.serial ?? ''} onChange={(e) => setTxExplorerFilters((f) => ({ ...f, serial: e.target.value || undefined }))} />
                      <input type="date" className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg" value={txExplorerFilters.dateFrom ?? ''} onChange={(e) => setTxExplorerFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))} />
                      <span className="text-slate-400">to</span>
                      <input type="date" className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg" value={txExplorerFilters.dateTo ?? ''} onChange={(e) => setTxExplorerFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))} />
                      {(txExplorerFilters.itemNo || txExplorerFilters.docRef || txExplorerFilters.lot || txExplorerFilters.serial || txExplorerFilters.dateFrom || txExplorerFilters.dateTo) && (
                        <button type="button" onClick={() => setTxExplorerFilters({})} className="px-2 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Clear filters</button>
                      )}
                    </div>
                    <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                      {!txExplorerView.hasData ? (
                        <p className="p-4 text-slate-500 text-sm">No transactions. Include MILOGH.CSV or LotSerialHistory in Full Company Data.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 sticky top-0"><tr><th className="text-left p-2 font-medium text-slate-600">Date</th><th className="text-left p-2 font-medium text-slate-600">Type</th><th className="text-left p-2 font-medium text-slate-600">Item</th><th className="text-right p-2 font-medium text-slate-600">Qty</th><th className="text-left p-2 font-medium text-slate-600">Loc</th><th className="text-left p-2 font-medium text-slate-600">Ref</th><th className="text-left p-2 font-medium text-slate-600">User</th></tr></thead>
                          <tbody>
                            {txExplorerView.rows.map((tx, i) => (
                              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{formatDisplayDate(tx.date) || '—'}</td>
                                <td className="p-2">{tx.type || '—'}</td>
                                <td className="p-2 font-mono text-blue-600 cursor-pointer hover:underline" onClick={() => tx.itemNo && openItemById(tx.itemNo)}>{tx.itemNo || '—'}</td>
                                <td className="p-2 text-right tabular-nums">{tx.qty.toLocaleString()}</td>
                                <td className="p-2 font-mono text-slate-600">{tx.location || '—'}</td>
                                <td className="p-2 font-mono text-slate-600">
                                  {tx.reference ? (
                                    <span className="text-violet-600 cursor-pointer hover:underline" onClick={() => {
                                      const r = tx.raw ?? {};
                                      const poNo = (r['PO No.'] ?? r['xvarPOId'] ?? r['poId'] ?? '').toString().trim();
                                      const moNo = (r['Mfg. Order No.'] ?? r['xvarMOId'] ?? r['mohId'] ?? '').toString().trim();
                                      if (poNo) { openPOById(poNo); }
                                      else if (moNo) { openMOById(moNo); }
                                      else { setTxExplorerFilters((f) => ({ ...f, docRef: tx.reference })); }
                                    }}>{tx.reference}</span>
                                  ) : '—'}
                                </td>
                                <td className="p-2 text-slate-600">{tx.user || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {txExplorerView.totalCount > 300 && <p className="text-xs text-slate-500 p-2 border-t">Showing 300 of {txExplorerView.totalCount}</p>}
                    </div>
                  </div>
                )}
                {showBOMPlanning && (
                <div className="bg-white rounded-2xl shadow-xl border border-purple-200 p-6 mt-4 mx-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Inventory Planning
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                      {planningTab === 'bom' && (() => {
                        const assembledItems = (data['Items.json'] || []).filter((item: any) => 
                          (data['BillOfMaterialDetails.json'] || []).some((bom: any) => 
                            bom["Parent Item No."] === item["Item No."]
                          )
                        );
                        return `${assembledItems.length} Assembled Items`;
                      })()}
                      {planningTab === 'shortages' && `${shortageList.length} Shortages`}
                      {planningTab === 'whatif' && 'What If Analysis'}
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

                {/* Planning tabs: BOM Explosion | Shortages | What If */}
                <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 pb-3">
                  {(['bom', 'shortages', 'whatif'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPlanningTab(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        planningTab === t ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t === 'bom' && 'BOM Explosion'}
                      {t === 'shortages' && <>Shortages {shortageList.length > 0 && <span className="ml-1 bg-white/90 text-amber-700 px-1.5 py-0.5 rounded text-xs">{shortageList.length}</span>}</>}
                      {t === 'whatif' && 'What If'}
                    </button>
                  ))}
                </div>
                
                {/* BOM Explosion tab content */}
                {planningTab === 'bom' && (
                <div className="space-y-6">
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
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
                        📋 Purchase Requisition History
                        <span className="text-sm font-normal text-indigo-600">
                          ({filteredPRHistory.length} of {prHistory.length})
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
                    
                    {/* Search & Filter Bar */}
                    <div className="mb-4 flex flex-wrap gap-3 items-center">
                      {/* Search Input */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search PRs (item, supplier, user, notes...)"
                            value={prHistorySearch}
                            onChange={(e) => setPrHistorySearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          />
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          {prHistorySearch && (
                            <button
                              onClick={() => setPrHistorySearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Filter Buttons */}
                      <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-indigo-200">
                        {[
                          { value: 'all', label: 'All', icon: '📋' },
                          { value: 'completed', label: 'Generated', icon: '✅' },
                          { value: 'ordered', label: 'Ordered', icon: '📦' },
                          { value: 'received', label: 'Received', icon: '✔️' }
                        ].map(status => (
                          <button
                            key={status.value}
                            onClick={() => setPrHistoryStatusFilter(status.value as any)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                              prHistoryStatusFilter === status.value
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-indigo-700 hover:bg-indigo-100'
                            }`}
                          >
                            {status.icon} {status.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {prHistoryLoading && prHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-3xl mb-2 animate-pulse">📊</div>
                        <div>Loading PR history...</div>
                      </div>
                    ) : filteredPRHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-3xl mb-2">📭</div>
                        <div>{prHistory.length > 0 ? 'No PRs match your search/filter' : 'No PRs generated in the last 30 days'}</div>
                        {prHistory.length > 0 && prHistorySearch && (
                          <button 
                            onClick={() => { setPrHistorySearch(''); setPrHistoryStatusFilter('all'); }}
                            className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-indigo-200">
                              <th className="text-left py-2 px-3 font-semibold text-indigo-900">Date</th>
                              <th className="text-left py-2 px-3 font-semibold text-indigo-900">User</th>
                              <th className="text-left py-2 px-3 font-semibold text-indigo-900">Justification</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">Items</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">Suppliers</th>
                              <th className="text-right py-2 px-3 font-semibold text-indigo-900">Value</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">Status</th>
                              <th className="text-center py-2 px-3 font-semibold text-indigo-900">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPRHistory.map((pr: any, index: number) => {
                              const isExpanded = expandedPRHistory.has(pr.id || `pr-${index}`);
                              const isEditing = editingPRId === pr.id;
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
                              const hasFullData = pr.short_items_detail?.length > 0 || pr.component_breakdown?.length > 0;
                              const components = pr.short_items_detail || pr.component_breakdown || pr.items_requested || [];
                              
                              // Status badge colors
                              const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
                                completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Generated', icon: '✅' },
                                ordered: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ordered', icon: '📦' },
                                received: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Received', icon: '✔️' },
                                cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled', icon: '❌' }
                              };
                              const currentStatus = statusConfig[pr.status] || statusConfig.completed;
                              
                              return (
                                <React.Fragment key={pr.id || index}>
                                  <tr 
                                    className="border-b border-indigo-100 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    onClick={toggleExpand}
                                  >
                                    <td className="py-3 px-3 font-medium text-gray-900">
                                      <div className="flex items-center gap-2">
                                        <span className="text-indigo-400">{isExpanded ? '▼' : '▶'}</span>
                                        <div>
                                          <div className="font-semibold">{pr.date}</div>
                                          <div className="text-xs text-gray-500">{pr.time}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-gray-800 text-sm">{pr.user}</td>
                                    <td className="py-3 px-3 text-gray-600 max-w-xs">
                                      <div className="truncate text-sm" title={pr.justification}>
                                        {pr.justification?.length > 25 ? `${pr.justification.substring(0, 25)}...` : pr.justification}
                                      </div>
                                      {pr.po_number && (
                                        <div className="text-xs text-blue-600 font-medium mt-0.5">
                                          PO: {pr.po_number}
                                        </div>
                                      )}
                                      {pr.notes && (
                                        <div className="text-xs text-gray-400 mt-0.5 truncate" title={pr.notes}>
                                          📝 {pr.notes.substring(0, 20)}...
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                        {components.length || 0}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex flex-wrap gap-1 justify-center">
                                        {pr.suppliers?.slice(0, 2).map((s: any, i: number) => (
                                          <span 
                                            key={i} 
                                            className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                            title={s.supplier_name}
                                          >
                                            {s.supplier_no?.length > 8 ? `${s.supplier_no.substring(0, 8)}...` : s.supplier_no}
                                          </span>
                                        ))}
                                        {pr.suppliers?.length > 2 && (
                                          <span className="text-gray-500 text-xs">+{pr.suppliers.length - 2}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-right font-medium text-gray-900 text-sm">
                                      ${(pr.total_value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="relative group">
                                        <button
                                          className={`${currentStatus.bg} ${currentStatus.text} px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1`}
                                        >
                                          {currentStatus.icon} {currentStatus.label}
                                        </button>
                                        {/* Status Dropdown */}
                                        <div className="absolute hidden group-hover:block right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]">
                                          {Object.entries(statusConfig).filter(([key]) => key !== 'cancelled').map(([key, config]) => (
                                            <button
                                              key={key}
                                              onClick={() => updatePRHistory(pr.id, { status: key })}
                                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 ${
                                                pr.status === key ? 'bg-gray-100 font-medium' : ''
                                              }`}
                                            >
                                              {config.icon} {config.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        {/* Redo Button */}
                                        <button
                                          onClick={() => {
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
                                          className="p-1.5 rounded hover:bg-orange-100 text-orange-600 transition-colors"
                                          title="Regenerate PRs"
                                        >
                                          🔄
                                        </button>
                                        {/* Add to Cart */}
                                        <button
                                          onClick={() => addPRItemsToCart(components)}
                                          className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                                          title="Add items to cart"
                                        >
                                          🛒
                                        </button>
                                        {/* Edit Notes */}
                                        <button
                                          onClick={() => {
                                            setEditingPRId(pr.id);
                                            setEditPRNotes(pr.notes || '');
                                            setEditPRPoNumber(pr.po_number || '');
                                          }}
                                          className="p-1.5 rounded hover:bg-purple-100 text-purple-600 transition-colors"
                                          title="Edit notes/PO"
                                        >
                                          ✏️
                                        </button>
                                        {/* Delete */}
                                        <button
                                          onClick={() => deletePRHistory(pr.id)}
                                          className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                                          title="Delete PR"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  {/* Edit Notes/PO Inline Form */}
                                  {isEditing && (
                                    <tr className="bg-purple-50 border-b border-purple-200">
                                      <td colSpan={8} className="px-4 py-3">
                                        <div className="flex items-center gap-4">
                                          <div className="flex-1">
                                            <label className="text-xs font-medium text-purple-700 mb-1 block">PO Number</label>
                                            <input
                                              type="text"
                                              value={editPRPoNumber}
                                              onChange={(e) => setEditPRPoNumber(e.target.value)}
                                              placeholder="Enter PO number..."
                                              className="w-full px-3 py-1.5 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <label className="text-xs font-medium text-purple-700 mb-1 block">Notes</label>
                                            <input
                                              type="text"
                                              value={editPRNotes}
                                              onChange={(e) => setEditPRNotes(e.target.value)}
                                              placeholder="Add notes..."
                                              className="w-full px-3 py-1.5 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                          </div>
                                          <div className="flex gap-2 pt-5">
                                            <button
                                              onClick={() => {
                                                updatePRHistory(pr.id, { 
                                                  po_number: editPRPoNumber,
                                                  notes: editPRNotes 
                                                });
                                              }}
                                              className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={() => setEditingPRId(null)}
                                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  
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
                                                  addToast({ type: 'success', title: 'Copied', message: 'Copied to clipboard! Paste into Excel.' });
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
                                                  addToast({ type: 'success', title: 'Copied', message: 'Copied to clipboard!' });
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
                        <div className="mt-4 pt-3 border-t border-indigo-200 flex justify-between items-center text-sm text-indigo-700">
                          <span>
                            Showing: {filteredPRHistory.length} PR{filteredPRHistory.length !== 1 ? 's' : ''}
                            {filteredPRHistory.length !== prHistory.length && (
                              <span className="text-gray-500"> of {prHistory.length} total</span>
                            )}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Generated: {filteredPRHistory.filter(pr => pr.status === 'completed' || !pr.status).length}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Ordered: {filteredPRHistory.filter(pr => pr.status === 'ordered').length}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                              Received: {filteredPRHistory.filter(pr => pr.status === 'received').length}
                            </span>
                          </div>
                          <span className="font-semibold">
                            Value: ${filteredPRHistory.reduce((sum: number, pr: any) => sum + (pr.total_value || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
                              const items = data['Items.json'] || [];
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
                                  const response = await fetch(getApiUrl('/api/pr/create-from-bom'), {
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
                                  
                                  // Show success message with toast
                                  if (filename.endsWith('.zip')) {
                                    toastSuccess('PRs Generated!', `Multiple PRs (grouped by supplier) downloaded as ${filename}`, {
                                      label: 'View History',
                                      onClick: () => { setShowPRHistory(true); fetchPRHistory(); }
                                    });
                                  } else {
                                    toastSuccess('PR Generated!', `Downloaded as ${filename}`, {
                                      label: 'View History',
                                      onClick: () => { setShowPRHistory(true); fetchPRHistory(); }
                                    });
                                  }
                                  // Auto-refresh history
                                  fetchPRHistory();
                                  
                                } catch (error) {
                                  console.error('PR generation error:', error);
                                  toastError('PR Generation Failed', error instanceof Error ? error.message : 'Unknown error');
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
                                  const newTotal = bomCart[existingIndex].qty + bomQuantity;
                                  setBomCart(prev => prev.map((c, i) => 
                                    i === existingIndex ? { ...c, qty: newTotal } : c
                                  ));
                                  toastSuccess('Cart Updated', `${selectedBomItem["Item No."]} now has ${newTotal} units`, {
                                    label: 'View Cart',
                                    onClick: () => setShowBomCart(true)
                                  });
                                } else {
                                  // Add new item
                                  setBomCart(prev => [...prev, {
                                    item_no: selectedBomItem["Item No."],
                                    description: selectedBomItem["Description"] || '',
                                    qty: bomQuantity
                                  }]);
                                  toastSuccess('Added to Cart', `${selectedBomItem["Item No."]} × ${bomQuantity}`, {
                                    label: 'View Cart',
                                    onClick: () => setShowBomCart(true)
                                  });
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
                                const items = data['Items.json'] || [];
                                
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
                {planningTab === 'shortages' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-600">Items below reorder level. Load via Shortage button if empty.</p>
                      <button
                        type="button"
                        disabled={shortageLoading}
                        onClick={async () => {
                          setShortageLoading(true);
                          try {
                            const res = await fetch(getApiUrl('/api/shortage'));
                            const j = await res.json();
                            setShortageList(j.shortage || []);
                          } finally {
                            setShortageLoading(false);
                          }
                        }}
                        className="px-3 py-1.5 text-sm font-medium bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200"
                      >
                        {shortageLoading ? 'Loading…' : 'Refresh Shortages'}
                      </button>
                    </div>
                    {shortageList.length > 0 ? (
                      <>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0"><tr><th className="text-left p-2 font-medium text-slate-600">Item</th><th className="text-right p-2 font-medium text-slate-600">Shortage</th><th className="text-right p-2 font-medium text-slate-600">On hand</th><th className="text-right p-2 font-medium text-slate-600">Open PO</th></tr></thead>
                            <tbody>
                              {shortageList.map((s: any, i: number) => (
                                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-2 font-mono text-red-600">{s.item_no}</td><td className="p-2 text-right font-medium text-red-600">{Number(s.shortage_qty).toLocaleString()}</td><td className="p-2 text-right text-slate-600">{Number(s.on_hand).toLocaleString()}</td><td className="p-2 text-right text-slate-600">{Number(s.open_po || 0).toLocaleString()}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          type="button"
                          disabled={autoCreatePOLoading}
                          onClick={async () => {
                            setAutoCreatePOLoading(true);
                            try {
                              const res = await fetch(getApiUrl('/api/mrp/auto-create-po'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                              const j = await res.json();
                              if (j.po_no) {
                                setShortageList([]);
                                onRefreshData?.();
                              }
                            } finally {
                              setAutoCreatePOLoading(false);
                            }
                          }}
                          className="px-4 py-2 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {autoCreatePOLoading ? 'Creating…' : 'Auto-create PO'}
                        </button>
                      </>
                    ) : (
                      <p className="text-slate-500 py-4">No shortages. Click Shortage in the tools row to load, or run MRP.</p>
                    )}
                    <div className="pt-3 border-t border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">MRP Process</div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="px-2 py-1 bg-purple-100 rounded">Buyer&apos;s Advice</span>
                        <span>→</span>
                        <span className="px-2 py-1 bg-purple-100 rounded">Create MRP</span>
                        <span>→</span>
                        <span className="px-2 py-1 bg-purple-100 rounded">Create POs</span>
                        <span>→</span>
                        <span className="px-2 py-1 bg-purple-100 rounded">Purchase Orders</span>
                      </div>
                    </div>
                  </div>
                )}
                {planningTab === 'whatif' && (
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-slate-600">What-if analysis: simulate transfers, builds, or demand changes before running MRP.</p>
                    <p className="text-xs text-slate-500">Use <code className="bg-slate-100 px-1 rounded">POST /api/mrp/what-if</code> with scenario data. Future: horizon-based what-if UI.</p>
                  </div>
                )}
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
                {/* Search & Controls Bar - User-friendly layout */}
                <div className="mb-6 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={inventorySearchQuery}
                        onChange={(e) => setInventorySearchQuery(e.target.value)}
                        placeholder="🔍 Smart search: 'tx case', 'bottle 1l', 'semi synthetic'... (finds partial matches!)"
                        className="w-full px-6 py-3.5 text-base rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-emerald-500">
                        <span className="text-lg">⚡</span>
                        <span className="text-[10px] font-semibold uppercase">Smart</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-sm text-slate-600 font-medium">Sort:</label>
                      <select
                        value={sortBy}
                        onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                      >
                        <option value="name">Item No. A–Z</option>
                        <option value="name-desc">Item No. Z–A</option>
                        <option value="description">Description A–Z</option>
                        <option value="quantity">Stock High→Low</option>
                        <option value="quantity-asc">Stock Low→High</option>
                        <option value="status">Status (Out first)</option>
                      </select>
                      <label className="text-sm text-slate-600 font-medium ml-2">Show:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                      >
                        <option value={12}>12</option>
                        <option value={20}>20</option>
                        <option value={40}>40</option>
                        <option value={60}>60</option>
                        <option value={100}>100</option>
                        <option value={999999}>All</option>
                      </select>
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
                  
                  // Get stock ownership breakdown (Canoil vs Customer stock)
                  // Pick Sequence contains location: 62TODD/HOME = Canoil, BRO/LANXESS/etc = Customer
                  const stockOwnership = getStockByOwnership(item["Item No."], data);
                  const hasCustomerStock = stockOwnership.customerStock > 0;
                  const canoilStock = stockOwnership.canoilStock;
                  const isCustomerOwned = hasCustomerStock && canoilStock === 0; // ALL stock is customer's
                  const customerName = stockOwnership.customerBreakdown[0]?.location || stockOwnership.location;
                  
                  let statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  let statusText = 'In Stock';
                  let statusDot = 'bg-emerald-500';
                  // Use Canoil stock for status (what WE can use)
                  if (canoilStock <= 0) {
                    statusColor = 'bg-red-100 text-red-700 border-red-200';
                    statusText = hasCustomerStock ? 'Customer Only' : 'Out';
                    statusDot = hasCustomerStock ? 'bg-purple-500' : 'bg-red-500';
                  } else if (canoilStock <= reorderLevel && reorderLevel > 0) {
                    statusColor = 'bg-amber-100 text-amber-700 border-amber-200';
                    statusText = 'Low';
                    statusDot = 'bg-amber-500';
                  }
                  
                  // Check if item is assembled (PERFORMANCE: using pre-computed Set)
                  const isAssembled = assembledItemsSet.has((item["Item No."] ?? "").toString().trim().toUpperCase());
                  
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
                        setItemModalActiveView('master');
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

                      {/* Stock & WIP - Modern Cards with Ownership */}
                      <div className="flex gap-2 mx-3 mb-3">
                        <div className={`flex-1 py-3 px-3 rounded-xl relative ${
                          canoilStock <= 0 
                            ? hasCustomerStock ? 'bg-gradient-to-br from-purple-100 to-purple-50' : 'bg-gradient-to-br from-red-100 to-red-50'
                            : canoilStock <= reorderLevel && reorderLevel > 0
                              ? 'bg-gradient-to-br from-amber-100 to-amber-50'
                              : 'bg-gradient-to-br from-emerald-100/80 to-emerald-50/50'
                        }`}>
                          <div className={`text-2xl font-black tracking-tight ${
                            canoilStock <= 0 
                              ? hasCustomerStock ? 'text-purple-600' : 'text-red-600'
                              : canoilStock <= reorderLevel && reorderLevel > 0 
                                ? 'text-amber-600' 
                                : 'text-emerald-600'
                          }`}>{canoilStock.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                            {hasCustomerStock ? 'Our Stock' : 'Stock'}
                          </div>
                          {/* Customer stock indicator - show owner name */}
                          {hasCustomerStock && (
                            <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-purple-500 text-white text-[8px] font-bold rounded-full" title={`Customer stock at ${customerName}`}>
                              {isCustomerOwned ? customerName : `+${stockOwnership.customerStock.toLocaleString()}`}
                            </div>
                          )}
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

                      {/* Footer: On Order + Cost + Add to Cart */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50/80 to-transparent border-t border-gray-100/80">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          <span className="text-xs text-gray-500">
                            <span className="font-bold text-gray-700">{onOrder.toLocaleString()}</span> on order
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-black text-gray-800">{formatCAD(cost)}</div>
                          {/* Add to Cart Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickAddItem(item);
                              setQuickAddQty(1);
                              setShowQuickAddPopup(true);
                            }}
                            className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-md hover:shadow-lg"
                            title="Add to PR Cart"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
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
                          {displayFolderName(folder)}
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
                      <button
                        onClick={() => setShowProformaInvoice(!showProformaInvoice)}
                        className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg ${
                          showProformaInvoice
                            ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-violet-500/25'
                            : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-400 hover:to-purple-400 shadow-violet-500/25'
                        }`}
                        title="Create Proforma Invoice from a Sales Order"
                      >
                        <FileText className="w-4 h-4" />
                        Proforma Invoice
                      </button>
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

                {/* Proforma Invoice Maker */}
                {showProformaInvoice && (
                  <div className="p-6 border-b border-slate-100">
                    <ProformaInvoiceMaker data={data} onClose={() => setShowProformaInvoice(false)} />
                  </div>
                )}
                
                {/* Content Section - Enhanced Light Theme */}
                <div className="p-6 bg-gradient-to-b from-slate-50/50 to-white">
                  {/* Search Bar - Real-time SO search (hide when Proforma Invoice is open to avoid duplicate) */}
                  {!showProformaInvoice && (
                  <div className="mb-8">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search SO number, customer, or PO (e.g., 3125, LANXESS)..."
                        value={soSearchQuery}
                        onChange={(e) => setSoSearchQuery(e.target.value)}
                        className="w-full px-5 py-4 pl-14 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base shadow-sm"
                      />
                      <div className="absolute left-5 top-1/2 transform -translate-y-1/2">
                        {soSearching ? (
                          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        )}
                      </div>
                      {soSearchQuery && (
                        <button
                          onClick={() => { setSoSearchQuery(''); setSoSearchResults([]); }}
                          className="absolute right-5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Search Results */}
                    {soSearchQuery.trim() && !soSearching && soSearchResults.length > 0 && (
                      <div className="mt-3 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden max-h-[400px] overflow-y-auto">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {soSearchResults.length} result{soSearchResults.length !== 1 ? 's' : ''} found
                        </div>
                        {soSearchResults.map((so) => (
                          <div
                            key={so.so_number}
                            onClick={() => {
                              const statusFolder = so.status;
                              setSoSearchQuery('');
                              setSoSearchResults([]);
                              if (statusFolder === 'Completed and Closed' || statusFolder === 'In Production' || statusFolder === 'Cancelled') {
                                navigateToSOFolder(statusFolder);
                              } else {
                                navigateToSOFolder(statusFolder);
                              }
                            }}
                            className="flex items-center gap-4 px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors group"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                              SO
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">SO {so.so_number}</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  so.status === 'New and Revised' ? 'bg-emerald-100 text-emerald-700' :
                                  so.status === 'In Production' ? 'bg-orange-100 text-orange-700' :
                                  so.status === 'Completed and Closed' ? 'bg-slate-100 text-slate-600' :
                                  so.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {so.status}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 truncate mt-0.5">{so.file}</div>
                            </div>
                            <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        ))}
                      </div>
                    )}

                    {soSearchQuery.trim() && !soSearching && soSearchResults.length === 0 && (
                      <div className="mt-3 text-center py-6 text-slate-500 bg-white border border-slate-200 rounded-2xl">
                        <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="font-medium text-sm">No sales orders matching "{soSearchQuery}"</p>
                        <p className="text-xs mt-1 text-slate-400">Try a different SO number or customer name</p>
                      </div>
                    )}

                    {!soSearchQuery.trim() && (
                      <div className="mt-2 text-xs text-slate-400">
                        Search across all sales order folders: New & Revised, In Production, Completed & Closed, Cancelled
                      </div>
                    )}
                  </div>
                  )}
                  
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

                    {/* Completed and Closed Card */}
                    <div 
                      onClick={() => navigateToSOFolder('Completed and Closed')}
                      className="group relative bg-white rounded-2xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-slate-100/60 to-transparent rounded-full -translate-y-24 translate-x-24 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-100/40 to-transparent rounded-full translate-y-16 -translate-x-16"></div>
                      
                      <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-slate-500 via-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-500/30 group-hover:scale-110 transition-transform ring-4 ring-white">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-xl">Completed & Closed</div>
                              <div className="text-sm text-slate-500 font-semibold">Fulfilled orders by year/month</div>
                            </div>
                          </div>
                          <svg className="w-6 h-6 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-5 mb-5 border border-slate-100">
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-5xl font-black text-slate-900 tracking-tight">{salesOrderAnalytics.completed.count || '1000+'}</div>
                              <div className="text-sm text-slate-600 font-bold uppercase tracking-wider mt-1">Closed SOs</div>
                            </div>
                            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <div className="w-2.5 h-2.5 bg-blue-400 rounded-full"></div>
                          Browse by year: 2022 - 2026
                        </div>
                        <div className="mt-3 h-1 bg-gradient-to-r from-slate-400 to-blue-500 rounded-full opacity-60"></div>
                      </div>
                    </div>

                    {/* Cancelled Card */}
                    <div 
                      onClick={() => navigateToSOFolder('Cancelled')}
                      className="group relative bg-white rounded-2xl p-6 border border-red-200 hover:border-red-300 hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
                    >
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-red-100/60 to-transparent rounded-full -translate-y-24 translate-x-24 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-100/40 to-transparent rounded-full translate-y-16 -translate-x-16"></div>
                      
                      <div className="relative">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-red-500 via-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl shadow-red-500/30 group-hover:scale-110 transition-transform ring-4 ring-white">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-xl">Cancelled</div>
                              <div className="text-sm text-red-500 font-semibold">Voided or cancelled orders</div>
                            </div>
                          </div>
                          <svg className="w-6 h-6 text-red-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        
                        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-5 mb-5 border border-red-100">
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-5xl font-black text-slate-900 tracking-tight">{salesOrderAnalytics.cancelled.count || 0}</div>
                              <div className="text-sm text-red-600 font-bold uppercase tracking-wider mt-1">Cancelled SOs</div>
                            </div>
                            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm border border-red-100">
                              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                          Last updated: {salesOrderAnalytics.cancelled.lastUpdated}
                        </div>
                        <div className="mt-3 h-1 bg-gradient-to-r from-red-500 to-pink-500 rounded-full opacity-60"></div>
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
                  <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-violet-50/80 border-b border-slate-100 px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 tracking-tight">{displayFolderName(soCurrentPath[soCurrentPath.length - 1])}</h3>
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
                                  <div className="font-bold text-slate-900 text-base mb-2 truncate group-hover:text-blue-700 transition-colors">{folder.display_name || folder.name}</div>
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

      {/* ITEM DETAILS MODAL - Uses itemView (portal so it appears on top) */}
      {showItemModal && itemView && createPortal((() => {
        const iv = itemView;
        const itemNo = iv.itemNo;
        const itemNoUpper = itemNo.toString().trim().toUpperCase();
        const item = iv.rawItem;

        const description = iv.description || 'No description';
        const isAssembled = assembledItemsSet.has(itemNoUpper);

        const currentStock = iv.stock;
        const currentWIP = iv.wip;
        const reserve = iv.reserve;
        const onOrder = iv.onOrder;
        const reorderLevel = iv.reorderLevel;
        const reorderQty = iv.reorderQuantity;
        const lotSize = parseStockValue(item['Lot Size'] || item['lotSize'] || 0);
        const unitCost = iv.recentCost || iv.standardCost || iv.unitCost || 0;
        const standardCost = iv.standardCost;
        const recentCost = iv.recentCost;
        const averageCost = parseCostValue(item['Average Cost'] || item['avgCost'] || 0);
        const totalValue = currentStock * unitCost;
        
        const stockStatus = currentStock <= 0 ? 'out' : currentStock <= reorderLevel ? 'low' : 'ok';
        
        // Count related records
        const poCount = (() => {
          const processedPOLines = processPurchaseOrders.lines.filter((line: any) => 
            (line.itemId || '').toString().trim().toUpperCase() === itemNoUpper
          );
          const rawPODetails = poDetailsSource.filter((detail: any) => {
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
        
        const bomWhereUsedCount = (indexes.bomWhereUsedByComponent.get(itemNoUpper) ?? []).length;
        
        const stockOwnership = getStockByOwnership(itemNo, data);
        const hasCustomerStock = stockOwnership.customerStock > 0;
        const customerBreakdown = stockOwnership.customerBreakdown || [];
        const workOrderCount = (data['WorkOrderDetails.json'] || []).filter((d: any) => (d['Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper).length;
        const tabActive = (id: string) => itemModalActiveView === id;

        const navSections: { title: string; items: { id: string; label: string; badge?: number; icon: React.ReactNode }[] }[] = [
          { title: 'Overview', items: [
            { id: 'master', label: 'Master', icon: <ClipboardList className="w-4 h-4" /> },
            { id: 'stock', label: 'Stock', icon: <Package className="w-4 h-4" /> },
            { id: 'costs', label: 'Costs', icon: <DollarSign className="w-4 h-4" /> },
          ]},
          { title: 'Orders', items: [
            { id: 'po', label: 'Purchase Orders', badge: poCount, icon: <FileText className="w-4 h-4" /> },
            { id: 'mo', label: 'Manufacturing', badge: moCount, icon: <Factory className="w-4 h-4" /> },
            { id: 'so', label: 'Sales Orders', badge: soCount, icon: <ShoppingCart className="w-4 h-4" /> },
            { id: 'work-orders', label: 'Work Orders', badge: workOrderCount, icon: <Wrench className="w-4 h-4" /> },
          ]},
          { title: 'Supply chain', items: [
            { id: 'bom-where-used', label: 'BOM Where Used', badge: bomWhereUsedCount, icon: <Layers className="w-4 h-4" /> },
            ...(isAssembled ? [{ id: 'bom', label: 'BOM', icon: <Layers className="w-4 h-4" /> }] : []),
            { id: 'suppliers', label: 'Suppliers', icon: <Building2 className="w-4 h-4" /> },
            { id: 'manufacturers', label: 'Manufacturers', icon: <Factory className="w-4 h-4" /> },
            { id: 'alternates', label: 'Alternates', icon: <Link2 className="w-4 h-4" /> },
          ]},
          { title: 'Inventory & history', items: [
            { id: 'stock-movement', label: 'Stock movement', icon: <Activity className="w-4 h-4" /> },
            { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
            ...(dataCatalog.hasLotTrace ? [{ id: 'sl-numbers', label: 'Serial / lot numbers', icon: <Hash className="w-4 h-4" /> }] : []),
            { id: 'locations', label: 'Locations', icon: <MapPin className="w-4 h-4" /> },
          ]},
          { title: 'Other', items: [
            { id: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" /> },
            { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
          ]},
        ];
        const allTabIds = navSections.flatMap((s) => s.items.map((i) => i.id));
        const currentTabIndex = allTabIds.indexOf(itemModalActiveView);
        const currentTabLabel = navSections.flatMap((s) => s.items).find((i) => i.id === itemModalActiveView)?.label ?? itemModalActiveView;
        const goPrevTab = () => { const i = currentTabIndex <= 0 ? allTabIds.length - 1 : currentTabIndex - 1; setItemModalActiveView(allTabIds[i]); };
        const goNextTab = () => { const i = currentTabIndex >= allTabIds.length - 1 ? 0 : currentTabIndex + 1; setItemModalActiveView(allTabIds[i]); };

        return (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md" 
          style={{ zIndex: 9999 }}
          onClick={closeItemModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-modal-title"
        >
          <div 
            className={`w-full max-w-6xl max-h-[90vh] flex flex-col bg-slate-50 rounded-2xl shadow-2xl ring-2 overflow-hidden ${stockStatus === 'out' ? 'ring-red-400' : stockStatus === 'low' ? 'ring-amber-400' : 'ring-emerald-400'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enterprise header bar */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 bg-slate-800 text-white rounded-t-2xl">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                  stockStatus === 'out' ? 'bg-red-500/20 text-red-300' : stockStatus === 'low' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  <Package2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h1 id="item-modal-title" className="text-xl font-bold tracking-tight text-white truncate">{itemNo}</h1>
                  <p className="text-slate-300 text-sm truncate mt-0.5">{description}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                      isAssembled ? 'bg-orange-500/30 text-orange-200' : (item['Item Type'] ?? item['type']) === 2 || (item['Item Type'] ?? item['type']) === '2' ? 'bg-violet-500/30 text-violet-200' : 'bg-sky-500/30 text-sky-200'
                    }`}>
                      {isAssembled ? 'Assembled' : (item['Item Type'] ?? item['type']) === 2 || (item['Item Type'] ?? item['type']) === '2' ? 'Resource' : 'Purchased'}
                    </span>
                    <span className="text-slate-400 text-xs">Stock {currentStock.toLocaleString()}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 text-xs">WIP {currentWIP.toLocaleString()}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 text-xs">{formatCAD(unitCost)}</span>
                    {itemSageMapping?.sage_part_code && (
                      <>
                        <span className="text-slate-500">·</span>
                        <span className="text-amber-200/90 text-xs font-medium" title={itemSageMapping.sage_description || 'Linked in Sage 50'}>
                          Sage: {itemSageMapping.sage_part_code}
                          {itemSageMapping.confirmed && <span className="ml-1 text-emerald-300">✓</span>}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => { setInventoryActionsInitialTab('adjust'); setShowInventoryActionsModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors" title="Adjust stock (add/remove)">
                  <Edit className="w-4 h-4" /> Adjust
                </button>
                <button onClick={() => { setInventoryActionsInitialTab('transfer'); setShowInventoryActionsModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors" title="Transfer between locations/bins">
                  <Package2 className="w-4 h-4" /> Transfer
                </button>
                <button onClick={() => { setInventoryActionsInitialTab('reorder'); setShowInventoryActionsModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors" title="Min/Max/Reorder settings">
                  <Settings className="w-4 h-4" /> Reorder
                </button>
                <button onClick={() => { setQuickAddItem(item); setQuickAddQty(1); setShowQuickAddPopup(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Add to PR
                </button>
                {dataCatalog.hasTransactions && (
                <button onClick={() => openTransactionExplorerWithFilters({ itemNo })} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium transition-colors">
                  <Activity className="w-4 h-4" /> View in Ledger
                </button>
                )}
                <button onClick={closeItemModal} className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors" aria-label="Close"><X className="w-5 h-5" /><span className="text-sm font-medium">Close</span></button>
              </div>
            </div>

            {/* Body: sidebar + content */}
            <div className="flex-1 flex min-h-0">
              {/* Left sidebar nav - always visible, no scroll away */}
              <aside className="flex-shrink-0 w-56 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                {navSections.map((section) => (
                  <div key={section.title} className="py-2">
                    <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</div>
                    {section.items.map(({ id, label, badge, icon }) => (
                      <button
                        key={id}
                        onClick={() => setItemModalActiveView(id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors border-l-2 ${
                          tabActive(id)
                            ? 'bg-slate-100 border-slate-800 text-slate-900'
                            : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <span className="text-slate-400 flex-shrink-0">{icon}</span>
                        <span className="truncate flex-1">{label}</span>
                        {badge !== undefined && badge > 0 && <span className="flex-shrink-0 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </aside>

              {/* Main content area - scrollable */}
              <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6">
                  {/* KPI strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    <div className={`rounded-xl border p-4 ${stockStatus === 'out' ? 'bg-red-50 border-red-100' : stockStatus === 'low' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">On hand</div>
                      <div className={`text-2xl font-bold mt-0.5 ${stockStatus === 'out' ? 'text-red-600' : stockStatus === 'low' ? 'text-amber-600' : 'text-emerald-600'}`}>{currentStock.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">WIP</div>
                      <div className="text-2xl font-bold text-slate-800 mt-0.5">{currentWIP.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">On order</div>
                      <div className="text-2xl font-bold text-slate-800 mt-0.5">{onOrder.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Unit cost</div>
                      <div className="text-xl font-bold text-slate-800 mt-0.5">{formatCAD(unitCost)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ownership</div>
                      <div className="text-sm font-semibold text-slate-700 mt-0.5">{stockOwnership.canoilStock.toLocaleString()} Canoil{hasCustomerStock ? ` · ${stockOwnership.customerStock.toLocaleString()} Cust.` : ''}</div>
                    </div>
                  </div>

                  {/* Section navigation - Prev/Next between modules */}
                  <div className="flex items-center justify-between gap-4 mb-4 py-2 px-3 bg-slate-100/80 rounded-xl border border-slate-200">
                    <button onClick={goPrevTab} className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors font-medium text-sm" title="Previous section">
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-sm font-semibold text-slate-700">{currentTabLabel}</span>
                    <button onClick={goNextTab} className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors font-medium text-sm" title="Next section">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tab content card - border color by stock status */}
                  <div className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden ${stockStatus === 'out' ? 'border-red-200' : stockStatus === 'low' ? 'border-amber-200' : 'border-emerald-200'}`}>
                    <div className="p-6">
                    <p className="text-xs text-slate-500 mb-4 pb-2 border-b border-slate-100">Click any <strong>PO #</strong>, <strong>MO #</strong>, <strong>Lot</strong>, <strong>Location</strong>, <strong>Bin</strong>, <strong>Supplier</strong>, or <strong>Item</strong> to see more details.</p>

              {/* ===== MASTER TAB ===== */}
              {itemModalActiveView === 'master' && (() => {
                const itemTypeRaw = item['Item Type'] ?? item['type'];
                const typeLabel = itemTypeRaw === 1 || itemTypeRaw === '1' ? 'Assembled' : itemTypeRaw === 2 || itemTypeRaw === '2' ? 'Resource' : 'Purchased';
                const stockingUnit = item['Stocking Units'] || item['uOfM'] || item['Base Unit of Measure'] || item['Unit of Measure'] || 'EA';
                const purchasingUnit = item['Purchasing Units'] || item['poUOfM'] || stockingUnit;
                const minimum = parseStockValue(item['Minimum'] ?? item['minQty'] ?? 0);
                const maximum = parseStockValue(item['Maximum'] ?? item['maxQty'] ?? 0);
                const statusVal = item['Status'] ?? item['status'];
                const statusLabel = statusVal === 0 || statusVal === '0' || (typeof statusVal === 'string' && statusVal.toLowerCase() === 'inactive') ? 'Inactive' : 'Active';
                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Identification</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Item No.</span><div className="font-mono font-bold text-slate-900 text-lg">{itemNo}</div></div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Type</span><div><span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${typeLabel === 'Assembled' ? 'bg-orange-100 text-orange-700' : typeLabel === 'Resource' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{typeLabel}</span></div></div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 sm:col-span-2 lg:col-span-1"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Status</span><div><span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusLabel === 'Inactive' ? 'bg-slate-100 text-slate-600' : stockStatus === 'out' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{statusLabel}</span></div></div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-3"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Description</span><div className="text-slate-900 font-medium">{description}</div></div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Units & reorder</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Stocking unit</span><div className="font-semibold text-slate-900">{stockingUnit}</div></div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Purchasing unit</span><div className="font-semibold text-slate-900">{purchasingUnit}</div></div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Reorder level</span><div className="font-semibold text-slate-900">{reorderLevel.toLocaleString()}</div></div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Reorder qty</span><div className="font-semibold text-slate-900">{reorderQty.toLocaleString()}</div></div>
                        {(minimum > 0 || maximum > 0) && <div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Minimum</span><div className="font-semibold text-slate-900">{minimum.toLocaleString()}</div></div>}
                        {(minimum > 0 || maximum > 0) && <div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider mb-1">Maximum</span><div className="font-semibold text-slate-900">{maximum.toLocaleString()}</div></div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ===== STOCK TAB (itemView.stockByLocation + itemView.bins) ===== */}
              {itemModalActiveView === 'stock' && (() => {
                const byLoc = iv.stockByLocation;
                const bins = iv.bins;
                return (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Aggregated stock</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">On Hand</div><div className="text-2xl font-bold text-emerald-700">{currentStock.toLocaleString()}</div></div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">WIP</div><div className="text-2xl font-bold text-blue-700">{currentWIP.toLocaleString()}</div></div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Reserve</div><div className="text-2xl font-bold text-amber-700">{reserve.toLocaleString()}</div></div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">On Order</div><div className="text-2xl font-bold text-slate-800">{onOrder.toLocaleString()}</div></div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Available</div><div className="text-2xl font-bold text-slate-800">{(currentStock + currentWIP + onOrder).toLocaleString()}</div></div>
                    </div>
                  </div>
                  {byLoc.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">By location (MIILOCQT)</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">On Hand</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">WIP</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Reserve</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">On Order</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{byLoc.map((row, i) => (
                            <tr key={i} className={`bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors`} onClick={() => { setSelectedLocId(row.location || null); setShowLocationDetail(true); }}><td className="px-4 py-3 font-mono font-medium text-blue-600 underline decoration-blue-600/50">{row.location}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{row.onHand?.toLocaleString() ?? '0'}</td><td className="px-4 py-3 text-right tabular-nums">{row.wip?.toLocaleString() ?? '0'}</td><td className="px-4 py-3 text-right tabular-nums">{row.reserve?.toLocaleString() ?? '0'}</td><td className="px-4 py-3 text-right tabular-nums">{row.onOrder?.toLocaleString() ?? '0'}</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {bins.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">By bin (MIBINQ)</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Bin</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">On Hand</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{bins.slice(0, 50).map((row, i) => (
                            <tr key={i} className={`bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors`} onClick={() => { if (row.location && row.bin) { setSelectedBinLocId(row.location); setSelectedBinId(row.bin); setShowBinDetail(true); } }}><td className="px-4 py-3 font-mono text-blue-600 underline decoration-blue-600/50">{row.location || '—'}</td><td className="px-4 py-3 font-mono text-blue-600 underline decoration-blue-600/50">{row.bin || '—'}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{row.onHand.toLocaleString()}</td></tr>
                          ))}</tbody>
                        </table>
                        {bins.length > 50 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 50 of {bins.length} bins</div>}
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Parameters</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Min</span><div className="font-semibold text-slate-900 mt-0.5">{parseStockValue(item['Minimum'] ?? item['minQty'] ?? 0).toLocaleString()}</div></div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Max</span><div className="font-semibold text-slate-900 mt-0.5">{parseStockValue(item['Maximum'] ?? item['maxQty'] ?? 0).toLocaleString()}</div></div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Reorder level</span><div className="font-semibold text-slate-900 mt-0.5">{reorderLevel.toLocaleString()}</div></div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Reorder qty</span><div className="font-semibold text-slate-900 mt-0.5">{reorderQty.toLocaleString()}</div></div>
                      {lotSize > 0 && <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Lot size</span><div className="font-semibold text-slate-900 mt-0.5">{lotSize.toLocaleString()}</div></div>}
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* ===== COSTS TAB (itemView.costHistory - already sorted) ===== */}
              {itemModalActiveView === 'costs' && (() => {
                const sortedCosts = iv.costHistory;
                return (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Cost summary</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Standard Cost</div><div className="text-xl font-bold text-slate-900">{formatCAD(standardCost)}</div></div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Average Cost</div><div className="text-xl font-bold text-slate-900">{formatCAD(averageCost)}</div></div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Last / Recent</div><div className="text-xl font-bold text-slate-900">{formatCAD(recentCost)}</div></div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Unit Cost</div><div className="text-xl font-bold text-slate-900">{formatCAD(unitCost)}</div></div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Current value (on hand × unit cost)</div>
                    <div className="text-2xl font-bold text-slate-900">{formatCAD(totalValue)}</div>
                  </div>
                  {sortedCosts.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Cost history (MIICST)</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Cost</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">PO No.</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Qty</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{sortedCosts.slice(0, 100).map((r, i) => (
                            <tr key={i} className={'bg-white'}><td className="px-4 py-3 text-slate-800">{formatDisplayDate(r.date) || '—'}</td><td className="px-4 py-3 font-mono text-slate-700">{r.location ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); setSelectedLocId(r.location!); setShowLocationDetail(true); }}>{r.location}</span> : '—'}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{formatCAD(r.cost)}</td><td className="px-4 py-3 font-mono text-slate-600">{r.poNo ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openPOById(r.poNo!); }}>{r.poNo}</span> : '—'}</td><td className="px-4 py-3 text-right tabular-nums">{(r.qtyReceived ?? 0).toLocaleString()}</td></tr>
                          ))}</tbody>
                        </table>
                        {sortedCosts.length > 100 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 100 of {sortedCosts.length}</div>}
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* ===== PURCHASE ORDERS TAB ===== */}
              {itemModalActiveView === 'po' && (() => {
                // Get PO data for this item
                const processedPOLines = processPurchaseOrders.lines.filter((line: any) => 
                  (line.itemId || '').toString().trim().toUpperCase() === itemNoUpper
                );
                
                const rawPODetails = poDetailsSource.filter((detail: any) => {
                  const fields = [detail['Item No.'], detail['Component Item No.'], detail['Part No.']];
                  return fields.some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper);
                });
                
                // Build PO list
                const allPOData: any[] = [];
                const seenPOs = new Set<string>();
                const poKey = (id: any) => (id ?? '').toString().trim();
                
                const rawPOHeaders = poHeadersSource;
                processedPOLines.forEach((line: any) => {
                  const key = poKey(line.poId);
                  if (!key || seenPOs.has(key)) return;
                  seenPOs.add(key);
                  const header = processPurchaseOrders.headers.find((h: any) => h.poId === line.poId);
                  const poNoStr = (line.poId ?? '').toString();
                  const rawHeader = rawPOHeaders.find((h: any) => (h['PO No.'] ?? '').toString() === poNoStr);
                  const poHeader = rawHeader || {
                    'PO No.': line.poId,
                    'Supplier No.': header?.vendor,
                    'Vendor': header?.vendor,
                    'Order Date': header?.orderDate,
                    'Status': header?.status
                  };
                  allPOData.push({
                    poNumber: line.poId,
                    vendor: header?.vendor || '—',
                    orderDate: header?.orderDate,
                    orderedQty: line.orderedQty,
                    receivedQty: line.receivedQty,
                    unitPrice: line.unitPrice,
                    status: header?.status,
                    poHeader
                  });
                });
                
                rawPODetails.forEach((detail: any) => {
                  const poNo = detail['PO No.'] ?? detail['pohId'];
                  const key = poKey(poNo);
                  if (!key || seenPOs.has(key)) return;
                  seenPOs.add(key);
                  const header = rawPOHeaders.find((h: any) => poKey(h['PO No.'] ?? h['pohId']) === key);
                  const hdr = header ?? {};
                  allPOData.push({
                    poNumber: poNo || '—',
                    vendor: hdr['Vendor'] ?? hdr['Name'] ?? hdr['Supplier No.'] ?? hdr['Supplier'] ?? '—',
                    orderDate: hdr['Order Date'] ?? hdr['ordDt'] ?? detail['Order Date'] ?? detail['ordDt'],
                    orderedQty: parseStockValue(detail['Ordered Qty'] || detail['Ordered'] || detail['Quantity'] || 0),
                    receivedQty: parseStockValue(detail['Received Qty'] || detail['Received'] || 0),
                    unitPrice: parseCostValue(detail['Unit Price'] || detail['Price'] || 0),
                    status: hdr['Status'] ?? detail['Status'],
                    poHeader: (Object.keys(hdr).length ? hdr : { 'PO No.': poNo, 'Supplier No.': detail['Vendor'] ?? detail['Supplier'], 'Order Date': detail['Order Date'] ?? detail['ordDt'], 'Status': detail['Status'] }) as any
                  });
                });
                
                allPOData.sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());
                
                if (allPOData.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">No Purchase Orders</div>
                      <p className="text-sm text-slate-500 mt-1">No PO history found for this item</p>
                    </div>
                  );
                }

                // Summary stats
                const totalOrdered = allPOData.reduce((sum, po) => sum + (po.orderedQty || 0), 0);
                const totalReceived = allPOData.reduce((sum, po) => sum + (po.receivedQty || 0), 0);
                const totalValue = allPOData.reduce((sum, po) => sum + ((po.orderedQty || 0) * (po.unitPrice || 0)), 0);

                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Summary</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total POs</div><div className="text-2xl font-bold text-blue-600">{allPOData.length}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Ordered</div><div className="text-2xl font-bold text-slate-800 tabular-nums">{totalOrdered.toLocaleString()}</div></div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Received</div><div className="text-2xl font-bold text-emerald-600 tabular-nums">{totalReceived.toLocaleString()}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Value</div><div className="text-xl font-bold text-slate-800">{formatCAD(totalValue)}</div></div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Purchase orders</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">PO #</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Vendor</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Ordered</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Received</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Price</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {allPOData.slice(0, 20).map((po, index) => {
                              const statusNum = Number(po.status);
                              const statusColor = statusNum === 2 || statusNum === 3 ? 'bg-emerald-100 text-emerald-700' 
                                : statusNum === 1 ? 'bg-amber-100 text-amber-700' 
                                : 'bg-blue-100 text-blue-700';
                              const statusText = statusNum === 2 ? 'Received' : statusNum === 3 ? 'Closed' 
                                : statusNum === 1 ? 'Released' : 'Open';
                              return (
                                <tr
                                  key={index}
                                  className="cursor-pointer transition-colors hover:bg-slate-50/80 bg-white border-b border-slate-100"
                                  onClick={() => {
                                    if (po.poHeader) {
                                      setSelectedPO(po.poHeader);
                                      setShowPODetails(true);
                                      setPoActiveTab('overview');
                                    }
                                  }}
                                >
                                  <td className="px-4 py-3 font-mono text-blue-600 font-medium underline decoration-blue-600/50">{po.poNumber}</td>
                                  <td className="px-4 py-3 text-slate-700">{po.vendor}</td>
                                  <td className="px-4 py-3 text-slate-600">{formatDisplayDate(po.orderDate) || '—'}</td>
                                  <td className="px-4 py-3 text-right font-medium tabular-nums">{(po.orderedQty || 0).toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">{(po.receivedQty || 0).toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right tabular-nums">{formatCAD(po.unitPrice || 0)}</td>
                                  <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusColor}`}>{statusText}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {allPOData.length > 20 && (
                          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 20 of {allPOData.length} records</div>
                        )}
                      </div>
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
                
                const moHeadersList = data['ManufacturingOrderHeaders.json'] || [];
                moDetails.forEach((detail: any) => {
                  const moNo = detail['Mfg. Order No.'];
                  if (seenMOs.has(moNo)) return;
                  seenMOs.add(moNo);
                  const header = moHeadersList.find((h: any) => h['Mfg. Order No.'] === moNo);
                  allMOData.push({
                    moNumber: moNo,
                    buildItem: header?.['Build Item No.'] || '—',
                    orderDate: header?.['Order Date'] ?? header?.['ordDt'],
                    requiredQty: parseStockValue(detail['Required Qty.'] || 0),
                    completedQty: parseStockValue(detail['Completed'] || 0),
                    status: header?.['Status'],
                    type: 'Component',
                    moHeader: header || { 'Mfg. Order No.': moNo, 'Build Item No.': header?.['Build Item No.'] || '—', 'Order Date': detail['Order Date'] ?? detail['ordDt'] ?? header?.['ordDt'] }
                  });
                });
                
                moHeaders.forEach((header: any) => {
                  const moNo = header['Mfg. Order No.'];
                  if (seenMOs.has(moNo)) return;
                  seenMOs.add(moNo);
                  allMOData.push({
                    moNumber: moNo,
                    buildItem: header['Build Item No.'] || itemNoUpper,
                    orderDate: header['Order Date'] ?? header['ordDt'],
                    requiredQty: parseStockValue(header['Ordered'] || 0),
                    completedQty: parseStockValue(header['Completed'] || 0),
                    status: header['Status'],
                    type: 'Build',
                    moHeader: header
                  });
                });
                
                allMOData.sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());
                
                if (allMOData.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Factory className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">No Manufacturing Orders</div>
                      <p className="text-sm text-slate-500 mt-1">No MO history found for this item</p>
                    </div>
                  );
                }
                
                const totalRequired = allMOData.reduce((sum, mo) => sum + (mo.requiredQty || 0), 0);
                const totalCompleted = allMOData.reduce((sum, mo) => sum + (mo.completedQty || 0), 0);

                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Summary</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total MOs</div><div className="text-2xl font-bold text-emerald-600">{allMOData.length}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Required</div><div className="text-2xl font-bold text-slate-800 tabular-nums">{totalRequired.toLocaleString()}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Completed</div><div className="text-2xl font-bold text-emerald-600 tabular-nums">{totalCompleted.toLocaleString()}</div></div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Manufacturing orders</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">MO #</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Build Item</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Required</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Completed</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Type</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {allMOData.slice(0, 20).map((mo, index) => {
                              const statusNum = Number(mo.status);
                              const getMOStatusInfo = (s: number) => {
                                switch (s) {
                                  case 0: return { text: 'Planned', color: 'bg-yellow-100 text-yellow-700' };
                                  case 1: return { text: 'Released', color: 'bg-amber-100 text-amber-700' };
                                  case 2: return { text: 'Started', color: 'bg-blue-100 text-blue-700' };
                                  case 3: return { text: 'Finished', color: 'bg-emerald-100 text-emerald-700' };
                                  case 4: return { text: 'Closed', color: 'bg-slate-100 text-slate-700' };
                                  default: return { text: 'Unknown', color: 'bg-slate-100 text-slate-700' };
                                }
                              };
                              const statusInfo = getMOStatusInfo(statusNum);
                              return (
                                <tr
                                  key={index}
                                  className="cursor-pointer transition-colors hover:bg-slate-50/80 bg-white border-b border-slate-100"
                                  onClick={() => {
                                    if (mo.moHeader) {
                                      setSelectedMO(mo.moHeader);
                                      setShowMODetails(true);
                                    }
                                  }}
                                >
                                  <td className="px-4 py-3 font-mono text-emerald-600 font-medium underline decoration-emerald-600/50">{mo.moNumber}</td>
                                  <td className="px-4 py-3 font-mono text-slate-800">{mo.buildItem ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded" onClick={(e) => { e.stopPropagation(); openItemById(mo.buildItem); }}>{mo.buildItem}</span> : '—'}</td>
                                  <td className="px-4 py-3 text-slate-600">{formatDisplayDate(mo.orderDate) || '—'}</td>
                                  <td className="px-4 py-3 text-right font-medium tabular-nums">{(mo.requiredQty || 0).toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">{(mo.completedQty || 0).toLocaleString()}</td>
                                  <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${mo.type === 'Build' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{mo.type}</span></td>
                                  <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusInfo.color}`}>{statusInfo.text}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {allMOData.length > 20 && (
                          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 20 of {allMOData.length} records</div>
                        )}
                      </div>
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
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <ShoppingBag className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">No Sales Orders Found</div>
                      <p className="text-sm text-slate-500 mt-1">No SO history found for this item</p>
                      <p className="text-xs text-slate-400 mt-3">Searched: {parsedSOs.length} parsed SOs, {soDetails.length} SO details, {soHeaders.length} SO headers</p>
                    </div>
                  );
                }
                
                const totalQty = allSOData.reduce((sum, so) => sum + (so.quantity || 0), 0);
                const totalRevenue = allSOData.reduce((sum, so) => sum + ((so.quantity || 0) * (so.unitPrice || 0)), 0);

                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Summary</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total SOs</div><div className="text-2xl font-bold text-violet-600">{allSOData.length}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Sold</div><div className="text-2xl font-bold text-slate-800 tabular-nums">{totalQty.toLocaleString()}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Revenue</div><div className="text-xl font-bold text-emerald-600">{formatCAD(totalRevenue)}</div></div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Sales orders</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">SO #</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Customer</th>
                              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Qty</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Price</th>
                              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {allSOData.slice(0, 20).map((so, index) => (
                              <tr key={index} className="bg-white border-b border-slate-100 hover:bg-slate-50/80"><td className="px-4 py-3 font-mono text-violet-600 font-medium">{so.soNumber}</td><td className="px-4 py-3 text-slate-700">{so.customer}</td><td className="px-4 py-3 text-slate-600">{so.orderDate}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{(so.quantity || 0).toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums">{formatCAD(so.unitPrice || 0)}</td><td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">{formatCAD((so.quantity || 0) * (so.unitPrice || 0))}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        {allSOData.length > 20 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 20 of {allSOData.length} records</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ===== BOM WHERE USED TAB (item as component in parent BOMs) - uses indexes ===== */}
              {itemModalActiveView === 'bom-where-used' && (() => {
                const bomWhereUsedRows = indexes.bomWhereUsedByComponent.get(itemNoUpper) ?? [];
                const itemsData = data['Items.json'] || [];
                const getParentDescription = (parentItemNo: string) => {
                  const item = itemsData.find((i: any) => (i['Item No.'] || '').toString().trim().toUpperCase() === (parentItemNo || '').toString().trim().toUpperCase());
                  return item?.['Description'] || '—';
                };
                if (bomWhereUsedRows.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Not used as component</div>
                      <p className="text-sm text-slate-500 mt-1">This item is not used in any Bill of Materials</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Summary</h3>
                      <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 shadow-sm inline-block"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Parent BOMs</div><div className="text-2xl font-bold text-teal-600">{bomWhereUsedRows.length}</div></div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Where used</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Parent Item No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Parent Description</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Required Qty</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Unit</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{bomWhereUsedRows.map((bom: any, index: number) => {
                            const parentNo = (bom['Parent Item No.'] ?? bom['bomItem'] ?? '').toString().trim();
                            return (
                            <tr key={index} className="bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors" onClick={() => parentNo && openItemById(parentNo)}><td className="px-4 py-3 font-mono text-teal-600 font-medium">{parentNo ? <span className="text-blue-600 underline decoration-blue-600/50">{parentNo}</span> : '—'}</td><td className="px-4 py-3 text-slate-700">{getParentDescription(parentNo)}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{parseStockValue(bom['Required Quantity'] || bom['Quantity Per'] || bom['Qty Per'] || 1)}</td><td className="px-4 py-3 text-slate-600">{bom['Unit'] || '—'}</td></tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ===== BOM TAB (for assembled items) - uses bomView ===== */}
              {itemModalActiveView === 'bom' && (() => {
                if (!isAssembled) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Not an assembled item</div>
                      <p className="text-sm text-slate-500 mt-1">BOM is only available for assembled items</p>
                    </div>
                  );
                }
                const components = bomView?.components ?? [];
                const itemsDataForBom = data['Items.json'] || [];
                const getComponentDescription = (componentItemNo: string) => {
                  const fromItems = (itemsDataForBom as any[]).find((i: any) => (i['Item No.'] || '').toString().trim().toUpperCase() === (componentItemNo || '').toString().trim().toUpperCase());
                  return fromItems?.['Description'] || '—';
                };
                if (components.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">No BOM Data</div>
                      <p className="text-sm text-slate-500 mt-1">No bill of materials found for this item</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Summary</h3>
                      <div className="flex flex-wrap gap-3 items-center">
                        <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 shadow-sm inline-block"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Components</div><div className="text-2xl font-bold text-orange-600">{components.length}</div></div>
                        {bomView?.revision && <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"><span className="text-xs text-slate-500">Rev:</span> <span className="font-mono font-medium text-slate-700">{bomView.revision}</span></div>}
                        {bomView?.buildQuantity != null && bomView.buildQuantity > 0 && <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"><span className="text-xs text-slate-500">Build Qty:</span> <span className="font-mono font-medium text-slate-700">{bomView.buildQuantity.toLocaleString()}</span></div>}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">BOM components</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Component</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Description</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Qty Per</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{components.map((c, index: number) => {
                            const compNo = c.componentItemNo;
                            const desc = (c.raw?.['Description'] ?? c.comment ?? getComponentDescription(compNo));
                            return (
                              <tr key={index} className="bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors" onClick={() => compNo && openItemById(compNo)}><td className="px-4 py-3 font-mono text-orange-600 font-medium">{compNo ? <span className="text-blue-600 underline decoration-blue-600/50">{compNo}</span> : '—'}</td><td className="px-4 py-3 text-slate-700">{desc || '—'}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{c.requiredQty.toLocaleString()}</td></tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ===== WORK ORDERS TAB ===== */}
              {itemModalActiveView === 'work-orders' && (() => {
                const woDetails = (data['WorkOrderDetails.json'] || []).filter((d: any) => (d['Item No.'] || '').toString().trim().toUpperCase() === itemNoUpper);
                if (woDetails.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Factory className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">No Work Orders</div>
                      <p className="text-sm text-slate-500 text-center max-w-md mt-1">No work order history found for this item. Data from WorkOrderDetails when available.</p>
                    </div>
                  );
                }
                const woHeaders = data['WorkOrders.json'] || [];
                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Summary</h3>
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 p-4 shadow-sm inline-block"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Work Orders</div><div className="text-2xl font-bold text-cyan-600">{woDetails.length}</div></div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Work order list</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">WO #</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Qty</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Status</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{woDetails.slice(0, 20).map((wo: any, idx: number) => {
                            const woNo = (wo['WO No.'] ?? wo['Work Order No.'] ?? '').toString().trim();
                            const header = woHeaders.find((h: any) => (h['WO No.'] || h['Work Order No.']) === woNo);
                            return (
                              <tr key={idx} className={`${idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'} cursor-pointer hover:bg-blue-50`} onClick={() => { if (woNo) { setSelectedWOHId(woNo); setShowWODetail(true); } }}><td className="px-4 py-3 font-mono text-cyan-600 font-medium underline decoration-cyan-600/50">{woNo || '—'}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{parseStockValue(wo['Ordered'] || wo['Quantity'] || 0).toLocaleString()}</td><td className="px-4 py-3 text-slate-600">{header?.['Status'] ?? wo['Status'] ?? '—'}</td></tr>
                            );
                          })}</tbody>
                        </table>
                        {woDetails.length > 20 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 20 of {woDetails.length}</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ===== STOCK MOVEMENT TAB (itemView.transactions + lotHistory) ===== */}
              {itemModalActiveView === 'stock-movement' && (() => {
                const rows = iv.transactions.length > 0 ? iv.transactions : iv.mergedHistory;
                const sourceLabel = iv.transactions.length > 0 ? 'MILOGH' : 'MISLTH';
                if (rows.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Stock Movement</div>
                      <p className="text-sm text-slate-500 text-center max-w-md mt-1">No movement history. Include <strong className="text-slate-600">MILOGH.CSV</strong> or <strong className="text-slate-600">MISLTH.CSV</strong> in your Full Company Data export to see data here.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-600">Source: <span className="font-semibold">{sourceLabel}</span> · {rows.length} records</div>
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-white/95 border-b border-slate-200">
                          <tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">User</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Type</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Quantity</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">PO No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">MO No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">{rows.slice(0, 200).map((m: any, i: number) => (
                          <tr key={i} className={'bg-white'}>
                            <td className="px-4 py-3 text-slate-800">{formatDisplayDate(m.date ?? m['Transaction Date'] ?? m['tranDate']) || '—'}</td>
                            <td className="px-4 py-3 text-slate-800">{m.userId ?? m['User'] ?? m['userId'] ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-800">{m.type ?? m['Type'] ?? '—'}</td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums">{(m.qty ?? m['Quantity'] ?? m['qty'] ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{(m.poNo ?? m['PO No.'] ?? m['xvarPOId'] ?? '') ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); openPOById(m.poNo ?? m['PO No.'] ?? m['xvarPOId']); }}>{m.poNo ?? m['PO No.'] ?? m['xvarPOId']}</span> : '—'}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{(m.moNo ?? m['Mfg. Order No.'] ?? m['xvarMOId'] ?? '') ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); openMOById(m.moNo ?? m['Mfg. Order No.'] ?? m['xvarMOId']); }}>{m.moNo ?? m['Mfg. Order No.'] ?? m['xvarMOId']}</span> : '—'}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{(m.locId ?? m['Location No.'] ?? m['locId'] ?? '') ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); setSelectedLocId(m.locId ?? m['Location No.'] ?? m['locId']); setShowLocationDetail(true); }}>{m.locId ?? m['Location No.'] ?? m['locId']}</span> : '—'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      {rows.length > 200 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 200 of {rows.length}</div>}
                    </div>
                  </div>
                );
              })()}

              {/* ===== SUPPLIERS TAB (from PO history + MISUPL for names) ===== */}
              {itemModalActiveView === 'suppliers' && (() => {
                const rawPODetails = poDetailsSource.filter((d: any) => [d['Item No.'], d['Component Item No.']].some(f => (f || '').toString().trim().toUpperCase() === itemNoUpper));
                const poHeaders = poHeadersSource;
                const suplMaster = (data['MISUPL.json'] || []) as any[];
                const supplierMap: Record<string, { name: string; orderCount: number; lastOrder?: string }> = {};
                rawPODetails.forEach((d: any) => {
                  const poNo = d['PO No.'];
                  const h = poHeaders.find((x: any) => x['PO No.'] === poNo) as any;
                  const suplId = (h?.['Supplier No.'] ?? h?.['suplId'] ?? '').toString().trim();
                  const nameFromPO = h?.['Name'] || h?.['Vendor'] || h?.['Supplier'] || '';
                  const sup = suplMaster.find((s: any) => (s['Supplier No.'] ?? s['suplId'] ?? '').toString().trim() === suplId);
                  const name = (sup?.['Name'] ?? sup?.['name'] ?? (nameFromPO || suplId || '—')).toString();
                  if (!supplierMap[suplId]) supplierMap[suplId] = { name, orderCount: 0 };
                  supplierMap[suplId].orderCount += 1;
                  if (h?.['Order Date'] ?? h?.['ordDt']) supplierMap[suplId].lastOrder = (h['Order Date'] ?? h['ordDt']).toString();
                });
                const suppliers = Object.entries(supplierMap).sort((a, b) => (b[1].orderCount - a[1].orderCount) || ((b[1].lastOrder || '').localeCompare(a[1].lastOrder || '')));
                if (suppliers.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Suppliers</div>
                      <p className="text-sm text-slate-500 text-center max-w-md mt-1">Vendor list from PO history (and MISUPL) will appear here when this item has purchase orders.</p>
                    </div>
                  );
                }
                return (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Suppliers</h3>
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Supplier No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Name</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">PO count</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Last order</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 bg-white">{suppliers.map(([suplId, v], i) => (
                        <tr key={i} className={`bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors`} onClick={() => { if (suplId) { setSelectedSuplId(suplId); setShowSupplierDetail(true); } }}>
                          <td className="px-4 py-3 font-mono text-blue-600 underline decoration-blue-600/50">{suplId || '—'}</td>
                          <td className="px-4 py-3 text-slate-800">{v.name}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">{v.orderCount}</td>
                          <td className="px-4 py-3 text-slate-600">{v.lastOrder ?? '—'}</td>
                        </tr>
                      ))}</tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ===== MANUFACTURERS TAB (MIQMFG) ===== */}
              {itemModalActiveView === 'manufacturers' && (() => {
                const mfgRows = (data['MIQMFG.json'] || []).filter((r: any) => (r['Item No.'] || r['itemId'] || '').toString().trim().toUpperCase() === itemNoUpper);
                if (mfgRows.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Factory className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Manufacturers</div>
                      <p className="text-sm text-slate-500 mt-1">No manufacturer links. Data from <strong className="text-slate-600">MIQMFG.CSV</strong> when available.</p>
                    </div>
                  );
                }
                return (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Manufacturers</h3>
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Manufacturer No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Name</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Product code</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 bg-white">{mfgRows.map((r: any, i: number) => (
                          <tr key={i} className={'bg-white'}><td className="px-4 py-3 font-mono text-slate-800">{r['Manufacturer No.'] ?? r['mfgId'] ?? '—'}</td><td className="px-4 py-3 text-slate-800">{r['Manufacturer Name'] ?? r['mfgName'] ?? '—'}</td><td className="px-4 py-3 font-mono text-slate-700">{r['Product Code'] ?? r['mfgProdCode'] ?? '—'}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ===== ALTERNATES TAB (MIITEMA: itemId / altItemId) ===== */}
              {itemModalActiveView === 'alternates' && (() => {
                const alternates = (data['MIITEMA.json'] || []).filter((r: any) => {
                  const id = (r['Item No.'] || r['itemId'] || '').toString().trim().toUpperCase();
                  const alt = (r['Alternate Item No.'] || r['altItemId'] || '').toString().trim().toUpperCase();
                  return id === itemNoUpper || alt === itemNoUpper;
                });
                if (alternates.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Alternates</div>
                      <p className="text-sm text-slate-500 text-center max-w-md mt-1">No alternate items. Data from <strong className="text-slate-600">MIITEMA.CSV</strong> when available.</p>
                    </div>
                  );
                }
                const itemsData = data['Items.json'] || [];
                return (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Alternate items</h3>
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Item No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Alternate Item No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Description</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 bg-white">{alternates.map((r: any, i: number) => {
                          const altId = (r['Alternate Item No.'] ?? r['altItemId'] ?? '').toString().trim();
                          const itId = (r['Item No.'] ?? r['itemId'] ?? '').toString().trim();
                          const showId = itId.toUpperCase() === itemNoUpper ? altId : itId;
                          const desc = itemsData.find((x: any) => (x['Item No.'] || '').toString().trim().toUpperCase() === showId.toUpperCase())?.['Description'] ?? '—';
                          return (
                          <tr key={i} className={'bg-white'}>
                            <td className="px-4 py-3 font-mono text-slate-800">{itId ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded" onClick={(e) => { e.stopPropagation(); openItemById(itId); }}>{itId}</span> : '—'}</td>
                            <td className="px-4 py-3 font-mono text-slate-800">{altId ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded" onClick={(e) => { e.stopPropagation(); openItemById(altId); }}>{altId}</span> : '—'}</td>
                            <td className="px-4 py-3 text-slate-700">{desc}</td>
                          </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ===== ACTIVITY TAB (empty until data source) ===== */}
              {itemModalActiveView === 'activity' && (
                <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                    <Package2 className="w-7 h-7 text-slate-400" />
                  </div>
                  <div className="text-base font-semibold text-slate-700">Activity</div>
                  <p className="text-sm text-slate-500 text-center max-w-md mt-1">Operational activity log will appear here when available.</p>
                </div>
              )}

              {/* ===== NOTES TAB (MIITEMX: notes, docPath, picPath) ===== */}
              {itemModalActiveView === 'notes' && (() => {
                const noteRow = (data['MIITEMX.json'] || []).find((r: any) => (r['Item No.'] || r['itemId'] || '').toString().trim().toUpperCase() === itemNoUpper);
                if (!noteRow || (!noteRow['Notes'] && !noteRow['Document Path'] && !noteRow['Picture Path'])) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Notes</div>
                      <p className="text-sm text-slate-500 text-center max-w-md mt-1">No notes for this item. Data from <strong className="text-slate-600">MIITEMX.CSV</strong> when available.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-5">
                    {noteRow['Notes'] && <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Notes</h3><div className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed">{noteRow['Notes']}</div></div>}
                    {noteRow['Document Path'] && <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Document path</h3><div className="text-slate-700 font-mono text-sm">{noteRow['Document Path']}</div></div>}
                    {noteRow['Picture Path'] && <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Picture path</h3><div className="text-slate-700 font-mono text-sm">{noteRow['Picture Path']}</div></div>}
                  </div>
                );
              })()}

              {/* ===== HISTORY TAB (itemView.mergedHistory) ===== */}
              {itemModalActiveView === 'history' && (() => {
                const historyRows = iv.mergedHistory;
                if (historyRows.length === 0) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">History</div>
                      <p className="text-sm text-slate-500 text-center max-w-md mt-1">Transaction history from <strong className="text-slate-600">MILOGH.CSV</strong> or <strong className="text-slate-600">MISLTH.CSV</strong> in your Full Company Data export.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-600">Merged transaction history · <span className="font-semibold">{historyRows.length}</span> records</div>
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Source</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">User</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Type</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Quantity</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">PO No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">MO No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 bg-white">{historyRows.slice(0, 200).map((m, i) => (
                          <tr key={i} className={'bg-white'}>
                            <td className="px-4 py-3 text-slate-800">{formatDisplayDate(m.date) || '—'}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m._src ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-800">{m.userId ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-800">{m.type ?? '—'}</td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums">{(m.qty ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{(m.poNo ?? m.raw?.['PO No.'] ?? m.raw?.['xvarPOId'] ?? m.raw?.['poId'] ?? '') ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); openPOById(m.poNo ?? m.raw?.['PO No.'] ?? m.raw?.['xvarPOId'] ?? m.raw?.['poId'] ?? ''); }}>{m.poNo ?? m.raw?.['PO No.'] ?? m.raw?.['xvarPOId'] ?? m.raw?.['poId'] ?? ''}</span> : '—'}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{m.moNo ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); openMOById(m.moNo!); }}>{m.moNo}</span> : '—'}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{m.locId ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded" onClick={(e) => { e.stopPropagation(); setSelectedLocId(m.locId!); setShowLocationDetail(true); }}>{m.locId}</span> : '—'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      {historyRows.length > 200 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 200 of {historyRows.length}</div>}
                    </div>
                  </div>
                );
              })()}

              {/* ===== SL NUMBERS TAB - uses itemLotSummaryView ===== */}
              {itemModalActiveView === 'sl-numbers' && (() => {
                const slv = itemLotSummaryView;
                if (!slv.hasData) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <Package2 className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">Serial / Lot Numbers</div>
                      <p className="text-sm text-slate-500 text-center max-w-md mt-1">No lot/serial records. Include <strong className="text-slate-600">MISLTD.CSV</strong> or <strong className="text-slate-600">MISLHIST.CSV</strong> in your Full Company Data export.</p>
                    </div>
                  );
                }
                const hasExtraCols = slv.serialRows.some((r) => r.description || r.status || r.expiry);
                return (
                  <div className="space-y-6">
                  {slv.serialRows.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Lot/Serial detail</h3>
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-white/95 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Lot No.</th>
                          <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Serial No.</th>
                          {hasExtraCols && <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Description</th>}
                          {hasExtraCols && <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>}
                          {hasExtraCols && <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Expiration</th>}
                          <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {slv.serialRows.map((r, i) => (
                          <tr key={i} className={`bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors`} onClick={() => { if (r.lotNo) { setSelectedLotId(r.lotNo); setShowLotDetail(true); } }}>
                            <td className="px-4 py-3 font-mono text-blue-600 underline decoration-blue-600/50">{r.lotNo || '—'}</td>
                            <td className="px-4 py-3 font-mono text-slate-800">{r.serialNo || '—'}</td>
                            {hasExtraCols && <td className="px-4 py-3 text-slate-700 max-w-[120px] truncate" title={r.description}>{r.description || '—'}</td>}
                            {hasExtraCols && <td className="px-4 py-3"><span className={r.status === 'Active' ? 'text-emerald-600' : 'text-slate-500'}>{r.status || '—'}</span></td>}
                            {hasExtraCols && <td className="px-4 py-3 text-slate-700">{r.expiry || '—'}</td>}
                            <td className="px-4 py-3 text-right font-medium">{r.qty.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    </div>
                  )}
                  {slv.lots.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Lot summary</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Lot No.</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Total Qty</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Last Move</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Expiry</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{slv.lots.map((l, i) => (
                            <tr key={i} className={`bg-white border-b border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors`} onClick={() => { setSelectedLotId(l.lotNo); setShowLotDetail(true); }}>
                              <td className="px-4 py-3 font-mono text-blue-600 underline decoration-blue-600/50">{l.lotNo}</td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums">{l.totalQty.toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-800">{formatDisplayDate(l.lastMoveDate) || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{l.expiry || '—'}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {slv.lotHistoryRows.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Lot history</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Lot No.</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Date</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">User</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Quantity</th><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{slv.lotHistoryRows.slice(0, 100).map((r, i) => (
                            <tr key={i} className={'bg-white'}>
                              <td className="px-4 py-3 font-mono text-slate-800">{r.lotNo ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded" onClick={(e) => { e.stopPropagation(); setSelectedLotId(r.lotNo); setShowLotDetail(true); }}>{r.lotNo}</span> : '—'}</td>
                              <td className="px-4 py-3 text-slate-800">{formatDisplayDate(r.date) || '—'}</td>
                              <td className="px-4 py-3 text-slate-800">{r.userId || '—'}</td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums">{r.qty.toLocaleString()}</td>
                              <td className="px-4 py-3 font-mono text-slate-700">{r.location ? <span className="text-blue-600 underline cursor-pointer hover:bg-blue-50 rounded" onClick={(e) => { e.stopPropagation(); setSelectedLocId(r.location ?? null); setShowLocationDetail(true); }}>{r.location}</span> : '—'}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                        {slv.lotHistoryRows.length > 100 && <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">Showing 100 of {slv.lotHistoryRows.length}</div>}
                      </div>
                    </div>
                  )}
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
                    <div className="rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center py-16 px-6">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                        <MapPin className="w-7 h-7 text-slate-400" />
                      </div>
                      <div className="text-base font-semibold text-slate-700">No Locations</div>
                      <p className="text-sm text-slate-500 mt-1">No location records found for this item</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Summary</h3>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm inline-block"><div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Locations</div><div className="text-2xl font-bold text-amber-600">{itemLocations.length}</div></div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">By location</h3>
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-white/95 border-b border-slate-200"><tr><th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Location</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">On Hand</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Allocated</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Available</th><th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Value</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 bg-white">{itemLocations.map((loc: any, index: number) => {
                            const onHand = parseStockValue(loc['On Hand'] || 0);
                            const allocated = parseStockValue(loc['Allocated'] || 0);
                            const available = onHand - allocated;
                            const unitCost = parseCostValue(loc['Unit Cost'] || 0);
                            return (
                              <tr key={index} className="bg-white border-b border-slate-100 hover:bg-slate-50/80"><td className="px-4 py-3 font-mono text-amber-600 font-medium">{loc['Location'] || '—'}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{onHand.toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{allocated.toLocaleString()}</td><td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">{available.toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums">{formatCAD(onHand * unitCost)}</td></tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
        );
      })(), document.body)}

      {/* SO VIEWER MODAL - Premium Design with Embedded PDF */}
      {showSOViewer && selectedSOFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
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
        <div className="fixed inset-0 bg-slate-900 flex flex-col" style={{ zIndex: 10000 }}>
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

      <ExportAllCompanyDataModal
        isOpen={showExportAllCompanyDataModal}
        onClose={() => setShowExportAllCompanyDataModal(false)}
      />

      {showInventoryActionsModal && createPortal(
        <InventoryActionsModal
          isOpen={showInventoryActionsModal}
          onClose={() => setShowInventoryActionsModal(false)}
          itemNo={selectedItem?.['Item No.'] || selectedItem?.['itemId'] || ''}
          onSuccess={onRefreshData}
          initialTab={inventoryActionsInitialTab}
        />,
        document.body
      )}

      {/* Create PO Modal (Phase 4) – full header + supplier picker + costs */}
      {showCreatePOModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => !createPOSubmitting && setShowCreatePOModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Create Purchase Order</h3>
              <button onClick={() => !createPOSubmitting && setShowCreatePOModal(false)} className="text-white/80 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier *</label>
                  <select
                    value={createPOForm.supplier_no}
                    onChange={(e) => {
                      const val = e.target.value;
                      const chosen = poSuppliersList.find(s => s.supplier_no === val);
                      setCreatePOForm(f => ({ ...f, supplier_no: val, supplier_name: chosen ? chosen.supplier_name : f.supplier_name }));
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select or type below</option>
                    {poSuppliersList.map(s => (
                      <option key={s.supplier_no} value={s.supplier_no}>{s.supplier_no} – {s.supplier_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier No. / Name (if new) *</label>
                  <input type="text" value={createPOForm.supplier_no} onChange={(e) => setCreatePOForm(f => ({ ...f, supplier_no: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. SUP001" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier display name</label>
                  <input type="text" value={createPOForm.supplier_name} onChange={(e) => setCreatePOForm(f => ({ ...f, supplier_name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Vendor name" />
                </div>
              </div>
              {/* Dates, terms, shipping, contact */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Order Date</label>
                  <input type="date" value={createPOForm.order_date} onChange={(e) => setCreatePOForm(f => ({ ...f, order_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Requested Date</label>
                  <input type="date" value={createPOForm.requested_date} onChange={(e) => setCreatePOForm(f => ({ ...f, requested_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Terms</label>
                  <input type="text" value={createPOForm.terms} onChange={(e) => setCreatePOForm(f => ({ ...f, terms: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" placeholder="e.g. Net 30" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ship Via</label>
                  <input type="text" value={createPOForm.ship_via} onChange={(e) => setCreatePOForm(f => ({ ...f, ship_via: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" placeholder="e.g. FedEx" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">FOB</label>
                  <input type="text" value={createPOForm.fob} onChange={(e) => setCreatePOForm(f => ({ ...f, fob: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Contact</label>
                  <input type="text" value={createPOForm.contact} onChange={(e) => setCreatePOForm(f => ({ ...f, contact: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Buyer</label>
                  <input type="text" value={createPOForm.buyer} onChange={(e) => setCreatePOForm(f => ({ ...f, buyer: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Freight</label>
                  <input type="number" min="0" step="0.01" value={createPOForm.freight} onChange={(e) => setCreatePOForm(f => ({ ...f, freight: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-right" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Currency</label>
                  <input type="text" value={createPOForm.currency} onChange={(e) => setCreatePOForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" placeholder="USD" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                  <input type="text" value={createPOForm.description} onChange={(e) => setCreatePOForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" placeholder="PO description" />
                </div>
              </div>
              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Line items</label>
                  <button type="button" onClick={() => setCreatePOForm(f => ({ ...f, lines: [...f.lines, { item_no: '', description: '', qty: '', unit_cost: '', required_date: '' }] }))} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200">+ Add line</button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-white/95 border-b border-slate-200">
                      <tr>
                        <th className="p-2 text-left font-medium text-slate-700">Item No.</th>
                        <th className="p-2 text-left font-medium text-slate-700">Description</th>
                        <th className="p-2 text-right font-medium text-slate-700">Qty</th>
                        <th className="p-2 text-right font-medium text-slate-700">Unit cost</th>
                        <th className="p-2 text-left font-medium text-slate-700">Required date</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {createPOForm.lines.map((line, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="p-2"><input type="text" value={line.item_no} onChange={(e) => setCreatePOForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, item_no: e.target.value } : l) }))} className="w-full px-2 py-1 border border-slate-200 rounded text-sm" placeholder="Item" /></td>
                          <td className="p-2"><input type="text" value={line.description} onChange={(e) => setCreatePOForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))} className="w-full px-2 py-1 border border-slate-200 rounded text-sm" placeholder="Optional" /></td>
                          <td className="p-2"><input type="number" min="0.000001" step="any" value={line.qty} onChange={(e) => setCreatePOForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, qty: e.target.value } : l) }))} className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-right" placeholder="0" /></td>
                          <td className="p-2"><input type="number" min="0" step="any" value={line.unit_cost} onChange={(e) => setCreatePOForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, unit_cost: e.target.value } : l) }))} className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-right" placeholder="0" /></td>
                          <td className="p-2"><input type="date" value={line.required_date} onChange={(e) => setCreatePOForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, required_date: e.target.value } : l) }))} className="w-full px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                          <td className="p-2">{createPOForm.lines.length > 1 ? <button type="button" onClick={() => setCreatePOForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))} className="text-red-600 hover:text-red-700 text-xs">✕</button> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const subtotal = createPOForm.lines.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.unit_cost) || 0), 0);
                  const freightNum = parseFloat(createPOForm.freight) || 0;
                  const total = subtotal + freightNum;
                  return (
                    <div className="mt-3 flex justify-end gap-6 text-sm">
                      <span className="text-slate-600">Subtotal: <strong>{(createPOForm.currency || 'USD')} {subtotal.toFixed(2)}</strong></span>
                      <span className="text-slate-600">Freight: <strong>{(createPOForm.currency || 'USD')} {freightNum.toFixed(2)}</strong></span>
                      <span className="text-slate-800 font-bold">Total: {(createPOForm.currency || 'USD')} {total.toFixed(2)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={() => !createPOSubmitting && setShowCreatePOModal(false)} className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 text-sm font-semibold">Cancel</button>
              <button
                type="button"
                disabled={createPOSubmitting || !createPOForm.supplier_no || !createPOForm.lines.some(l => (l.item_no || '').trim() && parseFloat(l.qty) > 0)}
                onClick={async () => {
                  setCreatePOSubmitting(true);
                  try {
                    const lines = createPOForm.lines
                      .filter(l => (l.item_no || '').trim() && parseFloat(l.qty) > 0)
                      .map(l => ({
                        item_no: l.item_no.trim(),
                        qty: parseFloat(l.qty),
                        unit_cost: parseFloat(l.unit_cost) || 0,
                        description: (l.description || '').trim() || undefined,
                        required_date: (l.required_date || '').trim() || undefined,
                      }));
                    const body: Record<string, unknown> = {
                      supplier_no: createPOForm.supplier_no.trim(),
                      supplier_name: createPOForm.supplier_name.trim(),
                      order_date: createPOForm.order_date || undefined,
                      requested_date: (createPOForm.requested_date || '').trim() || undefined,
                      terms: (createPOForm.terms || '').trim() || undefined,
                      ship_via: (createPOForm.ship_via || '').trim() || undefined,
                      fob: (createPOForm.fob || '').trim() || undefined,
                      contact: (createPOForm.contact || '').trim() || undefined,
                      buyer: (createPOForm.buyer || '').trim() || undefined,
                      freight: parseFloat(createPOForm.freight) || 0,
                      currency: (createPOForm.currency || 'USD').trim(),
                      description: (createPOForm.description || '').trim() || undefined,
                      lines,
                    };
                    const res = await fetch(getApiUrl('/api/purchase-orders'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    if (res.ok) {
                      setShowCreatePOModal(false);
                      setCreatePOForm({
                        supplier_no: '', supplier_name: '',
                        order_date: new Date().toISOString().slice(0, 10), requested_date: '',
                        terms: '', ship_via: '', fob: '', contact: '', buyer: '', freight: '', currency: 'USD', description: '',
                        lines: [{ item_no: '', description: '', qty: '', unit_cost: '', required_date: '' }]
                      });
                      onRefreshData?.();
                    }
                  } finally {
                    setCreatePOSubmitting(false);
                  }
                }}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
              >
                {createPOSubmitting ? 'Creating…' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create MO Modal - batch number + optional Sales Order # (for future Sage link) */}
      {showCreateMOModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => !createMOSubmitting && setShowCreateMOModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Create Manufacturing Order</h3>
              <button onClick={() => !createMOSubmitting && setShowCreateMOModal(false)} className="text-white/80 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Build Item *</label>
                <select
                  value={createMOForm.build_item_no}
                  onChange={(e) => setCreateMOForm(f => ({ ...f, build_item_no: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  required
                >
                  <option value="">Select item...</option>
                  {((data?.['Items.json'] || [])).map((item: any) => {
                    const no = item['Item No.'] || item['Item_No'];
                    const desc = item['Description'] || '';
                    if (!no) return null;
                    return <option key={no} value={no}>{no} {desc ? ` – ${desc.slice(0, 50)}${desc.length > 50 ? '…' : ''}` : ''}</option>;
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity *</label>
                  <input type="number" min="0.000001" step="any" value={createMOForm.quantity} onChange={(e) => setCreateMOForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Due Date</label>
                  <input type="date" value={createMOForm.due_date} onChange={(e) => setCreateMOForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Batch Number</label>
                <input type="text" value={createMOForm.batch_number} onChange={(e) => setCreateMOForm(f => ({ ...f, batch_number: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" placeholder="e.g. WH5H01G002" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Sales Order # (optional, for Sage link)</label>
                <input type="text" value={createMOForm.sales_order_no} onChange={(e) => setCreateMOForm(f => ({ ...f, sales_order_no: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" placeholder="e.g. 2707" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Description (optional)</label>
                <input type="text" value={createMOForm.description} onChange={(e) => setCreateMOForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" placeholder="Customer or notes" />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={() => !createMOSubmitting && setShowCreateMOModal(false)} className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 text-sm font-semibold">Cancel</button>
              <button
                type="button"
                disabled={createMOSubmitting || !createMOForm.build_item_no || !createMOForm.quantity || parseFloat(createMOForm.quantity) <= 0}
                onClick={async () => {
                  setCreateMOSubmitting(true);
                  try {
                    const res = await fetch(getApiUrl('/api/manufacturing-orders'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        build_item_no: createMOForm.build_item_no,
                        quantity: parseFloat(createMOForm.quantity),
                        due_date: createMOForm.due_date || undefined,
                        batch_number: createMOForm.batch_number || undefined,
                        sales_order_no: createMOForm.sales_order_no || undefined,
                        description: createMOForm.description || undefined
                      })
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      toastError('Create MO failed', err.error || res.statusText);
                      return;
                    }
                    const created = await res.json();
                    toastSuccess('MO created', `MO ${created['Mfg. Order No.']} created. Refreshing data…`);
                    setShowCreateMOModal(false);
                    setCreateMOForm({ build_item_no: '', quantity: '', due_date: '', batch_number: '', sales_order_no: '', description: '' });
                    if (onRefreshData) await onRefreshData();
                  } catch (e) {
                    toastError('Create MO failed', e instanceof Error ? e.message : 'Network error');
                  } finally {
                    setCreateMOSubmitting(false);
                  }
                }}
                className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2"
              >
                {createMOSubmitting ? 'Creating…' : 'Create MO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add to Cart Popup */}
      {showQuickAddPopup && quickAddItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => setShowQuickAddPopup(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Add to PR Cart</h3>
              <p className="text-orange-100 text-sm mt-1 truncate">{quickAddItem["Item No."]}</p>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Item:</div>
                <div className="font-bold text-gray-900">{quickAddItem["Item No."]}</div>
                <div className="text-sm text-gray-500">{quickAddItem["Description"]}</div>
              </div>
              
              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-gray-700">{parseStockValue(quickAddItem["Stock"]).toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 uppercase">Stock</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-blue-600">{parseStockValue(quickAddItem["WIP"]).toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 uppercase">WIP</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-green-600">{formatCAD(parseCostValue(quickAddItem["Recent Cost"] || quickAddItem["Standard Cost"] || 0))}</div>
                  <div className="text-[10px] text-gray-500 uppercase">Cost</div>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity to Order *
                </label>
                <input
                  type="number"
                  min="1"
                  value={quickAddQty}
                  onChange={(e) => setQuickAddQty(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-bold text-center"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQuickAddPopup(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (quickAddQty < 1) {
                      toastError('Invalid Quantity', 'Please enter a valid quantity');
                      return;
                    }
                    
                    // Check if item already in cart
                    const itemNo = quickAddItem["Item No."];
                    const existingIndex = bomCart.findIndex(c => c.item_no === itemNo);
                    
                    if (existingIndex >= 0) {
                      // Update quantity
                      const newTotal = bomCart[existingIndex].qty + quickAddQty;
                      setBomCart(prev => prev.map((c, i) => 
                        i === existingIndex ? { ...c, qty: newTotal } : c
                      ));
                      toastSuccess('Cart Updated', `${itemNo} now has ${newTotal} units`, {
                        label: 'View Cart',
                        onClick: () => setShowBomCart(true)
                      });
                    } else {
                      // Add new item
                      setBomCart(prev => [...prev, {
                        item_no: itemNo,
                        description: quickAddItem["Description"] || '',
                        qty: quickAddQty
                      }]);
                      toastSuccess('Added to Cart', `${itemNo} × ${quickAddQty}`, {
                        label: 'View Cart',
                        onClick: () => setShowBomCart(true)
                      });
                    }
                    
                    // Show cart and close popup
                    setShowBomCart(true);
                    setShowQuickAddPopup(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* BOM PR Generation Modal */}
      {showBOMPRModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
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
                    const response = await fetch(getApiUrl('/api/pr/create-from-bom'), {
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
                    
                    const itemCount = bomCart.length;
                    if (filename.endsWith('.zip')) {
                      toastSuccess('Batch PRs Generated!', `${itemCount} items grouped by supplier - Downloaded as ${filename}`, {
                        label: 'View History',
                        onClick: () => { setShowPRHistory(true); fetchPRHistory(); }
                      });
                    } else {
                      toastSuccess('PR Generated!', `${itemCount} items (single supplier) - Downloaded as ${filename}`, {
                        label: 'View History',
                        onClick: () => { setShowPRHistory(true); fetchPRHistory(); }
                      });
                    }
                    
                    // Auto-refresh history
                    fetchPRHistory();
                    setBomCart([]);
                    
                  } catch (error) {
                    console.error('Batch PR generation error:', error);
                    toastError('Batch PR Generation Failed', error instanceof Error ? error.message : 'Unknown error');
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
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
                    
                    addToast({ 
                      type: 'success', 
                      title: 'PRs regenerated',
                      message: `Regenerated PRs for ${redoPRData.items.length} items!`,
                      action: { label: 'View History', onClick: () => { setShowPRHistory(true); fetchPRHistory(); } }
                    });
                    
                    setShowRedoPRModal(false);
                    setRedoPRData(null);
                    
                    // Refresh PR history
                    fetchPRHistory();
                    
                  } catch (error) {
                    console.error('Redo PR generation error:', error);
                    toastError('Redo PR Generation Failed', error instanceof Error ? error.message : 'Unknown error');
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
      
      {/* Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

// ============================================================================
// MO Sage Accounting Tab
// ============================================================================
const MOSageTab: React.FC<{ moNo: string; customerName: string }> = ({ moNo, customerName }) => {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!moNo) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (customerName) params.set('customer_name', customerName);
    fetch(`/api/mo/${encodeURIComponent(moNo)}/sage-tab?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [moNo, customerName]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-8 text-slate-500">
        <svg className="animate-spin h-5 w-5 text-orange-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        <span className="text-sm">Loading Sage accounting data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Sage data not available</p>
          <p className="text-xs">{error}</p>
          <p className="text-xs mt-2 text-amber-600">Make sure the Sage G Drive CSV export is synced and the backend can access it.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const customer = data.customer;
  const buildItem = data.build_item;
  const components = data.components || [];
  const mappingNote = data.mapping_note;

  const fmt = (n: number | null | undefined, currency = 'CAD') =>
    n != null ? n.toLocaleString('en-CA', { style: 'currency', currency, minimumFractionDigits: 2 }) : '—';

  const pct = (n: number | null | undefined) =>
    n != null ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—';

  const PRICE_LIST_NAMES: Record<number, string> = { 1: 'Regular', 2: 'Preferred', 3: 'Web Price', 4: 'Master' };
  const CURRENCY_NAMES: Record<number, string> = { 1: 'CAD', 2: 'USD' };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏦</span>
        <h3 className="text-base font-bold text-slate-800">Sage Accounting</h3>
        <span className="ml-auto text-[10px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">READ-ONLY · From G Drive CSV export</span>
      </div>

      {mappingNote && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">{mappingNote}</div>
      )}

      {/* Customer Panel */}
      {customer ? (
        <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Sage Customer — READ-ONLY</p>
            <p className="text-base font-bold truncate">{customer.sName}</p>
            <p className="text-xs opacity-80">{customer.sCity}{customer.sProvState ? `, ${customer.sProvState}` : ''}{customer.sCountry ? ` · ${customer.sCountry}` : ''}</p>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* YTD Sales */}
            <div className="bg-white rounded-lg p-3 border border-orange-100">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">YTD Sales</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{fmt(customer.dAmtYtd, CURRENCY_NAMES[customer.lCurrncyId] || 'CAD')}</p>
              <p className={`text-xs font-semibold mt-0.5 ${(customer.yoy_change_pct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {pct(customer.yoy_change_pct)} vs last yr
              </p>
            </div>
            {/* Prior Year */}
            <div className="bg-white rounded-lg p-3 border border-orange-100">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Prior Year</p>
              <p className="text-base font-bold text-slate-700 tabular-nums">{fmt(customer.dLastYrAmt, CURRENCY_NAMES[customer.lCurrncyId] || 'CAD')}</p>
              <p className="text-xs text-slate-400 mt-0.5">Last fiscal yr</p>
            </div>
            {/* Credit */}
            <div className="bg-white rounded-lg p-3 border border-orange-100">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Credit Limit</p>
              <p className="text-base font-bold text-slate-700 tabular-nums">{fmt(customer.dCrLimit, CURRENCY_NAMES[customer.lCurrncyId] || 'CAD')}</p>
              {customer.credit_utilization_pct != null && (
                <div className="mt-1.5">
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${customer.credit_utilization_pct >= 90 ? 'bg-red-500' : customer.credit_utilization_pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(customer.credit_utilization_pct, 100)}%` }} />
                  </div>
                  <p className={`text-[10px] mt-0.5 font-semibold ${customer.credit_utilization_pct >= 90 ? 'text-red-600' : customer.credit_utilization_pct >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {customer.credit_utilization_pct.toFixed(1)}% utilized
                  </p>
                </div>
              )}
            </div>
            {/* Terms */}
            <div className="bg-white rounded-lg p-3 border border-orange-100">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Terms</p>
              <p className="text-base font-bold text-slate-700">{customer.nNetDay ? `Net ${customer.nNetDay}` : '—'}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {PRICE_LIST_NAMES[customer.lPrcListId] ?? 'Regular'} · {CURRENCY_NAMES[customer.lCurrncyId] ?? 'CAD'}
              </p>
            </div>
          </div>
          {/* Extra info row */}
          <div className="px-4 pb-3 flex flex-wrap gap-4 text-xs text-slate-600">
            {customer.sPhone1 && <span><span className="text-slate-400">Phone:</span> {customer.sPhone1}</span>}
            {customer.sEmail && <span><span className="text-slate-400">Email:</span> {customer.sEmail}</span>}
            {customer.dtLastSal && <span><span className="text-slate-400">Last Sale:</span> {customer.dtLastSal}</span>}
            {customer.dtSince && <span><span className="text-slate-400">Customer Since:</span> {customer.dtSince}</span>}
          </div>

          {/* Recent Sage SOs */}
          {customer.recent_orders && customer.recent_orders.length > 0 && (
            <div className="border-t border-orange-200 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-700 mb-2">Recent Sage Sales Orders</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-orange-100/60">
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-600">SO #</th>
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-600">Date</th>
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-600">Ship Date</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-slate-600">Total</th>
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.recent_orders.slice(0, 10).map((so: any, i: number) => (
                      <tr key={i} className="border-t border-orange-100 hover:bg-orange-50">
                        <td className="px-2 py-1.5 font-mono text-orange-700 font-semibold">{so.sSONum || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{so.dtSODate || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{so.dtShipDate || '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmt(so.dTotal)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${so.bQuote ? 'bg-slate-100 text-slate-600' : so.nFilled >= 2 ? 'bg-emerald-100 text-emerald-700' : so.nFilled === 1 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {so.bQuote ? 'Quote' : so.nFilled >= 2 ? 'Filled' : so.nFilled === 1 ? 'Partial' : 'Open'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-medium">No Sage customer found</p>
          <p className="text-xs mt-1">{customerName ? `Searched for: "${customerName}"` : 'No customer name on this MO'}</p>
        </div>
      )}

      {/* Build Item Pricing */}
      {buildItem && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mb-3">Sage Finished Good Pricing</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-mono text-sm font-bold text-blue-700">{buildItem.sPartCode}</span>
            <span className="text-sm text-slate-600">{buildItem.sName}</span>
            <span className="ml-auto text-xs text-slate-500">Stock: {(buildItem.dInStock ?? 0).toLocaleString()} {buildItem.sSellUnit}</span>
          </div>
          {buildItem.pricing && buildItem.pricing.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {buildItem.pricing.filter((p: any) => p.price > 0).map((p: any, i: number) => (
                <div key={i} className="bg-white rounded-lg p-2.5 border border-blue-100 text-center">
                  <p className="text-[10px] text-slate-500 font-medium">{p.price_list_name}</p>
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(p.price, p.currency)}</p>
                  <p className="text-[10px] text-slate-400">{p.currency}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No pricing configured in Sage for this item.</p>
          )}
        </div>
      )}

      {/* BOM Component Pricing */}
      {components.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Sage Pricing for BOM Components ({components.length} mapped)</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Sage Part Code</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">MiSys Item</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Description</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Regular (CAD)</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Preferred (CAD)</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">In Stock</th>
              </tr>
            </thead>
            <tbody>
              {components.map((comp: any, i: number) => {
                const regPrice = (comp.pricing || []).find((p: any) => p.price_list_id === 1 && p.currency_id === 1);
                const prefPrice = (comp.pricing || []).find((p: any) => p.price_list_id === 2 && p.currency_id === 1);
                return (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-blue-600 font-medium">{comp.sPartCode}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{comp.misys_item_id}</td>
                    <td className="px-3 py-2 text-slate-700">{comp.sName}</td>
                    <td className="px-3 py-2 text-right font-mono">{regPrice ? fmt(regPrice.price) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{prefPrice ? fmt(prefPrice.price) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(comp.dInStock ?? 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!customer && !buildItem && components.length === 0 && (
        <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-500">
          <p className="text-2xl mb-2">🏦</p>
          <p className="font-medium text-slate-700">No Sage data linked yet</p>
          <p className="text-sm mt-2">To see pricing and customer data here, confirm item mappings in ERP Portal → Item Mapping.</p>
        </div>
      )}
    </div>
  );
};

export default RevolutionaryCanoilHub;