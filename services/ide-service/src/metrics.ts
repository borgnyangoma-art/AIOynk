import client from 'prom-client';

const register = new client.Registry();
register.setDefaultLabels({
  app: 'aio-creative-hub-ide-service',
  version: process.env.npm_package_version || '1.0.0',
});

client.collectDefaultMetrics({ register });

export const codeExecutionTotal = new client.Counter({
  name: 'code_execution_total',
  help: 'Total number of code executions',
  labelNames: ['language', 'status'] as const,
  registers: [register],
});

export const codeExecutionDurationSeconds = new client.Histogram({
  name: 'code_execution_duration_seconds',
  help: 'Duration of code execution in seconds',
  labelNames: ['language'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

export const activeIDESessions = new client.Gauge({
  name: 'active_ide_sessions',
  help: 'Number of active IDE sessions',
  registers: [register],
});

export const sandboxResourceUsage = new client.Gauge({
  name: 'sandbox_resource_usage',
  help: 'Sandbox resource usage',
  labelNames: ['resource_type'] as const,
  registers: [register],
});

export const syntaxErrorsTotal = new client.Counter({
  name: 'syntax_errors_total',
  help: 'Total number of syntax errors detected',
  labelNames: ['language', 'severity'] as const,
  registers: [register],
});

export const securityViolationsTotal = new client.Counter({
  name: 'security_violations_total',
  help: 'Total number of security violations',
  labelNames: ['violation_type', 'severity'] as const,
  registers: [register],
});

export const activeSandboxes = new client.Gauge({
  name: 'active_sandboxes',
  help: 'Number of active code execution sandboxes',
  labelNames: ['language'] as const,
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

export const recordCodeExecution = (language: string, duration: number, status: 'success' | 'error' = 'success') => {
  codeExecutionTotal.inc({ language, status });
  codeExecutionDurationSeconds.observe({ language }, duration);
};

export const recordSyntaxError = (language: string, severity: 'warning' | 'error') => {
  syntaxErrorsTotal.inc({ language, severity });
};

export const recordSecurityViolation = (violationType: string, severity: 'warning' | 'critical') => {
  securityViolationsTotal.inc({ violation_type: violationType, severity });
};

export const updateActiveSessions = (count: number) => {
  activeIDESessions.set(count);
};

export const updateActiveSandboxes = (language: string, count: number) => {
  activeSandboxes.set({ language }, count);
};

export const updateSandboxResourceUsage = (resourceType: 'cpu' | 'memory' | 'disk', value: number) => {
  sandboxResourceUsage.set({ resource_type: resourceType }, value);
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
  recordCodeExecution,
  recordSyntaxError,
  recordSecurityViolation,
  updateActiveSessions,
  updateActiveSandboxes,
  updateSandboxResourceUsage,
  updateMemoryUsage,
  recordHttpRequest,
  getMetrics,
  register,
};
