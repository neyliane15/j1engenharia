import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { Unauthorized } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Autentica chamadas vindas do n8n.
 *
 * Aceita, nesta ordem:
 *  1. `x-emptra-signature: sha256=<hmac do corpo cru com WEBHOOK_SECRET>`  (recomendado)
 *  2. `x-emptra-key: <WEBHOOK_SECRET>`                                     (fallback simples)
 */
export function verifyWebhook(req: Request, _res: Response, next: NextFunction) {
  const signature = req.header('x-emptra-signature');
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (signature && rawBody) {
    const expected = `sha256=${createHmac('sha256', env.WEBHOOK_SECRET).update(rawBody).digest('hex')}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return next();
    logger.warn({ path: req.path }, 'assinatura de webhook inválida');
    return next(Unauthorized('Assinatura do webhook inválida'));
  }

  const key = req.header('x-emptra-key');
  if (key && key === env.WEBHOOK_SECRET) return next();

  return next(Unauthorized('Webhook não autenticado'));
}
