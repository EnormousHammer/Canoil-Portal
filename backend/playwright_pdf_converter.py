"""
HTML to PDF converter - Server-side PDF generation disabled
PDFs should be generated client-side by printing HTML to PDF
"""
import os

# PDF generation is disabled on server due to Docker complexity
PDFKIT_AVAILABLE = False

print("[INFO] Server-side PDF generation disabled - use browser Print to PDF for HTML documents")


def html_to_pdf_sync(html_content, output_pdf_path):
    """
    PDF generation disabled on server.
    Returns False - client should use browser Print to PDF.
    """
    print("[INFO] PDF generation skipped - use browser Print to PDF")
    return False
