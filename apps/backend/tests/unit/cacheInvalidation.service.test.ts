jest.mock('../../src/services/cache.service', () => ({
  __esModule: true,
  default: {
    invalidate: jest.fn().mockResolvedValue(0),
  },
}))

jest.mock('../../src/services/applicationCache.service', () => ({
  __esModule: true,
  default: {
    invalidateByTag: jest.fn(),
    invalidateByPattern: jest.fn(),
  },
}))

jest.mock('../../src/services/cdn.service', () => ({
  __esModule: true,
  default: {
    scheduleInvalidation: jest.fn().mockReturnValue({ id: 'cdn-1' }),
  },
}))

const cacheServiceMock = jest.requireMock('../../src/services/cache.service')
  .default as { invalidate: jest.Mock }
const applicationCacheMock = jest.requireMock('../../src/services/applicationCache.service')
  .default as { invalidateByTag: jest.Mock; invalidateByPattern: jest.Mock }
const cdnServiceMock = jest.requireMock('../../src/services/cdn.service')
  .default as { scheduleInvalidation: jest.Mock }

import cacheInvalidationService from '../../src/services/cacheInvalidation.service'

describe('CacheInvalidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears all cache layers for a conversation session', async () => {
    await cacheInvalidationService.invalidateConversation('session-42', [
      'history',
      'context',
      'artifacts',
    ])

    expect(cacheServiceMock.invalidate).toHaveBeenCalledWith('cache:history:session-42')
    expect(cacheServiceMock.invalidate).toHaveBeenCalledWith('cache:context:session-42')
    expect(cacheServiceMock.invalidate).toHaveBeenCalledWith('cache:artifacts:session-42')
    expect(applicationCacheMock.invalidateByTag).toHaveBeenCalledWith('session:session-42')
    expect(cdnServiceMock.scheduleInvalidation).toHaveBeenCalledWith('/api/conversations/session-42')
  })

  it('invalidates entries by wildcard pattern', async () => {
    await cacheInvalidationService.invalidatePattern('cache:history:*')

    expect(cacheServiceMock.invalidate).toHaveBeenCalledWith('cache:history:*')
    expect(applicationCacheMock.invalidateByPattern).toHaveBeenCalledWith(expect.any(RegExp))
    const regexArg = (applicationCacheMock.invalidateByPattern as jest.Mock).mock.calls[0][0]
    expect(regexArg.test('cache:history:abc')).toBe(true)
    expect(regexArg.test('cache:context:abc')).toBe(false)
  })
})
