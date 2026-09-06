'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { formatRelativeTime } from '@/lib/utils';

interface Props {
  reviewId: string;
  lineNumber: number;
  comments: any[];
  onClose: () => void;
}

export function CommentThread({ reviewId, lineNumber, comments, onClose }: Props) {
  const [content, setContent] = useState('');
  const qc = useQueryClient();

  const addComment = useMutation(async () => {
    await apiClient.post(`/reviews/${reviewId}/comments/inline`, { lineNumber, content });
  }, {
    onSuccess: () => {
      setContent('');
      qc.invalidateQueries(['review', reviewId]);
    },
  });

  const resolveComment = useMutation(async (commentId: string) => {
    await apiClient.patch(`/reviews/${reviewId}/comments/inline/${commentId}/resolve`);
  }, { onSuccess: () => qc.invalidateQueries(['review', reviewId]) });

  return (
    <div className="border border-border rounded-lg sticky top-4">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <p className="text-sm font-medium">Line {lineNumber}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="max-h-80 overflow-y-auto p-3 space-y-3">
        {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Be the first to leave one.</p>}
        {comments.map((c: any) => (
          <div key={c._id} className="flex gap-2">
            <Avatar src={c.author?.avatar} name={c.author?.name} size={24} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium">{c.author?.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatRelativeTime(c.createdAt)}</p>
              </div>
              <p className="text-sm mt-0.5">{c.content}</p>
              {!c.resolved && (
                <button
                  onClick={() => resolveComment.mutate(c._id)}
                  className="text-[11px] text-primary flex items-center gap-1 mt-1 hover:underline"
                >
                  <Check className="w-3 h-3" /> Resolve
                </button>
              )}
              {c.resolved && <span className="text-[11px] text-green-600 flex items-center gap-1 mt-1"><Check className="w-3 h-3" /> Resolved</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Leave a comment..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={!content.trim()}
          loading={addComment.isLoading}
          onClick={() => addComment.mutate()}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}
