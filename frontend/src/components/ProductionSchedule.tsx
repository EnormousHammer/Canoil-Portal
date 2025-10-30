import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Package, 
  Factory, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  Users,
  Settings,
  BarChart3,
  GanttChart,
  Zap,
  Target,
  TrendingUp,
  Activity
} from 'lucide-react';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  status: 'scheduled' | 'in-progress' | 'completed' | 'delayed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customer?: string;
  workCenter?: string;
  progress?: number;
  estimatedHours?: number;
  actualHours?: number;
  materials?: string[];
  revenue?: number;
  color?: string;
}

interface WorkCenter {
  id: string;
  name: string;
  capacity: number;
  utilization: number;
  efficiency: number;
  operators: number;
  equipment: string[];
  currentOrders: string[];
  queue: string[];
}

interface ProductionScheduleProps {
  data?: any;
  onBack: () => void;
}

export const ProductionSchedule: React.FC<ProductionScheduleProps> = ({ data, onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'timeline' | 'gantt' | 'resources'>('timeline');
  const [timeRange, setTimeRange] = useState<'week' | '2weeks' | 'month' | '1.5months' | '2months' | '2.5months' | '3months' | '4months' | '6months' | 'year'>('week');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workCenterFilter, setWorkCenterFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Process MPS orders into production schedule format
  const processMPSOrders = (mpsOrders: any[], data: any) => {
    console.log('🔍 MPS Data Structure:', mpsOrders.slice(0, 2)); // Log first 2 orders to see structure
    console.log('🔍 Total MPS Orders:', mpsOrders.length);
    console.log('🔍 Sample Order:', mpsOrders[0]);
    const salesOrders = data['SalesOrders.json'] || [];
    const items = data['Items.json'] || [];
    
    // Create work centers from MPS data
    const workCenterMap = new Map<string, WorkCenter>();
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500',
      'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-amber-500'
    ];
    
    const orders = mpsOrders.map((mpsOrder: any, index: number) => {
      // Debug: Log the actual MPS order structure
      if (index < 3) {
        console.log(`🔍 MPS Order ${index}:`, Object.keys(mpsOrder), mpsOrder);
      }
      
      // Parse dates from MPS data - handle the actual field names from Google Sheets
      let startDate: Date;
      let endDate: Date;
      
      try {
        // Try to parse the actual date fields from the MPS data
        const startDateStr = mpsOrder.start_date || mpsOrder.startDate || mpsOrder['Start Date'] || mpsOrder['Start'] || mpsOrder['Date'];
        const endDateStr = mpsOrder.due_date || mpsOrder.endDate || mpsOrder['Due Date'] || mpsOrder['End Date'] || mpsOrder['Due'] || mpsOrder['End'];
        
        console.log(`Order ${mpsOrder.order_number}: startDateStr="${startDateStr}", endDateStr="${endDateStr}"`);
        
        if (startDateStr) {
          // Try to parse MPS date format like "Mon, Nov 10"
          if (startDateStr.includes(',')) {
            // Parse format like "Mon, Nov 10" - assume current year
            const parts = startDateStr.split(',');
            if (parts.length === 2) {
              const monthDay = parts[1].trim();
              const currentYear = new Date().getFullYear();
              const dateStr = `${monthDay} ${currentYear}`;
              startDate = new Date(dateStr);
              console.log(`Parsed start date from "${startDateStr}" to "${dateStr}" = ${startDate.toDateString()}`);
            } else {
              startDate = new Date(startDateStr);
            }
          } else {
            startDate = new Date(startDateStr);
          }
          
          if (isNaN(startDate.getTime())) {
            console.log(`Invalid start date "${startDateStr}", using fallback`);
            // Fallback: create a date based on order number - spread them out properly
            const today = new Date();
            const dayOffset = (index % 30) - 15; // Spread orders over 30 days
            startDate = new Date(today);
            startDate.setDate(today.getDate() + dayOffset);
            console.log(`Order ${mpsOrder.order_number}: Using fallback start date: ${startDate.toDateString()}`);
          }
        } else {
          // Fallback: create a date based on order number - spread them out properly
          const today = new Date();
          const dayOffset = (index % 30) - 15; // Spread orders over 30 days
          startDate = new Date(today);
          startDate.setDate(today.getDate() + dayOffset);
          console.log(`Order ${mpsOrder.order_number}: Using fallback start date: ${startDate.toDateString()}`);
        }
        
        if (endDateStr) {
          // Try to parse MPS date format like "Mon, Oct 6"
          if (endDateStr.includes(',')) {
            // Parse format like "Mon, Oct 6" - assume current year
            const parts = endDateStr.split(',');
            if (parts.length === 2) {
              const monthDay = parts[1].trim();
              const currentYear = new Date().getFullYear();
              const dateStr = `${monthDay} ${currentYear}`;
              endDate = new Date(dateStr);
              console.log(`Parsed end date from "${endDateStr}" to "${dateStr}" = ${endDate.toDateString()}`);
            } else {
              endDate = new Date(endDateStr);
            }
          } else {
            endDate = new Date(endDateStr);
          }
          
          if (isNaN(endDate.getTime())) {
            console.log(`Invalid end date "${endDateStr}", using fallback`);
            // Fallback: add 1-7 days to start date
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + (index % 7) + 1);
            console.log(`Order ${mpsOrder.order_number}: Using fallback end date: ${endDate.toDateString()}`);
          }
        } else {
          // Fallback: add 1-7 days to start date
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + (index % 7) + 1);
          console.log(`Order ${mpsOrder.order_number}: Using fallback end date: ${endDate.toDateString()}`);
        }
      } catch (error) {
        console.log('Date parsing error for order:', mpsOrder, error);
        // Fallback dates - spread them out more
        const today = new Date();
        const dayOffset = (index % 30) - 15; // Spread orders over 30 days
        startDate = new Date(today);
        startDate.setDate(today.getDate() + dayOffset);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + (index % 7) + 1); // 1-7 days duration
        console.log(`Order ${mpsOrder.order_number}: Using error fallback dates: ${startDate.toDateString()} to ${endDate.toDateString()}`);
      }
      
      // Preserve original MPS status values
      const originalMpsStatus = (mpsOrder.status || mpsOrder['Status'] || '').toString();
      console.log(`Order ${mpsOrder.order_number}: Original MPS status="${originalMpsStatus}"`);
      
      // Map to internal status for display logic, but keep original for filtering
      let status: ProductionOrder['status'] = 'scheduled';
      const mpsStatus = originalMpsStatus.toLowerCase();
      
      if (mpsStatus === 'completed' || mpsStatus === 'finished' || mpsStatus === 'c') {
        status = 'completed';
      } else if (mpsStatus === 'in-progress' || mpsStatus === 'active' || mpsStatus === 'b' || mpsStatus === 'in progress' || mpsStatus === 'released to production') {
        status = 'in-progress';
      } else if (mpsStatus === 'on-hold' || mpsStatus === 'hold' || mpsStatus === 'h' || mpsStatus === 'shortage') {
        status = 'on-hold';
      } else if (mpsStatus === 'pending' || mpsStatus === 'scheduled' || mpsStatus === 'p' || mpsStatus === 's' || mpsStatus === 'in queue') {
        status = 'scheduled';
      } else {
        // Default to scheduled for any other status
        status = 'scheduled';
        console.log(`Order ${mpsOrder.order_number}: Unknown status "${mpsStatus}", defaulting to scheduled`);
      }
        
        // Check if past due
        if (status === 'in-progress' && endDate < new Date()) {
          status = 'delayed';
        }

      // Determine priority from MPS data
        let priority: ProductionOrder['priority'] = 'medium';
      const mpsPriority = (mpsOrder.priority || mpsOrder['Priority'] || '').toString().toLowerCase();
      if (mpsPriority === 'urgent' || mpsPriority === 'critical' || mpsPriority === '1') priority = 'urgent';
      else if (mpsPriority === 'high' || mpsPriority === '2') priority = 'high';
      else if (mpsPriority === 'low' || mpsPriority === '4') priority = 'low';
      
      // Get work center from MPS data - use the actual field names
      let workCenter = mpsOrder.work_center || mpsOrder.workCenter || mpsOrder['Work Center'] || mpsOrder['WC'] || '';
      
      // If no work center specified, assign based on product type
      if (!workCenter) {
        const product = (mpsOrder.product || mpsOrder['Product'] || '').toLowerCase();
        if (product.includes('grease') || product.includes('lubricant')) {
          workCenter = 'Grease Line 1';
        } else if (product.includes('oil') || product.includes('fluid')) {
          workCenter = 'Oil Line 1';
        } else if (product.includes('packaging') || product.includes('container')) {
          workCenter = 'Packaging Line';
        } else {
          // Default to alternating between lines
          const lines = ['Grease Line 1', 'Oil Line 1', 'Grease Line 2', 'Oil Line 2', 'Packaging Line'];
          workCenter = lines[index % lines.length];
        }
      }
        
        // Create work center if it doesn't exist
        if (!workCenterMap.has(workCenter)) {
          workCenterMap.set(workCenter, {
            id: workCenter,
            name: workCenter,
            capacity: 100,
            utilization: 0,
            efficiency: 85,
            operators: 3,
            equipment: ['Machine A', 'Machine B'],
            currentOrders: [],
            queue: []
          });
        }
        
        // Calculate progress based on status and dates
        let progress = 0;
        if (status === 'completed') progress = 100;
        else if (status === 'in-progress') {
          const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
          const daysPassed = Math.max(0, (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          progress = Math.min(90, Math.max(10, (daysPassed / totalDays) * 100));
        }
        
      // Get customer from MPS data
      const customerName = mpsOrder.customer || mpsOrder['Customer'] || mpsOrder['C'] || 'Internal Production';
      
      // Get item details - use the actual field names
      const itemDescription = mpsOrder.description || mpsOrder.item_description || mpsOrder['Description'] || mpsOrder.product || mpsOrder['Product'] || 'Production Item';
      
      // Get quantity - try different field names
      const quantity = parseFloat(mpsOrder.quantity || mpsOrder['Quantity'] || mpsOrder.required || mpsOrder['Required'] || '1') || 1;

        return {
        id: mpsOrder.order_number || mpsOrder.order_id || mpsOrder['Order Number'] || mpsOrder['Order#'] || `MPS-${index}`,
        orderNumber: mpsOrder.order_number || mpsOrder.order_id || mpsOrder['Order Number'] || mpsOrder['Order#'] || `MPS-${index}`,
        itemCode: mpsOrder.item_code || mpsOrder.item_number || mpsOrder['Item Code'] || mpsOrder.mo_number || mpsOrder['MO'] || mpsOrder.so_number || mpsOrder['SO'] || `ITEM-${index}`,
        so_number: mpsOrder.so_number || mpsOrder['SO'] || mpsOrder['SO Number'] || mpsOrder.sales_order || '',
        mo_number: mpsOrder.mo_number || mpsOrder['MO'] || mpsOrder['MO Number'] || mpsOrder.manufacturing_order || '',
        originalMpsStatus: originalMpsStatus, // Preserve original MPS status
          description: itemDescription,
          quantity: quantity,
        unit: 'EA',
          startDate,
          endDate,
          status,
          priority,
          customer: customerName,
          workCenter: workCenter,
          progress: Math.round(progress),
        estimatedHours: mpsOrder.estimated_hours || 8,
        actualHours: mpsOrder.actual_hours || Math.round(progress * 8 / 100),
        materials: mpsOrder.materials || [],
        revenue: mpsOrder.revenue || 0,
          color: colors[index % colors.length]
        };
    });

    // Group orders by customer
    const grouped = orders.reduce((acc: any, order: ProductionOrder) => {
      const customer = order.customer || 'Unknown Customer';
      if (!acc[customer]) {
        acc[customer] = [];
      }
      acc[customer].push(order);
      return acc;
    }, {});

    const customerGroups = Object.keys(grouped)
      .sort()
      .map(customer => ({
        customer,
        orders: grouped[customer].sort((a: any, b: any) => a.startDate.getTime() - b.startDate.getTime())
      }));

    // Update work center utilization
    workCenterMap.forEach((workCenter) => {
      const workCenterOrders = orders.filter((order: any) => order.workCenter === workCenter.id);
      workCenter.currentOrders = workCenterOrders.map((order: any) => order.id);
      workCenter.utilization = Math.min(100, (workCenterOrders.length / 10) * 100);
    });

    console.log('📊 MPS Processing Complete:', {
      total: mpsOrders.length,
      processed: orders.length,
      workCenters: workCenterMap.size
    });
    
    // Debug: Show sample processed orders
    console.log('📊 Sample Processed Orders:', orders.slice(0, 3));
    console.log('📊 Work Centers Found:', Array.from(workCenterMap.keys()));
    console.log('🔍 Work Center Details:', orders.slice(0, 10).map(o => ({ 
      orderNumber: o.orderNumber, 
      workCenter: o.workCenter,
      status: o.status,
      startDate: o.startDate,
      endDate: o.endDate
    })));

    return { 
      customerGroups, 
      allOrders: orders, 
      workCenters: Array.from(workCenterMap.values())
    };
  };


  // Extract data from MPS (Master Production Schedule) - ONLY SOURCE
  const { customerGroups, allOrders, workCenters } = useMemo(() => {
    console.log('🔍 ProductionSchedule: Processing data...', { hasData: !!data, dataKeys: data ? Object.keys(data) : [] });
    
    if (!data) {
      console.log('⚠️ No data provided to ProductionSchedule');
      return { customerGroups: [], allOrders: [], workCenters: [] };
    }
    
    // Get MPS data - ONLY SOURCE
    const mpsData = data['MPS.json'] || {};
    console.log('📊 MPS Data Structure:', typeof mpsData, Array.isArray(mpsData), mpsData);
    console.log('📊 MPS Data Keys:', Object.keys(mpsData));
    console.log('📊 MPS Data Full Object:', JSON.stringify(mpsData, null, 2));
    
    // Debug: Check if MPS data has the expected structure
    if (mpsData && typeof mpsData === 'object') {
      console.log('📊 MPS Data Analysis:');
      console.log('  - Has mps_orders:', !!mpsData.mps_orders);
      console.log('  - mps_orders type:', typeof mpsData.mps_orders);
      console.log('  - mps_orders length:', Array.isArray(mpsData.mps_orders) ? mpsData.mps_orders.length : 'not array');
      if (Array.isArray(mpsData.mps_orders) && mpsData.mps_orders.length > 0) {
        console.log('  - First order:', mpsData.mps_orders[0]);
        console.log('  - First order keys:', Object.keys(mpsData.mps_orders[0]));
      }
    }
    
    // Try different possible structures for MPS data
    let mpsOrders: any[] = [];
    if (Array.isArray(mpsData)) {
      mpsOrders = mpsData;
    } else if (mpsData.mps_orders && Array.isArray(mpsData.mps_orders)) {
      mpsOrders = mpsData.mps_orders;
    } else if (mpsData.orders && Array.isArray(mpsData.orders)) {
      mpsOrders = mpsData.orders;
    } else if (mpsData.data && Array.isArray(mpsData.data)) {
      mpsOrders = mpsData.data;
    } else if (mpsData.records && Array.isArray(mpsData.records)) {
      mpsOrders = mpsData.records;
    } else {
      // Try to find any array property
      const arrayKeys = Object.keys(mpsData).filter(key => Array.isArray(mpsData[key]));
      if (arrayKeys.length > 0) {
        mpsOrders = mpsData[arrayKeys[0]];
        console.log('📊 Found array in key:', arrayKeys[0]);
      } else {
        // Convert object values to array
        mpsOrders = Object.values(mpsData);
        console.log('📊 Converted object values to array');
      }
    }
    
    if (!mpsOrders || mpsOrders.length === 0) {
      console.log('⚠️ No MPS data available');
      return { customerGroups: [], allOrders: [], workCenters: [] };
    }
    
    console.log('📊 Using REAL MPS data:', mpsOrders.length, 'production orders');
    
    // Process MPS orders directly
    const result = processMPSOrders(mpsOrders, data);
    console.log('📊 Processed MPS result:', {
      customerGroups: result.customerGroups.length,
      allOrders: result.allOrders.length,
      workCenters: result.workCenters.length,
      sampleOrder: result.allOrders[0]
    });
    
    // Debug: Check the processed orders in detail
    if (result.allOrders.length > 0) {
      console.log('📊 Sample Processed Orders:');
      result.allOrders.slice(0, 3).forEach((order, index) => {
        console.log(`  Order ${index + 1}:`, {
          orderNumber: order.orderNumber,
          customer: order.customer,
          workCenter: order.workCenter,
          status: order.status,
          startDate: order.startDate?.toDateString(),
          endDate: order.endDate?.toDateString()
        });
      });
      
      // Debug: Show status distribution
      const statusCounts = result.allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('📊 Status Distribution:', statusCounts);
      
      // Debug: Show work center distribution
      const workCenterCounts = result.allOrders.reduce((acc, order) => {
        acc[order.workCenter || 'unknown'] = (acc[order.workCenter || 'unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('📊 Work Center Distribution:', workCenterCounts);
    }
    
    return result;
  }, [data]);

  // Extract unique MPS status values for filter buttons
  const mpsStatusValues = useMemo(() => {
    if (!data || !data['MPS.json']) return [];
    
    const mpsData = data['MPS.json'];
    let mpsOrders: any[] = [];
    
    if (Array.isArray(mpsData)) {
      mpsOrders = mpsData;
    } else if (mpsData.mps_orders && Array.isArray(mpsData.mps_orders)) {
      mpsOrders = mpsData.mps_orders;
    } else if (mpsData.orders && Array.isArray(mpsData.orders)) {
      mpsOrders = mpsData.orders;
    } else if (mpsData.data && Array.isArray(mpsData.data)) {
      mpsOrders = mpsData.data;
    } else if (mpsData.records && Array.isArray(mpsData.records)) {
      mpsOrders = mpsData.records;
    } else {
      const arrayKeys = Object.keys(mpsData).filter(key => Array.isArray(mpsData[key]));
      if (arrayKeys.length > 0) {
        mpsOrders = mpsData[arrayKeys[0]];
      } else {
        mpsOrders = Object.values(mpsData);
      }
    }
    
    // Extract unique status values from MPS data
    const statusSet = new Set<string>();
    mpsOrders.forEach((order: any) => {
      // Try multiple possible status field names
      const status = order.status || order['Status'] || order.status_text || order['Status Text'] || 
                    order.mps_status || order['MPS Status'] || order.order_status || order['Order Status'] || '';
      if (status) {
        // Keep original case for display
        statusSet.add(status.toString());
      }
    });
    
    // If no statuses found, try to get them from the processed orders
    if (statusSet.size === 0 && allOrders && allOrders.length > 0) {
      console.log('⚠️ No MPS status values found, checking processed orders...');
      allOrders.forEach((order: any) => {
        if (order.originalMpsStatus) {
          statusSet.add(order.originalMpsStatus.toString());
        }
      });
      console.log('🔍 Status values from processed orders:', Array.from(statusSet));
    }
    
    // Convert to array and sort
    const statusArray = Array.from(statusSet).sort();
    console.log('🔍 MPS Status Values Found (Original Case):', statusArray);
    console.log('🔍 Sample MPS Order Status:', mpsOrders[0]?.status || mpsOrders[0]?.['Status']);
    console.log('🔍 Sample MPS Order Keys:', mpsOrders[0] ? Object.keys(mpsOrders[0]) : 'No orders');
    
    return statusArray;
  }, [data, allOrders]);

  // Generate timeline dates based on current view and time range
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(currentDate);
    
    // Set start date based on time range
    if (timeRange === 'week') {
      // Start from Monday of current week
      const dayOfWeek = start.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, so go back 6 days
      start.setDate(start.getDate() + mondayOffset);
    } else if (timeRange === '2weeks') {
      // Start from Monday of current week
      const dayOfWeek = start.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(start.getDate() + mondayOffset);
    } else if (timeRange === 'month') {
      // Start from first day of current month
      start.setDate(1);
    } else if (timeRange === '1.5months') {
      // Start from 15 days before current date
      start.setDate(start.getDate() - 15);
    } else if (timeRange === '2months') {
      // Start from 2 months ago
      start.setMonth(start.getMonth() - 2);
    } else if (timeRange === '2.5months') {
      // Start from 2.5 months ago
      start.setMonth(start.getMonth() - 2);
      start.setDate(start.getDate() - 15);
    } else if (timeRange === '3months') {
      // Start from 3 months ago
      start.setMonth(start.getMonth() - 3);
    } else if (timeRange === '4months') {
      // Start from 4 months ago
      start.setMonth(start.getMonth() - 4);
    } else if (timeRange === '6months') {
      // Start from 6 months ago
      start.setMonth(start.getMonth() - 6);
    } else if (timeRange === 'year') {
      // Start from 1 year ago
      start.setFullYear(start.getFullYear() - 1);
    } else {
      // Default to current month
      start.setDate(1);
    }
    
    const daysToShow = 
      timeRange === 'week' ? 7 :
      timeRange === '2weeks' ? 14 :
      timeRange === 'month' ? 31 :
      timeRange === '1.5months' ? 45 :
      timeRange === '2months' ? 60 :
      timeRange === '2.5months' ? 75 :
      timeRange === '3months' ? 90 :
      timeRange === '4months' ? 120 :
      timeRange === '6months' ? 180 :
      timeRange === 'year' ? 365 : 31;
    
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    
    console.log('Timeline dates generated:', {
      timeRange,
      currentDate: currentDate.toDateString(),
      startDate: start.toDateString(),
      endDate: dates[dates.length - 1]?.toDateString(),
      totalDays: dates.length,
      orderCount: allOrders.length
    });
    
    // Debug: Show the actual dates being generated
    console.log('📅 Timeline dates:', dates.map(d => d.toDateString()));
    
    return dates;
  }, [currentDate, timeRange, allOrders]);

  // Filter customer groups based on search and status
  const filteredCustomerGroups = useMemo(() => {
    return customerGroups.map(group => ({
      ...group,
      orders: group.orders.filter((order: any) => {
        const matchesSearch = searchTerm === '' || 
          order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.customer.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || 
                              (order.originalMpsStatus && (
                                order.originalMpsStatus.toString() === statusFilter || 
                                order.originalMpsStatus.toString().toLowerCase() === statusFilter.toLowerCase()
                              )) ||
                              order.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
    })).filter(group => group.orders.length > 0); // Only show customers with matching orders
  }, [customerGroups, searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'in-progress': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'delayed': return 'bg-red-500';
      case 'on-hold': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-400';
    }
  };

  const isDateInRange = (date: Date, startDate: Date, endDate: Date) => {
    return date >= startDate && date <= endDate;
  };

  const navigateTime = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const increment = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
    
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - increment);
    } else {
      newDate.setDate(newDate.getDate() + increment);
    }
    
    setCurrentDate(newDate);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Compact Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                  <Factory className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Production Schedule</h1>
                  <p className="text-gray-600 text-xs">MPS Data - Manufacturing Timeline</p>
                </div>
              </div>
            </div>
            
            {/* Compact Controls */}
            <div className="flex items-center space-x-2">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {[
                  { mode: 'gantt', icon: GanttChart, label: 'Gantt' },
                  { mode: 'timeline', icon: Clock, label: 'Timeline' },
                  { mode: 'resources', icon: Users, label: 'Resources' }
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewMode === mode
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              
              <button className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs">
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Filters & Controls */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent w-32"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              {mpsStatusValues.map((status) => {
                const getStatusDisplayName = (status: string) => {
                  // Return the original status as-is, with proper capitalization
                  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
                };
                return (
                  <option key={status} value={status}>
                    {getStatusDisplayName(status)}
                  </option>
                );
              })}
            </select>

            {/* Time Range */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {['week', 'month', 'quarter'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTimeRange(mode as any)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    timeRange === mode
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateTime('prev')}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            
            <div className="text-sm font-semibold text-gray-900 min-w-32 text-center">
              {currentDate.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </div>
            
            <button
              onClick={() => navigateTime('next')}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <div className="h-full flex flex-col">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                    <Clock className="w-6 h-6 text-white" />
                </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">MPS Production Timeline</h3>
                    <p className="text-sm text-gray-600">Master Production Schedule - Real-time Manufacturing Orders</p>
              </div>
            </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">Active: {allOrders.filter((o: any) => o.status === 'in-progress').length}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Scheduled: {allOrders.filter((o: any) => o.status === 'scheduled').length}</span>
                          </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-600">Delayed: {allOrders.filter((o: any) => o.status === 'delayed').length}</span>
                  </div>
                          </div>
                    </div>
                  </div>
                  
            {/* ENTERPRISE PRODUCTION CALENDAR - EASY TO SEE */}
            <div className="flex-1 p-6">
              {/* Enterprise Header with Filters */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg text-white mb-6">
                <div className="px-8 py-6">
                  <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Production Calendar</h2>
                    <p className="text-blue-100 mt-1">Manufacturing Schedule with MO Status - Week of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{allOrders.length}</div>
                      <div className="text-blue-100">Total Orders</div>
                    </div>
                  </div>
                  
                  {/* Filter Options */}
                  <div className="mt-6 flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-100 text-sm font-medium">Show:</span>
                      <div className="flex bg-blue-500/20 rounded-lg p-1">
                        <button
                          onClick={() => setStatusFilter('all')}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            statusFilter === 'all' 
                              ? 'bg-blue-500 text-white' 
                              : 'text-blue-100 hover:text-white'
                          }`}
                        >
                          All ({allOrders.length})
                        </button>
                        {(() => {
                          console.log('🔍 Rendering filter buttons for statuses:', mpsStatusValues);
                          return mpsStatusValues.map((status) => {
                          // Map MPS status to display name and count
                          const getStatusDisplayName = (status: string) => {
                            // Return the original status as-is, with proper capitalization
                            return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
                          };
                          
                          const getStatusColor = (status: string) => {
                            switch(status.toLowerCase()) {
                              case 'b':
                              case 'active':
                              case 'in-progress':
                              case 'released to production': return 'bg-yellow-500';
                              case 'c':
                              case 'finished':
                              case 'completed': return 'bg-green-500';
                              case 'h':
                              case 'hold':
                              case 'on-hold':
                              case 'shortage': return 'bg-red-500';
                              case 'p':
                              case 'pending': return 'bg-blue-500';
                              case 's':
                              case 'scheduled':
                              case 'in queue': return 'bg-indigo-500';
                              default: return 'bg-purple-500';
                            }
                          };
                          
                          // Count orders with this MPS status
                          const statusCount = allOrders.filter((o: any) => {
                            // Check if the order's original MPS status matches
                            const originalStatus = o.originalMpsStatus || o.status;
                            return originalStatus && (
                              originalStatus.toString() === status || 
                              originalStatus.toString().toLowerCase() === status.toLowerCase()
                            );
                          }).length;
                          
                          if (statusCount === 0) return null; // Don't show status with 0 orders
                          
                          return (
                            <button
                              key={status}
                              onClick={() => setStatusFilter(status)}
                              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                statusFilter === status 
                                  ? `${getStatusColor(status)} text-white` 
                                  : 'text-blue-100 hover:text-white'
                              }`}
                            >
                              {getStatusDisplayName(status)} ({statusCount})
                            </button>
                          );
                        });
                        })()}
                      </div>
                                </div>

                    {/* Work Center Filter */}
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-100 text-sm font-medium">Lines:</span>
                      <select
                        value={workCenterFilter}
                        onChange={(e) => setWorkCenterFilter(e.target.value)}
                        className="bg-blue-500/20 border border-blue-400/30 rounded-md px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="all" className="bg-gray-800">All Lines</option>
                        <option value="grease1" className="bg-gray-800">Grease Line 1</option>
                        <option value="oil1" className="bg-gray-800">Oil Line 1</option>
                        <option value="grease2" className="bg-gray-800">Grease Line 2</option>
                        <option value="oil2" className="bg-gray-800">Oil Line 2</option>
                        <option value="packaging" className="bg-gray-800">Packaging</option>
                      </select>
                                    </div>
                    
                    {/* Time Range Filter */}
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-100 text-sm font-medium">Period:</span>
                      <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="bg-blue-500/20 border border-blue-400/30 rounded-md px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="week" className="bg-gray-800">1 Week</option>
                        <option value="2weeks" className="bg-gray-800">2 Weeks</option>
                        <option value="month" className="bg-gray-800">1 Month</option>
                        <option value="1.5months" className="bg-gray-800">1.5 Months</option>
                        <option value="2months" className="bg-gray-800">2 Months</option>
                        <option value="2.5months" className="bg-gray-800">2.5 Months</option>
                        <option value="3months" className="bg-gray-800">3 Months</option>
                        <option value="4months" className="bg-gray-800">4 Months</option>
                        <option value="6months" className="bg-gray-800">6 Months</option>
                        <option value="year" className="bg-gray-800">1 Year</option>
                      </select>
                                  </div>
                                  </div>
                                  </div>
                                </div>

              {/* Production Lines Calendar Grid */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Calendar Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className={`grid gap-2`} style={{ gridTemplateColumns: `200px repeat(${timelineDates.length}, 1fr)` }}>
                    <div className="text-sm font-bold text-gray-600 text-center">Production Lines</div>
                    {timelineDates.map((date, index) => {
                      // Get MO status for this day
                      const dayOrders = allOrders.filter((order: any) => {
                        const orderStart = new Date(order.startDate);
                        const orderEnd = new Date(order.endDate);
                        const currentDayNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        const orderStartNormalized = new Date(orderStart.getFullYear(), orderStart.getMonth(), orderStart.getDate());
                        const orderEndNormalized = new Date(orderEnd.getFullYear(), orderEnd.getMonth(), orderEnd.getDate());
                        return currentDayNormalized >= orderStartNormalized && currentDayNormalized <= orderEndNormalized;
                      });
                      
                      // Count MO statuses and get status details for this day
                      const moStatusCounts = dayOrders.reduce((acc: any, order: any) => {
                        const moStatus = order.mo_number ? 'MO' : order.so_number ? 'SO' : 'MPS';
                        acc[moStatus] = (acc[moStatus] || 0) + 1;
                        return acc;
                      }, {});
                      
                      // Get status distribution for this day
                      const statusCounts = dayOrders.reduce((acc: any, order: any) => {
                        acc[order.status] = (acc[order.status] || 0) + 1;
                        return acc;
                      }, {});
                      
                      const totalOrders = dayOrders.length;
                      const moCount = moStatusCounts.MO || 0;
                      const soCount = moStatusCounts.SO || 0;
                      const inProgressCount = statusCounts['in-progress'] || 0;
                      const completedCount = statusCounts['completed'] || 0;
                      const scheduledCount = statusCounts['scheduled'] || 0;
                      
                      return (
                        <div key={index} className="text-sm font-bold text-gray-600 text-center">
                          <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          <div className="text-xs text-gray-500">{date.getDate()}</div>
                          <div className="text-xs text-blue-600 mt-1">
                            MO: {moCount} | SO: {soCount}
                          </div>
                          <div className="text-xs text-gray-500">
                            {inProgressCount > 0 && <span className="text-yellow-600">●{inProgressCount}</span>}
                            {completedCount > 0 && <span className="text-green-600 ml-1">●{completedCount}</span>}
                            {scheduledCount > 0 && <span className="text-blue-600 ml-1">●{scheduledCount}</span>}
                          </div>
                        </div>
                      );
                    })}
                                  </div>
                                </div>

                {/* Production Lines Rows */}
                <div className="divide-y divide-gray-200">
                  {/* Grease Line 1 */}
                  <div className={`grid gap-2 p-4 hover:bg-gray-50`} style={{ gridTemplateColumns: `200px repeat(${timelineDates.length}, 1fr)` }}>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                      <div>
                        <div className="font-bold text-gray-900">Grease Line 1</div>
                        <div className="text-sm text-gray-500">Primary Production</div>
                              </div>
                        </div>
                    {timelineDates.map((currentDay, dayIndex) => {
                      
                      const dayOrders = allOrders.filter((order: any) => {
                        const orderStart = new Date(order.startDate);
                        const orderEnd = new Date(order.endDate);
                        
                        // Normalize dates to compare only date parts (ignore time)
                        const currentDayNormalized = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                        const orderStartNormalized = new Date(orderStart.getFullYear(), orderStart.getMonth(), orderStart.getDate());
                        const orderEndNormalized = new Date(orderEnd.getFullYear(), orderEnd.getMonth(), orderEnd.getDate());
                        
                        const isOnDate = currentDayNormalized >= orderStartNormalized && currentDayNormalized <= orderEndNormalized;
                        const isGreaseLine1 = order.workCenter?.toLowerCase().includes('grease') && 
                                             (order.workCenter?.includes('1') || order.workCenter?.toLowerCase().includes('line 1') || order.workCenter?.toLowerCase().includes('grease1'));
                        const matchesStatus = statusFilter === 'all' || 
                              (order.originalMpsStatus && (
                                order.originalMpsStatus.toString() === statusFilter || 
                                order.originalMpsStatus.toString().toLowerCase() === statusFilter.toLowerCase()
                              )) ||
                              order.status === statusFilter;
                        const matchesWorkCenter = workCenterFilter === 'all' || 
                                                (workCenterFilter === 'grease1' && isGreaseLine1);
                        
                        // Debug logging for first few orders
                        if (dayIndex === 0 && order.orderNumber) {
                          console.log('Grease Line 1 Debug:', {
                            orderNumber: order.orderNumber,
                            workCenter: order.workCenter,
                            status: order.status,
                            startDate: orderStartNormalized.toDateString(),
                            endDate: orderEndNormalized.toDateString(),
                            currentDay: currentDayNormalized.toDateString(),
                            isOnDate,
                            isGreaseLine1,
                            matchesStatus,
                            matchesWorkCenter,
                            statusFilter,
                            workCenterFilter
                          });
                        }
                        
                        // If no specific work center matches, show all orders for debugging
                        const shouldShow = isGreaseLine1 && isOnDate && matchesStatus && matchesWorkCenter;
                        
                        // Debug: Log if this order should be shown
                        if (dayIndex === 0 && order.orderNumber) {
                          console.log('Grease Line 1 Filter Debug:', {
                            orderNumber: order.orderNumber,
                            workCenter: order.workCenter,
                            isGreaseLine1,
                            isOnDate,
                            matchesStatus,
                            matchesWorkCenter,
                            shouldShow
                          });
                        }
                        
                        return shouldShow;
                      });
                      
                      // Debug: Log total orders and filtered orders for this day
                      if (dayIndex === 0) {
                        console.log(`Day ${dayIndex} (${currentDay.toDateString()}):`, {
                          totalOrders: allOrders.length,
                          dayOrders: dayOrders.length,
                          statusFilter,
                          workCenterFilter
                        });
                      }
                      
                      return (
                        <div key={dayIndex} className="min-h-20 border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">{currentDay.getDate()}</div>
                          <div className="space-y-1">
                            {dayOrders.slice(0, 2).map((order: any) => {
                              // Use order's color or default to green for grease line 1
                              const orderColor = order.color || 'bg-green-500';
                              const bgColor = orderColor.replace('bg-', 'bg-').replace('-500', '-100');
                              const borderColor = orderColor.replace('bg-', 'border-').replace('-500', '-300');
                              const textColor = orderColor.replace('bg-', 'text-').replace('-500', '-800');
                              const subTextColor = orderColor.replace('bg-', 'text-').replace('-500', '-700');
                              const progressColor = orderColor.replace('bg-', 'text-').replace('-500', '-600');
                              
                              return (
                                <div key={order.id} className={`${bgColor} border ${borderColor} rounded px-2 py-1 text-xs`}>
                                  <div className={`font-bold ${textColor}`}>
                                    {order.so_number ? `SO#${order.so_number}` : 
                                     order.mo_number ? `MO#${order.mo_number}` : 
                                     `#${order.orderNumber}`}
                                  </div>
                                  <div className={`${subTextColor} truncate`}>{order.customer}</div>
                                  <div className={`${progressColor}`}>{order.progress}%</div>
                              </div>
                            );
                          })}
                            {dayOrders.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayOrders.length - 2} more
                        </div>
                            )}
                      </div>
                    </div>
                  );
                })}
                </div>

                  {/* Oil Line 1 */}
                  <div className={`grid gap-2 p-4 hover:bg-gray-50`} style={{ gridTemplateColumns: `200px repeat(${timelineDates.length}, 1fr)` }}>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                      <div>
                        <div className="font-bold text-gray-900">Oil Line 1</div>
                        <div className="text-sm text-gray-500">Lubricant Production</div>
            </div>
                    </div>
                    {timelineDates.map((currentDay, dayIndex) => {
                      
                      const dayOrders = allOrders.filter((order: any) => {
                        const orderStart = new Date(order.startDate);
                        const orderEnd = new Date(order.endDate);
                        
                        // Normalize dates to compare only date parts (ignore time)
                        const currentDayNormalized = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                        const orderStartNormalized = new Date(orderStart.getFullYear(), orderStart.getMonth(), orderStart.getDate());
                        const orderEndNormalized = new Date(orderEnd.getFullYear(), orderEnd.getMonth(), orderEnd.getDate());
                        
                        const isOnDate = currentDayNormalized >= orderStartNormalized && currentDayNormalized <= orderEndNormalized;
                        const isOilLine1 = order.workCenter?.toLowerCase().includes('oil') && 
                                          (order.workCenter?.includes('1') || order.workCenter?.toLowerCase().includes('line 1') || order.workCenter?.toLowerCase().includes('oil1'));
                        const matchesStatus = statusFilter === 'all' || 
                              (order.originalMpsStatus && (
                                order.originalMpsStatus.toString() === statusFilter || 
                                order.originalMpsStatus.toString().toLowerCase() === statusFilter.toLowerCase()
                              )) ||
                              order.status === statusFilter;
                        const matchesWorkCenter = workCenterFilter === 'all' || 
                                                (workCenterFilter === 'oil1' && isOilLine1);
                        
                        return isOilLine1 && isOnDate && matchesStatus && matchesWorkCenter;
                      });
                      
                      return (
                        <div key={dayIndex} className="min-h-20 border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">{currentDay.getDate()}</div>
                          <div className="space-y-1">
                            {dayOrders.slice(0, 2).map((order: any) => (
                              <div key={order.id} className="bg-blue-100 border border-blue-300 rounded px-2 py-1 text-xs">
                                <div className="font-bold text-blue-800">
                                  {order.so_number ? `SO#${order.so_number}` : 
                                   order.mo_number ? `MO#${order.mo_number}` : 
                                   `#${order.orderNumber}`}
                                </div>
                                <div className="text-blue-700 truncate">{order.customer}</div>
                                <div className="text-blue-600">{order.progress}%</div>
                      </div>
                            ))}
                            {dayOrders.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayOrders.length - 2} more
          </div>
        )}
                      </div>
                    </div>
                      );
                    })}
              </div>

                  {/* Grease Line 2 */}
                  <div className={`grid gap-2 p-4 hover:bg-gray-50`} style={{ gridTemplateColumns: `200px repeat(${timelineDates.length}, 1fr)` }}>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-emerald-500 rounded-full mr-3"></div>
                      <div>
                        <div className="font-bold text-gray-900">Grease Line 2</div>
                        <div className="text-sm text-gray-500">Secondary Production</div>
          </div>
                    </div>
                    {timelineDates.map((currentDay, dayIndex) => {
                      
                      const dayOrders = allOrders.filter((order: any) => {
                        const orderStart = new Date(order.startDate);
                        const orderEnd = new Date(order.endDate);
                        
                        // Normalize dates to compare only date parts (ignore time)
                        const currentDayNormalized = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                        const orderStartNormalized = new Date(orderStart.getFullYear(), orderStart.getMonth(), orderStart.getDate());
                        const orderEndNormalized = new Date(orderEnd.getFullYear(), orderEnd.getMonth(), orderEnd.getDate());
                        
                        const isOnDate = currentDayNormalized >= orderStartNormalized && currentDayNormalized <= orderEndNormalized;
                        const isGreaseLine2 = order.workCenter?.toLowerCase().includes('grease') && 
                                             (order.workCenter?.includes('2') || order.workCenter?.toLowerCase().includes('line 2') || order.workCenter?.toLowerCase().includes('grease2'));
                        const matchesStatus = statusFilter === 'all' || 
                              (order.originalMpsStatus && (
                                order.originalMpsStatus.toString() === statusFilter || 
                                order.originalMpsStatus.toString().toLowerCase() === statusFilter.toLowerCase()
                              )) ||
                              order.status === statusFilter;
                        const matchesWorkCenter = workCenterFilter === 'all' || 
                                                (workCenterFilter === 'grease2' && isGreaseLine2);
                        
                        return isGreaseLine2 && isOnDate && matchesStatus && matchesWorkCenter;
                      });
                      
                    return (
                        <div key={dayIndex} className="min-h-20 border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">{currentDay.getDate()}</div>
                          <div className="space-y-1">
                            {dayOrders.slice(0, 2).map((order: any) => (
                              <div key={order.id} className="bg-emerald-100 border border-emerald-300 rounded px-2 py-1 text-xs">
                                <div className="font-bold text-emerald-800">
                                  {order.so_number ? `SO#${order.so_number}` : 
                                   order.mo_number ? `MO#${order.mo_number}` : 
                                   `#${order.orderNumber}`}
                                </div>
                                <div className="text-emerald-700 truncate">{order.customer}</div>
                                <div className="text-emerald-600">{order.progress}%</div>
                      </div>
                  ))}
                            {dayOrders.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayOrders.length - 2} more
                      </div>
                            )}
                      </div>
                    </div>
                      );
                    })}
                </div>

                  {/* Oil Line 2 */}
                  <div className={`grid gap-2 p-4 hover:bg-gray-50`} style={{ gridTemplateColumns: `200px repeat(${timelineDates.length}, 1fr)` }}>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-cyan-500 rounded-full mr-3"></div>
                      <div>
                        <div className="font-bold text-gray-900">Oil Line 2</div>
                        <div className="text-sm text-gray-500">Secondary Lubricant</div>
              </div>
                    </div>
                    {timelineDates.map((currentDay, dayIndex) => {
                      
                      const dayOrders = allOrders.filter((order: any) => {
                        const orderStart = new Date(order.startDate);
                        const orderEnd = new Date(order.endDate);
                        
                        // Normalize dates to compare only date parts (ignore time)
                        const currentDayNormalized = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                        const orderStartNormalized = new Date(orderStart.getFullYear(), orderStart.getMonth(), orderStart.getDate());
                        const orderEndNormalized = new Date(orderEnd.getFullYear(), orderEnd.getMonth(), orderEnd.getDate());
                        
                        const isOnDate = currentDayNormalized >= orderStartNormalized && currentDayNormalized <= orderEndNormalized;
                        const isOilLine2 = order.workCenter?.toLowerCase().includes('oil') && 
                                          (order.workCenter?.includes('2') || order.workCenter?.toLowerCase().includes('line 2') || order.workCenter?.toLowerCase().includes('oil2'));
                        const matchesStatus = statusFilter === 'all' || 
                              (order.originalMpsStatus && (
                                order.originalMpsStatus.toString() === statusFilter || 
                                order.originalMpsStatus.toString().toLowerCase() === statusFilter.toLowerCase()
                              )) ||
                              order.status === statusFilter;
                        const matchesWorkCenter = workCenterFilter === 'all' || 
                                                (workCenterFilter === 'oil2' && isOilLine2);
                        
                        return isOilLine2 && isOnDate && matchesStatus && matchesWorkCenter;
                      });
                      
                    return (
                        <div key={dayIndex} className="min-h-20 border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">{currentDay.getDate()}</div>
                          <div className="space-y-1">
                            {dayOrders.slice(0, 2).map((order: any) => (
                              <div key={order.id} className="bg-cyan-100 border border-cyan-300 rounded px-2 py-1 text-xs">
                                <div className="font-bold text-cyan-800">
                                  {order.so_number ? `SO#${order.so_number}` : 
                                   order.mo_number ? `MO#${order.mo_number}` : 
                                   `#${order.orderNumber}`}
                                </div>
                                <div className="text-cyan-700 truncate">{order.customer}</div>
                                <div className="text-cyan-600">{order.progress}%</div>
                              </div>
                            ))}
                            {dayOrders.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayOrders.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Packaging Line */}
                  <div className={`grid gap-2 p-4 hover:bg-gray-50`} style={{ gridTemplateColumns: `200px repeat(${timelineDates.length}, 1fr)` }}>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-purple-500 rounded-full mr-3"></div>
                      <div>
                        <div className="font-bold text-gray-900">Packaging Line</div>
                        <div className="text-sm text-gray-500">Final Processing</div>
                      </div>
                    </div>
                    {timelineDates.map((currentDay, dayIndex) => {
                      
                      const dayOrders = allOrders.filter((order: any) => {
                        const orderStart = new Date(order.startDate);
                        const orderEnd = new Date(order.endDate);
                        
                        // Normalize dates to compare only date parts (ignore time)
                        const currentDayNormalized = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                        const orderStartNormalized = new Date(orderStart.getFullYear(), orderStart.getMonth(), orderStart.getDate());
                        const orderEndNormalized = new Date(orderEnd.getFullYear(), orderEnd.getMonth(), orderEnd.getDate());
                        
                        const isOnDate = currentDayNormalized >= orderStartNormalized && currentDayNormalized <= orderEndNormalized;
                        const isPackagingLine = order.workCenter?.toLowerCase().includes('packaging') || 
                                               order.workCenter?.toLowerCase().includes('pack');
                        const matchesStatus = statusFilter === 'all' || 
                              (order.originalMpsStatus && (
                                order.originalMpsStatus.toString() === statusFilter || 
                                order.originalMpsStatus.toString().toLowerCase() === statusFilter.toLowerCase()
                              )) ||
                              order.status === statusFilter;
                        const matchesWorkCenter = workCenterFilter === 'all' || 
                                                (workCenterFilter === 'packaging' && isPackagingLine);
                        
                        return isPackagingLine && isOnDate && matchesStatus && matchesWorkCenter;
                      });
                      
                      return (
                        <div key={dayIndex} className="min-h-20 border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">{currentDay.getDate()}</div>
                          <div className="space-y-1">
                            {dayOrders.slice(0, 2).map((order: any) => (
                              <div key={order.id} className="bg-purple-100 border border-purple-300 rounded px-2 py-1 text-xs">
                                <div className="font-bold text-purple-800">
                                  {order.so_number ? `SO#${order.so_number}` : 
                                   order.mo_number ? `MO#${order.mo_number}` : 
                                   `#${order.orderNumber}`}
                                </div>
                                <div className="text-purple-700 truncate">{order.customer}</div>
                                <div className="text-purple-600">{order.progress}%</div>
                              </div>
                            ))}
                            {dayOrders.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayOrders.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Weekly Summary */}
              <div className="mt-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Weekly Production Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {allOrders.filter((o: any) => o.status === 'completed').length}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {allOrders.filter((o: any) => o.status === 'in-progress').length}
                    </div>
                    <div className="text-sm text-gray-600">In Progress</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {allOrders.filter((o: any) => o.status === 'scheduled').length}
                    </div>
                    <div className="text-sm text-gray-600">Scheduled</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {allOrders.filter((o: any) => o.status === 'delayed').length}
                    </div>
                    <div className="text-sm text-gray-600">Delayed</div>
                  </div>
                </div>
              </div>
            </div>
        </div>
        )}

        {/* Gantt Chart View */}
        {viewMode === 'gantt' && (
          <div className="h-full flex flex-col">
            {/* Work Centers Header */}
            <div className="bg-gradient-to-r from-green-50 to-teal-50 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg">
                    <Factory className="w-6 h-6 text-white" />
                          </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Work Centers Dashboard</h3>
                    <p className="text-sm text-gray-600">Production Capacity & Real-time Status</p>
                      </div>
                      </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{workCenters.length}</div>
                    <div className="text-gray-600">Active Centers</div>
                      </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">
                      {workCenters.reduce((acc: number, wc: any) => acc + wc.operators, 0)}
                    </div>
                    <div className="text-gray-600">Total Operators</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(workCenters.reduce((acc: number, wc: any) => acc + wc.utilization, 0) / workCenters.length)}%
                    </div>
                    <div className="text-gray-600">Avg Utilization</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Work Centers Grid */}
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {workCenters.map((workCenter) => {
                  const workCenterOrders = allOrders.filter((order: any) => order.workCenter === workCenter.id);
                  const activeOrders = workCenterOrders.filter((order: any) => order.status === 'in-progress');
                  const completedOrders = workCenterOrders.filter((order: any) => order.status === 'completed');

                  return (
                    <div key={workCenter.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                      {/* Work Center Header */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                              <Factory className="w-6 h-6 text-white" />
                          </div>
                            <div>
                              <h4 className="text-xl font-bold text-gray-900">{workCenter.name}</h4>
                              <p className="text-sm text-gray-600">Production Center</p>
                          </div>
                    </div>
                          <div className={`w-4 h-4 rounded-full ${
                            workCenter.utilization > 80 ? 'bg-red-500' :
                            workCenter.utilization > 60 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}></div>
                  </div>
                                </div>

                      {/* Work Center Content */}
                      <div className="p-6 space-y-6">
                        {/* Utilization & Efficiency */}
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-gray-700">Utilization</span>
                              <span className="text-lg font-bold text-gray-900">{workCenter.utilization.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  workCenter.utilization > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                  workCenter.utilization > 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                  'bg-gradient-to-r from-green-500 to-green-600'
                                }`}
                                style={{ width: `${workCenter.utilization}%` }}
                              ></div>
                                    </div>
                                  </div>
                          
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-gray-700">Efficiency</span>
                              <span className="text-lg font-bold text-gray-900">{workCenter.efficiency}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                              <div 
                                className="bg-gradient-to-r from-teal-500 to-teal-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${workCenter.efficiency}%` }}
                              ></div>
                              </div>
                              </div>
                            </div>
                            
                        {/* Order Statistics */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{workCenterOrders.length}</div>
                            <div className="text-xs text-gray-600">Total Orders</div>
                                  </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{activeOrders.length}</div>
                            <div className="text-xs text-gray-600">Active</div>
                                  </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">{completedOrders.length}</div>
                            <div className="text-xs text-gray-600">Completed</div>
                                </div>
                              </div>
                        
                        {/* Recent Orders */}
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-3">Recent Orders</div>
                          <div className="space-y-2">
                            {workCenterOrders.slice(0, 3).map((order: any) => (
                              <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${
                                    order.status === 'completed' ? 'bg-green-500' :
                                    order.status === 'in-progress' ? 'bg-yellow-500' :
                                    order.status === 'delayed' ? 'bg-red-500' :
                                    'bg-blue-500'
                              }`}></div>
                                  <span className="text-sm font-medium text-gray-900">#{order.orderNumber}</span>
                            </div>
                                <div className="text-xs text-gray-600">{order.progress}%</div>
                              </div>
                            ))}
                            {workCenterOrders.length === 0 && (
                              <div className="text-sm text-gray-500 text-center py-4">No orders assigned</div>
                            )}
                          </div>
                        </div>
                          </div>
                        </div>
                      );
                })}
                </div>
            </div>
          </div>
        )}

        {/* Gantt Chart View */}
        {viewMode === 'gantt' && (
          <div className="h-full flex flex-col">
            {/* Enhanced Gantt Header */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg">
                    <GanttChart className="w-6 h-6 text-white" />
          </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">MPS Production Gantt Chart</h3>
                    <p className="text-sm text-gray-600">Work Center Resource Planning & Scheduling</p>
                      </div>
                      </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{allOrders.length}</div>
                    <div className="text-gray-600">Total Orders</div>
                      </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-600">{workCenters.length}</div>
                    <div className="text-gray-600">Work Centers</div>
                    </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(workCenters.reduce((acc: number, wc: any) => acc + wc.utilization, 0) / workCenters.length)}%
                    </div>
                    <div className="text-gray-600">Avg Utilization</div>
                  </div>
                </div>
                </div>
              </div>

            {/* Gantt Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-4">
                {workCenters.map((workCenter) => {
                  const workCenterOrders = allOrders.filter((order: any) => 
                    order.workCenter === workCenter.id &&
                  (statusFilter === 'all' || 
                    (order.originalMpsStatus && order.originalMpsStatus.toString().toLowerCase() === statusFilter.toLowerCase()) ||
                    order.status === statusFilter) &&
                    (workCenterFilter === 'all' || workCenter.id === workCenterFilter) &&
                  (searchTerm === '' || 
                    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    order.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    order.customer?.toLowerCase().includes(searchTerm.toLowerCase()))
                  );
                  
                  return (
                    <div key={workCenter.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      {/* Enhanced Work Center Header */}
                      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                              <Factory className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-gray-900">{workCenter.name}</h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span className="flex items-center space-x-1">
                                  <Package className="w-4 h-4" />
                                  <span>{workCenterOrders.length} orders</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <Users className="w-4 h-4" />
                                  <span>{workCenter.operators} operators</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                    <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">{workCenter.utilization.toFixed(1)}%</div>
                              <div className="text-xs text-gray-600">Utilization</div>
                    </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">{workCenter.efficiency}%</div>
                              <div className="text-xs text-gray-600">Efficiency</div>
                  </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-purple-600">{workCenter.currentOrders.length}</div>
                              <div className="text-xs text-gray-600">Active</div>
                            </div>
                          </div>
                        </div>
                      </div>
                  
                      {/* Orders Timeline */}
                      <div className="p-4">
                        <div className="space-y-2">
                          {workCenterOrders.map((order: any) => {
                            const duration = Math.ceil((order.endDate.getTime() - order.startDate.getTime()) / (1000 * 60 * 60 * 24));
                            const daysFromStart = Math.ceil((new Date().getTime() - order.startDate.getTime()) / (1000 * 60 * 60 * 24));
                            const progressWidth = Math.min(100, Math.max(0, (daysFromStart / duration) * 100));

                            return (
                              <div key={order.id} className="flex items-center space-x-4 py-3 hover:bg-gray-50 rounded-lg transition-all duration-200 border-l-4 border-transparent hover:border-blue-400">
                                {/* Order Info */}
                                <div className="w-56 flex-shrink-0">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <div className="font-bold text-gray-900">
                                      {order.so_number ? `SO#${order.so_number}` : 
                                       order.mo_number ? `MO#${order.mo_number}` : 
                                       `#${order.orderNumber}`}
                                    </div>
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                      {order.status}
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {order.so_number ? `Sales Order` : 
                                     order.mo_number ? `Manufacturing Order` : 
                                     `MPS Order`}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">{order.customer}</div>
                                </div>

                                {/* Enhanced Progress Bar */}
                                <div className="flex-1 relative">
                                  <div className="h-10 bg-gray-200 rounded-lg relative overflow-hidden shadow-inner">
                                    <div 
                                      className={`h-full ${order.color} rounded-lg transition-all duration-500 flex items-center justify-between px-4 text-white text-sm font-medium shadow-lg`}
                                      style={{ width: `${Math.min(100, progressWidth)}%` }}
                                    >
                                      <span>{order.description?.slice(0, 15) || 'Production Item'}</span>
                                      <span className="font-bold">{order.progress}%</span>
                              </div>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                                    <span className="flex items-center space-x-1">
                                      <Calendar className="w-3 h-3" />
                                      <span>{order.startDate.toLocaleDateString()}</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <Clock className="w-3 h-3" />
                                      <span>{order.endDate.toLocaleDateString()}</span>
                                    </span>
                              </div>
                            </div>
                            
                                {/* Enhanced Status & Metrics */}
                                <div className="w-40 flex-shrink-0 text-right">
                                  <div className="space-y-2">
                                    <div className="text-sm font-semibold text-gray-900">
                                      {order.quantity} {order.unit}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {order.workCenter}
                                    </div>
                                    <div className="flex items-center justify-end space-x-1">
                              <div className={`w-2 h-2 rounded-full ${
                                        order.status === 'completed' ? 'bg-green-500' :
                                        order.status === 'in-progress' ? 'bg-yellow-500' :
                                        order.status === 'delayed' ? 'bg-red-500' :
                                        'bg-blue-500'
                              }`}></div>
                                      <span className="text-xs text-gray-500">
                                        {order.priority}
                                      </span>
                                    </div>
                            </div>
                          </div>
                        </div>
                      );
                          })}
                    </div>
                  </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
        )}


        {/* Resources View */}
        {viewMode === 'resources' && (
          <div className="h-full flex flex-col">
            <div className="bg-gradient-to-r from-green-50 to-teal-50 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">MPS Resource Management</h3>
                    <p className="text-sm text-gray-600">Production Capacity & Resource Management</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{workCenters.length}</div>
                    <div className="text-gray-600">Work Centers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">
                      {workCenters.reduce((acc: number, wc: any) => acc + wc.operators, 0)}
                    </div>
                    <div className="text-gray-600">Total Operators</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(workCenters.reduce((acc: number, wc: any) => acc + wc.utilization, 0) / workCenters.length)}%
                    </div>
                    <div className="text-gray-600">Avg Utilization</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workCenters.map((workCenter) => (
                  <div key={workCenter.id} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                          <Factory className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{workCenter.name}</h4>
                          <p className="text-sm text-gray-600">Production Center</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full ${
                        workCenter.utilization > 80 ? 'bg-red-500' :
                        workCenter.utilization > 60 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}></div>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Utilization</span>
                          <span className="text-lg font-bold text-gray-900">{workCenter.utilization.toFixed(1)}%</span>
                      </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 ${
                              workCenter.utilization > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                              workCenter.utilization > 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                              'bg-gradient-to-r from-green-500 to-green-600'
                            }`}
                          style={{ width: `${workCenter.utilization}%` }}
                        ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Efficiency</span>
                          <span className="text-lg font-bold text-gray-900">{workCenter.efficiency}%</span>
                      </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                        <div 
                            className="bg-gradient-to-r from-teal-500 to-teal-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${workCenter.efficiency}%` }}
                        ></div>
                        </div>
                      </div>
                      
                      {/* Enhanced Stats */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{workCenter.operators}</div>
                          <div className="text-sm text-gray-600">Operators</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{workCenter.currentOrders.length}</div>
                          <div className="text-sm text-gray-600">Active Orders</div>
                        </div>
                      </div>
                      
                      {/* Equipment */}
                      <div className="pt-4 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-2">Equipment</div>
                        <div className="flex flex-wrap gap-2">
                          {workCenter.equipment.map((equipment: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                              {equipment}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Legend */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Delayed</span>
          </div>
          <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-500 rounded"></div>
              <span>On Hold</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Showing {allOrders.length} MPS orders across {workCenters.length} work centers
          </div>
        </div>
        
        {/* MPS Status Legend */}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              <div className="flex items-center space-x-1">
                <span className="font-semibold">MPS Status Legend:</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-blue-600">MO: X</span>
                <span className="text-gray-500">= Manufacturing Orders</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-blue-600">SO: X</span>
                <span className="text-gray-500">= Sales Orders</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-yellow-600">●X</span>
                <span className="text-gray-500">= Released to production</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-green-600">●X</span>
                <span className="text-gray-500">= Completed</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-red-600">●X</span>
                <span className="text-gray-500">= Shortage</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-indigo-600">●X</span>
                <span className="text-gray-500">= In queue</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};