import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '@/lib/apiClient';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  bio: string;
  github: string;
  skills: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  loading: false,
  error: null,
  initialized: false,
};

export const loginUser = createAsyncThunk('auth/login', async (credentials: { email: string; password: string }, { rejectWithValue }) => {
  try {
    const res = await apiClient.post('/auth/login', credentials);
    if (res.data?.requiresOTP || res.data?.data?.requiresOTP) {
      return {
        requiresOTP: true,
        userId: res.data?.data?.userId,
        email: res.data?.data?.email || credentials.email,
        otp: res.data?.data?.otp,
        message: res.data?.message || 'OTP verification code sent to your email.',
      };
    }
    return res.data.data;
  } catch (err: any) {
    const data = err.response?.data;
    if (data?.isUnverified) {
      return rejectWithValue({
        message: data.message || 'Please verify your email before logging in.',
        isUnverified: true,
        userId: data.data?.userId,
        email: data.data?.email || credentials.email,
      });
    }
    return rejectWithValue(data?.message || 'Login failed');
  }
});

export const registerUser = createAsyncThunk('auth/register', async (data: { name: string; email: string; password: string }, { rejectWithValue }) => {
  try {
    const res = await apiClient.post('/auth/register', data);
    return res.data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const refreshAccessToken = createAsyncThunk('auth/refresh', async (_, { rejectWithValue }) => {
  try {
    const res = await apiClient.post('/auth/refresh');
    return res.data.data;
  } catch {
    return rejectWithValue('Session expired');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  try {
    apiClient.post('/auth/logout').catch(() => {});
  } finally {
    dispatch(authSlice.actions.clearAuth());
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
});

export const performImmediateLogout = (dispatch: any) => {
  try {
    apiClient.post('/auth/logout').catch(() => {});
  } catch (_) {}
  dispatch(authSlice.actions.clearAuth());
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const res = await apiClient.get('/auth/me');
    return res.data.data;
  } catch {
    return rejectWithValue('Not authenticated');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.initialized = true;
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
    },
    setInitialized(state) {
      state.initialized = true;
    },
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        if ((action.payload as any)?.requiresOTP) {
          return;
        }
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.initialized = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string'
          ? action.payload
          : (action.payload as any)?.message || 'Login failed';
      })
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.accessToken && action.payload?.user) {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.initialized = true;
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.initialized = true;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.initialized = true;
      })
      .addCase(fetchMe.rejected, (state) => { state.initialized = true; });
  },
});

export const { setCredentials, setAccessToken, clearAuth, setInitialized, updateUser } = authSlice.actions;
export default authSlice.reducer;
