import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth.routes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('SQL Injection Security Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should prevent SQL injection in email field', async () => {
      const maliciousPayload = {
        email: "admin'--",
        password: 'TestPassword123!',
        name: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousPayload)
        .expect(400);

      // Should reject the malicious input
      expect(response.body.error).toBeDefined();
    });

    it('should prevent SQL injection in password field', async () => {
      const maliciousPayload = {
        email: 'test@example.com',
        password: "password' OR '1'='1",
        name: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should sanitize special characters in input', async () => {
      const payload = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: "User'; DROP TABLE users;--",
      };

      // Should either sanitize or reject
      const response = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(response.status).toBe(201);
      // Name should be sanitized
      expect(response.body.user.name).not.toContain('DROP TABLE');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should prevent SQL injection in login query', async () => {
      const maliciousPayload = {
        email: "admin'--",
        password: "anything",
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousPayload)
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should prevent injection in password field', async () => {
      const maliciousPayload = {
        email: 'test@example.com',
        password: "' OR '1'='1' --",
      };

      await request(app)
        .post('/api/auth/login')
        .send(maliciousPayload)
        .expect(401);
    });
  });

  describe('GET /api/chat/messages', () => {
    it('should prevent injection in query parameters', async () => {
      const maliciousQuery = "?user_id=1' OR '1'='1";

      // Assuming this endpoint requires auth
      const token = 'Bearer valid-token';

      const response = await request(app)
        .get(`/api/chat/messages${maliciousQuery}`)
        .set('Authorization', token)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/chat/message', () => {
    it('should prevent injection in message content', async () => {
      const maliciousMessage = {
        message: "'; DROP TABLE messages;--",
        sessionId: 'test',
      };

      const token = 'Bearer valid-token';

      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', token)
        .send(maliciousMessage)
        .expect(400);

      // Should sanitize or reject
      expect(response.body.error).toBeDefined();
    });
  });
});
