import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, GripVertical, Plus, Search, Send, Trash2, Truck } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, linkButtonClass } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/Feedback';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { Company, Paginated, Quotation } from '@/types';

interface ItemDraft {
  key: string;
  description: string;
  unit: string;
  quantity: string;
  brandRef: string;
  notes: string;
}

const UNITS = ['un', 'sc', 'm', 'm²', 'm³', 'kg', 'lt', 'cx', 'br', 'rl', 'pç', 'pt', 'gl'];

const emptyItem = (): ItemDraft => ({
  key: crypto.randomUUID(),
  description: '',
  unit: 'un',
  quantity: '',
  brandRef: '',
  notes: '',
});

/** Prazo padrão: 3 dias úteis a partir de agora, às 18h. */
function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QuotationNew() {
  const navigate = useNavigate();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [selected, setSelected] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>('/projects'),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', 'picker'],
    queryFn: () => api.get<Paginated<Company>>('/companies?type=SUPPLIER&perPage=200'),
  });

  const filteredSuppliers = useMemo(() => {
    const list = suppliers?.data ?? [];
    if (!supplierSearch.trim()) return list;
    const q = supplierSearch.toLowerCase();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.tradeName?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.supplierProfile?.categories.some((c) => c.toLowerCase().includes(q)),
    );
  }, [suppliers, supplierSearch]);

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = 'Dê um título à cotação';
    if (!deadline) next.deadline = 'Informe o prazo de resposta';
    else if (new Date(deadline) <= new Date()) next.deadline = 'O prazo precisa ser no futuro';

    const valid = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
    if (!valid.length) next.items = 'Inclua ao menos um item com descrição e quantidade';
    if (!selected.length) next.suppliers = 'Selecione ao menos um fornecedor';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function payload() {
    return {
      title: title.trim(),
      description: description.trim() || undefined,
      projectId: projectId || undefined,
      deadline: new Date(deadline).toISOString(),
      deliveryAddress: deliveryAddress.trim() || undefined,
      paymentTerms: paymentTerms.trim() || undefined,
      supplierIds: selected,
      items: items
        .filter((i) => i.description.trim() && Number(i.quantity) > 0)
        .map((i) => ({
          description: i.description.trim(),
          unit: i.unit,
          quantity: Number(i.quantity),
          brandRef: i.brandRef.trim() || undefined,
          notes: i.notes.trim() || undefined,
        })),
    };
  }

  const save = useMutation({
    mutationFn: async (dispatch: boolean) => {
      const { quotation } = await api.post<{ quotation: Quotation }>('/quotations', payload());
      if (dispatch) {
        const result = await api.post<{ dispatched: { ok: boolean }[]; message: string }>(
          `/quotations/${quotation.id}/dispatch`,
        );
        return { quotation, result };
      }
      return { quotation, result: null };
    },
    onSuccess: ({ quotation, result }) => {
      if (result) {
        const sent = result.dispatched.filter((d) => d.ok).length;
        if (sent === result.dispatched.length) {
          toast.success('Cotação enviada', `${sent} ${sent === 1 ? 'fornecedor recebeu' : 'fornecedores receberam'} no WhatsApp.`);
        } else {
          toast.warning('Cotação criada', result.message);
        }
      } else {
        toast.success('Rascunho salvo', 'Você pode disparar quando quiser.');
      }
      navigate(`/comprador/cotacoes/${quotation.id}`);
    },
    onError: (err) => toast.error('Não foi possível salvar', err instanceof ApiError ? err.message : undefined),
  });

  function submit(dispatch: boolean) {
    if (dispatch && !validate()) {
      toast.error('Revise a cotação', 'Alguns campos ainda precisam de atenção.');
      return;
    }
    if (!dispatch && title.trim().length < 3) {
      setErrors({ title: 'Dê um título à cotação' });
      return;
    }
    save.mutate(dispatch);
  }

  const validItemCount = items.filter((i) => i.description.trim() && Number(i.quantity) > 0).length;

  return (
    <>
      <PageHeader
        title="Nova cotação"
        description="Monte a lista, escolha os fornecedores e dispare pelo WhatsApp."
        action={
          <Link to="/comprador/cotacoes" className={linkButtonClass({ variant: 'outline' })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Dados gerais */}
          <Card>
            <CardHeader title="Dados da cotação" />
            <CardBody className="space-y-4">
              <Input
                label="Título"
                required
                placeholder="Ex.: Hidráulica das prumadas — Bloco B"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Centro de custo" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Sem centro de custo</option>
                  {projects?.data.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                <Input
                  label="Prazo para resposta"
                  type="datetime-local"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  error={errors.deadline}
                  hint="Depois disso a cotação fecha sozinha."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Local de entrega"
                  placeholder="Endereço de entrega"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
                <Input
                  label="Condição de pagamento desejada"
                  placeholder="Ex.: 28 dias após entrega"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>

              <Textarea
                label="Observações para o fornecedor"
                placeholder="Detalhes de aplicação, exigências técnicas, prazos especiais..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </CardBody>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader
              title="Itens"
              description={`${validItemCount} ${validItemCount === 1 ? 'item preenchido' : 'itens preenchidos'}`}
              action={
                <Button size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyItem()])}>
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </Button>
              }
            />
            <CardBody className="space-y-3">
              {errors.items && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {errors.items}
                </p>
              )}

              {items.map((item, index) => (
                <div key={item.key} className="rounded-md border border-border bg-secondary/25 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="num flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <GripVertical className="h-3.5 w-3.5" />
                      Item {index + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((p) => p.filter((i) => i.key !== item.key))}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remover item ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12">
                    <Input
                      wrapperClassName="sm:col-span-6"
                      label="Descrição"
                      placeholder="Tubo PVC soldável 25mm — barra 6m"
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                    />
                    <Input
                      wrapperClassName="sm:col-span-2"
                      label="Quantidade"
                      type="number"
                      min="0"
                      step="any"
                      numeric
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                    />
                    <Select
                      wrapperClassName="sm:col-span-2"
                      label="Unidade"
                      value={item.unit}
                      onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </Select>
                    <Input
                      wrapperClassName="sm:col-span-2"
                      label="Marca ref."
                      placeholder="Tigre"
                      value={item.brandRef}
                      onChange={(e) => updateItem(item.key, { brandRef: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Fornecedores */}
        <div className="space-y-6">
          <Card className="xl:sticky xl:top-24">
            <CardHeader
              title="Fornecedores"
              description={`${selected.length} selecionado${selected.length === 1 ? '' : 's'}`}
            />
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, cidade ou categoria"
                  className="pl-8"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                />
              </div>
              {errors.suppliers && <p className="mt-2 text-xs font-medium text-destructive">{errors.suppliers}</p>}
            </div>

            <div className="max-h-[440px] overflow-y-auto">
              {filteredSuppliers.length ? (
                <ul className="divide-y divide-border">
                  {filteredSuppliers.map((s) => {
                    const active = selected.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelected((prev) => (active ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                          }
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                            active ? 'bg-primary/[0.06]' : 'hover:bg-secondary/50',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                            )}
                          >
                            {active && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {s.tradeName || s.name}
                            </span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              {[s.city, s.state].filter(Boolean).join('/') || 'Localização não informada'}
                              {!s.whatsapp && ' · sem WhatsApp'}
                            </span>
                            {s.supplierProfile?.categories.length ? (
                              <span className="mt-2 flex flex-wrap gap-1">
                                {s.supplierProfile.categories.slice(0, 3).map((c) => (
                                  <Badge key={c} tone="outline" className="px-2 py-0 text-[10px]">{c}</Badge>
                                ))}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<Truck className="h-5 w-5" />}
                  title="Nenhum fornecedor encontrado"
                  description="Peça ao administrador para cadastrar e liberar fornecedores."
                />
              )}
            </div>

            <div className="space-y-2 border-t border-border bg-secondary/40 p-4">
              <Button className="w-full" size="lg" loading={save.isPending} onClick={() => submit(true)}>
                <Send className="h-4 w-4" />
                Criar e enviar no WhatsApp
              </Button>
              <Button className="w-full" variant="outline" disabled={save.isPending} onClick={() => submit(false)}>
                Salvar como rascunho
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
