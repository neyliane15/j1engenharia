# Design system

## Princípio

Uma variável, um lugar. Todas as cores vivem em `frontend/src/index.css`.
Nenhum componente usa hex solto — trocar a marca é editar aquele arquivo.

## Cores

| Token | Valor | Uso |
| --- | --- | --- |
| `--primary` | `#12A594` | ações, destaques, melhor preço |
| `--brand-deep` | `#0C2F2C` | sidebar, rodapé de tabela, painel do login |
| `--background` | `#F7FAF9` | fundo da aplicação |
| `--foreground` | `#0A1614` | texto |
| `--card` | `#FFFFFF` | superfícies |
| `--secondary` / `--muted` | `#E7EFED` | fundos neutros, cabeçalho de tabela |
| `--muted-foreground` | `#6E7E7C` | texto secundário |
| `--border` | `#D3DEDB` | as bordas destacadas de todo o layout |
| `--destructive` | `#C0453B` | erro, exclusão |
| `--warning` | `#B4791C` | prazo apertado, pendência |
| `--success` | `#12A594` | aprovado, economia |
| `--radius` | `0.5rem` | arredondamento |

O tema escuro redefine os mesmos tokens no bloco `.dark`.

## Tipografia

- **IBM Plex Sans** — texto, rótulos, botões, tabelas
- **Newsreader** (600) — marca, `h1`, `h2` e `.brand-type`

A serifada nunca aparece em rótulo, botão ou célula de tabela. É o contraste
que dá o ar editorial sem prejudicar a leitura de dados.

Toda coluna de dinheiro, quantidade e código usa `.num`
(`font-variant-numeric: tabular-nums`) — os dígitos ficam com a mesma
largura e as colunas alinham.

## Superfícies

| Classe | Quando usar |
| --- | --- |
| `.surface` | card padrão: borda firme + sombra sutil |
| `.surface-raised` | sobreposições e elementos flutuantes |
| `.surface-accent` | KPI principal — ganha a faixa da marca no topo |

A borda destacada (`--border` em 1px sólido) é a assinatura visual do
sistema: as superfícies são delimitadas por contorno, não por sombra pesada.

## Componentes

Em `src/components/ui/`:

| Componente | Variantes |
| --- | --- |
| `Button` | `primary`, `deep`, `secondary`, `outline`, `ghost`, `destructive` × `sm`, `md`, `lg`, `icon` |
| `Badge` | `neutral`, `primary`, `success`, `warning`, `danger`, `deep`, `outline` |
| `Card` | `CardHeader`, `CardBody`, `CardFooter` |
| `Input` / `Select` / `Textarea` | com rótulo, dica e erro; `numeric` alinha à direita |
| `Table` | `TableWrap` cria a rolagem horizontal contida |
| `Modal` | trava o scroll do fundo, fecha no Esc, vira folha no celular |
| `Toast` | `success`, `error`, `warning`, `info` |
| `StatCard` | KPI com tendência (`invertTrend` para custos) |
| `StatusBadge` | traduz os status de cotação, proposta, convite e usuário |

## Gráficos

A paleta categórica sai da marca: teal profundo → teal claro, com dois
neutros quentes para as fatias menores. Definida em
`components/charts/Charts.tsx` como `SERIES_COLORS`.

| Gráfico | Uso |
| --- | --- |
| `PurchasesChart` | comprado × economizado por mês (área) |
| `RevenueChart` | faturamento do fornecedor (barras) |
| `RankingChart` | fornecedores, clientes, produtos (barras horizontais) |
| `DonutChart` | distribuição por categoria |
| `PriceHistoryChart` | variação de preço no tempo (linha) |
| `FunnelBars` | convite → proposta → aprovação |

O tooltip é sempre o mesmo componente, formatando dinheiro em pt-BR.

## Responsividade

| Faixa | Comportamento |
| --- | --- |
| `< 1024px` | sidebar vira gaveta com overlay; KPIs empilham |
| `≥ 1024px` | sidebar fixa de 264px |
| `≥ 1280px` | dashboards em 2–3 colunas |

Tabelas largas — o comparativo em especial — rolam dentro do próprio
container (`.scroll-x`). A página nunca rola na horizontal. No comparativo,
a coluna do item fica fixa à esquerda enquanto os fornecedores rolam.

## Acessibilidade

- Foco visível com anel de 2px em `--ring`, em toda a aplicação
- Rótulo associado a cada campo por `id`/`htmlFor`
- `aria-label` nos botões só de ícone
- `aria-invalid` nos campos com erro
- Status comunicados por texto e forma, não só por cor
