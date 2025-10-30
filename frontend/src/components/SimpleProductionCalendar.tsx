import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Factory, Calendar, Package } from 'lucide-react';

interface SimpleOrder {
  id: string;
  orderNumber: string;
  customer: string;
  product: string;
  status: string;
  workCenter: string;
  startDate: string;
  endDate: string;
  quantity: number;
}

interface SimpleProductionCalendarProps {
  onBack: () => void;
  data?: any;
}

export const SimpleProductionCalendar: React.FC<SimpleProductionCalendarProps> = ({ onBack, data }) => {
  const [orders, setOrders] = useState<SimpleOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');

  // Process preloaded MPS data
  useEffect(() => {
    const processMPSData = () => {
      try {
        console.log('🔄 Processing preloaded MPS data...');
        
        // Get MPS data from the main data object
        const mpsData = data?.['MPS.json'] || {};
        console.log('📊 Preloaded MPS Data:', mpsData);
        console.log('📊 MPS Orders Count:', mpsData.mps_orders?.length || 0);
        console.log('📊 Sample MPS Order:', mpsData.mps_orders?.[0]);
        
        // Debug: Check the actual structure of MPS data
        if (mpsData.mps_orders && Array.isArray(mpsData.mps_orders)) {
          console.log('🔍 First 3 MPS orders - ALL FIELDS:');
          mpsData.mps_orders.slice(0, 3).forEach((order, idx) => {
            console.log(`Order ${idx + 1} - Complete structure:`, order);
            console.log(`Order ${idx + 1} - Available fields:`, Object.keys(order));
          });
          
          console.log('🔍 Looking for Sales Order fields:');
          const sampleOrder = mpsData.mps_orders[0];
          console.log('SO fields found:', {
            'so_number': sampleOrder.so_number,
            'SO': sampleOrder.SO,
            'SO#': sampleOrder['SO#'],
            'sales_order': sampleOrder.sales_order,
            'Sales Order': sampleOrder['Sales Order']
          });
          
          console.log('🔍 Looking for Customer fields:');
          console.log('Customer fields found:', {
            'customer': sampleOrder.customer,
            'company': sampleOrder.company,
            'Company': sampleOrder.Company,
            'customer_name': sampleOrder.customer_name
          });
        }
        
        if (mpsData.mps_orders && Array.isArray(mpsData.mps_orders)) {
          // Convert MPS data to simple format
          const simpleOrders: SimpleOrder[] = mpsData.mps_orders.map((order: any, index: number) => {
            // Parse dates - handle the MPS date format
            let startDate = new Date();
            let endDate = new Date();
            
            try {
              if (order.start_date) {
                // Handle format like "Mon, Nov 10"
                if (order.start_date.includes(',')) {
                  const parts = order.start_date.split(',');
                  if (parts.length === 2) {
                    const monthDay = parts[1].trim();
                    const currentYear = new Date().getFullYear();
                    startDate = new Date(`${monthDay} ${currentYear}`);
                  }
                } else {
                  startDate = new Date(order.start_date);
                }
              }
              
              if (order.end_date) {
                if (order.end_date.includes(',')) {
                  const parts = order.end_date.split(',');
                  if (parts.length === 2) {
                    const monthDay = parts[1].trim();
                    const currentYear = new Date().getFullYear();
                    endDate = new Date(`${monthDay} ${currentYear}`);
                  }
                } else {
                  endDate = new Date(order.end_date);
                }
              }
            } catch (e) {
              console.log('Date parsing error for order:', order.order_number, e);
              // Use fallback dates
              startDate = new Date();
              startDate.setDate(startDate.getDate() + index);
              endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + 1);
            }
            
            // Distribute orders evenly across all production lines
            const lines = ['Grease Line 1', 'Oil Line 1', 'Grease Line 2', 'Oil Line 2', 'Packaging Line'];
            let workCenter = lines[index % lines.length];
            
            // Only override if product clearly indicates a specific line
            if (order.product) {
              const product = order.product.toLowerCase();
              console.log(`Order ${order.so_number}: Product="${product}"`);
              
              if (product.includes('grease') || product.includes('lubricant')) {
                workCenter = 'Grease Line 1';
              } else if (product.includes('oil') || product.includes('fluid')) {
                workCenter = 'Oil Line 1';
              } else if (product.includes('packaging') || product.includes('container')) {
                workCenter = 'Packaging Line';
              }
              // Otherwise keep the distributed assignment
            }
            
            console.log(`Order ${order.so_number}: Assigned to ${workCenter}`);
            
            // Determine status
            let status = 'scheduled';
            const mpsStatus = (order.status || '').toString().toLowerCase();
            if (mpsStatus === 'b' || mpsStatus === 'in-progress') {
              status = 'in-progress';
            } else if (mpsStatus === 'c' || mpsStatus === 'completed') {
              status = 'completed';
            } else if (mpsStatus === 'h' || mpsStatus === 'hold') {
              status = 'on-hold';
            }
            
            return {
              id: `order-${index}`,
              orderNumber: order.so_number || order.SO || order['SO#'] || order.order_number || `Order ${index + 1}`,
              customer: order.customer || order.company || order['Company'] || 'Unknown Customer',
              product: order.product || 'Production Item',
              status: status,
              workCenter: workCenter,
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              quantity: parseInt(order.required || order.quantity || '1') || 1
            };
          });
          
          console.log('✅ Processed orders:', simpleOrders.length);
          console.log('📊 Sample orders:', simpleOrders.slice(0, 3));
          console.log('📊 All work centers:', [...new Set(simpleOrders.map(o => o.workCenter))]);
          console.log('📊 All start dates:', [...new Set(simpleOrders.map(o => o.startDate))]);
          
          // Debug: Check work center distribution
          const workCenterCounts = simpleOrders.reduce((acc, order) => {
            acc[order.workCenter] = (acc[order.workCenter] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log('📊 Work Center Distribution:', workCenterCounts);
          
          // Debug: Check date distribution
          const dateCounts = simpleOrders.reduce((acc, order) => {
            acc[order.startDate] = (acc[order.startDate] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log('📊 Date Distribution:', dateCounts);
          
          setOrders(simpleOrders);
        } else {
          console.log('⚠️ No mps_orders found in preloaded data');
          setOrders([]);
        }
      } catch (err) {
        console.error('❌ Error processing MPS data:', err);
        setError(err instanceof Error ? err.message : 'Failed to process MPS data');
      }
    };

    if (data) {
      processMPSData();
    }
  }, [data]);

  // Get current week dates
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
    start.setDate(diff);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentWeek);
  
  // Debug: Log week dates
  console.log('📅 Current week dates:', weekDates.map(d => d.toISOString().split('T')[0]));
  
  // Filter orders by status
  const filteredOrders = orders.filter(order => 
    statusFilter === 'all' || order.status === statusFilter
  );

  // Get orders for a specific day and work center
  const getOrdersForDay = (date: Date, workCenter: string) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOrders = filteredOrders.filter(order => 
      order.workCenter === workCenter &&
      order.startDate <= dateStr &&
      order.endDate >= dateStr
    );
    
    // Debug logging
    if (workCenter === 'Grease Line 1' && date.getDay() === 1) { // Monday
      console.log(`🔍 Debug for ${workCenter} on ${dateStr}:`);
      console.log('  - Total filtered orders:', filteredOrders.length);
      console.log('  - Orders for this work center:', filteredOrders.filter(o => o.workCenter === workCenter).length);
      console.log('  - Orders for this day:', dayOrders.length);
      console.log('  - Sample orders:', filteredOrders.slice(0, 3).map(o => ({
        orderNumber: o.orderNumber,
        workCenter: o.workCenter,
        startDate: o.startDate,
        endDate: o.endDate
      })));
    }
    
    return dayOrders;
  };

  const workCenters = [
    { name: 'Grease Line 1', color: 'bg-green-100 border-green-300 text-green-800' },
    { name: 'Oil Line 1', color: 'bg-blue-100 border-blue-300 text-blue-800' },
    { name: 'Grease Line 2', color: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
    { name: 'Oil Line 2', color: 'bg-cyan-100 border-cyan-300 text-cyan-800' },
    { name: 'Packaging Line', color: 'bg-purple-100 border-purple-300 text-purple-800' }
  ];

  const statusCounts = {
    all: orders.length,
    'in-progress': orders.filter(o => o.status === 'in-progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
    delayed: orders.filter(o => o.status === 'delayed').length
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading production data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <Factory className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Production Calendar</h1>
                  <p className="text-gray-600">Week of {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{statusCounts.all}</div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Show:</span>
            {[
              { key: 'all', label: `All (${statusCounts.all})` },
              { key: 'in-progress', label: `In Progress (${statusCounts['in-progress']})` },
              { key: 'completed', label: `Completed (${statusCounts.completed})` },
              { key: 'delayed', label: `Delayed (${statusCounts.delayed})` }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentWeek(prev => {
                const newWeek = new Date(prev);
                newWeek.setDate(prev.getDate() - 7);
                return newWeek;
              })}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentWeek(prev => {
                const newWeek = new Date(prev);
                newWeek.setDate(prev.getDate() + 7);
                return newWeek;
              })}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-8 gap-0">
            <div className="p-4 bg-gray-50 border-r border-b">
              <div className="font-semibold text-gray-900">Production Lines</div>
            </div>
            {weekDates.map((date, index) => (
              <div key={index} className="p-4 bg-gray-50 border-b text-center">
                <div className="font-semibold text-gray-900">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-sm text-gray-600">{date.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Production Lines */}
          {workCenters.map((workCenter) => (
            <div key={workCenter.name} className="grid grid-cols-8 gap-0">
              <div className="p-4 border-r border-b bg-gray-50">
                <div className="font-medium text-gray-900">{workCenter.name}</div>
              </div>
              {weekDates.map((date, dayIndex) => {
                const dayOrders = getOrdersForDay(date, workCenter.name);
                return (
                  <div key={dayIndex} className="p-2 border-r border-b min-h-24">
                    <div className="space-y-1">
                      {dayOrders.slice(0, 3).map((order) => (
                        <div
                          key={order.id}
                          className={`p-2 rounded text-xs ${workCenter.color} border hover:shadow-sm transition-shadow`}
                        >
                          <div className="font-semibold">SO#{order.orderNumber}</div>
                          <div className="truncate font-medium">{order.customer}</div>
                          <div className="text-xs opacity-75">{order.quantity} units</div>
                        </div>
                      ))}
                      {dayOrders.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayOrders.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Production Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{statusCounts.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{statusCounts['in-progress']}</div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.all - statusCounts.completed - statusCounts['in-progress']}</div>
              <div className="text-sm text-gray-600">Scheduled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{statusCounts.delayed}</div>
              <div className="text-sm text-gray-600">Delayed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
