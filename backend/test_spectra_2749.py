"""
Test Spectra SO 2749 - 6000 L in 6 totes (partial of 50,000 L blanket)
"""
import requests
import json
import os

BASE_URL = "http://localhost:5002"

EMAIL_CONTENT = """
Hi Haron,

Spectra Products Inc purchase order number 0000300865 (Canoil sales orders 2749 attached) is ready to go out the door:

6000 litres of Multi Purpose Maintenance Spray 
5178 kg total net weight, 5562 kg total gross weight, Batch number CCL-26048
In 6 totes  40 × 46 × 48 inches each tote

BOL Notes:  with these 6,000 litres, 48,000 of the 50,000 litres mentioned in the blanket order have already been shipped.
"""


def main():
    print("=" * 70)
    print("SPECTRA SO 2749 - Testing Auto Partial Detection + Document Generation")
    print("=" * 70)

    # Step 1: Process email (Auto mode - no trust_email flag)
    print("\n1. Processing email (process-email, auto mode)...")
    try:
        r1 = requests.post(
            f"{BASE_URL}/api/logistics/process-email",
            json={"email_content": EMAIL_CONTENT, "processing_mode": "auto"},
            timeout=120,
        )
    except requests.exceptions.ConnectionError:
        print("\nERROR: Cannot connect to backend. Start it first:")
        print("  cd backend && python app.py")
        print("  (or use launch-canoil.bat)")
        return 1

    if r1.status_code != 200:
        print(f"ERROR: process-email failed: {r1.status_code}")
        print(r1.text[:1500])
        return 1

    result = r1.json()
    if not result.get("success"):
        print(f"ERROR: {result.get('error', 'Unknown error')}")
        if result.get("validation_errors"):
            print("Validation errors:", result["validation_errors"])
        return 1

    print("   OK - Email processed successfully")

    # Check trust_email was auto-enabled
    trust_mode = result.get("trust_email_mode", False)
    print(f"\n   trust_email_mode: {trust_mode}")

    # Check SO items
    so_data = result.get("so_data", {})
    items = so_data.get("items", [])
    print(f"\n2. SO Items (after processing):")
    for i, item in enumerate(items, 1):
        qty = item.get("quantity", "?")
        desc = item.get("description", "")[:50]
        liters = item.get("liters_filled", "")
        unit = item.get("unit", "")
        print(f"   Item {i}: qty={qty}, unit={unit}, liters_filled={liters}")
        print(f"           desc={desc}...")

    # Check email_analysis
    email_analysis = result.get("email_analysis", result.get("email_data", {}))
    print(f"\n3. Email Analysis:")
    print(f"   skid_info: {email_analysis.get('skid_info')}")
    print(f"   tote_count: {email_analysis.get('tote_count')}")
    print(f"   packaging_type: {email_analysis.get('packaging_type')}")
    print(f"   total_weight: {email_analysis.get('total_weight')}")

    # Step 2: Generate documents
    print("\n4. Generating documents (BOL, Packing Slip, CI)...")
    payload = {
        "so_data": so_data,
        "email_shipping": result.get("email_shipping", {}),
        "email_analysis": email_analysis,
        "items": result.get("items", items),
        "requested_documents": {
            "bol": True,
            "packing_slip": True,
            "commercial_invoice": True,
            "usmca": False,
            "tsca": False,
            "dangerous_goods": False,
        },
    }
    r2 = requests.post(
        f"{BASE_URL}/api/logistics/generate-all-documents",
        json=payload,
        timeout=120,
    )
    if r2.status_code != 200:
        print(f"ERROR: generate-all-documents failed: {r2.status_code}")
        print(r2.text[:1000])
        return 1

    gen_result = r2.json()
    if not gen_result.get("success"):
        print(f"ERROR: {gen_result.get('error', 'Unknown error')}")
        return 1

    print("   OK - Documents generated")

    # Show results
    docs = gen_result.get("documents", [])
    print(f"\n5. Generated documents:")
    for doc in docs:
        print(f"   - {doc.get('document_type', '?')}: {doc.get('filename', '?')}")

    # Try to download and show BOL content
    folder = gen_result.get("folder_name", "")
    if folder and docs:
        bol_doc = next((d for d in docs if "BOL" in (d.get("document_type") or "")), None)
        if bol_doc:
            dl_url = bol_doc.get("download_url", "")
            if dl_url:
                print(f"\n6. BOL download URL: {dl_url}")
                print(f"   (Open in browser: {BASE_URL}{dl_url})")

    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    exit(main())
