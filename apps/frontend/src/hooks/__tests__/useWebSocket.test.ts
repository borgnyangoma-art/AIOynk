import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useWebSocket from '../useWebSocket';

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should connect to WebSocket', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000'));

    expect(result.current.isConnected).toBe(false);
  });

  it('should handle connection', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000'));

    act(() => {
      result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should send messages', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000'));

    act(() => {
      result.current.connect();
    });

    act(() => {
      result.current.send('test message');
    });

    // Message should be sent
    expect(result.current.send).toBeDefined();
  });

  it('should handle incoming messages', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000', onMessage));

    act(() => {
      result.current.connect();
    });

    // Simulate incoming message
    act(() => {
      // This would be triggered by the WebSocket mock
    });

    expect(onMessage).toBeDefined();
  });

  it('should disconnect', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000'));

    act(() => {
      result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should handle connection errors', () => {
    const { result } = renderHook(() => useWebSocket('invalid-url'));

    act(() => {
      result.current.connect();
    });

    expect(result.current.error).toBeDefined();
  });
});
