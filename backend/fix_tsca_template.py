#!/usr/bin/env python3
"""Fix TSCA template - prefill with Haron Alhakimi's info"""
from pypdf import PdfReader, PdfWriter
import os

template_path = 'templates/tsca/TSCA CERTIFICATION_UPDATED.pdf'
output_path = 'templates/tsca/TSCA CERTIFICATION_UPDATED_NEW.pdf'

reader = PdfReader(template_path)

print('=== ALL FORM FIELDS IN TSCA PDF ===')
fields = reader.get_fields()
if fields:
    for name, field in fields.items():
        value = field.get('/V', '')
        print(f'  Field: "{name}" = "{value}"')
else:
    print('No fields found')

# Now update the template with Haron's info
writer = PdfWriter()
writer.append(reader)

# Update ALL possible name/title/email fields with Haron's info
fields_to_prefill = {}
if fields:
    for name in fields.keys():
        name_lower = name.lower()
        if 'name' in name_lower and 'company' not in name_lower:
            fields_to_prefill[name] = 'Haron Alhakimi'
            print(f'  -> Setting "{name}" to "Haron Alhakimi"')
        elif 'title' in name_lower:
            fields_to_prefill[name] = 'Logistics Supervisor'
            print(f'  -> Setting "{name}" to "Logistics Supervisor"')
        elif 'email' in name_lower:
            fields_to_prefill[name] = 'haron@canoilcanadaltd.com'
            print(f'  -> Setting "{name}" to "haron@canoilcanadaltd.com"')

if fields_to_prefill:
    writer.update_page_form_field_values(writer.pages[0], fields_to_prefill)

# Save the updated template
with open(output_path, 'wb') as f:
    writer.write(f)

print(f'\n✅ Updated template saved to: {output_path}')
print('Now replacing original template...')

# Replace original with updated
import shutil
shutil.move(output_path, template_path)
print(f'✅ Template updated: {template_path}')

