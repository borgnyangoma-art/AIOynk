import rateLimit, { Options, Store } from 'express-rate-limit'

import redisService from '../services/redis.service'
import config from '../utils/config'

class RedisRateLimitStore implements Store {
  private readonly prefix = 'rate-limit'
  private readonly windowSeconds: number

  constructor(private readonly options: Options = {} as Options, private readonly ttlMs: number) {
    this.windowSeconds = Math.ceil(ttlMs / 1000)
  }

  private buildKey(key: string) {
    return `${this.prefix}:${key}`
  }

  async increment(key: string) {
    const client = redisService.getClient()
    const redisKey = this.buildKey(key)
    const totalHits = await client.incr(redisKey)
    if (totalHits === 1) {
      await client.expire(redisKey, this.windowSeconds)
    }

    return {
      totalHits,
      resetTime: new Date(Date.now() + this.ttlMs),
    }
  }

  async decrement(key: string) {
    const client = redisService.getClient()
    const redisKey = this.buildKey(key)
    const current = await client.get(redisKey)
    if (current && Number(current) > 0) {
      await client.decr(redisKey)
    }
  }

  async resetKey(key: string) {
    const client = redisService.getClient()
    await client.del(this.buildKey(key))
  }

  // Full reset would require scanning; skip to avoid perf hit
  async resetAll() {
    return
  }
}

const windowMs = config.RATE_LIMIT_WINDOW_MS

const rateLimitMiddleware = rateLimit({
  windowMs,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  keyGenerator: (req) =>
    (req.ip || req.headers['x-forwarded-for']?.toString() || 'global').toString(),
  store: new RedisRateLimitStore({}, windowMs),
})

export default rateLimitMiddleware
