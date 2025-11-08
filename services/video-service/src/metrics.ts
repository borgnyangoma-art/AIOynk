import client from 'prom-client';

const register = new client.Registry();
register.setDefaultLabels({
  app: 'aio-creative-hub-video-service',
  version: process.env.npm_package_version || '1.0.0',
});

client.collectDefaultMetrics({ register });

export const videoProcessingTotal = new client.Counter({
  name: 'video_processing_total',
  help: 'Total number of video processing operations',
  labelNames: ['operation', 'format', 'status'] as const,
  registers: [register],
});

export const videoProcessingDurationSeconds = new client.Histogram({
  name: 'video_processing_duration_seconds',
  help: 'Duration of video processing in seconds',
  labelNames: ['operation', 'format'] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const activeVideoSessions = new client.Gauge({
  name: 'active_video_sessions',
  help: 'Number of active video editing sessions',
  registers: [register],
});

export const timelineOperationsTotal = new client.Counter({
  name: 'timeline_operations_total',
  help: 'Total number of timeline operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

export const effectApplicationsTotal = new client.Counter({
  name: 'effect_applications_total',
  help: 'Total number of effects applied',
  labelNames: ['effect_type', 'status'] as const,
  registers: [register],
});

export const renderJobsTotal = new client.Counter({
  name: 'render_jobs_total',
  help: 'Total number of render jobs',
  labelNames: ['format', 'resolution', 'status'] as const,
  registers: [register],
});

export const renderProgressUpdates = new client.Counter({
  name: 'render_progress_updates_total',
  help: 'Total number of render progress updates',
  registers: [register],
});

export const videoSizeBytes = new client.Gauge({
  name: 'video_size_bytes',
  help: 'Current video size in bytes',
  registers: [register],
});

export const activeClips = new client.Gauge({
  name: 'active_clips',
  help: 'Number of active video clips in timeline',
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
  labelNames: ['method', 'route'] as const,
  help: 'HTTP request duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.8, 1, 2, 5],
  registers: [register],
});

export const recordVideoProcessing = (operation: string, format: string, duration: number, status: 'success' | 'error' = 'success') => {
  videoProcessingTotal.inc({ operation, format, status });
  videoProcessingDurationSeconds.observe({ operation, format }, duration);
};

export const recordTimelineOperation = (operation: string, status: 'success' | 'error' = 'success') => {
  timelineOperationsTotal.inc({ operation, status });
};

export const recordEffectApplication = (effectType: string, duration: number, status: 'success' | 'error' = 'success') => {
  effectApplicationsTotal.inc({ effect_type: effectType, status });
};

export const recordRenderJob = (format: string, resolution: string, duration: number, status: 'success' | 'error' | 'processing' = 'processing') => {
  renderJobsTotal.inc({ format, resolution, status });
};

export const recordRenderProgress = () => {
  renderProgressUpdates.inc();
};

export const updateActiveSessions = (count: number) => {
  activeVideoSessions.set(count);
};

export const updateVideoSize = (sizeBytes: number) => {
  videoSizeBytes.set(sizeBytes);
};

export const updateActiveClips = (count: number) => {
  activeClips.set(count);
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
  recordVideoProcessing,
  recordTimelineOperation,
  recordEffectApplication,
  recordRenderJob,
  recordRenderProgress,
  updateActiveSessions,
  updateVideoSize,
  updateActiveClips,
  updateMemoryUsage,
  recordHttpRequest,
  getMetrics,
  register,
};
