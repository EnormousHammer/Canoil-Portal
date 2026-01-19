"""
HTML to PDF converter using pdfkit (wkhtmltopdf)
"""
import os

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
        
        pdfkit.from_string(html_content, output_pdf_path, options=options)
        print(f"[OK] PDF generated: {os.path.basename(output_pdf_path)}")
        return True
        
    except Exception as e:
        print(f"[ERROR] PDF generation failed: {e}")
        return False
