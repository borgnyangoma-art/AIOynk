import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Session, Message, Context } from '../../types';

interface SessionState {
  currentSession: Session | null;
  sessions: Session[];
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SessionState = {
  currentSession: null,
  sessions: [],
  messages: [],
  isLoading: false,
  error: null
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    createSessionStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    createSessionSuccess: (state, action: PayloadAction<Session>) => {
      state.currentSession = action.payload;
      state.sessions.unshift(action.payload);
      state.isLoading = false;
      state.messages = [];
      state.error = null;
    },
    createSessionFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    setCurrentSession: (state, action: PayloadAction<Session>) => {
      state.currentSession = action.payload;
    },
    loadSessionSuccess: (state, action: PayloadAction<Session>) => {
      state.currentSession = action.payload;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    addMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages.push(...action.payload);
    },
    updateContext: (state, action: PayloadAction<Context>) => {
      if (state.currentSession) {
        state.currentSession.context = action.payload;
      }
    },
    clearSession: (state) => {
      state.currentSession = null;
      state.messages = [];
    },
    loadSessionsSuccess: (state, action: PayloadAction<Session[]>) => {
      state.sessions = action.payload;
    },
    closeSessionSuccess: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.map(s =>
        s.id === action.payload ? { ...s, isActive: false } : s
      );
      if (state.currentSession?.id === action.payload) {
        state.currentSession = null;
        state.messages = [];
      }
    }
  }
});

export const {
  createSessionStart,
  createSessionSuccess,
  createSessionFailure,
  setCurrentSession,
  loadSessionSuccess,
  addMessage,
  addMessages,
  updateContext,
  clearSession,
  loadSessionsSuccess,
  closeSessionSuccess
} = sessionSlice.actions;

export default sessionSlice.reducer;
