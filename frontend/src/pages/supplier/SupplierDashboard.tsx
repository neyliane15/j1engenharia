import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Award, CalendarClock, Download, Package, Percent, TrendingUp, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button, linkButtonClass } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { FunnelBars, RankingChart, RevenueChart } from '@/components/charts/Charts';
import { api, downloadFile } from '@/lib/api';
import { formatDate, formatDeadline, formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SupplierDashboard as Dashboard } from '@/types';

export default function SupplierDashboard() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'supplier'],
    queryFn: () => api.get<Dashboard>('/dashboard/supplier'),
  });

  if (isLoading) return <LoadingBlock label="Montando o seu painel..." />;
  if (error || !data) return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;

  const { kpis, series, clients, topProducts, openInvites, funnel, recentAwards } = data;

  return (
    <>
      <PageHeader
        title="Meu painel"
        description="Quanto você faturou nas cotações aprovadas e quais clientes mais compram de você."
        action={
          <Button
            variant="outline"
            onClick={() =>
              downloadFile('/exports/supplier/revenue.xlsx', 'emptra-faturamento.xlsx').catch((e) =>
                toast.error('Falha ao baixar', e.message),
              )
            }
          >
            <Download className="h-4 w-4" />
            Baixar faturamento
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          label="Faturamento aprovado"
          value={formatMoney(kpis.revenue)}
          hint={`${kpis.orders} ${kpis.orders === 1 ? 'pedido' : 'pedidos'} nos últimos 12 meses`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Ticket médio"
          value={formatMoney(kpis.averageTicket)}
          hint={`${formatMoney(kpis.revenueAllTime)} desde o início`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Taxa de vitória"
          value={formatPercent(kpis.winRate, 0)}
          hint={`${kpis.won} de ${kpis.submitted} propostas enviadas`}
          icon={<Percent className="h-4 w-4" />}
        />
        <StatCard
          label="Cotações abertas"
          value={kpis.pendingInvites}
          hint={`${formatPercent(kpis.responseRate, 0)} de resposta`}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      {/* Cotações esperando resposta — a ação mais urgente do fornecedor */}
      {openInvites.length > 0 && (
        <Card className="mt-6 border-warning/40">
          <CardHeader
            title="Cotações esperando a sua proposta"
            description="Responda por aqui ou direto no WhatsApp"
            action={
              <Link to="/fornecedor/cotacoes" className={linkButtonClass({ variant: 'outline', size: 'sm' })}>
                Ver todas
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {openInvites.map((i) => {
              const deadline = formatDeadline(i.quotation.deadline);
              return (
                <li key={i.inviteId}>
                  <Link
                    to={`/fornecedor/cotacoes/${i.quotation.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-secondary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{i.quotation.title}</p>
                      <p className="num mt-0.5 text-xs text-muted-foreground">
                        {i.quotation.code} · {i.quotation.buyerCompany.name} · {i.quotation._count.items} itens
                      </p>
                    </div>
                    <span
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium',
                        deadline.tone === 'late' && 'text-destructive',
                        deadline.tone === 'warn' && 'text-warning',
                        deadline.tone === 'ok' && 'text-muted-foreground',
                      )}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      {deadline.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Faturamento por mês" description="Somente cotações aprovadas" />
          <CardBody>
            {series.some((s) => s.revenue > 0) ? (
              <RevenueChart data={series} />
            ) : (
              <EmptyState title="Sem faturamento ainda" description="Ganhe a primeira cotação para ver a curva aqui." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Do convite ao pedido" description="Sua conversão na plataforma" />
          <CardBody>
            <FunnelBars data={funnel} />
            <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Taxa de resposta</dt>
                <dd className="num font-medium">{formatPercent(kpis.responseRate, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Taxa de vitória</dt>
                <dd className="num font-medium">{formatPercent(kpis.winRate, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Clientes ativos</dt>
                <dd className="num font-medium">{kpis.clients}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Seus clientes" description="Ranking por faturamento aprovado" />
          {clients.length ? (
            <>
              <CardBody className="pb-1">
                <RankingChart data={clients.slice(0, 5).map((c) => ({ name: c.name, value: c.revenue }))} />
              </CardBody>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Cliente</Th>
                      <Th numeric>Pedidos</Th>
                      <Th numeric>Faturamento</Th>
                      <Th>Último</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <Tr key={c.clientId}>
                        <Td className="font-medium">{c.name}</Td>
                        <Td numeric>{c.orders}</Td>
                        <Td numeric className="font-semibold">{formatMoney(c.revenue)}</Td>
                        <Td className="num text-muted-foreground">{formatDate(c.lastAt)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </>
          ) : (
            <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum cliente ainda" description="Sua primeira venda aprovada aparece aqui." />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Produtos mais vendidos" />
            <CardBody>
              {topProducts.length ? (
                <RankingChart data={topProducts.slice(0, 6).map((p) => ({ name: p.name.slice(0, 26), value: p.total }))} />
              ) : (
                <EmptyState icon={<Package className="h-5 w-5" />} title="Sem produtos aprovados" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Últimos pedidos ganhos"
              action={
                <Link to="/fornecedor/pedidos" className="text-sm font-medium text-primary hover:underline">
                  Ver todos
                </Link>
              }
            />
            {recentAwards.length ? (
              <ul className="divide-y divide-border">
                {recentAwards.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.quotation.buyerCompany.name}</p>
                      <p className="num mt-0.5 text-xs text-muted-foreground">
                        {a.quotation.code} · {a.itemCount} itens · {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="num text-sm font-semibold">{formatMoney(a.total)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadFile(`/exports/awards/${a.id}.xlsx`, `${a.quotation.code}.xlsx`).catch((e) =>
                            toast.error('Falha ao baixar', e.message),
                          )
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Award className="h-5 w-5" />} title="Nenhum pedido ganho ainda" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
