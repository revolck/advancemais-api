import { Request, Response } from 'express';
import { Roles } from '@prisma/client';
import { ZodError } from 'zod';

import { turmasService } from '../services/turmas.service';
import { cursosService } from '../services/cursos.service';
import { generateCacheKey, getCachedOrFetch, invalidateCacheByPrefix } from '@/utils/cache';
import {
  createTurmaSchema,
  turmaInscricaoSchema,
  updateTurmaSchema,
  updateInscricaoStatusSchema,
  listTurmasQuerySchema,
  publicarTurmaSchema,
} from '../validators/turmas.schema';

const parseCursoId = (raw: string) => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  // Cursos.id agora é UUID (String), não mais Int
  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw.trim())) {
    return null;
  }

  return raw.trim();
};

const parseTurmaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return raw;
};

const parseBooleanQuery = (value: unknown): boolean | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'sim', 's', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'n', 'no'].includes(normalized)) return false;
  }
  return null;
};

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const TURMAS_LIST_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_TURMAS_LIST, 45);
const TURMAS_GET_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_TURMAS_GET, 45);
const TURMAS_INSCRICOES_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_TURMAS_INSCRICOES, 30);

const invalidateTurmasCache = async () => {
  try {
    await Promise.all([
      invalidateCacheByPrefix('cursos:turmas:list:'),
      invalidateCacheByPrefix('cursos:turmas:get:'),
      invalidateCacheByPrefix('cursos:turmas:inscricoes:'),
      invalidateCacheByPrefix('cursos:historico-inscricoes-curso:'),
    ]);
  } catch {
    // Cache é best effort; não deve quebrar fluxo principal
  }
};

export class TurmasController {
  static list = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    if (!cursoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const params = listTurmasQuerySchema.parse(req.query);
      const cacheKey = generateCacheKey(
        'cursos:turmas:list',
        {
          cursoId,
          page: params.page,
          pageSize: params.pageSize,
          status: params.status ?? '',
          turno: params.turno ?? '',
          metodo: params.metodo ?? '',
          instrutorId: params.instrutorId ?? '',
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const result = await getCachedOrFetch(
        cacheKey,
        () =>
          turmasService.list({
            cursoId,
            page: params.page,
            pageSize: params.pageSize,
            status: params.status,
            turno: params.turno,
            metodo: params.metodo,
            instrutorId: params.instrutorId,
          }),
        TURMAS_LIST_CACHE_TTL,
      );
      const defaultTurmaId =
        Array.isArray((result as any)?.data) && (result as any).data.length > 0
          ? ((result as any).data[0]?.id ?? null)
          : null;

      res.json({
        ...result,
        meta: {
          ...((result as any)?.meta ?? {}),
          defaultTurmaId,
        },
        defaultTurmaId,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error?.message || 'Dados inválidos para criação da turma',
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMAS_LIST_ERROR',
        message: 'Erro ao listar turmas do curso',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const includeAlunos = parseBooleanQuery(req.query.includeAlunos) ?? false;
      // Compatibilidade: por padrão manter estrutura no payload.
      // Otimização permanece disponível via `?includeEstrutura=false`.
      const includeEstrutura = parseBooleanQuery(req.query.includeEstrutura) ?? true;
      const cacheKey = generateCacheKey(
        'cursos:turmas:get',
        {
          cursoId,
          turmaId,
          includeAlunos: includeAlunos ? '1' : '0',
          includeEstrutura: includeEstrutura ? '1' : '0',
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const turma = await getCachedOrFetch(
        cacheKey,
        () => turmasService.get(cursoId, turmaId, { includeAlunos, includeEstrutura }),
        TURMAS_GET_CACHE_TTL,
      );
      res.json(turma);
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_GET_ERROR',
        message: 'Erro ao buscar turma do curso',
        error: error?.message,
      });
    }
  };

  static listInscricoes = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const cacheKey = generateCacheKey(
        'cursos:turmas:inscricoes',
        {
          cursoId,
          turmaId,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const inscricoes = await getCachedOrFetch(
        cacheKey,
        () => turmasService.listInscricoes(cursoId, turmaId),
        TURMAS_INSCRICOES_CACHE_TTL,
      );

      // Log para depuração (apenas em desenvolvimento)
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[listInscricoes] cursoId: ${cursoId}, turmaId: ${turmaId}, count: ${inscricoes.length}`,
        );
      }

      // Garantir que sempre retorna um array (mesmo que vazio)
      const response = {
        success: true,
        data: Array.isArray(inscricoes) ? inscricoes : [],
        count: Array.isArray(inscricoes) ? inscricoes.length : 0,
      };

      // Headers para evitar cache problemático
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json(response);
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'INSCRICOES_LIST_ERROR',
        message: 'Erro ao listar inscrições da turma',
        error: error?.message,
      });
    }
  };

  static publicGet = async (req: Request, res: Response) => {
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de turma inválido',
      });
    }

    try {
      const turma = await cursosService.getPublicTurma(turmaId);
      if (!turma) {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada ou indisponível',
        });
      }

      res.json(turma);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'TURMA_PUBLIC_GET_ERROR',
        message: 'Erro ao buscar turma pública',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    if (!cursoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const data = createTurmaSchema.parse(req.body);

      const turma = await turmasService.create(
        cursoId,
        {
          ...data,
          dataInicio: data.dataInicio ?? undefined,
          dataFim: data.dataFim ?? undefined,
          dataInscricaoInicio: data.dataInscricaoInicio ?? undefined,
          dataInscricaoFim: data.dataInscricaoFim ?? undefined,
        },
        { id: req.user?.id ?? null },
      );

      await invalidateTurmasCache();

      res.status(201).json(turma);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da turma',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      if (error?.code === 'TURMA_PREREQUISITOS_NAO_ATENDIDOS') {
        return res.status(422).json({
          success: false,
          code: 'TURMA_PREREQUISITOS_NAO_ATENDIDOS',
          message:
            error?.message ||
            'Para cadastrar uma turma é necessário ter pelo menos 1 aula e 1 avaliação cadastradas.',
          details: error?.details,
        });
      }

      if (
        error?.code === 'AULA_TEMPLATE_NOT_FOUND' ||
        error?.code === 'AVALIACAO_TEMPLATE_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error?.message || 'Template não encontrado',
          details: error?.details,
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_CREATE_ERROR',
        message: 'Erro ao criar turma para o curso',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const data = updateTurmaSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da turma',
        });
      }

      const turma = await turmasService.update(
        cursoId,
        turmaId,
        {
          ...data,
          dataInicio: data.dataInicio ?? undefined,
          dataFim: data.dataFim ?? undefined,
          dataInscricaoInicio: data.dataInscricaoInicio ?? undefined,
          dataInscricaoFim: data.dataInscricaoFim ?? undefined,
        },
        { id: req.user?.id ?? null },
      );

      await invalidateTurmasCache();

      res.json(turma);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da turma',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'CAMPO_NAO_EDITAVEL') {
        return res.status(400).json({
          success: false,
          code: 'CAMPO_NAO_EDITAVEL',
          message: error?.message,
          field: error?.field,
        });
      }

      if (error?.code === 'STATUS_NAO_EDITAVEL_APOS_INICIO') {
        return res.status(400).json({
          success: false,
          code: 'STATUS_NAO_EDITAVEL_APOS_INICIO',
          message: error?.message,
          details: error?.details,
        });
      }

      if (error?.code === 'INVALID_VAGAS_TOTAIS') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_VAGAS_TOTAIS',
          message: 'Vagas totais não podem ser menores que inscrições ativas',
        });
      }

      if (error?.code === 'TURMA_PREREQUISITOS_NAO_ATENDIDOS') {
        return res.status(422).json({
          success: false,
          code: 'TURMA_PREREQUISITOS_NAO_ATENDIDOS',
          message:
            error?.message ||
            'Para cadastrar/publicar uma turma é necessário ter pelo menos 1 aula e 1 avaliação cadastradas.',
          details: error?.details,
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_UPDATE_ERROR',
        message: 'Erro ao atualizar turma',
        error: error?.message,
      });
    }
  };

  static enroll = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const data = turmaInscricaoSchema.parse(req.body);
      const actorRole = (req.user?.role as Roles | undefined) ?? null;
      const turma = await turmasService.enroll(cursoId, turmaId, data.alunoId, {
        id: req.user?.id ?? null,
        role: actorRole,
      });

      await invalidateTurmasCache();
      res.status(201).json(turma);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para inscrição na turma',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'SEM_VAGAS') {
        return res.status(409).json({
          success: false,
          code: 'SEM_VAGAS',
          message: 'Não há vagas disponíveis nesta turma',
        });
      }

      if (error?.code === 'INSCRICOES_ENCERRADAS') {
        return res.status(409).json({
          success: false,
          code: 'INSCRICOES_ENCERRADAS',
          message: 'Período de inscrição encerrado para esta turma',
        });
      }

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if (error?.code === 'ALUNO_INVALID_ROLE') {
        return res.status(400).json({
          success: false,
          code: 'ALUNO_INVALID_ROLE',
          message: 'Aluno deve possuir a role ALUNO_CANDIDATO',
        });
      }

      if (error?.code === 'ALUNO_JA_INSCRITO') {
        return res.status(409).json({
          success: false,
          code: 'ALUNO_JA_INSCRITO',
          message: 'Aluno já está inscrito nesta turma',
        });
      }

      if (error?.code === 'ALUNO_INFORMATION_NOT_FOUND') {
        return res.status(400).json({
          success: false,
          code: 'ALUNO_INFORMATION_NOT_FOUND',
          message: 'Informações do aluno não encontradas para geração da inscrição',
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_ENROLL_ERROR',
        message: 'Erro ao inscrever aluno na turma',
        error: error?.message,
      });
    }
  };

  static unenroll = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const alunoId = req.params.alunoId;

    if (!cursoId || !turmaId || !alunoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou aluno inválidos',
      });
    }

    try {
      const turma = await turmasService.unenroll(cursoId, turmaId, alunoId);
      await invalidateTurmasCache();
      res.json(turma);
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'ALUNO_NAO_INSCRITO') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NAO_INSCRITO',
          message: 'Aluno não está inscrito nesta turma',
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_UNENROLL_ERROR',
        message: 'Erro ao remover inscrição do aluno na turma',
        error: error?.message,
      });
    }
  };

  static updateInscricaoStatus = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const inscricaoId = req.params.inscricaoId;

    if (!cursoId || !turmaId || !inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou inscrição inválidos',
      });
    }

    try {
      const payload = updateInscricaoStatusSchema.parse(req.body);
      const inscricao = await turmasService.updateInscricaoStatus(
        cursoId,
        turmaId,
        inscricaoId,
        payload.status,
      );

      await invalidateTurmasCache();

      res.json({
        success: true,
        data: inscricao,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização de status',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error?.code === 'TURMA_NOT_FOUND' ||
        error?.code === 'CURSO_NOT_FOUND' ||
        error?.code === 'INSCRICAO_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Inscrição não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'INSCRICAO_STATUS_UPDATE_ERROR',
        message: 'Erro ao atualizar status da inscrição',
        error: error?.message,
      });
    }
  };

  static togglePublicacao = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    try {
      const payload = publicarTurmaSchema.parse(req.body);
      const turma = await turmasService.togglePublicacao(cursoId, turmaId, payload.publicar);

      await invalidateTurmasCache();

      res.json({
        success: true,
        data: turma,
        message: payload.publicar
          ? 'Turma publicada com sucesso'
          : 'Turma despublicada com sucesso',
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para publicação/despublicação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'TURMA_PREREQUISITOS_NAO_ATENDIDOS') {
        return res.status(422).json({
          success: false,
          code: 'TURMA_PREREQUISITOS_NAO_ATENDIDOS',
          message:
            error?.message ||
            'Para publicar uma turma é necessário ter pelo menos 1 aula e 1 avaliação cadastradas.',
          details: error?.details,
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_PUBLICACAO_ERROR',
        message: 'Erro ao publicar/despublicar turma',
        error: error?.message,
      });
    }
  };
}
