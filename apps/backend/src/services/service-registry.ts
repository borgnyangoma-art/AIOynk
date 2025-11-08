export interface RegisterServiceInput {
  name: string
  url: string
  healthEndpoint: string
  metadata?: Record<string, any>
}

type RegistryRecord = RegisterServiceInput & {
  lastUpdated: Date
  status: 'healthy' | 'unhealthy'
  lastHeartbeat?: Date
}

export class ServiceRegistry {
  private services: Record<string, RegistryRecord> = {}

  registerService(service: RegisterServiceInput): void {
    this.services[service.name] = {
      ...service,
      lastUpdated: new Date(),
      status: 'healthy',
    }
  }

  unregisterService(name: string): void {
    delete this.services[name]
  }

  getService(name: string): RegistryRecord | null {
    return this.services[name] ?? null
  }

  getServices(): Record<string, RegistryRecord> {
    return { ...this.services }
  }

  async getHealthyServices(): Promise<Record<string, RegistryRecord>> {
    const healthy: Record<string, RegistryRecord> = {}
    Object.entries(this.services).forEach(([name, record]) => {
      if (record.status === 'healthy') {
        healthy[name] = record
      }
    })
    return healthy
  }

  getServiceByType(type: string): RegistryRecord[] {
    return Object.values(this.services).filter(
      (service) => service.metadata?.type === type,
    )
  }

  discoverServices(): void {
    const mapping: Record<string, string | undefined> = {
      'graphics-service': process.env.GRAPHICS_SERVICE_URL,
      'web-designer-service': process.env.WEB_DESIGNER_SERVICE_URL,
      'ide-service': process.env.IDE_SERVICE_URL,
      'cad-service': process.env.CAD_SERVICE_URL,
      'video-service': process.env.VIDEO_SERVICE_URL,
    }

    Object.entries(mapping).forEach(([name, url]) => {
      if (url) {
        this.registerService({
          name,
          url,
          healthEndpoint: '/health',
          metadata: { type: name.replace('-service', '') },
        })
      }
    })
  }
}

export default new ServiceRegistry()
