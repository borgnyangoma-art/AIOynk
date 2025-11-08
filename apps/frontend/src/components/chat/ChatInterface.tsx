import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuid } from 'uuid'

import { RootState } from '../../store'
import {
  addMessage,
  clearMessages,
  setConnectionState,
} from '../../store/slices/chatSlice'
import useWebSocket from '../../hooks/useWebSocket'

const MAX_CHARACTERS = 1000

const ChatInterface: React.FC = () => {
  const dispatch = useDispatch()
  const messages = useSelector((state: RootState) => state.chat.messages)
  const { isConnected, error, connect, disconnect, send } = useWebSocket(
    'ws://localhost:3000',
    (message) => {
      dispatch(
        addMessage({
          id: uuid(),
          content: message,
          sender: 'assistant',
          timestamp: Date.now(),
        })
      )
    }
  )

  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null
  )
  const [charLimitError, setCharLimitError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  useEffect(() => {
    dispatch(setConnectionState({ isConnecting: !isConnected, isConnected }))
  }, [dispatch, isConnected])

  useEffect(() => {
    return () => {
      dispatch(clearMessages())
    }
  }, [dispatch])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleSend = () => {
    if (!input.trim()) {
      return
    }

    if (input.length > MAX_CHARACTERS) {
      setCharLimitError('Message exceeds maximum length')
      return
    }

    const userMessage = {
      id: uuid(),
      content: input.trim(),
      sender: 'user' as const,
      timestamp: Date.now(),
    }

    dispatch(addMessage(userMessage))
    send(input.trim())
    setInput('')
    setCharLimitError('')
    setIsTyping(true)

    setTimeout(() => {
      dispatch(
        addMessage({
          id: uuid(),
          content: `Echo: ${userMessage.content}`,
          sender: 'assistant',
          timestamp: Date.now(),
        })
      )
      setIsTyping(false)
    }, 500)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAttachmentPreview(file.name)
      dispatch(
        addMessage({
          id: uuid(),
          content: file.name,
          sender: 'user',
          timestamp: Date.now(),
          type: 'attachment',
        })
      )
    }
    reader.readAsDataURL(file)
  }

  const characterCount = useMemo(
    () => `${input.length}/${MAX_CHARACTERS}`,
    [input]
  )

  return (
    <div className="flex h-full flex-col" data-testid="chat-container">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4">
        <div>
          <h1 className="text-lg font-semibold">AIO Creative Hub</h1>
          <p className="text-sm text-gray-500">Multi-tool creative assistant</p>
        </div>
        <div data-testid="connection-status" className="text-sm text-gray-500">
          {isConnected ? 'Connected' : 'Connecting...'}
          {error && <span className="text-red-500"> • {error.message}</span>}
        </div>
      </div>

      <div
        ref={messagesRef}
        data-testid="chat-messages"
        className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4"
      >
        {messages.length === 0 && (
          <div
            data-testid="empty-state"
            className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500"
          >
            Start a conversation to see messages here.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs rounded-lg p-3 text-sm ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-800 shadow'
              }`}
            >
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {isTyping && (
          <div data-testid="typing-indicator" className="text-sm text-gray-500">
            Assistant is typing…
          </div>
        )}

        {attachmentPreview && (
          <div
            data-testid="attachment-preview"
            className="text-xs text-gray-500"
          >
            Attached: {attachmentPreview}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <span data-testid="char-count">{characterCount}</span>
          {charLimitError && (
            <span data-testid="char-limit-error" className="text-red-500">
              {charLimitError}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            data-testid="message-input"
            className="flex-1 rounded border border-gray-300 p-2"
            placeholder="Type your message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <input
            data-testid="file-upload"
            type="file"
            className="hidden"
            id="chat-file-upload"
            onChange={handleFileChange}
          />
          <label
            htmlFor="chat-file-upload"
            className="cursor-pointer rounded bg-gray-100 px-3 py-2 text-sm text-gray-700"
          >
            Attach
          </label>
          <button
            data-testid="send-button"
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
