import authReducer, { setAccessToken, clearAuth, setInitialized } from '@/store/slices/authSlice';

describe('authSlice', () => {
  const initialState = {
    user: null,
    accessToken: null,
    loading: false,
    error: null,
    initialized: false,
  };

  it('returns initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('handles setAccessToken', () => {
    const state = authReducer(initialState, setAccessToken('abc123'));
    expect(state.accessToken).toBe('abc123');
  });

  it('handles clearAuth', () => {
    const loggedInState = { ...initialState, user: { _id: '1' } as any, accessToken: 'token' };
    const state = authReducer(loggedInState, clearAuth());
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('handles setInitialized', () => {
    const state = authReducer(initialState, setInitialized());
    expect(state.initialized).toBe(true);
  });
});
