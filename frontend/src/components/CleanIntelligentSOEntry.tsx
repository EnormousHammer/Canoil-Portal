import React, { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, ShoppingCart, TrendingUp, Factory, User, Calendar, Package, Zap, Brain, Target, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { getTotalItemStock, getItemCost } from '../utils/stockUtils';

interface CleanIntelligentSOEntryProps {
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

// Clean Input Card Component
const InputCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, children, className = "" }) => (
  <div className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-6 ${className}`}>
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
    </div>
    {children}
  </div>
);

// Clean Status Badge Component
const StatusBadge: React.FC<{
  status: 'ok' | 'tight' | 'shortage' | 'critical' | 'checking' | 'verified';
  text: string;
}> = ({ status, text }) => {
  const colors = {
    ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    tight: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    shortage: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
    checking: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse',
    verified: 'bg-green-100 text-green-800 border-green-200'
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
      {text}
    </span>
  );
};

// Clean Progress Ring (reused from dashboard)
const ProgressRing: React.FC<{ progress: number; size?: number; strokeWidth?: number; className?: string }> = ({ 
  progress, 
  size = 60, 
  strokeWidth = 4, 
  className = "" 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-700">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export const CleanIntelligentSOEntry: React.FC<CleanIntelligentSOEntryProps> = ({ data, onSOCreated }) => {
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
  const [showComponentDetails, setShowComponentDetails] = useState(false);

  // Get available products (only assembled items with BOMs)
  const availableProducts = useMemo(() => {
    if (!data['CustomAlert5.json'] || !data['BillOfMaterialDetails.json']) return [];
    
    return data['CustomAlert5.json'].filter((item: any) => {
      return data['BillOfMaterialDetails.json'].some((bom: any) => 
        bom["Parent Item No."] === item["Item No."]
      );
    });
  }, [data]);

  // Get available customers
  const availableCustomers = useMemo(() => {
    if (!data['SalesOrderHeaders.json']) return [];
    
    const uniqueCustomers = [...new Set(data['SalesOrderHeaders.json'].map((so: any) => so["Customer Name"]))];
    return uniqueCustomers.filter(Boolean).sort();
  }, [data]);

  // Intelligent BOM Analysis - Simplified and focused
  const performBOMAnalysis = useCallback((productItemNo: string, quantity: number, deliveryDate: string): BOMVerificationResult => {
    console.log('🧠 AI BOM Analysis:', productItemNo, quantity, 'units');
    
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

      // Determine status
      let status: 'ok' | 'tight' | 'shortage' | 'critical' = 'ok';
      if (currentStock < requiredQty) {
        const shortage = requiredQty - currentStock;
        if (shortage > requiredQty * 0.5) status = 'critical';
        else if (shortage > requiredQty * 0.2) status = 'shortage';
        else status = 'tight';
      }

      // Get component details
      const componentDetails = data['CustomAlert5.json']?.find((item: any) => 
        item["Item No."] === componentItemNo
      );

      components.push({
        itemNo: componentItemNo,
        description: componentDetails?.["Description"] || 'Unknown Component',
        required: requiredQty,
        available: currentStock,
        onOrder: 0, // Simplified for clean view
        dueDate: '',
        status,
        suppliers: [],
        leadTime: 0,
        cost: componentCost,
        alternatives: []
      });

      // Add recommendations based on status
      if (status === 'critical') {
        riskFactors.push(`Critical shortage: ${componentItemNo}`);
        recommendations.push(`Urgent: Order ${componentItemNo} immediately`);
      } else if (status === 'shortage') {
        riskFactors.push(`Material shortage: ${componentItemNo}`);
        recommendations.push(`Review stock levels for ${componentItemNo}`);
      }
    });

    // Calculate overall metrics
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const shortageCount = components.filter(c => c.status === 'shortage').length;
    const canFulfill = criticalCount === 0;
    
    let confidence = 100;
    if (criticalCount > 0) confidence = Math.max(20, 100 - (criticalCount * 30));
    else if (shortageCount > 0) confidence = Math.max(60, 100 - (shortageCount * 15));

    // Estimate delivery date
    const baseDeliveryDays = canFulfill ? 3 : 7;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + baseDeliveryDays);

    return {
      canFulfill,
      confidence,
      components: components.sort((a, b) => {
        const statusOrder = { critical: 0, shortage: 1, tight: 2, ok: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      }),
      recommendations,
      estimatedDeliveryDate: estimatedDelivery.toISOString().split('T')[0],
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
    
    // AI processing simulation
    setTimeout(() => {
      const result = performBOMAnalysis(soDetails.product, soDetails.quantity, soDetails.deliveryDate);
      setBomVerification(result);
      setVerificationPhase('verified');
    }, 1200);
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
    
    if (onSOCreated) {
      onSOCreated(finalSO);
    }

    // Success feedback
    setTimeout(() => {
      alert(bomVerification.canFulfill 
        ? '✅ Sales Order created successfully!'
        : '⚠️ Sales Order created with material warnings.'
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
      setShowComponentDetails(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-slate-900 mb-3 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Smart Sales Order Entry
          </h1>
          <p className="text-lg text-slate-600 font-medium max-w-2xl mx-auto">
            AI-powered BOM verification • Zero mistakes • 10x faster than MiSys
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Product Selection */}
            <InputCard title="Product Selection" icon={<Package className="w-5 h-5" />}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Product</label>
                  <select
                    value={soDetails.product}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select a product...</option>
                    {availableProducts.map((product: any) => (
                      <option key={product["Item No."]} value={product["Item No."]}>
                        {product["Item No."]} - {product["Description"]}
                      </option>
                    ))}
                  </select>
                </div>
                
                {soDetails.product && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-1">Selected Product</h4>
                    <p className="text-blue-700 text-sm">{soDetails.productDescription}</p>
                  </div>
                )}
              </div>
            </InputCard>

            {/* Order Details */}
            <InputCard title="Order Details" icon={<ShoppingCart className="w-5 h-5" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    value={soDetails.quantity}
                    onChange={(e) => setSODetails({...soDetails, quantity: parseInt(e.target.value) || 1})}
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Date</label>
                  <input
                    type="date"
                    value={soDetails.deliveryDate}
                    onChange={(e) => setSODetails({...soDetails, deliveryDate: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
                  <select
                    value={soDetails.customer}
                    onChange={(e) => setSODetails({...soDetails, customer: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select customer...</option>
                    {availableCustomers.map((customer: string) => (
                      <option key={customer} value={customer}>{customer}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                  <select
                    value={soDetails.priority}
                    onChange={(e) => setSODetails({...soDetails, priority: e.target.value as any})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="standard">Standard</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>
            </InputCard>

            {/* AI Verification Button */}
            {verificationPhase === 'input' && (
              <div className="flex justify-center">
                <button
                  onClick={handleVerifyBOM}
                  disabled={!soDetails.product || !soDetails.quantity || !soDetails.deliveryDate}
                  className="group relative overflow-hidden bg-gradient-to-r from-green-500 to-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <div className="flex items-center gap-3">
                    <Brain className="w-6 h-6" />
                    <span>AI BOM Verification</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Verification Results */}
          <div className="space-y-6">
            
            {/* Verification Status */}
            <InputCard 
              title="Verification Status" 
              icon={verificationPhase === 'checking' ? <Clock className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
              className={verificationPhase === 'verified' ? 'ring-2 ring-green-200' : ''}
            >
              <div className="text-center space-y-4">
                {verificationPhase === 'input' && (
                  <div className="text-slate-500">
                    <Package className="w-16 h-16 mx-auto mb-3 text-slate-300" />
                    <p>Enter order details and click verify</p>
                  </div>
                )}
                
                {verificationPhase === 'checking' && (
                  <div className="text-blue-600">
                    <Brain className="w-16 h-16 mx-auto mb-3 animate-pulse" />
                    <p className="font-semibold">AI analyzing BOM...</p>
                    <div className="w-full bg-blue-100 rounded-full h-2 mt-3">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '70%'}}></div>
                    </div>
                  </div>
                )}
                
                {verificationPhase === 'verified' && bomVerification && (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <ProgressRing progress={bomVerification.confidence} size={80} />
                    </div>
                    
                    <div className="space-y-2">
                      <StatusBadge 
                        status={bomVerification.canFulfill ? 'verified' : 'critical'} 
                        text={bomVerification.canFulfill ? 'Can Fulfill' : 'Material Issues'} 
                      />
                      
                      <div className="text-sm text-slate-600 space-y-1">
                        <p><strong>Components:</strong> {bomVerification.components.length}</p>
                        <p><strong>Total Cost:</strong> ${bomVerification.totalCost.toFixed(2)}</p>
                        <p><strong>Est. Delivery:</strong> {bomVerification.estimatedDeliveryDate}</p>
                      </div>
                    </div>

                    {/* Component Summary */}
                    {bomVerification.components.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <button
                          onClick={() => setShowComponentDetails(!showComponentDetails)}
                          className="flex items-center justify-between w-full text-left"
                        >
                          <span className="font-medium text-slate-700">Component Details</span>
                          {showComponentDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        
                        {showComponentDetails && (
                          <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                            {bomVerification.components.slice(0, 5).map((comp, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs bg-white rounded p-2">
                                <span className="truncate flex-1">{comp.itemNo}</span>
                                <StatusBadge status={comp.status} text={comp.status.toUpperCase()} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      onClick={handleApproveSO}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Create Sales Order
                      </div>
                    </button>
                  </div>
                )}
                
                {verificationPhase === 'approved' && (
                  <div className="text-green-600">
                    <CheckCircle className="w-16 h-16 mx-auto mb-3" />
                    <p className="font-semibold">Sales Order Created!</p>
                  </div>
                )}
              </div>
            </InputCard>
          </div>
        </div>
      </div>
    </div>
  );
};
