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
          'flex h-9 w-full rounded-xs border border-border/80 bg-background/80 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs',
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
