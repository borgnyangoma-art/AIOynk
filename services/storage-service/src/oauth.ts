import { google } from 'googleapis'
import { v4 as uuidv4 } from 'uuid'

import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  USE_MOCK_GOOGLE,
} from './config'
import { TokenStore } from './store'
import logger from './logger'

export class GoogleOAuthService {
  private client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  )
  constructor(private tokenStore: TokenStore) {}

  generateAuthUrl(state: string) {
    if (USE_MOCK_GOOGLE) {
      return `https://mock.google/consent?state=${state}`
    }
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state,
      prompt: 'consent',
    })
  }

  async exchangeCode(userId: string, code: string) {
    if (USE_MOCK_GOOGLE) {
      const token = {
        access_token: `mock-access-${uuidv4()}`,
        refresh_token: `mock-refresh-${uuidv4()}`,
        expiry_date: Date.now() + 3600 * 1000,
        token_type: 'Bearer',
        scope: 'mock',
      }
      await this.tokenStore.set(userId, {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiryDate: token.expiry_date,
        scope: token.scope,
        tokenType: token.token_type,
      })
      return token
    }

    const { tokens } = await this.client.getToken(code)
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new Error('Incomplete token response from Google')
    }
    await this.tokenStore.set(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      idToken: tokens.id_token,
    })
    logger.info(`Stored Google tokens for user ${userId}`)
    return tokens
  }
}
