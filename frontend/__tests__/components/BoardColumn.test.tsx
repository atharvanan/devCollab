import { render, screen, fireEvent } from '@testing-library/react';
import { BoardColumn } from '@/components/board/BoardColumn';

// Mock dnd-kit
jest.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: jest.fn(),
    isOver: false,
  }),
}));

// Mock TaskCard
jest.mock('@/components/board/TaskCard', () => ({
  TaskCard: ({ task }: { task: any }) => (
    <div data-testid={`task-card-${task._id}`}>{task.title}</div>
  ),
}));

describe('BoardColumn Component (UIX-003, D-07, ROLE-001)', () => {
  const mockTasks = [
    { _id: 't1', title: 'Task Alpha', status: 'in_progress' },
    { _id: 't2', title: 'Task Beta', status: 'in_progress' },
  ];

  it('renders column title and task count badge correctly', () => {
    render(
      <BoardColumn
        id="in_progress"
        title="In Progress"
        tasks={mockTasks}
        onAddTask={jest.fn()}
        isPM={false}
      />
    );

    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-t1')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-t2')).toBeInTheDocument();
  });

  it('displays PM Only lock badge on Done column when user is not PM', () => {
    render(
      <BoardColumn
        id="done"
        title="Done"
        tasks={[]}
        onAddTask={jest.fn()}
        isPM={false}
      />
    );

    expect(screen.getByText('PM Only')).toBeInTheDocument();
  });

  it('does NOT display PM Only lock badge on Done column when user is PM', () => {
    render(
      <BoardColumn
        id="done"
        title="Done"
        tasks={[]}
        onAddTask={jest.fn()}
        isPM={true}
      />
    );

    expect(screen.queryByText('PM Only')).not.toBeInTheDocument();
  });

  it('invokes onAddTask handler when plus icon button is clicked', () => {
    const handleAddTask = jest.fn();
    render(
      <BoardColumn
        id="todo"
        title="To Do"
        tasks={[]}
        onAddTask={handleAddTask}
        isPM={false}
      />
    );

    const addBtn = screen.getByLabelText('Add new task to To Do');
    fireEvent.click(addBtn);
    expect(handleAddTask).toHaveBeenCalledTimes(1);
  });

  it('shows empty state message when tasks array is empty', () => {
    render(
      <BoardColumn
        id="review"
        title="Review"
        tasks={[]}
        onAddTask={jest.fn()}
        isPM={false}
      />
    );

    expect(screen.getByText('No tasks in review')).toBeInTheDocument();
  });

  it('applies scrollbar-none class to prevent double vertical scrollbar clutter', () => {
    const { container } = render(
      <BoardColumn
        id="todo"
        title="To Do"
        tasks={mockTasks}
        onAddTask={jest.fn()}
      />
    );

    const scrollContainer = container.querySelector('.scrollbar-none');
    expect(scrollContainer).toBeInTheDocument();
  });
});
