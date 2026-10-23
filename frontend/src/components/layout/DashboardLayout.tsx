'use client';
import { useAppSelector } from '@/hooks/useRedux';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Footer } from './Footer';
import { cn } from '@/lib/utils';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);

  return (
    <div className="min-h-screen bg-background flex flex-col w-full max-w-[100vw] overflow-x-hidden">
      {/* Mobile Top Navbar and Drawer Menu */}
      <MobileNav />

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 flex flex-col transition-all duration-200 min-w-0 w-full overflow-x-hidden pt-14 md:pt-0',
          sidebarOpen ? 'md:pl-60' : 'md:pl-16'
        )}
      >
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
          {children}
        </div>

        {/* Global Footer */}
        <Footer />
      </main>
    </div>
  );
}
