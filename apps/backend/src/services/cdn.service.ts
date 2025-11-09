import { randomUUID } from 'crypto'

import logger from './logger.service'

export type CdnInvalidationStatus = 'pending' | 'completed'

interface InvalidationRecord {
  id: string
  pattern: string
  requestedAt: string
  completedAt?: string
  status: CdnInvalidationStatus
}

class CdnService {
  private invalidations: InvalidationRecord[] = []

  scheduleInvalidation(pattern: string) {
    const record: InvalidationRecord = {
      id: randomUUID(),
      pattern,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    }
    this.invalidations.unshift(record)
    this.trim()

    // Simulate async purge completion
    setTimeout(() => {
      record.status = 'completed'
      record.completedAt = new Date().toISOString()
      logger.info('CDN cache invalidated', { id: record.id, pattern })
    }, 500)

    logger.info('Scheduled CDN invalidation', { id: record.id, pattern })
    return record
  }

  private trim() {
    if (this.invalidations.length > 100) {
      this.invalidations.length = 100
    }
  }

  list(limit = 20) {
    return this.invalidations.slice(0, limit)
  }

  stats() {
    const pending = this.invalidations.filter((entry) => entry.status === 'pending').length
    const completed = this.invalidations.filter((entry) => entry.status === 'completed').length
    return { pending, completed, total: this.invalidations.length }
  }
}

export default new CdnService()
