# TEST CASE: SO 3006 - Canoil Heavy Duty EP2

**Email Content:**
```
Hi Haron,

GRP Company Limited purchase order number 2025-001 (Canoil sales order 3006, attached) is ready to go out the door:

2 drums of Canoil Heavy Duty EP2
360 total net weight, batch number WH5B25G049

2 drums of Canoil Multipurpose & Wheel Bearing #2
360 total net weight, batch number WH5H08G017

On 1 pallet, 45×45×40 inches
```

---

## 📋 **EXPECTED PARSING RESULTS**

Based on the code I've verified:

### Email Analysis Should Extract:
- **SO Number:** 3006
- **Customer:** GRP Company Limited
- **PO Number:** 2025-001
- **Items:**
  - 2 drums Canoil Heavy Duty EP2 (batch: WH5B25G049)
  - 2 drums Canoil Multipurpose & Wheel Bearing #2 (batch: WH5H08G017)
- **Pallet:** 1 pallet, 45×45×40 inches
- **Weight:** 360 lbs per product (720 total)

### Dangerous Goods Detection:
**From code line 332-346 (LogisticsAutomation.tsx):**
```typescript
const dangerousGoodsPatterns = [
  '46XC', 'REOL46XC', 'CC46XC', 'TURBOFLUID 46XC',
  '46B', 'REOL46B', 'CC46B', 'TURBOFLUID 46B',
  '32BGT', '32B GT', 'REOL32BGT', 'CC32BGT', 'TURBOFLUID 32B'
];
```

**Analysis:** 
- ❌ "Heavy Duty EP2" - NOT in dangerous goods patterns
- ❌ "Multipurpose & Wheel Bearing #2" - NOT in dangerous goods patterns

**Result:** NO dangerous goods detected ❌

### USMCA Check:
**Will check:**
1. Destination country (from PDF)
2. HTS codes (from PDF)
3. Country of Origin (from PDF)

**Without PDF, cannot determine USMCA eligibility**

---

## 🧪 **HOW TO TEST THIS EXACT CASE**

### Step 1: Get the SO 3006 PDF

The email mentions "attached" PDF. You need:
```
G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\2024\[Month]\SalesOrder_3006.pdf
```

Or find it in the Sales Orders folder.

### Step 2: Open Logistics Automation

1. Go to `http://localhost:5173` (frontend must be running)
2. Navigate to Logistics Automation page

### Step 3: Paste Email and Upload PDF

**Email Text Box:**
```
Hi Haron,

GRP Company Limited purchase order number 2025-001 (Canoil sales order 3006, attached) is ready to go out the door:

2 drums of Canoil Heavy Duty EP2
360 total net weight, batch number WH5B25G049

2 drums of Canoil Multipurpose & Wheel Bearing #2
360 total net weight, batch number WH5H08G017

On 1 pallet, 45×45×40 inches
```

**PDF Upload:** `SalesOrder_3006.pdf`

### Step 4: Click "Process Logistics Request"

Watch the console (F12) for:
```
📧 Processing email...
📄 Parsing PDF...
✅ Data extraction complete
```

### Step 5: Click "Generate All Documents"

---

## 📊 **EXPECTED DOCUMENTS GENERATED**

### Guaranteed (Always Generated):
1. ✅ **BOL** (Bill of Lading)
   - File: `BOL_SO3006_[timestamp].html`
   - Contains: Addresses, weight, pallet info

2. ✅ **Packing Slip**
   - File: `PackingSlip_SO3006_[timestamp].html`
   - Contains: Items, quantities, batch numbers

### Conditional (Based on PDF Data):

3. **Commercial Invoice** - IF destination is USA/Mexico/International
   - File: `CommercialInvoice_SO3006_[timestamp].html`
   - Check: What country is "GRP Company Limited" in?

4. **Dangerous Goods** - ❌ NOT GENERATED
   - Reason: "Heavy Duty EP2" and "Multipurpose #2" are NOT in DG patterns
   - These are NOT REOLUBE 46XC/46B/32BGT products

5. **USMCA Certificate** - IF all 3 conditions met:
   - ✅ Destination is USA or Mexico (check PDF)
   - ✅ Items have HTS codes (check PDF)
   - ✅ HTS codes are on approved list (check PDF)
   - ✅ COO is CA/US/MX (check PDF)

6. **TSCA** - IF destination is USA
   - File: `TSCA_Certification_SO3006_[timestamp].pdf`

---

## 🔍 **WHAT TO CHECK IN PDF**

Open `SalesOrder_3006.pdf` and look for:

### Ship To Address:
- **If USA/Mexico:** Commercial Invoice, TSCA, possibly USMCA generated
- **If Canada:** Only BOL + Packing Slip generated
- **If Other:** Commercial Invoice generated

### HTS Codes:
Look for codes like:
- `2710.19.3500` (Lubricating Grease)
- `3403.19.5000` (Biodegradable greases)

**Check if codes are on approved USMCA list:**
```
2710.19.3500 ✅
2710.19.3080 ✅
2710.19.4590 ✅
7310.10.0015 ✅
3811.21.0000 ✅
3811.90 ✅
3403.19 ✅
3403.19.5000 ✅
```

### Country of Origin:
- **If Canada:** USMCA may apply
- **If Other:** USMCA won't apply

---

## 🎯 **PREDICTED OUTCOME**

### Most Likely Scenario:
```
✅ BOL generated
✅ Packing Slip generated
✅ Commercial Invoice generated (if international)
❌ NO Dangerous Goods (not REOLUBE products)
❌ NO SDS files (no DG)
❌ NO COFA files (no DG)
? USMCA (depends on PDF data - destination, HTS, COO)
? TSCA (depends on PDF - if USA destination)
```

### Files You Should See:
```
BOL_SO3006_20251015_[time].html
PackingSlip_SO3006_20251015_[time].html
CommercialInvoice_SO3006_20251015_[time].html (if international)
TSCA_Certification_SO3006_20251015_[time].pdf (if USA)
USMCA_Certificate_SO3006_20251015_[time].pdf (if qualifies)
```

**Total: 2-5 documents** depending on destination

---

## ❗ **IMPORTANT: Why NO Dangerous Goods**

The email mentions:
- "Canoil Heavy Duty EP2"
- "Canoil Multipurpose & Wheel Bearing #2"

**These are NOT dangerous goods because:**

The code only detects these patterns (lines 332-336):
```
'46XC', '46B', '32BGT', '32B GT'  ← REOLUBE products only
'REOL46XC', 'REOL46B', 'REOL32BGT'
'TURBOFLUID 46XC', 'TURBOFLUID 46B', 'TURBOFLUID 32B'
```

**Your products:**
- "EP2" - NOT in the list ❌
- "#2" - NOT in the list ❌

**Conclusion:** NO dangerous goods declarations will be generated for SO 3006

---

## 📝 **WHAT TO REPORT BACK**

After testing SO 3006, tell me:

1. **What documents were generated?**
   - List the files that downloaded

2. **What did the backend console say?**
   - Copy/paste the output

3. **Did "Generate All" button work?**
   - Did files download automatically?
   - Were there any errors?

4. **What destination country is in the PDF?**
   - This determines which documents should generate

5. **Are there HTS codes in the PDF?**
   - This determines USMCA eligibility

---

## 🚀 **TESTING STEPS SUMMARY**

```bash
# 1. Start backend
cd canoil-portal/backend
python app.py

# 2. Start frontend (new terminal)
cd canoil-portal/frontend
npm run dev

# 3. Open browser
http://localhost:5173

# 4. Paste email + Upload PDF
[Paste the email text above]
[Upload SalesOrder_3006.pdf]

# 5. Click "Process Logistics Request"
[Wait for parsing]

# 6. Click "Generate All Documents"
[Watch console and downloads]
```

---

**This is a real test with real data. Run it and show me the results!**

