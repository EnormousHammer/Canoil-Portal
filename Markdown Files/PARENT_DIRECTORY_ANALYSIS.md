# Parent Directory Analysis
**Location:** `G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper`  
**Date:** 2025-12-20  
**Purpose:** Identify unused files/folders in parent directory

---

## 📂 **PARENT DIRECTORY STRUCTURE**

The parent directory contains:
- `canoil-portal/` - **ACTIVE PROJECT** (this is what we're working on)
- `backend/` - **SEPARATE BACKEND?** (needs verification)
- `cache/` - Cache folder
- `generated_documents/` - Generated documents
- `logs/` - Log files
- `so_cache/` - Sales order cache
- `test_output/` - Test output
- `env for render/` - Environment files
- `Logistics_Backups_20250925/` - Backup folder
- **Hundreds of test/debug/analysis files** (test_*.py, debug_*.py, analyze_*.py, etc.)
- **Many markdown documentation files**

---

## ❓ **QUESTIONS TO ANSWER**

1. **Is `backend/` folder in parent directory used?**
   - Or is it an old/duplicate backend?
   - Does canoil-portal reference it?

2. **Are all those test files used?**
   - Hundreds of `test_*.py`, `debug_*.py`, `analyze_*.py` files
   - Are they part of the project or just leftover test scripts?

3. **Are cache/log folders needed?**
   - `cache/`, `logs/`, `so_cache/`, `test_output/`
   - Can these be cleaned up?

4. **Are backup folders needed?**
   - `Logistics_Backups_20250925/`
   - Old backups that can be archived?

---

## 🔍 **VERIFICATION NEEDED**

### Check 1: Parent backend folder
- Does canoil-portal import from `../backend/`?
- Or is it completely separate/unused?

### Check 2: Test files
- Are test files in parent directory part of the project?
- Or are they one-off analysis scripts?

### Check 3: Cache/log folders
- Are these actively used?
- Or can they be cleaned up?

---

## 📋 **NEXT STEPS**

1. Verify if parent `backend/` is used by canoil-portal
2. Check if test files are referenced anywhere
3. Determine which folders are active vs legacy
4. Create cleanup list for parent directory

---

**Status:** Analysis in progress...

