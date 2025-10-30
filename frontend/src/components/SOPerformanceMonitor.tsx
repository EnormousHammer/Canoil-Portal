import React, { useState, useEffect } from 'react';

interface SOPerformanceStats {
  cache_hits: number;
  cache_misses: number;
  hit_rate_percent: number;
  total_requests: number;
  cache_valid: boolean;
  cache_size_mb: number;
}

interface SOBackgroundRefresh {
  is_running: boolean;
  last_refresh: string | null;
  refresh_count: number;
  refresh_interval_minutes: number;
  next_refresh: string | null;
}

interface SOPerformanceMonitorProps {
  data: any;
  onRefresh?: () => void;
}

export const SOPerformanceMonitor: React.FC<SOPerformanceMonitorProps> = ({ data, onRefresh }) => {
  const [performanceStats, setPerformanceStats] = useState<SOPerformanceStats | null>(null);
  const [backgroundRefresh, setBackgroundRefresh] = useState<SOBackgroundRefresh | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  // Get performance stats from data
  useEffect(() => {
    if (data?.SOPerformanceStats) {
      setPerformanceStats(data.SOPerformanceStats);
    }
    if (data?.SOBackgroundRefresh) {
      setBackgroundRefresh(data.SOBackgroundRefresh);
    }
  }, [data]);

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/so-performance/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setLastRefresh(new Date().toLocaleTimeString());
        
        // Trigger parent refresh if callback provided
        if (onRefresh) {
          onRefresh();
        }
        
        console.log('✅ SO cache refreshed successfully');
      } else {
        console.error('❌ Failed to refresh SO cache');
      }
    } catch (error) {
      console.error('❌ Error refreshing SO cache:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getPerformanceColor = (hitRate: number) => {
    if (hitRate >= 80) return 'text-green-600';
    if (hitRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCacheStatusColor = (isValid: boolean) => {
    return isValid ? 'text-green-600' : 'text-red-600';
  };

  if (!performanceStats) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">SO Performance Monitor</h3>
        <p className="text-gray-500">Performance data not available</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">SO Performance Monitor</h3>
        <div className="flex items-center space-x-3">
          {lastRefresh && (
            <span className="text-sm text-gray-500">
              Last refresh: {lastRefresh}
            </span>
          )}
          <button
            onClick={handleRefreshCache}
            disabled={isRefreshing}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isRefreshing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Cache'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cache Hit Rate */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
              <p className={`text-2xl font-bold ${getPerformanceColor(performanceStats.hit_rate_percent)}`}>
                {performanceStats.hit_rate_percent}%
              </p>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
        </div>

        {/* Cache Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cache Status</p>
              <p className={`text-lg font-semibold ${getCacheStatusColor(performanceStats.cache_valid)}`}>
                {performanceStats.cache_valid ? 'Valid' : 'Invalid'}
              </p>
            </div>
            <div className="text-3xl">💾</div>
          </div>
        </div>

        {/* Cache Size */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cache Size</p>
              <p className="text-2xl font-bold text-blue-600">
                {performanceStats.cache_size_mb} MB
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-purple-600">
                {performanceStats.total_requests}
              </p>
            </div>
            <div className="text-3xl">🔄</div>
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">Cache Hits</h4>
          <p className="text-3xl font-bold text-green-600">{performanceStats.cache_hits}</p>
          <p className="text-sm text-green-600 mt-1">Fast loads from cache</p>
        </div>

        <div className="bg-red-50 p-4 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">Cache Misses</h4>
          <p className="text-3xl font-bold text-red-600">{performanceStats.cache_misses}</p>
          <p className="text-sm text-red-600 mt-1">Fresh scans required</p>
        </div>
      </div>

      {/* Background Refresh Status */}
      {backgroundRefresh && (
        <div className="mt-6 bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-3">Background Refresh Service</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-green-700">Service Status</p>
              <p className={`text-lg font-semibold ${backgroundRefresh.is_running ? 'text-green-600' : 'text-red-600'}`}>
                {backgroundRefresh.is_running ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Refresh Interval</p>
              <p className="text-lg font-semibold text-green-600">
                Every {backgroundRefresh.refresh_interval_minutes} minutes
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Last Refresh</p>
              <p className="text-sm text-green-600">
                {backgroundRefresh.last_refresh 
                  ? new Date(backgroundRefresh.last_refresh).toLocaleString()
                  : 'Never'
                }
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Refresh Count</p>
              <p className="text-lg font-semibold text-green-600">
                {backgroundRefresh.refresh_count}
              </p>
            </div>
          </div>
          {backgroundRefresh.next_refresh && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-sm text-green-700">
                Next refresh: {new Date(backgroundRefresh.next_refresh).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Performance Tips */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">Performance Tips</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Higher hit rate = faster loading (aim for 80%+)</li>
          <li>• Cache refreshes automatically when files change</li>
          <li>• Local file access is much faster than network</li>
          <li>• Large cache size indicates comprehensive data coverage</li>
          <li>• Background service keeps data fresh automatically</li>
        </ul>
      </div>
    </div>
  );
};

export default SOPerformanceMonitor;
