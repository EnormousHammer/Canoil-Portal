"""
Invoicing service. Generates invoices from shipped SOs.
All writes to portal Postgres — never to Sage.
"""
import db_service
import audit_service


def _next_invoice_no():
    row = db_service.fetch_one(
        "SELECT invoice_no FROM core.invoices ORDER BY id DESC LIMIT 1"
    )
    if row and row["invoice_no"]:
        try:
            num = int(row["invoice_no"].replace("INV-", ""))
            return f"INV-{num + 1:05d}"
        except ValueError:
            pass
    return "INV-00001"


def create_from_shipment(shipment_id, created_by="portal"):
    """Generate an invoice from a confirmed shipment."""
    shipment = db_service.fetch_one(
        "SELECT * FROM core.shipments WHERE id = %s", (shipment_id,)
    )
    if not shipment:
        return {"error": "Shipment not found"}
    if shipment["status"] not in ("confirmed", "shipped", "delivered"):
        return {"error": f"Shipment must be confirmed first (current: {shipment['status']})"}

    existing = db_service.fetch_one(
        "SELECT id FROM core.invoices WHERE shipment_id = %s", (shipment_id,)
    )
    if existing:
        return {"error": "Invoice already exists for this shipment", "invoice_id": existing["id"]}

    so = db_service.fetch_one(
        "SELECT * FROM core.sales_orders WHERE so_no = %s", (shipment["so_no"],)
    )
    customer_id = so["customer_id"] if so else None

    ship_lines = db_service.fetch_all(
        "SELECT * FROM core.shipment_lines WHERE shipment_id = %s", (shipment_id,)
    )

    invoice_no = _next_invoice_no()
    subtotal = 0
    invoice_lines = []

    for sl in ship_lines:
        so_line = None
        if sl.get("so_line_id"):
            so_line = db_service.fetch_one(
                "SELECT * FROM core.sales_order_lines WHERE id = %s", (sl["so_line_id"],)
            )

        unit_price = float(so_line["unit_price"]) if so_line else 0
        qty = float(sl["qty_shipped"])
        amount = round(unit_price * qty, 2)
        subtotal += amount

        invoice_lines.append({
            "item_no": sl["item_no"],
            "description": so_line.get("description") if so_line else sl["item_no"],
            "qty": qty,
            "unit_price": unit_price,
            "amount": amount,
            "tax_rate": 0,
        })

    tax = round(subtotal * 0.05, 2)
    total = subtotal + tax

    payment_terms = 30
    if so and so.get("customer_id"):
        cust = db_service.fetch_one(
            "SELECT payment_terms FROM core.customers WHERE id = %s", (so["customer_id"],)
        )
        if cust and cust.get("payment_terms"):
            try:
                payment_terms = int(cust["payment_terms"].replace("Net ", ""))
            except (ValueError, AttributeError):
                pass

    from datetime import date, timedelta
    due_date = date.today() + timedelta(days=payment_terms)

    invoice = db_service.insert_returning(
        """INSERT INTO core.invoices
           (invoice_no, so_no, shipment_id, customer_id, due_date,
            subtotal, tax, total, status, created_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'draft',%s) RETURNING *""",
        (invoice_no, shipment["so_no"], shipment_id, customer_id,
         due_date, subtotal, tax, total, created_by)
    )

    for il in invoice_lines:
        db_service.execute(
            """INSERT INTO core.invoice_lines
               (invoice_id, item_no, description, qty, unit_price, amount, tax_rate)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (invoice["id"], il["item_no"], il["description"],
             il["qty"], il["unit_price"], il["amount"], il["tax_rate"])
        )

    audit_service.log_from_request("CREATE", "INVOICE", invoice_no,
                                   after={"total": total, "shipment_id": shipment_id})
    return invoice


def get_invoice(invoice_id):
    inv = db_service.fetch_one("SELECT * FROM core.invoices WHERE id = %s", (invoice_id,))
    if inv:
        inv["lines"] = db_service.fetch_all(
            "SELECT * FROM core.invoice_lines WHERE invoice_id = %s", (invoice_id,)
        )
    return inv


def get_invoice_by_no(invoice_no):
    inv = db_service.fetch_one("SELECT * FROM core.invoices WHERE invoice_no = %s", (invoice_no,))
    if inv:
        inv["lines"] = db_service.fetch_all(
            "SELECT * FROM core.invoice_lines WHERE invoice_id = %s", (inv["id"],)
        )
    return inv


def list_invoices(status=None, customer_id=None, limit=100, offset=0):
    conditions = []
    params = []
    if status:
        conditions.append("status = %s")
        params.append(status)
    if customer_id:
        conditions.append("customer_id = %s")
        params.append(customer_id)
    where = " AND ".join(conditions) if conditions else "TRUE"
    params.extend([limit, offset])
    return db_service.fetch_all(
        f"SELECT * FROM core.invoices WHERE {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        params
    )


def update_status(invoice_id, new_status):
    VALID = {"draft": ["sent"], "sent": ["paid", "void"]}
    inv = db_service.fetch_one("SELECT * FROM core.invoices WHERE id = %s", (invoice_id,))
    if not inv:
        return {"error": "Invoice not found"}

    allowed = VALID.get(inv["status"], [])
    if new_status not in allowed:
        return {"error": f"Cannot move from '{inv['status']}' to '{new_status}'"}

    db_service.execute(
        "UPDATE core.invoices SET status = %s, updated_at = NOW() WHERE id = %s",
        (new_status, invoice_id)
    )
    audit_service.log_from_request("STATUS_CHANGE", "INVOICE", inv["invoice_no"],
                                   before={"status": inv["status"]},
                                   after={"status": new_status})
    return get_invoice(invoice_id)


def generate_invoice_html(invoice_id):
    """Generate printable HTML for an invoice."""
    inv = get_invoice(invoice_id)
    if not inv:
        return None

    customer = None
    if inv.get("customer_id"):
        customer = db_service.fetch_one(
            "SELECT * FROM core.customers WHERE id = %s", (inv["customer_id"],)
        )

    lines_html = ""
    for line in inv.get("lines", []):
        lines_html += f"""
        <tr>
            <td>{line.get('item_no','')}</td>
            <td>{line.get('description','')}</td>
            <td style="text-align:right">{line.get('qty',0)}</td>
            <td style="text-align:right">${line.get('unit_price',0):,.2f}</td>
            <td style="text-align:right">${line.get('amount',0):,.2f}</td>
        </tr>"""

    cust_name = customer["name"] if customer else "N/A"
    cust_addr = f"{customer.get('address','')}, {customer.get('city','')}, {customer.get('province','')}" if customer else ""

    html = f"""<!DOCTYPE html>
<html><head><style>
body {{ font-family: Arial, sans-serif; margin: 40px; }}
.header {{ display: flex; justify-content: space-between; margin-bottom: 30px; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
th, td {{ padding: 8px 12px; border-bottom: 1px solid #ddd; text-align: left; }}
th {{ background: #f5f5f5; }}
.totals {{ text-align: right; margin-top: 20px; }}
</style></head><body>
<div class="header">
    <div><h1>INVOICE</h1><p>Canoil Canada Ltd.</p></div>
    <div style="text-align:right">
        <h2>{inv['invoice_no']}</h2>
        <p>Date: {inv.get('invoice_date','')}</p>
        <p>Due: {inv.get('due_date','')}</p>
    </div>
</div>
<div><strong>Bill To:</strong><br>{cust_name}<br>{cust_addr}</div>
<table>
<thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
<tbody>{lines_html}</tbody>
</table>
<div class="totals">
    <p>Subtotal: ${inv.get('subtotal',0):,.2f}</p>
    <p>Tax: ${inv.get('tax',0):,.2f}</p>
    <p><strong>Total: ${inv.get('total',0):,.2f} {inv.get('currency_code','CAD')}</strong></p>
</div>
</body></html>"""
    return html
