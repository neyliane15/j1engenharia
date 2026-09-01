import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, MessageSquareText, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { api } from '@/lib/api';
import { formatDateTime, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  phone: string;
  body: string | null;
  template: string | null;
  error: string | null;
  createdAt: string;
  quotation?: { code: string; title: string } | null;
}

const STATUS_TONE: Record<string, 'neutral' | 'pending' | 'approved' | 'rejected'> = {
  QUEUED: 'neutral',
  SENT: 'neutral',
  DELIVERED: 'approved',
  READ: 'approved',
  RECEIVED: 'neutral',
  FAILED: 'rejected',
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Na fila',
  SENT: 'Enviada',
  DELIVERED: 'Entregue',
  READ: 'Lida',
  RECEIVED: 'Recebida',
  FAILED: 'Falhou',
};

export default function AdminWhatsApp() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [direction, setDirection] = useState('');
  const [phone, setPhone] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'whatsapp', status, direction, phone],
    queryFn: () =>
      api.get<Paginated<Message>>(
        `/admin/whatsapp?perPage=60${status ? `&status=${status}` : ''}${direction ? `&direction=${direction}` : ''}${
          phone ? `&phone=${encodeURIComponent(phone)}` : ''
        }`,
      ),
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Trilha completa da automação: tudo que a plataforma enviou e recebeu."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar por telefone"
              className="pl-8"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Select value={direction} onChange={(e) => setDirection(e.target.value)} className="sm:w-44">
            <option value="">Todas</option>
            <option value="OUTBOUND">Enviadas</option>
            <option value="INBOUND">Recebidas</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('status', e.target.value);
              else next.delete('status');
              setParams(next, { replace: true });
            }}
            className="sm:w-44"
          >
            <option value="">Todos os status</option>
            <option value="SENT">Enviada</option>
            <option value="DELIVERED">Entregue</option>
            <option value="READ">Lida</option>
            <option value="RECEIVED">Recebida</option>
            <option value="FAILED">Falhou</option>
          </Select>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={<MessageSquareText className="h-5 w-5" />}
            title="Nenhuma mensagem"
            description="Assim que uma cotação for disparada, as mensagens aparecem aqui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.data.map((m) => {
              const outbound = m.direction === 'OUTBOUND';
              return (
                <li key={m.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full',
                        outbound ? 'bg-primary/12 text-primary' : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {outbound ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
                    </span>
                    <span className="num text-sm font-medium text-foreground">{formatPhone(m.phone)}</span>
                    <Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
                    {m.template && <Badge tone="outline">{m.template}</Badge>}
                    {m.quotation && <Badge tone="outline" className="num">{m.quotation.code}</Badge>}
                    <span className="num ml-auto text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                  </div>

                  {m.body && (
                    <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-3 font-sans text-[13px] leading-relaxed text-foreground">
                      {m.body}
                    </pre>
                  )}

                  {m.error && (
                    <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {m.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
