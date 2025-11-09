import express from 'express'
import request from 'supertest'

const mockContext = {
  appendMessage: jest.fn().mockResolvedValue(undefined),
  getContext: jest.fn(),
  clearContext: jest.fn(),
  getArtifactReferences: jest.fn().mockResolvedValue([]),
  addArtifactReference: jest.fn(),
  removeArtifactReference: jest.fn(),
}
const mockNlp = {
  classifyIntent: jest.fn(),
  generateContext: jest.fn(),
}
const mockCacheInvalidation = {
  invalidateConversation: jest.fn().mockResolvedValue(undefined),
}

jest.mock('../../src/services/context.service', () => ({
  __esModule: true,
  default: mockContext,
}))

jest.mock('../../src/services/nlp.service', () => ({
  __esModule: true,
  default: mockNlp,
}))

jest.mock('../../src/services/cacheInvalidation.service', () => ({
  __esModule: true,
  default: mockCacheInvalidation,
}))

jest.mock('../../src/services/cache.service', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
  },
}))

const conversationRoutes = require('../../src/routes/conversation.routes').default

const contextService = mockContext as unknown as jest.Mocked<typeof import('../../src/services/context.service').default>
const nlpService = mockNlp as unknown as jest.Mocked<typeof import('../../src/services/nlp.service').default>

describe('Conversation routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/', conversationRoutes)

  beforeEach(() => {
    jest.clearAllMocks()
    contextService.getContext.mockResolvedValue({
      sessionId: 'session-1',
      history: [],
      tokenCount: 0,
      updatedAt: new Date().toISOString(),
      references: [],
    } as any)

    nlpService.classifyIntent.mockResolvedValue({
      intent: 'graphics',
      confidence: 0.92,
      entities: { color: 'blue' },
    } as any)
    nlpService.generateContext.mockReturnValue({
      message: 'Draw',
      intent: 'graphics',
      entities: {},
      history: [],
      timestamp: new Date().toISOString(),
    } as any)
  })

  it('stores sanitized message and broadcasts response', async () => {
    const res = await request(app).post('/message').send({
      sessionId: 'session-1',
      message: '<script>alert(1)</script> draw a circle',
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.response).not.toContain('<script>')
    expect(contextService.appendMessage).toHaveBeenCalledTimes(2)
    expect(nlpService.classifyIntent).toHaveBeenCalled()
    expect(mockCacheInvalidation.invalidateConversation).toHaveBeenCalled()
  })

  it('returns history for GET /history/:id', async () => {
    contextService.getContext.mockResolvedValue({
      sessionId: 'session-2',
      history: [
        { role: 'user', content: 'hello', timestamp: new Date().toISOString() },
      ],
      tokenCount: 4,
      updatedAt: new Date().toISOString(),
      references: [],
    } as any)

    const res = await request(app).get('/history/session-2')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveLength(1)
  })

  it('clears history via DELETE', async () => {
    contextService.clearContext.mockResolvedValue()

    const res = await request(app).delete('/history/session-3')

    expect(res.status).toBe(204)
    expect(contextService.clearContext).toHaveBeenCalledWith('session-3')
    expect(mockCacheInvalidation.invalidateConversation).toHaveBeenCalledWith('session-3', [
      'history',
      'context',
      'artifacts',
    ])
  })

  it('exposes current context snapshot', async () => {
    contextService.getContext.mockResolvedValue({
      sessionId: 'session-4',
      history: [],
      tokenCount: 0,
      updatedAt: new Date().toISOString(),
      references: [],
    } as any)

    const res = await request(app).get('/context/session-4')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data?.sessionId).toBe('session-4')
  })

  it('returns artifact references', async () => {
    contextService.getArtifactReferences.mockResolvedValue([
      { id: 'art-1', tool: 'graphics', name: 'Logo' },
    ] as any)

    const res = await request(app).get('/session-5/artifacts')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(contextService.getArtifactReferences).toHaveBeenCalledWith('session-5')
  })

  it('stores artifact references', async () => {
    contextService.addArtifactReference.mockResolvedValue({
      id: 'art-2',
      tool: 'graphics',
      name: 'Logo',
      createdAt: new Date().toISOString(),
    } as any)

    const res = await request(app)
      .post('/session-5/artifacts')
      .send({ id: 'art-2', tool: 'graphics', name: 'Logo' })

    expect(res.status).toBe(201)
    expect(contextService.addArtifactReference).toHaveBeenCalledWith('session-5', {
      id: 'art-2',
      tool: 'graphics',
      name: 'Logo',
      url: undefined,
      metadata: undefined,
    })
  })

  it('removes artifact references', async () => {
    contextService.removeArtifactReference.mockResolvedValue(undefined)

    const res = await request(app).delete('/session-5/artifacts/art-2')

    expect(res.status).toBe(204)
    expect(contextService.removeArtifactReference).toHaveBeenCalledWith('session-5', 'art-2')
  })
})
