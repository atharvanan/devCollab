'use client';
import { useEffect } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { GitPullRequest, ArrowRight, FolderKanban } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { formatRelativeTime } from '@/lib/utils';

export default function ReviewsOverviewPage() {
  useEffect(() => {
    document.title = 'Code Reviews | DevCollab';
  }, []);

  const { data: projectsData, isLoading } = useQuery('all-projects-for-reviews', async () => {
    const res = await apiClient.get('/projects?limit=50');
    return res.data.data.projects;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Code Reviews</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select a project below to inspect and collaborate on code reviews.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-xs p-5 space-y-3 animate-pulse">
                <div className="h-5 bg-muted rounded-xs w-2/3" />
                <div className="h-4 bg-muted/60 rounded-xs w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsData?.map((p: any) => (
              <Link key={p._id} href={`/projects/${p._id}`} className="group">
                <Card className="p-5 hover:border-primary/50 transition-all h-full flex flex-col justify-between group-hover:shadow-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-xs bg-primary/10 flex items-center justify-center shrink-0">
                        <GitPullRequest className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {p.description || 'No description provided'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Updated {formatRelativeTime(p.updatedAt)}</span>
                    <span className="text-primary font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Reviews <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}

            {(!projectsData || projectsData.length === 0) && (
              <div className="col-span-full border border-dashed border-border rounded-xs p-12 text-center space-y-3">
                <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-base font-medium">No projects available</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Create a project first to start conducting and managing code reviews.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
