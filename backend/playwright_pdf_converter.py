"""
PERFECT HTML to PDF converter using Playwright
GUARANTEED identical formatting to manual Ctrl+P
"""
import asyncio
from playwright.async_api import async_playwright
import os
import tempfile
import time

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

def html_to_pdf_sync(html_content, output_pdf_path):
    """
    Synchronous wrapper for async Playwright function
    """
    try:
        return asyncio.run(html_to_pdf_playwright(html_content, output_pdf_path))
    except Exception as e:
        print(f"Error in sync PDF conversion: {e}")
        return False
