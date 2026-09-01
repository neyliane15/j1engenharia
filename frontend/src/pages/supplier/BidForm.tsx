import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, MessageSquareText, Save, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, linkButtonClass } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { BidStatusBadge, QuotationStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatMoney, formatNumber, parseMoneyInput } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Bid, Quotation, QuotationInvite } from '@/types';

interface Line {
  quotationItemId: string;
  position: number;
  description: string;
  unit: string;
  quantity: number;
  brandRef: string | null;
  unitPrice: string;
  brand: string;
  available: boolean;
}

export default function BidForm() {
  const { id = '' } = useParams();
  const toast = useToast();
  const qc = useQueryClient();

  const [lines, setLines] = useState<Line[]>([]);
  const [deliveryDays, setDeliveryDays] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [freight, setFreight] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['quotation', id, 'supplier'],
    queryFn: () =>
      api.get<{ quotation: Quotation; myInvite?: QuotationInvite; myBid?: Bid | null }>(`/quotations/${id}`),
  });

  // Preenche o formulário quando a cotação chega (ou quando o robô do
  // WhatsApp já registrou preços).
  useEffect(() => {
    if (!data?.quotation.items) return;
    const bid = data.myBid;
    setLines(
      data.quotation.items.map((item) => {
        const bidItem = bid?.items?.find((b) => b.quotationItemId === item.id);
        return {
          quotationItemId: item.id,
          position: item.position,
          description: item.description,
          unit: item.unit,
          quantity: Number(item.quantity),
          brandRef: item.brandRef ?? null,
          unitPrice: bidItem && Number(bidItem.unitPrice) > 0 ? String(Number(bidItem.unitPrice)) : '',
          brand: bidItem?.brand ?? item.brandRef ?? '',
          available: bidItem ? bidItem.available : true,
        };
      }),
    );
    if (bid) {
      setDeliveryDays(bid.deliveryDays ? String(bid.deliveryDays) : '');
      setPaymentTerms(bid.paymentTerms ?? '');
      setFreight(Number(bid.freight) ? String(Number(bid.freight)) : '');
      setDiscount(Number(bid.discount) ? String(Number(bid.discount)) : '');
      setNotes(bid.notes ?? '');
    }
  }, [data]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (acc, l) => (l.available ? acc + parseMoneyInput(l.unitPrice) * l.quantity : acc),
      0,
    );
    const f = parseMoneyInput(freight);
    const d = parseMoneyInput(discount);
    const missing = lines.filter((l) => l.available && parseMoneyInput(l.unitPrice) <= 0).length;
    return { subtotal, freight: f, discount: d, total: Math.max(0, subtotal + f - d), missing };
  }, [lines, freight, discount]);

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      api.put<{ message: string }>(`/bids/quotation/${id}`, {
        deliveryDays: deliveryDays ? Number(deliveryDays) : undefined,
        paymentTerms: paymentTerms || undefined,
        freight: parseMoneyInput(freight),
        discount: parseMoneyInput(discount),
        notes: notes || undefined,
        submit,
        items: lines.map((l) => ({
          quotationItemId: l.quotationItemId,
          unitPrice: parseMoneyInput(l.unitPrice),
          brand: l.brand || undefined,
          available: l.available,
        })),
      }),
    onSuccess: (r) => {
      toast.success(r.message);
      void qc.invalidateQueries({ queryKey: ['quotation', id] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'supplier'] });
    },
    onError: (e) => toast.error('Não foi possível salvar', e instanceof ApiError ? e.message : undefined),
  });

  const decline = useMutation({
    mutationFn: () => api.post(`/bids/quotation/${id}/decline`, { reason: 'Não vou participar desta cotação' }),
    onSuccess: () => {
      toast.success('Participação recusada', 'O comprador foi avisado.');
      void qc.invalidateQueries({ queryKey: ['quotation', id] });
    },
  });

  if (isLoading) return <LoadingBlock label="Carregando a cotação..." />;
  if (error || !data) return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;

  const { quotation, myBid } = data;
  const locked =
    myBid?.status === 'APPROVED' ||
    quotation.status === 'AWARDED' ||
    quotation.status === 'CANCELLED' ||
    (new Date(quotation.deadline) < new Date() && quotation.status !== 'CLOSED');

  function updateLine(itemId: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.quotationItemId === itemId ? { ...l, ...patch } : l)));
  }

  return (
    <>
      <PageHeader
        title={quotation.title}
        description={`${quotation.code} · ${quotation.buyerCompany?.name} · prazo ${formatDateTime(quotation.deadline)}`}
        badge={
          <>
            <QuotationStatusBadge status={quotation.status} />
            {myBid && <BidStatusBadge status={myBid.status} />}
          </>
        }
        action={
          <Link to="/fornecedor/cotacoes" className={linkButtonClass({ variant: 'outline' })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        }
      />

      {locked && (
        <div className="mb-6 rounded-md border border-warning/40 bg-warning/[0.07] px-4 py-3 text-sm text-foreground">
          {myBid?.status === 'APPROVED'
            ? 'Sua proposta foi aprovada e não pode mais ser alterada. Baixe a planilha em "Pedidos ganhos".'
            : 'Esta cotação está fechada para novas propostas.'}
        </div>
      )}

      <div className="mb-6 rounded-md border border-primary/25 bg-primary/[0.05] px-4 py-3">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <MessageSquareText className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <span>
            Prefere responder pelo WhatsApp? Mande <code className="num rounded bg-card px-1 py-1 text-xs">1 45,90</code>{' '}
            para cada item e <code className="num rounded bg-card px-1 py-1 text-xs">ENVIAR</code> no fim. O que chegar
            por lá aparece preenchido aqui.
          </span>
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Itens da cotação" description="Informe o preço unitário de cada item" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th numeric>Quantidade</Th>
                  <Th numeric className="min-w-[140px]">Preço unitário</Th>
                  <Th className="min-w-[130px]">Marca</Th>
                  <Th numeric>Total</Th>
                  <Th>Tenho</Th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const price = parseMoneyInput(l.unitPrice);
                  return (
                    <Tr key={l.quotationItemId} className={cn(!l.available && 'opacity-55')}>
                      <Td>
                        <span className="block text-sm font-medium text-foreground">
                          <span className="num mr-2 text-muted-foreground">{l.position}.</span>
                          {l.description}
                        </span>
                        {l.brandRef && <span className="mt-1 block text-xs text-muted-foreground">ref. {l.brandRef}</span>}
                      </Td>
                      <Td numeric className="whitespace-nowrap text-muted-foreground">
                        {formatNumber(l.quantity)} {l.unit}
                      </Td>
                      <Td numeric>
                        <Input
                          numeric
                          inputMode="decimal"
                          placeholder="0,00"
                          disabled={locked || !l.available}
                          value={l.unitPrice}
                          onChange={(e) => updateLine(l.quotationItemId, { unitPrice: e.target.value })}
                          className="h-9"
                          wrapperClassName="w-full"
                        />
                      </Td>
                      <Td>
                        <Input
                          placeholder="Marca"
                          disabled={locked || !l.available}
                          value={l.brand}
                          onChange={(e) => updateLine(l.quotationItemId, { brand: e.target.value })}
                          className="h-9"
                          wrapperClassName="w-full"
                        />
                      </Td>
                      <Td numeric className="whitespace-nowrap font-medium">
                        {l.available && price > 0 ? formatMoney(price * l.quantity) : '—'}
                      </Td>
                      <Td>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[hsl(var(--primary))]"
                            disabled={locked}
                            checked={l.available}
                            onChange={(e) => updateLine(l.quotationItemId, { available: e.target.checked })}
                          />
                          <span className="text-xs text-muted-foreground">{l.available ? 'sim' : 'não'}</span>
                        </label>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-24">
            <CardHeader title="Condições comerciais" />
            <CardBody className="space-y-4">
              <Input
                label="Prazo de entrega (dias)"
                type="number"
                min="0"
                numeric
                disabled={locked}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                placeholder="7"
              />
              <Input
                label="Condição de pagamento"
                disabled={locked}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="30/60 dias"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Frete"
                  numeric
                  inputMode="decimal"
                  disabled={locked}
                  value={freight}
                  onChange={(e) => setFreight(e.target.value)}
                  placeholder="0,00"
                />
                <Input
                  label="Desconto"
                  numeric
                  inputMode="decimal"
                  disabled={locked}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <Textarea
                label="Observações"
                disabled={locked}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições especiais, prazo de validade da proposta..."
              />

              <dl className="space-y-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="num">{formatMoney(totals.subtotal)}</dd>
                </div>
                {totals.freight > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Frete</dt>
                    <dd className="num">{formatMoney(totals.freight)}</dd>
                  </div>
                )}
                {totals.discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Desconto</dt>
                    <dd className="num text-success">−{formatMoney(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
                  <dt>Total</dt>
                  <dd className="num">{formatMoney(totals.total)}</dd>
                </div>
              </dl>

              {totals.missing > 0 && (
                <p className="rounded-md border border-warning/40 bg-warning/[0.07] px-3 py-2 text-xs text-foreground">
                  Faltam {totals.missing} {totals.missing === 1 ? 'item' : 'itens'} sem preço. Marque como
                  indisponível o que você não tiver.
                </p>
              )}
            </CardBody>

            {!locked && (
              <div className="space-y-2 border-t border-border bg-secondary/40 p-4">
                <Button
                  className="w-full"
                  size="lg"
                  loading={save.isPending}
                  disabled={totals.missing > 0 || totals.total <= 0}
                  onClick={() => save.mutate(true)}
                >
                  <Send className="h-4 w-4" />
                  Enviar proposta
                </Button>
                <Button className="w-full" variant="outline" disabled={save.isPending} onClick={() => save.mutate(false)}>
                  <Save className="h-4 w-4" />
                  Salvar rascunho
                </Button>
                <Button
                  className="w-full text-destructive"
                  variant="ghost"
                  size="sm"
                  loading={decline.isPending}
                  onClick={() => decline.mutate()}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Não vou participar
                </Button>
              </div>
            )}
          </Card>

          {quotation.description && (
            <Card>
              <CardHeader title="Observações do comprador" />
              <CardBody className="text-sm leading-relaxed text-muted-foreground">{quotation.description}</CardBody>
            </Card>
          )}

          {quotation.deliveryAddress && (
            <Card>
              <CardHeader title="Entrega" />
              <CardBody className="space-y-2 text-sm">
                <p className="text-muted-foreground">{quotation.deliveryAddress}</p>
                {quotation.paymentTerms && (
                  <Badge tone="outline">Pagamento desejado: {quotation.paymentTerms}</Badge>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
