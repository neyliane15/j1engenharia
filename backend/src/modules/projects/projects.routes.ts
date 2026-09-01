import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { Forbidden } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireCompany, requireRole } from '../../middlewares/rbac';

export const projectsRouter = Router();
projectsRouter.use(authenticate, requireCompany, requireRole('BUYER'));

/** GET /projects — centros de custo do comprador. */
projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { companyId: req.user!.companyId!, active: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { quotations: true } } },
    });
    res.json({ data: projects });
  }),
);

/** POST /projects */
projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(2),
        code: z.string().max(30).optional().nullable(),
        address: z.string().optional().nullable(),
      })
      .parse(req.body);

    const project = await prisma.project.create({
      data: { ...data, companyId: req.user!.companyId! },
    });
    res.status(201).json({ project });
  }),
);

/** PATCH /projects/:id */
projectsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const data = z
      .object({
        name: z.string().min(2).optional(),
        code: z.string().max(30).optional().nullable(),
        address: z.string().optional().nullable(),
        active: z.boolean().optional(),
      })
      .parse(req.body);

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.companyId !== req.user!.companyId) throw Forbidden();

    res.json({ project: await prisma.project.update({ where: { id }, data }) });
  }),
);
