import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BoardState {
  columns: { [key: string]: any[] };
  loading: boolean;
}

const boardSlice = createSlice({
  name: 'board',
  initialState: { columns: {}, loading: false } as BoardState,
  reducers: {
    setBoard(state, action: PayloadAction<{ [key: string]: any[] }>) {
      const board = action.payload || {};
      const cleanColumns: { [key: string]: any[] } = {};
      const seenIds = new Set<string>();

      Object.entries(board).forEach(([col, tasks]) => {
        cleanColumns[col] = [];
        (tasks || []).forEach((t: any) => {
          if (t && t._id && !seenIds.has(t._id)) {
            seenIds.add(t._id);
            cleanColumns[col].push(t);
          }
        });
      });

      state.columns = cleanColumns;
    },
    addTask(state, action: PayloadAction<any>) {
      const task = action.payload;
      if (!task || !task._id) return;

      // Deduplicate: check if this task is already in any column
      const existingCol = Object.keys(state.columns).find((c) =>
        state.columns[c]?.some((t: any) => t._id === task._id)
      );

      if (existingCol) {
        if (existingCol !== task.column) {
          state.columns[existingCol] = state.columns[existingCol].filter(
            (t: any) => t._id !== task._id
          );
        } else {
          const idx = state.columns[existingCol].findIndex((t: any) => t._id === task._id);
          if (idx !== -1) {
            state.columns[existingCol][idx] = { ...state.columns[existingCol][idx], ...task };
          }
          return;
        }
      }

      const col = task.column || 'backlog';
      if (!state.columns[col]) state.columns[col] = [];
      state.columns[col].push(task);
    },
    moveTask(state, action: PayloadAction<{ taskId: string; from: string; to: string; order: number }>) {
      const { taskId, from, to, order } = action.payload;
      const task = state.columns[from]?.find((t: any) => t._id === taskId);
      if (!task) return;
      state.columns[from] = state.columns[from].filter((t: any) => t._id !== taskId);
      task.column = to;
      task.order = order;
      if (!state.columns[to]) state.columns[to] = [];
      state.columns[to].splice(order, 0, task);
    },
    updateTask(state, action: PayloadAction<any>) {
      const task = action.payload;
      Object.keys(state.columns).forEach((col) => {
        state.columns[col] = state.columns[col].filter((t: any) => t._id !== task._id);
      });
      const col = task.column || 'backlog';
      if (!state.columns[col]) state.columns[col] = [];
      state.columns[col].push(task);
      state.columns[col].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    },
    removeTask(state, action: PayloadAction<string>) {
      Object.keys(state.columns).forEach((col) => {
        state.columns[col] = state.columns[col].filter((t: any) => t._id !== action.payload);
      });
    },
    setBoardLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const boardActions = boardSlice.actions;
export default boardSlice.reducer;
