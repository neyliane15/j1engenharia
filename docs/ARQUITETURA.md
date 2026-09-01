# Arquitetura

## Visão geral

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Frontend   │  HTTPS │     API      │  SQL   │  PostgreSQL  │
│ React + Vite ├───────►│   Express    ├───────►│      16      │
└──────────────┘        └──────┬───────┘        └──────────────┘
                               │ webhooks
                               ▼
                        ┌──────────────┐        ┌──────────────┐
                        │     n8n      ├───────►│   WhatsApp   │
                        │  workflows   │◄───────┤  Cloud API   │
                        └──────────────┘        │  ou Evolution│
                                                └──────────────┘
```

A API nunca fala com o WhatsApp diretamente. Ela publica intenções
("enviar esta mensagem para este número") e o n8n resolve o provedor. Trocar
de Cloud API para Evolution é mudar uma variável de ambiente — o backend não
sabe a diferença.

## Camadas do backend

```
src/
├── config/env.ts          validação das variáveis com Zod, falha no boot
├── lib/                   prisma, logger, erros tipados
├── middlewares/           autenticação, RBAC, erros, assinatura de webhook
├── modules/               rotas por domínio (auth, admin, quotations, bids…)
├── services/              regra de negócio
│   ├── quotation.service   comparativo, baseline, recálculo de totais
│   ├── award.service       adjudicação total ou dividida, economia
│   ├── dispatch.service    disparo em lote, lembretes, fechamento
│   ├── whatsapp.bot        máquina de estado da conversa
│   ├── whatsapp.parser     interpretação das mensagens
│   ├── whatsapp.templates  todos os textos enviados
│   ├── storage.service     compressão e guarda dos anexos em disco
│   └── xlsx.service        planilhas com a marca
├── data/                  catálogo de materiais e municípios da região
└── utils/                 dinheiro, telefone, códigos, auditoria, geo
```

As rotas validam e delegam; a regra mora nos serviços. Isso é o que permite
que a **mesma proposta** seja construída pela web (`bids.routes`), pelo link
público (`public.routes`) e pelo WhatsApp (`whatsapp.bot`) sem duplicar
lógica: os três terminam em `recalcBidTotals`.

## Modelo de dados

```
Company ──┬── User
          ├── SupplierProfile   (categorias, raio de atendimento)
          └── Project

Category ── CatalogItem ┐
                        │
Quotation ──┬── QuotationItem ──┬── BidItem ── AwardItem
            ├── QuotationInvite │
            ├── Bid ────────────┘
            ├── Award
            └── Attachment      (metadados; o arquivo fica no disco)
```

Decisões que valem explicar:

- **`Award` é por fornecedor, não por cotação.** Uma cotação pode ter vários
  `Award` — é assim que a compra dividida funciona sem um modelo paralelo.
- **`AwardItem` guarda o preço no momento da aprovação.** Se o fornecedor
  alterar a proposta depois, o pedido aprovado não muda.
- **`QuotationInvite.token`** é o que autentica o link público. Opaco, 24
  bytes, único por convite.
- **`WhatsAppMessage`** registra tudo, inclusive as falhas. É a trilha que
  responde "o fornecedor recebeu?".
- **Dinheiro é `Decimal(14,2)`** no banco e convertido com `toNumber` na
  borda. Preço unitário usa 4 casas — materiais de baixo valor unitário
  (parafuso, conexão) precisam disso.
- **`BidItem.discountPct` guarda a porcentagem, não o valor.** O total da
  linha já sai com o desconto aplicado, e a comparação usa o preço
  efetivo — comparar tabela contra tabela seria comparar coisas diferentes.
- **`CatalogItem` é opcional no item da cotação.** O comprador pode escrever
  livre; o vínculo, quando existe, é o que permite o histórico de preços por
  produto.
- **`Attachment` guarda caminho e metadados, nunca bytes.** O arquivo vive em
  `UPLOAD_DIR`; a imagem é reduzida a 1600px e recomprimida em JPEG no
  upload, o que derruba uma foto de celular de ~4 MB para ~200 KB.
- **Coordenadas em `Company` e `Quotation`** vêm da cidade escolhida, a
  partir da tabela de municípios em `src/data/regiao.ts`. É o que sustenta o
  raio de atendimento sem depender de serviço externo de geocodificação.

## Como a economia é calculada

O *baseline* é a **média das propostas válidas para os mesmos itens
adjudicados**, não o maior preço nem uma tabela de referência:

```
baseline  = Σ (média dos preços ofertados no item × quantidade aprovada)
economia  = baseline − valor aprovado
```

Só entram no cálculo propostas com o item disponível e preço maior que zero.
Um fornecedor que não cotou o item não distorce a média.

No comparativo em tela há duas leituras adicionais:

- **melhor cenário** — cada item pelo menor preço ofertado
- **ganho da divisão** — quanto o melhor cenário economiza contra comprar
  tudo do fornecedor único mais barato

## Segurança

| Camada | Medida |
| --- | --- |
| Senhas | bcrypt com 12 rounds |
| Sessão | JWT curto + refresh rotacionado e revogável |
| Papéis | `requireRole` nas rotas; escopo por empresa nas consultas |
| Isolamento | o fornecedor nunca recebe os dados dos concorrentes — filtrado no backend, não no frontend |
| Webhooks | HMAC-SHA256 sobre o corpo cru, com `timingSafeEqual` |
| Rate limit | 300 req/min geral, 20/15min no login, 30/min nas rotas públicas |
| Cabeçalhos | Helmet, CORS restrito a `APP_URL` |
| Auditoria | `audit()` nas ações sensíveis, com IP e autor |
| Logs | `pino` com redação de `authorization`, `cookie` e senhas |

O ponto mais delicado é o isolamento entre concorrentes. `GET
/quotations/:id` monta uma resposta diferente para o fornecedor: só o
próprio convite, nenhum `award`, nenhuma proposta alheia. O comparativo
(`/comparison`) é bloqueado por `requireRole('BUYER')`.

## Frontend

```
src/
├── components/ui/       primitivas (Button, Card, Table, Modal, Toast…)
├── components/layout/   AppShell com sidebar responsiva, rota protegida
├── components/charts/   gráficos com a paleta da marca
├── hooks/useAuth        sessão, refresh e destino por papel
├── lib/api              cliente com refresh automático e download autenticado
├── lib/format           dinheiro, data, prazo, telefone, CNPJ
└── pages/               admin | buyer | supplier | public
```

O cliente HTTP renova o token sozinho quando recebe 401 e refaz a chamada —
uma única vez, com a renovação compartilhada entre chamadas simultâneas para
não disparar vários refresh de uma vez.

Os tokens de design ficam só em `index.css`. Nenhum componente usa hex
solto, então trocar a marca é editar um arquivo.

## Onde encaixar novas integrações

Os workflows `3-disparo-cotacao` e `5-cotacao-aprovada` existem justamente
para isso: recebem o evento completo e não fazem nada além de logar. Emitir
pedido no ERP, avisar o financeiro, alimentar um BI — tudo entra ali, sem
tocar no backend.
