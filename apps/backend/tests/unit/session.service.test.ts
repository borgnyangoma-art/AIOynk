import { SessionService } from '../../src/services/session.service';

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeAll(() => {
    sessionService = new SessionService();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should store session data in Redis', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      // Check if session exists
      const session = await sessionService.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe(userId);
    });

    it('should set expiration on session', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      const session = await sessionService.getSession(sessionId);
      expect(session?.expiresAt).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      const session = await sessionService.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(userId);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionService.getSession('non-existent-id');
      expect(session).toBeNull();
    });

    it('should return null for expired session', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      // Manually expire the session
      await sessionService['client'].expire(sessionId, 0);

      const session = await sessionService.getSession(sessionId);
      expect(session).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session data', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      const updates = { lastActivity: new Date(), preferences: { theme: 'dark' } };
      await sessionService.updateSession(sessionId, updates);

      const session = await sessionService.getSession(sessionId);
      expect(session?.preferences).toEqual({ theme: 'dark' });
    });

    it('should update last activity timestamp', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      const newActivity = new Date();
      await sessionService.updateSession(sessionId, { lastActivity: newActivity });

      const session = await sessionService.getSession(sessionId);
      expect(session?.lastActivity).toEqual(newActivity);
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      await sessionService.deleteSession(sessionId);

      const session = await sessionService.getSession(sessionId);
      expect(session).toBeNull();
    });

    it('should handle deleting non-existent session', async () => {
      // Should not throw error
      await expect(sessionService.deleteSession('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('extendSession', () => {
    it('should extend session expiration', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      const firstSession = await sessionService.getSession(sessionId);
      const firstExpiry = firstSession?.expiresAt;

      await sessionService.extendSession(sessionId);

      const extendedSession = await sessionService.getSession(sessionId);
      const extendedExpiry = extendedSession?.expiresAt;

      expect(extendedExpiry).toBeDefined();
      expect(extendedExpiry).not.toBe(firstExpiry);
    });
  });

  describe('getUserSessions', () => {
    it('should return all sessions for a user', async () => {
      const userId = 'user-123';
      const sessionId1 = await sessionService.createSession(userId);
      const sessionId2 = await sessionService.createSession(userId);

      const sessions = await sessionService.getUserSessions(userId);

      expect(sessions).toHaveLength(2);
      expect(sessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionId: sessionId1 }),
          expect.objectContaining({ sessionId: sessionId2 }),
        ])
      );
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await sessionService.getUserSessions('non-existent-user');
      expect(sessions).toHaveLength(0);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', async () => {
      const userId = 'user-123';
      const sessionId = await sessionService.createSession(userId);

      // Manually set expiration to past
      await sessionService['client'].expire(sessionId, -1);

      await sessionService.cleanupExpiredSessions();

      const session = await sessionService.getSession(sessionId);
      expect(session).toBeNull();
    });
  });
});
