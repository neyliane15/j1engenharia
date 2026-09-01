import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} aria-label="Carregando" />;
}

export function LoadingBlock({ label = 'Carregando...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-14 text-sm text-muted-foreground', className)}>
      <Spinner />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 p-6', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-11" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/60 text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
      title={title}
      description={message ?? 'Tente novamente em instantes.'}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        )
      }
    />
  );
}
