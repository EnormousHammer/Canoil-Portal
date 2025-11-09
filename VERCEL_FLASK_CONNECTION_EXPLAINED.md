# Vercel Flask Connection - How It Works

## 🔍 Answer: Does Vercel Connect to Flask Differently?

**YES** - Vercel connects to Flask **completely differently** than locally.

## 📊 Local vs Vercel

### Local Development
- Flask runs as a **persistent server** using `app.run()`
- Server stays alive, handles multiple requests
- State can be maintained in memory
- Direct HTTP connection to Flask

### Vercel Deployment
- Flask runs as a **serverless function** (stateless, ephemeral)
- Each request may create a new function instance
- No persistent state between requests
- Must use a **WSGI wrapper** to convert Vercel's request format to Flask's WSGI format

## 🔧 How It Works on Vercel

1. **Request comes to Vercel** → `/api/data`
2. **Vercel routes to** → `/api/index` (via `vercel.json` rewrites)
3. **Python handler function** (`api/index.py`) receives request
4. **Handler converts** Vercel request format → WSGI format
5. **Handler calls** Flask app as WSGI application
6. **Flask processes** request and returns response
7. **Handler converts** Flask WSGI response → Vercel response format
8. **Vercel returns** response to client

## ✅ Current Setup (Correct)

```python
# api/index.py
def handler(request):
    # 1. Convert Vercel request → WSGI format
    environ = {...}  # WSGI environment
    
    # 2. Call Flask app as WSGI application
    app_iter = app(environ, start_response)
    
    # 3. Convert Flask WSGI response → Vercel format
    return {
        'statusCode': 200,
        'headers': {...},
        'body': '...'
    }
```

## ❌ What Doesn't Work

- **Direct Flask app** - Can't use `app.run()` on Vercel
- **Native Flask detection** - Only works if Flask app is at root level (`app.py`, `index.py`, `server.py`)
- **Persistent server** - Vercel is serverless, no persistent processes

## 🔍 Why We Need the WSGI Wrapper

Vercel's Python runtime:
- Uses `@vercel/python` runtime
- Expects a `handler` function in `api/*.py` files
- Passes request as dict/object
- Expects response as dict with `statusCode`, `headers`, `body`

Flask:
- Uses WSGI (Web Server Gateway Interface)
- Expects `environ` dict and `start_response` callback
- Returns iterable response

**The WSGI wrapper bridges these two formats.**

## 🐛 Current Issue

The generic error `{"error": {"code": "500", "message": "A server error has occurred"}}` suggests:

1. **Error before handler runs** - Module import fails
2. **Error in Flask app** - Flask route handler crashes
3. **Error in WSGI conversion** - Path/header conversion fails

## 🔧 Debugging Steps

1. **Check Vercel Logs** - Look for:
   - `🔵 Handler called: path=...`
   - `✅ Path setup complete: ...`
   - `✅ Flask app imported successfully`
   - `❌ Error importing Flask app: ...`
   - `❌ Flask app error: ...`

2. **Test Simple Endpoint** - Visit `/api/test` to verify handler works

3. **Check Error Response** - The response body should have `type`, `error`, `trace`

## ✅ Conclusion

**Yes, Vercel needs to connect to Flask differently than locally:**
- ✅ Local: Direct Flask server (`app.run()`)
- ✅ Vercel: WSGI wrapper in serverless function handler

**Our current approach is correct** - we just need to debug why it's failing.

