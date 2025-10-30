#!/usr/bin/env python3
"""
Test script for ChatGPT integration with Canoil inventory system
Run this script to test the backend API endpoints
"""

import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5002"

def test_health_check():
    """Test if the backend is running"""
    print("🔍 Testing backend health check...")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend is healthy: {data['status']}")
            print(f"📁 Latest folder: {data['message']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to backend: {e}")
        print("\n💡 Make sure to start the backend first:")
        print("   cd backend")
        print("   python app.py")
        return False

def test_chat_query(query):
    """Test a ChatGPT query"""
    print(f"\n🤖 Testing query: '{query}'")
    try:
        response = requests.post(
            f"{BASE_URL}/api/chat",
            json={"query": query},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ ChatGPT Response:")
            print("-" * 50)
            print(data['response'])
            print("-" * 50)
            print(f"📊 Context: {data['data_context']['total_items']} items, {data['data_context']['active_orders']} active orders")
            return True
        else:
            print(f"❌ Chat query failed: {response.status_code}")
            print(response.text)
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Chat query error: {e}")
        return False

def test_item_analysis(item_name):
    """Test item analysis endpoint"""
    print(f"\n🔍 Testing item analysis for: '{item_name}'")
    try:
        response = requests.get(
            f"{BASE_URL}/api/item-analysis/{item_name}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'error' in data:
                print(f"⚠️ Item not found: {data['error']}")
            else:
                print("✅ Item Analysis:")
                print(f"   Current Stock: {data.get('current_stock', 'N/A')}")
                print(f"   Allocated: {data.get('allocated_quantity', 'N/A')}")
                print(f"   Available: {data.get('available_quantity', 'N/A')}")
                print(f"   Used in {len(data.get('used_in_boms', []))} BOMs")
                print(f"   Active usage in {len(data.get('active_usage', []))} MOs")
            return True
        else:
            print(f"❌ Item analysis failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Item analysis error: {e}")
        return False

def main():
    print("🚀 Canoil ChatGPT Integration Test")
    print("=" * 50)
    
    # Test backend health
    if not test_health_check():
        sys.exit(1)
    
    # Test sample queries
    sample_queries = [
        "How many items do we have in our inventory?",
        "Do we have enough CC Calcium Stearate Grease to make 10 cases?",
        "What manufacturing orders are currently active?",
        "Show me the top 5 most expensive items in inventory"
    ]
    
    print(f"\n🧪 Testing {len(sample_queries)} sample queries...")
    
    success_count = 0
    for query in sample_queries:
        if test_chat_query(query):
            success_count += 1
        print()  # Add spacing between tests
    
    # Test item analysis
    test_items = ["CC Calcium Stearate Grease", "HiTEC 60646", "FarmTek"]
    
    print(f"\n🔍 Testing item analysis for {len(test_items)} items...")
    
    for item in test_items:
        test_item_analysis(item)
        print()
    
    print("=" * 50)
    print(f"✅ Chat queries successful: {success_count}/{len(sample_queries)}")
    print("\n💡 If all tests pass, your ChatGPT integration is working correctly!")
    print("   You can now use the chat interface in your Canoil portal.")

if __name__ == "__main__":
    main()
