import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { verifyWebhook } from '../../middlewares/webhook';
import { handleInboundMessage } from '../../services/whatsapp.bot';
import { closeExpiredQuotations, sendReminders } from '../../services/dispatch.service';

export const webhooksRouter = Router();

// Tudo aqui vem do n8n e precisa de assinatura.
webhooksRouter.use(verifyWebhook);

/**
 * POST /webhooks/n8n/whatsapp/inbound
 * O n8n normaliza o evento do provedor (Cloud API ou Evolution) e entrega
 * apenas { phone, body }. O robô responde e devolve o texto da resposta —
 * o n8n pode usá-lo, mas o envio já foi feito pela própria API.
 */
webhooksRouter.post(
  '/n8n/whatsapp/inbound',
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        phone: z.string().min(8),
        body: z.string().default(''),
        waId: z.string().optional().nullable(),
        name: z.string().optional().nullable(),
      })
      .parse(req.body);

    const result = await handleInboundMessage(payload);
    logger.info({ phone: payload.phone, action: result.action }, 'mensagem processada');
    res.json(result);
  }),
);

/**
 * POST /webhooks/n8n/whatsapp/status
 * Atualiza o status de entrega de uma mensagem já enviada.
 */
webhooksRouter.post(
  '/n8n/whatsapp/status',
  asyncHandler(async (req, res) => {
    const payload = z
      .object({
        messageId: z.string().uuid().optional(),
        waId: z.string().optional(),
        status: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED']),
        error: z.string().optional().nullable(),
      })
      .parse(req.body);

    if (!payload.messageId && !payload.waId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Informe messageId ou waId' } });
    }

    const updated = await prisma.whatsAppMessage.updateMany({
      where: payload.messageId ? { id: payload.messageId } : { waId: payload.waId! },
      data: {
        status: payload.status,
        error: payload.error ?? null,
        ...(payload.waId && payload.messageId ? { waId: payload.waId } : {}),
      },
    });

    res.json({ updated: updated.count });
  }),
);

/**
 * POST /webhooks/n8n/cron/reminders
 * Agendado no n8n (ex.: de hora em hora). Cobra quem não respondeu.
 */
webhooksRouter.post(
  '/n8n/cron/reminders',
  asyncHandler(async (req, res) => {
    const { hoursBefore } = z.object({ hoursBefore: z.coerce.number().min(1).max(168).default(24) }).parse(req.body ?? {});
    const result = await sendReminders(hoursBefore);
    res.json(result);
  }),
);

/**
 * POST /webhooks/n8n/cron/close-expired
 * Agendado no n8n. Fecha cotações vencidas e libera a comparação.
 */
webhooksRouter.post(
  '/n8n/cron/close-expired',
  asyncHandler(async (_req, res) => {
    res.json(await closeExpiredQuotations());
  }),
);

/** GET /webhooks/health — o n8n usa para confirmar a conexão com a API. */
webhooksRouter.get('/health', (_req, res) => res.json({ ok: true, service: 'emptra-webhooks' }));
