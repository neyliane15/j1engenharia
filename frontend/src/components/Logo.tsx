import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** 'assinatura' = símbolo + logotipo; 'simbolo' = só o símbolo. */
  variant?: 'assinatura' | 'simbolo';
  /** 'light' para fundo petróleo, 'dark' para fundo claro. */
  tone?: 'light' | 'dark';
}

/**
 * Marca do Emptra.
 *
 * O símbolo é um "E" construído como três linhas de uma tabela de cotação.
 * Os braços têm comprimentos diferentes, como itens de uma lista, e o do meio
 * é o mais longo, ultrapassando os demais em teal: é a proposta escolhida.
 *
 * Construção na malha 48×48, traço 5, extremidades e junções arredondadas —
 * haste em x=14 (y=10 a 38), braço superior até x=30, médio até x=36,5,
 * inferior até x=27. Não redesenhe à mão; os arquivos vivem em
 * `public/brand/`.
 */
export function Logo({ className, variant = 'assinatura', tone = 'dark' }: LogoProps) {
  const light = tone === 'light';

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="h-8 w-8 shrink-0"
        role="img"
        aria-label="Emptra"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M30 10H14v28h13"
          stroke={light ? 'hsl(var(--sidebar-foreground))' : 'hsl(var(--brand-deep))'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 24h22.5"
          stroke={light ? 'hsl(var(--teal-claro, var(--primary)))' : 'hsl(var(--primary))'}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      {variant === 'assinatura' && (
        <span className={cn('brand-type text-[22px] leading-none', light ? 'text-white' : 'text-brand-deep')}>
          Emptra
        </span>
      )}
    </span>
  );
}
