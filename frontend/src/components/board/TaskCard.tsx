'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Card';
import { PRIORITY_COLORS, formatDate, cn } from '@/lib/utils';

export function TaskCard({ task }: { task: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors">
        <p className="text-sm font-medium mb-2 line-clamp-2">{task.title}</p>
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px] font-semibold uppercase rounded px-1.5 py-0.5', PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </span>
          <div className="flex items-center gap-2">
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="w-3 h-3" /> {formatDate(task.dueDate)}
              </span>
            )}
            {task.assignees?.[0] && <Avatar src={task.assignees[0].avatar} name={task.assignees[0].name} size={20} />}
          </div>
        </div>
      </Card>
    </div>
  );
}
