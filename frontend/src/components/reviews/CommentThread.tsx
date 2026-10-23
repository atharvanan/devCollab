'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { formatRelativeTime } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface Props {
  reviewId: string;
  lineNumber: number;
  comments: any[];
  onClose: () => void;
}

export function CommentThread({ reviewId, lineNumber, comments, onClose }: Props) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();

  const addComment = useMutation(
    async () => {
      setError('');
      await apiClient.post(`/reviews/${reviewId}/comments/inline`, {
        lineNumber,
        content: content.trim(),
      });
    },
    {
      onSuccess: () => {
        setContent('');
        qc.invalidateQueries(['review', reviewId]);
        toast.success(`Comment on line ${lineNumber} added!`);
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to submit comment. Please try again.';
        setError(msg);
        toast.error(msg);
      },
    }
  );

  const resolveComment = useMutation(
    async (commentId: string) => {
      await apiClient.patch(`/reviews/${reviewId}/comments/inline/${commentId}/resolve`);
    },
    {
      onSuccess: () => {
        qc.invalidateQueries(['review', reviewId]);
        toast.success('Comment marked as resolved.');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Failed to resolve comment.');
      },
    }
  );

  return (
    <div className="border border-border rounded-xl sticky top-4 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-3.5 border-b border-border bg-card/60">
        <p className="text-sm font-semibold text-foreground">Discussion · Line {lineNumber}</p>
        <button
          onClick={onClose}
          aria-label="Close thread"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-3.5 space-y-3.5">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No comments yet on line {lineNumber}. Start the discussion below.
          </p>
        )}
        {comments.map((c: any) => (
          <div key={c._id} className="flex gap-2.5">
            <Avatar src={c.author?.avatar} name={c.author?.name} size={28} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-foreground">{c.author?.name || 'Reviewer'}</p>
                <span className="text-[10px] text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
              </div>
              <p className="text-xs sm:text-sm mt-1 text-foreground/90 break-words leading-relaxed">
                {c.content}
              </p>
              {!c.resolved ? (
                <button
                  onClick={() => resolveComment.mutate(c._id)}
                  disabled={resolveComment.isLoading}
                  className="text-[11px] text-primary flex items-center gap-1 mt-1.5 hover:underline font-medium disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Mark Resolved
                </button>
              ) : (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1.5 font-medium">
                  <Check className="w-3 h-3" /> Resolved
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3.5 border-t border-border space-y-2 bg-card/40">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write an inline comment or suggestion..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          size="sm"
          className="w-full"
          disabled={!content.trim()}
          loading={addComment.isLoading}
          onClick={() => addComment.mutate()}
        >
          Post Comment
        </Button>
      </div>
    </div>
  );
}
