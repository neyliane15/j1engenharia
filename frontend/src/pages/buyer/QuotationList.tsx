import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Plus, Search, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { linkButtonClass } from '@/components/ui/Button';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { QuotationStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDate, formatDeadline } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, Quotation } from '@/types';

const FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'DRAFT', label: 'Rascunhos' },
  { value: 'SENT,RECEIVING', label: 'Em andamento' },
  { value: 'CLOSED', label: 'Em análise' },
  { value: 'AWARDED', label: 'Aprovadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

export default function QuotationList() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['quotations', status, search],
    queryFn: () =>
      api.get<Paginated<Quotation>>(
        `/quotations?perPage=50${status ? `&status=${status}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  return (
    <>
      <PageHeader
        title="Minhas cotações"
        description="Do rascunho à aprovação, com o que cada fornecedor respondeu."
        action={
          <Link to="/comprador/cotacoes/nova" className={linkButtonClass()}>
            <Plus className="mr-2 h-4 w-4" />
            Nova cotação
          </Link>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou código (COT-2025-0001)"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-52">
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={<ShoppingCart className="h-5 w-5" />}
            title="Nenhuma cotação encontrada"
            description={search || status ? 'Ajuste o filtro ou a busca.' : 'Crie a primeira cotação e dispare no WhatsApp.'}
            action={
              <Link to="/comprador/cotacoes/nova" className={linkButtonClass({ size: 'sm' })}>
                Criar cotação
              </Link>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Cotação</Th>
                  <Th>Centro de custo</Th>
                  <Th>Situação</Th>
                  <Th numeric>Itens</Th>
                  <Th numeric>Propostas</Th>
                  <Th>Prazo</Th>
                  <Th>Criada em</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((q) => {
                  const deadline = formatDeadline(q.deadline);
                  return (
                    <Tr key={q.id} className="cursor-pointer">
                      <Td>
                        <Link to={`/comprador/cotacoes/${q.id}`} className="block">
                          <span className="block font-medium text-foreground hover:text-primary">{q.title}</span>
                          <span className="num mt-1 block text-xs text-muted-foreground">{q.code}</span>
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">{q.project?.name ?? '—'}</Td>
                      <Td><QuotationStatusBadge status={q.status} /></Td>
                      <Td numeric>{q._count?.items ?? 0}</Td>
                      <Td numeric>
                        <span className={cn((q._count?.bids ?? 0) > 0 && 'font-medium text-foreground')}>
                          {q._count?.bids ?? 0}
                        </span>
                        <span className="text-muted-foreground">/{q._count?.invites ?? 0}</span>
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs',
                            deadline.tone === 'late' && 'text-destructive',
                            deadline.tone === 'warn' && 'text-warning',
                            deadline.tone === 'ok' && 'text-muted-foreground',
                          )}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {deadline.label}
                        </span>
                      </Td>
                      <Td className="num text-muted-foreground">{formatDate(q.createdAt)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
