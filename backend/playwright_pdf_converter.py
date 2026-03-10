"""
HTML to PDF converter - Playwright (print-to-PDF) with wkhtmltopdf and WeasyPrint fallbacks.
Uses Chromium's native print engine for best fidelity. wkhtmltopdf is pre-installed in Docker.
"""
import os
import subprocess
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


def _wkhtmltopdf_available():
    """Check if wkhtmltopdf is installed (comes with Docker image)."""
    try:
        result = subprocess.run(
            ['wkhtmltopdf', '--version'],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def html_to_pdf_sync(html_content, output_pdf_path):
    """
    Convert HTML to PDF - NO API KEY. Order: WeasyPrint (no browser) -> wkhtmltopdf -> Playwright.
    On Render: WeasyPrint/wkhtmltopdf first to avoid Chromium segfaults.
    """
    output_pdf_path = os.path.abspath(output_pdf_path)
    os.makedirs(os.path.dirname(output_pdf_path) or '.', exist_ok=True)

    # 1. WeasyPrint FIRST - no browser, no segfault risk, no API key
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
            print(f"[WARN] WeasyPrint failed: {e} - trying wkhtmltopdf")

    # 2. wkhtmltopdf (pre-installed in Docker, no API key)
    if _wkhtmltopdf_available():
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
                f.write(html_content)
                tmp_html = f.name
            try:
                result = subprocess.run(
                    [
                        'wkhtmltopdf',
                        '--quiet',
                        '--page-size', 'Letter',
                        '--margin-top', '10mm',
                        '--margin-right', '10mm',
                        '--margin-bottom', '10mm',
                        '--margin-left', '10mm',
                        '--enable-local-file-access',
                        os.path.abspath(tmp_html),
                        output_pdf_path
                    ],
                    capture_output=True,
                    timeout=60
                )
                if result.returncode == 0 and os.path.exists(output_pdf_path):
                    print(f"[OK] PDF generated (wkhtmltopdf): {os.path.basename(output_pdf_path)}")
                    return True
            finally:
                if os.path.exists(tmp_html):
                    os.unlink(tmp_html)
        except Exception as e:
            print(f"[WARN] wkhtmltopdf failed: {e} - trying Playwright")

    # 3. Playwright LAST - SKIP on Render (Chromium causes segfault status 139)
    if PLAYWRIGHT_AVAILABLE and not os.environ.get('RENDER'):
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
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
            print(f"[WARN] Playwright failed: {e}")

    # 4. PDFShift (only if key set - user said no key)
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

    print("[ERROR] No PDF converter available (Playwright, wkhtmltopdf, WeasyPrint, and PDFShift all failed)")
    return False
