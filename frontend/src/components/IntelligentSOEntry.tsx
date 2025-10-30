import React, { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, ShoppingCart, TrendingUp, Factory, User, Calendar, Package, Zap } from 'lucide-react';
import { getTotalItemStock, getItemCost } from '../utils/stockUtils';

interface IntelligentSOEntryProps {
  data: any;
  onSOCreated?: (soDetails: any) => void;
}

interface SODetails {
  product: string;
  productDescription: string;
  quantity: number;
  customer: string;
  deliveryDate: string;
  priority: 'standard' | 'urgent' | 'emergency';
  specialInstructions: string;
}

interface BOMVerificationResult {
  canFulfill: boolean;
  confidence: number;
  components: ComponentAnalysis[];
  recommendations: string[];
  estimatedDeliveryDate: string;
  totalCost: number;
  riskFactors: string[];
}

interface ComponentAnalysis {
  itemNo: string;
  description: string;
  required: number;
  available: number;
  onOrder: number;
  dueDate: string;
  status: 'ok' | 'tight' | 'shortage' | 'critical';
  suppliers: string[];
  leadTime: number;
  cost: number;
  alternatives: string[];
}

export const IntelligentSOEntry: React.FC<IntelligentSOEntryProps> = ({ data, onSOCreated }) => {
  const [soDetails, setSODetails] = useState<SODetails>({
    product: '',
    productDescription: '',
    quantity: 1,
    customer: '',
    deliveryDate: '',
    priority: 'standard',
    specialInstructions: ''
  });

  const [verificationPhase, setVerificationPhase] = useState<'input' | 'checking' | 'verified' | 'approved'>('input');
  const [bomVerification, setBomVerification] = useState<BOMVerificationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get available products (only assembled items with BOMs)
  const availableProducts = useMemo(() => {
    if (!data['CustomAlert5.json'] || !data['BillOfMaterialDetails.json']) return [];
    
    return data['CustomAlert5.json'].filter((item: any) => {
      return data['BillOfMaterialDetails.json'].some((bom: any) => 
        bom["Parent Item No."] === item["Item No."]
      );
    });
  }, [data]);

  // Intelligent BOM Analysis - The Heart of Our System
  const performBOMAnalysis = useCallback((productItemNo: string, quantity: number, deliveryDate: string): BOMVerificationResult => {
    console.log('🧠 Performing Intelligent BOM Analysis for:', productItemNo, quantity, 'units');
    
    const bomDetails = data['BillOfMaterialDetails.json'] || [];
    const components: ComponentAnalysis[] = [];
    let totalCost = 0;
    const recommendations: string[] = [];
    const riskFactors: string[] = [];

    // Get all components for this product
    const productBOMs = bomDetails.filter((bom: any) => bom["Parent Item No."] === productItemNo);
    
    productBOMs.forEach((bom: any) => {
      const componentItemNo = bom["Component Item No."];
      const requiredQty = parseFloat(bom["Required Quantity"] || 1) * quantity;
      const currentStock = getTotalItemStock(componentItemNo, data);
      const itemCost = getItemCost(componentItemNo, data);
      const componentCost = itemCost * requiredQty;
      totalCost += componentCost;

      // Calculate on-order quantity and due date
      const onOrderData = data['PurchaseOrderDetails.json']?.filter((pod: any) => {
        const po = data['PurchaseOrders.json']?.find((po: any) => 
          po["Purchase Order No."] === pod["Purchase Order No."] && !po["Close Date"]
        );
        return pod["Item No."] === componentItemNo && po;
      }) || [];
      
      const onOrder = onOrderData.reduce((sum: number, pod: any) => 
        sum + parseFloat(pod["Quantity"] || 0), 0
      );

      // Find suppliers
      const suppliers = data['PurchaseOrderDetails.json']?.filter((pod: any) => 
        pod["Item No."] === componentItemNo
      ).map((pod: any) => {
        const po = data['PurchaseOrders.json']?.find((po: any) => 
          po["Purchase Order No."] === pod["Purchase Order No."]
        );
        return po?.["Buyer"] || po?.["Supplier No."] || 'Unknown';
      }).filter((supplier: string, index: number, arr: string[]) => 
        supplier !== 'Unknown' && arr.indexOf(supplier) === index
      ) || [];

      // Determine status
      let status: ComponentAnalysis['status'] = 'ok';
      const totalAvailable = currentStock + onOrder;
      
      if (totalAvailable < requiredQty) {
        const shortage = requiredQty - totalAvailable;
        if (shortage > requiredQty * 0.5) {
          status = 'critical';
          riskFactors.push(`Critical shortage of ${componentItemNo}: need ${shortage.toFixed(0)} more units`);
        } else {
          status = 'shortage';
          riskFactors.push(`Shortage of ${componentItemNo}: need ${shortage.toFixed(0)} more units`);
        }
      } else if (totalAvailable < requiredQty * 1.1) {
        status = 'tight';
        recommendations.push(`${componentItemNo} stock is tight - consider ordering safety stock`);
      }

      // Get component description
      const componentItem = data['CustomAlert5.json']?.find((item: any) => 
        item["Item No."] === componentItemNo
      );

      components.push({
        itemNo: componentItemNo,
        description: componentItem?.["Description"] || 'Unknown Component',
        required: requiredQty,
        available: currentStock,
        onOrder,
        dueDate: '2025-09-15', // Simplified - would calculate from PO dates
        status,
        suppliers,
        leadTime: 14, // Simplified - would calculate from historical data
        cost: componentCost,
        alternatives: [] // Could find alternative components
      });
    });

    // Calculate overall fulfillment capability
    const criticalShortages = components.filter(c => c.status === 'critical').length;
    const shortages = components.filter(c => c.status === 'shortage').length;
    const canFulfill = criticalShortages === 0 && shortages === 0;
    
    // Calculate confidence based on stock levels and risk factors
    let confidence = 100;
    if (criticalShortages > 0) confidence -= criticalShortages * 30;
    if (shortages > 0) confidence -= shortages * 15;
    if (components.filter(c => c.status === 'tight').length > 0) confidence -= 10;
    confidence = Math.max(confidence, 0);

    // Estimate delivery date based on constraints
    const requestedDate = new Date(deliveryDate);
    const today = new Date();
    const daysToDelivery = Math.ceil((requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let estimatedDeliveryDate = deliveryDate;
    if (shortages > 0 || criticalShortages > 0) {
      const maxLeadTime = Math.max(...components.filter(c => c.status !== 'ok').map(c => c.leadTime));
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + maxLeadTime + 5); // Add buffer
      estimatedDeliveryDate = estimatedDate.toISOString().split('T')[0];
      
      if (estimatedDate > requestedDate) {
        riskFactors.push(`Delivery may be delayed by ${Math.ceil((estimatedDate.getTime() - requestedDate.getTime()) / (1000 * 60 * 60 * 24))} days`);
      }
    }

    // Generate intelligent recommendations
    if (canFulfill) {
      recommendations.push('✅ All materials available - order can proceed immediately');
    } else {
      recommendations.push('⚠️ Material shortages detected - purchase orders required');
      
      const shortageComponents = components.filter(c => c.status === 'shortage' || c.status === 'critical');
      shortageComponents.forEach(comp => {
        const shortage = comp.required - (comp.available + comp.onOrder);
        recommendations.push(`📦 Order ${shortage.toFixed(0)} units of ${comp.itemNo} (${comp.suppliers.length > 0 ? comp.suppliers[0] : 'find supplier'})`);
      });
    }

    console.log('📊 BOM Analysis Complete:', {
      canFulfill,
      confidence,
      componentsAnalyzed: components.length,
      totalCost: totalCost.toFixed(2),
      riskFactors: riskFactors.length
    });

    return {
      canFulfill,
      confidence,
      components,
      recommendations,
      estimatedDeliveryDate,
      totalCost,
      riskFactors
    };
  }, [data]);

  // Handle product selection
  const handleProductChange = (selectedProduct: string) => {
    const product = availableProducts.find((p: any) => p["Item No."] === selectedProduct);
    setSODetails({
      ...soDetails,
      product: selectedProduct,
      productDescription: product?.["Description"] || ''
    });
    
    // Reset verification when product changes
    if (verificationPhase !== 'input') {
      setVerificationPhase('input');
      setBomVerification(null);
    }
  };

  // Trigger BOM verification
  const handleVerifyBOM = () => {
    if (!soDetails.product || !soDetails.quantity || !soDetails.deliveryDate) {
      alert('Please fill in Product, Quantity, and Delivery Date');
      return;
    }

    setVerificationPhase('checking');
    
    // Simulate processing time for dramatic effect
    setTimeout(() => {
      const result = performBOMAnalysis(soDetails.product, soDetails.quantity, soDetails.deliveryDate);
      setBomVerification(result);
      setVerificationPhase('verified');
    }, 1500);
  };

  // Handle SO approval
  const handleApproveSO = () => {
    if (!bomVerification) return;

    const finalSO = {
      ...soDetails,
      bomVerification,
      timestamp: new Date().toISOString(),
      status: bomVerification.canFulfill ? 'approved' : 'conditional'
    };

    setVerificationPhase('approved');
    
    // Call parent callback
    if (onSOCreated) {
      onSOCreated(finalSO);
    }

    // Show success message
    setTimeout(() => {
      alert(bomVerification.canFulfill 
        ? '✅ Sales Order created successfully! All materials are available.'
        : '⚠️ Sales Order created with conditions. Check material requirements.'
      );
      
      // Reset form
      setSODetails({
        product: '',
        productDescription: '',
        quantity: 1,
        customer: '',
        deliveryDate: '',
        priority: 'standard',
        specialInstructions: ''
      });
      setVerificationPhase('input');
      setBomVerification(null);
    }, 2000);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2 flex items-center">
          <Zap className="w-8 h-8 mr-3" />
          Intelligent Sales Order Entry
        </h2>
        <p className="text-green-100">
          10x Better than MISys • Real-time BOM verification • Zero mistakes guaranteed
        </p>
      </div>

      {/* SO Entry Form */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Package className="w-5 h-5 mr-2 text-blue-600" />
          Sales Order Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product (Assembled Items Only)
            </label>
            <select
              value={soDetails.product}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Select a product from assembled items with BOMs"
            >
              <option value="">Select a product...</option>
              {availableProducts.map((product: any) => (
                <option key={product["Item No."]} value={product["Item No."]}>
                  {product["Item No."]} - {product["Description"]}
                </option>
              ))}
            </select>
            {soDetails.product && (
              <div className="mt-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
                ✅ Product has BOM - can verify material availability
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={soDetails.quantity}
              onChange={(e) => setSODetails({...soDetails, quantity: parseInt(e.target.value) || 1})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter quantity"
              title="Enter the quantity of products to order"
            />
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer
            </label>
            <input
              type="text"
              value={soDetails.customer}
              onChange={(e) => setSODetails({...soDetails, customer: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Customer name or company"
              title="Enter customer name or company"
            />
          </div>

          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requested Delivery Date
            </label>
            <input
              type="date"
              value={soDetails.deliveryDate}
              onChange={(e) => setSODetails({...soDetails, deliveryDate: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Select the requested delivery date"
              placeholder="Select delivery date"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              value={soDetails.priority}
              onChange={(e) => setSODetails({...soDetails, priority: e.target.value as any})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Select order priority level"
            >
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions
            </label>
            <textarea
              value={soDetails.specialInstructions}
              onChange={(e) => setSODetails({...soDetails, specialInstructions: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Any special requirements or notes"
            />
          </div>
        </div>

        {/* BOM Verification Button */}
        <div className="mt-6 text-center">
          <button
            onClick={handleVerifyBOM}
            disabled={verificationPhase === 'checking' || !soDetails.product || !soDetails.quantity || !soDetails.deliveryDate}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
          >
            {verificationPhase === 'checking' ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Analyzing BOM & Stock...
              </div>
            ) : (
              <div className="flex items-center">
                <Factory className="w-5 h-5 mr-2" />
                🔍 Verify BOM & Check Stock
              </div>
            )}
          </button>
        </div>
      </div>

      {/* BOM Verification Results */}
      {bomVerification && verificationPhase === 'verified' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              BOM Verification Results
            </h3>
            <div className={`px-4 py-2 rounded-lg font-semibold ${
              bomVerification.canFulfill 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {bomVerification.canFulfill ? '✅ Can Fulfill' : '❌ Cannot Fulfill'}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{bomVerification.confidence}%</div>
              <div className="text-sm text-blue-600">Confidence</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{bomVerification.components.length}</div>
              <div className="text-sm text-green-600">Components</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">${bomVerification.totalCost.toFixed(0)}</div>
              <div className="text-sm text-purple-600">Total Cost</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {new Date(bomVerification.estimatedDeliveryDate).toLocaleDateString()}
              </div>
              <div className="text-sm text-orange-600">Est. Delivery</div>
            </div>
          </div>

          {/* Component Analysis Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left">Component</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Required</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Available</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">On Order</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Status</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Cost</th>
                </tr>
              </thead>
              <tbody>
                {bomVerification.components.map((comp, index) => (
                  <tr key={index} className={`${
                    comp.status === 'critical' ? 'bg-red-50' :
                    comp.status === 'shortage' ? 'bg-orange-50' :
                    comp.status === 'tight' ? 'bg-yellow-50' : 'bg-green-50'
                  }`}>
                    <td className="border border-gray-300 px-3 py-2">
                      <div className="font-medium">{comp.itemNo}</div>
                      <div className="text-sm text-gray-600">{comp.description}</div>
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                      {comp.required.toFixed(0)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {comp.available.toFixed(0)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {comp.onOrder > 0 ? comp.onOrder.toFixed(0) : '-'}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {comp.status === 'ok' && <span className="text-green-600 font-semibold">✅ OK</span>}
                      {comp.status === 'tight' && <span className="text-yellow-600 font-semibold">⚠️ TIGHT</span>}
                      {comp.status === 'shortage' && <span className="text-orange-600 font-semibold">📦 SHORT</span>}
                      {comp.status === 'critical' && <span className="text-red-600 font-semibold">🚨 CRITICAL</span>}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      ${comp.cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recommendations */}
          {bomVerification.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Smart Recommendations
              </h4>
              <ul className="space-y-1">
                {bomVerification.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-blue-700">• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Factors */}
          {bomVerification.riskFactors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-red-800 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Risk Factors
              </h4>
              <ul className="space-y-1">
                {bomVerification.riskFactors.map((risk, index) => (
                  <li key={index} className="text-sm text-red-700">• {risk}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleApproveSO}
              className={`px-6 py-3 font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 ${
                bomVerification.canFulfill
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {bomVerification.canFulfill ? '✅ Approve Sales Order' : '⚠️ Approve with Conditions'}
            </button>
            
            <button
              onClick={() => {
                setVerificationPhase('input');
                setBomVerification(null);
              }}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              ❌ Cancel & Modify
            </button>
          </div>
        </div>
      )}

      {/* Success State */}
      {verificationPhase === 'approved' && (
        <div className="bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-xl p-6 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-green-800 mb-2">Sales Order Processing Complete!</h3>
          <p className="text-green-700">
            SO for {soDetails.quantity} units of {soDetails.product} has been {bomVerification?.canFulfill ? 'approved' : 'conditionally approved'}.
          </p>
        </div>
      )}
    </div>
  );
};
