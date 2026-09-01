import { env } from '../config/env';
import { logger } from '../lib/logger';

type N8nPath = 'dispatch' | 'outbound' | 'award';

const PATHS: Record<N8nPath, () => string> = {
  dispatch: () => env.N8N_WEBHOOK_DISPATCH,
  outbound: () => env.N8N_WEBHOOK_OUTBOUND,
  award: () => env.N8N_WEBHOOK_AWARD,
};

export interface N8nResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}

/**
 * Dispara um webhook do n8n. Nunca lança: uma indisponibilidade da automação
 * não pode derrubar a operação de negócio — a falha é registrada e devolvida.
 */
export async function callN8n(path: N8nPath, payload: unknown, timeoutMs = 15_000): Promise<N8nResult> {
  const url = `${env.N8N_BASE_URL.replace(/\/$/, '')}${PATHS[path]()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-emptra-key': env.N8N_API_KEY || env.WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* resposta não-JSON é aceitável */
    }

    if (!res.ok) {
      logger.warn({ url, status: res.status, body }, 'n8n respondeu com erro');
      return { ok: false, status: res.status, body };
    }
    return { ok: true, status: res.status, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ url, err: message }, 'falha ao chamar n8n');
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
