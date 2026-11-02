'use client';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
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
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          {title}
          <span className="text-xs text-muted-foreground bg-secondary font-medium rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </h3>
        <button
          onClick={onAddTask}
          aria-label={`Add new task to ${title}`}
          title={`Add task to ${title}`}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-xl p-2.5 min-h-[220px] space-y-2.5 transition-colors border border-border/50',
          isOver ? 'bg-primary/5 ring-2 ring-primary/30 border-primary/30' : 'bg-secondary/30'
        )}
      >
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} isPM={isPM} currentUserId={currentUserId} />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/40 rounded-lg">
            <p className="text-xs text-muted-foreground">No tasks in {title.toLowerCase()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
