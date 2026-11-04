import { render } from '@testing-library/react';
import axe from 'axe-core';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BoardColumn } from '@/components/board/BoardColumn';
import { ShareMetrics } from '@/components/collab/ShareMetrics';

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

describe('WCAG 2.1 AA Automated Accessibility Verification (axe-core)', () => {
  it('Button component complies with WCAG accessibility standards without violations', async () => {
    const { container } = render(<Button aria-label="Submit Form">Submit Form</Button>);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('Input component with accessible label complies with WCAG standards', async () => {
    const { container } = render(
      <div>
        <label htmlFor="email-input">Email Address</label>
        <Input id="email-input" placeholder="user@devcollab.com" type="email" />
      </div>
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('ThemeToggle component has proper accessible name and role', async () => {
    const { container } = render(<ThemeToggle showLabel={true} />);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('BoardColumn structure complies with WCAG standards', async () => {
    const { container } = render(
      <BoardColumn
        id="todo"
        title="To Do"
        tasks={[]}
        onAddTask={jest.fn()}
        isPM={false}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('ShareMetrics dashboard component complies with WCAG standards', async () => {
    const { container } = render(
      <ShareMetrics
        contributors={[
          {
            user: 'u1',
            name: 'Sarah Chen',
            role: 'backend_developer',
            charactersAdded: 150,
            linesContributed: 20,
            percentage: 100,
          },
        ]}
        activeUserIds={['u1']}
        totalLines={20}
        totalChars={150}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
