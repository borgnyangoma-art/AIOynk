import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth.routes';
import jwtService from '../../src/services/jwt.service';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'TestPassword123!',
        name: 'New User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.accessToken).toBeDefined();
    });

    it('should not register user with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'TestPassword123!',
        name: 'User',
      };

      await request(app).post('/api/auth/register').send(userData);
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });

    it('should not register user with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        name: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('Password');
    });

    it('should not register user with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        name: 'User',
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user first
      await request(app).post('/api/auth/register').send({
        email: 'loginuser@example.com',
        password: 'TestPassword123!',
        name: 'Login User',
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'loginuser@example.com',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'loginuser@example.com',
          password: 'WrongPassword!',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should not login with missing fields', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'refresh@example.com',
        password: 'TestPassword123!',
        name: 'Refresh User',
      });
      refreshToken = response.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should not refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('GET /api/auth/profile', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'profile@example.com',
        password: 'TestPassword123!',
        name: 'Profile User',
      });
      accessToken = response.body.accessToken;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email', 'profile@example.com');
      expect(response.body).toHaveProperty('name', 'Profile User');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should not get profile without token', async () => {
      await request(app).get('/api/auth/profile').expect(401);
    });

    it('should not get profile with invalid token', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'logout@example.com',
        password: 'TestPassword123!',
        name: 'Logout User',
      });
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.message).toContain('logged out');
    });

    it('should invalidate refresh token', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      // Try to refresh with the same token
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
