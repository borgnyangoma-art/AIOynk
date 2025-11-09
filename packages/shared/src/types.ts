export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface ServiceMetadata {
  version?: string
  type?: string
  features?: string[]
  [key: string]: any
}

export interface ServiceRegistration {
  name: string
  url: string
  healthEndpoint: string
  metadata?: ServiceMetadata
  lastHeartbeat?: string
  status?: 'healthy' | 'unhealthy'
}

export interface IntentRoute {
  service: string
  endpoint: string
}

export interface IntentFallbackInfo {
  active: boolean
  reason?: string
  threshold?: number
  suggestions?: string[]
}

export interface IntentClassification {
  intent: string
  confidence: number
  entities?: Record<string, string>
  keywords?: string[]
  route?: IntentRoute
  fallback?: boolean
  fallbackInfo?: IntentFallbackInfo
  metadata?: Record<string, any>
}

export interface RoutingResult {
  service: string
  endpoint: string
  parameters?: Record<string, any>
}
