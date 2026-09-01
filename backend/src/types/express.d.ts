import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      name: string;
      role: Role;
      companyId: string | null;
    }
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
