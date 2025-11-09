import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwtService from '../services/jwt.service';
import metricsService from '../services/metrics.service';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

export const authenticate: RequestHandler = (req, res, next) => {
  const authRequest = req as AuthRequest;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      metricsService.authFailuresTotal.inc({ auth_type: 'jwt', reason: 'missing_token' });
      metricsService.securityEventsTotal.inc({ event_type: 'auth_missing_token', severity: 'warning' });
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const decoded = jwtService.verifyAccessToken(token);
    authRequest.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    metricsService.authFailuresTotal.inc({ auth_type: 'jwt', reason: 'invalid_token' });
    metricsService.securityEventsTotal.inc({ event_type: 'auth_invalid_token', severity: 'warning' });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
