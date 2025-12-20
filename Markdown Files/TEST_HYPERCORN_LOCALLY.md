# Testing Hypercorn Locally

## Quick Test

### Step 1: Install Dependencies
```bash
cd backend
pip install hypercorn asgiref
```

### Step 2: Run Test Script
```bash
python test_hypercorn_local.py
```

### Step 3: Test Endpoints
Open in browser or use curl:
- Health: http://localhost:5002/api/health
- Data: http://localhost:5002/api/data

## What to Test

### ✅ Critical Tests:
1. **Health Check**
   ```bash
   curl http://localhost:5002/api/health
   ```
   Should return JSON with status

2. **Main Data Endpoint**
   ```bash
   curl http://localhost:5002/api/data
   ```
   Should return data (might be slow if loading from G: Drive)

3. **Static Files**
   - Open http://localhost:5002/ in browser
   - Should serve frontend

4. **CORS Headers**
   ```bash
   curl -X OPTIONS http://localhost:5002/api/data -H "Origin: http://localhost:3000"
   ```
   Should return CORS headers

### ⚠️ Check for Issues:
- Error messages in console
- Routes not responding
- Static files not serving
- CORS not working

## Compare with Flask Server

### Run Flask Server (Normal):
```bash
python app.py
```

### Run Hypercorn (Test):
```bash
python test_hypercorn_local.py
```

Both should work the same way!

## If Tests Pass

✅ Ready to deploy to Cloud Run!

## If Tests Fail

Check error messages and let me know what's wrong.

