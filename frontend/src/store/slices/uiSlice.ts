import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: true, theme: 'light' as 'light' | 'dark' },
  reducers: {
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) { state.theme = action.payload; },
  },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
