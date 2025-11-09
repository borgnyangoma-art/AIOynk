import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'

import contextService, {
  ConversationMessage,
} from '../services/context.service'
import nlpService, { NlpContextPayload } from '../services/nlp.service'
import { cacheResponse } from '../middleware/cache.middleware'
import cacheInvalidationService from '../services/cacheInvalidation.service'
import logger from '../services/logger.service'
import metricsService from '../services/metrics.service'

const router = Router()

const historyCacheKey = (sessionId: string) => `cache:history:${sessionId}`
const contextCacheKey = (sessionId: string) => `cache:context:${sessionId}`
const artifactCacheKey = (sessionId: string) => `cache:artifacts:${sessionId}`

const sanitize = (value: string) => {
  let sanitized = value.replace(/<script.*?>[\s\S]*?<\/script>/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=\s*"[^"]*"/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=\s*'[^']*'/gi, '')
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return sanitized
}

router.post(
  '/message',
  [
    body('message').isString().trim().isLength({ min: 1, max: 2000 }),
    body('sessionId').isString().trim(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Message too long or invalid' })
    }

    const routeStart = process.hrtime.bigint()

    try {
      const { message, sessionId } = req.body
      const sanitizedMessage = sanitize(message)

      const userEntry: ConversationMessage = {
        role: 'user',
        content: sanitizedMessage,
        timestamp: new Date().toISOString(),
      }

      await contextService.appendMessage(sessionId, userEntry)
      await cacheInvalidationService.invalidateConversation(sessionId, ['history', 'context'])
      const existingContext = (await contextService.getContext(sessionId)) || {
        history: [],
        tokenCount: 0,
        sessionId,
        updatedAt: new Date().toISOString(),
        references: [],
      }

      const nlpContext: NlpContextPayload = {
        sessionId,
        history: existingContext.history.map((entry) => {
          const metadataIntent = entry.metadata?.intent
          return {
            role: entry.role,
            message: entry.content,
            intent: typeof metadataIntent === 'string' ? metadataIntent : undefined,
          }
        }),
        activeTool: req.body?.activeTool,
        artifacts: existingContext.references?.map((reference) => ({
          id: reference.id,
          tool: reference.tool,
          name: reference.name,
        })),
      }

      const intent = await nlpService.classifyIntent(sanitizedMessage, nlpContext)
      const contextHistory = (nlpContext.history || []).map((entry) => ({
        message: entry.message,
        intent: entry.intent || 'chat',
      }))

      const context = nlpService.generateContext(
        sanitizedMessage,
        intent.intent,
        intent.entities || {},
        contextHistory,
      )

      const assistantResponse = `Noted: ${sanitizedMessage}`
      const assistantEntry: ConversationMessage = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString(),
        metadata: { intent: intent.intent },
      }

      await contextService.appendMessage(sessionId, assistantEntry)
      await cacheInvalidationService.invalidateConversation(sessionId, ['history', 'context'])
      const snapshot = await contextService.getContext(sessionId)

      const durationSeconds =
        Number(process.hrtime.bigint() - routeStart) / 1_000_000_000
      const routedTool = intent.intent === 'chat' ? 'assistant' : intent.intent
      metricsService.recordToolOperation(
        routedTool,
        'conversation_route',
        durationSeconds,
        'success',
      )
      logger.info('Conversation message processed', {
        sessionId,
        intent: intent.intent,
        durationMs: durationSeconds * 1000,
      })

      return res.json({
        success: true,
        response: sanitize(assistantResponse),
        context: snapshot || context,
      })
    } catch (error) {
      const durationSeconds =
        Number(process.hrtime.bigint() - routeStart) / 1_000_000_000
      metricsService.recordToolOperation('assistant', 'conversation_route', durationSeconds, 'error')
      metricsService.appErrorsTotal.inc({
        error_type: 'conversation_error',
        service: 'backend',
        severity: 'error',
      })
      logger.error('Conversation processing failed', error as Error)

      return res.status(500).json({
        success: false,
        error: 'Failed to process message',
      })
    }
  },
)

router.get(
  '/history/:sessionId',
  cacheResponse({
    ttlSeconds: 60,
    keyBuilder: (req) => historyCacheKey(req.params.sessionId),
  }),
  (req: Request, res: Response) => {
    contextService
      .getContext(req.params.sessionId)
      .then((record) =>
        res.json({ success: true, data: record?.history || [] }),
      )
      .catch(() =>
        res.status(500).json({ success: false, error: 'Failed to load history' }),
      )
  },
)

router.delete('/history/:sessionId', (req: Request, res: Response) => {
  contextService
    .clearContext(req.params.sessionId)
    .then(async () => {
      await cacheInvalidationService.invalidateConversation(req.params.sessionId, ['history', 'context', 'artifacts'])
      res.status(204).send()
    })
    .catch(() =>
      res.status(500).json({ success: false, error: 'Failed to clear history' }),
    )
})

router.get(
  '/context/:sessionId',
  cacheResponse({
    ttlSeconds: 30,
    keyBuilder: (req) => contextCacheKey(req.params.sessionId),
  }),
  async (req: Request, res: Response) => {
    const context = await contextService.getContext(req.params.sessionId)
    res.json({ success: true, data: context })
  },
)

router.get(
  '/:sessionId/artifacts',
  cacheResponse({
    ttlSeconds: 120,
    keyBuilder: (req) => artifactCacheKey(req.params.sessionId),
  }),
  async (req: Request, res: Response) => {
    try {
      const references = await contextService.getArtifactReferences(req.params.sessionId)
      res.json({ success: true, data: references })
    } catch (error) {
      logger.error('Failed to load artifact references', error as Error)
      res.status(500).json({ success: false, error: 'Failed to load artifact references' })
    }
  },
)

router.post(
  '/:sessionId/artifacts',
  [
    body('id').isString().trim().notEmpty(),
    body('tool').isString().trim().notEmpty(),
    body('name').isString().trim().notEmpty(),
    body('url').optional().isString(),
    body('metadata').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid artifact payload', details: errors.array() })
    }

    try {
      const created = await contextService.addArtifactReference(req.params.sessionId, {
        id: req.body.id,
        tool: req.body.tool,
        name: req.body.name,
        url: req.body.url,
        metadata: req.body.metadata,
      })
      await cacheInvalidationService.invalidateConversation(req.params.sessionId, ['artifacts', 'context'])
      res.status(201).json({ success: true, data: created })
    } catch (error) {
      logger.error('Failed to add artifact reference', error as Error)
      res.status(500).json({ success: false, error: 'Failed to add artifact reference' })
    }
  },
)

router.delete('/:sessionId/artifacts/:artifactId', async (req: Request, res: Response) => {
  try {
    await contextService.removeArtifactReference(req.params.sessionId, req.params.artifactId)
    await cacheInvalidationService.invalidateConversation(req.params.sessionId, ['artifacts', 'context'])
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to remove artifact reference', error as Error)
    res.status(500).json({ success: false, error: 'Failed to remove artifact reference' })
  }
})

export default router
