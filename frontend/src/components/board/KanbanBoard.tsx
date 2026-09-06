'use client';
import { useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { boardActions } from '@/store/slices/boardSlice';
import { useSocket, useJoinRoom } from '@/hooks/useSocket';
import { COLUMNS, COLUMN_LABELS } from '@/lib/utils';
import { BoardColumn } from './BoardColumn';
import { useState } from 'react';
import { TaskModal } from './TaskModal';

export function KanbanBoard({ projectId }: { projectId: string }) {
  const dispatch = useAppDispatch();
  const columns = useAppSelector((s) => s.board.columns);
  const qc = useQueryClient();
  const [activeTaskModal, setActiveTaskModal] = useState<{ column: string } | null>(null);

  useJoinRoom(`project:${projectId}`);

  useQuery(['board', projectId], async () => {
    const res = await apiClient.get(`/board/${projectId}`);
    return res.data.data.board;
  }, {
    onSuccess: (data) => dispatch(boardActions.setBoard(data)),
  });

  useSocket('task:created', useCallback((task: any) => {
    if (task.project === projectId) dispatch(boardActions.addTask(task));
  }, [projectId, dispatch]));

  useSocket('task:moved', useCallback(() => {
    qc.invalidateQueries(['board', projectId]);
  }, [projectId, qc]));

  useSocket('task:updated', useCallback((task: any) => {
    dispatch(boardActions.updateTask(task));
  }, [dispatch]));

  useSocket('task:deleted', useCallback(({ taskId }: any) => {
    dispatch(boardActions.removeTask(taskId));
  }, [dispatch]));

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

    const toColumn = COLUMNS.includes(overId as any) ? overId : (() => {
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

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <SortableContext key={col} items={(columns[col] || []).map((t) => t._id)} strategy={verticalListSortingStrategy}>
              <BoardColumn
                id={col}
                title={COLUMN_LABELS[col]}
                tasks={columns[col] || []}
                onAddTask={() => setActiveTaskModal({ column: col })}
              />
            </SortableContext>
          ))}
        </div>
      </DndContext>

      {activeTaskModal && (
        <TaskModal
          projectId={projectId}
          column={activeTaskModal.column}
          onClose={() => setActiveTaskModal(null)}
        />
      )}
    </>
  );
}
