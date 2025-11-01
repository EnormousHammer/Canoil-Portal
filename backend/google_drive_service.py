"""
Google Drive API Service
Connects directly to Google Drive to access shared drive data
"""

import os
import json
import pickle
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Google Drive API scopes
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]

# Shared Drive folder paths
SHARED_DRIVE_NAME = "IT_Automation"  # The shared drive name
BASE_FOLDER_PATH = "MiSys/Misys Extracted Data/API Extractions"  # Path within shared drive
SALES_ORDERS_PATH = "Sales_CSR/Customer Orders/Sales Orders"

class GoogleDriveService:
    def __init__(self, credentials_file='backend/google_drive_credentials.json', token_file='backend/google_drive_token.pickle'):
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.service = None
        self.authenticated = False
        
    def authenticate(self):
        """Authenticate and build Google Drive API service"""
        creds = None
        
        # Load existing token if available
        if os.path.exists(self.token_file):
            with open(self.token_file, 'rb') as token:
                creds = pickle.load(token)
        
        # If no valid credentials, get new ones
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Credentials file not found: {self.credentials_file}\n"
                        "Please download OAuth 2.0 credentials from Google Cloud Console"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, SCOPES)
                creds = flow.run_local_server(port=0)
            
            # Save credentials for next run
            with open(self.token_file, 'wb') as token:
                pickle.dump(creds, token)
        
        self.service = build('drive', 'v3', credentials=creds)
        self.authenticated = True
        print("✅ Google Drive API authenticated successfully")
        return True
    
    def find_shared_drive(self, drive_name):
        """Find a shared drive by name"""
        try:
            drives = self.service.drives().list().execute()
            for drive in drives.get('drives', []):
                if drive.get('name') == drive_name:
                    print(f"✅ Found shared drive: {drive_name} (ID: {drive['id']})")
                    return drive['id']
            print(f"⚠️ Shared drive '{drive_name}' not found")
            return None
        except HttpError as error:
            print(f"❌ Error finding shared drive: {error}")
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
                    print(f"📁 Found folder: {folder_name} (ID: {current_id})")
                else:
                    print(f"❌ Folder not found: {folder_name}")
                    return None
            except HttpError as error:
                print(f"❌ Error finding folder {folder_name}: {error}")
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
                print(f"✅ Latest folder: {latest['name']} (ID: {latest['id']})")
                return latest['id'], latest['name']
            else:
                print("❌ No folders found")
                return None, None
        except HttpError as error:
            print(f"❌ Error getting latest folder: {error}")
            return None, None
    
    def download_file(self, file_id, file_name):
        """Download a file from Google Drive"""
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
            print(f"❌ Error downloading file {file_name}: {error}")
            return None
    
    def load_folder_data(self, folder_id):
        """Load all JSON files from a folder"""
        try:
            # Find all JSON files (either JSON mime type or files ending in .json)
            query = f"('{folder_id}' in parents) and (mimeType='application/json' or name contains '.json') and trashed=false"
            results = self.service.files().list(
                q=query,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                fields="files(id, name, mimeType, modifiedTime)"
            ).execute()
            
            files = results.get('files', [])
            data = {}
            
            for file_info in files:
                file_id = file_info['id']
                file_name = file_info['name']
                print(f"📄 Downloading: {file_name}")
                file_data = self.download_file(file_id, file_name)
                if file_data is not None:
                    data[file_name] = file_data
                else:
                    data[file_name] = []  # Fallback to empty array
            
            return data
        except HttpError as error:
            print(f"❌ Error loading folder data: {error}")
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
        data = self.load_folder_data(latest_folder_id)
        
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

