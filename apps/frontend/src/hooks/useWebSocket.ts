import { useCallback, useMemo, useRef, useState } from 'react'

type MessageHandler = (message: string) => void

type WebSocketState = {
  isConnected: boolean
  error: Error | null
  connect: () => void
  disconnect: () => void
  send: (message: string) => void
}

const useWebSocket = (url: string, onMessage?: MessageHandler): WebSocketState => {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    try {
      if (socketRef.current) {
        socketRef.current.close()
      }

      socketRef.current = new WebSocket(url)
      socketRef.current.onopen = () => setIsConnected(true)
      socketRef.current.onclose = () => setIsConnected(false)
      socketRef.current.onerror = () => setError(new Error('Connection failed'))
      socketRef.current.onmessage = (event) => {
        onMessage?.(event.data)
      }
    } catch (err) {
      setError(err as Error)
    }
  }, [url, onMessage])

  const disconnect = useCallback(() => {
    socketRef.current?.close()
    setIsConnected(false)
  }, [])

  const send = useCallback((message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message)
    }
  }, [])

  return useMemo(
    () => ({
      isConnected,
      error,
      connect,
      disconnect,
      send,
    }),
    [isConnected, error, connect, disconnect, send],
  )
}

export default useWebSocket
