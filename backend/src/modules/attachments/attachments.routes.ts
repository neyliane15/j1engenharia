import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors';
import { authenticate } from '../../middlewares/auth';
import { requireCompany } from '../../middlewares/rbac';
import { audit } from '../../utils/audit';
import {
  MAXIMO_ANEXOS_POR_COTACAO,
  TAMANHO_MAXIMO_ENVIO,
  TIPOS_ACEITOS,
  apagarAnexo,
  etagDoAnexo,
  guardarAnexo,
  lerAnexo,
} from '../../services/storage.service';

export const attachmentsRouter = Router();
attachmentsRouter.use(authenticate, requireCompany);

// O arquivo passa pela memória e vai comprimido para o disco — nunca fica
// num diretório temporário nem entra no banco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO_ENVIO, files: 5, fields: 5, parts: 12 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ACEITOS.includes(file.mimetype as (typeof TIPOS_ACEITOS)[number])) {
      cb(BadRequest('Só aceitamos JPEG, PNG, WebP e PDF.'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Traduz o que o multer recusa para a mensagem que o usuário precisa ler.
 * Sem isto, arquivo grande demais ou tipo errado viram 500 genérico.
 */
function receberArquivos(req: Request, res: Response, next: NextFunction) {
  upload.array('files', 5)(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError) {
      const mensagens: Record<string, string> = {
        LIMIT_FILE_SIZE: `Arquivo maior que ${Math.round(TAMANHO_MAXIMO_ENVIO / 1024 / 1024)} MB.`,
        LIMIT_FILE_COUNT: 'Envie no máximo 5 arquivos por vez.',
        LIMIT_UNEXPECTED_FILE: 'Campo de arquivo inesperado. Use "files".',
        LIMIT_PART_COUNT: 'Requisição com partes demais.',
      };
      return next(BadRequest(mensagens[err.code] ?? 'Não foi possível ler o arquivo enviado.'));
    }
    next(err);
  });
}

/** Quem pode mexer nos anexos desta cotação. */
async function autorizar(req: Parameters<typeof authenticate>[0], quotationId: string, escrita: boolean) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: {
      id: true,
      status: true,
      buyerCompanyId: true,
      invites: { select: { supplierCompanyId: true } },
    },
  });
  if (!quotation) throw NotFound('Cotação não encontrada');

  const user = req.user!;
  if (user.role === 'ADMIN') return quotation;

  const doComprador = user.role === 'BUYER' && quotation.buyerCompanyId === user.companyId;
  if (escrita) {
    // Só o comprador anexa. O fornecedor lê para entender a obra.
    if (!doComprador) throw Forbidden('Só o comprador da cotação pode anexar arquivos');
    return quotation;
  }

  const convidado =
    user.role === 'SUPPLIER' && quotation.invites.some((i) => i.supplierCompanyId === user.companyId);
  if (!doComprador && !convidado) throw Forbidden('Você não tem acesso a esta cotação');
  return quotation;
}

/** GET /attachments/quotation/:quotationId */
attachmentsRouter.get(
  '/quotation/:quotationId',
  asyncHandler(async (req, res) => {
    const { quotationId } = z.object({ quotationId: z.string().uuid() }).parse(req.params);
    await autorizar(req, quotationId, false);

    const data = await prisma.attachment.findMany({
      where: { quotationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        originalSize: true,
        width: true,
        height: true,
        createdAt: true,
      },
    });

    res.json({ data: data.map((a) => ({ ...a, url: `/attachments/${a.id}` })) });
  }),
);

/** POST /attachments/quotation/:quotationId — envia fotos da obra ou PDFs. */
attachmentsRouter.post(
  '/quotation/:quotationId',
  receberArquivos,
  asyncHandler(async (req, res) => {
    const { quotationId } = z.object({ quotationId: z.string().uuid() }).parse(req.params);
    const quotation = await autorizar(req, quotationId, true);
    if (['AWARDED', 'CANCELLED'].includes(quotation.status)) {
      throw BadRequest('Esta cotação já foi encerrada');
    }

    const arquivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!arquivos.length) throw BadRequest('Nenhum arquivo enviado');

    const existentes = await prisma.attachment.count({ where: { quotationId } });
    if (existentes + arquivos.length > MAXIMO_ANEXOS_POR_COTACAO) {
      throw BadRequest(
        `Cada cotação aceita até ${MAXIMO_ANEXOS_POR_COTACAO} anexos. Já existem ${existentes}.`,
      );
    }

    const criados = [];
    for (const arquivo of arquivos) {
      const guardado = await guardarAnexo(quotationId, arquivo);
      const registro = await prisma.attachment.create({
        data: { quotationId, uploadedById: req.user!.id, ...guardado },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          originalSize: true,
          width: true,
          height: true,
          createdAt: true,
        },
      });
      criados.push({ ...registro, url: `/attachments/${registro.id}` });
    }

    await audit(req, 'attachment.upload', 'Quotation', quotationId, { arquivos: criados.length });
    res.status(201).json({ data: criados });
  }),
);

/** GET /attachments/:id — serve o arquivo do disco. */
attachmentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const anexo = await prisma.attachment.findUnique({ where: { id } });
    if (!anexo) throw NotFound('Anexo não encontrado');
    await autorizar(req, anexo.quotationId, false);

    const etag = etagDoAnexo(anexo.storedName, anexo.size);
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    const stream = await lerAnexo(anexo.quotationId, anexo.storedName);
    res.setHeader('Content-Type', anexo.mimeType);
    res.setHeader('Content-Length', String(anexo.size));
    res.setHeader('Content-Disposition', `inline; filename="${anexo.filename}"`);
    res.setHeader('ETag', etag);
    // Privado: o anexo é de uma cotação, não pode ficar em cache compartilhado.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    stream.pipe(res);
  }),
);

/** DELETE /attachments/:id */
attachmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const anexo = await prisma.attachment.findUnique({ where: { id } });
    if (!anexo) throw NotFound('Anexo não encontrado');
    await autorizar(req, anexo.quotationId, true);

    await prisma.attachment.delete({ where: { id } });
    await apagarAnexo(anexo.quotationId, anexo.storedName);
    await audit(req, 'attachment.delete', 'Quotation', anexo.quotationId, { filename: anexo.filename });
    res.status(204).end();
  }),
);
