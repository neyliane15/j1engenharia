import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env, isProd, isTest } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middlewares/error';

import { authRouter } from './modules/auth/auth.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { companiesRouter } from './modules/companies/companies.routes';
import { quotationsRouter } from './modules/quotations/quotations.routes';
import { bidsRouter } from './modules/bids/bids.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { exportsRouter } from './modules/exports/exports.routes';
import { publicRouter } from './modules/public/public.routes';
import { webhooksRouter } from './modules/webhooks/webhooks.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { attachmentsRouter } from './modules/attachments/attachments.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // a SPA é servida em outro host
    }),
  );

  const allowed = [env.APP_URL, 'http://localhost:5173', 'http://localhost:3000'];
  app.use(
    cors({
      origin(origin, callback) {
        // Sem origin = chamada server-to-server (n8n, curl, health check).
        if (!origin || allowed.includes(origin)) return callback(null, true);
        callback(new Error(`Origem não autorizada: ${origin}`));
      },
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );

  app.use(compression());

  // rawBody é necessário para validar a assinatura HMAC dos webhooks.
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/health' },
      }),
    );
  }

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === '/health' || req.path.startsWith('/webhooks'),
      message: { error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente de novo em instantes.' } },
    }),
  );

  // Login e cadastro têm limite próprio, mais rígido.
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    max: isProd ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
  });

  app.get('/health', (_req, res) =>
    res.json({ ok: true, service: 'emptra-api', version: '1.0.0', env: env.NODE_ENV, time: new Date().toISOString() }),
  );

  app.use('/auth/login', authLimiter);
  app.use('/auth/register', authLimiter);

  app.use('/auth', authRouter);
  app.use('/admin', adminRouter);
  app.use('/companies', companiesRouter);
  app.use('/projects', projectsRouter);
  app.use('/quotations', quotationsRouter);
  app.use('/bids', bidsRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/exports', exportsRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/catalog', catalogRouter);
  app.use('/attachments', attachmentsRouter);
  app.use('/public', publicRouter);
  app.use('/webhooks', webhooksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
