import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../src/middleware/auth.middleware';

describe('AuthMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should pass with valid token', () => {
    const token = jwt.sign(
      { userId: '123', email: 'test@example.com' },
      process.env.JWT_PRIVATE_KEY as string,
      { algorithm: 'RS256', expiresIn: '1h' }
    );

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.userId).toBe('123');
  });

  it('should return 401 for missing authorization header', () => {
    authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unauthorized',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for malformed authorization header', () => {
    mockRequest.headers = {
      authorization: 'InvalidFormat',
    };

    authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token', () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token',
    };

    authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for expired token', () => {
    const token = jwt.sign(
      { userId: '123' },
      process.env.JWT_PRIVATE_KEY as string,
      { algorithm: 'RS256', expiresIn: '-1h' }
    );

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should extract user from valid token', () => {
    const payload = { userId: '123', email: 'test@example.com', role: 'admin' };
    const token = jwt.sign(
      payload,
      process.env.JWT_PRIVATE_KEY as string,
      { algorithm: 'RS256', expiresIn: '1h' }
    );

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRequest.user).toEqual(
      expect.objectContaining({
        userId: '123',
        email: 'test@example.com',
        role: 'admin',
      })
    );
  });
});
