import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireCompany, requireRole } from '../../middlewares/rbac';
import { audit } from '../../utils/audit';
import { recalcBidTotals } from '../../services/quotation.service';
import { notifyBidReceived } from '../../services/notification.service';

export const bidsRouter = Router();
bidsRouter.use(authenticate, requireCompany);

const bidItemSchema = z.object({
  quotationItemId: z.string().uuid(),
  unitPrice: z.number().nonnegative(),
  /** Desconto que o fornecedor concede neste item, em porcentagem. */
  discountPct: z.number().min(0).max(100).default(0),
  brand: z.string().optional().nullable(),
  available: z.boolean().default(true),
  leadTimeDays: z.number().int().min(0).max(365).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const saveSchema = z.object({
  deliveryDays: z.number().int().min(0).max(365).optional().nullable(),
  paymentTerms: z.string().max(120).optional().nullable(),
  freight: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(bidItemSchema).min(1),
  submit: z.boolean().default(false),
});

/** GET /bids — propostas do fornecedor logado (ou todas, para o admin). */
bidsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where = {
      ...(req.user!.role === 'SUPPLIER' ? { supplierCompanyId: req.user!.companyId! } : {}),
      ...(q.status ? { status: { in: q.status.split(',') as never } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.bid.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          quotation: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              priority: true,
              deadline: true,
              buyerCompany: { select: { name: true } },
            },
          },
          supplierCompany: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.bid.count({ where }),
    ]);

    res.json({ data, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
  }),
);

/** GET /bids/:id */
bidsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const bid = await prisma.bid.findUnique({
      where: { id },
      include: {
        quotation: { include: { buyerCompany: true, items: { orderBy: { position: 'asc' } } } },
        supplierCompany: true,
        items: { include: { quotationItem: true }, orderBy: { quotationItem: { position: 'asc' } } },
        awards: { include: { items: true } },
      },
    });
    if (!bid) throw NotFound('Proposta não encontrada');

    const user = req.user!;
    const allowed =
      user.role === 'ADMIN' ||
      (user.role === 'SUPPLIER' && bid.supplierCompanyId === user.companyId) ||
      (user.role === 'BUYER' && bid.quotation.buyerCompanyId === user.companyId);
    if (!allowed) throw Forbidden();

    res.json({ bid });
  }),
);

/**
 * PUT /bids/quotation/:quotationId — o fornecedor salva ou envia a proposta
 * pela web. É o mesmo destino do fluxo de WhatsApp.
 */
bidsRouter.put(
  '/quotation/:quotationId',
  requireRole('SUPPLIER'),
  asyncHandler(async (req, res) => {
    const { quotationId } = z.object({ quotationId: z.string().uuid() }).parse(req.params);
    const data = saveSchema.parse(req.body);
    const supplierCompanyId = req.user!.companyId!;

    const [quotation, invite] = await Promise.all([
      prisma.quotation.findUnique({ where: { id: quotationId }, include: { items: true } }),
      prisma.quotationInvite.findUnique({
        where: { quotationId_supplierCompanyId: { quotationId, supplierCompanyId } },
      }),
    ]);

    if (!quotation) throw NotFound('Cotação não encontrada');
    if (!invite) throw Forbidden('Sua empresa não foi convidada para esta cotação');
    if (quotation.status === 'AWARDED' || quotation.status === 'CANCELLED') {
      throw BadRequest('Esta cotação já foi encerrada');
    }
    if (data.submit && quotation.deadline < new Date() && quotation.status !== 'CLOSED') {
      throw BadRequest('O prazo desta cotação já expirou');
    }

    const validIds = new Set(quotation.items.map((i) => i.id));
    if (data.items.some((i) => !validIds.has(i.quotationItemId))) {
      throw BadRequest('Um dos itens enviados não pertence a esta cotação');
    }

    const existing = await prisma.bid.findUnique({
      where: { quotationId_supplierCompanyId: { quotationId, supplierCompanyId } },
    });
    if (existing?.status === 'APPROVED') throw BadRequest('Esta proposta já foi aprovada e não pode ser alterada');

    const bid = await prisma.bid.upsert({
      where: { quotationId_supplierCompanyId: { quotationId, supplierCompanyId } },
      create: {
        quotationId,
        supplierCompanyId,
        inviteId: invite.id,
        source: 'WEB',
        status: data.submit ? 'SUBMITTED' : 'DRAFT',
        deliveryDays: data.deliveryDays ?? null,
        paymentTerms: data.paymentTerms ?? null,
        freight: data.freight,
        discount: data.discount,
        validUntil: data.validUntil ?? null,
        notes: data.notes ?? null,
        submittedAt: data.submit ? new Date() : null,
      },
      update: {
        status: data.submit ? 'SUBMITTED' : existing?.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
        deliveryDays: data.deliveryDays ?? null,
        paymentTerms: data.paymentTerms ?? null,
        freight: data.freight,
        discount: data.discount,
        validUntil: data.validUntil ?? null,
        notes: data.notes ?? null,
        ...(data.submit ? { submittedAt: new Date() } : {}),
      },
    });

    for (const item of data.items) {
      const qi = quotation.items.find((i) => i.id === item.quotationItemId)!;
      await prisma.bidItem.upsert({
        where: { bidId_quotationItemId: { bidId: bid.id, quotationItemId: item.quotationItemId } },
        create: {
          bidId: bid.id,
          quotationItemId: item.quotationItemId,
          quantity: qi.quantity,
          unitPrice: item.unitPrice,
          discountPct: item.discountPct,
          available: item.available,
          brand: item.brand ?? null,
          leadTimeDays: item.leadTimeDays ?? null,
          notes: item.notes ?? null,
        },
        update: {
          unitPrice: item.unitPrice,
          discountPct: item.discountPct,
          available: item.available,
          brand: item.brand ?? null,
          leadTimeDays: item.leadTimeDays ?? null,
          notes: item.notes ?? null,
        },
      });
    }

    const updated = await recalcBidTotals(bid.id);

    if (data.submit) {
      await prisma.quotationInvite.update({
        where: { id: invite.id },
        data: { status: 'RESPONDED', respondedAt: new Date() },
      });
      if (quotation.status === 'SENT') {
        await prisma.quotation.update({ where: { id: quotationId }, data: { status: 'RECEIVING' } });
      }
      await notifyBidReceived(bid.id);
      await audit(req, 'bid.submit', 'Bid', bid.id, { quotationId });
    }

    res.json({ bid: updated, message: data.submit ? 'Proposta enviada ao comprador.' : 'Rascunho salvo.' });
  }),
);

/** POST /bids/quotation/:quotationId/decline */
bidsRouter.post(
  '/quotation/:quotationId/decline',
  requireRole('SUPPLIER'),
  asyncHandler(async (req, res) => {
    const { quotationId } = z.object({ quotationId: z.string().uuid() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {});
    const supplierCompanyId = req.user!.companyId!;

    const invite = await prisma.quotationInvite.findUnique({
      where: { quotationId_supplierCompanyId: { quotationId, supplierCompanyId } },
    });
    if (!invite) throw Forbidden('Sua empresa não foi convidada para esta cotação');

    await prisma.quotationInvite.update({
      where: { id: invite.id },
      data: { status: 'DECLINED', declineReason: reason ?? null, respondedAt: new Date() },
    });
    await prisma.bid.updateMany({
      where: { quotationId, supplierCompanyId, status: { in: ['DRAFT', 'SUBMITTED'] } },
      data: { status: 'WITHDRAWN' },
    });

    await audit(req, 'bid.decline', 'Quotation', quotationId, { reason });
    res.json({ message: 'Participação recusada. Obrigado por avisar.' });
  }),
);
