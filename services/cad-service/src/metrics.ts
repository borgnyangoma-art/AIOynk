import client from 'prom-client';

const register = new client.Registry();
register.setDefaultLabels({
  app: 'aio-creative-hub-cad-service',
  version: process.env.npm_package_version || '1.0.0',
});

client.collectDefaultMetrics({ register });

export const modelGenerationTotal = new client.Counter({
  name: 'model_generation_total',
  help: 'Total number of 3D model generations',
  labelNames: ['primitive_type', 'status'] as const,
  registers: [register],
});

export const modelGenerationDurationSeconds = new client.Histogram({
  name: 'model_generation_duration_seconds',
  help: 'Duration of 3D model generation in seconds',
  labelNames: ['primitive_type'] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const activeCADSessions = new client.Gauge({
  name: 'active_cad_sessions',
  help: 'Number of active CAD sessions',
  registers: [register],
});

export const meshOperationsTotal = new client.Counter({
  name: 'mesh_operations_total',
  help: 'Total number of mesh operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

export const exportOperationsTotal = new client.Counter({
  name: 'export_operations_total',
  help: 'Total number of export operations',
  labelNames: ['format', 'status'] as const,
  registers: [register],
});

export const renderDurationSeconds = new client.Histogram({
  name: 'render_duration_seconds',
  help: 'Duration of 3D rendering in seconds',
  labelNames: ['view_type'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const activeVertices = new client.Gauge({
  name: 'active_vertices',
  help: 'Number of active vertices in current model',
  registers: [register],
});

export const activeTriangles = new client.Gauge({
  name: 'active_triangles',
  help: 'Number of active triangles in current model',
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

export const recordModelGeneration = (primitiveType: string, duration: number, status: 'success' | 'error' = 'success') => {
  modelGenerationTotal.inc({ primitive_type: primitiveType, status });
  modelGenerationDurationSeconds.observe({ primitive_type: primitiveType }, duration);
};

export const recordMeshOperation = (operation: string, status: 'success' | 'error' = 'success') => {
  meshOperationsTotal.inc({ operation, status });
};

export const recordExport = (format: string, duration: number, status: 'success' | 'error' = 'success') => {
  exportOperationsTotal.inc({ format, status });
};

export const recordRender = (viewType: 'orthographic' | 'perspective', duration: number) => {
  renderDurationSeconds.observe({ view_type: viewType }, duration);
};

export const updateActiveSessions = (count: number) => {
  activeCADSessions.set(count);
};

export const updateActiveVertices = (count: number) => {
  activeVertices.set(count);
};

export const updateActiveTriangles = (count: number) => {
  activeTriangles.set(count);
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
  recordModelGeneration,
  recordMeshOperation,
  recordExport,
  recordRender,
  updateActiveSessions,
  updateActiveVertices,
  updateActiveTriangles,
  updateMemoryUsage,
  recordHttpRequest,
  getMetrics,
  register,
};
