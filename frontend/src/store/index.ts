import { configureStore } from '@reduxjs/toolkit';
import authReducer, { setAccessToken, clearAuth } from './slices/authSlice';
import notificationReducer from './slices/notificationSlice';
import boardReducer from './slices/boardSlice';
import uiReducer from './slices/uiSlice';
import { registerAuthHooks } from '@/lib/apiClient';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    notifications: notificationReducer,
    board: boardReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: { ignoredActions: ['auth/setUser'] } }),
});

// Wire the API client's token logic to this store without creating a circular import
registerAuthHooks({
  getAccessToken: () => store.getState().auth.accessToken,
  onTokenRefreshed: (token) => store.dispatch(setAccessToken(token)),
  onAuthCleared: () => store.dispatch(clearAuth()),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
