#!/usr/bin/env python3
"""
Sales Order Cache Builder - Parse all SOs once and create instant lookup cache
"""

import os
import json
import sys
from datetime import datetime
from app import extract_so_data_from_pdf

# Add current directory to path
sys.path.append('.')

def build_so_cache():
    """Build comprehensive SO cache for instant frontend lookups"""
    
    print("🚀 BUILDING SO CACHE - This runs once to enable instant lookups")
    print("=" * 60)
    
    # Paths
    sales_orders_base = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
    cache_dir = "cache"
    
    # Create cache directory
    os.makedirs(cache_dir, exist_ok=True)
    
    # Cache files
    parsed_sos_file = os.path.join(cache_dir, "ParsedSalesOrders.json")
    item_index_file = os.path.join(cache_dir, "SOItemIndex.json")
    cache_status_file = os.path.join(cache_dir, "SOCacheStatus.json")
    
    # Load existing cache to avoid re-parsing
    existing_cache = {}
    if os.path.exists(parsed_sos_file):
        try:
            with open(parsed_sos_file, 'r') as f:
                existing_cache = {so['so_number']: so for so in json.load(f)}
            print(f"📋 Loaded existing cache: {len(existing_cache)} SOs")
        except:
            print("⚠️ Could not load existing cache, starting fresh")
    
    # Find all SO PDFs
    all_so_files = []
    print(f"🔍 Scanning for SO PDFs in: {sales_orders_base}")
    print(f"   This may take 30-60 seconds for large folders...")
    
    folder_count = 0
    for root, dirs, files in os.walk(sales_orders_base):
        folder_count += 1
        folder_name = os.path.basename(root)
        
        # Show progress during scan
        if folder_count % 5 == 0:
            print(f"   Scanning folder #{folder_count}: {folder_name} ({len(all_so_files)} SOs found so far)")
        
        for file in files:
            if file.lower().endswith('.pdf') and 'salesorder_' in file.lower():
                file_path = os.path.join(root, file)
                # Extract SO number from filename
                so_number = file.replace('salesorder_', '').replace('.pdf', '')
                all_so_files.append({
                    'so_number': so_number,
                    'file_path': file_path,
                    'file_name': file,
                    'folder': os.path.basename(root)
                })
    
    print(f"\n✅ SCAN COMPLETE!")
    print(f"📄 Found {len(all_so_files)} SO PDF files in {folder_count} folders")
    
    # Parse SOs (skip already cached ones)
    parsed_sos = []
    item_index = []
    parsed_count = 0
    skipped_count = 0
    
    for i, so_file in enumerate(all_so_files, 1):
        so_number = so_file['so_number']
        
        # Skip if already cached
        if so_number in existing_cache:
            parsed_sos.append(existing_cache[so_number])
            # Add items to index
            for item in existing_cache[so_number].get('items', []):
                item_index.append({
                    'so_number': so_number,
                    'item_code': item.get('item_code', ''),
                    'item_description': item.get('description', ''),
                    'quantity': item.get('quantity', 0)
                })
            skipped_count += 1
            if i % 10 == 0:
                print(f"⏩ Skipped {skipped_count} cached SOs (up to #{i})")
            continue
        
        # Progress indicator
        print(f"\n📄 [{i}/{len(all_so_files)}] Parsing: {so_number}")
        print(f"   Folder: {so_file['folder']}")
        print(f"   Progress: {(i/len(all_so_files)*100):.1f}% complete")
        
        try:
            # Parse the PDF
            parsed_data = extract_so_data_from_pdf(so_file['file_path'])
            
            if parsed_data and parsed_data.get('items'):
                # Add metadata
                parsed_data['folder'] = so_file['folder']
                parsed_data['file_name'] = so_file['file_name']
                parsed_data['cached_at'] = datetime.now().isoformat()
                
                parsed_sos.append(parsed_data)
                
                # Add items to index for fast lookup
                for item in parsed_data.get('items', []):
                    item_index.append({
                        'so_number': so_number,
                        'item_code': item.get('item_code', ''),
                        'item_description': item.get('description', ''),
                        'quantity': item.get('quantity', 0)
                    })
                
                parsed_count += 1
                print(f"   ✅ SUCCESS: {len(parsed_data.get('items', []))} items | Customer: {parsed_data.get('customer', 'N/A')}")
                
                # Show summary every 25 SOs
                if parsed_count % 25 == 0:
                    print(f"\n{'='*60}")
                    print(f"   📊 PROGRESS SUMMARY")
                    print(f"   Parsed so far: {parsed_count} SOs")
                    print(f"   Items indexed: {len(item_index)}")
                    print(f"   Time remaining: ~{int((len(all_so_files)-i)*1.5/60)} minutes")
                    print(f"{'='*60}\n")
                
            else:
                print(f"    ❌ Failed to parse or no items found")
                
        except Exception as e:
            print(f"    ❌ Error parsing SO {so_number}: {e}")
        
        # Save progress every 10 SOs
        if i % 10 == 0:
            print(f"💾 Saving progress... ({i}/{len(all_so_files)})")
            save_cache(parsed_sos, item_index, parsed_sos_file, item_index_file)
    
    # Final save
    save_cache(parsed_sos, item_index, parsed_sos_file, item_index_file)
    
    # Save cache status
    cache_status = {
        'last_updated': datetime.now().isoformat(),
        'total_sos_found': len(all_so_files),
        'total_sos_parsed': len(parsed_sos),
        'newly_parsed': parsed_count,
        'skipped_cached': skipped_count,
        'total_items': len(item_index),
        'cache_files': {
            'parsed_sos': parsed_sos_file,
            'item_index': item_index_file
        }
    }
    
    with open(cache_status_file, 'w') as f:
        json.dump(cache_status, f, indent=2)
    
    print("\n🎉 SO CACHE BUILD COMPLETE!")
    print(f"📊 Results:")
    print(f"   • Total SOs found: {len(all_so_files)}")
    print(f"   • SOs parsed: {len(parsed_sos)}")
    print(f"   • Items indexed: {len(item_index)}")
    print(f"   • Cache files saved to: {cache_dir}/")
    print(f"\n⚡ Frontend will now have INSTANT SO lookups!")

def save_cache(parsed_sos, item_index, parsed_file, index_file):
    """Save cache files"""
    with open(parsed_file, 'w') as f:
        json.dump(parsed_sos, f, indent=2, default=str)
    
    with open(index_file, 'w') as f:
        json.dump(item_index, f, indent=2)

if __name__ == "__main__":
    build_so_cache()
