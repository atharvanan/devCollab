'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useParams } from 'next/navigation';
import { Lock, Globe, Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { ReviewList } from '@/components/reviews/ReviewList';
import { cn } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'board' | 'reviews' | 'members'>('board');

  const { data } = useQuery(['project', id], async () => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data.data.project;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{data?.name}</h1>
              {data?.visibility === 'private' ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Globe className="w-4 h-4 text-muted-foreground" />}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{data?.description}</p>
          </div>
        </div>

        <div className="border-b border-border flex gap-6">
          {(['board', 'reviews', 'members'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'pb-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'board' && <KanbanBoard projectId={id} />}
        {tab === 'reviews' && <ReviewList projectId={id} />}
        {tab === 'members' && (
          <div className="space-y-2">
            {data?.members?.map((m: any) => (
              <div key={m.user._id} className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium">{m.user.name}</p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
