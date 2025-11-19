#!/usr/bin/env python3
"""
Test script to verify the new system structure without requiring API keys
"""

import os
import sys

def test_file_structure():
    """Test that all files exist and have correct structure"""
    print("🔍 Testing file structure...")
    
    # Check backend file
    backend_file = "backend/logistics_automation.py"
    if os.path.exists(backend_file):
        with open(backend_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.count('\n') + 1
            print(f"✅ Backend file exists: {lines} lines")
            
            # Check for key functions
            if 'gpt4o_analyze_logistics' in content:
                print("✅ GPT-4o analysis function found")
            if 'gpt4o_generate_documents' in content:
                print("✅ GPT-4o document generation function found")
            if 'process_email_endpoint' in content:
                print("✅ Process email endpoint found")
            if 'generate_documents_endpoint' in content:
                print("✅ Generate documents endpoint found")
    else:
        print("❌ Backend file not found")
        return False
    
    # Check frontend file
    frontend_file = "frontend/src/components/LogisticsAutomation.tsx"
    if os.path.exists(frontend_file):
        with open(frontend_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.count('\n') + 1
            print(f"✅ Frontend file exists: {lines} lines")
            
            # Check for key components
            if 'processLogistics' in content:
                print("✅ Process logistics function found")
            if 'generateDocuments' in content:
                print("✅ Generate documents function found")
            if 'GPT-4o Vision' in content:
                print("✅ GPT-4o Vision references found")
    else:
        print("❌ Frontend file not found")
        return False
    
    return True

def test_code_reduction():
    """Test code reduction achieved"""
    print("\n🔍 Testing code reduction...")
    
    # Count lines in new backend
    backend_file = "backend/logistics_automation.py"
    if os.path.exists(backend_file):
        with open(backend_file, 'r', encoding='utf-8') as f:
            new_lines = len(f.readlines())
        print(f"✅ New backend: {new_lines} lines")
    
    # Count lines in new frontend
    frontend_file = "frontend/src/components/LogisticsAutomation.tsx"
    if os.path.exists(frontend_file):
        with open(frontend_file, 'r', encoding='utf-8') as f:
            new_frontend_lines = len(f.readlines())
        print(f"✅ New frontend: {new_frontend_lines} lines")
    
    total_new = new_lines + new_frontend_lines
    print(f"✅ Total new system: {total_new} lines")
    
    # Compare with original (from backup)
    backup_dir = "../Logistics_Backups_20250925"
    if os.path.exists(backup_dir):
        original_backend = os.path.join(backup_dir, "logistics_automation_BACKUP_20250925_210443.py")
        original_frontend = os.path.join(backup_dir, "LogisticsAutomation_BACKUP_20250925_210446.tsx")
        
        if os.path.exists(original_backend):
            with open(original_backend, 'r', encoding='utf-8') as f:
                original_backend_lines = len(f.readlines())
            print(f"📊 Original backend: {original_backend_lines} lines")
        
        if os.path.exists(original_frontend):
            with open(original_frontend, 'r', encoding='utf-8') as f:
                original_frontend_lines = len(f.readlines())
            print(f"📊 Original frontend: {original_frontend_lines} lines")
        
        total_original = original_backend_lines + original_frontend_lines
        reduction = ((total_original - total_new) / total_original) * 100
        
        print(f"📊 Original total: {total_original} lines")
        print(f"📊 New total: {total_new} lines")
        print(f"🎉 REDUCTION: {reduction:.1f}%")
        
        if reduction >= 90:
            print("✅ Excellent reduction achieved!")
        elif reduction >= 80:
            print("✅ Good reduction achieved!")
        else:
            print("⚠️ Reduction could be better")

def test_api_endpoints():
    """Test that API endpoints are properly defined"""
    print("\n🔍 Testing API endpoints...")
    
    backend_file = "backend/logistics_automation.py"
    if os.path.exists(backend_file):
        with open(backend_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        endpoints = [
            '/api/logistics/process-email',
            '/api/logistics/generate-documents',
            '/api/logistics/download/<filename>',
            '/health'
        ]
        
        for endpoint in endpoints:
            if endpoint in content:
                print(f"✅ Endpoint found: {endpoint}")
            else:
                print(f"❌ Endpoint missing: {endpoint}")

def main():
    """Run all structure tests"""
    print("🚀 Testing New GPT-4o Vision Logistics System Structure")
    print("=" * 60)
    
    # Test 1: File structure
    structure_ok = test_file_structure()
    
    # Test 2: Code reduction
    test_code_reduction()
    
    # Test 3: API endpoints
    test_api_endpoints()
    
    print("\n" + "=" * 60)
    if structure_ok:
        print("✅ System structure test PASSED!")
        print("\n📋 Next steps:")
        print("   1. Set OPENAI_API_KEY environment variable")
        print("   2. Start the server: python app.py")
        print("   3. Test with real data")
    else:
        print("❌ System structure test FAILED!")
        print("Please check the file structure and try again.")

if __name__ == "__main__":
    main()
