import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, MessageSquareText, PiggyBank, ShoppingCart, UserCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { linkButtonClass } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { QuotationStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { DonutChart } from '@/components/charts/Charts';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { AdminOverview } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviadas',
  receiving: 'Recebendo',
  closed: 'Em análise',
  awarded: 'Aprovadas',
  cancelled: 'Canceladas',
};

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<AdminOverview>('/admin/overview'),
  });

  if (isLoading) return <LoadingBlock label="Carregando a plataforma..." />;
  if (error || !data) return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;

  const statusData = Object.entries(data.quotations)
    .filter(([k, v]) => k !== 'total' && v > 0)
    .map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }));

  return (
    <>
      <PageHeader title="Visão geral" description="A saúde da plataforma inteira em um lugar." />

      {data.users.pending > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/[0.07] px-4 py-3.5">
          <p className="flex items-center gap-2.5 text-sm text-foreground">
            <UserCheck className="h-4 w-4 shrink-0 text-warning" />
            <span>
              <strong className="font-semibold">{data.users.pending}</strong>{' '}
              {data.users.pending === 1 ? 'cadastro aguardando' : 'cadastros aguardando'} liberação de acesso.
            </span>
          </p>
          <Link to="/admin/usuarios?status=PENDING" className={linkButtonClass({ size: 'sm' })}>
            Revisar agora
          </Link>
        </div>
      )}

      {data.whatsapp.failed > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/35 bg-destructive/[0.06] px-4 py-3.5">
          <p className="flex items-center gap-2.5 text-sm text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span>
              <strong className="font-semibold">{data.whatsapp.failed}</strong> mensagens de WhatsApp falharam. Verifique
              a conexão do n8n.
            </span>
          </p>
          <Link to="/admin/whatsapp?status=FAILED" className={linkButtonClass({ size: 'sm', variant: 'outline' })}>
            Ver mensagens
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          label="Volume transacionado"
          value={formatMoney(data.gmv.awardedTotal)}
          hint={`${data.gmv.awardCount} pedidos aprovados`}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          label="Economia gerada"
          value={formatMoney(data.gmv.savingsTotal)}
          hint="para os compradores"
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <StatCard
          label="Empresas ativas"
          value={data.companies.buyers + data.companies.suppliers}
          hint={`${data.companies.buyers} compradores · ${data.companies.suppliers} fornecedores`}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          label="Usuários"
          value={data.users.active}
          hint={data.users.pending ? `${data.users.pending} aguardando liberação` : 'todos liberados'}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Cotações por situação" description={`${data.quotations.total} no total`} />
          <CardBody>
            {statusData.length ? <DonutChart data={statusData} /> : <EmptyState title="Nenhuma cotação ainda" />}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Últimas cotações"
            action={
              <Link to="/admin/cotacoes" className="text-sm font-medium text-primary hover:underline">
                Ver todas
              </Link>
            }
          />
          {data.recentQuotations.length ? (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Cotação</Th>
                    <Th>Comprador</Th>
                    <Th>Situação</Th>
                    <Th numeric>Propostas</Th>
                    <Th>Criada</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentQuotations.map((q) => (
                    <Tr key={q.id}>
                      <Td>
                        <span className="block font-medium">{q.title}</span>
                        <span className="num mt-0.5 block text-xs text-muted-foreground">{q.code}</span>
                      </Td>
                      <Td className="text-muted-foreground">{q.buyerCompany.name}</Td>
                      <Td><QuotationStatusBadge status={q.status} /></Td>
                      <Td numeric>{q._count.bids}/{q._count.invites}</Td>
                      <Td className="num text-muted-foreground">{formatDate(q.createdAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState title="Nenhuma cotação criada ainda" />
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Automação de WhatsApp" description="Mensagens trocadas pela plataforma" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Badge tone="primary">{data.whatsapp.total} mensagens</Badge>
            <Badge tone={data.whatsapp.failed ? 'danger' : 'success'}>
              <MessageSquareText className="h-3 w-3" />
              {data.whatsapp.failed} falhas
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Toda mensagem enviada ou recebida fica registrada. Se houver falhas, confira se o n8n está no ar e se as
            credenciais do WhatsApp continuam válidas.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
