import { IntentClassification, RoutingResult } from '@aio/shared'

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
}

export class NLPService {
  async classifyIntent(message: string): Promise<IntentClassification> {
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

    return {
      intent: bestIntent,
      confidence,
      entities,
      keywords: winningKeywords,
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

  async routeRequest(message: string): Promise<RoutingResult & { parameters?: Record<string, any> }> {
    const classification = await this.classifyIntent(message)
    const route = SERVICE_ROUTES[classification.intent] ?? {
      service: 'chat-service',
      endpoint: '/message',
    }

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
