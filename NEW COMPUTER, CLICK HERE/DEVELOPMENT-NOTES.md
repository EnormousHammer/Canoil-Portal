# 🛠️ CANOIL PORTAL - DEVELOPMENT NOTES

## 🎯 Current Project Status

### ✅ Recently Completed Features

#### Stock Intelligence System
- **Real Data Integration**: Fixed parsing of comma-separated stock values
- **Smart Low Stock Detection**: Using actual `Reorder Level` vs `Stock` comparison
- **Accurate Cost Calculations**: Prioritizing `Recent Cost` over outdated standards
- **Business Intelligence**: Real reorder value calculations for purchasing decisions

#### Manufacturing Order Intelligence
- **Honest Status Tracking**: 
  - Status 0: Pending (42 MOs)
  - Status 1: Active (178 MOs)
  - Status 2: Closed (3693 MOs)
- **Smart BOM Planning**: Detects active MOs before creating new ones
- **Complete MO Data**: All 50+ fields displayed in hover tooltips

#### Vendor & Pricing Accuracy
- **Correct Vendor Display**: Using `Name` field (actual vendor) not `Buyer` (employee)
- **Latest Pricing**: `Recent Cost` prioritized in all calculations
- **Real Financial Data**: No more mock or average pricing

---

## 🏗️ Architecture Overview

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Lucide React** for icons

### Backend Stack
- **Python Flask** for API server
- **Direct JSON file reading** from G: Drive
- **CORS enabled** for frontend communication

### Data Flow
```
G: Drive JSON Files → Flask API → React Frontend → Dashboard Display
```

---

## 📊 Key Data Sources

### Primary Files
| File | Purpose | Key Fields |
|------|---------|------------|
| `CustomAlert5.json` | Inventory & Stock | `Stock`, `Reorder Level`, `Recent Cost` |
| `ManufacturingOrderHeaders.json` | MO Tracking | `Status`, `Customer`, `Build Item No.` |
| `PurchaseOrders.json` | Procurement | `Name` (vendor), `Total Amount` |
| `BillOfMaterialDetails.json` | BOM Structure | `Parent Item No.`, `Component Item No.` |

### Data Field Priorities
```typescript
// Cost/Price Fields (Priority Order)
Recent Cost → Unit Cost → Standard Cost → Average Cost → Landed Cost

// Vendor Fields (Correct Usage)
Name (actual vendor) NOT Buyer (employee)

// Stock Fields (Proper Logic)
Stock ≤ Reorder Level = Low Stock Alert
```

---

## 🧩 Component Architecture

### Main Components
```
CanoilEnterpriseHub.tsx          # Main dashboard hub
├── Enhanced KPI Cards           # Real-time metrics
├── Manufacturing Intelligence   # MO status & details
├── Purchase Intelligence        # PO & vendor tracking
├── Stock Intelligence          # Low stock alerts
└── Recent Activities           # Latest business data

BOMPlanningHub.tsx              # BOM planning with MO detection
├── Smart MO Detection          # Prevents duplicate planning
├── Real Cost Calculations      # Using Recent Cost data
├── Stock Availability         # Live inventory checks
└── Component Analysis         # Where-used tracking
```

### Data Services
```
GDriveDataLoader.ts             # Data loading & caching
├── JSON file reading
├── Data transformation
└── Error handling

stockUtils.ts                   # Stock calculations
├── Real stock parsing
├── Reorder logic
└── Location tracking
```

---

## 🔧 Development Patterns

### Data Parsing
```typescript
// Handle comma-separated values
const parseStockValue = (value: any) => {
  if (!value) return 0;
  return parseFloat(String(value).replace(/,/g, '')) || 0;
};

// Prioritize recent pricing
const cost = item["Recent Cost"] || item["Unit Cost"] || item["Standard Cost"];
```

### Error Handling
```typescript
// Graceful fallbacks
const vendor = po["Name"] || po["Supplier No."] || 'Unknown Vendor';
const status = mo["Status"] === 0 ? 'Pending' : 
               mo["Status"] === 1 ? 'Active' : 'Closed';
```

### Performance Optimization
```typescript
// Memoized calculations
const inventoryMetrics = useMemo(() => {
  // Heavy calculations here
}, [data['CustomAlert5.json']]);
```

---

## 🚨 Important Conventions

### Field Name Standards
- **Always use exact field names** from JSON data
- **Prioritize Recent/Current data** over historical
- **Handle missing data gracefully** with fallbacks

### Status Code Interpretations
```typescript
// MO Status Codes (Based on actual data analysis)
0 = Pending    // 42 MOs - awaiting release
1 = Active     // 178 MOs - in production
2 = Closed     // 3693 MOs - completed with close dates

// NOT the assumed:
// 0 = Pending, 1 = Released, 2 = In Progress, 3 = Completed
```

### Data Validation
```typescript
// Always validate data existence
if (!data['CustomAlert5.json'] || !Array.isArray(data['CustomAlert5.json'])) {
  return defaultValue;
}

// Handle numeric conversions safely
const stock = parseFloat(String(item["Stock"] || 0).replace(/,/g, '')) || 0;
```

---

## 🎯 Next Development Areas

### Potential Enhancements
1. **Advanced Analytics**: Trend analysis, forecasting
2. **Automated Workflows**: Auto-reorder triggers, MO optimization
3. **Mobile Responsiveness**: Tablet/phone dashboard views
4. **Data Export**: Excel/PDF report generation
5. **User Management**: Role-based access, preferences

### Performance Improvements
1. **Data Caching**: Smart refresh strategies
2. **Virtual Scrolling**: For large data sets
3. **Progressive Loading**: Lazy load non-critical data
4. **Search Optimization**: Indexed search for faster results

---

## 🐛 Known Issues & Solutions

### Resolved Issues ✅
- ❌ Stock values with commas not parsing → ✅ Fixed with proper string handling
- ❌ Wrong vendor names (showing employees) → ✅ Using correct `Name` field
- ❌ Outdated pricing data → ✅ Prioritizing `Recent Cost`
- ❌ Confusing MO status display → ✅ Honest status based on actual data

### Current Limitations
- **G: Drive Dependency**: Requires network access to shared drive
- **Manual Data Refresh**: No real-time updates (file-based)
- **Large Dataset Performance**: May slow with thousands of records

---

## 📚 Code Style Guide

### TypeScript Conventions
- Use `any` sparingly, prefer proper typing when possible
- Descriptive variable names: `lowStockItems` not `items`
- Comment complex business logic thoroughly

### React Patterns
- Functional components with hooks
- Memoization for expensive calculations
- Clear prop interfaces

### CSS/Styling
- Tailwind utility classes
- Responsive design patterns
- Consistent color schemes for status indicators

---

## 🚀 Deployment Notes

### Development Mode
```bash
npm run dev    # Frontend (Vite)
python app.py  # Backend (Flask)
```

### Production Build
```bash
npm run build  # Creates dist/ folder
# Serve dist/ folder with any web server
```

### Environment Setup
- Ensure G: Drive network access
- Verify Python/Node.js versions
- Check firewall for local development ports

---

**Happy Development! 🎉**

*This project represents a complete enterprise dashboard with real business intelligence capabilities. Continue building on this solid foundation.*
