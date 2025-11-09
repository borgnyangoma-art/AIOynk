import applicationCache from './applicationCache.service'
import cacheService from './cache.service'
import cdnService from './cdn.service'
import logger from './logger.service'

type ConversationCacheScope = 'history' | 'context' | 'artifacts'

class CacheInvalidationService {
  async invalidateConversation(sessionId: string, scopes: ConversationCacheScope[] = ['history', 'context']) {
    const tasks = scopes.map((scope) => {
      switch (scope) {
        case 'history':
          return cacheService.invalidate(`cache:history:${sessionId}`)
        case 'context':
          return cacheService.invalidate(`cache:context:${sessionId}`)
        case 'artifacts':
          return cacheService.invalidate(`cache:artifacts:${sessionId}`)
        default:
          return Promise.resolve(0)
      }
    })
    await Promise.all(tasks)
    applicationCache.invalidateByTag(`session:${sessionId}`)
    cdnService.scheduleInvalidation(`/api/conversations/${sessionId}`)
  }

  async invalidatePattern(pattern: string) {
    const redisResult = await cacheService.invalidate(pattern)
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    applicationCache.invalidateByPattern(new RegExp(`^${escaped}$`))
    logger.info('Cache invalidated', { pattern, redisResult })
    return { redisKeysRemoved: redisResult }
  }
}

export default new CacheInvalidationService()
