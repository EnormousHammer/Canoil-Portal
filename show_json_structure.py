import json

with open('CANOIL_PRODUCT_CUSTOMER_LIST_20251201_184301.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 70)
print("JSON STRUCTURE OVERVIEW")
print("=" * 70)

print("\n📊 METADATA:")
print(f"  Generated: {data['metadata']['generated']}")
print(f"  Total Products: {data['metadata']['total_products']}")
print(f"  Total Customers: {data['metadata']['total_customers']}")

print("\n📦 PRODUCTS ORGANIZATION:")
print(f"  • All products: {len(data['products']['all'])}")
print(f"  • Grouped by packaging: {len(data['products']['by_packaging'])} different packaging types")
print(f"  • Grouped by item type: {len(data['products']['by_type'])} types")
print(f"  • Grouped by status: {len(data['products']['by_status'])} statuses")

print("\n📋 SAMPLE: Products by Packaging (first 5 types):")
for i, (pkg, products) in enumerate(list(data['products']['by_packaging'].items())[:5]):
    print(f"  {i+1}. {pkg}: {len(products)} products")
    if products:
        print(f"     Example: {products[0]['Item No.']} - {products[0]['Description'][:50]}")

print("\n👥 CUSTOMERS ORGANIZATION:")
print(f"  • All customers: {len(data['customers']['all'])}")
print(f"  • High volume (50+ orders): {data['customers']['by_volume']['high_volume']['count']}")
print(f"  • Medium volume (10-49 orders): {data['customers']['by_volume']['medium_volume']['count']}")
print(f"  • Low volume (1-9 orders): {data['customers']['by_volume']['low_volume']['count']}")

print("\n🏆 TOP 5 HIGH VOLUME CUSTOMERS:")
for i, customer in enumerate(data['customers']['by_volume']['high_volume']['customers'][:5], 1):
    print(f"  {i}. {customer['Customer Name']}: {customer['Total Orders']} orders")

print("\n📈 STATISTICS:")
stats = data['customers']['statistics']
print(f"  • Total orders across all customers: {stats['total_orders']}")
print(f"  • Average orders per customer: {stats['average_orders_per_customer']}")
print(f"  • Customers with 10+ orders: {stats['customers_with_10_plus_orders']}")

print("\n📦 PACKAGING TYPES (sample):")
pkg_types = data['products']['packaging_types'][:15]
print(f"  {', '.join(pkg_types)}...")

print("\n" + "=" * 70)
print("✅ JSON file is well-organized with hierarchical structure!")
print("=" * 70)



















