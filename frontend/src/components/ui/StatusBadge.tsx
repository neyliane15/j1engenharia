import { Badge } from './Badge';
import type { BidStatus, InviteStatus, QuotationStatus, UserStatus } from '@/types';

const quotation: Record<QuotationStatus, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'deep' }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  SENT: { label: 'Enviada', tone: 'primary' },
  RECEIVING: { label: 'Recebendo propostas', tone: 'primary' },
  CLOSED: { label: 'Em análise', tone: 'warning' },
  AWARDED: { label: 'Aprovada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

const bid: Record<BidStatus, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  SUBMITTED: { label: 'Enviada', tone: 'primary' },
  APPROVED: { label: 'Aprovada', tone: 'success' },
  REJECTED: { label: 'Não aprovada', tone: 'danger' },
  WITHDRAWN: { label: 'Recusada', tone: 'neutral' },
};

const invite: Record<InviteStatus, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  PENDING: { label: 'Aguardando envio', tone: 'neutral' },
  SENT: { label: 'Enviado', tone: 'primary' },
  VIEWED: { label: 'Visualizado', tone: 'primary' },
  RESPONDED: { label: 'Respondeu', tone: 'success' },
  DECLINED: { label: 'Recusou', tone: 'danger' },
  EXPIRED: { label: 'Expirou', tone: 'warning' },
};

const user: Record<UserStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  PENDING: { label: 'Aguardando liberação', tone: 'warning' },
  ACTIVE: { label: 'Ativo', tone: 'success' },
  SUSPENDED: { label: 'Suspenso', tone: 'danger' },
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const s = quotation[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function BidStatusBadge({ status }: { status: BidStatus }) {
  const s = bid[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const s = invite[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const s = user[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}
