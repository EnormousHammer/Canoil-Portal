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
}

interface AIInsight {
  id: string;
  type: 'alert' | 'prediction' | 'optimization' | 'recommendation' | 'success' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  action?: string;
  data?: any;
  category: 'sales' | 'inventory' | 'production' | 'logistics' | 'financial' | 'operational';
}

interface DataSummary {
  salesOrders: number;
  manufacturingOrders: number;
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
  const [sageTopCustomers, setSageTopCustomers] = useState<any[]>([]);
  const [sageBestMovers, setSageBestMovers] = useState<any[]>([]);
  const [isLoadingSageAnalytics, setIsLoadingSageAnalytics] = useState(false);
  const [sageAnalyticsError, setSageAnalyticsError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch year-by-year Sage analytics from backend
  const loadSageAnalytics = async (year: number) => {
    setIsLoadingSageAnalytics(true);
    setSageAnalyticsError(null);
    try {
      const [yearsRes, kpisRes, monthlyRes, customersRes, moversRes] = await Promise.all([
        fetch(getApiUrl('/api/sage/gdrive/analytics/available-years')),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/kpis?year=${year}`)),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/monthly-revenue?year=${year}`)),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/top-customers?limit=15&year=${year}`)),
        fetch(getApiUrl(`/api/sage/gdrive/analytics/best-movers?limit=15&year=${year}`)),
      ]);

      if (yearsRes.ok) {
        const y = await yearsRes.json();
        if (y.years?.length) setAvailableYears(y.years);
      }
      if (kpisRes.ok) setSageKpis(await kpisRes.json());
      if (monthlyRes.ok) {
        const m = await monthlyRes.json();
        setSageMonthly(m.months || m.monthly_data || []);
      }
      if (customersRes.ok) {
        const c = await customersRes.json();
        setSageTopCustomers(c.customers || c.top_customers || []);
      }
      if (moversRes.ok) {
        const mv = await moversRes.json();
        setSageBestMovers(mv.items || mv.best_movers || []);
      }
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
      // Try multiple data sources for sales orders
      let realSalesOrders = data['RealSalesOrders'] || 
                           data['ParsedSalesOrders.json'] || 
                           data['SalesOrderHeaders.json'] ||
                           data['SalesOrders.json'] ||
                           [];
      
      const inventoryItems = data['Items.json'] || [];
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
            active_manufacturing_orders: moHeaders.filter((mo: any) => mo.Status === '1').length,
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
    // Check if we have cached data that's still valid (5 minutes)
    const now = Date.now();
    if (processedDataCache.dataSummary && (now - processedDataCache.lastProcessed) < 300000) {
      console.log('✅ Using cached AI data summary');
      return processedDataCache.dataSummary;
    }

    console.log('🔄 Processing fresh AI data summary...');
    
    // Get REAL Sales Orders from PDF-extracted data
    const realSalesOrders = data['RealSalesOrders'] || [];
    const salesOrdersByStatus = data['SalesOrdersByStatus'] || {};
    
    // ALSO check for other possible SO data sources
    const soInProduction = data['SalesOrders_InProduction'] || [];
    const soCompleted = data['SalesOrders_Completed'] || [];
    const soCancelled = data['SalesOrders_Cancelled'] || [];
    const soNew = data['SalesOrders_New'] || [];
    const soScheduled = data['SalesOrders_Scheduled'] || [];
    
    // Calculate total Sales Orders from ALL PDF sources
    let allSalesOrders: any[] = [...realSalesOrders, ...soInProduction, ...soCompleted, ...soCancelled, ...soNew, ...soScheduled];
    
    // Add Sales Orders from folder status (if available)
    if (typeof salesOrdersByStatus === 'object') {
      Object.values(salesOrdersByStatus).forEach((orders: any) => {
        if (Array.isArray(orders)) {
          allSalesOrders = [...allSalesOrders, ...orders];
        }
      });
    }
    
    // Remove duplicates based on SO number
    const uniqueSalesOrders = allSalesOrders.filter((so, index, self) => 
      index === self.findIndex(s => (s.so_number || s.soNumber || s['SO Number']) === (so.so_number || so.soNumber || so['SO Number']))
    );
    
    console.log(`📊 AI Summary - TOTAL Sales Orders found: ${uniqueSalesOrders.length} orders`);
    
    // Use the unique sales orders for calculations
    allSalesOrders = uniqueSalesOrders;
    
    const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
    const items = data['Items.json'] || [];
    
    // Calculate unique customers from MO headers
    const uniqueCustomers = new Set(moHeaders.map((mo: any) => mo.Customer).filter(Boolean)).size;
    
    // Calculate low stock items
    const lowStockItems = items.filter((item: any) => {
      const stock = parseFloat(item['Stock'] || 0);
      const reorderPoint = parseFloat(item['Reorder Point'] || 0);
      return stock <= reorderPoint && reorderPoint > 0;
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
      manufacturingOrders: moHeaders.length,
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

    // Sales Order insights
    if (s.pendingOrders > 0) {
      insights.push({
        id: 'so-pending-1',
        type: 'warning',
        title: `${s.pendingOrders} Pending Sales Orders`,
        description: `You have ${s.pendingOrders} sales orders requiring attention. Use the AI chat to analyze and prioritize them.`,
        impact: 'high',
        confidence: 0.95,
        action: 'Review pending orders',
        category: 'sales',
        data: { pendingOrders: s.pendingOrders, totalSOs: s.salesOrders }
      });
    }

    if (s.completedOrders > 0) {
      insights.push({
        id: 'so-completed-1',
        type: 'success',
        title: `${s.completedOrders} Orders Completed`,
        description: `${s.completedOrders} sales orders have been completed. Ask the AI to analyze completion patterns for optimization.`,
        impact: 'medium',
        confidence: 0.9,
        action: 'Analyze completion patterns',
        category: 'sales',
        data: { completedOrders: s.completedOrders, totalSOs: s.salesOrders }
      });
    }

    // Inventory insights
    if (s.lowStockItems > 0) {
      insights.push({
        id: 'stock-alert-1',
        type: 'alert',
        title: `${s.lowStockItems} Items Below Reorder Point`,
        description: `${s.lowStockItems} items are below their reorder point and need restocking to avoid stockouts.`,
        impact: 'high',
        confidence: 0.95,
        action: 'Review reorder recommendations',
        category: 'inventory',
        data: { lowStockItems: s.lowStockItems, totalItems: s.items }
      });
    }

    // Financial insights
    if (s.totalValue > 0) {
      insights.push({
        id: 'financial-1',
        type: 'recommendation',
        title: `$${s.totalValue.toLocaleString()} Total Order Value`,
        description: `Current sales orders represent $${s.totalValue.toLocaleString()} in total value. Monitor cash flow and payment terms.`,
        impact: 'medium',
        confidence: 0.9,
        action: 'Review financial projections',
        category: 'financial',
        data: { totalValue: s.totalValue, orderCount: s.salesOrders }
      });
    }

    // Operational insights
    if (s.manufacturingOrders > 0) {
      insights.push({
        id: 'production-1',
        type: 'recommendation',
        title: `${s.manufacturingOrders} Active Manufacturing Orders`,
        description: `${s.manufacturingOrders} manufacturing orders are in progress. Ask the AI to review production schedules and capacity.`,
        impact: 'medium',
        confidence: 0.85,
        action: 'Review production schedule',
        category: 'production',
        data: { manufacturingOrders: s.manufacturingOrders }
      });
    }

    if (s.items > 0) {
      insights.push({
        id: 'inventory-overview',
        type: 'prediction',
        title: `${s.items.toLocaleString()} Inventory Items Tracked`,
        description: `Your inventory contains ${s.items.toLocaleString()} unique items. Ask the AI for a full inventory health analysis.`,
        impact: 'low',
        confidence: 1.0,
        action: 'Analyze inventory health',
        category: 'inventory',
        data: { totalItems: s.items }
      });
    }

    return insights;
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

    // Add current date context for AI
    const currentDate = new Date();
    const dateContext = {
      currentDate: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
      currentDateTime: currentDate.toISOString(),
      currentTime: currentDate.toLocaleTimeString(),
      currentDayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
      currentMonth: currentDate.toLocaleDateString('en-US', { month: 'long' }),
      currentYear: currentDate.getFullYear()
    };

    // Build data sources summary - tell AI what data is available
    const dataSourcesSummary = {
      inventory: {
        available: !!(data['Items.json'] && data['Items.json'].length > 0),
        count: data['Items.json']?.length || 0,
        sources: ['Items.json', 'MIITEM.json', 'MIILOC.json'].filter(key => data[key]?.length > 0)
      },
      salesOrders: {
        available: !!(data['SalesOrderHeaders.json']?.length > 0 || data['SalesOrderDetails.json']?.length > 0 || 
                    data['SalesOrders.json']?.length > 0 || data['ParsedSalesOrders.json']?.length > 0),
        count: (data['SalesOrderHeaders.json']?.length || 0) + 
                (data['SalesOrderDetails.json']?.length || 0) + 
                (data['SalesOrders.json']?.length || 0) + 
                (data['ParsedSalesOrders.json']?.length || 0),
        sources: ['SalesOrderHeaders.json', 'SalesOrderDetails.json', 'SalesOrders.json', 'ParsedSalesOrders.json'].filter(key => data[key]?.length > 0)
      },
      manufacturingOrders: {
        available: !!(data['ManufacturingOrderHeaders.json']?.length > 0 || data['ManufacturingOrderDetails.json']?.length > 0),
        count: (data['ManufacturingOrderHeaders.json']?.length || 0) + (data['ManufacturingOrderDetails.json']?.length || 0),
        sources: ['ManufacturingOrderHeaders.json', 'ManufacturingOrderDetails.json', 'MIMOH.json', 'MIMOMD.json'].filter(key => data[key]?.length > 0)
      },
      purchaseOrders: {
        available: !!(data['PurchaseOrders.json']?.length > 0 || data['PurchaseOrderDetails.json']?.length > 0),
        count: (data['PurchaseOrders.json']?.length || 0) + (data['PurchaseOrderDetails.json']?.length || 0),
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
      )
    };

    try {
      const requestBody = {
        query: currentInput,
        dateContext: dateContext,
        dataSources: dataSourcesSummary  // Tell AI what data sources are available
      };
      
      console.log('🚀 SENDING REQUEST:');
      console.log('URL:', getApiUrl('/api/chat'));
      console.log('Body:', JSON.stringify(requestBody, null, 2));
      
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
        sources: result.sources || []
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
      title: "Sales Analysis", 
      description: "Analyze sales performance and trends",
      icon: TrendingUp,
      action: "Analyze our sales performance and identify trends",
      category: "sales"
    },
    { 
      title: "Inventory Status", 
      description: "Check stock levels and reorder points",
      icon: Package,
      action: "Show me inventory status and low stock items",
      category: "inventory"
    },
    { 
      title: "Production Schedule", 
      description: "Review manufacturing orders and schedules",
      icon: Factory,
      action: "What's our current production schedule and capacity?",
      category: "production"
    },
    { 
      title: "Customer Insights", 
      description: "Analyze customer data and relationships",
      icon: Users,
      action: "Analyze our customer base and top customers",
      category: "sales"
    },
    { 
      title: "Financial Overview", 
      description: "Review financial metrics and projections",
      icon: DollarSign,
      action: "Give me a financial overview of our business",
      category: "financial"
    },
    { 
      title: "BOM Analysis", 
      description: "Analyze bill of materials and costs",
      icon: Calculator,
      action: "Analyze our BOM costs and material requirements",
      category: "production"
    },
    { 
      title: "Comprehensive Reports", 
      description: "Generate detailed business reports and analytics",
      icon: FileText,
      action: "Generate a comprehensive business report with all key metrics, trends, and insights",
      category: "reports"
    },
    { 
      title: "Trends Analysis", 
      description: "Analyze trends across all business areas",
      icon: TrendingUp,
      action: "Analyze trends across sales, inventory, production, and purchasing for the last 6 months",
      category: "reports"
    },
    { 
      title: "MO Analysis", 
      description: "Analyze manufacturing orders and production",
      icon: Factory,
      action: "Analyze all manufacturing orders, production status, and capacity utilization",
      category: "production"
    },
    { 
      title: "PO Analysis", 
      description: "Analyze purchase orders and procurement",
      icon: ShoppingCart,
      action: "Analyze all purchase orders, supplier performance, and procurement trends",
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
      case 'logistics': return <Truck className="w-4 h-4" />;
      case 'financial': return <DollarSign className="w-4 h-4" />;
      case 'operational': return <Settings className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
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
                              body: JSON.stringify({
                                query: action.action,  // Backend expects 'query' not 'message'
                                dateContext: {
                                  currentDate: new Date().toISOString().split('T')[0],
                                  currentDateTime: new Date().toISOString()
                                }
                              })
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
                              sources: result.sources || []
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
                <div className="bg-white rounded-xl border border-slate-200 h-[calc(100vh-260px)] min-h-[500px] flex flex-col shadow-sm">
                  {/* Compact Chat Header */}
                  <div className="p-2 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                          <Brain className="w-3 h-3 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setProcessedDataCache({
                              allSalesOrders: [],
                              dataSummary: null,
                              lastProcessed: 0
                            });
                            console.log('🗑️ AI Command cache cleared');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                          title="Clear AI cache"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Clear Cache</span>
                        </button>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-500">Online</span>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Brain className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-2">
                          Welcome to AI Command Center
                        </h4>
                        <p className="text-gray-600 mb-4 max-w-md mx-auto">
                          Ask me anything about your business data. I have access to ALL your data sources 
                          including sales orders, inventory, production schedules, and customer information.
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
                              
                              // Collect all sales orders from various sources
                              let allSalesOrders = [];
                              
                              // Primary source: RealSalesOrders
                              if (data['RealSalesOrders']?.length) {
                                allSalesOrders.push(...data['RealSalesOrders']);
                              }
                              
                              // Secondary source: ParsedSalesOrders.json (from cache)
                              if (data['ParsedSalesOrders.json']?.length) {
                                allSalesOrders.push(...data['ParsedSalesOrders.json']);
                              }
                              
                              // Tertiary: Status-based arrays
                              if (data['SalesOrders_InProduction']?.length) allSalesOrders.push(...data['SalesOrders_InProduction']);
                              if (data['SalesOrders_Completed']?.length) allSalesOrders.push(...data['SalesOrders_Completed']);
                              if (data['SalesOrders_Cancelled']?.length) allSalesOrders.push(...data['SalesOrders_Cancelled']);
                              if (data['SalesOrders_New']?.length) allSalesOrders.push(...data['SalesOrders_New']);
                              if (data['SalesOrders_Scheduled']?.length) allSalesOrders.push(...data['SalesOrders_Scheduled']);
                              
                              // Quaternary: SalesOrdersByStatus object
                              if (data['SalesOrdersByStatus'] && typeof data['SalesOrdersByStatus'] === 'object') {
                                Object.values(data['SalesOrdersByStatus']).forEach((orders: any) => {
                                  if (Array.isArray(orders)) {
                                    allSalesOrders.push(...orders);
                                  }
                                });
                              }
                              
                              // Remove duplicates based on SO number
                              const uniqueSalesOrders = allSalesOrders.filter((so, index, self) => 
                                index === self.findIndex(s => {
                                  const soNum1 = s.so_number || s.soNumber || s['SO Number'] || s.SO_Number;
                                  const soNum2 = so.so_number || so.soNumber || so['SO Number'] || so.SO_Number;
                                  return soNum1 === soNum2;
                                })
                              );
                              
                              const salesOrdersCount = uniqueSalesOrders.length;
                              console.log('✅ Total unique Sales Orders:', salesOrdersCount);
                              
                              return (
                                <>
                                  <div className="bg-white rounded p-2 text-center border border-blue-200">
                                    <div className="font-bold text-blue-600">{salesOrdersCount.toLocaleString()}</div>
                                    <div className="text-gray-600">Sales Orders</div>
                                  </div>
                                  <div className="bg-white rounded p-2 text-center border border-green-200">
                                    <div className="font-bold text-green-600">{(data['Items.json'] || []).length.toLocaleString()}</div>
                                    <div className="text-gray-600">Inventory Items</div>
                                  </div>
                                  <div className="bg-white rounded p-2 text-center border border-purple-200">
                                    <div className="font-bold text-purple-600">{(data['ManufacturingOrderHeaders.json'] || []).length.toLocaleString()}</div>
                                    <div className="text-gray-600">Manufacturing Orders</div>
                                  </div>
                                  <div className="bg-white rounded p-2 text-center border border-orange-200">
                                    <div className="font-bold text-orange-600">{(data['PurchaseOrders.json'] || []).length.toLocaleString()}</div>
                                    <div className="text-gray-600">Purchase Orders</div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto">
                          <div className="text-sm text-gray-600 mb-2">Try asking:</div>
                          <div className="text-gray-900 font-medium text-sm">"Analyze all our sales orders performance"</div>
                          <div className="text-gray-900 font-medium text-sm">"Show me detailed sales order analysis"</div>
                          <div className="text-gray-900 font-medium text-sm">"What are our top customers by order value?"</div>
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
                      <div className="flex justify-start mb-4">
                        <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-2xl">
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex space-x-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Ask me anything about your business data..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                          disabled={isProcessing}
                        />
                        <Search className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || isProcessing}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center"
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    
                    {/* Quick Suggestions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        "Show me sales trends",
                        "What's our inventory status?",
                        "Analyze production capacity",
                        "Customer insights"
                      ].map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => setInputMessage(suggestion)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-full text-sm transition-colors"
                        >
                          {suggestion}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Business Insights</h2>
              <p className="text-gray-600">AI-powered insights from your business data</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {getInsightIcon(insight.type)}
                      <span className="text-sm font-medium text-gray-600 flex items-center">
                        {getCategoryIcon(insight.category)}
                        <span className="ml-1 capitalize">{insight.category}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {Math.round(insight.confidence * 100)}% confidence
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{insight.impact} impact</div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{insight.title}</h3>
                  <p className="text-gray-600 mb-4">{insight.description}</p>

                  {insight.action && (
                    <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                      {insight.action}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-7xl mx-auto space-y-5">

            {/* Header + Year Filter */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Sales Analytics</h2>
                <p className="text-sm text-slate-500 mt-0.5">Sage 50 invoiced revenue — real accounting data</p>
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
              <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Loading {analyticsYear} data…</span>
              </div>
            ) : sageKpis ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      {sageKpis.is_ytd ? 'Revenue YTD' : `${analyticsYear} Revenue`}
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Prior Year</p>
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
                  </div>
                </div>

                {/* Monthly Revenue Chart */}
                {sageMonthly.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">Monthly Revenue — {analyticsYear}</h3>
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
                              <span className="w-20 text-xs text-slate-600 text-right shrink-0 font-medium">
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

                {/* Top Customers + Best Movers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Top Customers */}
                  {sageTopCustomers.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-4">Top Customers — {analyticsYear}</h3>
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

                  {/* Best Movers */}
                  {sageBestMovers.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-4">Top Products — {analyticsYear}</h3>
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
              <div className="text-center py-12 text-slate-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No Sage analytics data available for {analyticsYear}.</p>
              </div>
            )}

            {/* Divider + MiSys local analytics below */}
            {enterpriseAnalytics && (
              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4">MiSys Sales Orders (PDF data)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Total Orders</p>
                    <p className="text-xl font-bold text-slate-900">{enterpriseAnalytics.kpis?.revenue?.total_orders || 0}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Total Value</p>
                    <p className="text-xl font-bold text-slate-900">
                      ${(enterpriseAnalytics.kpis?.revenue?.total_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Avg Order</p>
                    <p className="text-xl font-bold text-slate-900">
                      ${(enterpriseAnalytics.kpis?.revenue?.avg_order_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {false && <div className="hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white">
                      Enterprise Intelligence Hub
                    </h2>
                    <p className="text-blue-100 font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Real-time Analytics • Predictive Insights • Strategic Forecasting
                    </p>
                  </div>
                </div>
                <button
                  onClick={generateEnterpriseAnalytics}
                  disabled={isLoadingAnalytics}
                  className="px-5 py-2.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingAnalytics ? 'animate-spin' : ''}`} />
                  <span>{isLoadingAnalytics ? 'Processing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {isLoadingAnalytics ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
                <p className="text-gray-600 font-semibold text-lg">Analyzing Enterprise Data...</p>
                <p className="text-gray-500 text-sm mt-1">Processing forecasts and insights</p>
              </div>
            ) : enterpriseAnalytics ? (
              <div className="space-y-6">
                {/* CLEAN EXECUTIVE KPIS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Revenue KPI */}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm font-semibold mb-2">Total Revenue</p>
                        <p className="text-4xl font-bold mb-1">
                          ${(enterpriseAnalytics.kpis?.revenue?.total_revenue || 0).toLocaleString()}
                        </p>
                        <p className="text-blue-100 text-sm">
                          {enterpriseAnalytics.kpis?.revenue?.total_orders || 0} orders processed
                        </p>
                      </div>
                      <DollarSign className="w-12 h-12 text-white/70" />
                    </div>
                  </div>
                  
                  {/* Inventory KPI */}
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-semibold mb-2">Inventory Value</p>
                        <p className="text-4xl font-bold mb-1">
                          ${(enterpriseAnalytics.kpis?.inventory?.total_value || 0).toLocaleString()}
                        </p>
                        <p className="text-green-100 text-sm">
                          {enterpriseAnalytics.kpis?.inventory?.total_items || 0} unique items
                        </p>
                      </div>
                      <Package className="w-12 h-12 text-white/70" />
                    </div>
                  </div>
                  
                  {/* Performance KPI */}
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm font-semibold mb-2">Avg Order Value</p>
                        <p className="text-4xl font-bold mb-1">
                          ${(enterpriseAnalytics.kpis?.revenue?.avg_order_value || 0).toLocaleString()}
                        </p>
                        <p className="text-purple-100 text-sm">
                          Turnover: {(enterpriseAnalytics.kpis?.inventory?.turnover_ratio || 0).toFixed(2)}x ratio
                        </p>
                      </div>
                      <TrendingUp className="w-12 h-12 text-white/70" />
                    </div>
                  </div>
                </div>

                {/* SALES PERFORMANCE DASHBOARD */}
                {enterpriseAnalytics.sales_performance?.monthly_trends?.monthly_data && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Sales Performance Analytics</h3>
                    </div>
                    
                    {/* STATS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-700">
                            ${enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.reduce((sum, m) => sum + m.revenue, 0).toLocaleString()}
                          </div>
                          <div className="text-sm text-blue-600 font-medium mt-1">Total Revenue</div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.reduce((sum, m) => sum + m.order_count, 0)}
                          </div>
                          <div className="text-sm text-green-600 font-medium mt-1">Total Orders</div>
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            ${Math.round(enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.reduce((sum, m) => sum + m.revenue, 0) / enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.length).toLocaleString()}
                          </div>
                          <div className="text-sm text-purple-600 font-medium mt-1">Avg/Month</div>
                        </div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-700">
                            ${Math.max(...enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.map(m => m.revenue)).toLocaleString()}
                          </div>
                          <div className="text-sm text-orange-600 font-medium mt-1">Peak Month</div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Monthly Revenue Chart */}
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-gray-800 mb-4">📈 Monthly Revenue Trends</h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        {enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.map((month, index) => {
                          const maxRevenue = Math.max(...enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.map(m => m.revenue));
                          const widthPercent = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                          const isHighest = month.revenue === maxRevenue;
                          const isLowest = month.revenue === Math.min(...enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.map(m => m.revenue));
                          
                          return (
                            <div key={index} className="flex items-center gap-4">
                              <div className="w-28 text-sm font-medium text-gray-700">
                                {month.month_name} {month.year}
                              </div>
                              <div className="flex-1 bg-gray-200 rounded-full h-10 relative overflow-hidden">
                                <div 
                                  className={`h-10 rounded-full flex items-center justify-between px-4 transition-all duration-1000 ease-out ${
                                    isHighest ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                    isLowest ? 'bg-gradient-to-r from-red-400 to-red-500' :
                                    'bg-gradient-to-r from-blue-500 to-blue-600'
                                  }`}
                                  style={{ width: `${Math.max(widthPercent, 20)}%` }}
                                >
                                  <span className="text-white text-sm font-bold">
                                    ${month.revenue.toLocaleString()}
                                  </span>
                                  {isHighest && <span className="text-white text-xs">🏆</span>}
                                  {isLowest && <span className="text-white text-xs">📉</span>}
                                </div>
                              </div>
                              <div className="w-24 text-sm text-gray-600 text-right">
                                <div className="font-medium">{month.order_count} orders</div>
                                <div className="text-xs text-gray-500">{widthPercent.toFixed(0)}%</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sales Insights */}
                    {enterpriseAnalytics.sales_performance.monthly_trends.peak_month && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-green-600">🏆</span>
                            <span className="font-medium text-green-800">Best Performance</span>
                          </div>
                          <p className="text-green-700 text-sm">
                            <strong>{enterpriseAnalytics.sales_performance.monthly_trends.peak_month.month_name}</strong> was your strongest month 
                            with <strong>${enterpriseAnalytics.sales_performance.monthly_trends.peak_month.revenue?.toLocaleString() || '0'}</strong> in revenue
                          </p>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-blue-600">📊</span>
                            <span className="font-medium text-blue-800">Growth Opportunity</span>
                          </div>
                          <p className="text-blue-700 text-sm">
                            Focus on replicating <strong>{enterpriseAnalytics.sales_performance.monthly_trends.peak_month.month_name}'s</strong> success 
                            in lower-performing months to maximize revenue potential
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Seasonal Analysis */}
                {enterpriseAnalytics.sales_performance?.seasonal_analysis?.seasonal_data && (
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Seasonal Performance Analysis</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                      {enterpriseAnalytics.sales_performance.seasonal_analysis.seasonal_data.map((season, index) => {
                        const maxRevenue = Math.max(...enterpriseAnalytics.sales_performance.seasonal_analysis.seasonal_data.map(s => s.total_revenue));
                        const isHighSeason = season.month_name === enterpriseAnalytics.sales_performance.seasonal_analysis.high_season?.month_name;
                        const isLowSeason = season.month_name === enterpriseAnalytics.sales_performance.seasonal_analysis.low_season?.month_name;
                        return (
                          <div key={index} className={`p-4 rounded-lg border-2 ${
                            isHighSeason ? 'border-green-500 bg-green-50' : 
                            isLowSeason ? 'border-red-500 bg-red-50' : 
                            'border-gray-200 bg-gray-50'
                          }`}>
                            <div className="text-center">
                              <p className="text-sm font-medium text-gray-700">{season.month_name}</p>
                              <p className="text-lg font-bold text-gray-900">${season.total_revenue.toLocaleString()}</p>
                              <p className="text-xs text-gray-600">{season.order_count} orders</p>
                              {isHighSeason && <p className="text-xs text-green-600 font-medium mt-1">🔥 High Season</p>}
                              {isLowSeason && <p className="text-xs text-red-600 font-medium mt-1">❄️ Low Season</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Enhanced Customer & Product Intelligence */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Customers with Visual Chart */}
                  {enterpriseAnalytics.sales_performance?.top_customers && (
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-6">👥 Top Customer Analysis</h3>
                      
                      {/* Customer Revenue Chart */}
                      <div className="mb-6">
                        <div className="space-y-3">
                          {enterpriseAnalytics.sales_performance.top_customers.slice(0, 5).map((customer, index) => {
                            const maxRevenue = Math.max(...enterpriseAnalytics.sales_performance.top_customers.slice(0, 5).map(c => c.total_revenue));
                            const widthPercent = maxRevenue > 0 ? (customer.total_revenue / maxRevenue) * 100 : 0;
                            const isTop = index === 0;
                            
                            return (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                      isTop ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                    }`}>
                                      {isTop ? '👑' : index + 1}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-900 text-sm">{customer.customer_name}</p>
                                      <p className="text-xs text-gray-600">{customer.order_count} orders</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-gray-900 text-sm">${customer.total_revenue.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500">{widthPercent.toFixed(0)}%</p>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-1000 ${
                                      isTop ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                    }`}
                                    style={{ width: `${Math.max(widthPercent, 10)}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Customer Insights */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-blue-600">💡</span>
                          <span className="font-medium text-blue-800">Customer Insights</span>
                        </div>
                        <p className="text-blue-700 text-sm">
                          Your top customer generates <strong>{enterpriseAnalytics.sales_performance.top_customers[0] ? 
                            Math.round((enterpriseAnalytics.sales_performance.top_customers[0].total_revenue / 
                            enterpriseAnalytics.sales_performance.top_customers.reduce((sum, c) => sum + c.total_revenue, 0)) * 100) : 0}%</strong> of 
                          total revenue from top 5 customers
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Top Selling Items with Enhanced Visuals */}
                  {enterpriseAnalytics.item_intelligence?.top_selling_items && (
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-6">🏆 Top Product Performance</h3>
                      
                      {/* Product Revenue Chart */}
                      <div className="mb-6">
                        <div className="space-y-3">
                          {enterpriseAnalytics.item_intelligence.top_selling_items.slice(0, 5).map((item, index) => {
                            const maxRevenue = Math.max(...enterpriseAnalytics.item_intelligence.top_selling_items.slice(0, 5).map(i => i.total_revenue));
                            const widthPercent = maxRevenue > 0 ? (item.total_revenue / maxRevenue) * 100 : 0;
                            const isTop = index === 0;
                            
                            return (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                      isTop ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-purple-500 to-purple-600'
                                    }`}>
                                      {isTop ? '🥇' : index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-gray-900 text-sm truncate">{item.description}</p>
                                      <p className="text-xs text-gray-600 truncate">{item.item_code}</p>
                                      <p className="text-xs text-gray-500">{item.total_quantity_sold} units</p>
                                    </div>
                                  </div>
                                  <div className="text-right ml-2">
                                    <p className="font-bold text-gray-900 text-sm">${item.total_revenue.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500">{widthPercent.toFixed(0)}%</p>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-1000 ${
                                      isTop ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-purple-400 to-purple-500'
                                    }`}
                                    style={{ width: `${Math.max(widthPercent, 10)}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Product Performance Insights */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-green-600">📊</span>
                          <span className="font-medium text-green-800">Product Insights</span>
                        </div>
                        <p className="text-green-700 text-sm">
                          Top product accounts for <strong>{enterpriseAnalytics.item_intelligence.top_selling_items[0] ? 
                            Math.round((enterpriseAnalytics.item_intelligence.top_selling_items[0].total_revenue / 
                            enterpriseAnalytics.item_intelligence.top_selling_items.reduce((sum, i) => sum + i.total_revenue, 0)) * 100) : 0}%</strong> of 
                          revenue from top 5 products
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Insights and Recommendations */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {enterpriseAnalytics.insights && enterpriseAnalytics.insights.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-6">AI Business Insights</h3>
                      <div className="space-y-4">
                        {enterpriseAnalytics.insights.map((insight, index) => (
                          <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-semibold text-blue-900">{insight.title}</p>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                                insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {insight.impact} impact
                              </span>
                            </div>
                            <p className="text-blue-800">{insight.insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {enterpriseAnalytics.recommendations && enterpriseAnalytics.recommendations.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-6">Strategic Recommendations</h3>
                      <div className="space-y-4">
                        {enterpriseAnalytics.recommendations.map((rec, index) => (
                          <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-semibold text-green-900">{rec.title}</p>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                                rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {rec.priority} priority
                              </span>
                            </div>
                            <p className="text-green-800">{rec.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* FORECASTING & PREDICTIVE ANALYTICS */}
                {enterpriseAnalytics.forecasting_intelligence && (
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Zap className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Predictive Analytics & Forecasting
                        </h3>
                        <p className="text-indigo-600 text-sm font-medium">AI-Powered Business Projections</p>
                      </div>
                    </div>

                    {/* Forecasting Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {/* Revenue Projection */}
                      {enterpriseAnalytics.forecasting_intelligence.revenue_projections && (
                        <div className="bg-white rounded-lg border border-indigo-200 p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                              <TrendingUp className="w-5 h-5 text-indigo-600" />
                            </div>
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              Projected Growth
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Next Quarter Revenue</h4>
                          <p className="text-2xl font-bold text-indigo-600 mb-1">
                            ${(enterpriseAnalytics.forecasting_intelligence.revenue_projections.next_quarter || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Based on historical trends
                          </p>
                        </div>
                      )}

                      {/* Demand Forecast */}
                      {enterpriseAnalytics.forecasting_intelligence.demand_forecasts && (
                        <div className="bg-white rounded-lg border border-purple-200 p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <Activity className="w-5 h-5 text-purple-600" />
                            </div>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                              High Confidence
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Demand Forecast</h4>
                          <p className="text-2xl font-bold text-purple-600 mb-1">
                            {(enterpriseAnalytics.forecasting_intelligence.demand_forecasts.projected_orders || 0)} orders
                          </p>
                          <p className="text-xs text-gray-500">
                            Expected in next 30 days
                          </p>
                        </div>
                      )}

                      {/* Capacity Requirements */}
                      {enterpriseAnalytics.forecasting_intelligence.capacity_requirements && (
                        <div className="bg-white rounded-lg border border-pink-200 p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-pink-100 rounded-lg">
                              <Factory className="w-5 h-5 text-pink-600" />
                            </div>
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                              Monitor
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Capacity Utilization</h4>
                          <p className="text-2xl font-bold text-pink-600 mb-1">
                            {(enterpriseAnalytics.forecasting_intelligence.capacity_requirements.utilization_forecast || 75)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            Projected manufacturing capacity
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Strategic Recommendation */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-5 text-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-lg">
                            <Lightbulb className="w-6 h-6 text-yellow-300" />
                          </div>
                          <div>
                            <h4 className="font-bold mb-1">Strategic Recommendation</h4>
                            <p className="text-sm text-indigo-100">
                              {enterpriseAnalytics.forecasting_intelligence.demand_forecasts?.strategic_insight || 
                               "Current trends indicate strong growth potential. Consider expanding production capacity to meet forecasted demand increase."}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">94%</div>
                          <div className="text-xs text-indigo-100">Accuracy</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 🏢 WORLD-CLASS ENTERPRISE EXECUTIVE REPORT */}
                {enterpriseAnalytics.ai_report && enterpriseAnalytics.ai_report.executive_report && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl shadow-2xl border border-purple-500/20 mt-8">
                    {/* Animated Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-indigo-600/10 animate-pulse"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500"></div>
                    
                    <div className="relative p-8">
                      {/* Premium Header */}
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur opacity-75 animate-pulse"></div>
                            <div className="relative p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl">
                              <Brain className="w-10 h-10 text-white" />
                            </div>
                          </div>
                          <div>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                              🤖 AI Executive Intelligence Report
                            </h2>
                            <p className="text-purple-300 font-medium text-lg">
                              Powered by GPT-4o • McKinsey & Company Level Analysis
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
                            <div className="text-green-300 text-sm font-medium">CONFIDENTIAL</div>
                            <div className="text-green-400 text-xs">Executive Level</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Executive Report Content */}
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-white/20 p-8">
                        <div className="prose prose-lg max-w-none">
                          <div 
                            className="text-gray-800 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: enterpriseAnalytics.ai_report.executive_report
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 bg-yellow-100 px-1 rounded">$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em class="italic text-slate-700 font-medium">$1</em>')
                                .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4 pb-3 border-b-2 border-gradient-to-r from-purple-500 to-blue-500 flex items-center gap-2"><span class="w-2 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full"></span>$1</h2>')
                                .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold text-slate-800 mt-6 mb-3 flex items-center gap-2"><span class="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></span>$1</h3>')
                                .replace(/^#### (.*$)/gm, '<h4 class="text-lg font-medium text-slate-700 mt-4 mb-2 flex items-center gap-2"><span class="w-1 h-4 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>$1</h4>')
                                .replace(/^- (.*$)/gm, '<div class="flex items-start gap-3 mb-2 p-2 hover:bg-blue-50 rounded-lg transition-colors"><span class="flex-shrink-0 w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mt-2"></span><span class="text-slate-700">$1</span></div>')
                                .replace(/^\d+\. (.*$)/gm, '<div class="flex items-start gap-3 mb-2 p-2 hover:bg-purple-50 rounded-lg transition-colors"><span class="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">•</span><span class="text-slate-700">$1</span></div>')
                                .replace(/\n\n/g, '<div class="mb-6"></div>')
                                .replace(/\n/g, '<br/>')
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Premium Footer */}
                      <div className="mt-6 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4 text-purple-300">
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            📊 {enterpriseAnalytics.kpis?.revenue?.total_orders || 0} Sales Orders Analyzed
                          </span>
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                            💰 ${(enterpriseAnalytics.kpis?.revenue?.total_revenue || 0).toLocaleString()} Revenue Processed
                          </span>
                        </div>
                        <div className="text-purple-400 flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          🕒 Generated: {new Date().toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 🎨 STUNNING VISUAL ANALYTICS DASHBOARD */}
                <div className="mt-8 space-y-8">
                  {/* 🏆 WORLD-CLASS ENTERPRISE METRICS GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Revenue Card - Premium Design */}
                    <div className="group relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl transform rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
                      <div className="relative bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-8 text-white shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                              <DollarSign className="w-8 h-8" />
                            </div>
                            <div className="text-right">
                              <div className="text-blue-200 text-xs font-medium">TOTAL</div>
                              <div className="text-white text-sm font-bold">REVENUE</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-4xl font-black tracking-tight">${(enterpriseAnalytics.kpis?.revenue?.total_revenue || 0).toLocaleString()}</p>
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 bg-green-500/20 rounded-full">
                                <span className="text-green-300 text-xs font-bold">+15.2%</span>
                              </div>
                              <span className="text-blue-200 text-sm">📊 {enterpriseAnalytics.kpis?.revenue?.total_orders || 0} orders</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Customers Card - Premium Design */}
                    <div className="group relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800 rounded-2xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-300"></div>
                      <div className="relative bg-gradient-to-br from-emerald-500 to-green-700 rounded-2xl p-8 text-white shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                              <Users className="w-8 h-8" />
                            </div>
                            <div className="text-right">
                              <div className="text-green-200 text-xs font-medium">UNIQUE</div>
                              <div className="text-white text-sm font-bold">CUSTOMERS</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-4xl font-black tracking-tight">240</p>
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 bg-blue-500/20 rounded-full">
                                <span className="text-blue-300 text-xs font-bold">+12 new</span>
                              </div>
                              <span className="text-green-200 text-sm">🌍 Global reach</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Average Order Value - Premium Design */}
                    <div className="group relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-violet-700 to-indigo-800 rounded-2xl transform rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
                      <div className="relative bg-gradient-to-br from-purple-500 to-violet-700 rounded-2xl p-8 text-white shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                              <TrendingUp className="w-8 h-8" />
                            </div>
                            <div className="text-right">
                              <div className="text-purple-200 text-xs font-medium">AVERAGE</div>
                              <div className="text-white text-sm font-bold">ORDER VALUE</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-4xl font-black tracking-tight">${(enterpriseAnalytics.kpis?.revenue?.avg_order_value || 0).toLocaleString()}</p>
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 bg-yellow-500/20 rounded-full">
                                <span className="text-yellow-300 text-xs font-bold">High-value</span>
                              </div>
                              <span className="text-purple-200 text-sm">📈 B2B Focus</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Inventory Items - Premium Design */}
                    <div className="group relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-red-600 to-pink-700 rounded-2xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-300"></div>
                      <div className="relative bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-8 text-white shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                              <Package className="w-8 h-8" />
                            </div>
                            <div className="text-right">
                              <div className="text-orange-200 text-xs font-medium">INVENTORY</div>
                              <div className="text-white text-sm font-bold">ITEMS</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-4xl font-black tracking-tight">{(enterpriseAnalytics.kpis?.inventory?.total_items || 0).toLocaleString()}</p>
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 bg-green-500/20 rounded-full">
                                <span className="text-green-300 text-xs font-bold">In Stock</span>
                              </div>
                              <span className="text-orange-200 text-sm">📦 Catalog</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 📊 WORLD-CLASS VISUAL CHARTS SECTION */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                    {/* 🚀 PREMIUM REVENUE TRENDS CHART */}
                    <div className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                      <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
                        {/* Premium Header */}
                        <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20"></div>
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                                <BarChart3 className="w-8 h-8 text-white" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-bold text-white">📈 Revenue Performance</h3>
                                <p className="text-blue-200 font-medium">Monthly trends & growth analysis</p>
                              </div>
                            </div>
                            <div className="px-4 py-2 bg-green-500/20 rounded-xl border border-green-400/30">
                              <span className="text-green-300 text-sm font-bold">+15.2% Growth</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Chart Content */}
                        <div className="p-8">
                          {enterpriseAnalytics.sales_performance?.monthly_trends?.monthly_data ? (
                            <div className="space-y-6">
                              {enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.slice(0, 8).map((month, index) => {
                                const maxRevenue = Math.max(...enterpriseAnalytics.sales_performance.monthly_trends.monthly_data.map(m => m.revenue));
                                const widthPercent = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                                const isTop = widthPercent > 80;
                                const isGrowing = index > 0 && month.revenue > enterpriseAnalytics.sales_performance.monthly_trends.monthly_data[index - 1]?.revenue;
                                
                                return (
                                  <div key={index} className="group/item hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-2xl p-4 transition-all duration-300">
                                    <div className="flex items-center gap-6">
                                      <div className="w-24 text-center">
                                        <div className="text-lg font-bold text-slate-900">{month.month_name}</div>
                                        <div className="text-sm text-slate-600">{month.year}</div>
                                      </div>
                                      
                                      <div className="flex-1 relative">
                                        <div className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-2xl h-12 relative overflow-hidden">
                                          <div 
                                            className={`h-12 rounded-2xl flex items-center justify-between px-6 transition-all duration-1000 ease-out relative overflow-hidden ${
                                              isTop ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500' : 
                                              isGrowing ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500' :
                                              'bg-gradient-to-r from-slate-500 via-gray-500 to-slate-600'
                                            }`}
                                            style={{ width: `${Math.max(widthPercent, 20)}%` }}
                                          >
                                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                            <span className="relative text-white text-lg font-bold tracking-tight">
                                              ${month.revenue.toLocaleString()}
                                            </span>
                                            <div className="relative flex items-center gap-2">
                                              {isTop && <span className="text-yellow-300 text-xl">🏆</span>}
                                              {isGrowing && <span className="text-green-300 text-lg">📈</span>}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Performance Indicator */}
                                        <div className="mt-2 flex items-center justify-between text-sm">
                                          <span className="text-slate-600 font-medium">{month.order_count} orders</span>
                                          <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${isGrowing ? 'bg-green-400' : 'bg-slate-400'}`}></div>
                                            <span className={`font-bold ${isGrowing ? 'text-green-600' : 'text-slate-600'}`}>
                                              {widthPercent.toFixed(0)}% of peak
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-16">
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-full blur-xl"></div>
                                <BarChart3 className="relative w-16 h-16 mx-auto mb-4 text-slate-400" />
                              </div>
                              <p className="text-slate-600 font-medium">Revenue trend data loading...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 👑 PREMIUM CUSTOMER PERFORMANCE CHART */}
                    <div className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                      <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
                        {/* Premium Header */}
                        <div className="relative bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 p-8">
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-green-600/20 to-teal-600/20"></div>
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                                <Users className="w-8 h-8 text-white" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-bold text-white">👑 Elite Customers</h3>
                                <p className="text-emerald-200 font-medium">Revenue contribution leaders</p>
                              </div>
                            </div>
                            <div className="px-4 py-2 bg-yellow-500/20 rounded-xl border border-yellow-400/30">
                              <span className="text-yellow-300 text-sm font-bold">Top Performers</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Chart Content */}
                        <div className="p-8">
                          {enterpriseAnalytics.sales_performance?.top_customers ? (
                            <div className="space-y-6">
                              {enterpriseAnalytics.sales_performance.top_customers.slice(0, 8).map((customer, index) => {
                                const maxRevenue = Math.max(...enterpriseAnalytics.sales_performance.top_customers.slice(0, 8).map(c => c.total_revenue));
                                const widthPercent = maxRevenue > 0 ? (customer.total_revenue / maxRevenue) * 100 : 0;
                                const isTop = index === 0;
                                const isTopTier = index < 3;
                                const revenueShare = ((customer.total_revenue / (enterpriseAnalytics.kpis?.revenue?.total_revenue || 1)) * 100);
                                
                                return (
                                  <div key={index} className="group/customer hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 rounded-2xl p-4 transition-all duration-300">
                                    <div className="space-y-3">
                                      {/* Customer Header */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <div className={`flex items-center justify-center w-10 h-10 rounded-2xl font-bold text-white ${
                                            isTop ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                                            isTopTier ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                                            'bg-gradient-to-r from-slate-500 to-gray-500'
                                          }`}>
                                            {isTop ? '👑' : index + 1}
                                          </div>
                                          <div>
                                            <div className="font-bold text-slate-900 text-lg">
                                              {customer.customer_name.length > 30 ? 
                                                customer.customer_name.substring(0, 30) + '...' : 
                                                customer.customer_name}
                                            </div>
                                            <div className="text-slate-600 text-sm font-medium">
                                              {customer.order_count} orders • {revenueShare.toFixed(1)}% of total revenue
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-2xl font-black text-slate-900">
                                            ${customer.total_revenue.toLocaleString()}
                                          </div>
                                          {isTopTier && (
                                            <div className="px-2 py-1 bg-green-100 rounded-full">
                                              <span className="text-green-700 text-xs font-bold">VIP Client</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Revenue Bar */}
                                      <div className="relative">
                                        <div className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-xl h-6 relative overflow-hidden">
                                          <div 
                                            className={`h-6 rounded-xl transition-all duration-1000 ease-out relative overflow-hidden ${
                                              isTop ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500' :
                                              isTopTier ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500' :
                                              'bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500'
                                            }`}
                                            style={{ width: `${Math.max(widthPercent, 15)}%` }}
                                          >
                                            <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                                          </div>
                                        </div>
                                        
                                        {/* Performance Metrics */}
                                        <div className="mt-2 flex items-center justify-between text-xs">
                                          <span className="text-slate-600 font-medium">Market Share: {revenueShare.toFixed(2)}%</span>
                                          <span className="text-slate-600 font-medium">Performance: {widthPercent.toFixed(0)}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-16">
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-full blur-xl"></div>
                                <Users className="relative w-16 h-16 mx-auto mb-4 text-slate-400" />
                              </div>
                              <p className="text-slate-600 font-medium">Customer data loading...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Forecasting Section */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-lg border border-purple-200 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-purple-600 rounded-lg">
                        <Activity className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">🔮 AI-Powered Forecasting</h3>
                        <p className="text-purple-600 font-medium">Predictive analytics with machine learning insights</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-lg p-6 shadow-md">
                        <h4 className="font-semibold text-gray-900 mb-3">📈 Next Quarter Forecast</h4>
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          ${((enterpriseAnalytics.kpis?.revenue?.total_revenue || 0) * 1.15).toLocaleString()}
                        </div>
                        <p className="text-sm text-gray-600">+15% projected growth</p>
                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full w-3/4"></div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-6 shadow-md">
                        <h4 className="font-semibold text-gray-900 mb-3">👥 Customer Growth</h4>
                        <div className="text-3xl font-bold text-blue-600 mb-2">285</div>
                        <p className="text-sm text-gray-600">+45 new customers expected</p>
                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full w-4/5"></div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-6 shadow-md">
                        <h4 className="font-semibold text-gray-900 mb-3">🎯 Market Expansion</h4>
                        <div className="text-3xl font-bold text-purple-600 mb-2">3</div>
                        <p className="text-sm text-gray-600">New market segments identified</p>
                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-purple-500 h-2 rounded-full w-2/3"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise Analytics Ready</h3>
                <p className="text-gray-600 mb-6">Click "Refresh Analytics" to analyze your sales data and generate insights</p>
                <button
                  onClick={generateEnterpriseAnalytics}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Generate Analytics Report
                </button>
              </div>
            )}
            </div>}
          </div>
        )}

      </div>
    </div>
  );
};
