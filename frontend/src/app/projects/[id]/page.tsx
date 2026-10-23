'use client';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Globe, ArrowLeft, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiClient } from '@/lib/apiClient';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { ReviewList } from '@/components/reviews/ReviewList';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Card';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'board' | 'reviews' | 'members'>('board');

  const { data, isLoading } = useQuery(['project', id], async () => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data.data.project;
  });

  useEffect(() => {
    if (data?.name) {
      document.title = `${data.name} | DevCollab`;
    }
  }, [data?.name]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted/60 rounded w-1/2" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Projects
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{data?.name}</h1>
                {data?.visibility === 'private' ? (
                  <span title="Private project">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </span>
                ) : (
                  <span title="Public project">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {data?.description || 'No description provided'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation - horizontally scrollable on mobile */}
        <div className="border-b border-border flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
          {(['board', 'reviews', 'members'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'pb-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === t
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'board' ? 'Kanban Board' : t === 'reviews' ? 'Code Reviews' : 'Team Members'}
            </button>
          ))}
        </div>

        {tab === 'board' && <KanbanBoard projectId={id} />}
        {tab === 'reviews' && <ReviewList projectId={id} />}
        {tab === 'members' && (
          <div className="space-y-3 max-w-xl">
            {data?.members?.map((m: any) => (
              <div
                key={m.user._id}
                className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={m.user.avatar} name={m.user.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.user.name}</p>
                    {/* Clickable email */}
                    <a
                      href={`mailto:${m.user.email}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors truncate block"
                      title={`Email ${m.user.email}`}
                    >
                      {m.user.email}
                    </a>
                  </div>
                </div>
                <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                  {m.role}
                </span>
              </div>
            ))}

            {(!data?.members || data.members.length === 0) && (
              <div className="border border-dashed border-border rounded-xl p-8 text-center space-y-2">
                <Users className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">No other members</p>
                <p className="text-xs text-muted-foreground">Only you currently have access to this project.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
