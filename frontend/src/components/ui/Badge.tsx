import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Chip de status e rótulo.
 *
 * Os estados usam família própria, fora do teal — fundo tingido e texto
 * escuro da mesma família. Nunca texto branco sobre cor saturada, que é o
 * visual de sistema antigo, e nunca teal, que é cor de ação.
 */
type Tone = 'neutral' | 'pending' | 'approved' | 'rejected' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'bg-state-neutral text-state-neutral-foreground border-transparent',
  pending: 'bg-state-pending text-state-pending-foreground border-transparent',
  approved: 'bg-state-approved text-state-approved-foreground border-transparent',
  rejected: 'bg-state-rejected text-state-rejected-foreground border-transparent',
  outline: 'bg-transparent text-muted-foreground border-border',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-chip border px-3 py-1 text-[13px] font-medium leading-4',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
