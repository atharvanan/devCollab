'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { Plus, Search, Lock, Globe } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { formatRelativeTime } from '@/lib/utils';

export default function ProjectsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery(['projects', search], async () => {
    const res = await apiClient.get(`/projects?${search ? `search=${search}` : ''}`);
    return res.data.data;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Link href="/projects/new"><Button><Plus className="w-4 h-4" /> New Project</Button></Link>
        </div>

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.projects?.map((p: any) => (
              <Link key={p._id} href={`/projects/${p._id}`}>
                <Card className="hover:border-primary/50 transition-colors h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base truncate">{p.name}</CardTitle>
                      {p.visibility === 'private' ? <Lock className="w-4 h-4 text-muted-foreground shrink-0" /> : <Globe className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{p.description || 'No description'}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.tags?.slice(0, 3).map((t: string) => <Badge key={t}>{t}</Badge>)}
                    </div>
                    <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(p.updatedAt)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {data?.projects?.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full py-12 text-center">No projects found.</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
