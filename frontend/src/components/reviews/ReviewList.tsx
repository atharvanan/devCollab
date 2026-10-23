'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { Plus, GitPullRequest } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, Badge } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { STATUS_COLORS, formatRelativeTime } from '@/lib/utils';
import { NewReviewModal } from './NewReviewModal';

export function ReviewList({ projectId }: { projectId: string }) {
  const [showModal, setShowModal] = useState(false);

  const { data, refetch, isLoading } = useQuery(['reviews', projectId], async () => {
    const res = await apiClient.get(`/reviews?projectId=${projectId}`);
    return res.data.data.reviews;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {data?.length || 0} {data?.length === 1 ? 'review' : 'reviews'} in this project
        </p>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> New Review
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted/60 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {data?.map((r: any) => (
            <Link key={r._id} href={`/reviews/${r._id}`} className="block group">
              <Card className="p-4 hover:border-primary/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group-hover:shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {r.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    by <span className="text-foreground/90 font-medium">{r.author?.name || 'Developer'}</span> · {formatRelativeTime(r.createdAt)}
                  </p>
                </div>
                <div className="shrink-0">
                  <Badge className={STATUS_COLORS[r.status]}>
                    {r.status.replace('_', ' ')}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}

          {data?.length === 0 && (
            <div className="border border-dashed border-border rounded-xl p-10 text-center space-y-3">
              <GitPullRequest className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">No code reviews yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Submit a code snippet or pull request to get peer feedback from team members.
              </p>
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4" /> Create First Review
              </Button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <NewReviewModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
