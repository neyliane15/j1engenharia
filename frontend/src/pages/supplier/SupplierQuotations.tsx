import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { BidStatusBadge, InviteStatusBadge, QuotationStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDeadline, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated, Quotation } from '@/types';

const FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'SENT,RECEIVING', label: 'Abertas' },
  { value: 'CLOSED', label: 'Em análise' },
  { value: 'AWARDED', label: 'Decididas' },
];

export default function SupplierQuotations() {
  const [status, setStatus] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['quotations', 'supplier', status],
    queryFn: () => api.get<Paginated<Quotation>>(`/quotations?perPage=50${status ? `&status=${status}` : ''}`),
  });

  return (
    <>
      <PageHeader
        title="Cotações recebidas"
        description="Tudo que os compradores enviaram para você — responda aqui ou pelo WhatsApp."
      />

      <Card>
        <div className="flex justify-end border-b border-border p-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <SkeletonRows rows={5} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Nenhuma cotação por aqui"
            description="Quando um comprador te convidar, a cotação chega no WhatsApp e aparece nesta lista."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Cotação</Th>
                  <Th>Comprador</Th>
                  <Th>Situação</Th>
                  <Th>Minha proposta</Th>
                  <Th numeric>Valor</Th>
                  <Th>Prazo</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((q) => {
                  const deadline = formatDeadline(q.deadline);
                  return (
                    <Tr key={q.id}>
                      <Td>
                        <Link to={`/fornecedor/cotacoes/${q.id}`} className="block">
                          <span className="block font-medium text-foreground hover:text-primary">{q.title}</span>
                          <span className="num mt-1 block text-xs text-muted-foreground">
                            {q.code} · {q._count?.items ?? 0} itens
                          </span>
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">{q.buyerCompany?.name}</Td>
                      <Td><QuotationStatusBadge status={q.status} /></Td>
                      <Td>
                        {q.myBid ? (
                          <BidStatusBadge status={q.myBid.status} />
                        ) : q.myInvite ? (
                          <InviteStatusBadge status={q.myInvite.status} />
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td numeric className="font-medium">
                        {q.myBid ? formatMoney(Number(q.myBid.totalAmount)) : '—'}
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
