'use client';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useParams, useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiClient } from '@/lib/apiClient';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { ReviewList } from '@/components/reviews/ReviewList';
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
  const [tab, setTab] = useState<'board' | 'reviews' | 'members' | 'compliance'>(
    ['board', 'reviews', 'members', 'compliance'].includes(initialTab) ? initialTab : 'board'
  );

  const { user } = useAppSelector((s) => s.auth);
  const { toast } = useToast();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('frontend_developer');
  const [inviting, setInviting] = useState(false);

  useJoinRoom(`project:${id}`);

  // Fetch project details
  const { data: project, isLoading, refetch: refetchProject } = useQuery(
    ['project', id],
    async () => {
      const res = await apiClient.get(`/projects/${id}`);
      return res.data.data.project;
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

                {/* User Active Role Badge */}
                <span
                  className={cn(
                    'text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-sm',
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

            {/* Quick action for PM */}
            {isPM && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setInviteModalOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> Assign Role & Member
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
          {[
            { id: 'board', label: 'Kanban Board' },
            { id: 'reviews', label: 'Code Reviews' },
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

        {/* Tab 3: Team Members & Role Management */}
        {tab === 'members' && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Team Members</h2>
                <p className="text-xs text-muted-foreground">
                  Each person is strictly binded to their role to ensure project security and compliance.
                </p>
              </div>
              {isPM && (
                <Button size="sm" onClick={() => setInviteModalOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> Invite Member
                </Button>
              )}
            </div>

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
      </div>
    </DashboardLayout>
  );
}
