import React, { useState, useMemo } from 'react';
import { parseStockValue, parseCostValue, formatCAD } from '../utils/unifiedDataAccess';
import { DetailedViewModal } from './DetailedViewModal';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Grid, 
  List, 
  Eye, 
  Edit, 
  Trash2,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Factory,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Star,
  ArrowRight
} from 'lucide-react';

interface RevolutionaryDataDisplayProps {
  data: any[];
  type: 'inventory' | 'sales-orders' | 'customers' | 'vendors' | 'work-orders';
  title: string;
  onItemClick?: (item: any) => void;
  onItemEdit?: (item: any) => void;
  onItemDelete?: (item: any) => void;
  fullData?: any; // Full dataset for modal cross-referencing
}

interface DataCard {
  id: string;
  title: string;
  subtitle: string;
  status: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  primaryMetric: { label: string; value: string; trend?: 'up' | 'down' };
  secondaryMetrics: { label: string; value: string }[];
  tags: string[];
  lastUpdated: string;
  actions: string[];
}

// Status color mapping
const statusColors = {
  success: 'from-green-500 to-emerald-600',
  warning: 'from-yellow-500 to-orange-600', 
  danger: 'from-red-500 to-pink-600',
  info: 'from-blue-500 to-indigo-600',
  neutral: 'from-slate-500 to-gray-600'
};

const statusBadgeColors = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200'
};

// Helper function to format dates consistently
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Not set';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// Transform raw data into beautiful cards using EXACT field names from utils
const transformDataToCards = (data: any[], type: string): DataCard[] => {
  return data.map((item, index) => {
    switch (type) {
      case 'inventory':
        // Use EXACT field names from CustomAlert5.json (SMART_PRIMARY_SOURCES.ITEMS)
        const stock = parseStockValue(item["Stock"]);
        const reorderLevel = parseStockValue(item["Reorder Level"]) || parseStockValue(item["Minimum"]);
        const recentCost = parseCostValue(item["Recent Cost"]);
        const standardCost = parseCostValue(item["Standard Cost"]);
        const unitCost = parseCostValue(item["Unit Cost"]);
        const cost = recentCost || standardCost || unitCost || 0;
        const value = stock * cost;
        const onOrder = parseStockValue(item["On Order"]);
        const reserved = parseStockValue(item["Reserve"]);
        const wip = parseStockValue(item["WIP"]);
        const maximum = parseStockValue(item["Maximum"]);
        const reorderQuantity = parseStockValue(item["Reorder Quantity"]);
        
        let status: DataCard['status'] = 'neutral';
        if (stock <= 0) status = 'danger';
        else if (stock <= reorderLevel && reorderLevel > 0) status = 'warning';
        else if (stock > reorderLevel * 2) status = 'success';
        else status = 'info';

        return {
          id: item["Item No."] || `item-${index}`,
          title: item["Item No."] || '',
          subtitle: item["Description"] || '',
          status,
          primaryMetric: { 
            label: 'Current Stock', 
            value: stock.toLocaleString(),
            trend: stock > reorderLevel ? 'up' : 'down'
          },
          secondaryMetrics: [
            { label: 'Recent Cost', value: formatCAD(cost) },
            { label: 'Total Value', value: formatCAD(value) },
            { label: 'Reorder Level', value: reorderLevel.toLocaleString() },
            { label: 'On Order', value: onOrder.toLocaleString() },
            { label: 'Reserved', value: reserved.toLocaleString() },
            { label: 'Last Used', value: item["Last Used Date"] || 'Never' }
          ],
          tags: [
            item["Item Type"] || '',
            stock <= 0 ? 'Out of Stock' : stock <= reorderLevel && reorderLevel > 0 ? 'Low Stock' : 'In Stock',
            item["Status"] || '',
            onOrder > 0 ? 'On Order' : '',
            item["Serial/Lot Track Type"] || ''
          ].filter(Boolean),
          lastUpdated: item["Last Used Date"] || 'No recent activity',
          actions: ['view', 'edit', 'reorder']
        };

      case 'sales-orders':
        const orderValue = parseFloat(item["Order Value"] || item["Total Amount"] || 0);
        const orderStatus = item.Status || 'Unknown';
        
        let soStatus: DataCard['status'] = 'neutral';
        if (orderStatus.toLowerCase().includes('completed')) soStatus = 'success';
        else if (orderStatus.toLowerCase().includes('pending')) soStatus = 'warning';
        else if (orderStatus.toLowerCase().includes('cancelled')) soStatus = 'danger';
        else soStatus = 'info';

        return {
          id: item["Order No."] || `so-${index}`,
          title: `SO-${item["Order No."] || index}`,
          subtitle: item["Customer Name"] || 'Unknown Customer',
          status: soStatus,
          primaryMetric: { 
            label: 'Order Value', 
            value: `$${orderValue.toLocaleString()}`,
            trend: orderValue > 10000 ? 'up' : 'down'
          },
          secondaryMetrics: [
            { label: 'Status', value: orderStatus },
            { label: 'Order Date', value: item["Order Date"] || 'N/A' },
            { label: 'Due Date', value: item["Due Date"] || 'N/A' }
          ],
          tags: [
            orderStatus,
            orderValue > 50000 ? 'Large Order' : orderValue > 10000 ? 'Medium Order' : 'Small Order'
          ],
          lastUpdated: item["Order Date"] || 'Unknown',
          actions: ['view', 'edit', 'fulfill']
        };

      case 'customers':
        // Use REAL customer data from ManufacturingOrderHeaders.json (actual customers!)
        const realCustomerName = item["Customer Name"] || '';
        const totalMOs = parseInt(item["Total MOs"] || 0);
        const customerTotalValue = parseFloat(item["Total Value"] || 0);
        const activeMOs = parseInt(item["Active MOs"] || 0);
        const salesOrders = parseInt(item["Sales Orders"] || 0);
        const buildItems = parseInt(item["Build Items"] || 0);
        const lastMODate = item["Last MO Date"] || '';
        
        let custStatus: DataCard['status'] = 'neutral';
        if (customerTotalValue > 100000) custStatus = 'success';
        else if (customerTotalValue > 25000) custStatus = 'info';
        else if (activeMOs === 0) custStatus = 'warning';
        else custStatus = 'neutral';

        return {
          id: realCustomerName || `cust-${index}`,
          title: realCustomerName || '',
          subtitle: `${totalMOs} Manufacturing Orders • ${salesOrders} Sales Orders`,
          status: custStatus,
          primaryMetric: { 
            label: 'Total MO Value', 
            value: formatCAD(customerTotalValue),
            trend: activeMOs > 0 ? 'up' : 'down'
          },
          secondaryMetrics: [
            { label: 'Total MOs', value: totalMOs.toLocaleString() },
            { label: 'Active MOs', value: activeMOs.toString() },
            { label: 'Sales Orders', value: salesOrders.toString() },
            { label: 'Build Items', value: buildItems.toString() },
            { label: 'Last MO Date', value: formatDate(lastMODate) },
            { label: 'Customer Type', value: salesOrders > 0 ? 'External Customer' : 'Internal Customer' }
          ],
          tags: [
            customerTotalValue > 100000 ? 'VIP Customer' : customerTotalValue > 25000 ? 'Regular Customer' : 'Small Customer',
            activeMOs > 0 ? 'Active Manufacturing' : 'No Active MOs',
            salesOrders > 0 ? 'Has Sales Orders' : 'MO Only',
            buildItems > 5 ? 'Multi-Product Customer' : 'Single Product'
          ].filter(Boolean),
          lastUpdated: formatDate(lastMODate),
          actions: ['view', 'mos', 'sales', 'history']
        };

      case 'vendors':
        // Use REAL supplier data from smart aggregation
        const supplierName = item["Supplier Name"] || '';
        const supplierNo = item["Supplier No."] || '';
        const totalPOs = parseInt(item["Total POs"] || 0);
        const activePOs = parseInt(item["Active POs"] || 0);
        const vendorTotalValue = parseFloat(item["Total Value"] || 0);
        const vendorContact = item["Contact"] || '';
        const vendorPhone = item["Phone"] || '';
        const vendorEmail = item["Email"] || '';
        const vendorAddress = item["Address"] || '';
        const lastPODate = item["Last PO Date"] || 'No recent orders';
        
        let vendorStatus: DataCard['status'] = 'neutral';
        if (activePOs > 3) vendorStatus = 'success';
        else if (activePOs > 1) vendorStatus = 'info';
        else if (activePOs === 0 && totalPOs > 0) vendorStatus = 'warning';
        else vendorStatus = 'neutral';

        return {
          id: supplierNo || supplierName || `vendor-${index}`,
          title: supplierName || '',
          subtitle: `${supplierNo} • ${vendorContact}`,
          status: vendorStatus,
          primaryMetric: { 
            label: 'Total PO Value', 
            value: formatCAD(vendorTotalValue),
            trend: activePOs > 1 ? 'up' : 'down'
          },
          secondaryMetrics: [
            { label: 'Active POs', value: activePOs.toString() },
            { label: 'Total POs', value: totalPOs.toString() },
            { label: 'Phone', value: vendorPhone || 'No phone' },
            { label: 'Email', value: vendorEmail || 'No email' },
            { label: 'Last PO', value: lastPODate },
            { label: 'Location', value: vendorAddress || 'No address' }
          ],
          tags: [
            activePOs > 3 ? 'High Volume Supplier' : activePOs > 1 ? 'Regular Supplier' : activePOs > 0 ? 'Active' : 'Inactive',
            vendorTotalValue > 100000 ? 'Major Supplier' : vendorTotalValue > 25000 ? 'Standard Supplier' : 'Small Supplier',
            item["Country"] || 'Unknown Location'
          ].filter(Boolean),
          lastUpdated: lastPODate,
          actions: ['view', 'contact', 'orders', 'performance']
        };

      case 'work-orders':
        // Use EXACT field names from WorkOrderDetails.json
        const wodStatus = item["Status"] || 'Unknown';
        const woCustomer = item["Customer"] || 'Internal Order';
        const woOrdered = parseFloat(item["Ordered"] || 0);
        const woCompleted = parseFloat(item["Completed"] || 0);
        const woAllocated = parseFloat(item["Allocated"] || 0);
        const woReserved = parseFloat(item["Reserved"] || 0);
        
        // Real dates from WorkOrderDetails.json - EXACT field names
        const currentStartDate = item["Current Start Date"] || '';
        const currentCompletionDate = item["Current Completion Date"] || '';
        const initialStartDate = item["Initial Start Date"] || '';
        const initialCompletionDate = item["Initial Completion Date"] || '';
        const salesOrderShipDate = item["Sales Order Ship Date"] || '';
        
        let woCardStatus: DataCard['status'] = 'neutral';
        if (woCompleted >= woOrdered && woOrdered > 0) woCardStatus = 'success';
        else if (woAllocated > 0 || woCompleted > 0) woCardStatus = 'info';
        else if (woOrdered > 0 && woAllocated === 0) woCardStatus = 'warning';
        else woCardStatus = 'neutral';

        const completionPercentage = woOrdered > 0 ? Math.round((woCompleted / woOrdered) * 100) : 0;

        return {
          id: item["Work Order No."] || `wo-${index}`,
          title: `WO-${item["Work Order No."] || index}`,
          subtitle: `${item["Item No."] || 'Unknown Item'} - ${woCustomer}`,
          status: woCardStatus,
          primaryMetric: { 
            label: 'Completion', 
            value: `${completionPercentage}%`,
            trend: completionPercentage > 50 ? 'up' : 'down'
          },
          secondaryMetrics: [
            { label: 'Work Tracker', value: woCustomer || 'Internal' },
            { label: 'Ordered Qty', value: woOrdered.toLocaleString() },
            { label: 'Completed', value: woCompleted.toLocaleString() },
            { label: 'Start Date', value: formatDate(currentStartDate) },
            { label: 'Due Date', value: formatDate(currentCompletionDate) },
            { label: 'Sales Order', value: item["Sales Order No."] || 'Internal WO' }
          ],
          tags: [
            wodStatus,
            woCustomer !== 'Internal Order' ? 'External Work' : 'Internal',
            completionPercentage === 100 ? 'Complete' : completionPercentage > 0 ? 'In Progress' : 'Not Started',
            item["Manufacturing Order No."] ? 'Linked to MO' : ''
          ].filter(Boolean),
          lastUpdated: formatDate(currentStartDate) || formatDate(initialStartDate) || 'No start date',
          actions: ['view', 'edit', 'allocate', 'complete']
        };

      default:
        return {
          id: `item-${index}`,
          title: 'Unknown Item',
          subtitle: 'No data available',
          status: 'neutral' as const,
          primaryMetric: { label: 'Value', value: '0' },
          secondaryMetrics: [],
          tags: [],
          lastUpdated: 'Unknown',
          actions: ['view']
        };
    }
  });
};

export const RevolutionaryDataDisplay: React.FC<RevolutionaryDataDisplayProps> = ({
  data,
  type,
  title,
  onItemClick,
  onItemEdit,
  onItemDelete,
  fullData
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // Transform data to cards
  const cards = useMemo(() => transformDataToCards(data, type), [data, type]);

  // Filter and search
  const filteredCards = useMemo(() => {
    let filtered = cards;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(card => 
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(card => card.status === selectedFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortBy as keyof DataCard];
      let bValue = b[sortBy as keyof DataCard];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });

    return filtered;
  }, [cards, searchQuery, selectedFilter, sortBy, sortOrder]);

  // Get unique statuses for filter
  const availableStatuses = useMemo(() => {
    const statuses = [...new Set(cards.map(card => card.status))];
    return statuses;
  }, [cards]);

  // Handle item click to open detailed modal
  const handleItemClick = (card: any) => {
    setSelectedItem(card);
    setShowModal(true);
    if (onItemClick) onItemClick(card);
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Controls */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-600 font-medium">{filteredCards.length} of {cards.length} items</p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          
          {/* Search */}
          <div className="relative flex-1 min-w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${type.replace('-', ' ')}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-4 py-3 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="all">All Status</option>
            {availableStatuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>

          {/* Sort */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-2 px-4 py-3 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl hover:bg-white transition-all"
          >
            {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
            Sort
          </button>
        </div>
      </div>

      {/* Data Display */}
      <div className={`grid gap-6 ${
        viewMode === 'grid' 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
          : 'grid-cols-1'
      }`}>
        {filteredCards.map((card) => (
          <div
            key={card.id}
            className="group bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleItemClick(card)}
          >
            
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 truncate">{card.title}</h3>
                <p className="text-sm text-slate-600 truncate">{card.subtitle}</p>
              </div>
              
              {/* Status Badge */}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusBadgeColors[card.status]}`}>
                {card.status === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
                {card.status === 'warning' && <AlertCircle className="w-3 h-3 mr-1" />}
                {card.status === 'danger' && <AlertCircle className="w-3 h-3 mr-1" />}
                {card.status === 'info' && <Clock className="w-3 h-3 mr-1" />}
                {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
              </span>
            </div>

            {/* Primary Metric */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-600">{card.primaryMetric.label}</span>
                {card.primaryMetric.trend && (
                  card.primaryMetric.trend === 'up' 
                    ? <TrendingUp className="w-4 h-4 text-green-500" />
                    : <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="text-2xl font-black text-slate-900">{card.primaryMetric.value}</div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {card.secondaryMetrics.slice(0, 4).map((metric, idx) => (
                <div key={idx} className="text-center bg-slate-50/50 rounded-xl p-3">
                  <div className="text-xs text-slate-500 font-medium">{metric.label}</div>
                  <div className="text-sm font-bold text-slate-700">{metric.value}</div>
                </div>
              ))}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {card.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-800">
                  {tag}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200/50">
              <span className="text-xs text-slate-500">Updated {card.lastUpdated}</span>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                {onItemEdit && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onItemEdit(card); }}
                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                <button className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hover Arrow */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCards.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No items found</h3>
          <p className="text-slate-600">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Detailed View Modal */}
      <DetailedViewModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        item={selectedItem}
        type={type}
        data={fullData || {}}
      />
    </div>
  );
};
