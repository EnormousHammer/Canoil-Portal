import { useMemo, useState } from 'react';
import { AlertTriangle, Package, Factory, ShoppingCart, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { parseMISysDate } from '../utils/dateUtils';

interface StockAllocationTrackerProps {
  data: any;
}

interface StockAllocation {
  itemNo: string;
  description: string;
  currentStock: number;
  allocated: number;
  available: number;
  conflicted: boolean;
  allocations: {
    moNumber: string;
    customer: string;
    quantityNeeded: number;
    status: string;
    dueDate: Date | null;
    priority: 'High' | 'Medium' | 'Low';
  }[];
  incoming: {
    poNumber: string;
    vendor: string;
    quantity: number;
    expectedDate: Date | null;
  }[];
}

interface ConflictAlert {
  itemNo: string;
  description: string;
  shortfall: number;
  affectedMOs: string[];
  suggestedActions: string[];
}

export const StockAllocationTracker: React.FC<StockAllocationTrackerProps> = ({ data }) => {
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  // Calculate stock allocations for all items
  const stockAllocations = useMemo(() => {
    if (!data['CustomAlert5.json'] || !data['ManufacturingOrderHeaders.json']) return [];

    const allocationMap = new Map<string, StockAllocation>();

    // Initialize all items
    data['CustomAlert5.json'].forEach((item: any) => {
      const itemNo = item["Item No."];
      const currentStock = parseFloat(item["Stock"] || 0);  // CustomAlert5 exact field
      
      allocationMap.set(itemNo, {
        itemNo,
        description: item["Description"] || '',
        currentStock,
        allocated: 0,
        available: currentStock,
        conflicted: false,
        allocations: [],
        incoming: []
      });
    });

    // Calculate allocations from Manufacturing Orders
    data['ManufacturingOrderHeaders.json']?.forEach((mo: any) => {
      if (mo["Status"] === 3) return; // Skip closed MOs
      
      const moNumber = mo["Mfg. Order No."];
      const customer = mo["Customer"] || 'Unknown Customer';
      const dueDate = parseMISysDate(mo["Sales Order Ship Date"] || mo["Completion Date"]);
      
      // Get MO details to find component requirements
      const moDetails = data['ManufacturingOrderDetails.json']?.filter((mod: any) => 
        mod["Mfg. Order No."] === moNumber
      ) || [];

      moDetails.forEach((detail: any) => {
        const componentItem = detail["Component Item No."];
        const quantityNeeded = parseFloat(detail["Quantity"] || detail["Qty"] || 0);
        
        if (componentItem && allocationMap.has(componentItem)) {
          const allocation = allocationMap.get(componentItem)!;
          
          // Determine priority based on status and due date
          let priority: 'High' | 'Medium' | 'Low' = 'Medium';
          if (mo["Status"] === 2) priority = 'High'; // WIP
          else if (mo["Status"] === 1) priority = 'Medium'; // Released
          else priority = 'Low'; // Pending
          
          allocation.allocations.push({
            moNumber,
            customer,
            quantityNeeded,
            status: mo["Status"] === 0 ? 'Pending' : mo["Status"] === 1 ? 'Released' : mo["Status"] === 2 ? 'WIP' : 'Closed',
            dueDate,
            priority
          });
          
          allocation.allocated += quantityNeeded;
        }
      });

      // Also check if the build item itself is being allocated
      const buildItem = mo["Build Item No."];
      if (buildItem && allocationMap.has(buildItem)) {
        const allocation = allocationMap.get(buildItem)!;
        const quantityToBuild = parseFloat(mo["Quantity"] || mo["Qty"] || 0);
        
        allocation.allocations.push({
          moNumber,
          customer,
          quantityNeeded: quantityToBuild,
          status: mo["Status"] === 0 ? 'Pending' : mo["Status"] === 1 ? 'Released' : mo["Status"] === 2 ? 'WIP' : 'Closed',
          dueDate,
          priority: mo["Status"] === 2 ? 'High' : mo["Status"] === 1 ? 'Medium' : 'Low'
        });
        
        allocation.allocated += quantityToBuild;
      }
    });

    // Calculate incoming stock from Purchase Orders
    data['PurchaseOrderDetails.json']?.forEach((pod: any) => {
      const itemNo = pod["Item No."];
      const quantity = parseFloat(pod["Quantity"] || pod["Qty"] || 0);
      
      if (itemNo && allocationMap.has(itemNo)) {
        const po = data['PurchaseOrders.json']?.find((po: any) => 
          po["Purchase Order No."] === pod["Purchase Order No."] && !po["Close Date"]
        );
        
        if (po) {
          const allocation = allocationMap.get(itemNo)!;
          const vendor = po["Buyer"] || po["Name"] || po["Supplier No."] || 'Unknown Vendor';
          const expectedDate = parseMISysDate(po["Order Date"] ?? po["ordDt"]);
          
          allocation.incoming.push({
            poNumber: po["Purchase Order No."],
            vendor,
            quantity,
            expectedDate
          });
        }
      }
    });

    // Calculate available stock and identify conflicts
    allocationMap.forEach((allocation) => {
      const incomingTotal = allocation.incoming.reduce((sum, inc) => sum + inc.quantity, 0);
      allocation.available = allocation.currentStock + incomingTotal - allocation.allocated;
      allocation.conflicted = allocation.available < 0;
      
      // Sort allocations by priority and due date
      allocation.allocations.sort((a, b) => {
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        if (a.dueDate && b.dueDate) {
          return a.dueDate.getTime() - b.dueDate.getTime();
        }
        return 0;
      });
    });

    return Array.from(allocationMap.values())
      .filter(allocation => allocation.allocated > 0 || allocation.conflicted)
      .sort((a, b) => {
        // Sort conflicts first, then by shortage amount
        if (a.conflicted && !b.conflicted) return -1;
        if (!a.conflicted && b.conflicted) return 1;
        if (a.conflicted && b.conflicted) {
          return a.available - b.available; // Most negative first
        }
        return b.allocated - a.allocated; // Highest allocation first
      });
  }, [data]);

  // Generate conflict alerts
  const conflictAlerts = useMemo(() => {
    const alerts: ConflictAlert[] = [];
    
    stockAllocations.forEach(allocation => {
      if (allocation.conflicted) {
        const shortfall = Math.abs(allocation.available);
        const affectedMOs = allocation.allocations.map(alloc => alloc.moNumber);
        
        const suggestedActions = [];
        if (allocation.incoming.length > 0) {
          suggestedActions.push(`${allocation.incoming.length} PO(s) incoming - expedite delivery`);
        } else {
          suggestedActions.push('Create purchase order for additional stock');
        }
        
        if (allocation.allocations.some(alloc => alloc.priority === 'Low')) {
          suggestedActions.push('Consider delaying low-priority orders');
        }
        
        if (allocation.allocations.length > 1) {
          suggestedActions.push('Review MO priorities and reschedule if possible');
        }
        
        alerts.push({
          itemNo: allocation.itemNo,
          description: allocation.description,
          shortfall,
          affectedMOs,
          suggestedActions
        });
      }
    });
    
    return alerts.sort((a, b) => b.shortfall - a.shortfall);
  }, [stockAllocations]);

  const filteredAllocations = showConflictsOnly 
    ? stockAllocations.filter(alloc => alloc.conflicted)
    : stockAllocations;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WIP': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Released': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl shadow-soft p-6">
        <h2 className="text-2xl font-bold mb-2 flex items-center">
          <AlertTriangle className="w-8 h-8 mr-3" />
          Stock Allocation & Conflict Detection
        </h2>
        <p className="text-red-100">
          Track where every unit is allocated, prevent stock conflicts, and get early warnings before creating MOs
        </p>
      </div>

      {/* Conflict Alerts */}
      {conflictAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            🚨 STOCK CONFLICTS DETECTED ({conflictAlerts.length})
          </h3>
          <div className="space-y-4">
            {conflictAlerts.slice(0, 5).map((alert) => (
              <div key={alert.itemNo} className="bg-white border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-red-900">{alert.itemNo}</div>
                    <div className="text-sm text-gray-600">{alert.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-600">-{alert.shortfall.toLocaleString()}</div>
                    <div className="text-sm text-red-500">Units Short</div>
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <strong>Affected MOs:</strong> {alert.affectedMOs.join(', ')}
                </div>
                <div className="text-sm">
                  <strong className="text-gray-700">Suggested Actions:</strong>
                  <ul className="list-disc list-inside text-gray-600 mt-1">
                    {alert.suggestedActions.map((action, idx) => (
                      <li key={`${action}-${idx}`}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-soft p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Stock Allocation Overview</h3>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showConflictsOnly}
                onChange={(e) => setShowConflictsOnly(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Show conflicts only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Stock Allocations Table */}
      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allocated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Incoming</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAllocations.slice(0, 50).map((allocation) => (
                <tr 
                  key={allocation.itemNo} 
                  className={`hover:bg-gray-50 ${allocation.conflicted ? 'bg-red-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{allocation.itemNo}</div>
                    <div className="text-sm text-gray-600">{allocation.description}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{allocation.currentStock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">{allocation.allocated.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">
                    {allocation.incoming.reduce((sum, inc) => sum + inc.quantity, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${allocation.available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {allocation.available.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {allocation.conflicted ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Conflict
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedItem(selectedItem === allocation.itemNo ? '' : allocation.itemNo)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {selectedItem === allocation.itemNo ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Allocation View */}
      {selectedItem && (
        <div className="bg-white rounded-xl shadow-soft p-6">
          {(() => {
            const allocation = stockAllocations.find(a => a.itemNo === selectedItem);
            if (!allocation) return null;

            return (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Detailed Allocation: {allocation.itemNo} - {allocation.description}
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Allocations */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Manufacturing Order Allocations</h4>
                    <div className="space-y-2">
                      {allocation.allocations.map((alloc, idx) => (
                        <div key={`${alloc.orderNo}-${idx}`} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-gray-900">{alloc.moNumber}</div>
                              <div className="text-sm text-gray-600">{alloc.customer}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{alloc.quantityNeeded.toLocaleString()}</div>
                              <div className="text-sm text-gray-500">Units</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(alloc.status)}`}>
                              {alloc.status}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(alloc.priority)}`}>
                              {alloc.priority}
                            </span>
                            {alloc.dueDate && (
                              <span className="text-xs text-gray-500">
                                Due: {alloc.dueDate.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Incoming Stock */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Incoming Stock (Purchase Orders)</h4>
                    <div className="space-y-2">
                      {allocation.incoming.length > 0 ? allocation.incoming.map((inc, idx) => (
                        <div key={`${inc.poNumber}-${idx}`} className="p-3 bg-green-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-gray-900">{inc.poNumber}</div>
                              <div className="text-sm text-gray-600">{inc.vendor}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-green-600">+{inc.quantity.toLocaleString()}</div>
                              <div className="text-sm text-gray-500">Units</div>
                            </div>
                          </div>
                          {inc.expectedDate && (
                            <div className="text-xs text-gray-500">
                              Expected: {inc.expectedDate.toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )) : (
                        <div className="text-sm text-gray-500 italic">No incoming stock from purchase orders</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
