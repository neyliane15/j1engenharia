import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { Forbidden, NotFound } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { normalizePhone } from '../../utils/phone';
import { audit } from '../../utils/audit';
import { toNumber, round } from '../../utils/money';

export const companiesRouter = Router();
companiesRouter.use(authenticate);

const companySelect = {
  id: true,
  type: true,
  name: true,
  tradeName: true,
  cnpj: true,
  email: true,
  phone: true,
  whatsapp: true,
  city: true,
  state: true,
  address: true,
  logoUrl: true,
  active: true,
  createdAt: true,
  supplierProfile: true,
  _count: { select: { users: true } },
} as const;

const upsertSchema = z.object({
  type: z.enum(['BUYER', 'SUPPLIER']),
  name: z.string().min(2),
  tradeName: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  address: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  profile: z
    .object({
      categories: z.array(z.string()).optional(),
      description: z.string().optional().nullable(),
      deliveryDays: z.number().int().min(0).max(365).optional(),
      paymentTerms: z.string().optional().nullable(),
      autoReply: z.boolean().optional(),
    })
    .optional(),
});

/** GET /companies?type=SUPPLIER&q=&category= */
companiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        type: z.enum(['BUYER', 'SUPPLIER']).optional(),
        q: z.string().optional(),
        category: z.string().optional(),
        active: z.coerce.boolean().optional(),
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).max(200).default(50),
      })
      .parse(req.query);

    // Comprador e fornecedor só enxergam fornecedores ativos.
    const restricted = req.user!.role !== 'ADMIN';
    const where = {
      ...(restricted ? { type: 'SUPPLIER' as const, active: true } : {}),
      ...(q.type && !restricted ? { type: q.type } : {}),
      ...(q.active !== undefined && !restricted ? { active: q.active } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' as const } },
              { tradeName: { contains: q.q, mode: 'insensitive' as const } },
              { city: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(q.category ? { supplierProfile: { categories: { has: q.category } } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.company.findMany({
        where,
        select: companySelect,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.company.count({ where }),
    ]);

    res.json({ data, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
  }),
);

/** GET /companies/:id */
companiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const company = await prisma.company.findUnique({
      where: { id },
      select: { ...companySelect, users: { select: { id: true, name: true, email: true, role: true, status: true } } },
    });
    if (!company) throw NotFound('Empresa não encontrada');

    const restricted = req.user!.role !== 'ADMIN' && req.user!.companyId !== id;
    if (restricted && company.type !== 'SUPPLIER') throw Forbidden();

    res.json({ company: restricted ? { ...company, users: undefined } : company });
  }),
);

/** POST /companies — só admin cadastra empresa direto. */
companiesRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = upsertSchema.parse(req.body);
    const { profile, ...rest } = data;

    const company = await prisma.company.create({
      data: {
        ...rest,
        cnpj: rest.cnpj?.replace(/\D/g, '') || null,
        phone: normalizePhone(rest.phone),
        whatsapp: normalizePhone(rest.whatsapp ?? rest.phone),
        state: rest.state?.toUpperCase() ?? null,
        active: rest.active ?? true,
        ...(rest.type === 'SUPPLIER' ? { supplierProfile: { create: profile ?? {} } } : {}),
      },
      select: companySelect,
    });

    await audit(req, 'company.create', 'Company', company.id, { type: company.type });
    res.status(201).json({ company });
  }),
);

/** PATCH /companies/:id — admin edita qualquer uma; usuário edita a sua. */
companiesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    if (req.user!.role !== 'ADMIN' && req.user!.companyId !== id) {
      throw Forbidden('Você só pode editar a sua própria empresa');
    }

    const data = upsertSchema.partial().parse(req.body);
    const { profile, type, active, ...rest } = data;

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.cnpj !== undefined ? { cnpj: rest.cnpj?.replace(/\D/g, '') || null } : {}),
        ...(rest.phone !== undefined ? { phone: normalizePhone(rest.phone) } : {}),
        ...(rest.whatsapp !== undefined ? { whatsapp: normalizePhone(rest.whatsapp) } : {}),
        ...(rest.state !== undefined ? { state: rest.state?.toUpperCase() ?? null } : {}),
        // Só o admin muda tipo e status de ativação.
        ...(req.user!.role === 'ADMIN' ? { ...(type ? { type } : {}), ...(active !== undefined ? { active } : {}) } : {}),
        ...(profile
          ? { supplierProfile: { upsert: { create: profile, update: profile } } }
          : {}),
      },
      select: companySelect,
    });

    await audit(req, 'company.update', 'Company', id);
    res.json({ company });
  }),
);

/** DELETE /companies/:id */
companiesRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await prisma.company.delete({ where: { id } });
    await audit(req, 'company.delete', 'Company', id);
    res.status(204).end();
  }),
);

/**
 * GET /companies/:id/performance — histórico do fornecedor visto pelo comprador:
 * quantas cotações participou, quantas ganhou, ticket médio e prazo.
 */
companiesRouter.get(
  '/:id/performance',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const buyerCompanyId = req.user!.role === 'BUYER' ? req.user!.companyId : undefined;

    const scope = buyerCompanyId ? { quotation: { buyerCompanyId } } : {};

    const [invited, submitted, awards, avgDelivery] = await Promise.all([
      prisma.quotationInvite.count({ where: { supplierCompanyId: id, ...(scope as object) } }),
      prisma.bid.count({ where: { supplierCompanyId: id, status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] }, ...(scope as object) } }),
      prisma.award.findMany({
        where: { supplierCompanyId: id, ...(scope as object) },
        select: { totalAmount: true, savings: true, createdAt: true },
      }),
      prisma.bid.aggregate({
        where: { supplierCompanyId: id, deliveryDays: { not: null } },
        _avg: { deliveryDays: true },
      }),
    ]);

    const wonTotal = round(awards.reduce((acc, a) => acc + toNumber(a.totalAmount), 0));
    const savingsTotal = round(awards.reduce((acc, a) => acc + toNumber(a.savings), 0));

    res.json({
      invited,
      submitted,
      won: awards.length,
      responseRate: invited ? Math.round((submitted / invited) * 100) : 0,
      winRate: submitted ? Math.round((awards.length / submitted) * 100) : 0,
      wonTotal,
      savingsTotal,
      averageTicket: awards.length ? round(wonTotal / awards.length) : 0,
      averageDeliveryDays: avgDelivery._avg.deliveryDays ? Math.round(avgDelivery._avg.deliveryDays) : null,
      lastAwardAt: awards.length ? awards.map((a) => a.createdAt).sort((a, b) => b.getTime() - a.getTime())[0] : null,
    });
  }),
);
