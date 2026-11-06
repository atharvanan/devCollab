'use client';
import { useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { X, UserCheck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch } from '@/hooks/useRedux';
import { boardActions } from '@/store/slices/boardSlice';
import { useToast } from '@/components/ui/Toast';
import { ROLE_OPTIONS, ROLE_LABELS } from '@/lib/utils';

interface Props {
  projectId: string;
  column: string;
  projectMembers?: any[];
  isPM?: boolean;
  onClose: () => void;
}

export function TaskModal({
  projectId,
  column,
  projectMembers = [],
  isPM,
  onClose,
}: Props) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [targetRole, setTargetRole] = useState('any');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const { data: fallbackProject } = useQuery(
    ['project', projectId],
    async () => {
      const res = await apiClient.get(`/projects/${projectId}`);
      return res.data.data.project;
    },
    { enabled: (!projectMembers || projectMembers.length === 0) && !!projectId }
  );

  const activeMembers = (projectMembers && projectMembers.length > 0)
    ? projectMembers
    : (fallbackProject?.members || []);

  // Filter members matching selected targetRole
  const matchingMembers = activeMembers.filter((m: any) => {
    if (targetRole === 'any') return true;
    return m.role === targetRole;
  });

  const otherMembers = activeMembers.filter((m: any) => {
    if (targetRole === 'any') return false;
    return m.role !== targetRole;
  });

  const createMutation = useMutation(
    async () => {
      setError('');
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        priority,
        column,
        targetRole,
        assignees: assigneeId ? [assigneeId] : [],
        ...(dueDate && { dueDate }),
      };
      const res = await apiClient.post(`/board/${projectId}/tasks`, payload);
      return res.data.data.task;
    },
    {
      onSuccess: (task) => {
        dispatch(boardActions.addTask(task));
        toast.success(`Task "${task.title}" assigned successfully!`);
        onClose();
      },
      onError: (err: any) => {
        const msg =
          err.response?.data?.message || 'Failed to create task. Please try again.';
        setError(msg);
        toast.error(msg);
      },
    }
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl w-full max-w-lg p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg text-foreground">
              {isPM ? 'Assign New Ticket / Task' : 'New Task'}
            </h2>
            {isPM && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign work to team members binded to their engineering role.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Task Title *</label>
          <Input
            placeholder="e.g. Build authentication screens & implement JWT session refresh"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Work Requirements & Acceptance Criteria
          </label>
          <textarea
            placeholder="Detailed instructions for the assigned engineer..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Role & Assignee Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
              <Shield className="w-3.5 h-3.5 text-primary" /> Target Role
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="any">Any Role (Open)</option>
              {ROLE_OPTIONS.filter((r) => r.value !== 'contributor' && r.value !== 'viewer').map(
                (r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
              <UserCheck className="w-3.5 h-3.5 text-primary" /> Assign To Member
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Unassigned</option>
              {matchingMembers.length > 0 && (
                <optgroup label={targetRole === 'any' ? 'Project Members' : `${ROLE_LABELS[targetRole] || targetRole} Team`}>
                  {matchingMembers.map((m: any) => (
                    <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                      {m.user?.name || 'Member'} ({ROLE_LABELS[m.role] || m.role})
                    </option>
                  ))}
                </optgroup>
              )}
              {otherMembers.length > 0 && (
                <optgroup label="Other Project Members">
                  {otherMembers.map((m: any) => (
                    <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                      {m.user?.name || 'Member'} ({ROLE_LABELS[m.role] || m.role})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Priority & Due Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive font-medium">{error}</p>}

        <Button
          className="w-full"
          disabled={!title.trim()}
          loading={createMutation.isLoading}
          onClick={() => createMutation.mutate()}
        >
          {isPM ? 'Assign Ticket' : 'Create Task'}
        </Button>
      </div>
    </div>
  );
}
