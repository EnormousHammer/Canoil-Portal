"""
Google Drive API Service
Connects directly to Google Drive to access shared drive data
"""

import os
import json
import pickle
from datetime import datetime
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.service_account import Credentials as ServiceAccountCredentials

# Google Drive API scopes
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]

# Shared Drive folder paths - can be overridden by environment variables
SHARED_DRIVE_NAME = os.getenv('GOOGLE_DRIVE_SHARED_DRIVE_NAME', "IT_Automation")  # The shared drive name
BASE_FOLDER_PATH = os.getenv('GOOGLE_DRIVE_BASE_FOLDER_PATH', "MiSys/Misys Extracted Data/API Extractions")  # Path within shared drive
SALES_ORDERS_PATH = os.getenv('GOOGLE_DRIVE_SALES_ORDERS_PATH', "Sales_CSR/Customer Orders/Sales Orders")  # Sales orders path

# Print paths safely - wrap in try/except to prevent import failures
try:
    print(f"[INFO] Google Drive paths: SHARED_DRIVE_NAME={SHARED_DRIVE_NAME}, BASE_FOLDER_PATH={BASE_FOLDER_PATH}, SALES_ORDERS_PATH={SALES_ORDERS_PATH}")
except Exception as e:
    print(f"[WARN] Error printing Google Drive paths: {e}")

class GoogleDriveService:
    def __init__(self, credentials_file='backend/google_drive_credentials.json', token_file='backend/google_drive_token.pickle'):
        # Check if credentials file exists, if not check for Gmail credentials as fallback
        if not os.path.exists(credentials_file):
            # Try Gmail credentials location (might be same OAuth client)
            gmail_creds = Path(__file__).parent / 'gmail_credentials' / 'credentials.json'
            if os.path.exists(str(gmail_creds)):
                print("[WARN] Using Gmail credentials.json for Google Drive (same OAuth client)")
                self.credentials_file = str(gmail_creds)
            else:
                self.credentials_file = credentials_file
        else:
            self.credentials_file = credentials_file
        self.token_file = token_file
        self.service = None
        self.authenticated = False
        
    def authenticate(self):
        """Authenticate and build Google Drive API service"""
        creds = None
        
        # 0) Prefer Service Account if configured (no OAuth consent, stable in server environments)
        try:
            sa_json_env = os.getenv('GOOGLE_DRIVE_SA_JSON') or os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
            sa_json_path = Path(os.getenv('GOOGLE_DRIVE_SA_FILE', 'backend/google_service_account.json'))
            
            if sa_json_env:
                try:
                    sa_info = json.loads(sa_json_env)
                    creds = ServiceAccountCredentials.from_service_account_info(sa_info, scopes=SCOPES)
                    self.service = build('drive', 'v3', credentials=creds)
                    self.authenticated = True
                    print("[OK] Google Drive API authenticated successfully using Service Account (env)")
                    return True
                except Exception as e:
                    print(f"[WARN] Service Account (env) failed: {e}")
            
            if not creds and sa_json_path.exists():
                try:
                    with open(sa_json_path, 'r', encoding='utf-8') as f:
                        sa_info = json.load(f)
                    creds = ServiceAccountCredentials.from_service_account_info(sa_info, scopes=SCOPES)
                    self.service = build('drive', 'v3', credentials=creds)
                    self.authenticated = True
                    print("[OK] Google Drive API authenticated successfully using Service Account (file)")
                    return True
                except Exception as e:
                    print(f"[WARN] Service Account (file) failed: {e}")
        except Exception as e:
            print(f"[WARN] Service Account auth check failed: {e}")
        
        # Try loading token from environment variable first (for Vercel/serverless)
        token_env = os.getenv('GOOGLE_DRIVE_TOKEN')
        if token_env:
            try:
                token_dict = json.loads(token_env)
                # If token doesn't have client_id/client_secret, get from credentials
                if 'client_id' not in token_dict or 'client_secret' not in token_dict:
                    google_creds_env = os.getenv('GOOGLE_DRIVE_CREDENTIALS')
                    if google_creds_env:
                        try:
                            creds_dict = json.loads(google_creds_env)
                            # Extract client_id and client_secret from credentials
                            if 'installed' in creds_dict:
                                token_dict['client_id'] = creds_dict['installed'].get('client_id')
                                token_dict['client_secret'] = creds_dict['installed'].get('client_secret')
                            elif 'web' in creds_dict:
                                token_dict['client_id'] = creds_dict['web'].get('client_id')
                                token_dict['client_secret'] = creds_dict['web'].get('client_secret')
                            print("[OK] Added client_id/client_secret from GOOGLE_DRIVE_CREDENTIALS")
                        except Exception as e:
                            print(f"[WARN] Could not extract client credentials: {e}")
                
                creds = Credentials.from_authorized_user_info(token_dict, SCOPES)
                print("[OK] Loaded Google Drive token from environment variable")
            except Exception as e:
                print(f"[WARN] Error loading token from environment: {e}")
                import traceback
                traceback.print_exc()
                creds = None
        
        # Fallback: Load token from file if available
        if not creds and os.path.exists(self.token_file):
            try:
                with open(self.token_file, 'rb') as token:
                    creds = pickle.load(token)
                print("[OK] Loaded Google Drive token from file")
            except Exception as e:
                print(f"[WARN] Error loading token from file: {e}")
                creds = None
        
        # If no valid credentials, get new ones
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    print("[OK] Refreshed expired Google Drive token")
                except Exception as e:
                    print(f"[WARN] Failed to refresh token: {e}")
                    creds = None
            
            # If still no valid creds, need to authenticate
            if not creds or not creds.valid:
                # On Vercel/serverless, we can't run OAuth flow - need token from env var
                is_serverless = os.getenv('VERCEL') or os.getenv('GOOGLE_DRIVE_TOKEN')
                if is_serverless:
                    error_msg = (
                        "[ERROR] Google Drive authentication failed on serverless.\n"
                        "Token is missing or expired and cannot be refreshed.\n"
                        "Solution: Get a fresh token locally and set GOOGLE_DRIVE_TOKEN in Vercel.\n"
                        "Run 'python get_vercel_env_vars.py' locally to extract token."
                    )
                    print(error_msg)
                    raise ValueError(error_msg)
                
                # Check for credentials in environment variable (for Render/deployment)
                google_creds_env = os.getenv('GOOGLE_DRIVE_CREDENTIALS')
                if google_creds_env:
                    # Use credentials from environment variable (deployment)
                    try:
                        creds_dict = json.loads(google_creds_env)
                        flow = InstalledAppFlow.from_client_secrets_dict(creds_dict, SCOPES)
                        # For deployment, we need to handle OAuth flow differently
                        # This will require manual auth URL generation
                        print("[WARN] Using credentials from environment variable")
                        print("[WARN] First-time authentication required - check logs for auth URL")
                        # For now, we'll still use local server if possible
                        creds = flow.run_local_server(port=0)
                    except Exception as e:
                        print(f"[ERROR] Error using environment credentials: {e}")
                        raise
                elif os.path.exists(self.credentials_file):
                    # Use credentials file (local development)
                    flow = InstalledAppFlow.from_client_secrets_file(
                        self.credentials_file, SCOPES)
                    creds = flow.run_local_server(port=0)
                else:
                    raise FileNotFoundError(
                        f"Credentials not found: {self.credentials_file}\n"
                        "Please download OAuth 2.0 credentials from Google Cloud Console\n"
                        "Or set GOOGLE_DRIVE_CREDENTIALS environment variable"
                    )
            
            # Save credentials for next run (try file first, then env var hint)
            try:
                # Try to save to file (works on Render, not on Vercel serverless)
                with open(self.token_file, 'wb') as token:
                    pickle.dump(creds, token)
                print("[OK] Saved Google Drive token to file")
            except Exception as e:
                print(f"[WARN] Could not save token to file (serverless?): {e}")
                print("[TIP] For Vercel/serverless, save token JSON to GOOGLE_DRIVE_TOKEN env var")
                # Save token info to environment variable format (user can copy this)
                if hasattr(creds, 'to_json'):
                    token_json = creds.to_json()
                    print(f"[TIP] Token JSON (save to GOOGLE_DRIVE_TOKEN env var):")
                    print(token_json[:200] + "..." if len(token_json) > 200 else token_json)
        
        self.service = build('drive', 'v3', credentials=creds)
        self.authenticated = True
        print("[OK] Google Drive API authenticated successfully")
        return True
    
    def find_shared_drive(self, drive_name):
        """Find a shared drive by name"""
        try:
            drives = self.service.drives().list().execute()
            all_drives = drives.get('drives', [])
            print(f"[INFO] Searching for shared drive '{drive_name}' among {len(all_drives)} drives")
            
            # List all available drives for debugging
            if all_drives:
                print(f"[INFO] Available shared drives:")
                for drive in all_drives:
                    print(f"   - {drive.get('name')} (ID: {drive.get('id')})")
            
            # Try exact match first
            for drive in all_drives:
                if drive.get('name') == drive_name:
                    print(f"[OK] Found shared drive: {drive_name} (ID: {drive['id']})")
                    return drive['id']
            
            # Try case-insensitive match
            for drive in all_drives:
                if drive.get('name', '').lower() == drive_name.lower():
                    print(f"[OK] Found shared drive (case-insensitive): {drive.get('name')} (ID: {drive['id']})")
                    return drive['id']
            
            # Try partial match
            for drive in all_drives:
                if drive_name.lower() in drive.get('name', '').lower():
                    print(f"[OK] Found shared drive (partial match): {drive.get('name')} (ID: {drive['id']})")
                    return drive['id']
            
            print(f"[WARN] Shared drive '{drive_name}' not found")
            return None
        except HttpError as error:
            print(f"[ERROR] Error finding shared drive: {error}")
            return None
    
    def find_folder_by_path(self, drive_id, folder_path):
        """Find a folder by path within a shared drive"""
        path_parts = [p for p in folder_path.split('/') if p]  # Remove empty parts
        current_id = drive_id
        
        for folder_name in path_parts:
            try:
                query = f"name='{folder_name}' and '{current_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
                results = self.service.files().list(
                    q=query,
                    corpora='drive',
                    driveId=drive_id,
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                    fields="files(id, name)"
                ).execute()
                
                folders = results.get('files', [])
                if folders:
                    current_id = folders[0]['id']
                    print(f"[OK] Found folder: {folder_name} (ID: {current_id})")
                else:
                    print(f"[ERROR] Folder not found: {folder_name}")
                    return None
            except HttpError as error:
                print(f"[ERROR] Error finding folder {folder_name}: {error}")
                return None
        
        return current_id
    
    def get_latest_folder(self, parent_folder_id, drive_id=None):
        """Get the latest folder (by name/date) from parent folder"""
        try:
            query = f"'{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            list_params = {
                'q': query,
                'orderBy': 'name desc',
                'pageSize': 10,
                'fields': "files(id, name, createdTime, modifiedTime)"
            }
            
            # Add shared drive parameters if drive_id is provided
            if drive_id:
                list_params['corpora'] = 'drive'
                list_params['driveId'] = drive_id
                list_params['includeItemsFromAllDrives'] = True
                list_params['supportsAllDrives'] = True
            
            results = self.service.files().list(**list_params).execute()
            
            folders = results.get('files', [])
            if folders:
                latest = folders[0]
                print(f"[OK] Latest folder: {latest['name']} (ID: {latest['id']})")
                return latest['id'], latest['name']
            else:
                print("[ERROR] No folders found")
                return None, None
        except HttpError as error:
            print(f"[ERROR] Error getting latest folder: {error}")
            return None, None
    
    def download_file(self, file_id, file_name):
        """Download a file from Google Drive with retry logic for SSL errors"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                request = self.service.files().get_media(fileId=file_id)
                file_content = request.execute()
                
                # Parse JSON if it's a JSON file
                if file_name.endswith('.json'):
                    try:
                        return json.loads(file_content.decode('utf-8'))
                    except json.JSONDecodeError:
                        return []
                
                return file_content
            except HttpError as error:
                print(f"[ERROR] Error downloading file {file_name}: {error}")
                return None
            except Exception as error:
                # Catch SSL errors and other exceptions
                error_str = str(error)
                if attempt < max_retries - 1:
                    print(f"[WARN] SSL/Network error downloading {file_name} (attempt {attempt + 1}/{max_retries}): {error_str}")
                    import time as time_module
                    time_module.sleep(1)  # Wait 1 second before retry
                    continue
                else:
                    print(f"[ERROR] Failed to download {file_name} after {max_retries} attempts: {error_str}")
                    return None
        return None
    
    def load_folder_data(self, folder_id, drive_id=None):
        """Load all JSON files from a folder"""
        try:
            # Find all JSON files (either JSON mime type or files ending in .json)
            query = f"('{folder_id}' in parents) and (mimeType='application/json' or name contains '.json') and trashed=false"
            list_params = {
                'q': query,
                'supportsAllDrives': True,
                'includeItemsFromAllDrives': True,
                'fields': "files(id, name, mimeType, modifiedTime)"
            }
            
            # Add shared drive parameters if drive_id is provided
            if drive_id:
                list_params['corpora'] = 'drive'
                list_params['driveId'] = drive_id
            
            results = self.service.files().list(**list_params).execute()
            
            files = results.get('files', [])
            data = {}
            
            for file_info in files:
                file_id = file_info['id']
                file_name = file_info['name']
                print(f"[INFO] Downloading: {file_name}")
                file_data = self.download_file(file_id, file_name)
                if file_data is not None:
                    data[file_name] = file_data
                else:
                    data[file_name] = []  # Fallback to empty array
            
            return data
        except HttpError as error:
            print(f"[ERROR] Error loading folder data: {error}")
            return {}
    
    def download_file_content(self, file_id, mime_type=None):
        """Download file content from Google Drive (for PDFs, DOCX, etc.)"""
        try:
            request = self.service.files().get_media(fileId=file_id)
            file_content = request.execute()
            return file_content
        except HttpError as error:
            print(f"[ERROR] Error downloading file {file_id}: {error}")
            return None
    
    def _scan_folder_recursively(self, folder_id, folder_name, drive_id, depth=0, max_depth=3):
        """Recursively scan a folder and all its subfolders for PDF/DOCX files
        
        Returns: dict with structure {subfolder_path: [files]}
        """
        all_files_by_folder = {}
        
        if depth > max_depth:
            return all_files_by_folder
        
        try:
            # Get all PDF/DOCX files in current folder
            query = f"'{folder_id}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or name contains '.pdf' or name contains '.docx') and trashed=false"
            file_list_params = {
                'q': query,
                'includeItemsFromAllDrives': True,
                'supportsAllDrives': True,
                'orderBy': 'modifiedTime desc',
                'pageSize': 100,  # Get more files per folder
                'fields': "files(id, name, mimeType, modifiedTime)"
            }
            
            if drive_id:
                file_list_params['corpora'] = 'drive'
                file_list_params['driveId'] = drive_id
            
            file_results = self.service.files().list(**file_list_params).execute()
            files = file_results.get('files', [])
            
            # Add files from current folder
            if files:
                current_folder_files = []
                for file_info in files:
                    current_folder_files.append({
                        'file_id': file_info['id'],
                        'file_name': file_info['name'],
                        'folder': folder_name,
                        'folder_path': folder_name,
                        'modified_time': file_info.get('modifiedTime', ''),
                        'mime_type': file_info.get('mimeType', '')
                    })
                all_files_by_folder[folder_name] = current_folder_files
                print(f"[INFO] Found {len(current_folder_files)} files in {folder_name}")
            
            # Get all subfolders and scan them recursively
            query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            list_params = {
                'q': query,
                'includeItemsFromAllDrives': True,
                'supportsAllDrives': True,
                'fields': "files(id, name)",
                'pageSize': 100
            }
            
            if drive_id:
                list_params['corpora'] = 'drive'
                list_params['driveId'] = drive_id
            
            results = self.service.files().list(**list_params).execute()
            subfolders = results.get('files', [])
            
            for subfolder in subfolders:
                subfolder_id = subfolder['id']
                subfolder_name = subfolder['name']
                full_path = f"{folder_name}/{subfolder_name}" if folder_name else subfolder_name
                print(f"[INFO] Scanning subfolder: {full_path} (depth: {depth})")
                
                # Recursively scan subfolder
                subfolder_files_dict = self._scan_folder_recursively(subfolder_id, full_path, drive_id, depth + 1, max_depth)
                # Merge subfolder files into main dict
                all_files_by_folder.update(subfolder_files_dict)
            
            return all_files_by_folder
            
        except Exception as e:
            print(f"[WARN] Error scanning folder {folder_name}: {e}")
            import traceback
            traceback.print_exc()
            return all_files_by_folder
    
    def load_sales_orders_data(self, drive_id):
        """Load sales orders data from Google Drive - SCANS ALL FOLDERS UNDER Customer Orders
        
        Note: drive_id parameter is ignored - we always search for Sales_CSR as a separate drive
        Scans: Sales Orders, Purchase Orders, and ALL their subfolders recursively
        """
        print(f"[INFO] ===== STARTING load_sales_orders_data =====")
        try:
            # Sales_CSR is ALWAYS a separate shared drive, NOT a folder within IT_Automation
            # Ignore the drive_id parameter and search for Sales_CSR independently
            print(f"[INFO] Searching for Sales_CSR as separate shared drive (ignoring IT_Automation drive_id)")
            
            sales_orders_drive_id = None
            customer_orders_folder_id = None
            
            # Check if Sales_CSR is a separate shared drive
            print(f"[INFO] Calling find_shared_drive('Sales_CSR')...")
            sales_csr_drive_id = self.find_shared_drive("Sales_CSR")
            print(f"[INFO] find_shared_drive returned: {sales_csr_drive_id}")
            
            if sales_csr_drive_id:
                print(f"[OK] Found Sales_CSR as separate shared drive (ID: {sales_csr_drive_id})")
                # Find "Customer Orders" folder (parent of both Sales Orders and Purchase Orders)
                print(f"[INFO] Searching for 'Customer Orders' folder in Sales_CSR drive...")
                customer_orders_folder_id = self.find_folder_by_path(sales_csr_drive_id, "Customer Orders")
                print(f"[INFO] find_folder_by_path returned: {customer_orders_folder_id}")
                sales_orders_drive_id = sales_csr_drive_id
            else:
                # Sales_CSR not found - don't try fallback to IT_Automation
                print(f"[ERROR] Sales_CSR not found as separate shared drive - skipping sales orders")
                print(f"[TIP] Sales_CSR must be a separate shared drive, not a folder within {SHARED_DRIVE_NAME}")
                return {}
            
            if not customer_orders_folder_id:
                print("[WARN] Customer Orders folder not found, skipping")
                return {}
            
            print(f"[INFO] Loading ALL orders from Customer Orders (Sales Orders + Purchase Orders + all subfolders)")
            
            sales_orders_data = {
                'SalesOrders.json': [],
                'SalesOrdersByStatus': {},
                'PurchaseOrdersByStatus': {},
                'TotalOrders': 0,
                'TotalSalesOrders': 0,
                'TotalPurchaseOrders': 0,
                'StatusFolders': [],
                'ScanMethod': 'Google Drive API - Recursive Scan'
            }
            
            # Get all folders under Customer Orders (Sales Orders, Purchase Orders, etc.)
            query = f"'{customer_orders_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            list_params = {
                'q': query,
                'includeItemsFromAllDrives': True,
                'supportsAllDrives': True,
                'fields': "files(id, name)",
                'pageSize': 100
            }
            
            if sales_orders_drive_id:
                list_params['corpora'] = 'drive'
                list_params['driveId'] = sales_orders_drive_id
            
            results = self.service.files().list(**list_params).execute()
            customer_order_folders = results.get('files', [])
            
            print(f"[INFO] Found {len(customer_order_folders)} folders under Customer Orders: {[f['name'] for f in customer_order_folders]}")
            
            # Scan each folder under Customer Orders (Sales Orders, Purchase Orders, etc.)
            for order_folder in customer_order_folders:
                folder_id = order_folder['id']
                folder_name = order_folder['name']
                print(f"[INFO] Scanning folder: {folder_name}")
                
                # Recursively scan this folder and all its subfolders
                # Returns dict: {subfolder_path: [files]}
                files_by_subfolder = self._scan_folder_recursively(folder_id, folder_name, sales_orders_drive_id, depth=0, max_depth=3)
                
                if files_by_subfolder:
                    # Organize by folder type and subfolder structure
                    if 'Sales' in folder_name or 'sales' in folder_name.lower():
                        # Add each subfolder's files to SalesOrdersByStatus
                        # Extract just the subfolder name (not full path) for frontend compatibility
                        for subfolder_path, files in files_by_subfolder.items():
                            # Extract just the subfolder name (e.g., "Sales Orders/New and Revised" -> "New and Revised")
                            subfolder_name = subfolder_path.split('/')[-1] if '/' in subfolder_path else subfolder_path
                            # If it's the parent folder itself, use the folder name
                            if subfolder_path == folder_name:
                                subfolder_name = folder_name
                            
                            # Use subfolder name as key (frontend expects simple names like "New and Revised")
                            if subfolder_name not in sales_orders_data['SalesOrdersByStatus']:
                                sales_orders_data['SalesOrdersByStatus'][subfolder_name] = []
                            sales_orders_data['SalesOrdersByStatus'][subfolder_name].extend(files)
                            sales_orders_data['TotalSalesOrders'] += len(files)
                        print(f"[OK] Found {sum(len(files) for files in files_by_subfolder.values())} sales order files in {folder_name} across {len(files_by_subfolder)} subfolders")
                    elif 'Purchase' in folder_name or 'purchase' in folder_name.lower():
                        # Add each subfolder's files to PurchaseOrdersByStatus
                        for subfolder_path, files in files_by_subfolder.items():
                            # Extract just the subfolder name
                            subfolder_name = subfolder_path.split('/')[-1] if '/' in subfolder_path else subfolder_path
                            if subfolder_path == folder_name:
                                subfolder_name = folder_name
                            
                            if subfolder_name not in sales_orders_data['PurchaseOrdersByStatus']:
                                sales_orders_data['PurchaseOrdersByStatus'][subfolder_name] = []
                            sales_orders_data['PurchaseOrdersByStatus'][subfolder_name].extend(files)
                            sales_orders_data['TotalPurchaseOrders'] += len(files)
                        print(f"[OK] Found {sum(len(files) for files in files_by_subfolder.values())} purchase order files in {folder_name} across {len(files_by_subfolder)} subfolders")
                    else:
                        # Other folders under Customer Orders
                        for subfolder_path, files in files_by_subfolder.items():
                            subfolder_name = subfolder_path.split('/')[-1] if '/' in subfolder_path else subfolder_path
                            if subfolder_path == folder_name:
                                subfolder_name = folder_name
                            
                            if subfolder_name not in sales_orders_data['SalesOrdersByStatus']:
                                sales_orders_data['SalesOrdersByStatus'][subfolder_name] = []
                            sales_orders_data['SalesOrdersByStatus'][subfolder_name].extend(files)
                            sales_orders_data['TotalOrders'] += len(files)
                        print(f"[OK] Found {sum(len(files) for files in files_by_subfolder.values())} files in {folder_name} across {len(files_by_subfolder)} subfolders")
            
            # Calculate totals
            sales_orders_data['TotalOrders'] = sales_orders_data['TotalSalesOrders'] + sales_orders_data['TotalPurchaseOrders']
            
            # Collect all status folders
            all_status_folders = []
            for folder_name, files in sales_orders_data['SalesOrdersByStatus'].items():
                all_status_folders.append(folder_name)
            sales_orders_data['StatusFolders'] = all_status_folders
            
            print(f"[OK] Total orders found: {sales_orders_data['TotalOrders']} (Sales: {sales_orders_data['TotalSalesOrders']}, Purchase: {sales_orders_data['TotalPurchaseOrders']})")
            return sales_orders_data
            
        except Exception as e:
            print(f"[WARN] Error loading sales orders: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def get_all_data(self):
        """Main method to get all data from Google Drive"""
        if not self.authenticated:
            self.authenticate()
        
        # Find the shared drive
        drive_id = self.find_shared_drive(SHARED_DRIVE_NAME)
        if not drive_id:
            return None, "Shared drive not found"
        
        # Find the base folder
        base_folder_id = self.find_folder_by_path(drive_id, BASE_FOLDER_PATH)
        if not base_folder_id:
            return None, "Base folder not found"
        
        # Get latest folder
        latest_folder_id, latest_folder_name = self.get_latest_folder(base_folder_id, drive_id)
        if not latest_folder_id:
            return None, "No latest folder found"
        
        # Load all JSON files from latest folder
        data = self.load_folder_data(latest_folder_id, drive_id)
        
        # Load sales orders data (don't let errors break the main data loading)
        print(f"[INFO] ===== ATTEMPTING TO LOAD SALES ORDERS DATA =====")
        try:
            sales_orders_data = self.load_sales_orders_data(drive_id)
            print(f"[INFO] load_sales_orders_data returned: {type(sales_orders_data)}, keys: {list(sales_orders_data.keys()) if isinstance(sales_orders_data, dict) else 'not a dict'}")
            if sales_orders_data:
                data.update(sales_orders_data)
                print(f"[OK] Successfully added sales orders data to main data")
            else:
                print(f"[INFO] No sales orders data returned (empty dict or None)")
        except Exception as e:
            print(f"[ERROR] Exception loading sales orders data (non-fatal): {e}")
            import traceback
            traceback.print_exc()
            # Continue without sales orders data - don't break the main data loading
        
        folder_info = {
            "folderName": latest_folder_name,
            "syncDate": datetime.now().isoformat(),
            "lastModified": datetime.now().isoformat(),
            "folder": latest_folder_name,
            "created": datetime.now().isoformat(),
            "size": "N/A",
            "fileCount": len(data)
        }
        
        return data, folder_info

