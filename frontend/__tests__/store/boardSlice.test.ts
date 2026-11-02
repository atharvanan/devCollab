import boardReducer, { boardActions } from '@/store/slices/boardSlice';

describe('boardSlice', () => {
  const initialState = { columns: {}, loading: false };

  it('sets the board correctly', () => {
    const board = { backlog: [{ _id: '1', title: 'Task 1' }], todo: [] };
    const state = boardReducer(initialState, boardActions.setBoard(board));
    expect(state.columns).toEqual(board);
  });

  it('adds a task to the correct column', () => {
    const state = boardReducer(initialState, boardActions.addTask({ _id: '1', title: 'New Task', column: 'todo' }));
    expect(state.columns.todo).toHaveLength(1);
    expect(state.columns.todo[0].title).toBe('New Task');
  });

  it('safely deduplicates when adding the same task multiple times', () => {
    let state = boardReducer(initialState, boardActions.addTask({ _id: '1', title: 'Task 1', column: 'todo' }));
    state = boardReducer(state, boardActions.addTask({ _id: '1', title: 'Task 1 (duplicate socket event)', column: 'todo' }));
    expect(state.columns.todo).toHaveLength(1);
    expect(state.columns.todo[0]._id).toBe('1');
  });

  it('moves a task between columns', () => {
    const stateWithTask = {
      columns: { backlog: [{ _id: '1', title: 'Task 1', column: 'backlog' }], todo: [] },
      loading: false,
    };
    const state = boardReducer(stateWithTask, boardActions.moveTask({ taskId: '1', from: 'backlog', to: 'todo', order: 0 }));
    expect(state.columns.backlog).toHaveLength(0);
    expect(state.columns.todo).toHaveLength(1);
    expect(state.columns.todo[0].column).toBe('todo');
  });

  it('removes a task from all columns', () => {
    const stateWithTask = {
      columns: { backlog: [{ _id: '1', title: 'Task 1' }], todo: [{ _id: '2', title: 'Task 2' }] },
      loading: false,
    };
    const state = boardReducer(stateWithTask, boardActions.removeTask('1'));
    expect(state.columns.backlog).toHaveLength(0);
    expect(state.columns.todo).toHaveLength(1);
  });
});
