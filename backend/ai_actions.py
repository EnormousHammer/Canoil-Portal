"""
AI Command Center - Task Execution Actions

Handles natural-language task requests like:
- "Create a PR for 2 cases of MOVLL0 Kegs"
- "Generate a proforma invoice for SO 1234"
"""

import re
import os
from typing import Optional, Dict, Any, Tuple
from io import BytesIO


def _extract_pr_params(message: str) -> Optional[Dict[str, Any]]:
    """
    Extract product and quantity from a create-PR message using regex.
    Examples:
      - "create a pr for 2 cases of MOVLL0 Kegs" -> {product: "MOVLL0 Kegs", quantity: 2, unit: "cases"}
      - "create pr for 5 drums of MOV Long Life" -> {product: "MOV Long Life", quantity: 5, unit: "drums"}
    """
    msg = message.strip()
    # Primary: "create pr for 2 cases of MOVLL0 Kegs" -> qty, unit, product
    m = re.search(
        r"(?:create|make|generate)\s+(?:a\s+)?(?:pr|purchase\s+requisition)\s+for\s+(\d+)\s+"
        r"(cases?|drums?|pails?|kegs?|totes?)\s+of\s+(.+)",
        msg, re.IGNORECASE
    )
    if m:
        return {"product": m.group(3).strip(), "quantity": int(m.group(1)), "unit": m.group(2)}
    # Alternate: "create pr for MOVLL0 Kegs 2 cases"
    m = re.search(
        r"(?:create|make|generate)\s+(?:a\s+)?(?:pr|purchase\s+requisition)\s+for\s+(.+?)\s+(\d+)\s+"
        r"(cases?|drums?|pails?|kegs?|totes?)",
        msg, re.IGNORECASE
    )
    if m:
        return {"product": m.group(1).strip(), "quantity": int(m.group(2)), "unit": m.group(3)}
    # Short: "pr for 2 cases of X"
    m = re.search(r"pr\s+for\s+(\d+)\s+(cases?|drums?|pails?|kegs?|totes?)\s+of\s+(.+)", msg, re.IGNORECASE)
    if m:
        return {"product": m.group(3).strip(), "quantity": int(m.group(1)), "unit": m.group(2)}
    return None


def _search_items_for_product(product: str, limit: int = 5) -> list:
    """Search items by product name. Returns list of {item_no, description, ...}."""
    try:
        from purchase_requisition_service import load_items
        items = load_items()
        if not items:
            return []
        # Build search terms: "MOVLL0" -> also try "MOV Long Life", "Keg"
        terms = re.sub(r"[^\w\s]", " ", product).split()
        terms = [t for t in terms if len(t) >= 2]
        if not terms:
            terms = [product[:4]] if len(product) >= 4 else [product]
        matches = []
        for item in items:
            item_no = str(item.get("Item No.", "")).lower()
            desc = str(item.get("Description", "")).lower()
            score = 0
            for t in terms:
                t_lower = t.lower()
                if t_lower in item_no:
                    score += 100
                if t_lower in desc:
                    score += 50
                if item_no.startswith(t_lower):
                    score += 200
            if score > 0:
                matches.append({
                    "score": score,
                    "item_no": item.get("Item No."),
                    "description": item.get("Description"),
                    "stocking_units": item.get("Stocking Units", "EA"),
                    "purchasing_units": item.get("Purchasing Units", "EA"),
                })
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:limit]
    except Exception as e:
        print(f"[AI Actions] Item search error: {e}")
        return []


def execute_create_pr(message: str, app) -> Tuple[str, Optional[Dict], Optional[bytes], Optional[str]]:
    """
    Execute create-PR action from natural language.
    Returns: (response_text, action_result_dict, file_bytes, filename)
    """
    params = _extract_pr_params(message)
    if not params:
        return (
            "I couldn't parse the product and quantity from your message. "
            "Please try: \"Create a PR for 2 cases of MOV Long Life 0 Kegs\" "
            "(include quantity, unit, and product name).",
            None,
            None,
            None,
        )

    product = params["product"]
    qty = params["quantity"]
    unit = params.get("unit", "EA")

    matches = _search_items_for_product(product)
    if not matches:
        return (
            f"I couldn't find any items matching \"{product}\" in the item master. "
            "Please check the product name and try again.",
            None,
            None,
            None,
        )

    best = matches[0]
    item_no = best["item_no"]
    description = best["description"]

    pr_items = [{
        "item_no": item_no,
        "description": description,
        "quantity": qty,
        "unit": best.get("purchasing_units") or best.get("stocking_units") or unit,
    }]

    pr_payload = {
        "user_info": {
            "name": "AI Command",
            "department": "Sales",
            "justification": f"AI Command: {qty} {unit} of {product}",
        },
        "items": pr_items,
        "supplier": {},
    }

    try:
        with app.test_client() as client:
            resp = client.post("/api/pr/generate", json=pr_payload)
            if resp.status_code != 200:
                err = resp.get_json() if resp.is_json else {"error": resp.data.decode()[:200]}
                return (
                    f"PR generation failed: {err.get('error', 'Unknown error')}",
                    None,
                    None,
                    None,
                )
            file_bytes = resp.data
            cd = resp.headers.get("Content-Disposition", "")
            filename = "PR_AI_Command.xlsx"
            if "filename=" in cd:
                import re as _re
                m = _re.search(r'filename[*]?=(?:UTF-8\'\')?([^;\n]+)', cd)
                if m:
                    filename = m.group(1).strip().strip('"\'')
    except Exception as e:
        print(f"[AI Actions] PR generate error: {e}")
        import traceback
        traceback.print_exc()
        return (
            f"PR generation failed: {str(e)}",
            None,
            None,
            None,
        )

    response_text = (
        f"✅ **I've created a Purchase Requisition** for {qty} {unit} of **{description}** ({item_no}).\n\n"
        "The PR has been generated. Click the download button below to save it."
    )
    action_result = {
        "type": "pr",
        "item_no": item_no,
        "description": description,
        "quantity": qty,
        "filename": filename,
    }
    return response_text, action_result, file_bytes, filename


def is_create_pr_request(message: str) -> bool:
    """Check if the message is a create-PR request."""
    msg = message.lower().strip()
    if "create" in msg and ("pr" in msg or "purchase requisition" in msg):
        return True
    if "make" in msg and ("pr" in msg or "purchase requisition" in msg):
        return True
    if "generate" in msg and ("pr" in msg or "purchase requisition" in msg):
        return True
    return False
