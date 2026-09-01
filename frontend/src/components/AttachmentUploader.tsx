import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError, BASE_URL, tokenStore } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/types';

const MAXIMO = 10;

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  quotationId: string;
  /** false para o fornecedor, que vê os anexos mas não envia. */
  canEdit?: boolean;
}

/**
 * Fotos da obra e PDFs anexados à cotação.
 *
 * A imagem é reduzida e recomprimida no servidor antes de ir para o disco —
 * o banco guarda só o caminho e os metadados, então o armazenamento cresce
 * devagar mesmo com muita foto de celular.
 */
export function AttachmentUploader({ quotationId, canEdit = false }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  const { data } = useQuery({
    queryKey: ['attachments', quotationId],
    queryFn: () => api.get<{ data: Attachment[] }>(`/attachments/quotation/${quotationId}`),
  });

  const anexos = data?.data ?? [];

  const enviar = useMutation({
    mutationFn: async (files: FileList) => {
      const form = new FormData();
      Array.from(files)
        .slice(0, 5)
        .forEach((f) => form.append('files', f));

      // FormData não passa pelo cliente JSON: o Content-Type precisa vir do
      // próprio navegador, com o boundary.
      const res = await fetch(`${BASE_URL}/attachments/quotation/${quotationId}`, {
        method: 'POST',
        headers: tokenStore.access ? { authorization: `Bearer ${tokenStore.access}` } : {},
        body: form,
      });
      const texto = await res.text();
      const corpo = texto ? JSON.parse(texto) : null;
      if (!res.ok) throw new ApiError(res.status, corpo?.error?.message ?? 'Não foi possível enviar');
      return corpo as { data: Attachment[] };
    },
    onSuccess: (r) => {
      const economia = r.data.reduce((acc, a) => acc + ((a.originalSize ?? a.size) - a.size), 0);
      toast.success(
        `${r.data.length} ${r.data.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}`,
        economia > 0 ? `${tamanho(economia)} economizados na compressão.` : undefined,
      );
      void qc.invalidateQueries({ queryKey: ['attachments', quotationId] });
    },
    onError: (e) => toast.error('Não foi possível anexar', e instanceof ApiError ? e.message : undefined),
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/attachments/${id}`),
    onSuccess: () => {
      toast.success('Anexo removido');
      void qc.invalidateQueries({ queryKey: ['attachments', quotationId] });
    },
  });

  async function abrir(anexo: Attachment) {
    try {
      const res = await fetch(`${BASE_URL}/attachments/${anexo.id}`, {
        headers: tokenStore.access ? { authorization: `Bearer ${tokenStore.access}` } : {},
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('Não foi possível abrir o anexo');
    }
  }

  const cheio = anexos.length >= MAXIMO;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            if (!cheio && e.dataTransfer.files.length) enviar.mutate(e.dataTransfer.files);
          }}
          className={cn(
            'rounded-lg border border-dashed p-6 text-center transition-colors',
            arrastando ? 'border-primary bg-primary/[0.06]' : 'border-border bg-secondary/30',
            cheio && 'opacity-60',
          )}
        >
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-foreground">
            {cheio ? `Limite de ${MAXIMO} anexos atingido` : 'Arraste fotos da obra ou plantas em PDF'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, WebP ou PDF, até 15 MB cada. As imagens são reduzidas antes de guardar.
          </p>
          <input
            ref={input}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) enviar.mutate(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={cheio}
            loading={enviar.isPending}
            onClick={() => input.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            Escolher arquivos
          </Button>
        </div>
      )}

      {anexos.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {anexos.map((a) => {
            const imagem = a.mimeType.startsWith('image/');
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/60 text-muted-foreground">
                  {imagem ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <button
                  type="button"
                  onClick={() => abrir(a)}
                  className="min-w-0 flex-1 text-left"
                  title="Abrir anexo"
                >
                  <span className="block truncate text-sm text-foreground hover:text-primary">{a.filename}</span>
                  <span className="num mt-1 block text-xs text-muted-foreground">
                    {tamanho(a.size)}
                    {a.width && a.height ? ` · ${a.width}×${a.height}` : ''}
                  </span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remover.mutate(a.id)}
                    aria-label={`Remover ${a.filename}`}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/8 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !canEdit && <p className="text-sm text-muted-foreground">Nenhum anexo nesta cotação</p>
      )}
    </div>
  );
}
