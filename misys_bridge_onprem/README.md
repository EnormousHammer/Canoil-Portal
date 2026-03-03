# MISys Live Data Bridge — ANY ON-PREMISES PC

**Setup B:** Run this on any Windows PC that can reach 192.168.1.11 (same network or via OpenVPN).

---

## Requirements

- Any PC on the same LAN as 192.168.1.11, OR
- PC with OpenVPN connected (so it can reach 192.168.1.11)
- Python 3.8+
- Cloudflare account (free)

---

## Step 1: Install Python & Packages

```powershell
pip install -r requirements.txt
```

---

## Step 2: Install Cloudflared

1. Download: https://github.com/cloudflare/cloudflared/releases
2. Extract `cloudflared.exe` to `C:\cloudflared\` (or any folder)

---

## Step 3: Configure

Copy `.env.example` to `.env`. SQL is on the network:

```
MISYS_SQL_HOST=192.168.1.11
MISYS_SQL_USER=sa
MISYS_SQL_PASSWORD=MISys_SBM1
MISYS_SQL_DATABASE=CANOILCA
```

**If using OpenVPN:** Connect to VPN first, then run the bridge.

---

## Step 4: Run the Bridge

**Terminal 1 — Flask API:**
```powershell
cd misys_bridge_onprem
python misys_bridge.py
```

**Terminal 2 — Cloudflare Tunnel:**
```powershell
cd C:\cloudflared
cloudflared tunnel --url http://localhost:5003
```
Copy the URL shown.

---

## Step 5: Connect Your Cloud App

1. In Render (or your backend host), add env var:
   - `MISYS_LIVE_SQL_URL` = your tunnel URL

2. Your cloud backend fetches from this URL when `source=live_sql`.

---

## Notes

- Bridge only works when this PC is on and VPN connected (if using VPN)
- For 24/7 uptime, use Setup A (on the server) or run this PC 24/7
- Use Task Scheduler to auto-start both processes at login if needed
