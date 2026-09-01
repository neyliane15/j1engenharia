import { Prisma } from '@prisma/client';

export type Numeric = Prisma.Decimal | number | string | null | undefined;

/** Converte qualquer valor numérico do Prisma para number com 2 casas seguras. */
export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function sum(values: number[]): number {
  return round(values.reduce((acc, v) => acc + v, 0));
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(sum(values) / values.length);
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return round((part / whole) * 100, 1);
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Lê "1.234,56", "1234.56", "R$ 1.234,56" e devolve 1234.56. */
export function parseBRLNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/r\$/gi, '').replace(/\s/g, '').trim();
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // 1.234,56 → remove separador de milhar
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  s = s.replace(/[^0-9.\-]/g, '');
  // Sem nenhum dígito não há preço: devolver 0 aqui gravaria "item grátis".
  if (!/\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
