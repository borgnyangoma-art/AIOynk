import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getTracer, createSpan, injectSpanContext, extractSpanContext, addSpanTags, finishSpan } from '../services/tracing.service';

interface RequestWithTrace extends Request {
  traceId?: string;
  span?: any;
}

const CORRELATION_ID_HEADER = 'x-correlation-id';
const TRACING_HEADER = 'x-trace-id';

/**
 * Generate correlation ID
 */
const generateCorrelationId = (): string => {
  return uuidv4();
};

/**
 * Get correlation ID from request
 */
const getCorrelationId = (req: RequestWithTrace): string => {
  return req.headers[CORRELATION_ID_HEADER] as string || generateCorrelationId();
};

/**
 * Extract tracing headers
 */
const extractTracingHeaders = (req: Request): Record<string, string> => {
  const headers: Record<string, string> = {};
  Object.keys(req.headers).forEach(key => {
    if (key.toLowerCase().startsWith('x-trace')) {
      headers[key] = req.headers[key] as string;
    }
  });
  return headers;
};

/**
 * Correlation ID middleware - adds correlation ID to all requests
 */
export const correlationIdMiddleware = (req: RequestWithTrace, res: Response, next: NextFunction) => {
  const correlationId = getCorrelationId(req);

  req.traceId = correlationId;

  // Add correlation ID to response headers
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  // Add to request context for logging
  (req as any).context = { ...(req as any).context, correlationId };

  next();
};

/**
 * Tracing middleware - creates spans for HTTP requests
 */
export const tracingMiddleware = (req: RequestWithTrace, res: Response, next: NextFunction) => {
  const tracer = getTracer();
  const operationName = `${req.method} ${req.route?.path || req.path}`;

  // Extract parent span from headers
  const headers = extractTracingHeaders(req);
  const parentSpanContext = extractSpanContext(headers);
  const parentSpan = parentSpanContext ? tracer.startSpan(operationName, { childOf: parentSpanContext }) : undefined;

  // Create new span
  const span = createSpan(operationName, parentSpan);

  // Add basic tags
  addSpanTags(span, {
    'http.method': req.method,
    'http.url': req.url,
    'http.scheme': req.protocol,
    'http.host': req.get('host'),
    'user-agent': req.get('user-agent'),
    'correlation.id': req.traceId,
  });

  req.span = span;

  // Add response finish listener
  res.on('finish', () => {
    addSpanTags(span, {
      'http.status_code': res.statusCode,
      'http.status_class': Math.floor(res.statusCode / 100) * 100,
    });

    if (res.statusCode >= 400) {
      addSpanTags(span, { 'error': true });
    }

    finishSpan(span);
  });

  // Add error listener
  res.on('error', (error) => {
    addSpanTags(span, { 'error': true });
    finishSpan(span, error);
  });

  next();
};

/**
 * Get request correlation ID
 */
export const getRequestCorrelationId = (req: RequestWithTrace): string => {
  return req.traceId || 'unknown';
};

/**
 * Create child span for async operations
 */
export const createChildSpan = (operationName: string, parentSpan?: any) => {
  return createSpan(operationName, parentSpan);
};

/**
 * Wrap async function with tracing
 */
export const withTracing = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string,
  parentSpan?: any
): T => {
  return (async (...args: any[]) => {
    const span = createChildSpan(operationName, parentSpan);

    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      addSpanTags(span, { 'error': true });
      finishSpan(span, error as Error);
      throw error;
    } finally {
      finishSpan(span);
    }
  }) as T;
};

/**
 * Manual span creation for critical operations
 */
export const createManualSpan = (operationName: string, tags?: Record<string, any>) => {
  const span = createSpan(operationName);
  if (tags) {
    addSpanTags(span, tags);
  }
  return span;
};

export default {
  correlationIdMiddleware,
  tracingMiddleware,
  getRequestCorrelationId,
  createChildSpan,
  withTracing,
  createManualSpan,
};
