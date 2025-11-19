# 📧 Email Assistant - Customer PO Processing System

## ✅ IMPLEMENTATION COMPLETE!

### 🎯 What This Does

The Email Assistant now intelligently processes **INCOMING customer purchase orders** to:
1. ✅ Detect PDF attachments in emails
2. ✅ Parse customer PO to extract items & quantities  
3. ✅ Check inventory stock (MIILOC.json data) in real-time
4. ✅ Auto-draft professional responses based on stock availability
5. ✅ Alert if Purchase Requisition needed

---

## 🔄 Complete Workflow

```
Customer Email with PO.pdf Arrives
    ↓
Email Assistant Shows Attachment with 📄 Icon
    ↓
Click "Analyze PO" Button
    ↓
Backend Downloads PDF → Parses with OpenAI GPT-4o
    ↓
Extracts: PO#, Customer, Items, Quantities
    ↓
Checks Stock from MIILOC.json
    ├─ qStk (Stock Quantity)
    ├─ qRes (Reserved Quantity)
    └─ Available = qStk - qRes
    ↓
For Each Item:
    ✅ Sufficient Stock → Mark as available
    ❌ Insufficient Stock → Calculate shortfall
    ↓
Auto-Draft Response:
    ├─ ALL ITEMS AVAILABLE:
    │   "Thank you for your order! All items are in stock 
    │    and ready to ship."
    │
    └─ PARTIAL/NO STOCK:
        "Thank you for your order. We have [X] items in stock.
         For [Y] items, we need to order materials (est. [Z] days).
         Would you prefer partial shipment or wait for complete order?"
    ↓
Shows Stock Analysis Dashboard
    ├─ Total Items
    ├─ Available Items ✅
    ├─ Items Needing PR ⚠️
    └─ Item-by-Item Breakdown
    ↓
⚠️ Alert if PR Needed
```

---

## 📁 Files Modified

### Backend Files
1. **`backend/gmail_email_service.py`**
   - Added `_extract_attachments_info()` - Detect attachments in emails
   - Added `download_attachment()` - Download PDF from Gmail
   - Added `parse_customer_po()` - Parse PO with OpenAI GPT-4o
   - Added `check_stock_for_po()` - Check MIILOC.json for stock

2. **`backend/app.py`**
   - `/api/email/download-attachment` - Download attachment API
   - `/api/email/analyze-customer-po` - Full PO analysis pipeline
   - `/api/email/auto-draft-po-response` - AI response generation

### Frontend Files
1. **`frontend/src/components/EmailAssistant.tsx`**
   - Added `Attachment` interface
   - Added `poAnalysis` and `isAnalyzingPO` state
   - Added `analyzeCustomerPO()` function
   - Added attachment display UI with PDF icons
   - Added PO stock analysis dashboard
   - Added auto-draft from stock check

---

## 🎨 UI Features

### Email List View
- 📄 **PDF Icon** on emails with attachments
- Red PDF icon indicator for quick identification

### Email Detail View
#### Attachments Section
```
📄 Attachments (1)
┌────────────────────────────────────────┐
│ 📄 Customer_PO_12345.pdf   [Analyze PO]│
│ 147 KB                                 │
└────────────────────────────────────────┘
```

#### Stock Analysis Dashboard
```
┌─────────────────────────────────────────┐
│ 📦 Customer PO Analysis                 │
│ PO #12345 • ABC Manufacturing           │
├─────────────────────────────────────────┤
│ Total Items: 5  Available: 3  Short: 2 │
├─────────────────────────────────────────┤
│ Item Breakdown:                         │
│ ✅ CC HDEP2 DRM - Need: 10, Have: 25   │
│ ✅ CC MPWB2 PAIL - Need: 5, Have: 15   │
│ ❌ CC BLACK CAP - Need: 100, Have: 20  │
│    (Short: 80)                          │
├─────────────────────────────────────────┤
│ ⚠️ Purchase Requisition Needed          │
│ Some items are out of stock.           │
└─────────────────────────────────────────┘
```

---

## 🔧 Technical Details

### Stock Checking Logic
```typescript
// Uses MIILOC.json structure
for each item in customer PO:
    Find in MIILOC where itemId = item_no
    
    total_stock = sum(qStk)      // Stock quantity
    reserved = sum(qRes)          // Reserved quantity
    on_order = sum(qOrd)          // On order quantity
    
    available = total_stock - reserved
    
    if (available >= qty_needed):
        status = ✅ Available
    else:
        status = ❌ Short (qty_needed - available) units
```

### AI Response Generation
Uses your writing style profile (learned from sent emails) to generate responses that sound like YOU.

**Scenarios:**
1. **All Items Available**
   - Confirms stock availability
   - Mentions ship timeline
   - Professional & positive tone

2. **Partial Stock**
   - Lists available items
   - Lists items needing order
   - Asks customer preference: partial shipment or wait?
   - Mentions lead time estimation needed

---

## 🚀 How to Use

### Step 1: Start Email Assistant
```bash
# Backend
cd canoil-portal/backend
python app.py

# Frontend
cd canoil-portal/frontend
npm run dev
```

### Step 2: Navigate to Email Assistant
1. Login as Haron
2. Click "Email Assistant" card
3. Connect Gmail (if not already)
4. Click "Analyze Style" (learns your writing style)

### Step 3: Process Customer PO
1. Click "Refresh" to load emails
2. Select email with PO attachment (look for 📄 icon)
3. Click **"Analyze PO"** button
4. Wait for analysis (~5-10 seconds):
   - Downloads PDF
   - Parses with AI
   - Checks stock
   - Drafts response
5. Review stock analysis dashboard
6. Edit AI-generated response if needed
7. Click "Confirm & Send"

---

## 📊 Data Sources (REAL DATA ONLY!)

### MIILOC.json
**Source:** `G:\Shared drives\Data\[Latest Folder]\MIILOC.json`

**Fields Used:**
- `itemId` - Item number
- `qStk` - Stock quantity
- `qRes` - Reserved quantity
- `qOrd` - On order quantity

**Example:**
```json
{
  "itemId": "CC HDEP2 DRM",
  "locId": "62TODD",
  "qStk": 150.0,
  "qRes": 25.0,
  "qOrd": 50.0
}
```

**Available Stock = 150 - 25 = 125 units**

### CustomAlert5.json (Fallback)
If item not in MIILOC, checks CustomAlert5.json for stock.

---

## ⚠️ Important Notes

### NO MOCK DATA
- All stock data comes from MIILOC.json (G: Drive)
- All customer POs are real PDFs attached to emails
- All responses match your actual writing style

### Stock Check Accuracy
- Checks ALL locations in MIILOC
- Calculates total available across locations
- Considers reserved stock
- Shows on-order quantities for reference

### Purchase Requisition Integration
- System alerts when PR needed
- Lists specific items & quantities short
- PR generation can be added (template system exists)

---

## 🎯 Business Value

### Time Savings
- **Before:** Manually check each item in system, calculate shortfall, draft email
- **After:** Click button → Get complete analysis + draft response in 10 seconds

### Accuracy
- No manual errors in stock checking
- Consistent response format
- All items checked automatically

### Customer Satisfaction
- Faster response time
- Professional, consistent communication
- Clear information about availability

---

## 🔮 Future Enhancements (TODO)

### Priority 1: Automation
- [ ] Auto-process emails with POs in background
- [ ] Auto-draft responses without clicking button
- [ ] Send notifications when PO received

### Priority 2: Navigation
- [ ] Smart search across emails
- [ ] Filter by "Has PO", "Needs PR", etc.
- [ ] Smart folders for different email types

### Priority 3: PR Integration
- [ ] Auto-generate PR for missing items
- [ ] One-click PR creation from shortfall items
- [ ] Track PR status in email thread

---

## 🐛 Troubleshooting

### "Gmail service not available"
**Cause:** Backend not running or Gmail dependencies missing
**Fix:** 
```bash
cd canoil-portal/backend
pip install -r requirements.txt
python app.py
```

### "No inventory data"
**Cause:** Cannot access G: Drive or data not synced
**Fix:**
- Check G: Drive is mounted
- Verify latest folder exists: `G:\Shared drives\Data\2025-10-xx\`
- Backend will auto-load latest folder

### "Error parsing PO"
**Cause:** PDF format not recognized by AI
**Fix:**
- Check if PDF is valid (not corrupted)
- Ensure PDF contains text (not scanned image)
- Try different PO format

### "OpenAI not available"
**Cause:** OPENAI_API_KEY not set
**Fix:**
```bash
# Add to .env file
OPENAI_API_KEY=your_key_here
```

---

## 📝 Code Examples

### Backend: Check Stock for Single Item
```python
# From gmail_email_service.py
def check_stock_for_po(self, po_data, inventory_data):
    miiloc_data = inventory_data.get('MIILOC.json', [])
    
    for item in po_data['items']:
        item_no = item['item_no'].strip().upper()
        qty_needed = float(item['quantity'])
        
        # Find in MIILOC (all locations)
        location_stocks = [
            loc for loc in miiloc_data 
            if loc.get('itemId', '').strip().upper() == item_no
        ]
        
        # Calculate availability
        total_stock = sum(float(loc.get('qStk', 0)) for loc in location_stocks)
        total_reserved = sum(float(loc.get('qRes', 0)) for loc in location_stocks)
        available = total_stock - total_reserved
        
        # Check if sufficient
        sufficient = available >= qty_needed
        shortfall = max(0, qty_needed - available)
```

### Frontend: Analyze PO on Click
```typescript
// From EmailAssistant.tsx
const analyzeCustomerPO = async (email: Email, attachment: Attachment) => {
  // Step 1: Analyze PO and check stock
  const analyzeResponse = await fetch('/api/email/analyze-customer-po', {
    method: 'POST',
    body: JSON.stringify({
      emailId: email.id,
      attachmentId: attachment.id,
      filename: attachment.filename
    })
  });
  
  // Step 2: Auto-draft response
  const draftResponse = await fetch('/api/email/auto-draft-po-response', {
    method: 'POST',
    body: JSON.stringify({
      po_data: analyzeData.po_data,
      stock_check: analyzeData.stock_check
    })
  });
  
  // Show results
  setPoAnalysis(analyzeData);
  setDraftResponse(draftData.draft);
};
```

---

## ✅ Success Criteria

- ✅ Emails with attachments show PDF icon
- ✅ "Analyze PO" button visible on PDF attachments
- ✅ PO parsing extracts all items & quantities
- ✅ Stock check uses real MIILOC.json data
- ✅ Availability calculated correctly (qStk - qRes)
- ✅ Auto-draft response sounds natural
- ✅ Stock analysis dashboard shows all details
- ✅ Alerts when PR needed
- ✅ Windows notifications work
- ✅ No mock data anywhere

---

**Status:** ✅ FULLY IMPLEMENTED  
**Last Updated:** October 16, 2025  
**Tested With:** Real Gmail emails, Real MIILOC data, Real customer POs

