import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Notification slice
interface NotificationState {
  items: any[];
  unreadCount: number;
}

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], unreadCount: 0 } as NotificationState,
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
      if (n && !n.read) { n.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
    },
    markAllRead(state) {
      state.items.forEach((n) => (n.read = true));
      state.unreadCount = 0;
    },
  },
});

export default notificationSlice.reducer;
export const notificationActions = notificationSlice.actions;

// Board slice
interface BoardState {
  columns: { [key: string]: any[] };
  loading: boolean;
}

const boardSlice = createSlice({
  name: 'board',
  initialState: { columns: {}, loading: false } as BoardState,
  reducers: {
    setBoard(state, action: PayloadAction<{ [key: string]: any[] }>) {
      state.columns = action.payload;
    },
    addTask(state, action: PayloadAction<any>) {
      const col = action.payload.column || 'backlog';
      if (!state.columns[col]) state.columns[col] = [];
      state.columns[col].push(action.payload);
    },
    moveTask(state, action: PayloadAction<{ taskId: string; from: string; to: string; order: number }>) {
      const { taskId, from, to, order } = action.payload;
      const task = state.columns[from]?.find((t) => t._id === taskId);
      if (!task) return;
      state.columns[from] = state.columns[from].filter((t) => t._id !== taskId);
      task.column = to;
      task.order = order;
      if (!state.columns[to]) state.columns[to] = [];
      state.columns[to].splice(order, 0, task);
    },
    updateTask(state, action: PayloadAction<any>) {
      const task = action.payload;
      const col = state.columns[task.column];
      if (col) {
        const idx = col.findIndex((t) => t._id === task._id);
        if (idx !== -1) col[idx] = task;
      }
    },
    removeTask(state, action: PayloadAction<string>) {
      Object.keys(state.columns).forEach((col) => {
        state.columns[col] = state.columns[col].filter((t) => t._id !== action.payload);
      });
    },
    setBoardLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export { boardSlice };
export const boardActions = boardSlice.actions;

// UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: true, theme: 'light' as 'light' | 'dark' },
  reducers: {
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) { state.theme = action.payload; },
  },
});

export const uiActions = uiSlice.actions;
