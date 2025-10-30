// Test script to verify MIILOC integration
// This can be used in browser console to test the stock functions

import { getItemStock, getItemCost, getItemInfo } from './stockUtils';

// Example test function - can be called from browser console
export function testMIILOCIntegration(data: any) {
  console.log('🧪 Testing MIILOC Integration...');
  
  const milocData = data['MIILOC.json'] || [];
  const itemsData = data['CustomAlert5.json'] || [];  // Use CustomAlert5 - has all item data
  
  console.log(`📊 MIILOC Records: ${milocData.length}`);
  console.log(`📦 Items Records: ${itemsData.length}`);
  
  if (milocData.length === 0) {
    console.log('❌ No MIILOC data found - system will show 0 stock');
    return;
  }
  
  // Test with first few items
  const testItems = milocData.slice(0, 5);
  
  testItems.forEach((milocRecord: any, index: number) => {
    const itemId = milocRecord.itemId;
    const stock = getItemStock(itemId, milocData);
    const itemInfo = getItemInfo(itemId, itemsData, milocData);
    
    console.log(`\n🔍 Test ${index + 1}: ${itemId}`);
    console.log(`  Stock: ${stock.qStk} (WIP: ${stock.qWIP}, Reserved: ${stock.qRes})`);
    console.log(`  Available: ${stock.total}`);
    console.log(`  Cost: $${itemInfo.cost.toFixed(2)}`);
    console.log(`  Description: ${itemInfo.description}`);
  });
  
  // Test specific item from your screenshot
  const testItemId = "CC BLACK CAP 28-400";
  const testStock = getItemStock(testItemId, milocData);
  const testInfo = getItemInfo(testItemId, itemsData, milocData);
  
  console.log(`\n🎯 Specific Test: ${testItemId}`);
  console.log(`  Stock: ${testStock.qStk} (should be 7291 from your example)`);
  console.log(`  Available: ${testStock.total}`);
  console.log(`  Cost: $${testInfo.cost.toFixed(2)}`);
  
  console.log('\n✅ MIILOC Integration Test Complete!');
  
  return {
    milocRecords: milocData.length,
    itemRecords: itemsData.length,
    testResults: {
      testItemId,
      stock: testStock,
      cost: testInfo.cost
    }
  };
}

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testMIILOC = testMIILOCIntegration;
}





