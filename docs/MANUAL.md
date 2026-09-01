# Manual de implantação do Emptra

Passo a passo para colocar o sistema no ar — do zero à primeira cotação
aprovada com planilha baixada pelo fornecedor.

> Tempo estimado: **40 minutos** para o ambiente local, **2 a 3 horas** para
> produção com WhatsApp oficial.

---

## Sumário

1. [O que você vai precisar](#1-o-que-você-vai-precisar)
2. [Instalação local com Docker](#2-instalação-local-com-docker-o-caminho-rápido)
3. [Instalação local sem Docker](#3-instalação-local-sem-docker-desenvolvimento)
4. [Configurar o WhatsApp](#4-configurar-o-whatsapp)
5. [Importar e ligar os workflows do n8n](#5-importar-e-ligar-os-workflows-do-n8n)
6. [Teste de ponta a ponta](#6-teste-de-ponta-a-ponta)
7. [Primeiro uso: liberando acessos](#7-primeiro-uso-liberando-acessos)
8. [Colocar em produção](#8-colocar-em-produção)
9. [Trocar a logomarca e as cores](#9-trocar-a-logomarca-e-as-cores)
10. [Backup e manutenção](#10-backup-e-manutenção)
11. [Solução de problemas](#11-solução-de-problemas)

---

## 1. O que você vai precisar

| Item | Versão | Para quê |
| --- | --- | --- |
| Docker + Docker Compose | 24+ | subir tudo de uma vez |
| Node.js | 20 ou 22 | rodar sem Docker / desenvolvimento |
| PostgreSQL | 16 | banco de dados |
| Uma conta de WhatsApp Business | — | disparar as cotações |

**Para o WhatsApp você escolhe um dos dois caminhos:**

- **WhatsApp Cloud API (Meta)** — oficial, gratuito até 1.000 conversas/mês,
  exige verificação da empresa no Facebook Business. Recomendado para produção.
- **Evolution API** — open source, conecta lendo o QR Code de um número comum.
  Sobe em minutos, ideal para testar. Não é oficial: use com um número
  dedicado e ciente do risco de bloqueio.

Os dois já vêm suportados nos workflows. Você troca com uma variável.

---

## 2. Instalação local com Docker (o caminho rápido)

### 2.1 Clonar e configurar

```bash
git clone <url-do-repositorio> emptra
cd emptra
cp .env.example .env
```

### 2.2 Gerar as chaves de segurança

Nunca use os valores de exemplo. Gere os seus:

```bash
echo "JWT_SECRET=$(openssl rand -hex 48)"
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "N8N_API_KEY=$(openssl rand -hex 24)"
```

Copie cada linha para o `.env`, substituindo o valor que estava lá.
Troque também `POSTGRES_PASSWORD` e `N8N_BASIC_AUTH_PASSWORD`.

### 2.3 Subir

```bash
docker compose up -d
docker compose ps          # os quatro serviços devem estar "running"
docker compose logs -f api # acompanhe até ver "Emptra API no ar"
```

As migrações do banco rodam sozinhas no start da API.

### 2.4 Popular com dados de demonstração

```bash
docker compose exec api npx tsx prisma/seed.ts
```

O seed cria o administrador, um escritório comprador, cinco fornecedores e
sete cotações em estágios diferentes — os dashboards já abrem com gráficos.

### 2.5 Conferir

| Serviço | Endereço | Acesso |
| --- | --- | --- |
| Web | http://localhost:5173 | `admin@emptra.com.br` / `Emptra@2025` |
| API | http://localhost:3333/health | — |
| n8n | http://localhost:5678 | usuário e senha do `.env` |

**Usuários de demonstração** (senha `Emptra@2025` em todos):

| Perfil | E-mail |
| --- | --- |
| Administrador | `admin@emptra.com.br` |
| Comprador | `comprador@emptra.com.br` |
| Fornecedor | `fornecedor1@emptra.com.br` … `fornecedor5@emptra.com.br` |
| Aguardando liberação | `pendente@emptra.com.br` |

> Em produção, **apague os usuários de demonstração** e troque a senha do
> administrador antes de liberar o acesso a qualquer pessoa.

---

## 3. Instalação local sem Docker (desenvolvimento)

### 3.1 Banco

```bash
createdb emptra
# ou: docker run -d --name emptra-pg -e POSTGRES_PASSWORD=emptra \
#       -e POSTGRES_DB=emptra -p 5432:5432 postgres:16-alpine
```

### 3.2 Backend

```bash
cd backend
npm install
cp ../.env.example .env
```

Ajuste no `backend/.env`:

```ini
DATABASE_URL=postgresql://postgres:emptra@localhost:5432/emptra?schema=public
APP_URL=http://localhost:5173
N8N_BASE_URL=http://localhost:5678
```

```bash
npx prisma migrate deploy   # aplica as migrações
npm run prisma:seed         # dados de demonstração
npm run dev                 # http://localhost:3333
```

### 3.3 Frontend

Em outro terminal:

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:3333" > .env.local
npm run dev                 # http://localhost:5173
```

### 3.4 n8n

```bash
npx n8n start               # http://localhost:5678
```

---

## 4. Configurar o WhatsApp

### Opção A — WhatsApp Cloud API (oficial)

1. Acesse <https://developers.facebook.com> → **Meus aplicativos** → **Criar
   aplicativo** → tipo **Empresa**.
2. Adicione o produto **WhatsApp**.
3. Em **WhatsApp → Configuração da API**, anote:
   - **ID do número de telefone** → `WHATSAPP_PHONE_NUMBER_ID`
   - **ID da conta do WhatsApp Business** → `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - **Token de acesso** → `WHATSAPP_TOKEN`

   > O token temporário dura 24 h. Para produção, crie um **usuário do
   > sistema** em Business Settings → Usuários do sistema, dê a ele a
   > permissão do app e gere um token permanente.

4. Registre um número. O número de teste da Meta só fala com até 5 números
   cadastrados — suficiente para validar, insuficiente para operar.
5. Em **Configuração → Webhooks**, clique em **Editar** e informe:
   - **URL de callback**: `https://SEU-N8N/webhook/emptra-whatsapp-entrada`
   - **Token de verificação**: o valor de `WHATSAPP_VERIFY_TOKEN`
   - Assine os campos **`messages`**.

   > O webhook exige HTTPS público. Em desenvolvimento use
   > `ngrok http 5678` e informe a URL do ngrok.

6. No `.env`, defina `WHATSAPP_PROVIDER=cloud-api`.

**Sobre templates:** a Meta só permite iniciar conversa com uma mensagem
aprovada (template). Cadastre em **WhatsApp → Modelos de mensagem** um
template de categoria *Utility* com um parâmetro de texto, e use-o no nó
"Enviar WhatsApp" do workflow 2. Dentro da janela de 24 h após o fornecedor
responder, mensagens livres funcionam normalmente — que é o caso de todo o
diálogo de cotação.

### Opção B — Evolution API (rápido, não oficial)

```bash
docker run -d --name evolution \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=minha-chave-secreta \
  -e DATABASE_ENABLED=false \
  atendai/evolution-api:latest
```

1. Crie a instância:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: minha-chave-secreta" -H "content-type: application/json" \
  -d '{"instanceName":"emptra","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'
```

2. Abra `http://localhost:8080/instance/connect/emptra` e leia o QR Code com
   o WhatsApp do número que vai disparar as cotações.

3. Aponte o webhook da instância para o n8n:

```bash
curl -X POST http://localhost:8080/webhook/set/emptra \
  -H "apikey: minha-chave-secreta" -H "content-type: application/json" \
  -d '{"webhook":{"enabled":true,"url":"http://n8n:5678/webhook/emptra-whatsapp-entrada","events":["MESSAGES_UPSERT"]}}'
```

4. No `.env`:

```ini
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_API_KEY=minha-chave-secreta
EVOLUTION_INSTANCE=emptra
```

Depois de mexer no `.env`: `docker compose up -d --force-recreate n8n`.

---

## 5. Importar e ligar os workflows do n8n

Abra `http://localhost:5678`, entre com as credenciais do `.env`.

### 5.1 Importar

Para cada arquivo em `n8n/workflows/`:

**Workflows** → **Import from File** → selecione o `.json` → **Save**.

| Arquivo | O que faz |
| --- | --- |
| `1-whatsapp-entrada.json` | recebe a mensagem do fornecedor, normaliza e entrega à API |
| `2-whatsapp-saida.json` | envia as mensagens que a API enfileira |
| `3-disparo-cotacao.json` | gancho do disparo em lote (log e integrações extras) |
| `4-rotinas-cron.json` | de hora em hora: lembretes de prazo e fechamento de cotações vencidas |
| `5-cotacao-aprovada.json` | gancho da aprovação (ERP, financeiro, BI) |

### 5.2 Conferir as variáveis

Os workflows leem tudo de variáveis de ambiente — não há segredo dentro do
JSON. O `docker-compose.yml` já repassa:

| Variável | Valor |
| --- | --- |
| `EMPTRA_API_URL` | `http://api:3333` |
| `EMPTRA_WEBHOOK_SECRET` | mesmo `WEBHOOK_SECRET` da API |
| `EMPTRA_N8N_API_KEY` | mesmo `N8N_API_KEY` da API |
| `WHATSAPP_PROVIDER` | `cloud-api` ou `evolution` |

Se estiver rodando o n8n fora do Docker, exporte-as antes de subir.

### 5.3 Ativar

Ative os **cinco** workflows no botão *Active* do canto superior direito.

### 5.4 Testar a conexão

```bash
curl -X POST http://localhost:5678/webhook/emptra-whatsapp-entrada \
  -H 'content-type: application/json' \
  -d '{"phone":"5511988870002","body":"AJUDA"}'
```

Deve responder `{"ok":true}`. Confira em **Admin → WhatsApp** na aplicação:
a mensagem recebida e a resposta enviada aparecem lá.

---

## 6. Teste de ponta a ponta

Este é o roteiro que prova que o sistema inteiro funciona.

### 6.1 Criar a cotação (comprador)

1. Entre como `comprador@emptra.com.br`.
2. **Minhas cotações → Nova cotação**.
3. Preencha o título, o prazo e dois ou três itens.
4. Marque os fornecedores à direita.
5. **Criar e enviar no WhatsApp**.

O aviso confirma quantos fornecedores receberam. Se a automação estiver fora
do ar, a mensagem diz exatamente isso — e as falhas ficam em **Admin →
WhatsApp**.

### 6.2 Responder (fornecedor)

O fornecedor recebe no WhatsApp a lista numerada. Ele responde:

```
1 45,90
2 128,00
PRAZO 7
```

O robô devolve o espelho da proposta com os totais. Para fechar:

```
ENVIAR
```

Sem o WhatsApp configurado, simule a chegada da mensagem:

```bash
SECRET=$(grep '^WEBHOOK_SECRET=' .env | cut -d= -f2)
curl -X POST http://localhost:3333/webhooks/n8n/whatsapp/inbound \
  -H "x-emptra-key: $SECRET" -H 'content-type: application/json' \
  -d '{"phone":"5511988870002","body":"1 45,90\n2 128,00\nPRAZO 7"}'
```

A resposta traz o texto que o fornecedor veria.

### 6.3 Comparar e aprovar (comprador)

1. Abra a cotação. O **mapa comparativo** mostra a matriz item × fornecedor,
   com o melhor preço de cada linha em verde e o quanto cada concorrente
   está acima dele.
2. **Aprovar cotação**. Escolha:
   - **Fornecedor único** — tudo com um só, ou
   - **Compra dividida** — cada item com quem tem o melhor preço.
3. Confirme.

A economia é calculada contra a **média das propostas recebidas** para os
mesmos itens. Vencedores e perdedores são avisados no WhatsApp na hora.

### 6.4 Baixar a planilha (fornecedor)

Entre como o fornecedor vencedor → **Pedidos ganhos** → **Baixar XLSX**.

A planilha sai com a marca Emptra, os itens aprovados, quantidades, preços,
total, prazo, condição de pagamento e o contato do comprador.

---

## 7. Primeiro uso: liberando acessos

Ninguém entra sozinho. O fluxo é:

1. A pessoa se cadastra em `/cadastro` escolhendo **comprador** ou
   **fornecedor** e informando os dados da empresa.
2. O cadastro entra como **aguardando liberação** — o login é recusado com
   uma mensagem explicando isso.
3. O administrador vê o aviso no painel e vai em **Usuários e acessos**.
4. Ao clicar em **Liberar**, o usuário é ativado, **a empresa dele também**, e
   uma notificação é criada para ele.

O administrador também pode criar acessos direto, já liberados, em
**Usuários e acessos → Novo usuário**.

**Cadastre os fornecedores com o WhatsApp correto.** É por esse número que a
cotação chega e é por ele que o robô reconhece quem está respondendo. O
sistema aceita `(11) 98888-7777`, `11988887777` ou `5511988887777` e
normaliza tudo, inclusive tolerando a ausência do nono dígito.

---

## 8. Colocar em produção

### 8.1 Checklist de segurança

- [ ] `JWT_SECRET` e `WEBHOOK_SECRET` gerados com `openssl rand -hex`
- [ ] `POSTGRES_PASSWORD` e `N8N_BASIC_AUTH_PASSWORD` trocados
- [ ] `NODE_ENV=production`
- [ ] `APP_URL` e `API_URL` com o domínio real e **https**
- [ ] Usuários de demonstração excluídos
- [ ] Senha do administrador trocada
- [ ] Porta 5432 do Postgres **não** exposta na internet
- [ ] Backup automático do banco configurado

### 8.2 Domínios sugeridos

| Serviço | Domínio |
| --- | --- |
| Web | `app.suaempresa.com.br` |
| API | `api.suaempresa.com.br` |
| n8n | `flow.suaempresa.com.br` |

Atualize no `.env`:

```ini
APP_URL=https://app.suaempresa.com.br
API_URL=https://api.suaempresa.com.br
VITE_API_URL=https://api.suaempresa.com.br
N8N_HOST=flow.suaempresa.com.br
N8N_PROTOCOL=https
```

> `APP_URL` é usado para montar o link público da cotação que vai no
> WhatsApp e o link de download do XLSX. Se estiver errado, o fornecedor
> recebe um link quebrado.

### 8.3 HTTPS com Caddy

O jeito mais curto de ter certificado automático. Crie um `Caddyfile`:

```caddyfile
app.suaempresa.com.br {
  reverse_proxy web:80
}

api.suaempresa.com.br {
  reverse_proxy api:3333
}

flow.suaempresa.com.br {
  reverse_proxy n8n:5678
}
```

E acrescente ao `docker-compose.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
```

(adicione `caddy-data:` na seção `volumes:`)

### 8.4 Subir

```bash
docker compose build --no-cache
docker compose up -d
docker compose logs -f api
```

### 8.5 Limpar os dados de demonstração

```bash
docker compose exec api npx prisma studio   # revise antes de apagar
```

Ou direto no banco:

```sql
DELETE FROM users WHERE email LIKE '%@emptra.com.br' AND role <> 'ADMIN';
DELETE FROM companies WHERE cnpj IN ('12345678000190','11222333000144')
   OR cnpj LIKE '9876543000%';
```

---

## 9. Trocar a logomarca e as cores

### Logomarca

Os arquivos oficiais estão em `frontend/public/brand/`:

| Arquivo | Uso |
| --- | --- |
| `emptra-simbolo.svg` | duas cores, sobre fundo claro |
| `emptra-simbolo-mono.svg` | cor única, para fundo escuro e impressão |
| `emptra-assinatura-horizontal.svg` | site, documento, apresentação |
| `emptra-icone.svg` | favicon, PWA, ícone de aplicativo |

Na aplicação o símbolo é desenhado inline em
`frontend/src/components/Logo.tsx` para herdar os tokens de cor. Se receber
uma versão nova dos arquivos, substitua os SVGs em `public/brand/` e o path
dentro do `Logo.tsx` — são o mesmo desenho.

Reduções mínimas: símbolo 16px em tela, assinatura 90px. Abaixo disso, use só
o símbolo. Nunca altere a espessura do traço, incline, aplique sombra ou troque
a cor do braço médio.

> O logotipo da assinatura usa `<text>` com Newsreader. Antes de usar em
> material impresso ou enviar a terceiros, converta o texto em curvas num
> editor vetorial. O símbolo já é path puro.

### Cores e tipografia

Tudo está em `frontend/src/index.css`, no bloco `:root`. Mude a variável e a
aplicação inteira acompanha — nenhum componente usa hex solto.

| Variável | Uso |
| --- | --- |
| `--primary` | ações, destaques, melhor preço |
| `--brand-deep` | sidebar, rodapés de tabela, painel do login |
| `--background` / `--foreground` | superfície e texto |
| `--border` | as bordas destacadas de todo o layout |
| `--destructive` / `--warning` / `--success` | estados |
| `--radius` | arredondamento |

As fontes são **IBM Plex Sans** (texto, pesos 400 e 500) e **Newsreader**
(marca e títulos, peso 600), carregadas do Google Fonts na primeira linha do
arquivo. A serifada é usada **só** no logotipo, no título de página e no de
seção — nunca em rótulo, botão, título de card ou célula de tabela.

As regras completas estão em [manual-marca.md](manual-marca.md) e a
implementação em [DESIGN.md](DESIGN.md).

Números de dinheiro, quantidade e código usam a classe `.num`
(`font-variant-numeric: tabular-nums`), que alinha as colunas.

Depois de mudar: `cd frontend && npm run build`.

---

## 10. Backup e manutenção

### Backup do banco

```bash
docker compose exec -T postgres pg_dump -U emptra emptra | gzip > backup-$(date +%F).sql.gz
```

Restaurar:

```bash
gunzip -c backup-2026-01-15.sql.gz | docker compose exec -T postgres psql -U emptra emptra
```

### Backup do n8n

Os workflows versionados estão em `n8n/workflows/`. As **credenciais** ficam
criptografadas no volume `n8n-data` com a `N8N_ENCRYPTION_KEY` — guarde essa
chave junto com o backup, ou as credenciais não voltam.

```bash
docker run --rm -v emptra_n8n-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/n8n-$(date +%F).tar.gz -C /data .
```

### Cron diário sugerido

```cron
0 3 * * * cd /opt/emptra && docker compose exec -T postgres pg_dump -U emptra emptra | gzip > /backups/emptra-$(date +\%F).sql.gz
0 4 * * 0 find /backups -name 'emptra-*.sql.gz' -mtime +30 -delete
```

### Atualizar o sistema

```bash
git pull
docker compose build
docker compose up -d
# as migrações rodam sozinhas; para conferir:
docker compose exec api npx prisma migrate status
```

---

## 11. Solução de problemas

### "Configuração inválida" e a API não sobe

O `.env` está incompleto. A mensagem lista exatamente qual variável falta e
por quê. `JWT_SECRET` e `WEBHOOK_SECRET` precisam de no mínimo 16 caracteres.

### As mensagens aparecem como FAILED em Admin → WhatsApp

Nessa ordem:

1. O n8n está no ar? `curl http://localhost:5678/healthz`
2. Os workflows estão **ativos**? Webhook em workflow inativo devolve 404.
3. `N8N_BASE_URL` está certo? Dentro do Docker é `http://n8n:5678`, não
   `localhost`.
4. Abra a execução no n8n (**Executions**) e veja em qual nó parou.

### O fornecedor responde e nada acontece

- **O número bate?** O robô procura o fornecedor pelo WhatsApp cadastrado.
  Confira em **Admin → Empresas** se o número é o mesmo de onde a mensagem
  saiu.
- **A cotação está aberta?** O robô só aceita resposta em cotação com status
  *Enviada* ou *Recebendo propostas* e **dentro do prazo**. Vencida ou
  fechada, ele responde que não há cotação aberta — de propósito: gravar
  preço numa disputa encerrada seria pior que não gravar.
- **A mensagem chegou?** Veja em **Admin → WhatsApp** se há uma linha
  *INBOUND* com aquele número.

### O robô responde "Não entendi essa mensagem"

O texto não bateu com nenhum comando. Formatos aceitos para preço:
`1 45,90`, `1: 45,90`, `2 - 128,00`, `item 3 12,50`, `4) R$ 89,90`.
A lista completa está em [WHATSAPP.md](WHATSAPP.md) e em
**Admin → Configurações**.

### Webhook devolve 401

A API exige `x-emptra-key` com o `WEBHOOK_SECRET`, ou `x-emptra-signature`
com o HMAC-SHA256 do corpo. Confirme que `EMPTRA_WEBHOOK_SECRET` no n8n é
**idêntico** ao `WEBHOOK_SECRET` da API.

### Erro de CORS no navegador

`APP_URL` na API precisa ser exatamente a origem do frontend, com o mesmo
protocolo e porta. `http://localhost:5173` e `http://127.0.0.1:5173` são
origens diferentes.

### O XLSX baixa vazio ou dá erro

O download exige autenticação: o link é buscado com o token e entregue como
blob. Se você abriu a URL direto no navegador, vai receber 401 — use o botão
dentro da aplicação.

### O link do WhatsApp abre uma página quebrada

`APP_URL` está errado. Ele é a base do link `/cotacao/<token>` que vai na
mensagem. Corrija e **redispare** a cotação — os links já enviados apontam
para o endereço antigo.

### Login recusado com "aguardando liberação"

É o comportamento esperado para quem se cadastrou e ainda não foi aprovado.
Um administrador precisa liberar em **Usuários e acessos**.
