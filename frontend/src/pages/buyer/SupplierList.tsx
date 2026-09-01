import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, Radius, Search, Star, Truck } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { api } from '@/lib/api';
import { formatMoney, formatPercent, formatPhone } from '@/lib/format';
import type { BuyerDashboard, Company, Paginated } from '@/types';

export default function SupplierList() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () =>
      api.get<Paginated<Company>>(`/companies?type=SUPPLIER&perPage=100${search ? `&q=${encodeURIComponent(search)}` : ''}`),
  });

  // O ranking do painel dá o histórico de cada fornecedor com este comprador.
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', 'buyer'],
    queryFn: () => api.get<BuyerDashboard>('/dashboard/buyer'),
  });

  const stats = new Map((dashboard?.topSuppliers ?? []).map((s) => [s.supplierId, s]));

  return (
    <>
      <PageHeader
        title="Fornecedores"
        description="Quem responde rápido, quem ganha mais e quem já trabalhou com você."
      />

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cidade ou categoria"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Card><SkeletonRows rows={5} /></Card>
      ) : error ? (
        <Card><ErrorState message={(error as Error).message} onRetry={() => void refetch()} /></Card>
      ) : !data?.data.length ? (
        <Card>
          <EmptyState
            icon={<Truck className="h-5 w-5" />}
            title="Nenhum fornecedor encontrado"
            description="Peça ao administrador para cadastrar e liberar fornecedores na plataforma."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((s) => {
            const stat = stats.get(s.id);
            return (
              <Card key={s.id} className="flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-foreground">{s.tradeName || s.name}</h3>
                    {s.tradeName && <p className="truncate text-xs text-muted-foreground">{s.name}</p>}
                  </div>
                  {Number(s.supplierProfile?.rating ?? 0) > 0 && (
                    <Badge tone="pending" className="shrink-0">
                      <Star className="h-3 w-3 fill-current" />
                      {Number(s.supplierProfile?.rating).toFixed(1)}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[s.city, s.state].filter(Boolean).join('/') || 'Localização não informada'}
                  </p>
                  <p className="num flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {formatPhone(s.whatsapp ?? s.phone)}
                  </p>
                  {s.supplierProfile?.serviceRadiusKm != null && (
                    <p className="num flex items-center gap-2">
                      <Radius className="h-3.5 w-3.5 shrink-0" />
                      Entrega em até {s.supplierProfile.serviceRadiusKm} km
                    </p>
                  )}
                </div>

                {s.supplierProfile?.categories.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.supplierProfile.categories.slice(0, 4).map((c) => (
                      <Badge key={c} tone="outline">{c}</Badge>
                    ))}
                    {s.supplierProfile.categories.length > 4 && (
                      <Badge tone="outline">+{s.supplierProfile.categories.length - 4}</Badge>
                    )}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                  <div>
                    <p className="num text-sm font-medium text-foreground">{formatMoney(stat?.total ?? 0)}</p>
                    <p className="text-[11px] text-muted-foreground">comprado</p>
                  </div>
                  <div>
                    <p className="num text-sm font-medium text-success">{formatMoney(stat?.savings ?? 0)}</p>
                    <p className="text-[11px] text-muted-foreground">economia</p>
                  </div>
                  <div>
                    <p className="num text-sm font-medium text-foreground">{formatPercent(stat?.winRate ?? 0, 0)}</p>
                    <p className="text-[11px] text-muted-foreground">vitórias</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
