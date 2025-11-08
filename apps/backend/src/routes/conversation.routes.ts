import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'

import contextService, {
  ConversationMessage,
} from '../services/context.service'
import nlpService from '../services/nlp.service'

const router = Router()

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

    const { message, sessionId } = req.body
    const sanitizedMessage = sanitize(message)

    const userEntry: ConversationMessage = {
      role: 'user',
      content: sanitizedMessage,
      timestamp: new Date().toISOString(),
    }

    await contextService.appendMessage(sessionId, userEntry)
    const existingContext = (await contextService.getContext(sessionId)) || {
      history: [],
      tokenCount: 0,
      sessionId,
      updatedAt: new Date().toISOString(),
    }

    const intent = await nlpService.classifyIntent(sanitizedMessage)
    const contextHistory = existingContext.history.map((entry) => {
      const metadataIntent = entry.metadata?.intent
      return {
        message: entry.content,
        intent: typeof metadataIntent === 'string' ? metadataIntent : 'chat',
      }
    })

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
    const snapshot = await contextService.getContext(sessionId)

    return res.json({
      success: true,
      response: sanitize(assistantResponse),
      context: snapshot || context,
    })
  },
)

router.get('/history/:sessionId', (req: Request, res: Response) => {
  contextService
    .getContext(req.params.sessionId)
    .then((record) => res.json({ success: true, history: record?.history || [] }))
    .catch(() => res.status(500).json({ success: false, error: 'Failed to load history' }))
})

router.delete('/history/:sessionId', (req: Request, res: Response) => {
  contextService
    .clearContext(req.params.sessionId)
    .then(() => res.status(204).send())
    .catch(() => res.status(500).json({ success: false, error: 'Failed to clear history' }))
})

router.get('/context/:sessionId', async (req: Request, res: Response) => {
  const context = await contextService.getContext(req.params.sessionId)
  res.json({ success: true, data: context })
})

export default router
