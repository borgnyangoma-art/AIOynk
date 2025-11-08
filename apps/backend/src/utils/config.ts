import dotenv from 'dotenv';

dotenv.config();

export default {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/aio',
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '2', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '10', 10),

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_SESSION_TTL: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10),

  JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY || '',
  JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY || '',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '1h',
  REFRESH_TOKEN_EXPIRATION: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  JWT_ISSUER: process.env.JWT_ISSUER || 'aio-creative-hub',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'aio-users',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
  GOOGLE_SCOPE: process.env.GOOGLE_SCOPE || 'https://www.googleapis.com/auth/userinfo.email',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  UPLOAD_DIR: process.env.UPLOAD_DIR || './storage/uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10),

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
