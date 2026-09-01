import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'deep' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground border-border',
  primary: 'bg-primary/10 text-primary border-primary/25',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/30',
  danger: 'bg-destructive/10 text-destructive border-destructive/25',
  deep: 'bg-brand-deep text-brand-deep-foreground border-brand-deep',
  outline: 'bg-transparent text-muted-foreground border-border',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ className, tone = 'neutral', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
