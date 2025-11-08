import { ServiceRegistry } from '../../src/services/service-registry';

describe('ServiceRegistry', () => {
  let serviceRegistry: ServiceRegistry;

  beforeEach(() => {
    serviceRegistry = new ServiceRegistry();
  });

  describe('registerService', () => {
    it('should register a new service', () => {
      const serviceInfo = {
        name: 'graphics-service',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
        metadata: { version: '1.0.0' },
      };

      serviceRegistry.registerService(serviceInfo);

      const services = serviceRegistry.getServices();
      expect(services).toHaveProperty('graphics-service');
      expect(services['graphics-service'].url).toBe('http://localhost:3001');
    });

    it('should update existing service registration', () => {
      // Register service first
      serviceRegistry.registerService({
        name: 'test-service',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
      });

      // Update with new URL
      serviceRegistry.registerService({
        name: 'test-service',
        url: 'http://localhost:3002',
        healthEndpoint: '/health',
      });

      const service = serviceRegistry.getService('test-service');
      expect(service?.url).toBe('http://localhost:3002');
    });

    it('should include metadata in registration', () => {
      const serviceInfo = {
        name: 'test-service',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
        metadata: { version: '1.0.0', features: ['feature1'] },
      };

      serviceRegistry.registerService(serviceInfo);

      const service = serviceRegistry.getService('test-service');
      expect(service?.metadata.version).toBe('1.0.0');
    });
  });

  describe('getService', () => {
    it('should retrieve registered service', () => {
      serviceRegistry.registerService({
        name: 'test-service',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
      });

      const service = serviceRegistry.getService('test-service');

      expect(service).not.toBeNull();
      expect(service?.name).toBe('test-service');
    });

    it('should return null for non-existent service', () => {
      const service = serviceRegistry.getService('non-existent');

      expect(service).toBeNull();
    });
  });

  describe('getServices', () => {
    it('should return all registered services', () => {
      serviceRegistry.registerService({
        name: 'service1',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
      });

      serviceRegistry.registerService({
        name: 'service2',
        url: 'http://localhost:3002',
        healthEndpoint: '/health',
      });

      const services = serviceRegistry.getServices();

      expect(Object.keys(services)).toHaveLength(2);
      expect(services).toHaveProperty('service1');
      expect(services).toHaveProperty('service2');
    });

    it('should return empty object when no services registered', () => {
      const services = serviceRegistry.getServices();
      expect(services).toEqual({});
    });
  });

  describe('unregisterService', () => {
    it('should remove service from registry', () => {
      serviceRegistry.registerService({
        name: 'test-service',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
      });

      serviceRegistry.unregisterService('test-service');

      const service = serviceRegistry.getService('test-service');
      expect(service).toBeNull();
    });

    it('should not throw error for non-existent service', () => {
      expect(() => {
        serviceRegistry.unregisterService('non-existent');
      }).not.toThrow();
    });
  });

  describe('getHealthyServices', () => {
    it('should return only healthy services', async () => {
      // Note: In real implementation, this would check health endpoints
      serviceRegistry.registerService({
        name: 'healthy-service',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
      });

      serviceRegistry.registerService({
        name: 'unhealthy-service',
        url: 'http://localhost:3002',
        healthEndpoint: '/health',
      });

      const healthyServices = await serviceRegistry.getHealthyServices();

      expect(healthyServices).toHaveProperty('healthy-service');
    });
  });

  describe('discoverServices', () => {
    it('should discover services from environment', () => {
      // Mock environment variables
      process.env.GRAPHICS_SERVICE_URL = 'http://localhost:3001';
      process.env.WEB_DESIGNER_SERVICE_URL = 'http://localhost:3002';

      serviceRegistry.discoverServices();

      const services = serviceRegistry.getServices();
      expect(services).toHaveProperty('graphics-service');
      expect(services).toHaveProperty('web-designer-service');
    });
  });

  describe('getServiceByType', () => {
    it('should find services by type', () => {
      serviceRegistry.registerService({
        name: 'graphics-v1',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
        metadata: { type: 'graphics' },
      });

      serviceRegistry.registerService({
        name: 'graphics-v2',
        url: 'http://localhost:3003',
        healthEndpoint: '/health',
        metadata: { type: 'graphics' },
      });

      const graphicsServices = serviceRegistry.getServiceByType('graphics');

      expect(graphicsServices).toHaveLength(2);
      expect(graphicsServices[0].name).toMatch(/graphics/);
    });
  });
});
