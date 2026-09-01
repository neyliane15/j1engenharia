import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { QuotationStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDate, formatDeadline } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, Quotation } from '@/types';

export default function AdminQuotations() {
  const [status, setStatus] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'quotations', status],
    queryFn: () => api.get<Paginated<Quotation>>(`/admin/quotations?perPage=100${status ? `&status=${status}` : ''}`),
  });

  return (
    <>
      <PageHeader title="Cotações" description="Todas as cotações da plataforma, de todos os compradores." />

      <Card>
        <div className="flex justify-end border-b border-border p-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-52">
            <option value="">Todas as situações</option>
            <option value="DRAFT">Rascunho</option>
            <option value="SENT">Enviadas</option>
            <option value="RECEIVING">Recebendo</option>
            <option value="CLOSED">Em análise</option>
            <option value="AWARDED">Aprovadas</option>
            <option value="CANCELLED">Canceladas</option>
          </Select>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !data?.data.length ? (
          <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="Nenhuma cotação encontrada" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Cotação</Th>
                  <Th>Comprador</Th>
                  <Th>Responsável</Th>
                  <Th>Situação</Th>
                  <Th numeric>Itens</Th>
                  <Th numeric>Propostas</Th>
                  <Th>Prazo</Th>
                  <Th>Criada</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((q) => {
                  const deadline = formatDeadline(q.deadline);
                  return (
                    <Tr key={q.id}>
                      <Td>
                        <span className="block font-medium">{q.title}</span>
                        <span className="num mt-0.5 block text-xs text-muted-foreground">{q.code}</span>
                      </Td>
                      <Td className="text-muted-foreground">{q.buyerCompany?.name}</Td>
                      <Td className="text-muted-foreground">{q.createdBy?.name}</Td>
                      <Td><QuotationStatusBadge status={q.status} /></Td>
                      <Td numeric>{q._count?.items ?? 0}</Td>
                      <Td numeric>{q._count?.bids ?? 0}/{q._count?.invites ?? 0}</Td>
                      <Td>
                        <span
                          className={cn(
                            'text-xs',
                            deadline.tone === 'late' && 'text-destructive',
                            deadline.tone === 'warn' && 'text-warning',
                            deadline.tone === 'ok' && 'text-muted-foreground',
                          )}
                        >
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
