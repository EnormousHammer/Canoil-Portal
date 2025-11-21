# 📊 How to View Cloud Run Logs - Quick Guide

## Your Cloud Run Details
- **Project ID:** `dulcet-order-474521-q1`
- **Region:** `us-central1`
- **Service Name:** `canoil-backend`

---

## 🚀 Quick Access Methods

### Method 1: Google Cloud Console (Easiest - Web UI)

**Direct Link to Logs:**
https://console.cloud.google.com/logs/query?project=dulcet-order-474521-q1&query=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22canoil-backend%22

**Or navigate manually:**
1. Go to: https://console.cloud.google.com/run
2. Select project: `dulcet-order-474521-q1`
3. Click service: `canoil-backend`
4. Click **"Logs"** tab
5. See real-time logs with timestamps

**Direct Link to Service:**
https://console.cloud.google.com/run/detail/us-central1/canoil-backend?project=dulcet-order-474521-q1

---

### Method 2: gcloud CLI Commands

#### View Recent Logs (Last 50 lines)
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend" --limit=50 --project=dulcet-order-474521-q1 --format="table(timestamp,severity,textPayload)" --order=desc
```

#### Follow Logs in Real-Time (Like `tail -f`)
```powershell
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend" --project=dulcet-order-474521-q1
```

#### Filter for Errors Only
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend AND severity>=ERROR" --limit=50 --project=dulcet-order-474521-q1 --format="table(timestamp,severity,textPayload)" --order=desc
```

#### Filter for Logistics/Email Processing
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend AND (textPayload=~'LOGISTICS' OR textPayload=~'process-email' OR textPayload=~'GPT')" --limit=100 --project=dulcet-order-474521-q1 --format="table(timestamp,severity,textPayload)" --order=desc
```

#### Filter for Slow Requests (Look for timing info)
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend AND (textPayload=~'seconds' OR textPayload=~'timeout' OR textPayload=~'slow')" --limit=50 --project=dulcet-order-474521-q1 --format="table(timestamp,severity,textPayload)" --order=desc
```

#### Filter for Google Drive API Calls
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend AND (textPayload=~'Google Drive' OR textPayload=~'GDRIVE' OR textPayload=~'drive')" --limit=50 --project=dulcet-order-474521-q1 --format="table(timestamp,severity,textPayload)" --order=desc
```

---

### Method 3: Run Diagnostic Script

**PowerShell:**
```powershell
.\DIAGNOSE_CLOUD_RUN.ps1
```

**Batch:**
```cmd
.\DIAGNOSE_CLOUD_RUN.bat
```

---

## 🔍 What to Look For in Logs

### Performance Issues - Key Indicators:

1. **Cold Start Times**
   - Look for: `"Starting Flask server"` or `"Container starting"`
   - Cold starts can add 5-30 seconds on first request after idle
   - Solution: Set `--min-instances=1` (already configured ✅)

2. **Google Drive API Slow Calls**
   - Look for: `"Loading data from Google Drive"` with timestamps
   - First load: 2-4 minutes (normal - loading 86MB)
   - Subsequent loads: Should use cache (<10 seconds)
   - If slow every time: Cache not working

3. **GPT API Calls (Logistics)**
   - Look for: `"Parsing email with GPT-4o-mini"`
   - Normal: 2-5 seconds
   - Slow: >10 seconds = OpenAI API latency
   - Solution: Already optimized with parallel SO fetch ✅

4. **Request Timeouts**
   - Look for: `"timeout"`, `"AbortError"`, `"Request timeout"`
   - Check: Request duration vs timeout setting (300 seconds)
   - If timing out: Data too large or API too slow

5. **Cache Hits/Misses**
   - Look for: `"Cache hit"` or `"Loading from cache"`
   - Cache hit = fast (<1 second)
   - Cache miss = slow (2-4 minutes)
   - If always cache miss: Cache not persisting

6. **Error Messages**
   - Look for: `"ERROR:"`, `"Exception:"`, `"Traceback"`
   - These indicate failures that slow things down

---

## 📈 Performance Analysis Commands

### Get Average Response Time for /api/data
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend AND textPayload=~'/api/data'" --limit=100 --project=dulcet-order-474521-q1 --format=json | ConvertFrom-Json | Where-Object { $_.textPayload -match 'seconds|Duration' } | Select-Object timestamp, textPayload
```

### Count Cache Hits vs Misses
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend AND (textPayload=~'cache' OR textPayload=~'Cache')" --limit=200 --project=dulcet-order-474521-q1 --format="table(timestamp,textPayload)" --order=desc
```

### Find Slowest Requests
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend" --limit=500 --project=dulcet-order-474521-q1 --format=json | ConvertFrom-Json | Where-Object { $_.textPayload -match '\d+\.\d+ seconds' } | Select-Object timestamp, textPayload | Sort-Object textPayload -Descending | Select-Object -First 20
```

---

## 🎯 Quick Diagnostic Checklist

When logs show slowness, check:

1. ✅ **Is it a cold start?**
   - First request after 15+ minutes idle = cold start (normal)
   - Solution: Already have `--min-instances=1` ✅

2. ✅ **Is cache working?**
   - Look for "Cache hit" messages
   - If no cache hits: Cache directory issue

3. ✅ **Is Google Drive API authenticated?**
   - Look for "Google Drive API: AUTHENTICATED" in health check
   - If not: Secret Manager issue

4. ✅ **Are requests timing out?**
   - Check timeout setting (300 seconds)
   - If timing out: Data too large or API too slow

5. ✅ **Is GPT API slow?**
   - Look for GPT call duration in logs
   - Normal: 2-5 seconds
   - Slow: >10 seconds = OpenAI API issue

---

## 📝 Example: What Good Logs Look Like

```
2025-01-21 10:00:00 INFO: Loading data from backend...
2025-01-21 10:00:01 INFO: Cache hit! Loading from cache (45s old)
2025-01-21 10:00:01 INFO: ✅ Data loaded successfully (0.8 seconds)
```

**Bad Logs (Slow):**
```
2025-01-21 10:00:00 INFO: Loading data from backend...
2025-01-21 10:00:05 INFO: Cache miss - loading from Google Drive...
2025-01-21 10:02:30 INFO: ✅ Data loaded successfully (150.2 seconds)
```

---

## 🚨 Common Issues & Solutions

### Issue: "10x slower than local"
**Check logs for:**
- Cold starts (first request after idle)
- Cache misses (every request loads from Google Drive)
- Network latency to Google Drive API

**Solutions:**
- ✅ Already have `--min-instances=1` (prevents cold starts)
- ✅ Cache is configured (check if working)
- Network latency is normal for Cloud Run → Google Drive

### Issue: "Logistics email processing slow"
**Check logs for:**
- GPT API call duration
- SO data fetch duration
- Retry attempts

**Solutions:**
- ✅ Already optimized with parallel SO fetch
- GPT API latency is external (OpenAI's servers)

### Issue: "App takes long to connect"
**Check logs for:**
- Backend startup time
- First request processing time
- Health check response time

**Solutions:**
- ✅ Already optimized with parallel data loading
- First connection may be cold start (normal)

---

## 🔗 Quick Links

- **Cloud Run Console:** https://console.cloud.google.com/run?project=dulcet-order-474521-q1
- **Logs Explorer:** https://console.cloud.google.com/logs/query?project=dulcet-order-474521-q1
- **Service Details:** https://console.cloud.google.com/run/detail/us-central1/canoil-backend?project=dulcet-order-474521-q1

---

## 💡 Pro Tip

**Set up log streaming in terminal:**
```powershell
# This will show logs in real-time as they happen
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend" --project=dulcet-order-474521-q1
```

Then trigger a request from your app and watch the logs appear in real-time!

