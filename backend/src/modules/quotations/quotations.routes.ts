import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireCompany, requireRole } from '../../middlewares/rbac';
import { nextQuotationCode, inviteToken } from '../../utils/code';
import { normalizePhone } from '../../utils/phone';
import { audit } from '../../utils/audit';
import { buildComparison } from '../../services/quotation.service';
import { dispatchQuotation } from '../../services/dispatch.service';
import { awardQuotation } from '../../services/award.service';
import { buildComparisonWorkbook } from '../../services/xlsx.service';

export const quotationsRouter = Router();
quotationsRouter.use(authenticate, requireCompany);

// ── Schemas ───────────────────────────────────────────────────

const itemSchema = z.object({
  description: z.string().min(2, 'Descreva o item'),
  sku: z.string().optional().nullable(),
  unit: z.string().min(1).max(10).default('un'),
  quantity: z.number().positive('Quantidade precisa ser maior que zero'),
  brandRef: z.string().optional().nullable(),
  targetPrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createSchema = z.object({
  title: z.string().min(3, 'Dê um título à cotação'),
  description: z.string().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  deadline: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'O prazo precisa ser no futuro'),
  deliveryAddress: z.string().optional().nullable(),
  deliveryDate: z.coerce.date().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'Inclua ao menos um item'),
  supplierIds: z.array(z.string().uuid()).default([]),
});

const quotationListSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  deadline: true,
  createdAt: true,
  sentAt: true,
  awardedAt: true,
  project: { select: { id: true, name: true } },
  buyerCompany: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true, invites: true, bids: true } },
} as const;

/** Garante que o usuário pode ver esta cotação e devolve o registro. */
async function loadAccessible(req: { user?: Express.AuthUser }, id: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: 'asc' } },
      buyerCompany: true,
      project: true,
      createdBy: { select: { id: true, name: true, email: true, phone: true } },
      invites: {
        include: {
          supplierCompany: { select: { id: true, name: true, tradeName: true, city: true, state: true, whatsapp: true } },
        },
      },
      awards: {
        include: {
          supplierCompany: { select: { id: true, name: true, tradeName: true } },
          items: { include: { quotationItem: true } },
        },
      },
    },
  });
  if (!quotation) throw NotFound('Cotação não encontrada');

  const user = req.user!;
  if (user.role === 'ADMIN') return quotation;
  if (user.role === 'BUYER' && quotation.buyerCompanyId === user.companyId) return quotation;
  if (user.role === 'SUPPLIER' && quotation.invites.some((i) => i.supplierCompanyId === user.companyId)) {
    return quotation;
  }
  throw Forbidden('Você não tem acesso a esta cotação');
}

// ── Listagem ──────────────────────────────────────────────────

/** GET /quotations */
quotationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        status: z.string().optional(),
        q: z.string().optional(),
        projectId: z.string().uuid().optional(),
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).max(100).default(20),
      })
      .parse(req.query);

    const user = req.user!;
    const scope =
      user.role === 'BUYER'
        ? { buyerCompanyId: user.companyId! }
        : user.role === 'SUPPLIER'
          ? { invites: { some: { supplierCompanyId: user.companyId! } }, status: { not: 'DRAFT' as const } }
          : {};

    const where = {
      ...scope,
      ...(q.status ? { status: { in: q.status.split(',') as never } } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' as const } },
              { code: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        select: quotationListSelect,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.quotation.count({ where }),
    ]);

    // Para o fornecedor, anexa o estado da sua própria participação.
    if (user.role === 'SUPPLIER') {
      const ids = data.map((d) => d.id);
      const [invites, bids] = await Promise.all([
        prisma.quotationInvite.findMany({
          where: { quotationId: { in: ids }, supplierCompanyId: user.companyId! },
          select: { quotationId: true, status: true, token: true },
        }),
        prisma.bid.findMany({
          where: { quotationId: { in: ids }, supplierCompanyId: user.companyId! },
          select: { quotationId: true, id: true, status: true, totalAmount: true },
        }),
      ]);
      const enriched = data.map((d) => ({
        ...d,
        myInvite: invites.find((i) => i.quotationId === d.id) ?? null,
        myBid: bids.find((b) => b.quotationId === d.id) ?? null,
      }));
      return res.json({ data: enriched, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
    }

    res.json({ data, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
  }),
);

/** GET /quotations/:id */
quotationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const quotation = await loadAccessible(req, id);

    // O fornecedor nunca vê os concorrentes.
    if (req.user!.role === 'SUPPLIER') {
      const myInvite = quotation.invites.find((i) => i.supplierCompanyId === req.user!.companyId);
      const myBid = await prisma.bid.findUnique({
        where: { quotationId_supplierCompanyId: { quotationId: id, supplierCompanyId: req.user!.companyId! } },
        include: { items: { include: { quotationItem: true } } },
      });
      return res.json({
        quotation: { ...quotation, invites: myInvite ? [myInvite] : [], awards: [] },
        myInvite,
        myBid,
      });
    }

    res.json({ quotation });
  }),
);

// ── Criação e edição (comprador) ──────────────────────────────

/** POST /quotations */
quotationsRouter.post(
  '/',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const buyerCompanyId = req.user!.companyId!;

    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, companyId: buyerCompanyId } });
      if (!project) throw BadRequest('Centro de custo não encontrado nesta empresa');
    }

    const suppliers = data.supplierIds.length
      ? await prisma.company.findMany({
          where: { id: { in: data.supplierIds }, type: 'SUPPLIER', active: true },
          select: { id: true, whatsapp: true, phone: true },
        })
      : [];

    const code = await nextQuotationCode();

    const quotation = await prisma.quotation.create({
      data: {
        code,
        title: data.title.trim(),
        description: data.description ?? null,
        buyerCompanyId,
        createdById: req.user!.id,
        projectId: data.projectId ?? null,
        deadline: data.deadline,
        deliveryAddress: data.deliveryAddress ?? null,
        deliveryDate: data.deliveryDate ?? null,
        paymentTerms: data.paymentTerms ?? null,
        notes: data.notes ?? null,
        items: {
          create: data.items.map((item, index) => ({
            position: index + 1,
            description: item.description.trim(),
            sku: item.sku ?? null,
            unit: item.unit,
            quantity: item.quantity,
            brandRef: item.brandRef ?? null,
            targetPrice: item.targetPrice ?? null,
            notes: item.notes ?? null,
          })),
        },
        invites: {
          create: suppliers.map((s) => ({
            supplierCompanyId: s.id,
            token: inviteToken(),
            phone: normalizePhone(s.whatsapp ?? s.phone),
          })),
        },
      },
      include: { items: { orderBy: { position: 'asc' } }, invites: true },
    });

    await audit(req, 'quotation.create', 'Quotation', quotation.id, { code, items: data.items.length });
    res.status(201).json({ quotation });
  }),
);

/** PATCH /quotations/:id — só em rascunho. */
quotationsRouter.patch(
  '/:id',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await loadAccessible(req, id);
    if (existing.status !== 'DRAFT') throw BadRequest('Só é possível editar uma cotação em rascunho');

    const data = createSchema.partial().parse(req.body);

    const quotation = await prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        await tx.quotationItem.createMany({
          data: data.items.map((item, index) => ({
            quotationId: id,
            position: index + 1,
            description: item.description.trim(),
            sku: item.sku ?? null,
            unit: item.unit,
            quantity: item.quantity,
            brandRef: item.brandRef ?? null,
            targetPrice: item.targetPrice ?? null,
            notes: item.notes ?? null,
          })),
        });
      }

      if (data.supplierIds) {
        await tx.quotationInvite.deleteMany({
          where: { quotationId: id, supplierCompanyId: { notIn: data.supplierIds } },
        });
        const current = await tx.quotationInvite.findMany({ where: { quotationId: id }, select: { supplierCompanyId: true } });
        const currentIds = new Set(current.map((c) => c.supplierCompanyId));
        const toAdd = data.supplierIds.filter((sid) => !currentIds.has(sid));
        if (toAdd.length) {
          const suppliers = await tx.company.findMany({
            where: { id: { in: toAdd }, type: 'SUPPLIER' },
            select: { id: true, whatsapp: true, phone: true },
          });
          await tx.quotationInvite.createMany({
            data: suppliers.map((s) => ({
              quotationId: id,
              supplierCompanyId: s.id,
              token: inviteToken(),
              phone: normalizePhone(s.whatsapp ?? s.phone),
            })),
          });
        }
      }

      return tx.quotation.update({
        where: { id },
        data: {
          ...(data.title ? { title: data.title.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
          ...(data.deadline ? { deadline: data.deadline } : {}),
          ...(data.deliveryAddress !== undefined ? { deliveryAddress: data.deliveryAddress } : {}),
          ...(data.deliveryDate !== undefined ? { deliveryDate: data.deliveryDate } : {}),
          ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
        include: { items: { orderBy: { position: 'asc' } }, invites: true },
      });
    });

    await audit(req, 'quotation.update', 'Quotation', id);
    res.json({ quotation });
  }),
);

/** DELETE /quotations/:id */
quotationsRouter.delete(
  '/:id',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const quotation = await loadAccessible(req, id);
    if (quotation.status === 'AWARDED') throw BadRequest('Uma cotação aprovada não pode ser excluída');
    await prisma.quotation.delete({ where: { id } });
    await audit(req, 'quotation.delete', 'Quotation', id, { code: quotation.code });
    res.status(204).end();
  }),
);

// ── Disparo no WhatsApp ───────────────────────────────────────

/** POST /quotations/:id/dispatch — envia a cotação a todos os convidados. */
quotationsRouter.post(
  '/:id/dispatch',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await loadAccessible(req, id);

    const result = await dispatchQuotation(id);
    await audit(req, 'quotation.dispatch', 'Quotation', id, { sent: result.dispatched.filter((d) => d.ok).length });

    res.json({
      ...result,
      message: result.n8nAccepted
        ? 'Cotação enviada aos fornecedores pelo WhatsApp.'
        : 'Cotação registrada, mas a automação do WhatsApp não respondeu. Confira em Admin → WhatsApp.',
    });
  }),
);

/** POST /quotations/:id/suppliers — adiciona fornecedores a uma cotação já enviada. */
quotationsRouter.post(
  '/:id/suppliers',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { supplierIds } = z.object({ supplierIds: z.array(z.string().uuid()).min(1) }).parse(req.body);
    const quotation = await loadAccessible(req, id);
    if (quotation.status === 'AWARDED' || quotation.status === 'CANCELLED') {
      throw BadRequest('Esta cotação já foi encerrada');
    }

    const existing = new Set(quotation.invites.map((i) => i.supplierCompanyId));
    const suppliers = await prisma.company.findMany({
      where: { id: { in: supplierIds.filter((s) => !existing.has(s)) }, type: 'SUPPLIER', active: true },
      select: { id: true, whatsapp: true, phone: true },
    });

    if (suppliers.length) {
      await prisma.quotationInvite.createMany({
        data: suppliers.map((s) => ({
          quotationId: id,
          supplierCompanyId: s.id,
          token: inviteToken(),
          phone: normalizePhone(s.whatsapp ?? s.phone),
        })),
      });
    }

    const result = quotation.status === 'DRAFT' ? null : await dispatchQuotation(id);
    res.json({ added: suppliers.length, dispatch: result });
  }),
);

// ── Comparativo e aprovação ───────────────────────────────────

/** GET /quotations/:id/comparison — mapa comparativo item x fornecedor. */
quotationsRouter.get(
  '/:id/comparison',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await loadAccessible(req, id);
    res.json(await buildComparison(id));
  }),
);

/** GET /quotations/:id/comparison.xlsx */
quotationsRouter.get(
  '/:id/comparison.xlsx',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await loadAccessible(req, id);
    const { buffer, filename } = await buildComparisonWorkbook(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }),
);

/** POST /quotations/:id/close — encerra o prazo antes da hora. */
quotationsRouter.post(
  '/:id/close',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const quotation = await loadAccessible(req, id);
    if (!['SENT', 'RECEIVING'].includes(quotation.status)) throw BadRequest('Esta cotação não está aberta');

    await prisma.quotation.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
    await audit(req, 'quotation.close', 'Quotation', id);
    res.json({ message: 'Cotação encerrada. Já pode comparar e aprovar.' });
  }),
);

/** POST /quotations/:id/award — aprova (total ou dividida por item). */
quotationsRouter.post(
  '/:id/award',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { selections } = z
      .object({
        selections: z
          .array(
            z.object({
              bidId: z.string().uuid(),
              quotationItemIds: z.array(z.string().uuid()).optional(),
              notes: z.string().optional(),
            }),
          )
          .min(1, 'Selecione ao menos uma proposta'),
      })
      .parse(req.body);

    await loadAccessible(req, id);
    const outcome = await awardQuotation(id, selections, req.user!.id);
    await audit(req, 'quotation.award', 'Quotation', id, {
      suppliers: outcome.awards.length,
      total: outcome.totalAwarded,
      savings: outcome.totalSavings,
    });

    // A mensagem tem que refletir o que de fato saiu: se a automação estiver
    // fora do ar, o comprador precisa saber que o aviso não chegou.
    const notified = outcome.awards.filter((a) => a.notified).length;
    const message =
      notified === outcome.awards.length
        ? 'Cotação aprovada. Os fornecedores já foram avisados pelo WhatsApp.'
        : `Cotação aprovada. ${notified} de ${outcome.awards.length} avisos de WhatsApp saíram — confira em Admin → WhatsApp.`;

    res.json({ ...outcome, message });
  }),
);

/** POST /quotations/:id/cancel */
quotationsRouter.post(
  '/:id/cancel',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
    const quotation = await loadAccessible(req, id);
    if (quotation.status === 'AWARDED') throw BadRequest('Uma cotação aprovada não pode ser cancelada');

    await prisma.quotation.update({
      where: { id },
      data: { status: 'CANCELLED', notes: reason ? `${quotation.notes ?? ''}\n[cancelada] ${reason}`.trim() : quotation.notes },
    });
    await audit(req, 'quotation.cancel', 'Quotation', id, { reason });
    res.json({ message: 'Cotação cancelada.' });
  }),
);
