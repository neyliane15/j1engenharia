import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { NotFound } from '../lib/errors';
import { round, toNumber } from '../utils/money';
import { buildComparison } from './quotation.service';

// Paleta Emptra em ARGB para o Excel
const BRAND = {
  deep: 'FF0C2F2C',
  primary: 'FF12A594',
  soft: 'FFE7EFED',
  line: 'FFD3DEDB',
  ink: 'FF0A1614',
  white: 'FFFFFFFF',
  warning: 'FFB4791C',
};

function styleHeader(row: ExcelJS.Row, fill = BRAND.deep, color = BRAND.white) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: color }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND.line } },
      left: { style: 'thin', color: { argb: BRAND.line } },
      bottom: { style: 'thin', color: { argb: BRAND.line } },
      right: { style: 'thin', color: { argb: BRAND.line } },
    };
  });
  row.height = 26;
}

/** Converte 1 → "A", 27 → "AA". Necessário quando há muitos fornecedores. */
function columnLetter(index: number): string {
  let n = Math.max(1, index);
  let out = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    out = String.fromCharCode(65 + rest) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Cabeçalho da planilha: marca, título e subtítulo ocupando as três primeiras
 * linhas, mescladas de A até `lastColumn`.
 */
function titleBlock(ws: ExcelJS.Worksheet, lastColumn: number, title: string, subtitle: string) {
  const end = columnLetter(Math.max(1, lastColumn));

  const blocks: [number, string, Partial<ExcelJS.Font>, number][] = [
    [1, 'EMPTRA', { name: 'Georgia', bold: true, size: 18, color: { argb: BRAND.primary } }, 32],
    [2, title, { bold: true, size: 13, color: { argb: BRAND.ink } }, 22],
    [3, subtitle, { size: 10, color: { argb: 'FF6E7E7C' } }, 18],
  ];

  for (const [row, value, font, height] of blocks) {
    if (end !== 'A') ws.mergeCells(`A${row}:${end}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = value;
    cell.font = font as ExcelJS.Font;
    cell.alignment = { vertical: 'middle' };
    ws.getRow(row).height = height;
  }
}

function autoFit(ws: ExcelJS.Worksheet, min = 10, max = 55) {
  ws.columns.forEach((col) => {
    let width = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length + 2;
      if (len > width) width = len;
    });
    col.width = Math.min(width, max);
  });
}

/** "Casa Forte Construção" -> "casa-forte-construcao" — nome de arquivo legível. */
function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

const MONEY = 'R$ #,##0.00';
const QTY = '#,##0.###';

/**
 * Planilha do FORNECEDOR: itens que ele venceu numa cotação aprovada.
 * É o arquivo que ele baixa depois de ser aprovado.
 */
export async function buildSupplierAwardWorkbook(awardId: string): Promise<{ buffer: Buffer; filename: string }> {
  const award = await prisma.award.findUnique({
    where: { id: awardId },
    include: {
      quotation: { include: { buyerCompany: true, project: true, createdBy: true } },
      supplierCompany: true,
      bid: true,
      items: {
        include: { quotationItem: true, bidItem: true },
        orderBy: { quotationItem: { position: 'asc' } },
      },
    },
  });
  if (!award) throw NotFound('Adjudicação não encontrada');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Emptra';
  wb.created = new Date();

  const ws = wb.addWorksheet('Pedido aprovado', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  titleBlock(
    ws,
    8,
    `Pedido aprovado · ${award.quotation.code}`,
    `${award.quotation.title} — cliente: ${award.quotation.buyerCompany.name}` +
      (award.quotation.project ? ` · obra: ${award.quotation.project.name}` : ''),
  );

  ws.getCell('A4').value = `Fornecedor: ${award.supplierCompany.name}`;
  ws.getCell('A4').font = { bold: true, size: 10 };
  ws.getCell('E4').value = `Aprovado em: ${award.createdAt.toLocaleDateString('pt-BR')}`;
  ws.getCell('E4').font = { size: 10 };
  ws.getRow(5).height = 8;

  const header = ws.addRow([
    'Item',
    'Descrição',
    'Marca',
    'Unid.',
    'Quantidade',
    'Preço unitário',
    'Total',
    'Observações',
  ]);
  styleHeader(header);

  for (const line of award.items) {
    const row = ws.addRow([
      line.quotationItem.position,
      line.quotationItem.description,
      line.bidItem.brand ?? '—',
      line.quotationItem.unit,
      toNumber(line.quantity),
      toNumber(line.unitPrice),
      toNumber(line.total),
      line.bidItem.notes ?? '',
    ]);
    row.getCell(5).numFmt = QTY;
    row.getCell(6).numFmt = MONEY;
    row.getCell(7).numFmt = MONEY;
    row.eachCell((cell, col) => {
      cell.alignment = { vertical: 'middle', horizontal: col === 2 || col === 8 ? 'left' : 'center', wrapText: col === 2 };
      cell.border = { bottom: { style: 'hair', color: { argb: BRAND.line } } };
    });
  }

  ws.addRow([]);
  const totalRow = ws.addRow(['', '', '', '', '', 'TOTAL APROVADO', toNumber(award.totalAmount), '']);
  totalRow.getCell(6).font = { bold: true, color: { argb: BRAND.white } };
  totalRow.getCell(7).font = { bold: true, size: 12, color: { argb: BRAND.white } };
  totalRow.getCell(7).numFmt = MONEY;
  [6, 7].forEach((c) => {
    totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.primary } };
    totalRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
  });
  totalRow.height = 24;

  ws.addRow([]);
  const cond = ws.addRow([`Prazo de entrega: ${award.bid.deliveryDays ?? '—'} dias`]);
  cond.getCell(1).font = { size: 10 };
  const pay = ws.addRow([`Condição de pagamento: ${award.bid.paymentTerms ?? '—'}`]);
  pay.getCell(1).font = { size: 10 };
  const contact = ws.addRow([
    `Contato do comprador: ${award.quotation.createdBy.name} · ${award.quotation.createdBy.email}`,
  ]);
  contact.getCell(1).font = { size: 10 };

  autoFit(ws);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = `emptra-${award.quotation.code}-${slug(award.supplierCompany.name)}.xlsx`;
  return { buffer, filename };
}

/** Planilha do COMPRADOR: mapa comparativo item x fornecedor. */
export async function buildComparisonWorkbook(quotationId: string): Promise<{ buffer: Buffer; filename: string }> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { buyerCompany: true, project: true },
  });
  if (!quotation) throw NotFound('Cotação não encontrada');

  const comparison = await buildComparison(quotationId);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Emptra';

  const ws = wb.addWorksheet('Mapa comparativo', { views: [{ state: 'frozen', xSplit: 2, ySplit: 6 }] });
  titleBlock(
    ws,
    6 + comparison.suppliers.length,
    `Mapa comparativo · ${quotation.code}`,
    `${quotation.title} — ${quotation.buyerCompany.name}` + (quotation.project ? ` · ${quotation.project.name}` : ''),
  );
  ws.getRow(4).height = 8;
  ws.getRow(5).height = 8;

  const header = ws.addRow([
    'Item',
    'Descrição',
    'Unid.',
    'Qtd.',
    ...comparison.suppliers.map((s) => s.supplierName),
    'Melhor preço',
    'Economia vs. média',
  ]);
  styleHeader(header);

  for (const row of comparison.rows) {
    const cells = comparison.suppliers.map((s) => {
      const cell = row.cells.find((c) => c.bidId === s.bidId);
      return cell?.available ? cell.unitPrice : null;
    });
    const saving =
      row.averageUnitPrice !== null && row.bestUnitPrice !== null
        ? round((row.averageUnitPrice - row.bestUnitPrice) * row.quantity)
        : 0;

    const excelRow = ws.addRow([
      row.position,
      row.description,
      row.unit,
      row.quantity,
      ...cells,
      row.bestUnitPrice ?? null,
      saving,
    ]);

    excelRow.getCell(4).numFmt = QTY;
    for (let i = 0; i < comparison.suppliers.length; i++) {
      const cellRef = excelRow.getCell(5 + i);
      cellRef.numFmt = MONEY;
      const supplierCell = row.cells.find((c) => c.bidId === comparison.suppliers[i].bidId);
      if (supplierCell?.isBest) {
        cellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.soft } };
        cellRef.font = { bold: true, color: { argb: BRAND.deep } };
      } else if (!supplierCell?.available) {
        cellRef.value = '—';
        cellRef.font = { color: { argb: 'FF9AA8A6' } };
      }
    }
    excelRow.getCell(5 + comparison.suppliers.length).numFmt = MONEY;
    excelRow.getCell(6 + comparison.suppliers.length).numFmt = MONEY;
    excelRow.eachCell((cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: BRAND.line } } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }

  ws.addRow([]);
  const totals = ws.addRow([
    '',
    'TOTAL POR FORNECEDOR',
    '',
    '',
    ...comparison.suppliers.map((s) => s.total),
    comparison.totals.bestScenarioTotal,
    comparison.totals.potentialSavings,
  ]);
  totals.eachCell((cell, col) => {
    if (col === 1) return;
    cell.font = { bold: true, color: { argb: BRAND.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.deep } };
    if (col >= 5) cell.numFmt = MONEY;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  totals.height = 24;

  // Aba de condições comerciais
  const ws2 = wb.addWorksheet('Condições');
  const h2 = ws2.addRow([
    'Fornecedor',
    'Total',
    'Frete',
    'Desconto',
    'Prazo (dias)',
    'Pagamento',
    'Itens cotados',
    'Cobertura',
    'Melhores preços',
    'Origem',
  ]);
  styleHeader(h2);
  for (const s of comparison.suppliers) {
    const r = ws2.addRow([
      s.supplierName,
      s.total,
      s.freight,
      s.discount,
      s.deliveryDays ?? '—',
      s.paymentTerms ?? '—',
      `${s.itemsQuoted}/${comparison.totals.itemCount}`,
      s.coveragePct / 100,
      s.bestPriceCount,
      s.source === 'WHATSAPP' ? 'WhatsApp' : 'Web',
    ]);
    [2, 3, 4].forEach((c) => (r.getCell(c).numFmt = MONEY));
    r.getCell(8).numFmt = '0.0%';
  }

  autoFit(ws);
  autoFit(ws2);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `emptra-${quotation.code}-comparativo.xlsx` };
}

/** Planilha de faturamento do fornecedor: tudo que ele ganhou no período. */
export async function buildSupplierRevenueWorkbook(
  supplierCompanyId: string,
  from?: Date,
  to?: Date,
): Promise<{ buffer: Buffer; filename: string }> {
  const company = await prisma.company.findUnique({ where: { id: supplierCompanyId } });
  if (!company) throw NotFound('Fornecedor não encontrado');

  const awards = await prisma.award.findMany({
    where: {
      supplierCompanyId,
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    include: { quotation: { include: { buyerCompany: true } }, items: { include: { quotationItem: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Emptra';
  const ws = wb.addWorksheet('Faturamento', { views: [{ state: 'frozen', ySplit: 5 }] });
  titleBlock(ws, 6, `Faturamento aprovado · ${company.name}`, 'Cotações vencidas na plataforma Emptra');
  ws.getRow(4).height = 8;

  const header = ws.addRow(['Cotação', 'Cliente', 'Data', 'Itens', 'Total aprovado', 'Economia gerada ao cliente']);
  styleHeader(header);

  for (const a of awards) {
    const r = ws.addRow([
      a.quotation.code,
      a.quotation.buyerCompany.name,
      a.createdAt.toLocaleDateString('pt-BR'),
      a.items.length,
      toNumber(a.totalAmount),
      toNumber(a.savings),
    ]);
    r.getCell(5).numFmt = MONEY;
    r.getCell(6).numFmt = MONEY;
  }

  ws.addRow([]);
  const total = awards.reduce((acc, a) => acc + toNumber(a.totalAmount), 0);
  const t = ws.addRow(['', '', '', 'TOTAL', round(total), '']);
  t.getCell(4).font = { bold: true, color: { argb: BRAND.white } };
  t.getCell(5).font = { bold: true, color: { argb: BRAND.white } };
  t.getCell(5).numFmt = MONEY;
  [4, 5].forEach((c) => {
    t.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.primary } };
  });

  autoFit(ws);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `emptra-faturamento-${slug(company.name)}.xlsx` };
}
