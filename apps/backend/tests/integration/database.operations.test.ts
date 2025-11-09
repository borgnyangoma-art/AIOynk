import { Knex } from 'knex'

import googleAuthService, { GoogleUserData } from '../../src/services/google-auth.service'
import sessionService from '../../src/services/session.service'
import { testDb, generateId } from '../utils/memoryDb'

jest.mock('../../src/utils/database', () => ({
  __esModule: true,
  default: require('../utils/memoryDb').testDb,
}))

describe('Database-backed service flows', () => {
  beforeAll(async () => {
    await testDb.schema.createTable('users', (table: Knex.TableBuilder) => {
      table.uuid('id').primary().defaultTo(testDb.raw('gen_random_uuid()'))
      table.string('email').unique().notNullable()
      table.string('password_hash').notNullable()
      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.string('role').defaultTo('user')
      table.boolean('is_active').defaultTo(true)
      table.boolean('email_verified').defaultTo(false)
      table.timestamp('email_verified_at')
      table.string('google_id')
      table.string('google_access_token')
      table.string('google_refresh_token')
      table.timestamp('google_token_expires_at')
      table.string('avatar_url')
      table.timestamp('created_at').defaultTo(testDb.fn.now())
      table.timestamp('updated_at').defaultTo(testDb.fn.now())
    })

    await testDb.schema.createTable('user_preferences', (table: Knex.TableBuilder) => {
      table.increments('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.json('preferences').defaultTo('{}')
    })

    await testDb.schema.createTable('sessions', (table: Knex.TableBuilder) => {
      table.uuid('id').primary().defaultTo(testDb.raw('gen_random_uuid()'))
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.string('refresh_token_hash').notNullable()
      table.string('device_info')
      table.string('ip_address')
      table.timestamp('expires_at').notNullable()
      table.timestamp('revoked_at')
      table.string('revoked_reason')
      table.timestamp('created_at').defaultTo(testDb.fn.now())
      table.timestamp('updated_at').defaultTo(testDb.fn.now())
    })
  })

  beforeEach(async () => {
    await testDb('sessions').del()
    await testDb('user_preferences').del()
    await testDb('users').del()
  })

  afterAll(async () => {
    await testDb.destroy()
  })

  const buildGoogleUser = (overrides: Partial<GoogleUserData> = {}): GoogleUserData => ({
    googleId: overrides.googleId ?? 'google-user-1',
    email: overrides.email ?? 'drive-user@example.com',
    firstName: overrides.firstName ?? 'Drive',
    lastName: overrides.lastName ?? 'User',
    avatarUrl: overrides.avatarUrl ?? 'https://example.com/avatar.png',
    accessToken: overrides.accessToken ?? 'access-token',
    refreshToken: overrides.refreshToken ?? 'refresh-token',
  })

  it('persists Google users and preferences in a single flow', async () => {
    const created = await googleAuthService.processGoogleUser(buildGoogleUser())

    expect(created.email).toBe('drive-user@example.com')
    const storedPreferences = await testDb('user_preferences')
      .where('user_id', created.id)
      .first()
    expect(storedPreferences).toBeDefined()
    expect(JSON.parse(storedPreferences.preferences)).toEqual({})
  })

  it('links Google accounts to existing users and prevents duplicates', async () => {
    const [existingUser] = await testDb('users')
      .insert({
        id: generateId(),
        email: 'existing@example.com',
        password_hash: 'hashed',
        first_name: 'Existing',
        last_name: 'User',
        role: 'user',
        is_active: true,
      })
      .returning('*')

    const linked = await googleAuthService.linkGoogleAccount(
      existingUser.id,
      buildGoogleUser({ googleId: 'google-unique', email: existingUser.email }),
    )

    expect(linked.google_id).toBe('google-unique')

    const [otherUser] = await testDb('users')
      .insert({
        id: generateId(),
        email: 'second@example.com',
        password_hash: 'hashed',
        first_name: 'Second',
        last_name: 'User',
        role: 'user',
        is_active: true,
      })
      .returning('*')

    await expect(
      googleAuthService.linkGoogleAccount(
        otherUser.id,
        buildGoogleUser({ googleId: 'google-unique', email: otherUser.email }),
      ),
    ).rejects.toThrow('Failed to link Google account')
  })

  it('creates, rotates, and cleans up session records', async () => {
    const [user] = await testDb('users')
      .insert({
        id: generateId(),
        email: 'session-user@example.com',
        password_hash: 'hashed',
        first_name: 'Session',
        last_name: 'User',
        role: 'user',
        is_active: true,
      })
      .returning('*')

    const session = await sessionService.createSession({
      userId: user.id,
      refreshTokenHash: 'hashed-refresh',
      deviceInfo: 'Chrome',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 60 * 1000),
    })

    expect(session.user_id).toBe(user.id)

    await sessionService.rotateRefreshToken(session.id, {
      refreshTokenHash: 'new-refresh',
      expiresAt: new Date(Date.now() + 120 * 1000),
    })

    const updated = await testDb('sessions').where('id', session.id).first()
    expect(updated.refresh_token_hash).toBe('new-refresh')

    await testDb('sessions')
      .insert({
        id: generateId(),
        user_id: user.id,
        refresh_token_hash: 'expired-hash',
        expires_at: new Date(Date.now() - 60 * 1000),
      })

    await sessionService.cleanupExpiredSessions()

    const expired = await testDb('sessions')
      .where('refresh_token_hash', 'expired-hash')
      .first()
    expect(expired.revoked_reason).toBe('expired')
  })
})
