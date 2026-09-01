import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Store, Truck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const CATEGORIES = [
  'Alvenaria', 'Cimento', 'Argamassa', 'Hidráulica', 'Elétrica',
  'Revestimento', 'Acabamento', 'Iluminação', 'Ferragens', 'Madeiras',
  'Esquadrias', 'Impermeabilização', 'Tintas', 'Louças e metais',
];

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Extract<Role, 'BUYER' | 'SUPPLIER'>>('BUYER');
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));

    if (password !== String(form.get('confirm'))) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(
        '/auth/register',
        {
          name: String(form.get('name')),
          email: String(form.get('email')),
          password,
          phone: String(form.get('phone')),
          role,
          companyName: String(form.get('companyName')),
          cnpj: String(form.get('cnpj')) || undefined,
          city: String(form.get('city')) || undefined,
          state: String(form.get('state')) || undefined,
          ...(role === 'SUPPLIER' ? { categories } : {}),
        },
        { auth: false },
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o cadastro.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="surface-accent w-full max-w-md p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </span>
          <h1 className="text-2xl text-foreground">Cadastro enviado!</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Um administrador vai revisar e liberar o seu acesso. Assim que for aprovado, você entra normalmente com o
            e-mail e a senha que acabou de criar.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate('/entrar')}>
            Voltar para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/entrar" className="inline-block">
          <Logo showTagline />
        </Link>

        <h1 className="mt-8 text-2xl text-foreground">Solicitar acesso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados da sua empresa. O acesso é liberado por um administrador.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-6">
          {/* Perfil */}
          <fieldset className="surface p-5">
            <legend className="px-1 text-[13px] font-medium text-foreground">Como você vai usar o Emptra?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: 'BUYER', icon: Store, title: 'Sou comprador', text: 'Escritório ou construtora que cota materiais.' },
                  { value: 'SUPPLIER', icon: Truck, title: 'Sou fornecedor', text: 'Loja ou distribuidora que vende materiais.' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-4 text-left transition-colors',
                    role === opt.value
                      ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/25'
                      : 'border-border bg-card hover:border-primary/35',
                  )}
                >
                  <opt.icon className={cn('mt-0.5 h-5 w-5 shrink-0', role === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{opt.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Empresa */}
          <fieldset className="surface space-y-4 p-5">
            <legend className="px-1 text-[13px] font-medium text-foreground">Dados da empresa</legend>
            <Input name="companyName" label="Razão social ou nome fantasia" required placeholder="Construtora Exemplo Ltda" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="cnpj" label="CNPJ" placeholder="00.000.000/0001-00" inputMode="numeric" />
              <Input name="city" label="Cidade" placeholder="São Paulo" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select name="state" label="Estado" defaultValue="">
                <option value="">Selecione</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </Select>
              <Input
                name="phone"
                label="WhatsApp da empresa"
                required
                placeholder="(11) 98888-7777"
                hint={role === 'SUPPLIER' ? 'É por este número que as cotações chegam.' : undefined}
              />
            </div>

            {role === 'SUPPLIER' && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-foreground">O que você fornece?</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const active = categories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategories((prev) => (active ? prev.filter((x) => x !== c) : [...prev, c]))}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </fieldset>

          {/* Responsável */}
          <fieldset className="surface space-y-4 p-5">
            <legend className="px-1 text-[13px] font-medium text-foreground">Seus dados de acesso</legend>
            <Input name="name" label="Nome completo" required placeholder="Maria Souza" />
            <Input name="email" type="email" label="E-mail" required placeholder="voce@empresa.com.br" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="password" type="password" label="Senha" required minLength={8} hint="Mínimo de 8 caracteres" />
              <Input name="confirm" type="password" label="Confirmar senha" required minLength={8} />
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/entrar')}>
              Já tenho conta
            </Button>
            <Button type="submit" size="lg" loading={submitting}>
              Enviar cadastro
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
