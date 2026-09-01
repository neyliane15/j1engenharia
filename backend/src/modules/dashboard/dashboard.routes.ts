import { Router } from 'express';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

// Os rótulos da série mensal vão prontos para a tela — em português.
dayjs.locale('pt-br');
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { Forbidden } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireCompany, requireRole } from '../../middlewares/rbac';
import { percent, round, toNumber } from '../../utils/money';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, requireCompany);

const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  months: z.coerce.number().min(1).max(36).default(12),
});

function resolveRange(q: z.infer<typeof rangeSchema>) {
  const to = q.to ?? dayjs().endOf('day').toDate();
  const from = q.from ?? dayjs(to).subtract(q.months, 'month').startOf('month').toDate();
  return { from, to };
}

/** Série mensal pronta para o gráfico, sem meses vazios faltando. */
function monthlySeries(from: Date, to: Date) {
  const out: { month: string; label: string }[] = [];
  let cursor = dayjs(from).startOf('month');
  const end = dayjs(to).startOf('month');
  while (cursor.isBefore(end) || cursor.isSame(end)) {
    out.push({ month: cursor.format('YYYY-MM'), label: cursor.format('MMM/YY') });
    cursor = cursor.add(1, 'month');
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// COMPRADOR
// ─────────────────────────────────────────────────────────────

/**
 * GET /dashboard/buyer
 * Economia gerada, melhores fornecedores, evolução mensal e itens críticos.
 */
dashboardRouter.get(
  '/buyer',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const range = resolveRange(rangeSchema.parse(req.query));
    const companyId = req.user!.companyId!;
    const scope = { quotation: { buyerCompanyId: companyId } };

    const [quotationCounts, awards, openQuotations, invitesAgg, upcoming] = await Promise.all([
      prisma.quotation.groupBy({
        by: ['status'],
        where: { buyerCompanyId: companyId },
        _count: { _all: true },
      }),
      prisma.award.findMany({
        where: { ...scope, createdAt: { gte: range.from, lte: range.to } },
        include: {
          supplierCompany: { select: { id: true, name: true, tradeName: true } },
          quotation: { select: { id: true, code: true, title: true } },
          items: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotation.count({ where: { buyerCompanyId: companyId, status: { in: ['SENT', 'RECEIVING'] } } }),
      prisma.quotationInvite.groupBy({
        by: ['status'],
        where: { quotation: { buyerCompanyId: companyId } },
        _count: { _all: true },
      }),
      prisma.quotation.findMany({
        where: {
          buyerCompanyId: companyId,
          status: { in: ['SENT', 'RECEIVING', 'CLOSED'] },
        },
        orderBy: { deadline: 'asc' },
        take: 6,
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          deadline: true,
          _count: { select: { bids: true, invites: true } },
        },
      }),
    ]);

    const statusMap = Object.fromEntries(quotationCounts.map((s) => [s.status, s._count._all]));
    const inviteMap = Object.fromEntries(invitesAgg.map((s) => [s.status, s._count._all]));

    const totalAwarded = round(awards.reduce((acc, a) => acc + toNumber(a.totalAmount), 0));
    const totalBaseline = round(awards.reduce((acc, a) => acc + toNumber(a.baselineAmount), 0));
    const totalSavings = round(awards.reduce((acc, a) => acc + toNumber(a.savings), 0));

    // Evolução mensal: comprado x economizado
    const series = monthlySeries(range.from, range.to).map((m) => {
      const monthAwards = awards.filter((a) => dayjs(a.createdAt).format('YYYY-MM') === m.month);
      return {
        ...m,
        purchased: round(monthAwards.reduce((acc, a) => acc + toNumber(a.totalAmount), 0)),
        savings: round(monthAwards.reduce((acc, a) => acc + toNumber(a.savings), 0)),
        orders: monthAwards.length,
      };
    });

    // Ranking de fornecedores
    const bySupplier = new Map<
      string,
      { supplierId: string; name: string; total: number; savings: number; orders: number; items: number }
    >();
    for (const a of awards) {
      const key = a.supplierCompanyId;
      const name = a.supplierCompany.tradeName || a.supplierCompany.name;
      const current = bySupplier.get(key) ?? { supplierId: key, name, total: 0, savings: 0, orders: 0, items: 0 };
      current.total = round(current.total + toNumber(a.totalAmount));
      current.savings = round(current.savings + toNumber(a.savings));
      current.orders += 1;
      current.items += a.items.length;
      bySupplier.set(key, current);
    }

    const supplierIds = [...bySupplier.keys()];
    const [invitesPerSupplier, bidsPerSupplier] = await Promise.all([
      supplierIds.length
        ? prisma.quotationInvite.groupBy({
            by: ['supplierCompanyId'],
            where: { supplierCompanyId: { in: supplierIds }, quotation: { buyerCompanyId: companyId } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      supplierIds.length
        ? prisma.bid.groupBy({
            by: ['supplierCompanyId'],
            where: {
              supplierCompanyId: { in: supplierIds },
              quotation: { buyerCompanyId: companyId },
              status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const topSuppliers = [...bySupplier.values()]
      .map((s) => {
        const invited = invitesPerSupplier.find((i) => i.supplierCompanyId === s.supplierId)?._count._all ?? 0;
        const submitted = bidsPerSupplier.find((b) => b.supplierCompanyId === s.supplierId)?._count._all ?? 0;
        return {
          ...s,
          invited,
          submitted,
          responseRate: invited ? percent(submitted, invited) : 0,
          winRate: submitted ? percent(s.orders, submitted) : 0,
          averageTicket: s.orders ? round(s.total / s.orders) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Categorias de gasto: agrupadas pela primeira palavra significativa do item
    const awardItems = await prisma.awardItem.findMany({
      where: { award: { ...scope, createdAt: { gte: range.from, lte: range.to } } },
      include: { quotationItem: { select: { description: true, unit: true } } },
    });

    const byCategory = new Map<string, number>();
    for (const ai of awardItems) {
      const key = ai.quotationItem.description.split(/[\s,\-–]/)[0].toUpperCase().slice(0, 24) || 'OUTROS';
      byCategory.set(key, round((byCategory.get(key) ?? 0) + toNumber(ai.total)));
    }
    const categories = [...byCategory.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    res.json({
      range,
      kpis: {
        totalAwarded,
        totalBaseline,
        totalSavings,
        savingsPct: totalBaseline > 0 ? percent(totalSavings, totalBaseline) : 0,
        orders: awards.length,
        openQuotations,
        quotationsTotal: quotationCounts.reduce((acc, s) => acc + s._count._all, 0),
        averageTicket: awards.length ? round(totalAwarded / awards.length) : 0,
        supplierResponseRate: (() => {
          const invited = Object.values(inviteMap).reduce((a, b) => a + b, 0);
          const responded = (inviteMap.RESPONDED ?? 0) as number;
          return invited ? percent(responded, invited) : 0;
        })(),
      },
      quotationsByStatus: {
        draft: statusMap.DRAFT ?? 0,
        sent: statusMap.SENT ?? 0,
        receiving: statusMap.RECEIVING ?? 0,
        closed: statusMap.CLOSED ?? 0,
        awarded: statusMap.AWARDED ?? 0,
        cancelled: statusMap.CANCELLED ?? 0,
      },
      series,
      topSuppliers,
      categories,
      upcoming,
      recentAwards: awards.slice(0, 8).map((a) => ({
        id: a.id,
        quotation: a.quotation,
        supplier: a.supplierCompany.tradeName || a.supplierCompany.name,
        total: toNumber(a.totalAmount),
        savings: toNumber(a.savings),
        createdAt: a.createdAt,
      })),
    });
  }),
);

/**
 * GET /dashboard/buyer/price-history?q=termo
 * Como o preço de um material variou entre cotações — o comparativo
 * histórico que sustenta a negociação.
 */
dashboardRouter.get(
  '/buyer/price-history',
  requireRole('BUYER'),
  asyncHandler(async (req, res) => {
    const { q } = z.object({ q: z.string().min(2, 'Informe ao menos 2 letras') }).parse(req.query);
    const companyId = req.user!.companyId!;

    const items = await prisma.bidItem.findMany({
      where: {
        available: true,
        unitPrice: { gt: 0 },
        quotationItem: { description: { contains: q, mode: 'insensitive' } },
        bid: { status: { in: ['SUBMITTED', 'APPROVED'] }, quotation: { buyerCompanyId: companyId } },
      },
      include: {
        quotationItem: { select: { description: true, unit: true } },
        bid: {
          select: {
            status: true,
            supplierCompany: { select: { name: true, tradeName: true } },
            quotation: { select: { code: true, createdAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const points = items.map((i) => ({
      date: i.bid.quotation.createdAt,
      quotation: i.bid.quotation.code,
      description: i.quotationItem.description,
      unit: i.quotationItem.unit,
      supplier: i.bid.supplierCompany.tradeName || i.bid.supplierCompany.name,
      unitPrice: toNumber(i.unitPrice),
      approved: i.bid.status === 'APPROVED',
    }));

    const prices = points.map((p) => p.unitPrice);
    res.json({
      query: q,
      count: points.length,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      avg: prices.length ? round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      points,
    });
  }),
);

// ─────────────────────────────────────────────────────────────
// FORNECEDOR
// ─────────────────────────────────────────────────────────────

/**
 * GET /dashboard/supplier
 * Faturamento aprovado, clientes, taxa de conversão e funil de cotações.
 */
dashboardRouter.get(
  '/supplier',
  requireRole('SUPPLIER'),
  asyncHandler(async (req, res) => {
    const range = resolveRange(rangeSchema.parse(req.query));
    const companyId = req.user!.companyId!;

    const [awards, invitesAgg, bidsAgg, openInvites, allTimeAwards] = await Promise.all([
      prisma.award.findMany({
        where: { supplierCompanyId: companyId, createdAt: { gte: range.from, lte: range.to } },
        include: {
          quotation: { select: { id: true, code: true, title: true, buyerCompany: { select: { id: true, name: true } } } },
          items: { select: { id: true, total: true, quotationItem: { select: { description: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotationInvite.groupBy({
        by: ['status'],
        where: { supplierCompanyId: companyId },
        _count: { _all: true },
      }),
      prisma.bid.groupBy({
        by: ['status'],
        where: { supplierCompanyId: companyId },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.quotationInvite.findMany({
        where: {
          supplierCompanyId: companyId,
          status: { in: ['SENT', 'VIEWED'] },
          quotation: { status: { in: ['SENT', 'RECEIVING'] } },
        },
        orderBy: { quotation: { deadline: 'asc' } },
        take: 8,
        include: {
          quotation: {
            select: {
              id: true,
              code: true,
              title: true,
              deadline: true,
              buyerCompany: { select: { name: true } },
              _count: { select: { items: true } },
            },
          },
        },
      }),
      prisma.award.aggregate({ where: { supplierCompanyId: companyId }, _sum: { totalAmount: true }, _count: { _all: true } }),
    ]);

    const inviteMap = Object.fromEntries(invitesAgg.map((s) => [s.status, s._count._all]));
    const bidMap = Object.fromEntries(bidsAgg.map((s) => [s.status, s._count._all]));

    const revenue = round(awards.reduce((acc, a) => acc + toNumber(a.totalAmount), 0));
    const invited = Object.values(inviteMap).reduce((a, b) => a + b, 0);
    const submitted = (bidMap.SUBMITTED ?? 0) + (bidMap.APPROVED ?? 0) + (bidMap.REJECTED ?? 0);
    const won = bidMap.APPROVED ?? 0;

    const series = monthlySeries(range.from, range.to).map((m) => {
      const monthAwards = awards.filter((a) => dayjs(a.createdAt).format('YYYY-MM') === m.month);
      return {
        ...m,
        revenue: round(monthAwards.reduce((acc, a) => acc + toNumber(a.totalAmount), 0)),
        orders: monthAwards.length,
      };
    });

    // Clientes
    const byClient = new Map<string, { clientId: string; name: string; revenue: number; orders: number; lastAt: Date }>();
    for (const a of awards) {
      const key = a.quotation.buyerCompany.id;
      const current = byClient.get(key) ?? {
        clientId: key,
        name: a.quotation.buyerCompany.name,
        revenue: 0,
        orders: 0,
        lastAt: a.createdAt,
      };
      current.revenue = round(current.revenue + toNumber(a.totalAmount));
      current.orders += 1;
      if (a.createdAt > current.lastAt) current.lastAt = a.createdAt;
      byClient.set(key, current);
    }
    const clients = [...byClient.values()].sort((a, b) => b.revenue - a.revenue);

    // Produtos mais vendidos
    const byProduct = new Map<string, { name: string; total: number; count: number }>();
    for (const a of awards) {
      for (const item of a.items) {
        const name = item.quotationItem.description;
        const current = byProduct.get(name) ?? { name, total: 0, count: 0 };
        current.total = round(current.total + toNumber(item.total));
        current.count += 1;
        byProduct.set(name, current);
      }
    }
    const topProducts = [...byProduct.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    res.json({
      range,
      kpis: {
        revenue,
        revenueAllTime: round(toNumber(allTimeAwards._sum.totalAmount)),
        ordersAllTime: allTimeAwards._count._all,
        orders: awards.length,
        averageTicket: awards.length ? round(revenue / awards.length) : 0,
        clients: clients.length,
        invited,
        submitted,
        won,
        responseRate: invited ? percent(submitted, invited) : 0,
        winRate: submitted ? percent(won, submitted) : 0,
        pendingInvites: openInvites.length,
      },
      funnel: [
        { stage: 'Convites recebidos', value: invited },
        { stage: 'Propostas enviadas', value: submitted },
        { stage: 'Propostas aprovadas', value: won },
      ],
      series,
      clients,
      topProducts,
      openInvites: openInvites.map((i) => ({
        inviteId: i.id,
        token: i.token,
        status: i.status,
        quotation: i.quotation,
      })),
      recentAwards: awards.slice(0, 8).map((a) => ({
        id: a.id,
        quotation: a.quotation,
        total: toNumber(a.totalAmount),
        itemCount: a.items.length,
        createdAt: a.createdAt,
      })),
    });
  }),
);

/** GET /dashboard/supplier/awards — pedidos ganhos, com link do XLSX. */
dashboardRouter.get(
  '/supplier/awards',
  requireRole('SUPPLIER'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId!;
    const awards = await prisma.award.findMany({
      where: { supplierCompanyId: companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        quotation: { select: { id: true, code: true, title: true, buyerCompany: { select: { name: true } } } },
        bid: { select: { deliveryDays: true, paymentTerms: true } },
        items: {
          include: { quotationItem: { select: { position: true, description: true, unit: true } } },
          orderBy: { quotationItem: { position: 'asc' } },
        },
      },
    });

    res.json({
      data: awards.map((a) => ({
        id: a.id,
        quotation: a.quotation,
        total: toNumber(a.totalAmount),
        savings: toNumber(a.savings),
        createdAt: a.createdAt,
        deliveryDays: a.bid.deliveryDays,
        paymentTerms: a.bid.paymentTerms,
        items: a.items.map((i) => ({
          position: i.quotationItem.position,
          description: i.quotationItem.description,
          unit: i.quotationItem.unit,
          quantity: toNumber(i.quantity),
          unitPrice: toNumber(i.unitPrice),
          total: toNumber(i.total),
        })),
        xlsxUrl: `/exports/awards/${a.id}.xlsx`,
      })),
    });
  }),
);

/** GET /dashboard/supplier/awards/:id */
dashboardRouter.get(
  '/supplier/awards/:id',
  requireRole('SUPPLIER'),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const award = await prisma.award.findUnique({
      where: { id },
      include: {
        quotation: { include: { buyerCompany: true, createdBy: { select: { name: true, email: true, phone: true } } } },
        bid: true,
        items: {
          include: { quotationItem: true, bidItem: { select: { brand: true, notes: true } } },
          orderBy: { quotationItem: { position: 'asc' } },
        },
      },
    });
    if (!award) throw Forbidden();
    if (req.user!.role !== 'ADMIN' && award.supplierCompanyId !== req.user!.companyId) throw Forbidden();

    res.json({
      award: {
        id: award.id,
        createdAt: award.createdAt,
        total: toNumber(award.totalAmount),
        savings: toNumber(award.savings),
        quotation: {
          id: award.quotation.id,
          code: award.quotation.code,
          title: award.quotation.title,
          deliveryAddress: award.quotation.deliveryAddress,
          deliveryDate: award.quotation.deliveryDate,
          buyer: award.quotation.buyerCompany,
          contact: award.quotation.createdBy,
        },
        conditions: { deliveryDays: award.bid.deliveryDays, paymentTerms: award.bid.paymentTerms },
        items: award.items.map((i) => ({
          position: i.quotationItem.position,
          description: i.quotationItem.description,
          unit: i.quotationItem.unit,
          quantity: toNumber(i.quantity),
          unitPrice: toNumber(i.unitPrice),
          total: toNumber(i.total),
          brand: i.bidItem.brand,
          notes: i.bidItem.notes,
        })),
        xlsxUrl: `/exports/awards/${award.id}.xlsx`,
      },
    });
  }),
);
