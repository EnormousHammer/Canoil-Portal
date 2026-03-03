"""
MISys Bridge Launcher
=====================
Starts the bridge + cloudflared tunnel, then auto-updates Render
with the new tunnel URL so the cloud app always points to the right place.

Usage:
    python start_bridge.py

Requires (set in .env or environment):
    RENDER_API_KEY      - from Render dashboard > Account Settings > API Keys
    RENDER_SERVICE_ID   - from Render dashboard URL: srv-XXXXXXXX
"""

import os
import re
import sys
import time
import subprocess
import threading
import requests

# Unbuffer stdout/stderr so print() appears immediately in terminal
try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except AttributeError:
    pass  # Python < 3.7 fallback

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────────────────────

BRIDGE_PORT     = 5003
CLOUDFLARED_EXE = os.path.join(os.path.dirname(__file__), "cloudflared.exe")
BRIDGE_SCRIPT   = os.path.join(os.path.dirname(__file__), "misys_bridge.py")

RENDER_API_KEY     = os.environ.get("RENDER_API_KEY", "")
RENDER_SERVICE_ID  = os.environ.get("RENDER_SERVICE_ID", "")  # e.g. srv-abc123

# ── Render API ────────────────────────────────────────────────────────────────

def update_render_env(tunnel_url: str) -> bool:
    """Update MISYS_LIVE_SQL_URL env var on Render via API."""
    if not RENDER_API_KEY or not RENDER_SERVICE_ID:
        print("[launcher] Render API key or service ID not set — skipping auto-update.")
        print(f"[launcher] Set manually in Render: MISYS_LIVE_SQL_URL = {tunnel_url}")
        return False

    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Content-Type":  "application/json",
    }

    # Render API: PUT /services/{id}/env-vars  (replaces all env vars)
    # Use PATCH-style: get current env vars first, then update/add ours
    try:
        # 1. Get existing env vars
        # Render returns: [{"envVar": {"key": ..., "value": ...}, "cursor": ...}, ...]
        r = requests.get(
            f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/env-vars",
            headers=headers, timeout=15
        )
        r.raise_for_status()
        existing = r.json()

        # 2. Replace or add MISYS_LIVE_SQL_URL
        # Each item in the list has an "envVar" wrapper
        updated = [
            {"key": item["envVar"]["key"], "value": item["envVar"]["value"]}
            for item in existing
            if item.get("envVar", {}).get("key") != "MISYS_LIVE_SQL_URL"
        ]
        updated.append({"key": "MISYS_LIVE_SQL_URL", "value": tunnel_url})

        # 3. PUT updated list back
        r2 = requests.put(
            f"https://api.render.com/v1/services/{RENDER_SERVICE_ID}/env-vars",
            headers=headers, json=updated, timeout=15
        )
        r2.raise_for_status()
        print(f"[launcher] Render updated: MISYS_LIVE_SQL_URL = {tunnel_url}")
        return True
    except Exception as e:
        print(f"[launcher] Render API error: {e}")
        print(f"[launcher] Set manually: MISYS_LIVE_SQL_URL = {tunnel_url}")
        return False


# ── Cloudflared ───────────────────────────────────────────────────────────────

def start_tunnel_and_get_url() -> tuple[subprocess.Popen, str]:
    """Start cloudflared and wait for the tunnel URL to appear in output."""
    if not os.path.exists(CLOUDFLARED_EXE):
        print(f"[launcher] cloudflared.exe not found at {CLOUDFLARED_EXE}")
        sys.exit(1)

    print(f"[launcher] Starting cloudflared tunnel -> http://localhost:{BRIDGE_PORT}")
    proc = subprocess.Popen(
        [CLOUDFLARED_EXE, "tunnel", "--url", f"http://localhost:{BRIDGE_PORT}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    url_pattern = re.compile(r"https://[a-z0-9\-]+\.trycloudflare\.com")
    tunnel_url  = None
    deadline    = time.time() + 60  # wait up to 60s for URL

    for line in proc.stdout:
        line = line.strip()
        if line:
            print(f"  [cloudflared] {line}")
        match = url_pattern.search(line)
        if match and "api.trycloudflare.com" not in line:
            tunnel_url = match.group(0)
            break
        if time.time() > deadline:
            print("[launcher] Timeout waiting for cloudflared URL")
            break

    # Keep draining stdout in background so the process doesn't hang
    def _drain():
        for line in proc.stdout:
            if line.strip():
                print(f"  [cloudflared] {line.strip()}")
    threading.Thread(target=_drain, daemon=True).start()

    return proc, tunnel_url


# ── Bridge ────────────────────────────────────────────────────────────────────

def start_bridge() -> subprocess.Popen:
    """Start the Flask bridge server in a subprocess."""
    print(f"[launcher] Starting misys_bridge.py on port {BRIDGE_PORT}...")
    proc = subprocess.Popen(
        [sys.executable, BRIDGE_SCRIPT],
        cwd=os.path.dirname(__file__),
    )
    return proc


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  MISys Bridge Launcher")
    print("=" * 60)

    # 1. Start bridge first — it pre-loads data (~40s) while tunnel connects
    bridge_proc = start_bridge()

    print(f"[launcher] Bridge starting, waiting 60s for data pre-load...")
    time.sleep(60)  # give bridge time to load all data before tunneling

    # 2. Start cloudflared tunnel (bridge is now ready on port 5003)
    tunnel_proc, tunnel_url = start_tunnel_and_get_url()

    if not tunnel_url:
        print("[launcher] Could not get tunnel URL — bridge still running locally.")
        print(f"[launcher] You can still access it at http://localhost:{BRIDGE_PORT}")
        # Don't exit — keep bridge alive; user can retry tunnel manually
        try:
            while True:
                time.sleep(10)
                if bridge_proc.poll() is not None:
                    print("[launcher] Bridge process died — restarting...")
                    bridge_proc = start_bridge()
        except KeyboardInterrupt:
            print("\n[launcher] Shutting down...")
            bridge_proc.terminate()
            print("[launcher] Done.")
        return

    print(f"\n[launcher] Tunnel URL: {tunnel_url}\n")

    # 3. Update Render env var
    update_render_env(tunnel_url)

    print("\n[launcher] Both processes running. Press Ctrl+C to stop.\n")
    print(f"  Bridge:  http://localhost:{BRIDGE_PORT}")
    print(f"  Tunnel:  {tunnel_url}")
    print(f"  Health:  {tunnel_url}/health")
    print(f"  Data:    {tunnel_url}/api/data")
    print()

    # 4. Monitor — restart bridge/tunnel if they crash
    try:
        while True:
            time.sleep(10)
            if bridge_proc.poll() is not None:
                print("[launcher] Bridge process died — restarting...")
                bridge_proc = start_bridge()
                time.sleep(60)  # wait for data reload
            if tunnel_proc.poll() is not None:
                print("[launcher] Tunnel died — restarting and updating Render...")
                tunnel_proc, tunnel_url = start_tunnel_and_get_url()
                if tunnel_url:
                    update_render_env(tunnel_url)
    except KeyboardInterrupt:
        print("\n[launcher] Shutting down...")
        bridge_proc.terminate()
        tunnel_proc.terminate()
        print("[launcher] Done.")


if __name__ == "__main__":
    main()
