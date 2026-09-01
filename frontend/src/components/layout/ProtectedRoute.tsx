import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingBlock } from '@/components/ui/Feedback';
import type { Role } from '@/types';

/**
 * Porteiro das rotas privadas: exige sessão e, quando informado, um dos papéis.
 * Quem entra com o papel errado vai para o próprio painel, não para uma tela de erro.
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading, homeFor } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingBlock label="Carregando sua sessão..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/entrar" state={{ from: location.pathname }} replace />;

  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;

  return <Outlet />;
}
