import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BASE_URL } from '@/lib/api';

const COMMANDS = [
  ['1 45,90', 'preço unitário do item 1'],
  ['PRAZO 7', 'prazo de entrega em dias'],
  ['PAGAMENTO 30/60', 'condição de pagamento'],
  ['MARCA 1 Tigre', 'marca do item 1'],
  ['SEM 3', 'item 3 indisponível'],
  ['FRETE 150', 'valor do frete'],
  ['DESCONTO 50', 'desconto no total'],
  ['RESUMO', 'espelho da proposta'],
  ['ENVIAR', 'fecha e envia a proposta'],
  ['RECUSAR', 'declina a cotação'],
  ['AJUDA', 'lista os comandos'],
  ['COT-2026-0012', 'troca para outra cotação aberta, pelo código'],
];

const WEBHOOKS = [
  ['POST', '/webhooks/n8n/whatsapp/inbound', 'mensagem recebida do fornecedor'],
  ['POST', '/webhooks/n8n/whatsapp/status', 'atualização de entrega'],
  ['POST', '/webhooks/n8n/cron/reminders', 'lembretes de prazo'],
  ['POST', '/webhooks/n8n/cron/close-expired', 'fecha cotações vencidas'],
];

export default function AdminSettings() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Como a automação está ligada e o que o fornecedor pode digitar no WhatsApp."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Integração com o n8n" description="Endereços que o n8n chama nesta instalação" />
          <CardBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Base da API: <code className="num rounded bg-secondary px-1.5 py-0.5 text-foreground">{BASE_URL}</code>
            </p>
            <ul className="space-y-2">
              {WEBHOOKS.map(([method, path, desc]) => (
                <li key={path} className="rounded-md border border-border bg-secondary/30 p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">{method}</Badge>
                    <code className="num text-[13px] text-foreground">{path}</code>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                </li>
              ))}
            </ul>
            <p className="rounded-md border border-warning/35 bg-warning/[0.07] p-3 text-xs leading-relaxed text-foreground">
              Toda chamada precisa do cabeçalho <code className="num">x-emptra-key</code> com o valor de{' '}
              <code className="num">WEBHOOK_SECRET</code>, ou de <code className="num">x-emptra-signature</code> com o
              HMAC-SHA256 do corpo. Sem isso a API devolve 401.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Comandos do WhatsApp" description="O que o fornecedor digita no chat" />
          <CardBody>
            <ul className="divide-y divide-border">
              {COMMANDS.map(([cmd, desc]) => (
                <li key={cmd} className="flex items-baseline justify-between gap-4 py-2.5">
                  <code className="num rounded bg-secondary px-2 py-1 text-[13px] font-medium text-foreground">{cmd}</code>
                  <span className="text-right text-xs text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Fluxo automatizado" description="O caminho de uma cotação, do disparo à planilha" />
        <CardBody>
          <ol className="space-y-3">
            {[
              'O comprador cria a cotação e escolhe os fornecedores.',
              'A API gera um convite com link único e envia a mensagem pelo n8n.',
              'O fornecedor responde os preços no próprio WhatsApp — ou abre o link e preenche na web.',
              'O robô interpreta cada linha, monta a proposta e devolve o resumo para conferência.',
              'Com ENVIAR, a proposta é registrada e o comprador é notificado na hora.',
              'Vencido o prazo, o cron do n8n fecha a cotação e libera o comparativo.',
              'O comprador aprova (fornecedor único ou compra dividida) e a economia é calculada.',
              'O vencedor recebe o aviso no WhatsApp com o link da planilha XLSX dos produtos aprovados.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </>
  );
}
