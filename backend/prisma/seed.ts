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

const SUPPLIERS = [
  { name: 'Casa Forte Materiais de Construção', trade: 'Casa Forte', city: 'São Paulo', uf: 'SP', whatsapp: '5511988870001', categories: ['Alvenaria', 'Cimento', 'Argamassa'], factor: 1.0 },
  { name: 'Hidra Distribuidora Hidráulica', trade: 'Hidra', city: 'Guarulhos', uf: 'SP', whatsapp: '5511988870002', categories: ['Hidráulica', 'Conexões', 'Louças'], factor: 1.08 },
  { name: 'Voltz Elétrica e Iluminação', trade: 'Voltz', city: 'Campinas', uf: 'SP', whatsapp: '5519988870003', categories: ['Elétrica', 'Iluminação'], factor: 0.94 },
  { name: 'Acabamentos Norte Revestimentos', trade: 'Norte Revestimentos', city: 'Belo Horizonte', uf: 'MG', whatsapp: '5531988870004', categories: ['Revestimento', 'Porcelanato', 'Acabamento'], factor: 1.12 },
  { name: 'MegaObra Suprimentos', trade: 'MegaObra', city: 'Osasco', uf: 'SP', whatsapp: '5511988870005', categories: ['Alvenaria', 'Elétrica', 'Hidráulica', 'Revestimento'], factor: 0.98 },
];

const CATALOG = [
  { description: 'Cimento CP-II 50kg', unit: 'sc', quantity: 240, base: 34.9, brandRef: 'Votoran' },
  { description: 'Argamassa AC-III 20kg', unit: 'sc', quantity: 180, base: 28.5, brandRef: 'Quartzolit' },
  { description: 'Bloco cerâmico 14x19x39', unit: 'un', quantity: 3200, base: 2.35, brandRef: null },
  { description: 'Porcelanato acetinado 90x90', unit: 'm²', quantity: 420, base: 89.9, brandRef: 'Portobello' },
  { description: 'Tubo PVC soldável 25mm 6m', unit: 'br', quantity: 150, base: 22.4, brandRef: 'Tigre' },
  { description: 'Cabo flexível 2,5mm² 100m', unit: 'rl', quantity: 40, base: 189.0, brandRef: 'Sil' },
  { description: 'Disjuntor bipolar 40A', unit: 'un', quantity: 60, base: 41.9, brandRef: 'Schneider' },
  { description: 'Luminária LED embutir 18W', unit: 'un', quantity: 120, base: 54.5, brandRef: 'Philips' },
  { description: 'Tinta acrílica premium 18L', unit: 'lt', quantity: 32, base: 349.0, brandRef: 'Suvinil' },
  { description: 'Rejunte flexível 5kg', unit: 'sc', quantity: 90, base: 31.2, brandRef: 'Quartzolit' },
];

async function main() {
  console.log('🌱  Emptra — populando o banco...\n');

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
      phone: '5511990001111',
      whatsapp: '5511990001111',
      city: 'São Paulo',
      state: 'SP',
      address: 'Rua dos Pinheiros, 1200 — Pinheiros',
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
      phone: '5511990001111',
      companyId: buyerCompany.id,
    },
  });
  console.log(`✓ comprador   ${buyer.email}`);

  const projects = await Promise.all(
    [
      { name: 'Residencial Alto da Serra', code: 'OBRA-001', address: 'Av. Serra Azul, 400 — Cotia/SP' },
      { name: 'Retrofit Edifício Marambaia', code: 'OBRA-002', address: 'R. Marambaia, 88 — São Paulo/SP' },
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
        city: s.city,
        state: s.uf,
        active: true,
        supplierProfile: {
          create: {
            categories: s.categories,
            description: `Distribuidor de materiais em ${s.city}/${s.uf}.`,
            deliveryDays: 5 + index,
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
      city: 'Santo André',
      state: 'SP',
      whatsapp: '5511988870009',
      active: false,
      supplierProfile: { create: { categories: ['Ferragens', 'Fixação'] } },
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
    { title: 'Estrutura e alvenaria — Bloco A', items: [0, 1, 2], daysAgo: 95, status: 'AWARDED' as const, project: 0 },
    { title: 'Revestimentos áreas comuns', items: [3, 9], daysAgo: 70, status: 'AWARDED' as const, project: 0 },
    { title: 'Instalações elétricas — 3º pavimento', items: [5, 6, 7], daysAgo: 45, status: 'AWARDED' as const, project: 1 },
    { title: 'Hidráulica prumadas', items: [4, 0], daysAgo: 30, status: 'AWARDED' as const, project: 1 },
    { title: 'Pintura fachada e interiores', items: [8, 9], daysAgo: 12, status: 'CLOSED' as const, project: 0 },
    { title: 'Complemento elétrico — luminárias', items: [7, 6], daysAgo: 3, status: 'RECEIVING' as const, project: 1 },
    { title: 'Reposição de cimento e argamassa', items: [0, 1], daysAgo: 1, status: 'SENT' as const, project: 0 },
  ];

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
        deliveryAddress: projects[scenario.project]?.address ?? null,
        paymentTerms: '28 dias após entrega',
        createdAt,
        sentAt: createdAt,
        closedAt: scenario.status === 'SENT' || scenario.status === 'RECEIVING' ? null : deadline,
        items: {
          create: scenario.items.map((catIndex, position) => {
            const c = CATALOG[catIndex];
            return {
              position: position + 1,
              description: c.description,
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
        const base = CATALOG[scenario.items[idx]].base;
        const variation = 1 + ((i * 7 + idx * 3) % 17) / 100 - 0.06;
        const unitPrice = round2(base * s.factor * variation);
        return {
          quotationItem: { connect: { id: item.id } },
          quantity: item.quantity,
          unitPrice,
          total: round2(unitPrice * Number(item.quantity)),
          available: true,
          brand: CATALOG[scenario.items[idx]].brandRef,
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
  const [companies, users, quotations, bids, awards] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.quotation.count(),
    prisma.bid.count(),
    prisma.award.count(),
  ]);

  console.log('\n─────────────────────────────────────────');
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
    console.error('\n✗ falha no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
