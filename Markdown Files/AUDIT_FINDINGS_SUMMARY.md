# Project Usage Audit - Findings Summary
**Date:** 2025-12-20  
**Purpose:** Identify what's actually being used vs unused (NO DELETIONS - Analysis Only)

---

## ✅ **ACTIVE & IN USE**

### Backend
- **`backend/app.py`** - PRIMARY BACKEND ✅
  - 24 API routes defined
  - Used by all frontend components
  - Local: `http://localhost:5002`
  - Cloud Run: `https://canoil-backend-711358371169.us-central1.run.app`

### Frontend Configuration
- **`frontend/src/utils/apiConfig.ts`** - CENTRALIZED CONFIG ✅
  - **12 components** properly use this:
    - GDriveDataLoader.ts
    - RevolutionaryCanoilHub.tsx
    - AICommandCenter.tsx
    - LogisticsAutomation.tsx
    - PurchaseRequisitionModal.tsx
    - GmailCleanEmail.tsx
    - AIEmailAssistant.tsx
    - App.tsx
    - (and 4 more)

### Deployment Configs (All Exist)
- ✅ Dockerfile
- ✅ render.yaml
- ✅ vercel.json (routes to Cloud Run, NOT api folder)
- ✅ Procfile
- ✅ start.sh

### Startup Scripts (All Exist)
- ✅ backend/start_app.py (local dev)
- ✅ backend/start_hypercorn.py (Cloud Run)
- ✅ backend/start_server.py
- ✅ start.sh
- ✅ Procfile
- ✅ launch-canoil.bat
- ✅ launch-canoil.ps1

---

## ⚠️ **NEEDS ATTENTION**

### 1. Hardcoded Backend URL (Bypasses apiConfig)
- **`frontend/src/services/mpsDataService.ts`** (line 17)
  - Uses: `https://canoil-portal-backend-711358371169.us-central1.run.app` ❌
  - Should use: `apiConfig.ts` instead
  - **ISSUE:** Different URL than rest of app (`canoil-portal-backend` vs `canoil-backend`)

### 2. Potentially Unused Components (22 files)
These components exist but are NOT imported anywhere:
- ComprehensiveDataExplorer.tsx
- StockAllocationTracker.tsx
- IntelligentSOEntry.tsx
- DataTest.tsx
- CleanVisualBOM.tsx
- KeyboardShortcutsHelp.tsx
- MISysDataGrid.tsx
- CleanIntelligentSOEntry.tsx
- RevolutionaryDataDisplay.tsx
- EnterpriseProductionVisualization.tsx
- InteractiveProductionSchedule.tsx
- VisualProductionDashboard.tsx
- TimelineProductionSchedule.tsx
- RevolutionaryCanoilHub_clean.tsx
- temp_file.tsx
- UserSelectionModal.tsx
- UltimateEnterpriseLoadingScreen.tsx
- EnterpriseLoginScreen.tsx
- SimpleProductionCalendar.tsx
- GmailStyleEmail.tsx
- GmailLikeEmail.tsx
- SparkStyleEmailView.tsx

**NOTE:** Some may be used dynamically or conditionally. Verify before removing.

---

## ❌ **UNUSED/LEGACY**

### API Folder (Not Connected)
- **`api/index.py`** - Vercel serverless wrapper
  - ❌ NOT referenced in vercel.json
  - ❌ NOT imported anywhere
  - ❌ vercel.json routes to Cloud Run instead
  - **Status:** LEGACY/UNUSED

- **`api/health.py`** - Health check
  - ❌ NOT referenced
  - **Status:** UNUSED

- **`api/test.py`** - Test endpoint
  - ❌ NOT referenced
  - **Status:** UNUSED

**Note:** The only references to "api/" are in route definitions like `/api/health` (which go to backend/app.py, not api/health.py)

---

## 📊 **BACKEND URL ANALYSIS**

### URLs Found in Code:
1. **`localhost:5002`** ✅
   - Used in: apiConfig.ts, mpsDataService.ts, test files
   - **Status:** CORRECT (local development)

2. **`canoil-backend-711358371169.us-central1.run.app`** ✅
   - Used in: apiConfig.ts, vercel.json
   - **Status:** CORRECT (Cloud Run production)

3. **`canoil-portal-backend-711358371169.us-central1.run.app`** ⚠️
   - Used in: mpsDataService.ts ONLY
   - **Status:** WRONG URL (different service name)
   - **Action Needed:** Fix to use apiConfig.ts

---

## 🔍 **VERIFICATION NEEDED**

### Questions to Answer:
1. **Does `canoil-portal-backend` Cloud Run service exist?**
   - Or is it a typo and should be `canoil-backend`?
   - Run: `gcloud run services list --region=us-central1`

2. **Are the 22 "unused" components actually unused?**
   - Some may be loaded dynamically
   - Some may be for future features
   - Check if they're referenced in:
     - Dynamic imports
     - Route definitions
     - Conditional rendering

3. **Should `api/` folder be kept?**
   - If planning to use Vercel serverless functions in future: KEEP
   - If not: Can be removed (but NOT deleting per user request)

---

## 📝 **RECOMMENDATIONS**

### Immediate Fix:
1. **Fix `mpsDataService.ts`** to use `apiConfig.ts`:
   ```typescript
   // Change from:
   const PORTAL_BACKEND_URL = IS_PRODUCTION
     ? 'https://canoil-portal-backend-711358371169.us-central1.run.app'
     : 'http://localhost:5002';
   
   // To:
   import { API_BASE_URL } from '../utils/apiConfig';
   const PORTAL_BACKEND_URL = API_BASE_URL;
   ```

### Future Cleanup (After Verification):
1. Verify which Cloud Run service actually exists
2. Check if unused components are truly unused
3. Decide on api/ folder (keep for future or remove)

---

## ✅ **CONFIRMED ACTIVE ARCHITECTURE**

```
Frontend (Vercel)
    ↓
vercel.json routes /api/* to
    ↓
Google Cloud Run: canoil-backend-711358371169.us-central1.run.app
    ↓
backend/app.py (Flask)
    ↓
Google Drive API (Cloud Run) OR Local G: Drive (Local Dev)
```

**Local Development:**
- Frontend: `localhost:5001` (Vite)
- Backend: `localhost:5002` (Flask)
- Data: Local G: Drive mount

**Production:**
- Frontend: Vercel
- Backend: Cloud Run
- Data: Google Drive API

---

## 📋 **AUDIT COMPLETE**

**No files were deleted or moved during this audit.**  
This is analysis only to identify what's used vs unused.

**Next Steps:**
1. Fix mpsDataService.ts URL issue
2. Verify Cloud Run service names
3. Review unused components list
4. Decide on api/ folder future

