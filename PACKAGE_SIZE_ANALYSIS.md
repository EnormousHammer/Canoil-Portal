# Package Size Analysis for Vercel Deployment

## Current Status
- **Vercel Limit**: 250 MB (unzipped)
- **Current Error**: Function exceeds 250 MB

## Package Sizes (Estimated)

### Already Removed from `api/requirements.txt`:
- ✅ `pdf2image` - ~50 MB (removed - not used)
- ✅ `docx2pdf` - ~30 MB (removed - not used)
- ✅ `pandas` - ~100 MB (removed - but still needed for enterprise_analytics)

### Currently in `api/requirements.txt`:
1. **Flask** + **Flask-CORS** - ~5 MB
2. **openai** - ~15 MB
3. **python-dotenv** - <1 MB
4. **openpyxl** - ~25 MB (Excel reading/writing)
5. **PyPDF2** - ~5 MB (PDF reading)
6. **pdfplumber** - ~50 MB (PDF parsing with dependencies)
7. **python-docx** - ~5 MB (Word document handling)
8. **Pillow** - ~50 MB (Image processing)
9. **google-auth** packages - ~20 MB (Google API authentication)
10. **google-api-python-client** - ~30 MB (Google Drive/Gmail APIs)

**Total Estimated**: ~205 MB (without pandas)

### With pandas (if added back):
- **pandas** - ~100 MB
- **numpy** (pandas dependency) - ~50 MB
- **Total with pandas**: ~355 MB ❌ (EXCEEDS 250 MB LIMIT)

## What Uses What:

### pandas Usage:
- ✅ `backend/enterprise_analytics.py` - **HEAVILY USED**
  - Sales performance analysis
  - Monthly/seasonal trends
  - Top customers/items analysis
  - Date parsing and aggregation
- ✅ `backend/app.py` - `load_mps_from_excel()` function
  - **ALREADY FIXED** - Now uses `openpyxl` instead

### openpyxl Usage:
- ✅ `backend/purchase_requisition_service.py` - Excel file generation
- ✅ `backend/app.py` - MPS Excel loading (after my fix)

### pdfplumber Usage:
- ✅ `backend/app.py` - PDF text extraction
- ✅ `backend/logistics_automation.py` - PDF parsing

## Options:

### Option 1: Keep pandas removed (Current)
- ✅ Function size: ~205 MB (under 250 MB limit)
- ❌ Enterprise Analytics will fail on Vercel
- ✅ All other features work

### Option 2: Add pandas back
- ❌ Function size: ~355 MB (EXCEEDS 250 MB limit)
- ✅ Enterprise Analytics works
- ❌ Deployment will fail

### Option 3: Split into multiple functions
- Create separate Vercel function for enterprise analytics
- Main function: ~205 MB (without pandas)
- Analytics function: ~155 MB (with pandas)
- ✅ Both stay under 250 MB
- ✅ All features work
- ⚠️ More complex deployment

### Option 4: Optimize further
- Remove `pdfplumber` (~50 MB) if not critical
- Use lighter PDF library
- Function size: ~155 MB
- ⚠️ May break PDF parsing features

## Recommendation:
**Option 3** (Split functions) is best long-term solution, but requires more setup.

**Option 1** (Keep pandas removed) is quickest fix - enterprise analytics won't work on Vercel but everything else will.

## Your Decision:
Which option do you prefer?

