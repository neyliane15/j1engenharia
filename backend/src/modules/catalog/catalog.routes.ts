import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middlewares/auth';
import { MUNICIPIOS_POR_REGIAO, REGIOES } from '../../data/regiao';

export const catalogRouter = Router();

/**
 * GET /catalog/regions — municípios atendidos, agrupados por região.
 *
 * Aberto: o formulário de cadastro precisa dele antes de existir sessão.
 */
catalogRouter.get('/regions', (_req, res) => {
  res.json({
    regions: MUNICIPIOS_POR_REGIAO.map((r) => ({
      slug: r.slug,
      name: r.name,
      cities: r.municipios.map((m) => ({ name: m.name, state: m.state })),
    })),
    labels: REGIOES,
  });
});

/** GET /catalog/categories — as categorias do catálogo, com a contagem. */
catalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, slug: true, _count: { select: { items: true } } },
    });
    res.json({ data: categories });
  }),
);

/**
 * GET /catalog/items?q=&categoryId=
 * Busca do autocompletar. Procura no nome e nos sinônimos, porque o
 * comprador digita como fala na obra.
 */
catalogRouter.get(
  '/items',
  authenticate,
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        q: z.string().trim().optional(),
        categoryId: z.string().uuid().optional(),
        limit: z.coerce.number().min(1).max(100).default(25),
      })
      .parse(req.query);

    const termo = q.q ?? '';
    const where = {
      active: true,
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(termo.length >= 2
        ? { OR: [{ name: { contains: termo, mode: 'insensitive' as const } }, { keywords: { has: termo.toLowerCase() } }] }
        : {}),
    };

    const items = await prisma.catalogItem.findMany({
      where,
      orderBy: { name: 'asc' },
      // Busca mais do que o pedido para poder reordenar antes de cortar.
      take: q.limit * 4,
      select: {
        id: true,
        name: true,
        unit: true,
        keywords: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    // Quem digita "porcelanato" quer o porcelanato antes da argamassa que
    // leva "porcelanato" como sinônimo. Nome vem antes de palavra-chave, e
    // começar com o termo vem antes de contê-lo no meio.
    const alvo = termo.toLowerCase();
    const peso = (nome: string) => {
      const n = nome.toLowerCase();
      if (!alvo) return 3;
      if (n.startsWith(alvo)) return 0;
      if (n.includes(alvo)) return 1;
      return 2;
    };

    const ordenados = items
      .map((i) => ({ item: i, peso: peso(i.name) }))
      .sort((a, b) => a.peso - b.peso || a.item.name.localeCompare(b.item.name, 'pt-BR'))
      .slice(0, q.limit)
      .map((x) => x.item);

    res.json({ data: ordenados });
  }),
);
