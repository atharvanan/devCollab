'use client';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Globe,
  ArrowLeft,
  Users,
  Shield,
  ShieldAlert,
  UserPlus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Bot,
  Copy,
  Check,
  Archive,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiClient } from '@/lib/apiClient';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { ReviewList } from '@/components/reviews/ReviewList';
import { CollaborativeEditor } from '@/components/collab/CollaborativeEditor';
import { CollabSessionsList } from '@/components/collab/CollabSessionsList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, Avatar } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAppSelector } from '@/hooks/useRedux';
import { useSocket, useJoinRoom } from '@/hooks/useSocket';
import {
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_OPTIONS,
  DOMAINS,
  formatRelativeTime,
  cn,
} from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'board';
  const [tab, setTab] = useState<'board' | 'reviews' | 'collab' | 'members' | 'compliance'>(
    ['board', 'reviews', 'collab', 'members', 'compliance'].includes(initialTab) ? initialTab : 'board'
  );

  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const { toast } = useToast();

  const [activeSession, setActiveSession] = useState<any>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('frontend_developer');
  const [inviting, setInviting] = useState(false);

  // Project lifecycle and bot testing states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [seededBotsList, setSeededBotsList] = useState<any[]>([]);
  const [seedingBots, setSeedingBots] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [copiedBot, setCopiedBot] = useState<string | null>(null);

  useJoinRoom(`project:${id}`);

  // Fetch project details
  const { data: project, isLoading, isError, refetch: refetchProject } = useQuery(
    ['project', id],
    async () => {
      const res = await apiClient.get(`/projects/${id}`);
      return res.data.data.project;
    }
  );

  // Fetch collaborative coding sessions
  const { data: collabSessions = [], refetch: refetchCollab } = useQuery(
    ['collab-sessions', id],
    async () => {
      try {
        const res = await apiClient.get(`/collab/project/${id}`);
        return res.data.data.sessions || [];
      } catch (e) {
        return [];
      }
    },
    {
      enabled: !!id,
      onSuccess: (sessions) => {
        if (sessions?.length > 0 && !activeSession) {
          setActiveSession(sessions[0]);
        }
      },
    }
  );

  // Fetch security compliance audits
  const { data: securityAudits, refetch: refetchAudits } = useQuery(
    ['security-audits', id],
    async () => {
      try {
        const res = await apiClient.get(`/projects/${id}/security-audits`);
        return res.data.data.audits;
      } catch (e) {
        return [];
      }
    },
    {
      enabled: !!project,
    }
  );

  // Listen for real-time security alerts
  useSocket('security:alert', () => {
    refetchAudits();
    toast.error('⚠️ Compliance Violation Detected! An unauthorized action was blocked.');
  });

  useEffect(() => {
    if (project?.name) {
      document.title = `${project.name} | DevCollab`;
    }
  }, [project?.name]);

  const isOwner = project?.owner?._id === user?._id;
  const userMember = project?.members?.find(
    (m: any) => (m.user?._id || m.user) === user?._id
  );
  const userRole = isOwner ? 'project_manager' : userMember?.role || 'contributor';
  const isPM = isOwner || userRole === 'project_manager' || userRole === 'admin';

  // Handle role change for a member
  const handleRoleChange = async (memberUserId: string, newRole: string) => {
    try {
      await apiClient.patch(`/projects/${id}/members/${memberUserId}/role`, { role: newRole });
      toast.success(`Role updated to ${ROLE_LABELS[newRole] || newRole}`);
      refetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update member role');
    }
  };

  // Handle member removal
  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;
    try {
      await apiClient.delete(`/projects/${id}/members/${memberUserId}`);
      toast.success(`${memberName} has been removed from the project.`);
      refetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  // Handle member invitation
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      setInviting(true);
      await apiClient.post(`/projects/${id}/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success(`Member invited as ${ROLE_LABELS[inviteRole] || inviteRole}!`);
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('frontend_developer');
      refetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  // Handle audit resolve
  const handleResolveAudit = async (auditId: string) => {
    try {
      await apiClient.patch(`/projects/${id}/security-audits/${auditId}/resolve`);
      toast.success('Security violation acknowledged.');
      refetchAudits();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resolve audit');
    }
  };

  // Handle project status update (Active, On Hold, Completed, Archived)
  const handleStatusChange = async (newStatus: 'active' | 'on_hold' | 'completed' | 'archived') => {
    try {
      setStatusUpdating(true);
      await apiClient.patch(`/projects/${id}`, { status: newStatus });
      toast.success(`Project marked as ${newStatus.replace('_', ' ')}!`);
      refetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update project status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle project deletion
  const handleDeleteProject = async () => {
    try {
      setDeletingProject(true);
      await apiClient.delete(`/projects/${id}`);
      toast.success('Project deleted successfully.');
      router.push('/projects');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete project');
      setDeletingProject(false);
    }
  };

  // Handle generating test bot team
  const handleSeedBots = async () => {
    try {
      setSeedingBots(true);
      const res = await apiClient.post(`/projects/${id}/seed-bots`);
      setSeededBotsList(res.data.data.bots || []);
      setBotModalOpen(true);
      toast.success('5 Test bot teammates spawned and added to this project!');
      refetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate test bots');
    } finally {
      setSeedingBots(false);
    }
  };

  const copyBotCredentials = (email: string, pass: string) => {
    navigator.clipboard.writeText(`${email}\n${pass}`);
    setCopiedBot(email);
    toast.success(`Credentials copied for ${email}!`);
    setTimeout(() => setCopiedBot(null), 2000);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted/60 rounded w-1/2" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError && !isLoading) {
    return (
      <DashboardLayout>
        <div className="border border-dashed border-border rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto mt-8">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Project Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            You do not have access to this project, or it may have been removed. Please contact the Project Manager.
          </p>
          <Link href="/projects" className="inline-block">
            <Button size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Projects
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const unresolvedViolationsCount =
    securityAudits?.filter((a: any) => !a.resolved)?.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Breadcrumb & Title */}
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Projects
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {project?.name}
                </h1>
                {project?.visibility === 'private' ? (
                  <span title="Private project">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </span>
                ) : (
                  <span title="Public project">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  </span>
                )}

                {/* Project Status Badge */}
                {project?.status === 'completed' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </span>
                )}
                {project?.status === 'on_hold' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <PauseCircle className="w-3.5 h-3.5" /> On Hold
                  </span>
                )}
                {project?.status === 'archived' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border flex items-center gap-1">
                    <Archive className="w-3.5 h-3.5" /> Archived
                  </span>
                )}
                {(!project?.status || project?.status === 'active') && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                  </span>
                )}

                {/* User Active Role Badge */}
                <span
                  className={cn(
                    'text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-xs',
                    ROLE_COLORS[userRole] || 'bg-secondary text-secondary-foreground'
                  )}
                  title="Your assigned role on this project"
                >
                  Your Role: {ROLE_LABELS[userRole] || userRole}
                </span>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {project?.description || 'No description provided'}
              </p>
            </div>

            {/* Quick Actions for PM & Owner */}
            {isPM && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setInviteModalOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> Assign Role & Member
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  loading={seedingBots}
                  onClick={handleSeedBots}
                  title="Spawn 5 test bot teammates with engineering roles and login credentials"
                >
                  <Bot className="w-4 h-4 mr-1.5 text-primary" /> Test Bots Team
                </Button>

                {/* Project Lifecycle Actions */}
                {project?.status !== 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={statusUpdating}
                    onClick={() => handleStatusChange('completed')}
                    className="border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                    title="Mark project as finished and completed"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Finish
                  </Button>
                )}

                {project?.status !== 'on_hold' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={statusUpdating}
                    onClick={() => handleStatusChange('on_hold')}
                    className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    title="Put project on hold temporarily"
                  >
                    <PauseCircle className="w-4 h-4 mr-1.5" /> Hold
                  </Button>
                )}

                {(project?.status === 'on_hold' || project?.status === 'completed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={statusUpdating}
                    onClick={() => handleStatusChange('active')}
                    className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    title="Resume active work on project"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" /> Resume
                  </Button>
                )}

                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteModalOpen(true)}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
          {[
            { id: 'board', label: 'Kanban Board' },
            { id: 'reviews', label: 'Code Reviews' },
            {
              id: 'collab',
              label: (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-live" />
                  Live Pair-Coding
                </span>
              ),
            },
            { id: 'members', label: `Team Members (${project?.members?.length || 1})` },
            {
              id: 'compliance',
              label: (
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Security & Compliance
                  {unresolvedViolationsCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold">
                      {unresolvedViolationsCount}
                    </span>
                  )}
                </span>
              ),
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Kanban Board */}
        {tab === 'board' && <KanbanBoard projectId={id} project={project} />}

        {/* Tab 2: Code Reviews */}
        {tab === 'reviews' && <ReviewList projectId={id} project={project} />}

        {/* Tab 3: Real-Time Collaborative Coding & Share Tracking */}
        {tab === 'collab' && (
          <div className="space-y-6">
            <CollabSessionsList
              projectId={id}
              sessions={collabSessions}
              activeSessionId={activeSession?._id || (collabSessions[0]?._id ?? null)}
              onSelectSession={(s) => setActiveSession(s)}
              onSessionCreated={(s) => {
                refetchCollab();
                setActiveSession(s);
              }}
              onSessionDeleted={() => {
                refetchCollab();
                setActiveSession(null);
              }}
              isPM={isPM}
            />

            {(activeSession || collabSessions[0]) && (
              <div className="pt-2">
                <CollaborativeEditor
                  session={activeSession || collabSessions[0]}
                  project={project}
                  onSessionUpdated={() => {
                    refetchCollab();
                  }}
                  onReviewCreated={() => {
                    refetchCollab();
                    setTab('reviews');
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Team Members & Role Management */}
        {tab === 'members' && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Team Members</h2>
                <p className="text-xs text-muted-foreground">
                  Each person is strictly binded to their role to ensure project security and compliance.
                </p>
              </div>
              {isPM && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={seedingBots}
                    onClick={handleSeedBots}
                  >
                    <Bot className="w-4 h-4 mr-1.5 text-primary" /> Spawn 5 Test Bots
                  </Button>
                  <Button size="sm" onClick={() => setInviteModalOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Invite Member
                  </Button>
                </div>
              )}
            </div>

            {/* Test Bots Info Banner */}
            {isPM && (
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Bot className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">End-to-End Testing with Multi-Role Bots</span>
                    <p className="text-muted-foreground mt-0.5">
                      Need to test ticket completion and review approval from other tabs? Spawn 5 verified test bots (Frontend, Backend, QA, UI/UX, DevOps) and log in with their credentials instantly.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={seedingBots}
                  onClick={handleSeedBots}
                  className="shrink-0 text-xs"
                >
                  <Bot className="w-3.5 h-3.5 mr-1.5" /> Generate Test Bots
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {project?.members?.map((m: any) => {
                const memberUser = m.user;
                const isMemberOwner = project.owner?._id === memberUser?._id;
                return (
                  <Card
                    key={memberUser?._id || m._id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={memberUser?.avatar}
                        name={memberUser?.name || 'User'}
                        size={40}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {memberUser?.name || 'Member'}
                          </p>
                          {isMemberOwner && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary text-white">
                              Owner
                            </span>
                          )}
                        </div>
                        <a
                          href={`mailto:${memberUser?.email}`}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors truncate block"
                        >
                          {memberUser?.email}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* PM role changer select vs static badge */}
                      {isPM && !isMemberOwner ? (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground hidden sm:inline">
                            Role:
                          </label>
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(memberUser?._id, e.target.value)}
                            className={cn(
                              'text-xs font-semibold rounded-md border px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary',
                              ROLE_COLORS[m.role]
                            )}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleRemoveMember(memberUser?._id, memberUser?.name)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                            title="Remove member from project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            'text-xs font-semibold px-3 py-1 rounded-full border',
                            ROLE_COLORS[m.role] || 'bg-secondary text-secondary-foreground'
                          )}
                        >
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Security & Compliance Audit Log */}
        {tab === 'compliance' && (
          <div className="space-y-6 max-w-3xl">
            {/* Info Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/90 space-y-1">
                <p className="font-semibold text-sm text-foreground">
                  Role-Based Security & Compliance Guard
                </p>
                <p className="text-muted-foreground">
                  Developers are strictly binded to their assigned engineering role. Any unauthorized
                  attempts (e.g. Cloud Admin trying to modify Frontend code) are blocked by the system
                  and automatically logged here. Project Managers receive instant alerts upon every violation.
                </p>
              </div>
            </div>

            {/* Audit Log Entries */}
            <div className="space-y-3">
              {securityAudits && securityAudits.length > 0 ? (
                securityAudits.map((audit: any) => (
                  <Card
                    key={audit._id}
                    className={cn(
                      'p-4 space-y-2 border transition-all',
                      audit.resolved
                        ? 'border-border opacity-75'
                        : 'border-rose-500/40 bg-rose-500/5 shadow-sm'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert
                          className={cn(
                            'w-4 h-4 shrink-0',
                            audit.resolved ? 'text-muted-foreground' : 'text-rose-500'
                          )}
                        />
                        <span className="text-xs font-bold text-foreground">
                          {audit.attemptedAction.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">
                          Blocked & Flagged
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(audit.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/90">{audit.details}</p>

                    <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>
                          User:{' '}
                          <strong className="text-foreground">{audit.user?.name || 'User'}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Role:{' '}
                          <strong className="text-foreground">
                            {ROLE_LABELS[audit.userRole] || audit.userRole}
                          </strong>
                        </span>
                        {audit.targetDomain && (
                          <>
                            <span>•</span>
                            <span>
                              Target Domain:{' '}
                              <strong className="text-foreground">
                                {DOMAINS[audit.targetDomain] || audit.targetDomain}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>

                      {isPM && !audit.resolved ? (
                        <button
                          onClick={() => handleResolveAudit(audit._id)}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Acknowledge Violation
                        </button>
                      ) : audit.resolved ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Acknowledged by{' '}
                          {audit.resolvedBy?.name || 'PM'}
                        </span>
                      ) : null}
                    </div>
                  </Card>
                ))
              ) : (
                <div className="border border-dashed border-border rounded-xl p-10 text-center space-y-3">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">
                    100% Compliance — Zero Violations
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No unauthorized code modifications or role boundary violations have been attempted.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invite Member Modal */}
        {inviteModalOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setInviteModalOpen(false)}
          >
            <div
              className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Assign Project Role</h3>
                  <p className="text-xs text-muted-foreground">
                    Invite a teammate and bind them to their software engineering role.
                  </p>
                </div>
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">User Email *</label>
                  <Input
                    type="email"
                    placeholder="engineer@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Assigned Engineering Role *
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full" loading={inviting}>
                  Invite & Assign Role
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Delete Project Confirmation Modal */}
        {deleteModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteModalOpen(false)}
          >
            <div
              className="bg-card border border-destructive/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Delete Project</h3>
                  <p className="text-xs text-muted-foreground">This action is irreversible.</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                Are you sure you want to delete <strong className="text-foreground">{project?.name}</strong>?
                All associated Kanban tasks, code reviews, collaborative pair-coding sessions, and security audits will be permanently removed.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  loading={deletingProject}
                  onClick={handleDeleteProject}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Yes, Delete Project
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Test Bot Credentials Cheat-Sheet Modal */}
        {botModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setBotModalOpen(false)}
          >
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Test Bot Teammates Ready</h3>
                    <p className="text-xs text-muted-foreground">
                      Spawned and assigned to this project with role bindings.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBotModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="text-foreground font-semibold">How to test cross-role collaboration:</p>
                <p>
                  1. Open a new Incognito or separate browser window.<br />
                  2. Sign in with any of the bot credentials below (passwords are already verified).<br />
                  3. Open this project to test task completion, resolution submissions, code reviews, and role permissions!
                </p>
              </div>

              <div className="space-y-2.5">
                {(seededBotsList.length > 0 ? seededBotsList : [
                  { name: 'Alex Chen (Frontend)', email: 'alex.frontend@devcollab.com', role: 'frontend_developer', password: 'DevCollab123!' },
                  { name: 'Sarah Connor (Backend)', email: 'sarah.backend@devcollab.com', role: 'backend_developer', password: 'DevCollab123!' },
                  { name: 'David Miller (QA Tester)', email: 'david.qa@devcollab.com', role: 'qa_tester', password: 'DevCollab123!' },
                  { name: 'Emma Watson (UI/UX)', email: 'emma.designer@devcollab.com', role: 'ui_ux_designer', password: 'DevCollab123!' },
                  { name: 'Lucas Vance (DevOps)', email: 'lucas.devops@devcollab.com', role: 'devops', password: 'DevCollab123!' },
                ]).map((bot: any) => (
                  <div
                    key={bot.email}
                    className="p-3.5 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{bot.name}</span>
                        <span
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded border',
                            ROLE_COLORS[bot.role] || 'bg-secondary text-secondary-foreground'
                          )}
                        >
                          {ROLE_LABELS[bot.role] || bot.role}
                        </span>
                      </div>
                      <p className="text-muted-foreground font-mono text-[11px] truncate">
                        {bot.email}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Password: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{bot.password || 'DevCollab123!'}</code>
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={() => copyBotCredentials(bot.email, bot.password || 'DevCollab123!')}
                    >
                      {copiedBot === bot.email ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Login
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setBotModalOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
