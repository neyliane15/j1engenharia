import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { Forbidden, Unauthorized } from '../lib/errors';

/** Restringe a rota aos papéis informados. ADMIN sempre passa. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (req.user.role === 'ADMIN') return next();
    if (!roles.includes(req.user.role)) return next(Forbidden('Seu perfil não tem acesso a este recurso'));
    next();
  };
}

/** Exige que o usuário esteja vinculado a uma empresa (comprador/fornecedor). */
export function requireCompany(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(Unauthorized());
  if (req.user.role !== 'ADMIN' && !req.user.companyId) {
    return next(Forbidden('Seu usuário ainda não está vinculado a uma empresa'));
  }
  next();
}

export const isAdmin = (req: Request) => req.user?.role === 'ADMIN';
