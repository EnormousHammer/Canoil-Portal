"""
HTML to PDF converter using WeasyPrint
Simple, reliable, no browser needed
"""
import os

# Track if WeasyPrint is available
WEASYPRINT_AVAILABLE = False

try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
    print("[OK] WeasyPrint PDF converter available")
except ImportError as e:
    print(f"[ERROR] WeasyPrint not available: {e}")


def html_to_pdf_sync(html_content, output_pdf_path):
    """
    Convert HTML to PDF using WeasyPrint
    """
    if not WEASYPRINT_AVAILABLE:
        print("[ERROR] WeasyPrint not available - cannot generate PDF")
        return False
    
    try:
        # WeasyPrint can render HTML directly
        html_doc = HTML(string=html_content)
        
        # Generate PDF
        html_doc.write_pdf(output_pdf_path)
        
        print(f"[OK] PDF generated: {os.path.basename(output_pdf_path)}")
        return True
        
    except Exception as e:
        print(f"[ERROR] PDF generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False
