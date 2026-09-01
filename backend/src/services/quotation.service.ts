import { prisma } from '../lib/prisma';
import { average, percent, round, sum, toNumber, type Numeric } from '../utils/money';

/** Uma célula do comparativo: o preço de um fornecedor para um item. */
export interface ComparisonCell {
  bidId: string;
  supplierId: string;
  supplierName: string;
  bidItemId: string | null;
  /** Preço de tabela do fornecedor, antes do desconto da linha. */
  listPrice: number;
  /** Preço já com o desconto — é este que entra na comparação. */
  unitPrice: number;
  discountPct: number;
  total: number;
  brand: string | null;
  available: boolean;
  leadTimeDays: number | null;
  isBest: boolean;
  deltaToBestPct: number;
}

export interface ComparisonRow {
  itemId: string;
  position: number;
  description: string;
  unit: string;
  quantity: number;
  brandRef: string | null;
  targetPrice: number | null;
  cells: ComparisonCell[];
  bestUnitPrice: number | null;
  worstUnitPrice: number | null;
  averageUnitPrice: number | null;
  bestSupplierId: string | null;
  spreadPct: number;
}

export interface ComparisonSupplier {
  bidId: string;
  supplierId: string;
  supplierName: string;
  status: string;
  source: string;
  total: number;
  freight: number;
  discount: number;
  deliveryDays: number | null;
  paymentTerms: string | null;
  submittedAt: Date | null;
  itemsQuoted: number;
  itemsMissing: number;
  bestPriceCount: number;
  coveragePct: number;
  rankByTotal: number;
}

export interface ComparisonResult {
  priority: 'PRICE' | 'DELIVERY_SPEED' | 'PAYMENT_TERM';
  rows: ComparisonRow[];
  suppliers: ComparisonSupplier[];
  totals: {
    itemCount: number;
    bidCount: number;
    bestScenarioTotal: number;
    cheapestSingleSupplierTotal: number | null;
    averageTotal: number;
    highestTotal: number;
    potentialSavings: number;
    potentialSavingsPct: number;
    splitGain: number;
  };
}

/**
 * Lê "30/60", "28 dias", "à vista" e devolve o maior prazo em dias.
 * É aproximado de propósito: serve para ordenar, não para contabilizar.
 */
export function prazoEmDias(termo?: string | null): number {
  if (!termo) return 0;
  const numeros = termo.match(/\d{1,3}/g);
  if (!numeros) return 0;
  return Math.max(...numeros.map(Number).filter((n) => n <= 365));
}

const bidInclude = {
  supplierCompany: { select: { id: true, name: true, tradeName: true } },
  items: true,
} as const;

/**
 * Monta o comparativo completo de uma cotação: matriz item x fornecedor,
 * melhor preço por linha, ranking e potencial de economia.
 */
export async function buildComparison(quotationId: string): Promise<ComparisonResult> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: { priority: true },
  });
  const priority = quotation?.priority ?? 'PRICE';

  const [items, bids] = await Promise.all([
    prisma.quotationItem.findMany({ where: { quotationId }, orderBy: { position: 'asc' } }),
    prisma.bid.findMany({
      where: { quotationId, status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
      include: bidInclude,
      orderBy: { totalAmount: 'asc' },
    }),
  ]);

  const supplierTotals = new Map<string, number>();
  const bestPriceCount = new Map<string, number>();

  const rows: ComparisonRow[] = items.map((item) => {
    const quantity = toNumber(item.quantity);

    const cells: ComparisonCell[] = bids.map((bid) => {
      const bidItem = bid.items.find((bi) => bi.quotationItemId === item.id);
      const available = Boolean(bidItem?.available) && toNumber(bidItem?.unitPrice) > 0;
      const listPrice = available ? toNumber(bidItem?.unitPrice) : 0;
      const discountPct = available ? toNumber(bidItem?.discountPct) : 0;
      // Comparar preço de tabela quando um deu desconto e o outro não seria
      // comparar coisas diferentes: a linha vale pelo que o comprador paga.
      const unitPrice = round(listPrice * (1 - discountPct / 100), 4);
      return {
        bidId: bid.id,
        supplierId: bid.supplierCompanyId,
        supplierName: bid.supplierCompany.tradeName || bid.supplierCompany.name,
        bidItemId: bidItem?.id ?? null,
        listPrice,
        unitPrice,
        discountPct,
        total: round(unitPrice * quantity),
        brand: bidItem?.brand ?? null,
        available,
        leadTimeDays: bidItem?.leadTimeDays ?? null,
        isBest: false,
        deltaToBestPct: 0,
      };
    });

    const valid = cells.filter((c) => c.available && c.unitPrice > 0);
    const prices = valid.map((c) => c.unitPrice);
    const bestUnitPrice = prices.length ? Math.min(...prices) : null;
    const worstUnitPrice = prices.length ? Math.max(...prices) : null;
    const averageUnitPrice = prices.length ? average(prices) : null;

    let bestSupplierId: string | null = null;
    for (const cell of cells) {
      if (bestUnitPrice !== null && cell.available && cell.unitPrice === bestUnitPrice && !bestSupplierId) {
        cell.isBest = true;
        bestSupplierId = cell.supplierId;
        bestPriceCount.set(cell.supplierId, (bestPriceCount.get(cell.supplierId) ?? 0) + 1);
      }
      if (bestUnitPrice && cell.available && cell.unitPrice > 0) {
        cell.deltaToBestPct = percent(cell.unitPrice - bestUnitPrice, bestUnitPrice);
      }
      if (cell.available) {
        supplierTotals.set(cell.supplierId, round((supplierTotals.get(cell.supplierId) ?? 0) + cell.total));
      }
    }

    return {
      itemId: item.id,
      position: item.position,
      description: item.description,
      unit: item.unit,
      quantity,
      brandRef: item.brandRef,
      targetPrice: item.targetPrice ? toNumber(item.targetPrice) : null,
      cells,
      bestUnitPrice,
      worstUnitPrice,
      averageUnitPrice,
      bestSupplierId,
      spreadPct: bestUnitPrice && worstUnitPrice ? percent(worstUnitPrice - bestUnitPrice, bestUnitPrice) : 0,
    };
  });

  // Cenário ótimo: cada item pelo menor preço disponível.
  const bestScenarioTotal = sum(rows.map((r) => (r.bestUnitPrice !== null ? round(r.bestUnitPrice * r.quantity) : 0)));

  // Fornecedores que cobrem TODOS os itens — base do cenário de compra única.
  const fullCoverage = bids.filter((bid) =>
    rows.every((row) => {
      const cell = row.cells.find((c) => c.bidId === bid.id);
      return cell?.available && cell.unitPrice > 0;
    }),
  );
  const cheapestSingleSupplierTotal = fullCoverage.length
    ? Math.min(...fullCoverage.map((b) => toNumber(b.totalAmount)))
    : null;

  const bidTotals = bids.map((b) => toNumber(b.totalAmount)).filter((v) => v > 0);
  const averageTotal = bidTotals.length ? average(bidTotals) : 0;
  const highestTotal = bidTotals.length ? Math.max(...bidTotals) : 0;

  const suppliers: ComparisonSupplier[] = bids
    .map((bid) => {
      const quoted = rows.filter((r) => r.cells.find((c) => c.bidId === bid.id)?.available).length;
      return {
        bidId: bid.id,
        supplierId: bid.supplierCompanyId,
        supplierName: bid.supplierCompany.tradeName || bid.supplierCompany.name,
        status: bid.status as string,
        source: bid.source as string,
        total: toNumber(bid.totalAmount),
        freight: toNumber(bid.freight),
        discount: toNumber(bid.discount),
        deliveryDays: bid.deliveryDays,
        paymentTerms: bid.paymentTerms,
        submittedAt: bid.submittedAt,
        itemsQuoted: quoted,
        itemsMissing: rows.length - quoted,
        bestPriceCount: bestPriceCount.get(bid.supplierCompanyId) ?? 0,
        coveragePct: rows.length ? percent(quoted, rows.length) : 0,
        rankByTotal: 0,
      };
    })
    // O ranking segue o que o comprador pediu para priorizar. Empate e
    // proposta sem valor caem para o fim, sempre.
    .sort((a, b) => {
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      if (priority === 'DELIVERY_SPEED') {
        const da = a.deliveryDays ?? Number.MAX_SAFE_INTEGER;
        const db = b.deliveryDays ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
      }
      if (priority === 'PAYMENT_TERM') {
        const pa = prazoEmDias(a.paymentTerms);
        const pb = prazoEmDias(b.paymentTerms);
        if (pa !== pb) return pb - pa; // quanto mais dias para pagar, melhor
      }
      return a.total - b.total;
    })
    .map((s, idx) => ({ ...s, rankByTotal: idx + 1 }));

  const potentialSavings = averageTotal > 0 ? round(averageTotal - bestScenarioTotal) : 0;

  return {
    priority,
    rows,
    suppliers,
    totals: {
      itemCount: rows.length,
      bidCount: bids.length,
      bestScenarioTotal,
      cheapestSingleSupplierTotal,
      averageTotal,
      highestTotal,
      potentialSavings: potentialSavings > 0 ? potentialSavings : 0,
      potentialSavingsPct: averageTotal > 0 && potentialSavings > 0 ? percent(potentialSavings, averageTotal) : 0,
      splitGain:
        cheapestSingleSupplierTotal !== null ? Math.max(0, round(cheapestSingleSupplierTotal - bestScenarioTotal)) : 0,
    },
  };
}

/**
 * Baseline de economia para itens adjudicados: a média das propostas válidas
 * para esses mesmos itens. Economia = baseline − valor aprovado.
 */
export async function computeBaseline(
  quotationId: string,
  awardedItems: { quotationItemId: string; quantity: number }[],
): Promise<number> {
  if (awardedItems.length === 0) return 0;

  const ids = awardedItems.map((i) => i.quotationItemId);
  const bidItems = await prisma.bidItem.findMany({
    where: {
      quotationItemId: { in: ids },
      available: true,
      unitPrice: { gt: 0 },
      bid: { quotationId, status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
    },
    select: { quotationItemId: true, unitPrice: true },
  });

  let baseline = 0;
  for (const item of awardedItems) {
    const prices = bidItems
      .filter((bi) => bi.quotationItemId === item.quotationItemId)
      .map((bi) => toNumber(bi.unitPrice));
    if (!prices.length) continue;
    baseline += average(prices) * item.quantity;
  }
  return round(baseline);
}

/** Total de uma linha da proposta, já com o desconto do fornecedor. */
export function totalDaLinha(unitPrice: Numeric, quantity: Numeric, discountPct: Numeric = 0): number {
  const bruto = toNumber(unitPrice) * toNumber(quantity);
  const desconto = Math.min(100, Math.max(0, toNumber(discountPct)));
  return round(bruto * (1 - desconto / 100));
}

/** Recalcula os totais de uma proposta a partir dos seus itens. */
export async function recalcBidTotals(bidId: string) {
  const bid = await prisma.bid.findUnique({ where: { id: bidId }, include: { items: true } });
  if (!bid) return null;

  for (const item of bid.items) {
    const total = totalDaLinha(item.unitPrice, item.quantity, item.discountPct);
    if (total !== toNumber(item.total)) {
      await prisma.bidItem.update({ where: { id: item.id }, data: { total } });
    }
  }

  const subtotal = sum(
    bid.items.filter((i) => i.available).map((i) => totalDaLinha(i.unitPrice, i.quantity, i.discountPct)),
  );
  const total = round(subtotal + toNumber(bid.freight) - toNumber(bid.discount));

  return prisma.bid.update({
    where: { id: bidId },
    data: { totalAmount: total < 0 ? 0 : total },
    include: { items: true },
  });
}
