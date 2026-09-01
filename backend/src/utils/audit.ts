import type { Request } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function audit(
  req: Request | null,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req?.user?.id ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        meta: (meta ?? {}) as never,
        ip: req?.ip ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err, action, entity }, 'falha ao gravar auditoria');
  }
}
