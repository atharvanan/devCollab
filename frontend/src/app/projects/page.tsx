'use client';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { Plus, Search, Lock, Globe, FolderKanban } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { formatRelativeTime } from '@/lib/utils';

export default function ProjectsPage() {
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = 'Projects | DevCollab';
  }, []);

  const { data, isLoading } = useQuery(['projects', search], async () => {
    const res = await apiClient.get(`/projects?${search ? `search=${encodeURIComponent(search)}` : ''}`);
    return res.data.data;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your repositories, team members, and task boards.
            </p>
          </div>
          <Link href="/projects/new" className="shrink-0">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </Link>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search projects by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
            {data?.projects?.map((p: any) => (
              <Link key={p._id} href={`/projects/${p._id}`} className="group">
                <Card className="hover:border-primary/50 transition-all h-full flex flex-col justify-between group-hover:shadow-sm">
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </CardTitle>
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
                    <p className="text-xs text-muted-foreground/80 pt-3 border-t border-border/50">
                      Updated {formatRelativeTime(p.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {data?.projects?.length === 0 && (
              <div className="col-span-full border border-dashed border-border rounded-xl p-12 text-center space-y-3">
                <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-base font-medium">No projects found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {search ? `No projects match "${search}". Try searching with a different term.` : 'Create your first project to begin collaborating.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
