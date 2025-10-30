#!/usr/bin/env python3
"""
SO Background Refresh Service
Automatically refreshes SO cache in the background to keep data current
"""

import os
import time
import threading
import schedule
from datetime import datetime, timedelta
from so_performance_optimizer import so_optimizer

class SOBackgroundRefresh:
    """Background service for automatic SO cache refresh"""
    
    def __init__(self):
        self.is_running = False
        self.refresh_thread = None
        self.last_refresh = None
        self.refresh_interval_minutes = 30  # Refresh every 30 minutes
        self.refresh_count = 0
        
    def start_background_refresh(self):
        """Start the background refresh service"""
        if self.is_running:
            print("⚠️ Background refresh already running")
            return
        
        print("🚀 Starting SO Background Refresh Service")
        print("=" * 50)
        
        self.is_running = True
        
        # Schedule refresh every 30 minutes
        schedule.every(self.refresh_interval_minutes).minutes.do(self._perform_refresh)
        
        # Start background thread
        self.refresh_thread = threading.Thread(target=self._background_worker, daemon=True)
        self.refresh_thread.start()
        
        print(f"✅ Background refresh started (every {self.refresh_interval_minutes} minutes)")
        
    def stop_background_refresh(self):
        """Stop the background refresh service"""
        if not self.is_running:
            print("⚠️ Background refresh not running")
            return
        
        print("🛑 Stopping SO Background Refresh Service")
        self.is_running = False
        
        if self.refresh_thread:
            self.refresh_thread.join(timeout=5)
        
        print("✅ Background refresh stopped")
    
    def _background_worker(self):
        """Background worker that runs scheduled refreshes"""
        print("🔄 Background worker started")
        
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                print(f"❌ Background worker error: {e}")
                time.sleep(60)
    
    def _perform_refresh(self):
        """Perform the actual refresh"""
        try:
            print(f"\n🔄 BACKGROUND REFRESH #{self.refresh_count + 1}")
            print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            start_time = time.time()
            
            # Check if cache needs refresh
            if so_optimizer.is_cache_valid():
                print("✅ Cache is still valid - skipping refresh")
                return
            
            print("🔄 Cache invalid - performing refresh...")
            
            # Force refresh
            refreshed_data = so_optimizer.force_refresh()
            
            refresh_time = time.time() - start_time
            self.last_refresh = datetime.now()
            self.refresh_count += 1
            
            print(f"✅ Background refresh completed:")
            print(f"   • Total Orders: {refreshed_data.get('TotalOrders', 0)}")
            print(f"   • Refresh Time: {refresh_time:.3f}s")
            print(f"   • Refresh Count: {self.refresh_count}")
            
        except Exception as e:
            print(f"❌ Background refresh error: {e}")
    
    def get_status(self):
        """Get background refresh status"""
        return {
            'is_running': self.is_running,
            'last_refresh': self.last_refresh.isoformat() if self.last_refresh else None,
            'refresh_count': self.refresh_count,
            'refresh_interval_minutes': self.refresh_interval_minutes,
            'next_refresh': self._get_next_refresh_time()
        }
    
    def _get_next_refresh_time(self):
        """Get next scheduled refresh time"""
        if not self.is_running or not self.last_refresh:
            return None
        
        next_refresh = self.last_refresh + timedelta(minutes=self.refresh_interval_minutes)
        return next_refresh.isoformat()
    
    def force_refresh_now(self):
        """Force an immediate refresh"""
        print("🔄 FORCING IMMEDIATE REFRESH")
        self._perform_refresh()

# Global instance
background_refresh = SOBackgroundRefresh()

def start_so_background_refresh():
    """Start the background refresh service"""
    background_refresh.start_background_refresh()

def stop_so_background_refresh():
    """Stop the background refresh service"""
    background_refresh.stop_background_refresh()

def get_so_refresh_status():
    """Get background refresh status"""
    return background_refresh.get_status()

def force_so_refresh_now():
    """Force immediate SO refresh"""
    background_refresh.force_refresh_now()

if __name__ == "__main__":
    # Test the background refresh service
    print("🧪 Testing SO Background Refresh Service")
    
    # Start service
    start_so_background_refresh()
    
    # Show status
    status = get_so_refresh_status()
    print(f"Status: {status}")
    
    # Keep running for testing
    try:
        while True:
            time.sleep(60)
            print(f"💓 Service heartbeat - {datetime.now().strftime('%H:%M:%S')}")
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        stop_so_background_refresh()
