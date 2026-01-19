"""
HTML to PDF converter - DISABLED on Render (returns HTML only)
PDF generation requires browser/WeasyPrint which adds complexity to Docker
Documents are generated as HTML - users can print to PDF from browser
"""
import os

def html_to_pdf_sync(html_content, output_pdf_path):
    """
    PDF generation disabled on cloud - returns False
    HTML files are still generated and can be printed to PDF from browser
    """
    print(f"[INFO] PDF generation skipped on cloud - HTML file available for browser print")
    return False
