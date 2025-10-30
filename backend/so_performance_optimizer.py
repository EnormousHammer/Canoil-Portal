#!/usr/bin/env python3
"""
SO Performance Optimizer - Ultra-fast local sales order loading
Optimized for local file system access with intelligent caching
"""

import os
import json
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import pickle
import hashlib

class SOPerformanceOptimizer:
    """Ultra-fast SO loading with local file optimization"""
    
    def __init__(self):
        self.sales_orders_base = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
        self.cache_dir = "so_cache"
        self.performance_cache = os.path.join(self.cache_dir, "performance_cache.pkl")
        self.metadata_file = os.path.join(self.cache_dir, "cache_metadata.json")
        self.last_scan_file = os.path.join(self.cache_dir, "last_scan.json")
        
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Performance tracking
        self.load_times = []
        self.cache_hits = 0
        self.cache_misses = 0
        
    def get_file_hash(self, file_path: str) -> str:
        """Get file hash for change detection"""
        try:
            with open(file_path, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except:
            return ""
    
    def is_cache_valid(self) -> bool:
        """Check if cache is still valid (files haven't changed)"""
        try:
            if not os.path.exists(self.metadata_file):
                return False
                
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)
            
            # Check if any SO files have changed since last scan
            last_scan_time = datetime.fromisoformat(metadata.get('last_scan', '1970-01-01'))
            current_scan_time = datetime.now()
            
            # If cache is older than 1 hour, refresh
            if (current_scan_time - last_scan_time).total_seconds() > 3600:
                return False
            
            # Check file modification times
            for file_info in metadata.get('file_hashes', []):
                file_path = file_info['path']
                if os.path.exists(file_path):
                    current_hash = self.get_file_hash(file_path)
                    if current_hash != file_info['hash']:
                        print(f"🔄 File changed: {os.path.basename(file_path)}")
                        return False
                else:
                    print(f"🔄 File removed: {os.path.basename(file_path)}")
                    return False
            
            return True
            
        except Exception as e:
            print(f"⚠️ Cache validation error: {e}")
            return False
    
    def scan_so_files_fast(self) -> Dict[str, Any]:
        """Ultra-fast SO file scanning with metadata tracking"""
        start_time = time.time()
        print("🚀 ULTRA-FAST SO SCAN - Local File Optimization")
        print("=" * 50)
        
        if not os.path.exists(self.sales_orders_base):
            print(f"❌ Sales Orders path not accessible: {self.sales_orders_base}")
            return {}
        
        # Discover status folders
        status_folders = []
        for item in os.listdir(self.sales_orders_base):
            item_path = os.path.join(self.sales_orders_base, item)
            if os.path.isdir(item_path) and item != 'desktop.ini':
                status_folders.append(item)
        
        print(f"📁 Found {len(status_folders)} status folders: {status_folders}")
        
        all_orders = []
        file_metadata = []
        sales_data = {}
        
        # Fast recursive scan with metadata collection
        for status in status_folders:
            folder_path = os.path.join(self.sales_orders_base, status)
            orders = []
            
            # Use os.walk for efficient recursive scanning
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    if file.lower().endswith('.pdf') and 'salesorder_' in file.lower():
                        file_path = os.path.join(root, file)
                        
                        # Extract SO number
                        so_number = file.replace('salesorder_', '').replace('.pdf', '')
                        
                        # Create lightweight order object
                        order = {
                            'Order No.': so_number,
                            'File Path': file_path,
                            'File Name': file,
                            'Status': status,
                            'Folder': os.path.basename(root),
                            'Modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
                            'Size': os.path.getsize(file_path)
                        }
                        
                        orders.append(order)
                        all_orders.append(order)
                        
                        # Track file metadata for cache validation
                        file_metadata.append({
                            'path': file_path,
                            'hash': self.get_file_hash(file_path),
                            'modified': os.path.getmtime(file_path)
                        })
            
            sales_data[status] = orders
            print(f"✅ {status}: {len(orders)} orders")
        
        # Smart sorting by order number
        def smart_sort(order):
            try:
                order_num = order['Order No.']
                import re
                numbers = re.findall(r'\d+', order_num)
                return int(numbers[0]) if numbers else 0
            except:
                return 0
        
        all_orders.sort(key=smart_sort, reverse=True)
        
        # Save metadata for cache validation
        metadata = {
            'last_scan': datetime.now().isoformat(),
            'total_orders': len(all_orders),
            'status_folders': status_folders,
            'file_hashes': file_metadata
        }
        
        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        scan_time = time.time() - start_time
        print(f"⚡ SCAN COMPLETE: {len(all_orders)} orders in {scan_time:.2f}s")
        
        return {
            'SalesOrders.json': all_orders,
            'SalesOrdersByStatus': sales_data,
            'LoadTimestamp': datetime.now().isoformat(),
            'TotalOrders': len(all_orders),
            'StatusFolders': status_folders,
            'ScanMethod': 'Ultra-Fast Local Scan',
            'ScanTime': scan_time
        }
    
    def load_so_data_optimized(self) -> Dict[str, Any]:
        """Load SO data with intelligent caching"""
        start_time = time.time()
        
        # Check if we have valid cache
        if self.is_cache_valid() and os.path.exists(self.performance_cache):
            print("⚡ CACHE HIT: Loading from optimized cache...")
            try:
                with open(self.performance_cache, 'rb') as f:
                    cached_data = pickle.load(f)
                
                self.cache_hits += 1
                load_time = time.time() - start_time
                print(f"🚀 INSTANT LOAD: {cached_data.get('TotalOrders', 0)} orders in {load_time:.3f}s")
                
                # Add performance metrics
                cached_data['LoadMethod'] = 'Cached'
                cached_data['LoadTime'] = load_time
                cached_data['CacheHit'] = True
                
                return cached_data
                
            except Exception as e:
                print(f"⚠️ Cache load error: {e}")
                self.cache_misses += 1
        
        # Cache miss - perform fresh scan
        print("🔄 CACHE MISS: Performing fresh scan...")
        self.cache_misses += 1
        
        fresh_data = self.scan_so_files_fast()
        
        # Save to performance cache
        try:
            with open(self.performance_cache, 'wb') as f:
                pickle.dump(fresh_data, f)
            print("💾 Cache updated for next load")
        except Exception as e:
            print(f"⚠️ Cache save error: {e}")
        
        load_time = time.time() - start_time
        fresh_data['LoadMethod'] = 'Fresh Scan'
        fresh_data['LoadTime'] = load_time
        fresh_data['CacheHit'] = False
        
        return fresh_data
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        total_requests = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'hit_rate_percent': round(hit_rate, 1),
            'total_requests': total_requests,
            'cache_valid': self.is_cache_valid(),
            'cache_size_mb': self.get_cache_size_mb()
        }
    
    def get_cache_size_mb(self) -> float:
        """Get cache file size in MB"""
        try:
            if os.path.exists(self.performance_cache):
                size_bytes = os.path.getsize(self.performance_cache)
                return round(size_bytes / (1024 * 1024), 2)
        except:
            pass
        return 0.0
    
    def clear_cache(self):
        """Clear performance cache"""
        try:
            if os.path.exists(self.performance_cache):
                os.remove(self.performance_cache)
            if os.path.exists(self.metadata_file):
                os.remove(self.metadata_file)
            print("🗑️ Performance cache cleared")
        except Exception as e:
            print(f"⚠️ Cache clear error: {e}")
    
    def force_refresh(self):
        """Force cache refresh"""
        print("🔄 FORCING CACHE REFRESH...")
        self.clear_cache()
        return self.load_so_data_optimized()

# Global instance for app.py integration
so_optimizer = SOPerformanceOptimizer()

def get_optimized_so_data():
    """Get optimized SO data - main entry point"""
    return so_optimizer.load_so_data_optimized()

def get_so_performance_stats():
    """Get SO loading performance statistics"""
    return so_optimizer.get_performance_stats()

def force_so_refresh():
    """Force SO data refresh"""
    return so_optimizer.force_refresh()

if __name__ == "__main__":
    # Test the optimizer
    print("🧪 Testing SO Performance Optimizer...")
    
    # First load (should be fresh scan)
    data1 = get_optimized_so_data()
    print(f"First load: {data1.get('TotalOrders', 0)} orders in {data1.get('LoadTime', 0):.3f}s")
    
    # Second load (should be cache hit)
    data2 = get_optimized_so_data()
    print(f"Second load: {data2.get('TotalOrders', 0)} orders in {data2.get('LoadTime', 0):.3f}s")
    
    # Performance stats
    stats = get_so_performance_stats()
    print(f"Performance: {stats['hit_rate_percent']}% hit rate, {stats['cache_size_mb']}MB cache")
