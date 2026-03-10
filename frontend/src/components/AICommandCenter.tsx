import React, { useState, useRef, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { CompactLoading } from './LoadingComponents';
import { InteractiveChatMessage } from './InteractiveChatMessage';
import { 
  Brain, 
  Send, 
  MessageCircle, 

  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Package,
  Calculator,
  Zap,
  BarChart3,
  Settings,
  Search,
  Database,
  FileText,
  Users,
  ShoppingCart,
  Factory,
  Truck,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Activity,
  Lightbulb,
  Wifi
} from 'lucide-react';

interface AICommandCenterProps {
  data: any;
  onBack: () => void;
  onItemClick?: (item: any) => void;
  onNavigate?: (section: string) => void;
}

interface EnterpriseAnalytics {
  kpis: {
    revenue: {
      total_revenue: number;
      avg_order_value: number;
      total_orders: number;
    };
    inventory: {
      total_value: number;
      turnover_ratio: number;
      total_items: number;
    };
    operations: {
      active_manufacturing_orders: number;
      active_purchase_orders: number;
    };
  };
  sales_performance: {
    summary: {
      total_orders: number;
      total_revenue: number;
      average_order_value: number;
    };
    monthly_trends: {
      monthly_data: Array<{
        year: number;
        month: number;
        month_name: string;
        revenue: number;
        order_count: number;
      }>;
      peak_month: any;
    };
    seasonal_analysis: {
      seasonal_data: Array<{
        month: number;
        month_name: string;
        total_revenue: number;
        order_count: number;
      }>;
      high_season: any;
      low_season: any;
    };
    top_customers: Array<{
      customer_name: string;
      total_revenue: number;
      order_count: number;
    }>;
  };
  item_intelligence: {
    top_selling_items: Array<{
      item_code: string;
      description: string;
      total_quantity_sold: number;
      total_revenue: number;
    }>;
    seasonal_item_trends: Record<string, any>;
  };
  insights: Array<{
    type: string;
    title: string;
    insight: string;
    impact: string;
  }>;
  recommendations: Array<{
    type: string;
    title: string;
    recommendation: string;
    priority: string;
  }>;
  ai_report?: {
    executive_report?: string;
  };
  forecasting_intelligence?: {
    demand_forecasts?: {
      projected_orders?: number;
      strategic_insight?: string;
    };
    revenue_projections?: {
      next_quarter?: number;
    };
    capacity_requirements?: {
      utilization_forecast?: number;
    };
    inventory_forecasts?: any;
  };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  category?: 'bom' | 'stock' | 'analytics' | 'sales' | 'production' | 'logistics' | 'general';
  confidence?: number;
  sources?: string[];
  action_file?: string;
  action_filename?: string;
  action_result?: { type: string; item_no?: string; description?: string; quantity?: number; filename?: string };
}

interface AIInsight {
  id: string;
  type: 'alert' | 'prediction' | 'optimization' | 'recommendation' | 'success' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  action?: string;
  query?: string;  // Chat query to send when action is clicked
  data?: any;
  category: 'sales' | 'inventory' | 'production' | 'logistics' | 'financial' | 'operational' | 'procurement';
}

interface DataSummary {
  salesOrders: number;
  manufacturingOrders: number;
  openPurchaseOrders: number;
  items: number;
  customers: number;
  lowStockItems: number;
  pendingOrders: number;
  completedOrders: number;
  totalValue: number;
}

export const AICommandCenter: React.FC<AICommandCenterProps> = ({ data, onBack, onItemClick, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'analytics'>('chat');
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [enterpriseAnalytics, setEnterpriseAnalytics] = useState<EnterpriseAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Year-by-year Sage analytics
  const currentYear = new Date().getFullYear();
  const [analyticsYear, setAnalyticsYear] = useState<number>(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [sageKpis, setSageKpis] = useState<any>(null);
  const [sageMonthly, setSageMonthly] = useState<any[]>([]);
  const [sageMonthlyMeta, setSageMonthlyMeta] = useState<{ year?: number; total_revenue?: number } | null>(null);
  const [sageTopCustomers, setSageTopCustomers] = useState<any[]>([]);
  const [sageBestMovers, setSageBestMovers] = useState<any[]>([]);
  const [sageArAging, setSageArAging] = useState<any>(null);
  const [isLoadingSageAnalytics, setIsLoadingSageAnalytics] = useState(false);
  const [sageAnalyticsError, setSageAnalyticsError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch year-by-year Sage analytics from backend
  const loadSageAnalytics = async (year: number) => {
    setIsLoadingSageAnalytics(true);
    setSageAnalyticsError(null);
    const yearParam = year > 0 ? year : currentYear; // All Time (0) uses current year
    try {
      const [yearsRes, kpisRes, monthlyRes, customersRes, moversRes, arRes] = await Promise.all([
        fetch(getApiUrl('/api/sage/gdrive/analytics/available-years')),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/kpis?year=${yearParam}`)),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/monthly-revenue?year=${yearParam}`)),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/top-customers?limit=15&year=${yearParam}`)),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/best-movers?limit=15&year=${yearParam}`)),
        fetch(getApiUrl('/api/sage/gdrive/analytics/ar-aging')),
      ]);

      if (yearsRes.ok) {
        const y = await yearsRes.json();
        if (y.years?.length) setAvailableYears(y.years);
      }
      if (kpisRes.ok) setSageKpis(await kpisRes.json());
      if (monthlyRes.ok) {
        const m = await monthlyRes.json();
        setSageMonthly(m.months || m.monthly_data || []);
        setSageMonthlyMeta({ year: m.year, total_revenue: m.total_revenue });
      }
      if (customersRes.ok) {
        const c = await customersRes.json();
        setSageTopCustomers(c.customers || c.top_customers || []);
      }
      if (moversRes.ok) {
        const mv = await moversRes.json();
        setSageBestMovers(mv.items || mv.best_movers || []);
      }
      if (arRes.ok) setSageArAging(await arRes.json());
    } catch (err) {
      setSageAnalyticsError('Could not load Sage analytics — backend may be offline.');
    } finally {
      setIsLoadingSageAnalytics(false);
    }
  };

  // Generate enterprise analytics from existing data (no API call needed!)
  const generateEnterpriseAnalytics = () => {
    console.log('📊 Generating analytics from existing data...');
    console.log('🔍 Available data keys:', Object.keys(data));
    console.log('🔍 Data structure:', {
      'RealSalesOrders': data['RealSalesOrders']?.length || 0,
      'ParsedSalesOrders.json': data['ParsedSalesOrders.json']?.length || 0,
      'SalesOrderHeaders.json': data['SalesOrderHeaders.json']?.length || 0,
      'SalesOrders.json': data['SalesOrders.json']?.length || 0,
    });
    
    setIsLoadingAnalytics(true);
    
    try {
      // Combine all sales order sources — prefer GDrive folder-scanned SOs as most complete
      let realSalesOrders = [
        ...(data['SalesOrders.json'] || []),
        ...(data['RealSalesOrders'] || []),
        ...(data['ParsedSalesOrders.json'] || []),
        ...(data['SalesOrderHeaders.json'] || []),
      ];
      
      const inventoryItems = data['Items.json'] || data['MIITEM.json'] || [];
      const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
      const poOrders = data['PurchaseOrders.json'] || [];
      
      console.log(`📈 Found: ${realSalesOrders.length} sales orders, ${inventoryItems.length} inventory items`);
      
      // If still no sales orders, log sample data to see structure
      if (realSalesOrders.length > 0) {
        console.log('📋 Sample SO data:', realSalesOrders[0]);
      } else {
        console.warn('⚠️ NO SALES ORDERS FOUND - checking all data keys...');
        Object.keys(data).forEach(key => {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            console.log(`📦 ${key}: ${data[key].length} items`);
          }
        });
      }
      
      // Calculate KPIs
      const totalRevenue = realSalesOrders.reduce((sum: number, so: any) => {
        return sum + parseFloat(so.total_amount || so.Total_Amount || 0);
      }, 0);
      
      const avgOrderValue = realSalesOrders.length > 0 ? totalRevenue / realSalesOrders.length : 0;
      
      const inventoryValue = inventoryItems.reduce((sum: number, item: any) => {
        const stock = parseFloat(item['Stock'] || 0);
        const cost = parseFloat(item['Unit Cost'] || 0);
        return sum + (stock * cost);
      }, 0);
      
      // Process monthly trends
      const monthlyData: any[] = [];
      const monthlyMap = new Map();
      
      realSalesOrders.forEach((so: any) => {
        const orderDate = new Date(so.order_date || so.Order_Date || Date.now());
        const year = orderDate.getFullYear();
        const month = orderDate.getMonth() + 1;
        const key = `${year}-${month}`;
        
        if (!monthlyMap.has(key)) {
          monthlyMap.set(key, {
            year,
            month,
            month_name: orderDate.toLocaleString('default', { month: 'long' }),
            revenue: 0,
            order_count: 0
          });
        }
        
        const monthData = monthlyMap.get(key);
        monthData.revenue += parseFloat(so.total_amount || so.Total_Amount || 0);
        monthData.order_count += 1;
      });
      
      monthlyMap.forEach(value => monthlyData.push(value));
      monthlyData.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
      
      // Find peak month
      const peakMonth = monthlyData.length > 0 
        ? monthlyData.reduce((max, curr) => curr.revenue > max.revenue ? curr : max, monthlyData[0])
        : null;
      
      // Top customers
      const customerMap = new Map();
      realSalesOrders.forEach((so: any) => {
        const customer = so.customer_name || so.Customer_Name || 'Unknown';
        if (!customerMap.has(customer)) {
          customerMap.set(customer, { customer_name: customer, total_revenue: 0, order_count: 0 });
        }
        const custData = customerMap.get(customer);
        custData.total_revenue += parseFloat(so.total_amount || so.Total_Amount || 0);
        custData.order_count += 1;
      });
      
      const topCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);
      
      // Build analytics object
      const analytics: EnterpriseAnalytics = {
        kpis: {
          revenue: {
            total_revenue: totalRevenue,
            avg_order_value: avgOrderValue,
            total_orders: realSalesOrders.length
          },
          inventory: {
            total_value: inventoryValue,
            turnover_ratio: totalRevenue > 0 ? totalRevenue / inventoryValue : 0,
            total_items: inventoryItems.length
          },
          operations: {
            active_manufacturing_orders: moHeaders.filter((mo: any) => String(mo.Status ?? '2') !== '2').length,
            active_purchase_orders: poOrders.filter((po: any) => po.Status === 'Open').length
          }
        },
        sales_performance: {
          summary: {
            total_orders: realSalesOrders.length,
            total_revenue: totalRevenue,
            average_order_value: avgOrderValue
          },
          monthly_trends: {
            monthly_data: monthlyData,
            peak_month: peakMonth
          },
          seasonal_analysis: {
            seasonal_data: [],
            high_season: null,
            low_season: null
          },
          top_customers: topCustomers
        },
        item_intelligence: {
          top_selling_items: [],
          seasonal_item_trends: {}
        },
        insights: [],
        recommendations: []
      };
      
      setEnterpriseAnalytics(analytics);
      console.log('✅ Analytics generated from existing data');
    } catch (error) {
      console.error('❌ Error generating analytics:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Auto-load analytics on mount and when switching to analytics tab
  useEffect(() => {
    if (!enterpriseAnalytics && data && Object.keys(data).length > 0) {
      generateEnterpriseAnalytics();
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'analytics' && !enterpriseAnalytics) {
      generateEnterpriseAnalytics();
    }
    if (activeTab === 'analytics') {
      loadSageAnalytics(analyticsYear);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch Sage analytics when year changes
  useEffect(() => {
    if (activeTab === 'analytics') {
      loadSageAnalytics(analyticsYear);
    }
  }, [analyticsYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interactive handlers
  const handleItemClick = (item: any) => {
    console.log('🔍 AI Chat Item clicked:', item);
    
    // Find the full item data from the app data
    const inventory = data?.['Items.json'] || [];
    console.log('📊 Searching in inventory with', inventory.length, 'items');
    
    // Try multiple matching strategies
    let fullItem = inventory.find((invItem: any) => 
      invItem['Item No.']?.toLowerCase() === item.itemCode.toLowerCase()
    );
    
    if (!fullItem) {
      fullItem = inventory.find((invItem: any) => 
        invItem['Item No.']?.toLowerCase().includes(item.itemCode.toLowerCase()) ||
        invItem['Description']?.toLowerCase().includes(item.itemCode.toLowerCase()) ||
        invItem['Description 2']?.toLowerCase().includes(item.itemCode.toLowerCase())
      );
    }
    
    console.log('🎯 Found item:', fullItem ? fullItem['Item No.'] : 'Not found');
    
    if (fullItem && onItemClick) {
      console.log('✅ Opening item modal for:', fullItem['Item No.']);
      // Use the exact same behavior as inventory section
      onItemClick(fullItem);
    } else {
      console.log('❌ Item not found, falling back to chat query');
      // Fallback to chat query if item not found
      setInputMessage(`Tell me more about item ${item.itemCode}`);
    }
  };

  const handleSOClick = (soNumber: string) => {
    console.log('SO clicked:', soNumber);
    setInputMessage(`Show me details for sales order ${soNumber}`);
  };

  const handleCustomerClick = (customer: string) => {
    console.log('Customer clicked:', customer);
    setInputMessage(`Show me information about customer ${customer}`);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate data summary and insights together so insights always have the summary available
  useEffect(() => {
    const summary = generateDataSummary();
    setDataSummary(summary);
    const newInsights = generateAIInsights(summary);
    setInsights(newInsights);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache for processed data to avoid re-scanning every time
  const [processedDataCache, setProcessedDataCache] = useState<{
    allSalesOrders: any[];
    dataSummary: DataSummary | null;
    lastProcessed: number;
  }>({
    allSalesOrders: [],
    dataSummary: null,
    lastProcessed: 0
  });

  const generateDataSummary = (): DataSummary => {
    const now = Date.now();
    // Always compute fresh when called — cache can return stale data when data prop changes
    console.log('🔄 Processing AI data summary...');

    // Get ALL Sales Orders from every available source
    const realSalesOrders = data['RealSalesOrders'] || [];
    const parsedSalesOrders = data['ParsedSalesOrders.json'] || [];
    const salesOrdersByStatus = data['SalesOrdersByStatus'] || {};
    const soInProduction = data['SalesOrders_InProduction'] || [];
    const soCompleted = data['SalesOrders_Completed'] || [];
    const soCancelled = data['SalesOrders_Cancelled'] || [];
    const soNew = data['SalesOrders_New'] || [];
    const soScheduled = data['SalesOrders_Scheduled'] || [];
    // PRIMARY: Google Drive folder-scanned SOs (most reliable count)
    const gdriveSalesOrders = data['SalesOrders.json'] || [];
    
    let allSalesOrders: any[] = [...realSalesOrders, ...parsedSalesOrders, ...soInProduction, ...soCompleted, ...soCancelled, ...soNew, ...soScheduled, ...gdriveSalesOrders];
    
    // Add Sales Orders from folder status (if available)
    if (typeof salesOrdersByStatus === 'object') {
      Object.values(salesOrdersByStatus).forEach((orders: any) => {
        if (Array.isArray(orders)) {
          allSalesOrders = [...allSalesOrders, ...orders];
        }
      });
    }
    
    // Remove duplicates based on SO number (handle all naming conventions)
    const getSoNum = (so: any) =>
      so.so_number || so.soNumber || so['SO Number'] || so.SO_Number || so.so_no || so['SO#'] || '';
    const uniqueSalesOrders = allSalesOrders.filter((so, index, self) =>
      getSoNum(so) === '' || index === self.findIndex(s => getSoNum(s) === getSoNum(so))
    );
    
    console.log(`📊 AI Summary - TOTAL Sales Orders found: ${uniqueSalesOrders.length} orders (GDrive: ${gdriveSalesOrders.length}, PDF: ${realSalesOrders.length}, Parsed: ${parsedSalesOrders.length})`);
    
    // Use the unique sales orders for calculations
    allSalesOrders = uniqueSalesOrders;
    
    const moHeaders = data['ManufacturingOrderHeaders.json'] || data['MIMOH.json'] || [];
    const activeMoHeaders = moHeaders.filter((mo: any) => String(mo.Status ?? mo['Status'] ?? '2') !== '2');
    const poHeaders = data['PurchaseOrders.json'] || data['MIPOH.json'] || [];
    const openPOs = poHeaders.filter((po: any) => String(po.Status ?? po['Status'] ?? '2') === '1');
    const items = data['Items.json'] || data['MIITEM.json'] || [];
    
    // Calculate unique customers from active MO headers only
    const uniqueCustomers = new Set(activeMoHeaders.map((mo: any) => mo.Customer).filter(Boolean)).size;
    
    // Calculate low stock items (Items.json/MIITEM: Reorder Level, fallback to Minimum; Stock or Quantity on Hand)
    const lowStockItems = items.filter((item: any) => {
      const stock = parseFloat(item['Stock'] || item.Stock || item['Quantity on Hand'] || 0);
      const reorderLevel = parseFloat(item['Reorder Level'] || item['Reorder Point'] || item.ordLvl || item.Minimum || 0);
      return stock <= reorderLevel && reorderLevel > 0;
    }).length;

    // Calculate order statuses from REAL PDF Sales Orders
    const pendingOrders = allSalesOrders.filter((so: any) => {
      const status = (so.status || so.Status || '').toLowerCase();
      return status.includes('pending') || status.includes('new') || status.includes('open') || status.includes('production') || status.includes('scheduled');
    }).length;

    const completedOrders = allSalesOrders.filter((so: any) => {
      const status = (so.status || so.Status || '').toLowerCase();
      return status.includes('completed') || status.includes('closed') || status.includes('shipped');
    }).length;

    // Calculate total value from REAL PDF Sales Orders
    const totalValue = allSalesOrders.reduce((sum: number, so: any) => {
      return sum + parseFloat(so.total_amount || so["Total Amount"] || so["Order Value"] || 0);
    }, 0);

    const dataSummary = {
      salesOrders: allSalesOrders.length,
      manufacturingOrders: activeMoHeaders.length,
      openPurchaseOrders: openPOs.length,
      items: items.length,
      customers: uniqueCustomers,
      lowStockItems,
      pendingOrders,
      completedOrders,
      totalValue
    };

    // Cache the processed data
    setProcessedDataCache({
      allSalesOrders,
      dataSummary,
      lastProcessed: now
    });

    return dataSummary;
  };

  const generateAIInsights = (summary?: DataSummary | null): AIInsight[] => {
    const insights: AIInsight[] = [];
    const s = summary || dataSummary;
    if (!s) return insights;

    // Low stock — always show if any (high priority)
    if (s.lowStockItems > 0) {
      insights.push({
        id: 'stock-alert-1',
        type: 'alert',
        title: `${s.lowStockItems} Items Below Reorder Level`,
        description: `${s.lowStockItems} items need restocking. Ask the AI for the list with stock and reorder quantities.`,
        impact: 'high',
        confidence: 0.95,
        action: 'Get low stock list',
        query: 'Which items are below reorder level? Give me the list with stock and reorder quantities.',
        category: 'inventory',
        data: { lowStockItems: s.lowStockItems, totalItems: s.items }
      });
    }

    // Active MOs
    if (s.manufacturingOrders > 0) {
      insights.push({
        id: 'production-1',
        type: 'recommendation',
        title: `${s.manufacturingOrders} Active Manufacturing Orders`,
        description: `${s.manufacturingOrders} MOs in progress. Ask for details by build item.`,
        impact: 'medium',
        confidence: 0.95,
        action: 'List active MOs',
        query: 'How many active manufacturing orders do we have? List them by build item.',
        category: 'production',
        data: { manufacturingOrders: s.manufacturingOrders }
      });
    }

    // Open POs
    if (s.openPurchaseOrders > 0) {
      insights.push({
        id: 'po-open-1',
        type: 'recommendation',
        title: `${s.openPurchaseOrders} Open Purchase Orders`,
        description: `${s.openPurchaseOrders} POs awaiting delivery. Ask for breakdown by supplier.`,
        impact: 'medium',
        confidence: 0.95,
        action: 'List open POs',
        query: 'How many open purchase orders do we have? List by supplier.',
        category: 'procurement',
        data: { openPOs: s.openPurchaseOrders }
      });
    }

    // Sales orders (from PDF data)
    if (s.pendingOrders > 0) {
      insights.push({
        id: 'so-pending-1',
        type: 'warning',
        title: `${s.pendingOrders} Pending Sales Orders`,
        description: `${s.pendingOrders} sales orders in progress from PDF data.`,
        impact: 'high',
        confidence: 0.9,
        action: 'View pending orders',
        query: 'List our pending sales orders with customer and value.',
        category: 'sales',
        data: { pendingOrders: s.pendingOrders, totalSOs: s.salesOrders }
      });
    }

    if (s.completedOrders > 0) {
      insights.push({
        id: 'so-completed-1',
        type: 'success',
        title: `${s.completedOrders} Completed Orders`,
        description: `${s.completedOrders} sales orders completed.`,
        impact: 'low',
        confidence: 0.9,
        action: 'View completed',
        query: 'How many sales orders have we completed? What is the total value?',
        category: 'sales',
        data: { completedOrders: s.completedOrders, totalSOs: s.salesOrders }
      });
    }

    if (s.totalValue > 0) {
      insights.push({
        id: 'financial-1',
        type: 'recommendation',
        title: `$${s.totalValue.toLocaleString()} Total Order Value`,
        description: `Sales orders total $${s.totalValue.toLocaleString()} from PDF data.`,
        impact: 'medium',
        confidence: 0.9,
        action: 'Order value details',
        query: 'What is the total value of our sales orders?',
        category: 'financial',
        data: { totalValue: s.totalValue, orderCount: s.salesOrders }
      });
    }

    // Inventory overview
    if (s.items > 0) {
      insights.push({
        id: 'inventory-overview',
        type: 'prediction',
        title: `${s.items.toLocaleString()} Inventory Items`,
        description: `${s.items.toLocaleString()} items in MiSys. Ask for stock levels or item lookup.`,
        impact: 'low',
        confidence: 1.0,
        action: 'Inventory value',
        query: 'What is our total inventory value? Use Items.json stock and standard cost.',
        category: 'inventory',
        data: { totalItems: s.items }
      });
    }

    return insights;
  };

  // Build chat request body (shared by main send + Quick Actions) — ensures full context: ALL data, dateContext, dataSources
  const buildChatRequestBody = (query: string) => {
    const currentDate = new Date();
    const dateContext = {
      currentDate: currentDate.toISOString().split('T')[0],
      currentDateTime: currentDate.toISOString(),
      currentTime: currentDate.toLocaleTimeString(),
      currentDayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
      currentMonth: currentDate.toLocaleDateString('en-US', { month: 'long' }),
      currentYear: currentDate.getFullYear()
    };
    const realSalesCount = (data['RealSalesOrders']?.length || 0) +
      (Object.values(data['SalesOrdersByStatus'] || {}).flat().length || 0) +
      (data['SalesOrders_InProduction']?.length || 0) + (data['SalesOrders_Completed']?.length || 0) +
      (data['SalesOrders_Cancelled']?.length || 0) + (data['SalesOrders_New']?.length || 0) +
      (data['SalesOrders_Scheduled']?.length || 0);
    const salesSourcesList = [
      'RealSalesOrders', 'ParsedSalesOrders.json', 'SalesOrdersByStatus',
      'SalesOrderHeaders.json', 'SalesOrderDetails.json', 'SalesOrders.json',
      'SalesOrders_InProduction', 'SalesOrders_Completed', 'SalesOrders_Cancelled',
      'SalesOrders_New', 'SalesOrders_Scheduled'
    ].filter(key => {
      const v = data[key];
      return v && (Array.isArray(v) ? v.length > 0 : typeof v === 'object' && Object.keys(v).length > 0);
    });
    const dataSourcesSummary = {
      inventory: {
        available: !!((data['Items.json']?.length > 0) || (data['MIITEM.json']?.length > 0)),
        count: (data['Items.json']?.length || 0) || (data['MIITEM.json']?.length || 0),
        sources: ['Items.json', 'MIITEM.json', 'MIILOC.json'].filter(key => data[key]?.length > 0)
      },
      salesOrders: {
        available: !!(realSalesCount > 0 || data['SalesOrderHeaders.json']?.length > 0 ||
          data['SalesOrderDetails.json']?.length > 0 || data['SalesOrders.json']?.length > 0 ||
          data['ParsedSalesOrders.json']?.length > 0),
        count: realSalesCount || (data['SalesOrderHeaders.json']?.length || 0) +
                (data['SalesOrderDetails.json']?.length || 0) + 
                (data['SalesOrders.json']?.length || 0) + 
                (data['ParsedSalesOrders.json']?.length || 0),
        sources: salesSourcesList.length ? salesSourcesList : ['SalesOrderHeaders.json', 'SalesOrderDetails.json', 'SalesOrders.json', 'ParsedSalesOrders.json'].filter(key => data[key]?.length > 0)
      },
      manufacturingOrders: {
        available: !!((data['ManufacturingOrderHeaders.json']?.length > 0) || (data['ManufacturingOrderDetails.json']?.length > 0) || (data['MIMOH.json']?.length > 0) || (data['MIMOMD.json']?.length > 0)),
        count: (data['ManufacturingOrderHeaders.json']?.length || data['MIMOH.json']?.length || 0) + (data['ManufacturingOrderDetails.json']?.length || data['MIMOMD.json']?.length || 0),
        sources: ['ManufacturingOrderHeaders.json', 'ManufacturingOrderDetails.json', 'MIMOH.json', 'MIMOMD.json'].filter(key => data[key]?.length > 0)
      },
      purchaseOrders: {
        available: !!((data['PurchaseOrders.json']?.length > 0) || (data['PurchaseOrderDetails.json']?.length > 0) || (data['MIPOH.json']?.length > 0) || (data['MIPOD.json']?.length > 0)),
        count: (data['PurchaseOrders.json']?.length || data['MIPOH.json']?.length || 0) + (data['PurchaseOrderDetails.json']?.length || data['MIPOD.json']?.length || 0),
        sources: ['PurchaseOrders.json', 'PurchaseOrderDetails.json', 'MIPOH.json', 'MIPOD.json'].filter(key => data[key]?.length > 0)
      },
      boms: {
        available: !!(data['BillsOfMaterial.json']?.length > 0 || data['BillOfMaterialDetails.json']?.length > 0),
        count: (data['BillsOfMaterial.json']?.length || 0) + (data['BillOfMaterialDetails.json']?.length || 0),
        sources: ['BillsOfMaterial.json', 'BillOfMaterialDetails.json', 'MIBOMH.json', 'MIBOMD.json'].filter(key => data[key]?.length > 0)
      },
      jobs: {
        available: !!(data['Jobs.json']?.length > 0 || data['JobDetails.json']?.length > 0),
        count: (data['Jobs.json']?.length || 0) + (data['JobDetails.json']?.length || 0),
        sources: ['Jobs.json', 'JobDetails.json', 'MIJOBH.json', 'MIJOBD.json'].filter(key => data[key]?.length > 0)
      },
      workOrders: {
        available: !!(data['WorkOrderHeaders.json']?.length > 0 || data['WorkOrderDetails.json']?.length > 0),
        count: (data['WorkOrderHeaders.json']?.length || 0) + (data['WorkOrderDetails.json']?.length || 0),
        sources: ['WorkOrderHeaders.json', 'WorkOrderDetails.json', 'MIWOH.json', 'MIWOD.json'].filter(key => data[key]?.length > 0)
      },
      mps: {
        available: !!(data['MPS.json'] && (data['MPS.json'].mps_orders?.length > 0 || data['MPS.json'].summary?.total_orders > 0)),
        count: data['MPS.json']?.mps_orders?.length || data['MPS.json']?.summary?.total_orders || 0,
        sources: ['MPS.json'].filter(key => data[key])
      },
      allAvailableFiles: Object.keys(data).filter(key => 
        data[key] && 
        (Array.isArray(data[key]) ? data[key].length > 0 : typeof data[key] === 'object' && Object.keys(data[key]).length > 0)
      ),
      // Explicit note: backend loads Sage + G Drive data server-side when available
      sageData: 'Available server-side (customers, open SOs, AR aging)',
      googleDriveData: 'Available server-side (MiSys, Sales Orders PDFs)'
    };
    // NOTE: We intentionally do NOT send the full `data` object here.
    // Sending 600k+ records in the POST body was crashing the backend (OOM on Render).
    // The backend loads its own data from Google Drive / Sage for each query.
    return { query, dateContext, dataSources: dataSourcesSummary };
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      category: 'general'
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsProcessing(true);

    const requestBody = buildChatRequestBody(currentInput);

    try {
      
      console.log('🚀 Sending chat request to:', getApiUrl('/api/chat'));
      
      const response = await fetch(getApiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 RESPONSE:');
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      console.log('✅ AI Response received:', result);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.response || 'I apologize, but I could not process your request.',
        timestamp: new Date(),
        category: 'general',
        confidence: 0.9,
        sources: result.sources || [],
        action_file: result.action_file,
        action_filename: result.action_filename,
        action_result: result.action_result
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('❌ CHAT ERROR:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `⚠️ **Cannot Connect to AI Backend**\n\nError: ${error}\n\n**Troubleshooting:**\n1. Check if backend is running on getApiUrl\n2. Check browser console (F12) for detailed error\n3. Verify OpenAI API key is configured`,
        timestamp: new Date(),
        category: 'general'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { 
      title: "Active MOs", 
      description: "List active manufacturing orders",
      icon: Factory,
      action: "How many active manufacturing orders do we have? List them by customer name and build item.",
      category: "production"
    },
    { 
      title: "Low Stock", 
      description: "Items below reorder level",
      icon: Package,
      action: "Which items are below reorder level? Give me the list with stock and reorder quantities.",
      category: "inventory"
    },
    { 
      title: "Open POs", 
      description: "Open purchase orders",
      icon: ShoppingCart,
      action: "How many open purchase orders do we have? List by supplier.",
      category: "procurement"
    },
    { 
      title: "Top Customers", 
      description: "From Sage invoiced data",
      icon: Users,
      action: "Who are our top customers by revenue this year? Use the Sage data.",
      category: "sales"
    },
    { 
      title: "Inventory Value", 
      description: "Total stock value",
      icon: DollarSign,
      action: "What is our total inventory value? Use Items.json stock and standard cost.",
      category: "inventory"
    },
    { 
      title: "AR Aging", 
      description: "Accounts receivable summary",
      icon: DollarSign,
      action: "What is our accounts receivable aging? Current, 30-60, 60-90, 90+ days.",
      category: "financial"
    },
    { 
      title: "Pricing / Quote", 
      description: "Look up price and draft quote email",
      icon: FileText,
      action: "I need pricing for a customer and help drafting a quote email. Which customer and product? Look up our price, ask me how much the customer wants, then draft the quote email.",
      category: "sales"
    },
    { 
      title: "Create PR", 
      description: "Create purchase requisition for items",
      icon: ShoppingCart,
      action: "Create a PR for 2 cases of MOV Long Life 0 Kegs",
      category: "procurement"
    }
  ];

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'recommendation': return <Lightbulb className="w-5 h-5 text-blue-500" />;
      case 'optimization': return <Zap className="w-5 h-5 text-purple-500" />;
      case 'prediction': return <TrendingUp className="w-5 h-5 text-indigo-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales': return <ShoppingCart className="w-4 h-4" />;
      case 'inventory': return <Package className="w-4 h-4" />;
      case 'production': return <Factory className="w-4 h-4" />;
      case 'procurement': return <ShoppingCart className="w-4 h-4" />;
      case 'logistics': return <Truck className="w-4 h-4" />;
      case 'financial': return <DollarSign className="w-4 h-4" />;
      case 'operational': return <Settings className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const handleInsightAction = (insight: AIInsight) => {
    if (insight.query) {
      setActiveTab('chat');
      setInputMessage(insight.query);
      // Focus and optionally send after a brief delay so user sees it
      setTimeout(() => {
        const input = document.querySelector('input[placeholder*="Ask"]') as HTMLInputElement;
        input?.focus();
      }, 100);
    }
  };


  return (
    <div className="bg-slate-50 rounded-xl">

      {/* Header — matches app style, no internal back button */}
      <div className="bg-white rounded-t-xl border border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">AI Command Center</h2>
              <p className="text-xs text-slate-500">Ask anything about your business data — MiSys + Sage 50</p>
                </div>
              </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                <Wifi className="w-3 h-3" />
              <span>Live</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex gap-1">
            {[
              { id: 'chat', label: 'AI Chat', icon: MessageCircle },
              { id: 'insights', label: 'Insights', icon: Lightbulb },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
              <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              {tab.id === 'insights' && insights.length > 0 && (
                <span className="ml-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {insights.length}
                </span>
              )}
              </button>
            ))}
          </nav>
      </div>

      {/* Main Content */}
      <div className="p-4 border-x border-b border-slate-200 rounded-b-xl bg-white">
        {activeTab === 'chat' && (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              {/* Compact Quick Actions Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                    <Zap className="w-3 h-3 mr-1 text-purple-500" />
                    Quick Actions
                  </h3>
                  <div className="space-y-1">
                    {quickActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={async () => {
                          // Directly send the quick action message
                          const userMessage: ChatMessage = {
                            id: Date.now().toString(),
                            type: 'user',
                            content: action.action,
                            timestamp: new Date(),
                            category: action.category as any
                          };
                          
                          setMessages(prev => [...prev, userMessage]);
                          setIsProcessing(true);
                          
                          try {
                            const response = await fetch(getApiUrl('/api/chat'), {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(buildChatRequestBody(action.action))
                            });
                            
                            if (!response.ok) {
                              throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            
                            const result = await response.json();
                            
                            const assistantMessage: ChatMessage = {
                              id: (Date.now() + 1).toString(),
                              type: 'assistant',
                              content: result.response || 'I received your request but encountered an issue.',
                              timestamp: new Date(),
                              category: action.category as any,
                              sources: result.sources || [],
                              action_file: result.action_file,
                              action_filename: result.action_filename,
                              action_result: result.action_result
                            };
                            
                            setMessages(prev => [...prev, assistantMessage]);
                          } catch (error) {
                            console.error('❌ Quick Action Error:', error);
                            const errorMessage: ChatMessage = {
                              id: (Date.now() + 1).toString(),
                              type: 'assistant',
                              content: `⚠️ Cannot connect to AI backend. Make sure the backend is running on port 5002.\n\nError: ${error}`,
                              timestamp: new Date(),
                              category: 'general'
                            };
                            setMessages(prev => [...prev, errorMessage]);
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        disabled={isProcessing}
                        className="w-full text-left p-2 rounded border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start space-x-2">
                          <action.icon className="w-3 h-3 text-purple-500 mt-0.5 group-hover:text-purple-600" />
                          <div>
                            <div className="font-medium text-gray-900 group-hover:text-purple-900 text-xs">
                              {action.title}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Large Chat Interface */}
              <div className="lg:col-span-4">
                <div className="bg-slate-50/30 rounded-xl border border-slate-200 h-[calc(100vh-260px)] min-h-[500px] flex flex-col shadow-sm overflow-hidden">
                  {/* Chat Header */}
                  <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center shadow-sm">
                        <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div>
                        <h3 className="text-sm font-semibold text-slate-800">AI Assistant</h3>
                        <p className="text-[10px] text-slate-500">Connected to your data</p>
                        </div>
                      </div>
                    <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setProcessedDataCache({
                              allSalesOrders: [],
                              dataSummary: null,
                              lastProcessed: 0
                            });
                            console.log('🗑️ AI Command cache cleared');
                          }}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                          title="Clear AI cache"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Clear Cache</span>
                        </button>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs text-slate-500">Online</span>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    {messages.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Brain className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-2">
                          AI Command Center
                        </h4>
                        <p className="text-slate-600 mb-4 max-w-md mx-auto text-sm">
                          Ask questions about your real data — inventory, MOs, POs, customers. 
                          I only report what&apos;s in your MiSys and Sage data, no made-up analysis.
                        </p>
                        
                        {/* Data Summary Display */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 max-w-2xl mx-auto mb-4 border border-blue-200">
                          <div className="text-sm font-semibold text-gray-800 mb-3">📊 Available Data Sources:</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {(() => {
                              // DEBUG: Log what data keys we have
                              console.log('🔍 AI Command Center - Available data keys:', Object.keys(data));
                              console.log('🔍 RealSalesOrders:', data['RealSalesOrders']?.length || 0);
                              console.log('🔍 ParsedSalesOrders.json:', data['ParsedSalesOrders.json']?.length || 0);
                              console.log('🔍 SalesOrdersByStatus:', typeof data['SalesOrdersByStatus'], data['SalesOrdersByStatus']);
                              
                              // Collect all sales orders from ALL sources
                              const _getSoNum = (so: any) =>
                                so.so_number || so.soNumber || so['SO Number'] || so.SO_Number || so.so_no || so['SO#'] || '';
                              let allSalesOrders: any[] = [];
                              
                              // Google Drive folder-scanned SOs (primary)
                              if (data['SalesOrders.json']?.length) allSalesOrders.push(...data['SalesOrders.json']);
                              // PDF-parsed SOs
                              if (data['RealSalesOrders']?.length) allSalesOrders.push(...data['RealSalesOrders']);
                              if (data['ParsedSalesOrders.json']?.length) allSalesOrders.push(...data['ParsedSalesOrders.json']);
                              // Status-bucketed SOs
                              if (data['SalesOrders_InProduction']?.length) allSalesOrders.push(...data['SalesOrders_InProduction']);
                              if (data['SalesOrders_Completed']?.length) allSalesOrders.push(...data['SalesOrders_Completed']);
                              if (data['SalesOrders_Cancelled']?.length) allSalesOrders.push(...data['SalesOrders_Cancelled']);
                              if (data['SalesOrders_New']?.length) allSalesOrders.push(...data['SalesOrders_New']);
                              if (data['SalesOrders_Scheduled']?.length) allSalesOrders.push(...data['SalesOrders_Scheduled']);
                              // SalesByStatus object
                              if (data['SalesOrdersByStatus'] && typeof data['SalesOrdersByStatus'] === 'object') {
                                Object.values(data['SalesOrdersByStatus']).forEach((orders: any) => {
                                  if (Array.isArray(orders)) allSalesOrders.push(...orders);
                                });
                              }
                              
                              // Remove duplicates
                              const uniqueSalesOrders = allSalesOrders.filter((so, index, self) =>
                                _getSoNum(so) === '' || index === self.findIndex(s => _getSoNum(s) === _getSoNum(so))
                              );
                              
                              const salesOrdersCount = uniqueSalesOrders.length;
                              console.log('✅ AI panel SO count:', salesOrdersCount, '(GDrive:', data['SalesOrders.json']?.length || 0, ')');
                              
                              return (
                                <>
                                  <div className="bg-white rounded p-2 text-center border border-blue-200">
                                    <div className="font-bold text-blue-600">{salesOrdersCount.toLocaleString()}</div>
                                    <div className="text-gray-600">Sales Orders</div>
                                  </div>
                                  <div className="bg-white rounded p-2 text-center border border-green-200">
                                    <div className="font-bold text-green-600">{(data['Items.json'] || data['MIITEM.json'] || []).length.toLocaleString()}</div>
                                    <div className="text-gray-600">Inventory Items</div>
                                  </div>
                                  <div className="bg-white rounded p-2 text-center border border-purple-200">
                                    <div className="font-bold text-purple-600">{(data['ManufacturingOrderHeaders.json'] || data['MIMOH.json'] || []).filter((mo: any) => String(mo.Status ?? '2') !== '2').length.toLocaleString()}</div>
                                    <div className="text-gray-600">Active MOs</div>
                                  </div>
                                  <div className="bg-white rounded p-2 text-center border border-orange-200">
                                    <div className="font-bold text-orange-600">{(data['PurchaseOrders.json'] || data['MIPOH.json'] || []).length.toLocaleString()}</div>
                                    <div className="text-gray-600">Purchase Orders</div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        
                        <div className="bg-slate-100 rounded-lg p-4 max-w-md mx-auto">
                          <div className="text-sm text-slate-600 mb-2">Ask about real data:</div>
                          <div className="text-slate-800 font-medium text-sm">"How many active manufacturing orders?"</div>
                          <div className="text-slate-800 font-medium text-sm">"Which items are below reorder level?"</div>
                          <div className="text-slate-800 font-medium text-sm">"Top customers by revenue this year"</div>
                        </div>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <InteractiveChatMessage
                          key={message.id}
                          message={message}
                          onItemClick={handleItemClick}
                          onSOClick={handleSOClick}
                          onCustomerClick={handleCustomerClick}
                          data={data}
                        />
                      ))
                    )}
                    {isProcessing && (
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-slate-700 shadow-sm">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>Thinking</span>
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Ask anything... e.g. What's our price for [Customer] for [Product]? I need a quote email."
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-400 focus:border-violet-400 bg-white pr-11 text-slate-800 placeholder-slate-400 transition-shadow"
                          disabled={isProcessing}
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || isProcessing}
                        className="px-5 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center shrink-0"
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {/* Quick Suggestions — concrete queries only */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { label: "Active MOs by customer & build item", query: "How many active manufacturing orders do we have? List them by customer name and build item." },
                        { label: "Items below reorder level", query: "Items below reorder level" },
                        { label: "Open POs by supplier", query: "Open POs by supplier" },
                        { label: "Top customers by revenue", query: "Top customers by revenue" },
                        { label: "Create PR for items", query: "Create a PR for 2 cases of MOV Long Life 0 Kegs" }
                      ].map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => setInputMessage(suggestion.query)}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-600 hover:text-violet-700 rounded-lg text-sm transition-colors"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Insights</h2>
              <p className="text-slate-600">From your real MiSys and Sage data</p>
            </div>

            {insights.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <Lightbulb className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No insights yet</h3>
                <p className="text-slate-500 max-w-md mx-auto text-sm">
                  Insights appear when you have data loaded — low stock items, active MOs, open POs, sales orders.
                  Check that data is loaded in the portal.
                </p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                      {getInsightIcon(insight.type)}
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1 capitalize">
                        {getCategoryIcon(insight.category)}
                          {insight.category}
                      </span>
                    </div>
                      <span className="text-xs text-slate-400">{Math.round(insight.confidence * 100)}%</span>
                  </div>

                    <h3 className="text-base font-semibold text-slate-900 mb-2">{insight.title}</h3>
                    <p className="text-sm text-slate-600 mb-4">{insight.description}</p>

                    {insight.query && (
                      <button
                        onClick={() => handleInsightAction(insight)}
                        className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        {insight.action || 'Ask in Chat'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-7xl mx-auto space-y-6">

            {/* ── SECTION 1: SAGE FINANCIAL ANALYTICS ─────────────── */}
            <div className="space-y-4">
              {/* Header + Year Filter */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                  <h2 className="text-xl font-bold text-slate-900">Financial Analytics</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Sage 50 — invoiced revenue, AR aging, customers</p>
                  </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {availableYears.map(y => (
                    <button key={y} onClick={() => setAnalyticsYear(y)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                        analyticsYear === y
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700'
                      }`}>
                      {y === currentYear ? `${y} YTD` : String(y)}
                    </button>
                  ))}
                  <button onClick={() => setAnalyticsYear(0)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                      analyticsYear === 0
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700'
                    }`}>
                    All Time
                  </button>
                  <button onClick={() => loadSageAnalytics(analyticsYear)} disabled={isLoadingSageAnalytics}
                    className="ml-1 px-3 py-1.5 rounded-lg text-sm font-semibold border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSageAnalytics ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

              {sageAnalyticsError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{sageAnalyticsError}</div>
              )}

              {isLoadingSageAnalytics && !sageKpis ? (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Loading {analyticsYear > 0 ? analyticsYear : 'All Time'} data…</span>
              </div>
              ) : sageKpis ? (
                <>
                  {/* KPI Cards row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        {sageKpis.is_ytd ? 'Revenue YTD' : `${analyticsYear > 0 ? analyticsYear : 'All Time'} Revenue`}
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        ${(sageKpis.total_ytd_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      {sageKpis.yoy_revenue_pct != null && (
                        <p className={`text-xs mt-1 font-semibold ${sageKpis.yoy_revenue_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {sageKpis.yoy_revenue_pct >= 0 ? '▲' : '▼'} {Math.abs(sageKpis.yoy_revenue_pct)}% vs prior year
                        </p>
                      )}
                      </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Prior Year Revenue</p>
                      <p className="text-2xl font-bold text-slate-900">
                        ${(sageKpis.total_ly_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Open Sales Orders</p>
                      <p className="text-2xl font-bold text-slate-900">{sageKpis.open_sales_orders || 0}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        ${(sageKpis.open_so_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} value
                        </p>
                      </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Active Customers</p>
                      <p className="text-2xl font-bold text-slate-900">{sageKpis.active_customers || 0}</p>
                      {sageArAging && (
                        <p className="text-xs text-slate-500 mt-1">
                          AR: ${(sageArAging.total_ar || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      )}
                  </div>
                </div>

                  {/* Monthly Revenue Chart */}
                  {sageMonthly.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-1">Monthly Revenue — {analyticsYear > 0 ? analyticsYear : 'All Time'}</h3>
                      <div className="mb-4 text-sm text-slate-600">
                        Total {(sageMonthlyMeta?.year ?? (analyticsYear || currentYear))}: <span className="font-bold text-emerald-700">${(sageMonthlyMeta?.total_revenue ?? sageMonthly.reduce((s, m) => s + (m.revenue || 0), 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          const maxRev = Math.max(...sageMonthly.map(m => m.revenue || 0), 1);
                          return sageMonthly.map((m, i) => {
                            const pct = ((m.revenue || 0) / maxRev) * 100;
                            const isMax = m.revenue === maxRev && maxRev > 0;
                          return (
                              <div key={i} className="flex items-center gap-3">
                                <span className="w-8 text-xs text-slate-500 text-right shrink-0">{m.month_name?.slice(0,3)}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-7 relative overflow-hidden">
                                  <div className={`h-7 rounded-full flex items-center px-2 transition-all duration-500 ${isMax ? 'bg-amber-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.max(pct, m.revenue > 0 ? 3 : 0)}%` }}>
                                    {pct > 15 && (
                                      <span className="text-white text-xs font-semibold">
                                        ${(m.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </span>
                                    )}
                                </div>
                              </div>
                                <span className="w-24 text-xs text-slate-600 text-right shrink-0 font-medium">
                                  {pct <= 15 && m.revenue > 0
                                    ? `$${(m.revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                    : `${m.order_count || 0} inv.`}
                                </span>
                            </div>
                          );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* AR Aging */}
                  {sageArAging && sageArAging.total_ar > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800">Accounts Receivable Aging</h3>
                        <span className="text-sm font-bold text-slate-900">
                          Total AR: ${(sageArAging.total_ar || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                          </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Current (0–30d)', key: 'current', color: 'bg-emerald-500' },
                          { label: '31–60 Days', key: 'days_31_60', color: 'bg-yellow-400' },
                          { label: '61–90 Days', key: 'days_61_90', color: 'bg-orange-500' },
                          { label: '90+ Days', key: 'days_over_90', color: 'bg-red-500' },
                        ].map(bucket => {
                          const amt = sageArAging[bucket.key] || 0;
                          const pct = sageArAging.total_ar > 0 ? ((amt / sageArAging.total_ar) * 100).toFixed(1) : '0.0';
                          return (
                            <div key={bucket.key} className="border border-slate-100 rounded-lg p-3">
                              <div className={`w-3 h-3 rounded-full ${bucket.color} mb-2`} />
                              <p className="text-xs text-slate-500 font-medium">{bucket.label}</p>
                              <p className="text-lg font-bold text-slate-900 mt-0.5">
                                ${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                              <p className="text-xs text-slate-400">{pct}% of total</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                  {/* Top Customers + Best Products */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {sageTopCustomers.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">Top Customers — {analyticsYear > 0 ? analyticsYear : 'All Time'}</h3>
                        <div className="space-y-2">
                          {sageTopCustomers.slice(0, 10).map((c, i) => {
                            const maxRev = sageTopCustomers[0]?.dAmtYtd || 1;
                            const pct = ((c.dAmtYtd || 0) / maxRev) * 100;
                            return (
                              <div key={i} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-800 truncate max-w-[60%]">
                                    {i + 1}. {c.sName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {c.yoy_change_pct != null && (
                                      <span className={`font-semibold ${c.yoy_change_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {c.yoy_change_pct >= 0 ? '▲' : '▼'}{Math.abs(c.yoy_change_pct)}%
                                      </span>
                                    )}
                                    <span className="font-bold text-slate-900">${(c.dAmtYtd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                    </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                    {sageBestMovers.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-4">Top Products — {analyticsYear > 0 ? analyticsYear : 'All Time'}</h3>
                        <div className="space-y-2">
                          {sageBestMovers.slice(0, 10).map((item, i) => {
                            const maxRev = sageBestMovers[0]?.revenue || sageBestMovers[0]?.dAmtYtd || 1;
                            const rev = item.revenue || item.dAmtYtd || 0;
                            const pct = (rev / maxRev) * 100;
                            return (
                              <div key={i} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-800 truncate max-w-[65%]">
                                    {i + 1}. {item.sName || item.name || item.sPartCode}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    ${rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </span>
                                    </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
                </>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No Sage data available for {analyticsYear > 0 ? analyticsYear : 'All Time'}. Try a different year.</p>
                    </div>
                  )}
                </div>

            {/* ── SECTION 2: MISYS OPERATIONS DASHBOARD ────────────── */}
            {(() => {
              const allMOs = (data['ManufacturingOrderHeaders.json'] || data['MIMOH.json'] || []) as any[];
              const activeMOs = allMOs.filter((mo: any) => String(mo.Status ?? '2') !== '2');
              const allPOs = (data['PurchaseOrders.json'] || data['MIPOH.json'] || []) as any[];
              const openPOs = allPOs.filter((po: any) => String(po.Status ?? '2') === '1');
              const allItems = (data['Items.json'] || data['MIITEM.json'] || []) as any[];
              const getStock = (i: any) => parseFloat(i.Stock || i['Quantity on Hand'] || 0);
              const getReorderLevel = (i: any) => parseFloat(i['Reorder Level'] || i['Reorder Point'] || i.ordLvl || 0);
              const itemsWithStock = allItems.filter((i: any) => getStock(i) > 0);
              const belowReorder = allItems.filter((i: any) =>
                getStock(i) < getReorderLevel(i) && getReorderLevel(i) > 0
              );
              const inventoryValue = allItems.reduce((sum: number, i: any) =>
                sum + getStock(i) * parseFloat(i['Standard Cost'] || i['Unit Cost'] || 0), 0
              );

              // Top active MOs by build item
              const moBuildMap = new Map<string, { count: number; qty: number }>();
              activeMOs.forEach((mo: any) => {
                const item = mo['Build Item No.'] || mo.buildItem || 'Unknown';
                const qty = parseFloat(mo.Ordered || 0);
                if (!moBuildMap.has(item)) moBuildMap.set(item, { count: 0, qty: 0 });
                const e = moBuildMap.get(item)!;
                e.count += 1;
                e.qty += qty;
              });
              const topMOs = Array.from(moBuildMap.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 10);

              // Top open PO suppliers
              const poSupplierMap = new Map<string, number>();
              openPOs.forEach((po: any) => {
                const name = po.Name || po['Supplier No.'] || 'Unknown';
                poSupplierMap.set(name, (poSupplierMap.get(name) || 0) + 1);
              });
              const topSuppliers = Array.from(poSupplierMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8);

              // Top low stock items
              const lowStockItems = belowReorder
                .sort((a: any, b: any) => {
                  const gapA = getReorderLevel(a) - getStock(a);
                  const gapB = getReorderLevel(b) - getStock(b);
                  return gapB - gapA;
                })
                .slice(0, 10);

              return (
                <div className="border-t border-slate-200 pt-6 space-y-4">
                          <div>
                    <h2 className="text-xl font-bold text-slate-900">Operations Dashboard</h2>
                    <p className="text-sm text-slate-500 mt-0.5">MiSys ERP — manufacturing, procurement & inventory</p>
                          </div>

                  {/* Operations KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-violet-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">Active MOs</p>
                      <p className="text-2xl font-bold text-slate-900">{activeMOs.length}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {activeMOs.filter((mo: any) => String(mo.Status) === '1').length} released, {activeMOs.filter((mo: any) => String(mo.Status) === '0').length} open
                      </p>
                            </div>
                    <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Open POs</p>
                      <p className="text-2xl font-bold text-slate-900">{openPOs.length}</p>
                      <p className="text-xs text-slate-500 mt-1">{topSuppliers.length} suppliers</p>
                          </div>
                    <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Inventory Value</p>
                      <p className="text-2xl font-bold text-slate-900">
                        ${(inventoryValue / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{itemsWithStock.length} items in stock</p>
                          </div>
                    <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Low Stock Alerts</p>
                      <p className="text-2xl font-bold text-red-600">{belowReorder.length}</p>
                      <p className="text-xs text-slate-500 mt-1">below reorder level</p>
                        </div>
                      </div>
                      
                  {/* Active MOs + Open POs side by side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Active MOs by product */}
                    {topMOs.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-1">Active Manufacturing Orders</h3>
                        <p className="text-xs text-slate-400 mb-4">by build item — {activeMOs.length} total active</p>
                          <div className="space-y-2">
                          {topMOs.map(([item, stats], i) => {
                            const maxCount = topMOs[0][1].count;
                            const pct = (stats.count / maxCount) * 100;
                                return (
                              <div key={i} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-800 truncate max-w-[65%]">{item}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-slate-500">{stats.qty.toLocaleString(undefined, { maximumFractionDigits: 0 })} units</span>
                                    <span className="font-bold text-violet-700">{stats.count} MO{stats.count > 1 ? 's' : ''}</span>
                                      </div>
                                            </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            </div>
                          )}

                    {/* Open POs by supplier */}
                    {topSuppliers.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-1">Open Purchase Orders</h3>
                        <p className="text-xs text-slate-400 mb-4">by supplier — {openPOs.length} total open</p>
                        <div className="space-y-2">
                          {topSuppliers.map(([supplier, count], i) => {
                            const maxCount = topSuppliers[0][1];
                            const pct = (count / maxCount) * 100;
                                return (
                              <div key={i} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-800 truncate max-w-[70%]">{supplier}</span>
                                  <span className="font-bold text-blue-700 shrink-0">{count} PO{count > 1 ? 's' : ''}</span>
                                          </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            </div>
                          )}
                  </div>

                  {/* Inventory Health — Low Stock */}
                  {lowStockItems.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                      <div>
                          <h3 className="text-sm font-bold text-slate-800">Low Stock Alerts</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{belowReorder.length} items below reorder level — top {lowStockItems.length} shown</p>
                      </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Total inventory</p>
                          <p className="text-sm font-bold text-slate-900">{allItems.length} items · {itemsWithStock.length} in stock</p>
                    </div>
                        </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left text-slate-500 font-semibold pb-2 pr-4">Item</th>
                              <th className="text-right text-slate-500 font-semibold pb-2 px-3">On Hand</th>
                              <th className="text-right text-slate-500 font-semibold pb-2 px-3">Reorder At</th>
                              <th className="text-right text-slate-500 font-semibold pb-2 px-3">Shortfall</th>
                              <th className="text-right text-slate-500 font-semibold pb-2 pl-3">On Order</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {lowStockItems.map((item: any, i: number) => {
                              const stock = parseFloat(item.Stock || 0);
                              const reorder = parseFloat(item['Reorder Level'] || 0);
                              const onOrder = parseFloat(item['On Order'] || 0);
                              const shortfall = reorder - stock;
                              return (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="py-1.5 pr-4">
                                    <p className="font-medium text-slate-800 truncate max-w-[200px]">{item['Item No.']}</p>
                                    <p className="text-slate-400 truncate max-w-[200px]">{item.Description}</p>
                                  </td>
                                  <td className="py-1.5 px-3 text-right">
                                    <span className={`font-semibold ${stock === 0 ? 'text-red-600' : 'text-orange-500'}`}>
                                      {stock.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-slate-600">
                                    {reorder.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-semibold text-red-600">
                                    -{shortfall.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                  </td>
                                  <td className="py-1.5 pl-3 text-right">
                                    <span className={`font-semibold ${onOrder > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      {onOrder > 0 ? onOrder.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                      </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                    </div>
                      </div>
                    )}
                  </div>
              );
                    })()}
                  </div>
        )}

      </div>
    </div>
  );
};
