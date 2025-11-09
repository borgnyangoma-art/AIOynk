import { describe, it, expect } from 'vitest'
import authReducer, {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateUser,
} from '../slices/authSlice'

const baseState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
}

const mockTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
}

describe('authSlice', () => {
  it('returns the initial state', () => {
    const state = authReducer(undefined, { type: 'unknown' })
    expect(state).toEqual(baseState)
  })

  it('handles loginStart', () => {
    const state = authReducer(baseState, loginStart())
    expect(state.isLoading).toBe(true)
    expect(state.error).toBeNull()
  })

  it('handles loginSuccess', () => {
    const state = authReducer(
      baseState,
      loginSuccess({ user: mockUser, tokens: mockTokens }),
    )

    expect(state).toEqual({
      user: mockUser,
      tokens: mockTokens,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })
  })

  it('handles loginFailure', () => {
    const previousState = { ...baseState, isLoading: true }
    const state = authReducer(previousState, loginFailure('Invalid credentials'))

    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Invalid credentials')
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.tokens).toBeNull()
  })

  it('handles logout', () => {
    const authenticatedState = authReducer(
      baseState,
      loginSuccess({ user: mockUser, tokens: mockTokens }),
    )

    const state = authReducer(authenticatedState, logout())
    expect(state).toEqual(baseState)
  })

  it('handles updateUser', () => {
    const authenticatedState = authReducer(
      baseState,
      loginSuccess({ user: mockUser, tokens: mockTokens }),
    )

    const state = authReducer(
      authenticatedState,
      updateUser({ name: 'Updated User' }),
    )

    expect(state.user?.name).toBe('Updated User')
    expect(state.tokens).toEqual(mockTokens)
  })
})
