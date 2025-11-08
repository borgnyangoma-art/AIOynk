import React, { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Mic, MicOff } from 'lucide-react'

interface Suggestion {
  id: string
  text: string
  type: 'command' | 'tool' | 'common'
  description?: string
}

interface MessageInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  onFileUpload?: (file: File) => void
  onOpenFileUpload?: () => void
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: '1',
    text: 'create a logo',
    type: 'command',
    description: 'Generate a logo design',
  },
  {
    id: '2',
    text: 'design a website',
    type: 'command',
    description: 'Create a web page layout',
  },
  {
    id: '3',
    text: 'write code',
    type: 'command',
    description: 'Generate code for an application',
  },
  {
    id: '4',
    text: 'make a 3D model',
    type: 'command',
    description: 'Create a 3D object',
  },
  {
    id: '5',
    text: 'edit a video',
    type: 'command',
    description: 'Edit video content',
  },
  {
    id: '6',
    text: 'use graphics',
    type: 'tool',
    description: 'Switch to graphics editor',
  },
  {
    id: '7',
    text: 'use web designer',
    type: 'tool',
    description: 'Switch to web designer',
  },
  { id: '8', text: 'use IDE', type: 'tool', description: 'Switch to code IDE' },
  { id: '9', text: 'use CAD', type: 'tool', description: 'Switch to 3D CAD' },
  {
    id: '10',
    text: 'use video',
    type: 'tool',
    description: 'Switch to video editor',
  },
  {
    id: '11',
    text: 'help',
    type: 'common',
    description: 'Show available commands',
  },
  {
    id: '12',
    text: 'clear chat',
    type: 'common',
    description: 'Clear conversation history',
  },
]

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  onFileUpload,
  onOpenFileUpload,
}) => {
  const [message, setMessage] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>(
    []
  )
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isRecording, setIsRecording] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const filterSuggestions = (query: string) => {
    if (!query.trim()) {
      setFilteredSuggestions([])
      setShowSuggestions(false)
      return
    }

    const filtered = SUGGESTIONS.filter(
      (suggestion) =>
        suggestion.text.toLowerCase().includes(query.toLowerCase()) ||
        (suggestion.description &&
          suggestion.description.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 5)

    setFilteredSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setSelectedIndex(-1)
  }

  useEffect(() => {
    filterSuggestions(message)
  }, [message])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
      setShowSuggestions(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          setMessage(filteredSuggestions[selectedIndex].text)
          setShowSuggestions(false)
        } else {
          handleSubmit(e)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setMessage(suggestion.text)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onFileUpload) {
      onFileUpload(file)
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    // TODO: Implement speech-to-text
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'command':
        return '⚡'
      case 'tool':
        return '🛠️'
      default:
        return '💡'
    }
  }

  const getSuggestionStyle = (index: number) => {
    return index === selectedIndex
      ? 'bg-blue-100 dark:bg-blue-900'
      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
  }

  return (
    <div className="relative">
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`px-4 py-3 cursor-pointer transition-colors ${getSuggestionStyle(index)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">
                  {getSuggestionIcon(suggestion.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {suggestion.text}
                  </div>
                  {suggestion.description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {suggestion.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end gap-2 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => message && setShowSuggestions(true)}
              placeholder="Type a message..."
              disabled={disabled}
              className="w-full px-4 py-3 pr-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {message && (
              <button
                type="button"
                onClick={() => setMessage('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>

          <input
            type="file"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={disabled}
          />

          <button
            type="button"
            onClick={onOpenFileUpload}
            className="p-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach file"
            disabled={disabled}
          >
            <Paperclip size={20} />
          </button>

          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isRecording
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            title={isRecording ? 'Stop recording' : 'Voice input'}
            disabled={disabled}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  )
}
