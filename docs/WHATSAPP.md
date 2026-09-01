# Protocolo de conversa no WhatsApp

Como o fornecedor cota sem sair do chat. Este documento descreve o que o
robô entende, o que ele responde e como o estado da conversa é mantido.

---

## O convite

Quando o comprador dispara a cotação, o fornecedor recebe:

```
*EMPTRA · Nova cotação COT-2026-0012*

Olá, Hidra!
*Atelier Vertical* está cotando materiais e quer o seu preço.

*Hidráulica das prumadas — Bloco B*
Prazo para resposta: *20/09/2026 às 18:00*
Entrega em: *Niterói*
Critério de decisão: *entrega mais rápida*.
Há 3 anexos da obra no link abaixo.

*Itens:*
1. Tubo PVC soldável 25mm — barra 6m — 100 br (ref: Tigre)
2. Joelho 90° PVC 25mm — 400 un
3. Registro esfera 25mm — 25 un

━━━━━━━━━━━━━━━
*Responda aqui mesmo pelo WhatsApp:*
Envie o número do item e o preço unitário, um por linha.

_Exemplo:_
1 45,90
2 128,00
...
```

A mensagem já traz a lista numerada e o link da página web, para quem
preferir preencher numa tabela. Os dois caminhos gravam na mesma proposta.

---

## Comandos

| O que digitar | O que faz |
| --- | --- |
| `1 45,90` | preço unitário do item 1 |
| `PRAZO 7` | prazo de entrega em dias |
| `PAGAMENTO 30/60` | condição de pagamento |
| `MARCA 1 Tigre` | marca oferecida no item 1 |
| `SEM 3` | item 3 indisponível |
| `FRETE 150` | valor do frete (`FRETE GRÁTIS` zera) |
| `DESCONTO 50` | desconto no total da proposta |
| `DESCONTO 1 10%` | desconto de 10% no item 1 |
| `RESUMO` | espelho da proposta com os totais |
| `ENVIAR` | fecha e envia a proposta |
| `RECUSAR` | declina a participação |
| `AJUDA` | lista os comandos |
| `COT-2026-0012` | troca para outra cotação aberta, pelo código |

### O convite já diz como o comprador vai decidir

A mensagem informa o critério — menor preço, entrega mais rápida ou melhor
prazo de pagamento — antes de o fornecedor cotar. Quem sabe que a disputa é
por prazo de entrega ajusta a proposta em vez de descobrir depois que perdeu
por dois dias.

Também vão na mensagem a cidade de entrega (para o fornecedor conferir se
compensa) e quantos anexos existem no link.

### Desconto por item

`DESCONTO 1 10%` aplica 10% no item 1. O resumo mostra o desconto na linha e
já recalcula o total:

```
1. Cimento CP-II-E-32 saco 50kg
    100 sc × R$ 38,90 (-8%) = *R$ 3.578,80*
```

Com **dois** argumentos o comando é sempre desconto de item. Se a
porcentagem for inválida — `DESCONTO 1 150%` — o robô responde que não
entendeu, em vez de interpretar como R$ 1.150 de abatimento no total.

Com **um** argumento é desconto no total: `DESCONTO 50` tira R$ 50 do valor
final da proposta.

### Formatos aceitos para preço

O parser é tolerante ao que a pessoa realmente digita:

```
1 45,90        1: 45,90       2 - 128,00
item 3 12,50   4) R$ 89,90    10 = 5,00
```

Aceita vírgula ou ponto decimal, separador de milhar (`1.234,56`), prefixo
`R$` e espaços. Uma mensagem pode trazer **vários comandos**, um por linha
ou separados por ponto e vírgula:

```
1 45,90
2 128,00
SEM 3
PRAZO 7
ENVIAR
```

Acentos e maiúsculas são irrelevantes: `RECUSAR`, `recusar` e `Recusar`
funcionam igual.

---

## O diálogo

**Fornecedor:**
```
1 45,90
2 128,00
PRAZO 7
```

**Robô:**
```
✅ Registrado: item 1, item 2, prazo de entrega.

*Resumo da sua proposta · COT-2026-0012*

1. Tubo PVC soldável 25mm — barra 6m
    100 br × R$ 45,90 = *R$ 4.590,00*
2. Joelho 90° PVC 25mm
    400 un × R$ 128,00 = *R$ 51.200,00*
3. Registro esfera 25mm
    25 un × R$ 0,00 = *R$ 0,00*

━━━━━━━━━━━━━━━
Subtotal: R$ 55.790,00
*Total: R$ 55.790,00*
Entrega: 7 dias

⚠️ Faltam os itens: *3*
Envie o preço deles ou use `SEM <número>` se não tiver.
```

Cada alteração devolve o espelho completo. O fornecedor sempre vê o que está
gravado — não precisa lembrar do que já mandou.

**Fornecedor:** `3 89,90` → **Robô:** resumo atualizado, "Tudo preenchido."

**Fornecedor:** `ENVIAR`

**Robô:**
```
✅ *Proposta enviada!*

Cotação COT-2026-0012 · Total R$ 58.037,50
Atelier Vertical já recebeu a sua proposta e vai analisar.
```

O comprador é notificado no mesmo instante.

---

## Regras do robô

**Uma cotação por vez, mas o fornecedor escolhe qual.** Por padrão o robô
responde pela cotação aberta com o prazo mais próximo de vencer. Quem tem
mais de uma disputa aberta manda o código para trocar:

```
COT-2026-0012
1 45,90
2 128,00
ENVIAR
```

O código pode vir sozinho — aí o robô confirma a troca e mostra os itens
daquela cotação — ou junto dos preços, valendo para a mensagem inteira.

Cotação fechada, cancelada ou com prazo vencido nunca é escolhida — gravar
preço numa disputa encerrada seria pior que não gravar. Se o código citado
não existir ou já tiver vencido, o robô explica isso em vez de gravar no
lugar errado.

**`ENVIAR` com item faltando não passa.** O robô devolve o resumo apontando
quais itens estão sem preço. Ou o fornecedor precifica, ou marca `SEM`.

**Dá para corrigir depois de enviar.** Enquanto o comprador não aprovar, o
fornecedor pode mandar novos preços e `ENVIAR` de novo. Depois da aprovação
a proposta trava.

**O desconto entra na comparação.** O comprador compara o preço com
desconto, não o de tabela. Quem dá 8% num item de R$ 38,90 chega a R$ 35,79
e ganha de quem cotou R$ 36,50 sem desconto.

**Quem responde pelo chat fica marcado como WhatsApp.** O comparativo do
comprador mostra a origem de cada proposta — "via WhatsApp" ou "via site".

**Número desconhecido recebe uma resposta educada.** Quem escrever sem ter
cotação aberta é informado disso, sem vazar nenhum dado.

---

## Estado da conversa

A tabela `whatsapp_sessions` guarda, por telefone, qual convite está em
andamento e em que passo. A sessão vale **72 horas** e é renovada a cada
mensagem. Se expirar, o robô resolve o convite de novo pelo telefone — a
conversa continua sem que o fornecedor perceba.

O telefone é normalizado para `55DDDNNNNNNNNN` e comparado tolerando a
ausência do nono dígito, então `(11) 98888-7777` e `551188887777` são
tratados como o mesmo número.

---

## Rastreabilidade

Toda mensagem — enviada, recebida ou falha — é gravada em
`whatsapp_messages` com direção, status, corpo e a cotação relacionada. O
administrador vê tudo em **Admin → WhatsApp**, com filtro por telefone,
direção e status. É essa trilha que responde "o fornecedor recebeu?" sem
depender da memória de ninguém.

---

## Automações agendadas

O workflow `4-rotinas-cron.json` roda de hora em hora e chama a API:

| Rotina | O que faz |
| --- | --- |
| `POST /webhooks/n8n/cron/reminders` | cobra quem não respondeu, até 24 h antes do prazo (máximo 2 lembretes por convite) |
| `POST /webhooks/n8n/cron/close-expired` | fecha cotações vencidas, marca os convites como expirados e avisa o comprador |

---

## Mudando os textos

Todas as mensagens estão em `backend/src/services/whatsapp.templates.ts`,
uma função por tipo. Os comandos ficam em
`backend/src/services/whatsapp.parser.ts` — para acrescentar um comando,
adicione um caso em `parseLine` e trate-o em `applyCommands`
(`whatsapp.bot.ts`).

Os testes do parser estão em `backend/tests/parser.test.ts`:

```bash
cd backend && npm test
```
