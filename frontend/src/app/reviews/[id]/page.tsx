'use client';
import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiClient } from '@/lib/apiClient';
import { useJoinRoom, useSocket } from '@/hooks/useSocket';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { STATUS_COLORS, DOMAINS } from '@/lib/utils';
import { CodeViewer } from '@/components/reviews/CodeViewer';
import { CommentThread } from '@/components/reviews/CommentThread';
import { useToast } from '@/components/ui/Toast';

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useJoinRoom(`review:${id}`);

  const { data: review, isLoading } = useQuery(['review', id], async () => {
    const res = await apiClient.get(`/reviews/${id}`);
    return res.data.data.review;
  });

  useEffect(() => {
    if (review?.title) {
      document.title = `${review.title} | DevCollab`;
    }
  }, [review?.title]);

  useSocket('comment:added', useCallback((payload: any) => {
    if (payload.reviewId === id) qc.invalidateQueries(['review', id]);
  }, [id, qc]));

  useSocket('comment:resolved', useCallback(() => {
    qc.invalidateQueries(['review', id]);
  }, [id, qc]));

  useSocket('review:statusChanged', useCallback(() => {
    qc.invalidateQueries(['review', id]);
  }, [id, qc]));

  const statusMutation = useMutation(
    async (status: string) => {
      setUpdatingStatus(status);
      await apiClient.patch(`/reviews/${id}/status`, { status });
      return status;
    },
    {
      onSuccess: (status) => {
        qc.invalidateQueries(['review', id]);
        toast.success(`Review status updated to "${status.replace('_', ' ')}"!`);
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to update review status. Please try again.';
        toast.error(msg);
      },
      onSettled: () => {
        setUpdatingStatus(null);
      },
    }
  );

  if (isLoading || !review) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-40 bg-muted/40 rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  const commentsForLine = (line: number) =>
    (review.inlineComments || []).filter((c: any) => c.lineNumber === line);

  const backLink = review.project?._id
    ? `/projects/${review.project._id}`
    : typeof review.project === 'string'
    ? `/projects/${review.project}`
    : '/reviews';

  return (
    <DashboardLayout>
      <div className="space-y-5 min-w-0">
        <div>
          <Link
            href={backLink}
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Project
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">
                  {review.title}
                </h1>
                <Badge className={STATUS_COLORS[review.status]}>
                  {review.status.replace('_', ' ')}
                </Badge>
                {review.domain && review.domain !== 'general' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Domain: {DOMAINS[review.domain] || review.domain}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 break-words">
                {review.description || 'No description provided for this review.'}
              </p>
            </div>

            {/* Action buttons with feedback */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                loading={updatingStatus === 'approved'}
                disabled={statusMutation.isLoading || review.status === 'approved'}
                onClick={() => statusMutation.mutate('approved')}
                className="hover:border-green-500 hover:text-green-600 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={updatingStatus === 'changes_requested'}
                disabled={statusMutation.isLoading || review.status === 'changes_requested'}
                onClick={() => statusMutation.mutate('changes_requested')}
                className="hover:border-amber-500 hover:text-amber-600 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Request Changes
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={updatingStatus === 'closed'}
                disabled={statusMutation.isLoading || review.status === 'closed'}
                onClick={() => statusMutation.mutate('closed')}
                className="hover:border-destructive hover:text-destructive transition-colors"
              >
                <XCircle className="w-3.5 h-3.5 text-destructive" /> Close
              </Button>
            </div>
          </div>
        </div>

        {/* Code inspection and comments layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
          <div className="lg:col-span-2 min-w-0 overflow-hidden">
            <CodeViewer
              code={review.code}
              language={review.language}
              activeLine={activeLine}
              setActiveLine={setActiveLine}
              commentsForLine={commentsForLine}
            />
          </div>
          <div className="min-w-0">
            {activeLine !== null ? (
              <CommentThread
                reviewId={id}
                lineNumber={activeLine}
                comments={commentsForLine(activeLine)}
                onClose={() => setActiveLine(null)}
              />
            ) : (
              <div className="border border-border/80 rounded-xl p-6 text-center space-y-2 bg-card/60">
                <p className="text-sm font-medium text-foreground">Inline Comments</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Click any line number in the code viewer to view discussion or leave a new comment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
