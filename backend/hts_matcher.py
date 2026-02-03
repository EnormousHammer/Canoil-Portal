"""HTS Code Matcher for Canoil Products"""
import json
import os
import re

class HTSMatcher:
    def __init__(self):
        self.hts_codes = {}
        self.load_hts_codes()
    
    def load_hts_codes(self):
        """Load HTS codes from JSON file"""
        try:
            hts_file_path = os.path.join(os.path.dirname(__file__), 'hts_codes.json')
            
            # Read file and close it before processing
            with open(hts_file_path, 'r', encoding='utf-8') as f:
                hts_data = json.load(f)
                
            # File is now closed, process data
            # Flatten the structure for easier lookup
            for letter, items in hts_data.items():
                for item in items:
                    # Create multiple lookup keys for better matching
                    desc = item['description']
                    
                    # Store by full description
                    self.hts_codes[desc.upper()] = {
                        'hts_code': item['hts_code'],
                        'country_of_origin': item.get('country_of_origin', 'Canada'),
                        'description': item['description']
                    }
                    
                    # Also store by product code for easier matching
                    # Extract product codes like "MOVEXT0DRM", "MOVEXT1P17", etc.
                    parts = desc.split()
                    if parts:
                        # Store by first word (usually the product family)
                        product_family = parts[0].upper()
                        if product_family not in self.hts_codes:
                            self.hts_codes[product_family] = {
                                'hts_code': item['hts_code'],
                                'country_of_origin': item.get('country_of_origin', 'Canada'),
                                'description': item['description']
                            }
                    
            # Print after file is closed and data is processed
            # Use sys.stdout.write directly to avoid issues with wrapped stdout
            try:
                import sys
                sys.stdout.write(f"Loaded {len(self.hts_codes)} HTS code entries\n")
                sys.stdout.flush()
            except (IOError, OSError, AttributeError):
                # If stdout is closed or unavailable, just skip print
                pass
            
        except FileNotFoundError:
            # File doesn't exist - that's okay, use empty dict
            self.hts_codes = {}
        except Exception as e:
            # Any other error - log it safely
            try:
                import sys
                sys.stdout.write(f"Warning: Could not load HTS codes: {e}\n")
                sys.stdout.flush()
            except (IOError, OSError, AttributeError):
                pass
            self.hts_codes = {}
    
    def match_hts_code(self, item_description, item_code=None):
        """Match an item to its HTS code"""
        if not item_description and not item_code:
            return None
            
        # Clean the inputs
        desc_upper = item_description.upper().strip() if item_description else ""
        code_upper = item_code.upper().strip() if item_code else ""
        
        # Method 1: Exact match on description
        if desc_upper in self.hts_codes:
            return self.hts_codes[desc_upper]
        
        # Method 2: Check by item code
        if code_upper:
            # For MOVEXT codes, they all use MOV HTS codes
            if code_upper.startswith('MOVEXT'):
                return {
                    'hts_code': '2710.19.3500',
                    'country_of_origin': 'Canada',
                    'description': 'MOV Lubricating Grease'
                }
            
            # Direct code match
            if code_upper in self.hts_codes:
                return self.hts_codes[code_upper]
        
        # Method 3: Check for REOLUBE products by code or description
        if 'REOL' in code_upper or 'REOLUBE' in desc_upper:
            # REOLUBE 46XC
            if '46XC' in code_upper or '46XC' in desc_upper or 'REOL46XC' in code_upper:
                return {
                    'hts_code': '3819.00.0090',
                    'country_of_origin': 'Canada',
                    'description': 'Reolube Turbofluid 46XC (phosphate ester)'
                }
            # REOLUBE 46B (not 46XC)
            elif '46B' in code_upper or '46B' in desc_upper:
                if '46BGT' not in code_upper:  # Not 32B GT
                    return {
                        'hts_code': '3819.00.0000',
                        'country_of_origin': 'Canada',
                        'description': 'Reolube Turbofluid 46B (phosphate ester)'
                    }
            # REOLUBE 32B GT
            elif '32BGT' in code_upper or '32B GT' in desc_upper or '32BGT' in desc_upper:
                return {
                    'hts_code': '3819.00.0000',
                    'country_of_origin': 'Canada',
                    'description': 'Reolube Turbofluid 32B GT (phosphate ester)'
                }
        
        # Method 4: Check if it's a MOV product by description
        if 'MOV' in desc_upper or (code_upper and 'MOV' in code_upper):
            # All MOV products have the same HTS code
            return {
                'hts_code': '2710.19.3500',
                'country_of_origin': 'Canada',
                'description': 'MOV Lubricating Grease'
            }
        
        # Method 5: Check for other known patterns
        if 'SAE30' in desc_upper or 'SAE 30' in desc_upper:
            return {
                'hts_code': '2710.19.9190',
                'country_of_origin': 'Canada',
                'description': 'SAE30 Motor Oil'
            }
        
        if 'DEHYLUB' in desc_upper or 'DEHY' in code_upper:
            return {
                'hts_code': '2916.15.1000',
                'country_of_origin': 'Canada',
                'description': 'Dehylub Ester'
            }
        
        if desc_upper.startswith('CC ') or code_upper.startswith('CC'):
            return {
                'hts_code': '2710.19.9190',
                'country_of_origin': 'Canada',
                'description': 'CC Motor Oil'
            }
        
        # Method 6: VSG Grease products
        if 'VSG' in desc_upper or 'VSG' in code_upper or 'G-2126' in code_upper or 'G21261' in code_upper:
            # Check if it's the biodegradable canola version
            if 'BIODEGRADABLE' in desc_upper or 'CANOLA' in desc_upper:
                return {
                    'hts_code': '3403.19.5000',
                    'country_of_origin': 'Canada',
                    'description': 'VSG Biodegradable Canola-Oil Based Grease'
                }
            else:
                return {
                    'hts_code': '2710.19.3500',
                    'country_of_origin': 'Canada',
                    'description': 'VSG Grease (Fully synthetic grease)'
                }
        
        # Method 7: Anderol products
        if 'ANDEROL' in desc_upper or 'ANDER' in code_upper or 'ANDEP' in code_upper or 'FGCS' in code_upper or 'FGCS' in desc_upper:
            # Anderol 555 is oil (3080)
            if '555' in code_upper or '555' in desc_upper or 'COMPRESSOR' in desc_upper or 'VACUUM' in desc_upper:
                return {
                    'hts_code': '2710.19.3080',
                    'country_of_origin': 'USA',
                    'description': 'Anderol 555 Synthetic Compressor/Vacuum Oil'
                }
            # Anderol FGCS-2 Food Grade Grease - 2710.19.3400
            elif 'FGCS' in code_upper or 'FGCS' in desc_upper or 'FOOD GRADE' in desc_upper:
                return {
                    'hts_code': '2710.19.3400',
                    'country_of_origin': 'USA',
                    'description': 'Petroleum Lubricating Grease (Food Grade)'
                }
            # Anderol 86EP-2 is grease (3500)
            elif '86' in code_upper or '86' in desc_upper or 'EP-2' in desc_upper or 'EP2' in code_upper:
                return {
                    'hts_code': '2710.19.3500',
                    'country_of_origin': 'Canada',
                    'description': 'Anderol 86 EP-2 Lubricating Grease'
                }
        
        # Method 8: Cansol and Canox base oils
        if 'CANSOL' in desc_upper or 'CANSOL' in code_upper:
            return {
                'hts_code': '2710.19.4590',
                'country_of_origin': 'Canada',
                'description': 'Cansol Base Oil'
            }
        
        if 'CANOX' in desc_upper or 'CANOX' in code_upper:
            return {
                'hts_code': '2710.19.4590',
                'country_of_origin': 'Canada',
                'description': 'Canox 02 Base Oil'
            }
        
        # Method 9: Xiameter PMX 200
        if 'XIAMETER' in desc_upper or 'PMX' in code_upper or 'PMX 200' in desc_upper:
            return {
                'hts_code': '2710.19.3080',
                'country_of_origin': 'Canada',
                'description': 'Xiameter PMX 200 Silicone Fluid'
            }
        
        # Method 10: Naugalube
        if 'NAUGALUBE' in desc_upper or 'NAUGALUBE' in code_upper:
            return {
                'hts_code': '2710.19.3080',
                'country_of_origin': 'Canada',
                'description': 'Naugalube-750'
            }
        
        # Method 11: Duratherm Heat Transfer Fluids
        if 'DURATHERM' in desc_upper or 'DURA' in code_upper or 'B-DURA' in code_upper:
            return {
                'hts_code': '3811.21.0000',
                'country_of_origin': 'USA',
                'description': 'Duratherm Heat Transfer Fluids'
            }
        
        # Method 12: AEC Fuel System Cleaners and Engine Flush
        if 'AEC' in desc_upper or 'AEC-' in code_upper:
            if 'DIESEL' in desc_upper or 'DIESEL' in code_upper:
                return {
                    'hts_code': '3811.90.0000',
                    'country_of_origin': 'Canada',
                    'description': 'Advantage Diesel Fuel System Cleaning Solution'
                }
            elif 'GAS' in desc_upper or 'PETROL' in desc_upper or 'PETROL' in code_upper:
                return {
                    'hts_code': '3811.90.0000',
                    'country_of_origin': 'Canada',
                    'description': 'Advantage Petrol Fuel Systems Cleaning Solution'
                }
            elif 'ENGINE' in desc_upper or 'FLUSH' in desc_upper or 'ENGINEFLUSH' in code_upper:
                return {
                    'hts_code': '3403.19.0000',
                    'country_of_origin': 'Canada',
                    'description': 'Engine Flush Solution RDS Lubricating Oil'
                }
        
        # Method 12b: Diesel/Fuel System products (without AEC prefix)
        if 'DIESEL' in desc_upper and ('FUEL' in desc_upper or 'SYSTEM' in desc_upper or 'CLEANING' in desc_upper):
            return {
                'hts_code': '3811.90.0000',
                'country_of_origin': 'Canada',
                'description': 'Diesel Fuel System Cleaning Solution'
            }
        
        # Method 13: VanFlex DIDP Lube Oil (rare)
        if 'VANFLEX' in desc_upper or 'DIDP' in desc_upper:
            return {
                'hts_code': '2710.19.3080',
                'country_of_origin': 'USA',
                'description': 'VanFlex DIDP Lube Oil'
            }
        
        # NO PARTIAL MATCHES - Only exact matches from JSON or known patterns above
        # Don't make up or guess HTS codes
        
        # No match found
        return None

# Create a singleton instance
# Use lazy initialization to avoid import-time errors
hts_matcher = None

def get_hts_matcher():
    """Get or create the HTS matcher instance (lazy initialization)"""
    global hts_matcher
    if hts_matcher is None:
        hts_matcher = HTSMatcher()
    return hts_matcher

def get_hts_code_for_item(item_description, item_code=None):
    """Convenience function to get HTS code info for an item"""
    matcher = get_hts_matcher()
    return matcher.match_hts_code(item_description, item_code)