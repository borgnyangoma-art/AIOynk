import { Router, Request, Response } from 'express'
import { body, query, validationResult } from 'express-validator'

import cacheService from '../services/cache.service'
import applicationCache from '../services/applicationCache.service'
import cacheInvalidationService from '../services/cacheInvalidation.service'
import cdnService from '../services/cdn.service'

const router = Router()

router.get(
  '/',
  [query('pattern').optional().isString().trim(), query('limit').optional().isInt({ min: 1, max: 200 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: errors.array() })
    }

    const pattern = (req.query.pattern as string) || 'cache:*'
    const limit = req.query.limit ? Number(req.query.limit) : 50
    const keys = await cacheService.list(pattern, limit)
    res.json({ success: true, data: { keys, pattern } })
  },
)

router.delete(
  '/',
  [body('pattern').isString().trim()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: errors.array() })
    }

    const removed = await cacheService.invalidate(req.body.pattern as string)
    res.json({ success: true, data: { removed } })
  },
)

router.get(
  '/application',
  [query('limit').optional().isInt({ min: 1, max: 200 })],
  (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50
    const entries = applicationCache.inspect(limit)
    res.json({ success: true, data: { entries, limit } })
  },
)

router.delete(
  '/application',
  [
    body('pattern').optional().isString(),
    body('tag').optional().isString(),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: errors.array() })
    }

    if (req.body.tag) {
      applicationCache.invalidateByTag(req.body.tag)
    }
    if (req.body.pattern) {
      const escaped = req.body.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')
      applicationCache.invalidateByPattern(new RegExp(`^${escaped}$`))
    }

    res.json({ success: true })
  },
)

router.post(
  '/session',
  [body('sessionId').isString().trim()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: errors.array() })
    }
    await cacheInvalidationService.invalidateConversation(req.body.sessionId as string, ['history', 'context', 'artifacts'])
    res.json({ success: true })
  },
)

router.get('/cdn', (_req: Request, res: Response) => {
  res.json({ success: true, data: { invalidations: cdnService.list(), stats: cdnService.stats() } })
})

router.post(
  '/cdn',
  [body('pattern').isString().trim()],
  (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: errors.array() })
    }
    const record = cdnService.scheduleInvalidation(req.body.pattern as string)
    res.json({ success: true, data: record })
  },
)

export default router
