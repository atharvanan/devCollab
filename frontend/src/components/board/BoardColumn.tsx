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
}

export function BoardColumn({ id, title, tasks, onAddTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {title}
          <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{tasks.length}</span>
        </h3>
        <button onClick={onAddTask} className="text-muted-foreground hover:text-foreground">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg p-2 min-h-[200px] space-y-2 transition-colors',
          isOver ? 'bg-primary/5 ring-2 ring-primary/30' : 'bg-secondary/30'
        )}
      >
        {tasks.map((task) => <TaskCard key={task._id} task={task} />)}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No tasks</p>
        )}
      </div>
    </div>
  );
}
