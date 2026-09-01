import { describe, expect, it } from 'vitest';
import { parseLine, parseMessage, isAllUnknown } from '../src/services/whatsapp.parser';
import { parseBRLNumber } from '../src/utils/money';
import { normalizePhone, phoneMatches, phoneVariants } from '../src/utils/phone';

describe('parseBRLNumber', () => {
  it('lê os formatos que o fornecedor realmente digita', () => {
    expect(parseBRLNumber('45,90')).toBe(45.9);
    expect(parseBRLNumber('45.90')).toBe(45.9);
    expect(parseBRLNumber('R$ 1.234,56')).toBe(1234.56);
    expect(parseBRLNumber('1234')).toBe(1234);
    expect(parseBRLNumber('')).toBeNull();
    expect(parseBRLNumber('abc')).toBeNull();
  });
});

describe('parseLine — preços', () => {
  it.each([
    ['1 45,90', 1, 45.9],
    ['1: 45,90', 1, 45.9],
    ['2 - 128,00', 2, 128],
    ['item 3 12,50', 3, 12.5],
    ['4) R$ 89,90', 4, 89.9],
    ['10 = 5,00', 10, 5],
  ])('entende "%s"', (input, position, price) => {
    expect(parseLine(input)).toEqual({ kind: 'price', position, unitPrice: price });
  });
});

describe('parseLine — comandos', () => {
  it('prazo de entrega', () => {
    expect(parseLine('PRAZO 7')).toEqual({ kind: 'leadTime', days: 7 });
    expect(parseLine('entrega 10 dias')).toEqual({ kind: 'leadTime', days: 10 });
  });

  it('indisponibilidade', () => {
    expect(parseLine('SEM 3')).toEqual({ kind: 'unavailable', position: 3 });
    expect(parseLine('não tenho o item 2')).toEqual({ kind: 'unavailable', position: 2 });
  });

  it('marca, pagamento, frete e desconto', () => {
    expect(parseLine('MARCA 1 Tigre')).toEqual({ kind: 'brand', position: 1, brand: 'Tigre' });
    expect(parseLine('PAGAMENTO 30/60')).toEqual({ kind: 'payment', terms: '30/60' });
    expect(parseLine('FRETE 150')).toEqual({ kind: 'freight', value: 150 });
    expect(parseLine('frete grátis')).toEqual({ kind: 'freight', value: 0 });
    expect(parseLine('DESCONTO 50')).toEqual({ kind: 'discount', value: 50 });
  });

  it('ações de fluxo, sem depender de acento ou caixa', () => {
    expect(parseLine('ENVIAR')).toEqual({ kind: 'submit' });
    expect(parseLine('enviar')).toEqual({ kind: 'submit' });
    expect(parseLine('Resumo')).toEqual({ kind: 'summary' });
    expect(parseLine('ajuda')).toEqual({ kind: 'help' });
    expect(parseLine('RECUSAR sem estoque')).toEqual({ kind: 'decline', reason: 'sem estoque' });
  });

  it('devolve unknown para texto solto', () => {
    expect(parseLine('bom dia, tudo bem?')).toEqual({ kind: 'unknown', raw: 'bom dia, tudo bem?' });
  });
});

describe('parseMessage', () => {
  it('processa a mensagem inteira de uma vez', () => {
    const cmds = parseMessage(['1 45,90', '2 128,00', 'SEM 3', 'PRAZO 7', 'ENVIAR'].join('\n'));
    expect(cmds).toHaveLength(5);
    expect(cmds[0]).toEqual({ kind: 'price', position: 1, unitPrice: 45.9 });
    expect(cmds[4]).toEqual({ kind: 'submit' });
  });

  it('aceita comandos separados por ponto e vírgula', () => {
    expect(parseMessage('1 10,00; 2 20,00')).toHaveLength(2);
  });

  it('reconhece uma mensagem sem nenhum comando', () => {
    expect(isAllUnknown(parseMessage('oi, quem fala?'))).toBe(true);
    expect(isAllUnknown(parseMessage('1 10,00'))).toBe(false);
  });
});

describe('telefone', () => {
  it('normaliza para E.164 sem +', () => {
    expect(normalizePhone('(11) 98888-7777')).toBe('5511988887777');
    expect(normalizePhone('11988887777')).toBe('5511988887777');
    expect(normalizePhone('+55 11 98888-7777')).toBe('5511988887777');
    expect(normalizePhone('123')).toBeNull();
  });

  it('tolera o nono dígito ao comparar', () => {
    expect(phoneMatches('5511988887777', '551188887777')).toBe(true);
    expect(phoneMatches('5511988887777', '5511988887778')).toBe(false);
  });

  it('gera as variantes para busca no banco', () => {
    expect(phoneVariants('5511988887777')).toContain('551188887777');
  });
});

describe('seleção de cotação por código', () => {
  it('reconhece o código sozinho', () => {
    expect(parseLine('COT-2026-0012')).toEqual({ kind: 'selectQuotation', code: 'COT-2026-0012' });
    expect(parseLine('cot-2026-0012')).toEqual({ kind: 'selectQuotation', code: 'COT-2026-0012' });
    expect(parseLine('cotação COT-2026-0012')).toEqual({ kind: 'selectQuotation', code: 'COT-2026-0012' });
  });

  it('não confunde código com preço', () => {
    expect(parseLine('1 45,90')).toEqual({ kind: 'price', position: 1, unitPrice: 45.9 });
  });

  it('aceita o código junto dos preços', () => {
    const cmds = parseMessage('COT-2026-0012\n1 10,00\nENVIAR');
    expect(cmds[0]).toEqual({ kind: 'selectQuotation', code: 'COT-2026-0012' });
    expect(cmds).toHaveLength(3);
  });
});

describe('desconto por item', () => {
  it('separa desconto de linha de desconto do total', () => {
    expect(parseLine('DESCONTO 1 10%')).toEqual({ kind: 'itemDiscount', position: 1, percent: 10 });
    expect(parseLine('desconto 3 7,5%')).toEqual({ kind: 'itemDiscount', position: 3, percent: 7.5 });
    expect(parseLine('DESCONTO 2 15')).toEqual({ kind: 'itemDiscount', position: 2, percent: 15 });
    expect(parseLine('DESCONTO 50')).toEqual({ kind: 'discount', value: 50 });
  });

  it('recusa porcentagem impossível', () => {
    expect(parseLine('DESCONTO 1 150%')).toEqual({ kind: 'unknown', raw: 'DESCONTO 1 150%' });
  });
});
