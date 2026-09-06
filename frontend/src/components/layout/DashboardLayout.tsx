'use client';
import { useAppSelector } from '@/hooks/useRedux';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={cn('transition-all duration-200', sidebarOpen ? 'ml-60' : 'ml-16')}>
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
