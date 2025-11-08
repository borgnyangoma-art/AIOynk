import client from 'prom-client';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'aio-creative-hub-backend',
  version: process.env.npm_package_version || '1.0.0',
});

// Enable collection of default metrics
client.collectDefaultMetrics({ register });

// ====================
// HTTP Request Metrics
// ====================

// Counter for total HTTP requests
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  registers: [register],
});

// Histogram for HTTP request duration
export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'service'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.8, 1, 2, 5, 10],
  registers: [register],
});

// Counter for HTTP request errors
export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'error_type', 'service'] as const,
  registers: [register],
});

// ====================
// Business Metrics
// ====================

// Counter for active sessions
export const activeSessionsTotal = new client.Gauge({
  name: 'active_sessions_total',
  help: 'Total number of active user sessions',
  registers: [register],
});

// Counter for user registrations
export const userRegistrationsTotal = new client.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['method'] as const,
  registers: [register],
});

// Counter for user logins
export const userLoginsTotal = new client.Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['method', 'status'] as const,
  registers: [register],
});

// Counter for Google OAuth authentications
export const oauthAuthenticationsTotal = new client.Counter({
  name: 'oauth_authentications_total',
  help: 'Total number of OAuth authentications',
  labelNames: ['provider', 'status'] as const,
  registers: [register],
});

// ====================
// Creative Tool Metrics
// ====================

// Counter for tool usage
export const toolUsageTotal = new client.Counter({
  name: 'tool_usage_total',
  help: 'Total number of tool usage instances',
  labelNames: ['tool_name', 'operation', 'status'] as const,
  registers: [register],
});

// Histogram for tool operation duration
export const toolOperationDurationSeconds = new client.Histogram({
  name: 'tool_operation_duration_seconds',
  help: 'Duration of tool operations in seconds',
  labelNames: ['tool_name', 'operation'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

// Gauge for active tool sessions
export const activeToolSessions = new client.Gauge({
  name: 'active_tool_sessions',
  help: 'Number of active tool sessions',
  labelNames: ['tool_name'] as const,
  registers: [register],
});

// ====================
// WebSocket Metrics
// ====================

// Counter for WebSocket connections
export const websocketConnectionsTotal = new client.Counter({
  name: 'websocket_connections_total',
  help: 'Total number of WebSocket connections',
  labelNames: ['status'] as const,
  registers: [register],
});

// Gauge for active WebSocket connections
export const activeWebsocketConnections = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// Counter for WebSocket messages
export const websocketMessagesTotal = new client.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'message_type'] as const,
  registers: [register],
});

// ====================
// Database Metrics
// ====================

// Histogram for database query duration
export const dbQueryDurationSeconds = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Counter for database errors
export const dbErrorsTotal = new client.Counter({
  name: 'db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['query_type', 'error_type'] as const,
  registers: [register],
});

// ====================
// Cache Metrics
// ====================

// Counter for cache hits
export const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['status'] as const,
  registers: [register],
});

// Histogram for cache operation duration
export const cacheOperationDurationSeconds = new client.Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation', 'status'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.3],
  registers: [register],
});

// ====================
// NLP & AI Metrics
// ====================

// Counter for NLP intent classifications
export const nlpIntentClassificationsTotal = new client.Counter({
  name: 'nlp_intent_classifications_total',
  help: 'Total number of NLP intent classifications',
  labelNames: ['intent', 'confidence_level', 'tool_routed'] as const,
  registers: [register],
});

// Histogram for NLP processing duration
export const nlpProcessingDurationSeconds = new client.Histogram({
  name: 'nlp_processing_duration_seconds',
  help: 'Duration of NLP processing in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// ====================
// Context & Memory Metrics
// ====================

// Gauge for context size
export const contextSizeBytes = new client.Gauge({
  name: 'context_size_bytes',
  help: 'Size of context in bytes',
  labelNames: ['session_id'] as const,
  registers: [register],
});

// Counter for context operations
export const contextOperationsTotal = new client.Counter({
  name: 'context_operations_total',
  help: 'Total number of context operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

// ====================
// Artifact & Storage Metrics
// ====================

// Counter for artifacts created
export const artifactsCreatedTotal = new client.Counter({
  name: 'artifacts_created_total',
  help: 'Total number of artifacts created',
  labelNames: ['artifact_type', 'tool_name'] as const,
  registers: [register],
});

// Histogram for artifact size
export const artifactSizeBytes = new client.Histogram({
  name: 'artifact_size_bytes',
  help: 'Size of artifacts in bytes',
  labelNames: ['artifact_type', 'tool_name'] as const,
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600], // 1KB to 100MB
  registers: [register],
});

// Gauge for storage usage
export const storageUsageBytes = new client.Gauge({
  name: 'storage_usage_bytes',
  help: 'Total storage usage in bytes',
  labelNames: ['storage_type'] as const,
  registers: [register],
});

// ====================
// Rate Limiting Metrics
// ====================

// Counter for rate limit violations
export const rateLimitViolationsTotal = new client.Counter({
  name: 'rate_limit_violations_total',
  help: 'Total number of rate limit violations',
  labelNames: ['endpoint', 'user_type'] as const,
  registers: [register],
});

// ====================
// Security Metrics
// ====================

// Counter for authentication failures
export const authFailuresTotal = new client.Counter({
  name: 'auth_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['auth_type', 'reason'] as const,
  registers: [register],
});

// Counter for security events
export const securityEventsTotal = new client.Counter({
  name: 'security_events_total',
  help: 'Total number of security events',
  labelNames: ['event_type', 'severity'] as const,
  registers: [register],
});

// ====================
// Error Tracking Metrics
// ====================

// Counter for application errors
export const appErrorsTotal = new client.Counter({
  name: 'app_errors_total',
  help: 'Total number of application errors',
  labelNames: ['error_type', 'service', 'severity'] as const,
  registers: [register],
});

// Histogram for error recovery time
export const errorRecoveryDurationSeconds = new client.Histogram({
  name: 'error_recovery_duration_seconds',
  help: 'Time taken to recover from errors in seconds',
  labelNames: ['error_type'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// ====================
// Performance Metrics
// ====================

// Histogram for response time by endpoint
export const endpointResponseTimeSeconds = new client.Histogram({
  name: 'endpoint_response_time_seconds',
  help: 'Response time by endpoint in seconds',
  labelNames: ['endpoint', 'method'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Gauge for CPU usage
export const processCpuUsagePercent = new client.Gauge({
  name: 'process_cpu_usage_percent',
  help: 'Process CPU usage percentage',
  registers: [register],
});

// Gauge for memory usage
export const processMemoryUsageBytes = new client.Gauge({
  name: 'process_memory_usage_bytes',
  help: 'Process memory usage in bytes',
  registers: [register],
});

// ====================
// Helper Functions
// ====================

/**
 * Record an HTTP request
 */
export const recordHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  duration: number,
  service: string = 'backend'
) => {
  httpRequestsTotal.inc({ method, route, status_code: statusCode.toString(), service });
  httpRequestDurationSeconds.observe({ method, route, service }, duration);

  if (statusCode >= 400) {
    const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
    httpErrorsTotal.inc({ method, route, error_type: errorType, service });
  }
};

/**
 * Record a database query
 */
export const recordDbQuery = (
  queryType: string,
  table: string,
  duration: number,
  error?: string
) => {
  dbQueryDurationSeconds.observe({ query_type: queryType, table }, duration);

  if (error) {
    dbErrorsTotal.inc({ query_type: queryType, error_type: error });
  }
};

/**
 * Record a tool operation
 */
export const recordToolOperation = (
  toolName: string,
  operation: string,
  duration: number,
  status: 'success' | 'error' = 'success'
) => {
  toolUsageTotal.inc({ tool_name: toolName, operation, status });
  toolOperationDurationSeconds.observe({ tool_name: toolName, operation }, duration);
};

/**
 * Record a WebSocket event
 */
export const recordWebSocketEvent = (
  type: 'connect' | 'disconnect' | 'message',
  status: 'success' | 'error',
  direction?: 'in' | 'out',
  messageType?: string
) => {
  if (type === 'connect' || type === 'disconnect') {
    websocketConnectionsTotal.inc({ status });
  } else if (type === 'message' && direction && messageType) {
    websocketMessagesTotal.inc({ direction, message_type: messageType });
  }
};

/**
 * Update active connection gauges
 */
export const updateActiveConnections = (websocketCount: number) => {
  activeWebsocketConnections.set(websocketCount);
};

/**
 * Record NLP processing
 */
export const recordNlpProcessing = (
  intent: string,
  confidence: number,
  processingTime: number,
  toolRouted: boolean
) => {
  const confidenceLevel = confidence > 0.9 ? 'high' : confidence > 0.7 ? 'medium' : 'low';
  nlpIntentClassificationsTotal.inc({
    intent,
    confidence_level: confidenceLevel,
    tool_routed: toolRouted.toString(),
  });
  nlpProcessingDurationSeconds.observe({ operation: 'intent_classification' }, processingTime);
};

/**
 * Record an artifact creation
 */
export const recordArtifactCreation = (
  artifactType: string,
  toolName: string,
  sizeBytes: number
) => {
  artifactsCreatedTotal.inc({ artifact_type: artifactType, tool_name: toolName });
  artifactSizeBytes.observe({ artifact_type: artifactType, tool_name: toolName }, sizeBytes);
};

/**
 * Update process metrics
 */
export const updateProcessMetrics = () => {
  const cpuUsage = process.cpuUsage();
  const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage
  processCpuUsagePercent.set(cpuPercent);

  const memUsage = process.memoryUsage();
  processMemoryUsageBytes.set(memUsage.heapUsed);
};

/**
 * Get all metrics
 */
export const getMetrics = async () => {
  return await register.metrics();
};

/**
 * Get metrics registry
 */
export const getRegistry = () => {
  return register;
};

export default {
  recordHttpRequest,
  recordDbQuery,
  recordToolOperation,
  recordWebSocketEvent,
  updateActiveConnections,
  recordNlpProcessing,
  recordArtifactCreation,
  updateProcessMetrics,
  getMetrics,
  getRegistry,
  // Metrics
  httpRequestsTotal,
  httpRequestDurationSeconds,
  activeSessionsTotal,
  userRegistrationsTotal,
  userLoginsTotal,
  oauthAuthenticationsTotal,
  toolUsageTotal,
  activeToolSessions,
  websocketConnectionsTotal,
  activeWebsocketConnections,
  nlpIntentClassificationsTotal,
  artifactsCreatedTotal,
  artifactSizeBytes,
  storageUsageBytes,
  rateLimitViolationsTotal,
  authFailuresTotal,
  securityEventsTotal,
  appErrorsTotal,
  endpointResponseTimeSeconds,
  processCpuUsagePercent,
  processMemoryUsageBytes,
};
