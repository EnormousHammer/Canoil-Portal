# 🚀 CANOIL PORTAL - NEW COMPUTER SETUP

## ⚡ QUICK START (One-Click Setup)

1. **Double-click `SETUP.bat`** in this folder
2. Follow the prompts to install Node.js and Python
3. The script will automatically install all dependencies
4. Use `launch-canoil.bat` in the main folder to start the project

---

## 📋 MANUAL SETUP (If needed)

### Prerequisites
- **Node.js** (LTS version): https://nodejs.org/
- **Python 3.8+**: https://python.org/downloads/
- **Git** (optional): https://git-scm.com/

### Installation Steps

1. **Install Node.js Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Install Python Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Start the Application**
   ```bash
   # Option 1: Use the launcher
   launch-canoil.bat
   
   # Option 2: Manual start
   # Terminal 1 (Backend):
   cd backend
   python app.py
   
   # Terminal 2 (Frontend):
   cd frontend
   npm run dev
   ```

---

## 🎯 PROJECT STRUCTURE

```
canoil-portal/
├── frontend/           # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/ # Main dashboard components
│   │   ├── pages/      # Page components
│   │   ├── services/   # Data loading services
│   │   └── utils/      # Utility functions
│   ├── package.json    # Frontend dependencies
│   └── vite.config.js  # Build configuration
├── backend/            # Python Flask API
│   ├── app.py          # Main server file
│   └── requirements.txt # Python dependencies
└── launch-canoil.bat   # Start both servers
```

---

## 🔧 KEY FEATURES IMPLEMENTED

### ✅ Dashboard Components
- **CanoilEnterpriseHub.tsx** - Main enterprise dashboard
- **BOMPlanningHub.tsx** - Bill of Materials planning with MO detection
- **Enhanced KPI Cards** - Real-time metrics with detailed breakdowns

### ✅ Data Integration
- **Real MiSys Data** - Direct integration with G: Drive JSON extractions
- **CustomAlert5.json** - Primary inventory and stock data
- **ManufacturingOrderHeaders.json** - Complete MO tracking
- **PurchaseOrders.json** - Vendor and procurement data

### ✅ Business Intelligence
- **Stock Management** - Real low stock alerts with reorder calculations
- **MO Intelligence** - Smart status tracking (Pending/Active/Closed)
- **Vendor Accuracy** - Correct vendor names vs employee buyers
- **Latest Pricing** - Recent Cost prioritized over outdated standards

---

## 💡 DEVELOPMENT NOTES

### Important Files to Know
- `frontend/src/components/CanoilEnterpriseHub.tsx` - Main dashboard
- `frontend/src/components/BOMPlanningHub.tsx` - BOM planning with MO detection
- `backend/app.py` - Data API server
- `frontend/src/services/GDriveDataLoader.ts` - Data loading service

### Data Source Configuration
The application reads from:
```
G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\2025-09-03\
```

### Key Data Fields Used
- **Stock Data**: `CustomAlert5.json` → `Stock`, `Reorder Level`, `Recent Cost`
- **MO Data**: `ManufacturingOrderHeaders.json` → `Status`, `Customer`, `Build Item No.`
- **PO Data**: `PurchaseOrders.json` → `Name` (vendor), `Buyer` (employee)

---

## 🐛 TROUBLESHOOTING

### Common Issues

1. **Port Already in Use**
   - Frontend runs on: http://localhost:5173
   - Backend runs on: http://localhost:5000
   - Kill processes if ports are busy

2. **Data Not Loading**
   - Check G: Drive path accessibility
   - Verify JSON files exist in the API Extractions folder
   - Check browser console for errors

3. **Dependencies Issues**
   - Delete `node_modules` and run `npm install` again
   - Try `pip install --upgrade -r requirements.txt`

4. **Build Errors**
   - Check TypeScript errors in console
   - Verify all imports are correct
   - Run `npm run build` to check for build issues

---

## 🔄 RECENT MAJOR UPDATES

### Stock Intelligence ✅
- Fixed comma-separated stock value parsing
- Real low stock detection using `Reorder Level` vs `Stock`
- Accurate reorder value calculations

### MO Status Accuracy ✅
- Status 0: Pending (42 MOs)
- Status 1: Active (178 MOs) 
- Status 2: Closed (3693 MOs)
- No more fake "In Progress" numbers

### Pricing Accuracy ✅
- Prioritized `Recent Cost` over `Standard Cost`
- Real current market pricing throughout application

### Vendor Accuracy ✅
- Fixed PO vendor display to show `Name` (actual vendor)
- No longer showing `Buyer` (employee) as vendor

---

## 📞 SUPPORT

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check the terminal/command prompt for server errors
3. Verify the G: Drive path is accessible
4. Ensure all dependencies are installed correctly

---

## 🚀 READY TO DEVELOP!

After setup, you'll have:
- ✅ Full development environment
- ✅ Real data integration
- ✅ Enterprise-level dashboard
- ✅ Accurate business intelligence
- ✅ Modern React + TypeScript stack

**Happy coding! 🎉**
