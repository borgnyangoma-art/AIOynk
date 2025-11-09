import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

import useWebSocket from '../useWebSocket'

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  static lastInstance: MockWebSocket | null = null

  public readyState = MockWebSocket.OPEN
  public sentMessages: string[] = []
  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {
    if (url === 'invalid-url') {
      throw new Error('Invalid URL')
    }
    MockWebSocket.lastInstance = this
  }

  simulateOpen() {
    this.onopen?.({} as Event)
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }

  send(message: string) {
    this.sentMessages.push(message)
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    MockWebSocket.lastInstance = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('connects to a WebSocket server', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000'))

    act(() => {
      result.current.connect()
      MockWebSocket.lastInstance?.simulateOpen()
    })

    await waitFor(() => expect(result.current.isConnected).toBe(true))
  })

  it('sends messages when connected', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000'))

    act(() => {
      result.current.connect()
      MockWebSocket.lastInstance?.simulateOpen()
    })

    act(() => {
      result.current.send('ping')
    })

    expect(MockWebSocket.lastInstance?.sentMessages).toContain('ping')
  })

  it('invokes message handler for incoming messages', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000', onMessage))

    act(() => {
      result.current.connect()
      MockWebSocket.lastInstance?.simulateOpen()
      MockWebSocket.lastInstance?.simulateMessage('hello')
    })

    await waitFor(() => expect(onMessage).toHaveBeenCalledWith('hello'))
  })

  it('disconnects gracefully', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000'))

    act(() => {
      result.current.connect()
      MockWebSocket.lastInstance?.simulateOpen()
    })

    await waitFor(() => expect(result.current.isConnected).toBe(true))

    act(() => {
      result.current.disconnect()
    })

    expect(result.current.isConnected).toBe(false)
    expect(MockWebSocket.lastInstance?.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('captures connection errors', () => {
    const { result } = renderHook(() => useWebSocket('invalid-url'))

    act(() => {
      result.current.connect()
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })
})
