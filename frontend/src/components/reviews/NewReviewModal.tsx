'use client';
import { useState } from 'react';
import { useMutation } from 'react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'css', 'html'];

export function NewReviewModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const createMutation = useMutation(
    async () => {
      setError('');
      await apiClient.post('/reviews', {
        projectId,
        title: title.trim(),
        description: description.trim(),
        code: code.trim(),
        language,
      });
    },
    {
      onSuccess: () => {
        toast.success(`Code review "${title}" created successfully!`);
        onCreated();
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to create code review. Please try again.';
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
        className="bg-card border border-border rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-foreground">New Code Review</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Input
          placeholder="e.g. Refactor API route handlers & middleware"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <textarea
          placeholder="Context, goals, or specific questions for reviewers (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring capitalize"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Source Code</label>
          <textarea
            placeholder="Paste or write your source code snippet here..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-input bg-[#1e1e2e] text-[#cdd6f4] px-3 py-2 text-xs sm:text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {error && <p className="text-sm text-destructive font-medium">{error}</p>}

        <Button
          className="w-full"
          disabled={!title.trim() || !code.trim()}
          loading={createMutation.isLoading}
          onClick={() => createMutation.mutate()}
        >
          Create Review
        </Button>
      </div>
    </div>
  );
}
