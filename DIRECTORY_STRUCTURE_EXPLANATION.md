# Directory Structure Explanation
**Date:** 2025-12-20

---

## 📂 **CURRENT STRUCTURE**

### **Parent Directory:**
```
G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\
├── canoil-portal\          ← THE REAL PROJECT (backend + frontend here)
├── WORKFLOW FROM CANOIL HELPER TO SAGE\
├── .cursor\
├── logs\
├── uploads\
├── test_output\
├── generated_documents\
└── env for render\
```

### **Inside canoil-portal (THE REAL PROJECT):**
```
G:\...\Canoil Helper\canoil-portal\
├── backend\                ← REAL BACKEND (Flask app)
│   ├── app.py
│   ├── start_app.py
│   └── ...
├── frontend\               ← REAL FRONTEND (React/Vite)
│   ├── src\
│   ├── package.json
│   └── ...
├── .git\
├── Dockerfile\
├── vercel.json\
└── ...
```

---

## ✅ **WHICH IS THE REAL ONE?**

### **✅ USED BY CANOIL-PORTAL:**
- **`canoil-portal/backend/`** ← This is the REAL backend
- **`canoil-portal/frontend/`** ← This is the REAL frontend

### **❌ NOT USED (Was in parent directory):**
- **`Canoil Helper/backend/`** ← This was DELETED (was not used)
- **`Canoil Helper/frontend/`** ← This doesn't exist

---

## 🎯 **KEY POINT**

**The parent directory (`Canoil Helper`) is just a container folder.**

**The actual project is inside `canoil-portal/` folder:**
- All the real code is in `canoil-portal/backend/` and `canoil-portal/frontend/`
- The parent directory just has leftover files, folders, and documentation

---

## 📍 **WHERE TO LOOK**

### **For the Real Project:**
- Go to: `G:\...\Canoil Helper\canoil-portal\`
- You'll see: `backend/` and `frontend/` folders ← These are the real ones

### **Parent Directory:**
- `G:\...\Canoil Helper\` (parent)
- Contains: leftover files, documentation, test scripts
- Does NOT contain the real backend/frontend

---

**Summary:** The real backend and frontend are INSIDE the `canoil-portal` folder, not in the parent directory.


