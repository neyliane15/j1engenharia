import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, PiggyBank, Plus, ShoppingCart, Timer, TrendingDown, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { linkButtonClass } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { QuotationStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { DonutChart, PurchasesChart, RankingChart } from '@/components/charts/Charts';
import { api } from '@/lib/api';
import { formatDate, formatDeadline, formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BuyerDashboard as Dashboard } from '@/types';

export default function BuyerDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'buyer'],
    queryFn: () => api.get<Dashboard>('/dashboard/buyer'),
  });

  if (isLoading) return <LoadingBlock label="Montando o seu painel..." />;
  if (error || !data) return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;

  const { kpis, series, topSuppliers, categories, upcoming, recentAwards } = data;

  return (
    <>
      <PageHeader
        title="Meu painel"
        description="Onde o seu dinheiro está indo e quanto a concorrência entre fornecedores está rendendo."
        action={
          <Link to="/comprador/cotacoes/nova" className={linkButtonClass()}>
            <Plus className="mr-2 h-4 w-4" />
            Nova cotação
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          label="Economia gerada"
          value={formatMoney(kpis.totalSavings)}
          hint={`${formatPercent(kpis.savingsPct)} abaixo da média das propostas`}
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <StatCard
          label="Total comprado"
          value={formatMoney(kpis.totalAwarded)}
          hint={`${kpis.orders} ${kpis.orders === 1 ? 'pedido aprovado' : 'pedidos aprovados'}`}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          label="Ticket médio"
          value={formatMoney(kpis.averageTicket)}
          hint={`${kpis.quotationsTotal} cotações no total`}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Cotações abertas"
          value={kpis.openQuotations}
          hint={`${formatPercent(kpis.supplierResponseRate, 0)} dos fornecedores respondem`}
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Comprado x economizado" description="Últimos 12 meses" />
          <CardBody>
            {series.some((s) => s.purchased > 0) ? (
              <PurchasesChart data={series} />
            ) : (
              <EmptyState title="Sem histórico ainda" description="Aprove a primeira cotação para ver a curva aqui." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Onde você gasta" description="Por família de material" />
          <CardBody>
            {categories.length ? (
              <DonutChart data={categories.map((c) => ({ name: c.name, value: c.total }))} />
            ) : (
              <EmptyState title="Sem compras aprovadas" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Melhores fornecedores"
            description="Ranking por valor aprovado"
            action={
              <Link to="/comprador/fornecedores" className="text-sm font-medium text-primary hover:underline">
                Ver todos
              </Link>
            }
          />
          {topSuppliers.length ? (
            <>
              <CardBody className="pb-1">
                <RankingChart
                  data={topSuppliers.slice(0, 5).map((s) => ({ name: s.name, value: s.total }))}
                />
              </CardBody>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Fornecedor</Th>
                      <Th numeric>Comprado</Th>
                      <Th numeric>Economia</Th>
                      <Th numeric>Resposta</Th>
                      <Th numeric>Vitórias</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSuppliers.slice(0, 6).map((s) => (
                      <Tr key={s.supplierId}>
                        <Td className="font-medium">{s.name}</Td>
                        <Td numeric>{formatMoney(s.total)}</Td>
                        <Td numeric className="text-success">{formatMoney(s.savings)}</Td>
                        <Td numeric>{formatPercent(s.responseRate, 0)}</Td>
                        <Td numeric>
                          <Badge tone={s.winRate >= 50 ? 'success' : 'neutral'}>{formatPercent(s.winRate, 0)}</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </>
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Nenhum fornecedor com pedido aprovado"
              description="Assim que você aprovar uma cotação, o ranking aparece aqui."
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Cotações em andamento"
              description="Prazos mais próximos primeiro"
              action={
                <Link to="/comprador/cotacoes" className="text-sm font-medium text-primary hover:underline">
                  Ver todas
                </Link>
              }
            />
            {upcoming.length ? (
              <ul className="divide-y divide-border">
                {upcoming.map((q) => {
                  const deadline = formatDeadline(q.deadline);
                  return (
                    <li key={q.id}>
                      <Link
                        to={`/comprador/cotacoes/${q.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-secondary/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{q.title}</p>
                          <p className="num mt-0.5 text-xs text-muted-foreground">
                            {q.code} · {q._count.bids}/{q._count.invites} responderam
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <QuotationStatusBadge status={q.status} />
                          <p
                            className={cn(
                              'mt-1 flex items-center justify-end gap-1 text-xs',
                              deadline.tone === 'late' && 'text-destructive',
                              deadline.tone === 'warn' && 'text-warning',
                              deadline.tone === 'ok' && 'text-muted-foreground',
                            )}
                          >
                            <CalendarClock className="h-3 w-3" />
                            {deadline.label}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Nenhuma cotação aberta"
                description="Crie uma cotação e dispare para os fornecedores em um clique."
                action={
                  <Link to="/comprador/cotacoes/nova" className={linkButtonClass({ size: 'sm' })}>
                    Criar cotação
                  </Link>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Últimas aprovações" />
            {recentAwards.length ? (
              <ul className="divide-y divide-border">
                {recentAwards.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{a.supplier}</p>
                      <p className="num mt-0.5 text-xs text-muted-foreground">
                        {a.quotation.code} · {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num text-sm font-semibold text-foreground">{formatMoney(a.total)}</p>
                      <p className="num text-xs text-success">−{formatMoney(a.savings)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhuma aprovação ainda" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
