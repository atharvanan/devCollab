import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NotificationState {
  items: any[];
  unreadCount: number;
}

const initialState: NotificationState = {
  items: [],
  unreadCount: 0,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<{ items: any[]; unreadCount: number }>) {
      state.items = action.payload.items;
      state.unreadCount = action.payload.unreadCount;
    },
    addNotification(state, action: PayloadAction<any>) {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
    markAsRead(state, action: PayloadAction<string>) {
      const n = state.items.find((i) => i._id === action.payload);
      if (n && !n.read) {
        n.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead(state) {
      state.items.forEach((n) => {
        n.read = true;
      });
      state.unreadCount = 0;
    },
  },
});

export const notificationActions = notificationSlice.actions;
export default notificationSlice.reducer;
