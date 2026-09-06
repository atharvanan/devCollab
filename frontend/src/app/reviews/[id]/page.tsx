'use client';
import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiClient } from '@/lib/apiClient';
import { useJoinRoom, useSocket, useSocketEmit } from '@/hooks/useSocket';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { STATUS_COLORS } from '@/lib/utils';
import { CodeViewer } from '@/components/reviews/CodeViewer';
import { CommentThread } from '@/components/reviews/CommentThread';

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const emit = useSocketEmit();
  const [activeLine, setActiveLine] = useState<number | null>(null);

  useJoinRoom(`review:${id}`);

  const { data: review } = useQuery(['review', id], async () => {
    const res = await apiClient.get(`/reviews/${id}`);
    return res.data.data.review;
  });

  useSocket('comment:added', useCallback((payload: any) => {
    if (payload.reviewId === id) qc.invalidateQueries(['review', id]);
  }, [id, qc]));

  useSocket('comment:resolved', useCallback(() => {
    qc.invalidateQueries(['review', id]);
  }, [id, qc]));

  useSocket('review:statusChanged', useCallback(() => {
    qc.invalidateQueries(['review', id]);
  }, [id, qc]));

  const statusMutation = useMutation(async (status: string) => {
    await apiClient.patch(`/reviews/${id}/status`, { status });
  });

  if (!review) return <DashboardLayout><p className="text-sm text-muted-foreground">Loading review...</p></DashboardLayout>;

  const commentsForLine = (line: number) => review.inlineComments.filter((c: any) => c.lineNumber === line);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{review.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{review.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[review.status]}>{review.status.replace('_', ' ')}</Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('approved')}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('changes_requested')}>Request Changes</Button>
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('closed')}>Close</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <CodeViewer
              code={review.code}
              language={review.language}
              activeLine={activeLine}
              setActiveLine={setActiveLine}
              commentsForLine={commentsForLine}
            />
          </div>
          <div>
            {activeLine !== null ? (
              <CommentThread
                reviewId={id}
                lineNumber={activeLine}
                comments={commentsForLine(activeLine)}
                onClose={() => setActiveLine(null)}
              />
            ) : (
              <p className="text-sm text-muted-foreground p-4">Click a line number to leave a comment.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
