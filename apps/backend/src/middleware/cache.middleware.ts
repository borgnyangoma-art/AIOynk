import { Request, Response, NextFunction } from 'express'

import cacheService from '../services/cache.service'
import logger from '../services/logger.service'

type CacheOptions = {
  ttlSeconds: number
  keyBuilder?: (req: Request) => string
}

export const cacheResponse =
  (options: CacheOptions) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next()
    }

    const cacheKey =
      options.keyBuilder?.(req) || `${req.originalUrl}`.toLowerCase()

    try {
      const cached = await cacheService.get<unknown>(cacheKey)
      if (cached) {
        return res.json({ success: true, cached: true, data: cached })
      }
    } catch (error) {
      logger.warn('Failed to read cache entry', { cacheKey, error })
    }

    const originalJson = res.json.bind(res)
    res.json = (body: any) => {
      if (body?.success && body.data !== undefined) {
        void cacheService.set(cacheKey, body.data, options.ttlSeconds)
      }
      return originalJson(body)
    }

    next()
  }
