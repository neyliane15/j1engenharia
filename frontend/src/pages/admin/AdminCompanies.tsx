import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Power, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/Feedback';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { api, ApiError } from '@/lib/api';
import { formatCNPJ, formatPhone } from '@/lib/format';
import type { Company, Paginated } from '@/types';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function AdminCompanies() {
  const toast = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'companies', type, search],
    queryFn: () =>
      api.get<Paginated<Company>>(
        `/companies?perPage=200${type ? `&type=${type}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'companies'] });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/companies/${id}`, { active }),
    onSuccess: (_r, v) => {
      toast.success(v.active ? 'Empresa ativada' : 'Empresa desativada');
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível atualizar', e instanceof ApiError ? e.message : undefined),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/companies', body),
    onSuccess: () => {
      setOpen(false);
      toast.success('Empresa cadastrada');
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível cadastrar', e instanceof ApiError ? e.message : undefined),
  });

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Compradores e fornecedores cadastrados na plataforma."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova empresa
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou cidade"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-48">
            <option value="">Todos os tipos</option>
            <option value="BUYER">Compradores</option>
            <option value="SUPPLIER">Fornecedores</option>
          </Select>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !data?.data.length ? (
          <EmptyState icon={<Building2 className="h-5 w-5" />} title="Nenhuma empresa encontrada" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Empresa</Th>
                  <Th>Tipo</Th>
                  <Th>Cidade</Th>
                  <Th>WhatsApp</Th>
                  <Th numeric>Usuários</Th>
                  <Th>Situação</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <span className="block font-medium text-foreground">{c.tradeName || c.name}</span>
                      <span className="num mt-1 block text-xs text-muted-foreground">{formatCNPJ(c.cnpj)}</span>
                      {c.supplierProfile?.categories.length ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {c.supplierProfile.categories.slice(0, 3).map((cat) => (
                            <Badge key={cat} tone="outline" className="px-2 py-0 text-[10px]">{cat}</Badge>
                          ))}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={c.type === 'BUYER' ? 'neutral' : 'neutral'}>
                        {c.type === 'BUYER' ? 'Comprador' : 'Fornecedor'}
                      </Badge>
                    </Td>
                    <Td className="text-muted-foreground">{[c.city, c.state].filter(Boolean).join('/') || '—'}</Td>
                    <Td className="num text-muted-foreground">{formatPhone(c.whatsapp ?? c.phone)}</Td>
                    <Td numeric>{c._count?.users ?? 0}</Td>
                    <Td>
                      <Badge tone={c.active ? 'approved' : 'pending'}>{c.active ? 'Ativa' : 'Inativa'}</Badge>
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant={c.active ? 'outline' : 'primary'}
                          onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {c.active ? 'Desativar' : 'Ativar'}
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

      <Modal open={open} onClose={() => setOpen(false)} title="Nova empresa" size="lg">
        <form
          id="create-company"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const companyType = String(f.get('type'));
            const categories = String(f.get('categories') ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            create.mutate({
              type: companyType,
              name: String(f.get('name')),
              tradeName: String(f.get('tradeName')) || undefined,
              cnpj: String(f.get('cnpj')) || undefined,
              email: String(f.get('email')) || undefined,
              whatsapp: String(f.get('whatsapp')),
              phone: String(f.get('whatsapp')),
              city: String(f.get('city')) || undefined,
              state: String(f.get('state')) || undefined,
              address: String(f.get('address')) || undefined,
              active: true,
              ...(companyType === 'SUPPLIER' ? { profile: { categories } } : {}),
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="type" label="Tipo" required defaultValue="SUPPLIER">
              <option value="SUPPLIER">Fornecedor</option>
              <option value="BUYER">Comprador</option>
            </Select>
            <Input name="cnpj" label="CNPJ" placeholder="00.000.000/0001-00" />
          </div>
          <Input name="name" label="Razão social" required />
          <Input name="tradeName" label="Nome fantasia" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="whatsapp"
              label="WhatsApp"
              required
              placeholder="(11) 98888-7777"
              hint="É por este número que as cotações são enviadas."
            />
            <Input name="email" type="email" label="E-mail" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input name="city" label="Cidade" wrapperClassName="sm:col-span-2" />
            <Select name="state" label="UF" defaultValue="">
              <option value="">—</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </Select>
          </div>
          <Textarea name="address" label="Endereço" />
          <Input
            name="categories"
            label="Categorias fornecidas"
            placeholder="Hidráulica, Elétrica, Cimento"
            hint="Separe por vírgula. Só se aplica a fornecedores."
          />
        </form>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="create-company" loading={create.isPending}>Cadastrar</Button>
        </div>
      </Modal>
    </>
  );
}
