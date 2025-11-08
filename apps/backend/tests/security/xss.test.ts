import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth.routes';
import conversationRoutes from '../../src/routes/conversation.routes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/chat', conversationRoutes);

describe('XSS (Cross-Site Scripting) Security Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should sanitize script tags in name field', async () => {
      const payload = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: '<script>alert("XSS")</script>',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(payload);

      if (response.status === 201) {
        // If registration succeeds, name should be sanitized
        expect(response.body.user.name).not.toContain('<script>');
        expect(response.body.user.name).not.toContain('alert');
      }
    });

    it('should prevent XSS in email field', async () => {
      const payload = {
        email: '<script>alert("XSS")</script>@example.com',
        password: 'TestPassword123!',
        name: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/chat/message', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login to get token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'xss@example.com',
          password: 'TestPassword123!',
          name: 'User',
        });

      authToken = registerResponse.body.accessToken;
    });

    it('should sanitize script tags in chat messages', async () => {
      const maliciousMessage = {
        message: '<script>alert("XSS")</script>',
        sessionId: 'test-session',
      };

      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousMessage);

      // Response should not contain the raw script tag
      if (response.body.response) {
        expect(response.body.response).not.toContain('<script>');
        expect(response.body.response).not.toContain('alert');
      }
    });

    it('should prevent inline event handlers', async () => {
      const maliciousMessage = {
        message: '<img src="x" onerror="alert(1)">',
        sessionId: 'test-session',
      };

      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousMessage);

      expect(response.body.response).not.toContain('onerror');
    });

    it('should escape HTML entities', async () => {
      const message = {
        message: '<div>&lt;script&gt;</div>',
        sessionId: 'test-session',
      };

      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send(message);

      // Should escape HTML entities
      expect(response.body.response).toContain('&lt;script&gt;');
    });

    it('should filter javascript: URLs', async () => {
      const message = {
        message: '<a href="javascript:alert(1)">Click me</a>',
        sessionId: 'test-session',
      };

      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send(message);

      expect(response.body.response).not.toContain('javascript:');
    });
  });

  describe('Content Security Policy', () => {
    it('should include CSP header in responses', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should prevent inline scripts', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
    });
  });

  describe('Input validation', () => {
    it('should reject messages that are too long', async () => {
      const longMessage = {
        message: 'a'.repeat(10000),
        sessionId: 'test-session',
      };

      const authToken = 'Bearer valid-token';

      const response = await request(app)
        .post('/api/chat/message')
        .set('Authorization', authToken)
        .send(longMessage)
        .expect(400);

      expect(response.body.error).toContain('too long');
    });

    it('should reject empty or whitespace-only messages', async () => {
      const emptyMessage = {
        message: '   ',
        sessionId: 'test-session',
      };

      const authToken = 'Bearer valid-token';

      await request(app)
        .post('/api/chat/message')
        .set('Authorization', authToken)
        .send(emptyMessage)
        .expect(400);
    });
  });
});
