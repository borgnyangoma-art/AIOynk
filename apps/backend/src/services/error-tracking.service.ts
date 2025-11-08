import logger, { logError } from './logger.service';
import metricsService from './metrics.service';

interface ErrorReport {
  id: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack: string;
    code?: string;
  };
  context: {
    service: string;
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    requestId?: string;
    url?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'application' | 'database' | 'external' | 'validation' | 'security';
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  tags: string[];
  occurrenceCount: number;
  firstOccurrence: number;
  lastOccurrence: number;
}

class ErrorTrackingService {
  private errors: Map<string, ErrorReport> = new Map();
  private errorCounts: Map<string, number> = new Map();

  /**
   * Report an error
   */
  reportError(
    error: Error,
    context: {
      service: string;
      userId?: string;
      sessionId?: string;
      correlationId?: string;
      requestId?: string;
      url?: string;
      method?: string;
      userAgent?: string;
      ip?: string;
      tags?: string[];
    }
  ) {
    const errorId = this.generateErrorId(error, context);
    const now = Date.now();

    // Check if error already exists
    const existingError = this.errors.get(errorId);

    if (existingError) {
      existingError.occurrenceCount++;
      existingError.lastOccurrence = now;

      // Update metrics
      metricsService.appErrorsTotal.inc({
        error_type: existingError.type,
        service: context.service,
        severity: existingError.severity,
      });
    } else {
      // Create new error report
      const errorReport: ErrorReport = {
        id: errorId,
        timestamp: now,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack || '',
        },
        context: {
          service: context.service,
          userId: context.userId,
          sessionId: context.sessionId,
          correlationId: context.correlationId,
          requestId: context.requestId,
          url: context.url,
          method: context.method,
          userAgent: context.userAgent,
          ip: context.ip,
        },
        severity: this.determineSeverity(error, context),
        type: this.determineErrorType(error, context),
        status: 'open',
        tags: context.tags || [],
        occurrenceCount: 1,
        firstOccurrence: now,
        lastOccurrence: now,
      };

      this.errors.set(errorId, errorReport);

      // Increment counter
      this.errorCounts.set(errorId, 1);

      // Log the error
      logError(error, {
        service: context.service,
        operation: context.requestId,
        userId: context.userId,
        correlationId: context.correlationId,
        stack: error.stack,
      });

      // Update metrics
      metricsService.appErrorsTotal.inc({
        error_type: errorReport.type,
        service: context.service,
        severity: errorReport.severity,
      });

      // Alert on critical errors
      if (errorReport.severity === 'critical') {
        logger.error('Critical error detected', {
          errorId,
          error: error.message,
          context,
        });
      }
    }

    return errorId;
  }

  /**
   * Get error by ID
   */
  getError(errorId: string): ErrorReport | undefined {
    return this.errors.get(errorId);
  }

  /**
   * Get all errors
   */
  getAllErrors(): ErrorReport[] {
    return Array.from(this.errors.values()).sort(
      (a, b) => b.lastOccurrence - a.lastOccurrence
    );
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorReport['severity']): ErrorReport[] {
    return this.getAllErrors().filter((error) => error.severity === severity);
  }

  /**
   * Get errors by service
   */
  getErrorsByService(service: string): ErrorReport[] {
    return this.getAllErrors().filter((error) => error.context.service === service);
  }

  /**
   * Update error status
   */
  updateErrorStatus(errorId: string, status: ErrorReport['status']) {
    const error = this.errors.get(errorId);
    if (error) {
      error.status = status;
      logger.info('Error status updated', { errorId, status });
    }
    return error;
  }

  /**
   * Add tags to error
   */
  addErrorTags(errorId: string, tags: string[]) {
    const error = this.errors.get(errorId);
    if (error) {
      error.tags.push(...tags);
      error.tags = Array.from(new Set(error.tags)); // Remove duplicates
    }
    return error;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const errors = this.getAllErrors();
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    return {
      total: errors.length,
      open: errors.filter((e) => e.status === 'open').length,
      critical: errors.filter((e) => e.severity === 'critical').length,
      lastHour: errors.filter((e) => e.lastOccurrence > oneHourAgo).length,
      lastDay: errors.filter((e) => e.lastOccurrence > oneDayAgo).length,
      byService: this.groupBy(errors, (e) => e.context.service),
      byType: this.groupBy(errors, (e) => e.type),
      topErrors: errors
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
        .slice(0, 10)
        .map((e) => ({
          id: e.id,
          message: e.error.message,
          count: e.occurrenceCount,
          lastOccurrence: e.lastOccurrence,
        })),
    };
  }

  /**
   * Clean up old errors
   */
  cleanup(olderThanDays: number = 7) {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [errorId, error] of this.errors) {
      if (error.lastOccurrence < cutoff && error.status === 'resolved') {
        this.errors.delete(errorId);
        this.errorCounts.delete(errorId);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info('Old errors cleaned up', { removed, olderThanDays });
    }

    return removed;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, context: any): ErrorReport['severity'] {
    // Critical errors
    if (
      error.name === 'OutOfMemoryError' ||
      error.message.includes('Segmentation fault') ||
      error.message.includes('stack overflow') ||
      context.status >= 500
    ) {
      return 'critical';
    }

    // High severity errors
    if (
      error.name === 'ValidationError' ||
      error.name === 'UnauthorizedError' ||
      error.name === 'ForbiddenError' ||
      context.status === 401 ||
      context.status === 403
    ) {
      return 'high';
    }

    // Medium severity errors
    if (
      error.name === 'TypeError' ||
      error.name === 'ReferenceError' ||
      error.name === 'SyntaxError' ||
      context.status === 400 ||
      context.status === 404
    ) {
      return 'medium';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Determine error type
   */
  private determineErrorType(error: Error, context: any): ErrorReport['type'] {
    if (error.name.includes('Database') || error.message.includes('SQL')) {
      return 'database';
    }
    if (error.name.includes('Validation') || error.message.includes('validation')) {
      return 'validation';
    }
    if (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError') {
      return 'security';
    }
    if (error.message.includes('fetch') || error.message.includes('API')) {
      return 'external';
    }
    return 'application';
  }

  /**
   * Generate error ID
   */
  private generateErrorId(error: Error, context: any): string {
    const errorSignature = `${error.name}:${error.message}`;
    const location = context.url || context.operation || 'unknown';
    return `${errorSignature}:${location}`.substring(0, 200);
  }

  /**
   * Group array by key
   */
  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, number> {
    return array.reduce((result, item) => {
      const key = keyFn(item);
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
  }
}

export default new ErrorTrackingService();
