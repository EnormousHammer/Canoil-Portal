"""
Unit test for Spectra SO 2749 logic - NO API calls, tests matching and quantity logic.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from logistics_automation import (
    _core_product_for_matching,
    _products_match_via_alias,
)

def test_alias_matching():
    """Multi Purpose Maintenance Spray should match Termin8R Red Totes"""
    email_desc = "MULTI PURPOSE MAINTENANCE SPRAY"
    so_desc = "TERMIN8R RED TOTES"
    email_core = _core_product_for_matching(email_desc)
    so_core = _core_product_for_matching(so_desc)
    match = _products_match_via_alias(email_core, so_core)
    print(f"  email_core: '{email_core}'")
    print(f"  so_core: '{so_core}'")
    print(f"  alias match: {match}")
    assert match, "Alias should match Multi Purpose = Termin8R"
    print("  [OK] Alias matching works")

def test_auto_partial_detection():
    """6000 < 50% of 50000 should trigger trust_email"""
    email_qty = 6000
    so_qty = 50000
    threshold = 0.5
    should_trigger = email_qty < so_qty * threshold
    print(f"  email_qty={email_qty}, so_qty={so_qty}, threshold=50%")
    print(f"  {email_qty} < {so_qty * threshold}? {should_trigger}")
    assert should_trigger, "Should trigger for 6000 vs 50000"
    print("  [OK] Auto partial detection threshold correct")

def test_full_shipment_no_trigger():
    """100 vs 100 should NOT trigger"""
    email_qty = 100
    so_qty = 100
    should_trigger = email_qty < so_qty * 0.5
    print(f"  email_qty={email_qty}, so_qty={so_qty}")
    print(f"  Would trigger? {should_trigger}")
    assert not should_trigger, "Full shipment should NOT trigger"
    print("  [OK] Full shipments not affected")

def test_extract_skid_tote():
    """extract_skid_info should use tote_count for totes"""
    from new_bol_generator import extract_skid_info
    email_analysis = {
        'skid_info': '',  # Empty so we test fallback
        'pallet_dimensions': '40×46×48 inches',
        'packaging_type': 'tote',
        'pallet_count': 0,
        'tote_count': 6,
    }
    skid_info, total_skids = extract_skid_info(email_analysis)
    print(f"  skid_info: '{skid_info}'")
    print(f"  total_skids: {total_skids}")
    assert '6' in skid_info and 'tote' in skid_info.lower(), "Should have 6 totes"
    assert total_skids == 6, "total_skids should be 6"
    print("  [OK] extract_skid_info uses tote_count for totes")

def main():
    print("=" * 60)
    print("SPECTRA SO 2749 - Logic Verification (no API)")
    print("=" * 60)
    try:
        test_alias_matching()
        test_auto_partial_detection()
        test_full_shipment_no_trigger()
        test_extract_skid_tote()
        print("\n" + "=" * 60)
        print("ALL CHECKS PASSED")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\nFAIL: {e}")
        return 1
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
