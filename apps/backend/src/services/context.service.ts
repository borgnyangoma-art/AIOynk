import config from '../utils/config'

import redisService from './redis.service'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface ContextRecord {
  sessionId: string
  history: ConversationMessage[]
  summary?: string
  tokenCount: number
  updatedAt: string
}

class ContextService {
  private readonly prefix = 'context'
  private readonly tokenLimit = 10000
  private readonly ttlSeconds = config.REDIS_SESSION_TTL

  private key(sessionId: string) {
    return `${this.prefix}:${sessionId}`
  }

  private async read(sessionId: string): Promise<ContextRecord | null> {
    const raw = await redisService.getClient().get(this.key(sessionId))
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as ContextRecord
  }

  private async write(sessionId: string, record: ContextRecord) {
    await redisService
      .getClient()
      .setEx(this.key(sessionId), this.ttlSeconds, JSON.stringify(record))
  }

  async getContext(sessionId: string): Promise<ContextRecord | null> {
    return this.read(sessionId)
  }

  async appendMessage(sessionId: string, message: ConversationMessage) {
    const existing = (await this.read(sessionId)) || {
      sessionId,
      history: [],
      tokenCount: 0,
      updatedAt: new Date().toISOString(),
    }

    existing.history.push(message)
    existing.tokenCount += this.countTokens(message.content)
    existing.updatedAt = new Date().toISOString()

    if (existing.tokenCount > this.tokenLimit) {
      existing.summary = this.summarize(existing.history)
      existing.history = existing.history.slice(-10)
      existing.tokenCount = this.countTokens(existing.summary)
    }

    await this.write(sessionId, existing)
    return existing
  }

  async saveContext(sessionId: string, record: ContextRecord) {
    await this.write(sessionId, record)
  }

  async clearContext(sessionId: string) {
    await redisService.getClient().del(this.key(sessionId))
  }

  private countTokens(text: string) {
    return Math.ceil(text.length / 4)
  }

  private summarize(history: ConversationMessage[]) {
    const recent = history.slice(-20)
    const combined = recent
      .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
      .join(' ')
    return combined.slice(-4000)
  }
}

export default new ContextService()
