import redisService from './redis.service'
import logger from './logger.service'

class CacheService {
  private get client() {
    return redisService.getClient()
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.client.get(key)
    if (!cached) {
      return null
    }
    try {
      return JSON.parse(cached) as T
    } catch (error) {
      logger.warn('Failed to parse cached payload', { key, error })
      await this.client.del(key)
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      logger.warn('Failed to store cache entry', { key, error })
    }
  }

  async invalidate(pattern: string): Promise<number> {
    let removed = 0
    const pipeline = this.client.multi()

    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      pipeline.del(key as string)
      removed += 1
    }

    if (removed > 0) {
      await pipeline.exec()
    }

    return removed
  }

  async list(pattern: string, limit = 50): Promise<string[]> {
    const keys: string[] = []
    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(String(key))
      if (keys.length >= limit) {
        break
      }
    }
    return keys
  }
}

export default new CacheService()
