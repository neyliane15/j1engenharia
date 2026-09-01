import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __emptraPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__emptraPrisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProd) global.__emptraPrisma = prisma;

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
