import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <div className="w-full">
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-border/70 bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 shadow-xs',
          error && 'border-destructive focus-visible:ring-destructive focus-visible:border-destructive text-destructive',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive mt-1 font-medium">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

export { Input };
