'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  Code2,
  LayoutDashboard,
  FolderKanban,
  GitPullRequest,
  Bell,
  Settings,
  LogOut,
  Plus,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { logoutUser } from '@/store/slices/authSlice';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/reviews', label: 'Reviews', icon: GitPullRequest },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount);

  // Close drawer whenever the route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur border-b border-border z-30 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open navigation menu"
            className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Clickable Brand Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold text-foreground group"
          >
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-sm">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-base tracking-tight">DevCollab</span>
          </Link>
        </div>

        {/* Right side mobile icons */}
        <div className="flex items-center gap-1.5">
          <ThemeToggle />

          <Link
            href="/notifications"
            className="p-2 relative rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            )}
          </Link>

          {user && (
            <Link href="/settings" className="shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/30">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Drawer Slide-over */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Menu Panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 font-bold text-lg text-foreground"
              >
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                  <Code2 className="w-4 h-4 text-white" />
                </div>
                <span>DevCollab</span>
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Button */}
            <div className="p-3 border-b border-border/50">
              <Link
                href="/projects/new"
                onClick={() => setIsOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> New Project
              </Link>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {label === 'Notifications' && unreadCount > 0 && (
                      <span className="bg-primary text-white text-xs rounded-full font-bold px-1.5 py-0.5 min-w-[20px] text-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile and Logout */}
            <div className="p-4 border-t border-border space-y-3 bg-card/60">
              {user && (
                <div className="flex items-center gap-3">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary border border-primary/30 shrink-0">
                      {user.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                    <a
                      href={`mailto:${user.email}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors truncate block flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setIsOpen(false);
                  dispatch(logoutUser());
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
