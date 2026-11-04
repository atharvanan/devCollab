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
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { logoutUser, performImmediateLogout } from '@/store/slices/authSlice';
import { uiActions } from '@/store/slices/uiSlice';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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
        'hidden md:flex fixed left-0 top-0 h-full bg-card/95 backdrop-blur-md border-r border-border flex-col transition-all duration-200 z-40 shadow-xs',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Polished, Spacious Brand Header */}
      <Link
        href="/dashboard"
        className={cn(
          'flex items-center gap-3.5 px-4 py-5 border-b border-border/70 group hover:bg-accent/30 transition-colors',
          !sidebarOpen && 'justify-center px-2'
        )}
        title="DevCollab Workspace"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-indigo-500 dark:to-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/25 group-hover:scale-105 transition-transform">
          <Code2 className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <span className="font-bold text-base tracking-tight text-foreground block leading-none">
              DevCollab
            </span>
            <span className="text-[11px] text-muted-foreground font-medium block mt-1">
              Engineering Workspace
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group',
                active
                  ? 'bg-primary/10 text-primary font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
              )}
              <Icon
                className={cn(
                  'w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105',
                  active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
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
      <div className="border-t border-border/70 p-3 space-y-2 bg-accent/5">
        {/* Dark Mode Switcher */}
        <div className={cn('flex items-center', sidebarOpen ? 'justify-between px-1' : 'justify-center')}>
          <ThemeToggle showLabel={sidebarOpen} className={sidebarOpen ? 'w-full justify-start' : ''} />
        </div>

        {/* User Card */}
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
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-card" />
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
          type="button"
          onClick={() => performImmediateLogout(dispatch)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group cursor-pointer active:scale-95"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>

        <button
          type="button"
          onClick={() => dispatch(uiActions.toggleSidebar())}
          className="flex items-center gap-3 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer active:scale-95"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <ChevronLeft className={cn('w-4 h-4 shrink-0 transition-transform', !sidebarOpen && 'rotate-180')} />
          {sidebarOpen && <span className="text-xs">Collapse sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
