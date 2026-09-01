# Referência da API

Base: `http://localhost:3333` (produção: `API_URL`).
Respostas em JSON. Erros seguem sempre o mesmo formato:

```json
{ "error": { "code": "NOT_FOUND", "message": "Cotação não encontrada" } }
```

Erros de validação trazem `details` com o campo e a mensagem.

## Autenticação

Envie `Authorization: Bearer <accessToken>` nas rotas privadas.
O access token dura `JWT_EXPIRES_IN` (padrão 1 dia); o refresh token dura 30
dias e é **rotacionado** a cada uso — o antigo é revogado.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/auth/login` | entrar (`email`, `password`) |
| POST | `/auth/register` | solicitar acesso — nasce `PENDING` |
| POST | `/auth/refresh` | renovar a sessão (`refreshToken`) |
| POST | `/auth/logout` | revogar o refresh token |
| GET | `/auth/me` | usuário logado e sua empresa |
| PATCH | `/auth/me` | editar o próprio perfil |
| POST | `/auth/change-password` | trocar a senha (encerra as sessões) |

Login e cadastro têm limite de 20 tentativas a cada 15 minutos em produção.

## Cotações

| Método | Rota | Perfil | Descrição |
| --- | --- | --- | --- |
| GET | `/quotations` | todos | lista filtrada pelo escopo do usuário |
| GET | `/quotations/:id` | todos | detalhe — o fornecedor só vê a própria participação |
| POST | `/quotations` | comprador | cria com itens e convidados |
| PATCH | `/quotations/:id` | comprador | edita (somente em rascunho) |
| DELETE | `/quotations/:id` | comprador | exclui (nunca se aprovada) |
| POST | `/quotations/:id/dispatch` | comprador | dispara no WhatsApp |
| POST | `/quotations/:id/suppliers` | comprador | acrescenta fornecedores e redispara |
| GET | `/quotations/:id/comparison` | comprador | mapa comparativo item × fornecedor |
| POST | `/quotations/:id/close` | comprador | encerra o prazo antes da hora |
| POST | `/quotations/:id/award` | comprador | aprova (total ou dividida) |
| POST | `/quotations/:id/cancel` | comprador | cancela |

### Criar uma cotação

```http
POST /quotations
```

```json
{
  "title": "Hidráulica das prumadas — Bloco B",
  "deadline": "2026-09-20T18:00:00.000Z",
  "projectId": null,
  "deliveryAddress": "Av. Serra Azul, 400 — Cotia/SP",
  "paymentTerms": "28 dias após entrega",
  "items": [
    { "description": "Tubo PVC soldável 25mm 6m", "unit": "br", "quantity": 100, "brandRef": "Tigre" },
    { "description": "Joelho 90 PVC 25mm", "unit": "un", "quantity": 400 }
  ],
  "supplierIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### Aprovar

```http
POST /quotations/:id/award
```

Fornecedor único:

```json
{ "selections": [{ "bidId": "uuid-da-proposta" }] }
```

Compra dividida — cada fornecedor leva os itens indicados:

```json
{
  "selections": [
    { "bidId": "uuid-a", "quotationItemIds": ["item-1", "item-2"] },
    { "bidId": "uuid-b", "quotationItemIds": ["item-3"] }
  ]
}
```

Um item não pode ser aprovado para dois fornecedores — a API recusa.

A resposta traz, por vencedor, o total, o *baseline* (média das propostas
para os mesmos itens), a economia, o link do XLSX e se o aviso de WhatsApp
saiu de fato.

## Propostas

| Método | Rota | Perfil | Descrição |
| --- | --- | --- | --- |
| GET | `/bids` | fornecedor/admin | propostas do fornecedor |
| GET | `/bids/:id` | envolvidos | detalhe |
| PUT | `/bids/quotation/:quotationId` | fornecedor | salva rascunho ou envia (`submit`) |
| POST | `/bids/quotation/:quotationId/decline` | fornecedor | recusa participar |

## Dashboards

| Método | Rota | Perfil |
| --- | --- | --- |
| GET | `/dashboard/buyer` | comprador |
| GET | `/dashboard/buyer/price-history?q=cimento` | comprador |
| GET | `/dashboard/supplier` | fornecedor |
| GET | `/dashboard/supplier/awards` | fornecedor |
| GET | `/dashboard/supplier/awards/:id` | fornecedor |

Aceitam `?from=`, `?to=` e `?months=` (padrão 12).

## Exportações (XLSX)

| Método | Rota | Quem pode |
| --- | --- | --- |
| GET | `/exports/awards/:id.xlsx` | o fornecedor vencedor e o comprador da cotação |
| GET | `/exports/quotations/:id/comparison.xlsx` | o comprador da cotação |
| GET | `/exports/supplier/revenue.xlsx` | o fornecedor logado |

Exigem `Authorization`. Devolvem o arquivo com `Content-Disposition`.

## Empresas, obras e notificações

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/companies` | comprador e fornecedor só enxergam fornecedores ativos |
| GET | `/companies/:id` | detalhe |
| GET | `/companies/:id/performance` | histórico do fornecedor com o comprador logado |
| POST/PATCH/DELETE | `/companies` | admin (o dono edita a própria) |
| GET/POST/PATCH | `/projects` | obras do comprador |
| GET | `/notifications` | notificações do usuário |
| POST | `/notifications/read` | marca como lidas |

## Administração

Todas exigem perfil `ADMIN`.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/admin/overview` | números da plataforma |
| GET | `/admin/users` | filtros: `status`, `role`, `q` |
| POST | `/admin/users` | cria acesso já liberado |
| PATCH | `/admin/users/:id` | libera, suspende, muda papel ou empresa |
| DELETE | `/admin/users/:id` | exclui |
| GET | `/admin/quotations` | todas as cotações |
| GET | `/admin/whatsapp` | trilha das mensagens |
| GET | `/admin/audit` | log de auditoria |
| GET/PUT | `/admin/settings` | configurações chave-valor |

Liberar um usuário (`status: "ACTIVE"`) ativa também a empresa dele.

## Rotas públicas (link do WhatsApp)

Sem login, autenticadas pelo token do convite. Limite de 30 requisições por
minuto.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/public/quotation/:token` | a cotação e a proposta atual |
| POST | `/public/quotation/:token/bid` | salva ou envia a proposta |
| POST | `/public/quotation/:token/decline` | recusa participar |

## Webhooks (n8n)

Exigem `x-emptra-signature: sha256=<hmac do corpo cru>` **ou**
`x-emptra-key: <WEBHOOK_SECRET>`.

| Método | Rota | Corpo |
| --- | --- | --- |
| POST | `/webhooks/n8n/whatsapp/inbound` | `{ phone, body, waId?, name? }` |
| POST | `/webhooks/n8n/whatsapp/status` | `{ messageId? \| waId?, status, error? }` |
| POST | `/webhooks/n8n/cron/reminders` | `{ hoursBefore? }` |
| POST | `/webhooks/n8n/cron/close-expired` | `{}` |
| GET | `/webhooks/health` | teste de conexão |

`inbound` devolve `{ handled, action, reply, bidId, inviteId }` — `reply` é o
texto que o robô já enviou ao fornecedor.

## Saúde

```http
GET /health
```

```json
{ "ok": true, "service": "emptra-api", "version": "1.0.0", "env": "production" }
```

## Códigos de erro

| Código | HTTP | Quando |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | corpo inválido (traz `details`) |
| `UNAUTHORIZED` | 401 | sem token, token inválido ou expirado |
| `FORBIDDEN` | 403 | perfil sem acesso, ou usuário pendente/suspenso |
| `NOT_FOUND` | 404 | registro inexistente |
| `CONFLICT` | 409 | duplicidade (e-mail, CNPJ) |
| `BAD_REQUEST` | 400 | regra de negócio violada |
| `RATE_LIMITED` | 429 | excesso de requisições |
