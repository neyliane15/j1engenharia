import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, LoadingBlock } from '@/components/ui/Feedback';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { PriceHistoryChart } from '@/components/charts/Charts';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';

interface PricePoint {
  date: string;
  quotation: string;
  description: string;
  unit: string;
  supplier: string;
  unitPrice: number;
  approved: boolean;
}

interface PriceHistoryResult {
  query: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  points: PricePoint[];
}

export default function PriceHistory() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['price-history', query],
    queryFn: () => api.get<PriceHistoryResult>(`/dashboard/buyer/price-history?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery(term.trim());
  }

  const chartData = [...(data?.points ?? [])]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((p) => ({ label: formatDate(p.date), price: p.unitPrice }));

  return (
    <>
      <PageHeader
        title="Histórico de preços"
        description="Quanto você já pagou por um material — e quanto os fornecedores estão pedindo agora."
      />

      <Card className="mb-6">
        <CardBody>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ex.: cimento, porcelanato, cabo flexível"
                className="pl-9"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={term.trim().length < 2}>
              Consultar
            </Button>
          </form>
        </CardBody>
      </Card>

      {!query ? (
        <Card>
          <EmptyState
            icon={<LineChart className="h-5 w-5" />}
            title="Busque um material"
            description="Digite parte da descrição para ver todos os preços já cotados por você."
          />
        </Card>
      ) : isLoading ? (
        <LoadingBlock />
      ) : !data?.points.length ? (
        <Card>
          <EmptyState title={`Nenhum preço encontrado para "${query}"`} description="Tente um termo mais curto." />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Menor preço" value={formatMoney(data.min)} accent />
            <StatCard label="Preço médio" value={formatMoney(data.avg)} hint={`${data.count} cotações`} />
            <StatCard label="Maior preço" value={formatMoney(data.max)} />
          </div>

          <Card className="mb-6">
            <CardHeader title="Variação no tempo" description={`Preço unitário cotado para "${query}"`} />
            <CardBody>
              <PriceHistoryChart data={chartData} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Todas as cotações" />
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Cotação</Th>
                    <Th>Material</Th>
                    <Th>Fornecedor</Th>
                    <Th numeric>Preço unitário</Th>
                    <Th>Situação</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.points.map((p, i) => (
                    <Tr key={i}>
                      <Td className="num text-muted-foreground">{formatDate(p.date)}</Td>
                      <Td className="num">{p.quotation}</Td>
                      <Td>{p.description}</Td>
                      <Td className="text-muted-foreground">{p.supplier}</Td>
                      <Td numeric className="font-medium">{formatMoney(p.unitPrice)}</Td>
                      <Td>{p.approved ? <Badge tone="success">Comprado</Badge> : <Badge tone="outline">Cotado</Badge>}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </>
      )}
    </>
  );
}
