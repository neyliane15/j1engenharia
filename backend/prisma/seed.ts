/**
 * Seed do Emptra.
 *
 *  - Cria o administrador a partir das variáveis SEED_ADMIN_*
 *  - Cria um escritório comprador e cinco fornecedores de demonstração
 *  - Gera cotações em vários estágios (aberta, recebendo, aprovada) para
 *    que os dashboards já abram com dados reais
 *
 * Rodar:  npm run prisma:seed
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { CATALOGO, TOTAL_ITENS } from '../src/data/catalogo';
import { acharMunicipio } from '../src/data/regiao';

const prisma = new PrismaClient();

const ADMIN = {
  name: process.env.SEED_ADMIN_NAME ?? 'Administrador Emptra',
  email: (process.env.SEED_ADMIN_EMAIL ?? 'admin@emptra.com.br').toLowerCase(),
  password: process.env.SEED_ADMIN_PASSWORD ?? 'Emptra@2025',
};

const DEMO_PASSWORD = 'Emptra@2025';
const token = () => randomBytes(24).toString('base64url');
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Fornecedores de demonstração, todos na região de atuação do Emptra:
 * Niterói, Região dos Lagos e Rio de Janeiro. O raio de atendimento varia
 * de propósito, para o filtro por distância ter o que mostrar.
 */
const SUPPLIERS = [
  { name: 'Casa Forte Materiais de Construção', trade: 'Casa Forte', city: 'Niterói', whatsapp: '5521988870001', radius: 40, categories: ['Cimento, cal e argamassas', 'Blocos e alvenaria', 'Agregados e britas'], factor: 1.0 },
  { name: 'Hidra Distribuidora Hidráulica', trade: 'Hidra', city: 'São Gonçalo', whatsapp: '5521988870002', radius: 60, categories: ['Hidráulica — tubos e conexões', 'Louças, metais e acessórios'], factor: 1.08 },
  { name: 'Voltz Elétrica e Iluminação', trade: 'Voltz', city: 'Rio de Janeiro', whatsapp: '5521988870003', radius: 120, categories: ['Elétrica — cabos, eletrodutos e quadros', 'Iluminação', 'Automação e segurança'], factor: 0.94 },
  { name: 'Costa Azul Revestimentos', trade: 'Costa Azul', city: 'Cabo Frio', whatsapp: '5522988870004', radius: 80, categories: ['Revestimentos cerâmicos e porcelanatos', 'Pedras naturais e bancadas'], factor: 1.12 },
  { name: 'MegaObra Suprimentos', trade: 'MegaObra', city: 'Duque de Caxias', whatsapp: '5521988870005', radius: 150, categories: ['Cimento, cal e argamassas', 'Elétrica — cabos, eletrodutos e quadros', 'Hidráulica — tubos e conexões', 'Tintas e vernizes'], factor: 0.98 },
  { name: 'Lagos Construção e Acabamento', trade: 'Lagos Construção', city: 'Araruama', whatsapp: '5522988870006', radius: 50, categories: ['Blocos e alvenaria', 'Cobertura e telhados', 'Tintas e vernizes'], factor: 1.05 },
];

/** Itens usados nas cotações de demonstração — todos vindos do catálogo. */
const DEMO_ITENS = [
  { description: 'Cimento CP-II-E-32 saco 50kg', unit: 'sc', quantity: 240, base: 38.9, brandRef: 'Votoran' },
  { description: 'Argamassa colante AC-III saco 20kg', unit: 'sc', quantity: 180, base: 31.5, brandRef: 'Quartzolit' },
  { description: 'Bloco cerâmico vedação 14x19x39', unit: 'un', quantity: 3200, base: 2.55, brandRef: null },
  { description: 'Porcelanato acetinado 90x90cm', unit: 'm²', quantity: 420, base: 94.9, brandRef: 'Portobello' },
  { description: 'Tubo PVC soldável 25mm barra 6m', unit: 'br', quantity: 150, base: 24.4, brandRef: 'Tigre' },
  { description: 'Cabo flexível 2,5mm² rolo 100m', unit: 'rl', quantity: 40, base: 198.0, brandRef: 'Sil' },
  { description: 'Disjuntor bipolar DIN 40A', unit: 'un', quantity: 60, base: 44.9, brandRef: 'Schneider' },
  { description: 'Luminária LED de embutir quadrada 18W', unit: 'un', quantity: 120, base: 58.5, brandRef: 'Philips' },
  { description: 'Tinta acrílica fosca premium 18L', unit: 'lt', quantity: 32, base: 379.0, brandRef: 'Suvinil' },
  { description: 'Rejunte cimentício flexível 5kg', unit: 'sc', quantity: 90, base: 33.2, brandRef: 'Quartzolit' },
];

/** Semeia o catálogo de materiais. Idempotente: roda quantas vezes precisar. */
async function semearCatalogo() {
  for (const [ordem, categoria] of CATALOGO.entries()) {
    const cat = await prisma.category.upsert({
      where: { slug: categoria.slug },
      update: { name: categoria.name, position: ordem },
      create: { slug: categoria.slug, name: categoria.name, position: ordem },
    });

    for (const item of categoria.items) {
      await prisma.catalogItem.upsert({
        where: { categoryId_name: { categoryId: cat.id, name: item.name } },
        update: { unit: item.unit, keywords: item.keywords ?? [] },
        create: {
          categoryId: cat.id,
          name: item.name,
          unit: item.unit,
          keywords: item.keywords ?? [],
        },
      });
    }
  }
  console.log(`✓ catálogo    ${CATALOGO.length} categorias · ${TOTAL_ITENS} produtos`);
}

async function main() {
  console.log('Emptra — populando o banco...\n');

  await semearCatalogo();

  // ── Admin ───────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { status: 'ACTIVE', role: 'ADMIN' },
    create: {
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash: await bcrypt.hash(ADMIN.password, 12),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ admin       ${admin.email}`);

  // ── Comprador ───────────────────────────────────────────────
  const buyerCompany = await prisma.company.upsert({
    where: { cnpj: '12345678000190' },
    update: {},
    create: {
      type: 'BUYER',
      name: 'Atelier Vertical Arquitetura e Engenharia',
      tradeName: 'Atelier Vertical',
      cnpj: '12345678000190',
      email: 'compras@ateliervertical.com.br',
      phone: '5521990001111',
      whatsapp: '5521990001111',
      city: 'Niterói',
      state: 'RJ',
      address: 'Rua Gavião Peixoto, 200 — Icaraí',
      latitude: acharMunicipio('Niterói')!.lat,
      longitude: acharMunicipio('Niterói')!.lng,
      active: true,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'comprador@emptra.com.br' },
    update: { status: 'ACTIVE', companyId: buyerCompany.id },
    create: {
      name: 'Marina Alencar',
      email: 'comprador@emptra.com.br',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      role: 'BUYER',
      status: 'ACTIVE',
      jobTitle: 'Coordenadora de Suprimentos',
      phone: '5521990001111',
      companyId: buyerCompany.id,
    },
  });
  console.log(`✓ comprador   ${buyer.email}`);

  const projects = await Promise.all(
    [
      { name: 'Residencial Praia de Itaipu', code: 'CC-001', address: 'Estrada Francisco da Cruz Nunes, 1200 — Niterói/RJ' },
      { name: 'Retrofit Edifício Icaraí', code: 'CC-002', address: 'R. Miguel de Frias, 88 — Niterói/RJ' },
      { name: 'Pousada Peró', code: 'CC-003', address: 'Av. dos Espadartes, 450 — Cabo Frio/RJ' },
    ].map((p) =>
      prisma.project.upsert({
        where: { id: `${buyerCompany.id.slice(0, 8)}-${p.code}` },
        update: {},
        create: { ...p, companyId: buyerCompany.id },
      }).catch(() => prisma.project.create({ data: { ...p, companyId: buyerCompany.id } })),
    ),
  );

  // ── Fornecedores ────────────────────────────────────────────
  const suppliers: { company: Awaited<ReturnType<typeof prisma.company.create>>; factor: number }[] = [];

  for (const [index, s] of SUPPLIERS.entries()) {
    const cnpj = `9876543000${String(index + 10).padStart(4, '0')}`;
    const municipio = acharMunicipio(s.city)!;
    const company = await prisma.company.upsert({
      where: { cnpj },
      update: {},
      create: {
        type: 'SUPPLIER',
        name: s.name,
        tradeName: s.trade,
        cnpj,
        email: `contato@${s.trade.toLowerCase().replace(/\s+/g, '')}.com.br`,
        phone: s.whatsapp,
        whatsapp: s.whatsapp,
        city: municipio.name,
        state: municipio.state,
        latitude: municipio.lat,
        longitude: municipio.lng,
        active: true,
        supplierProfile: {
          create: {
            categories: s.categories,
            description: `Distribuidor de materiais em ${municipio.name}/${municipio.state}.`,
            deliveryDays: 5 + index,
            serviceRadiusKm: s.radius,
            paymentTerms: index % 2 === 0 ? '28 dias' : '30/60 dias',
            rating: round2(3.8 + index * 0.2),
          },
        },
      },
    });

    await prisma.user.upsert({
      where: { email: `fornecedor${index + 1}@emptra.com.br` },
      update: { status: 'ACTIVE', companyId: company.id },
      create: {
        name: `Vendedor ${s.trade}`,
        email: `fornecedor${index + 1}@emptra.com.br`,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
        role: 'SUPPLIER',
        status: 'ACTIVE',
        jobTitle: 'Representante comercial',
        phone: s.whatsapp,
        companyId: company.id,
      },
    });

    suppliers.push({ company, factor: s.factor });
  }
  console.log(`✓ fornecedores ${suppliers.length} empresas (fornecedor1..${suppliers.length}@emptra.com.br)`);

  // Um cadastro aguardando liberação, para o admin ter o que aprovar.
  const pendingCompany = await prisma.company.upsert({
    where: { cnpj: '11222333000144' },
    update: {},
    create: {
      type: 'SUPPLIER',
      name: 'Ferragens União Ltda',
      tradeName: 'Ferragens União',
      cnpj: '11222333000144',
      city: 'Maricá',
      state: 'RJ',
      latitude: acharMunicipio('Maricá')!.lat,
      longitude: acharMunicipio('Maricá')!.lng,
      whatsapp: '5521988870009',
      active: false,
      supplierProfile: {
        create: { categories: ['Ferragens, fixação e fechaduras'], serviceRadiusKm: 35 },
      },
    },
  });
  await prisma.user.upsert({
    where: { email: 'pendente@emptra.com.br' },
    update: {},
    create: {
      name: 'Rogério Bastos',
      email: 'pendente@emptra.com.br',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      role: 'SUPPLIER',
      status: 'PENDING',
      companyId: pendingCompany.id,
    },
  });
  console.log('✓ pendente    pendente@emptra.com.br (aguardando liberação)');

  // ── Cotações ────────────────────────────────────────────────
  if (await prisma.quotation.count()) {
    console.log('\n• já existem cotações — pulando a geração de demonstração.');
    await summary();
    return;
  }

  const scenarios = [
    { title: 'Estrutura e alvenaria — Bloco A', items: [0, 1, 2], daysAgo: 95, status: 'AWARDED' as const, project: 0, priority: 'PRICE' as const },
    { title: 'Revestimentos áreas comuns', items: [3, 9], daysAgo: 70, status: 'AWARDED' as const, project: 0, priority: 'PRICE' as const },
    { title: 'Instalações elétricas — 3º pavimento', items: [5, 6, 7], daysAgo: 45, status: 'AWARDED' as const, project: 1, priority: 'DELIVERY_SPEED' as const },
    { title: 'Hidráulica prumadas', items: [4, 0], daysAgo: 30, status: 'AWARDED' as const, project: 1, priority: 'PRICE' as const },
    { title: 'Pintura fachada e interiores', items: [8, 9], daysAgo: 12, status: 'CLOSED' as const, project: 0, priority: 'PAYMENT_TERM' as const },
    { title: 'Complemento elétrico — luminárias', items: [7, 6], daysAgo: 3, status: 'RECEIVING' as const, project: 1, priority: 'DELIVERY_SPEED' as const },
    { title: 'Reposição de cimento e argamassa', items: [0, 1], daysAgo: 1, status: 'SENT' as const, project: 0, priority: 'PRICE' as const },
  ];

  // Índice nome -> id, para amarrar o item da cotação ao catálogo.
  const catalogoPorNome = new Map(
    (await prisma.catalogItem.findMany({ select: { id: true, name: true } })).map((i) => [i.name, i.id]),
  );

  let seq = 1;
  for (const scenario of scenarios) {
    const createdAt = new Date(Date.now() - scenario.daysAgo * 86_400_000);
    const deadline =
      scenario.status === 'SENT' || scenario.status === 'RECEIVING'
        ? daysFromNow(scenario.status === 'SENT' ? 5 : 2)
        : new Date(createdAt.getTime() + 5 * 86_400_000);

    const chosen = SUPPLIERS.map((_, i) => i).filter((i) => i % 5 !== 4 || scenario.items.length > 2).slice(0, 4);
    const inviteSuppliers = chosen.map((i) => suppliers[i]);

    const code = `COT-${new Date(createdAt).getFullYear()}-${String(seq++).padStart(4, '0')}`;

    const quotation = await prisma.quotation.create({
      data: {
        code,
        title: scenario.title,
        description: 'Cotação gerada automaticamente para demonstração do Emptra.',
        status: scenario.status,
        buyerCompanyId: buyerCompany.id,
        createdById: buyer.id,
        projectId: projects[scenario.project]?.id ?? null,
        deadline,
        priority: scenario.priority,
        deliveryAddress: projects[scenario.project]?.address ?? null,
        deliveryCity: scenario.project === 2 ? 'Cabo Frio' : 'Niterói',
        deliveryState: 'RJ',
        deliveryLat: acharMunicipio(scenario.project === 2 ? 'Cabo Frio' : 'Niterói')!.lat,
        deliveryLng: acharMunicipio(scenario.project === 2 ? 'Cabo Frio' : 'Niterói')!.lng,
        paymentTerms: '28 dias após entrega',
        createdAt,
        sentAt: createdAt,
        closedAt: scenario.status === 'SENT' || scenario.status === 'RECEIVING' ? null : deadline,
        items: {
          create: scenario.items.map((catIndex, position) => {
            const c = DEMO_ITENS[catIndex];
            return {
              position: position + 1,
              description: c.description,
              catalogItemId: catalogoPorNome.get(c.description) ?? null,
              unit: c.unit,
              quantity: c.quantity,
              brandRef: c.brandRef,
            };
          }),
        },
        invites: {
          create: inviteSuppliers.map((s) => ({
            supplierCompanyId: s.company.id,
            token: token(),
            phone: s.company.whatsapp,
            status: scenario.status === 'SENT' ? 'SENT' : 'RESPONDED',
            sentAt: createdAt,
            respondedAt: scenario.status === 'SENT' ? null : new Date(createdAt.getTime() + 86_400_000),
          })),
        },
      },
      include: { items: true, invites: true },
    });

    if (scenario.status === 'SENT') continue;

    // Propostas: variação determinística em torno do preço-base.
    const bids: { id: string; supplierId: string; total: number }[] = [];

    for (const [i, s] of inviteSuppliers.entries()) {
      // No cenário "RECEIVING" nem todos responderam ainda.
      if (scenario.status === 'RECEIVING' && i >= 2) continue;

      const invite = quotation.invites.find((inv) => inv.supplierCompanyId === s.company.id)!;
      const itemsData: Prisma.BidItemCreateWithoutBidInput[] = quotation.items.map((item, idx) => {
        const base = DEMO_ITENS[scenario.items[idx]].base;
        const variation = 1 + ((i * 7 + idx * 3) % 17) / 100 - 0.06;
        const unitPrice = round2(base * s.factor * variation);
        // Um fornecedor concede desconto de linha, para o comparativo
        // mostrar como o desconto entra na conta.
        const discountPct = i === 1 && idx === 0 ? 5 : 0;
        return {
          quotationItem: { connect: { id: item.id } },
          quantity: item.quantity,
          unitPrice,
          discountPct,
          total: round2(unitPrice * Number(item.quantity) * (1 - discountPct / 100)),
          available: true,
          brand: DEMO_ITENS[scenario.items[idx]].brandRef,
          leadTimeDays: 5 + i,
        };
      });

      const subtotal = round2(itemsData.reduce((acc, it) => acc + Number(it.total ?? 0), 0));
      const freight = i === 0 ? 0 : round2(180 + i * 60);
      const total = round2(subtotal + freight);

      const bid = await prisma.bid.create({
        data: {
          quotationId: quotation.id,
          supplierCompanyId: s.company.id,
          inviteId: invite.id,
          status: 'SUBMITTED',
          source: i % 2 === 0 ? 'WHATSAPP' : 'WEB',
          deliveryDays: 5 + i,
          paymentTerms: i % 2 === 0 ? '28 dias' : '30/60 dias',
          freight,
          totalAmount: total,
          submittedAt: new Date(createdAt.getTime() + (i + 1) * 43_200_000),
          createdAt,
          items: { create: itemsData },
        },
      });

      bids.push({ id: bid.id, supplierId: s.company.id, total });
    }

    if (scenario.status !== 'AWARDED' || !bids.length) continue;

    // Adjudica ao menor total e calcula a economia contra a média.
    const winner = bids.reduce((a, b) => (a.total <= b.total ? a : b));
    const baseline = round2(bids.reduce((acc, b) => acc + b.total, 0) / bids.length);
    const winnerBid = await prisma.bid.findUniqueOrThrow({ where: { id: winner.id }, include: { items: true } });
    const awardTotal = round2(winnerBid.items.reduce((acc, it) => acc + Number(it.total), 0));

    await prisma.award.create({
      data: {
        quotationId: quotation.id,
        bidId: winner.id,
        supplierCompanyId: winner.supplierId,
        awardedById: buyer.id,
        totalAmount: awardTotal,
        baselineAmount: baseline,
        savings: round2(Math.max(0, baseline - awardTotal)),
        createdAt: new Date(createdAt.getTime() + 6 * 86_400_000),
        items: {
          create: winnerBid.items.map((it) => ({
            quotationItemId: it.quotationItemId,
            bidItemId: it.id,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.total,
          })),
        },
      },
    });

    await prisma.bid.update({ where: { id: winner.id }, data: { status: 'APPROVED', reviewedAt: new Date() } });
    await prisma.bid.updateMany({
      where: { quotationId: quotation.id, id: { not: winner.id }, status: 'SUBMITTED' },
      data: { status: 'REJECTED', reviewedAt: new Date() },
    });
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { awardedAt: new Date(createdAt.getTime() + 6 * 86_400_000) },
    });
  }

  await summary();
}

async function summary() {
  const [companies, users, quotations, bids, awards, categorias, produtos] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.quotation.count(),
    prisma.bid.count(),
    prisma.award.count(),
    prisma.category.count(),
    prisma.catalogItem.count(),
  ]);

  console.log('\n─────────────────────────────────────────');
  console.log(`catálogo ${categorias} categorias · ${produtos} produtos`);
  console.log(`empresas ${companies} · usuários ${users} · cotações ${quotations} · propostas ${bids} · pedidos ${awards}`);
  console.log('─────────────────────────────────────────');
  console.log('\nAcessos de demonstração (senha: ' + DEMO_PASSWORD + ')');
  console.log(`  admin       ${ADMIN.email}  (senha: ${ADMIN.password})`);
  console.log('  comprador   comprador@emptra.com.br');
  console.log('  fornecedor  fornecedor1@emptra.com.br … fornecedor5@emptra.com.br');
  console.log('  pendente    pendente@emptra.com.br  (bloqueado até o admin liberar)\n');
}

main()
  .catch((err) => {
    console.error('\nfalha no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
