/**
 * Normaliza telefone brasileiro para o formato E.164 sem "+": 55DDDNNNNNNNNN.
 * Aceita "(11) 98888-7777", "11988887777", "5511988887777", "+55 11 98888-7777".
 */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits.startsWith('55')) {
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  }
  if (digits.length < 12 || digits.length > 13) return null;
  return digits;
}

/** Compara dois telefones tolerando o 9º dígito. */
export function phoneMatches(a?: string | null, b?: string | null): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const strip9 = (p: string) => (p.length === 13 ? p.slice(0, 4) + p.slice(5) : p);
  return strip9(na) === strip9(nb);
}

/** Todas as variantes possíveis de um telefone (com e sem 9º dígito). */
export function phoneVariants(raw?: string | null): string[] {
  const n = normalizePhone(raw);
  if (!n) return [];
  const out = new Set<string>([n]);
  if (n.length === 13) out.add(n.slice(0, 4) + n.slice(5));
  if (n.length === 12) out.add(`${n.slice(0, 4)}9${n.slice(4)}`);
  return [...out];
}

export function formatPhoneBR(raw?: string | null): string {
  const n = normalizePhone(raw);
  if (!n) return raw ?? '';
  const ddd = n.slice(2, 4);
  const rest = n.slice(4);
  return rest.length === 9
    ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
