import { Request, Response, NextFunction } from 'express';
import metricsService from '../services/metrics.service';

interface ResponseWithTiming extends Response {
  startTime?: number;
}

/**
 * Middleware to collect HTTP request metrics
 */
export const metricsMiddleware = (req: Request, res: ResponseWithTiming, next: NextFunction) => {
  res.startTime = Date.now();

  // Remove sensitive data from path for metrics
  const cleanPath = req.path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid');

  // Get response status code
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function (data?: any): Response {
    recordMetrics();
    return originalSend.call(this, data);
  };

  res.json = function (data?: any): Response {
    recordMetrics();
    return originalJson.call(this, data);
  };

  const recordMetrics = () => {
    const duration = res.startTime ? (Date.now() - res.startTime) / 1000 : 0;

    metricsService.recordHttpRequest(
      req.method,
      cleanPath,
      res.statusCode,
      duration,
      'backend'
    );

    metricsService.endpointResponseTimeSeconds.observe(
      { endpoint: cleanPath, method: req.method },
      duration
    );
  };

  next();
};

/**
 * WebSocket metrics middleware
 */
export const websocketMetricsMiddleware = {
  onConnection: (socketId: string) => {
    metricsService.recordWebSocketEvent('connect', 'success');
  },

  onDisconnect: (socketId: string) => {
    metricsService.recordWebSocketEvent('disconnect', 'success');
  },

  onMessage: (direction: 'in' | 'out', messageType: string) => {
    metricsService.recordWebSocketEvent('message', 'success', direction, messageType);
  },

  onError: (error: string) => {
    metricsService.recordWebSocketEvent('connect', 'error');
    metricsService.appErrorsTotal.inc({
      error_type: 'websocket_error',
      service: 'backend',
      severity: 'error',
    });
  },
};

/**
 * Error metrics middleware
 */
export const errorMetricsMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Record error metrics
  const errorType = error.name || 'UnknownError';
  const severity = res.statusCode >= 500 ? 'critical' : res.statusCode >= 400 ? 'warning' : 'error';

  metricsService.appErrorsTotal.inc({
    error_type: errorType,
    service: 'backend',
    severity,
  });

  next(error);
};

/**
 * Database query metrics middleware
 */
export const dbMetricsMiddleware = {
  beforeQuery: (queryType: string, table: string) => {
    return Date.now();
  },

  afterQuery: (startTime: number, queryType: string, table: string, error?: string) => {
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordDbQuery(queryType, table, duration, error);
  },
};

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Update process metrics periodically
    if (Math.random() < 0.1) { // Update 10% of the time to reduce overhead
      metricsService.updateProcessMetrics();
    }

    // Alert on slow requests
    if (duration > 5000) { // 5 seconds
      metricsService.appErrorsTotal.inc({
        error_type: 'slow_request',
        service: 'backend',
        severity: 'warning',
      });
    }
  });

  next();
};

export default {
  metricsMiddleware,
  websocketMetricsMiddleware,
  errorMetricsMiddleware,
  dbMetricsMiddleware,
  performanceMiddleware,
};
