import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { BadRequest, NotFound } from '../lib/errors';
import { normalizePhone } from '../utils/phone';
import { inviteToken } from '../utils/code';
import { toNumber } from '../utils/money';
import { callN8n } from './n8n.service';
import { sendWhatsApp } from './whatsapp.service';
import * as T from './whatsapp.templates';
import { notifyCompany } from './notification.service';

export interface DispatchResult {
  quotationId: string;
  dispatched: { supplierId: string; supplierName: string; phone: string | null; ok: boolean; reason?: string }[];
  n8nAccepted: boolean;
}

/**
 * Dispara a cotação para todos os fornecedores convidados via WhatsApp.
 *
 * Estratégia em duas camadas:
 *  1. Envia o payload completo ao workflow do n8n (que fala com o WhatsApp).
 *  2. Se o n8n não aceitar, registra as mensagens como FAILED — nenhum convite
 *     se perde silenciosamente e o admin vê tudo em /admin/whatsapp.
 */
export async function dispatchQuotation(quotationId: string): Promise<DispatchResult> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      items: { orderBy: { position: 'asc' } },
      buyerCompany: true,
      createdBy: { select: { name: true, email: true, phone: true } },
      invites: { include: { supplierCompany: { include: { supplierProfile: true } } } },
    },
  });

  if (!quotation) throw NotFound('Cotação não encontrada');
  if (quotation.items.length === 0) throw BadRequest('A cotação precisa ter ao menos um item');
  if (quotation.invites.length === 0) throw BadRequest('Selecione ao menos um fornecedor');
  if (quotation.status === 'AWARDED' || quotation.status === 'CANCELLED') {
    throw BadRequest('Esta cotação já foi encerrada');
  }

  const deadline = dayjs(quotation.deadline).format('DD/MM/YYYY [às] HH:mm');
  const dispatched: DispatchResult['dispatched'] = [];
  const n8nInvites: Record<string, unknown>[] = [];

  for (const invite of quotation.invites) {
    const supplier = invite.supplierCompany;
    const phone = normalizePhone(invite.phone ?? supplier.whatsapp ?? supplier.phone);
    const token = invite.token || inviteToken();
    const link = `${env.APP_URL.replace(/\/$/, '')}/cotacao/${token}`;

    if (!phone) {
      dispatched.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        phone: null,
        ok: false,
        reason: 'Fornecedor sem WhatsApp cadastrado',
      });
      continue;
    }

    const body = T.inviteMessage({
      supplierName: supplier.tradeName || supplier.name,
      buyerName: quotation.buyerCompany.name,
      quotationCode: quotation.code,
      quotationTitle: quotation.title,
      deadline,
      items: quotation.items.map((i) => ({
        position: i.position,
        description: i.description,
        quantity: toNumber(i.quantity).toLocaleString('pt-BR'),
        unit: i.unit,
        brandRef: i.brandRef,
      })),
      link,
    });

    await prisma.quotationInvite.update({
      where: { id: invite.id },
      data: { token, phone, status: 'SENT', sentAt: new Date() },
    });

    const sent = await sendWhatsApp({
      phone,
      body,
      template: 'cotacao_convite',
      quotationId: quotation.id,
      inviteId: invite.id,
    });

    n8nInvites.push({
      inviteId: invite.id,
      supplierId: supplier.id,
      supplierName: supplier.tradeName || supplier.name,
      phone,
      token,
      link,
      messageId: sent?.id ?? null,
    });

    dispatched.push({
      supplierId: supplier.id,
      supplierName: supplier.name,
      phone,
      ok: sent?.ok ?? false,
      ...(sent?.ok ? {} : { reason: sent?.error ?? 'A automação do WhatsApp não aceitou a mensagem' }),
    });
  }

  // Payload agregado — permite ao n8n fazer disparo em lote, throttling e
  // agendar os lembretes de prazo.
  const n8nResult = await callN8n('dispatch', {
    event: 'quotation.dispatched',
    quotation: {
      id: quotation.id,
      code: quotation.code,
      title: quotation.title,
      deadline: quotation.deadline,
      deadlineFormatted: deadline,
      buyer: { id: quotation.buyerCompanyId, name: quotation.buyerCompany.name },
      contact: quotation.createdBy,
      items: quotation.items.map((i) => ({
        position: i.position,
        description: i.description,
        quantity: toNumber(i.quantity),
        unit: i.unit,
        brandRef: i.brandRef,
      })),
    },
    invites: n8nInvites,
  });

  await prisma.quotation.update({
    where: { id: quotation.id },
    data: { status: quotation.status === 'DRAFT' ? 'SENT' : quotation.status, sentAt: quotation.sentAt ?? new Date() },
  });

  for (const invite of quotation.invites) {
    await notifyCompany(invite.supplierCompanyId, {
      type: 'QUOTATION_SENT',
      title: `Nova cotação: ${quotation.code}`,
      body: `${quotation.buyerCompany.name} quer o seu preço para "${quotation.title}". Prazo: ${deadline}.`,
      link: `/fornecedor/cotacoes/${quotation.id}`,
    }).catch((err) => logger.warn({ err }, 'falha ao notificar fornecedor'));
  }

  return { quotationId: quotation.id, dispatched, n8nAccepted: n8nResult.ok };
}

/** Envia lembretes aos convites ainda sem resposta. Usado pelo cron do n8n. */
export async function sendReminders(hoursBefore = 24): Promise<{ sent: number }> {
  const limit = dayjs().add(hoursBefore, 'hour').toDate();

  const invites = await prisma.quotationInvite.findMany({
    where: {
      status: { in: ['SENT', 'VIEWED'] },
      remindersSent: { lt: 2 },
      quotation: { status: { in: ['SENT', 'RECEIVING'] }, deadline: { lte: limit, gte: new Date() } },
    },
    include: { quotation: { include: { buyerCompany: true } }, supplierCompany: true },
  });

  let sent = 0;
  for (const invite of invites) {
    const phone = normalizePhone(invite.phone ?? invite.supplierCompany.whatsapp ?? invite.supplierCompany.phone);
    if (!phone) continue;

    const hoursLeft = Math.max(1, dayjs(invite.quotation.deadline).diff(dayjs(), 'hour'));
    const body = T.reminderMessage({
      quotationCode: invite.quotation.code,
      buyerName: invite.quotation.buyerCompany.name,
      hoursLeft,
      link: `${env.APP_URL.replace(/\/$/, '')}/cotacao/${invite.token}`,
    });

    await sendWhatsApp({ phone, body, template: 'cotacao_lembrete', quotationId: invite.quotationId, inviteId: invite.id });
    await prisma.quotationInvite.update({
      where: { id: invite.id },
      data: { remindersSent: { increment: 1 } },
    });
    sent++;
  }

  return { sent };
}

/** Fecha cotações cujo prazo expirou. Usado pelo cron do n8n. */
export async function closeExpiredQuotations(): Promise<{ closed: number }> {
  const expired = await prisma.quotation.findMany({
    where: { status: { in: ['SENT', 'RECEIVING'] }, deadline: { lt: new Date() } },
    select: { id: true, buyerCompanyId: true, code: true },
  });

  for (const q of expired) {
    await prisma.$transaction([
      prisma.quotation.update({ where: { id: q.id }, data: { status: 'CLOSED', closedAt: new Date() } }),
      prisma.quotationInvite.updateMany({
        where: { quotationId: q.id, status: { in: ['PENDING', 'SENT', 'VIEWED'] } },
        data: { status: 'EXPIRED' },
      }),
    ]);
    await notifyCompany(q.buyerCompanyId, {
      type: 'DEADLINE_NEAR',
      title: `Cotação ${q.code} encerrada`,
      body: 'O prazo terminou. As propostas recebidas já estão prontas para comparação.',
      link: `/comprador/cotacoes/${q.id}`,
    }).catch(() => undefined);
  }

  return { closed: expired.length };
}
