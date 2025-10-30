# Logistics Automation Module - Clean Version with GPT-4o
from flask import Blueprint, request, jsonify, send_file
import re
import os
import json
from datetime import datetime
import traceback
from openai import OpenAI

# Create blueprint
logistics_bp = Blueprint('logistics', __name__, url_prefix='')

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def parse_email_with_gpt4(email_text):
    """Parse email content using GPT-4 to extract ALL logistics information"""
    try:
        prompt = f"""
        You are a logistics expert. Extract ALL shipping information from this email.
        
        Extract these fields (return as JSON):
        - so_number: Sales order number (look for SO, Sales Order, order followed by numbers)
        - company_name: Customer/company name
        - contact_person: Contact person if mentioned
        - items: Array of items with description, quantity, unit
        - total_weight: Total weight with unit (e.g. "500 lbs", "226 kg")
        - pallet_count: Number of pallets
        - pallet_dimensions: Pallet size if mentioned
        - batch_numbers: Any batch/lot numbers mentioned
        - special_instructions: Any special handling notes
        - ship_date: When to ship
        - carrier: Shipping company if mentioned
        
        Email:
        {email_text}
        
        Return ONLY valid JSON, no explanations.
        """
        
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a logistics data extraction expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        
        result = response.choices[0].message.content.strip()
        if result.startswith('```'):
            result = result.split('\n', 1)[1].rsplit('\n```', 1)[0]
        
        return json.loads(result)
        
    except Exception as e:
        print(f"❌ GPT-4 parsing error: {e}")
        # Fallback to basic regex
        data = {'so_number': None}
        so_match = re.search(r'(?:sales\s*order|SO|S\.O\.|order)\s*#?\s*(\d+)', email_text, re.IGNORECASE)
        if so_match:
            data['so_number'] = so_match.group(1)
        return data

def get_so_data_from_system(so_number):
    """Get SO data by extracting from PDF file"""
    try:
        # Find the SO PDF file
        sales_orders_base = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
        matching_files = []
        
        for root, dirs, files in os.walk(sales_orders_base):
            for file in files:
                if file.lower().endswith('.pdf') and so_number in file:
                    matching_files.append(os.path.join(root, file))
        
        if not matching_files:
            return {"status": "Not found", "error": f"SO {so_number} PDF not found"}
        
        # Sort to get latest revision
        def get_revision_priority(filepath):
            filename = os.path.basename(filepath).lower()
            rev_match = re.search(r'_r(\d+)', filename)
            return int(rev_match.group(1)) if rev_match else 0
        
        matching_files.sort(key=get_revision_priority, reverse=True)
        so_file_path = matching_files[0]
        
        # Use the enhanced SO parsing function
        from app import extract_so_data_from_pdf
        enhanced_data = extract_so_data_from_pdf(so_file_path)
        
        if enhanced_data:
            enhanced_data['status'] = "Found in system"
            enhanced_data['file_path'] = so_file_path
            return enhanced_data
        else:
            return {"status": "Error", "error": "Could not parse PDF data"}
            
    except Exception as e:
        print(f"❌ Error in get_so_data_from_system: {e}")
        return {"status": "Error", "error": str(e)}

@logistics_bp.route('/api/logistics/process-email', methods=['POST'])
def process_email():
    """Process email content with GPT-4o and extract SO data"""
    try:
        data = request.get_json()
        email_content = data.get('email_content', '')
        
        if not email_content:
            return jsonify({'error': 'No email content provided'}), 400
        
        # Parse email with GPT-4o
        email_data = parse_email_with_gpt4(email_content)
        
        if not email_data.get('so_number'):
            return jsonify({'error': 'No SO number found in email', 'email_data': email_data}), 400
        
        so_number = email_data['so_number']
        
        # Get SO data from system
        so_data = get_so_data_from_system(so_number)
        
        if so_data.get('status') in ['Error', 'Not found']:
            return jsonify({'error': f"SO {so_number}: {so_data.get('error')}"}), 404
        
        # Prepare email shipping data
        email_shipping = {
            'weight': email_data.get('total_weight'),
            'pallet_info': {
                'count': email_data.get('pallet_count', 1),
                'dimensions': email_data.get('pallet_dimensions')
            },
            'batch_numbers': email_data.get('batch_numbers'),
            'pieces': email_data.get('pallet_count', 1),
            'carrier': email_data.get('carrier'),
            'special_instructions': email_data.get('special_instructions')
        }
        
        # Update items with batch numbers from email
        if email_data.get('batch_numbers') and so_data.get('items'):
            for item in so_data['items']:
                item['batch_number'] = email_data.get('batch_numbers', '')
        
        return jsonify({
            'success': True,
            'so_data': so_data,
            'email_data': email_data,
            'email_analysis': email_data,  # For backward compatibility
            'items': so_data.get('items', []),
            'email_shipping': email_shipping,
            'so_pdf_file': so_data.get('file_path'),
            'auto_detection': {
                'so_number': so_number,
                'filename': os.path.basename(so_data.get('file_path', '')),
                'file_path': so_data.get('file_path')
            }
        })
        
    except Exception as e:
        print(f"❌ Error processing email: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@logistics_bp.route('/api/logistics/generate-bol-html', methods=['POST'])
def generate_bol():
    """Generate BOL using GPT-4o populated template and convert to PDF"""
    try:
        data = request.get_json()
        so_data = data.get('so_data', {})
        email_shipping = data.get('email_shipping', {})
        
        # Use the existing BOL generator
        from bol_html_generator import generate_bol_html
        
        # Merge email shipping data
        enhanced_so_data = {**so_data}
        if email_shipping:
            enhanced_so_data['extracted_details'] = {
                'total_weight': email_shipping.get('weight'),
                'pallet_info': email_shipping.get('pallet_info'),
                'batch_numbers': email_shipping.get('batch_numbers')
            }
        
        html_content = generate_bol_html(enhanced_so_data, email_shipping)
        
        # Save the generated HTML
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        html_filename = f"BOL_SO{so_data.get('so_number', 'Unknown')}_{timestamp}.html"
        html_filepath = os.path.join('uploads', 'logistics', html_filename)
        
        os.makedirs(os.path.dirname(html_filepath), exist_ok=True)
        with open(html_filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return jsonify({
            'success': True,
            'filename': html_filename,
            'download_url': f'/download/logistics/{html_filename}'
        })
        
    except Exception as e:
        print(f"❌ Error generating BOL: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@logistics_bp.route('/api/logistics/generate-packing-slip', methods=['POST'])
def generate_packing_slip():
    """Generate Packing Slip HTML using actual template with GPT-4o"""
    try:
        data = request.get_json()
        so_data = data.get('so_data', {})
        email_shipping = data.get('email_shipping', {})
        items = data.get('items', [])
        
        from packing_slip_html_generator import generate_packing_slip_html
        html_content = generate_packing_slip_html(so_data, email_shipping, items)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"PackingSlip_SO{so_data.get('so_number', 'Unknown')}_{timestamp}.html"
        filepath = os.path.join('uploads', 'logistics', filename)
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return jsonify({
            'success': True,
            'packing_slip_file': filename,
            'download_url': f'/download/logistics/{filename}'
        })
        
    except Exception as e:
        print(f"❌ Error generating packing slip: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@logistics_bp.route('/api/logistics/generate-commercial-invoice', methods=['POST'])
def generate_commercial_invoice():
    """Generate Commercial Invoice HTML using actual template with GPT-4o"""
    try:
        data = request.get_json()
        so_data = data.get('so_data', {})
        items = data.get('items', [])
        
        from commercial_invoice_html_generator import generate_commercial_invoice_html
        html_content = generate_commercial_invoice_html(so_data, items)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"CommercialInvoice_SO{so_data.get('so_number', 'Unknown')}_{timestamp}.html"
        filepath = os.path.join('uploads', 'logistics', filename)
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return jsonify({
            'success': True,
            'commercial_invoice_file': filename,
            'download_url': f'/download/logistics/{filename}'
        })
        
    except Exception as e:
        print(f"❌ Error generating commercial invoice: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@logistics_bp.route('/download/logistics/<filename>')
def download_file(filename):
    """Serve HTML files for viewing/printing - perfect formatting guaranteed"""
    try:
        filepath = os.path.join('uploads', 'logistics', filename)
        if os.path.exists(filepath):
            # Serve HTML files inline (opens in browser for Ctrl+P)
            if filename.endswith('.html'):
                return send_file(filepath, mimetype='text/html')
            else:
                return send_file(filepath, as_attachment=True, download_name=filename)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
