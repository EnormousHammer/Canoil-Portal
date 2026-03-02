"""
Proforma Invoice Generator - copies the xlsx template and fills data cells.

The template file is NEVER modified. We shutil.copy2 it to the output
location and then open the copy with openpyxl to write only the data cells.
This preserves every aspect of the original template (images, merged cells,
borders, fonts, print settings, headers/footers, column widths, etc.).

Template: backend/templates/proforma_invoice/proforma_invoice_template.xlsx
Output:   Proforma Invoice_CompanyName_PO.xlsx
"""
import os
import shutil
from datetime import datetime
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), 'templates', 'proforma_invoice')
TEMPLATE_PATH = os.path.join(TEMPLATE_DIR, 'proforma_invoice_template.xlsx')

ITEM_START_ROW = 19
ITEM_END_ROW = 24
MAX_ITEMS = ITEM_END_ROW - ITEM_START_ROW + 1  # 6 (rows 19-24, before Sub Total at row 25)


def _safe_str(val, default=''):
    if val is None:
        return default
    return str(val).strip() or default


def _safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        cleaned = str(val).replace('$', '').replace(',', '').replace('US', '').strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return default


def _safe_int(val, default=0):
    if val is None:
        return default
    try:
        return int(float(str(val).replace(',', '').strip()))
    except (ValueError, TypeError):
        return default


def _parse_date(val):
    """Try to parse a date value into a datetime object."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip()
    if not s:
        return None
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%dT%H:%M:%S',
                '%B %d, %Y', '%b %d, %Y'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _merge_if_not_merged(ws, cell_range):
    """Merge cells only if they aren't already merged."""
    for existing in ws.merged_cells.ranges:
        if str(existing) == cell_range:
            return
    try:
        ws.merge_cells(cell_range)
    except Exception:
        pass


def generate_proforma_invoice(so_data: dict) -> tuple:
    """
    Copy the proforma invoice template and fill it with sales order data.

    The template is copied as-is first, then only the data cells are written.
    All template formatting, merged cells, formulas (I27 SUM), etc. are preserved.

    Returns:
        (output_path, filename) tuple.
    """
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"Proforma invoice template not found: {TEMPLATE_PATH}")

    customer_name = _safe_str(so_data.get('customer_name'), 'Customer')
    po_number = _safe_str(so_data.get('po_number'))
    so_number = _safe_str(so_data.get('so_number'))
    invoice_date = _parse_date(so_data.get('invoice_date')) or datetime.now()
    date_str = invoice_date.strftime('%Y-%m-%d')

    # --- Build output filename ---
    safe_customer = ''.join(
        c for c in customer_name if c.isalnum() or c in (' ', '-', '_', '.')
    ).strip()
    safe_po = ''.join(
        c for c in po_number if c.isalnum() or c in (' ', '-', '_', '.')
    ).strip()

    if safe_po:
        filename = f'Proforma Invoice_{safe_customer}_{safe_po}.xlsx'
    else:
        filename = f'Proforma Invoice_{safe_customer}_{date_str}.xlsx'

    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'proforma_invoices')
    os.makedirs(uploads_dir, exist_ok=True)
    output_path = os.path.join(uploads_dir, filename)

    # STEP 1: Copy the template file exactly as-is (binary copy)
    shutil.copy2(TEMPLATE_PATH, output_path)

    # STEP 2: Open the COPY and fill only the data cells
    wb = load_workbook(output_path)
    ws = wb.active

    # --- Title row ---
    ws['C4'] = f'Proforma Invoice {date_str}'
    if so_number:
        ws['G4'] = f'SO# {so_number}'

    # --- Buyer / Sold To ---
    ws['C5'] = customer_name
    ws['C7'] = _safe_str(so_data.get('address'))
    ws['C8'] = _safe_str(so_data.get('city_state_zip'))
    ws['C9'] = _safe_str(so_data.get('country'))
    ws['C10'] = _safe_str(so_data.get('phone'))
    ws['C11'] = f' {po_number}' if po_number else ''
    ws['C12'] = _safe_str(so_data.get('email'))

    # --- Shipping / Dates ---
    ship_via = _safe_str(so_data.get('ship_via'))
    if ship_via:
        ws['B15'] = ship_via

    ship_by = _parse_date(so_data.get('ship_by_date'))
    if ship_by:
        ws['E15'] = ship_by

    ws['I15'] = invoice_date

    # --- Trade Terms ---
    trade_terms = _safe_str(so_data.get('trade_terms'), 'EXW')
    ws['B31'] = f'Trade Terms: {trade_terms}'

    # --- Items (rows 19-24, max 6 items before Sub Total row 25) ---
    # Template has I27 =SUM(I19:I26) which covers all item rows + subtotal area
    items = so_data.get('items', [])
    for idx, item in enumerate(items[:MAX_ITEMS]):
        row = ITEM_START_ROW + idx

        # Merge description cells C:F for this row (template only has C19:F19 merged)
        _merge_if_not_merged(ws, f'C{row}:F{row}')

        ws[f'B{row}'] = _safe_str(item.get('product_code') or item.get('item_code'))
        ws[f'C{row}'] = _safe_str(item.get('description'))
        qty = _safe_int(item.get('quantity'))
        price = _safe_float(item.get('unit_price'))
        ws[f'G{row}'] = qty
        ws[f'H{row}'] = price
        ws[f'I{row}'] = f'=H{row}*G{row}'

    # Write subtotal formula at I25 (the Sub Total row)
    ws['I25'] = f'=SUM(I{ITEM_START_ROW}:I{ITEM_END_ROW})'

    # I27 =SUM(I19:I26) is already in the template (grand total)

    wb.save(output_path)
    wb.close()

    return output_path, filename
