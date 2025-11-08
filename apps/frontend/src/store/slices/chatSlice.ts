import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface ChatAttachment {
  id: string
  name: string
  type: string
  size: number
}

export interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: number
  type?: 'text' | 'attachment'
  attachments?: ChatAttachment[]
}

interface ChatState {
  messages: ChatMessage[]
  isConnecting: boolean
  isConnected: boolean
}

const initialState: ChatState = {
  messages: [],
  isConnecting: false,
  isConnected: false,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload)
    },
    setConnectionState: (
      state,
      action: PayloadAction<{ isConnecting: boolean; isConnected: boolean }>,
    ) => {
      state.isConnecting = action.payload.isConnecting
      state.isConnected = action.payload.isConnected
    },
    clearMessages: (state) => {
      state.messages = []
    },
  },
})

export const { addMessage, setConnectionState, clearMessages } = chatSlice.actions
export default chatSlice.reducer
