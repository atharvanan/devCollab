'use client';
import { useState } from 'react';
import { useMutation } from 'react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch } from '@/hooks/useRedux';
import { boardActions } from '@/store/slices/boardSlice';
import { useToast } from '@/components/ui/Toast';

interface Props {
  projectId: string;
  column: string;
  onClose: () => void;
}

export function TaskModal({ projectId, column, onClose }: Props) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation(
    async () => {
      setError('');
      const res = await apiClient.post(`/board/${projectId}/tasks`, {
        title: title.trim(),
        description: description.trim(),
        priority,
        column,
        ...(dueDate && { dueDate }),
      });
      return res.data.data.task;
    },
    {
      onSuccess: (task) => {
        dispatch(boardActions.addTask(task));
        toast.success(`Task "${task.title}" created successfully!`);
        onClose();
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to create task. Please try again.';
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
        className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-foreground">New Task</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Input
          placeholder="e.g. Implement user authentication middleware"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <textarea
          placeholder="Detailed requirements or acceptance criteria (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">Priority</label>
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
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">Due date</label>
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
          Create Task
        </Button>
      </div>
    </div>
  );
}
