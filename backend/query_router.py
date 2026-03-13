"""
Smart Query Router for Canoil AI Chat.

Classifies user queries into intents and fetches ONLY the relevant data
from the appropriate source, instead of loading the full ERP + Sage dataset
on every question.

Intent → Data Source mapping:
  so_list           → Sage tsalordr (open SOs only)
  so_detail         → SmartSOSearch / RealSalesOrders (handled upstream)
  customer_item_sales → Sage tsalordr + tsoline + tinvent (customer + item filter)
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
    # Customer + item sales history — "How many times did we sell REOL46bdrm to Duke Energy?" / "All orders for REOLUBE46B to Duke Energy"
    "customer_item_sales": {
        "priority": 9,
        "patterns": [
            r"\bhow many times\b.*\bsell\b.*\bto\b",
            r"\bsell\b.*\bto\b",
            r"\bsold\b.*\bto\b",
            r"\bsales\s+of\b.*\bto\b",
            r"\btimes\s+(we\s+)?sold\b",
            r"\bproduct\s+.*\bto\s+[A-Za-z]",
            r"\bitem\s+.*\bto\s+[A-Za-z]",
            r"\borders?\s+for\b.*\bto\b",
            r"\ball\s+orders\b.*\bto\b",
            r"\bmargin\b.*\b(for|on)\b",
            r"\b(for|on)\b.*\b(margin|revenue|cost)\b",
            r"\bduke\s+energy\b.*\b(reolube|reol46)\b",
            r"\b(reolube|reol46)\b.*\bduke\s+energy\b",
        ],
        "keywords": [
            "sell to",
            "sold to",
            "times sold",
            "sales to",
            "how many times did we sell",
            "product to customer",
            "item to customer",
            "sold to customer",
            "orders for",
            "orders to",
            "duke energy",
            "reolube46b",
            "reolube 46b",
            "reol46b",
            "margin on",
            "for duke",
            "export",
            "export to",
            "give me a file",
            "download",
            "as a file",
            "as excel",
            "as xlsx",
        ],
        "data_sources": ["sage_customer_item_sales"],
        "model": "gpt-5.2-chat-latest",
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
            # Follow-up: "Motion industries, ANDEROL food grade, cases" (customer, product, size)
            r"^[A-Za-z][^,]+,.*(?:anderol|mov|reolube|grease|vsg|fgcs|sulfonate)\b",
            r"^[A-Za-z][^,]+,.*(?:cases?|drums?|pails?|kegs?|totes?)\s*$",
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
        "data_sources": ["price_list"],  # Price list only — no inventory (lead time uses fallback)
        "model": "gpt-5.2-chat-latest",
    },
}

# Intents that use the focused routing path (so_detail is excluded — handled upstream)
FOCUSED_INTENTS = frozenset(INTENT_DEFINITIONS.keys()) - {"so_detail"}

# Intents that are purely Sage-based (no MiSys raw_data needed)
SAGE_ONLY_INTENTS = frozenset({"so_list", "ar_aging", "customers", "customer_item_sales"})

# Intents that need MiSys raw_data (pricing uses price list only — no MiSys load)
MISYS_INTENTS = frozenset({"inventory", "manufacturing", "purchase_orders", "bom"})

# Intents that use the Google Drive price list
PRICE_LIST_INTENTS = frozenset({"pricing"})

# Query → data needs (for fallback path: load only what the query suggests)
# Each key = trigger words (any match); value = data category
_DATA_NEEDS_TRIGGERS: Dict[str, list] = {
    "inventory": ["stock", "inventory", "on hand", "qty", "quantity", "item", "reorder", "warehouse", "available", "low stock", "out of stock", "fulfill", "have we got"],
    "customers": ["customer", "revenue", "ytd", "who are our", "top customer", "best customer", "biggest customer"],
    "sales_orders": ["so ", "sales order", "order #", "pending order", "open order", "fulfill", "ship", "delivery", "real sales"],
    "ar_aging": ["ar ", "receivable", "overdue", "owe", "outstanding", "past due", "balance", "aged"],
    "manufacturing": ["mo ", "manufacturing", "production", "wip", "work in progress", "build order"],
    "purchase_orders": ["po ", "purchase order", "vendor", "supplier", "procurement"],
    "bom": ["bom", "bill of material", "component", "ingredient", "what goes into", "made from", "recipe"],
    "pricing": ["price", "pricing", "quote", "cost per", "rate for", "how much"],
}

# Data need → JSON file names to load (when loading from G Drive)
DATA_NEEDS_TO_FILES: Dict[str, list] = {
    "inventory": ["Items.json", "MIITEM.json", "MIILOC.json"],
    "sales_orders": ["SalesOrderHeaders.json", "SalesOrderDetails.json"],
    "manufacturing": ["ManufacturingOrderHeaders.json", "ManufacturingOrderDetails.json", "MIMOH.json", "MIMOMD.json"],
    "purchase_orders": ["PurchaseOrders.json", "PurchaseOrderDetails.json", "MIPOH.json", "MIPOD.json"],
    "bom": ["BillsOfMaterial.json", "BillOfMaterialDetails.json", "MIBOMH.json", "MIBOMD.json"],
}


def infer_data_needs(query: str) -> set:
    """
    Infer which data categories the user's query likely needs.
    Used by the fallback path to load ONLY relevant data instead of everything.
    Returns empty set = load everything (conservative).
    """
    q = (query or "").lower().strip()
    if len(q) < 3:
        return set()
    needs = set()
    for category, triggers in _DATA_NEEDS_TRIGGERS.items():
        if any(t in q for t in triggers):
            needs.add(category)
    return needs


def get_files_to_load_for_needs(needs: set) -> list:
    """Return list of JSON file names to load given inferred data needs."""
    if not needs:
        return []  # Caller interprets empty as "load all"
    files = set()
    for need in needs:
        files.update(DATA_NEEDS_TO_FILES.get(need, []))
    return list(files)


# Soft intent keywords: when no pattern/keyword matches, try these for a second pass
_SOFT_INTENT_KEYWORDS: Dict[str, list] = {
    "inventory": ["stock", "inventory", "item", "qty", "reorder", "warehouse"],
    "customers": ["customer", "revenue", "top customer", "who are our"],
    "so_list": ["sales order", "open order", "pending order", "how many order"],
    "ar_aging": ["ar ", "receivable", "overdue", "owe", "outstanding"],
    "manufacturing": ["mo ", "manufacturing", "production", "wip"],
    "purchase_orders": ["po ", "purchase order", "vendor", "supplier"],
    "bom": ["bom", "component", "ingredient", "what goes into"],
    "pricing": ["price", "quote", "how much", "cost per"],
}


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

    # When nothing matched, check if it's a straightforward product+customer question
    if best_intent == "general" and best_score == 0:
        ql = query_lower
        has_topic = any(w in ql for w in ["order", "sold", "margin", "revenue", "cost", "pricing", "sales"])
        has_product_or_customer = any(w in ql for w in ["reolube", "reol46", "duke", "energy", "anderol", "mov"])
        if has_topic and has_product_or_customer:
            best_intent = "customer_item_sales"
            best_score = 5

    # Soft pass: when still general, try broader keywords to infer intent (score 3 = use focused path)
    if best_intent == "general" and best_score == 0:
        for intent_name, keywords in _SOFT_INTENT_KEYWORDS.items():
            if any(kw in query_lower for kw in keywords):
                best_intent = intent_name
                best_score = 3
                break

    return best_intent, best_score


# ──────────────────────────────────────────────────────────────────────────────
# PRICING QUERY PARSER (customer + product from natural reply)
# ──────────────────────────────────────────────────────────────────────────────

def _parse_pricing_query(query: str) -> Tuple[str, str]:
    """
    Extract customer and product from pricing follow-up replies like:
    "duke energy reolube46b all sizes and both cad and usd"
    "Motion Industries ANDEROL food grade cases"
    Returns (customer_search, product_search).
    """
    q = (query or "").strip()
    if not q:
        return "", ""
    q_lower = q.lower()

    # Strip common modifiers (sizes, currency) so we can parse customer + product
    for mod in [
        r"\ball\s+sizes?\b", r"\bboth\s+cad\s+and\s+usd\b", r"\bcad\s+and\s+usd\b",
        r"\busd\s+and\s+cad\b", r"\bevery\s+size\b", r"\ball\s+size\b",
        r"\b(and\s+)?both\b", r"\bcad\b", r"\busd\b", r"\band\b",
    ]:
        q_lower = re.sub(mod, " ", q_lower, flags=re.IGNORECASE)
    q_lower = re.sub(r"\s+", " ", q_lower).strip()

    # Known product patterns (order matters: more specific first)
    product_patterns = [
        (r"reolube\s*46\s*b", "reolube46b"),
        (r"reol46b\w*", "reol46b"),
        (r"reol46b", "reol46b"),
        (r"anderol\s*fgcs", "anderol fgcs"),
        (r"anderol\s*food\s*grade", "anderol food grade"),
        (r"mov\s*long\s*life", "mov long life"),
        (r"mov\s*extra", "mov extra"),
        (r"reolube\s*32", "reolube 32"),
        (r"reolube\s*46\s*xc", "reolube 46xc"),
        (r"\bvsg\b", "vsg"),
        (r"\bmov\b", "mov"),
        (r"\banderol\b", "anderol"),
        (r"\breolube\b", "reolube"),
    ]

    product_search = ""
    for pat, canonical in product_patterns:
        m = re.search(pat, q_lower, re.I)
        if m:
            product_search = canonical
            # Remove the product from the string to get customer
            q_lower = re.sub(pat, " ", q_lower, flags=re.IGNORECASE)
            break

    # If no pattern matched, try to find a product-like token (compact alphanumeric)
    if not product_search:
        tokens = re.findall(r"\b([A-Za-z0-9]{4,})\b", q_lower)
        skip = {"duke", "energy", "progress", "carolinas", "industries", "motion", "inc", "ltd", "corp"}
        for t in tokens:
            if t not in skip and ("reol" in t or "mov" in t or "anderol" in t or "vsg" in t):
                product_search = t
                q_lower = q_lower.replace(t, " ")
                break

    q_lower = re.sub(r"\s+", " ", q_lower).strip()

    # Customer = what remains, or known names
    customer_search = ""
    # Known customer substrings (partial match for price list)
    known_customers = [
        ("duke energy", "Duke Energy"),
        ("motion industries", "Motion Industries"),
        ("lanxess", "LANXESS"),
        ("spectra", "Spectra"),
    ]
    for key, name in known_customers:
        if key in q_lower:
            customer_search = name
            break

    if not customer_search and q_lower:
        # Use remaining text as customer (e.g. "duke energy" or "motion industries")
        customer_search = q_lower.title()

    return customer_search, product_search


# ──────────────────────────────────────────────────────────────────────────────
# CUSTOMER + ITEM QUERY PARSER
# ──────────────────────────────────────────────────────────────────────────────

def _parse_customer_item_query(query: str) -> Tuple[str, str]:
    """
    Extract customer name and item code from queries like:
    "How many times did we sell reolube46b (REOL46bdrm) to Duke Energy?"
    "Sales of REOL46bdrm to Duke York"
    "REOLUBE46B for Duke Energy" / "Duke Energy REOLUBE46B"
    "margin on Duke Energy for REOLUBE46B"
    Returns (customer_search, item_code_search).
    """
    q = (query or "").strip()
    if not q:
        return "", ""

    cust_search = ""
    item_search = ""
    q_lower = q.lower()

    # Helper: product codes are compact (REOL46B, REOLUBE46B); customer names have spaces
    def _looks_like_product(s: str) -> bool:
        s = (s or "").strip()
        if len(s) < 3:
            return False
        # Product codes: alphanumeric, maybe hyphen, no spaces (or 1-2 words like "MOV Long Life")
        return bool(re.match(r"^[A-Za-z0-9\-]+$", s)) or (len(s) <= 25 and " " in s)

    def _looks_like_customer(s: str) -> bool:
        s = (s or "").strip()
        if len(s) < 3:
            return False
        # Customer names: usually have spaces, &, or multi-word (Duke Energy, Duke Energy Progress Inc)
        return " " in s or "&" in s or "'" in s

    # Pattern 1: "X to Y" — item X, customer Y
    to_match = re.search(r"\bto\s+([A-Za-z0-9\s&'.\-]+?)(?:\?|$|\.|\s+how|\s+what|\s+with)", q_lower)
    if to_match:
        cust_search = to_match.group(1).strip()
    parts_to = re.split(r"\s+to\s+", q, 1, flags=re.IGNORECASE)
    if len(parts_to) >= 2 and cust_search:
        left = parts_to[0]
        for prefix in ["how many times did we sell", "how many times did we sold", "sales of", "sold", "sell",
                       "all orders for", "orders for", "list orders for", "show orders for", "margin on", "margins on"]:
            if left.lower().startswith(prefix):
                left = left[len(prefix):].strip()
                break
        if left:
            paren = re.search(r"\(([^)]+)\)", left)
            item_search = paren.group(1).strip() if paren else left.strip()

    # Pattern 2: "X for Y" or "Y for X" — figure out which is customer vs product
    if (not cust_search or not item_search) and " for " in q_lower:
        parts_for = re.split(r"\s+for\s+", q, 1, flags=re.IGNORECASE)
        if len(parts_for) >= 2:
            left, right = parts_for[0].strip(), parts_for[1].strip()
            for prefix in ["margin on", "margins on", "orders for", "all orders for", "sales of"]:
                if left.lower().startswith(prefix):
                    left = left[len(prefix):].strip()
                    break
            if left and right:
                if _looks_like_customer(left) and _looks_like_product(right):
                    cust_search = cust_search or left
                    item_search = item_search or right
                elif _looks_like_product(left) and _looks_like_customer(right):
                    cust_search = cust_search or right
                    item_search = item_search or left
                else:
                    # Heuristic: "REOLUBE46B for Duke Energy" — product first (no spaces), customer second (spaces)
                    if " " in right and " " not in left:
                        cust_search = cust_search or right
                        item_search = item_search or left
                    elif " " in left and " " not in right:
                        cust_search = cust_search or left
                        item_search = item_search or right

    # Pattern 3: "Duke Energy REOLUBE46B" or "REOLUBE46B Duke Energy" — both appear, extract
    if (not cust_search or not item_search):
        # Known product patterns (case-insensitive)
        product_patterns = [r"reolube\s*46\s*b", r"reol46b", r"reol46bdrm", r"reol46bdrn"]
        # Find customer-like tokens (multi-word)
        cust_candidates = re.findall(r"\b([A-Za-z][A-Za-z0-9\s&'.\-]{2,40})\b", q)
        item_candidates = re.findall(r"\b([A-Za-z0-9]{4,})\b", q)
        for cc in cust_candidates:
            c = cc.strip()
            if c and " " in c and c.upper() not in ("HOW MANY", "SALES OF"):
                if "duke" in c.lower() or "energy" in c.lower():
                    cust_search = cust_search or c
                    break
        for ic in item_candidates:
            if ic.upper() not in ("HOW", "MANY", "TIMES", "DID", "WE", "SELL", "SOLD", "TO", "SALES", "OF", "FOR", "DUKE", "ENERGY"):
                if any(re.search(p, ic, re.I) for p in product_patterns) or "reol" in ic.lower():
                    item_search = item_search or ic
                    break
        if not item_search and item_candidates:
            for ic in item_candidates:
                if ic.upper() not in ("HOW", "MANY", "TIMES", "DID", "WE", "SELL", "SOLD", "TO", "SALES", "OF", "FOR", "DUKE", "ENERGY", "PROGRESS", "INC"):
                    item_search = ic
                    break

    if not item_search and cust_search:
        codes = re.findall(r"\b([A-Za-z0-9]{4,})\b", q)
        for c in codes:
            if c.upper() not in ("HOW", "MANY", "TIMES", "DID", "WE", "SELL", "SOLD", "TO", "SALES", "OF", "FOR", "DUKE", "ENERGY"):
                item_search = c
                break

    return cust_search, item_search


# ──────────────────────────────────────────────────────────────────────────────
# TARGETED DATA FETCHER
# ──────────────────────────────────────────────────────────────────────────────

def ai_extract_product_customer(query: str, client) -> Tuple[str, str]:
    """
    Use GPT to understand a straightforward question and extract product + customer.
    Used when regex parser fails — lets the AI understand natural language.
    Returns (customer_search, item_code_search).
    """
    if not client or not (query or "").strip():
        return "", ""
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You extract product and customer from business questions. Reply ONLY with JSON: {\"product\": \"...\", \"customer\": \"...\"}. "
                    "Product = item code or name (e.g. REOLUBE46B, REOL46BDRM). Customer = company name (e.g. Duke Energy). "
                    "If unclear, use empty string. No other text."
                },
                {"role": "user", "content": (query or "").strip()[:500]}
            ],
            max_tokens=80,
            temperature=0,
        )
        text = (resp.choices[0].message.content or "").strip()
        # Parse JSON (may be wrapped in markdown)
        for raw in [text, text.replace("`", "").strip()]:
            if raw.startswith("{"):
                try:
                    obj = json.loads(raw.split("\n")[0])
                    prod = (obj.get("product") or "").strip()
                    cust = (obj.get("customer") or "").strip()
                    if prod and cust:
                        return cust, prod
                except json.JSONDecodeError:
                    pass
    except Exception:
        pass
    return "", ""


def fetch_targeted_data(
    intent: str,
    raw_data: Dict[str, Any],
    sage_service=None,
    query: str = "",
    openai_client=None,
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

        # ── Sage: customer + item sales history ──────────────────────────────
        elif source == "sage_customer_item_sales":
            if sage_service and hasattr(sage_service, "get_customer_item_sales"):
                try:
                    cust_search, item_search = _parse_customer_item_query(query)
                    # If regex parser failed, use AI to understand the straightforward question
                    if (not cust_search or not item_search) and openai_client:
                        cust_search, item_search = ai_extract_product_customer(query, openai_client)
                    if cust_search and item_search:
                        misys_items = raw_data.get("Items.json") or raw_data.get("MIITEM.json") or []
                        result = sage_service.get_customer_item_sales(
                            cust_search, item_search, limit=500, misys_items=misys_items
                        )
                        context["customer_item_sales"] = result
                    else:
                        context["customer_item_sales"] = {
                            "records": [],
                            "error": "Could not identify the product and customer from your question. "
                            "Try: 'All orders for REOLUBE46B to Duke Energy' or 'REOLUBE46B sold to Duke Energy'",
                        }
                except Exception as exc:
                    context["customer_item_sales"] = {"records": [], "error": str(exc)}
            else:
                context["customer_item_sales"] = {"records": [], "error": "Sage data not available"}

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
                import re as _re
                q = raw_data.get("_query", "")
                customer = None
                product_query = q
                # "for [CustomerName]" at end
                cust_match = _re.search(r"\bfor\s+([A-Z][A-Za-z\s&'.\-]+)$", q, _re.I)
                if cust_match:
                    customer = cust_match.group(1).strip()
                # "Customer, Product, Size" format (e.g. "Motion industries, ANDEROL food grade, cases")
                elif "," in q:
                    parts = [p.strip() for p in q.split(",", 2)]
                    if len(parts) >= 2:
                        customer = parts[0]
                        product_query = q
                else:
                    # Smart parse: "duke energy reolube46b all sizes and both cad and usd" → customer="Duke Energy", product="reolube 46b"
                    _cust, _prod = _parse_pricing_query(q)
                    if _cust:
                        customer = _cust
                    if _prod:
                        # Add space for "reolube46b" → "reolube 46b" so price list match works
                        product_query = _prod.replace("reolube46b", "reolube 46b").replace("reol46b", "reolube 46b")
                result = search_price(
                    query=product_query,
                    customer=customer,
                    limit=60,
                )
                if result.get("error"):
                    context["price_list"] = {"error": result["error"]}
                else:
                    context["price_list"] = {
                        "source_file":         result["source_file"],
                        "sheet_names":         result["sheet_names"],
                        "total_matched":       result["total_matched"],
                        "customer_filter":     result["customer"],
                        "currencies_available": result.get("currencies_available", []),
                        "matched_rows":        result["matched_rows"],
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
    "customer_item_sales": (
        "You are a business intelligence AI for Canoil Canada Ltd.\n"
        "Answer using ONLY the customer_item_sales data in the DATA section.\n\n"
        "The user asked about sales of a specific product to a specific customer (orders, pricing, cost, margins).\n"
        "Display a markdown table with columns: SO Number | Currency | Qty | Unit Price | Line Total | Cost | Total Cost | Margin % | Order Date\n"
        "Include all columns that have data. If cost/margin are null, show '-' or omit that column.\n"
        "Sort by Order Date (newest first).\n"
        "At the end, provide a summary: total orders, total quantity sold, total revenue, total cost (if available), overall margin % (if available).\n"
        "Format all money as $X,XXX.XX. State currency (CAD/USD) if known.\n"
        "If the data shows no records or an error, say so clearly — do NOT fabricate numbers.\n"
        "If customer or item was not found, explain what was searched for."
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
        "CURRENCY — CRITICAL (no conversion, use only what exists):\n"
        "- NEVER convert between CAD and USD. Use ONLY the prices from the master price list.\n"
        "- The DATA includes 'currencies_available' — the list of currencies that actually exist for this customer/product.\n"
        "- If the user asks for 'both CAD and USD' but only one exists: clearly state it. "
        "Example: \"No USD pricing for Duke Energy in the master price list, but here is the CAD pricing:\" then show the CAD rows.\n"
        "- If only CAD exists: say \"CAD only\" and show the data. If only USD exists: say \"USD only\" and show the data.\n"
        "- If both exist: show both. Never fabricate or convert — only display what is in the data.\n\n"
        "LEAD TIME (when drafting a quote email):\n"
        "- Use: \"Lead time: To be confirmed (subject to availability)\". "
        "Stock levels are not available in this response — user can check inventory separately.\n"
        "- Include the Lead Time line in the quote email body.\n\n"
        "CAD vs USD (when user asks for both but data has both):\n"
        "- If the DATA shows BOTH CAD and USD rows, show both.\n"
        "- If the user did not specify and data has both, you may ask: \"Is this for CAD or USD?\" "
        "or show both with clear currency labels."
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
