import winston from 'winston';
import { Request } from 'express';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.service}] ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define log format for files (JSON)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileLogFormat,
  defaultMeta: {
    service: 'aio-creative-hub-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports,
  exitOnError: false,
});

// Request logging helper
export const logRequest = (req: Request, res: any, responseTime: number) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    correlationId: (req as any).traceId,
  };

  logger.info('HTTP Request', logData);
};

// Error logging helper
export const logError = (
  error: Error,
  context?: {
    service?: string;
    operation?: string;
    userId?: string;
    requestId?: string;
    correlationId?: string;
    stack?: string;
  }
) => {
  logger.error('Application Error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context: context || {},
  });
};

// Security event logging
export const logSecurityEvent = (
  event: string,
  details: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: string;
    ip?: string;
    userAgent?: string;
    description: string;
    metadata?: Record<string, any>;
  }
) => {
  logger.warn('Security Event', {
    event,
    severity: details.severity,
    userId: details.userId,
    ip: details.ip,
    userAgent: details.userAgent,
    description: details.description,
    metadata: details.metadata || {},
    timestamp: new Date().toISOString(),
  });
};

// Business event logging
export const logBusinessEvent = (
  event: string,
  details: {
    userId?: string;
    sessionId?: string;
    operation?: string;
    metadata?: Record<string, any>;
  }
) => {
  logger.info('Business Event', {
    event,
    userId: details.userId,
    sessionId: details.sessionId,
    operation: details.operation,
    metadata: details.metadata || {},
  });
};

// Performance logging
export const logPerformance = (
  operation: string,
  duration: number,
  context?: {
    service?: string;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  }
) => {
  const level = duration > 5000 ? 'warn' : duration > 2000 ? 'info' : 'debug';

  logger.log(level, 'Performance Metric', {
    operation,
    duration: `${duration}ms`,
    context: context || {},
  });
};

// Database query logging
export const logDatabaseQuery = (
  query: string,
  duration: number,
  context?: {
    table?: string;
    operation?: string;
    rowsAffected?: number;
    error?: string;
  }
) => {
  const level = duration > 1000 ? 'warn' : 'debug';

  logger.log(level, 'Database Query', {
    query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    duration: `${duration}ms`,
    context: context || {},
  });
};

// WebSocket event logging
export const logWebSocketEvent = (
  event: 'connect' | 'disconnect' | 'message',
  socketId: string,
  details?: {
    userId?: string;
    messageType?: string;
    error?: string;
  }
) => {
  logger.info('WebSocket Event', {
    event,
    socketId,
    userId: details?.userId,
    messageType: details?.messageType,
    error: details?.error,
  });
};

// Tool usage logging
export const logToolUsage = (
  toolName: string,
  operation: string,
  context: {
    userId?: string;
    sessionId?: string;
    duration?: number;
    status: 'success' | 'error';
    error?: string;
    metadata?: Record<string, any>;
  }
) => {
  const level = context.status === 'error' ? 'error' : 'info';

  logger.log(level, 'Tool Usage', {
    tool: toolName,
    operation,
    status: context.status,
    duration: context.duration ? `${context.duration}ms` : undefined,
    userId: context.userId,
    sessionId: context.sessionId,
    error: context.error,
    metadata: context.metadata || {},
  });
};

// Audit logging
export const logAuditEvent = (
  action: string,
  userId: string,
  resource: {
    type: string;
    id?: string;
  },
  changes?: Record<string, any>
) => {
  logger.info('Audit Event', {
    action,
    userId,
    resource,
    changes: changes || {},
    timestamp: new Date().toISOString(),
  });
};

// Structured logger with context
export const createContextualLogger = (context: Record<string, any>) => {
  return {
    error: (message: string, meta?: Record<string, any>) => {
      logger.error(message, { ...context, ...meta });
    },
    warn: (message: string, meta?: Record<string, any>) => {
      logger.warn(message, { ...context, ...meta });
    },
    info: (message: string, meta?: Record<string, any>) => {
      logger.info(message, { ...context, ...meta });
    },
    http: (message: string, meta?: Record<string, any>) => {
      logger.http(message, { ...context, ...meta });
    },
    debug: (message: string, meta?: Record<string, any>) => {
      logger.debug(message, { ...context, ...meta });
    },
  };
};

export default logger;
