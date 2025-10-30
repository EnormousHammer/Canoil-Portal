import sys, os
import pdfplumber

sales_orders_base = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders'
so_number = '3012'
matching_files = []

for root, dirs, files in os.walk(sales_orders_base):
    for file in files:
        if file.lower().endswith('.pdf'):
            if so_number in file:
                file_path = os.path.join(root, file)
                matching_files.append(file_path)

if matching_files:
    pdf_path = matching_files[0]
    print('=== EXAMINING ACTUAL SO 3012 PDF STRUCTURE ===')
    
    with pdfplumber.open(pdf_path) as pdf:
        full_text = ''
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + '\n'
    
    lines = full_text.split('\n')
    
    sold_to_found = False
    ship_to_found = False
    
    for i, line in enumerate(lines):
        if 'Sold To:' in line and not sold_to_found:
            print('SOLD TO SECTION:')
            for j in range(i, min(i+8, len(lines))):
                print('  Line', j, ':', repr(lines[j]))
            print()
            sold_to_found = True
            
        elif 'Ship To:' in line and not ship_to_found:
            print('SHIP TO SECTION:')
            for j in range(i, min(i+8, len(lines))):
                print('  Line', j, ':', repr(lines[j]))
            print()
            ship_to_found = True
            
        if sold_to_found and ship_to_found:
            break
else:
    print('SO 3012 PDF not found')
