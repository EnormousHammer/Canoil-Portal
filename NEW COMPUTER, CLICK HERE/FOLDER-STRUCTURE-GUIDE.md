# 📁 CANOIL PORTAL - FOLDER STRUCTURE GUIDE

## 🎯 WHERE TO PUT THE PROJECT ON NEW COMPUTER

### ✅ RECOMMENDED LOCATIONS

#### **Windows:**
```
C:\APPLICATIONS MADE BY ME\WINDOWS\Canoil Helper\canoil-portal\
```
**OR**
```
C:\Development\canoil-portal\
C:\Projects\canoil-portal\
C:\Code\canoil-portal\
```

#### **Mac:**
```
/Users/[YourUsername]/Development/canoil-portal/
/Users/[YourUsername]/Projects/canoil-portal/
```

#### **Linux:**
```
/home/[username]/Development/canoil-portal/
/home/[username]/Projects/canoil-portal/
```

---

## 📂 COMPLETE PROJECT STRUCTURE

After copying, your folder should look like this:

```
canoil-portal/                          ← Main project folder
├── NEW COMPUTER, CLICK HERE/           ← Setup package (this folder!)
│   ├── SETUP.bat                      ← Main setup script
│   ├── CHECK-REQUIREMENTS.bat         ← Requirements checker
│   ├── INSTALL-NODEJS.bat             ← Node.js installer helper
│   ├── INSTALL-PYTHON.bat             ← Python installer helper
│   ├── QUICK-START.md                 ← Simple instructions
│   ├── README-NEW-COMPUTER.md         ← Detailed guide
│   ├── DEVELOPMENT-NOTES.md           ← Project status
│   └── FOLDER-STRUCTURE-GUIDE.md      ← This file
├── frontend/                          ← React TypeScript app
│   ├── src/
│   │   ├── components/
│   │   │   ├── CanoilEnterpriseHub.tsx    ← Main dashboard
│   │   │   ├── BOMPlanningHub.tsx         ← BOM planning
│   │   │   ├── MISysDataGrid.tsx          ← Data grid component
│   │   │   └── [other components...]
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── public/
│   ├── package.json                   ← Frontend dependencies
│   ├── package-lock.json
│   ├── vite.config.js
│   └── tsconfig.json
├── backend/                           ← Python Flask API
│   ├── app.py                         ← Main server file
│   └── requirements.txt               ← Python dependencies
├── launch-canoil.bat                  ← Start both servers
├── package.json                       ← Root package file
├── package-lock.json
└── [other root files...]
```

---

## 🚀 TRANSFER STEPS

### Step 1: Copy the Entire Project
1. **Copy the ENTIRE `canoil-portal` folder**
2. **Paste it to your chosen location** (e.g., `C:\Development\`)
3. **Verify all files copied** - especially the `NEW COMPUTER, CLICK HERE` folder

### Step 2: Navigate to Setup
1. **Open the copied project folder**
2. **Enter the `NEW COMPUTER, CLICK HERE` folder**
3. **Start with the setup process**

### Step 3: Quick Verification
Make sure these key files exist:
- ✅ `NEW COMPUTER, CLICK HERE/SETUP.bat`
- ✅ `frontend/package.json`
- ✅ `backend/requirements.txt`
- ✅ `launch-canoil.bat`

---

## ⚠️ IMPORTANT NOTES

### Avoid These Locations:
- ❌ **OneDrive/Dropbox folders** (sync conflicts)
- ❌ **Desktop** (cluttered, hard to find)
- ❌ **Downloads** (temporary location)
- ❌ **Program Files** (permission issues)

### Network Drive Requirements:
The project needs access to:
```
G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\
```
Make sure this path is accessible on the new computer.

---

## 🎯 RECOMMENDED WORKFLOW

### Development Folder Structure:
```
C:\Development\                         ← Your main dev folder
├── canoil-portal/                     ← This project
├── other-projects/
└── tools/
```

### After Setup:
```
canoil-portal/
├── NEW COMPUTER, CLICK HERE/          ← Keep for reference
├── frontend/                          ← Active development
├── backend/                           ← API server
└── launch-canoil.bat                  ← Daily startup
```

---

## 🔧 PATH CONSIDERATIONS

### Windows Path Length
- Keep total path under 260 characters
- Avoid spaces in parent folder names if possible
- Example: `C:\Dev\canoil-portal\` vs `C:\Very Long Folder Name With Spaces\canoil-portal\`

### Permissions
- Ensure write access to the project folder
- Admin rights might be needed for initial setup
- Network drive access for G: drive data

---

## 🚀 QUICK START CHECKLIST

After copying to new location:

1. ✅ **Project folder exists** in chosen location
2. ✅ **All subfolders copied** (frontend, backend, NEW COMPUTER CLICK HERE)
3. ✅ **Network access to G: drive** available
4. ✅ **Ready to run setup** from NEW COMPUTER, CLICK HERE folder

---

## 💡 PRO TIPS

### Backup Strategy
- Keep a backup copy in a different location
- Version control with Git (optional but recommended)
- Regular exports of your changes

### Multiple Environments
```
C:\Development\
├── canoil-portal-main/        ← Production version
├── canoil-portal-dev/         ← Development version
└── canoil-portal-backup/      ← Backup copy
```

### Shortcuts
Create desktop shortcuts to:
- Project folder
- `launch-canoil.bat`
- VS Code with project open

---

## 🆘 TROUBLESHOOTING LOCATIONS

### If Setup Fails:
1. **Check path length** (under 260 chars)
2. **Verify write permissions** to folder
3. **Ensure no special characters** in path
4. **Try different location** if issues persist

### Network Drive Issues:
1. **Map G: drive** properly on new computer
2. **Test access** to the API Extractions folder
3. **Check VPN connection** if working remotely

---

## ✅ READY TO TRANSFER!

**Recommended Transfer Process:**
1. **Copy entire project** to `C:\Development\canoil-portal\`
2. **Verify folder structure** matches above
3. **Open `NEW COMPUTER, CLICK HERE` folder**
4. **Double-click `CHECK-REQUIREMENTS.bat`**
5. **Follow the setup process**

**You'll be coding in minutes! 🎉**
