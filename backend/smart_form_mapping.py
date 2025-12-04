#!/usr/bin/env python3
"""
SMART FORM FIELD MAPPING SYSTEM
Based on actual template analysis from G Drive logistics templates
Maps parsed SO data to correct form fields intelligently
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
import re

class SmartFormMapper:
    """
    Intelligent field mapping based on actual template analysis
    Maps SO data to form fields with high accuracy
    """
    
    def __init__(self):
        self.canoil_company_info = {
            'name': 'Canoil Canada Ltd.',
            'address': '62 Todd Road',
            'city': 'Georgetown',
            'province': 'ON',
            'postal_code': 'L7G 4R7',
            'country': 'Canada'
        }
    
    def map_packing_slip_fields(self, so_data: Dict[str, Any], email_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map data to Packing Slip template fields
        Based on analysis: 9 rows x 9 cols table structure
        """
        print("🎯 SMART MAPPING: Packing Slip fields...")
        
        # Extract customer info from SO
        customer_info = so_data.get('customer_info', {})
        shipping_address = so_data.get('shipping_address', {})
        raw_items = so_data.get('items', [])
        
        # CRITICAL FIX: Apply Mosier filtering logic
        is_mosier = email_analysis.get('is_mosier_order', False)
        items = self._filter_items_for_forms(raw_items, is_mosier)
        
        print(f"🏢 MOSIER ORDER: {is_mosier} - Using {len(items)} items (was {len(raw_items)})")
        
        # Smart field mapping
        mapping = {
            # Header information
            'packing_slip_number': so_data.get('so_number', 'N/A'),
            'date': datetime.now().strftime('%B %d, %Y'),
            'page': '1 of 1',
            
            # Company information (Canoil - always same)
            'shipper_name': self.canoil_company_info['name'],
            'shipper_address': f"{self.canoil_company_info['address']}\n{self.canoil_company_info['city']}, {self.canoil_company_info['province']} {self.canoil_company_info['postal_code']}",
            
            # Customer information (Sold To & Ship To)
            'sold_to_company': customer_info.get('name', 'N/A'),
            'sold_to_address': self._format_address(customer_info),
            'ship_to_company': shipping_address.get('name', customer_info.get('name', 'N/A')),
            'ship_to_address': self._format_address(shipping_address) if shipping_address else self._format_address(customer_info),
            
            # Order information
            'sales_order_number': so_data.get('so_number', 'N/A'),
            'shipped_by': self.canoil_company_info['name'],
            'scheduled_ship_date': email_analysis.get('ship_date', datetime.now().strftime('%B %d, %Y')),
            
            # Items - intelligently formatted
            'items': self._format_packing_slip_items(items),
            
            # Additional info from email
            'special_instructions': email_analysis.get('special_instructions', ''),
            'contact_info': email_analysis.get('contact_info', ''),
        }
        
        print(f"✅ PACKING SLIP: Mapped {len(mapping)} fields successfully")
        return mapping
    
    def map_bill_of_lading_fields(self, so_data: Dict[str, Any], email_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map data to Bill of Lading template fields
        Based on analysis: 7 tables with complex structure
        """
        print("🎯 SMART MAPPING: Bill of Lading fields...")
        
        customer_info = so_data.get('customer_info', {})
        shipping_address = so_data.get('shipping_address', {})
        raw_items = so_data.get('items', [])
        
        # CRITICAL FIX: Apply Mosier filtering logic
        is_mosier = email_analysis.get('is_mosier_order', False)
        items = self._filter_items_for_forms(raw_items, is_mosier)
        
        # Calculate total weight and pieces
        total_weight_kg = sum(item.get('total_weight', 0) for item in items)
        total_weight_lb = total_weight_kg * 2.20462  # Convert kg to lb
        total_pieces = sum(item.get('quantity', 0) for item in items)
        
        mapping = {
            # Carrier information
            'carrier': email_analysis.get('carrier', 'TBD'),
            
            # Date
            'date': datetime.now().strftime('%Y-%m-%d'),
            
            # Shipper information (Canoil)
            'shipper_name': self.canoil_company_info['name'],
            'shipper_street': self.canoil_company_info['address'],
            'shipper_city': f"{self.canoil_company_info['city']}, {self.canoil_company_info['province']}",
            'shipper_postal': self.canoil_company_info['postal_code'],
            
            # Consignee information
            'consignee_name': shipping_address.get('name', customer_info.get('name', 'N/A')),
            'consignee_street': shipping_address.get('address', customer_info.get('address', 'N/A')),
            'consignee_city': f"{shipping_address.get('city', customer_info.get('city', 'N/A'))}, {shipping_address.get('state', customer_info.get('state', 'N/A'))}",
            'consignee_postal': shipping_address.get('postal_code', customer_info.get('postal_code', 'N/A')),
            
            # Freight charges
            'freight_charges': 'Prepaid',  # Default for Canoil
            
            # Goods description
            'pieces': str(total_pieces),
            'description': self._format_bol_description(items),
            'weight_lb': f"{total_weight_lb:.1f}",
            'weight_kg': f"{total_weight_kg:.1f}",
            
            # Declared valuation
            'declared_value': self._calculate_declared_value(items),
            
            # Signatures
            'shipper_signature': self.canoil_company_info['name'],
            'date_signed': datetime.now().strftime('%Y-%m-%d'),
            
            # Notes
            'notes': email_analysis.get('special_instructions', ''),
        }
        
        print(f"✅ BILL OF LADING: Mapped {len(mapping)} fields successfully")
        return mapping
    
    def map_commercial_invoice_fields(self, so_data: Dict[str, Any], email_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map data to Commercial Invoice template fields
        Based on PDF template analysis
        """
        print("🎯 SMART MAPPING: Commercial Invoice fields...")
        
        customer_info = so_data.get('customer_info', {})
        shipping_address = so_data.get('shipping_address', {})
        raw_items = so_data.get('items', [])
        
        # CRITICAL FIX: Apply Mosier filtering logic
        is_mosier = email_analysis.get('is_mosier_order', False)
        items = self._filter_items_for_forms(raw_items, is_mosier)
        
        # Calculate totals
        subtotal = sum(item.get('total_price', 0) for item in items)
        tax_amount = subtotal * 0.13 if customer_info.get('country', '').upper() == 'CANADA' else 0  # HST for Canadian customers
        total_amount = subtotal + tax_amount
        
        mapping = {
            # Invoice information
            'invoice_number': f"INV-{so_data.get('so_number', 'N/A')}",
            'invoice_date': datetime.now().strftime('%B %d, %Y'),
            'po_number': email_analysis.get('po_number', so_data.get('po_number', 'N/A')),
            
            # Seller information (Canoil)
            'seller_name': self.canoil_company_info['name'],
            'seller_address': self._format_full_address(self.canoil_company_info),
            
            # Buyer information
            'buyer_name': customer_info.get('name', 'N/A'),
            'buyer_address': self._format_address(customer_info),
            
            # Ship to information
            'ship_to_name': shipping_address.get('name', customer_info.get('name', 'N/A')),
            'ship_to_address': self._format_address(shipping_address) if shipping_address else self._format_address(customer_info),
            
            # Items
            'items': self._format_invoice_items(items),
            
            # Totals
            'subtotal': f"${subtotal:,.2f}",
            'tax_amount': f"${tax_amount:,.2f}" if tax_amount > 0 else "$0.00",
            'total_amount': f"${total_amount:,.2f}",
            
            # Payment terms
            'payment_terms': 'Net 30 days',
            
            # Shipping information
            'ship_date': email_analysis.get('ship_date', datetime.now().strftime('%B %d, %Y')),
            'ship_via': email_analysis.get('carrier', 'TBD'),
            
            # Additional information
            'currency': 'USD',
            'country_of_origin': 'Canada',
        }
        
        print(f"✅ COMMERCIAL INVOICE: Mapped {len(mapping)} fields successfully")
        return mapping
    
    def map_dangerous_goods_fields(self, so_data: Dict[str, Any], email_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map data to Dangerous Goods Declaration template fields
        Based on analysis: 16 rows x 18 cols complex table
        """
        print("🎯 SMART MAPPING: Dangerous Goods Declaration fields...")
        
        customer_info = so_data.get('customer_info', {})
        shipping_address = so_data.get('shipping_address', {})
        raw_items = so_data.get('items', [])
        
        # CRITICAL FIX: Apply Mosier filtering logic
        is_mosier = email_analysis.get('is_mosier_order', False)
        items = self._filter_items_for_forms(raw_items, is_mosier)
        
        # Filter hazardous items
        hazardous_items = [item for item in items if self._is_hazardous_item(item)]
        
        mapping = {
            # Shipper information (Canoil)
            'shipper_name': self.canoil_company_info['name'],
            'shipper_address': f"{self.canoil_company_info['address']}, {self.canoil_company_info['city']}, {self.canoil_company_info['province']} {self.canoil_company_info['postal_code']}",
            
            # Consignee information
            'consignee_name': shipping_address.get('name', customer_info.get('name', 'N/A')),
            'consignee_address': self._format_address(shipping_address) if shipping_address else self._format_address(customer_info),
            
            # Air/Ground waybill
            'waybill_number': email_analysis.get('waybill_number', 'TBD'),
            
            # Buyer information
            'buyer_name': customer_info.get('name', 'N/A'),
            'buyer_address': self._format_address(customer_info),
            
            # Dangerous goods items
            'dangerous_goods': self._format_dangerous_goods_items(hazardous_items),
            
            # Declaration
            'declaration_date': datetime.now().strftime('%Y-%m-%d'),
            'shipper_signature': 'Haron Alhakimi',
            'shipper_title': 'Logistics Supervisor',
            'shipper_email': 'Haron@canoilcanadaltd.com',
        }
        
        print(f"✅ DANGEROUS GOODS: Mapped {len(mapping)} fields successfully")
        return mapping
    
    def map_tsca_statement_fields(self, so_data: Dict[str, Any], email_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map data to TSCA Statement template fields
        Based on analysis: Simple paragraph structure
        """
        print("🎯 SMART MAPPING: TSCA Statement fields...")
        
        customer_info = so_data.get('customer_info', {})
        raw_items = so_data.get('items', [])
        
        # CRITICAL FIX: Apply Mosier filtering logic
        is_mosier = email_analysis.get('is_mosier_order', False)
        items = self._filter_items_for_forms(raw_items, is_mosier)
        
        mapping = {
            # TSCA certification text
            'certification_text': 'I CERTIFY THAT ALL CHEMICAL SUBSTANCES IN THIS SHIPMENT COMPLY WITH ALL APPLICABLE RULES OR ORDERS UNDER TSCA AND THAT I AM NOT OFFERING FOR SHIPMENT A CHEMICAL SUBSTANCE WHICH REQUIRES A NOTICE OF COMMENCEMENT OR PREMANUFACTURE NOTIFICATION UNDER TSCA.',
            
            # Signatory information
            'name': 'Haron Alhakimi',
            'title': 'Logistics Supervisor',
            'email': 'haron@canoilcanadaltd.com',
            'date': datetime.now().strftime('%B %d, %Y'),
            
            # Delivery information
            'delivery_address': self._format_address(customer_info),
            
            # Product information
            'products': self._format_tsca_products(items),
            
            # Company information
            'company_name': self.canoil_company_info['name'],
            'company_address': self._format_full_address(self.canoil_company_info),
        }
        
        print(f"✅ TSCA STATEMENT: Mapped {len(mapping)} fields successfully")
        return mapping
    
    # Helper methods for filtering and formatting
    
    def _filter_items_for_forms(self, items: List[Dict[str, Any]], is_mosier: bool) -> List[Dict[str, Any]]:
        """
        UNIVERSAL: Filter out pallets, charges, and packaging for ALL orders
        Only count actual products, never packaging or service charges
        """
        filtered_items = []
        for item in items:
            item_code = item.get('item_code', '').upper()
            description = item.get('description', '').lower()
            
            # Check if this is a non-product item (pallet, charge, brokerage, freight, etc.)
            is_non_product = (
                item_code in ['PALLET', 'FREIGHT', 'BROKERAGE', 'MISC', 'MISCELLANEOUS'] or
                'pallet' in description or
                'charge' in description or
                'brokerage' in description or
                'freight' in description or
                'handling' in description or
                'service' in description or
                'prepaid' in description or
                'add shipment' in description or
                'prepay' in description or
                description.strip() in ['prepaid & add', 'prepaid and add', 'prepay and add']
            )
            
            if not is_non_product:
                filtered_items.append(item)
                print(f"✅ FORM ITEM INCLUDED: {item.get('description', 'N/A')}")
            else:
                print(f"❌ FORM ITEM EXCLUDED (Universal): {item.get('description', 'N/A')} (non-product)")
        
        print(f"🔧 UNIVERSAL FORM FILTERING: {len(filtered_items)} items (was {len(items)})")
        return filtered_items
    
    def _format_address(self, address_info: Dict[str, Any]) -> str:
        """Format address information consistently"""
        if not address_info:
            return 'N/A'
        
        parts = []
        if address_info.get('address'):
            parts.append(address_info['address'])
        
        city_line = []
        if address_info.get('city'):
            city_line.append(address_info['city'])
        if address_info.get('state') or address_info.get('province'):
            city_line.append(address_info.get('state') or address_info.get('province'))
        if address_info.get('postal_code'):
            city_line.append(address_info['postal_code'])
        
        if city_line:
            parts.append(', '.join(city_line))
        
        if address_info.get('country'):
            parts.append(address_info['country'])
        
        return '\n'.join(parts) if parts else 'N/A'
    
    def _format_full_address(self, address_info: Dict[str, Any]) -> str:
        """Format full address with company name"""
        parts = []
        if address_info.get('name'):
            parts.append(address_info['name'])
        
        parts.append(self._format_address(address_info))
        return '\n'.join(parts)
    
    def _format_packing_slip_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format items for packing slip"""
        formatted_items = []
        for item in items:
            formatted_items.append({
                'item_code': item.get('item_code', 'N/A'),
                'description': item.get('description', 'N/A'),
                'quantity': item.get('quantity', 0),
                'unit': item.get('unit', 'EA'),
                'unit_price': f"${item.get('unit_price', 0):,.2f}",
                'total_price': f"${item.get('total_price', 0):,.2f}"
            })
        return formatted_items
    
    def _format_bol_description(self, items: List[Dict[str, Any]]) -> str:
        """Format goods description for BOL"""
        descriptions = []
        for item in items:
            qty = item.get('quantity', 0)
            unit = item.get('unit', 'EA')
            desc = item.get('description', 'Product')
            descriptions.append(f"{qty} {unit} {desc}")
        
        return '; '.join(descriptions)
    
    def _format_invoice_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format items for commercial invoice"""
        formatted_items = []
        for i, item in enumerate(items, 1):
            formatted_items.append({
                'line_number': i,
                'item_code': item.get('item_code', 'N/A'),
                'description': item.get('description', 'N/A'),
                'quantity': item.get('quantity', 0),
                'unit': item.get('unit', 'EA'),
                'unit_price': item.get('unit_price', 0),
                'total_price': item.get('total_price', 0),
                'country_of_origin': 'Canada',
                'hs_code': self._get_hs_code(item)
            })
        return formatted_items
    
    def _format_dangerous_goods_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format dangerous goods items"""
        formatted_items = []
        for item in items:
            formatted_items.append({
                'un_number': self._get_un_number(item),
                'proper_shipping_name': item.get('description', 'N/A'),
                'class': self._get_hazard_class(item),
                'packing_group': self._get_packing_group(item),
                'quantity': item.get('quantity', 0),
                'unit': item.get('unit', 'EA')
            })
        return formatted_items
    
    def _format_tsca_products(self, items: List[Dict[str, Any]]) -> str:
        """Format products for TSCA statement"""
        product_names = []
        for item in items:
            desc = item.get('description', 'Chemical Product')
            product_names.append(desc)
        
        return ', '.join(product_names)
    
    def _calculate_declared_value(self, items: List[Dict[str, Any]]) -> str:
        """Calculate declared value for BOL"""
        total_value = sum(item.get('total_price', 0) for item in items)
        return f"${total_value:,.2f}"
    
    def _is_hazardous_item(self, item: Dict[str, Any]) -> bool:
        """Determine if item is hazardous"""
        description = item.get('description', '').lower()
        hazardous_keywords = ['oil', 'lubricant', 'grease', 'fluid', 'chemical']
        return any(keyword in description for keyword in hazardous_keywords)
    
    def _get_hs_code(self, item: Dict[str, Any]) -> str:
        """Get HS code for item"""
        # Default HS code for lubricants/oils
        return '2710.19.99'
    
    def _get_un_number(self, item: Dict[str, Any]) -> str:
        """Get UN number for dangerous goods"""
        # Default UN number for lubricating oils
        return 'UN3082'
    
    def _get_hazard_class(self, item: Dict[str, Any]) -> str:
        """Get hazard class for dangerous goods"""
        return '9'  # Miscellaneous dangerous goods
    
    def _get_packing_group(self, item: Dict[str, Any]) -> str:
        """Get packing group for dangerous goods"""
        return 'III'  # Low hazard

# Main mapping function
def get_smart_field_mapping(form_type: str, so_data: Dict[str, Any], email_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get smart field mapping for any form type
    """
    mapper = SmartFormMapper()
    
    mapping_functions = {
        'packing_slip': mapper.map_packing_slip_fields,
        'bill_of_lading': mapper.map_bill_of_lading_fields,
        'commercial_invoice': mapper.map_commercial_invoice_fields,
        'dangerous_goods': mapper.map_dangerous_goods_fields,
        'tsca_statement': mapper.map_tsca_statement_fields
    }
    
    if form_type not in mapping_functions:
        raise ValueError(f"Unknown form type: {form_type}")
    
    print(f"🎯 SMART MAPPING: Processing {form_type} with parsed SO data...")
    return mapping_functions[form_type](so_data, email_analysis)

if __name__ == '__main__':
    # Test the mapping system
    print("🧪 TESTING SMART FORM MAPPING SYSTEM")
    
    # Sample data for testing
    sample_so_data = {
        'so_number': '2619',
        'customer_info': {
            'name': 'Actuation Plus LLC',
            'address': '506 Todd St',
            'city': 'Conroe',
            'state': 'TX',
            'postal_code': '77385',
            'country': 'USA'
        },
        'items': [
            {
                'item_code': 'REOL46XCDRM',
                'description': 'REOLUBE 46XC DRUM',
                'quantity': 10,
                'unit': 'DRUM',
                'unit_price': 1046.58,
                'total_price': 10465.80
            }
        ]
    }
    
    sample_email_analysis = {
        'ship_date': 'October 22, 2024',
        'carrier': 'Manitoulin Transport',
        'special_instructions': 'Handle with care'
    }
    
    # Test each form type
    for form_type in ['packing_slip', 'bill_of_lading', 'commercial_invoice', 'dangerous_goods', 'tsca_statement']:
        print(f"\n{'='*50}")
        print(f"TESTING: {form_type.upper()}")
        print('='*50)
        
        try:
            mapping = get_smart_field_mapping(form_type, sample_so_data, sample_email_analysis)
            print(f"✅ SUCCESS: {len(mapping)} fields mapped")
            
            # Show first few fields
            for i, (key, value) in enumerate(mapping.items()):
                if i < 5:  # Show first 5 fields
                    print(f"  {key}: {str(value)[:60]}...")
                
        except Exception as e:
            print(f"❌ ERROR: {e}")
