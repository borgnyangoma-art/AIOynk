import client from 'prom-client';

// Create a Registry
const register = new client.Registry();
register.setDefaultLabels({
  app: 'aio-creative-hub-web-designer',
  version: process.env.npm_package_version || '1.0.0',
});

client.collectDefaultMetrics({ register });

// ====================
// Web Designer Metrics
// ====================

export const codeGenerationTotal = new client.Counter({
  name: 'code_generation_total',
  help: 'Total number of code generation operations',
  labelNames: ['framework', 'status'] as const,
  registers: [register],
});

export const codeGenerationDurationSeconds = new client.Histogram({
  name: 'code_generation_duration_seconds',
  help: 'Duration of code generation in seconds',
  labelNames: ['framework'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const activeWebDesignerSessions = new client.Gauge({
  name: 'active_web_designer_sessions',
  help: 'Number of active web designer sessions',
  registers: [register],
});

export const componentOperationsTotal = new client.Counter({
  name: 'component_operations_total',
  help: 'Total number of component operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

export const responsivePreviewRequests = new client.Counter({
  name: 'responsive_preview_requests_total',
  help: 'Total number of responsive preview requests',
  labelNames: ['viewport', 'status'] as const,
  registers: [register],
});

export const accessibilityChecksTotal = new client.Counter({
  name: 'accessibility_checks_total',
  help: 'Total number of accessibility checks',
  labelNames: ['level', 'result'] as const,
  registers: [register],
});

export const codeValidationErrors = new client.Counter({
  name: 'code_validation_errors_total',
  help: 'Total number of code validation errors',
  labelNames: ['error_type', 'severity'] as const,
  registers: [register],
});

export const activeComponents = new client.Gauge({
  name: 'active_components',
  help: 'Number of active components in the project',
  registers: [register],
});

export const previewRenderDurationSeconds = new client.Histogram({
  name: 'preview_render_duration_seconds',
  help: 'Duration of preview rendering in seconds',
  labelNames: ['viewport'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const memoryUsageBytes = new client.Gauge({
  name: 'memory_usage_bytes',
  help: 'Service memory usage in bytes',
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.8, 1, 2, 5],
  registers: [register],
});

// ====================
// Helper Functions
// ====================

export const recordCodeGeneration = (framework: string, duration: number, status: 'success' | 'error' = 'success') => {
  codeGenerationTotal.inc({ framework, status });
  codeGenerationDurationSeconds.observe({ framework }, duration);
};

export const recordComponentOperation = (operation: string, status: 'success' | 'error' = 'success') => {
  componentOperationsTotal.inc({ operation, status });
};

export const recordResponsivePreview = (viewport: string, duration: number, status: 'success' | 'error' = 'success') => {
  responsivePreviewRequests.inc({ viewport, status });
  previewRenderDurationSeconds.observe({ viewport }, duration);
};

export const recordAccessibilityCheck = (level: 'A' | 'AA' | 'AAA', result: 'pass' | 'fail') => {
  accessibilityChecksTotal.inc({ level, result });
};

export const recordCodeValidation = (errorType: string, severity: 'warning' | 'error') => {
  codeValidationErrors.inc({ error_type: errorType, severity });
};

export const updateActiveSessions = (count: number) => {
  activeWebDesignerSessions.set(count);
};

export const updateActiveComponents = (count: number) => {
  activeComponents.set(count);
};

export const updateMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  memoryUsageBytes.set(memUsage.heapUsed);
};

export const recordHttpRequest = (method: string, route: string, statusCode: number, duration: number) => {
  httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
  httpRequestDurationSeconds.observe({ method, route }, duration);
};

export const getMetrics = async () => {
  return await register.metrics();
};

export default {
  recordCodeGeneration,
  recordComponentOperation,
  recordResponsivePreview,
  recordAccessibilityCheck,
  recordCodeValidation,
  updateActiveSessions,
  updateActiveComponents,
  updateMemoryUsage,
  recordHttpRequest,
  getMetrics,
  register,
};
