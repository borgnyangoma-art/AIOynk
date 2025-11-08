import { describe, it, expect } from 'vitest';
import authSlice, { loginSuccess, logout, setUser } from '../slices/authSlice';

describe('authSlice', () => {
  it('should return initial state', () => {
    const initialState = authSlice.reducer(undefined, { type: 'unknown' });
    expect(initialState).toEqual({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  });

  it('should handle loginSuccess', () => {
    const user = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    };
    const accessToken = 'access-token';
    const refreshToken = 'refresh-token';

    const state = authSlice.reducer(
      undefined,
      loginSuccess({ user, accessToken, refreshToken })
    );

    expect(state).toEqual({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      loading: false,
      error: null,
    });
  });

  it('should handle logout', () => {
    const stateWithUser = authSlice.reducer(
      {
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        accessToken: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
        loading: false,
        error: null,
      },
      logout()
    );

    expect(stateWithUser).toEqual({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  });

  it('should handle setUser', () => {
    const initialState = authSlice.reducer(
      undefined,
      loginSuccess({
        user: { id: '1', email: 'old@example.com', name: 'Old' },
        accessToken: 'token',
        refreshToken: 'refresh',
      })
    );

    const updatedUser = { id: '1', email: 'new@example.com', name: 'New' };
    const state = authSlice.reducer(initialState, setUser(updatedUser));

    expect(state.user).toEqual(updatedUser);
    expect(state.accessToken).toBe('token');
  });

  it('should handle multiple actions correctly', () => {
    let state = authSlice.reducer(undefined, { type: 'unknown' });

    // Login
    state = authSlice.reducer(
      state,
      loginSuccess({
        user: { id: '1', email: 'test@example.com', name: 'Test' },
        accessToken: 'token',
        refreshToken: 'refresh',
      })
    );
    expect(state.isAuthenticated).toBe(true);

    // Logout
    state = authSlice.reducer(state, logout());
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
