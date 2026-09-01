import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Notification, Role } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
  end?: boolean;
}

const NAV: Record<Role, { section: string; items: NavItem[] }[]> = {
  ADMIN: [
    {
      section: 'Plataforma',
      items: [
        { to: '/admin', label: 'Visão geral', icon: Gauge, end: true },
        { to: '/admin/usuarios', label: 'Usuários e acessos', icon: Users },
        { to: '/admin/empresas', label: 'Empresas', icon: Building2 },
        { to: '/admin/cotacoes', label: 'Cotações', icon: ShoppingCart },
      ],
    },
    {
      section: 'Automação',
      items: [
        { to: '/admin/whatsapp', label: 'WhatsApp', icon: MessageSquareText },
        { to: '/admin/auditoria', label: 'Auditoria', icon: ScrollText },
        { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
      ],
    },
  ],
  BUYER: [
    {
      section: 'Compras',
      items: [
        { to: '/comprador', label: 'Meu painel', icon: LayoutDashboard, end: true },
        { to: '/comprador/cotacoes', label: 'Minhas cotações', icon: ShoppingCart },
        { to: '/comprador/fornecedores', label: 'Fornecedores', icon: Truck },
        { to: '/comprador/precos', label: 'Histórico de preços', icon: FileSpreadsheet },
      ],
    },
  ],
  SUPPLIER: [
    {
      section: 'Vendas',
      items: [
        { to: '/fornecedor', label: 'Meu painel', icon: LayoutDashboard, end: true },
        { to: '/fornecedor/cotacoes', label: 'Cotações recebidas', icon: ShoppingCart },
        { to: '/fornecedor/pedidos', label: 'Pedidos ganhos', icon: Package },
        { to: '/fornecedor/faturamento', label: 'Faturamento', icon: FileSpreadsheet },
      ],
    },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  BUYER: 'Comprador',
  SUPPLIER: 'Fornecedor',
};

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cada navegação fecha o menu no celular.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  if (!user) return null;
  const sections = NAV[user.role];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — fixa no desktop, gaveta no celular */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-sidebar-border bg-sidebar',
          'transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Logo tone="light" showTagline />
          <button
            className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.section}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                {section.section}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          'border border-transparent',
                          isActive
                            ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-sidebar-primary')} />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="truncate text-sm font-medium text-white">{user.company?.name ?? 'Emptra'}</p>
            <p className="mt-0.5 text-xs text-sidebar-foreground/70">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-brand-deep/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-md border border-border p-2 text-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">Olá, {user.name.split(' ')[0]}</p>
            <p className="truncate text-xs text-muted-foreground">{user.jobTitle ?? ROLE_LABEL[user.role]}</p>
          </div>

          <NotificationsBell />

          <UserMenu
            name={user.name}
            email={user.email}
            onLogout={async () => {
              await logout();
              navigate('/entrar', { replace: true });
            }}
          />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          Emptra · cotações para arquitetos e engenheiros
        </footer>
      </div>
    </div>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: Notification[]; unread: number }>('/notifications?limit=12'),
    refetchInterval: 60_000,
  });

  const unread = data?.unread ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (unread) void api.post('/notifications/read');
        }}
        className="relative rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-80 animate-slide-up overflow-hidden rounded-lg border border-border bg-card shadow-pop">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Notificações</p>
            </div>
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {data?.data.length ? (
                data.data.map((n) => (
                  <li key={n.id} className={cn('px-4 py-3', !n.read && 'bg-primary/[0.04]')}>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{n.body}</p>}
                    {n.link && (
                      <NavLink to={n.link} className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline">
                        Abrir
                      </NavLink>
                    )}
                  </li>
                ))
              ) : (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nada por aqui ainda.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu({ name, email, onLogout }: { name: string; email: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-border py-1.5 pl-1.5 pr-2 transition-colors hover:bg-secondary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-deep text-[11px] font-semibold text-brand-deep-foreground">
          {initials(name)}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-60 animate-slide-up overflow-hidden rounded-lg border border-border bg-card shadow-pop">
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <NavLink
              to="/perfil"
              className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-secondary"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              Meu perfil
            </NavLink>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  badge,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl leading-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export { Badge };
