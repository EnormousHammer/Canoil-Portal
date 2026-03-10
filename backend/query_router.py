"""
Smart Query Router for Canoil AI Chat.

Classifies user queries into intents and fetches ONLY the relevant data
from the appropriate source, instead of loading the full ERP + Sage dataset
on every question.

Intent → Data Source mapping:
  so_list           → Sage tsalordr (open SOs only)
  so_detail         → SmartSOSearch / RealSalesOrders (handled upstream)
  inventory         → MiSys Items.json / MIITEM.json + MIILOC.json
  manufacturing     → MiSys ManufacturingOrderHeaders / MIMOH.json
  purchase_orders   → MiSys PurchaseOrders / MIPOH.json
  ar_aging          → Sage tcustr / AR aging endpoint
  customers         → Sage tcustomr
  bom               → MiSys BillsOfMaterial / MIBOMH + MIBOMD
"""

import re
import json
from typing import Tuple, Dict, Any

# ──────────────────────────────────────────────────────────────────────────────
# INTENT DEFINITIONS
# priority  – higher wins when two intents match the same query
# patterns  – compiled regex (case-insensitive), match against full query
# keywords  – plain substrings; any single hit triggers this intent
# data_sources – which backend sources the fetcher should pull
# model     – OpenAI model to use (gpt-5.2-chat-latest for simple queries, gpt-5.2 for complex)
# ──────────────────────────────────────────────────────────────────────────────
INTENT_DEFINITIONS: Dict[str, Any] = {
    # Specific SO number lookup — SmartSOSearch handles it upstream; we still
    # declare this intent so the router can skip the focused path gracefully.
    "so_detail": {
        "priority": 10,
        "patterns": [
            r"\bso\s*#?\s*\d{3,}\b",
            r"\bsales\s+order\s+#?\s*\d{3,}\b",
            r"\border\s+#?\s*\d{3,}\b",
            r"\bsalesorder[_\s]*\d{3,}\b",
        ],
        "keywords": [],
        "data_sources": ["real_sales_orders"],
        "model": "gpt-5.2",
    },
    # List / summary of sales orders (no specific SO number)
    "so_list": {
        "priority": 8,
        "patterns": [
            r"\bhow many sales order",
            r"\bhow many so\b",
        ],
        "keywords": [
            "pending sales order",
            "open sales order",
            "active sales order",
            "list sales order",
            "show sales order",
            "all sales order",
            "our sales order",
            "current sales order",
            "sales orders with customer",
            "sales orders and value",
            "pending so",
            "open so",
            "active so",
            "list so",
            "sales order status",
            "what sales order",
            "which sales order",
            "outstanding sales order",
            "unfilled sales order",
            "sales orders today",
            "sales orders this week",
            "how many orders today",
        ],
        "data_sources": ["sage_sales_orders"],
        "model": "gpt-5.2-chat-latest",
    },
    # Inventory / stock check
    "inventory": {
        "priority": 7,
        "patterns": [
            r"\bitem\s+[A-Z0-9]{3,}\b",
        ],
        "keywords": [
            "stock level",
            "on hand",
            "qty on hand",
            "quantity on hand",
            "low stock",
            "out of stock",
            "reorder level",
            "inventory level",
            "available stock",
            "do we have stock",
            "how much stock",
            "warehouse stock",
        ],
        "data_sources": ["misys_inventory"],
        "model": "gpt-5.2-chat-latest",
    },
    # Manufacturing orders
    "manufacturing": {
        "priority": 7,
        "patterns": [
            r"\bmo\s*#?\s*\d{3,}\b",
            r"\bmanufacturing\s+order\s+#?\s*\d{3,}\b",
        ],
        "keywords": [
            "manufacturing order",
            "production order",
            "active mo",
            "open mo",
            "work in progress",
            "wip",
            "production schedule",
            "manufacturing schedule",
            "list mo",
            "pending mo",
        ],
        "data_sources": ["misys_manufacturing"],
        "model": "gpt-5.2-chat-latest",
    },
    # Purchase orders
    "purchase_orders": {
        "priority": 7,
        "patterns": [
            r"\bpo\s*#?\s*\d{3,}\b",
            r"\bpurchase\s+order\s+#?\s*\d{3,}\b",
        ],
        "keywords": [
            "purchase order",
            "open po",
            "pending po",
            "procurement",
            "vendor order",
            "supplier order",
            "orders from vendor",
            "orders from supplier",
            "list po",
            "active po",
        ],
        "data_sources": ["misys_purchase_orders"],
        "model": "gpt-5.2-chat-latest",
    },
    # AR aging / accounts receivable
    "ar_aging": {
        "priority": 8,
        "patterns": [],
        "keywords": [
            "ar aging",
            "accounts receivable",
            "overdue",
            "outstanding balance",
            "aged receivable",
            "past due",
            "customer balance",
            "who owes us",
            "owe us money",
            "outstanding invoices",
        ],
        "data_sources": ["sage_ar_aging"],
        "model": "gpt-5.2-chat-latest",
    },
    # Customer info / top customers
    "customers": {
        "priority": 6,
        "patterns": [
            r"\btop\s+\d*\s*customer",
        ],
        "keywords": [
            "top customer",
            "best customer",
            "biggest customer",
            "customer revenue",
            "customer list",
            "who are our customer",
            "customer ranking",
            "customer ytd",
            "customer by revenue",
            "customers by revenue",
            "customers ranked",
        ],
        "data_sources": ["sage_customers"],
        "model": "gpt-5.2-chat-latest",
    },
    # Bill of materials
    "bom": {
        "priority": 7,
        "patterns": [
            r"\bbom\s+(for|of)\b",
        ],
        "keywords": [
            "bill of material",
            "components of",
            "ingredients for",
            "what goes into",
            "made from",
            "recipe for",
            "component list",
        ],
        "data_sources": ["misys_bom"],
        "model": "gpt-5.2-chat-latest",
    },
    # Pricing — reads from Price List Master 2026.xlsx on Google Drive
    "pricing": {
        "priority": 9,
        "patterns": [
            r"\bprice\s+(for|of)\b",
            r"\bpricing\s+(for|of)\b",
            r"\bhow much\s+(is|are|does|do)\b",
            r"\bwhat.*(price|cost|rate)\b",
            r"\blatest\s+price\b",
            r"\bcurrent\s+price\b",
        ],
        "keywords": [
            "price for",
            "price of",
            "pricing for",
            "how much is",
            "how much are",
            "how much does",
            "what is the price",
            "what's the price",
            "latest price",
            "current price",
            "unit price",
            "sell price",
            "selling price",
            "price list",
            "our price",
            "charge for",
            "cost per",
            "rate for",
            "quote",
            "quote email",
            "draft quote",
            "quote for",
            "email quote",
        ],
        "data_sources": ["price_list", "misys_inventory"],
        "model": "gpt-5.2-chat-latest",
    },
}

# Intents that use the focused routing path (so_detail is excluded — handled upstream)
FOCUSED_INTENTS = frozenset(INTENT_DEFINITIONS.keys()) - {"so_detail"}

# Intents that are purely Sage-based (no MiSys raw_data needed)
SAGE_ONLY_INTENTS = frozenset({"so_list", "ar_aging", "customers"})

# Intents that need MiSys raw_data (pricing needs inventory for lead-time check)
MISYS_INTENTS = frozenset({"inventory", "manufacturing", "purchase_orders", "bom", "pricing"})

# Intents that use the Google Drive price list
PRICE_LIST_INTENTS = frozenset({"pricing"})


# ──────────────────────────────────────────────────────────────────────────────
# INTENT CLASSIFIER
# ──────────────────────────────────────────────────────────────────────────────

def classify_intent(query: str) -> Tuple[str, int]:
    """
    Classify a user query into an intent.

    Returns (intent_name, confidence_score).
    A confidence_score of 0 means no intent matched — fall back to the
    existing general chat path.
    """
    query_lower = query.lower()
    best_intent = "general"
    best_score = 0

    for intent_name, config in INTENT_DEFINITIONS.items():
        priority = config.get("priority", 5)
        score = 0

        # Pattern match = strongest signal (double weight)
        for pattern in config.get("patterns", []):
            if re.search(pattern, query_lower, re.IGNORECASE):
                score = priority * 2
                break

        # Keyword match (plain substring)
        if score == 0:
            for keyword in config.get("keywords", []):
                if keyword in query_lower:
                    score = priority
                    break

        if score > best_score:
            best_score = score
            best_intent = intent_name

    return best_intent, best_score


# ──────────────────────────────────────────────────────────────────────────────
# TARGETED DATA FETCHER
# ──────────────────────────────────────────────────────────────────────────────

def fetch_targeted_data(
    intent: str,
    raw_data: Dict[str, Any],
    sage_service=None,
    query: str = "",
) -> Dict[str, Any]:
    """
    Fetch ONLY the data sources relevant to the given intent.

    raw_data     – dict of MiSys JSON data (may be empty for Sage-only intents)
    sage_service – instance of SageGDriveService (or None)
    query        – the original user query string (used for price list search)

    Returns a compact context dict ready to be embedded in the GPT prompt.
    """
    sources = INTENT_DEFINITIONS.get(intent, {}).get("data_sources", [])
    # Inject query into raw_data so the price_list fetcher can use it
    if query:
        raw_data = dict(raw_data)
        raw_data["_query"] = query
    context: Dict[str, Any] = {}

    for source in sources:

        # ── Sage: open / pending sales orders ────────────────────────────────
        if source == "sage_sales_orders":
            if sage_service:
                try:
                    result = sage_service.get_sales_orders(limit=500)
                    all_sos = result.get("sales_orders", [])
                    open_sos = [
                        {
                            "so_number": s.get("sSONum", ""),
                            "customer": s.get("sCustomerName") or s.get("sName", ""),
                            "total": round(float(s.get("dTotal") or 0), 2),
                            "order_date": str(s.get("dtSODate", ""))[:10],
                            "ship_date": str(s.get("dtShipDate", ""))[:10],
                            "currency": "USD" if s.get("lCurrncyId") == 2 else "CAD",
                            "status": (
                                "Filled"
                                if s.get("nFilled") == 2
                                else "Partial"
                                if s.get("nFilled") == 1
                                else "Open"
                            ),
                        }
                        for s in all_sos
                        if not s.get("bCleared") and not s.get("bQuote")
                    ]
                    # Sort by value descending so GPT sees highest-value first
                    open_sos.sort(key=lambda x: x["total"], reverse=True)
                    context["open_sales_orders"] = {
                        "count": len(open_sos),
                        "total_value_cad": round(
                            sum(s["total"] for s in open_sos if s["currency"] == "CAD"), 2
                        ),
                        "total_value_usd": round(
                            sum(s["total"] for s in open_sos if s["currency"] == "USD"), 2
                        ),
                        "records": open_sos,
                    }
                except Exception as exc:
                    context["open_sales_orders"] = {"error": str(exc)}
            else:
                # Fallback: use PDF-extracted sales orders from raw_data
                real_sos = raw_data.get("RealSalesOrders", [])
                if real_sos:
                    pending = [
                        s for s in real_sos
                        if s.get("status", "").lower()
                        not in ("completed", "cancelled", "closed")
                    ]
                    context["open_sales_orders"] = {
                        "count": len(pending),
                        "records": pending[:200],
                    }

        # ── Real SO detail (PDF-extracted) ───────────────────────────────────
        elif source == "real_sales_orders":
            real_sos = raw_data.get("RealSalesOrders", [])
            if real_sos:
                context["real_sales_orders"] = {
                    "count": len(real_sos),
                    "records": real_sos[:50],
                }

        # ── MiSys inventory ──────────────────────────────────────────────────
        elif source == "misys_inventory":
            items = (
                raw_data.get("Items.json")
                or raw_data.get("MIITEM.json")
                or []
            )
            locations = raw_data.get("MIILOC.json") or []
            if items:
                context["inventory_items"] = {
                    "count": len(items),
                    "records": items[:150],
                }
            if locations:
                context["inventory_by_location"] = {
                    "count": len(locations),
                    "records": locations[:100],
                }

        # ── MiSys manufacturing orders ───────────────────────────────────────
        elif source == "misys_manufacturing":
            headers = (
                raw_data.get("ManufacturingOrderHeaders.json")
                or raw_data.get("MIMOH.json")
                or []
            )
            if headers:
                context["manufacturing_orders"] = {
                    "count": len(headers),
                    "records": headers[:75],
                }

        # ── MiSys purchase orders ────────────────────────────────────────────
        elif source == "misys_purchase_orders":
            headers = (
                raw_data.get("PurchaseOrders.json")
                or raw_data.get("MIPOH.json")
                or []
            )
            if headers:
                context["purchase_orders"] = {
                    "count": len(headers),
                    "records": headers[:75],
                }

        # ── Sage AR aging ─────────────────────────────────────────────────────
        elif source == "sage_ar_aging":
            if sage_service:
                try:
                    context["ar_aging"] = sage_service.get_ar_aging()
                except Exception as exc:
                    context["ar_aging"] = {"error": str(exc)}

        # ── Sage customers ────────────────────────────────────────────────────
        elif source == "sage_customers":
            if sage_service:
                try:
                    result = sage_service.get_customers(inactive=False, limit=500)
                    customers = result.get("customers", [])
                    customers_sorted = sorted(
                        customers,
                        key=lambda c: c.get("dAmtYtd") or 0,
                        reverse=True,
                    )
                    context["customers"] = {
                        "total": result.get("total", len(customers)),
                        "records": [
                            {
                                "name": c.get("sName", ""),
                                "city": c.get("sCity", ""),
                                "province": c.get("sProvState", ""),
                                "ytd_revenue": round(float(c.get("dAmtYtd") or 0), 2),
                                "last_year_revenue": round(float(c.get("dLastYrAmt") or 0), 2),
                                "credit_limit": round(float(c.get("dCrLimit") or 0), 2),
                                "last_sale_date": str(c.get("dtLastSal", ""))[:10],
                                "currency": "USD" if c.get("lCurrncyId") == 2 else "CAD",
                            }
                            for c in customers_sorted
                        ],
                    }
                except Exception as exc:
                    context["customers"] = {"error": str(exc)}

        # ── MiSys BOM ─────────────────────────────────────────────────────────
        elif source == "misys_bom":
            bom_h = (
                raw_data.get("BillsOfMaterial.json")
                or raw_data.get("MIBOMH.json")
                or []
            )
            bom_d = (
                raw_data.get("BillOfMaterialDetails.json")
                or raw_data.get("MIBOMD.json")
                or []
            )
            if bom_h:
                context["bom_headers"] = {"count": len(bom_h), "records": bom_h[:40]}
            if bom_d:
                context["bom_details"] = {"count": len(bom_d), "records": bom_d[:120]}

        # ── Google Drive Price List ────────────────────────────────────────────
        elif source == "price_list":
            try:
                from price_list_service import search_price
                # Extract a customer name from the query if present
                import re as _re
                # Heuristic: look for "for [CustomerName]" at the end of the query
                cust_match = _re.search(r"\bfor\s+([A-Z][A-Za-z\s&'.\-]+)$", raw_data.get("_query", ""))
                customer = cust_match.group(1).strip() if cust_match else None
                result = search_price(
                    query=raw_data.get("_query", ""),
                    customer=customer,
                    limit=60,
                )
                if result.get("error"):
                    context["price_list"] = {"error": result["error"]}
                else:
                    context["price_list"] = {
                        "source_file":   result["source_file"],
                        "sheet_names":   result["sheet_names"],
                        "total_matched": result["total_matched"],
                        "customer_filter": result["customer"],
                        "matched_rows":  result["matched_rows"],
                    }
            except Exception as exc:
                context["price_list"] = {"error": str(exc)}

    return context


# ──────────────────────────────────────────────────────────────────────────────
# FOCUSED SYSTEM PROMPTS  (short, intent-specific — saves tokens)
# ──────────────────────────────────────────────────────────────────────────────

_FOCUSED_PROMPTS: Dict[str, str] = {
    "so_list": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer ONLY the user's question using the DATA section below. "
        "Do NOT fabricate any numbers, names, or order details.\n\n"
        "You have the complete list of open (pending) sales orders from Sage 50 accounting.\n"
        "Format results as a markdown table with columns: "
        "SO # | Customer | Order Value | Currency | Order Date | Ship Date | Status\n"
        "Sort by value (highest first) unless the user requests otherwise.\n"
        "End with a summary line: total count and combined value split by CAD / USD.\n"
        "Keep the response concise and factual."
    ),
    "so_detail": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer ONLY using the real SO data provided in the DATA section. "
        "Do NOT make up any details.\n"
        "For the requested sales order provide:\n"
        "  - SO Number, Customer, Order Date, Ship Date, Status, Total Value\n"
        "  - Items ordered: description, quantity, unit price\n"
        "  - Any special notes\n"
        "If the SO is not found in the data, say so clearly."
    ),
    "inventory": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer the stock / inventory question using ONLY the MiSys ERP data in the DATA section.\n"
        "Show: Item Code, Description, Qty On Hand, Reorder Level, Location.\n"
        "Flag any items that are at or below reorder level. "
        "Do not fabricate quantities."
    ),
    "manufacturing": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer using ONLY the MiSys manufacturing order data in the DATA section.\n"
        "For a list query, render a markdown table with columns: "
        "MO # | Build Item | Description | Qty Ordered | Qty Completed | Status | Start Date | Due Date\n"
        "Sort by Status then Due Date.\n"
        "End with a summary: total active MOs and total quantity in production.\n"
        "Do not fabricate order details."
    ),
    "purchase_orders": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer using ONLY the MiSys purchase order data in the DATA section.\n"
        "Show: PO Number, Vendor, Items, Quantity, Expected Delivery, Status.\n"
        "Do not fabricate order details."
    ),
    "ar_aging": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer using ONLY the Sage 50 AR aging data in the DATA section.\n"
        "Show: Customer, Current, 31-60 days, 61-90 days, 90+ days, Total Outstanding.\n"
        "Highlight the most overdue accounts. Do not fabricate balances."
    ),
    "customers": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer using ONLY the Sage 50 customer data in the DATA section.\n"
        "Show: Customer Name, YTD Revenue, Last Year Revenue, Last Sale Date.\n"
        "Rank by YTD revenue unless the user asks otherwise."
    ),
    "bom": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer using ONLY the MiSys BOM data in the DATA section.\n"
        "Show the component breakdown for the requested product: "
        "Component Code, Description, Quantity Required.\n"
        "Do not fabricate components."
    ),
    "pricing": (
        "You are a pricing assistant for Canoil Canada Ltd.\n"
        "Answer ONLY using the price list data in the DATA section, which comes from the official "
        "'Price List Master 2026' Excel file on Google Drive.\n\n"
        "ABOUT THE DATA:\n"
        "- Each row = one specific customer + product + package-size combination\n"
        "- Prices are customer-specific (negotiated/agreed rates, not standard list prices)\n"
        "- 'current_price' = the most recent agreed price for that customer line\n"
        "- 'price_as_of' = the date/period that price was last set\n"
        "- 'currency' = CAD or USD (per customer agreement)\n"
        "- Products include: MOV Long Life, MOV Extra, VSG, Reolube 46XC, Reolube 46B, "
        "  Reolube 32BGT, Anderol 86EP-2, Anderol FGCS-2, and other greases/oils\n"
        "- Package sizes include: Drum 180kg, Pail (17kg), Case (30), Keg (55kg), "
        "  3x10 tube case, Tote, etc.\n\n"
        "WHEN ANSWERING:\n"
        "- If a customer name was provided, show ONLY that customer's rows first\n"
        "- Be smart about fuzzy product name matches "
        "  (e.g. 'MOv Long Life 1 drums' → MOV Long Life, Drum 180kg)\n"
        "- Always render results as a markdown table with columns: "
        "  Customer | Product | Size | Price | Currency | Price Type\n"
        "- PRICE FORMATTING: always format as $X,XXX.XX with 2 decimal places "
        "  (e.g. 4711.276 → $4,711.28). Never show raw unformatted numbers.\n"
        "- CURRENCY: always state CAD or USD explicitly in the Currency column\n"
        "- PRICE TYPE: use the price_as_of label exactly as given "
        "  (e.g. 'Current Grease Price' or 'Current Reolube Price')\n"
        "- If multiple sizes exist for the same product+customer, list all of them as separate rows\n"
        "- Do NOT fabricate any prices — only use values from the DATA section\n"
        "- If the product or customer is not in the data, say so clearly and show the "
        "  closest matches found\n"
        "- Never output raw markdown symbols like ** or ## in your prose text\n\n"
        "QUOTE EMAIL FLOW (when user wants a quote or quote email):\n"
        "- If the user did NOT specify quantity, ask: \"How much does the customer want?\" "
        "(e.g. 4 drums, 10 pails). If they ALREADY said the quantity (e.g. \"2 cases\"), skip this — use it.\n"
        "- Draft a professional quote email using the prices from DATA.\n"
        "- QUOTE EMAIL FORMAT: Start with \"Hi,\" and end with \"Best Regards,\" (exactly as written).\n"
        "- In the email body, ALWAYS show BOTH: (1) unit price for 1x, and (2) line total for the quantity requested.\n"
        "  Example: \"Unit price (1 case): $XXX.XX | Quantity: 2 cases | Total: $X,XXX.XX\"\n"
        "- If customer/product not specified, ask for them before showing prices.\n\n"
        "LEAD TIME (when drafting a quote email):\n"
        "- Use the inventory_items / inventory_by_location data in DATA to check stock for the quoted product.\n"
        "- Match the product by Item No. or Description (e.g. Anderol FGCS-2, 61203671-58).\n"
        "- If stock (On Hand, qStk, Stock, or Quantity on Hand) >= quantity requested: "
        "\"Lead Time: 5-7 days\"\n"
        "- If stock < quantity requested or item not found: "
        "\"Lead Time: To be confirmed (subject to availability)\" or similar.\n"
        "- Include the Lead Time line in the quote email body.\n\n"
        "CAD vs USD (when company has both):\n"
        "- If the DATA shows the same company/customer with BOTH CAD and USD rows (different currency), "
        "you MUST ask: \"Is this for [Company Name] CAD or USD?\" before showing prices or drafting the quote.\n"
        "- Do not assume — always clarify which location/currency the user needs."
    ),
}


_FORMATTING_RULES = (
    "\n\nFORMATTING RULES (always follow):\n"
    "- Use markdown tables for any list of records — never pipe-separated plain text\n"
    "- Format all money as $X,XXX.XX with 2 decimal places and the $ sign "
    "(e.g. 4711.276 → $4,711.28; 940631.09 → $940,631.09)\n"
    "- Always state currency (CAD / USD) explicitly — never leave it ambiguous\n"
    "- Use **bold** only for key totals or headings — do not bold random words\n"
    "- Do not output raw markdown syntax characters (* # | ---) in prose sentences\n"
    "- Keep responses concise and factual — no filler phrases"
)


def build_focused_prompt(
    intent: str,
    targeted_data: Dict[str, Any],
    date_context: Dict[str, Any],
) -> str:
    """
    Build a short, focused system prompt for the given intent.
    The data is embedded directly so GPT has exactly what it needs and nothing more.
    """
    base = _FOCUSED_PROMPTS.get(
        intent,
        "You are a business intelligence AI for Canoil Canada Ltd. "
        "Answer using only the data provided.",
    )
    today = date_context.get("currentDate", "")
    if today:
        base = f"Today is {today}.\n\n" + base

    data_json = json.dumps(targeted_data, indent=2, default=str)
    return base + _FORMATTING_RULES + f"\n\nDATA:\n{data_json}"


def get_model_for_intent(intent: str) -> str:
    """Return the appropriate OpenAI model for the intent."""
    return INTENT_DEFINITIONS.get(intent, {}).get("model", "gpt-5.2-chat-latest")
