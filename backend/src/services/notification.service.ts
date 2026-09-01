import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import type { NotificationType } from '@prisma/client';
import { toNumber, formatBRL } from '../utils/money';

export async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    },
  });
}

/** Notifica todos os usuários ativos de uma empresa. */
export async function notifyCompany(
  companyId: string,
  params: { type: NotificationType; title: string; body?: string; link?: string },
) {
  const users = await prisma.user.findMany({
    where: { companyId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!users.length) return [];
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    })),
  });
  return users.map((u) => u.id);
}

/** Avisa o comprador que uma proposta chegou. */
export async function notifyBidReceived(bidId: string) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      quotation: { select: { id: true, code: true, title: true, buyerCompanyId: true } },
      supplierCompany: { select: { name: true, tradeName: true } },
    },
  });
  if (!bid) return;

  const supplier = bid.supplierCompany.tradeName || bid.supplierCompany.name;
  await notifyCompany(bid.quotation.buyerCompanyId, {
    type: 'BID_RECEIVED',
    title: `Nova proposta em ${bid.quotation.code}`,
    body: `${supplier} enviou uma proposta de ${formatBRL(toNumber(bid.totalAmount))}.`,
    link: `/comprador/cotacoes/${bid.quotation.id}`,
  }).catch((err) => logger.warn({ err }, 'falha ao notificar comprador'));
}
