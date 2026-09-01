import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { BadRequest } from '../lib/errors';

/** Só foto de obra e documento. Nada mais entra. */
export const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** Limite do que o navegador pode mandar, antes da compressão. */
export const TAMANHO_MAXIMO_ENVIO = 15 * 1024 * 1024; // 15 MB
/** Limite do que fica guardado — um PDF não comprimível maior que isso é recusado. */
export const TAMANHO_MAXIMO_GUARDADO = 8 * 1024 * 1024; // 8 MB
export const MAXIMO_ANEXOS_POR_COTACAO = 10;

/**
 * Foto de obra serve para o fornecedor entender o contexto, não para ampliar
 * detalhe. 1600px no maior lado dá zoom confortável na tela e derruba um JPEG
 * de celular de ~4 MB para algo em torno de 200 KB.
 */
const LADO_MAXIMO = 1600;
const QUALIDADE_JPEG = 72;

export interface ArquivoRecebido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ArquivoGuardado {
  storedName: string;
  filename: string;
  mimeType: string;
  size: number;
  originalSize: number;
  width: number | null;
  height: number | null;
}

function raiz(): string {
  return path.resolve(env.UPLOAD_DIR);
}

function pastaDaCotacao(quotationId: string): string {
  // O id vem do banco (uuid) e é validado nas rotas, mas nunca confie:
  // qualquer coisa fora de [a-zA-Z0-9-] iria parar fora da raiz.
  // Reescrever em silêncio esconderia o problema: um id que não é um id
  // significa chamada errada, e a pasta certa não existe.
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(quotationId)) throw BadRequest('Identificador de cotação inválido');
  return path.join(raiz(), quotationId);
}

/** Nome de exibição sem caminho, sem caractere de controle e sem exageros. */
function nomeSeguro(original: string): string {
  return (
    path
      .basename(original)
      .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '')
      .trim()
      .slice(0, 120) || 'arquivo'
  );
}

/**
 * Comprime a imagem e grava no disco. O banco só recebe o caminho e os
 * metadados — nenhum byte de arquivo entra em tabela.
 */
export async function guardarAnexo(quotationId: string, arquivo: ArquivoRecebido): Promise<ArquivoGuardado> {
  if (!TIPOS_ACEITOS.includes(arquivo.mimetype as (typeof TIPOS_ACEITOS)[number])) {
    throw BadRequest('Só aceitamos JPEG, PNG, WebP e PDF.');
  }
  if (arquivo.size > TAMANHO_MAXIMO_ENVIO) {
    throw BadRequest(`Arquivo maior que ${Math.round(TAMANHO_MAXIMO_ENVIO / 1024 / 1024)} MB.`);
  }

  const pasta = pastaDaCotacao(quotationId);
  await mkdir(pasta, { recursive: true });

  const ehPdf = arquivo.mimetype === 'application/pdf';
  let conteudo: Buffer;
  let mimeType: string;
  let extensao: string;
  let width: number | null = null;
  let height: number | null = null;

  if (ehPdf) {
    // PDF vai como veio: comprimir exigiria reescrever o documento, e o risco
    // de corromper uma planta não compensa os KB economizados.
    if (!arquivo.buffer.subarray(0, 5).toString('latin1').startsWith('%PDF-')) {
      throw BadRequest('O arquivo não é um PDF válido.');
    }
    conteudo = arquivo.buffer;
    mimeType = 'application/pdf';
    extensao = 'pdf';
  } else {
    try {
      const pipeline = sharp(arquivo.buffer, { failOn: 'error' }).rotate(); // respeita o EXIF do celular
      const meta = await pipeline.metadata();

      const saida = await pipeline
        .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
        // Reencodar em JPEG descarta EXIF, GPS e perfil de cor junto — menos
        // peso e nenhuma coordenada de obra viajando dentro da foto.
        .jpeg({ quality: QUALIDADE_JPEG, progressive: true, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      conteudo = saida.data;
      width = saida.info.width;
      height = saida.info.height;
      mimeType = 'image/jpeg';
      extensao = 'jpg';

      logger.debug(
        { de: arquivo.size, para: conteudo.length, original: `${meta.width}x${meta.height}` },
        'imagem comprimida',
      );
    } catch (err) {
      logger.warn({ err }, 'falha ao processar imagem');
      throw BadRequest('Não foi possível ler esta imagem. Envie um JPEG ou PNG válido.');
    }
  }

  if (conteudo.length > TAMANHO_MAXIMO_GUARDADO) {
    throw BadRequest(
      `Mesmo comprimido o arquivo passa de ${Math.round(TAMANHO_MAXIMO_GUARDADO / 1024 / 1024)} MB. Reduza antes de enviar.`,
    );
  }

  const storedName = `${randomUUID()}.${extensao}`;
  await writeFile(path.join(pasta, storedName), conteudo);

  return {
    storedName,
    filename: nomeSeguro(arquivo.originalname),
    mimeType,
    size: conteudo.length,
    originalSize: arquivo.size,
    width,
    height,
  };
}

/** Caminho absoluto de um anexo, já barrado contra travessia de diretório. */
export function caminhoDoAnexo(quotationId: string, storedName: string): string {
  const alvo = path.join(pastaDaCotacao(quotationId), path.basename(storedName));
  const base = raiz();
  if (!alvo.startsWith(base + path.sep)) throw BadRequest('Caminho de arquivo inválido');
  return alvo;
}

export async function lerAnexo(quotationId: string, storedName: string) {
  const caminho = caminhoDoAnexo(quotationId, storedName);
  await stat(caminho); // lança se não existir
  return createReadStream(caminho);
}

export async function apagarAnexo(quotationId: string, storedName: string) {
  try {
    await rm(caminhoDoAnexo(quotationId, storedName), { force: true });
  } catch (err) {
    logger.warn({ err, storedName }, 'falha ao apagar anexo do disco');
  }
}

/** Apaga a pasta inteira de uma cotação — usado quando ela é excluída. */
export async function apagarPastaDaCotacao(quotationId: string) {
  try {
    await rm(pastaDaCotacao(quotationId), { recursive: true, force: true });
  } catch (err) {
    logger.warn({ err, quotationId }, 'falha ao apagar pasta de anexos');
  }
}

/** ETag estável para o navegador cachear o anexo. */
export function etagDoAnexo(storedName: string, size: number): string {
  return `"${createHash('sha1').update(`${storedName}:${size}`).digest('hex')}"`;
}
