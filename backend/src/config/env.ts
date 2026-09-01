import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:3333'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  WEBHOOK_SECRET: z.string().min(16, 'WEBHOOK_SECRET precisa ter ao menos 16 caracteres'),

  N8N_BASE_URL: z.string().default('http://n8n:5678'),
  N8N_WEBHOOK_DISPATCH: z.string().default('/webhook/emptra-cotacao-disparo'),
  N8N_WEBHOOK_OUTBOUND: z.string().default('/webhook/emptra-whatsapp-envio'),
  N8N_WEBHOOK_AWARD: z.string().default('/webhook/emptra-cotacao-aprovada'),
  N8N_API_KEY: z.string().default(''),

  SEED_ADMIN_NAME: z.string().default('Administrador Emptra'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@emptra.com.br'),
  SEED_ADMIN_PASSWORD: z.string().default('Emptra@2025'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n[emptra] Configuração inválida:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
