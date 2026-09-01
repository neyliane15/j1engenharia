import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, Building2, CalendarClock, CheckCircle2, Send } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatMoney, formatNumber, parseMoneyInput } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PublicQuotation {
  invite: { id: string; status: string; token: string };
  supplier: { id: string; name: string; tradeName: string | null };
  quotation: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    deadline: string;
    deliveryAddress: string | null;
    paymentTerms: string | null;
    project: { name: string } | null;
    buyer: { name: string; city: string | null; state: string | null };
    contact: { name: string; email: string };
    items: {
      id: string;
      position: number;
      description: string;
      unit: string;
      quantity: number;
      brandRef: string | null;
      notes: string | null;
    }[];
  };
  bid: {
    id: string;
    status: string;
    deliveryDays: number | null;
    paymentTerms: string | null;
    freight: number;
    discount: number;
    notes: string | null;
    totalAmount: number;
    items: { quotationItemId: string; unitPrice: number; brand: string | null; available: boolean }[];
  } | null;
  expired: boolean;
  closed: boolean;
}

interface Line {
  quotationItemId: string;
  unitPrice: string;
  brand: string;
  available: boolean;
}

/**
 * Página aberta pelo link do WhatsApp — sem login.
 * O fornecedor que prefere digitar numa tabela usa esta tela; quem prefere
 * responder no chat continua no chat. Os dois caem na mesma proposta.
 */
export default function PublicBid() {
  const { token = '' } = useParams();
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [deliveryDays, setDeliveryDays] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [freight, setFreight] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState(false);
  const [declined, setDeclined] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-quotation', token],
    queryFn: () => api.get<PublicQuotation>(`/public/quotation/${token}`, { auth: false }),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, Line> = {};
    for (const item of data.quotation.items) {
      const bidItem = data.bid?.items.find((b) => b.quotationItemId === item.id);
      next[item.id] = {
        quotationItemId: item.id,
        unitPrice: bidItem && bidItem.unitPrice > 0 ? String(bidItem.unitPrice) : '',
        brand: bidItem?.brand ?? item.brandRef ?? '',
        available: bidItem ? bidItem.available : true,
      };
    }
    setLines(next);
    if (data.bid) {
      setDeliveryDays(data.bid.deliveryDays ? String(data.bid.deliveryDays) : '');
      setPaymentTerms(data.bid.paymentTerms ?? '');
      setFreight(data.bid.freight ? String(data.bid.freight) : '');
      setDiscount(data.bid.discount ? String(data.bid.discount) : '');
      setNotes(data.bid.notes ?? '');
      if (data.bid.status === 'SUBMITTED' || data.bid.status === 'APPROVED') setSent(true);
    }
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { subtotal: 0, total: 0, missing: 0 };
    let subtotal = 0;
    let missing = 0;
    for (const item of data.quotation.items) {
      const line = lines[item.id];
      if (!line?.available) continue;
      const price = parseMoneyInput(line.unitPrice);
      if (price <= 0) missing++;
      else subtotal += price * item.quantity;
    }
    const f = parseMoneyInput(freight);
    const d = parseMoneyInput(discount);
    return { subtotal, total: Math.max(0, subtotal + f - d), missing };
  }, [data, lines, freight, discount]);

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ message: string; total: number }>(
        `/public/quotation/${token}/bid`,
        {
          deliveryDays: deliveryDays ? Number(deliveryDays) : undefined,
          paymentTerms: paymentTerms || undefined,
          freight: parseMoneyInput(freight),
          discount: parseMoneyInput(discount),
          notes: notes || undefined,
          submit: true,
          items: Object.values(lines).map((l) => ({
            quotationItemId: l.quotationItemId,
            unitPrice: parseMoneyInput(l.unitPrice),
            brand: l.brand || undefined,
            available: l.available,
          })),
        },
        { auth: false },
      ),
    onSuccess: () => setSent(true),
  });

  const decline = useMutation({
    mutationFn: () => api.post(`/public/quotation/${token}/decline`, {}, { auth: false }),
    onSuccess: () => setDeclined(true),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingBlock label="Carregando a cotação..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <PublicShell>
        <Card>
          <ErrorState
            title="Link inválido ou expirado"
            message={error instanceof ApiError ? error.message : 'Peça um novo link ao comprador.'}
            onRetry={() => void refetch()}
          />
        </Card>
      </PublicShell>
    );
  }

  const q = data.quotation;
  const locked = data.closed || data.expired || sent || declined || data.bid?.status === 'APPROVED';

  if (declined) {
    return (
      <PublicShell>
        <Card className="p-10 text-center">
          <Ban className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl">Tudo bem!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registramos que você não vai participar da cotação {q.code}. Até a próxima.
          </p>
        </Card>
      </PublicShell>
    );
  }

  if (sent) {
    return (
      <PublicShell>
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success" />
          <h1 className="text-2xl">Proposta enviada!</h1>
          <p className="num mt-2 text-lg font-semibold text-foreground">
            {formatMoney(data.bid?.totalAmount || totals.total)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {q.buyer.name} já recebeu a sua proposta da cotação <strong className="num">{q.code}</strong> e vai analisar.
            Você recebe a resposta pelo WhatsApp.
          </p>
        </Card>
      </PublicShell>
    );
  }

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  return (
    <PublicShell>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl text-foreground">{q.title}</h1>
          <Badge tone="primary" className="num">{q.code}</Badge>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            {q.buyer.name}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            responder até {formatDateTime(q.deadline)}
          </span>
        </p>
        {q.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{q.description}</p>}
      </div>

      {(data.expired || data.closed) && (
        <div className="mb-6 rounded-md border border-warning/40 bg-warning/[0.07] px-4 py-3 text-sm">
          Esta cotação está fechada para novas propostas.
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Itens" description="Preencha o preço unitário de cada item" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th numeric>Qtd.</Th>
                  <Th numeric className="min-w-[128px]">Preço unit.</Th>
                  <Th className="min-w-[120px]">Marca</Th>
                  <Th numeric>Total</Th>
                  <Th>Tenho</Th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((item) => {
                  const line = lines[item.id];
                  const price = parseMoneyInput(line?.unitPrice ?? '');
                  return (
                    <Tr key={item.id} className={cn(line && !line.available && 'opacity-55')}>
                      <Td>
                        <span className="block text-sm font-medium">
                          <span className="num mr-1.5 text-muted-foreground">{item.position}.</span>
                          {item.description}
                        </span>
                        {item.brandRef && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">ref. {item.brandRef}</span>
                        )}
                      </Td>
                      <Td numeric className="whitespace-nowrap text-muted-foreground">
                        {formatNumber(item.quantity)} {item.unit}
                      </Td>
                      <Td numeric>
                        <Input
                          numeric
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-9"
                          wrapperClassName="w-full"
                          disabled={locked || !line?.available}
                          value={line?.unitPrice ?? ''}
                          onChange={(e) => updateLine(item.id, { unitPrice: e.target.value })}
                        />
                      </Td>
                      <Td>
                        <Input
                          placeholder="Marca"
                          className="h-9"
                          wrapperClassName="w-full"
                          disabled={locked || !line?.available}
                          value={line?.brand ?? ''}
                          onChange={(e) => updateLine(item.id, { brand: e.target.value })}
                        />
                      </Td>
                      <Td numeric className="whitespace-nowrap font-medium">
                        {line?.available && price > 0 ? formatMoney(price * item.quantity) : '—'}
                      </Td>
                      <Td>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                          disabled={locked}
                          checked={line?.available ?? true}
                          onChange={(e) => updateLine(item.id, { available: e.target.checked })}
                          aria-label={`Tenho o item ${item.position}`}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-6">
            <CardHeader title="Sua proposta" />
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
                placeholder="Validade da proposta, condições especiais..."
              />

              <div className="rounded-md border border-border bg-secondary/40 p-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="num text-lg font-semibold">{formatMoney(totals.total)}</span>
                </div>
              </div>

              {totals.missing > 0 && (
                <p className="rounded-md border border-warning/40 bg-warning/[0.07] px-3 py-2 text-xs">
                  Faltam {totals.missing} {totals.missing === 1 ? 'item' : 'itens'} sem preço.
                </p>
              )}

              {submit.error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {submit.error instanceof ApiError ? submit.error.message : 'Não foi possível enviar.'}
                </p>
              )}
            </CardBody>

            {!locked && (
              <div className="space-y-2 border-t border-border bg-secondary/40 p-4">
                <Button
                  className="w-full"
                  size="lg"
                  loading={submit.isPending}
                  disabled={totals.missing > 0 || totals.total <= 0}
                  onClick={() => submit.mutate()}
                >
                  <Send className="h-4 w-4" />
                  Enviar proposta
                </Button>
                <Button
                  className="w-full text-destructive"
                  variant="ghost"
                  size="sm"
                  loading={decline.isPending}
                  onClick={() => decline.mutate()}
                >
                  Não vou participar
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Entrega e contato" />
            <CardBody className="space-y-2 text-sm text-muted-foreground">
              {q.project && <p><strong className="text-foreground">Obra:</strong> {q.project.name}</p>}
              {q.deliveryAddress && <p><strong className="text-foreground">Local:</strong> {q.deliveryAddress}</p>}
              {q.paymentTerms && <p><strong className="text-foreground">Pagamento desejado:</strong> {q.paymentTerms}</p>}
              <p
                className={cn(
                  // A linha só faz sentido quando há algo acima dela.
                  (q.project || q.deliveryAddress || q.paymentTerms) && 'border-t border-border pt-2',
                )}
              >
                <strong className="text-foreground">Contato:</strong> {q.contact.name} · {q.contact.email}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Logo showTagline />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
      <footer className="px-5 py-8 text-center text-xs text-muted-foreground">
        Emptra · cotações para arquitetos e engenheiros
      </footer>
    </div>
  );
}
