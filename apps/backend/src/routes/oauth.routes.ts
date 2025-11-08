/**
 * OAuth Routes
 * Google OAuth 2.0 authentication endpoints
 */

import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import googleAuthService from '../services/google-auth.service';
import jwtService from '../services/jwt.service';
import sessionService from '../services/session.service';
import { body, validationResult } from 'express-validator';
import config from '../utils/config';

const router = Router();

// Configure Google OAuth strategy
passport.use(new GoogleStrategy(
  {
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: config.GOOGLE_REDIRECT_URI,
    passReqToCallback: true,
  },
  async (req: Request, accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Process Google profile
      const user = await googleAuthService.processGoogleUser({
        googleId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        avatarUrl: profile.photos[0]?.value,
        accessToken,
        refreshToken,
      });

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await googleAuthService.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth flow
 * @access  Public
 */
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback handler
 * @access  Public
 */
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${config.FRONTEND_URL}/login?error=oauth_failed`,
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // Generate JWT tokens
      const tokens = jwtService.generateTokens(user.id, user.email, user.role);

      // Create session
      const session = await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: await sessionService.hashRefreshToken(tokens.refreshToken),
        deviceInfo: req.get('user-agent') || 'unknown',
        ipAddress: req.ip || req.connection.remoteAddress,
        expiresAt: sessionService.getRefreshExpiryDate(),
      });

      // Update user's Google tokens
      await googleAuthService.updateUserGoogleTokens(user.id, {
        accessToken: (req as any).accessToken,
        refreshToken: (req as any).refreshToken,
      });

      // Redirect to frontend with tokens
      const redirectUrl = new URL(`${config.FRONTEND_URL}/auth/callback`);
      redirectUrl.searchParams.set('accessToken', tokens.accessToken);
      redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
      redirectUrl.searchParams.set('expiresIn', tokens.expiresIn.toString());

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${config.FRONTEND_URL}/login?error=token_generation_failed`);
    }
  }
);

/**
 * @route   POST /api/auth/oauth/refresh
 * @desc    Refresh OAuth access token
 * @access  Public
 */
router.post('/oauth/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    body('provider').equals('google').withMessage('Only Google OAuth is supported'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { refreshToken, provider } = req.body;

      // Verify refresh token
      const decoded = jwtService.verifyRefreshToken(refreshToken);

      // Get user
      const user = await googleAuthService.getUserById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if session exists and is valid
      const session = await sessionService.getValidSession(refreshToken);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired session',
        });
      }

      // Refresh Google access token
      const newTokens = await googleAuthService.refreshGoogleAccessToken(user.id);

      // Generate new JWT tokens
      const jwtTokens = jwtService.generateTokens(user.id, user.email, user.role);

      // Update session with new refresh token
      await sessionService.rotateRefreshToken(session.id, {
        refreshTokenHash: await sessionService.hashRefreshToken(jwtTokens.refreshToken),
        expiresAt: sessionService.getRefreshExpiryDate(),
      });

      res.json({
        success: true,
        data: {
          accessToken: jwtTokens.accessToken,
          refreshToken: jwtTokens.refreshToken,
          expiresIn: jwtTokens.expiresIn,
          googleAccessToken: newTokens.accessToken,
        },
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        error: 'Token refresh failed',
      });
    }
  }
);

/**
 * @route   POST /api/auth/oauth/revoke
 * @desc    Revoke OAuth tokens and logout
 * @access  Private
 */
router.post('/oauth/revoke',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { refreshToken } = req.body;

      // Verify token
      const decoded = jwtService.verifyRefreshToken(refreshToken);

      // Revoke session
      await sessionService.revokeSession(refreshToken, 'user_requested');

      // Revoke Google tokens
      await googleAuthService.revokeGoogleTokens(decoded.userId);

      res.json({
        success: true,
        message: 'Tokens revoked successfully',
      });
    } catch (error) {
      console.error('Token revocation error:', error);
      res.status(500).json({
        success: false,
        error: 'Token revocation failed',
      });
    }
  }
);

/**
 * @route   GET /api/auth/oauth/status
 * @desc    Get OAuth connection status
 * @access  Private
 */
router.get('/oauth/status', async (req: Request, res: Response) => {
  try {
    // This would be protected by auth middleware in a real implementation
    // For now, return mock status
    res.json({
      success: true,
      data: {
        google: {
          connected: true,
          scopes: ['profile', 'email'],
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get OAuth status',
    });
  }
);

export default router;
