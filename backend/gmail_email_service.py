#!/usr/bin/env python3
"""
Gmail Email Assistant Service with OpenAI Integration
Handles Gmail OAuth, email fetching, writing style analysis, and AI response generation
"""

import os
import json
import pickle
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import openai
from openai import OpenAI

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify'
]

class GmailEmailService:
    """Gmail Email Service with OpenAI-powered writing style analysis and response generation"""
    
    def __init__(self):
        self.creds = None
        self.service = None
        self.openai_client = None
        self.user_email = None
        self.writing_style_profile = None
        self.credentials_path = Path(__file__).parent / 'gmail_credentials'
        self.credentials_path.mkdir(exist_ok=True)
        self._initialized = False  # Track if we've loaded credentials on startup
        
        # Email caching for performance
        self.cached_emails = []
        self.last_fetch_time = None
        self.last_fetched_email_id = None  # Track last email ID to avoid duplicates
        
        # Smart caching: 1 hour in dev mode, 5 minutes in production
        is_dev = os.getenv('FLASK_ENV') == 'development' or os.getenv('NODE_ENV') == 'development'
        # Force dev mode for local development
        self.cache_duration = 3600  # Always 1 hour for local dev
        print(f"⏰ Email cache duration set to: {self.cache_duration} seconds ({self.cache_duration//60} minutes)")
        
        # Only clear caches in dev mode if explicitly requested (not on every startup)
        # Comment out auto-clear for better dev experience
        # self._clear_all_caches()
        
        # Initialize OpenAI
        self._init_openai()
        
        # Load saved credentials if they exist
        print("\n🔑 ===== LOADING GMAIL CREDENTIALS ON STARTUP =====")
        self._load_credentials()
        print("🔑 ===== CREDENTIALS LOADED =====\n")
        
        # Load last fetched email ID to avoid duplicates
        last_id_path = self.credentials_path / 'last_fetched_email_id.txt'
        if last_id_path.exists():
            with open(last_id_path, 'r') as f:
                self.last_fetched_email_id = f.read().strip()
                print(f"📝 Loaded last fetched email ID: {self.last_fetched_email_id}")
        
        # Load saved writing style profile if it exists
        self._load_writing_style()
    
    def _clear_all_caches(self):
        """Clear all caches - only when explicitly requested
        
        IMPORTANT: Preserves Gmail credentials - only clears email cache and writing style
        """
        try:
            print("🧹 Clearing all caches (preserving Gmail credentials)...")
            
            # Clear in-memory caches
            self.cached_emails = []
            self.last_fetch_time = None
            self.writing_style_profile = None
            
            # Clear file-based caches
            writing_style_file = self.credentials_path / 'writing_style.json'
            if writing_style_file.exists():
                writing_style_file.unlink()
                print("   🗑️ Deleted writing_style.json")
            
            # IMPORTANT: Keep credentials and service intact!
            # Only clear email cache, not authentication
            # This allows Gmail to stay connected even after cache clear
            # self.service = None  # DON'T clear this
            # self.creds = None    # DON'T clear this
            
            print("✅ All caches cleared (credentials preserved)")
            
        except Exception as e:
            print(f"⚠️ Error clearing caches: {e}")
    
    def _init_openai(self):
        """Initialize OpenAI client"""
        try:
            openai_api_key = os.getenv('OPENAI_API_KEY')
            if not openai_api_key or openai_api_key == "your_openai_api_key_here":
                # Use the working API key for Canoil operations (same as enterprise_analytics)
                openai_api_key = "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"
                os.environ['OPENAI_API_KEY'] = openai_api_key
            
            if openai_api_key:
                self.openai_client = OpenAI(api_key=openai_api_key)
                print("✅ OpenAI client initialized for Email Assistant (GPT-4o)")
            else:
                print("❌ OpenAI API key not set - AI features will be disabled")
                self.openai_client = None
        except Exception as e:
            print(f"❌ Error initializing OpenAI: {e}")
            self.openai_client = None
    
    def _load_writing_style(self):
        """Load saved writing style profile from disk"""
        try:
            profile_path = self.credentials_path / 'writing_style.json'
            if profile_path.exists():
                with open(profile_path, 'r', encoding='utf-8') as f:
                    self.writing_style_profile = json.load(f)
                    sample_count = self.writing_style_profile.get('sample_count', 0)
                    analyzed_date = self.writing_style_profile.get('analyzed_date', 'Unknown')
                    print(f"✅ Loaded writing style profile: {sample_count} emails analyzed on {analyzed_date}")
            else:
                print("📝 No writing style profile found (train AI to create one)")
        except Exception as e:
            print(f"⚠️ Error loading writing style profile: {e}")
            self.writing_style_profile = None
    
    def _load_credentials(self):
        """Load saved Gmail credentials - try JSON first, then pickle"""
        json_path = self.credentials_path / 'token.json'
        pickle_path = self.credentials_path / 'token.pickle'
        
        # Try loading from JSON first
        if json_path.exists():
            print(f"📄 Loading credentials from JSON: {json_path}")
            try:
                with open(json_path, 'r') as f:
                    creds_dict = json.load(f)
                
                # Reconstruct credentials object
                self.creds = Credentials(
                    token=creds_dict.get('token'),
                    refresh_token=creds_dict.get('refresh_token'),
                    token_uri=creds_dict.get('token_uri'),
                    client_id=creds_dict.get('client_id'),
                    client_secret=creds_dict.get('client_secret'),
                    scopes=creds_dict.get('scopes')
                )
                print("✅ Credentials loaded from JSON")
            except Exception as e:
                print(f"❌ Error loading JSON credentials: {e}")
                self.creds = None
        # Fallback to pickle if JSON doesn't exist
        elif pickle_path.exists():
            print(f"📄 Loading credentials from pickle: {pickle_path}")
            try:
                with open(pickle_path, 'rb') as f:
                    self.creds = pickle.load(f)
                print("✅ Credentials loaded from pickle")
            except Exception as e:
                print(f"❌ Error loading pickle credentials: {e}")
                self.creds = None
        else:
            print("❌ No saved credentials found")
            return
        
        # Check credential status and refresh if needed
        if self.creds:
            if self.creds.expired and self.creds.refresh_token:
                print("🔄 Credentials expired, attempting to refresh...")
                try:
                    self.creds.refresh(Request())
                    self._save_credentials()  # Save refreshed credentials
                    print("✅ Credentials refreshed successfully")
                except Exception as e:
                    print(f"❌ Failed to refresh credentials: {e}")
                    self.creds = None
                    return
            elif self.creds.expired:
                print("⚠️ Credentials expired and no refresh token")
                self.creds = None
                return
            else:
                print("✅ Credentials are still valid")
            
            # Initialize service with valid credentials
            if self.creds and self.creds.valid:
                self._init_service()
                print("✅ Gmail service initialized successfully")
            else:
                print("⚠️ Credentials invalid, need to log in again")
    
    def _save_credentials(self):
        """Save Gmail credentials as JSON (more reliable than pickle)"""
        try:
            if not self.creds:
                print("⚠️ No credentials to save")
                return
                
            # Extract credential info
            creds_dict = {
                'token': self.creds.token,
                'refresh_token': self.creds.refresh_token,
                'token_uri': self.creds.token_uri,
                'client_id': self.creds.client_id,
                'client_secret': self.creds.client_secret,
                'scopes': self.creds.scopes,
                'id_token': getattr(self.creds, 'id_token', None)
            }
            
            token_path = self.credentials_path / 'token.json'
            with open(token_path, 'w') as f:
                json.dump(creds_dict, f)
            print("✅ Gmail credentials saved as JSON")
            
            # Also save as pickle for backwards compatibility
            pickle_path = self.credentials_path / 'token.pickle'
            with open(pickle_path, 'wb') as f:
                pickle.dump(self.creds, f)
        except Exception as e:
            print(f"❌ Error saving credentials: {e}")
            import traceback
            traceback.print_exc()
    
    def _init_service(self):
        """Initialize Gmail API service"""
        try:
            if self.creds and self.creds.valid:
                print(f"🔧 Initializing Gmail service...")
                self.service = build('gmail', 'v1', credentials=self.creds)
                
                # Get user email
                print(f"🔧 Getting user profile...")
                profile = self.service.users().getProfile(userId='me').execute()
                self.user_email = profile.get('emailAddress')
                print(f"✅ Gmail service initialized for {self.user_email}")
                
                # Auto-fetch emails on startup for instant access (only if service is valid)
                if self.service and self.creds and self.creds.valid:
                    print("📧 Skipping pre-fetch to avoid rate limits...")
                    print("✅ Gmail service ready (no pre-fetch)")
                else:
                    print("⏭️ Skipping email pre-fetch (not authenticated yet)")
            else:
                print(f"❌ Cannot initialize service - creds: {self.creds is not None}, valid: {self.creds.valid if self.creds else False}")
        except Exception as e:
            print(f"❌ Error initializing Gmail service: {e}")
            import traceback
            traceback.print_exc()
            self.service = None
    
    def start_oauth_flow(self) -> Dict[str, Any]:
        """Start OAuth flow - Returns URL for user to visit
        
        IMPORTANT: Checks if credentials already exist and are valid first
        """
        try:
            # Check if we already have valid credentials
            if self.creds and self.creds.valid:
                # We're already authenticated!
                if not self.service:
                    self._init_service()
                
                if self.service and self.user_email:
                    print(f"✅ Already authenticated as {self.user_email} - skipping OAuth flow")
                    return {
                        'success': True,
                        'already_connected': True,
                        'email': self.user_email,
                        'message': f'Already connected as {self.user_email}'
                    }
            
            # Check if credentials exist but are expired - try to refresh
            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    print("🔄 Credentials expired, attempting to refresh...")
                    self.creds.refresh(Request())
                    self._save_credentials()
                    print("✅ Credentials refreshed successfully")
                    if not self.service:
                        self._init_service()
                    if self.service and self.user_email:
                        return {
                            'success': True,
                            'already_connected': True,
                            'email': self.user_email,
                            'message': f'Reconnected as {self.user_email} after refresh'
                        }
                except Exception as e:
                    print(f"❌ Failed to refresh credentials: {e}")
                    # Continue with OAuth flow below
            
            credentials_json_path = self.credentials_path / 'credentials.json'
            
            if not credentials_json_path.exists():
                return {
                    'success': False,
                    'error': 'Gmail OAuth credentials.json not found. Please set up Gmail API credentials.'
                }
            
            # Create flow with explicit redirect URI
            flow = InstalledAppFlow.from_client_secrets_file(
                str(credentials_json_path),
                SCOPES,
                redirect_uri='urn:ietf:wg:oauth:2.0:oob'  # Out-of-band flow
            )
            
            # Generate authorization URL
            auth_url, _ = flow.authorization_url(prompt='consent')
            
            # Don't pickle the flow - we'll recreate it when needed
            # Just save a flag that we're in auth process
            auth_state_path = self.credentials_path / 'auth_in_progress.txt'
            with open(auth_state_path, 'w') as f:
                f.write('waiting_for_code')
            
            return {
                'success': True,
                'authUrl': auth_url,
                'message': 'Copy the code from the browser and paste it back'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error starting OAuth flow: {str(e)}'
            }
    
    def handle_oauth_code(self, code: str) -> Dict[str, Any]:
        """Handle OAuth code from user and complete authentication"""
        try:
            credentials_json_path = self.credentials_path / 'credentials.json'
            
            if not credentials_json_path.exists():
                return {
                    'success': False,
                    'error': 'credentials.json not found'
                }
            
            # Create a fresh flow (can't reuse pickled one)
            flow = InstalledAppFlow.from_client_secrets_file(
                str(credentials_json_path),
                SCOPES,
                redirect_uri='urn:ietf:wg:oauth:2.0:oob'
            )
            
            # Exchange code for credentials
            flow.fetch_token(code=code)
            self.creds = flow.credentials
            
            self._save_credentials()
            
            # Initialize service WITHOUT fetching emails (that blocks the response)
            try:
                self.service = build('gmail', 'v1', credentials=self.creds)
                profile = self.service.users().getProfile(userId='me').execute()
                self.user_email = profile.get('emailAddress')
                print(f"✅ Gmail OAuth complete for {self.user_email}")
                print("⏭️ Skipping email pre-fetch (user will click Refresh to load)")
            except Exception as e:
                print(f"❌ Error getting user profile: {e}")
                self.user_email = 'Unknown'
            
            # Clean up auth state
            auth_state_path = self.credentials_path / 'auth_in_progress.txt'
            if auth_state_path.exists():
                auth_state_path.unlink()
            
            return {
                'success': True,
                'email': self.user_email
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error handling OAuth code: {str(e)}'
            }
    
    def logout(self) -> Dict[str, Any]:
        """Logout and clear credentials"""
        try:
            # Delete BOTH token files
            token_pickle = self.credentials_path / 'token.pickle'
            token_json = self.credentials_path / 'token.json'
            
            if token_pickle.exists():
                token_pickle.unlink()
                print("🗑️ Deleted token.pickle")
            
            if token_json.exists():
                token_json.unlink()
                print("🗑️ Deleted token.json")
            
            # Clear in-memory state
            self.creds = None
            self.service = None
            self.user_email = None
            self.writing_style_profile = None
            self.cached_emails = []
            self.last_fetch_time = None
            
            print("✅ Logged out - all credentials cleared")
            return {'success': True}
        except Exception as e:
            print(f"❌ Error during logout: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_status(self) -> Dict[str, Any]:
        """Get connection status"""
        print(f"🔍 get_status() called - creds: {self.creds is not None}, service: {self.service is not None}")
        
        # If we have credentials but they're expired, try to refresh them
        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                print("🔄 Credentials expired, attempting to refresh...")
                self.creds.refresh(Request())
                self._save_credentials()  # Save refreshed credentials
                print("✅ Credentials refreshed successfully")
                # Now initialize service if not already initialized
                if not self.service:
                    self._init_service()
            except Exception as e:
                print(f"❌ Failed to refresh credentials: {e}")
                # Don't return error yet - might still have valid service
        
        # If we have credentials but no service, try to initialize
        if self.creds and not self.service:
            try:
                print("⚠️ Have creds but no service, initializing...")
                self._init_service()
            except Exception as e:
                print(f"❌ Failed to initialize service: {e}")
                import traceback
                traceback.print_exc()
                return {
                    'connected': False,
                    'error': 'Failed to initialize Gmail service',
                    'email': None,
                    'styleAnalyzed': self.writing_style_profile is not None,
                    'sentEmailsCount': len(self.writing_style_profile.get('samples', [])) if self.writing_style_profile else 0
                }
        
        # Get actual email count from the profile
        sent_emails_count = 0
        if self.writing_style_profile:
            # Use the actual sample_count from when the analysis was done
            sent_emails_count = self.writing_style_profile.get('sample_count', 0)
        
        is_connected = self.service is not None and self.creds is not None and self.creds.valid
        print(f"📊 Status: connected={is_connected}, email={self.user_email}, creds_valid={self.creds.valid if self.creds else False}")
        
        return {
            'connected': is_connected,
            'email': self.user_email,
            'styleAnalyzed': self.writing_style_profile is not None,
            'sentEmailsCount': sent_emails_count
        }
    
    def fetch_inbox(self, max_results: int = 500, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch recent inbox emails with intelligent caching and rate limit handling
        
        Args:
            max_results: Number of emails to fetch (default 500, can go up to 1000+)
            force_refresh: Force fetch from Gmail (bypass cache)
        """
        if not self.service:
            return {
                'success': False,
                'error': 'Gmail not connected'
            }
        
        # Check cache first (unless force refresh)
        import time
        current_time = time.time()
        
        if not force_refresh and self.cached_emails and self.last_fetch_time:
            cache_age = current_time - self.last_fetch_time
            if cache_age < self.cache_duration:
                print(f"✅ Returning cached emails ({len(self.cached_emails)} emails, cache age: {cache_age:.0f}s)")
                return {
                    'success': True,
                    'emails': self.cached_emails,
                    'cached': True,
                    'cache_age': cache_age
            }
        
        try:
            # Smart date filtering: Only fetch NEW emails if we have a last_fetched_email_id
            from datetime import datetime, timedelta
            
            if self.last_fetched_email_id and not force_refresh:
                # We have a marker - only fetch NEW emails from last 7 days
                # This avoids fetching all emails on every launch
                seven_days_ago = datetime.now() - timedelta(days=7)
                date_filter = seven_days_ago.strftime('%Y/%m/%d')
                print(f"📧 Fetching NEW emails only (last 7 days since {date_filter})...")
                print(f"   Last fetched email ID: {self.last_fetched_email_id}")
            else:
                # First time or force refresh: fetch all emails from past 3 months
                three_months_ago = datetime.now() - timedelta(days=90)
                date_filter = three_months_ago.strftime('%Y/%m/%d')
                print(f"📧 Fetching emails from Gmail (past 3 months since {date_filter})...")
                if force_refresh:
                    print("   Force refresh requested - fetching all emails")
            
            # Use pagination to get emails
            # Gmail API allows up to 500 emails per request, so we'll paginate if needed
            all_emails = []
            page_token = None
            total_fetched = 0
            max_requests = 10  # Safety limit to prevent infinite loops
            found_last_email = False
            
            for request_num in range(max_requests):
                if total_fetched >= max_results:
                    break
                    
                # Calculate how many emails to fetch in this request
                remaining = max_results - total_fetched
                current_batch_size = min(500, remaining)  # Gmail API max is 500 per request
                
                if not found_last_email:
                    print(f"📧 API Request #{request_num + 1}: Fetching {current_batch_size} emails (total so far: {total_fetched})...")
                
                try:
                    # Make API call with pagination
                    results = self.service.users().messages().list(
                        userId='me',
                        labelIds=['INBOX'],
                        q=f'after:{date_filter}',  # Filter by date
                        maxResults=current_batch_size,
                        pageToken=page_token
                    ).execute()
                    
                    messages = results.get('messages', [])
                    print(f"   Found {len(messages)} messages in this batch")
                    
                    if not messages:
                        print("   No more messages found, stopping pagination")
                        break
                    
                    # Process each message in this batch
                    batch_emails = []
                    for idx, msg in enumerate(messages):
                        try:
                            # Extract basic info from the list response
                            msg_id = msg['id']
                            
                            # Skip if we've already processed this email (avoid duplicates)
                            if self.last_fetched_email_id and msg_id == self.last_fetched_email_id:
                                print(f"   ⏭️ Reached previously fetched email ({self.last_fetched_email_id}), stopping")
                                found_last_email = True
                                break
                            
                            thread_id = msg.get('threadId', msg_id)
                            
                            # Get snippet from the list response (no additional API call)
                            snippet = msg.get('snippet', '')
                            
                            # Fetch full email details to get subject, from, timestamp
                            try:
                                # Small delay to avoid rate limits
                                if idx > 0 and idx % 10 == 0:
                                    time.sleep(0.1)  # 100ms delay every 10 emails
                                
                                full_msg = self.service.users().messages().get(
                                    userId='me',
                                    id=msg_id,
                                    format='full'
                                ).execute()
                                
                                # Extract headers
                                headers = full_msg.get('payload', {}).get('headers', [])
                                from_header = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                                subject_header = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                                
                                # Use Gmail's internalDate (milliseconds since epoch) - more reliable than parsing headers
                                try:
                                    internal_date = full_msg.get('internalDate', '')
                                    if internal_date:
                                        # Convert milliseconds to ISO datetime
                                        import datetime
                                        timestamp_dt = datetime.datetime.fromtimestamp(int(internal_date) / 1000, tz=datetime.timezone.utc)
                                        timestamp = timestamp_dt.isoformat()
                                    else:
                                        # Fallback to Date header if internalDate not available
                                        date_header = next((h['value'] for h in headers if h['name'] == 'Date'), '')
                                        from email.utils import parsedate_to_datetime
                                        parsed_date = parsedate_to_datetime(date_header)
                                        timestamp = parsed_date.isoformat() if parsed_date else ''
                                except Exception as e:
                                    print(f"   ⚠️ Error parsing date: {e}")
                                    timestamp = ''
                                
                                # Extract email body
                                email_body = self._extract_email_body(full_msg)
                                
                            except Exception as e:
                                print(f"   ⚠️ Error fetching full email {msg_id}: {e}")
                                # Fallback to basic info
                                from_header = 'Unknown'
                                subject_header = 'No Subject'
                                timestamp = ''
                                email_body = snippet  # Fallback to snippet
                            
                            batch_emails.append({
                                'id': msg_id,
                                'threadId': thread_id,
                                'from': from_header,
                                'subject': subject_header,
                                'body': email_body,  # Use actual email body
                                'snippet': snippet,
                                'timestamp': timestamp,
                                'hasResponse': False,
                                'isProcessing': False,
                                'attachments': [],
                                'hasAttachments': False
                            })
                            
                        except Exception as e:
                            print(f"   ⚠️ Error processing email {msg.get('id', 'unknown')}: {e}")
                            # Add a basic entry even if processing fails
                            batch_emails.append({
                                'id': msg.get('id', 'unknown'),
                                'threadId': msg.get('threadId', msg.get('id', 'unknown')),
                                'from': 'Unknown',
                                'subject': 'Error loading email',
                                'body': f'Error: {str(e)}',
                                'snippet': f'Error: {str(e)}',
                                'timestamp': '',
                                'hasResponse': False,
                                'isProcessing': False,
                                'attachments': [],
                                'hasAttachments': False
                            })
                    
                    # Add this batch to our total
                    all_emails.extend(batch_emails)
                    total_fetched += len(batch_emails)
                    
                    print(f"   ✅ Processed {len(batch_emails)} emails in this batch (total: {total_fetched})")
                    
                    # Stop if we found the last email marker
                    if found_last_email:
                        print("   ⏭️ Stopping pagination - reached last fetched email")
                        break
                    
                    # Check if we have more pages
                    page_token = results.get('nextPageToken')
                    if not page_token:
                        print("   No more pages available, stopping pagination")
                        break
                    
                    # Add a small delay between requests to be respectful to the API
                    if page_token:
                        print("   ⏳ Waiting 1 second before next request...")
                        time.sleep(1)
                
                except Exception as e:
                    print(f"   ❌ Error in API request #{request_num + 1}: {e}")
                    if "rate limit" in str(e).lower() or "quota" in str(e).lower():
                        print("   ⏳ Rate limit detected, stopping pagination")
                        break
                    else:
                        # For other errors, continue with next request
                        continue
            
            # Cache the results
            # If we had cached emails, merge new emails with cached ones (newest first)
            if self.cached_emails and all_emails and not force_refresh:
                # Merge: add new emails to cached list, keeping newest first
                existing_ids = {email['id'] for email in self.cached_emails}
                new_emails_only = [email for email in all_emails if email['id'] not in existing_ids]
                
                if new_emails_only:
                    print(f"📧 Merging {len(new_emails_only)} new emails with {len(self.cached_emails)} cached emails")
                    # Combine and sort by timestamp (newest first)
                    combined = new_emails_only + self.cached_emails
                    combined.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
                    self.cached_emails = combined[:max_results]  # Keep only max_results
                    all_emails = new_emails_only  # Track new emails separately
                else:
                    print("📧 No new emails found - using cached emails")
                    new_emails_only = []  # No new emails
            else:
                # First fetch or force refresh: replace cache
                self.cached_emails = all_emails
                new_emails_only = all_emails
                
            self.last_fetch_time = current_time
            
            # Save the first email ID as our "last fetched" marker (only if we got new emails)
            if new_emails_only:
                # Update last_fetched_email_id to the newest email we fetched
                newest_email_id = new_emails_only[0]['id']
                if newest_email_id != self.last_fetched_email_id:
                    self.last_fetched_email_id = newest_email_id
                    # Also save to file for persistence
                    last_id_path = self.credentials_path / 'last_fetched_email_id.txt'
                    with open(last_id_path, 'w') as f:
                        f.write(self.last_fetched_email_id)
                    print(f"📝 Updated last fetched email ID: {self.last_fetched_email_id}")
            
            if new_emails_only:
                print(f"✅ Fetched {len(new_emails_only)} NEW emails, total cached: {len(self.cached_emails)}")
            else:
                print(f"✅ No new emails found. Using {len(self.cached_emails)} cached emails")
            
            # Return merged list (new + cached) so frontend has all emails
            # If no new emails, return cached emails
            emails_to_return = self.cached_emails if self.cached_emails else []
            
            return {
                'success': True,
                'emails': emails_to_return,
                'cached': len(new_emails_only) == 0,  # Mark as cached if no new emails
                'cache_age': 0 if new_emails_only else (current_time - self.last_fetch_time if self.last_fetch_time else 0),
                'new_emails_count': len(new_emails_only),
                'total_cached_count': len(self.cached_emails)
            }
        except HttpError as error:
            return {
                'success': False,
                'error': f'Gmail API error: {str(error)}'
            }
    
    def fetch_thread(self, thread_id: str) -> Dict[str, Any]:
        """Fetch all messages in an email thread/conversation
        
        Args:
            thread_id: Gmail thread ID
            
        Returns:
            Dict with thread messages in chronological order
        """
        if not self.service:
            return {
                'success': False,
                'error': 'Gmail not connected'
            }
        
        try:
            print(f"🔗 Fetching thread: {thread_id}")
            
            # Get thread with all messages
            thread = self.service.users().threads().get(
                userId='me',
                id=thread_id,
                format='full'
            ).execute()
            
            messages = thread.get('messages', [])
            thread_messages = []
            
            print(f"   Found {len(messages)} messages in thread")
            
            for msg_data in messages:
                headers = msg_data['payload']['headers']
                subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
                from_email = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown')
                to_email = next((h['value'] for h in headers if h['name'].lower() == 'to'), 'Unknown')
                date = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')
                
                # Extract email body
                body = self._extract_email_body(msg_data)
                snippet = msg_data.get('snippet', '')
                
                # Check for attachments
                attachments = []
                if 'payload' in msg_data:
                    attachments = self._extract_attachments_info(msg_data['payload'])
                
                # Determine if this is from the user (sent) or received
                is_from_me = self.user_email and (self.user_email.lower() in from_email.lower())
                
                thread_messages.append({
                    'id': msg_data['id'],
                    'from': from_email,
                    'to': to_email,
                    'subject': subject,
                    'body': body or snippet,
                    'snippet': snippet,
                    'timestamp': date,
                    'attachments': attachments,
                    'hasAttachments': len(attachments) > 0,
                    'isFromMe': is_from_me,
                    'messageType': 'sent' if is_from_me else 'received'
                })
            
            # Sort by timestamp (chronological order)
            thread_messages.sort(key=lambda x: x['timestamp'])
            
            print(f"✅ Thread loaded: {len(thread_messages)} messages")
            
            return {
                'success': True,
                'threadId': thread_id,
                'messageCount': len(thread_messages),
                'messages': thread_messages
            }
        except HttpError as error:
            print(f"❌ Error fetching thread: {error}")
            return {
                'success': False,
                'error': f'Gmail API error: {str(error)}'
            }
    
    def analyze_writing_style(self, max_emails: int = 250) -> Dict[str, Any]:
        """Analyze user's writing style from sent emails using OpenAI"""
        if not self.service:
            return {
                'success': False,
                'error': 'Gmail not connected'
            }
        
        if not self.openai_client:
            return {
                'success': False,
                'error': 'OpenAI not available'
            }
        
        try:
            # Fetch sent emails (250 should fit in one request)
            print(f"📧 Fetching {max_emails} sent emails...")
            
            # Try different approaches to get sent emails
            print("🔍 Trying to find sent emails...")
            
            # First, let's see what labels are available
            try:
                labels = self.service.users().labels().list(userId='me').execute()
                print(f"📋 Available labels: {[label['name'] for label in labels.get('labels', [])]}")
            except Exception as e:
                print(f"❌ Error getting labels: {e}")
            
            # Try the standard SENT label
            results = self.service.users().messages().list(
                userId='me',
                labelIds=['SENT'],
                maxResults=max_emails
            ).execute()
            
            print(f"📧 SENT label query result: {results}")
            
            # If no results with SENT label, try without labelIds (all messages)
            if not results.get('messages'):
                print("🔍 No results with SENT label, trying all messages...")
                results = self.service.users().messages().list(
                    userId='me',
                    maxResults=max_emails
                ).execute()
                print(f"📧 All messages query result: {results}")
            
            messages = results.get('messages', [])
            print(f"📧 Found {len(messages)} sent emails")
            print(f"📧 Gmail API response: {results}")
            
            # Debug: Check if we have any messages at all
            if not messages:
                print("❌ No messages found in Gmail API response")
                print(f"❌ Full response: {results}")
                return {
                    'success': False,
                    'error': 'No sent emails found in Gmail API response'
                }
            sent_emails = []
            
            for msg in messages:
                msg_data = self.service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='full'
                ).execute()
                
                # Extract email body
                body = self._extract_email_body(msg_data)
                if body:
                    sent_emails.append(body)
            
            if not sent_emails:
                return {
                    'success': False,
                    'error': 'No sent emails found to analyze'
                }
            
            # Analyze writing style with OpenAI - DEEP LEARNING
            print(f"🧠 Deep learning writing style from {len(sent_emails)} emails...")
            
            analysis_prompt = f"""You are analyzing {len(sent_emails)} real business emails to create a PERFECT psychological and linguistic profile of this person's writing style.

📧 EMAIL SAMPLES:
{chr(10).join([f"━━━ EMAIL {i+1} ━━━{chr(10)}{email}{chr(10)}" for i, email in enumerate(sent_emails[:15])])}

🎯 CREATE A COMPREHENSIVE PROFILE:

1. **VOICE & PERSONALITY**
   - What is their unique voice? (formal, casual, direct, warm, authoritative, friendly)
   - Personality traits that show through their writing
   - Emotional tone (enthusiastic, reserved, matter-of-fact, empathetic)
   - Confidence level in their writing

2. **SIGNATURE PHRASES & PATTERNS**
   - Specific phrases they ALWAYS use (greetings, transitions, closings)
   - Their exact greeting style (e.g., "Hi", "Hello", "Hey", "Good morning")
   - Their exact closing style (e.g., "Thanks", "Best regards", "Cheers", "Best")
   - Filler words or connecting phrases they use
   - Any unique expressions or idioms

3. **SENTENCE STRUCTURE & RHYTHM**
   - Do they write short, punchy sentences or longer, flowing ones?
   - Do they use bullet points or numbered lists?
   - Paragraph length preferences
   - How do they structure information (direct first vs build-up)?

4. **PUNCTUATION & FORMATTING**
   - Use of exclamation marks (frequent, rare, never)
   - Use of emojis or emoticons (yes/no, which ones)
   - Comma usage patterns
   - Use of dashes, ellipses, parentheses
   - Capitalization preferences

5. **BUSINESS COMMUNICATION STYLE**
   - How direct or indirect are they?
   - Do they ask questions or make statements?
   - How do they handle requests (polite, direct, suggestive)?
   - Do they provide context before getting to the point?
   - Level of detail (brief, moderate, extensive)

6. **TONE & FORMALITY**
   - Professional level (corporate formal, business casual, friendly professional)
   - Use of humor or lightness
   - How they address people (formal titles vs first names)
   - Politeness patterns ("please", "thank you", "would you mind")

7. **RESPONSE PATTERNS**
   - How do they acknowledge received information?
   - How do they express agreement or disagreement?
   - How do they offer help or solutions?
   - How do they handle urgency or problems?

8. **VOCABULARY & LANGUAGE**
   - Technical terms they use
   - Industry jargon preferences
   - Simple vs complex vocabulary
   - Use of abbreviations or acronyms
   - Active vs passive voice preference

Return ONLY a detailed narrative profile that captures their EXACT voice. Write it as if you're describing how THIS SPECIFIC PERSON writes emails. Be specific with examples from their actual emails."""

            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",  # Using mini for cost efficiency
                messages=[
                    {
                        "role": "system",
                        "content": """You are a world-class linguistic profiler and communication expert. Your specialty is creating ultra-detailed personality profiles from writing samples. 

You don't just identify patterns - you CAPTURE THE SOUL of how someone writes. You notice:
- The tiny quirks that make their writing unique
- The emotional undertones in their word choices
- The psychological patterns behind their sentence structures
- The personality that shines through their punctuation

Create a profile so accurate that an AI using it could write emails that the person's colleagues would believe came from them."""
                    },
                    {
                        "role": "user",
                        "content": analysis_prompt
                    }
                ],
                temperature=0.2,
                max_tokens=3000
            )
            
            print("✅ Writing style deeply analyzed and learned")
            
            style_analysis = response.choices[0].message.content
            
            # Save writing style profile
            self.writing_style_profile = {
                'analyzed_date': datetime.now().isoformat(),
                'sample_count': len(sent_emails),
                'profile': style_analysis,
                'samples': sent_emails[:5]  # Keep first 5 for reference
            }
            
            # Save to file
            profile_path = self.credentials_path / 'writing_style.json'
            with open(profile_path, 'w', encoding='utf-8') as f:
                json.dump(self.writing_style_profile, f, indent=2)
            
            print(f"✅ Writing style profile created from {len(sent_emails)} emails")
            print(f"📄 Profile saved to: {profile_path}")
            
            return {
                'success': True,
                'sentEmailsCount': len(sent_emails),
                'emailsAnalyzed': len(sent_emails),  # Add this for frontend compatibility
                'profile': style_analysis,
                'message': f'Successfully learned your writing style from {len(sent_emails)} sent emails!'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error analyzing writing style: {str(e)}'
            }
    
    def generate_response(self, email_id: str, from_email: str, subject: str, snippet: str) -> Dict[str, Any]:
        """Generate AI response to an email using learned writing style"""
        if not self.service:
            return {
                'success': False,
                'error': 'Gmail not connected'
            }
        
        if not self.openai_client:
            return {
                'success': False,
                'error': 'OpenAI not available'
            }
        
        try:
            # Get full email content
            msg_data = self.service.users().messages().get(
                userId='me',
                id=email_id,
                format='full'
            ).execute()
            
            email_body = self._extract_email_body(msg_data)
            
            # Load writing style profile if not loaded
            if not self.writing_style_profile:
                profile_path = self.credentials_path / 'writing_style.json'
                if profile_path.exists():
                    with open(profile_path, 'r', encoding='utf-8') as f:
                        self.writing_style_profile = json.load(f)
            
            # Generate response using OpenAI with LEARNED STYLE
            print(f"✍️ Generating response as YOU for: {subject[:50]}...")
            
            if not self.writing_style_profile:
                print("⚠️ No writing style learned yet - generating generic professional response")
                style_context = "Professional and friendly business tone"
            else:
                style_context = self.writing_style_profile.get('profile', 'Professional and friendly tone')
                print(f"✅ Using your learned writing style (based on {self.writing_style_profile.get('sample_count', 0)} emails)")
            
            # Include sample emails for reference
            sample_emails = ""
            if self.writing_style_profile and 'samples' in self.writing_style_profile:
                sample_emails = f"""

📝 YOUR PREVIOUS EMAIL EXAMPLES FOR REFERENCE:
{chr(10).join([f"Example {i+1}:{chr(10)}{sample}{chr(10)}" for i, sample in enumerate(self.writing_style_profile['samples'][:3])])}
"""
            
            response_prompt = f"""🎯 YOUR MISSION: Write an email response that sounds EXACTLY like the person whose style is profiled below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DETAILED WRITING STYLE PROFILE (This is HOW they write):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{style_context}
{sample_emails}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 INCOMING EMAIL TO RESPOND TO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

From: {from_email}
Subject: {subject}

{email_body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✍️ WRITE THE RESPONSE:

CRITICAL REQUIREMENTS:
1. Use their EXACT greeting style (check the profile and examples!)
2. Match their sentence length and structure perfectly
3. Use their typical phrases and expressions
4. Match their punctuation patterns exactly
5. Match their level of detail and directness
6. Sound like THEM, not like generic "professional email"
7. If they use emojis, use them. If they don't, don't.
8. Match their formality level precisely
9. Capture their personality and voice

Address all points from the incoming email appropriately.

⚠️ IMPORTANT: DO NOT include any signature, closing phrase (like "Regards", "Best regards", etc.), or name at the end.
The user already has their email signature configured in Gmail which will be automatically added.

Return ONLY the email body content (greeting + message content). Stop BEFORE any closing/signature. No subject line. No explanations."""

            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",  # Using mini for cost efficiency
                messages=[
                    {
                        "role": "system",
                        "content": """You are a master ghostwriter and linguistic chameleon. Your superpower is writing in someone else's voice so perfectly that nobody can tell it wasn't written by them.

You don't just follow style guidelines - you BECOME the person. You:
- Use their exact greetings and closings
- Match their punctuation quirks perfectly  
- Capture their sentence rhythm and flow
- Use their specific phrases and expressions
- Match their emotional tone and personality
- Write at their level of detail and formality

The email you write should be INDISTINGUISHABLE from one they wrote themselves."""
                    },
                    {
                        "role": "user",
                        "content": response_prompt
                    }
                ],
                temperature=0.8,
                max_tokens=1500
            )
            
            print("✅ Response generated in YOUR voice")
            
            draft_body = response.choices[0].message.content
            
            # Generate reply subject
            reply_subject = subject if subject.startswith('Re:') else f'Re: {subject}'
            
            # Calculate confidence based on whether we have style profile
            confidence = 0.95 if self.writing_style_profile else 0.65
            reasoning = f"Written in your voice (learned from {self.writing_style_profile.get('sample_count', 0)} emails)" if self.writing_style_profile else "Generic professional response (learn your style first)"
            
            print(f"✅ Response ready - Confidence: {confidence*100:.0f}%")
            
            return {
                'success': True,
                'draft': {
                    'subject': reply_subject,
                    'body': draft_body,
                    'confidence': confidence,
                    'reasoning': reasoning
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error generating response: {str(e)}'
            }
    
    def _extract_body_from_raw_email(self, email_message) -> str:
        """Extract plain text body from raw RFC 2822 email message - gets EVERYTHING including forwards"""
        import email as email_lib
        
        text_parts = []
        
        try:
            # Walk through all parts of the email
            if email_message.is_multipart():
                for part in email_message.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get('Content-Disposition', ''))
                    
                    # Get text/plain parts (not attachments)
                    if content_type == 'text/plain' and 'attachment' not in content_disposition:
                        try:
                            payload = part.get_payload(decode=True)
                            if payload:
                                text = payload.decode('utf-8', errors='ignore')
                                text_parts.append(text)
                        except Exception as e:
                            print(f"Error decoding part: {e}")
            else:
                # Not multipart - just get the body
                try:
                    payload = email_message.get_payload(decode=True)
                    if payload:
                        text = payload.decode('utf-8', errors='ignore')
                        text_parts.append(text)
                except Exception as e:
                    print(f"Error decoding single-part email: {e}")
            
            # Combine all text parts
            full_text = '\n\n'.join(filter(None, text_parts))
            
            return full_text if full_text else ''
            
        except Exception as e:
            print(f"❌ Error extracting body from raw email: {e}")
            return ''
    
    def _extract_attachments_from_raw_email(self, email_message) -> List[Dict]:
        """Extract attachment information from raw email message"""
        attachments = []
        
        try:
            if email_message.is_multipart():
                for part in email_message.walk():
                    content_disposition = str(part.get('Content-Disposition', ''))
                    
                    # Check if this part is an attachment
                    if 'attachment' in content_disposition:
                        filename = part.get_filename()
                        if filename:
                            attachments.append({
                                'id': '',  # Raw format doesn't provide attachment ID
                                'filename': filename,
                                'mimeType': part.get_content_type(),
                                'size': len(part.get_payload(decode=False))
                            })
        except Exception as e:
            print(f"Error extracting attachments from raw email: {e}")
        
        return attachments
    
    def _extract_email_body(self, msg_data: Dict) -> str:
        """Extract plain text body from email message, including all parts recursively (LEGACY - for backwards compatibility)"""
        import base64
        
        def extract_text_from_part(part: Dict) -> str:
            """Recursively extract all text/plain content from a part"""
            text_parts = []
            
            try:
                mime_type = part.get('mimeType', '')
                
                # If this part is text/plain, extract it
                if mime_type == 'text/plain':
                    data = part.get('body', {}).get('data', '')
                    if data:
                        decoded = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                        text_parts.append(decoded)
                
                # If this part has nested parts, recursively extract from them
                if 'parts' in part:
                    for subpart in part['parts']:
                        text_parts.append(extract_text_from_part(subpart))
            
            except Exception as e:
                print(f"Error extracting text from part: {e}")
            
            return '\n'.join(filter(None, text_parts))
        
        try:
            payload = msg_data.get('payload', {})
            
            # Extract all text content recursively
            full_text = extract_text_from_part(payload)
            
            if full_text:
                return full_text
            
            # Fallback: try to get body data from top-level payload
            body_data = payload.get('body', {}).get('data', '')
            if body_data:
                return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
            
            return ''
            
        except Exception as e:
            print(f"❌ Error extracting email body: {e}")
            return ''
    
    def _extract_attachments_info(self, payload: Dict) -> List[Dict]:
        """Extract attachment information from email payload"""
        attachments = []
        try:
            if 'parts' in payload:
                for part in payload['parts']:
                    # Check if part has filename (indicates attachment)
                    if 'filename' in part and part['filename']:
                        attachment_info = {
                            'id': part['body'].get('attachmentId', ''),
                            'filename': part['filename'],
                            'mimeType': part.get('mimeType', 'application/octet-stream'),
                            'size': part['body'].get('size', 0)
                        }
                        attachments.append(attachment_info)
                    
                    # Recursively check nested parts
                    if 'parts' in part:
                        nested_attachments = self._extract_attachments_info(part)
                        attachments.extend(nested_attachments)
        except Exception as e:
            print(f"Error extracting attachment info: {e}")
        
        return attachments
    
    def download_attachment(self, email_id: str, attachment_id: str, filename: str) -> Dict[str, Any]:
        """Download an email attachment"""
        if not self.service:
            return {
                'success': False,
                'error': 'Gmail not connected'
            }
        
        try:
            import base64
            import tempfile
            
            # Get attachment data
            attachment = self.service.users().messages().attachments().get(
                userId='me',
                messageId=email_id,
                id=attachment_id
            ).execute()
            
            # Decode and save to temp file
            file_data = base64.urlsafe_b64decode(attachment['data'])
            
            # Create temp file
            temp_dir = Path(tempfile.gettempdir()) / 'email_attachments'
            temp_dir.mkdir(exist_ok=True)
            
            file_path = temp_dir / filename
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            print(f"✅ Downloaded attachment: {filename} ({len(file_data)} bytes)")
            
            return {
                'success': True,
                'file_path': str(file_path),
                'filename': filename,
                'size': len(file_data)
            }
        except HttpError as error:
            return {
                'success': False,
                'error': f'Gmail API error: {str(error)}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error downloading attachment: {str(e)}'
            }
    
    def parse_customer_po(self, pdf_path: str) -> Dict[str, Any]:
        """Parse customer purchase order PDF using OpenAI"""
        if not self.openai_client:
            return {
                'success': False,
                'error': 'OpenAI not available'
            }
        
        try:
            import pdfplumber
            
            # Extract text from PDF
            full_text = ""
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        full_text += page_text + "\n"
            
            # Use OpenAI to extract structured data
            extraction_prompt = f"""Extract purchase order information from this customer PO:

{full_text}

Return a JSON object with:
{{
    "po_number": "customer PO number",
    "customer_name": "customer company name",
    "order_date": "order date",
    "items": [
        {{
            "item_no": "item/product code",
            "description": "full product description",
            "quantity": number,
            "unit": "unit of measure (ea, kg, lb, gal, etc.)"
        }}
    ],
    "total_amount": number or null,
    "special_instructions": "any special notes or instructions"
}}

Be precise with item numbers and quantities. If unsure, include it in special_instructions."""

            # Use GPT-4o for PDF/attachment parsing (complex document understanding)
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",  # Keep 4o for attachments - needs strong vision/document parsing
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise data extraction assistant. Extract purchase order information accurately from documents."
                    },
                    {
                        "role": "user",
                        "content": extraction_prompt
                    }
                ],
                temperature=0.1,
                max_tokens=2000
            )
            
            import json
            po_data = json.loads(response.choices[0].message.content)
            
            print(f"✅ Parsed customer PO: {po_data.get('po_number', 'Unknown')}")
            print(f"   Items found: {len(po_data.get('items', []))}")
            
            return {
                'success': True,
                'po_data': po_data
            }
        except Exception as e:
            print(f"❌ Error parsing customer PO: {e}")
            return {
                'success': False,
                'error': f'Error parsing PO: {str(e)}'
            }
    
    def check_stock_for_po(self, po_data: Dict, inventory_data: Dict) -> Dict[str, Any]:
        """Check if we have enough stock for customer PO items
        
        PRIMARY SOURCE: CustomAlert5.json - Complete item master with stock levels
        
        CustomAlert5.json fields:
        - Item No.: Item number
        - Stock: Available stock quantity
        - Description: Item description
        """
        try:
            items = po_data.get('items', [])
            customalert5_data = inventory_data.get('CustomAlert5.json', [])
            
            print(f"\n📊 === STOCK CHECK: {len(items)} items ===")
            print(f"   CustomAlert5 records: {len(customalert5_data)}")
            
            stock_analysis = []
            insufficient_items = []
            
            for idx, item in enumerate(items, 1):
                item_no = item.get('item_no', '').strip().upper()
                qty_needed = float(item.get('quantity', 0))
                
                print(f"\n   Item {idx}: {item_no}")
                print(f"   └─ Need: {qty_needed}")
                
                # PRIMARY: Check CustomAlert5.json
                ca5_item = next((i for i in customalert5_data if i.get('Item No.', '').strip().upper() == item_no), None)
                
                if ca5_item:
                    print(f"   └─ ✅ Found in CustomAlert5")
                    data_source = 'CustomAlert5.json'
                    
                    # Get stock from CustomAlert5
                    total_stock = float(str(ca5_item.get('Stock', 0)).replace(',', ''))
                    available = total_stock
                    
                    print(f"   └─ Stock: {total_stock}")
                    print(f"   └─ Available: {available}")
                    
                    # Optional: Get additional info if available
                    total_reserved = 0  # CustomAlert5 doesn't track this
                    total_on_order = 0
                else:
                    print(f"   └─ ❌ NOT FOUND in CustomAlert5!")
                    data_source = 'NOT FOUND'
                    total_stock = 0
                    total_reserved = 0
                    total_on_order = 0
                    available = 0
                
                # Determine status
                sufficient = available >= qty_needed
                shortfall = max(0, qty_needed - available)
                
                if sufficient:
                    print(f"   └─ ✅ SUFFICIENT STOCK")
                else:
                    print(f"   └─ ❌ SHORTFALL: {shortfall:.0f} units")
                
                analysis = {
                    'item_no': item_no,
                    'description': item.get('description', ''),
                    'qty_needed': qty_needed,
                    'stock_available': available,
                    'stock_total': total_stock,
                    'reserved': total_reserved,
                    'on_order': total_on_order,
                    'sufficient': sufficient,
                    'shortfall': shortfall,
                    'status': '✅ Available' if sufficient else f'❌ Short {shortfall:.0f} units',
                    'data_source': data_source
                }
                
                stock_analysis.append(analysis)
                
                if not sufficient:
                    insufficient_items.append(analysis)
            
            # Overall assessment
            all_available = len(insufficient_items) == 0
            
            return {
                'success': True,
                'all_items_available': all_available,
                'total_items': len(items),
                'available_items': len(items) - len(insufficient_items),
                'insufficient_items': len(insufficient_items),
                'stock_analysis': stock_analysis,
                'needs_pr': len(insufficient_items) > 0,
                'insufficient_details': insufficient_items
            }
        except Exception as e:
            print(f"❌ Error checking stock: {e}")
            return {
                'success': False,
                'error': f'Error checking stock: {str(e)}'
            }

# Singleton instance
_gmail_service = None

def get_gmail_service() -> GmailEmailService:
    """Get or create Gmail service singleton"""
    global _gmail_service
    if _gmail_service is None:
        _gmail_service = GmailEmailService()
    return _gmail_service

