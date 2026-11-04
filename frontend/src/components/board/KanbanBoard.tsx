'use client';
import { useCallback, useState } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { boardActions } from '@/store/slices/boardSlice';
import { useSocket, useJoinRoom } from '@/hooks/useSocket';
import { COLUMNS, COLUMN_LABELS } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { BoardColumn } from './BoardColumn';
import { TaskModal } from './TaskModal';

export function KanbanBoard({ projectId, project }: { projectId: string; project?: any }) {
  const dispatch = useAppDispatch();
  const columns = useAppSelector((s) => s.board.columns);
  const { user } = useAppSelector((s) => s.auth);
  const qc = useQueryClient();
  const [activeTaskModal, setActiveTaskModal] = useState<{ column: string } | null>(null);

  const isPM =
    project?.owner?._id === user?._id ||
    project?.members?.some(
      (m: any) =>
        (m.user?._id || m.user) === user?._id &&
        (m.role === 'project_manager' || m.role === 'admin')
    );

  useJoinRoom(`project:${projectId}`);

  useQuery(
    ['board', projectId],
    async () => {
      const res = await apiClient.get(`/board/${projectId}`);
      return res.data.data.board;
    },
    {
      onSuccess: (data) => dispatch(boardActions.setBoard(data)),
    }
  );

  useSocket(
    'task:created',
    useCallback(
      (task: any) => {
        if (task.project === projectId) dispatch(boardActions.addTask(task));
      },
      [projectId, dispatch]
    )
  );

  useSocket(
    'task:moved',
    useCallback(() => {
      qc.invalidateQueries(['board', projectId]);
    }, [projectId, qc])
  );

  useSocket(
    'task:updated',
    useCallback(
      (task: any) => {
        dispatch(boardActions.updateTask(task));
      },
      [dispatch]
    )
  );

  useSocket(
    'task:deleted',
    useCallback(
      ({ taskId }: any) => {
        dispatch(boardActions.removeTask(taskId));
      },
      [dispatch]
    )
  );

  const moveMutation = useMutation(async ({ taskId, column, order }: any) => {
    await apiClient.patch(`/board/tasks/${taskId}/move`, { column, order });
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let fromColumn = '';
    Object.entries(columns).forEach(([col, tasks]) => {
      if (tasks.some((t) => t._id === taskId)) fromColumn = col;
    });

    const toColumn = COLUMNS.includes(overId as any)
      ? overId
      : (() => {
          let found = '';
          Object.entries(columns).forEach(([col, tasks]) => {
            if (tasks.some((t) => t._id === overId)) found = col;
          });
          return found;
        })();

    if (!fromColumn || !toColumn) return;

    const newOrder = columns[toColumn]?.length || 0;
    dispatch(boardActions.moveTask({ taskId, from: fromColumn, to: toColumn, order: newOrder }));
    moveMutation.mutate({ taskId, column: toColumn, order: newOrder });
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollBoard = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -380 : 380;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-full min-w-0">
            {/* Quick horizontal board navigation helper */}
      <div className="flex items-center justify-between pb-2 px-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          Workflow Columns
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollBoard('left')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary border border-border/70 rounded-md transition-colors cursor-pointer"
            title="Scroll left to Backlog / To Do"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Scroll Left
          </button>
          <button
            type="button"
            onClick={() => scrollBoard('right')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary border border-border/70 rounded-md transition-colors cursor-pointer"
            title="Scroll right to Review / Done"
          >
            Scroll Right <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div ref={scrollContainerRef} className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 touch-pan-x board-horizontal-scrollbar">
          {COLUMNS.map((col) => (
            <SortableContext
              key={col}
              items={(columns[col] || []).map((t) => t._id)}
              strategy={verticalListSortingStrategy}
            >
              <BoardColumn
                id={col}
                title={COLUMN_LABELS[col]}
                tasks={columns[col] || []}
                onAddTask={() => setActiveTaskModal({ column: col })}
                isPM={isPM}
                currentUserId={user?._id}
              />
            </SortableContext>
          ))}
        </div>
      </DndContext>

      {activeTaskModal && (
        <TaskModal
          projectId={projectId}
          column={activeTaskModal.column}
          projectMembers={project?.members || []}
          isPM={isPM}
          onClose={() => setActiveTaskModal(null)}
        />
      )}
    </div>
  );
}
