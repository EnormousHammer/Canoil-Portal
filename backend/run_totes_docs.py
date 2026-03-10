"""
Run logistics automation for Big Red Oil totes (SO 3097 & 3099) and save BOL + Packing Slip.
Usage: python run_totes_docs.py
Requires: Backend running on localhost:5002
"""
import requests
import json
import os

BASE_URL = "http://localhost:5002"

# Big Red Oil totes email content (user's format)
EMAIL_CONTENT = """
Sales Order 3097 (PO C121125-2):
  - Product: 210 cases of BRO SAE 5W-30 Synthetic Blend (12x946ml Case)
  - Batch Number: N60047
  - Weights: 2040 kg net / 2313 kg gross
  - Pallets: 3 pallets (45×45×63 inches each)
  - Totes for Return: 3 Totes (2 empty + 1 with approx. 505 kg / 591 L)

Sales Order 3099 (PO C121125-1):
  - Product: 210 cases of BRO SAE 5W-20 Synthetic Blend (12x946ml Case)
  - Batch Number: N55099
  - Weights: 2048 kg net / 2313 kg gross
  - Pallets: 3 pallets (45×45×63 inches each)
  - Totes for Return: 3 Totes (2 empty + 1 with approx. 529 kg / 617 L)

Combined Shipment Totals:
  - Total Skids: 6
  - Total Gross Weight: 4626 kg
"""

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "generated_totes_docs")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("=" * 70)
    print("BIG RED OIL TOTES - Generating BOL and Packing Slip")
    print("=" * 70)

    # Step 1: Process email
    print("\n1. Processing email (process-email)...")
    try:
        r1 = requests.post(
            f"{BASE_URL}/api/logistics/process-email",
            json={"email_content": EMAIL_CONTENT, "processing_mode": "multi_so"},
            timeout=120,
        )
    except requests.exceptions.ConnectionError:
        print("\nERROR: Cannot connect to backend. Start it first:")
        print("  cd backend && python app.py")
        print("  (or use launch-canoil.bat)")
        return 1

    if r1.status_code != 200:
        print(f"ERROR: process-email failed: {r1.status_code}")
        print(r1.text[:800])
        return 1

    result = r1.json()
    if not result.get("success"):
        print(f"ERROR: {result.get('error', 'Unknown error')}")
        return 1

    print("   OK - Multi-SO processed")

    # Step 2: Generate documents (BOL + Packing Slip only)
    print("\n2. Generating documents (generate-all-documents)...")
    payload = {
        "so_data": result.get("so_data", {}),
        "so_data_list": result.get("so_data_list", []),
        "email_shipping": result.get("email_shipping", {}),
        "email_analysis": result.get("email_analysis", result.get("email_data", {})),
        "items": result.get("items", []),
        "requested_documents": {
            "bol": True,
            "packing_slip": True,
            "commercial_invoice": False,
            "usmca": False,
            "tsca": False,
            "dangerous_goods": False,
        },
    }

    r2 = requests.post(
        f"{BASE_URL}/api/logistics/generate-all-documents",
        json=payload,
        timeout=180,
    )

    if r2.status_code != 200:
        print(f"ERROR: generate-all-documents failed: {r2.status_code}")
        print(r2.text[:800])
        return 1

    gen = r2.json()
    if not gen.get("success"):
        print(f"ERROR: {gen.get('error', 'Unknown error')}")
        return 1

    # Find totes BOL and Packing Slip (so_number = TOTES-RETURN)
    results = gen.get("results", {})
    bols = results.get("bols", [])
    pss = results.get("packing_slips", [])

    tote_bol = next((b for b in bols if b.get("so_number") == "TOTES-RETURN"), None)
    tote_ps = next((p for p in pss if p.get("so_number") == "TOTES-RETURN"), None)

    if not tote_bol and bols:
        tote_bol = bols[-1]
    if not tote_ps and pss:
        tote_ps = pss[-1]

    saved = []

    def _copy_doc(doc, default_name):
        """Copy from uploads folder (backend saves to uploads/logistics/Company/Year/Month/Order/HTML Format/)"""
        if not doc or not doc.get("filename"):
            return None
        backend_dir = os.path.dirname(__file__)
        uploads_dir = os.path.join(backend_dir, "uploads", "logistics")
        company = gen.get("company_name", "").strip()
        folder_name = gen.get("folder_name", "").replace("\\", os.sep)
        if not company or not folder_name:
            return None
        # Path: uploads/logistics/Company/Year/Month/Order/HTML Format/filename
        src = os.path.join(uploads_dir, company, folder_name, "HTML Format", doc.get("filename", default_name))
        if os.path.exists(src):
            dst = os.path.join(OUTPUT_DIR, doc.get("filename", default_name))
            try:
                with open(src, "r", encoding="utf-8") as f:
                    content = f.read()
                with open(dst, "w", encoding="utf-8") as f:
                    f.write(content)
                return dst
            except Exception as e:
                print(f"   Copy error: {e}")
        return None

    def _download(doc, default_name):
        if not doc or not doc.get("download_url"):
            return None
        raw_url = doc["download_url"]
        url_path = raw_url.replace("\\", "/")
        url = f"{BASE_URL}{url_path}"
        try:
            r = requests.get(url, timeout=30)
            if r.status_code == 200:
                path = os.path.join(OUTPUT_DIR, doc.get("filename", default_name))
                with open(path, "w", encoding="utf-8") as f:
                    f.write(r.text)
                return path
        except Exception as e:
            print(f"   Download error: {e}")
        return None

    # Get BOL and Packing Slip (try copy from disk first, then download)
    if tote_bol:
        print(f"\n   BOL: {tote_bol.get('filename', 'BOL')}")
        path = _copy_doc(tote_bol, "BOL_Totes.html")
        if not path:
            path = _download(tote_bol, "BOL_Totes.html")
        if path:
            saved.append(path)
            print(f"   Saved: {path}")
        else:
            print(f"   Failed to get BOL")

    if tote_ps:
        print(f"\n   Packing Slip: {tote_ps.get('filename', 'PackingSlip')}")
        path = _copy_doc(tote_ps, "PackingSlip_Totes.html")
        if not path:
            path = _download(tote_ps, "PackingSlip_Totes.html")
        if path:
            saved.append(path)
            print(f"   Saved: {path}")
        else:
            print(f"   Failed to get Packing Slip")

    if not saved:
        print("\n   No totes documents found in response.")
        print("   Full keys:", list(gen.keys()))
        if "results" in gen:
            print("   results keys:", list(gen["results"].keys()))
        # Save full response for debugging
        debug_path = os.path.join(OUTPUT_DIR, "generate_response.json")
        with open(debug_path, "w", encoding="utf-8") as f:
            json.dump(gen, f, indent=2, default=str)
        print(f"   Debug: saved full response to {debug_path}")
        return 1

    print("\n" + "=" * 70)
    print("DONE - Totes documents saved to:")
    for p in saved:
        print(f"  {p}")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    exit(main())
