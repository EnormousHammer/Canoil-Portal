// 🔒 G: DRIVE FIELD STANDARD ESLINT RULES
// This file enforces the G: Drive field naming standard
// DO NOT MODIFY OR DISABLE THESE RULES

module.exports = {
  "extends": ["../.eslintrc.js"], // Keep existing rules
  "rules": {
    // Enforce bracket notation for G: Drive fields
    "dot-notation": ["error", { 
      "allowKeywords": false,
      "allowPattern": "^[a-zA-Z_$][a-zA-Z0-9_$]*$" 
    }],
    
    // Ban old field names completely
    "no-restricted-syntax": [
      "error",
      {
        "selector": "MemberExpression[property.name='itemId']",
        "message": "❌ FORBIDDEN: Use item[\"Item No.\"] instead of item.itemId"
      },
      {
        "selector": "MemberExpression[property.name='descr']", 
        "message": "❌ FORBIDDEN: Use item[\"Description\"] instead of item.descr"
      },
      {
        "selector": "MemberExpression[property.name='qStk']",
        "message": "❌ FORBIDDEN: Use item[\"Stock Quantity\"] instead of item.qStk"
      },
      {
        "selector": "MemberExpression[property.name='mohId']",
        "message": "❌ FORBIDDEN: Use mo[\"Mfg. Order No.\"] instead of mo.mohId"
      },
      {
        "selector": "MemberExpression[property.name='moStat']",
        "message": "❌ FORBIDDEN: Use mo[\"Status\"] instead of mo.moStat" 
      },
      {
        "selector": "MemberExpression[property.name='customer']",
        "message": "❌ FORBIDDEN: Use mo[\"Customer\"] instead of mo.customer"
      },
      {
        "selector": "MemberExpression[property.name='bomItem']",
        "message": "❌ FORBIDDEN: Use mo[\"Build Item No.\"] instead of mo.bomItem"
      },
      {
        "selector": "MemberExpression[property.name='pohId']",
        "message": "❌ FORBIDDEN: Use po[\"Purchase Order No.\"] instead of po.pohId"
      },
      {
        "selector": "MemberExpression[property.name='name']",
        "message": "❌ FORBIDDEN: Use po[\"Vendor Name\"] instead of po.name (for POs)"
      },
      {
        "selector": "MemberExpression[property.name='items']",
        "message": "❌ FORBIDDEN: Use data['Items.json'] instead of data.items"
      },
      {
        "selector": "MemberExpression[property.name='manufacturingOrders']",
        "message": "❌ FORBIDDEN: Use data['ManufacturingOrderHeaders.json'] instead of data.manufacturingOrders"
      },
      {
        "selector": "MemberExpression[property.name='bomHeaders']",
        "message": "❌ FORBIDDEN: Use data['BillsOfMaterial.json'] instead of data.bomHeaders"
      },
      {
        "selector": "MemberExpression[property.name='bomDetails']",
        "message": "❌ FORBIDDEN: Use data['BillOfMaterialDetails.json'] instead of data.bomDetails"
      }
    ]
  }
};
