# Vercel 500 Error Debug Guide

## 🔍 Current Issue
Getting 500 error from `/api/data` endpoint with generic message: "A server error has occurred"

## 🔧 Steps to Debug

### Step 1: Check Vercel Logs
1. Go to Vercel Dashboard → Your Project
2. Click "Deployments" tab
3. Click on the latest deployment
4. Click "Functions" tab
5. Click on `api/index` function
6. Click "Logs" tab
7. Look for:
   - `❌ Error importing Flask app: ...`
   - `❌ Error in handler: ...`
   - `❌ Flask app error: ...`
   - Any Python traceback

### Step 2: Test Debug Endpoint
Visit: `https://your-project.vercel.app/api/debug`

This will show:
- Environment variables status
- Google Drive service status
- Authentication status
- Any initialization errors

### Step 3: Check Error Response
The error response should now include:
- `error`: Error message
- `type`: Error type (`import_error`, `flask_error`, `handler_error`)
- `trace`: Full traceback

### Step 4: Common Issues

#### Issue 1: Import Error
**Symptom:** `type: "import_error"` in response
**Cause:** Flask app failed to import
**Solution:** Check Vercel logs for import errors

#### Issue 2: Flask App Error
**Symptom:** `type: "flask_error"` in response
**Cause:** Flask route handler crashed
**Solution:** Check the traceback in the response

#### Issue 3: Handler Error
**Symptom:** `type: "handler_error"` in response
**Cause:** Handler itself crashed
**Solution:** Check the traceback in the response

#### Issue 4: Google Drive Authentication
**Symptom:** Authentication fails during initialization
**Solution:** 
- Check `GOOGLE_DRIVE_TOKEN` environment variable
- Verify token is valid JSON
- Check token hasn't expired

## 📋 Next Steps

1. **Check Vercel Logs** - This will show the actual error
2. **Test Debug Endpoint** - This will show initialization status
3. **Check Error Response** - The response body should have detailed error info
4. **Fix Based on Error Type** - Address the specific issue

## 🚨 Most Likely Causes

1. **Google Drive Token Invalid/Expired**
   - Check `GOOGLE_DRIVE_TOKEN` in Vercel
   - Token might need to be refreshed

2. **Import Error in backend/app.py**
   - Some module might be missing
   - Check `api/requirements.txt` has all dependencies

3. **Path Resolution Issue**
   - The `os.chdir()` might be causing issues
   - Try removing it or handling paths differently

4. **Environment Variable Access**
   - Variables might not be accessible during import
   - Check Vercel environment variable settings

