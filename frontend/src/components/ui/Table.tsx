import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Tabela sempre dentro de um container que rola sozinho — a página nunca rola na horizontal. */
export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('scroll-x -mx-px', className)} {...props} />;
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full min-w-full border-collapse text-sm', className)} {...props} />;
}

export function Th({ className, numeric, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-secondary/70 px-4 py-2.5',
        'text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, numeric, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn('border-b border-border/70 px-4 py-3 align-middle', numeric && 'num text-right', className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-secondary/40', className)} {...props} />;
}
