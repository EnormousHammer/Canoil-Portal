# 🔒 G: DRIVE FIELD STANDARD - DO NOT MODIFY

## ⚠️ CRITICAL SYSTEM REQUIREMENT ⚠️

This document establishes the **IMMUTABLE STANDARD** for field names and data structure in the Canoil Portal application.

**❌ VIOLATION OF THIS STANDARD WILL BREAK THE ENTIRE SYSTEM ❌**

---

## 📋 MANDATORY FIELD NAMING CONVENTION

### ✅ **CORRECT - ALWAYS USE THESE:**
```typescript
// File References - EXACT .json names
data['Items.json']
data['ManufacturingOrderHeaders.json'] 
data['BillsOfMaterial.json']
data['BillOfMaterialDetails.json']
data['PurchaseOrders.json']
data['PurchaseOrderDetails.json']

// Field References - EXACT G: Drive field names with brackets
item["Item No."]
item["Description"] 
item["Stock Quantity"]
item["Standard Cost"]
mo["Mfg. Order No."]
mo["Status"]             // Numeric: 0,1,2,3,4
mo["Customer"]
mo["Build Item No."]
po["Purchase Order No."]
po["Vendor Name"]
po["Order Date"]
```

### ❌ **FORBIDDEN - NEVER USE THESE:**
```typescript
// OLD FAKE FIELD NAMES - WILL BREAK SYSTEM
item.itemId              // ❌ Use item["Item No."]
item.descr               // ❌ Use item["Description"]
item.qStk                // ❌ Use item["Stock Quantity"]
mo.mohId                 // ❌ Use mo["Mfg. Order No."]
mo.moStat                // ❌ Use mo["Status"]
mo.customer              // ❌ Use mo["Customer"]
mo.bomItem               // ❌ Use mo["Build Item No."]
po.pohId                 // ❌ Use po["Purchase Order No."]
po.name                  // ❌ Use po["Vendor Name"]

// OLD FAKE FILE NAMES - WILL BREAK SYSTEM  
data.items               // ❌ Use data['Items.json']
data.manufacturingOrders // ❌ Use data['ManufacturingOrderHeaders.json']
data.bomHeaders          // ❌ Use data['BillsOfMaterial.json']
data.bomDetails          // ❌ Use data['BillOfMaterialDetails.json']
```

---

## 🎯 VERIFIED CLEAN COMPONENTS

The following components have been **VERIFIED CLEAN** and use ONLY G: Drive field names:

### ✅ **PROTECTED COMPONENTS:**
1. **`CanoilEnterpriseHub.tsx`** - Main dashboard component
2. **`EnhancedInventoryHub.tsx`** - Enhanced inventory management
3. **`UnifiedMISysHub.tsx`** - Unified operations center
4. **`ComprehensiveDataExplorer.tsx`** - Data exploration interface

**Verification Date:** 2025-08-28  
**Old Field Name Instances:** 0 (ZERO)  
**Status:** ✅ FULLY COMPLIANT

---

## 🔧 BACKEND DATA STRUCTURE

### Flask Backend (`backend/app.py`)
```python
# Returns EXACT G: Drive file structure
return jsonify({
    "data": {
        "Items.json": [...],
        "ManufacturingOrderHeaders.json": [...],
        "BillsOfMaterial.json": [...],
        "BillOfMaterialDetails.json": [...],
        "PurchaseOrders.json": [...],
        "PurchaseOrderDetails.json": [...]
    }
})
```

### Frontend Data Access
```typescript
// CORRECT - Direct G: Drive field access
const items = data['Items.json'] || [];
const item = items.find(i => i["Item No."] === itemId);
const stock = parseFloat(item["Stock Quantity"] || 0);
```

---

## 🚨 ENFORCEMENT RULES

### **RULE 1: NO FIELD NAME CHANGES**
- Frontend MUST use exact G: Drive field names with bracket notation
- Backend MUST return raw G: Drive JSON without field mapping
- NO translation layers or field conversion allowed

### **RULE 2: NO FAKE DATA**
- NO mock arrays, hardcoded data, or placeholder values
- ALL data MUST come from latest G: Drive folder
- NO local data storage or caching with different field names

### **RULE 3: NO INTERMEDIATE MAPPINGS**
- NO `itemId` → `"Item No."` conversions
- NO `moStat` → `"Status"` mappings  
- NO field aliasing or renaming functions

### **RULE 4: EXACT FILE NAME MATCHING**
- Backend file names MUST match frontend expectations exactly
- NO `BillsOfMaterial.json` for both headers AND details
- USE `BillOfMaterialDetails.json` for details specifically

---

## 📝 CHANGE APPROVAL PROCESS

### **AUTHORIZED CHANGES ONLY:**
1. **G: Drive Structure Changes** - If MISys adds/removes fields
2. **New Component Creation** - Must follow this exact standard
3. **Bug Fixes** - That maintain field name compliance

### **CHANGE REVIEW CHECKLIST:**
Before ANY code changes:
- [ ] Uses ONLY G: Drive field names with brackets
- [ ] Uses ONLY exact `.json` file names  
- [ ] NO old field names (itemId, descr, mohId, etc.)
- [ ] NO fake or mock data
- [ ] Passes verification scan: `grep -r "\.(itemId|descr|mohId)" frontend/src/components/`

---

## 🔍 VERIFICATION COMMANDS

### Check for Old Field Names:
```bash
grep -r "\.(itemId|descr|qStk|moStat|bomItem|mohId|pohId)" frontend/src/components/
# RESULT MUST BE: No matches found
```

### Check for G: Drive Field Usage:
```bash
grep -r "\[\"[^\"]*\"\]" frontend/src/components/ | head -10
# RESULT MUST SHOW: Bracket notation field access
```

### Check File Structure:
```bash
grep -r "data\[.*\.json.*\]" frontend/src/components/ | head -10  
# RESULT MUST SHOW: Exact .json file names
```

---

## 🎯 SUCCESS METRICS

### **SYSTEM IS COMPLIANT WHEN:**
- ✅ 0 instances of old field names found
- ✅ All components use bracket notation for fields
- ✅ All file references use exact `.json` names
- ✅ Frontend data matches backend data 1:1
- ✅ No fake or mock data exists

### **SYSTEM IS BROKEN WHEN:**
- ❌ ANY old field names detected (itemId, descr, mohId, etc.)
- ❌ ANY dot notation field access for G: Drive fields  
- ❌ ANY fake data arrays or hardcoded values
- ❌ ANY field name translation or mapping logic

---

## 🛡️ PROTECTION GUARANTEE

This standard ensures:
1. **Perfect Data Alignment** - Frontend and backend always match
2. **No Data Loss** - All G: Drive fields are accessible
3. **Future Compatibility** - New G: Drive fields work automatically
4. **System Reliability** - No field name conflicts or undefined errors
5. **Maintenance Simplicity** - Single source of truth for all field names

**THIS STANDARD IS NON-NEGOTIABLE AND MUST BE PRESERVED.**

---

## 📊 MIILOC DATA STRUCTURE (2025-08-31)

### **NEW: MIILOC.json - Inventory Location Data**
**Purpose:** Contains inventory quantities by item and location  
**File Size:** 64,432 records  
**Date Added:** 2025-08-31

**EXACT Field Structure:**
```typescript
// Access pattern: data['MIILOC.json']
{
  "itemId": string,        // Item identifier (e.g., "CC BLACK CAP 28-400")
  "locId": string,         // Location identifier (e.g., "62TODD")
  "pick": string,          // Pick sequence (usually empty)
  "minLvl": number,        // Minimum Level
  "maxLvl": number,        // Maximum Level  
  "ordLvl": number,        // Reorder Level
  "ordQty": number,        // Reorder Quantity
  "lstPIDate": string,     // Last Physical Inventory Date (YYYYMMDD format)
  "variance": number,      // Variance amount
  "qStk": number,          // 🔥 Stock Quantity (main inventory)
  "qWIP": number,          // 🔥 Work In Process Quantity
  "qRes": number,          // 🔥 Reserved Quantity
  "qOrd": number,          // 🔥 On Order Quantity
  "iqStk": number,         // Inspection Stock Quantity
  "iqWIP": number,         // Inspection WIP Quantity
  "iqRes": number,         // Inspection Reserved Quantity
  "iqOrd": number,         // Inspection On Order Quantity
  "lstUseDate": string,    // Last Use Date (YYYYMMDD format)
  "fldXml": string,        // Field XML data ("<fields></fields>")
  "lstPIDt": string,       // Last Physical Inventory Date (MISys /Date()/ format)
  "lstUseDt": string,      // Last Use Date (MISys /Date()/ format)
  "rowVer": number[],      // Row version array (8 elements)
  "custFld1": string       // Custom Field 1 (usually empty)
}
```

**Key Stock Fields:**
- `qStk` = Available stock quantity
- `qWIP` = Work in process quantity  
- `qRes` = Reserved/allocated quantity
- `qOrd` = On order quantity

**Usage Example:**
```typescript
const locations = data['MIILOC.json'] || [];
const itemStock = locations.find(loc => 
  loc.itemId === "CC BLACK CAP 28-400" && loc.locId === "62TODD"
);
const availableQty = itemStock?.qStk || 0; // 7291 in example
```

---

*Document Created: 2025-08-28*  
*Last Updated: 2025-08-31 (Added MIILOC)*  
*Status: ENFORCED ✅*
