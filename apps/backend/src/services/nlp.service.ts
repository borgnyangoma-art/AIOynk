import axios from 'axios'
import { IntentClassification, RoutingResult } from '@aio/shared'

import config from '../utils/config'
import logger from './logger.service'
import metricsService from './metrics.service'
import applicationCache from './applicationCache.service'

const INTENT_KEYWORDS: Record<string, string[]> = {
  graphics: ['draw', 'design', 'logo', 'canvas', 'circle', 'square', 'color'],
  web_designer: ['website', 'landing page', 'responsive', 'hero', 'layout'],
  ide: ['code', 'function', 'script', 'bug', 'compile', 'run'],
  cad: ['3d', 'model', 'render', 'mesh', 'extrude'],
  video: ['video', 'clip', 'transition', 'render video', 'timeline'],
}

const SERVICE_ROUTES: Record<string, RoutingResult> = {
  graphics: { service: 'graphics-service', endpoint: '/canvas' },
  web_designer: { service: 'web-designer-service', endpoint: '/project' },
  ide: { service: 'ide-service', endpoint: '/project' },
  cad: { service: 'cad-service', endpoint: '/model' },
  video: { service: 'video-service', endpoint: '/project' },
  chat: { service: 'chat-service', endpoint: '/message' },
}

type RemoteIntentResponse = {
  success: boolean
  data: IntentClassification
}

type ConversationHistoryEntry = { role: string; message: string; intent?: string }

export interface NlpContextPayload {
  sessionId?: string
  history?: ConversationHistoryEntry[]
  activeTool?: string
  artifacts?: Array<{ id: string; tool?: string; name?: string }>
  metadata?: Record<string, unknown>
}

class KeywordClassifier {
  async classify(message: string): Promise<IntentClassification> {
    const start = process.hrtime.bigint()
    const lower = message.toLowerCase()
    let bestIntent = 'chat'
    let bestScore = 0
    let winningKeywords: string[] = []

    Object.entries(INTENT_KEYWORDS).forEach(([intent, keywords]) => {
      const count = keywords.reduce(
        (score, keyword) => (lower.includes(keyword) ? score + 1 : score),
        0,
      )
      const normalized = count / keywords.length
      if (normalized > bestScore) {
        bestIntent = intent
        bestScore = normalized
        winningKeywords = keywords.filter((keyword) => lower.includes(keyword))
      }
    })

    const entities = this.extractEntities(lower)
    const confidence = this.calculateConfidence(bestIntent, winningKeywords)

    const durationSeconds =
      Number(process.hrtime.bigint() - start) / 1_000_000_000
    metricsService.recordNlpProcessing(
      bestIntent,
      confidence,
      durationSeconds,
      bestIntent !== 'chat',
    )

    return {
      intent: bestIntent,
      confidence,
      entities,
      keywords: winningKeywords,
      route: SERVICE_ROUTES[bestIntent] ?? SERVICE_ROUTES.chat,
      fallback: bestIntent === 'chat',
      metadata: { source: 'local' },
    }
  }

  private extractEntities(message: string): Record<string, string> {
    const entities: Record<string, string> = {}

    const colorMatch = message.match(/(red|blue|green|yellow|purple|orange)/)
    if (colorMatch) {
      entities.color = colorMatch[1]
    }

    const shapeMatch = message.match(/(circle|square|rectangle|triangle|logo)/)
    if (shapeMatch) {
      entities.shape = shapeMatch[1]
    }

    const sizeMatch = message.match(/(\d+)(px|pixels|cm|mm)?/)
    if (sizeMatch) {
      entities.size = sizeMatch[1]
    }

    const primitiveMatch = message.match(/(cube|sphere|cylinder|torus)/)
    if (primitiveMatch) {
      entities.primitive = primitiveMatch[1]
    }

    return entities
  }

  private calculateConfidence(intent: string, keywords: string[]): number {
    if (intent === 'chat') {
      return 0.3
    }

    const maxKeywords = INTENT_KEYWORDS[intent]?.length || 1
    return Math.min(1, keywords.length / maxKeywords + 0.5)
  }
}

export class NLPService {
  private readonly fallback = new KeywordClassifier()

  private buildCacheKey(message: string, context: NlpContextPayload) {
    const normalized = message.trim().toLowerCase().slice(0, 300)
    const lastIntent = context.history?.slice(-1)?.[0]?.intent ?? 'none'
    const activeTool = context.activeTool ?? 'none'
    const session = context.sessionId ?? 'anon'
    return `nlp:${session}:${activeTool}:${lastIntent}:${normalized}`
  }

  async classifyIntent(
    message: string,
    context: NlpContextPayload = {},
  ): Promise<IntentClassification> {
    const cacheKey = this.buildCacheKey(message, context)
    const cached = applicationCache.get<IntentClassification>(cacheKey)
    if (cached) {
      return {
        ...cached,
        metadata: { ...(cached.metadata || {}), cacheHit: true },
      }
    }

    const remoteResult = await this.callRemoteService(message, context)
    const result = remoteResult ?? (await this.fallback.classify(message))

    const tags = ['nlp']
    if (context.sessionId) {
      tags.push(`session:${context.sessionId}`)
    }
    applicationCache.set(cacheKey, result, 120, tags)

    return result
  }

  private async callRemoteService(
    message: string,
    context: NlpContextPayload,
  ): Promise<IntentClassification | null> {
    if (!config.NLP_SERVICE_URL) {
      return null
    }

    try {
      const response = await axios.post<RemoteIntentResponse>(
        `${config.NLP_SERVICE_URL}/api/v1/nlp/intent`,
        {
          message,
          sessionId: context.sessionId,
          history: context.history,
          activeTool: context.activeTool,
          artifacts: context.artifacts,
          metadata: context.metadata,
        },
        {
          timeout: config.NLP_SERVICE_TIMEOUT_MS,
        },
      )

      if (response.data?.success && response.data.data) {
        const payload = response.data.data
        metricsService.recordNlpProcessing(
          payload.intent,
          payload.confidence,
          (payload.metadata?.processingTimeMs ?? 0) / 1000,
          payload.intent !== 'chat',
        )
        return payload
      }
    } catch (error) {
      logger.warn('Remote NLP service unavailable, falling back', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return null
  }

  async routeRequest(message: string, context: NlpContextPayload = {}) {
    const classification = await this.classifyIntent(message, context)
    const route = classification.route ?? SERVICE_ROUTES[classification.intent] ?? SERVICE_ROUTES.chat
    return {
      ...route,
      parameters: classification.entities,
    }
  }

  generateContext(
    message: string,
    intent: string,
    entities: Record<string, any> = {},
    history: Array<{ message: string; intent: string }> = [],
  ) {
    return {
      message,
      intent,
      entities,
      history,
      timestamp: new Date().toISOString(),
    }
  }
}

export default new NLPService()
