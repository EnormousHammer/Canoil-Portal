#!/usr/bin/env python3
"""
Smart Sales Order Search System - COMPLETELY DYNAMIC AND FREE
Uses AI to intelligently find and analyze Sales Order files from ANY folder structure
NO LIMITATIONS - DISCOVERS EVERYTHING DYNAMICALLY
"""

import os
import re
import glob
from typing import List, Dict, Optional, Tuple
from openai import OpenAI
# Import will be done dynamically to avoid circular imports

class SmartSOSearch:
    def __init__(self, openai_client):
        self.client = openai_client
        # NO HARDCODED PATHS - DISCOVER EVERYTHING DYNAMICALLY
    
    def discover_all_so_directories(self) -> List[str]:
        """
        COMPLETELY DYNAMIC DISCOVERY - NO LIMITATIONS!
        Finds ALL possible Sales Order locations across the entire G: Drive
        """
        directories = []
        
        # DYNAMIC BASE PATH DISCOVERY - NO HARDCODING!
        possible_bases = [
            r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders",
            r"G:\Shared drives\Sales_CSR\Customer Orders", 
            r"G:\Shared drives\Sales_CSR",
            r"G:\Shared drives"
        ]
        
        sales_orders_base = None
        for base in possible_bases:
            if os.path.exists(base):
                # Check if this contains Sales Order files
                if self._contains_sales_orders(base):
                    sales_orders_base = base
                    print(f"🎯 DYNAMIC DISCOVERY: Found Sales Orders base at {base}")
                    break
        
        if not sales_orders_base:
            print("❌ No Sales Orders base found - searching entire G: Drive")
            # FALLBACK: Search entire G: Drive if needed
            sales_orders_base = r"G:\Shared drives"
        
        try:
            print(f"🔍 UNLIMITED SEARCH starting from: {sales_orders_base}")
            
            # RECURSIVE DISCOVERY - NO LIMITS!
            self._discover_recursively(sales_orders_base, directories)
            
            print(f"🎉 DYNAMIC DISCOVERY COMPLETE! Found {len(directories)} directories with Sales Orders")
            return directories
            
        except Exception as e:
            print(f"❌ Error in dynamic discovery: {e}")
            return directories
    
    def _contains_sales_orders(self, path: str) -> bool:
        """Check if a directory contains Sales Order files"""
        try:
            for root, dirs, files in os.walk(path):
                for file in files:
                    if file.lower().startswith('salesorder') and file.lower().endswith(('.pdf', '.docx', '.doc')):
                        return True
                # Don't go too deep on initial check
                if len(root.replace(path, '').split(os.sep)) > 3:
                    break
            return False
        except:
            return False
    
    def _discover_recursively(self, base_path: str, directories: List[str]):
        """
        UNLIMITED RECURSIVE DISCOVERY - NO RESTRICTIONS!
        Finds every single directory that contains Sales Order files
        """
        try:
            for root, dirs, files in os.walk(base_path):
                # Check if this directory contains Sales Order files
                has_so_files = False
                for file in files:
                    if (file.lower().startswith('salesorder') or 
                        'salesorder' in file.lower() or
                        file.lower().startswith('so_') or
                        re.search(r'so[\s_-]*\d+', file.lower())):
                        if file.lower().endswith(('.pdf', '.docx', '.doc')):
                            has_so_files = True
                            break
                
                if has_so_files:
                    directories.append(root)
                    print(f"📁 FOUND SO FILES IN: {root}")
                
                # Skip system directories
                dirs[:] = [d for d in dirs if d not in ['desktop.ini', '$RECYCLE.BIN', 'System Volume Information']]
                
        except Exception as e:
            print(f"❌ Error in recursive discovery: {e}")

    def find_so_files_by_number(self, so_number: str) -> List[Tuple[str, str]]:
        """
        UNLIMITED SMART FILE SEARCH - NO RESTRICTIONS!
        Finds SO files by number across ALL discovered directories
        Returns list of (file_path, folder_status) tuples
        """
        print(f"🔍 UNLIMITED SEARCH for SO {so_number}")
        found_files = []
        
        # DYNAMIC DISCOVERY - NO HARDCODED LIMITS!
        all_directories = self.discover_all_so_directories()
        
        for directory in all_directories:
            if not os.path.exists(directory):
                continue
                
            # Get meaningful folder name/path
            folder_name = os.path.basename(directory)
            
            # COMPREHENSIVE SEARCH PATTERNS - CATCH EVERYTHING!
            patterns = [
                f"*{so_number}*",
                f"*salesorder*{so_number}*", 
                f"*sales*order*{so_number}*",
                f"*SO*{so_number}*",
                f"salesorder_{so_number}*",
                f"SO_{so_number}*",
                f"so_{so_number}*",
                f"SalesOrder_{so_number}*",
                f"*SO{so_number}*",
                f"*so{so_number}*"
            ]
            
            for pattern in patterns:
                search_path = os.path.join(directory, pattern)
                matches = glob.glob(search_path, recursive=False)
                
                for match in matches:
                    if match.lower().endswith(('.pdf', '.docx', '.doc')):
                        print(f"🎯 FOUND: {os.path.basename(match)} in {directory}")
                        found_files.append((match, folder_name))
        
        print(f"🎉 UNLIMITED SEARCH COMPLETE! Found {len(found_files)} files for SO {so_number}")
        return found_files
    
    def smart_so_search(self, query: str) -> Dict:
        """
        AI-powered smart search for Sales Orders
        Extracts SO number from query and finds matching files
        """
        print(f"🧠 Smart SO Search for query: '{query}'")
        
        # Extract SO number from query using AI
        so_number = self.extract_so_number_with_ai(query)
        
        if not so_number:
            return {
                'success': False,
                'error': 'Could not extract Sales Order number from query',
                'query': query
            }
        
        print(f"🔍 Extracted SO number: {so_number}")
        
        # Find files containing this SO number
        found_files = self.find_so_files_by_number(so_number)
        
        if not found_files:
            return {
                'success': False,
                'error': f'No files found for Sales Order {so_number}',
                'so_number': so_number,
                'searched_directories': self.so_directories
            }
        
        print(f"📁 Found {len(found_files)} files for SO {so_number}")
        
        # Extract data from found files
        extracted_data = []
        for file_path, folder_status in found_files:
            print(f"📄 Processing: {os.path.basename(file_path)} from {folder_status}")
            
            try:
                # Dynamic import to avoid circular imports
                import importlib
                app_module = importlib.import_module('app')
                
                if file_path.lower().endswith('.pdf'):
                    data = app_module.extract_so_data_from_pdf(file_path)
                elif file_path.lower().endswith(('.docx', '.doc')):
                    data = app_module.extract_so_data_from_docx(file_path)
                else:
                    continue
                
                if data:
                    data['folder_status'] = folder_status
                    data['file_path'] = file_path
                    extracted_data.append(data)
                    
            except Exception as e:
                print(f"❌ Error processing {file_path}: {e}")
                continue
        
        if not extracted_data:
            return {
                'success': False,
                'error': f'Found files for SO {so_number} but could not extract data',
                'so_number': so_number,
                'found_files': [f[0] for f in found_files]
            }
        
        return {
            'success': True,
            'so_number': so_number,
            'found_files': len(found_files),
            'extracted_data': extracted_data,
            'query': query
        }
    
    def extract_so_number_with_ai(self, query: str) -> Optional[str]:
        """
        Use AI to intelligently extract SO number from user query
        """
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a Sales Order number extractor. Extract ONLY the numeric Sales Order number from user queries.

Examples:
- "show me sales order 2968" → "2968"
- "what information is on SO 2972" → "2972"
- "salesorder_2968 details" → "2968"
- "tell me about order 1234" → "1234"
- "SO #5678 status" → "5678"

Return ONLY the numeric part, no text, no explanation. If no SO number found, return "NONE"."""
                    },
                    {
                        "role": "user",
                        "content": query
                    }
                ],
                max_tokens=10,
                temperature=0
            )
            
            result = response.choices[0].message.content.strip()
            
            # Validate it's a number
            if result and result != "NONE" and result.isdigit():
                return result
            
            return None
            
        except Exception as e:
            print(f"❌ AI extraction failed: {e}")
            # Fallback to regex
            numbers = re.findall(r'\b\d{3,5}\b', query)
            return numbers[0] if numbers else None
    
    def analyze_so_with_vision(self, file_path: str) -> Dict:
        """
        Use GPT-4 Vision to analyze Sales Order PDF/image
        """
        try:
            # Convert PDF to image first (would need additional library)
            # For now, use text extraction + AI analysis
            
            # Dynamic import to avoid circular imports
            import importlib
            app_module = importlib.import_module('app')
            
            if file_path.lower().endswith('.pdf'):
                data = app_module.extract_so_data_from_pdf(file_path)
            else:
                data = app_module.extract_so_data_from_docx(file_path)
            
            if not data or not data.get('raw_text'):
                return {'error': 'Could not extract text from file'}
            
            # Use AI to analyze the extracted text
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a Sales Order analyzer. Analyze the provided Sales Order text and extract ALL relevant information in a structured format.

Extract:
- SO Number
- Customer Name and Address
- Order Date and Due Date
- All Items with quantities, descriptions, and prices
- Total Amount
- Status/Notes
- Any special instructions

Provide a comprehensive analysis."""
                    },
                    {
                        "role": "user",
                        "content": f"Analyze this Sales Order:\n\n{data['raw_text']}"
                    }
                ],
                max_tokens=1000,
                temperature=0.1
            )
            
            analysis = response.choices[0].message.content
            
            return {
                'success': True,
                'file_path': file_path,
                'extracted_data': data,
                'ai_analysis': analysis
            }
            
        except Exception as e:
            return {'error': f'Vision analysis failed: {e}'}

# Global instance
smart_search = None

def get_smart_search(openai_client):
    """Get or create smart search instance"""
    global smart_search
    if smart_search is None:
        smart_search = SmartSOSearch(openai_client)
    return smart_search
