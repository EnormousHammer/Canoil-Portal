# MISys Live Data Bridge — ON THE SERVER

**Setup A:** Run this on the MISys server itself (192.168.1.11).

The bridge connects to MISys SQL locally and exposes an API. Cloudflare Tunnel makes it reachable from your cloud app.

---

## Requirements

- Access to install software on the MISys server (192.168.1.11)
- Python 3.8+
- Cloudflare account (free) for a stable tunnel URL

---

## Step 1: Install Python & Packages

```powershell
pip install -r requirements.txt
```

---

## Step 2: Install Cloudflared

1. Download: https://github.com/cloudflare/cloudflared/releases
2. Get `cloudflared-windows-amd64.exe`, rename to `cloudflared.exe`
3. Put in `C:\cloudflared\` (or any folder)

---

## Step 3: Configure (Optional)

Copy `.env.example` to `.env` and edit if needed.

On the server, SQL is local — use `localhost` or `127.0.0.1`:

```
MISYS_SQL_HOST=localhost
MISYS_SQL_USER=sa
MISYS_SQL_PASSWORD=MISys_SBM1
MISYS_SQL_DATABASE=CANOILCA
```

---

## Step 4: Run the Bridge

**Terminal 1 — Flask API:**
```powershell
cd misys_bridge_server
python misys_bridge.py
```
You should see: `Running on http://0.0.0.0:5003`

**Terminal 2 — Cloudflare Tunnel:**
```powershell
cd C:\cloudflared
cloudflared tunnel --url http://localhost:5003
```
Copy the URL shown (e.g. `https://xyz.trycloudflare.com`).

---

## Step 5: Test

Open in browser: `https://YOUR-TUNNEL-URL/api/data`

You should get JSON with MISys data.

---

## Step 6: Connect Your Cloud App

1. In Render (or your backend host), add env var:
   - `MISYS_LIVE_SQL_URL` = `https://your-tunnel-url`

2. Your cloud backend fetches from this URL when `source=live_sql`.

---

## Auto-Start (Optional)

Use **Task Scheduler** or **NSSM** to run both at startup:

- **Task 1:** `python C:\path\to\misys_bridge_server\misys_bridge.py`
- **Task 2:** `C:\cloudflared\cloudflared.exe tunnel --url http://localhost:5003`

---

## Permanent Tunnel (Recommended)

Quick tunnel URLs change on restart. For a stable URL:

1. Go to https://one.dash.cloudflare.com/
2. **Networks** → **Tunnels** → **Create a tunnel**
3. Choose **Cloudflared**, name it (e.g. `canoil-misys`)
4. Run the install command on the server
5. Add Public Hostname: `http://localhost:5003`
6. Use the stable URL (e.g. `https://canoil-misys-xxx.cfargotunnel.com`)
