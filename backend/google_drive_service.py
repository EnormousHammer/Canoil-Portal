"""
Google Drive API Service
Connects directly to Google Drive to access shared drive data
"""

import os
import json
import pickle
import time
import functools
from datetime import datetime
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
import google_auth_httplib2
import httplib2

def retry_on_error(max_retries=5, delay=2, backoff=2):
    """Decorator to retry functions on network/SSL errors"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    error_str = str(e).lower()
                    # Only retry on network/SSL errors, not auth or permission errors
                    if any(x in error_str for x in ['ssl', 'timeout', 'connection', 'network', 'reset', 'broken pipe', 'record layer']):
                        wait_time = delay * (backoff ** attempt)
                        print(f"[WARN] {func.__name__} failed (attempt {attempt + 1}/{max_retries}): {e}")
                        if attempt < max_retries - 1:
                            print(f"[INFO] Retrying in {wait_time}s...")
                            time.sleep(wait_time)
                    else:
                        # Non-retryable error, raise immediately
                        raise
            print(f"[ERROR] {func.__name__} failed after {max_retries} attempts")
            raise last_error
        return wrapper
    return decorator

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
        self.shared_drive_id = None  # Will be set when shared drive is found
        self._credentials = None  # Store credentials for fresh service creation
    
    def _get_fresh_service(self):
        """Create a fresh Drive service with new HTTP connection to avoid SSL issues"""
        if not self._credentials:
            return self.service
        # Disable persistent connections to avoid SSL stale connection issues
        http = httplib2.Http(disable_ssl_certificate_validation=False)
        http.follow_redirects = True
        authorized_http = google_auth_httplib2.AuthorizedHttp(self._credentials, http=http)
        return build('drive', 'v3', http=authorized_http, cache_discovery=False)
        
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
                    self._credentials = creds  # Store for fresh service creation
                    # Use fresh httplib2.Http() for each build to avoid SSL connection reuse issues
                    http = google_auth_httplib2.AuthorizedHttp(creds, http=httplib2.Http())
                    self.service = build('drive', 'v3', http=http, cache_discovery=False)
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
                    # Use fresh httplib2.Http() for each build to avoid SSL connection reuse issues
                    http = google_auth_httplib2.AuthorizedHttp(creds, http=httplib2.Http())
                    self.service = build('drive', 'v3', http=http, cache_discovery=False)
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
                    print("[INFO] Token expired, attempting to refresh...")
                    creds.refresh(Request())
                    print("[OK]  Successfully refreshed expired Google Drive token")
                    
                    # Save refreshed token immediately
                    try:
                        with open(self.token_file, 'wb') as token:
                            pickle.dump(creds, token)
                        print("[OK] Saved refreshed token to file")
                    except Exception as save_error:
                        print(f"[WARN] Could not save refreshed token: {save_error}")
                        
                except Exception as e:
                    print(f"[ERROR]  Failed to refresh token: {e}")
                    print(f"[ERROR] Token refresh failed - deleting invalid token file")
                    
                    # Delete invalid token file to force re-authentication
                    try:
                        if os.path.exists(self.token_file):
                            os.remove(self.token_file)
                            print("[OK] Deleted invalid token file")
                    except Exception as del_error:
                        print(f"[WARN] Could not delete token file: {del_error}")
                    
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
        
        self.service = build('drive', 'v3', credentials=creds, cache_discovery=False)
        self.authenticated = True
        print("[OK] Google Drive API authenticated successfully")
        return True
    
    @retry_on_error(max_retries=3, delay=1, backoff=2)
    def find_shared_drive(self, drive_name):
        """Find a shared drive by name"""
        import time
        max_retries = 3
        service = self._get_fresh_service()  # Fresh connection
        for attempt in range(max_retries):
            try:
                print(f"[INFO] Attempt {attempt + 1}/{max_retries} to list shared drives")
                drives = service.drives().list().execute()
                all_drives = drives.get('drives', [])
                break  # Success - exit retry loop
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2  # 2, 4, 6 seconds
                    print(f"[WARN] Error listing drives (attempt {attempt + 1}/{max_retries}): {e}")
                    print(f"[INFO] Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    print(f"[ERROR] Failed to list drives after {max_retries} attempts")
                    raise
        
        try:
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
    
    @retry_on_error(max_retries=3, delay=1, backoff=2)
    def find_folder_by_path(self, drive_id, folder_path):
        """Find a folder by path within a shared drive"""
        path_parts = [p for p in folder_path.split('/') if p]  # Remove empty parts
        current_id = drive_id
        service = self._get_fresh_service()  # Fresh connection for each call
        
        for folder_name in path_parts:
            # Let exceptions bubble up to retry decorator
            query = f"name='{folder_name}' and '{current_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = service.files().list(
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
        
        print(f"[OK] Found base folder '{folder_path}' (ID: {current_id})")
        return current_id
    
    @retry_on_error(max_retries=3, delay=1, backoff=2)
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
    
    def find_latest_api_extractions_folder(self):
        """Find the latest folder in the API Extractions path"""
        try:
            # Find the shared drive
            drive_id = self.find_shared_drive(SHARED_DRIVE_NAME)
            if not drive_id:
                print(f"[ERROR] Shared drive '{SHARED_DRIVE_NAME}' not found")
                return None, None
            
            # Store the shared drive ID for use in other methods
            self.shared_drive_id = drive_id
            
            # Find the base folder
            base_folder_id = self.find_folder_by_path(drive_id, BASE_FOLDER_PATH)
            if not base_folder_id:
                print(f"[ERROR] Base folder '{BASE_FOLDER_PATH}' not found")
                return None, None
            
            # Get latest folder
            latest_folder_id, latest_folder_name = self.get_latest_folder(base_folder_id, drive_id)
            return latest_folder_id, latest_folder_name
        except Exception as error:
            print(f"[ERROR] Error finding latest API extractions folder: {error}")
            return None, None
    
    @retry_on_error(max_retries=3, delay=1, backoff=2)
    def download_file(self, file_id, file_name):
        """Download a file from Google Drive with retry logic for SSL errors"""
        max_retries = 3
        service = self._get_fresh_service()  # Fresh connection for each download
        for attempt in range(max_retries):
            try:
                request = service.files().get_media(fileId=file_id)
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
    
    def load_specific_files(self, folder_id, drive_id, file_names):
        """Load only specific JSON files from a folder (Cloud Run 32MB limit optimization)
        
        Args:
            folder_id: Google Drive folder ID
            drive_id: Google Drive shared drive ID
            file_names: List of specific file names to load
        """
        try:
            data = {}
            
            for file_name in file_names:
                # Find specific file by name
                query = f"name='{file_name}' and '{folder_id}' in parents and trashed=false"
                list_params = {
                    'q': query,
                    'supportsAllDrives': True,
                    'includeItemsFromAllDrives': True,
                    'fields': "files(id, name)",
                    'pageSize': 1
                }
                
                if drive_id:
                    list_params['corpora'] = 'drive'
                    list_params['driveId'] = drive_id
                
                results = self.service.files().list(**list_params).execute()
                files = results.get('files', [])
                
                if files:
                    file_id = files[0]['id']
                    print(f"[INFO] Downloading: {file_name}")
                    file_data = self.download_file(file_id, file_name)
                    if file_data is not None:
                        data[file_name] = file_data
                    else:
                        data[file_name] = []
                else:
                    print(f"[WARN] File not found: {file_name}")
                    data[file_name] = []
            
            return data
            
        except Exception as error:
            print(f"[ERROR] Error loading specific files: {error}")
            return {}
    
    def load_folder_data(self, folder_id, drive_id=None):
        """Load all JSON files from a folder - SEQUENTIAL (httplib2 is not thread-safe)"""
        import time
        
        try:
            start_time = time.time()
            
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
            
            print(f"[INFO] Found {len(files)} files to download (sequential - httplib2 not thread-safe)...")
            
            data = {}
            
            for file_info in files:
                file_id = file_info['id']
                file_name = file_info['name']
                print(f"[INFO] Downloading: {file_name}")
                file_data = self.download_file(file_id, file_name)
                if file_data is not None:
                    data[file_name] = file_data
                else:
                    data[file_name] = []
            
            elapsed = time.time() - start_time
            print(f"[OK] Download complete: {len(data)} files in {elapsed:.1f}s")
            
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
    
    def _scan_folder_recursively(self, folder_id, folder_name, drive_id, depth=0, max_depth=3, start_time=None, max_scan_time=30):
        """Recursively scan a folder and all its subfolders for PDF/DOCX files
        
        Returns: dict with structure {subfolder_path: [files]}
        
        Args:
            start_time: When scanning started (for timeout protection)
            max_scan_time: Maximum time to spend scanning (seconds)
        """
        import time as time_module
        
        all_files_by_folder = {}
        
        if depth > max_depth:
            return all_files_by_folder
        
        # Check if we've exceeded the time limit
        if start_time:
            elapsed = time_module.time() - start_time
            if elapsed > max_scan_time:
                print(f"[WARN] Scanning timeout after {elapsed:.1f}s - returning partial results")
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
                
                # Recursively scan subfolder (pass start_time for timeout protection)
                subfolder_files_dict = self._scan_folder_recursively(subfolder_id, full_path, drive_id, depth + 1, max_depth, start_time, max_scan_time)
                # Merge subfolder files into main dict
                all_files_by_folder.update(subfolder_files_dict)
            
            return all_files_by_folder
            
        except Exception as e:
            error_str = str(e)
            # SSL errors are common with Google Drive API - log but continue
            if 'SSL' in error_str or 'WRONG_VERSION' in error_str:
                print(f"[WARN] SSL error scanning folder {folder_name} (non-fatal): {error_str}")
                # Return what we have so far - don't let SSL errors break everything
                return all_files_by_folder
            else:
                print(f"[WARN] Error scanning folder {folder_name}: {e}")
                import traceback
                traceback.print_exc()
                return all_files_by_folder
    
    def load_sales_orders_data(self, drive_id, filter_folders=None):
        """Load sales orders data from Google Drive - supports folder filtering
        Returns file metadata extracted from filenames (like local version - simple and reliable)
        
        Args:
            drive_id: Ignored - we always search for Sales_CSR as a separate drive
            filter_folders: List of specific folders to scan (e.g., ['In Production', 'New and Revised'])
                           If None, scans all folders
        
        DEFAULT BEHAVIOR: Loads only active folders to reduce response size for Cloud Run
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
                'SalesOrders.json': [],  # File metadata (for display)
                'ParsedSalesOrders.json': [],  # Parsed SO data (for logistics automation)
                'SalesOrdersByStatus': {},
                'PurchaseOrdersByStatus': {},
                'TotalOrders': 0,
                'TotalSalesOrders': 0,
                'TotalPurchaseOrders': 0,
                'StatusFolders': [],
                'ScanMethod': 'Google Drive API - Smart Recursive Discovery'
            }
            
            # METADATA ONLY MODE - No parsing, no downloads
            # Parsing happens on-demand via separate API endpoint
            print(f"[INFO] Loading METADATA ONLY (no PDF parsing)")
            
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
            
            # Scan each folder under Customer Orders, but only "Sales Orders" folder
            # (Skip Purchase Orders to reduce response size)
            sales_orders_folder = None
            for order_folder in customer_order_folders:
                if order_folder['name'] == 'Sales Orders':
                    sales_orders_folder = order_folder
                    break
            
            if not sales_orders_folder:
                print("[WARN] Sales Orders folder not found under Customer Orders")
                return {}
            
            folder_id = sales_orders_folder['id']
            folder_name = sales_orders_folder['name']
            print(f"[INFO] ===== STARTING SCAN OF FOLDER: {folder_name} =====")
            
            # Get subfolders (In Production, Cancelled, etc.)
            query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            subfolder_params = {
                'q': query,
                'includeItemsFromAllDrives': True,
                'supportsAllDrives': True,
                'fields': "files(id, name)",
                'pageSize': 100
            }
            if sales_orders_drive_id:
                subfolder_params['corpora'] = 'drive'
                subfolder_params['driveId'] = sales_orders_drive_id
            
            subfolder_results = self.service.files().list(**subfolder_params).execute()
            all_status_folders = subfolder_results.get('files', [])
            
            print(f"[INFO] Found {len(all_status_folders)} status folders: {[f['name'] for f in all_status_folders]}")
            
            # ALWAYS exclude "Closed" and "Cancelled" from main loading (unless explicitly requested)
            excluded_folders = ['Closed', 'Cancelled', 'closed', 'cancelled', 'Completed and Closed']
            all_status_folders = [f for f in all_status_folders if f['name'] not in excluded_folders]
            
            # Apply filter if specified
            if filter_folders:
                status_folders_to_scan = [f for f in all_status_folders if f['name'] in filter_folders]
                print(f"[INFO] FILTERED to {len(status_folders_to_scan)} folders: {[f['name'] for f in status_folders_to_scan]}")
            else:
                status_folders_to_scan = all_status_folders
                print(f"[INFO] Scanning ALL {len(status_folders_to_scan)} folders (excluded: {excluded_folders})")
            
            # Scan each status folder
            for status_folder in status_folders_to_scan:
                folder_id = status_folder['id']
                folder_name = status_folder['name']
                print(f"[INFO] ===== SCANNING FOLDER: {folder_name} =====")
                
                # Scan this folder and immediate subfolders only (depth 2 for "Scheduled" subfolder)
                # For "In Production" and "New and Revised" - fast metadata-only scan
                import time as time_module
                scan_start_time = time_module.time()
                # Depth 2 = folder -> subfolder (e.g., "In Production" -> "Scheduled") -> files
                # Timeout 20s should be plenty for 2 folders with metadata-only
                files_by_subfolder = self._scan_folder_recursively(folder_id, folder_name, sales_orders_drive_id, depth=0, max_depth=2, start_time=scan_start_time, max_scan_time=20)
                scan_elapsed = time_module.time() - scan_start_time
                print(f"[INFO] Scan completed in {scan_elapsed:.1f}s for folder: {folder_name}")
                
                if files_by_subfolder:
                    # Process files: extract metadata ONLY (no downloads, no parsing)
                    all_orders = []  # File metadata (for SalesOrders.json)
                    
                    # Process all subfolders - FILTER OUT "Closed" and "Cancelled"
                    excluded_subfolders = ['Closed', 'Cancelled', 'closed', 'cancelled']
                    for subfolder_path, files in files_by_subfolder.items():
                        
                        subfolder_name = subfolder_path.split('/')[-1] if '/' in subfolder_path else subfolder_path
                        if subfolder_path == folder_name:
                            subfolder_name = folder_name
                        
                        # SKIP excluded folders (Closed, Cancelled)
                        if subfolder_name in excluded_subfolders:
                            print(f"[INFO] SKIPPING excluded folder: {subfolder_name}")
                            continue
                        
                        # Also skip if any part of the path contains excluded folders
                        if any(excluded in subfolder_path for excluded in excluded_subfolders):
                            print(f"[INFO] SKIPPING path containing excluded folder: {subfolder_path}")
                            continue
                        
                        orders_in_folder = []
                        
                        # Process each PDF/DOCX file - METADATA ONLY
                        for file_info in files:
                            file_id = file_info.get('file_id')
                            file_name = file_info.get('file_name', '')
                            modified_time = file_info.get('modified_time', '')
                            
                            # Only process PDF/DOCX files
                            if not file_name.lower().endswith(('.pdf', '.docx', '.doc')):
                                continue
                            
                            # Look for SO pattern in filename
                            if not any(pattern in file_name.lower() for pattern in ['salesorder', 'sales order', 'so_', 'so-', 'order']):
                                continue
                            
                            try:
                                # 1. Extract metadata from filename (for SalesOrders.json)
                                import re
                                order_num = 'Unknown'
                                patterns = [
                                    r'salesorder[_\s-]*(\d+)',
                                    r'sales\s*order[_\s-]*(\d+)',
                                    r'so[_\s-]*(\d+)',
                                    r'order[_\s-]*(\d+)',
                                    r'(\d+)'
                                ]
                                
                                for pattern in patterns:
                                    match = re.search(pattern, file_name.lower())
                                    if match:
                                        order_num = match.group(1)
                                        break
                                
                                # Parse modified time
                                order_date = ''
                                ship_date = ''
                                if modified_time:
                                    try:
                                        from datetime import datetime
                                        dt = datetime.fromisoformat(modified_time.replace('Z', '+00:00'))
                                        order_date = dt.strftime('%Y-%m-%d')
                                        ship_date = dt.strftime('%Y-%m-%d')
                                    except:
                                        pass
                                
                                # Build metadata (for SalesOrders.json) - METADATA ONLY
                                path_info = {
                                    'Order No.': order_num,
                                    'Customer': '',  # Will be populated when user views the order
                                    'Order Date': order_date,
                                    'Ship Date': ship_date,
                                    'Status': subfolder_name,
                                    'File': file_name,
                                    'File Path': f"Google Drive: {subfolder_path}/{file_name}",
                                    'File Type': file_name.split('.')[-1].upper(),
                                    'Last Modified': modified_time,
                                    'Folder Path': subfolder_path,
                                    'Full Path': f"{folder_name}/{subfolder_path}" if subfolder_path != folder_name else folder_name,
                                    'file_id': file_id  # Store file_id for on-demand parsing
                                }
                                orders_in_folder.append(path_info)
                                all_orders.append(path_info)
                                
                            except Exception as e:
                                print(f"[ERROR] Error processing {file_name}: {e}")
                                continue
                        
                        # Add orders to SalesOrdersByStatus
                        if 'Sales' in folder_name or 'sales' in folder_name.lower():
                            if subfolder_name not in sales_orders_data['SalesOrdersByStatus']:
                                sales_orders_data['SalesOrdersByStatus'][subfolder_name] = []
                            sales_orders_data['SalesOrdersByStatus'][subfolder_name].extend(orders_in_folder)
                            sales_orders_data['TotalSalesOrders'] += len(orders_in_folder)
                        elif 'Purchase' in folder_name or 'purchase' in folder_name.lower():
                            if subfolder_name not in sales_orders_data['PurchaseOrdersByStatus']:
                                sales_orders_data['PurchaseOrdersByStatus'][subfolder_name] = []
                            sales_orders_data['PurchaseOrdersByStatus'][subfolder_name].extend(orders_in_folder)
                            sales_orders_data['TotalPurchaseOrders'] += len(orders_in_folder)
                        else:
                            if subfolder_name not in sales_orders_data['SalesOrdersByStatus']:
                                sales_orders_data['SalesOrdersByStatus'][subfolder_name] = []
                            sales_orders_data['SalesOrdersByStatus'][subfolder_name].extend(orders_in_folder)
                            sales_orders_data['TotalOrders'] += len(orders_in_folder)
                    
                    # Add all orders to SalesOrders.json (flat list) - METADATA ONLY
                    sales_orders_data['SalesOrders.json'].extend(all_orders)
                    
                    print(f"[OK] Found {len(all_orders)} sales orders (metadata only) from {folder_name}")
            
            # Add all parsed orders from all folders to ParsedSalesOrders.json
            # (already done above, but ensure it's in the final structure)
            
            # Calculate totals
            sales_orders_data['TotalOrders'] = len(sales_orders_data['SalesOrders.json'])
            
            # Collect all status folders
            all_status_folders = []
            for folder_name, files in sales_orders_data['SalesOrdersByStatus'].items():
                all_status_folders.append(folder_name)
            sales_orders_data['StatusFolders'] = all_status_folders
            
            print(f"[OK] Total orders parsed: {sales_orders_data['TotalOrders']} (Sales: {sales_orders_data['TotalSalesOrders']}, Purchase: {sales_orders_data['TotalPurchaseOrders']})")
            return sales_orders_data
            
        except Exception as e:
            print(f"[WARN] Error loading sales orders: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def get_all_data(self):
        """Main method to get all data from Google Drive"""
        print(f"[INFO] ===== STARTING get_all_data =====")
        print(f"[INFO] Looking for shared drive: {SHARED_DRIVE_NAME}")
        
        if not self.authenticated:
            print(f"[INFO] Not authenticated, calling authenticate()...")
            self.authenticate()
        
        # Find the shared drive
        print(f"[INFO] Calling find_shared_drive('{SHARED_DRIVE_NAME}')...")
        drive_id = self.find_shared_drive(SHARED_DRIVE_NAME)
        print(f"[INFO] find_shared_drive returned: {drive_id}")
        
        if not drive_id:
            print(f"[ERROR] Shared drive '{SHARED_DRIVE_NAME}' not found!")
            return None, "Shared drive not found"
        
        # Store the shared drive ID for use in other methods
        self.shared_drive_id = drive_id
        
        print(f"[OK] Found shared drive '{SHARED_DRIVE_NAME}' (ID: {drive_id})")
        
        # Find the base folder
        print(f"[INFO] Looking for base folder: {BASE_FOLDER_PATH}")
        base_folder_id = self.find_folder_by_path(drive_id, BASE_FOLDER_PATH)
        print(f"[INFO] find_folder_by_path returned: {base_folder_id}")
        
        if not base_folder_id:
            print(f"[ERROR] Base folder '{BASE_FOLDER_PATH}' not found!")
            return None, "Base folder not found"
        
        print(f"[OK] Found base folder '{BASE_FOLDER_PATH}' (ID: {base_folder_id})")
        
        # Get latest folder
        print(f"[INFO] Getting latest folder from base folder...")
        latest_folder_id, latest_folder_name = self.get_latest_folder(base_folder_id, drive_id)
        print(f"[INFO] get_latest_folder returned: {latest_folder_id}, {latest_folder_name}")
        
        if not latest_folder_id:
            print(f"[ERROR] No latest folder found!")
            return None, "No latest folder found"
        
        print(f"[OK] Found latest folder: {latest_folder_name} (ID: {latest_folder_id})")
        
        # Load ALL JSON files from API Extractions folder (HTTP/2 removes 32MB limit)
        print(f"[INFO] Loading ALL JSON files from API Extractions folder (HTTP/2 enabled - no size limit)...")
        
        data = self.load_folder_data(latest_folder_id, drive_id)
        print(f"[INFO] Loaded {len(data)} files: {list(data.keys())}")
        
        # SKIP Sales Orders - Load via separate /api/sales-orders endpoint (Cloud Run 32MB limit)
        print(f"[INFO] ===== SKIPPING SALES ORDERS (use /api/sales-orders endpoint) =====")
        # Add empty placeholders so frontend doesn't break
        data['SalesOrders.json'] = []
        data['SalesOrdersByStatus'] = {}
        data['TotalOrders'] = 0
        data['StatusFolders'] = []
        
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
    
    def get_all_data_incremental(self, cached_file_times=None):
        """
        Load data incrementally - only download files that changed
        
        Args:
            cached_file_times: Dict of {filename: modifiedTime} from last load
        
        Returns:
            (data, folder_info, new_file_times)
        """
        if cached_file_times is None:
            cached_file_times = {}
        
        print(f"[INFO] ===== INCREMENTAL SYNC =====")
        print(f"[INFO] Cached files: {len(cached_file_times)}")
        
        # Find latest folder
        latest_folder_id, latest_folder_name = self.find_latest_api_extractions_folder()
        if not latest_folder_id:
            return {}, {}, {}
        
        # Get all files with modification times
        query = f"('{latest_folder_id}' in parents) and (mimeType='application/json' or name contains '.json') and trashed=false"
        list_params = {
            'q': query,
            'supportsAllDrives': True,
            'includeItemsFromAllDrives': True,
            'fields': "files(id, name, mimeType, modifiedTime)",
            'orderBy': 'modifiedTime desc'
        }
        
        if self.shared_drive_id:
            list_params['corpora'] = 'drive'
            list_params['driveId'] = self.shared_drive_id
        
        results = self.service.files().list(**list_params).execute()
        files = results.get('files', [])
        
        data = {}
        new_file_times = {}
        changed_count = 0
        unchanged_count = 0
        
        for file_info in files:
            file_name = file_info['name']
            file_id = file_info['id']
            modified_time = file_info.get('modifiedTime', '')
            
            # Check if file changed
            cached_time = cached_file_times.get(file_name)
            if cached_time and cached_time == modified_time:
                # File unchanged - skip download
                unchanged_count += 1
                print(f"[SKIP] {file_name} (unchanged)")
                continue
            
            # File changed or new - download it
            changed_count += 1
            print(f"[DOWNLOAD] {file_name} (changed or new)")
            file_data = self.download_file(file_id, file_name)
            if file_data is not None:
                data[file_name] = file_data
                new_file_times[file_name] = modified_time
        
        print(f"[INFO] Incremental sync: {changed_count} changed, {unchanged_count} unchanged")
        
        folder_info = {
            "folderName": latest_folder_name,
            "syncDate": datetime.now().isoformat(),
            "lastModified": datetime.now().isoformat(),
            "folder": latest_folder_name,
            "created": datetime.now().isoformat(),
            "size": "N/A",
            "fileCount": len(files)
        }
        
        return data, folder_info, new_file_times

