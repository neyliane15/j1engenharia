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
  className?: string;
}

export function StatCard({ label, value, hint, icon, trend, invertTrend, className }: StatCardProps) {
  const good = trend === undefined ? null : invertTrend ? trend <= 0 : trend >= 0;

  return (
    <div className={cn('surface p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/60 text-primary">
            {icon}
          </span>
        )}
      </div>

      <p className="num mt-2 text-[26px] font-medium leading-tight tracking-tight text-foreground">{value}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {trend !== undefined && (
          <span
            className={cn(
              'num inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium',
              good
                ? 'bg-state-approved text-state-approved-foreground'
                : 'bg-state-rejected text-state-rejected-foreground',
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
