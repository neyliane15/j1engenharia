import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Profile from '@/pages/Profile';
import NotFound from '@/pages/NotFound';
import PublicBid from '@/pages/public/PublicBid';

import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminCompanies from '@/pages/admin/AdminCompanies';
import AdminQuotations from '@/pages/admin/AdminQuotations';
import AdminWhatsApp from '@/pages/admin/AdminWhatsApp';
import AdminAudit from '@/pages/admin/AdminAudit';
import AdminSettings from '@/pages/admin/AdminSettings';

import BuyerDashboard from '@/pages/buyer/BuyerDashboard';
import QuotationList from '@/pages/buyer/QuotationList';
import QuotationNew from '@/pages/buyer/QuotationNew';
import QuotationDetail from '@/pages/buyer/QuotationDetail';
import SupplierList from '@/pages/buyer/SupplierList';
import PriceHistory from '@/pages/buyer/PriceHistory';

import SupplierDashboard from '@/pages/supplier/SupplierDashboard';
import SupplierQuotations from '@/pages/supplier/SupplierQuotations';
import BidForm from '@/pages/supplier/BidForm';
import SupplierAwards, { SupplierRevenue } from '@/pages/supplier/SupplierAwards';

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/entrar" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/cotacao/:token" element={<PublicBid />} />

      {/* Comuns a qualquer perfil autenticado */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/perfil" element={<Profile />} />
        </Route>
      </Route>

      {/* Administrador */}
      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/usuarios" element={<AdminUsers />} />
          <Route path="/admin/empresas" element={<AdminCompanies />} />
          <Route path="/admin/cotacoes" element={<AdminQuotations />} />
          <Route path="/admin/whatsapp" element={<AdminWhatsApp />} />
          <Route path="/admin/auditoria" element={<AdminAudit />} />
          <Route path="/admin/configuracoes" element={<AdminSettings />} />
        </Route>
      </Route>

      {/* Comprador */}
      <Route element={<ProtectedRoute roles={['BUYER']} />}>
        <Route element={<AppShell />}>
          <Route path="/comprador" element={<BuyerDashboard />} />
          <Route path="/comprador/cotacoes" element={<QuotationList />} />
          <Route path="/comprador/cotacoes/nova" element={<QuotationNew />} />
          <Route path="/comprador/cotacoes/:id" element={<QuotationDetail />} />
          <Route path="/comprador/fornecedores" element={<SupplierList />} />
          <Route path="/comprador/precos" element={<PriceHistory />} />
        </Route>
      </Route>

      {/* Fornecedor */}
      <Route element={<ProtectedRoute roles={['SUPPLIER']} />}>
        <Route element={<AppShell />}>
          <Route path="/fornecedor" element={<SupplierDashboard />} />
          <Route path="/fornecedor/cotacoes" element={<SupplierQuotations />} />
          <Route path="/fornecedor/cotacoes/:id" element={<BidForm />} />
          <Route path="/fornecedor/pedidos" element={<SupplierAwards />} />
          <Route path="/fornecedor/pedidos/:id" element={<SupplierAwards />} />
          <Route path="/fornecedor/faturamento" element={<SupplierRevenue />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/entrar" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
