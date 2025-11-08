/**
 * Google OAuth Authentication Service
 * Handles Google OAuth 2.0 integration and user management
 */

import { Request, Response } from 'express';
import database from '../utils/database';
import bcrypt from 'bcrypt';

export interface GoogleUserData {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

class GoogleAuthService {
  /**
   * Process Google user and create/update in database
   */
  async processGoogleUser(userData: GoogleUserData): Promise<any> {
    try {
      // Check if user exists by Google ID
      let user = await database('users')
        .where('google_id', userData.googleId)
        .first();

      if (user) {
        // Update existing user
        user = await database('users')
          .where('id', user.id)
          .update({
            first_name: userData.firstName,
            last_name: userData.lastName,
            avatar_url: userData.avatarUrl,
            google_access_token: userData.accessToken,
            google_refresh_token: userData.refreshToken,
            google_token_expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour
            email_verified: true,
            email_verified_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*')
          .then(rows => rows[0]);
      } else {
        // Check if user exists by email
        const existingEmailUser = await database('users')
          .where('email', userData.email)
          .first();

        if (existingEmailUser) {
          // Link Google account to existing user
          user = await database('users')
            .where('id', existingEmailUser.id)
            .update({
              google_id: userData.googleId,
              google_access_token: userData.accessToken,
              google_refresh_token: userData.refreshToken,
              google_token_expires_at: new Date(Date.now() + 3600 * 1000),
              email_verified: true,
              email_verified_at: new Date(),
              updated_at: new Date(),
            })
            .returning('*')
            .then(rows => rows[0]);
        } else {
          // Create new user
          const passwordHash = await bcrypt.hash(
            this.generateRandomPassword(),
            12
          );

          user = await database('users')
            .insert({
              email: userData.email,
              password_hash: passwordHash,
              first_name: userData.firstName,
              last_name: userData.lastName,
              google_id: userData.googleId,
              google_access_token: userData.accessToken,
              google_refresh_token: userData.refreshToken,
              google_token_expires_at: new Date(Date.now() + 3600 * 1000),
              avatar_url: userData.avatarUrl,
              role: 'user',
              email_verified: true,
              email_verified_at: new Date(),
              is_active: true,
            })
            .returning('*')
            .then(rows => rows[0]);
        }
      }

      // Create user preferences if they don't exist
      await this.ensureUserPreferences(user.id);

      return user;
    } catch (error) {
      console.error('Error processing Google user:', error);
      throw new Error('Failed to process Google user');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any> {
    try {
      const user = await database('users')
        .where('id', userId)
        .where('is_active', true)
        .select(
          'id',
          'email',
          'first_name',
          'last_name',
          'avatar_url',
          'role',
          'google_id',
          'email_verified'
        )
        .first();

      return user || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Get user by Google ID
   */
  async getUserByGoogleId(googleId: string): Promise<any> {
    try {
      const user = await database('users')
        .where('google_id', googleId)
        .where('is_active', true)
        .first();

      return user || null;
    } catch (error) {
      console.error('Error getting user by Google ID:', error);
      throw new Error('Failed to get user by Google ID');
    }
  }

  /**
   * Update user's Google tokens
   */
  async updateUserGoogleTokens(userId: string, tokens: GoogleTokens): Promise<void> {
    try {
      await database('users')
        .where('id', userId)
        .update({
          google_access_token: tokens.accessToken,
          google_refresh_token: tokens.refreshToken,
          google_token_expires_at: tokens.expiresAt,
          updated_at: new Date(),
        });
    } catch (error) {
      console.error('Error updating Google tokens:', error);
      throw new Error('Failed to update Google tokens');
    }
  }

  /**
   * Refresh Google access token
   */
  async refreshGoogleAccessToken(userId: string): Promise<GoogleTokens> {
    try {
      const user = await database('users')
        .where('id', userId)
        .select('google_refresh_token')
        .first();

      if (!user?.google_refresh_token) {
        throw new Error('No refresh token available');
      }

      // In a real implementation, you would use Google's OAuth2 API here
      // For now, return mock tokens
      const newAccessToken = 'refreshed_access_token_' + Date.now();
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      await this.updateUserGoogleTokens(userId, {
        accessToken: newAccessToken,
        refreshToken: user.google_refresh_token,
        expiresAt,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: user.google_refresh_token,
        expiresAt,
      };
    } catch (error) {
      console.error('Error refreshing Google access token:', error);
      throw new Error('Failed to refresh Google access token');
    }
  }

  /**
   * Revoke Google tokens
   */
  async revokeGoogleTokens(userId: string): Promise<void> {
    try {
      await database('users')
        .where('id', userId)
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
          updated_at: new Date(),
        });
    } catch (error) {
      console.error('Error revoking Google tokens:', error);
      throw new Error('Failed to revoke Google tokens');
    }
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId: string, googleData: GoogleUserData): Promise<any> {
    try {
      // Check if Google account is already linked to another user
      const existingGoogleUser = await this.getUserByGoogleId(googleData.googleId);
      if (existingGoogleUser && existingGoogleUser.id !== userId) {
        throw new Error('Google account already linked to another user');
      }

      // Update user with Google information
      const user = await database('users')
        .where('id', userId)
        .update({
          google_id: googleData.googleId,
          google_access_token: googleData.accessToken,
          google_refresh_token: googleData.refreshToken,
          google_token_expires_at: new Date(Date.now() + 3600 * 1000),
          avatar_url: googleData.avatarUrl,
          updated_at: new Date(),
        })
        .returning('*')
        .then(rows => rows[0]);

      return user;
    } catch (error) {
      console.error('Error linking Google account:', error);
      throw new Error('Failed to link Google account');
    }
  }

  /**
   * Unlink Google account from user
   */
  async unlinkGoogleAccount(userId: string): Promise<void> {
    try {
      await database('users')
        .where('id', userId)
        .update({
          google_id: null,
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
          updated_at: new Date(),
        });
    } catch (error) {
      console.error('Error unlinking Google account:', error);
      throw new Error('Failed to unlink Google account');
    }
  }

  /**
   * Ensure user preferences exist
   */
  private async ensureUserPreferences(userId: string): Promise<void> {
    try {
      const existing = await database('user_preferences')
        .where('user_id', userId)
        .first();

      if (!existing) {
        await database('user_preferences').insert({
          user_id: userId,
          preferences: {},
        });
      }
    } catch (error) {
      console.error('Error ensuring user preferences:', error);
    }
  }

  /**
   * Generate random password for OAuth users
   */
  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Get user's Google connection status
   */
  async getGoogleConnectionStatus(userId: string): Promise<any> {
    try {
      const user = await database('users')
        .where('id', userId)
        .select('google_id', 'google_access_token', 'google_token_expires_at')
        .first();

      return {
        connected: !!user?.google_id,
        hasValidToken: !!user?.google_access_token && !!user?.google_token_expires_at,
        expiresAt: user?.google_token_expires_at,
      };
    } catch (error) {
      console.error('Error getting Google connection status:', error);
      throw new Error('Failed to get Google connection status');
    }
  }
}

export default new GoogleAuthService();
