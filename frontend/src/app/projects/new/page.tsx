'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/projects', {
        name, description, visibility,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      router.push(`/projects/${res.data.data.project._id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Create New Project</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Project name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="My Awesome Project" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this project about?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags (comma separated)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, node, mongodb" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Visibility</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setVisibility('private')}
                className={`flex-1 py-2 rounded-md text-sm border ${visibility === 'private' ? 'border-primary bg-primary/10 text-primary' : 'border-input'}`}>
                Private
              </button>
              <button type="button" onClick={() => setVisibility('public')}
                className={`flex-1 py-2 rounded-md text-sm border ${visibility === 'public' ? 'border-primary bg-primary/10 text-primary' : 'border-input'}`}>
                Public
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" loading={loading}>Create Project</Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
