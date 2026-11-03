'use client';
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare, Square, ShieldAlert, CheckCircle2, RotateCcw, MessageSquare, Maximize2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Card';
import { PRIORITY_COLORS, ROLE_LABELS, ROLE_COLORS, formatDate, cn } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch } from '@/hooks/useRedux';
import { boardActions } from '@/store/slices/boardSlice';
import { useToast } from '@/components/ui/Toast';
import { TaskDetailModal } from './TaskDetailModal';

export function TaskCard({
  task,
  isPM,
  currentUserId,
}: {
  task: any;
  isPM?: boolean;
  currentUserId?: string;
}) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loadingAction, setLoadingAction] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isAssignee = task.assignees?.some(
    (a: any) => (a._id || a).toString() === currentUserId?.toString()
  );
  const canToggleDone = isAssignee || isPM;

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoadingAction(true);
      const res = await apiClient.patch(`/board/tasks/${task._id}/complete`);
      const updatedTask = res.data.data.task;
      dispatch(boardActions.updateTask(updatedTask));
      toast.success(
        updatedTask.completedByAssignee
          ? 'Work marked as Done! Submitted for Project Manager review.'
          : 'Task returned to In Progress.'
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update task completion');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleManagerReview = async (e: React.MouseEvent, status: 'approved' | 'rejected') => {
    e.stopPropagation();
    if (status === 'rejected' && !rejectModalOpen) {
      setRejectModalOpen(true);
      return;
    }

    try {
      setLoadingAction(true);
      const res = await apiClient.patch(`/board/tasks/${task._id}/manager-review`, {
        status,
        feedback: feedback.trim(),
      });
      const updatedTask = res.data.data.task;
      dispatch(boardActions.updateTask(updatedTask));
      toast.success(
        status === 'approved'
          ? 'Task approved & signed off by Project Manager! Moved to Done.'
          : 'Revisions requested. Task sent back to developer.'
      );
      setRejectModalOpen(false);
      setFeedback('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <>
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <Card
          onClick={() => setDetailModalOpen(true)}
          className="p-3.5 cursor-pointer hover:border-primary/50 transition-all shadow-xs space-y-2.5 group relative"
        >
          {/* Top Title & Expand Icon */}
          <div className="flex items-start justify-between gap-1.5">
            <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
              {task.title}
            </p>
            <span
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground shrink-0"
              title="Click to view full ticket details and feedback"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </span>
          </div>

        {/* Role & Priority Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'text-[10px] font-semibold uppercase rounded px-1.5 py-0.5',
              PRIORITY_COLORS[task.priority]
            )}
          >
            {task.priority}
          </span>

          {task.targetRole && task.targetRole !== 'any' && (
            <span
              className={cn(
                'text-[10px] font-medium rounded px-1.5 py-0.5 border',
                ROLE_COLORS[task.targetRole] || 'bg-secondary text-secondary-foreground'
              )}
            >
              {ROLE_LABELS[task.targetRole] || task.targetRole}
            </span>
          )}
        </div>

        {/* Description preview if present */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        {/* Developer "Mark as Done" Checkbox */}
        <div className="pt-1 border-t border-border/50 flex items-center justify-between gap-2">
          {canToggleDone ? (
            <button
              onClick={handleToggleComplete}
              disabled={loadingAction}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium py-1 px-2 rounded-md transition-colors',
                task.completedByAssignee
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title={
                task.completedByAssignee
                  ? 'Completed — Click to uncheck'
                  : 'Click when work is done to submit for PM review'
              }
            >
              {task.completedByAssignee ? (
                <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Square className="w-4 h-4 shrink-0" />
              )}
              <span>{task.completedByAssignee ? 'Done (Submitted)' : 'Mark Done'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {task.completedByAssignee ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </span>
              ) : (
                <span>In Progress</span>
              )}
            </div>
          )}

          {/* Date & Assignee Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="w-3 h-3" /> {formatDate(task.dueDate)}
              </span>
            )}
            {task.assignees?.[0] && (
              <div title={`Assigned to: ${task.assignees[0].name}`}>
                <Avatar
                  src={task.assignees[0].avatar}
                  name={task.assignees[0].name}
                  size={20}
                />
              </div>
            )}
          </div>
        </div>

        {/* Manager Review Status Banner */}
        {task.managerReview?.status === 'approved' && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Approved by Project Manager</span>
          </div>
        )}

        {task.managerReview?.status === 'rejected' && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded px-2 py-1 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
            <div className="flex items-center gap-1.5 font-medium">
              <RotateCcw className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Revisions Requested by PM</span>
            </div>
            {task.managerReview.feedback && (
              <p className="text-[10px] text-rose-600 dark:text-rose-400 italic pl-5">
                &ldquo;{task.managerReview.feedback}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* PM Review Action Buttons (When task is completed/review and user is PM) */}
        {isPM && task.column === 'review' && task.managerReview?.status !== 'approved' && (
          <div className="bg-accent/50 rounded-lg p-2 space-y-2 border border-border">
            <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-primary" /> Manager Sign-Off Required:
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleManagerReview(e, 'approved')}
                disabled={loadingAction}
                className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                title="Approve work and move to Done"
              >
                <CheckCircle2 className="w-3 h-3" /> Approve
              </button>
              <button
                onClick={(e) => handleManagerReview(e, 'rejected')}
                disabled={loadingAction}
                className="flex-1 py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                title="Request revisions and send back"
              >
                <RotateCcw className="w-3 h-3" /> Revise
              </button>
            </div>

            {/* Quick feedback input if PM clicked Revise */}
            {rejectModalOpen && (
              <div className="space-y-1.5 pt-1 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  placeholder="Feedback / what needs to change..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full text-xs px-2 py-1 rounded border border-input bg-background"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => setRejectModalOpen(false)}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => handleManagerReview(e, 'rejected')}
                    className="text-[10px] bg-rose-600 text-white font-medium px-2 py-0.5 rounded"
                  >
                    Send Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>

    {detailModalOpen && (
      <TaskDetailModal
        task={task}
        isPM={!!isPM}
        currentUserId={currentUserId}
        onClose={() => setDetailModalOpen(false)}
      />
    )}
  </>
  );
}
