'use client';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Lock } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';

interface Props {
  id: string;
  title: string;
  tasks: any[];
  onAddTask: () => void;
  isPM?: boolean;
  currentUserId?: string;
}

export function BoardColumn({ id, title, tasks, onAddTask, isPM, currentUserId }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex-shrink-0 w-72 sm:w-80 flex flex-col">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-2 px-1 select-none">
        <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
          {title}
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary border border-border font-medium rounded-sm px-1.5 py-0.2">
            {tasks.length}
          </span>
          {id === 'done' && !isPM && (
            <span
              className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-sm flex items-center gap-1"
              title="Compliance Rule: Only Project Managers can approve and close tickets into Done"
            >
              <Lock className="w-2.5 h-2.5" /> PM Only
            </span>
          )}
        </h3>
        <button
          onClick={onAddTask}
          aria-label={`Add new task to ${title}`}
          title={`Add task to ${title}`}
          className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Internal scrollable task list */}
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-md p-2 min-h-[260px] max-h-[calc(100vh-330px)] overflow-y-auto space-y-2 transition-colors border border-border scrollbar-none shadow-2xs',
          isOver ? 'bg-primary/5 border-primary/50' : 'bg-secondary/20'
        )}
      >
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} isPM={isPM} currentUserId={currentUserId} />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-md">
            <p className="text-xs text-muted-foreground">No tasks in {title.toLowerCase()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
