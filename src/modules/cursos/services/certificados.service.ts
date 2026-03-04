import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  CursosCertificados,
  CursosCertificadosLogAcao,
  CursosCertificadosTipos,
  CursosEstagioStatus,
  Prisma,
  Roles,
  StatusInscricao,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { generateUniqueCertificateCode } from '../utils/code-generator';
import {
  type CertificadoWithRelations,
  certificadoWithRelations,
  mapCertificado,
  mapCertificadoDashboard,
} from './certificados.mapper';
import type {
  EmitirCertificadoGlobalInput,
  ListarCertificadosGlobaisQuery,
  ListarMeCertificadosQuery,
} from '../validators/certificados.schema';

const certificadosLogger = logger.child({ module: 'CursosCertificadosService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

type EmitirCertificadoData = {
  inscricaoId: string;
  tipo: CursosCertificados;
  formato: CursosCertificadosTipos;
  modeloId?: string | null;
  cargaHoraria?: number | null;
  assinaturaUrl?: string | null;
  observacoes?: string | null;
  conteudoProgramatico?: string | null;
};

type ListCertificadosFilters = {
  inscricaoId?: string;
  tipo?: CursosCertificados;
  formato?: CursosCertificadosTipos;
};

const CERTIFICADO_MODELOS = [
  {
    id: 'advance-plus-v1',
    nome: 'Modelo Advance+ Oficial',
    ativo: true,
    versao: 1,
    default: true,
  },
] as const;

const CERTIFICADO_MODELO_DEFAULT = 'advance-plus-v1' as const;
const CERTIFICADOS_EMISSAO_TX_OPTIONS = {
  maxWait: 20_000,
  timeout: 30_000,
} as const;
const CERTIFICADO_PDF_CACHE_TTL_MS = 10 * 60 * 1000;
const CERTIFICADO_PDF_CACHE_MAX_ITEMS = 30;

const normalizeCpf = (value: string | null | undefined) => value?.replace(/\D/g, '') ?? '';

let certificadoBackgroundDataUriCache: string | null = null;
let certificadoVersoBackgroundDataUriCache: string | null = null;
const certificadoPdfCache = new Map<string, { buffer: Buffer; expiresAt: number }>();
const certificadoPdfInFlight = new Map<string, Promise<Buffer>>();

const createModeloInvalidoError = (message: string) => {
  const error = new Error(message);
  (error as any).code = 'MODELO_CERTIFICADO_INVALIDO';
  return error;
};

const loadCertificadoBackgroundDataUri = async () => {
  if (certificadoBackgroundDataUriCache) return certificadoBackgroundDataUriCache;

  const backgroundPath = path.resolve(process.cwd(), 'public', 'img', 'fundo_certificado_pag1.png');

  try {
    const png = await fs.readFile(backgroundPath);
    certificadoBackgroundDataUriCache = `data:image/png;base64,${png.toString('base64')}`;
    return certificadoBackgroundDataUriCache;
  } catch (error) {
    certificadosLogger.error(
      {
        err: error,
        backgroundPath,
      },
      'Falha ao carregar fundo oficial do certificado',
    );
    throw createModeloInvalidoError('Template oficial do certificado não encontrado');
  }
};

const loadCertificadoVersoBackgroundDataUri = async () => {
  if (certificadoVersoBackgroundDataUriCache) return certificadoVersoBackgroundDataUriCache;

  const backgroundPath = path.resolve(process.cwd(), 'public', 'img', 'verso-certificado.png');

  try {
    const png = await fs.readFile(backgroundPath);
    certificadoVersoBackgroundDataUriCache = `data:image/png;base64,${png.toString('base64')}`;
    return certificadoVersoBackgroundDataUriCache;
  } catch (error) {
    certificadosLogger.error(
      {
        err: error,
        backgroundPath,
      },
      'Falha ao carregar fundo do verso do certificado',
    );
    throw createModeloInvalidoError('Template do verso do certificado não encontrado');
  }
};

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
) => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

const ensureInscricaoBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
) => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: inscricaoId, turmaId },
    select: { id: true },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada para a turma informada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
    throw error;
  }
};

const findInscricaoForAlunoNaTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  alunoId: string,
) => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: {
      turmaId,
      alunoId,
      status: {
        notIn: [StatusInscricao.REPROVADO, StatusInscricao.CANCELADO],
      },
    },
    select: { id: true, turmaId: true, CursosTurmas: { select: { cursoId: true } } },
    orderBy: { criadoEm: 'desc' },
  });

  if (!inscricao) {
    const error = new Error('Aluno não possui inscrição ativa nesta turma');
    (error as any).code = 'ALUNO_FORA_DA_TURMA';
    throw error;
  }

  return inscricao;
};

const emitirCertificadoNoClient = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  data: EmitirCertificadoData,
  emitidoPorId?: string,
) => {
  await ensureTurmaBelongsToCurso(client, cursoId, turmaId);
  await ensureInscricaoBelongsToTurma(client, turmaId, data.inscricaoId);

  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: data.inscricaoId },
    include: {
      Usuarios: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          cpf: true,
        },
      },
      CursosTurmas: {
        select: {
          id: true,
          nome: true,
          codigo: true,
          Cursos: {
            select: {
              id: true,
              nome: true,
              codigo: true,
              estagioObrigatorio: true,
              cargaHoraria: true,
            },
          },
        },
      },
    },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
    throw error;
  }

  if (inscricao.CursosTurmas.Cursos.estagioObrigatorio) {
    const estagioConcluido = await client.cursosEstagios.findFirst({
      where: {
        inscricaoId: data.inscricaoId,
        status: CursosEstagioStatus.CONCLUIDO,
      },
      select: { id: true },
    });

    if (!estagioConcluido) {
      const error = new Error('Estágio obrigatório ainda não concluído');
      (error as any).code = 'ESTAGIO_NAO_CONCLUIDO';
      throw error;
    }
  }

  const cargaHoraria = data.cargaHoraria ?? inscricao.CursosTurmas.Cursos.cargaHoraria ?? 0;
  if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
    const error = new Error('Carga horária inválida para o certificado');
    (error as any).code = 'INVALID_CARGA_HORARIA';
    throw error;
  }

  const codigo = await generateUniqueCertificateCode(client, certificadosLogger);
  const conteudoProgramaticoNormalizado = normalizeConteudoProgramatico(data.conteudoProgramatico);
  const detalhesEmissao = [
    data.modeloId ? `modelo:${data.modeloId}` : null,
    emitidoPorId ? `emitidoPor:${emitidoPorId}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const certificado = await client.cursosCertificadosEmitidos.create({
    data: {
      inscricaoId: data.inscricaoId,
      codigo,
      tipo: data.tipo,
      formato: data.formato,
      cargaHoraria,
      assinaturaUrl: data.assinaturaUrl ?? null,
      alunoNome: inscricao.Usuarios.nomeCompleto,
      alunoCpf: inscricao.Usuarios.cpf,
      cursoNome: inscricao.CursosTurmas.Cursos.nome,
      turmaNome: inscricao.CursosTurmas.nome,
      emitidoPorId: emitidoPorId ?? null,
      observacoes: data.observacoes ?? null,
      CursosCertificadosConteudoProgramatico: conteudoProgramaticoNormalizado
        ? {
            create: {
              conteudo: conteudoProgramaticoNormalizado,
            },
          }
        : undefined,
      CursosCertificadosLogs: {
        create: {
          acao: CursosCertificadosLogAcao.EMISSAO,
          formato: data.formato,
          detalhes: detalhesEmissao || null,
        },
      },
    },
    include: certificadoWithRelations.include,
  });

  certificadosLogger.info(
    { certificadoId: certificado.id, inscricaoId: data.inscricaoId, turmaId },
    'Certificado emitido com sucesso',
  );

  const certificadoCompleto = await client.cursosCertificadosEmitidos.findUniqueOrThrow({
    where: { id: certificado.id },
    include: {
      Usuarios: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
        },
      },
      CursosTurmasInscricoes: {
        select: {
          id: true,
          codigo: true,
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
              UsuariosInformation: {
                select: {
                  inscricao: true,
                  avatarUrl: true,
                },
              },
            },
          },
          CursosTurmas: {
            select: {
              id: true,
              nome: true,
              codigo: true,
              Cursos: {
                select: {
                  id: true,
                  nome: true,
                  codigo: true,
                  cargaHoraria: true,
                },
              },
            },
          },
        },
      },
      CursosCertificadosLogs: {
        orderBy: { criadoEm: 'desc' },
      },
      CursosCertificadosConteudoProgramatico: {
        select: {
          id: true,
          conteudo: true,
          atualizadoEm: true,
        },
      },
    },
  });

  return mapCertificado(certificadoCompleto);
};

const mapSortByToOrderBy = (
  sortBy: ListarCertificadosGlobaisQuery['sortBy'],
  sortDir: ListarCertificadosGlobaisQuery['sortDir'],
): Prisma.CursosCertificadosEmitidosOrderByWithRelationInput => {
  switch (sortBy) {
    case 'alunoNome':
      return { alunoNome: sortDir };
    case 'codigo':
      return { codigo: sortDir };
    case 'status':
      return { emitidoEm: 'desc' };
    case 'emitidoEm':
    default:
      return { emitidoEm: sortDir };
  }
};

const toDateRange = (value: Date, mode: 'start' | 'end') => {
  const date = new Date(value);
  if (mode === 'start') {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

const buildCertificadoUrls = (certificadoId: string) => ({
  pdfUrl: `/api/v1/cursos/certificados/${certificadoId}/pdf`,
  previewUrl: `/api/v1/cursos/certificados/${certificadoId}/preview`,
});

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatDateOnlyPtBrLong = (value: Date) => {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ] as const;

  const day = value.getUTCDate();
  const month = months[value.getUTCMonth()] ?? months[0];
  const year = value.getUTCFullYear();
  return `${day} de ${month} de ${year}`;
};

const formatDateTimePtBr = (value: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Maceio',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(value)
    .replace(',', ' às');

const normalizeConteudoProgramatico = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.replace(/\r\n/g, '\n').trim();
  return normalized.length > 0 ? normalized : null;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)));

const richTextAllowedTags = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'span',
]);

const richTextBlockedTags = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'svg',
  'math',
];

const parseTagAttributes = (rawAttributes: string) => {
  const attributes = new Map<string, string>();
  const regex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawAttributes)) !== null) {
    const name = (match[1] ?? '').toLowerCase();
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (!name) continue;
    attributes.set(name, value);
  }

  return attributes;
};

const sanitizeRichTextHtml = (rawContent: string) => {
  const maybeEncodedHtml =
    /&lt;\s*\/?\s*[a-z][^&]*&gt;/i.test(rawContent) && !/<\s*\/?\s*[a-z]/i.test(rawContent);
  const decoded = maybeEncodedHtml ? decodeHtmlEntities(rawContent) : rawContent;

  let content = decoded;
  for (const blockedTag of richTextBlockedTags) {
    const withContent = new RegExp(
      `<\\s*${blockedTag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${blockedTag}\\s*>`,
      'gi',
    );
    const selfClosing = new RegExp(`<\\s*${blockedTag}\\b[^>]*\\/?>`, 'gi');
    content = content.replace(withContent, '').replace(selfClosing, '');
  }

  const tokens = content.split(/(<[^>]+>)/g);
  const anchorOpenStack: boolean[] = [];

  return tokens
    .map((token) => {
      if (!token.startsWith('<')) {
        return escapeHtml(token);
      }

      const tagMatch = token.match(/^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>$/i);
      if (!tagMatch) return '';

      const isClosingTag = Boolean(tagMatch[1]);
      const tagName = (tagMatch[2] ?? '').toLowerCase();
      const rawAttributes = tagMatch[3] ?? '';

      if (!richTextAllowedTags.has(tagName)) return '';

      if (tagName === 'br') {
        return isClosingTag ? '' : '<br />';
      }

      if (isClosingTag) {
        if (tagName === 'a') {
          const isValidAnchor = anchorOpenStack.pop() ?? false;
          return isValidAnchor ? '</a>' : '';
        }
        return `</${tagName}>`;
      }

      const attributes = parseTagAttributes(rawAttributes);

      if (tagName === 'a') {
        const rawHref = decodeHtmlEntities(attributes.get('href') ?? '').trim();
        const isAllowedHref = /^(https?:|mailto:)/i.test(rawHref);
        if (!isAllowedHref) {
          anchorOpenStack.push(false);
          return '';
        }

        anchorOpenStack.push(true);
        const safeHref = escapeHtml(rawHref);
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer nofollow">`;
      }

      if (tagName === 'span') {
        const classValue = (attributes.get('class') ?? '')
          .split(/\s+/)
          .map((item) => item.trim())
          .filter((item) => /^[a-zA-Z0-9_-]{1,40}$/.test(item))
          .join(' ');

        if (classValue.length > 0) {
          return `<span class="${escapeHtml(classValue)}">`;
        }
        return '<span>';
      }

      return `<${tagName}>`;
    })
    .join('');
};

const formatSafeTextToHtmlParagraphs = (safeText: string) =>
  safeText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('');

const formatPlainTextToHtml = (rawText: string) =>
  rawText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('');

const formatConteudoProgramaticoToHtml = (value: string | null) => {
  if (!value) {
    return '<p class="program-empty">Conteúdo programático não informado.</p>';
  }

  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '<p class="program-empty">Conteúdo programático não informado.</p>';
  }

  const looksLikeHtml =
    /<\s*\/?\s*[a-z][^>]*>/i.test(normalized) || /&lt;\s*\/?\s*[a-z][^&]*&gt;/i.test(normalized);

  if (!looksLikeHtml) {
    return formatPlainTextToHtml(normalized);
  }

  const sanitizedHtml = sanitizeRichTextHtml(normalized).trim();
  if (!sanitizedHtml) {
    return '<p class="program-empty">Conteúdo programático não informado.</p>';
  }

  const hasAnyTag = /<\s*\/?\s*[a-z][^>]*>/i.test(sanitizedHtml);
  if (!hasAnyTag) {
    return formatSafeTextToHtmlParagraphs(sanitizedHtml);
  }

  return sanitizedHtml;
};

const getCachedPdf = (certificadoId: string): Buffer | null => {
  const cached = certificadoPdfCache.get(certificadoId);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    certificadoPdfCache.delete(certificadoId);
    return null;
  }

  return cached.buffer;
};

const setCachedPdf = (certificadoId: string, buffer: Buffer) => {
  while (certificadoPdfCache.size >= CERTIFICADO_PDF_CACHE_MAX_ITEMS) {
    const oldestKey = certificadoPdfCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    certificadoPdfCache.delete(oldestKey);
  }

  certificadoPdfCache.set(certificadoId, {
    buffer,
    expiresAt: Date.now() + CERTIFICADO_PDF_CACHE_TTL_MS,
  });
};

const renderAdvancePlusHtml = async (certificado: CertificadoWithRelations) => {
  const backgroundDataUri = await loadCertificadoBackgroundDataUri();
  const versoBackgroundDataUri = await loadCertificadoVersoBackgroundDataUri();
  const { pdfUrl } = buildCertificadoUrls(certificado.id);
  const safePdfUrl = pdfUrl.replace(/'/g, "\\'");
  const safeCertificadoId = certificado.id.replace(/'/g, '');
  const alunoNome = escapeHtml(
    (certificado.alunoNome || certificado.CursosTurmasInscricoes.Usuarios.nomeCompleto || '')
      .trim()
      .toUpperCase(),
  );
  const cursoNome = escapeHtml(
    (
      certificado.cursoNome ||
      certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.nome ||
      'Curso não informado'
    ).trim(),
  );
  const cargaHoraria = Number(
    certificado.cargaHoraria ||
      certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.cargaHoraria ||
      0,
  );
  const cargaHorariaLabel = Number.isFinite(cargaHoraria) && cargaHoraria > 0 ? cargaHoraria : 0;
  const dataInicio = certificado.CursosTurmasInscricoes.CursosTurmas.dataInicio;
  const dataFim = certificado.CursosTurmasInscricoes.CursosTurmas.dataFim;
  const periodoLabel =
    dataInicio && dataFim
      ? `${formatDateOnlyPtBrLong(dataInicio)} a ${formatDateOnlyPtBrLong(dataFim)}.`
      : `${formatDateOnlyPtBrLong(certificado.emitidoEm)}.`;
  const codigoLabel = escapeHtml(`N° Cert. ${certificado.codigo}`);
  const emitidoEmLabel = escapeHtml(`Emitido em ${formatDateTimePtBr(certificado.emitidoEm)}`);
  const conteudoProgramatico = normalizeConteudoProgramatico(
    certificado.CursosCertificadosConteudoProgramatico?.conteudo,
  );
  const conteudoProgramaticoHtml = formatConteudoProgramaticoToHtml(conteudoProgramatico);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      @page { size: A4 landscape; margin: 0; }
      html, body {
        width: 100%;
        height: auto;
        min-height: 100%;
        margin: 0;
        padding: 0;
        background: #f3f4f6;
        font-family: "Nunito", "Helvetica Neue", Arial, sans-serif;
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
        overflow: auto;
      }
      body {
        display: block;
      }
      .preview-pages {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 0 8px;
        box-sizing: border-box;
      }
      .page-shell {
        width: min(1123px, calc(100vw - 24px));
        aspect-ratio: 297 / 210;
        height: auto;
        margin: 0 auto;
        position: relative;
        background: #ffffff;
        overflow: hidden;
        box-sizing: border-box;
        border: 1px solid #d1d5db;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
      .page-shell + .page-shell {
        margin-top: 10px;
      }
      @media screen and (max-width: 1240px) {
        .preview-pages {
          padding: 8px;
        }
      }
      .background {
        position: absolute;
        inset: 0;
        z-index: 0;
      }
      .background img {
        width: 100%;
        height: 100%;
        object-fit: fill;
        display: block;
      }
      .cert-main {
        position: absolute;
        top: 32%;
        left: 50%;
        transform: translateX(-50%);
        width: min(86%, 980px);
        z-index: 1;
        text-align: center;
        color: #252329;
      }
      .cert-title {
        margin: 0;
        font-size: clamp(12px, 1.2vw, 18px);
        line-height: 1.15;
        font-weight: 500;
        letter-spacing: 0;
      }
      .cert-name {
        margin: 8px auto 0;
        max-width: 96%;
        font-size: clamp(20px, 2.55vw, 45px);
        line-height: 1.12;
        font-weight: 800;
        color: #ef2b2d;
        text-transform: uppercase;
        letter-spacing: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
        text-align: center;
      }
      .cert-subtitle {
        margin: clamp(14px, 1.3vw, 20px) 0 0;
        font-size: clamp(12px, 1.2vw, 18px);
        line-height: 1.15;
        font-weight: 500;
        letter-spacing: 0;
      }
      .cert-subtitle.period-label {
        margin-top: clamp(3px, 0.35vw, 6px);
      }
      .cert-course {
        margin: clamp(4px, 0.55vw, 8px) auto 0;
        max-width: 92%;
        font-size: clamp(20px, 2.55vw, 35px);
        line-height: 1.12;
        font-weight: 700;
        color: #252329;
        overflow-wrap: anywhere;
      }
      .cert-workload {
        margin: clamp(10px, 1.3vw, 30px) 0 0;
        font-size: clamp(12px, 1.2vw, 18px);
        line-height: 1.15;
        font-weight: 500;
        letter-spacing: 0;
      }
      .cert-workload-value {
        font-weight: 800;
      }
      .cert-period {
        margin: clamp(4px, 0.6vw, 8px) 0 0;
        font-size: clamp(20px, 2.55vw, 30px);
        line-height: 1.12;
        font-weight: 700;
        color: #252329;
        overflow-wrap: anywhere;
        font-variant-numeric: tabular-nums;
      }
      .cert-meta {
        position: absolute;
        left: clamp(26px, 4.8vw, 72px);
        bottom: clamp(20px, 3.8vw, 60px);
        z-index: 1;
        color: #252329;
        font-size: clamp(8px, 0.7vw, 11px);
        line-height: 1.2;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .cert-org-meta {
        position: absolute;
        left: clamp(26px, 4.8vw, 72px);
        bottom: clamp(62px, 8vw, 112px);
        z-index: 1;
        color: #252329;
        font-size: clamp(8px, 0.72vw, 11px);
        line-height: 1.25;
        font-weight: 500;
      }
      .verso-main {
        position: absolute;
        top: 17%;
        left: 50%;
        transform: translateX(-50%);
        width: min(86%, 1080px);
        max-height: 72%;
        z-index: 1;
        text-align: left;
        color: #1f2937;
      }
      .cert-page-verso {
        page-break-before: always;
        break-before: page;
      }
      .verso-title {
        margin: 0;
        font-size: clamp(20px, 2.55vw, 35px);
        line-height: 1.12;
        font-weight: 700;
        color: #252329;
        overflow-wrap: anywhere;
      }
      .verso-subtitle {
        margin: 8px 0 0;
        color: #374151;
        font-size: clamp(12px, 1.2vw, 18px);
        line-height: 1.15;
        font-weight: 500;
        letter-spacing: 0;
      }
      .verso-content {
        margin-top: clamp(18px, 2vw, 30px);
        max-height: calc(100% - 68px);
        overflow: hidden;
        font-size: clamp(15px, 1.35vw, 18px);
        line-height: 1.6;
        font-weight: 500;
        color: #111827;
      }
      .verso-content p {
        margin: 0 0 14px;
      }
      .verso-content p:last-child {
        margin-bottom: 0;
      }
      .verso-content h1,
      .verso-content h2,
      .verso-content h3 {
        margin: 0 0 10px;
        line-height: 1.25;
        color: #0f172a;
      }
      .verso-content h1 {
        font-size: clamp(20px, 1.9vw, 28px);
        font-weight: 800;
      }
      .verso-content h2 {
        font-size: clamp(18px, 1.7vw, 24px);
        font-weight: 700;
      }
      .verso-content h3 {
        font-size: clamp(16px, 1.45vw, 21px);
        font-weight: 700;
      }
      .verso-content ul,
      .verso-content ol {
        margin: 0 0 14px 24px;
        padding: 0;
      }
      .verso-content li {
        margin-bottom: 6px;
      }
      .verso-content blockquote {
        margin: 0 0 14px;
        padding-left: 12px;
        border-left: 3px solid #cbd5e1;
        color: #334155;
      }
      .verso-content a {
        color: #0b3ea8;
        text-decoration: underline;
      }
      .verso-content .program-empty {
        color: #6b7280;
        font-style: italic;
      }
      #cert-actions {
        display: none;
      }
      @media screen {
        #cert-actions {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 9999;
          display: flex;
          gap: 10px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 14px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(2px);
        }
        #cert-actions .cert-action-btn {
          position: relative;
          appearance: none;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          cursor: pointer;
          background: #ffffff;
          color: #101828;
          transition: all 0.15s ease;
          padding: 0;
        }
        #cert-actions .cert-action-btn svg {
          width: 20px;
          height: 20px;
        }
        #cert-actions .cert-action-btn:hover,
        #cert-actions .cert-action-btn:focus-visible {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
          outline: none;
        }
        #cert-actions #btn-download {
          background: #001a57;
          color: #ffffff;
          border-color: #001a57;
        }
        #cert-actions .cert-action-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          background: rgba(16, 24, 40, 0.95);
          color: #ffffff;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: all 0.15s ease;
        }
        #cert-actions .cert-action-btn:hover::after,
        #cert-actions .cert-action-btn:focus-visible::after {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }
        @media (max-width: 640px) {
          #cert-actions {
            right: 12px;
            bottom: 12px;
            left: 12px;
            justify-content: flex-end;
          }
          #cert-actions .cert-action-btn::after {
            display: none;
          }
        }
      }
      @media print {
        html, body {
          width: auto !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
          background: #ffffff;
        }
        body {
          display: block;
          padding: 0;
          margin: 0;
        }
        .preview-pages {
          display: block;
          padding: 0;
          margin: 0;
          gap: 0 !important;
        }
        .page-shell {
          width: 297mm !important;
          height: 210mm !important;
          aspect-ratio: auto !important;
          max-width: none !important;
          max-height: none !important;
          margin: 0;
          border: none;
          box-shadow: none;
          page-break-inside: avoid;
          break-inside: avoid-page;
        }
        .cert-page:not(:last-child) {
          page-break-after: always;
          break-after: page;
        }
        .cert-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .cert-page-verso {
          page-break-before: always;
          break-before: page;
        }
        .cert-main {
          top: 31% !important;
          width: min(72%, 820px) !important;
          transform: translateX(-50%) scale(1.25) !important;
          transform-origin: top center !important;
        }
        .cert-title {
          font-size: 15px !important;
          line-height: 1.15 !important;
        }
        .cert-name {
          font-size: 29px !important;
          line-height: 1.12 !important;
        }
        .cert-subtitle {
          font-size: 15px !important;
          line-height: 1.15 !important;
        }
        .cert-course {
          font-size: 29px !important;
          line-height: 1.12 !important;
        }
        .cert-workload {
          font-size: 15px !important;
          line-height: 1.15 !important;
        }
        .cert-period {
          font-size: 29px !important;
          line-height: 1.12 !important;
        }
        .cert-org-meta {
          font-size: 12px !important;
        }
        .cert-meta {
          font-size: 11px !important;
        }
        #cert-actions { display: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="preview-pages">
      <div class="page-shell cert-page">
        <div class="background">
          <img src="${backgroundDataUri}" alt="" />
        </div>
        <main class="cert-main">
          <p class="cert-title">Certificamos que o aluno (a)</p>
          <p class="cert-name">${alunoNome}</p>
          <p class="cert-subtitle">concluiu o treinamento de</p>
          <p class="cert-course">${cursoNome}</p>
          <p class="cert-workload">Com uma carga horária de <strong class="cert-workload-value">${cargaHorariaLabel} horas</strong></p>
          <p class="cert-subtitle period-label">realizado no período de</p>
          <p class="cert-period">${escapeHtml(periodoLabel)}</p>
        </main>
        <aside class="cert-org-meta">
          <div>CNPJ: 25.089.257/0001-92</div>
          <div>Maceió-AL</div>
        </aside>
        <aside class="cert-meta">
          <div>${codigoLabel}</div>
          <div>${emitidoEmLabel}</div>
        </aside>
      </div>
      <div class="page-shell cert-page cert-page-verso">
        <div class="background">
          <img src="${versoBackgroundDataUri}" alt="" />
        </div>
        <main class="verso-main">
          <h2 class="verso-title">Conteúdo Programático</h2>
          <section class="verso-content">${conteudoProgramaticoHtml}</section>
        </main>
      </div>
    </div>
    <div id="cert-actions" aria-label="Ações do certificado">
      <button id="btn-print" class="cert-action-btn" type="button" data-tooltip="Imprimir" aria-label="Imprimir certificado">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9V3h12v6" />
          <rect x="6" y="14" width="12" height="7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        </svg>
      </button>
      <button id="btn-download" class="cert-action-btn" type="button" data-tooltip="Baixar PDF" aria-label="Baixar PDF do certificado">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M4 21h16" />
        </svg>
      </button>
    </div>
    <script>
      (() => {
        const printButton = document.getElementById('btn-print');
        const downloadButton = document.getElementById('btn-download');
        const pdfUrl = '${safePdfUrl}';
        const certificadoId = '${safeCertificadoId}';

        printButton?.addEventListener('click', () => window.print());
        downloadButton?.addEventListener('click', () => {
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.download = 'certificado-' + certificadoId + '.pdf';
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          link.remove();
        });
      })();
    </script>
  </body>
</html>`;
};

export const certificadosService = {
  async emitir(
    cursoId: string,
    turmaId: string,
    data: EmitirCertificadoData,
    emitidoPorId?: string,
  ) {
    return prisma.$transaction(
      (tx) => emitirCertificadoNoClient(tx, cursoId, turmaId, data, emitidoPorId),
      CERTIFICADOS_EMISSAO_TX_OPTIONS,
    );
  },

  async listar(cursoId: string, turmaId: string, filtros: ListCertificadosFilters = {}) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: {
        CursosTurmasInscricoes: {
          turmaId,
          CursosTurmas: { cursoId },
        },
        ...(filtros.inscricaoId ? { inscricaoId: filtros.inscricaoId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.formato ? { formato: filtros.formato } : {}),
      },
      orderBy: { emitidoEm: 'desc' },
      include: certificadoWithRelations.include,
    });

    return certificados.map((item) => mapCertificado(item));
  },

  async listarGlobal(query: ListarCertificadosGlobaisQuery) {
    const where: Prisma.CursosCertificadosEmitidosWhereInput = {
      ...(query.cursoId || query.turmaId
        ? {
            CursosTurmasInscricoes: {
              ...(query.turmaId ? { turmaId: query.turmaId } : {}),
              ...(query.cursoId
                ? {
                    CursosTurmas: {
                      cursoId: query.cursoId,
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(query.emitidoDe || query.emitidoA
        ? {
            emitidoEm: {
              ...(query.emitidoDe ? { gte: toDateRange(query.emitidoDe, 'start') } : {}),
              ...(query.emitidoA ? { lte: toDateRange(query.emitidoA, 'end') } : {}),
            },
          }
        : {}),
    };

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      const normalizedCpf = normalizeCpf(term);
      where.OR = [
        { alunoNome: { contains: term, mode: 'insensitive' } },
        { codigo: { contains: term, mode: 'insensitive' } },
        ...(normalizedCpf.length > 0 ? [{ alunoCpf: { contains: normalizedCpf } }] : []),
        {
          CursosTurmasInscricoes: {
            OR: [
              { codigo: { contains: term, mode: 'insensitive' } },
              {
                Usuarios: {
                  UsuariosInformation: {
                    inscricao: { contains: term, mode: 'insensitive' },
                  },
                },
              },
            ],
          },
        },
      ];
    }

    if (query.status && query.status !== 'EMITIDO') {
      return {
        success: true,
        data: {
          items: [],
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total: 0,
            totalPages: 1,
          },
        },
      };
    }

    const total = await prisma.cursosCertificadosEmitidos.count({ where });
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 1;
    const page = Math.min(query.page, totalPages);
    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where,
      include: certificadoWithRelations.include,
      orderBy: [mapSortByToOrderBy(query.sortBy, query.sortDir), { id: 'desc' }],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      success: true,
      data: {
        items: certificados.map((item) =>
          mapCertificadoDashboard(item, {
            ...buildCertificadoUrls(item.id),
          }),
        ),
        pagination: {
          page,
          pageSize: query.pageSize,
          total,
          totalPages,
        },
      },
    };
  },

  async emitirGlobal(data: EmitirCertificadoGlobalInput, emitidoPorId?: string) {
    const modeloId = data.modeloId ?? CERTIFICADO_MODELO_DEFAULT;
    if (!CERTIFICADO_MODELOS.some((item) => item.id === modeloId)) {
      const error = new Error('Modelo de certificado inválido');
      (error as any).code = 'MODELO_CERTIFICADO_INVALIDO';
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, data.cursoId, data.turmaId);

      const aluno = await tx.usuarios.findFirst({
        where: { id: data.alunoId, role: Roles.ALUNO_CANDIDATO },
        select: { id: true },
      });

      if (!aluno) {
        const error = new Error('Aluno não encontrado');
        (error as any).code = 'ALUNO_NOT_FOUND';
        throw error;
      }

      const inscricao = await findInscricaoForAlunoNaTurma(tx, data.turmaId, data.alunoId);
      if (inscricao.CursosTurmas.cursoId !== data.cursoId) {
        const error = new Error('Aluno não pertence ao curso/turma informados');
        (error as any).code = 'ALUNO_FORA_DA_TURMA';
        throw error;
      }

      const existente = await tx.cursosCertificadosEmitidos.findFirst({
        where: { inscricaoId: inscricao.id },
        include: certificadoWithRelations.include,
        orderBy: { emitidoEm: 'desc' },
      });

      if (existente && !data.forcarReemissao) {
        const error = new Error('Certificado já existe para esta inscrição');
        (error as any).code = 'CERTIFICADO_JA_EXISTE';
        (error as any).data = mapCertificadoDashboard(existente, {
          ...buildCertificadoUrls(existente.id),
        });
        throw error;
      }

      const emitted = await emitirCertificadoNoClient(
        tx,
        data.cursoId,
        data.turmaId,
        {
          inscricaoId: inscricao.id,
          tipo: CursosCertificados.CONCLUSAO,
          formato: CursosCertificadosTipos.VERIFICAVEL,
          modeloId,
          conteudoProgramatico: data.conteudoProgramatico,
        },
        emitidoPorId,
      );

      return {
        success: true,
        data: {
          id: emitted.id,
          codigo: emitted.codigo,
          numero: emitted.codigo.replace(/\D/g, '').slice(-6).padStart(6, '0'),
          status: 'EMITIDO',
          modelo: {
            id: CERTIFICADO_MODELO_DEFAULT,
            nome: 'Modelo Advance+ Oficial',
          },
          emitidoEm:
            emitted.emitidoEm instanceof Date ? emitted.emitidoEm.toISOString() : emitted.emitidoEm,
          ...buildCertificadoUrls(emitted.id),
        },
      };
    }, CERTIFICADOS_EMISSAO_TX_OPTIONS);
  },

  async getById(certificadoId: string) {
    const certificado = await prisma.cursosCertificadosEmitidos.findUnique({
      where: { id: certificadoId },
      include: certificadoWithRelations.include,
    });

    if (!certificado) {
      const error = new Error('Certificado não encontrado');
      (error as any).code = 'CERTIFICADO_NOT_FOUND';
      throw error;
    }

    return {
      success: true,
      data: mapCertificadoDashboard(certificado, {
        ...buildCertificadoUrls(certificado.id),
      }),
    };
  },

  async getPreviewHtml(certificadoId: string) {
    const certificado = await prisma.cursosCertificadosEmitidos.findUnique({
      where: { id: certificadoId },
      include: certificadoWithRelations.include,
    });

    if (!certificado) {
      const error = new Error('Certificado não encontrado');
      (error as any).code = 'CERTIFICADO_NOT_FOUND';
      throw error;
    }

    return renderAdvancePlusHtml(certificado);
  },

  async getPdfBuffer(certificadoId: string) {
    const cachedPdf = getCachedPdf(certificadoId);
    if (cachedPdf) {
      return Buffer.from(cachedPdf);
    }

    const inFlight = certificadoPdfInFlight.get(certificadoId);
    if (inFlight) {
      const sharedPdf = await inFlight;
      return Buffer.from(sharedPdf);
    }

    const generatePdf = async () => {
      const html = await this.getPreviewHtml(certificadoId);

      const puppeteerModule = await import('puppeteer');
      const browser = await puppeteerModule.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      try {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 1 });
          await page.setContent(html, { waitUntil: 'domcontentloaded' });
          await page
            .waitForFunction('document.fonts ? document.fonts.status === "loaded" : true', {
              timeout: 1200,
            })
            .catch(() => undefined);

          const pdfBytes = await page.pdf({
            format: 'A4',
            landscape: true,
            preferCSSPageSize: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            printBackground: true,
          });
          return Buffer.from(pdfBytes);
        } finally {
          await page.close();
        }
      } finally {
        await browser.close();
      }
    };

    const promise = generatePdf();
    certificadoPdfInFlight.set(certificadoId, promise);
    try {
      const generatedPdf = await promise;
      setCachedPdf(certificadoId, generatedPdf);
      return Buffer.from(generatedPdf);
    } finally {
      certificadoPdfInFlight.delete(certificadoId);
    }
  },

  async listarPorInscricao(
    inscricaoId: string,
    requesterId?: string,
    { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
  ) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: inscricaoId },
      include: {
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            UsuariosInformation: {
              select: { inscricao: true },
            },
          },
        },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            Cursos: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                cargaHoraria: true,
              },
            },
          },
        },
      },
    });

    if (!inscricao) {
      const error = new Error('Inscrição não encontrada');
      (error as any).code = 'INSCRICAO_NOT_FOUND';
      throw error;
    }

    if (requesterId && inscricao.alunoId !== requesterId && !permitirAdmin) {
      const error = new Error('Acesso negado');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: { inscricaoId },
      orderBy: { emitidoEm: 'desc' },
      include: certificadoWithRelations.include,
    });

    return {
      inscricao: {
        id: inscricao.id,
        aluno: {
          id: inscricao.Usuarios.id,
          nome: inscricao.Usuarios.nomeCompleto,
          email: inscricao.Usuarios.email,
          cpf: inscricao.Usuarios.cpf,
          inscricao: inscricao.Usuarios.UsuariosInformation?.inscricao ?? null,
        },
      },
      curso: {
        id: inscricao.CursosTurmas.Cursos.id,
        nome: inscricao.CursosTurmas.Cursos.nome,
        codigo: inscricao.CursosTurmas.Cursos.codigo,
        cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
      },
      turma: {
        id: inscricao.CursosTurmas.id,
        nome: inscricao.CursosTurmas.nome,
        codigo: inscricao.CursosTurmas.codigo,
      },
      certificados: certificados.map((item) => mapCertificado(item)),
    } as const;
  },

  async listarDoAluno(usuarioId: string) {
    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: { CursosTurmasInscricoes: { alunoId: usuarioId } },
      orderBy: { emitidoEm: 'desc' },
      include: certificadoWithRelations.include,
    });

    return certificados.map((item) => mapCertificado(item));
  },

  async listarDoAlunoPaginado(usuarioId: string, query: ListarMeCertificadosQuery) {
    const where: Prisma.CursosCertificadosEmitidosWhereInput = {
      CursosTurmasInscricoes: {
        alunoId: usuarioId,
        ...(query.turmaId ? { turmaId: query.turmaId } : {}),
        ...(query.cursoId ? { CursosTurmas: { cursoId: query.cursoId } } : {}),
      },
      ...(query.emitidoDe || query.emitidoA
        ? {
            emitidoEm: {
              ...(query.emitidoDe ? { gte: toDateRange(query.emitidoDe, 'start') } : {}),
              ...(query.emitidoA ? { lte: toDateRange(query.emitidoA, 'end') } : {}),
            },
          }
        : {}),
    };

    const total = await prisma.cursosCertificadosEmitidos.count({ where });
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 1;
    const page = Math.min(query.page, totalPages);
    const items = await prisma.cursosCertificadosEmitidos.findMany({
      where,
      include: certificadoWithRelations.include,
      orderBy: { emitidoEm: 'desc' },
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      success: true,
      data: {
        items: items.map((item) =>
          mapCertificadoDashboard(item, {
            ...buildCertificadoUrls(item.id),
          }),
        ),
        pagination: {
          page,
          pageSize: query.pageSize,
          total,
          totalPages,
        },
      },
    };
  },

  listarModelos() {
    return {
      success: true,
      data: {
        items: [...CERTIFICADO_MODELOS],
      },
    };
  },

  async verificarPorCodigo(codigo: string) {
    return prisma.$transaction(async (tx) => {
      const certificado = await tx.cursosCertificadosEmitidos.findUnique({
        where: { codigo },
        include: certificadoWithRelations.include,
      });

      if (!certificado) {
        return null;
      }

      await tx.cursosCertificadosLogs.create({
        data: {
          certificadoId: certificado.id,
          acao: CursosCertificadosLogAcao.VISUALIZACAO,
          formato: CursosCertificadosTipos.VERIFICAVEL,
          detalhes: 'Consulta por código do certificado',
        },
      });

      certificadosLogger.info({ codigo }, 'Certificado consultado por código');

      return mapCertificado(certificado, { maskCpf: true, includeLogs: false });
    });
  },

  async verificarPorCodigoPublico(codigo: string) {
    const certificado = await prisma.cursosCertificadosEmitidos.findUnique({
      where: { codigo },
      include: {
        CursosTurmasInscricoes: {
          select: {
            CursosTurmas: {
              select: {
                Cursos: { select: { nome: true } },
              },
            },
          },
        },
      },
    });

    if (!certificado) {
      return null;
    }

    await prisma.cursosCertificadosLogs.create({
      data: {
        certificadoId: certificado.id,
        acao: CursosCertificadosLogAcao.VISUALIZACAO,
        formato: CursosCertificadosTipos.VERIFICAVEL,
        detalhes: 'Consulta pública por código do certificado',
      },
    });

    return {
      success: true,
      data: {
        valido: true,
        codigo: certificado.codigo,
        alunoNome: certificado.alunoNome,
        cursoNome: certificado.CursosTurmasInscricoes.CursosTurmas.Cursos.nome,
        emitidoEm: certificado.emitidoEm.toISOString(),
        status: 'EMITIDO',
      },
    };
  },
};
