'use client';
import { useEffect } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { Plus, FolderKanban, GitPullRequest, Bell, ArrowRight, Code2, Sparkles, Terminal } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { useAppSelector } from '@/hooks/useRedux';
import { formatRelativeTime } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAppSelector((s) => s.auth);
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount);

  useEffect(() => {
    document.title = 'Dashboard | DevCollab';
  }, []);

  const { data: projectsData, isLoading: loadingProjects } = useQuery('recent-projects', async () => {
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
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {user?.name?.split(' ')[0] || 'Developer'} 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Here&apos;s what&apos;s happening across your projects and code reviews.
            </p>
          </div>
          <Link href="/projects/new" className="shrink-0">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </Link>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:border-primary/40 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FolderKanban className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {projectsData?.pagination?.total ?? (loadingProjects ? '...' : 0)}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Active Projects</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-emerald-500/40 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <GitPullRequest className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {openReviewsData ?? 0}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Open Reviews</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-sky-500/40 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                <Code2 className="w-6 h-6 text-sky-500" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-2xl font-bold tracking-tight">Live</p>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-live" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Pair-Coding Rooms</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-amber-500/40 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{unreadCount ?? 0}</p>
                <p className="text-xs font-medium text-muted-foreground">Unread Alerts</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Recent Projects</h2>
            <Link
              href="/projects"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {projectsData?.projects?.map((p: any) => (
              <Link key={p._id} href={`/projects/${p._id}`} className="group">
                <Card className="hover:border-primary/50 transition-all h-full flex flex-col justify-between group-hover:shadow-sm">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-between">
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                      {p.description || 'No description provided'}
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-4 pt-3 border-t border-border/50">
                      Updated {formatRelativeTime(p.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {projectsData?.projects?.length === 0 && !loadingProjects && (
              <div className="col-span-full border border-dashed border-border rounded-xl p-8 text-center space-y-3">
                <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Create your first collaborative software project with a Kanban board and code review system.
                </p>
                <Link href="/projects/new" className="inline-block pt-1">
                  <Button size="sm">
                    <Plus className="w-4 h-4" /> Create Project
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
