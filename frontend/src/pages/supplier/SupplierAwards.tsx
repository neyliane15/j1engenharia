import { useQuery } from '@tanstack/react-query';
import { Award, Download, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api, downloadFile } from '@/lib/api';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

interface AwardRow {
  id: string;
  quotation: { id: string; code: string; title: string; buyerCompany: { name: string } };
  total: number;
  savings: number;
  createdAt: string;
  deliveryDays: number | null;
  paymentTerms: string | null;
  items: {
    position: number;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  xlsxUrl: string;
}

export default function SupplierAwards() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['supplier', 'awards'],
    queryFn: () => api.get<{ data: AwardRow[] }>('/dashboard/supplier/awards'),
  });

  function download(a: AwardRow) {
    downloadFile(a.xlsxUrl, `${a.quotation.code}.xlsx`).catch((e) => toast.error('Falha ao baixar', e.message));
  }

  if (isLoading) return <LoadingBlock label="Carregando seus pedidos..." />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        title="Pedidos ganhos"
        description="As cotações que você venceu. Baixe a lista dos produtos aprovados em XLSX."
      />

      {!data?.data.length ? (
        <Card>
          <EmptyState
            icon={<Award className="h-5 w-5" />}
            title="Você ainda não venceu uma cotação"
            description="Responda as cotações abertas com o seu melhor preço — os pedidos aprovados aparecem aqui."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {data.data.map((a) => (
            <Card key={a.id}>
              <CardHeader
                title={a.quotation.title}
                description={`${a.quotation.code} · ${a.quotation.buyerCompany.name} · aprovado em ${formatDate(a.createdAt)}`}
                action={
                  <Button onClick={() => download(a)}>
                    <Download className="h-4 w-4" />
                    Baixar XLSX
                  </Button>
                }
              />

              <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
                <Badge tone="success">Total {formatMoney(a.total)}</Badge>
                <Badge tone="outline">{a.items.length} {a.items.length === 1 ? 'item' : 'itens'}</Badge>
                {a.deliveryDays !== null && <Badge tone="outline">Entrega em {a.deliveryDays} dias</Badge>}
                {a.paymentTerms && <Badge tone="outline">{a.paymentTerms}</Badge>}
              </div>

              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Item</Th>
                      <Th numeric>Quantidade</Th>
                      <Th numeric>Preço unitário</Th>
                      <Th numeric>Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.items.map((i) => (
                      <Tr key={i.position}>
                        <Td>
                          <span className="num mr-1.5 text-muted-foreground">{i.position}.</span>
                          {i.description}
                        </Td>
                        <Td numeric className="text-muted-foreground">{formatNumber(i.quantity)} {i.unit}</Td>
                        <Td numeric>{formatMoney(i.unitPrice)}</Td>
                        <Td numeric className="font-medium">{formatMoney(i.total)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/60">
                      <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium">Total aprovado</td>
                      <td className="num px-4 py-3 text-right text-sm font-semibold">{formatMoney(a.total)}</td>
                    </tr>
                  </tfoot>
                </Table>
              </TableWrap>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function SupplierRevenue() {
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['supplier', 'awards'],
    queryFn: () => api.get<{ data: AwardRow[] }>('/dashboard/supplier/awards'),
  });

  const byClient = new Map<string, { name: string; total: number; orders: number }>();
  for (const a of data?.data ?? []) {
    const key = a.quotation.buyerCompany.name;
    const cur = byClient.get(key) ?? { name: key, total: 0, orders: 0 };
    cur.total += a.total;
    cur.orders += 1;
    byClient.set(key, cur);
  }
  const clients = [...byClient.values()].sort((a, b) => b.total - a.total);
  const total = clients.reduce((acc, c) => acc + c.total, 0);

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Faturamento"
        description="Tudo que você faturou por cliente, com a planilha consolidada."
        action={
          <Button
            onClick={() =>
              downloadFile('/exports/supplier/revenue.xlsx', 'emptra-faturamento.xlsx').catch((e) =>
                toast.error('Falha ao baixar', e.message),
              )
            }
          >
            <FileSpreadsheet className="h-4 w-4" />
            Baixar XLSX
          </Button>
        }
      />

      <Card>
        <CardHeader title="Faturamento por cliente" description={`Total ${formatMoney(total)}`} />
        {clients.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th numeric>Pedidos</Th>
                  <Th numeric>Faturamento</Th>
                  <Th numeric>Participação</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <Tr key={c.name}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td numeric>{c.orders}</Td>
                    <Td numeric className="font-semibold">{formatMoney(c.total)}</Td>
                    <Td numeric className="text-muted-foreground">
                      {total ? `${Math.round((c.total / total) * 100)}%` : '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState title="Nenhum faturamento ainda" description="Ganhe uma cotação para começar." />
        )}
      </Card>
    </>
  );
}
