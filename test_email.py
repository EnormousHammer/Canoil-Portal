import requests
import json

email = """Hi Zuri,

The Slover Group purchase order number 1009 (Canoil sales order 3075, attached) is ready to go out the door:

3 drums of MOV Extra 0, 540 kg total net weight, batch number WH5D07G025

1 drum of MOV Extra 1, 180 kg total net weight, batch number WH5D06G024

On 1 pallet 45x45x40 inches"""

try:
    r = requests.post('http://localhost:5002/api/logistics/process-email', 
                     json={'email_content': email}, 
                     timeout=60)
    print(f'Status: {r.status_code}')
    
    if r.status_code == 200:
        result = r.json()
        print('SUCCESS!')
    else:
        result = r.json() if r.headers.get('content-type', '').startswith('application/json') else {'error': r.text[:500]}
        print('ERROR RESPONSE:')
    
    print('\n' + '='*80)
    print('EMAIL ITEMS EXTRACTED:')
    print('='*80)
    email_items = result.get('email_data', {}).get('items', [])
    for i, item in enumerate(email_items, 1):
        print(f'{i}. Description: "{item.get("description")}"')
        print(f'   Quantity: {item.get("quantity")}')
        print(f'   Unit: {item.get("unit")}')
        print(f'   Batch: {item.get("batch_number")}')
        print()
    
    print('='*80)
    print('SO ITEMS FROM PDF:')
    print('='*80)
    so_items = result.get('so_data', {}).get('items', [])
    for i, item in enumerate(so_items[:10], 1):
        print(f'{i}. Description: "{item.get("description")}"')
        print(f'   Code: {item.get("item_code")}')
        print(f'   Quantity: {item.get("quantity")}')
        print()
    
    print('='*80)
    print('VALIDATION ERRORS:')
    print('='*80)
    errors = result.get('validation_errors', [])
    for error in errors:
        print(f'  - {error}')
    
    if result.get('validation_details'):
        items_check = result.get('validation_details', {}).get('items_check', {})
        if items_check.get('status') == 'failed':
            print(f'\nItems Check Failed:')
            print(f'  Matched: {items_check.get("matched_items", 0)}/{items_check.get("total_email_items", 0)}')
            print(f'  Unmatched items:')
            for item in items_check.get('unmatched_items', []):
                print(f'    - {item.get("email_item")}')
            print(f'  Quantity mismatches:')
            for item in items_check.get('quantity_mismatches', []):
                print(f'    - {item.get("email_item")}: {item.get("quantity_details")}')
                
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()

