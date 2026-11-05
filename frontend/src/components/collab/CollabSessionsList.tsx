'use client';
import { useState } from 'react';
import { Plus, Users, Code, Sparkles, Trash2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Avatar } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { DOMAINS, formatRelativeTime } from '@/lib/utils';

interface Props {
  projectId: string;
  sessions: any[];
  activeSessionId: string | null;
  onSelectSession: (session: any) => void;
  onSessionCreated: (session: any) => void;
  onSessionDeleted?: (sessionId: string) => void;
  isPM?: boolean;
}

export function CollabSessionsList({
  projectId,
  sessions,
  activeSessionId,
  onSelectSession,
  onSessionCreated,
  onSessionDeleted,
  isPM,
}: Props) {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [domain, setDomain] = useState('general');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Session title is required.');
      return;
    }

    setCreating(true);
    try {
      const res = await apiClient.post(`/collab/project/${projectId}`, {
        title: title.trim(),
        description: description.trim(),
        language,
        domain,
      });

      toast.success('Live coding session created!');
      onSessionCreated(res.data.data.session);
      setModalOpen(false);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create session.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await apiClient.delete(`/collab/${sessionId}`);
      toast.success('Session removed.');
      onSessionDeleted?.(sessionId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete session.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Live Pair-Coding Rooms
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time multi-cursor collaboration with automated authorship tracking.
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Code Room
        </Button>
      </div>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-md bg-card/50 space-y-3">
          <Code className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No collaborative rooms yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Launch a live coding session to pair program with team members in real time.
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Room
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sessions.map((s) => {
            const isActive = s._id === activeSessionId;
            const contributors = s.contributors || [];

            return (
              <div
                key={s._id}
                onClick={() => onSelectSession(s)}
                className={`p-4 rounded-md border text-left cursor-pointer transition-colors duration-150 flex flex-col justify-between ${
                  isActive
                    ? 'border-primary bg-accent/30 shadow-xs'
                    : 'border-border bg-card hover:border-foreground/30 hover:bg-accent/10'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">{s.title}</h3>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0 rounded-sm">
                      {s.language}
                    </Badge>
                  </div>

                  {s.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                  )}

                  {/* Domain Badge */}
                  <div className="pt-0.5">
                    <span className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-secondary text-secondary-foreground font-mono">
                      {DOMAINS[s.domain] || s.domain}
                    </span>
                  </div>
                </div>

                {/* Bottom Card Footer: Contributors & Join Action */}
                <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                    {contributors.slice(0, 4).map((c: any, idx: number) => (
                      <Avatar key={idx} src={c.avatar} name={c.name} size={20} />
                    ))}
                    {contributors.length > 4 && (
                      <span className="text-[10px] font-semibold text-muted-foreground pl-2 font-mono">
                        +{contributors.length - 4}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isPM && sessions.length > 1 && (
                      <button
                        onClick={(e) => handleDelete(e, s._id)}
                        className="p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-xs font-semibold text-primary inline-flex items-center gap-1">
                      {isActive ? 'Active Now' : 'Open'} <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create New Session Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Create Live Code Room</h3>
              <p className="text-xs text-muted-foreground">
                Start a shared coding room where team members can pair program concurrently.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Room Name</label>
                <Input
                  placeholder="e.g. Auth Refactoring, Billing Service"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-md"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <Input
                  placeholder="Briefly describe what you are building"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="json">JSON</option>
                    <option value="sql">SQL</option>
                    <option value="go">Go</option>
                    <option value="rust">Rust</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Target Domain</label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="general">General</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="database">Database</option>
                    <option value="devops_cloud">DevOps / Cloud</option>
                    <option value="qa">QA</option>
                    <option value="security">Security</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={creating}>
                  Launch Room
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

