"""
HTML to PDF converter - Playwright (print-to-PDF) with WeasyPrint fallback.
Uses Chromium's native print engine for best fidelity, no deformation.
"""
import os
import tempfile

PLAYWRIGHT_AVAILABLE = False
WEASYPRINT_AVAILABLE = False

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    pass

try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except ImportError:
    pass


def html_to_pdf_sync(html_content, output_pdf_path):
    """
    Convert HTML to PDF using Playwright (print-to-PDF) or WeasyPrint fallback.
    Playwright uses Chromium's native print - best fidelity, no deformation.
    """
    output_pdf_path = os.path.abspath(output_pdf_path)
    os.makedirs(os.path.dirname(output_pdf_path) or '.', exist_ok=True)

    # Try Playwright first (true print-to-PDF)
    if PLAYWRIGHT_AVAILABLE:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                # Ensure print media for correct layout
                page.emulate_media(media='print')
                page.set_content(html_content, wait_until='networkidle')
                page.pdf(
                    path=output_pdf_path,
                    format='Letter',
                    margin={'top': '0.5in', 'right': '0.5in', 'bottom': '0.5in', 'left': '0.5in'},
                    print_background=True
                )
                browser.close()
            if os.path.exists(output_pdf_path):
                print(f"[OK] PDF generated (Playwright): {os.path.basename(output_pdf_path)}")
                return True
        except Exception as e:
            print(f"[WARN] Playwright PDF failed: {e} - trying WeasyPrint")

    # Fallback: WeasyPrint (no browser)
    if WEASYPRINT_AVAILABLE:
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
                f.write(html_content)
                tmp_html = f.name
            try:
                HTML(filename=tmp_html).write_pdf(output_pdf_path)
                if os.path.exists(output_pdf_path):
                    print(f"[OK] PDF generated (WeasyPrint): {os.path.basename(output_pdf_path)}")
                    return True
            finally:
                if os.path.exists(tmp_html):
                    os.unlink(tmp_html)
        except Exception as e:
            print(f"[ERROR] WeasyPrint PDF failed: {e}")

    # Fallback: PDFShift API (works in cloud/serverless when Playwright unavailable)
    api_key = os.environ.get('PDFSHIFT_API_KEY', '').strip()
    if api_key:
        try:
            import httpx
            resp = httpx.post(
                'https://api.pdfshift.io/v3/convert/pdf',
                auth=('api', api_key),
                json={'source': html_content},
                timeout=60.0
            )
            if resp.status_code == 200:
                with open(output_pdf_path, 'wb') as f:
                    f.write(resp.content)
                print(f"[OK] PDF generated (PDFShift): {os.path.basename(output_pdf_path)}")
                return True
        except Exception as e:
            print(f"[WARN] PDFShift failed: {e}")

    print("[ERROR] No PDF converter available (install playwright, weasyprint, or set PDFSHIFT_API_KEY)")
    return False
