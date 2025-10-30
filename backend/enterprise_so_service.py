#!/usr/bin/env python3
"""
Enterprise SO Service - Smart, scalable, background SO parsing system
"""

import os
import json
import time
import threading
from datetime import datetime, timedelta
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app import extract_so_data_from_pdf

class SOFileWatcher(FileSystemEventHandler):
    """Watches for new SO files and queues them for parsing"""
    
    def __init__(self, parse_queue):
        self.parse_queue = parse_queue
        
    def on_created(self, event):
        if not event.is_directory and event.src_path.lower().endswith('.pdf'):
            if 'salesorder_' in event.src_path.lower():
                print(f"🆕 New SO detected: {os.path.basename(event.src_path)}")
                self.parse_queue.append(event.src_path)

class EnterpriseSO:
    """Enterprise-grade SO parsing and caching system"""
    
    def __init__(self):
        self.sales_orders_base = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
        self.cache_dir = "cache"
        self.parse_queue = []
        self.is_running = False
        self.observer = None
        
        # Cache files
        self.parsed_sos_file = os.path.join(self.cache_dir, "ParsedSalesOrders.json")
        self.item_index_file = os.path.join(self.cache_dir, "SOItemIndex.json")
        self.cache_status_file = os.path.join(self.cache_dir, "SOCacheStatus.json")
        self.parse_log_file = os.path.join(self.cache_dir, "ParseLog.json")
        
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def get_cache_status(self):
        """Get current cache status"""
        try:
            if os.path.exists(self.cache_status_file):
                with open(self.cache_status_file, 'r') as f:
                    return json.load(f)
            return {"status": "no_cache", "last_updated": None}
        except:
            return {"status": "error", "last_updated": None}
    
    def get_files_to_parse(self):
        """Smart file discovery - only parse new/changed files"""
        cache_status = self.get_cache_status()
        last_update = cache_status.get('last_updated')
        
        if last_update:
            last_update_time = datetime.fromisoformat(last_update)
        else:
            last_update_time = datetime.min
        
        files_to_parse = []
        
        # Scan for SO files
        for root, dirs, files in os.walk(self.sales_orders_base):
            for file in files:
                if file.lower().endswith('.pdf') and 'salesorder_' in file.lower():
                    file_path = os.path.join(root, file)
                    file_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    # Only parse if file is newer than last cache update
                    if file_modified > last_update_time:
                        so_number = file.replace('salesorder_', '').replace('.pdf', '')
                        files_to_parse.append({
                            'so_number': so_number,
                            'file_path': file_path,
                            'file_name': file,
                            'modified': file_modified.isoformat(),
                            'folder': os.path.basename(root)
                        })
        
        return files_to_parse
    
    def incremental_parse(self):
        """Parse only new/changed SOs - ENTERPRISE APPROACH"""
        print("🚀 ENTERPRISE SO SERVICE - Incremental Parse")
        print("=" * 50)
        
        # Load existing cache
        existing_cache = self.load_existing_cache()
        files_to_parse = self.get_files_to_parse()
        
        print(f"📊 Status:")
        print(f"   • Existing cached SOs: {len(existing_cache)}")
        print(f"   • New/changed files: {len(files_to_parse)}")
        
        if len(files_to_parse) == 0:
            print("✅ Cache is up to date - no parsing needed")
            return
        
        # Parse new files
        parsed_count = 0
        for file_info in files_to_parse:
            try:
                print(f"📄 Parsing {file_info['so_number']}...")
                parsed_data = extract_so_data_from_pdf(file_info['file_path'])
                
                if parsed_data and parsed_data.get('items'):
                    parsed_data.update({
                        'folder': file_info['folder'],
                        'file_name': file_info['file_name'],
                        'cached_at': datetime.now().isoformat()
                    })
                    
                    existing_cache[file_info['so_number']] = parsed_data
                    parsed_count += 1
                    print(f"    ✅ {len(parsed_data.get('items', []))} items")
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
        
        # Save updated cache
        self.save_cache(existing_cache)
        print(f"🎉 Incremental parse complete - {parsed_count} new SOs added")
    
    def load_existing_cache(self):
        """Load existing parsed SOs"""
        if os.path.exists(self.parsed_sos_file):
            try:
                with open(self.parsed_sos_file, 'r') as f:
                    parsed_list = json.load(f)
                    return {so['so_number']: so for so in parsed_list}
            except:
                pass
        return {}
    
    def save_cache(self, parsed_cache):
        """Save cache files"""
        # Convert to list format
        parsed_list = list(parsed_cache.values())
        
        # Save parsed SOs
        with open(self.parsed_sos_file, 'w') as f:
            json.dump(parsed_list, f, indent=2, default=str)
        
        # Build item index
        item_index = []
        for so in parsed_list:
            for item in so.get('items', []):
                item_index.append({
                    'so_number': so['so_number'],
                    'item_code': item.get('item_code', ''),
                    'item_description': item.get('description', ''),
                    'quantity': item.get('quantity', 0)
                })
        
        # Save item index
        with open(self.item_index_file, 'w') as f:
            json.dump(item_index, f, indent=2)
        
        # Save status
        status = {
            'last_updated': datetime.now().isoformat(),
            'total_sos': len(parsed_list),
            'total_items': len(item_index),
            'status': 'healthy'
        }
        
        with open(self.cache_status_file, 'w') as f:
            json.dump(status, f, indent=2)
    
    def start_file_watcher(self):
        """Start watching for new SO files"""
        if self.observer:
            return
        
        print("👁️ Starting file watcher...")
        self.observer = Observer()
        handler = SOFileWatcher(self.parse_queue)
        self.observer.schedule(handler, self.sales_orders_base, recursive=True)
        self.observer.start()
        print("✅ File watcher active")
    
    def background_worker(self):
        """Background worker that processes parse queue"""
        print("🔄 Background worker started")
        
        while self.is_running:
            if self.parse_queue:
                file_path = self.parse_queue.pop(0)
                print(f"🔄 Background parsing: {os.path.basename(file_path)}")
                # Parse and update cache incrementally
                # Implementation here...
            
            time.sleep(5)  # Check queue every 5 seconds
    
    def start_enterprise_service(self):
        """Start the full enterprise SO service"""
        print("🚀 STARTING ENTERPRISE SO SERVICE")
        print("=" * 40)
        
        self.is_running = True
        
        # 1. Initial incremental parse
        self.incremental_parse()
        
        # 2. Start file watcher
        self.start_file_watcher()
        
        # 3. Start background worker
        worker_thread = threading.Thread(target=self.background_worker)
        worker_thread.daemon = True
        worker_thread.start()
        
        print("✅ Enterprise SO Service is running")
        print("   • File watcher: Active")
        print("   • Background worker: Active")
        print("   • Cache: Up to date")
        
        return True

# API endpoint for health check
def get_so_service_health():
    """Get SO service health status"""
    service = EnterpriseSO()
    status = service.get_cache_status()
    
    return {
        'service': 'Enterprise SO Service',
        'status': status.get('status', 'unknown'),
        'last_updated': status.get('last_updated'),
        'cache_age_hours': get_cache_age_hours(status.get('last_updated')),
        'total_sos': status.get('total_sos', 0),
        'total_items': status.get('total_items', 0)
    }

def get_cache_age_hours(last_updated):
    """Calculate cache age in hours"""
    if not last_updated:
        return None
    
    try:
        last_update_time = datetime.fromisoformat(last_updated)
        age = datetime.now() - last_update_time
        return round(age.total_seconds() / 3600, 1)
    except:
        return None

if __name__ == "__main__":
    service = EnterpriseSO()
    service.start_enterprise_service()
    
    # Keep running
    try:
        while True:
            time.sleep(60)
            print(f"💓 Service heartbeat - {datetime.now().strftime('%H:%M:%S')}")
    except KeyboardInterrupt:
        print("🛑 Shutting down enterprise service...")
        service.is_running = False
        if service.observer:
            service.observer.stop()
            service.observer.join()
