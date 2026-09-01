import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { BadRequest, NotFound } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { normalizePhone } from '../../utils/phone';
import { audit } from '../../utils/audit';
import { notify } from '../../services/notification.service';
import { toNumber, round } from '../../utils/money';

export const adminRouter = Router();

// Todo este módulo é exclusivo do administrador.
adminRouter.use(authenticate, requireRole('ADMIN'));

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  jobTitle: true,
  companyId: true,
  lastLoginAt: true,
  createdAt: true,
  company: { select: { id: true, name: true, type: true, city: true, state: true, active: true } },
} as const;

// ── Usuários ──────────────────────────────────────────────────

/** GET /admin/users?status=&role=&q=&page= */
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
        role: z.enum(['ADMIN', 'BUYER', 'SUPPLIER']).optional(),
        q: z.string().optional(),
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' as const } },
              { email: { contains: q.q, mode: 'insensitive' as const } },
              { company: { name: { contains: q.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ data, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
  }),
);

/** POST /admin/users — o admin cria um acesso já liberado. */
adminRouter.post(
  '/users',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(['ADMIN', 'BUYER', 'SUPPLIER']),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        companyId: z.string().uuid().optional().nullable(),
        status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).default('ACTIVE'),
      })
      .parse(req.body);

    if (data.role !== 'ADMIN' && !data.companyId) {
      throw BadRequest('Compradores e fornecedores precisam estar vinculados a uma empresa');
    }

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(data.password, 12),
        role: data.role,
        status: data.status,
        phone: normalizePhone(data.phone),
        jobTitle: data.jobTitle ?? null,
        companyId: data.companyId ?? null,
      },
      select: userSelect,
    });

    await audit(req, 'admin.user.create', 'User', user.id, { role: user.role });
    res.status(201).json({ user });
  }),
);

/** PATCH /admin/users/:id — libera, suspende, troca papel, vincula empresa. */
adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const data = z
      .object({
        name: z.string().min(3).optional(),
        role: z.enum(['ADMIN', 'BUYER', 'SUPPLIER']).optional(),
        status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        companyId: z.string().uuid().nullable().optional(),
        password: z.string().min(8).optional(),
      })
      .parse(req.body);

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) throw NotFound('Usuário não encontrado');

    if (current.id === req.user!.id && data.status && data.status !== 'ACTIVE') {
      throw BadRequest('Você não pode suspender o seu próprio acesso');
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.phone !== undefined ? { phone: normalizePhone(data.phone) } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
        ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}),
      },
      select: userSelect,
    });

    // Liberar o acesso também ativa a empresa do usuário.
    if (data.status === 'ACTIVE' && current.status !== 'ACTIVE') {
      if (user.companyId) {
        await prisma.company.update({ where: { id: user.companyId }, data: { active: true } });
      }
      await notify({
        userId: user.id,
        type: 'ACCESS_GRANTED',
        title: 'Acesso liberado!',
        body: 'Seu acesso ao Emptra foi aprovado. Já pode entrar na plataforma.',
        link: user.role === 'SUPPLIER' ? '/fornecedor' : '/comprador',
      });
    }

    if (data.status && data.status !== 'ACTIVE') {
      await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    await audit(req, 'admin.user.update', 'User', id, { changes: Object.keys(data) });
    res.json({ user });
  }),
);

/** DELETE /admin/users/:id */
adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    if (id === req.user!.id) throw BadRequest('Você não pode excluir o seu próprio usuário');
    await prisma.user.delete({ where: { id } });
    await audit(req, 'admin.user.delete', 'User', id);
    res.status(204).end();
  }),
);

// ── Painel do admin ───────────────────────────────────────────

/** GET /admin/overview — números da plataforma inteira. */
adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [
      pendingUsers,
      activeUsers,
      buyers,
      suppliers,
      quotationsByStatus,
      awards,
      messages,
      failedMessages,
      recentQuotations,
    ] = await Promise.all([
      prisma.user.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.company.count({ where: { type: 'BUYER', active: true } }),
      prisma.company.count({ where: { type: 'SUPPLIER', active: true } }),
      prisma.quotation.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.award.aggregate({ _sum: { totalAmount: true, savings: true }, _count: { _all: true } }),
      prisma.whatsAppMessage.count(),
      prisma.whatsAppMessage.count({ where: { status: 'FAILED' } }),
      prisma.quotation.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          deadline: true,
          createdAt: true,
          buyerCompany: { select: { name: true } },
          _count: { select: { bids: true, invites: true } },
        },
      }),
    ]);

    const statusMap = Object.fromEntries(quotationsByStatus.map((s) => [s.status, s._count._all]));

    res.json({
      users: { pending: pendingUsers, active: activeUsers },
      companies: { buyers, suppliers },
      quotations: {
        draft: statusMap.DRAFT ?? 0,
        sent: statusMap.SENT ?? 0,
        receiving: statusMap.RECEIVING ?? 0,
        closed: statusMap.CLOSED ?? 0,
        awarded: statusMap.AWARDED ?? 0,
        cancelled: statusMap.CANCELLED ?? 0,
        total: quotationsByStatus.reduce((acc, s) => acc + s._count._all, 0),
      },
      gmv: {
        awardedTotal: round(toNumber(awards._sum.totalAmount)),
        savingsTotal: round(toNumber(awards._sum.savings)),
        awardCount: awards._count._all,
      },
      whatsapp: { total: messages, failed: failedMessages },
      recentQuotations,
    });
  }),
);

/** GET /admin/quotations — todas as cotações da plataforma. */
adminRouter.get(
  '/quotations',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where = q.status ? { status: q.status as never } : {};
    const [data, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          deadline: true,
          createdAt: true,
          buyerCompany: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          _count: { select: { items: true, invites: true, bids: true } },
        },
      }),
      prisma.quotation.count({ where }),
    ]);

    res.json({ data, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
  }),
);

/** GET /admin/whatsapp — trilha completa das mensagens. */
adminRouter.get(
  '/whatsapp',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
        status: z.string().optional(),
        phone: z.string().optional(),
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).max(100).default(30),
      })
      .parse(req.query);

    const where = {
      ...(q.direction ? { direction: q.direction } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.phone ? { phone: { contains: q.phone.replace(/\D/g, '') } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { quotation: { select: { code: true, title: true } } },
      }),
      prisma.whatsAppMessage.count({ where }),
    ]);

    res.json({ data, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
  }),
);

/** GET /admin/audit */
adminRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        entity: z.string().optional(),
        action: z.string().optional(),
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).max(100).default(30),
      })
      .parse(req.query);

    const where = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.action ? { action: { contains: q.action } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data, meta: { total, page: q.page, perPage: q.perPage, pages: Math.ceil(total / q.perPage) } });
  }),
);

// ── Configurações ─────────────────────────────────────────────

adminRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }),
);

adminRouter.put(
  '/settings/:key',
  asyncHandler(async (req, res) => {
    const { key } = z.object({ key: z.string().min(1).max(60) }).parse(req.params);
    const { value } = z.object({ value: z.unknown() }).parse(req.body);

    const setting = await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    });
    await audit(req, 'admin.setting.update', 'Setting', key);
    res.json({ setting });
  }),
);
