import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ListChecks, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

const HIGHLIGHTS = [
  {
    icon: MessageSquareText,
    title: 'Resposta registrada',
    text: 'O fornecedor responde os preços no próprio WhatsApp e cada mensagem fica gravada.',
  },
  {
    icon: ListChecks,
    title: 'Comparação item a item',
    text: 'O melhor preço de cada linha, a diferença de cada concorrente e as condições lado a lado.',
  },
  {
    icon: ShieldCheck,
    title: 'Acesso controlado',
    text: 'Comprador e fornecedor só enxergam o que é deles. O administrador libera cada acesso.',
  },
];

export default function Login() {
  const { user, login, loading, homeFor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={location.state?.from ?? homeFor(user.role)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const logged = await login(email, password);
      navigate(location.state?.from ?? homeFor(logged.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,44%)]">
      {/* Painel da marca — some no celular para não empurrar o formulário */}
      <section className="relative hidden flex-col justify-between bg-brand-deep p-12 lg:flex">
        <Logo tone="light" />

        <div className="max-w-md">
          <h1 className="text-[36px] leading-[1.15] text-white">
            Da requisição ao pedido, com registro de cada etapa.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-foreground">
            O Emptra dispara a cotação aos fornecedores, recebe as propostas pelo WhatsApp e conduz a decisão até a
            aprovação — com a trilha inteira guardada.
          </p>

          <ul className="mt-8 space-y-6">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3">
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent text-sidebar-primary">
                  <h.icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{h.title}</p>
                  <p className="mt-1 text-sm text-sidebar-foreground/80">{h.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          Emptra · compras e cotação para arquitetura e engenharia
        </p>
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center bg-background px-6 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h2 className="text-2xl text-foreground">Entrar na plataforma</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use o e-mail cadastrado pelo administrador.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com.br"
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              Entrar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tem acesso?{' '}
            <Link to="/cadastro" className="font-medium text-primary hover:underline">
              Solicitar cadastro
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
