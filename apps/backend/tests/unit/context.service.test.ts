const store = new Map<string, string>()

const metricsMock = {
  contextOperationsTotal: { inc: jest.fn() },
  contextSizeBytes: { set: jest.fn() },
}

jest.mock('../../src/services/metrics.service', () => ({
  __esModule: true,
  default: metricsMock,
}))

import contextService, {
  ConversationMessage,
} from '../../src/services/context.service'

const redisMock = {
  get: jest.fn(async (key: string) => store.get(key) ?? null),
  setEx: jest.fn(async (key: string, _ttl: number, value: string) => {
    store.set(key, value)
  }),
  del: jest.fn(async (key: string) => {
    store.delete(key)
  }),
}

jest.mock('../../src/services/redis.service', () => ({
  getClient: () => redisMock,
}))

describe('ContextService', () => {
  beforeEach(() => {
    store.clear()
    Object.values(redisMock).forEach((fn) => (fn as jest.Mock).mockClear())
    metricsMock.contextOperationsTotal.inc.mockClear()
    metricsMock.contextSizeBytes.set.mockClear()
  })

  it('appends messages and persists to redis', async () => {
    const message: ConversationMessage = {
      role: 'user',
      content: 'Draw a logo',
      timestamp: new Date().toISOString(),
    }

    const result = await contextService.appendMessage('session-1', message)

    expect(result.history).toHaveLength(1)
    expect(redisMock.setEx).toHaveBeenCalledWith(
      expect.stringContaining('context:session-1'),
      expect.any(Number),
      expect.any(String),
    )
  })

  it('summarizes history when token limit exceeded', async () => {
    ;(contextService as any).tokenLimit = 10
    const longMessage: ConversationMessage = {
      role: 'user',
      content: 'a'.repeat(1000),
      timestamp: new Date().toISOString(),
    }

    const result = await contextService.appendMessage('session-2', longMessage)

    expect(result.summary).toBeDefined()
    expect(result.history.length).toBeLessThanOrEqual(10)
  })

  it('clears context records', async () => {
    await contextService.appendMessage('session-3', {
      role: 'user',
      content: 'hello',
      timestamp: new Date().toISOString(),
    })

    await contextService.clearContext('session-3')

    expect(store.size).toBe(0)
    expect(redisMock.del).toHaveBeenCalled()
  })

  it('stores cross-tool artifact references with enforced limits', async () => {
    for (let index = 0; index < 30; index += 1) {
      await contextService.addArtifactReference('session-tools', {
        id: `artifact-${index}`,
        tool: index % 2 === 0 ? 'graphics' : 'video',
        name: `Artifact ${index}`,
      })
    }

    const references = await contextService.getArtifactReferences('session-tools')
    expect(references).toHaveLength(25)
    expect(references[references.length - 1].tool).toBe('video')

    await contextService.removeArtifactReference('session-tools', references[0].id)
    const afterRemoval = await contextService.getArtifactReferences('session-tools')
    expect(afterRemoval).toHaveLength(24)
  })
})
