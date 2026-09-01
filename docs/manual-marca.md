# Emptra — manual da marca

Versão 1.0 · N&L Sistems
Destino no repositório: `docs/manual-marca.md`

---

## 1. A marca

Emptra é um sistema de compras e cotação para escritórios de arquitetura e
engenharia. O usuário registra o que precisa, o sistema dispara a cotação para
os fornecedores, compara as respostas lado a lado e conduz a decisão até a
aprovação e o pedido.

O nome vem de *emptor*, comprador em latim — a mesma raiz da expressão
jurídica *caveat emptor*. É palavra inventada a partir de raiz real: não
significa nada em português, o que deixa o campo livre para o produto preencher
o significado, mas carrega som e origem que sustentam um contexto profissional.

Pronúncia: emp-TRA. Grafia sempre "Emptra", nunca "EMPTRA" nem "emptra".

**Quem usa o produto:** arquiteto, engenheiro e o administrativo do escritório.
São profissionais que trabalham com identidade visual todos os dias e reparam
em detalhe. A marca precisa parecer cara sem parecer enfeitada.

**O que a marca precisa comunicar:** controle, precisão e rastreabilidade. Não
precisa comunicar rapidez, economia ou modernidade — esses três são o que todo
concorrente promete.

---

## 2. Símbolo

O símbolo é um "E" construído como três linhas de uma tabela de cotação. Os
braços têm comprimentos diferentes, como itens de uma lista, e o do meio é o
mais longo, ultrapassando os demais em teal: é a proposta escolhida, a linha
que segue para o pedido.

A marca conta a operação inteira do produto em quatro traços. Como é
construção puramente geométrica, sem detalhe fino, sobrevive à redução.

### Construção

Desenhado numa malha de 48 × 48. Traço de 5 unidades, extremidades e junções
arredondadas.

```
        ┌──────────────── braço superior, até x=30
        │
────────┤                 haste vertical, x=14, de y=10 a y=38
        │────────────     braço médio, até x=36,5 · TEAL
        │
        └────────────     braço inferior, até x=27
```

Não redesenhe o símbolo à mão. Use sempre os arquivos SVG fornecidos.

### Versões

| Arquivo | Uso |
|---|---|
| `emptra-simbolo.svg` | Duas cores, sobre fundo claro |
| `emptra-simbolo-mono.svg` | Cor única via `currentColor` — fundo escuro, impressão, fax, gravação |
| `emptra-assinatura-horizontal.svg` | Site, documento, apresentação, assinatura de e-mail |
| `emptra-icone.svg` | Favicon, PWA, ícone de aplicativo |

### Área de proteção

Nenhum elemento gráfico ou texto invade uma faixa equivalente à altura do
símbolo em todos os lados da assinatura.

### Reduções mínimas

- Símbolo isolado: 16 px em tela, 6 mm em impresso.
- Assinatura horizontal: 90 px em tela, 30 mm em impresso. Abaixo disso, use só
  o símbolo.

### Usos incorretos

Não altere a espessura do traço. Não incline, distorça, gire ou espelhe. Não
aplique sombra, contorno, gradiente ou brilho. Não troque a cor do braço médio
por outra que não seja o teal da marca. Não aplique a versão de duas cores
sobre fotografia ou sobre fundo teal. Não reescreva o logotipo em outra fonte.
Não coloque o símbolo dentro de círculo, losango ou qualquer outra forma que
não seja o tile de canto arredondado do ícone.

---

## 3. Cor

A base é verde-petróleo. É a família cromática que ferramenta financeira usa
porque transmite controle, e no Emptra a pessoa está aprovando gasto.

| Papel | Hex | Onde entra |
|---|---|---|
| Petróleo | `#0C2F2C` | Sidebar, cabeçalho, rodapé, fundo de documento, logotipo |
| Teal | `#12A594` | Botão primário, link, anel de foco, braço médio do símbolo |
| Teal claro | `#2BC4B0` | Mesma função do teal, quando aplicado sobre o petróleo |
| Superfície | `#E7EFED` | Cabeçalho de tabela, fundo de formulário, campo inativo |
| Fundo | `#F7FAF9` | Tela da aplicação |
| Apoio | `#6E7E7C` | Texto secundário, ícone neutro, legenda |
| Borda | `#D3DEDB` | Linha de tabela, contorno de campo, divisor |
| Texto | `#0A1614` | Todo texto principal |

Nunca use preto puro `#000` nem cinza puro (`#808080`, `#CCC`). Os neutros
daqui têm verde no pigmento; cinza neutro ao lado deles suja a tela.

### Proporção de uso

Cerca de 70% neutro claro, 20% petróleo, 10% teal. O teal é reservado. Se ele
aparecer em mais de um lugar por tela, algo está competindo por atenção.

### Estados do pedido

O teal é cor de ação. Se também virar cor de status, tudo disputa a atenção do
olho. Por isso os estados têm família própria, sempre em chip com fundo tingido
e texto escuro da mesma família — nunca texto branco sobre cor saturada, que é
o visual de sistema antigo.

| Estado | Fundo | Texto |
|---|---|---|
| Rascunho | `#E4E9E8` | `#3C4A48` |
| Em cotação | `#E4E9E8` | `#3C4A48` |
| Aguardando aprovação | `#F6EAD2` | `#7A5307` |
| Aprovado | `#D5F0EB` | `#0A5B51` |
| Recusado | `#F7E2E0` | `#8C2F27` |
| Recebido | `#D5F0EB` | `#0A5B51` |

Nenhum estado depende só de cor. Todo chip carrega o rótulo escrito, porque
parte dos engenheiros tem alguma deficiência de percepção de cor e porque a
tabela vai ser impressa em preto e branco em algum momento.

---

## 4. Tipografia

Duas famílias, papéis separados, ambas sob licença SIL Open Font License e
livres para uso comercial.

### Newsreader — marca e títulos

Serifada de leitura, desenho contemporâneo com estrutura clássica. Sustenta a
origem latina do nome sem soar antiquada. Usada no logotipo, nos títulos de
página e de seção, e em nada mais.

Peso 600, entrelinhas em `-0.005em`. Nunca em caixa alta.

### IBM Plex Sans — interface

Desenhada dentro de um contexto de engenharia, com formas racionais e numeral
tabular confiável. Usada em formulário, tabela, botão, rótulo e corpo de texto.

Pesos 400 e 500. Nunca 700, que fica pesado ao lado da serifada.

### Escala

| Papel | Família | Tamanho | Peso |
|---|---|---|---|
| Logotipo | Newsreader | conforme aplicação | 600 |
| Título de página | Newsreader | 28px | 600 |
| Título de seção | Newsreader | 20px | 600 |
| Título de card | IBM Plex Sans | 16px | 500 |
| Corpo | IBM Plex Sans | 15px | 400 |
| Tabela | IBM Plex Sans | 14px | 400 |
| Legenda e apoio | IBM Plex Sans | 13px | 400 |

### Números

Toda coluna de valor, quantidade e código recebe a classe `.num`, que ativa
`font-variant-numeric: tabular-nums`. Sem isso os algarismos têm larguras
diferentes, as colunas de preço não alinham na vertical e a comparação de
propostas — que é a tela central do produto — fica difícil de ler.

Valores em real sempre por `Intl.NumberFormat('pt-BR', { style: 'currency',
currency: 'BRL' })`. Nunca concatene "R$" manualmente.

### Vetorização do logotipo

O arquivo `emptra-assinatura-horizontal.svg` usa `<text>` com Newsreader. Na web
funciona porque a fonte é carregada, mas quebra para quem abrir o arquivo sem a
fonte instalada. Antes de usar em material impresso ou enviar a terceiros,
converta o texto em curvas num editor vetorial. O símbolo já é path puro e não
tem esse problema.

---

## 5. Layout da aplicação

```
┌────────────┬──────────────────────────────────────────────────┐
│            │  Título da página            [ Ação primária ]   │
│  Emptra    ├──────────────────────────────────────────────────┤
│            │                                                  │
│  Painel    │   Filtros: [busca] [status ▾] [período ▾]        │
│  Requisi-  │                                                  │
│   ções     │   ┌────────────────────────────────────────────┐ │
│  Cotações  │   │ Tabela                                     │ │
│  Pedidos   │   │                                            │ │
│  Fornece-  │   │                                            │ │
│   dores    │   └────────────────────────────────────────────┘ │
│  Catálogo  │                                                  │
│            │                                                  │
│  ────────  │                                                  │
│  Ajustes   │                                                  │
│  Usuário   │                                                  │
└────────────┴──────────────────────────────────────────────────┘
   240px                         resto
```

- Sidebar fixa de 240px em petróleo, recolhível para 64px. Item ativo com fundo
  `#153F3B` e barra teal de 3px na borda esquerda.
- Conteúdo com largura máxima de 1440px, centralizado, respiro lateral de 32px.
- Uma única ação primária por tela. As demais viram botão secundário ou item de
  menu.
- Sem breadcrumb. A hierarquia tem no máximo dois níveis e a sidebar resolve.
- Mobile: sidebar vira drawer, tabela vira lista de cards. Compra não se faz no
  celular, mas aprovação se faz — a tela de aprovar precisa funcionar bem no
  telefone.

### Espaçamento e forma

Escala de 4px: 4, 8, 12, 16, 24, 32, 48. Nada fora dela.
Raio: 8px em card e campo, 6px em botão, 20px em chip de status.

### Tabela

É o componente mais importante do sistema, então tem regra própria:

- Cabeçalho com fundo `#E7EFED`, texto 13px peso 500 em `#3C4A48`.
- Linhas separadas por borda de 1px `#D3DEDB`. Sem zebra striping.
- Altura de linha de 48px. Nada mais apertado — o usuário lê preço aqui.
- Coluna de valor alinhada à direita, com `.num`.
- Hover da linha em `#EEF4F3`, sem sombra.
- Estado vazio com uma frase e o botão da ação que preenche a tabela.

### Movimento

Só existe movimento que responde a uma ação da pessoa: abrir modal, expandir
linha, confirmar aprovação. De 150ms a 200ms, `ease-out`. Nada de entrada em
fade-and-slide ao carregar a página, nada de animação em hover de card.
Respeitar `prefers-reduced-motion`.

---

## 6. Voz

Português do Brasil, sentence case em tudo, inclusive botão e título de coluna.

- O botão diz o que acontece: "Enviar cotação", não "Confirmar". "Aprovar
  pedido", não "OK".
- A ação mantém o mesmo nome do início ao fim. O botão "Aprovar" gera o aviso
  "Pedido aprovado".
- Erro diz o que houve e o que fazer: "Este fornecedor já está cadastrado com
  esse CNPJ. Edite o cadastro existente." Sem "Erro:", sem pedido de desculpa.
- Tela vazia é convite: "Nenhuma cotação em aberto", com o botão "Nova
  requisição". Nunca "Nada por aqui ainda".
- Sem "por favor", sem "simplesmente", sem exclamação em mensagem de sistema,
  sem emoji.

### Vocabulário fixo

Trocar sinônimo no meio do produto desorienta o usuário. Use sempre o mesmo
termo.

| Termo | Significa |
|---|---|
| Requisição | O pedido interno de quem precisa do material |
| Cotação | O pedido de preço enviado ao fornecedor |
| Proposta | A resposta de um fornecedor a uma cotação |
| Pedido | A compra efetivada após aprovação |
| Fornecedor | A empresa que vende |
| Catálogo | Os itens cadastrados no escritório |

Não use: insumo, orçamento, compra como substantivo de tela, obra.

---

## 7. Pendências antes do lançamento

- Confirmar registro de `emptra.com.br`, `emptra.com`, `emptra.app` e
  `emptra.io`. Na checagem por DNS os quatro estavam sem apontamento, o que é
  indício forte mas não é prova.
- Busca de anterioridade no INPI, classes 9 e 42.
- Converter o logotipo em curvas para uso impresso.
