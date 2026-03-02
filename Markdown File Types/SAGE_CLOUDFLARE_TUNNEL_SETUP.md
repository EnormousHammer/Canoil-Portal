# Sage 50 Cloudflare Tunnel Setup — Connect Render to Office Sage MySQL

**Purpose:** Let the Render cloud backend (canoil-portal-1.onrender.com) securely reach the Sage 50 MySQL database sitting on the office network at 192.168.1.11:13540.

**Architecture:**
```
User Browser
    |
    v
Vercel (frontend - canoil-portal.vercel.app)
    |  /api/* proxy
    v
Render (backend - canoil-portal-1.onrender.com)
    |
    v  (encrypted Cloudflare Tunnel)
Cloudflare Edge Network
    |
    v  (encrypted tunnel)
cloudflared (Windows service on office machine)
    |
    v  (local network)
192.168.1.11:13540 (Sage 50 MySQL - READ-ONLY)
```

**REMINDER: Sage 50 is 100% READ-ONLY. We never write to Sage. Ever.**

**Total cost:** Free (Cloudflare Tunnel is free) + ~$10/year if you need to buy a domain

---

## Prerequisites

- A Windows machine **inside the office network** that can reach 192.168.1.11
  - This machine must be always-on (or at least on during business hours)
  - Can be the Sage server itself, or any PC on the same network
- A domain name (e.g., canoil.com or any domain you own)
- Cloudflare account (free)

---

## Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com
2. Sign up for a free account
3. Verify your email

---

## Step 2: Add Your Domain to Cloudflare

1. In the Cloudflare dashboard, click **"Add a site"**
2. Enter your domain (e.g., `canoil.com`)
3. Select the **Free** plan
4. Cloudflare will scan your existing DNS records
5. Update your domain's nameservers to the ones Cloudflare provides:
   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Change nameservers to the two Cloudflare provides (e.g., `ada.ns.cloudflare.com`, `brad.ns.cloudflare.com`)
6. Wait for DNS propagation (can take 5 minutes to 24 hours, usually ~15 minutes)

**Don't have a domain?** You can buy one on Cloudflare Registrar for ~$10/year. A `.com` or `.ca` works fine. The domain is only used internally for the tunnel hostname — no one else sees it.

---

## Step 3: Install cloudflared on the Office Windows Machine

**Option A — Using winget (recommended):**
```powershell
winget install Cloudflare.cloudflared
```

**Option B — Manual download:**
1. Go to https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Download the Windows 64-bit installer (.msi)
3. Run the installer

**Verify installation:**
```powershell
cloudflared --version
```
You should see something like `cloudflared version 2024.x.x`

---

## Step 4: Authenticate cloudflared with Your Cloudflare Account

```powershell
cloudflared tunnel login
```

- This opens a browser window
- Log in to your Cloudflare account
- Select the domain you added in Step 2
- A certificate is downloaded to `C:\Users\<YourUser>\.cloudflared\cert.pem`
- You should see: `You have successfully logged in`

---

## Step 5: Create the Tunnel

```powershell
cloudflared tunnel create sage-tunnel
```

Output will look like:
```
Tunnel credentials written to C:\Users\<YourUser>\.cloudflared\<TUNNEL-ID>.json
Created tunnel sage-tunnel with id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Write down the Tunnel ID** (the UUID). You need it for the config file.

---

## Step 6: Create the DNS Route

```powershell
cloudflared tunnel route dns sage-tunnel sage-db.yourdomain.com
```

Replace `yourdomain.com` with your actual domain.

This creates a CNAME record in Cloudflare DNS: `sage-db.yourdomain.com` → your tunnel.

---

## Step 7: Create the Configuration File

Create/edit the file at:
```
C:\Users\<YourUser>\.cloudflared\config.yml
```

Paste this content:
```yaml
tunnel: PASTE-YOUR-TUNNEL-ID-HERE
credentials-file: C:\Users\<YourUser>\.cloudflared\PASTE-YOUR-TUNNEL-ID-HERE.json

ingress:
  - hostname: sage-db.yourdomain.com
    service: tcp://192.168.1.11:13540
  - service: http_status:404
```

**Replace:**
- `PASTE-YOUR-TUNNEL-ID-HERE` with your actual Tunnel ID from Step 5 (appears twice)
- `<YourUser>` with your Windows username
- `yourdomain.com` with your actual domain

---

## Step 8: Test the Tunnel

```powershell
cloudflared tunnel run sage-tunnel
```

You should see output like:
```
INF Starting tunnel
INF Connection established connIndex=0
INF Connection established connIndex=1
INF Connection established connIndex=2
INF Connection established connIndex=3
```

4 connections = healthy tunnel. Leave this running and proceed to test.

**To test from another machine:**
If you have `mysql` CLI on another computer:
```bash
mysql -h sage-db.yourdomain.com -P 13540 -u sysadmin -p simply
```

If it connects, the tunnel works. Press Ctrl+C to stop the test run.

---

## Step 9: Install as a Windows Service (Permanent)

This makes the tunnel start automatically on boot:

```powershell
cloudflared service install
```

Verify in Windows Services:
1. Press `Win+R`, type `services.msc`, press Enter
2. Find **"Cloudflare Tunnel agent"** or **"cloudflared"**
3. Confirm it shows **Status: Running** and **Startup Type: Automatic**

The tunnel is now permanent. It survives reboots, auto-reconnects on network drops.

---

## Step 10: Set Render Environment Variables

1. Go to https://dashboard.render.com
2. Open your backend service (**canoil-portal-1**)
3. Go to **Environment** tab
4. Add these variables:

| Variable           | Value                          |
|---------------------|--------------------------------|
| `SAGE_DB_HOST`     | `sage-db.yourdomain.com`       |
| `SAGE_DB_PORT`     | `13540`                        |
| `SAGE_DB_USER`     | `sysadmin`                     |
| `SAGE_DB_PASSWORD` | *(your Sage MySQL password)*   |
| `SAGE_DB_NAME`     | `simply`                       |

5. Click **Save Changes** — Render will restart the backend automatically

---

## Step 11: Verify It Works

Open this URL in your browser:
```
https://canoil-portal-1.onrender.com/api/sage/test
```

You should see a JSON response like:
```json
{
  "connected": true,
  "company": {
    "sCompName": "Canoil Canada Ltd",
    "sCity": "...",
    "sProvStat": "...",
    "sPhone1": "..."
  },
  "summary": {
    "customers": 353,
    "vendors": 478,
    "inventory_items": 616,
    "sales_orders": 4734
  }
}
```

If you see `connected: true` — you're done! Sage 50 is now accessible from Render through the encrypted Cloudflare Tunnel.

---

## Troubleshooting

### "Connection refused" or timeout
- **Check the tunnel is running:** Open Services (`services.msc`) and verify "Cloudflare Tunnel agent" is Running
- **Check the office machine can reach Sage:** Open PowerShell and run:
  ```powershell
  Test-NetConnection -ComputerName 192.168.1.11 -Port 13540
  ```
  Should show `TcpTestSucceeded: True`
- **Check DNS:** Run `nslookup sage-db.yourdomain.com` — it should resolve to a Cloudflare IP

### "Authentication failed"
- Verify `SAGE_DB_USER` and `SAGE_DB_PASSWORD` in Render match your Sage MySQL credentials
- The default user is `sysadmin` — confirm the password

### Tunnel keeps disconnecting
- Check the office machine's internet connection
- If behind a corporate proxy, set the `HTTP_PROXY` / `HTTPS_PROXY` environment variables for cloudflared
- The service auto-reconnects, but if the internet is down, the tunnel is down

### How to check tunnel status
```powershell
cloudflared tunnel info sage-tunnel
```

### How to view tunnel logs
```powershell
cloudflared tunnel run --loglevel debug sage-tunnel
```
Or check Windows Event Viewer > Application logs for "cloudflared"

---

## Security Notes

- **No ports opened on your firewall** — cloudflared makes outbound connections only
- **Encrypted end-to-end** — traffic between Render and your office is encrypted by Cloudflare
- **Sage stays READ-ONLY** — the tunnel only handles networking; our code has triple-layer read-only protection:
  1. MySQL `SET SESSION TRANSACTION READ ONLY`
  2. `ReadOnlyCursor` blocks non-SELECT queries
  3. `autocommit=False` and `commit()` is never called
- **No one else can access your Sage DB** — the tunnel hostname is private to your Cloudflare account

---

## Quick Reference

| Item                    | Value                                    |
|--------------------------|------------------------------------------|
| Tunnel name             | `sage-tunnel`                            |
| Tunnel hostname         | `sage-db.yourdomain.com`                 |
| Office Sage MySQL       | `192.168.1.11:13540`                     |
| Render env var          | `SAGE_DB_HOST=sage-db.yourdomain.com`    |
| Config file location    | `C:\Users\<You>\.cloudflared\config.yml` |
| Windows service name    | Cloudflare Tunnel agent                  |
| Cloudflare dashboard    | https://dash.cloudflare.com              |
| Render dashboard        | https://dashboard.render.com             |

---

## What This Enables on Render

Once the tunnel is active, all these features work from the cloud:

- Sage 50 Browser (customers, vendors, inventory, accounts, orders, receipts)
- Sage financial reports (monthly sales, customer revenue, vendor spend)
- Sage entity matching (MISys vs Sage key comparison)
- BOM cost rollup using Sage costs
- Inventory reconciliation (MISys vs Sage)
- MO Sage enrichment (customer financials + item costs)
- AP/AR aging (combined portal + Sage data)
- GL summary from Sage
- Margin analysis using Sage cost data

**All READ-ONLY. We never write to Sage.**

---

*Last updated: March 2026*
