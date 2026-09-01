import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  Ban,
  CalendarClock,
  Crown,
  Download,
  Lock,
  MessageSquareText,
  Send,
  Split,
  TrendingDown,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, linkButtonClass } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { InviteStatusBadge, QuotationStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api, ApiError, downloadFile } from '@/lib/api';
import { formatDate, formatDateTime, formatDeadline, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Comparison, Quotation } from '@/types';

type AwardMode = 'single' | 'split';

export default function QuotationDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const qc = useQueryClient();

  const [awardOpen, setAwardOpen] = useState(false);
  const [mode, setMode] = useState<AwardMode>('single');
  const [singleBid, setSingleBid] = useState('');
  /** itemId → bidId, para a compra dividida. */
  const [splitChoice, setSplitChoice] = useState<Record<string, string>>({});

  const quotationQuery = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => api.get<{ quotation: Quotation }>(`/quotations/${id}`),
  });

  const quotation = quotationQuery.data?.quotation;

  const comparisonQuery = useQuery({
    queryKey: ['comparison', id],
    queryFn: () => api.get<Comparison>(`/quotations/${id}/comparison`),
    enabled: Boolean(quotation) && quotation!.status !== 'DRAFT',
  });

  const comparison = comparisonQuery.data;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['quotation', id] });
    void qc.invalidateQueries({ queryKey: ['comparison', id] });
    void qc.invalidateQueries({ queryKey: ['quotations'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const dispatch = useMutation({
    mutationFn: () => api.post<{ dispatched: { ok: boolean; supplierName: string; reason?: string }[]; message: string }>(`/quotations/${id}/dispatch`),
    onSuccess: (r) => {
      const failed = r.dispatched.filter((d) => !d.ok);
      if (failed.length) toast.warning('Envio parcial', r.message);
      else toast.success('Cotação enviada!', `${r.dispatched.length} fornecedores receberam no WhatsApp.`);
      invalidate();
    },
    onError: (e) => toast.error('Falha no envio', e instanceof ApiError ? e.message : undefined),
  });

  const close = useMutation({
    mutationFn: () => api.post(`/quotations/${id}/close`),
    onSuccess: () => {
      toast.success('Cotação encerrada', 'Já pode comparar e aprovar.');
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível encerrar', e instanceof ApiError ? e.message : undefined),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/quotations/${id}/cancel`, { reason: 'Cancelada pelo comprador' }),
    onSuccess: () => {
      toast.success('Cotação cancelada');
      invalidate();
    },
  });

  const award = useMutation({
    mutationFn: () => {
      if (mode === 'single') {
        return api.post<{ message: string; totalSavings: number }>(`/quotations/${id}/award`, {
          selections: [{ bidId: singleBid }],
        });
      }
      // Agrupa os itens escolhidos por fornecedor.
      const byBid = new Map<string, string[]>();
      for (const [itemId, bidId] of Object.entries(splitChoice)) {
        if (!bidId) continue;
        byBid.set(bidId, [...(byBid.get(bidId) ?? []), itemId]);
      }
      return api.post<{ message: string; totalSavings: number }>(`/quotations/${id}/award`, {
        selections: [...byBid.entries()].map(([bidId, quotationItemIds]) => ({ bidId, quotationItemIds })),
      });
    },
    onSuccess: (r) => {
      setAwardOpen(false);
      toast.success('Cotação aprovada!', r.message);
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível aprovar', e instanceof ApiError ? e.message : undefined),
  });

  /** Total do cenário escolhido no diálogo de aprovação. */
  const awardPreview = useMemo(() => {
    if (!comparison) return { total: 0, suppliers: 0, items: 0 };
    if (mode === 'single') {
      const s = comparison.suppliers.find((x) => x.bidId === singleBid);
      return { total: s?.total ?? 0, suppliers: s ? 1 : 0, items: s?.itemsQuoted ?? 0 };
    }
    let total = 0;
    const bids = new Set<string>();
    let items = 0;
    for (const row of comparison.rows) {
      const bidId = splitChoice[row.itemId];
      if (!bidId) continue;
      const cell = row.cells.find((c) => c.bidId === bidId);
      if (!cell?.available) continue;
      total += cell.total;
      bids.add(bidId);
      items++;
    }
    return { total: Math.round(total * 100) / 100, suppliers: bids.size, items };
  }, [comparison, mode, singleBid, splitChoice]);

  function openAward() {
    if (!comparison?.suppliers.length) return;
    setSingleBid(comparison.suppliers[0].bidId);
    setSplitChoice(
      Object.fromEntries(
        comparison.rows.map((r) => [r.itemId, r.cells.find((c) => c.isBest)?.bidId ?? '']),
      ),
    );
    setAwardOpen(true);
  }

  if (quotationQuery.isLoading) return <LoadingBlock label="Carregando a cotação..." />;
  if (quotationQuery.error || !quotation)
    return <ErrorState message={(quotationQuery.error as Error)?.message} onRetry={() => void quotationQuery.refetch()} />;

  const deadline = formatDeadline(quotation.deadline);
  const isOpen = quotation.status === 'SENT' || quotation.status === 'RECEIVING';
  const canAward = ['RECEIVING', 'CLOSED'].includes(quotation.status) && (comparison?.suppliers.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={quotation.title}
        description={`${quotation.code} · criada em ${formatDate(quotation.createdAt)}${quotation.project ? ` · ${quotation.project.name}` : ''}`}
        badge={<QuotationStatusBadge status={quotation.status} />}
        action={
          <>
            <Link to="/comprador/cotacoes" className={linkButtonClass({ variant: 'outline' })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>

            {quotation.status === 'DRAFT' && (
              <Button loading={dispatch.isPending} onClick={() => dispatch.mutate()}>
                <Send className="h-4 w-4" />
                Enviar no WhatsApp
              </Button>
            )}

            {isOpen && (
              <Button variant="outline" loading={close.isPending} onClick={() => close.mutate()}>
                <Lock className="h-4 w-4" />
                Encerrar prazo
              </Button>
            )}

            {canAward && (
              <Button onClick={openAward}>
                <Award className="h-4 w-4" />
                Aprovar cotação
              </Button>
            )}

            {quotation.status !== 'DRAFT' && (
              <Button
                variant="outline"
                onClick={() =>
                  downloadFile(`/exports/quotations/${id}/comparison.xlsx`, `${quotation.code}-comparativo.xlsx`).catch(
                    (e) => toast.error('Falha ao baixar', e.message),
                  )
                }
              >
                <Download className="h-4 w-4" />
                XLSX
              </Button>
            )}
          </>
        }
      />

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Prazo de resposta"
          value={<span className="text-lg">{formatDateTime(quotation.deadline)}</span>}
          hint={deadline.label}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Fornecedores"
          value={`${quotation.invites?.filter((i) => i.status === 'RESPONDED').length ?? 0}/${quotation.invites?.length ?? 0}`}
          hint="responderam"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Melhor cenário"
          value={formatMoney(comparison?.totals.bestScenarioTotal ?? 0)}
          hint={
            comparison?.totals.splitGain
              ? `${formatMoney(comparison.totals.splitGain)} a menos que comprar tudo de um só fornecedor`
              : 'comprando cada item pelo melhor preço'
          }
          icon={<TrendingDown className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Economia potencial"
          value={formatMoney(comparison?.totals.potentialSavings ?? 0)}
          hint={`${formatPercent(comparison?.totals.potentialSavingsPct ?? 0)} contra a média recebida`}
          icon={<Award className="h-4 w-4" />}
        />
      </div>

      {/* Aprovações feitas */}
      {quotation.awards?.length ? (
        <Card className="mt-6 border-success/35">
          <CardHeader title="Aprovação" description="Fornecedores escolhidos e economia realizada" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Fornecedor</Th>
                  <Th numeric>Itens</Th>
                  <Th numeric>Valor aprovado</Th>
                  <Th numeric>Economia</Th>
                  <Th>Data</Th>
                </tr>
              </thead>
              <tbody>
                {quotation.awards.map((a) => (
                  <Tr key={a.id}>
                    <Td className="font-medium">
                      <Crown className="mr-1.5 inline h-4 w-4 text-warning" />
                      {a.supplierCompany?.tradeName || a.supplierCompany?.name}
                    </Td>
                    <Td numeric>{a.items?.length ?? 0}</Td>
                    <Td numeric className="font-semibold">{formatMoney(Number(a.totalAmount))}</Td>
                    <Td numeric className="text-success">{formatMoney(Number(a.savings))}</Td>
                    <Td>{formatDate(a.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      {/* Comparativo */}
      <Card className="mt-6">
        <CardHeader
          title="Mapa comparativo"
          description={
            comparison?.suppliers.length
              ? `${comparison.suppliers.length} propostas · verde marca o melhor preço de cada item`
              : 'Assim que as propostas chegarem, o comparativo aparece aqui'
          }
        />

        {quotation.status === 'DRAFT' ? (
          <EmptyState
            icon={<Send className="h-5 w-5" />}
            title="Cotação ainda em rascunho"
            description="Dispare no WhatsApp para começar a receber propostas."
            action={
              <Button size="sm" loading={dispatch.isPending} onClick={() => dispatch.mutate()}>
                Enviar agora
              </Button>
            }
          />
        ) : comparisonQuery.isLoading ? (
          <LoadingBlock />
        ) : !comparison?.suppliers.length ? (
          <EmptyState
            icon={<MessageSquareText className="h-5 w-5" />}
            title="Nenhuma proposta recebida ainda"
            description="Os fornecedores respondem pelo WhatsApp e as propostas caem aqui automaticamente."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="sticky left-0 z-20 min-w-[240px] bg-secondary/90">Item</Th>
                  <Th numeric>Qtd.</Th>
                  {comparison.suppliers.map((s) => (
                    <Th key={s.bidId} numeric className="min-w-[132px]">
                      <span className="block truncate">{s.supplierName}</span>
                      <span className="num mt-0.5 block text-[10px] font-normal normal-case text-muted-foreground">
                        {s.source === 'WHATSAPP' ? 'via WhatsApp' : 'via site'}
                      </span>
                    </Th>
                  ))}
                  <Th numeric>Economia do item</Th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => {
                  const saving =
                    row.averageUnitPrice !== null && row.bestUnitPrice !== null
                      ? (row.averageUnitPrice - row.bestUnitPrice) * row.quantity
                      : 0;
                  return (
                    <Tr key={row.itemId}>
                      <Td className="sticky left-0 z-10 bg-card">
                        <span className="block text-sm font-medium text-foreground">
                          <span className="num mr-1.5 text-muted-foreground">{row.position}.</span>
                          {row.description}
                        </span>
                        {row.brandRef && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">ref. {row.brandRef}</span>
                        )}
                      </Td>
                      <Td numeric className="text-muted-foreground">
                        {formatNumber(row.quantity)} {row.unit}
                      </Td>
                      {comparison.suppliers.map((s) => {
                        const cell = row.cells.find((c) => c.bidId === s.bidId);
                        if (!cell?.available) {
                          return (
                            <Td key={s.bidId} numeric className="text-muted-foreground/60">
                              —
                            </Td>
                          );
                        }
                        return (
                          <Td
                            key={s.bidId}
                            numeric
                            className={cn(cell.isBest && 'bg-success/[0.08] font-semibold text-success')}
                          >
                            {formatMoney(cell.unitPrice)}
                            {!cell.isBest && cell.deltaToBestPct > 0 && (
                              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                                +{formatPercent(cell.deltaToBestPct, 0)}
                              </span>
                            )}
                            {cell.brand && (
                              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                                {cell.brand}
                              </span>
                            )}
                          </Td>
                        );
                      })}
                      <Td numeric className={cn(saving > 0 ? 'text-success' : 'text-muted-foreground')}>
                        {saving > 0 ? formatMoney(saving) : '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-brand-deep text-brand-deep-foreground">
                  <td className="sticky left-0 z-10 bg-brand-deep px-4 py-3 text-sm font-semibold">Total da proposta</td>
                  <td className="px-4 py-3" />
                  {comparison.suppliers.map((s) => (
                    <td key={s.bidId} className="num px-4 py-3 text-right text-sm font-semibold">
                      {formatMoney(s.total)}
                      {s.rankByTotal === 1 && (
                        <span className="mt-0.5 block text-[11px] font-normal text-sidebar-primary">menor total</span>
                      )}
                    </td>
                  ))}
                  <td className="num px-4 py-3 text-right text-sm font-semibold">
                    {formatMoney(comparison.totals.potentialSavings)}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </TableWrap>
        )}

        {comparison?.suppliers.length ? (
          <CardBody className="border-t border-border">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {comparison.suppliers.map((s) => (
                <div key={s.bidId} className="rounded-md border border-border bg-secondary/30 p-3">
                  <p className="truncate text-sm font-medium text-foreground">{s.supplierName}</p>
                  <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <dt>Frete</dt>
                      <dd className="num">{s.freight ? formatMoney(s.freight) : 'incluso'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Entrega</dt>
                      <dd className="num">{s.deliveryDays ? `${s.deliveryDays} dias` : '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Pagamento</dt>
                      <dd className="truncate">{s.paymentTerms ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Cobertura</dt>
                      <dd className="num">{s.itemsQuoted}/{comparison.totals.itemCount}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </CardBody>
        ) : null}
      </Card>

      {/* Fornecedores convidados */}
      <Card className="mt-6">
        <CardHeader title="Fornecedores convidados" description="Situação de cada convite enviado" />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Fornecedor</Th>
                <Th>Cidade</Th>
                <Th>Situação</Th>
                <Th>Enviado</Th>
                <Th>Respondeu</Th>
              </tr>
            </thead>
            <tbody>
              {quotation.invites?.map((i) => (
                <Tr key={i.id}>
                  <Td className="font-medium">{i.supplierCompany?.tradeName || i.supplierCompany?.name}</Td>
                  <Td className="text-muted-foreground">
                    {[i.supplierCompany?.city, i.supplierCompany?.state].filter(Boolean).join('/') || '—'}
                  </Td>
                  <Td>
                    <InviteStatusBadge status={i.status} />
                    {i.declineReason && (
                      <span className="mt-1 block text-xs text-muted-foreground">{i.declineReason}</span>
                    )}
                  </Td>
                  <Td className="num text-muted-foreground">{formatDateTime(i.sentAt)}</Td>
                  <Td className="num text-muted-foreground">{formatDateTime(i.respondedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      {quotation.status === 'DRAFT' && (
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" className="text-destructive" onClick={() => cancel.mutate()}>
            <Ban className="h-4 w-4" />
            Cancelar cotação
          </Button>
        </div>
      )}

      {/* Diálogo de aprovação */}
      <Modal
        open={awardOpen}
        onClose={() => setAwardOpen(false)}
        title="Aprovar cotação"
        description="Escolha um fornecedor para tudo ou divida item a item pelo melhor preço."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setAwardOpen(false)}>Cancelar</Button>
            <Button
              loading={award.isPending}
              disabled={mode === 'single' ? !singleBid : awardPreview.items === 0}
              onClick={() => award.mutate()}
            >
              <Award className="h-4 w-4" />
              Aprovar {formatMoney(awardPreview.total)}
            </Button>
          </>
        }
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: 'single', icon: Crown, title: 'Fornecedor único', text: 'Tudo com um só fornecedor.' },
              { value: 'split', icon: Split, title: 'Compra dividida', text: 'Cada item com quem tem o melhor preço.' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={cn(
                'flex items-start gap-3 rounded-md border p-3.5 text-left transition-colors',
                mode === opt.value ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/25' : 'border-border hover:border-primary/35',
              )}
            >
              <opt.icon className={cn('mt-0.5 h-5 w-5 shrink-0', mode === opt.value ? 'text-primary' : 'text-muted-foreground')} />
              <span>
                <span className="block text-sm font-medium">{opt.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{opt.text}</span>
              </span>
            </button>
          ))}
        </div>

        {mode === 'single' ? (
          <ul className="space-y-2">
            {comparison?.suppliers.map((s) => (
              <li key={s.bidId}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border p-3.5 transition-colors',
                    singleBid === s.bidId ? 'border-primary bg-primary/[0.06]' : 'border-border hover:border-primary/35',
                  )}
                >
                  <input
                    type="radio"
                    name="award-bid"
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={singleBid === s.bidId}
                    onChange={() => setSingleBid(s.bidId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {s.supplierName}
                      {s.rankByTotal === 1 && <Badge tone="success">menor total</Badge>}
                      {s.itemsMissing > 0 && <Badge tone="warning">{s.itemsMissing} item(ns) sem preço</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {s.deliveryDays ? `${s.deliveryDays} dias` : 'prazo não informado'} ·{' '}
                      {s.paymentTerms ?? 'pagamento não informado'} · {s.bestPriceCount} melhores preços
                    </span>
                  </span>
                  <span className="num shrink-0 text-right text-sm font-semibold">{formatMoney(s.total)}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Fornecedor escolhido</Th>
                  <Th numeric>Total do item</Th>
                </tr>
              </thead>
              <tbody>
                {comparison?.rows.map((row) => {
                  const chosen = splitChoice[row.itemId];
                  const cell = row.cells.find((c) => c.bidId === chosen);
                  return (
                    <Tr key={row.itemId}>
                      <Td>
                        <span className="text-sm font-medium">
                          <span className="num mr-1.5 text-muted-foreground">{row.position}.</span>
                          {row.description}
                        </span>
                      </Td>
                      <Td>
                        <select
                          value={chosen ?? ''}
                          onChange={(e) => setSplitChoice((p) => ({ ...p, [row.itemId]: e.target.value }))}
                          className="h-9 w-full min-w-[190px] rounded-md border border-input bg-card px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
                        >
                          <option value="">Não comprar este item</option>
                          {row.cells
                            .filter((c) => c.available)
                            .map((c) => (
                              <option key={c.bidId} value={c.bidId}>
                                {c.supplierName} — {formatMoney(c.unitPrice)}
                                {c.isBest ? ' (melhor)' : ''}
                              </option>
                            ))}
                        </select>
                      </Td>
                      <Td numeric>{cell?.available ? formatMoney(cell.total) : '—'}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}

        <div className="mt-5 rounded-md border border-border bg-secondary/40 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {awardPreview.items} {awardPreview.items === 1 ? 'item' : 'itens'} ·{' '}
                {awardPreview.suppliers} {awardPreview.suppliers === 1 ? 'fornecedor' : 'fornecedores'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Os vencedores recebem o aviso no WhatsApp com a planilha dos produtos aprovados.
              </p>
            </div>
            <p className="num text-xl font-semibold text-foreground">{formatMoney(awardPreview.total)}</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
