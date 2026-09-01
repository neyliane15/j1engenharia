import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pause, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { UserStatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatPhone } from '@/lib/format';
import type { Company, Paginated, Role, User, UserStatus } from '@/types';

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrador', BUYER: 'Comprador', SUPPLIER: 'Fornecedor' };

export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const qc = useQueryClient();

  const status = params.get('status') ?? '';
  const role = params.get('role') ?? '';
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', status, role, search],
    queryFn: () =>
      api.get<Paginated<User>>(
        `/admin/users?perPage=100${status ? `&status=${status}` : ''}${role ? `&role=${role}` : ''}${
          search ? `&q=${encodeURIComponent(search)}` : ''
        }`,
      ),
  });

  const { data: companies } = useQuery({
    queryKey: ['admin', 'companies', 'all'],
    queryFn: () => api.get<Paginated<Company>>('/companies?perPage=200'),
    enabled: createOpen,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
  };

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<User> & { status?: UserStatus } }) =>
      api.patch(`/admin/users/${id}`, patch),
    onSuccess: (_r, v) => {
      toast.success(
        v.patch.status === 'ACTIVE'
          ? 'Acesso liberado'
          : v.patch.status === 'SUSPENDED'
            ? 'Acesso suspenso'
            : 'Usuário atualizado',
      );
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível atualizar', e instanceof ApiError ? e.message : undefined),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('Usuário excluído');
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível excluir', e instanceof ApiError ? e.message : undefined),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/users', body),
    onSuccess: () => {
      setCreateOpen(false);
      toast.success('Usuário criado', 'O acesso já está liberado.');
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível criar', e instanceof ApiError ? e.message : undefined),
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const pending = data?.data.filter((u) => u.status === 'PENDING') ?? [];

  return (
    <>
      <PageHeader
        title="Usuários e acessos"
        description="Libere, suspenda e crie acessos de comprador, fornecedor e administrador."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </Button>
        }
      />

      {pending.length > 0 && !status && (
        <div className="mb-5 rounded-md border border-warning/40 bg-warning/[0.07] px-4 py-3 text-sm">
          <strong className="font-semibold">{pending.length}</strong>{' '}
          {pending.length === 1 ? 'cadastro aguarda' : 'cadastros aguardam'} sua liberação — estão no topo da lista.
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou empresa"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setFilter('status', e.target.value)} className="sm:w-48">
            <option value="">Todas as situações</option>
            <option value="PENDING">Aguardando liberação</option>
            <option value="ACTIVE">Ativos</option>
            <option value="SUSPENDED">Suspensos</option>
          </Select>
          <Select value={role} onChange={(e) => setFilter('role', e.target.value)} className="sm:w-44">
            <option value="">Todos os perfis</option>
            <option value="ADMIN">Administrador</option>
            <option value="BUYER">Comprador</option>
            <option value="SUPPLIER">Fornecedor</option>
          </Select>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !data?.data.length ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum usuário encontrado" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Usuário</Th>
                  <Th>Empresa</Th>
                  <Th>Perfil</Th>
                  <Th>Situação</Th>
                  <Th>Último acesso</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <span className="block font-medium text-foreground">{u.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{u.email}</span>
                      {u.phone && <span className="num mt-0.5 block text-xs text-muted-foreground">{formatPhone(u.phone)}</span>}
                    </Td>
                    <Td className="text-muted-foreground">
                      {u.company?.name ?? '—'}
                      {u.company && !u.company.active && (
                        <Badge tone="warning" className="ml-2">empresa inativa</Badge>
                      )}
                    </Td>
                    <Td><Badge tone={u.role === 'ADMIN' ? 'deep' : 'outline'}>{ROLE_LABEL[u.role]}</Badge></Td>
                    <Td><UserStatusBadge status={u.status} /></Td>
                    <Td className="num text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'nunca'}</Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {u.status !== 'ACTIVE' && (
                          <Button
                            size="sm"
                            loading={update.isPending}
                            onClick={() => update.mutate({ id: u.id, patch: { status: 'ACTIVE' } })}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Liberar
                          </Button>
                        )}
                        {u.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => update.mutate({ id: u.id, patch: { status: 'SUSPENDED' } })}
                          >
                            <Pause className="h-3.5 w-3.5" />
                            Suspender
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Excluir o usuário ${u.name}? Esta ação não pode ser desfeita.`)) {
                              remove.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo usuário"
        description="O acesso já nasce liberado."
      >
        <form
          id="create-user"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const roleValue = String(f.get('role')) as Role;
            create.mutate({
              name: String(f.get('name')),
              email: String(f.get('email')),
              password: String(f.get('password')),
              role: roleValue,
              phone: String(f.get('phone')) || undefined,
              jobTitle: String(f.get('jobTitle')) || undefined,
              companyId: roleValue === 'ADMIN' ? null : String(f.get('companyId')) || null,
              status: 'ACTIVE',
            });
          }}
        >
          <Input name="name" label="Nome completo" required />
          <Input name="email" type="email" label="E-mail" required />
          <Input name="password" type="password" label="Senha provisória" required minLength={8} hint="Mínimo de 8 caracteres" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="role" label="Perfil" required defaultValue="BUYER">
              <option value="BUYER">Comprador</option>
              <option value="SUPPLIER">Fornecedor</option>
              <option value="ADMIN">Administrador</option>
            </Select>
            <Input name="phone" label="WhatsApp" placeholder="(11) 98888-7777" />
          </div>
          <Select name="companyId" label="Empresa" hint="Obrigatório para comprador e fornecedor" defaultValue="">
            <option value="">Sem empresa (apenas administradores)</option>
            {companies?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.type === 'BUYER' ? 'comprador' : 'fornecedor'}
              </option>
            ))}
          </Select>
          <Input name="jobTitle" label="Cargo" placeholder="Coordenador de Suprimentos" />
        </form>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button type="submit" form="create-user" loading={create.isPending}>Criar usuário</Button>
        </div>
      </Modal>
    </>
  );
}
