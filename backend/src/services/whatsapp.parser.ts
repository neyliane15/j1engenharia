import { parseBRLNumber } from '../utils/money';

export type ParsedCommand =
  | { kind: 'selectQuotation'; code: string }
  | { kind: 'price'; position: number; unitPrice: number }
  | { kind: 'unavailable'; position: number }
  | { kind: 'brand'; position: number; brand: string }
  | { kind: 'leadTime'; days: number }
  | { kind: 'payment'; terms: string }
  | { kind: 'freight'; value: number }
  | { kind: 'discount'; value: number }
  | { kind: 'itemDiscount'; position: number; percent: number }
  | { kind: 'submit' }
  | { kind: 'decline'; reason?: string }
  | { kind: 'summary' }
  | { kind: 'help' }
  | { kind: 'unknown'; raw: string };

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const KEYWORDS = {
  submit: ['enviar', 'finalizar', 'confirmar', 'fechar', 'concluir', 'ok enviar'],
  decline: ['recusar', 'declinar', 'nao vou participar', 'nao participar', 'sair', 'cancelar'],
  summary: ['resumo', 'conferir', 'ver proposta', 'status'],
  help: ['ajuda', 'help', 'comandos', 'menu', '?'],
};

/**
 * Interpreta UMA linha da mensagem do fornecedor.
 *
 * Formatos aceitos para preço (tolerante ao que a pessoa realmente digita):
 *   `1 45,90`   `1: 45,90`   `1 - 45,90`   `item 1 45,90`   `1) R$ 45,90`
 */
export function parseLine(line: string): ParsedCommand | null {
  const raw = line.trim();
  if (!raw) return null;
  const s = strip(raw);

  // Código da cotação: troca qual disputa o fornecedor está respondendo.
  // Quem tem duas cotações abertas precisa poder escolher.
  const code = raw.match(/^\s*(?:cot(?:a[cç][aã]o)?\s*)?(COT-\d{4}-\d{1,6})\s*$/i);
  if (code) return { kind: 'selectQuotation', code: code[1].toUpperCase() };

  for (const kw of KEYWORDS.submit) if (s === kw) return { kind: 'submit' };
  for (const kw of KEYWORDS.summary) if (s === kw) return { kind: 'summary' };
  for (const kw of KEYWORDS.help) if (s === kw) return { kind: 'help' };
  for (const kw of KEYWORDS.decline) {
    if (s === kw || s.startsWith(`${kw} `)) {
      const reason = raw.slice(kw.length).trim();
      return { kind: 'decline', reason: reason || undefined };
    }
  }

  // SEM 3 / NAO TENHO 3 / INDISPONIVEL 3
  const unavailable = s.match(/^(?:sem|nao tenho|não tenho|indisponivel|indisponível)\s+(?:o\s+)?(?:item\s+)?(\d{1,3})$/);
  if (unavailable) return { kind: 'unavailable', position: Number(unavailable[1]) };

  // MARCA 1 Tigre
  const brand = raw.match(/^marca\s+(\d{1,3})\s+(.+)$/i);
  if (brand) return { kind: 'brand', position: Number(brand[1]), brand: brand[2].trim() };

  // PRAZO 7 / ENTREGA 7 dias
  const lead = s.match(/^(?:prazo|entrega)\s+(?:de\s+)?(\d{1,3})\s*(?:dias?|d)?$/);
  if (lead) return { kind: 'leadTime', days: Number(lead[1]) };

  // PAGAMENTO 30/60
  const payment = raw.match(/^(?:pagamento|pgto|condicao|condição)\s+(.+)$/i);
  if (payment) return { kind: 'payment', terms: payment[1].trim().slice(0, 120) };

  // FRETE 150 / FRETE GRATIS
  const freightFree = s.match(/^frete\s+(?:gratis|grátis|incluso|cif|0)$/);
  if (freightFree) return { kind: 'freight', value: 0 };
  const freight = raw.match(/^frete\s+(.+)$/i);
  if (freight) {
    const v = parseBRLNumber(freight[1]);
    if (v !== null && v >= 0) return { kind: 'freight', value: v };
  }

  // DESCONTO 1 10%  → desconto por item, em porcentagem.
  // Com dois argumentos a intenção é essa; porcentagem inválida vira
  // "não entendi", nunca desconto no total — um dígito a mais não pode
  // virar abatimento na proposta inteira.
  const itemDiscount = raw.match(/^desconto\s+(\d{1,3})\s+([\d.,]+)\s*%?$/i);
  if (itemDiscount) {
    const percent = parseBRLNumber(itemDiscount[2]);
    if (percent !== null && percent >= 0 && percent <= 100) {
      return { kind: 'itemDiscount', position: Number(itemDiscount[1]), percent };
    }
    return { kind: 'unknown', raw };
  }

  // DESCONTO 50 → desconto no total da proposta
  const discount = raw.match(/^desconto\s+([\d.,\sR$]+)$/i);
  if (discount) {
    const v = parseBRLNumber(discount[1]);
    if (v !== null && v >= 0) return { kind: 'discount', value: v };
  }

  // Preço do item
  const price = raw.match(/^(?:item\s*)?(\d{1,3})\s*(?:[.):\-–=]|\s)\s*(?:r\$\s*)?([\d.,]+)$/i);
  if (price) {
    const position = Number(price[1]);
    const unitPrice = parseBRLNumber(price[2]);
    if (unitPrice !== null && unitPrice >= 0 && position > 0) {
      return { kind: 'price', position, unitPrice };
    }
  }

  return { kind: 'unknown', raw };
}

/** Interpreta a mensagem inteira (multilinha) devolvendo todos os comandos válidos. */
export function parseMessage(text: string): ParsedCommand[] {
  const lines = text.split(/\r?\n/).flatMap((l) => l.split(/\s*;\s*/));
  const out: ParsedCommand[] = [];
  for (const line of lines) {
    const cmd = parseLine(line);
    if (cmd) out.push(cmd);
  }
  return out;
}

/** true quando a mensagem inteira não produziu nenhum comando reconhecido. */
export function isAllUnknown(cmds: ParsedCommand[]): boolean {
  return cmds.length === 0 || cmds.every((c) => c.kind === 'unknown');
}
