import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Variação percentual — positiva em teal, negativa em vermelho. */
  trend?: number;
  /** Em custos, cair é bom: inverte a cor da tendência. */
  invertTrend?: boolean;
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, icon, trend, invertTrend, accent, className }: StatCardProps) {
  const good = trend === undefined ? null : invertTrend ? trend <= 0 : trend >= 0;

  return (
    <div className={cn(accent ? 'surface-accent' : 'surface', 'p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/60 text-primary">
            {icon}
          </span>
        )}
      </div>

      <p className="num mt-2 text-[26px] font-semibold leading-tight tracking-tight text-foreground">{value}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {trend !== undefined && (
          <span
            className={cn(
              'num inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium',
              good ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
