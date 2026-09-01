import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-md border border-input bg-card px-3 text-sm text-foreground transition-colors ' +
  'placeholder:text-muted-foreground/70 hover:border-primary/35 ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 ' +
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  id: string;
  children: React.ReactNode;
}

function Field({ label, hint, error, required, className, id, children }: FieldWrapperProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  /** Alinha o valor à direita com tabular-nums — para dinheiro e quantidade. */
  numeric?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, wrapperClassName, numeric, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <Field label={label} hint={hint} error={error} required={props.required} className={wrapperClassName} id={fieldId}>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          className={cn(fieldBase, 'h-10', numeric && 'num text-right', error && 'border-destructive', className)}
          {...props}
        />
      </Field>
    );
  },
);
Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, wrapperClassName, id, children, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <Field label={label} hint={hint} error={error} required={props.required} className={wrapperClassName} id={fieldId}>
        <select
          ref={ref}
          id={fieldId}
          className={cn(fieldBase, 'h-10 cursor-pointer pr-8', error && 'border-destructive', className)}
          {...props}
        >
          {children}
        </select>
      </Field>
    );
  },
);
Select.displayName = 'Select';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, wrapperClassName, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <Field label={label} hint={hint} error={error} required={props.required} className={wrapperClassName} id={fieldId}>
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(fieldBase, 'min-h-[88px] resize-y py-2 leading-relaxed', error && 'border-destructive', className)}
          {...props}
        />
      </Field>
    );
  },
);
Textarea.displayName = 'Textarea';
