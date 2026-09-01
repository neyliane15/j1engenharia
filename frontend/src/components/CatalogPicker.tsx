import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CatalogItem, Category } from '@/types';

interface CatalogPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando a escolha veio do catálogo, com unidade e id. */
  onPick: (item: CatalogItem) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Campo de descrição do item com sugestão do catálogo.
 *
 * O comprador pode digitar livre — nem tudo que se compra está no catálogo —
 * mas quando escolhe uma sugestão o item fica amarrado ao produto, e é isso
 * que permite comparar o preço do mesmo material entre cotações diferentes.
 */
export function CatalogPicker({ value, onChange, onPick, placeholder, disabled, id }: CatalogPickerProps) {
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const [termoBusca, setTermoBusca] = useState(value);
  const caixa = useRef<HTMLDivElement>(null);

  // Espera o usuário parar de digitar antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(value), 220);
    return () => clearTimeout(t);
  }, [value]);

  const { data } = useQuery({
    queryKey: ['catalog', 'items', termoBusca],
    queryFn: () => api.get<{ data: CatalogItem[] }>(`/catalog/items?limit=12&q=${encodeURIComponent(termoBusca)}`),
    enabled: aberto && termoBusca.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

  const sugestoes = useMemo(() => data?.data ?? [], [data]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  useEffect(() => setDestaque(0), [sugestoes.length]);

  function escolher(item: CatalogItem) {
    onChange(item.name);
    onPick(item);
    setAberto(false);
  }

  return (
    <div ref={caixa} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (!aberto || !sugestoes.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setDestaque((d) => (d + 1) % sugestoes.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDestaque((d) => (d - 1 + sugestoes.length) % sugestoes.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            escolher(sugestoes[destaque]);
          } else if (e.key === 'Escape') {
            setAberto(false);
          }
        }}
        className={cn(
          'h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground transition-colors',
          'placeholder:text-muted-foreground/70 hover:border-primary/35',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25',
          'disabled:cursor-not-allowed disabled:bg-muted',
        )}
      />

      {aberto && sugestoes.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-pop"
        >
          {sugestoes.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === destaque}
                onMouseEnter={() => setDestaque(i)}
                onClick={() => escolher(item)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-2 text-left transition-colors',
                  i === destaque ? 'bg-secondary' : 'hover:bg-secondary/60',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{item.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {item.category.name} · {item.unit}
                  </span>
                </span>
                {value === item.name && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lista de categorias do catálogo — usada no cadastro do fornecedor. */
export function useCategorias() {
  return useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api.get<{ data: Category[] }>('/catalog/categories'),
    staleTime: 30 * 60_000,
  });
}
