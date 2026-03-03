# MISys Live Data Bridge — 3 Implementation Options

Choose one based on your situation. All three feed your cloud app (Vercel/Render) with real-time MISys data.

---

## Option 1: Test Now (VPN Connected)

**When:** You're on VPN right now and want to verify everything works.

**Where:** Your current laptop/PC (connected via OpenVPN to reach 192.168.1.11).

**What to do:**
1. Open terminal on your laptop
2. `cd misys_bridge_onprem`
3. `pip install -r requirements.txt`
4. `copy .env.example .env` (or create .env with MISYS_SQL_HOST=192.168.1.11)
5. `python misys_bridge.py` — leave running
6. New terminal: `cloudflared tunnel --url http://localhost:5003`
7. Copy the URL (e.g. `https://xyz.trycloudflare.com`)
8. In Render: add env var `MISYS_LIVE_SQL_URL` = that URL
9. In your app: refresh with source=live_sql

**Pros:** Quick test, no extra hardware  
**Cons:** Only works while your laptop is on and VPN connected; URL changes each time you restart the tunnel

**Duration:** Works until you close the terminals or disconnect VPN.

---

## Option 2: Dedicated Laptop (24/7 Station)

**When:** You have a laptop you can leave on and plugged in as a dedicated data bridge.

**Where:** Any laptop on the same network as 192.168.1.11 (or with VPN always connected).

**What to do:**
1. Set up the laptop on the network (or configure auto-connect VPN on startup)
2. Copy `misys_bridge_onprem` folder to the laptop
3. Install Python, run `pip install -r requirements.txt`
4. Create `.env` with MISYS_SQL_HOST=192.168.1.11
5. Use **Task Scheduler** (Windows) to run at startup:
   - Task 1: `python misys_bridge.py` (start when user logs in)
   - Task 2: `cloudflared tunnel --url http://localhost:5003`
6. For a **permanent tunnel URL**, create a Cloudflare Tunnel (Option 3 step 2) and run `cloudflared tunnel run <tunnel-id>` instead of quick tunnel
7. Add `MISYS_LIVE_SQL_URL` to Render

**Pros:** Dedicated machine, can run 24/7; no changes to MISys server  
**Cons:** Laptop must stay on; power outage = downtime until it comes back

**Maintenance:** Keep laptop plugged in, disable sleep/hibernate, ensure VPN auto-connects if needed.

---

## Option 3: Server + Permanent Cloudflare Tunnel

**When:** You want the most reliable setup — bridge runs on the MISys server with a stable URL.

**Where:** MISys server (192.168.1.11) — requires admin access to install software.

**What to do:**

### Step 1: Install on the server
1. Copy `misys_bridge_server` folder to 192.168.1.11
2. Install Python 3.8+ if needed
3. `pip install -r requirements.txt`
4. Create `.env` with `MISYS_SQL_HOST=localhost`
5. Test: `python misys_bridge.py` — should connect to SQL locally

### Step 2: Create permanent Cloudflare Tunnel
1. Sign up at https://dash.cloudflare.com (free)
2. Go to https://one.dash.cloudflare.com/ → **Networks** → **Tunnels**
3. **Create a tunnel** → name it `canoil-misys` → **Cloudflared**
4. Copy the install command for Windows
5. On the server, run that command (installs and runs cloudflared)
6. Add **Public Hostname**: e.g. `canoil-misys` → `cfargotunnel.com` → `http://localhost:5003`
7. You get a stable URL: `https://canoil-misys-xxx.cfargotunnel.com`

### Step 3: Auto-start on server
- Use **Task Scheduler** or **NSSM** to run at startup:
  - `python misys_bridge.py`
  - `cloudflared tunnel run canoil-misys` (or your tunnel ID)

### Step 4: Connect cloud app
- In Render: `MISYS_LIVE_SQL_URL` = `https://your-permanent-tunnel-url`

**Pros:** Most reliable; server is always on; stable URL; no extra hardware  
**Cons:** Requires admin access to the MISys server

---

## Comparison

| | Option 1 (VPN now) | Option 2 (Laptop 24/7) | Option 3 (Server + Cloudflare) |
|---|-------------------|------------------------|--------------------------------|
| **Setup time** | ~10 min | ~30 min | ~45 min |
| **Hardware** | Your laptop | Dedicated laptop | MISys server only |
| **Uptime** | While you're on VPN | While laptop is on | 24/7 (server) |
| **URL** | Changes on restart | Can be permanent* | Permanent |
| **Server access** | Not needed | Not needed | Required |
| **Best for** | Quick test | No server access | Production |

*Option 2 can use a permanent Cloudflare Tunnel too — same as Option 3 step 2, but run on the laptop.

---

## Recommended Path

1. **Today:** Use **Option 1** to test end-to-end (bridge → tunnel → Render → app).
2. **If no server access:** Use **Option 2** with a permanent Cloudflare Tunnel.
3. **If you have server access:** Use **Option 3** for production.

---

## Checklist (All Options)

- [ ] Bridge runs and `/api/data` returns JSON
- [ ] Cloudflare tunnel gives you a URL
- [ ] `MISYS_LIVE_SQL_URL` set in Render
- [ ] App loads with `source=live_sql`
- [ ] (Option 2/3) Auto-start configured
