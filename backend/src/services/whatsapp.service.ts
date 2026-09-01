import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { normalizePhone } from '../utils/phone';
import { callN8n } from './n8n.service';

export interface SendResult {
  /** id da linha em `whatsapp_messages` — existe mesmo quando o envio falha. */
  id: string;
  /** true só quando o n8n aceitou a mensagem. */
  ok: boolean;
  error?: string;
}

export interface SendOptions {
  phone: string;
  body: string;
  template?: string;
  quotationId?: string | null;
  inviteId?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Enfileira e envia uma mensagem de WhatsApp através do n8n.
 * Toda mensagem — enviada ou falha — fica registrada em `whatsapp_messages`,
 * que é a trilha de auditoria da automação.
 */
export async function sendWhatsApp(opts: SendOptions): Promise<SendResult | null> {
  const phone = normalizePhone(opts.phone);
  if (!phone) {
    logger.warn({ phone: opts.phone }, 'telefone inválido, mensagem não enviada');
    return null;
  }

  const message = await prisma.whatsAppMessage.create({
    data: {
      direction: 'OUTBOUND',
      status: 'QUEUED',
      phone,
      body: opts.body,
      template: opts.template ?? null,
      payload: (opts.payload ?? {}) as never,
      quotationId: opts.quotationId ?? null,
      inviteId: opts.inviteId ?? null,
    },
  });

  const result = await callN8n('outbound', {
    messageId: message.id,
    phone,
    body: opts.body,
    template: opts.template ?? null,
    quotationId: opts.quotationId ?? null,
    inviteId: opts.inviteId ?? null,
    ...opts.payload,
  });

  const error = result.ok ? null : (result.error ?? `HTTP ${result.status}`);

  await prisma.whatsAppMessage.update({
    where: { id: message.id },
    data: { status: result.ok ? 'SENT' : 'FAILED', error },
  });

  return { id: message.id, ok: result.ok, ...(error ? { error } : {}) };
}

/** Registra uma mensagem recebida (chamada pelo webhook do n8n). */
export async function recordInbound(params: {
  phone: string;
  body: string;
  waId?: string | null;
  quotationId?: string | null;
  inviteId?: string | null;
  payload?: Record<string, unknown>;
}) {
  return prisma.whatsAppMessage.create({
    data: {
      direction: 'INBOUND',
      status: 'RECEIVED',
      phone: normalizePhone(params.phone) ?? params.phone,
      body: params.body,
      waId: params.waId ?? null,
      quotationId: params.quotationId ?? null,
      inviteId: params.inviteId ?? null,
      payload: (params.payload ?? {}) as never,
    },
  });
}
