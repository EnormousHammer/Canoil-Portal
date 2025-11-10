# Sales Order Folder Mapping - EXACT REQUIREMENTS

## What the Frontend is Looking For

The frontend reads from `data['SalesOrdersByStatus']` which is a dictionary where:
- **Keys** = Folder names (as strings)
- **Values** = Arrays of file objects

### Status Category Matching Logic

The frontend matches folder names to status categories using these rules (case-insensitive):

#### 1. "New and Revised" Status
**Matches if folder name contains:**
- `"new"` OR
- `"revised"`

**Examples that WOULD match:**
- "New and Revised"
- "New Orders"
- "Revised Orders"
- "New Sales Orders"
- "Revised"

**Examples that would NOT match:**
- "In Production"
- "Completed"
- "Cancelled"

#### 2. "In Production" Status
**Matches if folder name contains:**
- `"production"` OR
- `"manufacturing"`

**Examples that WOULD match:**
- "In Production"
- "Production"
- "Manufacturing"
- "In Manufacturing"

**Examples that would NOT match:**
- "New and Revised"
- "Completed"
- "Cancelled"

#### 3. "Completed and Closed" Status
**Matches if folder name contains:**
- `"completed"` OR
- `"closed"`

**Examples that WOULD match:**
- "Completed and Closed"
- "Completed"
- "Closed"
- "Completed Orders"

**Examples that would NOT match:**
- "New and Revised"
- "In Production"
- "Cancelled"

#### 4. "Cancelled" Status
**Matches if folder name contains:**
- `"cancelled"` OR
- `"canceled"` (US spelling)

**Examples that WOULD match:**
- "Cancelled"
- "Canceled"
- "Cancelled Orders"

**Examples that would NOT match:**
- "New and Revised"
- "In Production"
- "Completed"

## What the Backend Returns

The backend scans Google Drive folders and returns data in this structure:

```json
{
  "SalesOrdersByStatus": {
    "Folder Name 1": [array of files],
    "Folder Name 2": [array of files],
    ...
  }
}
```

### Backend Processing Steps

1. **Finds "Customer Orders" folder** in Sales_CSR shared drive
2. **Scans all folders under "Customer Orders"** (e.g., "Sales Orders", "Purchase Orders")
3. **For each folder, recursively scans subfolders** (up to 3 levels deep)
4. **Extracts the subfolder name** from the full path:
   - Full path: `"Sales Orders/New and Revised"`
   - Extracted name: `"New and Revised"`
5. **Uses the extracted name as the key** in `SalesOrdersByStatus`

### Example Backend Output

If Google Drive has this structure:
```
Sales_CSR/
  Customer Orders/
    Sales Orders/
      New and Revised/  (files here)
      In Production/     (files here)
      Completed and Closed/  (files here)
      Cancelled/         (files here)
```

The backend would return:
```json
{
  "SalesOrdersByStatus": {
    "New and Revised": [files...],
    "In Production": [files...],
    "Completed and Closed": [files...],
    "Cancelled": [files...]
  }
}
```

## Debug Endpoints

To see EXACTLY what folder names the backend is returning:

1. **Check what folders are in SalesOrdersByStatus:**
   ```
   https://canoil-portal.onrender.com/api/debug/sales-orders-folders
   ```
   This shows:
   - All folder names (keys) in SalesOrdersByStatus
   - File count for each folder
   - Sample file from each folder

2. **Check the complete Google Drive structure:**
   ```
   https://canoil-portal.onrender.com/api/debug/drive-structure
   ```
   This shows:
   - Complete folder structure under Customer Orders
   - All subfolders with their exact names
   - File counts for each folder

3. **Check browser console:**
   Open browser console (F12) and look for:
   - `[DEBUG] SalesOrdersByStatus keys: [...]` - Shows all folder names
   - `[DEBUG] Processing folder: "..."` - Shows each folder being processed
   - `[DEBUG] Matched "..." to ...` - Shows which folders matched which status
   - `[DEBUG] Folder "..." did not match any status category` - Shows folders that didn't match

## Common Issues

### Issue 1: Folder names don't match
**Problem:** Folder names in Google Drive don't contain the expected keywords
**Example:** Folder named "Active Orders" won't match "New and Revised" because it doesn't contain "new" or "revised"
**Solution:** Rename folders in Google Drive to include the expected keywords, OR update the frontend matching logic

### Issue 2: Case sensitivity
**Problem:** Folder names have different capitalization
**Solution:** Matching is case-insensitive, so this shouldn't be an issue

### Issue 3: Folder names have extra words
**Problem:** Folder named "Sales Orders - New and Revised" might not match correctly
**Solution:** The matching uses `.includes()`, so it should still match. Check the debug logs to confirm.

### Issue 4: No data in SalesOrdersByStatus
**Problem:** Backend returns empty `SalesOrdersByStatus: {}`
**Possible causes:**
- No files found in scanned folders
- Folders not found in Google Drive
- Scanning timed out (30 second limit per folder)
- SSL errors during scanning

## How to Fix

1. **Check the debug endpoints** to see what folder names are actually being returned
2. **Compare folder names** from Google Drive with what the frontend expects
3. **Either:**
   - Rename folders in Google Drive to match expected keywords, OR
   - Update the frontend matching logic to match your actual folder names

## Current Matching Logic (Frontend Code)

```typescript
// Line 1098-1109 in RevolutionaryCanoilHub.tsx
if (folderLower === 'new and revised' || folderLower.includes('new') || folderLower.includes('revised')) {
  newAndRevisedCount += orders.length;
} else if (folderLower === 'in production' || folderLower.includes('production') || folderLower.includes('manufacturing')) {
  inProductionCount += orders.length;
} else if (folderLower === 'completed and closed' || folderLower.includes('completed') || folderLower.includes('closed')) {
  completedCount += orders.length;
} else if (folderLower === 'cancelled' || folderLower.includes('cancelled') || folderLower.includes('canceled')) {
  cancelledCount += orders.length;
}
```

**Note:** The matching is done in order, so if a folder name contains multiple keywords (e.g., "New Production Orders"), it will match the FIRST condition that matches (in this case, "New and Revised" because "new" comes first).

