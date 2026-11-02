'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  GitPullRequest,
  Bell,
  Settings,
  LogOut,
  Code2,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
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
    <aside
      className={cn(
        'hidden md:flex fixed left-0 top-0 h-full bg-card/95 backdrop-blur-md border-r border-border/80 flex-col transition-all duration-200 z-40 shadow-xs',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Brand Header */}
      <Link
        href="/dashboard"
        className="flex items-center gap-3 px-4 py-4.5 border-b border-border/70 group hover:bg-accent/40 transition-colors"
        title="Go to DevCollab Dashboard"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center shrink-0 shadow-sm shadow-primary/30 group-hover:scale-105 transition-transform">
          <Code2 className="w-4 h-4 text-white" />
        </div>
        {sidebarOpen && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-base tracking-tight text-foreground">DevCollab</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
              Live
            </span>
          </div>
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative group',
                active
                  ? 'bg-primary/10 text-primary font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-full" />
              )}
              <Icon className={cn('w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
              {sidebarOpen && <span className="truncate">{label}</span>}
              {label === 'Notifications' && unreadCount > 0 && (
                <span
                  className={cn(
                    'bg-primary text-white text-[11px] rounded-full font-bold shadow-xs',
                    sidebarOpen
                      ? 'ml-auto px-2 py-0.5'
                      : 'absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-[10px]'
                  )}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section & Toggles */}
      <div className="border-t border-border/70 p-3 space-y-2 bg-accent/10">
        {sidebarOpen && user && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-card/60 border border-border/40">
            <div className="relative shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-border/80"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/30">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-foreground leading-tight">{user.name}</p>
              <a
                href={`mailto:${user.email}`}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors truncate block leading-tight mt-0.5"
                title={`Send email to ${user.email}`}
              >
                {user.email}
              </a>
            </div>
          </div>
        )}

        <button
          onClick={() => dispatch(logoutUser())}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
        >
          <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>

        <button
          onClick={() => dispatch(uiActions.toggleSidebar())}
          className="flex items-center gap-3 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <ChevronLeft className={cn('w-4 h-4 shrink-0 transition-transform', !sidebarOpen && 'rotate-180')} />
          {sidebarOpen && <span className="text-xs">Collapse sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
