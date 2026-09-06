'use client';
import { useState } from 'react';
import { useMutation } from 'react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'css', 'html'];

export function NewReviewModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');

  const createMutation = useMutation(async () => {
    await apiClient.post('/reviews', { projectId, title, description, code, language });
  }, { onSuccess: onCreated });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">New Code Review</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <Input placeholder="Review title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        <textarea
          placeholder="Paste your code here..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={12}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <Button
          className="w-full"
          disabled={!title.trim() || !code.trim()}
          loading={createMutation.isLoading}
          onClick={() => createMutation.mutate()}
        >
          Create Review
        </Button>
      </div>
    </div>
  );
}
