import { Request, Response } from 'express';
import { CursosNotasTipo } from '@prisma/client';
import { ZodError } from 'zod';

import { generateCacheKey, getCachedOrFetch, invalidateCacheByPrefix } from '@/utils/cache';
import { notasService } from '../services/notas.service';
import {
  clearNotasManuaisSchema,
  createNotaV2Schema,
  listNotasGeralQuerySchema,
  listCursoNotasQuerySchema,
  updateNotaSchema,
} from '../validators/notas.schema';

const parseCursoId = (raw: string): string | null => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  // Cursos.id agora é UUID (String), não mais Int
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

const parseNotaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseInscricaoId = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseAlunoId = (raw: string) => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw.trim())) {
    return null;
  }
  return raw.trim();
};

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const CURSOS_NOTAS_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_NOTAS, 30);

const invalidateCursoNotasCache = async () => {
  try {
    await Promise.all([
      invalidateCacheByPrefix('cursos:notas:list-curso:'),
      invalidateCacheByPrefix('cursos:notas:list-geral:'),
      invalidateCacheByPrefix('cursos:notas:list-aluno:'),
    ]);
  } catch {
    // cache é best-effort
  }
};

export class NotasController {
  static listGeral = async (req: Request, res: Response) => {
    try {
      const query = listNotasGeralQuerySchema.parse(req.query);
      const cacheKey = generateCacheKey(
        'cursos:notas:list-geral',
        {
          cursoId: query.cursoId ?? '',
          turmaIds: query.turmaIds?.join(',') ?? '',
          search: query.search ?? '',
          page: query.page,
          pageSize: query.pageSize,
          orderBy: query.orderBy,
          order: query.order,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const result = await getCachedOrFetch(
        cacheKey,
        () => notasService.listNotasGeral(query),
        CURSOS_NOTAS_CACHE_TTL,
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem geral de notas',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INVALID_TURMA_FILTER') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_TURMA_FILTER',
          message: 'Uma ou mais turmas são inválidas para o curso informado.',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_GERAL_LIST_ERROR',
        message: 'Erro ao listar notas',
        error: error?.message,
      });
    }
  };

  static listAluno = async (req: Request, res: Response) => {
    const alunoId = parseAlunoId(req.params.alunoId);
    if (!alunoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de aluno inválido',
      });
    }

    const cursoIdRaw = typeof req.query.cursoId === 'string' ? req.query.cursoId.trim() : '';
    const turmaIdsRaw = req.query.turmaIds;
    const hasTurmaIds =
      (typeof turmaIdsRaw === 'string' && turmaIdsRaw.trim().length > 0) ||
      (Array.isArray(turmaIdsRaw) && turmaIdsRaw.some((item) => String(item).trim().length > 0));

    if (!cursoIdRaw || !hasTurmaIds) {
      return res.status(400).json({
        success: false,
        code: 'TURMA_FILTER_REQUIRED',
        message: 'Selecione curso e ao menos uma turma para listar notas.',
        data: {
          requires: ['cursoId', 'turmaIds'],
        },
      });
    }

    try {
      const query = listNotasGeralQuerySchema.parse(req.query);
      if (!query.cursoId || !query.turmaIds || query.turmaIds.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'TURMA_FILTER_REQUIRED',
          message: 'Selecione curso e ao menos uma turma para listar notas.',
          data: {
            requires: ['cursoId', 'turmaIds'],
          },
        });
      }

      const cacheKey = generateCacheKey(
        'cursos:notas:list-aluno',
        {
          alunoId,
          cursoId: query.cursoId,
          turmaIds: query.turmaIds.join(','),
          search: query.search ?? '',
          page: query.page,
          pageSize: query.pageSize,
          orderBy: query.orderBy,
          order: query.order,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const result = await getCachedOrFetch(
        cacheKey,
        () => notasService.listNotasGeral(query, { alunoId }),
        CURSOS_NOTAS_CACHE_TTL,
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de notas do aluno',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INVALID_TURMA_FILTER') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_TURMA_FILTER',
          message: 'Uma ou mais turmas são inválidas para o curso informado.',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_ALUNO_LIST_ERROR',
        message: 'Erro ao listar notas do aluno',
        error: error?.message,
      });
    }
  };

  static listCurso = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    if (!cursoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const query = listCursoNotasQuerySchema.parse(req.query);
      const cacheKey = generateCacheKey(
        'cursos:notas:list-curso',
        {
          cursoId,
          turmaIds: query.turmaIds.join(','),
          search: query.search ?? '',
          page: query.page,
          pageSize: query.pageSize,
          orderBy: query.orderBy,
          order: query.order,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const result = await getCachedOrFetch(
        cacheKey,
        () => notasService.listCursoNotas(cursoId, query),
        CURSOS_NOTAS_CACHE_TTL,
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de notas do curso',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INVALID_TURMA_FILTER') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_TURMA_FILTER',
          message: 'Uma ou mais turmas são inválidas para o curso informado.',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_CURSO_LIST_ERROR',
        message: 'Erro ao listar notas do curso',
        error: error?.message,
      });
    }
  };

  static list = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    const inscricaoId = parseInscricaoId(req.query.inscricaoId);

    try {
      const notas = await notasService.list(cursoId, turmaId, {
        inscricaoId: inscricaoId ?? undefined,
      });
      res.json({ data: notas });
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_LIST_ERROR',
        message: 'Erro ao listar notas da turma',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const notaId = parseNotaId(req.params.notaId);

    if (!cursoId || !turmaId || !notaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou nota inválidos',
      });
    }

    try {
      const nota = await notasService.get(cursoId, turmaId, notaId);
      res.json(nota);
    } catch (error: any) {
      if (error?.code === 'NOTA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'NOTA_NOT_FOUND',
          message: 'Nota não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTA_GET_ERROR',
        message: 'Erro ao buscar nota da turma',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
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
      const parsed = createNotaV2Schema.parse(req.body);

      // Novo contrato: lançamento manual por alunoId
      if ('alunoId' in parsed) {
        const userAgentHeader = req.headers['user-agent'];
        const userAgent = Array.isArray(userAgentHeader)
          ? userAgentHeader.join(' | ')
          : userAgentHeader;

        const nota = await notasService.createManualLancamento(
          cursoId,
          turmaId,
          {
            alunoId: parsed.alunoId,
            nota: parsed.nota,
            motivo: parsed.motivo,
            origem: parsed.origem,
          },
          {
            criadoPorId: req.user?.id,
            ip: req.ip,
            userAgent,
          },
        );
        await invalidateCursoNotasCache();
        return res.status(201).json(nota);
      }

      // Contrato legado: criação direta de nota (por inscrição)
      const nota = await notasService.create(cursoId, turmaId, {
        ...parsed,
        tipo: parsed.tipo as CursosNotasTipo,
      });
      await invalidateCursoNotasCache();
      res.status(201).json(nota);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da nota',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Inscrição não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      if (error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ATIVIDADE_NOT_FOUND',
          message: 'Atividade não encontrada para a turma informada',
        });
      }

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'NOTA_MAXIMA_ATINGIDA' || error?.code === 'NOTA_EXCEDE_LIMITE') {
        return res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          data: error.data ?? undefined,
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTA_CREATE_ERROR',
        message: 'Erro ao criar nota para a turma',
        error: error?.message,
      });
    }
  };

  static clearManuais = async (req: Request, res: Response) => {
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
      const alunoIdRaw = (req.body?.alunoId ?? req.query?.alunoId) as unknown;
      const { alunoId } = clearNotasManuaisSchema.parse({ alunoId: alunoIdRaw });

      const result = await notasService.clearLancamentosManuais(cursoId, turmaId, alunoId);
      await invalidateCursoNotasCache();
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para remoção de lançamentos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Aluno não possui inscrição nesta turma',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_CLEAR_ERROR',
        message: 'Erro ao remover lançamentos manuais',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const notaId = parseNotaId(req.params.notaId);

    if (!cursoId || !turmaId || !notaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou nota inválidos',
      });
    }

    try {
      const data = updateNotaSchema.parse(req.body);

      if (Object.values(data).every((value) => value === undefined)) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da nota',
        });
      }

      const nota = await notasService.update(cursoId, turmaId, notaId, {
        ...data,
        tipo: data.tipo as CursosNotasTipo | undefined,
      });
      await invalidateCursoNotasCache();
      res.json(nota);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da nota',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'NOTA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'NOTA_NOT_FOUND',
          message: 'Nota não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      if (error?.code === 'NOTA_SYSTEM_LOCKED') {
        return res.status(409).json({
          success: false,
          code: 'NOTA_SYSTEM_LOCKED',
          message: error.message,
        });
      }

      if (error?.code === 'NOTA_EXCEDE_LIMITE') {
        return res.status(409).json({
          success: false,
          code: 'NOTA_EXCEDE_LIMITE',
          message: error.message,
          data: error.data ?? undefined,
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTA_UPDATE_ERROR',
        message: 'Erro ao atualizar nota da turma',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const notaId = parseNotaId(req.params.notaId);

    if (!cursoId || !turmaId || !notaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou nota inválidos',
      });
    }

    try {
      const result = await notasService.remove(cursoId, turmaId, notaId);
      await invalidateCursoNotasCache();
      res.json(result);
    } catch (error: any) {
      if (error?.code === 'NOTA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'NOTA_NOT_FOUND',
          message: 'Nota não encontrada para a turma informada',
        });
      }

      if (error?.code === 'NOTA_SYSTEM_LOCKED') {
        return res.status(409).json({
          success: false,
          code: 'NOTA_SYSTEM_LOCKED',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTA_DELETE_ERROR',
        message: 'Erro ao remover nota da turma',
        error: error?.message,
      });
    }
  };

  static listByInscricao = async (req: Request, res: Response) => {
    const inscricaoId = parseInscricaoId(req.params.inscricaoId);

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da inscrição inválido',
      });
    }

    try {
      const resultado = await notasService.listByInscricao(inscricaoId, undefined, {
        permitirAdmin: true,
      });
      res.json(resultado);
    } catch (error: any) {
      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Inscrição não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_INSCRICAO_ERROR',
        message: 'Erro ao consultar notas da inscrição',
        error: error?.message,
      });
    }
  };

  static listMy = async (req: Request, res: Response) => {
    const inscricaoId = parseInscricaoId(req.params.inscricaoId);

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da inscrição inválido',
      });
    }

    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    try {
      const resultado = await notasService.listByInscricao(inscricaoId, usuarioId);
      res.json(resultado);
    } catch (error: any) {
      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSCRICAO_NOT_FOUND',
          message: 'Inscrição não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar as notas desta inscrição',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_ME_INSCRICAO_ERROR',
        message: 'Erro ao consultar notas da inscrição do aluno',
        error: error?.message,
      });
    }
  };
}
