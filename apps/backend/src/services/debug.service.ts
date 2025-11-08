import logger from './logger.service';

interface DebugSession {
  id: string;
  userId?: string;
  correlationId: string;
  startTime: number;
  operations: Array<{
    operation: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: 'success' | 'error' | 'pending';
    data?: any;
    error?: Error;
  }>;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

class DebugService {
  private sessions: Map<string, DebugSession> = new Map();

  /**
   * Create a new debug session
   */
  createSession(correlationId: string, userId?: string): string {
    const sessionId = this.generateSessionId();
    const session: DebugSession = {
      id: sessionId,
      userId,
      correlationId,
      startTime: Date.now(),
      operations: [],
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
      },
    };

    this.sessions.set(sessionId, session);
    logger.info('Debug session created', { sessionId, correlationId, userId });

    return sessionId;
  }

  /**
   * Start an operation in a debug session
   */
  startOperation(sessionId: string, operation: string, data?: any) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Debug session not found', { sessionId, operation });
      return;
    }

    const opIndex = session.operations.findIndex(
      (op) => op.operation === operation && op.status === 'pending'
    );

    if (opIndex >= 0) {
      logger.warn('Operation already in progress', { sessionId, operation });
      return;
    }

    session.operations.push({
      operation,
      startTime: Date.now(),
      status: 'pending',
      data,
    });

    logger.debug('Operation started', {
      sessionId,
      operation,
      data,
    });
  }

  /**
   * End an operation in a debug session
   */
  endOperation(
    sessionId: string,
    operation: string,
    status: 'success' | 'error' = 'success',
    error?: Error
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Debug session not found', { sessionId, operation });
      return;
    }

    const op = session.operations.find(
      (o) => o.operation === operation && o.status === 'pending'
    );

    if (!op) {
      logger.warn('Operation not found or already completed', { sessionId, operation });
      return;
    }

    op.endTime = Date.now();
    op.duration = op.endTime - op.startTime;
    op.status = status;
    op.error = error;

    logger.info('Operation completed', {
      sessionId,
      operation,
      duration: op.duration,
      status,
      error: error?.message,
    });

    return op.duration;
  }

  /**
   * Get session details
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a correlation ID
   */
  getSessionsByCorrelationId(correlationId: string): DebugSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.correlationId === correlationId
    );
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const totalDuration = Date.now() - session.startTime;
    const completedOps = session.operations.filter((op) => op.status !== 'pending');
    const errors = session.operations.filter((op) => op.status === 'error');

    return {
      sessionId: session.id,
      userId: session.userId,
      correlationId: session.correlationId,
      startTime: session.startTime,
      totalDuration,
      operations: session.operations.length,
      completedOperations: completedOps.length,
      errors: errors.length,
      errorRate: errors.length / session.operations.length,
      slowestOperation: session.operations.reduce((max, op) =>
        !max || (op.duration || 0) > (max.duration || 0) ? op : max
      ),
    };
  }

  /**
   * Clean up old sessions
   */
  cleanup(olderThanMinutes: number = 60) {
    const cutoff = Date.now() - olderThanMinutes * 60 * 1000;
    let removed = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.startTime < cutoff) {
        this.sessions.delete(sessionId);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info('Debug sessions cleaned up', { removed, olderThanMinutes });
    }

    return removed;
  }

  /**
   * Export session data for analysis
   */
  exportSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const exportData = {
      ...session,
      exportedAt: new Date().toISOString(),
    };

    return exportData;
  }

  /**
   * Monitor resource usage
   */
  updateMemoryUsage(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const memUsage = process.memoryUsage();
    session.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    };
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `debug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default new DebugService();
