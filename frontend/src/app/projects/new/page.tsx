'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';

export default function NewProjectPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Create Project | DevCollab';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/projects', {
        name,
        description,
        visibility,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Project created successfully!');
      router.push(`/projects/${res.data.data.project._id}`);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to create project. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Projects
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set up a project to organize Kanban tasks and peer code reviews.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Project name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Distributed Task Engine"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Summary of project architecture and roadmap..."
              className="w-full rounded-xs border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags (comma separated)</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. typescript, nextjs, api"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex-1 py-2 rounded-xs text-xs font-semibold border transition-colors ${
                  visibility === 'private'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input hover:bg-accent text-muted-foreground'
                }`}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex-1 py-2 rounded-xs text-xs font-semibold border transition-colors ${
                  visibility === 'public'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input hover:bg-accent text-muted-foreground'
                }`}
              >
                Public
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive font-medium">{error}</p>}

          <Button type="submit" className="w-full" loading={loading}>
            Create Project
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
