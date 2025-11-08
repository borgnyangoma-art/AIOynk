import { NLPService } from '../../src/services/nlp.service';

describe('NLPService', () => {
  let nlpService: NLPService;

  beforeAll(() => {
    nlpService = new NLPService();
  });

  describe('classifyIntent', () => {
    it('should classify graphics request', async () => {
      const message = 'Create a blue circle on a white background';
      const result = await nlpService.classifyIntent(message);

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
      expect(result.intent).toBe('graphics');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify web design request', async () => {
      const message = 'Build a landing page for my business';
      const result = await nlpService.classifyIntent(message);

      expect(result.intent).toBe('web_designer');
    });

    it('should classify IDE request', async () => {
      const message = 'Write a Python function to calculate fibonacci';
      const result = await nlpService.classifyIntent(message);

      expect(result.intent).toBe('ide');
    });

    it('should classify CAD request', async () => {
      const message = 'Create a 3D model of a car';
      const result = await nlpService.classifyIntent(message);

      expect(result.intent).toBe('cad');
    });

    it('should classify video request', async () => {
      const message = 'Edit this video and add a fade transition';
      const result = await nlpService.classifyIntent(message);

      expect(result.intent).toBe('video');
    });

    it('should return low confidence for unclear message', async () => {
      const message = 'Hello';
      const result = await nlpService.classifyIntent(message);

      expect(result.confidence).toBeLessThan(0.7);
    });

    it('should extract entities from message', async () => {
      const message = 'Create a red circle with 50px radius';
      const result = await nlpService.classifyIntent(message);

      expect(result.entities).toBeDefined();
      expect(result.entities?.color).toBe('red');
      expect(result.entities?.shape).toBe('circle');
    });
  });

  describe('extractEntities', () => {
    it('should extract color entity', () => {
      const message = 'Make it blue';
      const entities = nlpService['extractEntities'](message);

      expect(entities.color).toBe('blue');
    });

    it('should extract size entity', () => {
      const message = 'Make it 200 pixels wide';
      const entities = nlpService['extractEntities'](message);

      expect(entities.size).toBe('200');
    });

    it('should extract shape entity', () => {
      const message = 'Draw a rectangle';
      const entities = nlpService['extractEntities'](message);

      expect(entities.shape).toBe('rectangle');
    });

    it('should extract multiple entities', () => {
      const message = 'Create a large red circle';
      const entities = nlpService['extractEntities'](message);

      expect(entities.size).toBe('large');
      expect(entities.color).toBe('red');
      expect(entities.shape).toBe('circle');
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate high confidence for clear intent', () => {
      const keywords = ['create', 'circle', 'canvas'];
      const confidence = nlpService['calculateConfidence']('graphics', keywords);

      expect(confidence).toBeGreaterThan(0.8);
    });

    it('should calculate low confidence for ambiguous message', () => {
      const keywords = ['hello', 'test'];
      const confidence = nlpService['calculateConfidence']('graphics', keywords);

      expect(confidence).toBeLessThan(0.5);
    });
  });

  describe('routeRequest', () => {
    it('should route to graphics service', async () => {
      const message = 'Create a logo with text';
      const routing = await nlpService.routeRequest(message);

      expect(routing.service).toBe('graphics-service');
      expect(routing.endpoint).toBeDefined();
    });

    it('should route to web designer service', async () => {
      const message = 'Build a website';
      const routing = await nlpService.routeRequest(message);

      expect(routing.service).toBe('web-designer-service');
    });

    it('should route to IDE service', async () => {
      const message = 'Write some code';
      const routing = await nlpService.routeRequest(message);

      expect(routing.service).toBe('ide-service');
    });

    it('should include extracted parameters', async () => {
      const message = 'Create a blue square';
      const routing = await nlpService.routeRequest(message);

      expect(routing.parameters).toBeDefined();
      expect(routing.parameters?.color).toBe('blue');
      expect(routing.parameters?.shape).toBe('square');
    });
  });

  describe('generateContext', () => {
    it('should generate context from message', () => {
      const message = 'Create a blue circle';
      const context = nlpService.generateContext(message, 'graphics', {});

      expect(context).toHaveProperty('intent');
      expect(context).toHaveProperty('entities');
      expect(context).toHaveProperty('timestamp');
    });

    it('should include conversation history', () => {
      const history = [
        { message: 'Create a circle', intent: 'graphics' },
        { message: 'Make it blue', intent: 'graphics' },
      ];
      const context = nlpService.generateContext('Now add a border', 'graphics', {}, history);

      expect(context.history).toEqual(history);
    });
  });
});
