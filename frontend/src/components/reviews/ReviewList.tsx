'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, Badge } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { STATUS_COLORS, formatRelativeTime } from '@/lib/utils';
import { NewReviewModal } from './NewReviewModal';

export function ReviewList({ projectId }: { projectId: string }) {
  const [showModal, setShowModal] = useState(false);

  const { data, refetch } = useQuery(['reviews', projectId], async () => {
    const res = await apiClient.get(`/reviews?projectId=${projectId}`);
    return res.data.data.reviews;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> New Review</Button>
      </div>

      <div className="space-y-2">
        {data?.map((r: any) => (
          <Link key={r._id} href={`/reviews/${r._id}`}>
            <Card className="p-4 hover:border-primary/40 transition-colors flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  by {r.author?.name} · {formatRelativeTime(r.createdAt)}
                </p>
              </div>
              <Badge className={STATUS_COLORS[r.status]}>{r.status.replace('_', ' ')}</Badge>
            </Card>
          </Link>
        ))}
        {data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No reviews yet.</p>}
      </div>

      {showModal && (
        <NewReviewModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); refetch(); }}
        />
      )}
    </div>
  );
}
