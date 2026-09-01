import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { BadRequest, NotFound } from '../../lib/errors';
import { toNumber } from '../../utils/money';
import { recalcBidTotals } from '../../services/quotation.service';
import { notifyBidReceived } from '../../services/notification.service';
import { audit } from '../../utils/audit';

export const publicRouter = Router();

// Rotas abertas por token — limite mais apertado que o resto da API.
const tokenLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
publicRouter.use(tokenLimiter);

async function loadInvite(token: string) {
  const invite = await prisma.quotationInvite.findUnique({
    where: { token },
    include: {
      supplierCompany: { select: { id: true, name: true, tradeName: true } },
      quotation: {
        include: {
          items: { orderBy: { position: 'asc' } },
          buyerCompany: { select: { name: true, city: true, state: true } },
          createdBy: { select: { name: true, email: true } },
          project: { select: { name: true } },
        },
      },
    },
  });
  if (!invite) throw NotFound('Link de cotação inválido ou expirado');
  return invite;
}

/**
 * GET /public/quotation/:token
 * Página que o fornecedor abre pelo link do WhatsApp — sem login.
 */
publicRouter.get(
  '/quotation/:token',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.params);
    const invite = await loadInvite(token);

    if (invite.status === 'SENT' || invite.status === 'PENDING') {
      await prisma.quotationInvite.update({
        where: { id: invite.id },
        data: { status: 'VIEWED', viewedAt: new Date() },
      });
    }

    const bid = await prisma.bid.findUnique({
      where: {
        quotationId_supplierCompanyId: {
          quotationId: invite.quotationId,
          supplierCompanyId: invite.supplierCompanyId,
        },
      },
      include: { items: true },
    });

    const q = invite.quotation;
    res.json({
      invite: { id: invite.id, status: invite.status, token },
      supplier: invite.supplierCompany,
      quotation: {
        id: q.id,
        code: q.code,
        title: q.title,
        description: q.description,
        status: q.status,
        deadline: q.deadline,
        deliveryAddress: q.deliveryAddress,
        deliveryDate: q.deliveryDate,
        paymentTerms: q.paymentTerms,
        notes: q.notes,
        project: q.project,
        buyer: q.buyerCompany,
        contact: q.createdBy,
        items: q.items.map((i) => ({
          id: i.id,
          position: i.position,
          description: i.description,
          sku: i.sku,
          unit: i.unit,
          quantity: toNumber(i.quantity),
          brandRef: i.brandRef,
          notes: i.notes,
        })),
      },
      bid: bid
        ? {
            id: bid.id,
            status: bid.status,
            deliveryDays: bid.deliveryDays,
            paymentTerms: bid.paymentTerms,
            freight: toNumber(bid.freight),
            discount: toNumber(bid.discount),
            notes: bid.notes,
            totalAmount: toNumber(bid.totalAmount),
            items: bid.items.map((i) => ({
              quotationItemId: i.quotationItemId,
              unitPrice: toNumber(i.unitPrice),
              brand: i.brand,
              available: i.available,
              leadTimeDays: i.leadTimeDays,
              notes: i.notes,
            })),
          }
        : null,
      expired: q.deadline < new Date(),
      closed: ['AWARDED', 'CANCELLED'].includes(q.status),
    });
  }),
);

/** POST /public/quotation/:token/bid — envia a proposta sem login. */
publicRouter.post(
  '/quotation/:token/bid',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.params);
    const data = z
      .object({
        deliveryDays: z.number().int().min(0).max(365).optional().nullable(),
        paymentTerms: z.string().max(120).optional().nullable(),
        freight: z.number().nonnegative().default(0),
        discount: z.number().nonnegative().default(0),
        notes: z.string().max(600).optional().nullable(),
        items: z
          .array(
            z.object({
              quotationItemId: z.string().uuid(),
              unitPrice: z.number().nonnegative(),
              brand: z.string().max(80).optional().nullable(),
              available: z.boolean().default(true),
              leadTimeDays: z.number().int().min(0).max(365).optional().nullable(),
            }),
          )
          .min(1),
        submit: z.boolean().default(true),
      })
      .parse(req.body);

    const invite = await loadInvite(token);
    const q = invite.quotation;

    if (['AWARDED', 'CANCELLED'].includes(q.status)) throw BadRequest('Esta cotação já foi encerrada');
    if (q.deadline < new Date() && q.status !== 'CLOSED') throw BadRequest('O prazo desta cotação expirou');

    const validIds = new Set(q.items.map((i) => i.id));
    if (data.items.some((i) => !validIds.has(i.quotationItemId))) {
      throw BadRequest('Um dos itens não pertence a esta cotação');
    }

    const existing = await prisma.bid.findUnique({
      where: { quotationId_supplierCompanyId: { quotationId: q.id, supplierCompanyId: invite.supplierCompanyId } },
    });
    if (existing?.status === 'APPROVED') throw BadRequest('Esta proposta já foi aprovada e não pode ser alterada');

    const bid = await prisma.bid.upsert({
      where: { quotationId_supplierCompanyId: { quotationId: q.id, supplierCompanyId: invite.supplierCompanyId } },
      create: {
        quotationId: q.id,
        supplierCompanyId: invite.supplierCompanyId,
        inviteId: invite.id,
        source: 'WEB',
        status: data.submit ? 'SUBMITTED' : 'DRAFT',
        deliveryDays: data.deliveryDays ?? null,
        paymentTerms: data.paymentTerms ?? null,
        freight: data.freight,
        discount: data.discount,
        notes: data.notes ?? null,
        submittedAt: data.submit ? new Date() : null,
      },
      update: {
        status: data.submit ? 'SUBMITTED' : 'DRAFT',
        deliveryDays: data.deliveryDays ?? null,
        paymentTerms: data.paymentTerms ?? null,
        freight: data.freight,
        discount: data.discount,
        notes: data.notes ?? null,
        ...(data.submit ? { submittedAt: new Date() } : {}),
      },
    });

    for (const item of data.items) {
      const qi = q.items.find((i) => i.id === item.quotationItemId)!;
      await prisma.bidItem.upsert({
        where: { bidId_quotationItemId: { bidId: bid.id, quotationItemId: item.quotationItemId } },
        create: {
          bidId: bid.id,
          quotationItemId: item.quotationItemId,
          quantity: qi.quantity,
          unitPrice: item.unitPrice,
          available: item.available,
          brand: item.brand ?? null,
          leadTimeDays: item.leadTimeDays ?? null,
        },
        update: {
          unitPrice: item.unitPrice,
          available: item.available,
          brand: item.brand ?? null,
          leadTimeDays: item.leadTimeDays ?? null,
        },
      });
    }

    const updated = await recalcBidTotals(bid.id);

    if (data.submit) {
      await prisma.quotationInvite.update({
        where: { id: invite.id },
        data: { status: 'RESPONDED', respondedAt: new Date() },
      });
      if (q.status === 'SENT') {
        await prisma.quotation.update({ where: { id: q.id }, data: { status: 'RECEIVING' } });
      }
      await notifyBidReceived(bid.id);
      await audit(null, 'bid.submit.public', 'Bid', bid.id, { quotationId: q.id });
    }

    res.json({
      total: toNumber(updated?.totalAmount ?? 0),
      status: updated?.status,
      message: data.submit ? 'Proposta enviada! O comprador já foi avisado.' : 'Rascunho salvo.',
    });
  }),
);

/** POST /public/quotation/:token/decline */
publicRouter.post(
  '/quotation/:token/decline',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.params);
    const { reason } = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {});
    const invite = await loadInvite(token);

    await prisma.quotationInvite.update({
      where: { id: invite.id },
      data: { status: 'DECLINED', declineReason: reason ?? null, respondedAt: new Date() },
    });
    res.json({ message: 'Tudo bem. Registramos que você não vai participar desta cotação.' });
  }),
);
