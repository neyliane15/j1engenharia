import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma';

/** Gera COT-2025-0001 sequencial por ano. */
export async function nextQuotationCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COT-${year}-`;
  const last = await prisma.quotation.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const seq = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** Token opaco para o link público de proposta. */
export function inviteToken(): string {
  return randomBytes(24).toString('base64url');
}
