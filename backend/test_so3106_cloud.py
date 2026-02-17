#!/usr/bin/env python3
"""
Test SO 3106 via CLOUD API (Render) - process-email endpoint. No local files.
Requires: Google Drive API enabled on Render, SO 3106 PDF in Sales_CSR drive.
Usage: python test_so3106_cloud.py
"""
import requests
import sys

CLOUD_URL = "https://canoil-portal-1.onrender.com"

EMAIL_SO3106 = """Hi,

Mosier International's PO 3448 (Canoil sales order 3106) is ready to ship:

- 252 cases 2T SEMI-SYNTHETIC BLUE 12x1L
- 154 cases CC 2T SEMI-SYNTHETIC 2C BLUE 12x1L
- 120 cases CC SAE30 4T 12x600ml
- 84 cases CC SL BAR & CHAIN Oil 12x1L
- 60 cases CC SL BAR & CHAIN Oil 4X4L
- 434 cases EP-0 Lithium Complex 12x120g

Total 6 pallets, 1200 kg. Advise when ready to ship.
"""


def test_cloud_process_email():
    print("=" * 60)
    print("CLOUD TEST: process-email for SO 3106 (Render)")
    print("=" * 60)
    print(f"URL: {CLOUD_URL}/api/logistics/process-email")
    print()

    try:
        response = requests.post(
            f"{CLOUD_URL}/api/logistics/process-email",
            json={"email_content": EMAIL_SO3106},
            timeout=120
        )
    except requests.exceptions.RequestException as e:
        print(f"FAIL: Request failed - {e}")
        return False

    if response.status_code != 200:
        print(f"FAIL: Status {response.status_code}")
        try:
            err = response.json()
            print(f"  Error: {err.get('error', response.text[:300])}")
        except Exception:
            print(f"  Body: {response.text[:500]}")
        return False

    result = response.json()
    so_data = result.get("so_data", {})
    items = result.get("items", so_data.get("items", []))

    print(f"SO Number: {so_data.get('so_number', 'N/A')}")
    print(f"Items: {len(items)}")
    for i, it in enumerate(items, 1):
        desc = (it.get("description") or it.get("item_code") or "")[:50]
        qty = it.get("quantity")
        unit = it.get("unit", "")
        print(f"  {i}. {desc} | Qty: {qty} {unit}")

    has_4x4l = any("4X4L" in (it.get("description") or it.get("item_code") or "").upper() for it in items)

    if len(items) == 6 and has_4x4l:
        print()
        print("PASS: 6 items including CC SL BAR & CHAIN Oil 4X4L CASE")
        return True
    else:
        print()
        print(f"FAIL: expected 6 items with 4X4L, got {len(items)} items, 4X4L present: {has_4x4l}")
        return False


if __name__ == "__main__":
    ok = test_cloud_process_email()
    sys.exit(0 if ok else 1)
