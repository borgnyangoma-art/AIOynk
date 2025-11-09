// React performance monitoring dashboard component

import React, { useState, useEffect } from 'react';
import { performanceMonitor, PerformanceAlert } from '../utils/performanceMonitoring';
import { resourcePrioritizer } from '../utils/resourcePrioritizer';

interface Props {
  isVisible?: boolean;
  onClose?: () => void;
}

const PerformanceDashboard: React.FC<Props> = ({ isVisible = false, onClose }) => {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [stats, setStats] = useState<any>({});
  const [queueStatus, setQueueStatus] = useState({ pending: 0, running: 0, completed: 0, cancelled: 0 });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [cachePattern, setCachePattern] = useState('cache:*');
  const [cacheKeys, setCacheKeys] = useState<string[]>([]);
  const [applicationCacheEntries, setApplicationCacheEntries] = useState<any[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [cdnInvalidations, setCdnInvalidations] = useState<any[]>([]);

  useEffect(() => {
    if (!isVisible) return;

    // Load initial data
    loadData();

    // Setup interval for auto-refresh
    if (autoRefresh) {
      const interval = setInterval(loadData, 2000);
      return () => clearInterval(interval);
    }
  }, [isVisible, autoRefresh]);

  const loadData = () => {
    setAlerts(performanceMonitor.getAlerts());
    setStats(performanceMonitor.checkSLACompliance());
    setQueueStatus(resourcePrioritizer.getQueueStatus());
    void loadCacheData(cachePattern);
  };

  const loadCacheData = async (pattern: string = cachePattern) => {
    if (!isVisible) return;
    setCacheLoading(true);
    setCacheError(null);
    try {
      const [redisRes, appRes, cdnRes] = await Promise.all([
        fetch(`/api/cache?pattern=${encodeURIComponent(pattern)}`, { credentials: 'include' }),
        fetch('/api/cache/application', { credentials: 'include' }),
        fetch('/api/cache/cdn', { credentials: 'include' }),
      ]);

      if (!redisRes.ok) {
        throw new Error('Failed to load cache keys');
      }
      if (!appRes.ok) {
        throw new Error('Failed to load application cache');
      }
      if (!cdnRes.ok) {
        throw new Error('Failed to load CDN invalidations');
      }

      const redisJson = await redisRes.json();
      const appJson = await appRes.json();
      const cdnJson = await cdnRes.json();
      setCacheKeys(redisJson?.data?.keys ?? []);
      setApplicationCacheEntries(appJson?.data?.entries ?? []);
      setCdnInvalidations(cdnJson?.data?.invalidations ?? []);
    } catch (error) {
      setCacheError(error instanceof Error ? error.message : 'Failed to load cache data');
    } finally {
      setCacheLoading(false);
    }
  };

  const invalidateRedisCache = async () => {
    try {
      await fetch('/api/cache', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pattern: cachePattern }),
      });
      await loadCacheData(cachePattern);
    } catch (error) {
      setCacheError(error instanceof Error ? error.message : 'Failed to invalidate cache');
    }
  };

  const invalidateApplicationCache = async () => {
    try {
      await fetch('/api/cache/application', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pattern: cachePattern }),
      });
      await loadCacheData(cachePattern);
    } catch (error) {
      setCacheError(error instanceof Error ? error.message : 'Failed to invalidate application cache');
    }
  };

  const triggerCdnInvalidation = async () => {
    try {
      await fetch('/api/cache/cdn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pattern: cachePattern }),
      });
      await loadCacheData(cachePattern);
    } catch (error) {
      setCacheError(error instanceof Error ? error.message : 'Failed to schedule CDN invalidation');
    }
  };

  const clearMetrics = () => {
    performanceMonitor.clearMetrics();
    loadData();
  };

  const exportMetrics = () => {
    const data = performanceMonitor.exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Performance Dashboard</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="form-checkbox"
              />
              Auto Refresh
            </label>
            <button
              onClick={loadData}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Refresh
            </button>
            <button
              onClick={exportMetrics}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Export
            </button>
            <button
              onClick={clearMetrics}
              className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
            >
              Clear
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* SLA Compliance */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">SLA Compliance (5s Response Time)</h3>
            <div className={`p-3 rounded ${stats.compliant ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {stats.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
                </span>
                <span>{Math.round((stats.compliant ? 100 : 0))}% of checks passing</span>
              </div>
            </div>
            {stats.details && (
              <div className="mt-2 space-y-1">
                {stats.details.map((check: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded ${
                      check.status === 'pass' ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <span className="text-sm">{check.metric}</span>
                    <span className="text-sm font-mono">
                      {check.actual.toFixed(2)} / {check.threshold}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Critical Alerts */}
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Critical Alerts</h3>
            {alerts.filter((a) => a.severity === 'critical').length === 0 ? (
              <p className="text-sm text-gray-600">No critical alerts</p>
            ) : (
              <div className="space-y-2">
                {alerts
                  .filter((a) => a.severity === 'critical')
                  .slice(0, 5)
                  .map((alert, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border-l-4 border-red-500">
                      <div className="font-semibold text-red-700">{alert.metric}</div>
                      <div className="text-sm text-gray-700">{alert.message}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Performance Metrics */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Performance Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              {['LCP', 'FID', 'CLS', 'PAGE_LOAD', 'API_CALL'].map((metric) => {
                const metricStats = performanceMonitor.getStats(metric);
                return (
                  <div key={metric} className="bg-white p-3 rounded">
                    <div className="font-semibold text-blue-700">{metric}</div>
                    {metricStats ? (
                      <div className="text-sm mt-1 space-y-1">
                        <div>Avg: {metricStats.averageResponseTime.toFixed(2)}ms</div>
                        <div>P95: {metricStats.p95ResponseTime.toFixed(2)}ms</div>
                        {metric === 'API_CALL' && (
                          <>
                            <div>Success: {(metricStats.successRate * 100).toFixed(1)}%</div>
                            <div>Total: {metricStats.totalRequests}</div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No data</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resource Queue Status */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Resource Queue Status</h3>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white p-3 rounded text-center">
                <div className="text-2xl font-bold text-blue-600">{queueStatus.pending}</div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
              <div className="bg-white p-3 rounded text-center">
                <div className="text-2xl font-bold text-yellow-600">{queueStatus.running}</div>
                <div className="text-sm text-gray-600">Running</div>
              </div>
              <div className="bg-white p-3 rounded text-center">
                <div className="text-2xl font-bold text-green-600">{queueStatus.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="bg-white p-3 rounded text-center">
                <div className="text-2xl font-bold text-gray-600">{queueStatus.cancelled}</div>
                <div className="text-sm text-gray-600">Cancelled</div>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Recent Alerts</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-600">No alerts</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts.slice(0, 10).map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded ${
                      alert.severity === 'critical'
                        ? 'bg-red-100 border-l-4 border-red-500'
                        : alert.severity === 'error'
                        ? 'bg-orange-100 border-l-4 border-orange-500'
                        : 'bg-yellow-100 border-l-4 border-yellow-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{alert.metric}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">{alert.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cache Inspector */}
          <div className="bg-white rounded-lg p-4 border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cache Inspector</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  value={cachePattern}
                  onChange={(event) => setCachePattern(event.target.value)}
                  placeholder="cache:*"
                />
                <button
                  onClick={() => loadCacheData(cachePattern)}
                  className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                  disabled={cacheLoading}
                >
                  Refresh
                </button>
              </div>
            </div>

            {cacheError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {cacheError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Redis Keys</span>
                  <button
                    onClick={invalidateRedisCache}
                    className="text-xs text-red-600 hover:underline disabled:text-red-300"
                    disabled={cacheLoading}
                  >
                    Invalidate
                  </button>
                </div>
                {cacheKeys.length === 0 ? (
                  <p className="text-xs text-gray-500">No keys match pattern.</p>
                ) : (
                  <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                    {cacheKeys.map((key) => (
                      <li key={key} className="truncate">
                        {key}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Application Cache</span>
                  <button
                    onClick={invalidateApplicationCache}
                    className="text-xs text-red-600 hover:underline disabled:text-red-300"
                    disabled={cacheLoading}
                  >
                    Clear
                  </button>
                </div>
                {applicationCacheEntries.length === 0 ? (
                  <p className="text-xs text-gray-500">No entries cached.</p>
                ) : (
                  <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                    {applicationCacheEntries.slice(0, 10).map((entry: any) => (
                      <li key={entry.key} className="flex items-center justify-between gap-2">
                        <span className="truncate">{entry.key}</span>
                        <span className="text-[10px] text-gray-400">
                          ttl: {Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000))}s
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">CDN Invalidation</p>
                <p className="text-xs text-gray-500">
                  Pending: {cdnInvalidations.filter((item: any) => item.status === 'pending').length} • Total:{' '}
                  {cdnInvalidations.length}
                </p>
              </div>
              <button
                onClick={triggerCdnInvalidation}
                className="px-3 py-1 rounded bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:bg-purple-300"
                disabled={cacheLoading}
              >
                Purge Pattern
              </button>
            </div>

            {cdnInvalidations.length > 0 && (
              <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                {cdnInvalidations.slice(0, 6).map((entry: any) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded border border-gray-100 px-2 py-1"
                  >
                    <span className="truncate">{entry.pattern}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] ${
                        entry.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
