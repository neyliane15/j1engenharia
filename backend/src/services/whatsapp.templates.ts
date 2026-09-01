import { formatBRL } from '../utils/money';

const currency = (v: number) => formatBRL(v);

export interface InviteTemplateData {
  supplierName: string;
  buyerName: string;
  quotationCode: string;
  quotationTitle: string;
  deadline: string;
  items: { position: number; description: string; quantity: string; unit: string; brandRef?: string | null }[];
  link: string;
}

export function inviteMessage(d: InviteTemplateData): string {
  const list = d.items
    .map((i) => `${i.position}. ${i.description} — ${i.quantity} ${i.unit}${i.brandRef ? ` (ref: ${i.brandRef})` : ''}`)
    .join('\n');

  return [
    `*Emptra · Nova cotação ${d.quotationCode}*`,
    '',
    `Olá, ${d.supplierName}.`,
    `*${d.buyerName}* está cotando materiais e quer o seu preço.`,
    '',
    `*${d.quotationTitle}*`,
    `Prazo para resposta: *${d.deadline}*`,
    '',
    '*Itens:*',
    list,
    '',
    '━━━━━━━━━━━━━━━',
    '*Responda aqui mesmo pelo WhatsApp:*',
    'Envie o número do item e o preço unitário, um por linha.',
    '',
    '_Exemplo:_',
    '1 45,90',
    '2 128,00',
    '',
    'Outros comandos:',
    '• `PRAZO 7` — prazo de entrega em dias',
    '• `PAGAMENTO 30/60` — condição de pagamento',
    '• `MARCA 1 Tigre` — marca do item 1',
    '• `SEM 3` — não tenho o item 3',
    '• `FRETE 150` — valor do frete',
    '• `RESUMO` — conferir o que já enviei',
    '• `ENVIAR` — fechar e enviar a proposta',
    '• `RECUSAR` — não vou participar',
    '• `AJUDA` — ver os comandos',
    `• \`${d.quotationCode}\` — voltar para esta cotação, se tiver mais de uma aberta`,
    '',
    `Prefere preencher pelo site? ${d.link}`,
  ].join('\n');
}

export function helpMessage(): string {
  return [
    '*Comandos disponíveis*',
    '',
    '`1 45,90` — preço unitário do item 1',
    '`PRAZO 7` — prazo de entrega em dias',
    '`PAGAMENTO 30/60` — condição de pagamento',
    '`MARCA 1 Tigre` — marca do item 1',
    '`SEM 3` — item 3 indisponível',
    '`FRETE 150` — valor do frete',
    '`DESCONTO 50` — desconto no total',
    '`RESUMO` — ver o que já registrei',
    '`ENVIAR` — fechar e enviar a proposta',
    '`RECUSAR` — declinar esta cotação',
    '`COT-2026-0012` — trocar para outra cotação aberta, pelo código',
  ].join('\n');
}

/** O fornecedor citou um código que não é dele, já fechou ou venceu. */
export function quotationNotFoundMessage(code: string): string {
  return [
    `Não encontrei a cotação *${code}* aberta para o seu número.`,
    '',
    'Isso acontece quando o prazo já venceu, a cotação foi encerrada ou o',
    'convite foi para outro número. Confira o código na mensagem original',
    'ou fale com o comprador.',
  ].join('\n');
}

export interface SummaryData {
  quotationCode: string;
  lines: { position: number; description: string; quantity: number; unit: string; unitPrice: number; total: number; available: boolean; brand?: string | null }[];
  missing: number[];
  subtotal: number;
  freight: number;
  discount: number;
  total: number;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
}

export function summaryMessage(d: SummaryData): string {
  const rows = d.lines.map((l) =>
    l.available
      ? `${l.position}. ${l.description}\n    ${l.quantity} ${l.unit} × ${currency(l.unitPrice)} = *${currency(l.total)}*${l.brand ? `\n    marca: ${l.brand}` : ''}`
      : `${l.position}. ${l.description}\n    _indisponível_`,
  );

  const out = [`*Resumo da sua proposta · ${d.quotationCode}*`, '', ...rows, '', '━━━━━━━━━━━━━━━'];

  out.push(`Subtotal: ${currency(d.subtotal)}`);
  if (d.freight) out.push(`Frete: ${currency(d.freight)}`);
  if (d.discount) out.push(`Desconto: -${currency(d.discount)}`);
  out.push(`*Total: ${currency(d.total)}*`);
  if (d.deliveryDays) out.push(`Entrega: ${d.deliveryDays} dias`);
  if (d.paymentTerms) out.push(`Pagamento: ${d.paymentTerms}`);

  if (d.missing.length) {
    out.push('', `Faltam os itens: *${d.missing.join(', ')}*`);
    out.push('Envie o preço deles ou use `SEM <número>` se não tiver.');
  } else {
    out.push('', 'Tudo preenchido. Envie `ENVIAR` para concluir.');
  }

  return out.join('\n');
}

export function submittedMessage(quotationCode: string, total: number, buyerName: string): string {
  return [
    '*Proposta enviada*',
    '',
    `Cotação ${quotationCode} · Total ${currency(total)}`,
    `${buyerName} já recebeu a sua proposta e vai analisar.`,
    '',
    'Avisamos por aqui assim que houver decisão.',
    'Para alterar algo antes da aprovação, envie os novos preços e `ENVIAR` de novo.',
  ].join('\n');
}

export function approvedMessage(d: {
  quotationCode: string;
  buyerName: string;
  total: number;
  itemCount: number;
  downloadLink: string;
}): string {
  return [
    '*Proposta aprovada*',
    '',
    `Cotação ${d.quotationCode} · ${d.buyerName}`,
    `${d.itemCount} ${d.itemCount === 1 ? 'item aprovado' : 'itens aprovados'} · Total *${currency(d.total)}*`,
    '',
    `Baixe a planilha dos produtos aprovados (XLSX):`,
    d.downloadLink,
    '',
    'O comprador entrará em contato para fechar a entrega.',
  ].join('\n');
}

export function rejectedMessage(quotationCode: string, buyerName: string, reason?: string | null): string {
  return [
    `*Cotação ${quotationCode} · ${buyerName}*`,
    '',
    'Desta vez a proposta não foi a escolhida.',
    reason ? `Motivo: ${reason}` : '',
    '',
    'Obrigado por participar — em breve enviamos novas oportunidades.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function declinedMessage(quotationCode: string): string {
  return `Registramos que você não vai participar da cotação ${quotationCode}.`;
}

export function reminderMessage(d: { quotationCode: string; buyerName: string; hoursLeft: number; link: string }): string {
  return [
    `*Lembrete · Cotação ${d.quotationCode}*`,
    '',
    `A cotação de ${d.buyerName} encerra em *${d.hoursLeft}h* e ainda não recebemos a sua proposta.`,
    '',
    'Envie os preços por aqui (ex.: `1 45,90`) ou preencha pelo site:',
    d.link,
  ].join('\n');
}

export function unknownMessage(): string {
  return [
    'Não reconheci nenhum comando nesta mensagem.',
    '',
    'Para cotar, envie o número do item e o preço, um por linha:',
    '`1 45,90`',
    '',
    'Envie `AJUDA` para ver todos os comandos.',
  ].join('\n');
}

export function noActiveQuotationMessage(): string {
  return [
    'Olá! Aqui é o assistente de cotações da *Emptra*.',
    '',
    'Não encontrei nenhuma cotação aberta para este número.',
    'Assim que um comprador te enviar uma cotação, ela aparece aqui e você responde por mensagem.',
    '',
    'Se você acha que deveria ter uma cotação aberta, fale com o comprador ou com o administrador.',
  ].join('\n');
}
