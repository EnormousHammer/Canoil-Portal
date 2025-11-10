"""
Preflight System Check for Canoil Portal Backend
Validates all dependencies and configurations before startup
"""

import os
import sys
import json
from pathlib import Path

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(message):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{message}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.RESET}\n")

def print_success(message):
    print(f"{Colors.GREEN}[OK] {message}{Colors.RESET}")

def print_error(message):
    print(f"{Colors.RED}[ERROR] {message}{Colors.RESET}")

def print_warning(message):
    print(f"{Colors.YELLOW}[WARN] {message}{Colors.RESET}")

def print_info(message):
    print(f"{Colors.BLUE}[INFO] {message}{Colors.RESET}")

def check_gdrive_access():
    """Check if G: Drive is accessible"""
    print_header("Checking G: Drive Access")
    
    gdrive_paths = [
        r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions",
        r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
    ]
    
    all_accessible = True
    for path in gdrive_paths:
        if os.path.exists(path):
            print_success(f"G: Drive accessible: {path}")
        else:
            print_error(f"G: Drive NOT accessible: {path}")
            all_accessible = False
    
    if not all_accessible:
        print_warning("Solution: Open Google Drive desktop app and ensure 'G:' drive is mounted")
    
    return all_accessible

def check_tokens():
    """Check if authentication tokens exist"""
    print_header("Checking Authentication Tokens")
    
    tokens = {
        "Google Drive API": "google_drive_token.pickle",
        "Gmail OAuth": "gmail_credentials/token.json"
    }
    
    all_exist = True
    for name, path in tokens.items():
        if os.path.exists(path):
            print_success(f"{name} token exists: {path}")
            
            # Check if token is valid (basic check)
            try:
                file_size = os.path.getsize(path)
                if file_size > 0:
                    print_info(f"  Token file size: {file_size} bytes")
                else:
                    print_warning(f"  Token file is empty!")
                    all_exist = False
            except Exception as e:
                print_warning(f"  Could not read token file: {e}")
        else:
            print_error(f"{name} token MISSING: {path}")
            all_exist = False
    
    if not all_exist:
        print_warning("Solution: Run backend - it will prompt for authentication")
    
    return all_exist

def check_environment_variables():
    """Check if required environment variables are set"""
    print_header("Checking Environment Variables")
    
    required_vars = {
        "OPENAI_API_KEY": "OpenAI API access",
        # Optional but recommended
        "USE_GOOGLE_DRIVE_API": "Google Drive API mode (optional)",
    }
    
    all_set = True
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # Don't print API keys, just confirm they exist
            if "KEY" in var or "SECRET" in var:
                print_success(f"{var} is SET ({description})")
            else:
                print_success(f"{var} = '{value}' ({description})")
        else:
            if var == "OPENAI_API_KEY":
                print_error(f"{var} is NOT SET ({description})")
                all_set = False
            else:
                print_warning(f"{var} is NOT SET ({description}) - OPTIONAL")
    
    if not all_set:
        print_warning("Solution for OPENAI_API_KEY:")
        print_info("  PowerShell: $env:OPENAI_API_KEY = 'sk-proj-your_key_here'")
        print_info("  CMD: set OPENAI_API_KEY=sk-proj-your_key_here")
        print_info("  Or set permanently in Windows Environment Variables")
    
    return all_set

def check_python_packages():
    """Check if required Python packages are installed"""
    print_header("Checking Python Packages")
    
    required_packages = [
        ("flask", "Flask"),
        ("flask_cors", "Flask-CORS"),
        ("openai", "OpenAI"),
        ("google.oauth2", "Google Auth"),
        ("googleapiclient", "Google API Client"),
    ]
    
    all_installed = True
    for module, name in required_packages:
        try:
            __import__(module)
            print_success(f"{name} is installed")
        except ImportError:
            print_error(f"{name} is NOT installed")
            all_installed = False
    
    if not all_installed:
        print_warning("Solution: pip install -r requirements.txt")
    
    return all_installed

def check_backend_port():
    """Check if backend port is available"""
    print_header("Checking Backend Port")
    
    import socket
    port = 5002
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    
    if result == 0:
        print_warning(f"Port {port} is already in use (backend may be running)")
        return True
    else:
        print_success(f"Port {port} is available")
        return True

def check_data_folders():
    """Check if data folders have recent files"""
    print_header("Checking Data Freshness")
    
    gdrive_base = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
    
    if not os.path.exists(gdrive_base):
        print_warning("Cannot check data freshness - G: Drive not accessible")
        return False
    
    try:
        # Check for folders
        folders = [f for f in os.listdir(gdrive_base) if os.path.isdir(os.path.join(gdrive_base, f))]
        folders.sort(reverse=True)
        
        if folders:
            latest_folder = folders[0]
            print_success(f"Latest data folder: {latest_folder}")
            
            # Check folder contents
            folder_path = os.path.join(gdrive_base, latest_folder)
            files = [f for f in os.listdir(folder_path) if f.endswith('.json')]
            print_info(f"  Found {len(files)} JSON files")
            
            return True
        else:
            print_warning("No data folders found")
            return False
    except Exception as e:
        print_error(f"Error checking data folders: {e}")
        return False

def run_all_checks():
    """Run all preflight checks"""
    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"  CANOIL PORTAL BACKEND - PREFLIGHT CHECK")
    print(f"{'='*60}{Colors.RESET}\n")
    
    results = {
        "G: Drive Access": check_gdrive_access(),
        "Authentication Tokens": check_tokens(),
        "Environment Variables": check_environment_variables(),
        "Python Packages": check_python_packages(),
        "Backend Port": check_backend_port(),
        "Data Freshness": check_data_folders()
    }
    
    # Summary
    print_header("Preflight Check Summary")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for check, status in results.items():
        if status:
            print_success(f"{check}: PASSED")
        else:
            print_error(f"{check}: FAILED")
    
    print(f"\n{Colors.BOLD}Overall: {passed}/{total} checks passed{Colors.RESET}\n")
    
    if passed == total:
        print_success("*** All systems ready! You can start the backend. ***")
        return True
    elif passed >= total - 1:
        print_warning("*** Most systems ready - backend should work with minor issues ***")
        return True
    else:
        print_error("*** Critical issues detected - fix them before starting backend ***")
        return False

if __name__ == '__main__':
    try:
        success = run_all_checks()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}[CANCELLED] Check cancelled by user{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}[ERROR] Unexpected error during preflight check: {e}{Colors.RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

