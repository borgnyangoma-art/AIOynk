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
import { estimateTokens } from '../../utils/tokenCounter'

const MAX_CHARACTERS = 1000
const MAX_HISTORY = 20
const MAX_TOKENS = 750

const QUICK_SUGGESTIONS = [
  {
    id: 'logo',
    title: 'Design a logo',
    prompt: 'Create a modern geometric logo using two colors and subtle gradients.',
  },
  {
    id: 'landing',
    title: 'Landing page layout',
    prompt: 'Draft a responsive landing page hero with headline, CTA, and background illustration.',
  },
  {
    id: 'code-review',
    title: 'Code review',
    prompt: 'Review my React component for accessibility and suggest improvements.',
  },
  {
    id: 'model',
    title: '3D model concept',
    prompt: 'Generate a low-poly 3D chair model concept with rounded edges.',
  },
  {
    id: 'edit-video',
    title: 'Edit video clip',
    prompt: 'Trim the intro, add fade-in text overlay, and apply a warm color filter.',
  },
  {
    id: 'debug',
    title: 'Debug issue',
    prompt: 'Help me debug an intermittent API timeout in the project creation flow.',
  },
] as const

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
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState<number>(-1)
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

    if (tokenEstimate >= MAX_TOKENS) {
      setCharLimitError('Message exceeds token budget')
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
    setHistory((prev) => {
      const nextHistory = [...prev, userMessage.content]
      if (nextHistory.length > MAX_HISTORY) {
        nextHistory.shift()
      }
      return nextHistory
    })
    setHistoryIndex(null)
    setCharLimitError('')
    setIsTyping(true)
    setActiveSuggestionIndex(-1)

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

  const characterCount = useMemo(
    () => `${input.length}/${MAX_CHARACTERS}`,
    [input]
  )
  const tokenEstimate = useMemo(() => estimateTokens(input.length), [input.length])
  const isTokenLimited = tokenEstimate >= MAX_TOKENS

  const filteredSuggestions = useMemo(() => {
    const term = input.trim().toLowerCase()
    if (!term) {
      return QUICK_SUGGESTIONS.slice(0, 5)
    }
    return QUICK_SUGGESTIONS.filter(
      (suggestion) =>
        suggestion.title.toLowerCase().includes(term) ||
        suggestion.prompt.toLowerCase().includes(term)
    ).slice(0, 5)
  }, [input])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' && !event.altKey) {
      event.preventDefault()
      setHistoryIndex((prev) => {
        const nextIndex =
          prev === null ? history.length - 1 : Math.max(prev - 1, 0)
        if (nextIndex >= 0 && history[nextIndex]) {
          setInput(history[nextIndex])
          setActiveSuggestionIndex(-1)
          return nextIndex
        }
        return prev
      })
      return
    }

    if (event.key === 'ArrowDown' && !event.altKey) {
      event.preventDefault()
      setHistoryIndex((prev) => {
        if (prev === null) {
          return null
        }
        const nextIndex = prev + 1
        if (nextIndex >= history.length) {
          setInput('')
          setActiveSuggestionIndex(-1)
          return null
        }
        setInput(history[nextIndex])
        setActiveSuggestionIndex(-1)
        return nextIndex
      })
      return
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.altKey) {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveSuggestionIndex((prev) => {
        const suggestions = filteredSuggestions
        if (suggestions.length === 0) {
          return -1
        }
        const nextIndex =
          prev === -1
            ? direction > 0
              ? 0
              : suggestions.length - 1
            : (prev + direction + suggestions.length) % suggestions.length
        setInput(suggestions[nextIndex].prompt)
        return nextIndex
      })
      return
    }

    if (event.key === 'Tab' && activeSuggestionIndex >= 0) {
      event.preventDefault()
      const suggestion = filteredSuggestions[activeSuggestionIndex]
      setInput(suggestion?.prompt || '')
      return
    }

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

  const handleSuggestionSelect = (prompt: string, index: number) => {
    setInput(prompt)
    setActiveSuggestionIndex(index)
    setHistoryIndex(null)
  }

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
          <div className="flex items-center gap-4">
            <span data-testid="char-count">{characterCount}</span>
            <span
              data-testid="token-estimate"
              className={isTokenLimited ? 'text-red-500' : 'text-gray-500'}
            >
              ~{tokenEstimate} tokens
            </span>
          </div>
          {charLimitError && (
            <span data-testid="char-limit-error" className="text-red-500">
              {charLimitError}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <input
            data-testid="message-input"
            className="flex-1 rounded border border-gray-300 p-2"
            placeholder="Type your message"
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setActiveSuggestionIndex(-1)
            }}
            onKeyDown={handleKeyDown}
          />
            {filteredSuggestions.length > 0 && (
              <div
                data-testid="suggestion-panel"
                className="rounded border border-gray-200 bg-white shadow-sm"
              >
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    data-testid="suggestion-option"
                    className={`flex w-full items-start justify-between gap-4 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 ${
                      index === activeSuggestionIndex
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleSuggestionSelect(suggestion.prompt, index)
                    }}
                  >
                    <div>
                      <p className="font-medium">{suggestion.title}</p>
                      <p className="text-xs text-gray-500">
                        {suggestion.prompt}
                      </p>
                    </div>
                    {index === activeSuggestionIndex && (
                      <span className="text-[10px] uppercase text-blue-500">
                        Selected
                      </span>
                    )}
                  </button>
                ))}
                <div className="px-3 py-1 text-[10px] uppercase text-gray-400">
                  Use Alt+↑/↓ to browse suggestions
                </div>
              </div>
            )}
          </div>
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
