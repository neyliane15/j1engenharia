import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { BadRequest, NotFound } from '../lib/errors';
import { round, toNumber } from '../utils/money';
import { normalizePhone } from '../utils/phone';
import { computeBaseline } from './quotation.service';
import { callN8n } from './n8n.service';
import { sendWhatsApp } from './whatsapp.service';
import * as T from './whatsapp.templates';
import { notifyCompany } from './notification.service';

export interface AwardSelection {
  /** Aprova a proposta inteira de um fornecedor. */
  bidId: string;
  /** Se informado, aprova apenas estes itens da proposta (compra dividida). */
  quotationItemIds?: string[];
  notes?: string;
}

export interface AwardOutcome {
  quotationId: string;
  awards: {
    awardId: string;
    supplierId: string;
    supplierName: string;
    total: number;
    baseline: number;
    savings: number;
    itemCount: number;
    downloadUrl: string;
    notified: boolean;
  }[];
  totalAwarded: number;
  totalSavings: number;
}

/**
 * Aprova uma cotação. Aceita adjudicação total (um fornecedor) ou dividida
 * (itens diferentes para fornecedores diferentes). Gera a economia, avisa
 * vencedores e perdedores no WhatsApp e libera o XLSX do vencedor.
 */
export async function awardQuotation(
  quotationId: string,
  selections: AwardSelection[],
  awardedById: string,
): Promise<AwardOutcome> {
  if (!selections.length) throw BadRequest('Selecione ao menos uma proposta para aprovar');

  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { buyerCompany: true, items: true },
  });
  if (!quotation) throw NotFound('Cotação não encontrada');
  if (quotation.status === 'AWARDED') throw BadRequest('Esta cotação já foi aprovada');
  if (quotation.status === 'CANCELLED') throw BadRequest('Esta cotação está cancelada');

  const bids = await prisma.bid.findMany({
    where: { id: { in: selections.map((s) => s.bidId) }, quotationId },
    include: { items: true, supplierCompany: true, invite: true },
  });
  if (bids.length !== selections.length) throw BadRequest('Uma das propostas selecionadas não pertence a esta cotação');

  // Um item só pode ser adjudicado a um fornecedor.
  const claimed = new Set<string>();
  for (const sel of selections) {
    const bid = bids.find((b) => b.id === sel.bidId)!;
    const itemIds = sel.quotationItemIds?.length
      ? sel.quotationItemIds
      : bid.items.filter((i) => i.available && toNumber(i.unitPrice) > 0).map((i) => i.quotationItemId);
    for (const id of itemIds) {
      if (claimed.has(id)) throw BadRequest('O mesmo item foi aprovado para mais de um fornecedor');
      claimed.add(id);
    }
  }

  const outcome: AwardOutcome = { quotationId, awards: [], totalAwarded: 0, totalSavings: 0 };

  for (const sel of selections) {
    const bid = bids.find((b) => b.id === sel.bidId)!;
    const targetIds = sel.quotationItemIds?.length
      ? new Set(sel.quotationItemIds)
      : new Set(bid.items.filter((i) => i.available && toNumber(i.unitPrice) > 0).map((i) => i.quotationItemId));

    const lines = bid.items.filter((i) => targetIds.has(i.quotationItemId) && i.available && toNumber(i.unitPrice) > 0);
    if (!lines.length) throw BadRequest(`A proposta de ${bid.supplierCompany.name} não tem itens válidos para aprovar`);

    const totalAmount = round(lines.reduce((acc, l) => acc + toNumber(l.unitPrice) * toNumber(l.quantity), 0));
    const baseline = await computeBaseline(
      quotationId,
      lines.map((l) => ({ quotationItemId: l.quotationItemId, quantity: toNumber(l.quantity) })),
    );
    const savings = round(Math.max(0, baseline - totalAmount));

    const award = await prisma.award.create({
      data: {
        quotationId,
        bidId: bid.id,
        supplierCompanyId: bid.supplierCompanyId,
        awardedById,
        totalAmount,
        baselineAmount: baseline,
        savings,
        notes: sel.notes ?? null,
        items: {
          create: lines.map((l) => ({
            quotationItemId: l.quotationItemId,
            bidItemId: l.id,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: round(toNumber(l.unitPrice) * toNumber(l.quantity)),
          })),
        },
      },
    });

    await prisma.bid.update({
      where: { id: bid.id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    });

    const downloadUrl = `${env.APP_URL.replace(/\/$/, '')}/fornecedor/pedidos/${award.id}`;

    // Aviso ao vencedor
    const phone = normalizePhone(bid.invite?.phone ?? bid.supplierCompany.whatsapp ?? bid.supplierCompany.phone);
    let notified = false;
    if (phone) {
      const sent = await sendWhatsApp({
        phone,
        body: T.approvedMessage({
          quotationCode: quotation.code,
          buyerName: quotation.buyerCompany.name,
          total: totalAmount,
          itemCount: lines.length,
          downloadLink: downloadUrl,
        }),
        template: 'cotacao_aprovada',
        quotationId,
        inviteId: bid.inviteId,
      });
      notified = sent?.ok ?? false;
    }

    await notifyCompany(bid.supplierCompanyId, {
      type: 'BID_APPROVED',
      title: `Proposta aprovada · ${quotation.code}`,
      body: `${quotation.buyerCompany.name} aprovou ${lines.length} ${lines.length === 1 ? 'item' : 'itens'} da sua proposta.`,
      link: `/fornecedor/pedidos/${award.id}`,
    }).catch((err) => logger.warn({ err }, 'falha ao notificar fornecedor vencedor'));

    outcome.awards.push({
      awardId: award.id,
      supplierId: bid.supplierCompanyId,
      supplierName: bid.supplierCompany.tradeName || bid.supplierCompany.name,
      total: totalAmount,
      baseline,
      savings,
      itemCount: lines.length,
      downloadUrl,
      notified,
    });
    outcome.totalAwarded = round(outcome.totalAwarded + totalAmount);
    outcome.totalSavings = round(outcome.totalSavings + savings);
  }

  // Recusa os demais e avisa
  const winners = new Set(selections.map((s) => s.bidId));
  const losers = await prisma.bid.findMany({
    where: { quotationId, status: 'SUBMITTED', id: { notIn: [...winners] } },
    include: { supplierCompany: true, invite: true },
  });

  for (const loser of losers) {
    await prisma.bid.update({
      where: { id: loser.id },
      data: { status: 'REJECTED', reviewedAt: new Date() },
    });
    const phone = normalizePhone(loser.invite?.phone ?? loser.supplierCompany.whatsapp ?? loser.supplierCompany.phone);
    if (phone) {
      await sendWhatsApp({
        phone,
        body: T.rejectedMessage(quotation.code, quotation.buyerCompany.name),
        template: 'cotacao_nao_aprovada',
        quotationId,
        inviteId: loser.inviteId,
      });
    }
    await notifyCompany(loser.supplierCompanyId, {
      type: 'BID_REJECTED',
      title: `Cotação ${quotation.code} encerrada`,
      body: 'Desta vez a proposta não foi a escolhida.',
      link: `/fornecedor/cotacoes/${quotationId}`,
    }).catch(() => undefined);
  }

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status: 'AWARDED', awardedAt: new Date(), closedAt: quotation.closedAt ?? new Date() },
  });

  await callN8n('award', {
    event: 'quotation.awarded',
    quotation: { id: quotationId, code: quotation.code, title: quotation.title, buyer: quotation.buyerCompany.name },
    awards: outcome.awards,
    rejected: losers.map((l) => ({ supplierId: l.supplierCompanyId, supplierName: l.supplierCompany.name })),
    totals: { awarded: outcome.totalAwarded, savings: outcome.totalSavings },
  });

  return outcome;
}
