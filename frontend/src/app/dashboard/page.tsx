'use client';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { Plus, FolderKanban, GitPullRequest, Bell } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { useAppSelector } from '@/hooks/useRedux';
import { formatRelativeTime } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAppSelector((s) => s.auth);
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount);

  const { data: projectsData } = useQuery('recent-projects', async () => {
    const res = await apiClient.get('/projects?limit=4');
    return res.data.data;
  });

  const { data: openReviewsData } = useQuery('open-reviews-count', async () => {
    const res = await apiClient.get('/reviews?status=open&limit=1');
    return res.data.data.total as number;
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
            <p className="text-muted-foreground text-sm mt-1">Here&apos;s what&apos;s happening across your projects.</p>
          </div>
          <Link href="/projects/new">
            <Button><Plus className="w-4 h-4" /> New Project</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectsData?.pagination?.total ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Active Projects</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <GitPullRequest className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openReviewsData ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Open Reviews</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Unread Notifications</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Recent Projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {projectsData?.projects?.map((p: any) => (
              <Link key={p._id} href={`/projects/${p._id}`}>
                <Card className="hover:border-primary/50 transition-colors h-full">
                  <CardHeader>
                    <CardTitle className="text-base truncate">{p.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{p.description || 'No description'}</p>
                    <p className="text-xs text-muted-foreground mt-3">Updated {formatRelativeTime(p.updatedAt)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {projectsData?.projects?.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
                No projects yet. Create your first project to get started.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
