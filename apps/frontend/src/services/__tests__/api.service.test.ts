import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiService from '../api.service';

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make GET request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const response = await apiService.get('/test');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(response).toEqual({ data: 'test' });
  });

  it('should make POST request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const response = await apiService.post('/test', { data: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
      })
    );
    expect(response).toEqual({ success: true });
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    await expect(apiService.get('/not-found')).rejects.toThrow('Not found');
  });

  it('should include authorization header when token is set', async () => {
    apiService.setAuthToken('test-token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiService.get('/protected');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/protected'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('should handle timeouts', async () => {
    vi.useFakeTimers();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    global.fetch = vi.fn().mockReturnValue(timeoutPromise as any);

    const request = apiService.get('/slow-endpoint');

    vi.advanceTimersByTime(5000);

    await expect(request).rejects.toThrow('Timeout');

    vi.useRealTimers();
  });
});
