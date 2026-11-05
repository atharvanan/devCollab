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
import { ChevronLeft, ChevronRight, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { BoardColumn } from './BoardColumn';
import { TaskModal } from './TaskModal';

export function KanbanBoard({ projectId, project }: { projectId: string; project?: any }) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
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

  const [slaMetrics, setSlaMetrics] = useState<any>(null);

  useQuery(
    ['board', projectId],
    async () => {
      const res = await apiClient.get(`/board/${projectId}`);
      return res.data.data;
    },
    {
      onSuccess: (data) => {
        dispatch(boardActions.setBoard(data.board));
        if (data.slaSummary) {
          setSlaMetrics(data.slaSummary);
        }
      },
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

    const taskToMove = (columns[fromColumn] || []).find((t) => t._id === taskId);
    if (!taskToMove) return;

    const isAssignee = taskToMove.assignees?.some(
      (a: any) => (a._id || a).toString() === user?._id?.toString()
    );

    // Compliance Check 1: Non-PM cannot move directly into Done
    if (toColumn === 'done' && !isPM) {
      toast.error('Compliance Restriction: Only Project Managers can approve and close tickets into Done.');
      return;
    }

    // Compliance Check 2: Non-PM cannot drag tickets out of Review
    if (fromColumn === 'review' && toColumn !== 'review' && !isPM) {
      toast.error('Compliance Restriction: Ticket is locked under PM Review. Only Project Managers can approve or request revisions.');
      return;
    }

    // Compliance Check 3: Non-PM cannot move other members' tickets
    if (!isPM && !isAssignee) {
      toast.error('Permission Denied: Only assigned engineers or Project Managers can move this ticket.');
      return;
    }

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
            {/* Enterprise SLA & SDLC Compliance Bar */}
      <div className="mb-3 p-3 rounded-md border border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>SLA Health:</span>
            <span className="text-primary font-mono">{slaMetrics?.complianceRate ?? 100}% Met</span>
          </div>

          <div className="h-3 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
              <CheckCircle2 className="w-3 h-3" /> {slaMetrics?.compliant ?? 0} Compliant
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
              <AlertTriangle className="w-3 h-3" /> {slaMetrics?.atRisk ?? 0} At Risk
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono">
              <AlertCircle className="w-3 h-3" /> {slaMetrics?.breached ?? 0} Breached
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-sm border border-border font-medium">
            <Lock className="w-3 h-3 text-muted-foreground" />
            {isPM ? 'PM Authority: Full Sign-Off Active' : 'Strict Hierarchy: PM Sign-Off Required for Done'}
          </span>
        </div>
      </div>

      {/* Quick horizontal board navigation helper */}
      <div className="flex items-center justify-between pb-2 px-1">
        <span className="text-xs text-muted-foreground font-medium">
          Workflow Columns
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollBoard('left')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary border border-border/70 rounded-lg transition-colors cursor-pointer shadow-xs active:scale-98"
            title="Scroll left to Backlog / To Do"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Scroll Left
          </button>
          <button
            type="button"
            onClick={() => scrollBoard('right')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary border border-border/70 rounded-lg transition-colors cursor-pointer shadow-xs active:scale-98"
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
