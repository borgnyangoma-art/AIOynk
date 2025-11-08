import jwt from 'jsonwebtoken';
import { JWTService } from '../../src/services/jwt.service';

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeAll(() => {
    jwtService = new JWTService();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = jwtService.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token) as any;
      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should use RS256 algorithm', () => {
      const payload = { userId: '123' };
      const token = jwtService.generateAccessToken(payload);

      const decodedHeader = jwt.decode(token, { complete: true }) as any;
      expect(decodedHeader.header.alg).toBe('RS256');
    });

    it('should include expiration in token', () => {
      const payload = { userId: '123' };
      const token = jwtService.generateAccessToken(payload);

      const decoded = jwt.decode(token) as any;
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = jwtService.generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token) as any;
      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should have different expiration from access token', () => {
      const payload = { userId: '123' };
      const accessToken = jwtService.generateAccessToken(payload);
      const refreshToken = jwtService.generateRefreshToken(payload);

      const accessDecoded = jwt.decode(accessToken) as any;
      const refreshDecoded = jwt.decode(refreshToken) as any;

      expect(accessDecoded.exp).not.toBe(refreshDecoded.exp);
    });
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = jwtService.generateTokens('123', 'test@example.com');

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(typeof tokens.expiresIn).toBe('number');
    });

    it('should include user ID and email in tokens', () => {
      const tokens = jwtService.generateTokens('123', 'test@example.com');

      const accessDecoded = jwt.decode(tokens.accessToken) as any;
      const refreshDecoded = jwt.decode(tokens.refreshToken) as any;

      expect(accessDecoded.userId).toBe('123');
      expect(accessDecoded.email).toBe('test@example.com');
      expect(refreshDecoded.userId).toBe('123');
      expect(refreshDecoded.email).toBe('test@example.com');
    });

    it('should set correct expiresIn value for 1 hour', () => {
      const tokens = jwtService.generateTokens('123', 'test@example.com');

      expect(tokens.expiresIn).toBe(3600);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = jwtService.generateAccessToken(payload);

      const decoded = jwtService.verifyAccessToken(token);

      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should throw error for expired token', () => {
      // Create token with past expiration
      const expiredToken = jwt.sign(
        { userId: '123' },
        process.env.JWT_PRIVATE_KEY as string,
        { algorithm: 'RS256', expiresIn: '-1h' }
      );

      expect(() => {
        jwtService.verifyAccessToken(expiredToken);
      }).toThrow('Invalid or expired token');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid or expired token');
    });

    it('should verify issuer and audience', () => {
      const payload = { userId: '123' };
      const token = jwtService.generateAccessToken(payload);

      const decoded = jwtService.verifyAccessToken(token);

      expect(decoded.iss).toBe('aio-creative-hub');
      expect(decoded.aud).toBe('aio-users');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = jwtService.generateRefreshToken(payload);

      const decoded = jwtService.verifyRefreshToken(token);

      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should throw error for expired refresh token', () => {
      const expiredToken = jwt.sign(
        { userId: '123' },
        process.env.JWT_PRIVATE_KEY as string,
        { algorithm: 'RS256', expiresIn: '-1d' }
      );

      expect(() => {
        jwtService.verifyRefreshToken(expiredToken);
      }).toThrow('Invalid or expired refresh token');
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = jwtService.generateAccessToken(payload);

      const decoded = jwtService.decodeToken(token);

      expect(decoded?.userId).toBe('123');
      expect(decoded?.email).toBe('test@example.com');
    });

    it('should return null for invalid token', () => {
      const decoded = jwtService.decodeToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('parseExpiration', () => {
    it('should parse seconds correctly', () => {
      // @ts-ignore - accessing private method
      const result = jwtService.parseExpiration('60s');
      expect(result).toBe(60);
    });

    it('should parse minutes correctly', () => {
      // @ts-ignore - accessing private method
      const result = jwtService.parseExpiration('30m');
      expect(result).toBe(1800);
    });

    it('should parse hours correctly', () => {
      // @ts-ignore - accessing private method
      const result = jwtService.parseExpiration('2h');
      expect(result).toBe(7200);
    });

    it('should parse days correctly', () => {
      // @ts-ignore - accessing private method
      const result = jwtService.parseExpiration('7d');
      expect(result).toBe(604800);
    });

    it('should default to 1 hour for unknown unit', () => {
      // @ts-ignore - accessing private method
      const result = jwtService.parseExpiration('1x');
      expect(result).toBe(3600);
    });
  });
});
