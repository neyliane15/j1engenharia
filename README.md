<div align="center">

# Emptra

**Plataforma de cotação de materiais para Arquitetos e Engenheiros**

Comprador → Cotação → WhatsApp → Fornecedor → Proposta → Aprovação → XLSX

</div>

---

## O que é

Emptra é um sistema de compras B2B focado no ciclo de **cotação** entre
escritórios de arquitetura/engenharia (compradores) e fornecedores de material.
Toda a negociação acontece de forma **automatizada via WhatsApp**: o comprador
monta a cotação, o sistema dispara para os fornecedores, o fornecedor responde
os preços pelo próprio chat e o robô monta a proposta. O comprador compara,
aprova, e o fornecedor vencedor baixa a lista dos produtos em `.xlsx`.

## Módulos

| Perfil | O que faz |
| --- | --- |
| **Admin** | Libera acesso de comprador e fornecedor, gerencia empresas, usuários, vê todas as cotações, logs de WhatsApp e auditoria. Autorização total. |
| **Comprador** | Cria cotações a partir de um catálogo de 400 produtos, define o que priorizar (preço, entrega ou prazo), anexa fotos da obra, escolhe fornecedores que atendem a cidade de entrega, dispara no WhatsApp, compara item a item e aprova. |
| **Fornecedor** | Declara até onde entrega, recebe as cotações do seu raio, responde pelo WhatsApp ou pela web com desconto por item, acompanha o faturamento aprovado e baixa os produtos vencedores em XLSX. |

**Região de atuação:** Niterói, Região dos Lagos e Rio de Janeiro — 32 municípios.

## Stack

- **Backend** — Node 22, TypeScript, Express, Prisma, PostgreSQL, JWT, Zod, ExcelJS
- **Frontend** — React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, Recharts
- **Automação** — n8n (WhatsApp Cloud API ou Evolution API)
- **Infra** — Docker Compose (Postgres + n8n + API + Web)

## Começar em 3 comandos

```bash
cp .env.example .env
docker compose up -d
npm --prefix backend run prisma:seed
```

Web em `http://localhost:5173` · API em `http://localhost:3333` · n8n em `http://localhost:5678`

> Passo a passo completo de implantação: **[docs/MANUAL.md](docs/MANUAL.md)**

## Estrutura

```
emptra/
├── backend/          API REST, regras de negócio, parser de WhatsApp, XLSX
├── frontend/         SPA React com os três painéis + página pública de proposta
├── n8n/workflows/    4 workflows prontos para importar
├── docs/             Manual de implantação, protocolo de WhatsApp, API
└── docker-compose.yml
```

## Documentação

- [Manual de implantação passo a passo](docs/MANUAL.md)
- [Protocolo de conversa no WhatsApp](docs/WHATSAPP.md)
- [Referência da API](docs/API.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Manual da marca](docs/manual-marca.md)
- [Design system — o manual da marca no código](docs/DESIGN.md)
