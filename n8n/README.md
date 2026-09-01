# Workflows do n8n

Cinco workflows cobrem toda a automação de WhatsApp do Emptra.

| Arquivo | Gatilho | O que faz |
| --- | --- | --- |
| `1-whatsapp-entrada.json` | webhook `/emptra-whatsapp-entrada` | normaliza o evento do provedor, separa mensagem de status e entrega à API assinado |
| `2-whatsapp-saida.json` | webhook `/emptra-whatsapp-envio` | envia as mensagens que a API enfileira, com throttle de 1s |
| `3-disparo-cotacao.json` | webhook `/emptra-cotacao-disparo` | recebe o disparo em lote — gancho para integrações |
| `4-rotinas-cron.json` | agenda, a cada hora | lembretes de prazo e fechamento de cotações vencidas |
| `5-cotacao-aprovada.json` | webhook `/emptra-cotacao-aprovada` | recebe a aprovação — gancho para ERP, financeiro, BI |

## Importar

**Workflows → Import from File** para cada `.json`, depois **ative os cinco**.

## Variáveis de ambiente

Nenhum segredo está dentro do JSON. Os workflows leem de `$env`:

| Variável | Descrição |
| --- | --- |
| `EMPTRA_API_URL` | base da API (`http://api:3333` dentro do Docker) |
| `EMPTRA_WEBHOOK_SECRET` | igual ao `WEBHOOK_SECRET` da API — assina as chamadas |
| `EMPTRA_N8N_API_KEY` | igual ao `N8N_API_KEY` — valida quem chama o workflow 2 |
| `WHATSAPP_PROVIDER` | `cloud-api` ou `evolution` |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN` | Cloud API |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | Evolution |

O `docker-compose.yml` já repassa todas.

## Trocar de provedor

Mude `WHATSAPP_PROVIDER` e recrie o container:

```bash
docker compose up -d --force-recreate n8n
```

O nó "Preparar provedor" monta a URL, os cabeçalhos e o payload conforme a
variável. A API não sabe qual provedor está em uso.

## Testar sem WhatsApp

```bash
curl -X POST http://localhost:5678/webhook/emptra-whatsapp-entrada \
  -H 'content-type: application/json' \
  -d '{"phone":"5511988870002","body":"AJUDA"}'
```

O formato já normalizado é aceito direto — útil para testar o robô sem
provedor nenhum.

## Segurança

O workflow 1 assina cada chamada à API com HMAC-SHA256 sobre o corpo
(`x-emptra-signature`). O workflow 2 valida `x-emptra-key` antes de enviar
qualquer mensagem — sem isso, qualquer um que alcançasse o n8n poderia
disparar mensagens em nome da plataforma.

## Adicionar integrações

Os workflows 3 e 5 recebem o evento completo e só logam. Conecte novos nós
ali para emitir pedido no ERP, avisar o financeiro por e-mail, alimentar um
painel — sem tocar no backend.
