import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth.routes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Rate Limiting Security Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should allow requests within rate limit', async () => {
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong',
          })
      );

      const responses = await Promise.all(promises);

      // All should be processed (not rate limited)
      responses.forEach(response => {
        expect(response.status).not.toBe(429);
      });
    });

    it('should reject requests exceeding rate limit', async () => {
      // Send requests exceeding the limit (100 per minute = ~1.67 per second)
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong',
          })
      );

      const responses = await Promise.all(promises);

      // At least some should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('should return rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong',
        });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should include Retry-After header when rate limited', async () => {
      // Exceed rate limit
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong',
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('POST /api/auth/register', () => {
    it('should rate limit registration attempts', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: `user${i}@example.com`,
            password: 'TestPassword123!',
            name: 'User',
          })
      );

      const responses = await Promise.all(promises);

      // At least some should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('POST /api/chat/message', () => {
    it('should rate limit chat messages', async () => {
      // Assuming we have a valid token
      const token = 'Bearer valid-token';

      const promises = Array(30).fill(null).map(() =>
        request(app)
          .post('/api/chat/message')
          .set('Authorization', token)
          .send({
            message: 'Test message',
            sessionId: 'test',
          })
      );

      const responses = await Promise.all(promises);

      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Rate limit by IP', () => {
    it('should apply rate limit per IP address', async () => {
      const promises = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong',
          })
          .set('X-Forwarded-For', '192.168.1.1')
      );

      const responses = await Promise.all(promises);

      // All from same IP should count toward limit
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Rate limit bypass attempts', () => {
    it('should not allow bypass via different authorization header formats', async () => {
      const formats = [
        'Bearer token',
        'bearer token',
        'BEARER token',
        'Token token',
        'token',
      ];

      for (const format of formats) {
        const response = await request(app)
          .post('/api/auth/login')
          .set('Authorization', format)
          .send({
            email: 'test@example.com',
            password: 'wrong',
          });

        expect(response.status).not.toBeLessThan(400);
      }
    });

    it('should handle missing rate limit headers gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong',
        });

      // Should still work without custom headers
      expect(response.status).toBe(401);
    });
  });
});
