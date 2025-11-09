import client from 'prom-client'

const register = new client.Registry()
register.setDefaultLabels({
  service: 'aio-storage-service',
})

client.collectDefaultMetrics({ register })

export const uploadCounter = new client.Counter({
  name: 'artifact_upload_total',
  help: 'Total file uploads',
  labelNames: ['storage', 'tool'] as const,
  registers: [register],
})

export const exportCounter = new client.Counter({
  name: 'artifact_version_total',
  help: 'Version count per artifact',
  labelNames: ['tool'] as const,
  registers: [register],
})

export const quotaGauge = new client.Gauge({
  name: 'storage_quota_usage_bytes',
  help: 'Storage usage in bytes',
  labelNames: ['type'] as const,
  registers: [register],
})

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
})

export const recordHttp = (method: string, route: string, status: number) => {
  httpRequestsTotal.inc({ method, route, status: status.toString() })
}

export const getMetrics = () => register.metrics()
