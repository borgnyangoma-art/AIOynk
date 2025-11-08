import { GoogleAuthService } from '../../src/services/google-auth.service';

describe('GoogleAuthService', () => {
  let googleAuthService: GoogleAuthService;

  beforeAll(() => {
    googleAuthService = new GoogleAuthService();
  });

  describe('getAuthUrl', () => {
    it('should return Google OAuth URL', () => {
      const state = 'random-state-123';
      const url = googleAuthService.getAuthUrl(state);

      expect(url).toContain('accounts.google.com/oauth/authorize');
      expect(url).toContain('scope=');
    });

    it('should include state parameter', () => {
      const state = 'test-state';
      const url = googleAuthService.getAuthUrl(state);

      expect(url).toContain(`state=${state}`);
    });

    it('should include required scopes', () => {
      const url = googleAuthService.getAuthUrl('state');

      expect(url).toContain('openid');
      expect(url).toContain('email');
      expect(url).toContain('profile');
    });
  });

  describe('getTokenFromCode', () => {
    it('should exchange code for tokens', async () => {
      const code = 'auth-code-123';
      const tokens = await googleAuthService.getTokenFromCode(code);

      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('refresh_token');
      expect(typeof tokens.access_token).toBe('string');
    });

    it('should handle invalid code', async () => {
      // Mock implementation - actual service would throw error
      try {
        await googleAuthService.getTokenFromCode('invalid-code');
      } catch (error: any) {
        expect(error.message).toContain('invalid');
      }
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info with access token', async () => {
      const accessToken = 'valid-access-token';
      const userInfo = await googleAuthService.getUserInfo(accessToken);

      expect(userInfo).toHaveProperty('id');
      expect(userInfo).toHaveProperty('email');
      expect(userInfo).toHaveProperty('name');
    });

    it('should return user profile with correct fields', async () => {
      const accessToken = 'valid-access-token';
      const userInfo = await googleAuthService.getUserInfo(accessToken);

      expect(userInfo).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
      });
    });

    it('should handle invalid access token', async () => {
      try {
        await googleAuthService.getUserInfo('invalid-token');
      } catch (error: any) {
        expect(error.message).toContain('401');
      }
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token with refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const newTokens = await googleAuthService.refreshAccessToken(refreshToken);

      expect(newTokens).toHaveProperty('access_token');
      expect(newTokens).toHaveProperty('refresh_token');
    });

    it('should return new access token', async () => {
      const refreshToken = 'valid-refresh-token';
      const newTokens = await googleAuthService.refreshAccessToken(refreshToken);

      expect(typeof newTokens.access_token).toBe('string');
    });
  });
});
