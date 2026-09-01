import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { asyncHandler } from '../../lib/asyncHandler';
import { BadRequest, Forbidden, Unauthorized } from '../../lib/errors';
import { authenticate, signAccessToken } from '../../middlewares/auth';
import { normalizePhone } from '../../utils/phone';
import { audit } from '../../utils/audit';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

const registerSchema = z.object({
  name: z.string().min(3, 'Informe seu nome completo'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa de ao menos 8 caracteres'),
  phone: z.string().optional(),
  role: z.enum(['BUYER', 'SUPPLIER']),
  companyName: z.string().min(2, 'Informe o nome da empresa'),
  cnpj: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  categories: z.array(z.string()).optional(),
});

const userPublic = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  jobTitle: true,
  avatarUrl: true,
  companyId: true,
} as const;

async function issueSession(userId: string, role: 'ADMIN' | 'BUYER' | 'SUPPLIER', companyId: string | null, req: { headers: Record<string, unknown>; ip?: string }) {
  const accessToken = signAccessToken({ sub: userId, role, companyId });
  const refreshToken = randomBytes(48).toString('base64url');
  const days = Number(env.REFRESH_TOKEN_EXPIRES_IN.replace(/\D/g, '')) || 30;

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: dayjs().add(days, 'day').toDate(),
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
      ip: req.ip ?? null,
    },
  });

  return { accessToken, refreshToken };
}

/** POST /auth/login */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { company: { select: { id: true, name: true, type: true, logoUrl: true } } },
    });

    // Mensagem genérica: não revela se o e-mail existe.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw Unauthorized('E-mail ou senha incorretos');
    }
    if (user.status === 'PENDING') {
      throw Forbidden('Seu acesso ainda está aguardando liberação do administrador.');
    }
    if (user.status === 'SUSPENDED') {
      throw Forbidden('Seu acesso está suspenso. Fale com o administrador.');
    }

    const tokens = await issueSession(user.id, user.role, user.companyId, req);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit(req, 'auth.login', 'User', user.id);

    res.json({
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        companyId: user.companyId,
        company: user.company,
      },
    });
  }),
);

/** POST /auth/register — cria a solicitação de acesso (fica PENDING até o admin liberar). */
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    if (await prisma.user.findUnique({ where: { email } })) {
      throw BadRequest('Já existe um cadastro com este e-mail');
    }

    const phone = normalizePhone(data.phone);
    const companyType = data.role === 'BUYER' ? 'BUYER' : 'SUPPLIER';

    const user = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          type: companyType,
          name: data.companyName.trim(),
          cnpj: data.cnpj?.replace(/\D/g, '') || null,
          city: data.city ?? null,
          state: data.state?.toUpperCase() ?? null,
          phone,
          whatsapp: phone,
          email,
          active: false, // liberada junto com o usuário
          ...(companyType === 'SUPPLIER'
            ? { supplierProfile: { create: { categories: data.categories ?? [] } } }
            : {}),
        },
      });

      return tx.user.create({
        data: {
          name: data.name.trim(),
          email,
          passwordHash: await bcrypt.hash(data.password, 12),
          role: data.role,
          status: 'PENDING',
          phone,
          companyId: company.id,
        },
        select: userPublic,
      });
    });

    await audit(null, 'auth.register', 'User', user.id, { role: data.role });

    res.status(201).json({
      user,
      message: 'Cadastro recebido. Um administrador vai liberar o seu acesso — você recebe um aviso por e-mail.',
    });
  }),
);

/** POST /auth/refresh */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, role: true, companyId: true, status: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw Unauthorized('Sessão expirada. Entre novamente.');
    }
    if (stored.user.status !== 'ACTIVE') throw Forbidden('Acesso indisponível');

    // Rotação: o token antigo morre ao ser usado.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const tokens = await issueSession(stored.user.id, stored.user.role, stored.user.companyId, req);

    res.json(tokens);
  }),
);

/** POST /auth/logout */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const parsed = z.object({ refreshToken: z.string().optional() }).safeParse(req.body);
    if (parsed.success && parsed.data.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: parsed.data.refreshToken, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.status(204).end();
  }),
);

/** GET /auth/me */
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: {
        ...userPublic,
        lastLoginAt: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            type: true,
            cnpj: true,
            city: true,
            state: true,
            whatsapp: true,
            logoUrl: true,
            supplierProfile: true,
          },
        },
      },
    });
    res.json({ user });
  }),
);

/** PATCH /auth/me — o próprio usuário edita o seu perfil. */
authRouter.patch(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(3).optional(),
        phone: z.string().optional(),
        jobTitle: z.string().max(80).optional(),
        avatarUrl: z.string().url().optional().nullable(),
      })
      .parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { ...data, ...(data.phone ? { phone: normalizePhone(data.phone) } : {}) },
      select: userPublic,
    });
    res.json({ user });
  }),
);

/** POST /auth/change-password */
authRouter.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, 'A nova senha precisa de ao menos 8 caracteres'),
      })
      .parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw BadRequest('Senha atual incorreta');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(newPassword, 12) },
      }),
      prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await audit(req, 'auth.change_password', 'User', user.id);
    res.json({ message: 'Senha alterada. Entre novamente com a nova senha.' });
  }),
);
