#!/usr/bin/env python3
"""
Generate a simple list of item descriptions only
"""

import json
import os
import re
from datetime import datetime

# G: Drive base path
GDRIVE_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"

def load_data_from_gdrive():
    """Load data directly from G: Drive"""
    if not os.path.exists(GDRIVE_BASE):
        print(f"❌ G: Drive not accessible at: {GDRIVE_BASE}")
        return None
    
    # Find latest folder
    folders = [f for f in os.listdir(GDRIVE_BASE) if os.path.isdir(os.path.join(GDRIVE_BASE, f)) and re.match(r'\d{4}-\d{2}-\d{2}', f)]
    if not folders:
        print("❌ No date folders found in G: Drive")
        return None
    
    latest_folder = sorted(folders)[-1]
    folder_path = os.path.join(GDRIVE_BASE, latest_folder)
    print(f"📁 Using folder: {latest_folder}")
    
    # Load CustomAlert5.json (products)
    custom_alert5_path = os.path.join(folder_path, 'CustomAlert5.json')
    if os.path.exists(custom_alert5_path):
        with open(custom_alert5_path, 'r', encoding='utf-8') as f:
            items = json.load(f)
        print(f"✅ Loaded {len(items)} products from CustomAlert5.json")
        return items
    else:
        print("⚠️  CustomAlert5.json not found")
        return []

def extract_descriptions(items):
    """Extract all item descriptions"""
    descriptions = []
    for item in items:
        description = item.get('Description', '').strip()
        if description:  # Only add non-empty descriptions
            descriptions.append(description)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_descriptions = []
    for desc in descriptions:
        if desc not in seen:
            seen.add(desc)
            unique_descriptions.append(desc)
    
    return sorted(unique_descriptions)  # Sort alphabetically

def generate_text_list(descriptions, output_file):
    """Generate simple text file with one description per line"""
    with open(output_file, 'w', encoding='utf-8') as f:
        for desc in descriptions:
            f.write(desc + '\n')
    
    print(f"✅ Text list generated: {output_file} ({len(descriptions)} descriptions)")

def generate_json_list(descriptions, output_file):
    """Generate JSON array with descriptions"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(descriptions, f, indent=2, ensure_ascii=False)
    
    print(f"✅ JSON list generated: {output_file} ({len(descriptions)} descriptions)")

def main():
    """Main function"""
    print("=" * 80)
    print("ITEM DESCRIPTIONS LIST GENERATOR")
    print("=" * 80)
    print()
    
    # Load data
    print("📥 Loading data from G: Drive...")
    items = load_data_from_gdrive()
    
    if not items:
        print("❌ Failed to load data")
        return
    
    # Extract descriptions
    print("\n📝 Extracting item descriptions...")
    descriptions = extract_descriptions(items)
    print(f"✅ Found {len(descriptions)} unique descriptions")
    
    # Generate files
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    text_file = f'ITEM_DESCRIPTIONS_LIST_{timestamp}.txt'
    json_file = f'ITEM_DESCRIPTIONS_LIST_{timestamp}.json'
    
    print(f"\n📄 Generating files...")
    generate_text_list(descriptions, text_file)
    generate_json_list(descriptions, json_file)
    
    print("\n" + "=" * 80)
    print("✅ LIST GENERATION COMPLETE")
    print("=" * 80)
    print(f"📄 Text File: {text_file} (one description per line)")
    print(f"📋 JSON File: {json_file} (JSON array)")
    print()
    
    # Show first 10 as preview
    print("📋 Preview (first 10 descriptions):")
    print("-" * 80)
    for i, desc in enumerate(descriptions[:10], 1):
        print(f"{i}. {desc}")
    print()

if __name__ == '__main__':
    main()


















