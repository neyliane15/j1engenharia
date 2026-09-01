import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { linkButtonClass } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function NotFound() {
  const { user, homeFor } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Logo showTagline />
      <div>
        <p className="num text-5xl font-semibold text-primary">404</p>
        <h1 className="mt-2 text-2xl">Página não encontrada</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          O endereço que você abriu não existe ou foi movido.
        </p>
      </div>
      <Link to={user ? homeFor(user.role) : '/entrar'} className={linkButtonClass()}>
        {user ? 'Voltar ao meu painel' : 'Ir para o login'}
      </Link>
    </div>
  );
}
