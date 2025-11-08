/**
 * AIO Creative Hub - Backend API Server
 * Main entry point for the Express application
 */
/* eslint-disable import/order */

import { createServer } from 'http'

import compression from 'compression'
import dotenv from 'dotenv'
import express, { Express, Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

// Load environment variables
dotenv.config()

// Import configurations
import config from './utils/config'
import database from './utils/database'

// Import middleware
import { authenticate } from './middleware/auth.middleware'
import corsMiddleware from './middleware/cors.middleware'
import metricsMiddleware from './middleware/metrics.middleware'
import rateLimitMiddleware from './middleware/rateLimit.middleware'
import tracingMiddleware from './middleware/tracing.middleware'

// Import routes
import authRoutes from './routes/auth.routes'
import conversationRoutes from './routes/conversation.routes'
import oauthRoutes from './routes/oauth.routes'

// Import services
import contextService, { ConversationMessage } from './services/context.service'
import logger from './services/logger.service'
import metricsService, {
  recordWebSocketEvent,
  updateActiveConnections,
} from './services/metrics.service'
import redisService from './services/redis.service'
import sessionService from './services/session.service'
import storageService from './services/storage.service'
import tracingService from './services/tracing.service'

type AttachmentPayload = {
  id: string
  name: string
  type: string
  size?: number
}

interface ClientToServerEvents {
  join_session: (payload: { sessionId: string; userId?: string }) => void
  leave_session: () => void
  'chat:message': (payload: {
    sessionId?: string
    message: string
    userId?: string
    attachments?: AttachmentPayload[]
  }) => void
  'chat:typing': (payload: {
    sessionId?: string
    userId?: string
    isTyping: boolean
  }) => void
  'tool:update': (payload: {
    sessionId?: string
    toolId: string
    context: unknown
    userId?: string
  }) => void
  'presence:ping': () => void
}

interface ChatBroadcastPayload {
  id: string
  sessionId: string
  message: string
  sender: 'user' | 'assistant'
  timestamp: string
  userId?: string
  attachments?: AttachmentPayload[]
}

interface ServerToClientEvents {
  'chat:message': (payload: ChatBroadcastPayload) => void
  'chat:typing': (payload: {
    sessionId: string
    userId?: string
    isTyping: boolean
  }) => void
  'presence:update': (payload: {
    sessionId: string
    participants: number
  }) => void
  'tool:update': (payload: {
    sessionId: string
    toolId: string
    context: unknown
    userId?: string
  }) => void
  'session:history': (payload: {
    sessionId: string
    history: ConversationMessage[]
  }) => void
}

interface SocketData {
  userId?: string
  sessionId?: string
}

type AioSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents,
  Record<string, never>,
  SocketData
>

// Create Express app
const app: Express = express()
const httpServer = createServer(app)

// Initialize Socket.io
const io = new SocketIOServer<
  ServerToClientEvents,
  ClientToServerEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: {
    origin: config.CORS_ORIGIN,
    credentials: true,
  },
})

const sessionParticipants = new Map<string, Set<string>>()

const getRoomName = (sessionId: string) => `conversation:${sessionId}`

const sanitizeText = (value: string) =>
  value
    .replace(/<script.*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const broadcastPresence = (sessionId: string) => {
  const count = sessionParticipants.get(sessionId)?.size ?? 0
  io.to(getRoomName(sessionId)).emit('presence:update', {
    sessionId,
    participants: count,
  })
}

const leaveSessionRoom = (socket: AioSocket) => {
  const currentSession = socket.data.sessionId
  if (!currentSession) {
    return
  }

  socket.leave(getRoomName(currentSession))
  const members = sessionParticipants.get(currentSession)
  if (members) {
    members.delete(socket.id)
    if (members.size === 0) {
      sessionParticipants.delete(currentSession)
    }
  }
  socket.data.sessionId = undefined
  broadcastPresence(currentSession)
}

const joinSessionRoom = async (
  socket: AioSocket,
  sessionId: string,
  userId?: string,
) => {
  leaveSessionRoom(socket)
  socket.join(getRoomName(sessionId))
  socket.data.sessionId = sessionId
  if (userId) {
    socket.data.userId = userId
  }

  const members = sessionParticipants.get(sessionId) ?? new Set<string>()
  members.add(socket.id)
  sessionParticipants.set(sessionId, members)
  broadcastPresence(sessionId)

  const context = await contextService.getContext(sessionId)
  socket.emit('session:history', {
    sessionId,
    history: context?.history || [],
  })
}

const resolveSessionId = (socket: AioSocket, explicit?: string | null) => {
  return explicit || socket.data.sessionId || null
}

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1)

// ===== MIDDLEWARE =====

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)

// CORS
app.use(corsMiddleware)

// Compression
app.use(compression())

// Logging
if (config.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }),
  )
}

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
app.use(rateLimitMiddleware)

// Request tracking
app.use(tracingMiddleware)

// Metrics collection
app.use(metricsMiddleware)

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  })
})

// Metrics endpoint (admin only)
app.get('/metrics', authenticate, (req: Request, res: Response) => {
  res.json(metricsService.getMetrics())
})

// ===== API ROUTES =====

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes)

// OAuth routes (no auth required)
app.use('/api/auth', oauthRoutes)

// Conversation routes (auth required)
app.use('/api/conversations', authenticate, conversationRoutes)

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  })
})

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err)

  // Don't leak error details in production
  const isDevelopment = config.NODE_ENV === 'development'

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { detail: err.message, stack: err.stack }),
  })
})

// ===== SOCKET.IO =====

// Authentication for Socket.io
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication error'))
    }

    // Verify JWT token
    // (implementation would use jwtService here)

    next()
  } catch (err) {
    next(new Error('Authentication error'))
  }
})

io.on('connection', (socket: AioSocket) => {
  logger.info(`Client connected: ${socket.id}`)
  recordWebSocketEvent('connect', 'success')
  updateActiveConnections(io.of('/').sockets.size)

  socket.on('join_session', async ({ sessionId, userId }) => {
    try {
      await joinSessionRoom(socket, sessionId, userId)
      recordWebSocketEvent('message', 'success', 'in', 'join_session')
    } catch (error) {
      logger.error(`Failed to join session ${sessionId}`, error)
    }
  })

  socket.on('leave_session', () => {
    leaveSessionRoom(socket)
    recordWebSocketEvent('message', 'success', 'in', 'leave_session')
  })

  socket.on('chat:message', async (payload) => {
    const sessionId = resolveSessionId(socket, payload.sessionId)
    if (!sessionId) {
      return
    }

    const sanitized = sanitizeText(payload.message)
    const timestamp = new Date().toISOString()
    const userId = payload.userId || socket.data.userId

    const entry: ConversationMessage = {
      role: 'user',
      content: sanitized,
      timestamp,
      metadata: { transport: 'websocket', userId },
    }

    try {
      await contextService.appendMessage(sessionId, entry)
    } catch (error) {
      logger.error('Failed to persist conversation context', error)
    }

    const broadcast: ChatBroadcastPayload = {
      id: uuidv4(),
      sessionId,
      message: sanitized,
      sender: 'user',
      timestamp,
      userId,
      attachments: payload.attachments,
    }

    io.to(getRoomName(sessionId)).emit('chat:message', broadcast)
    recordWebSocketEvent('message', 'success', 'in', 'chat:message')
    recordWebSocketEvent('message', 'success', 'out', 'chat:message')
  })

  socket.on('chat:typing', (payload) => {
    const sessionId = resolveSessionId(socket, payload.sessionId)
    if (!sessionId) {
      return
    }

    socket.to(getRoomName(sessionId)).emit('chat:typing', {
      sessionId,
      userId: payload.userId || socket.data.userId,
      isTyping: payload.isTyping,
    })
    recordWebSocketEvent('message', 'success', 'in', 'chat:typing')
  })

  socket.on('tool:update', (payload) => {
    const sessionId = resolveSessionId(socket, payload.sessionId)
    if (!sessionId) {
      return
    }

    socket.to(getRoomName(sessionId)).emit('tool:update', {
      sessionId,
      toolId: payload.toolId,
      context: payload.context,
      userId: payload.userId || socket.data.userId,
    })
    recordWebSocketEvent('message', 'success', 'in', 'tool:update')
    recordWebSocketEvent('message', 'success', 'out', 'tool:update')
  })

  socket.on('presence:ping', () => {
    const sessionId = socket.data.sessionId
    if (sessionId) {
      broadcastPresence(sessionId)
    }
  })

  socket.on('disconnect', () => {
    leaveSessionRoom(socket)
    recordWebSocketEvent('disconnect', 'success')
    updateActiveConnections(io.of('/').sockets.size)
    logger.info(`Client disconnected: ${socket.id}`)
  })
})

// ===== SERVER INITIALIZATION =====

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await database.raw('SELECT 1')
    logger.info(' Database connected successfully')

    // Connect to Redis
    await redisService.connect()
    logger.info(' Redis connected successfully')

    // Initialize services
    await sessionService.initialize()
    await storageService.initialize()
    await tracingService.initialize()
    await metricsService.initialize()

    // Start HTTP server
    const port = config.PORT || 3000
    httpServer.listen(port, () => {
      logger.info(`= AIO Backend API server running on port ${port}`)
      logger.info(`= Environment: ${config.NODE_ENV}`)
      logger.info(`= Health check: http://localhost:${port}/health`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')

  httpServer.close(async () => {
    await sessionService.shutdown()
    await redisService.disconnect()
    await database.destroy()
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')

  httpServer.close(async () => {
    await sessionService.shutdown()
    await redisService.disconnect()
    await database.destroy()
    process.exit(0)
  })
})

// Start server if this file is run directly
if (require.main === module) {
  startServer()
}

export default app
