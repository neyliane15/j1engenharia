# Design system

Este documento descreve **como o manual da marca está implementado no código**.
A fonte da verdade é [`manual-marca.md`](manual-marca.md); aqui está onde cada
regra vive.

## Princípio

Uma variável, um lugar. Todas as cores estão em `frontend/src/index.css`.
Nenhum componente usa hex solto — trocar a marca é editar aquele arquivo.

## Marca

Os arquivos estão em `frontend/public/brand/`:

| Arquivo | Uso |
| --- | --- |
| `emptra-simbolo.svg` | duas cores, sobre fundo claro |
| `emptra-simbolo-mono.svg` | cor única via `currentColor` |
| `emptra-assinatura-horizontal.svg` | site, documento, apresentação |
| `emptra-icone.svg` | favicon, PWA, ícone de aplicativo |

O componente `Logo.tsx` desenha o símbolo inline para herdar os tokens de cor —
é o mesmo path dos arquivos, na malha 48×48, traço 5, extremidades
arredondadas: haste em `x=14` de `y=10` a `y=38`, braço superior até `x=30`,
médio até `x=36,5` em teal, inferior até `x=27`.

> O logotipo da assinatura usa `<text>` com Newsreader. Antes de imprimir ou
> enviar a terceiros, **converta o texto em curvas**.

Reduções mínimas: símbolo 16px, assinatura 90px. Abaixo disso, só o símbolo.

## Cor

| Token | Valor | Uso |
| --- | --- | --- |
| `--brand-deep` | `#0C2F2C` | sidebar, cabeçalho, rodapé, logotipo |
| `--primary` | `#12A594` | botão primário, link, anel de foco, braço médio |
| `--teal-claro` | `#2BC4B0` | mesma função, sobre o petróleo |
| `--secondary` | `#E7EFED` | cabeçalho de tabela, fundo de formulário |
| `--background` | `#F7FAF9` | tela da aplicação |
| `--muted-foreground` | `#6E7E7C` | texto secundário, ícone neutro |
| `--border` | `#D3DEDB` | linha de tabela, contorno de campo |
| `--foreground` | `#0A1614` | todo texto principal |

Proporção de uso: ~70% neutro claro, 20% petróleo, 10% teal. **O teal é
reservado** — se aparecer em mais de um lugar por tela, algo está competindo
por atenção. Por isso o melhor preço do comparativo, a tendência dos KPIs e o
toast de sucesso usam a família "aprovado", não o teal.

Nunca preto puro nem cinza puro: os neutros daqui têm verde no pigmento.

### Estados

Família própria, fora do teal. Fundo tingido e texto escuro da mesma família —
**nunca texto branco sobre cor saturada**.

| Estado | Token de fundo | Token de texto |
| --- | --- | --- |
| Rascunho, em cotação | `--state-neutral` `#E4E9E8` | `--state-neutral-foreground` `#3C4A48` |
| Aguardando aprovação | `--state-pending` `#F6EAD2` | `--state-pending-foreground` `#7A5307` |
| Aprovado, recebido | `--state-approved` `#D5F0EB` | `--state-approved-foreground` `#0A5B51` |
| Recusado | `--state-rejected` `#F7E2E0` | `--state-rejected-foreground` `#8C2F27` |

Nenhum estado depende só de cor: `StatusBadge` sempre escreve o rótulo, porque
parte dos engenheiros tem alguma deficiência de percepção de cor e porque a
tabela vai ser impressa em preto e branco.

## Tipografia

| Papel | Família | Tamanho | Peso |
| --- | --- | --- | --- |
| Logotipo | Newsreader | conforme aplicação | 600 |
| Título de página (`h1`) | Newsreader | 28px | 600 |
| Título de seção (`h2`, `.section-title`) | Newsreader | 20px | 600 |
| Título de card (`.card-title`) | IBM Plex Sans | 16px | 500 |
| Corpo (`body`) | IBM Plex Sans | 15px | 400 |
| Tabela | IBM Plex Sans | 14px | 400 |
| Legenda | IBM Plex Sans | 13px | 400 |

A serifada **nunca** aparece em rótulo, botão, título de card ou célula de
tabela. O IBM Plex Sans só carrega 400 e 500 — não existe `font-semibold` nem
`font-bold` no código.

Toda coluna de valor, quantidade e código usa `.num`
(`font-variant-numeric: tabular-nums`). Sem isso as colunas de preço não
alinham e a comparação de propostas fica difícil de ler.

Dinheiro sempre por `formatMoney`, que usa `Intl.NumberFormat('pt-BR', …)`.
Nunca concatene "R$" manualmente.

## Layout

- Sidebar fixa de **240px** em petróleo. Item ativo com fundo `#153F3B` e barra
  teal de 3px na borda esquerda.
- Conteúdo com largura máxima de **1440px**, centralizado, respiro de 32px.
- Uma única ação primária por tela.
- Sem breadcrumb: a hierarquia tem no máximo dois níveis.
- No celular a sidebar vira gaveta. A tela de aprovar funciona no telefone —
  aprovação se faz no celular.

### Espaçamento e forma

Escala de 4px: **4, 8, 12, 16, 24, 32, 48**. Nada fora dela.
Raio: 8px em card e campo (`rounded-lg`), 6px em botão (`rounded-md`), 20px em
chip de status (`rounded-chip`).

### Tabela

É o componente mais importante do sistema:

- Cabeçalho `--table-header` `#E7EFED`, texto 13px peso 500 em `#3C4A48`
- Linhas separadas por 1px `#D3DEDB`, **sem zebra**
- Altura de linha de 48px
- Coluna de valor à direita, com `.num`
- Hover `--row-hover` `#EEF4F3`, sem sombra
- Estado vazio com uma frase e o botão da ação que preenche a tabela

### Movimento

Só existe movimento que responde a uma ação: abrir modal, abrir menu, confirmar.
De 150ms a 200ms, `ease-out`. Nada de entrada em fade-and-slide ao carregar a
página, nada de animação em hover de card. `prefers-reduced-motion` é
respeitado num bloco global no `index.css`.

## Componentes

Em `src/components/ui/`:

| Componente | Observação |
| --- | --- |
| `Button` | `primary`, `deep`, `secondary`, `outline`, `ghost`, `destructive` |
| `Badge` | só os quatro tons de estado + `outline` |
| `StatusBadge` | traduz cotação, proposta, convite e usuário |
| `Card` | `CardHeader` usa `.card-title` (sans 16/500) |
| `Input` / `Select` / `Textarea` | rótulo, dica e erro; `numeric` alinha à direita |
| `Table` | cabeçalho, altura de 48px e hover conforme a regra acima |
| `Modal` | trava o scroll, fecha no Esc, vira folha no celular |
| `Toast` | sucesso na família "aprovado", não em teal |
| `StatCard` | KPI com tendência (`invertTrend` para custos) |

## Gráficos

Paleta em `components/charts/Charts.tsx` (`SERIES_COLORS`), derivada da marca:
teal profundo → teal claro, com dois neutros quentes para as fatias menores.
O tooltip é sempre o mesmo componente, formatando dinheiro em pt-BR.

## Voz

Português do Brasil, **sentence case em tudo** — inclusive botão e título de
coluna. O botão diz o que acontece ("Enviar cotação", não "Confirmar") e a ação
mantém o nome do início ao fim.

Sem "por favor", sem exclamação em mensagem de sistema, **sem emoji** — vale
também para as mensagens de WhatsApp, que são o produto falando.

Tela vazia é convite: "Nenhuma cotação em aberto" com o botão que preenche a
tela, nunca "Nada por aqui ainda".

### Vocabulário fixo

| Termo | Significa |
| --- | --- |
| Cotação | o pedido de preço enviado ao fornecedor |
| Proposta | a resposta de um fornecedor a uma cotação |
| Pedido | a compra efetivada após aprovação |
| Fornecedor | a empresa que vende |

Não use: insumo, orçamento, compra como substantivo de tela, **obra**. O
agrupamento por empreendimento chama-se **centro de custo**.

## Acessibilidade

- Foco visível com anel de 2px em `--ring`, em toda a aplicação
- Rótulo associado a cada campo por `id`/`htmlFor`
- `aria-label` nos botões só de ícone
- `aria-invalid` nos campos com erro
- Status comunicados por texto e forma, não só por cor
