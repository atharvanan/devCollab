'use client';
import Link from 'next/link';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime, cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {notifications.map((n: any) => (
            <Card key={n._id} className={cn('p-4 flex items-start gap-3', !n.read && 'border-primary/30 bg-primary/5')}>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={n.link || '#'} className="text-sm font-medium hover:underline">{n.title}</Link>
                <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</p>
              </div>
              {!n.read && (
                <button onClick={() => markRead.mutate(n._id)} className="shrink-0 text-muted-foreground hover:text-primary">
                  <Check className="w-4 h-4" />
                </button>
              )}
            </Card>
          ))}
          {notifications.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">No notifications yet.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
