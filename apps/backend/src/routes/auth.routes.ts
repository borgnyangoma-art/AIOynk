import bcrypt from 'bcrypt'
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'

import { authenticate, AuthRequest } from '../middleware/auth.middleware'
import jwtService from '../services/jwt.service'
import sessionService from '../services/session.service'
import database from '../utils/database'
import logger from '../services/logger.service'
import metricsService from '../services/metrics.service'

const router = Router()

type DbUser = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  avatar_url?: string | null
  email_verified: boolean
}

const hashRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)

const sanitizeText = (value: string) =>
  value
    .replace(/<script.*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()

const handleValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    })
    return true
  }
  return false
}

router.get('/health', (_req, res) => {
  res
    .set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; object-src 'none';",
    )
    .json({ status: 'ok', timestamp: new Date().toISOString() })
})

const formatUser = (user: DbUser) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  role: user.role,
  avatar: user.avatar_url,
  emailVerified: user.email_verified,
})

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
  ],
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) {
      return
    }

    try {
      const { email, password, firstName, lastName } = req.body
      const safeFirstName = sanitizeText(firstName || '')
      const safeLastName = sanitizeText(lastName || '')

      const existingUser = await database('users')
        .whereRaw('LOWER(email) = ?', email.toLowerCase())
        .first()

      if (existingUser) {
        metricsService.authFailuresTotal.inc({
          auth_type: 'registration',
          reason: 'email_exists',
        })
        return res.status(409).json({
          success: false,
          error: 'Email already in use',
        })
      }

      const passwordHash = await bcrypt.hash(password, hashRounds)

      const [user] = await database('users')
        .insert({
          email,
          password_hash: passwordHash,
          first_name: safeFirstName,
          last_name: safeLastName,
          role: 'user',
          email_verified: false,
          is_active: true,
        })
        .returning('*')

      await database('user_preferences').insert({
        user_id: user.id,
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: true,
        },
      })

      const tokens = jwtService.generateTokens(user.id, user.email, user.role)
      await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: await sessionService.hashRefreshToken(
          tokens.refreshToken,
        ),
        deviceInfo: req.get('user-agent') || 'unknown',
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
        expiresAt: sessionService.getRefreshExpiryDate(),
      })

      metricsService.userRegistrationsTotal.inc({ method: 'email_password' })
      logger.info('User registered', { userId: user.id, email })

      res.status(201).json({
        success: true,
        data: {
          user: formatUser(user),
          tokens,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      })
    } catch (error) {
      logger.error('User registration failed', error as Error)
      metricsService.appErrorsTotal.inc({
        error_type: 'registration_error',
        service: 'backend',
        severity: 'error',
      })
      res.status(500).json({
        success: false,
        error: 'Registration failed',
      })
    }
  },
)

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) {
      return
    }

    try {
      const { email, password } = req.body

      const user = await database('users')
        .whereRaw('LOWER(email) = ?', email.toLowerCase())
        .first()

      if (!user || !user.password_hash) {
        metricsService.userLoginsTotal.inc({ method: 'password', status: 'failure' })
        metricsService.authFailuresTotal.inc({
          auth_type: 'password',
          reason: 'user_not_found',
        })
        return res
          .status(401)
          .json({ success: false, error: 'Invalid credentials' })
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash)
      if (!isValidPassword) {
        metricsService.userLoginsTotal.inc({ method: 'password', status: 'failure' })
        metricsService.authFailuresTotal.inc({
          auth_type: 'password',
          reason: 'invalid_password',
        })
        return res
          .status(401)
          .json({ success: false, error: 'Invalid credentials' })
      }

      if (!user.is_active) {
        metricsService.authFailuresTotal.inc({
          auth_type: 'password',
          reason: 'account_disabled',
        })
        return res
          .status(403)
          .json({ success: false, error: 'Account is disabled' })
      }

      const tokens = jwtService.generateTokens(user.id, user.email, user.role)

      await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: await sessionService.hashRefreshToken(
          tokens.refreshToken,
        ),
        deviceInfo: req.get('user-agent') || 'unknown',
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
        expiresAt: sessionService.getRefreshExpiryDate(),
      })

      metricsService.userLoginsTotal.inc({ method: 'password', status: 'success' })
      logger.info('User login successful', { userId: user.id })

      res.json({
        success: true,
        data: {
          user: formatUser(user),
          tokens,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      })
    } catch (error) {
      logger.error('Login failed', error as Error)
      metricsService.appErrorsTotal.inc({
        error_type: 'login_error',
        service: 'backend',
        severity: 'error',
      })
      res.status(500).json({
        success: false,
        error: 'Login failed',
      })
    }
  },
)

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) {return}

    const { refreshToken } = req.body

    try {
      const decoded = jwtService.verifyRefreshToken(refreshToken)
      const session = await sessionService.getValidSession(refreshToken)

      if (!session) {
        return res
          .status(401)
          .json({ success: false, error: 'Invalid or expired session' })
      }

      if (session.user_id !== decoded.userId) {
        await sessionService.revokeSession(session.id, 'refresh_token_mismatch')
        return res
          .status(401)
          .json({ success: false, error: 'Session does not match user' })
      }

      const user = await database('users')
        .where('id', session.user_id)
        .where('is_active', true)
        .first()

      if (!user) {
        await sessionService.revokeSession(session.id, 'user_not_found')
        return res.status(401).json({ success: false, error: 'User not found' })
      }

      const tokens = jwtService.generateTokens(user.id, user.email, user.role)

      await sessionService.rotateRefreshToken(session.id, {
        refreshTokenHash: await sessionService.hashRefreshToken(
          tokens.refreshToken,
        ),
        expiresAt: sessionService.getRefreshExpiryDate(),
      })

      res.json({
        success: true,
        data: {
          user: formatUser(user),
          tokens,
        },
      })
    } catch (error) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' })
    }
  },
)

router.post(
  '/logout',
  [
    body('refreshToken')
      .optional()
      .isString()
      .withMessage('Refresh token must be a string when provided'),
  ],
  authenticate,
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) {
      return
    }

    const authReq = req as AuthRequest
    const { refreshToken } = req.body as { refreshToken?: string }

    if (refreshToken) {
      const session = await sessionService.getValidSession(refreshToken)
      if (session) {
        await sessionService.revokeSession(session.id, 'user_logout')
      }
    } else if (authReq.user) {
      await sessionService.revokeAllSessionsForUser(
        authReq.user.userId,
        'user_logout_all',
      )
    }

    res.json({ success: true, message: 'Logged out successfully' })
  },
)

export default router
