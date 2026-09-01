import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** 'full' mostra o monograma e o nome; 'mark' só o monograma. */
  variant?: 'full' | 'mark';
  /** 'light' para fundos escuros (sidebar), 'dark' para fundos claros. */
  tone?: 'light' | 'dark';
  showTagline?: boolean;
}

/**
 * Marca do Emptra.
 *
 * O monograma é um "E" construído em barras — a leitura de plantas e níveis —
 * com o ponto em primary marcando o item cotado. Para trocar pela logomarca
 * oficial, substitua apenas o <svg> abaixo mantendo o viewBox 0 0 64 64.
 */
export function Logo({ className, variant = 'full', tone = 'dark', showTagline = false }: LogoProps) {
  const nameColor = tone === 'light' ? 'text-white' : 'text-brand-deep';
  const taglineColor = tone === 'light' ? 'text-sidebar-foreground/70' : 'text-muted-foreground';

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 64 64"
        className="h-9 w-9 shrink-0"
        role="img"
        aria-label="Emptra"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="64" height="64" rx="14" fill="hsl(var(--brand-deep))" />
        <path d="M20 18h26v7H27v6.5h17v7H27V45h19v7H20z" fill="hsl(var(--primary))" />
        <circle cx="46" cy="21.5" r="3.5" fill="hsl(var(--background))" />
      </svg>

      {variant === 'full' && (
        <span className="flex flex-col leading-none">
          <span className={cn('brand-type text-xl tracking-tight', nameColor)}>Emptra</span>
          {showTagline && (
            <span className={cn('mt-0.5 text-[11px] font-medium tracking-wide', taglineColor)}>
              Cotações para obras
            </span>
          )}
        </span>
      )}
    </span>
  );
}
