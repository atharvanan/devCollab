'use client';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, Badge } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { STATUS_COLORS, formatRelativeTime } from '@/lib/utils';

export default function ReviewsOverviewPage() {
  const { data: projectsData } = useQuery('all-projects-for-reviews', async () => {
    const res = await apiClient.get('/projects?limit=50');
    return res.data.data.projects;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">All Reviews</h1>
        <p className="text-sm text-muted-foreground">Select a project to view its code reviews.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectsData?.map((p: any) => (
            <Link key={p._id} href={`/projects/${p._id}`}>
              <Card className="p-4 hover:border-primary/40 transition-colors">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Updated {formatRelativeTime(p.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
