import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middlewares/auth';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

/** GET /notifications */
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { unreadOnly, limit } = z
      .object({ unreadOnly: z.coerce.boolean().default(false), limit: z.coerce.number().min(1).max(100).default(30) })
      .parse(req.query);

    const [data, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id, ...(unreadOnly ? { read: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
    ]);

    res.json({ data, unread });
  }),
);

/** POST /notifications/read */
notificationsRouter.post(
  '/read',
  asyncHandler(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).optional() }).parse(req.body ?? {});
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, ...(ids?.length ? { id: { in: ids } } : { read: false }) },
      data: { read: true },
    });
    res.json({ updated: result.count });
  }),
);
