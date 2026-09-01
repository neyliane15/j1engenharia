import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { normalizePhone, phoneVariants } from '../utils/phone';
import { round, sum, toNumber } from '../utils/money';
import { recalcBidTotals } from './quotation.service';
import { parseMessage, isAllUnknown, type ParsedCommand } from './whatsapp.parser';
import { recordInbound, sendWhatsApp } from './whatsapp.service';
import * as T from './whatsapp.templates';
import { notifyBidReceived } from './notification.service';

const SESSION_TTL_HOURS = 72;

export interface InboundPayload {
  phone: string;
  body: string;
  waId?: string | null;
  name?: string | null;
}

export interface BotResult {
  handled: boolean;
  reply?: string;
  bidId?: string;
  inviteId?: string;
  action: string;
}

const inviteInclude = {
  quotation: { include: { items: { orderBy: { position: 'asc' as const } }, buyerCompany: true } },
  supplierCompany: true,
} as const;

/** Encontra o fornecedor dono de um número, olhando empresa e usuários. */
function findSupplierByPhone(variants: string[]) {
  return prisma.company.findFirst({
    where: {
      type: 'SUPPLIER',
      active: true,
      OR: [{ whatsapp: { in: variants } }, { phone: { in: variants } }, { users: { some: { phone: { in: variants } } } }],
    },
    select: { id: true },
  });
}

/** Uma cotação só aceita resposta por WhatsApp enquanto está aberta e no prazo. */
const openQuotationWhere = (): Prisma.QuotationWhereInput => ({
  status: { in: ['SENT', 'RECEIVING'] },
  deadline: { gte: new Date() },
});

/**
 * Localiza o convite ativo do fornecedor dono deste número.
 *
 * Ordem de prioridade:
 *  1. A conversa em andamento — desde que a cotação siga aberta e no prazo.
 *  2. O convite aberto com o prazo mais próximo de vencer.
 *
 * Cotação fechada, cancelada ou com prazo vencido nunca é escolhida: responder
 * nela gravaria preço numa disputa que já terminou.
 */
async function resolveInvite(phone: string, requestedCode?: string) {
  const variants = phoneVariants(phone);
  if (!variants.length) return null;

  // Código explícito manda em tudo — é o fornecedor dizendo qual disputa
  // está respondendo, e ele pode ter mais de uma aberta.
  if (requestedCode) {
    const company = await findSupplierByPhone(variants);
    if (!company) return null;
    return prisma.quotationInvite.findFirst({
      where: {
        supplierCompanyId: company.id,
        status: { not: 'DECLINED' },
        quotation: { ...openQuotationWhere(), code: requestedCode },
      },
      include: inviteInclude,
    });
  }

  const session = await prisma.whatsAppSession.findFirst({ where: { phone: { in: variants } } });
  if (session?.inviteId && session.expiresAt > new Date()) {
    const invite = await prisma.quotationInvite.findFirst({
      where: {
        id: session.inviteId,
        status: { not: 'DECLINED' },
        quotation: openQuotationWhere(),
      },
      include: inviteInclude,
    });
    if (invite) return invite;
  }

  const company = await findSupplierByPhone(variants);
  if (!company) return null;

  return prisma.quotationInvite.findFirst({
    where: {
      supplierCompanyId: company.id,
      status: { in: ['PENDING', 'SENT', 'VIEWED', 'RESPONDED'] },
      quotation: openQuotationWhere(),
    },
    include: inviteInclude,
    orderBy: [{ quotation: { deadline: 'asc' } }, { createdAt: 'desc' }],
  });
}

/** Garante uma proposta em rascunho com uma linha por item da cotação. */
async function ensureDraftBid(inviteId: string, quotationId: string, supplierCompanyId: string) {
  const existing = await prisma.bid.findUnique({
    where: { quotationId_supplierCompanyId: { quotationId, supplierCompanyId } },
    include: { items: true },
  });
  if (existing) return existing;

  const items = await prisma.quotationItem.findMany({ where: { quotationId }, orderBy: { position: 'asc' } });

  return prisma.bid.create({
    data: {
      quotationId,
      supplierCompanyId,
      inviteId,
      source: 'WHATSAPP',
      status: 'DRAFT',
      items: {
        create: items.map((item) => ({
          quotationItemId: item.id,
          quantity: item.quantity,
          unitPrice: 0,
          total: 0,
          available: true,
        })),
      },
    },
    include: { items: true },
  });
}

async function touchSession(phone: string, data: { inviteId?: string; bidId?: string; step?: string }) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);
  await prisma.whatsAppSession.upsert({
    where: { phone },
    create: { phone, expiresAt, ...data },
    update: { expiresAt, ...data },
  });
}

async function buildSummary(bidId: string): Promise<T.SummaryData> {
  const bid = await prisma.bid.findUniqueOrThrow({
    where: { id: bidId },
    include: {
      quotation: { select: { code: true } },
      items: { include: { quotationItem: true }, orderBy: { quotationItem: { position: 'asc' } } },
    },
  });

  const lines = bid.items.map((i) => ({
    position: i.quotationItem.position,
    description: i.quotationItem.description,
    quantity: toNumber(i.quantity),
    unit: i.quotationItem.unit,
    unitPrice: toNumber(i.unitPrice),
    total: toNumber(i.total),
    available: i.available && toNumber(i.unitPrice) > 0,
    brand: i.brand,
  }));

  const missing = bid.items
    .filter((i) => i.available && toNumber(i.unitPrice) <= 0)
    .map((i) => i.quotationItem.position)
    .sort((a, b) => a - b);

  const subtotal = sum(lines.filter((l) => l.available).map((l) => l.total));
  const freight = toNumber(bid.freight);
  const discount = toNumber(bid.discount);

  return {
    quotationCode: bid.quotation.code,
    lines,
    missing,
    subtotal,
    freight,
    discount,
    total: round(subtotal + freight - discount),
    deliveryDays: bid.deliveryDays,
    paymentTerms: bid.paymentTerms,
  };
}

/**
 * Aplica os comandos da mensagem sobre a proposta em rascunho.
 * Devolve o que mudou, para que a resposta seja específica.
 */
async function applyCommands(bidId: string, quotationId: string, commands: ParsedCommand[]) {
  const items = await prisma.quotationItem.findMany({
    where: { quotationId },
    select: { id: true, position: true, quantity: true },
  });
  const byPosition = new Map(items.map((i) => [i.position, i]));

  const applied: string[] = [];
  const invalidPositions: number[] = [];
  let submit = false;
  let decline: { reason?: string } | null = null;
  let summary = false;
  let help = false;

  for (const cmd of commands) {
    switch (cmd.kind) {
      case 'price': {
        const item = byPosition.get(cmd.position);
        if (!item) {
          invalidPositions.push(cmd.position);
          break;
        }
        await prisma.bidItem.update({
          where: { bidId_quotationItemId: { bidId, quotationItemId: item.id } },
          data: {
            unitPrice: cmd.unitPrice,
            total: round(cmd.unitPrice * toNumber(item.quantity)),
            available: true,
          },
        });
        applied.push(`item ${cmd.position}`);
        break;
      }
      case 'unavailable': {
        const item = byPosition.get(cmd.position);
        if (!item) {
          invalidPositions.push(cmd.position);
          break;
        }
        await prisma.bidItem.update({
          where: { bidId_quotationItemId: { bidId, quotationItemId: item.id } },
          data: { available: false, unitPrice: 0, total: 0 },
        });
        applied.push(`item ${cmd.position} sem estoque`);
        break;
      }
      case 'brand': {
        const item = byPosition.get(cmd.position);
        if (!item) {
          invalidPositions.push(cmd.position);
          break;
        }
        await prisma.bidItem.update({
          where: { bidId_quotationItemId: { bidId, quotationItemId: item.id } },
          data: { brand: cmd.brand },
        });
        applied.push(`marca do item ${cmd.position}`);
        break;
      }
      case 'leadTime':
        await prisma.bid.update({ where: { id: bidId }, data: { deliveryDays: cmd.days } });
        applied.push('prazo de entrega');
        break;
      case 'payment':
        await prisma.bid.update({ where: { id: bidId }, data: { paymentTerms: cmd.terms } });
        applied.push('condição de pagamento');
        break;
      case 'freight':
        await prisma.bid.update({ where: { id: bidId }, data: { freight: cmd.value } });
        applied.push('frete');
        break;
      case 'discount':
        await prisma.bid.update({ where: { id: bidId }, data: { discount: cmd.value } });
        applied.push('desconto');
        break;
      case 'submit':
        submit = true;
        break;
      case 'decline':
        decline = { reason: cmd.reason };
        break;
      case 'summary':
        summary = true;
        break;
      case 'help':
        help = true;
        break;
      case 'selectQuotation':
        // Já foi usado para escolher o convite; aqui é só ruído.
        break;
      default:
        break;
    }
  }

  return { applied, invalidPositions, submit, decline, summary, help };
}

/**
 * Ponto de entrada do robô: processa uma mensagem recebida do fornecedor
 * e devolve o texto de resposta. Toda a cotação por WhatsApp passa por aqui.
 */
export async function handleInboundMessage(payload: InboundPayload): Promise<BotResult> {
  const phone = normalizePhone(payload.phone);
  const text = (payload.body ?? '').trim();

  if (!phone) return { handled: false, action: 'invalid_phone' };

  // O código pode vir sozinho ou no meio da mensagem — vale para toda ela.
  const requestedCode = parseMessage(text).find((c) => c.kind === 'selectQuotation')?.code;
  const invite = await resolveInvite(phone, requestedCode);
  await recordInbound({
    phone,
    body: text,
    waId: payload.waId,
    quotationId: invite?.quotationId ?? null,
    inviteId: invite?.id ?? null,
    payload: { name: payload.name ?? null },
  });

  if (!invite) {
    const reply = requestedCode
      ? T.quotationNotFoundMessage(requestedCode)
      : T.noActiveQuotationMessage();
    await sendWhatsApp({ phone, body: reply });
    return { handled: true, reply, action: requestedCode ? 'quotation_not_found' : 'no_active_quotation' };
  }

  const commands = parseMessage(text);

  // Mensagem que é só o código: confirma a troca mostrando os itens.
  if (commands.length === 1 && commands[0].kind === 'selectQuotation') {
    const bid = await ensureDraftBid(invite.id, invite.quotationId, invite.supplierCompanyId);
    await touchSession(phone, { inviteId: invite.id, bidId: bid.id, step: 'COLLECTING' });
    const summary = await buildSummary(bid.id);
    const reply = `Certo! Agora respondendo a *${invite.quotation.code}* — ${invite.quotation.title}.\n\n${T.summaryMessage(summary)}`;
    await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
    return { handled: true, reply, bidId: bid.id, inviteId: invite.id, action: 'quotation_selected' };
  }

  if (isAllUnknown(commands)) {
    const reply = T.unknownMessage();
    await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
    return { handled: true, reply, inviteId: invite.id, action: 'unknown' };
  }

  // AJUDA não precisa de proposta aberta.
  if (commands.length === 1 && commands[0].kind === 'help') {
    const reply = T.helpMessage();
    await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
    return { handled: true, reply, inviteId: invite.id, action: 'help' };
  }

  const bid = await ensureDraftBid(invite.id, invite.quotationId, invite.supplierCompanyId);
  await touchSession(phone, { inviteId: invite.id, bidId: bid.id, step: 'COLLECTING' });

  if (invite.status === 'PENDING' || invite.status === 'SENT') {
    await prisma.quotationInvite.update({
      where: { id: invite.id },
      data: { status: 'VIEWED', viewedAt: invite.viewedAt ?? new Date() },
    });
  }

  const result = await applyCommands(bid.id, invite.quotationId, commands);

  // Recusar encerra o fluxo.
  if (result.decline) {
    await prisma.$transaction([
      prisma.quotationInvite.update({
        where: { id: invite.id },
        data: { status: 'DECLINED', declineReason: result.decline.reason ?? null, respondedAt: new Date() },
      }),
      prisma.bid.update({ where: { id: bid.id }, data: { status: 'WITHDRAWN' } }),
      prisma.whatsAppSession.updateMany({ where: { phone }, data: { step: 'DONE' } }),
    ]);
    const reply = T.declinedMessage(invite.quotation.code);
    await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
    return { handled: true, reply, bidId: bid.id, inviteId: invite.id, action: 'declined' };
  }

  // A proposta passa a constar como respondida por WhatsApp — é o canal real
  // da última alteração, e o comparativo mostra isso ao comprador.
  if (bid.source !== 'WHATSAPP') {
    await prisma.bid.update({ where: { id: bid.id }, data: { source: 'WHATSAPP' } });
  }

  await recalcBidTotals(bid.id);
  const summary = await buildSummary(bid.id);

  if (result.help) {
    const reply = T.helpMessage();
    await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
    return { handled: true, reply, bidId: bid.id, inviteId: invite.id, action: 'help' };
  }

  if (result.submit) {
    if (summary.missing.length) {
      const reply = [
        '⚠️ Ainda não dá para enviar.',
        '',
        T.summaryMessage(summary),
      ].join('\n');
      await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
      return { handled: true, reply, bidId: bid.id, inviteId: invite.id, action: 'submit_blocked' };
    }

    await prisma.$transaction([
      prisma.bid.update({ where: { id: bid.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } }),
      prisma.quotationInvite.update({
        where: { id: invite.id },
        data: { status: 'RESPONDED', respondedAt: new Date() },
      }),
      prisma.whatsAppSession.updateMany({ where: { phone }, data: { step: 'DONE' } }),
    ]);

    if (invite.quotation.status === 'SENT') {
      await prisma.quotation.update({ where: { id: invite.quotationId }, data: { status: 'RECEIVING' } });
    }

    await notifyBidReceived(bid.id).catch((err) => logger.warn({ err }, 'falha ao notificar comprador'));

    const reply = T.submittedMessage(invite.quotation.code, summary.total, invite.quotation.buyerCompany.name);
    await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
    return { handled: true, reply, bidId: bid.id, inviteId: invite.id, action: 'submitted' };
  }

  // Qualquer alteração ou pedido de resumo devolve o espelho da proposta.
  const head = result.applied.length ? `✅ Registrado: ${result.applied.join(', ')}.\n\n` : '';
  const warn = result.invalidPositions.length
    ? `\n\n⚠️ Não existe item ${result.invalidPositions.join(', ')} nesta cotação (são ${summary.lines.length} itens).`
    : '';
  const reply = `${head}${T.summaryMessage(summary)}${warn}`;

  await sendWhatsApp({ phone, body: reply, quotationId: invite.quotationId, inviteId: invite.id });
  return {
    handled: true,
    reply,
    bidId: bid.id,
    inviteId: invite.id,
    action: result.summary ? 'summary' : 'updated',
  };
}
