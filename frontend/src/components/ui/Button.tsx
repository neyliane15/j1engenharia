import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'deep';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 active:bg-primary/95 shadow-card',
  deep: 'bg-brand-deep text-brand-deep-foreground border-brand-deep hover:bg-brand-deep/90 shadow-card',
  secondary: 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/70',
  outline: 'bg-card text-foreground border-border hover:bg-secondary/60 hover:border-primary/40',
  ghost: 'bg-transparent text-foreground border-transparent hover:bg-secondary/70',
  destructive: 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-2',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-[15px] gap-2',
  icon: 'h-10 w-10 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md border font-medium',
        'transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
}

/** Mesma aparência do Button, mas para navegação (usar com <Link asChild> do router). */
export const linkButtonClass = ({ variant = 'primary', size = 'md' }: { variant?: Variant; size?: Size } = {}) =>
  cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md border font-medium',
    'transition-colors duration-150',
    variants[variant],
    sizes[size],
  );
