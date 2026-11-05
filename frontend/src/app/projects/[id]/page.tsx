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
  Crown,
  Star,
  ShieldCheck,
  ArrowRightLeft,
  Sliders,
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

  // Ownership transfer states
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);

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

  // Fetch governance details
  const { data: governance, refetch: refetchGovernance } = useQuery(
    ['project-governance', id],
    async () => {
      try {
        const res = await apiClient.get(`/projects/${id}/governance`);
        return res.data.data;
      } catch (e) {
        return null;
      }
    },
    { enabled: !!id }
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

  // Listen for real-time security alerts & governance events
  useSocket('security:alert', () => {
    refetchAudits();
    toast.error('⚠️ Compliance Violation Detected! An unauthorized action was blocked.');
  });

  useSocket('project:ownership_transferred', () => {
    refetchProject();
    refetchGovernance();
    refetchAudits();
    toast.info('👑 Project ownership was updated.');
  });

  useEffect(() => {
    if (project?.name) {
      document.title = `${project.name} | DevCollab`;
    }
  }, [project?.name]);

  const isOwner = (project?.owner?._id || project?.owner) === user?._id || user?.role === 'admin';
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
      refetchGovernance();
      refetchAudits();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update member role');
    }
  };

  // Handle appointing a member to Project Manager
  const handleAppointPM = async (memberUserId: string, memberName: string) => {
    try {
      await apiClient.post(`/projects/${id}/managers/${memberUserId}`);
      toast.success(`Appointed ${memberName} as Project Manager!`);
      refetchProject();
      refetchGovernance();
      refetchAudits();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to appoint Project Manager');
    }
  };

  // Handle revoking Project Manager status
  const handleRevokePM = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to revoke Project Manager privileges from ${memberName}?`)) return;
    try {
      await apiClient.delete(`/projects/${id}/managers/${memberUserId}`);
      toast.success(`Revoked Project Manager status from ${memberName}.`);
      refetchProject();
      refetchGovernance();
      refetchAudits();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke Project Manager');
    }
  };

  // Handle ownership transfer
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetId) {
      toast.error('Please select an active member to receive ownership.');
      return;
    }
    try {
      setTransferring(true);
      const res = await apiClient.post(`/projects/${id}/transfer-ownership`, {
        newOwnerId: transferTargetId,
        reason: transferReason.trim(),
      });
      toast.success(res.data.message || 'Project ownership transferred successfully!');
      setTransferModalOpen(false);
      setTransferTargetId('');
      setTransferReason('');
      refetchProject();
      refetchGovernance();
      refetchAudits();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  // Handle member removal
  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;
    try {
      await apiClient.delete(`/projects/${id}/members/${memberUserId}`);
      toast.success(`${memberName} has been removed from the project.`);
      refetchProject();
      refetchGovernance();
      refetchAudits();
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
      refetchGovernance();
      refetchAudits();
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
      await apiClient.patch(`/projects/${id}/lifecycle`, { status: newStatus });
      toast.success(`Project marked as ${newStatus.replace('_', ' ')}!`);
      refetchProject();
      refetchGovernance();
      refetchAudits();
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
      toast.success('Test bot teammates added to this project!');
      refetchProject();
      refetchGovernance();
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

  const otherMembersForTransfer = project?.members?.filter(
    (m: any) => (m.user?._id || m.user) !== project?.owner?._id
  );

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

                {/* Project Owner Badge */}
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-500" /> Owner: {project?.owner?.name || 'Owner'}
                </span>

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

            {/* Governance Actions for PM & Owner */}
            {isPM && (
              <div className="flex flex-wrap items-center gap-2">
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTransferModalOpen(true)}
                    className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    title="Transfer project ownership to another active member"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Transfer Ownership
                  </Button>
                )}

                <Button size="sm" variant="outline" onClick={() => setInviteModalOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> Invite Member
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
                    title="Put project temporarily on hold"
                  >
                    <PauseCircle className="w-4 h-4 mr-1.5" /> On Hold
                  </Button>
                )}

                {project?.status !== 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={statusUpdating}
                    onClick={() => handleStatusChange('active')}
                    className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    title="Resume active project development"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" /> Resume
                  </Button>
                )}

                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteModalOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/80 gap-6 overflow-x-auto pb-px">
          {[
            { key: 'board', label: 'Kanban Board' },
            { key: 'reviews', label: 'Code Reviews' },
            {
              key: 'collab',
              label: (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Pair-Coding
                </span>
              ),
            },
            {
              key: 'members',
              label: `Team Members (${project?.members?.length || 0})`,
            },
            {
              key: 'compliance',
              label: (
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Security & Compliance
                </span>
              ),
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as any)}
              className={cn(
                'pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap cursor-pointer',
                tab === item.key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
              {tab === item.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Tab 0: Kanban Board */}
        {tab === 'board' && <KanbanBoard projectId={id} />}

        {/* Tab 1: Code Reviews */}
        {tab === 'reviews' && <ReviewList projectId={id} />}

        {/* Tab 2: Live Pair-Coding Session */}
        {tab === 'collab' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-xl p-4">
              <div>
                <h3 className="font-semibold text-sm text-foreground">
                  Real-Time Pair Programming Session
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multi-cursor code editor with syntax execution and inline discussion room.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CollabSessionsList
                  projectId={id}
                  sessions={collabSessions}
                  activeSessionId={activeSession?._id}
                  onSelectSession={(s) => setActiveSession(s)}
                  onSessionCreated={(newSession) => {
                    refetchCollab();
                    setActiveSession(newSession);
                  }}
                />
              </div>
            </div>

            {activeSession && (
              <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                <CollaborativeEditor
                  sessionId={activeSession._id}
                  projectId={id}
                  onExportToReview={() => {
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
          <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Team & Governance</h2>
                <p className="text-xs text-muted-foreground">
                  Strictly role-governed engineering workspace. Only Project Owner can appoint or revoke Project Managers.
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
                    <Bot className="w-4 h-4 mr-1.5 text-primary" /> Spawn Test Bots
                  </Button>
                  <Button size="sm" onClick={() => setInviteModalOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Invite Member
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {project?.members?.map((m: any) => {
                const memberUser = m.user;
                const isMemberOwner = (project.owner?._id || project.owner)?.toString() === (memberUser?._id || memberUser)?.toString();
                const isMemberPM = m.role === 'project_manager' || m.role === 'admin';

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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {memberUser?.name || 'Member'}
                          </p>
                          {isMemberOwner && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-500" /> Project Owner
                            </span>
                          )}
                          {!isMemberOwner && isMemberPM && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                              <Star className="w-3 h-3 text-primary" /> Project Manager
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

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {/* Appoint / Revoke PM Controls (Project Owner Only) */}
                      {isOwner && !isMemberOwner && (
                        <>
                          {isMemberPM ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevokePM(memberUser?._id, memberUser?.name)}
                              className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                              title="Revoke Project Manager privileges from this member"
                            >
                              Revoke PM
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAppointPM(memberUser?._id, memberUser?.name)}
                              className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                              title="Elevate this member to Project Manager"
                            >
                              <Star className="w-3 h-3 mr-1" /> Appoint PM
                            </Button>
                          )}
                        </>
                      )}

                      {/* PM role changer select vs static badge */}
                      {isPM && !isMemberOwner ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(memberUser?._id, e.target.value)}
                            className={cn(
                              'text-xs font-semibold rounded-md border px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary',
                              ROLE_COLORS[m.role]
                            )}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option
                                key={opt.value}
                                value={opt.value}
                                disabled={opt.value === 'project_manager' && !isOwner}
                              >
                                {opt.label} {opt.value === 'project_manager' && !isOwner ? '(Owner Only)' : ''}
                              </option>
                            ))}
                          </select>

                          {/* Non-owner PM cannot remove another PM or owner */}
                          {(!isMemberPM || isOwner) && (
                            <button
                              onClick={() => handleRemoveMember(memberUser?._id, memberUser?.name)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title="Remove member from project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
          <div className="space-y-6 max-w-4xl">
            {/* Info Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/90 space-y-1">
                <p className="font-semibold text-sm text-foreground">
                  Governance & Compliance Audit Trail (SOC-2 Immutable)
                </p>
                <p className="text-muted-foreground">
                  All privileged operations (Project Creation, Ownership Transfers, Project Manager appointments,
                  role changes, task reviews, lifecycle transitions, and unauthorized security attempts) are immutably logged below.
                </p>
              </div>
            </div>

            {/* Audit Log Entries */}
            <div className="space-y-3">
              {securityAudits && securityAudits.length > 0 ? (
                securityAudits.map((audit: any) => {
                  const isGovernanceEvent = audit.status === 'success' || audit.attemptedAction.includes('OWNERSHIP') || audit.attemptedAction.includes('PM_') || audit.attemptedAction.includes('PROJECT_');
                  return (
                    <Card
                      key={audit._id}
                      className={cn(
                        'p-4 space-y-2 border transition-all',
                        isGovernanceEvent
                          ? 'border-border/80 bg-card'
                          : audit.resolved
                          ? 'border-border opacity-75'
                          : 'border-rose-500/40 bg-rose-500/5 shadow-sm'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isGovernanceEvent ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <ShieldAlert
                              className={cn(
                                'w-4 h-4 shrink-0',
                                audit.resolved ? 'text-muted-foreground' : 'text-rose-500'
                              )}
                            />
                          )}
                          <span className="text-xs font-bold text-foreground">
                            {audit.attemptedAction.replace(/_/g, ' ')}
                          </span>
                          {isGovernanceEvent ? (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Governance Log
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">
                              Blocked & Flagged
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(audit.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-foreground/90">{audit.details}</p>

                      <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            Actor:{' '}
                            <strong className="text-foreground">{audit.actor?.name || audit.user?.name || 'User'}</strong>
                          </span>
                          {audit.targetUser && (
                            <>
                              <span>•</span>
                              <span>
                                Target:{' '}
                                <strong className="text-foreground">{audit.targetUser?.name || 'Target User'}</strong>
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            Role:{' '}
                            <strong className="text-foreground">
                              {ROLE_LABELS[audit.userRole] || audit.userRole}
                            </strong>
                          </span>
                        </div>

                        {!isGovernanceEvent && isPM && !audit.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => handleResolveAudit(audit._id)}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Acknowledge Violation
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="border border-dashed border-border rounded-xl p-8 text-center space-y-2">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold">Clean Audit Log</p>
                  <p className="text-xs text-muted-foreground">
                    No violations or security warnings detected in this project.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ownership Transfer Modal */}
        {transferModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setTransferModalOpen(false)}
          >
            <div
              className="bg-card border border-amber-500/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Transfer Ownership</h3>
                    <p className="text-xs text-muted-foreground">Appoint a new Project Owner</p>
                  </div>
                </div>
                <button
                  onClick={() => setTransferModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-foreground/80 leading-relaxed">
                Project Ownership grants ultimate authority over settings, managers, and project lifecycle.
                You will retain your Project Manager role. Projects can never be ownerless.
              </p>

              <form onSubmit={handleTransferOwnership} className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Select New Owner (Active Members Only)
                  </label>
                  <select
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    required
                    className="w-full text-xs rounded-lg border border-border px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose Member --</option>
                    {otherMembersForTransfer?.map((m: any) => {
                      const u = m.user;
                      return (
                        <option key={u?._id || m._id} value={u?._id || m.user}>
                          {u?.name} ({u?.email}) — {ROLE_LABELS[m.role] || m.role}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Transfer Reason / Governance Notes (Optional)
                  </label>
                  <Input
                    placeholder="e.g. Lead transition for Sprint 4 release"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTransferModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    loading={transferring}
                  >
                    <Crown className="w-4 h-4 mr-1.5" /> Confirm Transfer
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invite Member Modal */}
        {inviteModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setInviteModalOpen(false)}
          >
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Invite Project Member</h3>
                    <p className="text-xs text-muted-foreground">Assign engineering role</p>
                  </div>
                </div>
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email Address</label>
                  <Input
                    type="email"
                    placeholder="developer@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Engineering Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.value === 'project_manager' && !isOwner}
                      >
                        {opt.label} {opt.value === 'project_manager' && !isOwner ? '(Owner Only)' : ''}
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
                  2. Sign in with any of the bot credentials below.<br />
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
