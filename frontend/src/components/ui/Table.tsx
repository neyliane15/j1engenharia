import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A tabela é o componente mais importante do sistema, então tem regra própria:
 * cabeçalho em superfície, linhas separadas por 1px, sem zebra, altura de 48px,
 * coluna de valor à direita com `.num`, hover discreto e sem sombra.
 */

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
        'sticky top-0 z-10 h-12 whitespace-nowrap border-b border-border bg-table-header px-4',
        'text-left text-[13px] font-medium text-table-header-foreground',
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
      className={cn('h-12 border-b border-border px-4 py-3 align-middle', numeric && 'num text-right', className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-row-hover', className)} {...props} />;
}
