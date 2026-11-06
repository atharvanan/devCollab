'use client';
import { useState } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  Send,
  User,
  ArrowRight,
  AlertCircle,
  Sparkles,
  FileText,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { useAppDispatch } from '@/hooks/useRedux';
import { boardActions } from '@/store/slices/boardSlice';
import {
  COLUMN_LABELS,
  PRIORITY_COLORS,
  ROLE_LABELS,
  ROLE_COLORS,
  formatDate,
  formatRelativeTime,
  cn,
} from '@/lib/utils';

interface Props {
  task: any;
  isPM: boolean;
  currentUserId?: string;
  onClose: () => void;
}

export function TaskDetailModal({ task, isPM, currentUserId, onClose }: Props) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState(task.resolutionNotes || '');
  const [pmFeedback, setPmFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [newComment, setNewComment] = useState('');

  const isAssignee = task.assignees?.some(
    (a: any) => (a._id || a).toString() === currentUserId?.toString()
  );
  const isUnassigned = !task.assignees || task.assignees.length === 0;
  const canWorkOnTask = isAssignee || isPM || isUnassigned;

  // Claim unassigned task
  const handleClaimTask = async () => {
    try {
      setLoading(true);
      const res = await apiClient.put(`/board/tasks/${task._id}`, {
        assignees: [currentUserId],
        column: task.column === 'backlog' ? 'in_progress' : task.column,
      });
      const updated = res.data.data.task;
      dispatch(boardActions.updateTask(updated));
      toast.success('Task claimed and assigned to you!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to claim task');
    } finally {
      setLoading(false);
    }
  };

  // 1. Move to In Progress
  const handleStartProgress = async () => {
    try {
      setLoading(true);
      const res = await apiClient.put(`/board/tasks/${task._id}`, {
        column: 'in_progress',
      });
      const updated = res.data.data.task;
      dispatch(boardActions.updateTask(updated));
      toast.success('Ticket moved to In Progress!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start progress');
    } finally {
      setLoading(false);
    }
  };

  // 2. Developer Submits Work / Resolution Notes
  const handleSubmitResolution = async () => {
    try {
      setLoading(true);
      const res = await apiClient.patch(`/board/tasks/${task._id}/resolve`, {
        notes: resolutionNotes.trim(),
        column: 'review',
      });
      const updated = res.data.data.task;
      dispatch(boardActions.updateTask(updated));
      toast.success('Work submitted for Project Manager review with your notes!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setLoading(false);
    }
  };

  // 3. PM Review: Approve or Request Changes
  const handleManagerReview = async (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (status === 'rejected' && !pmFeedback.trim()) {
      toast.error('Please enter feedback describing what changes are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.patch(`/board/tasks/${task._id}/manager-review`, {
        status,
        feedback: pmFeedback.trim(),
        routeToColumn: 'in_progress',
      });
      const updated = res.data.data.task;
      dispatch(boardActions.updateTask(updated));
      toast.success(
        status === 'approved'
          ? 'Ticket approved and closed! Moved to Done.'
          : 'Revisions requested. Ticket routed back to developer.'
      );
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to review ticket');
    } finally {
      setLoading(false);
    }
  };

  // 4. Add Comment / Update Note to Activity
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setLoading(true);
      const res = await apiClient.post(`/board/tasks/${task._id}/comments`, {
        message: newComment.trim(),
      });
      const updated = res.data.data.task;
      dispatch(boardActions.updateTask(updated));
      setNewComment('');
      toast.success('Note added to ticket!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const activityNotes = task.activityNotes || [];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Badges & Close Button */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            {/* Stage / Column Badge */}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground border border-border shadow-xs">
              {COLUMN_LABELS[task.column] || task.column}
            </span>

            {/* Priority Badge */}
            <span
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold uppercase shadow-xs',
                PRIORITY_COLORS[task.priority]
              )}
            >
              {task.priority} Priority
            </span>

            {/* Target Role Badge */}
            {task.targetRole && task.targetRole !== 'any' && (
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border shadow-xs',
                  ROLE_COLORS[task.targetRole] || 'bg-secondary text-secondary-foreground'
                )}
              >
                {ROLE_LABELS[task.targetRole] || task.targetRole}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close details"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 scrollbar-none">
          {/* Title */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
              {task.title}
            </h2>
            {task.createdAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Created {formatRelativeTime(task.createdAt)}
              </p>
            )}
          </div>

          {/* Full Uncut Description Section */}
          <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-muted/15 space-y-2 shadow-xs">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Ticket Details & Description
            </h3>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {task.description || (
                <span className="text-muted-foreground italic">No detailed description provided.</span>
              )}
            </div>
          </div>

          {/* People & Dates Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Assigned To */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 shadow-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[11px]">
                Assigned Developer
              </span>
              {task.assignees?.length > 0 ? (
                <div className="flex items-center gap-2.5">
                  <Avatar
                    src={task.assignees[0].avatar}
                    name={task.assignees[0].name}
                    size={28}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {task.assignees[0].name}
                    </p>
                    <p className="text-muted-foreground truncate">{task.assignees[0].email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic">Unassigned</p>
              )}
            </div>

            {/* Created By (Who Assigned) */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 shadow-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[11px]">
                Assigned By (Project Manager)
              </span>
              {task.createdBy ? (
                <div className="flex items-center gap-2.5">
                  <Avatar
                    src={task.createdBy.avatar}
                    name={task.createdBy.name}
                    size={28}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{task.createdBy.name}</p>
                    <p className="text-muted-foreground truncate">Project Creator</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic">Unknown</p>
              )}
            </div>

            {/* Due Date */}
            {task.dueDate && (
              <div className="p-3 rounded-xl border border-border/80 bg-card flex items-center gap-2.5 text-muted-foreground sm:col-span-2 shadow-xs">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Due Date: <strong className="text-foreground">{formatDate(task.dueDate)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Enterprise SLA Audit & Compliance Panel */}
          <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" /> Enterprise SLA & Compliance Audit
              </h3>
              {task.slaStatus && (
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded border',
                    task.slaStatus.state === 'breached' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                    task.slaStatus.state === 'at_risk' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                    task.slaStatus.state === 'fulfilled' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                    task.slaStatus.state === 'healthy' && 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                  )}
                >
                  {task.slaStatus.label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Response SLA */}
              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  1. Response SLA (Time to In Progress)
                </span>
                <p className="text-foreground font-medium">
                  {task.startedAt ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Started {formatRelativeTime(task.startedAt)}
                    </span>
                  ) : task.sla?.responseDeadline ? (
                    new Date() > new Date(task.sla.responseDeadline) ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Response Breached (Overdue)
                      </span>
                    ) : (
                      <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Due by {formatDate(task.sla.responseDeadline)}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">Within standard SLA window</span>
                  )}
                </p>
              </div>

              {/* Resolution SLA */}
              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  2. Resolution SLA (Time to PM Done)
                </span>
                <p className="text-foreground font-medium">
                  {task.column === 'done' ? (
                    task.sla?.resolutionBreached ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Closed Post-Breach
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved within SLA
                      </span>
                    )
                  ) : task.sla?.resolutionDeadline ? (
                    new Date() > new Date(task.sla.resolutionDeadline) ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> SLA Breached
                      </span>
                    ) : (
                      <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Due by {formatDate(task.sla.resolutionDeadline)}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">Active in lifecycle</span>
                  )}
                </p>
              </div>
            </div>

            {/* Hierarchy Compliance Notice */}
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                <strong>SOC-2 SDLC Rule:</strong> Only the Project Manager can sign off and close open tickets into Done after reviewing submitted work.
              </span>
            </div>
          </div>

          {/* Manager Review Status Card (if present) */}
          {task.managerReview?.status === 'approved' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Approved & Signed Off by Project Manager</span>
              </div>
              {task.managerReview.feedback && (
                <p className="text-foreground/90 pl-6 italic">
                  &ldquo;{task.managerReview.feedback}&rdquo;
                </p>
              )}
            </div>
          )}

          {task.managerReview?.status === 'rejected' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400">
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Revisions Requested by Project Manager</span>
              </div>
              {task.managerReview.feedback && (
                <p className="text-foreground/90 pl-6 italic">
                  &ldquo;{task.managerReview.feedback}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Developer Resolution Notes (if submitted) */}
          {task.resolutionNotes && (
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs space-y-1.5">
              <span className="font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Developer Submission Notes & Feedback:
              </span>
              <p className="text-foreground whitespace-pre-wrap pl-5 text-xs sm:text-sm">
                {task.resolutionNotes}
              </p>
            </div>
          )}

          {/* Activity / Notes Thread */}
          <div className="space-y-3 pt-2 border-t border-border/70">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Ticket Activity & Team Notes
            </h3>

            {activityNotes.length > 0 ? (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {activityNotes.map((act: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border/70 bg-card/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {act.authorName || act.author?.name || 'Team Member'}
                        {act.role && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                            ({ROLE_LABELS[act.role] || act.role})
                          </span>
                        )}
                      </span>
                      <span className="text-[10px]">{formatRelativeTime(act.createdAt)}</span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{act.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No notes recorded yet.</p>
            )}

            {/* Quick Comment Form */}
            <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Post a note, QA test result, or question on this ticket..."
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="sm" loading={loading} disabled={!newComment.trim()}>
                <Send className="w-3.5 h-3.5 mr-1" /> Post Note
              </Button>
            </form>
          </div>

          {/* SECTION: Developer Action Area (Submit Work / Feedback) */}
          {canWorkOnTask && task.column !== 'done' && (
            <div className="p-4 sm:p-5 rounded-md border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> Work & Submit for PM Review
                </h3>
                {isUnassigned && (
                  <Button size="sm" variant="outline" onClick={handleClaimTask} loading={loading}>
                    <User className="w-3.5 h-3.5 mr-1" /> Claim Ticket (Assign to Me)
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Document what was implemented or tested before submitting for Project Manager sign-off.
              </p>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                placeholder="e.g., Implemented responsive navigation bar, fixed toggle button alignment, and tested across mobile viewports..."
                className="w-full rounded-md border border-input bg-background p-3 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(task.column === 'todo' || task.column === 'backlog') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={loading}
                    onClick={handleStartProgress}
                  >
                    Start Work (Move to In Progress)
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  loading={loading}
                  onClick={handleSubmitResolution}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Work to PM (For Review)
                </Button>
              </div>
            </div>
          )}

          {/* SECTION: Project Manager Sign-Off & Routing Area */}
          {isPM && task.column !== 'done' && (
            <div className="p-4 sm:p-5 rounded-md border border-border bg-card space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Project Manager Decision & Routing
              </h3>
              <p className="text-xs text-muted-foreground">
                Review the developer&apos;s submitted work. Sign off to mark completed, or request revisions and route back with notes.
              </p>

              {showRejectInput && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    What changes are required? (Sent to developer)
                  </label>
                  <textarea
                    value={pmFeedback}
                    onChange={(e) => setPmFeedback(e.target.value)}
                    rows={2}
                    placeholder="e.g., Please fix the button padding on mobile screens and handle the empty state..."
                    className="w-full rounded-md border border-rose-300 dark:border-rose-900 bg-background p-2.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  loading={loading}
                  onClick={() => handleManagerReview('approved')}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve & Close Ticket (Done)
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                  loading={loading}
                  onClick={() => handleManagerReview('rejected')}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {showRejectInput ? 'Confirm & Route Back to Developer' : 'Request Changes & Route Back'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with primary action shortcuts */}
        <div className="p-3 sm:p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {canWorkOnTask && (task.column === 'todo' || task.column === 'backlog') && (
              <Button type="button" variant="outline" size="sm" onClick={handleStartProgress} loading={loading}>
                Start Work
              </Button>
            )}
            {canWorkOnTask && task.column !== 'done' && task.column !== 'review' && (
              <Button type="button" size="sm" onClick={handleSubmitResolution} loading={loading}>
                Send to Review
              </Button>
            )}
            {isPM && task.column === 'review' && (
              <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleManagerReview('approved')} loading={loading}>
                Approve (Done)
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

