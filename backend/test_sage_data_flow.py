#!/usr/bin/env python3
"""
Sage Data Flow Diagnostic — Verify we're not excluding valid data.
Run from backend/: python test_sage_data_flow.py

Compares:
1. tcustomr (Sage built-in dAmtYtd, dLastYrAmt) vs titrec (our aggregation)
2. Row counts before/after our filters (reversals, valid-customer)
3. What data we load and from where
"""
import os
import sys
import pandas as pd

# Ensure backend is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def main():
    print("=" * 60)
    print("SAGE DATA FLOW DIAGNOSTIC")
    print("=" * 60)

    import sage_gdrive_service as sgs

    # 1. Load data
    print("\n1. LOADING SAGE DATA")
    print("-" * 40)
    tables, err = sgs.load_data(force=True)
    if err:
        print(f"   ERROR: {err}")
        return
    print(f"   Loaded {len(tables)} tables from: {sgs._cache_folder}")
    for t, df in tables.items():
        print(f"   - {t}: {len(df)} rows" if df is not None else f"   - {t}: NOT LOADED")

    # 2. titrec raw vs filtered
    print("\n2. TITREC — RAW vs OUR FILTERS")
    print("-" * 40)
    titrec = tables.get("titrec")
    if titrec is None or titrec.empty:
        print("   titrec not loaded")
    else:
        date_col = sgs._find_col(titrec, ["dtASDate", "dtDate"])
        cid_col = sgs._find_col(titrec, ["lVenCusId", "lCusId"])
        amt_col = sgs._find_col(titrec, ["dInvAmt", "dAmt", "dTotalAmt"])
        rev_col = sgs._find_col(titrec, ["bReversal"])
        rev2_col = sgs._find_col(titrec, ["bReversed"])

        print(f"   Columns: date={date_col}, cid={cid_col}, amt={amt_col}, bReversal={rev_col}, bReversed={rev2_col}")

        total_rows = len(titrec)
        amt_pos = titrec[amt_col] if amt_col else None
        if amt_col:
            amt_numeric = titrec[amt_col].apply(lambda x: sgs._safe_float(x))
            pos_rows = (amt_numeric > 0).sum()
        else:
            pos_rows = 0

        print(f"   Total rows: {total_rows}")
        if amt_col:
            print(f"   Rows with dInvAmt>0: {pos_rows}")

        if rev_col:
            rev_zeros = (titrec[rev_col].fillna(0).astype(str).str.strip().isin(["0", "0.0", ""])).sum()
            rev_ones = (pd.to_numeric(titrec[rev_col], errors="coerce").fillna(0) == 1).sum()
            print(f"   bReversal=0: {rev_zeros}, bReversal=1: {rev_ones}")
        if rev2_col:
            r2_ones = (pd.to_numeric(titrec[rev2_col], errors="coerce").fillna(0) == 1).sum()
            print(f"   bReversed=1: {r2_ones}")

        # Valid customer filter
        tcustomr = tables.get("tcustomr")
        if tcustomr is not None and not tcustomr.empty and cid_col:
            id_col = sgs._find_col(tcustomr, ["lId", "lid"])
            if id_col:
                valid_cids = set(pd.to_numeric(tcustomr[id_col], errors="coerce").fillna(0).astype(int).tolist())
                valid_cids.discard(0)
                titrec_cids = set(pd.to_numeric(titrec[cid_col], errors="coerce").fillna(0).astype(int).tolist())
                in_tcustomr = titrec_cids & valid_cids
                not_in_tcustomr = titrec_cids - valid_cids
                print(f"   Unique lVenCusId in titrec: {len(titrec_cids)}")
                print(f"   In tcustomr (valid customers): {len(in_tcustomr)}")
                print(f"   NOT in tcustomr (vendor IDs?): {len(not_in_tcustomr)}")
                if not_in_tcustomr and len(not_in_tcustomr) <= 20:
                    print(f"   Sample IDs not in tcustomr: {sorted(not_in_tcustomr)[:10]}")

    # 3. tcustomr vs titrec revenue (current FY)
    print("\n3. TCUSTOMR (Sage built-in) vs TITREC (our aggregation) — Current FY")
    print("-" * 40)
    current_fy = sgs._current_fiscal_year()
    txn_rev = sgs._customer_revenue_from_titrec(current_fy)
    txn_prev = sgs._customer_revenue_from_titrec(current_fy - 1)

    tcustomr = tables.get("tcustomr")
    if tcustomr is not None and not tcustomr.empty:
        cust_df = tcustomr[tcustomr["bInactive"].fillna(0) == 0] if "bInactive" in tcustomr.columns else tcustomr
        ytd_col = sgs._find_col(cust_df, ["dAmtYtd", "dAmtYTd"])
        ly_col = sgs._find_col(cust_df, ["dLastYrAmt", "dLastYRAmt"])
        sage_ytd_total = cust_df[ytd_col].apply(sgs._safe_float).sum() if ytd_col else 0
        sage_ly_total = cust_df[ly_col].apply(sgs._safe_float).sum() if ly_col else 0
        titrec_ytd_total = sum(txn_rev.values())
        titrec_ly_total = sum(txn_prev.values())

        print(f"   FY{current_fy} YTD:")
        print(f"     tcustomr.dAmtYtd total: ${sage_ytd_total:,.2f}")
        print(f"     titrec aggregated:      ${titrec_ytd_total:,.2f}")
        print(f"     Difference:             ${abs(sage_ytd_total - titrec_ytd_total):,.2f}")

        print(f"   FY{current_fy - 1} total:")
        print(f"     tcustomr.dLastYrAmt total: ${sage_ly_total:,.2f}")
        print(f"     titrec aggregated:        ${titrec_ly_total:,.2f}")
        print(f"     Difference:               ${abs(sage_ly_total - titrec_ly_total):,.2f}")

        # Top 5 comparison
        print("\n   Top 5 customers — tcustomr vs titrec:")
        if ytd_col:
            cust_df = cust_df.copy()
            cust_df["_ytd_num"] = cust_df[ytd_col].apply(sgs._safe_float)
            sage_top = cust_df.nlargest(5, "_ytd_num", keep="first")
            id_col = sgs._find_col(cust_df, ["lId", "lid"])
            name_col = sgs._find_col(cust_df, ["sName", "sname"])
            for _, r in sage_top.iterrows():
                cid = int(r.get(id_col, 0) or 0)
                t_ytd = txn_rev.get(cid, 0)
                sage_ytd = sgs._safe_float(r.get(ytd_col, 0))
                name = str(r.get(name_col, ""))[:30]
                match = "OK" if abs(sage_ytd - t_ytd) < 1 else "DIFF"
                print(f"     [{match}] {name:30} | Sage YTD: ${sage_ytd:>12,.2f} | titrec: ${t_ytd:>12,.2f}")

    # 4. Recency filter impact
    print("\n4. RECENCY FILTER (last sale >2 FY ago)")
    print("-" * 40)
    top_result = sgs.get_top_customers(limit=50, year=current_fy)
    total_before = len([c for c in (sgs._tables().get("tcustomr") or [])])  # approximate
    total_after = top_result.get("total", 0)
    print(f"   Customers with revenue (before recency filter): from txn_rev")
    print(f"   Customers shown after recency filter: {total_after}")
    print(f"   Top customers returned: {len(top_result.get('customers', []))}")

    print("\n" + "=" * 60)
    print("DONE. Use tcustomr (Sage built-in) for current FY to match Sage exactly.")
    print("=" * 60)


if __name__ == "__main__":
    main()
