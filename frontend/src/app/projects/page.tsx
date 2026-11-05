'use client';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { Plus, Search, Lock, Globe, FolderKanban, ShieldCheck, Crown } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { formatRelativeTime } from '@/lib/utils';
import { useAppSelector } from '@/hooks/useRedux';

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_hold' | 'completed' | 'archived'>('all');
  const { user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    document.title = 'Projects | DevCollab';
  }, []);

  const { data: permissions } = useQuery('my-permissions', async () => {
    try {
      const res = await apiClient.get('/users/me/permissions');
      return res.data.data;
    } catch {
      return null;
    }
  });

  const canCreate = Boolean(
    permissions?.canCreateProjects ||
    user?.role === 'admin' ||
    (user as any)?.canCreateProjects
  );

  const { data, isLoading } = useQuery(['projects', search], async () => {
    const res = await apiClient.get(`/projects?${search ? `search=${encodeURIComponent(search)}` : ''}`);
    return res.data.data;
  });

  const filteredProjects = data?.projects?.filter((p: any) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return !p.status || p.status === 'active';
    return p.status === statusFilter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your engineering workspaces, role assignments, and governance.
            </p>
          </div>
          {canCreate ? (
            <Link href="/projects/new" className="shrink-0">
              <Button className="w-full sm:w-auto shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" /> New Project
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-lg bg-secondary/80 text-muted-foreground border border-border flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/80" /> Member Account
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search projects by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'active', 'on_hold', 'completed', 'archived'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-xl p-5 space-y-3 animate-pulse">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted/60 rounded w-full" />
                <div className="h-4 bg-muted/40 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects?.map((p: any) => (
              <Link key={p._id} href={`/projects/${p._id}`} className="group">
                <Card className="hover:border-primary/50 transition-all h-full flex flex-col justify-between group-hover:shadow-sm">
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                            {p.name}
                          </CardTitle>
                          {p.status === 'completed' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                              Completed
                            </span>
                          )}
                          {p.status === 'on_hold' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              On Hold
                            </span>
                          )}
                          {p.status === 'archived' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20 shrink-0">
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                      {p.visibility === 'private' ? (
                        <span title="Private project" className="shrink-0">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </span>
                      ) : (
                        <span title="Public project" className="shrink-0">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-between space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                      {p.description || 'No description provided'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.tags?.slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                      <span className="flex items-center gap-1 font-medium text-foreground/80 truncate">
                        <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">{p.owner?.name ? p.owner.name.split(' ')[0] : 'Owner'}</span>
                      </span>
                      <span className="shrink-0">Updated {formatRelativeTime(p.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {(!filteredProjects || filteredProjects.length === 0) && (
              <div className="col-span-full border border-dashed border-border rounded-xl p-12 text-center space-y-3">
                <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-base font-medium">No projects found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {search ? `No projects match "${search}". Try searching with a different term.` : 'No active projects available in this view.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
