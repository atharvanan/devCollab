'use client';
import { useState } from 'react';
import { useMutation } from 'react-query';
import { X, ShieldAlert, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { DOMAINS, ROLE_LABELS } from '@/lib/utils';

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'css', 'html', 'sql', 'yaml', 'dockerfile'];

const ROLE_ALLOWED_DOMAINS: Record<string, string[]> = {
  frontend_developer: ['frontend'],
  ui_ux_designer: ['frontend'],
  backend_developer: ['backend'],
  db_developer: ['database'],
  devops: ['devops_cloud'],
  cloud_admin: ['devops_cloud'],
  qa_tester: ['qa'],
  security_engineer: ['security', 'devops_cloud'],
  project_manager: ['*'],
  admin: ['*'],
  contributor: ['*'],
};

export function NewReviewModal({
  projectId,
  userRole,
  isPM,
  onClose,
  onCreated,
}: {
  projectId: string;
  userRole?: string;
  isPM?: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [domain, setDomain] = useState<string>('frontend');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const allowedList = userRole ? ROLE_ALLOWED_DOMAINS[userRole] || [] : ['*'];
  const hasAccess = isPM || allowedList.includes('*') || allowedList.includes(domain);

  const createMutation = useMutation(
    async () => {
      setError('');
      await apiClient.post('/reviews', {
        projectId,
        title: title.trim(),
        description: description.trim(),
        code: code.trim(),
        language,
        domain,
      });
    },
    {
      onSuccess: () => {
        toast.success(`Code review "${title}" created successfully!`);
        onCreated();
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to create code review. Please try again.';
        setError(msg);
        toast.error(msg);
      },
    }
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">New Code Review</h2>
              {userRole && (
                <p className="text-xs text-muted-foreground">
                  Your Role: <span className="font-semibold text-foreground">{ROLE_LABELS[userRole] || userRole}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Input
          placeholder="e.g. Refactor API route handlers & middleware"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <textarea
          placeholder="Context, goals, or specific questions for reviewers (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">Code Domain *</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(DOMAINS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring capitalize"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Role Boundary Security Warning */}
        {!hasAccess && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Role Boundary Restriction Active</p>
              <p className="mt-0.5 text-rose-600 dark:text-rose-400">
                As a <strong>{ROLE_LABELS[userRole || ''] || userRole}</strong>, you are strictly binded from modifying{' '}
                <strong>{DOMAINS[domain] || domain}</strong> resources. Submitting this code will be blocked by the server
                and automatically flagged to your Project Manager.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Source Code</label>
          <textarea
            placeholder="Paste or write your source code snippet here..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-input bg-[#1e1e2e] text-[#cdd6f4] px-3 py-2 text-xs sm:text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {error && <p className="text-sm text-destructive font-medium">{error}</p>}

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
