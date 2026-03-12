#!/usr/bin/env python3
"""
Test HTML to PDF conversion with BOL SO3177 - PO334804 - 2026-03-10
Uses: Playwright -> wkhtmltopdf -> WeasyPrint (wkhtmltopdf is in Docker).
Run: python test_html_to_pdf.py
Output: BOL SO3177 - PO334804 - 2026-03-10.html and .pdf in backend folder
"""
import os

# BOL SO3177 - PO334804 style HTML
BOL_HTML = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid black; padding: 8px; }
        .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">Bill of Lading - Canoil Canada Ltd</div>
    <p><strong>SO# 3177</strong> | <strong>PO# 334804</strong> | 2026-03-10</p>
    <table>
        <tr><th>Description</th><th>Pieces</th><th>Weight</th></tr>
        <tr><td>Drum of Product A</td><td>10</td><td>2000 kg</td></tr>
        <tr><td>Drum of Product B</td><td>5</td><td>1000 kg</td></tr>
        <tr><td colspan="2">Total Gross Weight</td><td>3000 kg</td></tr>
    </table>
    <p style="margin-top: 20px;">Consignee: Example Customer Inc.</p>
</body>
</html>"""


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_name = "BOL SO3177 - PO334804 - 2026-03-10"
    html_path = os.path.join(script_dir, f"{base_name}.html")
    pdf_path = os.path.join(script_dir, f"{base_name}.pdf")

    print(f"BOL HTML to PDF: {base_name}")
    print("=" * 50)

    # 1. Save HTML
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(BOL_HTML)
    print(f"[OK] HTML saved: {html_path}")

    # 2. Convert to PDF (pass html_filepath for Playwright file:// loading)
    from playwright_pdf_converter import html_to_pdf_sync

    success = html_to_pdf_sync(BOL_HTML, pdf_path, html_filepath=html_path)

    if success:
        print(f"[OK] PDF saved: {pdf_path}")
        print(f"\nSUCCESS: Both {base_name}.html and .pdf created.")
    else:
        print(f"\nPDF conversion FAILED - HTML is at {html_path}")
        print("   On Render (Docker): wkhtmltopdf is pre-installed - should work.")


if __name__ == '__main__':
    main()
