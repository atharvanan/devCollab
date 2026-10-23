'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/hooks/useRedux';
import { Code2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, initialized } = useAppSelector((s) => s.auth);

  useEffect(() => {
    document.title = 'DevCollab — Real-Time Code Review & Team Collaboration';
  }, []);

  useEffect(() => {
    if (!initialized) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [initialized, user, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
          <Code2 className="w-6 h-6 text-white" />
        </div>
        <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
