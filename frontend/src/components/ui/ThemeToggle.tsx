'use client';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: Props) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className={cn('w-8 h-8 rounded-lg bg-accent/30 animate-pulse', className)} />
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={cn(
        'inline-flex items-center gap-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors select-none text-xs font-medium',
        className
      )}
    >
      <div className="relative w-4 h-4 shrink-0">
        <Sun
          className={cn(
            'w-4 h-4 absolute inset-0 transition-transform duration-200',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-amber-500'
          )}
        />
        <Moon
          className={cn(
            'w-4 h-4 absolute inset-0 transition-transform duration-200',
            isDark ? 'rotate-0 scale-100 opacity-100 text-sky-400' : '-rotate-90 scale-0 opacity-0'
          )}
        />
      </div>
      {showLabel && <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>}
    </button>
  );
}

