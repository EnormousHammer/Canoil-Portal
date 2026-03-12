# PDF Template Conversion Plan

**Goal:** Make HTML templates PDF-friendly for WeasyPrint/wkhtmltopdf by replacing flex/grid with tables, without breaking form filling.

**Status:** Backups exist. Ready to execute.

---

## Phase 0: Backups (DONE)

| Template | Backup Path |
|----------|-------------|
| BOL | `templates/bol/final_bol_template.html.backup` |
| Packing Slip | `templates/packing_slip/Packing Slip Template.html.backup` |
| Commercial Invoice | `templates/commercial_invoice/Commerical Invoice New.html.backup` |

---

## Phase 1: BOL Template

**File:** `backend/templates/bol/final_bol_template.html`  
**Generator:** `new_bol_generator.py`

### Selectors to preserve (DO NOT CHANGE)
- Classes: `shipper-table`, `carrier-row`, `freight-box`, `items-container`, `left-table`, `right-column`
- Structure: `strong.find_next('input')`, `tbody` → `tr` → `td` → `input`/`textarea`

### Flex/Grid locations to convert

| Line | Current | Convert to |
|------|---------|------------|
| ~148 | `.items-container` display: flex | Table layout |
| ~265 | flex | Table |
| ~280 | flex | Table |
| ~460 | flex | Table |
| ~473 | flex | Table |
| ~491 | flex | Table |
| ~500 | flex | Table |
| ~572 | inline grid (1fr 1fr) | `<table>` with 2 columns |
| ~657, 664 | `.declared-row` flex | Table row |
| ~668, 675 | `.declared-row` flex column | Table cell |
| ~670, 677 | inner flex | Table row |
| ~704 | inline grid | `<table>` 2 columns |

### Approach
- Replace flex containers with `<table>` / `<tr>` / `<td>`
- Keep all class names and IDs intact
- Use `border-collapse: collapse` and `width: 100%` where needed

---

## Phase 2: Packing Slip Template

**File:** `backend/templates/packing_slip/Packing Slip Template.html`  
**Generator:** `packing_slip_html_generator.py`

### Selectors to preserve (DO NOT CHANGE)
- IDs: `packing_slip_number`, `packing_date`, `sold_to`, `ship_to`, `item_row_N`, etc.
- All existing IDs and structure

### Flex/Grid locations to convert

| Line | Current | Convert to |
|------|---------|------------|
| ~28 | `.header` grid (150px 1fr 250px) | `<table>` 3 columns |
| ~37 | `.logo-container` flex | Table cell |
| ~77 | `.info-row` flex | Table row |
| ~237 | grid | Table |

### Approach
- `.header` → `<table>` with 3 `<td>` cells
- `.info-row` → `<tr>` with 2 `<td>` cells (label | value)
- Preserve all IDs

---

## Phase 3: Commercial Invoice Template

**File:** `backend/templates/commercial_invoice/Commerical Invoice New.html`  
**Generator:** `commercial_invoice_html_generator.py`

### Selectors to preserve (DO NOT CHANGE)
- IDs: `brokerCompany`, `itemsBody`, etc.
- `input[name='currency'][value='USD']`
- `tbody` with `id='itemsBody'`

### Flex/Grid locations to convert

| Line | Current | Convert to |
|------|---------|------------|
| ~87 | `.checkbox-group` flex | Table or inline-block |
| ~95 | flex | Table or inline-block |
| ~512 | footer flex (space-between) | Table with 2 columns |

### Approach
- Checkbox groups: use `<table>` or `display: inline-block` with fixed widths
- Footer: `<table>` with 2 columns, `width: 100%`

---

## Phase 4: Verification

### After each template change
1. **Form filling:** Run the generator and confirm all fields populate correctly
2. **PDF conversion:** Generate PDF via WeasyPrint/wkhtmltopdf and check layout

### Test commands (adjust as needed)
```bash
# From backend directory
python -c "from new_bol_generator import *; ..."  # BOL
python -c "from packing_slip_html_generator import *; ..."  # Packing Slip
python -c "from commercial_invoice_html_generator import *; ..."  # Commercial Invoice
```

---

## Execution order

1. **BOL** (most complex)
2. **Packing Slip**
3. **Commercial Invoice**

If any conversion breaks form filling, restore from backup and adjust the approach for that section only.
