#!/usr/bin/env python3
"""
Test HTML to PDF conversion - no API key needed.
Uses: Playwright -> wkhtmltopdf -> WeasyPrint (wkhtmltopdf is in Docker).
Run: python test_html_to_pdf.py
Output: test_output.pdf in backend folder
"""
import os

# Sample BOL-like HTML (Big Red style with SO/PO)
SAMPLE_HTML = """<!DOCTYPE html>
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
    <table>
        <tr><th>Description</th><th>Pieces</th><th>Weight</th></tr>
        <tr><td>2 Empty Totes</td><td>2</td><td>111.0 kg</td></tr>
        <tr><td>1st partial tote (5W-30)</td><td>1</td><td>180.5 kg</td></tr>
        <tr><td>PO# C121125-2 & C121125-1 | SO# 3097 & 3099</td><td></td><td></td></tr>
    </table>
    <p style="margin-top: 20px;">Big Red Oil Products Inc. - Totes related to SO 3097 & 3099, PO C121125-2 & C121125-1</p>
</body>
</html>"""


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, 'test_output.pdf')

    print("HTML to PDF test (no API key)")
    print("=" * 50)
    print("Sample HTML:")
    print(SAMPLE_HTML[:300] + "...")
    print()

    from playwright_pdf_converter import html_to_pdf_sync

    success = html_to_pdf_sync(SAMPLE_HTML, output_path)

    if success:
        print(f"\nSUCCESS: PDF saved to {output_path}")
        print("   Open it to verify - Big Red totes with SO/PO should be visible.")
    else:
        print("\nFAILED: Check console for [WARN]/[ERROR] above.")
        print("   On Render (Docker): wkhtmltopdf is pre-installed - should work.")
        print("   Locally: Install wkhtmltopdf or run in Docker to test.")


if __name__ == '__main__':
    main()
