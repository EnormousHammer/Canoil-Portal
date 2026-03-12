"""
HTML to PDF converter - Playwright (best quality) with WeasyPrint/wkhtmltopdf/PDFShift fallbacks.
- Local: Playwright FIRST (Chromium print engine, best fidelity)
- Render: WeasyPrint/wkhtmltopdf first (Chromium segfaults)
- Vercel serverless: PDFShift first (only reliable option - no Chromium/wkhtmltopdf)
"""
import os
from pathlib import Path
import subprocess
import tempfile
import time

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

IS_RENDER = bool(os.environ.get('RENDER'))
IS_VERCEL = bool(os.environ.get('VERCEL'))


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


def _playwright_convert(html_content, output_pdf_path, html_filepath=None):
    """
    Playwright conversion - best quality. Use file:// when path available for reliable loading.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.emulate_media(media='print')

        if html_filepath and os.path.exists(html_filepath):
            file_url = Path(os.path.abspath(html_filepath)).as_uri()
            page.goto(file_url, wait_until='load', timeout=30000)
        else:
            page.set_content(html_content, wait_until='load', timeout=30000)

        time.sleep(0.3)

        page.pdf(
            path=output_pdf_path,
            format='Letter',
            margin={'top': '0.5in', 'right': '0.5in', 'bottom': '0.5in', 'left': '0.5in'},
            print_background=True,
            prefer_css_page_size=False,
        )
        browser.close()
    return os.path.exists(output_pdf_path)


def html_to_pdf_sync(html_content, output_pdf_path, html_filepath=None):
    """
    Convert HTML to PDF.
    html_filepath: optional path to HTML file - when provided, Playwright uses file:// for more reliable loading.
    Order:
      - Vercel: PDFShift first (only reliable - no Chromium/wkhtmltopdf in serverless)
      - Local: Playwright first (best quality)
      - Render: WeasyPrint/wkhtmltopdf first (Chromium segfaults)
    """
    output_pdf_path = os.path.abspath(output_pdf_path)
    os.makedirs(os.path.dirname(output_pdf_path) or '.', exist_ok=True)

    if html_filepath and not os.path.isabs(html_filepath):
        html_filepath = os.path.abspath(html_filepath)

    # 1. VERCEL: PDFShift FIRST (only reliable option - no Chromium/wkhtmltopdf in serverless)
    if IS_VERCEL:
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
                print(f"[WARN] PDFShift failed on Vercel: {e}")
        else:
            print("[WARN] Vercel: Set PDFSHIFT_API_KEY for HTML→PDF. See https://pdfshift.io")
            return False

    # 2. LOCAL: Playwright FIRST (best quality)
    if PLAYWRIGHT_AVAILABLE and not IS_RENDER and not IS_VERCEL:
        try:
            if _playwright_convert(html_content, output_pdf_path, html_filepath):
                print(f"[OK] PDF generated (Playwright): {os.path.basename(output_pdf_path)}")
                return True
        except Exception as e:
            print(f"[WARN] Playwright failed: {e} - trying fallbacks")

    # 2. WeasyPrint (no browser, safe on Render)
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
            print(f"[WARN] WeasyPrint failed: {e}")

    # 3. wkhtmltopdf (Docker)
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
            print(f"[WARN] wkhtmltopdf failed: {e}")

    # 5. RENDER: Playwright as last resort (may segfault)
    if PLAYWRIGHT_AVAILABLE and IS_RENDER and not IS_VERCEL:
        try:
            if _playwright_convert(html_content, output_pdf_path, html_filepath):
                print(f"[OK] PDF generated (Playwright): {os.path.basename(output_pdf_path)}")
                return True
        except Exception as e:
            print(f"[WARN] Playwright failed on Render: {e}")

    # 6. PDFShift (if API key set - fallback when no local converter works)
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

    print("[ERROR] No PDF converter succeeded")
    return False
