'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useAppDispatch } from '@/hooks/useRedux';
import { boardActions } from '@/store/slices/boardSlice';

interface Props {
  projectId: string;
  column: string;
  onClose: () => void;
}

export function TaskModal({ projectId, column, onClose }: Props) {
  const dispatch = useAppDispatch();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');

  const createMutation = useMutation(async () => {
    const res = await apiClient.post(`/board/${projectId}/tasks`, {
      title, description, priority, column,
      ...(dueDate && { dueDate }),
    });
    return res.data.data.task;
  }, {
    onSuccess: (task) => {
      dispatch(boardActions.addTask(task));
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">New Task</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <textarea
          placeholder="Description (optional)"
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
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
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
