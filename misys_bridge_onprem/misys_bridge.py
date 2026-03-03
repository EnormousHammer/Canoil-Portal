"""
MISys Live Data Bridge - On-Premises PC Setup
Runs on any PC that can reach 192.168.1.11 (same LAN or OpenVPN).
Connects to MISys SQL over network, exposes /api/data for the cloud app.
"""
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from flask_compress import Compress
    HAS_COMPRESS = True
except ImportError:
    HAS_COMPRESS = False

import misys_service
import threading

app = Flask(__name__)
CORS(app)
# flask-compress disabled — we manually pre-compress the response at cache time for speed

# In-memory cache — preloaded on startup, refreshed every 10 minutes
_cache = {"data": None, "err": None, "loaded_at": None, "loading": False,
          "response_bytes": None, "response_gzip": None}
_CACHE_TTL_SECONDS = 600  # 10 minutes


def _refresh_cache():
    """Load all MISys data, pre-serialize and pre-compress response for instant serving."""
    import json as _json, gzip as _gzip, time as _time
    _cache["loading"] = True
    print(f"[bridge] Loading data from MISys SQL... {datetime.now().strftime('%H:%M:%S')}")
    t0 = _time.time()
    data, err = misys_service.load_all_data()
    _cache["data"] = data
    _cache["err"] = err
    _cache["loaded_at"] = datetime.now()
    _cache["response_bytes"] = None
    _cache["response_gzip"] = None

    if data:
        count = sum(1 for v in data.values() if isinstance(v, list) and len(v) > 0)
        print(f"[bridge] Loaded {count} tables in {_time.time()-t0:.1f}s. Pre-serializing...")
        t1 = _time.time()
        payload = {
            "data": data,
            "folderInfo": {
                "folderName": "MISys Live SQL (On-Prem)",
                "syncDate": _cache["loaded_at"].isoformat(),
                "lastModified": _cache["loaded_at"].isoformat(),
                "folder": "192.168.1.11/CANOILCA",
                "created": _cache["loaded_at"].isoformat(),
                "size": "N/A",
                "fileCount": count,
            },
            "LoadTimestamp": _cache["loaded_at"].isoformat(),
            "source": "live_sql",
            "fullCompanyDataReady": True,
        }
        raw = _json.dumps(payload).encode('utf-8')
        gzipped = _gzip.compress(raw, compresslevel=1)
        _cache["response_bytes"] = raw
        _cache["response_gzip"] = gzipped
        mb_raw = len(raw) / 1024 / 1024
        mb_gz = len(gzipped) / 1024 / 1024
        print(f"[bridge] Pre-serialized in {_time.time()-t1:.1f}s: {mb_raw:.1f}MB raw -> {mb_gz:.1f}MB gzip")
    else:
        print(f"[bridge] Cache load FAILED: {err}")

    _cache["loading"] = False


def _maybe_refresh():
    """Trigger background refresh if cache is stale."""
    if _cache["loading"]:
        return
    if _cache["loaded_at"] is None:
        return
    age = (datetime.now() - _cache["loaded_at"]).total_seconds()
    if age > _CACHE_TTL_SECONDS:
        t = threading.Thread(target=_refresh_cache, daemon=True)
        t.start()


@app.route('/api/data', methods=['GET'])
def get_data():
    from flask import Response, request as _req
    _maybe_refresh()

    if _cache["loading"] and _cache["data"] is None:
        return jsonify({"data": {}, "source": "live_sql", "fullCompanyDataReady": False,
                        "message": "Data is loading, please retry in ~30 seconds"}), 503

    if _cache["data"] is None:
        return jsonify({"data": {}, "source": "live_sql", "fullCompanyDataReady": False,
                        "message": _cache["err"] or "No data loaded yet"}), 500

    # Serve pre-built response — instant, no re-serialization
    accept_encoding = _req.headers.get('Accept-Encoding', '')
    if 'gzip' in accept_encoding and _cache["response_gzip"]:
        return Response(_cache["response_gzip"], mimetype='application/json',
                        headers={'Content-Encoding': 'gzip',
                                 'Content-Length': len(_cache["response_gzip"])})
    return Response(_cache["response_bytes"], mimetype='application/json',
                    headers={'Content-Length': len(_cache["response_bytes"])})


@app.route('/api/refresh', methods=['POST'])
def refresh():
    """Force-refresh the cache from MISys SQL."""
    if _cache["loading"]:
        return jsonify({"status": "already_loading"})
    t = threading.Thread(target=_refresh_cache, daemon=True)
    t.start()
    return jsonify({"status": "refresh_started"})


@app.route('/health', methods=['GET'])
def health():
    ok, msg = misys_service.test_connection()
    cache_age = None
    if _cache["loaded_at"]:
        cache_age = round((datetime.now() - _cache["loaded_at"]).total_seconds())
    return jsonify({"ok": ok, "message": msg, "cache_age_seconds": cache_age,
                    "cache_loaded": _cache["data"] is not None})

if __name__ == '__main__':
    import sys, logging
    sys.stdout.reconfigure(line_buffering=True)
    logging.basicConfig(level=logging.INFO)

    # Pre-load data BEFORE accepting requests so first call returns immediately
    print("[bridge] Pre-loading MISys data on startup...")
    _refresh_cache()

    try:
        from waitress import serve
        print("[bridge] Starting on port 5003 with waitress (production WSGI)")
        serve(app, host='0.0.0.0', port=5003, threads=4, channel_timeout=300)
    except ImportError:
        print("[bridge] waitress not available, falling back to Flask dev server")
        app.run(host='0.0.0.0', port=5003, threaded=True)
