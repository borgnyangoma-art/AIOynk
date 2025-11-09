import config from '../utils/config'

import redisService from './redis.service'
import metricsService from './metrics.service'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface ArtifactReference {
  id: string
  tool: string
  name: string
  url?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface ContextRecord {
  sessionId: string
  history: ConversationMessage[]
  summary?: string
  tokenCount: number
  updatedAt: string
  references?: ArtifactReference[]
}

class ContextService {
  private readonly prefix = 'context'
  private readonly tokenLimit = 10000
  private readonly ttlSeconds = config.REDIS_SESSION_TTL
  private readonly referenceLimit = 25

  private key(sessionId: string) {
    return `${this.prefix}:${sessionId}`
  }

  private createRecord(sessionId: string): ContextRecord {
    return {
      sessionId,
      history: [],
      tokenCount: 0,
      updatedAt: new Date().toISOString(),
      references: [],
    }
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
    try {
      const existing = (await this.read(sessionId)) || this.createRecord(sessionId)

      existing.history.push(message)
      existing.tokenCount += this.countTokens(message.content)
      existing.updatedAt = new Date().toISOString()

      if (existing.tokenCount > this.tokenLimit) {
        existing.summary = this.summarize(existing.history)
        existing.history = existing.history.slice(-10)
        existing.tokenCount = this.countTokens(existing.summary)
      }

      await this.write(sessionId, existing)
      this.recordOperation('append', 'success')
      this.updateContextSize(sessionId, existing)
      return existing
    } catch (error) {
      this.recordOperation('append', 'error')
      throw error
    }
  }

  async addArtifactReference(
    sessionId: string,
    payload: Omit<ArtifactReference, 'createdAt'>,
  ): Promise<ArtifactReference> {
    try {
      const record = (await this.read(sessionId)) || this.createRecord(sessionId)
      const reference: ArtifactReference = {
        ...payload,
        createdAt: new Date().toISOString(),
      }
      const references = record.references ?? []
      references.push(reference)
      record.references = references.slice(-this.referenceLimit)
      record.updatedAt = new Date().toISOString()
      await this.write(sessionId, record)
      this.recordOperation('add_artifact', 'success')
      this.updateContextSize(sessionId, record)
      return reference
    } catch (error) {
      this.recordOperation('add_artifact', 'error')
      throw error
    }
  }

  async getArtifactReferences(sessionId: string): Promise<ArtifactReference[]> {
    const record = await this.read(sessionId)
    return record?.references ?? []
  }

  async removeArtifactReference(sessionId: string, artifactId: string) {
    try {
      const record = await this.read(sessionId)
      if (!record?.references?.length) {
        return
      }
      record.references = record.references.filter((ref) => ref.id !== artifactId)
      await this.write(sessionId, record)
      this.recordOperation('remove_artifact', 'success')
      this.updateContextSize(sessionId, record)
    } catch (error) {
      this.recordOperation('remove_artifact', 'error')
      throw error
    }
  }

  async saveContext(sessionId: string, record: ContextRecord) {
    try {
      await this.write(sessionId, record)
      this.recordOperation('save', 'success')
      this.updateContextSize(sessionId, record)
    } catch (error) {
      this.recordOperation('save', 'error')
      throw error
    }
  }

  async clearContext(sessionId: string) {
    try {
      await redisService.getClient().del(this.key(sessionId))
      this.recordOperation('clear', 'success')
      this.updateContextSize(sessionId, null)
    } catch (error) {
      this.recordOperation('clear', 'error')
      throw error
    }
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

  private recordOperation(operation: string, status: 'success' | 'error') {
    metricsService.contextOperationsTotal.inc({ operation, status })
  }

  private updateContextSize(sessionId: string, record: ContextRecord | null) {
    const sizeBytes = record ? Buffer.byteLength(JSON.stringify(record)) : 0
    metricsService.contextSizeBytes.set({ session_id: sessionId }, sizeBytes)
  }
}

export default new ContextService()
