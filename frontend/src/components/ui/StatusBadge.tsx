import { Badge } from './Badge';
import type { BidStatus, InviteStatus, QuotationStatus, UserStatus } from '@/types';

/**
 * Nenhum estado depende só de cor: todo chip carrega o rótulo escrito, porque
 * parte dos engenheiros tem alguma deficiência de percepção de cor e porque a
 * tabela vai ser impressa em preto e branco em algum momento.
 */
type Tone = 'neutral' | 'pending' | 'approved' | 'rejected';

const quotation: Record<QuotationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  SENT: { label: 'Em cotação', tone: 'neutral' },
  RECEIVING: { label: 'Em cotação', tone: 'neutral' },
  CLOSED: { label: 'Aguardando aprovação', tone: 'pending' },
  AWARDED: { label: 'Aprovada', tone: 'approved' },
  CANCELLED: { label: 'Cancelada', tone: 'rejected' },
};

const bid: Record<BidStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  SUBMITTED: { label: 'Enviada', tone: 'neutral' },
  APPROVED: { label: 'Aprovada', tone: 'approved' },
  REJECTED: { label: 'Recusada', tone: 'rejected' },
  WITHDRAWN: { label: 'Retirada', tone: 'neutral' },
};

const invite: Record<InviteStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Aguardando envio', tone: 'neutral' },
  SENT: { label: 'Enviado', tone: 'neutral' },
  VIEWED: { label: 'Visualizado', tone: 'neutral' },
  RESPONDED: { label: 'Respondeu', tone: 'approved' },
  DECLINED: { label: 'Recusou', tone: 'rejected' },
  EXPIRED: { label: 'Expirou', tone: 'pending' },
};

const user: Record<UserStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Aguardando liberação', tone: 'pending' },
  ACTIVE: { label: 'Ativo', tone: 'approved' },
  SUSPENDED: { label: 'Suspenso', tone: 'rejected' },
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const s = quotation[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function BidStatusBadge({ status }: { status: BidStatus }) {
  const s = bid[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const s = invite[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const s = user[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
