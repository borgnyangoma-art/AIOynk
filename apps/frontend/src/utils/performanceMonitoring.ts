// Performance monitoring utilities for ensuring 5-second response time SLA

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url?: string;
  method?: string;
  status?: number;
}

export interface PerformanceAlert {
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
  severity: 'warning' | 'error' | 'critical';
}

export interface PerformanceStats {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  totalRequests: number;
  errorCount: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private startTime: number = Date.now();
  private isEnabled: boolean = true;
  private readonly SLA_THRESHOLD = 5000; // 5 seconds in milliseconds
  private readonly SUCCESS_RATE_THRESHOLD = 0.95; // 95%
  private observers: PerformanceObserver[] = [];

  // Enable performance monitoring
  enable(): void {
    this.isEnabled = true;
    this.setupObservers();
  }

  // Disable performance monitoring
  disable(): void {
    this.isEnabled = false;
    this.cleanupObservers();
  }

  // Setup performance observers
  private setupObservers(): void {
    if (typeof window === 'undefined' || !window.PerformanceObserver) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    // Measure Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('LCP', lastEntry.startTime, {
          url: window.location.href,
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (e) {
      console.warn('LCP measurement not supported');
    }

    // Measure First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fid = entry.processingStart - entry.startTime;
          this.recordMetric('FID', fid, {
            url: window.location.href,
          });
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (e) {
      console.warn('FID measurement not supported');
    }

    // Measure Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.recordMetric('CLS', clsValue, {
              url: window.location.href,
            });
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (e) {
      console.warn('CLS measurement not supported');
    }

    // Measure resource loading
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const duration = entry.responseEnd - entry.startTime;
          this.recordMetric('RESOURCE_LOAD', duration, {
            url: entry.name,
            method: entry.initiatorType,
          });

          // Check SLA for critical resources
          if (this.isCriticalResource(entry.name) && duration > this.SLA_THRESHOLD) {
            this.raiseAlert(
              'RESOURCE_LOAD',
              duration,
              this.SLA_THRESHOLD,
              `Resource ${entry.name} exceeded SLA threshold`,
              'warning'
            );
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (e) {
      console.warn('Resource measurement not supported');
    }

    // Measure navigation timing
    try {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const navEntry = entry as PerformanceNavigationTiming;

          // DNS lookup time
          this.recordMetric('DNS_LOOKUP', navEntry.domainLookupEnd - navEntry.domainLookupStart, {
            url: entry.name,
          });

          // TCP connection time
          this.recordMetric('TCP_CONNECTION', navEntry.connectEnd - navEntry.connectStart, {
            url: entry.name,
          });

          // Server response time
          this.recordMetric('SERVER_RESPONSE', navEntry.responseEnd - navEntry.requestStart, {
            url: entry.name,
          });

          // DOM content loaded
          this.recordMetric('DOM_CONTENT_LOADED', navEntry.domContentLoadedEventEnd - navEntry.startTime, {
            url: entry.name,
          });

          // Load complete
          this.recordMetric('PAGE_LOAD', navEntry.loadEventEnd - navEntry.startTime, {
            url: entry.name,
          });
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);
    } catch (e) {
      console.warn('Navigation timing measurement not supported');
    }
  }

  // Cleanup observers
  private cleanupObservers(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }

  // Check if resource is critical
  private isCriticalResource(url: string): boolean {
    const criticalPatterns = [
      /\/main\./,
      /\/chunk/,
      /\/vendor/,
      /index\.html/,
    ];

    return criticalPatterns.some((pattern) => pattern.test(url));
  }

  // Record a performance metric
  recordMetric(
    name: string,
    value: number,
    metadata: Record<string, any> = {}
  ): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      ...metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only last 1000 metrics per type
    if (metrics.length > 1000) {
      metrics.shift();
    }

    // Check for alerts
    this.checkAlerts(name, value);
  }

  // Start measuring API call
  startAPICall(url: string, method: string = 'GET'): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!this.isEnabled) return id;

    // Store start time
    performance.mark(`api-call-${id}-start`);

    return id;
  }

  // End measuring API call
  endAPICall(id: string, url: string, method: string, status?: number): void {
    if (!this.isEnabled) return;

    performance.mark(`api-call-${id}-end`);

    try {
      performance.measure(
        `api-call-${id}`,
        `api-call-${id}-start`,
        `api-call-${id}-end`
      );

      const measure = performance.getEntriesByName(`api-call-${id}`, 'measure')[0];
      const duration = measure.duration;

      this.recordMetric('API_CALL', duration, {
        url,
        method,
        status,
      });

      // Check SLA
      if (duration > this.SLA_THRESHOLD) {
        this.raiseAlert(
          'API_CALL',
          duration,
          this.SLA_THRESHOLD,
          `API call to ${url} took ${duration.toFixed(2)}ms (SLA: ${this.SLA_THRESHOLD}ms)`,
          duration > this.SLA_THRESHOLD * 2 ? 'error' : 'warning'
        );
      }

      // Check success rate
      if (status && status >= 400) {
        this.recordMetric('API_ERROR', 1, { url, method, status });
      }

      // Cleanup marks
      performance.clearMarks(`api-call-${id}-start`);
      performance.clearMarks(`api-call-${id}-end`);
      performance.clearMeasures(`api-call-${id}`);
    } catch (e) {
      console.warn('Error measuring API call:', e);
    }
  }

  // Raise performance alert
  private raiseAlert(
    metric: string,
    value: number,
    threshold: number,
    message: string,
    severity: 'warning' | 'error' | 'critical'
  ): void {
    const alert: PerformanceAlert = {
      metric,
      value,
      threshold,
      message,
      severity,
      timestamp: Date.now(),
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Log alert
    console.warn(`[Performance Alert] ${severity.toUpperCase()}: ${message}`);

    // Dispatch custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-alert', { detail: alert }));
    }
  }

  // Check for alerts
  private checkAlerts(name: string, value: number): void {
    switch (name) {
      case 'LCP':
        if (value > 2500) {
          this.raiseAlert(
            name,
            value,
            2500,
            `LCP is ${value.toFixed(2)}ms (should be < 2500ms)`,
            value > 4000 ? 'critical' : 'warning'
          );
        }
        break;

      case 'FID':
        if (value > 100) {
          this.raiseAlert(
            name,
            value,
            100,
            `FID is ${value.toFixed(2)}ms (should be < 100ms)`,
            value > 300 ? 'critical' : 'warning'
          );
        }
        break;

      case 'CLS':
        if (value > 0.1) {
          this.raiseAlert(
            name,
            value,
            0.1,
            `CLS is ${value.toFixed(3)} (should be < 0.1)`,
            value > 0.25 ? 'critical' : 'warning'
          );
        }
        break;

      case 'PAGE_LOAD':
        if (value > 3000) {
          this.raiseAlert(
            name,
            value,
            3000,
            `Page load time is ${value.toFixed(2)}ms (should be < 3000ms)`,
            value > 5000 ? 'critical' : 'warning'
          );
        }
        break;
    }
  }

  // Get performance statistics
  getStats(metricName: string): PerformanceStats | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const total = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / total;
    const p95Index = Math.floor(total * 0.95);
    const p99Index = Math.floor(total * 0.99);

    const apiMetrics = metrics.filter((m) => m.name === 'API_CALL');
    const errorMetrics = metrics.filter((m) => m.name === 'API_ERROR');

    const successRate = apiMetrics.length > 0
      ? 1 - errorMetrics.length / apiMetrics.length
      : 1;

    return {
      averageResponseTime: average,
      p95ResponseTime: values[p95Index] || 0,
      p99ResponseTime: values[p99Index] || 0,
      successRate,
      totalRequests: apiMetrics.length,
      errorCount: errorMetrics.length,
    };
  }

  // Get metrics by name
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  // Get all alerts
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  // Get critical alerts
  getCriticalAlerts(): PerformanceAlert[] {
    return this.alerts.filter((a) => a.severity === 'critical');
  }

  // Check SLA compliance
  checkSLACompliance(): {
    compliant: boolean;
    details: {
      metric: string;
      actual: number;
      threshold: number;
      status: 'pass' | 'fail';
    }[];
  } {
    const apiStats = this.getStats('API_CALL');
    const lcpStats = this.getStats('LCP');
    const fidStats = this.getStats('FID');
    const clsStats = this.getStats('CLS');

    const checks = [
      {
        metric: 'API Response Time (P95)',
        actual: apiStats?.p95ResponseTime || 0,
        threshold: this.SLA_THRESHOLD,
        status: (apiStats?.p95ResponseTime || 0) <= this.SLA_THRESHOLD ? 'pass' as const : 'fail' as const,
      },
      {
        metric: 'Largest Contentful Paint',
        actual: lcpStats?.averageResponseTime || 0,
        threshold: 2500,
        status: (lcpStats?.averageResponseTime || 0) <= 2500 ? 'pass' as const : 'fail' as const,
      },
      {
        metric: 'First Input Delay',
        actual: fidStats?.averageResponseTime || 0,
        threshold: 100,
        status: (fidStats?.averageResponseTime || 0) <= 100 ? 'pass' as const : 'fail' as const,
      },
      {
        metric: 'API Success Rate',
        actual: apiStats?.successRate || 0,
        threshold: this.SUCCESS_RATE_THRESHOLD,
        status: (apiStats?.successRate || 0) >= this.SUCCESS_RATE_THRESHOLD ? 'pass' as const : 'fail' as const,
      },
    ];

    const allPass = checks.every((check) => check.status === 'pass');

    return {
      compliant: allPass,
      details: checks,
    };
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics.clear();
    this.alerts = [];
  }

  // Export metrics for analysis
  exportMetrics(): string {
    const data = {
      metrics: Object.fromEntries(
        Array.from(this.metrics.entries()).map(([name, values]) => [
          name,
          values,
        ])
      ),
      alerts: this.alerts,
      stats: Object.fromEntries(
        Array.from(this.metrics.keys()).map((name) => [
          name,
          this.getStats(name),
        ])
      ),
      uptime: Date.now() - this.startTime,
    };

    return JSON.stringify(data, null, 2);
  }

  // Setup automatic reporting
  setupAutoReporting(interval: number = 60000): void {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      const compliance = this.checkSLACompliance();
      if (!compliance.compliant) {
        console.warn('[SLA Compliance] FAILED', compliance.details);
      }
    }, interval);
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Auto-enable in browser
if (typeof window !== 'undefined') {
  performanceMonitor.enable();
  performanceMonitor.setupAutoReporting();
}

export { performanceMonitor };
export default PerformanceMonitor;
