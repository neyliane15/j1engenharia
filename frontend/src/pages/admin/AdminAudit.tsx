import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Paginated } from '@/types';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string } | null;
}

export default function AdminAudit() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => api.get<Paginated<AuditRow>>('/admin/audit?perPage=80'),
  });

  return (
    <>
      <PageHeader title="Auditoria" description="Quem fez o quê, quando e de onde." />

      <Card>
        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !data?.data.length ? (
          <EmptyState icon={<ScrollText className="h-5 w-5" />} title="Nenhum registro ainda" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Quando</Th>
                  <Th>Quem</Th>
                  <Th>Ação</Th>
                  <Th>Registro</Th>
                  <Th>Detalhes</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <Tr key={a.id}>
                    <Td className="num whitespace-nowrap text-muted-foreground">{formatDateTime(a.createdAt)}</Td>
                    <Td>
                      {a.user ? (
                        <>
                          <span className="block text-sm font-medium">{a.user.name}</span>
                          <span className="block text-xs text-muted-foreground">{a.user.email}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">sistema</span>
                      )}
                    </Td>
                    <Td><Badge tone="outline" className="num">{a.action}</Badge></Td>
                    <Td className="text-muted-foreground">
                      {a.entity}
                      {a.entityId && <span className="num mt-1 block text-[11px]">{a.entityId.slice(0, 8)}</span>}
                    </Td>
                    <Td className="max-w-xs">
                      {a.meta && Object.keys(a.meta).length ? (
                        <code className="num block truncate text-[11px] text-muted-foreground">
                          {JSON.stringify(a.meta)}
                        </code>
                      ) : (
                        '—'
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
