import bcrypt from 'bcrypt'

import config from '../utils/config'
import database from '../utils/database'

import logger from './logger.service'
import metricsService from './metrics.service'

export interface SessionRecord {
  id: string
  user_id: string
  refresh_token_hash: string
  device_info?: string
  ip_address?: string
  expires_at: Date
  revoked_at?: Date
  revoked_reason?: string
  created_at?: Date
  updated_at?: Date
}

interface CreateSessionInput {
  userId: string
  refreshTokenHash: string
  deviceInfo?: string
  ipAddress?: string
  expiresAt: Date
}

interface RotateSessionInput {
  refreshTokenHash: string
  expiresAt: Date
}

export class SessionService {
  private cleanupTimer?: NodeJS.Timeout
  private readonly cleanupIntervalMs = 1000 * 60 * 30 // every 30 minutes
  private readonly saltRounds = parseInt(
    process.env.BCRYPT_SALT_ROUNDS || '12',
    10,
  )
  private readonly refreshTokenTtlMs = this.parseDuration(
    config.REFRESH_TOKEN_EXPIRATION || '7d',
  )

  async initialize(): Promise<void> {
    await this.cleanupExpiredSessions()
    await this.refreshActiveSessionGauge()
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSessions()
    }, this.cleanupIntervalMs)
    logger.info('Session service initialized')
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const [session] = await database('sessions')
      .insert({
        user_id: input.userId,
        refresh_token_hash: input.refreshTokenHash,
        device_info: input.deviceInfo,
        ip_address: input.ipAddress,
        expires_at: input.expiresAt,
      })
      .returning('*')

    await this.refreshActiveSessionGauge()
    return session as SessionRecord
  }

  async getValidSession(refreshToken: string): Promise<SessionRecord | null> {
    const candidateSessions: SessionRecord[] = await database('sessions')
      .whereNull('revoked_at')
      .andWhere('expires_at', '>', new Date())

    for (const session of candidateSessions) {
      const matches = await bcrypt.compare(
        refreshToken,
        session.refresh_token_hash,
      )
      if (matches) {
        return session
      }
    }

    return null
  }

  async rotateRefreshToken(
    sessionId: string,
    input: RotateSessionInput,
  ): Promise<void> {
    await database('sessions').where('id', sessionId).update({
      refresh_token_hash: input.refreshTokenHash,
      expires_at: input.expiresAt,
      updated_at: new Date(),
    })
  }

  async revokeSession(
    sessionId: string,
    reason: string = 'user_logout',
  ): Promise<void> {
    await database('sessions')
      .where('id', sessionId)
      .update({
        revoked_at: new Date(),
        revoked_reason: reason,
      })
    await this.refreshActiveSessionGauge()
  }

  async revokeAllSessionsForUser(
    userId: string,
    reason: string = 'security_reset',
  ): Promise<void> {
    await database('sessions')
      .where('user_id', userId)
      .whereNull('revoked_at')
      .update({
        revoked_at: new Date(),
        revoked_reason: reason,
      })
    await this.refreshActiveSessionGauge()
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const updated = await database('sessions')
        .where('expires_at', '<=', new Date())
        .whereNull('revoked_at')
        .update({
          revoked_at: new Date(),
          revoked_reason: 'expired',
        })

      if (updated > 0) {
        logger.info(`Session service cleaned up ${updated} expired session(s)`)
        await this.refreshActiveSessionGauge()
      }
    } catch (error) {
      logger.error('Failed to clean up sessions', error as Error)
    }
  }

  async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, this.saltRounds)
  }

  async compareRefreshToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash)
  }

  getRefreshExpiryDate(): Date {
    return new Date(Date.now() + this.refreshTokenTtlMs)
  }

  private parseDuration(value: string): number {
    const unit = value.slice(-1)
    const amount = parseInt(value.slice(0, -1), 10)

    switch (unit) {
      case 's':
        return amount * 1000
      case 'm':
        return amount * 60 * 1000
      case 'h':
        return amount * 60 * 60 * 1000
      case 'd':
        return amount * 24 * 60 * 60 * 1000
      default:
        return 7 * 24 * 60 * 60 * 1000 // fallback to one week
    }
  }

  private async refreshActiveSessionGauge(): Promise<void> {
    try {
      const queryResult = (await database('sessions')
        .whereNull('revoked_at')
        .andWhere('expires_at', '>', new Date())
        .count<{ count: string }>('id as count')) as unknown as Array<{ count: string }>
      const [row = { count: '0' }] = queryResult
      const count = Number(row.count ?? 0)
      metricsService.activeSessionsTotal.set(count)
    } catch (error) {
      logger.warn('Failed to refresh active session gauge', error as Error)
    }
  }
}

export default new SessionService()
