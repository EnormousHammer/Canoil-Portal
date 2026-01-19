"""
HTML to PDF converter with multiple backends:
1. Playwright (best quality, requires browser)
2. WeasyPrint (fallback, no browser needed)
"""
import os
import tempfile
import time

# Track which PDF backend is available
PLAYWRIGHT_AVAILABLE = False
WEASYPRINT_AVAILABLE = False

# Try to import Playwright
try:
    import asyncio
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
    print("[OK] Playwright PDF converter available")
except ImportError as e:
    print(f"[WARN] Playwright not available: {e} - will try WeasyPrint")

# Try to import WeasyPrint as fallback
try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
    print("[OK] WeasyPrint PDF converter available (fallback)")
except ImportError as e:
    print(f"[WARN] WeasyPrint not available: {e}")

if not PLAYWRIGHT_AVAILABLE and not WEASYPRINT_AVAILABLE:
    print("[ERROR] No PDF converter available! Documents will be HTML only.")


async def html_to_pdf_playwright(html_content, output_pdf_path):
    """
    Convert HTML to PDF using Playwright - IDENTICAL to manual Ctrl+P
    This uses the EXACT same browser engine as when you manually print
    """
    try:
        # Create temporary HTML file
        temp_dir = tempfile.gettempdir()
        temp_html = os.path.join(temp_dir, f"temp_logistics_{int(time.time())}.html")
        
        # Write HTML content
        with open(temp_html, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        async with async_playwright() as p:
            # Launch Chromium (same engine as Chrome)
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Load the HTML file
            await page.goto(f"file:///{temp_html.replace(os.sep, '/')}")
            
            # Wait for page to fully load
            await page.wait_for_load_state('networkidle')
            
            # Generate PDF with EXACT same settings as manual print
            await page.pdf(
                path=output_pdf_path,
                format='A4',
                margin={
                    'top': '0in',
                    'right': '0in', 
                    'bottom': '0in',
                    'left': '0in'
                },
                print_background=True,  # Include background colors/images
                prefer_css_page_size=True  # Let CSS @page control margins
            )
            
            await browser.close()
        
        # Clean up temp file
        try:
            os.unlink(temp_html)
        except:
            pass
            
        return True
        
    except Exception as e:
        print(f"Playwright PDF generation failed: {e}")
        return False


def html_to_pdf_weasyprint(html_content, output_pdf_path):
    """
    Convert HTML to PDF using WeasyPrint - fallback when Playwright unavailable
    """
    try:
        # WeasyPrint can render HTML directly
        html_doc = HTML(string=html_content)
        
        # Generate PDF
        html_doc.write_pdf(output_pdf_path)
        
        print(f"[OK] WeasyPrint PDF generated: {output_pdf_path}")
        return True
        
    except Exception as e:
        print(f"WeasyPrint PDF generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def html_to_pdf_sync(html_content, output_pdf_path):
    """
    Synchronous wrapper - tries Playwright first, falls back to WeasyPrint
    """
    # Try Playwright first (best quality)
    if PLAYWRIGHT_AVAILABLE:
        try:
            result = asyncio.run(html_to_pdf_playwright(html_content, output_pdf_path))
            if result:
                return True
            print("[WARN] Playwright failed, trying WeasyPrint fallback...")
        except Exception as e:
            print(f"[WARN] Playwright error: {e}, trying WeasyPrint fallback...")
    
    # Fallback to WeasyPrint
    if WEASYPRINT_AVAILABLE:
        return html_to_pdf_weasyprint(html_content, output_pdf_path)
    
    # No PDF converter available
    print("[ERROR] No PDF converter available - cannot generate PDF")
    return False
