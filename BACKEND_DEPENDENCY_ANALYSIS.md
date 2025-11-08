# Backend Dependency Analysis for Vercel

## 📋 Complete Dependency Analysis

### Core Dependencies (Required)
All of these are in `api/requirements.txt`:

1. **Flask==2.3.3** - Web framework ✅
2. **Flask-CORS==4.0.0** - CORS support ✅
3. **openai==1.51.2** - OpenAI API client ✅
4. **python-dotenv==1.0.0** - Environment variables ✅
5. **openpyxl==3.1.2** - Excel file handling ✅
6. **PyPDF2==3.0.1** - PDF reading ✅
7. **pdfplumber==0.11.7** - PDF parsing ✅
8. **python-docx==1.2.0** - Word document handling ✅
9. **Pillow>=10.0.0** - Image processing ✅
10. **google-auth>=2.23.0** - Google authentication ✅
11. **google-auth-oauthlib>=1.1.0** - OAuth flow ✅
12. **google-auth-httplib2>=0.1.1** - HTTP transport ✅
13. **google-api-python-client>=2.100.0** - Google APIs ✅

### Optional Dependencies (Not in api/requirements.txt)

1. **pandas==2.0.3** - Used by `enterprise_analytics.py`
   - **Status**: Too large for Vercel (~100MB + numpy ~50MB = 150MB)
   - **Impact**: Enterprise Analytics won't work on Vercel
   - **Code**: Already handles gracefully with try/except
   - **Decision**: Keep removed (would exceed 250MB limit)

2. **pdf2image>=1.17.0** - Not used
   - **Status**: Removed (not needed)
   - **Impact**: None

3. **docx2pdf>=0.1.8** - Not used
   - **Status**: Removed (not needed)
   - **Impact**: None

## 🔍 Module Import Analysis

### app.py Imports:
- ✅ Flask, Flask-CORS - Required
- ✅ PyPDF2, pdfplumber - Required
- ✅ python-docx - Required
- ✅ openai - Required
- ✅ dotenv - Required
- ✅ enterprise_analytics - Optional (handled with try/except)
- ✅ logistics_automation - Required
- ✅ purchase_requisition_service - Required
- ✅ gmail_email_service - Optional (handled with try/except)

### logistics_automation.py Imports:
- ✅ Flask Blueprint - Required
- ✅ PyPDF2 - Required
- ✅ openai - Required
- ✅ hts_matcher - Custom module (included in backend/)

### google_drive_service.py Imports:
- ✅ google-auth packages - Required
- ✅ google-api-python-client - Required

### gmail_email_service.py Imports:
- ✅ google-auth packages - Required
- ✅ google-api-python-client - Required
- ✅ openai - Required

### purchase_requisition_service.py Imports:
- ✅ Flask Blueprint - Required
- ✅ openpyxl - Required

### enterprise_analytics.py Imports:
- ⚠️ pandas - Optional (too large for Vercel)
- ✅ openai - Required

## ✅ Verification Checklist

- [x] All required dependencies in `api/requirements.txt`
- [x] Optional dependencies handled with try/except
- [x] Custom modules (hts_matcher, etc.) included in backend/
- [x] No missing critical dependencies
- [x] Code handles missing optional dependencies gracefully

## 🎯 Conclusion

**All required dependencies are in `api/requirements.txt`!**

The only missing dependency is `pandas`, which is:
- Too large for Vercel (would exceed 250MB limit)
- Already handled gracefully in code
- Only affects enterprise_analytics (optional feature)

**The backend should work on Vercel with current dependencies!**

