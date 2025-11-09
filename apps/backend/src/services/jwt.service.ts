import jwt, { SignOptions, VerifyOptions, Secret } from 'jsonwebtoken';
import config from '../utils/config';
import { AuthTokens } from '@aio/shared';

export class JWTService {
  private privateKey: Secret;
  private publicKey: Secret;

  constructor() {
    this.privateKey = config.JWT_PRIVATE_KEY;
    this.publicKey = config.JWT_PUBLIC_KEY;

    if (!this.privateKey || !this.publicKey) {
      console.warn('⚠️  JWT keys not configured. Generate keys using:');
      console.warn('   openssl genrsa -out private.pem 2048');
      console.warn('   openssl rsa -in private.pem -pubout -out public.pem');
    }
  }

  private buildSignOptions(expiresIn: string): SignOptions {
    return {
      algorithm: 'RS256',
      expiresIn: expiresIn as SignOptions['expiresIn'],
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    };
  }

  generateAccessToken(payload: any): string {
    return jwt.sign(payload, this.privateKey, this.buildSignOptions(config.JWT_EXPIRATION));
  }

  generateRefreshToken(payload: any): string {
    return jwt.sign(payload, this.privateKey, this.buildSignOptions(config.REFRESH_TOKEN_EXPIRATION));
  }

  generateTokens(userId: string, email: string, role?: string): AuthTokens {
    const payload = {
      userId,
      email,
      ...(role ? { role } : {}),
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: this.parseExpiration(config.JWT_EXPIRATION),
    };
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      } as VerifyOptions);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      } as VerifyOptions);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  private parseExpiration(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600;
    }
  }
}

export default new JWTService();
