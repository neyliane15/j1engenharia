import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { Forbidden, NotFound } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireCompany } from '../../middlewares/rbac';
import { audit } from '../../utils/audit';
import {
  buildComparisonWorkbook,
  buildSupplierAwardWorkbook,
  buildSupplierRevenueWorkbook,
} from '../../services/xlsx.service';

export const exportsRouter = Router();
exportsRouter.use(authenticate, requireCompany);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendXlsx(res: import('express').Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

/**
 * GET /exports/awards/:id.xlsx
 * A planilha que o fornecedor aprovado baixa com os produtos que venceu.
 * O comprador da cotação também pode baixar.
 */
exportsRouter.get(
  '/awards/:id.xlsx',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const award = await prisma.award.findUnique({
      where: { id },
      select: { id: true, supplierCompanyId: true, quotation: { select: { buyerCompanyId: true, code: true } } },
    });
    if (!award) throw NotFound('Pedido não encontrado');

    const user = req.user!;
    const allowed =
      user.role === 'ADMIN' ||
      (user.role === 'SUPPLIER' && award.supplierCompanyId === user.companyId) ||
      (user.role === 'BUYER' && award.quotation.buyerCompanyId === user.companyId);
    if (!allowed) throw Forbidden('Você não tem acesso a este pedido');

    const { buffer, filename } = await buildSupplierAwardWorkbook(id);
    await audit(req, 'export.award.xlsx', 'Award', id, { code: award.quotation.code });
    sendXlsx(res, buffer, filename);
  }),
);

/** GET /exports/quotations/:id/comparison.xlsx — mapa comparativo do comprador. */
exportsRouter.get(
  '/quotations/:id/comparison.xlsx',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const quotation = await prisma.quotation.findUnique({ where: { id }, select: { buyerCompanyId: true } });
    if (!quotation) throw NotFound('Cotação não encontrada');

    const user = req.user!;
    if (user.role !== 'ADMIN' && !(user.role === 'BUYER' && quotation.buyerCompanyId === user.companyId)) {
      throw Forbidden();
    }

    const { buffer, filename } = await buildComparisonWorkbook(id);
    await audit(req, 'export.comparison.xlsx', 'Quotation', id);
    sendXlsx(res, buffer, filename);
  }),
);

/** GET /exports/supplier/revenue.xlsx — faturamento do fornecedor logado. */
exportsRouter.get(
  '/supplier/revenue.xlsx',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        supplierId: z.string().uuid().optional(),
      })
      .parse(req.query);

    const user = req.user!;
    const supplierId = user.role === 'ADMIN' && q.supplierId ? q.supplierId : user.companyId;
    if (!supplierId) throw Forbidden('Usuário sem empresa vinculada');
    if (user.role === 'BUYER') throw Forbidden();

    const { buffer, filename } = await buildSupplierRevenueWorkbook(supplierId, q.from, q.to);
    await audit(req, 'export.revenue.xlsx', 'Company', supplierId);
    sendXlsx(res, buffer, filename);
  }),
);
