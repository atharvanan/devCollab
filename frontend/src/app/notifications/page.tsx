'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Inbox, ShieldAlert, CheckCircle, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Notifications | DevCollab';
  }, []);

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        toast.success('All notifications marked as read.');
      },
      onError: () => {
        toast.error('Failed to mark all notifications as read.');
      },
    });
  };

  const handleMarkSingleRead = (id: string) => {
    markRead.mutate(id, {
      onSuccess: () => {
        toast.success('Notification marked as read.');
      },
      onError: () => {
        toast.error('Failed to update notification.');
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Updates on pull reviews, project mentions, and task assignments.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              loading={markAllRead.isLoading}
              onClick={handleMarkAllRead}
              className="w-full sm:w-auto"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>

        <div className="space-y-2.5">
          {notifications.map((n: any) => {
            const targetUrl = n.link && n.link !== '#' ? n.link : '/dashboard';
            return (
              <Card
                key={n._id}
                className={cn(
                  'p-4 flex items-start gap-3 transition-colors',
                  n.type === 'security_violation'
                    ? 'border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/20'
                    : !n.read && 'border-primary/40 bg-primary/5'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    n.type === 'security_violation'
                      ? 'bg-rose-500/10 text-rose-500'
                      : n.type === 'task_completed' || n.type === 'task_approved'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : n.type === 'task_rejected'
                      ? 'bg-rose-500/10 text-rose-500'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  {n.type === 'security_violation' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : n.type === 'task_approved' || n.type === 'task_completed' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : n.type === 'task_rejected' ? (
                    <RotateCcw className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={targetUrl}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors block break-words"
                  >
                    {n.title}
                  </Link>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">
                    {n.message}
                  </p>
                  <p className="text-[11px] text-muted-foreground/75 mt-1.5">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => handleMarkSingleRead(n._id)}
                    disabled={markRead.isLoading}
                    title="Mark as read"
                    aria-label="Mark notification as read"
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </Card>
            );
          })}

          {notifications.length === 0 && (
            <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-3">
              <Inbox className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-base font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                You have no pending notifications. When someone comments on your code or assigns a task, it will show up here.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
