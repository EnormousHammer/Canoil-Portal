import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  Factory, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Calculator,
  Clock,
  TrendingUp,
  Zap,
  Target,
  Brain,
  ChevronLeft
} from 'lucide-react';
import { getTotalItemStock, getItemCost } from '../utils/stockUtils';
import { AIAlertEngine } from './AIAlertEngine';

interface CleanVisualBOMProps {
  data: any;
  selectedItem: string;
  targetQuantity: number;
  onBack: () => void;
  onQuantityChange: (quantity: number) => void;
}

interface CleanBOMComponent {
  itemNo: string;
  description: string;
  quantityNeeded: number;
  currentStock: number;
  shortage: number;
  cost: number;
  totalCost: number;
  status: 'ready' | 'low' | 'critical';
  statusMessage: string;
}

export const CleanVisualBOM: React.FC<CleanVisualBOMProps> = ({ 
  data, 
  selectedItem, 
  targetQuantity, 
  onBack, 
  onQuantityChange 
}) => {
  const [showAIAlerts, setShowAIAlerts] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // Clean BOM Analysis - Following Enterprise BOM Master Plan Phase 3
  const cleanBOMAnalysis = useMemo(() => {
    try {
      if (!selectedItem || !data['BillOfMaterialDetails.json'] || !data['CustomAlert5.json']) {
        return { components: [], mainProduct: null, canBuild: false, totalCost: 0 };
      }

    const bomDetails = data['BillOfMaterialDetails.json'] || [];
    const items = data['CustomAlert5.json'] || [];
    
    // Get main product info
    const mainProduct = items.find((item: any) => item['Item No.'] === selectedItem);
    if (!mainProduct) return { components: [], mainProduct: null, canBuild: false, totalCost: 0 };

    // Get direct components only (no nested complexity)
    const directComponents = bomDetails
      .filter((bom: any) => bom['Parent Item No.'] === selectedItem)
      .map((bom: any) => {
        const componentItem = items.find((item: any) => item['Item No.'] === bom['Component Item No.']);
        const quantityPerUnit = parseFloat(bom['Required Quantity'] || 1);
        const quantityNeeded = quantityPerUnit * targetQuantity;
        const currentStock = getTotalItemStock(bom['Component Item No.'], data);
        const cost = getItemCost(bom['Component Item No.'], data);
        const shortage = Math.max(0, quantityNeeded - currentStock);
        
        let status: 'ready' | 'low' | 'critical' = 'ready';
        let statusMessage = '✅ Ready';
        
        if (shortage > 0) {
          status = 'critical';
          statusMessage = `❌ Missing ${shortage}`;
        } else if (currentStock < quantityNeeded * 1.1) { // Less than 10% buffer
          status = 'low';
          statusMessage = '⚠️ Tight';
        }

        return {
          itemNo: bom['Component Item No.'],
          description: componentItem ? componentItem['Description'] || '' : 'Unknown Component',
          quantityNeeded,
          currentStock,
          shortage,
          cost,
          totalCost: cost * quantityNeeded,
          status,
          statusMessage
        } as CleanBOMComponent;
      })
      .sort((a, b) => {
        // Sort by status priority: critical > low > ready
        const statusPriority = { 'critical': 3, 'low': 2, 'ready': 1 };
        if (statusPriority[a.status] !== statusPriority[b.status]) {
          return statusPriority[b.status] - statusPriority[a.status];
        }
        return a.itemNo.localeCompare(b.itemNo);
      });

    const canBuild = directComponents.every(comp => comp.shortage === 0);
    const totalCost = directComponents.reduce((sum, comp) => sum + comp.totalCost, 0);

    return {
      components: directComponents,
      mainProduct,
      canBuild,
      totalCost
    };
    } catch (error) {
      console.error('Error in Clean Visual BOM analysis:', error);
      return {
        components: [],
        mainProduct: null,
        canBuild: false,
        totalCost: 0,
        error: `BOM analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, [selectedItem, targetQuantity, data]);

  if (showAIAlerts) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-4">
          <button
            onClick={() => setShowAIAlerts(false)}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to BOM Planning
          </button>
        </div>
        
        <AIAlertEngine data={data} selectedItem={selectedItem} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Smart BOM Planner
          </button>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowAIAlerts(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center"
            >
              <Brain className="w-4 h-4 mr-2" />
              AI Alerts
            </button>
            
            <button
              onClick={() => setShowCostBreakdown(!showCostBreakdown)}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Cost Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Clean Visual BOM - Following Enterprise Master Plan */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-8">
        {/* Main Product Header */}
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              🏗️ Building: {selectedItem}
            </h1>
            <p className="text-gray-600 mb-4">
              {cleanBOMAnalysis.mainProduct?.['Description'] || 'Product Description'}
            </p>
            
            {/* Quantity Selector */}
            <div className="flex items-center justify-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Quantity:</label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onQuantityChange(Math.max(1, targetQuantity - 10))}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
                >
                  -10
                </button>
                <button
                  onClick={() => onQuantityChange(Math.max(1, targetQuantity - 1))}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
                >
                  -1
                </button>
                <input
                  type="number"
                  value={targetQuantity}
                  onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold text-lg"
                  min="1"
                  title="Target quantity to build"
                  placeholder="Qty"
                />
                <button
                  onClick={() => onQuantityChange(targetQuantity + 1)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
                >
                  +1
                </button>
                <button
                  onClick={() => onQuantityChange(targetQuantity + 10)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
                >
                  +10
                </button>
              </div>
              <span className="text-sm text-gray-500">units</span>
            </div>
          </div>

          {/* Build Status - Clean & Clear */}
          <div className={`rounded-xl p-6 border-2 ${
            cleanBOMAnalysis.canBuild 
              ? 'bg-green-50 border-green-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center justify-center space-x-4">
              {cleanBOMAnalysis.canBuild ? (
                <>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <div className="text-xl font-bold text-green-800">✅ Ready to Build!</div>
                    <div className="text-green-700">All {cleanBOMAnalysis.components.length} components available</div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                  <div>
                    <div className="text-xl font-bold text-red-800">❌ Missing Components</div>
                    <div className="text-red-700">
                      {cleanBOMAnalysis.components.filter(c => c.shortage > 0).length} components need ordering
                    </div>
                  </div>
                </>
              )}
              
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  ${cleanBOMAnalysis.totalCost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Cost</div>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Component Flow - Enterprise Style */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            Components Required ({cleanBOMAnalysis.components.length})
          </h3>
          
          {cleanBOMAnalysis.components.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No BOM components found</p>
              <p className="text-sm">This item may not have a bill of materials defined</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cleanBOMAnalysis.components.map((component, index) => (
                <div
                  key={`${component.itemNo}-${index}`}
                  className={`rounded-xl p-6 border-2 transition-all hover:shadow-lg ${
                    component.status === 'ready' 
                      ? 'bg-green-50 border-green-300 hover:border-green-400' 
                      : component.status === 'low'
                      ? 'bg-yellow-50 border-yellow-300 hover:border-yellow-400'
                      : 'bg-red-50 border-red-300 hover:border-red-400'
                  }`}
                >
                  {/* Component Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{component.itemNo}</div>
                      <div className="text-sm text-gray-600 truncate">{component.description}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      component.status === 'ready' ? 'bg-green-200 text-green-800' :
                      component.status === 'low' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-red-200 text-red-800'
                    }`}>
                      {component.statusMessage}
                    </div>
                  </div>

                  {/* Quantity Info */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Need:</span>
                      <span className="font-bold text-blue-600">{component.quantityNeeded.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Have:</span>
                      <span className={`font-bold ${
                        component.currentStock >= component.quantityNeeded ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {component.currentStock.toLocaleString()}
                      </span>
                    </div>
                    
                    {component.shortage > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Short:</span>
                        <span className="font-bold text-red-600">{component.shortage.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Cost:</span>
                        <span className="font-bold text-gray-900">${component.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  {component.shortage > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                        Order {component.shortage.toLocaleString()} Units
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Breakdown */}
        {showCostBreakdown && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h4 className="font-semibold text-blue-800 mb-4 flex items-center">
              <Calculator className="w-5 h-5 mr-2" />
              💰 Cost Breakdown
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-blue-700">Most Expensive Components:</div>
                {cleanBOMAnalysis.components
                  .sort((a, b) => b.totalCost - a.totalCost)
                  .slice(0, 5)
                  .map((comp, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-blue-600 truncate">{comp.itemNo}</span>
                      <span className="font-medium text-blue-800">${comp.totalCost.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-blue-700">Summary:</div>
                <div className="flex justify-between text-sm">
                  <span>Components:</span>
                  <span>{cleanBOMAnalysis.components.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Quantity:</span>
                  <span>{cleanBOMAnalysis.components.reduce((sum, c) => sum + c.quantityNeeded, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-blue-300 pt-2">
                  <span>Total Cost:</span>
                  <span>${cleanBOMAnalysis.totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cost per Unit:</span>
                  <span>${(cleanBOMAnalysis.totalCost / targetQuantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all">
            <Factory className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Create Manufacturing Order</div>
            <div className="text-sm opacity-90">Start production planning</div>
          </button>
          
          <button 
            onClick={() => setShowAIAlerts(true)}
            className="p-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 transition-all"
          >
            <Brain className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">AI Stock Alerts</div>
            <div className="text-sm opacity-90">Predictive shortage detection</div>
          </button>
          
          <button className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all">
            <Target className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Optimize Build</div>
            <div className="text-sm opacity-90">Find cost savings</div>
          </button>
        </div>
      </div>
    </div>
  );
};
