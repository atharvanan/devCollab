'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, GitPullRequest, Bell, Settings, LogOut, Code2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { logoutUser } from '@/store/slices/authSlice';
import { uiActions } from '@/store/slices/uiSlice';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/reviews', label: 'Reviews', icon: GitPullRequest },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { sidebarOpen } = useAppSelector((s) => s.ui);
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount);

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col transition-all duration-200 z-40',
      sidebarOpen ? 'w-60' : 'w-16'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <Code2 className="w-4 h-4 text-white" />
        </div>
        {sidebarOpen && <span className="font-semibold text-lg">DevCollab</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}>
              <Icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{label}</span>}
              {label === 'Notifications' && unreadCount > 0 && (
                <span className={cn(
                  'absolute bg-primary text-white text-xs rounded-full font-bold',
                  sidebarOpen ? 'right-3 top-2 px-1.5 py-0.5' : 'top-1 right-1 w-4 h-4 flex items-center justify-center'
                )}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-border p-3 space-y-2">
        {sidebarOpen && user && (
          <div className="flex items-center gap-2 px-2 py-1">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {user.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => dispatch(logoutUser())}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {sidebarOpen && <span>Logout</span>}
        </button>
        <button
          onClick={() => dispatch(uiActions.toggleSidebar())}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <ChevronLeft className={cn('w-5 h-5 shrink-0 transition-transform', !sidebarOpen && 'rotate-180')} />
          {sidebarOpen && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
