"""Test SO extraction with the format from the log"""
import re

def extract_all_so_numbers(text: str) -> list:
    """
    Extract ALL SO numbers from email text.
    Returns list of unique SO numbers found.
    """
    so_numbers = []
    
    # Pattern 1: "sales orders 3004 & 3020" or "SOs 3004, 3020"
    multi_pattern = r'(?:sales\s*orders?|SOs?)\s*[#:]?\s*(\d{3,5})\s*(?:&|,|and)\s*(\d{3,5})'
    multi_matches = re.findall(multi_pattern, text, re.IGNORECASE)
    for match in multi_matches:
        so_numbers.extend(match)
    
    # Pattern 2: Individual SO mentions - "Sales Order 3004:", "SO 3024", "s0 3004" (typo)
    # Also handles "SO 3012, SO 3022, and SO 3222" format
    individual_pattern = r'(?:sales\s*order|[Ss][Oo0])\s*[#:]?\s*(\d{3,5})'
    individual_matches = re.findall(individual_pattern, text, re.IGNORECASE)
    so_numbers.extend(individual_matches)
    
    # Pattern 3: Just numbers after commas/and in SO context
    # "SO 3012, 3022, and 3222" → catches 3022 and 3222
    comma_and_pattern = r'(?:,\s*|\band\s+)(\d{3,5})(?=\s*(?:,|\band\b|\.|$|\s+we|\s+need))'
    comma_matches = re.findall(comma_and_pattern, text, re.IGNORECASE)
    so_numbers.extend(comma_matches)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_so_numbers = []
    for so in so_numbers:
        if so not in seen:
            seen.add(so)
            unique_so_numbers.append(so)
    
    return unique_so_numbers

# Test with the format from the log
test_email = """Hi Haron,

Pengxin (Wuhan) Import & Export purchase order number 20260109 (Canoil sales order 3110 attached) is ready to go out the door:

2 kegs of MOV LONG LIFE 0

130 kg total gross weight, batch number WH5B16G031

On 1 pallet, 23.5×45×32 inches 

2) PO C092525-2 / SO 3024 – BRO SAE 0W-20 Full Synthetic dexos 1 Gen 3 4×5 L
Status: Completed and ready.
Quantity: 240 cases.
Batch: N54900
Pallets: 6 pallets, approx. 48×42×59 inches each.
Total gross weight: 4,506 kg.
Totes on site: 5 totes – 4 empty + 1 partial (approx. 149 kg).

3) PO C110525-1 / SO 3064 – BRO SAE 10W-30 Heavy Duty CK-4 4×5 L
Status: Completed and ready.
Quantity: 80 cases.
Batch: N54788
Pallets: 2 pallets, approx. 48×42×59 inches each.
Total gross weight: 1,512 kg.
Totes on site: 2 totes – 1 empty + 1 partial (approx. 330 kg).
"""

print("Testing SO extraction...")
print(f"Email length: {len(test_email)} characters")
print(f"\nEmail content:\n{test_email}\n")

so_numbers = extract_all_so_numbers(test_email)
print(f"Extracted SO numbers: {so_numbers}")
print(f"Expected: ['3110', '3024', '3064']")
print(f"Match: {set(so_numbers) == set(['3110', '3024', '3064'])}")
