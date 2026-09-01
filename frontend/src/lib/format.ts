import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('pt-br');
dayjs.extend(relativeTime);

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

export const formatMoney = (value?: number | null) => brl.format(value ?? 0);

/** R$ 1,2 mi — para eixos de gráfico e KPIs grandes. */
export const formatMoneyCompact = (value?: number | null) => brlCompact.format(value ?? 0);

export const formatNumber = (value?: number | null) => decimal.format(value ?? 0);

export const formatPercent = (value?: number | null, digits = 1) =>
  `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const formatDate = (value?: string | Date | null) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');

export const formatDateTime = (value?: string | Date | null) =>
  value ? dayjs(value).format('DD/MM/YYYY [às] HH:mm') : '—';

export const formatRelative = (value?: string | Date | null) => (value ? dayjs(value).fromNow() : '—');

/** "em 3 dias", "hoje", "vencida há 2 dias" — para prazos de cotação. */
export function formatDeadline(value?: string | Date | null): { label: string; tone: 'ok' | 'warn' | 'late' } {
  if (!value) return { label: '—', tone: 'ok' };
  const target = dayjs(value);
  const hours = target.diff(dayjs(), 'hour');

  if (hours < 0) return { label: `vencida ${target.fromNow()}`, tone: 'late' };
  if (hours < 24) return { label: `vence em ${hours <= 1 ? '1 hora' : `${hours} horas`}`, tone: 'warn' };
  const days = target.diff(dayjs(), 'day');
  return { label: `vence em ${days === 1 ? '1 dia' : `${days} dias`}`, tone: days <= 2 ? 'warn' : 'ok' };
}

export function formatPhone(raw?: string | null): string {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw;
}

export function formatCNPJ(raw?: string | null): string {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export const initials = (name?: string | null) =>
  (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/** Lê "1.234,56" digitado no input e devolve number. */
export function parseMoneyInput(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
