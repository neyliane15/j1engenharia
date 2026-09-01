import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatCNPJ, formatPhone } from '@/lib/format';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSavingProfile(true);
    try {
      await api.patch('/auth/me', {
        name: String(f.get('name')),
        phone: String(f.get('phone')) || undefined,
        jobTitle: String(f.get('jobTitle')) || undefined,
      });
      await refreshUser();
      toast.success('Perfil atualizado');
    } catch (err) {
      toast.error('Não foi possível salvar', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (String(f.get('newPassword')) !== String(f.get('confirm'))) {
      toast.error('As senhas não conferem');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: String(f.get('currentPassword')),
        newPassword: String(f.get('newPassword')),
      });
      form.reset();
      toast.success('Senha alterada', 'Entre novamente com a nova senha.');
    } catch (err) {
      toast.error('Não foi possível alterar', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <PageHeader title="Meu perfil" description="Seus dados de acesso e da sua empresa." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Dados pessoais" />
          <CardBody>
            <form onSubmit={saveProfile} className="space-y-4">
              <Input name="name" label="Nome completo" defaultValue={user.name} required />
              <Input label="E-mail" defaultValue={user.email} disabled hint="Fale com o administrador para trocar." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="phone" label="WhatsApp" defaultValue={user.phone ?? ''} placeholder="(11) 98888-7777" />
                <Input name="jobTitle" label="Cargo" defaultValue={user.jobTitle ?? ''} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={savingProfile}>Salvar</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Alterar senha" description="Ao trocar, todas as sessões são encerradas." />
            <CardBody>
              <form onSubmit={changePassword} className="space-y-4">
                <Input name="currentPassword" type="password" label="Senha atual" required />
                <Input name="newPassword" type="password" label="Nova senha" required minLength={8} hint="Mínimo de 8 caracteres" />
                <Input name="confirm" type="password" label="Confirmar nova senha" required minLength={8} />
                <div className="flex justify-end">
                  <Button type="submit" variant="outline" loading={savingPassword}>Alterar senha</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          {user.company && (
            <Card>
              <CardHeader title="Minha empresa" />
              <CardBody>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Razão social</dt>
                    <dd className="text-right font-medium">{user.company.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">CNPJ</dt>
                    <dd className="num text-right">{formatCNPJ(user.company.cnpj)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">WhatsApp</dt>
                    <dd className="num text-right">{formatPhone(user.company.whatsapp)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Cidade</dt>
                    <dd className="text-right">
                      {[user.company.city, user.company.state].filter(Boolean).join('/') || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Tipo</dt>
                    <dd className="text-right">
                      <Badge tone={user.company.type === 'BUYER' ? 'primary' : 'neutral'}>
                        {user.company.type === 'BUYER' ? 'Comprador' : 'Fornecedor'}
                      </Badge>
                    </dd>
                  </div>
                </dl>

                {user.company.supplierProfile?.categories.length ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-2 text-[13px] font-medium">Categorias fornecidas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.company.supplierProfile.categories.map((c) => (
                        <Badge key={c} tone="outline">{c}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
