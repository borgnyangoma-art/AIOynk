import client from 'prom-client';

// Create a Registry
const register = new client.Registry();
register.setDefaultLabels({
  app: 'aio-creative-hub-graphics-service',
  version: process.env.npm_package_version || '1.0.0',
});

// Enable default metrics
client.collectDefaultMetrics({ register });

// ====================
// Graphics-Specific Metrics
// ====================

export const canvasOperationsTotal = new client.Counter({
  name: 'canvas_operations_total',
  help: 'Total number of canvas operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

export const canvasOperationDurationSeconds = new client.Histogram({
  name: 'canvas_operation_duration_seconds',
  help: 'Duration of canvas operations in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const activeCanvasSessions = new client.Gauge({
  name: 'active_canvas_sessions',
  help: 'Number of active canvas sessions',
  registers: [register],
});

export const layerOperationsTotal = new client.Counter({
  name: 'layer_operations_total',
  help: 'Total number of layer operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

export const imageProcessingDurationSeconds = new client.Histogram({
  name: 'image_processing_duration_seconds',
  help: 'Duration of image processing in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const exportOperationsTotal = new client.Counter({
  name: 'export_operations_total',
  help: 'Total number of export operations',
  labelNames: ['format', 'status'] as const,
  registers: [register],
});

export const undoRedoOperationsTotal = new client.Counter({
  name: 'undo_redo_operations_total',
  help: 'Total number of undo/redo operations',
  labelNames: ['operation'] as const,
  registers: [register],
});

export const canvasSizeBytes = new client.Gauge({
  name: 'canvas_size_bytes',
  help: 'Current canvas size in bytes',
  registers: [register],
});

export const activeObjects = new client.Gauge({
  name: 'active_objects',
  help: 'Number of active objects on canvas',
  labelNames: ['object_type'] as const,
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

export const recordCanvasOperation = (operation: string, duration: number, status: 'success' | 'error' = 'success') => {
  canvasOperationsTotal.inc({ operation, status });
  canvasOperationDurationSeconds.observe({ operation }, duration);
};

export const recordLayerOperation = (operation: string, status: 'success' | 'error' = 'success') => {
  layerOperationsTotal.inc({ operation, status });
};

export const recordImageProcessing = (operation: string, duration: number) => {
  imageProcessingDurationSeconds.observe({ operation }, duration);
};

export const recordExport = (format: string, duration: number, status: 'success' | 'error' = 'success') => {
  exportOperationsTotal.inc({ format, status });
};

export const recordUndoRedo = (operation: 'undo' | 'redo') => {
  undoRedoOperationsTotal.inc({ operation });
};

export const updateActiveCanvasSessions = (count: number) => {
  activeCanvasSessions.set(count);
};

export const updateCanvasSize = (sizeBytes: number) => {
  canvasSizeBytes.set(sizeBytes);
};

export const updateActiveObjects = (objectType: string, count: number) => {
  activeObjects.set({ object_type: objectType }, count);
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
  recordCanvasOperation,
  recordLayerOperation,
  recordImageProcessing,
  recordExport,
  recordUndoRedo,
  updateActiveCanvasSessions,
  updateCanvasSize,
  updateActiveObjects,
  updateMemoryUsage,
  recordHttpRequest,
  getMetrics,
  register,
};
