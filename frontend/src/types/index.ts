export type Role = 'ADMIN' | 'BUYER' | 'SUPPLIER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type CompanyType = 'BUYER' | 'SUPPLIER';
export type QuotationStatus = 'DRAFT' | 'SENT' | 'RECEIVING' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
export type InviteStatus = 'PENDING' | 'SENT' | 'VIEWED' | 'RESPONDED' | 'DECLINED' | 'EXPIRED';
export type BidStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface Company {
  id: string;
  type: CompanyType;
  name: string;
  tradeName?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  active: boolean;
  createdAt?: string;
  supplierProfile?: SupplierProfile | null;
  _count?: { users: number };
}

export interface SupplierProfile {
  id: string;
  categories: string[];
  description?: string | null;
  deliveryDays: number;
  paymentTerms?: string | null;
  rating: string | number;
  autoReply: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  phone?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  companyId?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  company?: Company | null;
}

export interface QuotationItem {
  id: string;
  position: number;
  description: string;
  sku?: string | null;
  unit: string;
  quantity: number | string;
  brandRef?: string | null;
  targetPrice?: number | string | null;
  notes?: string | null;
}

export interface QuotationInvite {
  id: string;
  supplierCompanyId: string;
  status: InviteStatus;
  token: string;
  phone?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  declineReason?: string | null;
  supplierCompany?: Pick<Company, 'id' | 'name' | 'tradeName' | 'city' | 'state' | 'whatsapp'>;
}

export interface Quotation {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  status: QuotationStatus;
  deadline: string;
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  createdAt: string;
  sentAt?: string | null;
  awardedAt?: string | null;
  project?: { id: string; name: string } | null;
  buyerCompany?: { id: string; name: string };
  createdBy?: { id: string; name: string; email?: string };
  items?: QuotationItem[];
  invites?: QuotationInvite[];
  awards?: Award[];
  _count?: { items: number; invites: number; bids: number };
  myInvite?: QuotationInvite | null;
  myBid?: { id: string; status: BidStatus; totalAmount: number | string } | null;
}

export interface BidItem {
  id: string;
  quotationItemId: string;
  unitPrice: number | string;
  quantity: number | string;
  total: number | string;
  brand?: string | null;
  available: boolean;
  leadTimeDays?: number | null;
  notes?: string | null;
  quotationItem?: QuotationItem;
}

export interface Bid {
  id: string;
  quotationId: string;
  supplierCompanyId: string;
  status: BidStatus;
  source: 'WEB' | 'WHATSAPP' | 'IMPORT';
  totalAmount: number | string;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  freight: number | string;
  discount: number | string;
  notes?: string | null;
  submittedAt?: string | null;
  items?: BidItem[];
  quotation?: Quotation;
  supplierCompany?: Pick<Company, 'id' | 'name' | 'tradeName'>;
}

export interface Award {
  id: string;
  totalAmount: number | string;
  savings: number | string;
  createdAt: string;
  supplierCompany?: Pick<Company, 'id' | 'name' | 'tradeName'>;
  items?: { id: string; quotationItem?: QuotationItem }[];
}

// ── Comparativo ───────────────────────────────────────────────

export interface ComparisonCell {
  bidId: string;
  supplierId: string;
  supplierName: string;
  bidItemId: string | null;
  unitPrice: number;
  total: number;
  brand: string | null;
  available: boolean;
  leadTimeDays: number | null;
  isBest: boolean;
  deltaToBestPct: number;
}

export interface ComparisonRow {
  itemId: string;
  position: number;
  description: string;
  unit: string;
  quantity: number;
  brandRef: string | null;
  targetPrice: number | null;
  cells: ComparisonCell[];
  bestUnitPrice: number | null;
  worstUnitPrice: number | null;
  averageUnitPrice: number | null;
  bestSupplierId: string | null;
  spreadPct: number;
}

export interface ComparisonSupplier {
  bidId: string;
  supplierId: string;
  supplierName: string;
  status: BidStatus;
  source: string;
  total: number;
  freight: number;
  discount: number;
  deliveryDays: number | null;
  paymentTerms: string | null;
  submittedAt: string | null;
  itemsQuoted: number;
  itemsMissing: number;
  bestPriceCount: number;
  coveragePct: number;
  rankByTotal: number;
}

export interface Comparison {
  rows: ComparisonRow[];
  suppliers: ComparisonSupplier[];
  totals: {
    itemCount: number;
    bidCount: number;
    bestScenarioTotal: number;
    cheapestSingleSupplierTotal: number | null;
    averageTotal: number;
    highestTotal: number;
    potentialSavings: number;
    potentialSavingsPct: number;
    splitGain: number;
  };
}

// ── Dashboards ────────────────────────────────────────────────

export interface BuyerDashboard {
  kpis: {
    totalAwarded: number;
    totalBaseline: number;
    totalSavings: number;
    savingsPct: number;
    orders: number;
    openQuotations: number;
    quotationsTotal: number;
    averageTicket: number;
    supplierResponseRate: number;
  };
  quotationsByStatus: Record<string, number>;
  series: { month: string; label: string; purchased: number; savings: number; orders: number }[];
  topSuppliers: {
    supplierId: string;
    name: string;
    total: number;
    savings: number;
    orders: number;
    items: number;
    invited: number;
    submitted: number;
    responseRate: number;
    winRate: number;
    averageTicket: number;
  }[];
  categories: { name: string; total: number }[];
  upcoming: {
    id: string;
    code: string;
    title: string;
    status: QuotationStatus;
    deadline: string;
    _count: { bids: number; invites: number };
  }[];
  recentAwards: {
    id: string;
    quotation: { id: string; code: string; title: string };
    supplier: string;
    total: number;
    savings: number;
    createdAt: string;
  }[];
}

export interface SupplierDashboard {
  kpis: {
    revenue: number;
    revenueAllTime: number;
    ordersAllTime: number;
    orders: number;
    averageTicket: number;
    clients: number;
    invited: number;
    submitted: number;
    won: number;
    responseRate: number;
    winRate: number;
    pendingInvites: number;
  };
  funnel: { stage: string; value: number }[];
  series: { month: string; label: string; revenue: number; orders: number }[];
  clients: { clientId: string; name: string; revenue: number; orders: number; lastAt: string }[];
  topProducts: { name: string; total: number; count: number }[];
  openInvites: {
    inviteId: string;
    token: string;
    status: InviteStatus;
    quotation: {
      id: string;
      code: string;
      title: string;
      deadline: string;
      buyerCompany: { name: string };
      _count: { items: number };
    };
  }[];
  recentAwards: {
    id: string;
    quotation: { id: string; code: string; title: string; buyerCompany: { id: string; name: string } };
    total: number;
    itemCount: number;
    createdAt: string;
  }[];
}

export interface AdminOverview {
  users: { pending: number; active: number };
  companies: { buyers: number; suppliers: number };
  quotations: Record<string, number>;
  gmv: { awardedTotal: number; savingsTotal: number; awardCount: number };
  whatsapp: { total: number; failed: number };
  recentQuotations: {
    id: string;
    code: string;
    title: string;
    status: QuotationStatus;
    deadline: string;
    createdAt: string;
    buyerCompany: { name: string };
    _count: { bids: number; invites: number };
  }[];
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; perPage: number; pages: number };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}
