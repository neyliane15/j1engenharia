import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { Forbidden, Unauthorized } from '../lib/errors';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: Role;
  companyId: string | null;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

/** Exige um usuário autenticado e ATIVO. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Token não informado');

    const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, role: true, companyId: true, status: true },
    });

    if (!user) throw Unauthorized('Usuário não encontrado');
    if (user.status === 'PENDING') throw Forbidden('Acesso aguardando liberação do administrador');
    if (user.status === 'SUSPENDED') throw Forbidden('Acesso suspenso. Fale com o administrador.');

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return next(Unauthorized('Sessão expirada'));
    if (err instanceof jwt.JsonWebTokenError) return next(Unauthorized('Token inválido'));
    next(err);
  }
}
