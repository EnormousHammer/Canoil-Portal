"""
HTML to PDF converter using pdfkit (wkhtmltopdf)
Simple, reliable, works in Docker
"""
import os
import tempfile

# Track if pdfkit is available
PDFKIT_AVAILABLE = False

try:
    import pdfkit
    PDFKIT_AVAILABLE = True
    print("[OK] pdfkit PDF converter available")
except ImportError as e:
    print(f"[WARN] pdfkit not available: {e}")


def html_to_pdf_sync(html_content, output_pdf_path):
    """
    Convert HTML to PDF using pdfkit (wkhtmltopdf)
    """
    if not PDFKIT_AVAILABLE:
        print("[ERROR] pdfkit not available - cannot generate PDF")
        return False
    
    try:
        # Configure pdfkit options for better rendering
        options = {
            'page-size': 'Letter',
            'margin-top': '0.5in',
            'margin-right': '0.5in',
            'margin-bottom': '0.5in',
            'margin-left': '0.5in',
            'encoding': 'UTF-8',
            'no-outline': None,
            'enable-local-file-access': None,
            'print-media-type': None
        }
        
        # Generate PDF from HTML string
        pdfkit.from_string(html_content, output_pdf_path, options=options)
        
        print(f"[OK] PDF generated: {os.path.basename(output_pdf_path)}")
        return True
        
    except Exception as e:
        print(f"[ERROR] PDF generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False
