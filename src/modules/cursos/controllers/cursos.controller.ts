import { Request, Response } from 'express';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Prisma, Roles, StatusInscricao } from '@prisma/client';

import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { cursosService } from '../services/cursos.service';
import { buscarVisaoGeralCursos } from '../services/visaogeral.service';
import { buscarFaturamentoTendenciasCursos } from '../services/faturamento-tendencias.service';
import {
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
  vincularTemplatesSchema,
} from '../validators/cursos.schema';
import {
  listAlunosComInscricoesQuerySchema,
  alunoHistoricoInscricoesQuerySchema,
  alunoCriarEntrevistaSchema,
  alunoEntrevistasQuerySchema,
} from '../validators/alunos.schema';
import { cursoHistoricoInscricoesQuerySchema } from '../validators/cursos.schema';
import {
  sanitizeSocialLinks,
  buildSocialLinksUpdateData,
  mapSocialLinks,
} from '@/modules/usuarios/utils/social-links';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { getCachedOrFetch, generateCacheKey, invalidateCacheByPrefix } from '@/utils/cache';
import { cursosAuditoriaService } from '../services/cursos-auditoria.service';
import { invalidateCursosAlunosGetResponseCache } from '../middlewares/alunos-response-cache';
import {
  AlunoNotFoundError,
  alunosEntrevistasService,
} from '../services/alunos-entrevistas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import {
  buildInstrutorScope,
  canAccessCursoInScope,
  hasInstrutorScope,
  type InstrutorScope,
} from '@/modules/instrutor/services/instrutor-scope.service';

const parseCourseId = (raw: string): string | null => {
  // Validar se é UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw)) {
    return null;
  }
  return raw;
};

const parseAlunoId = (raw: string): string | null => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw)) {
    return null;
  }
  return raw;
};

const ensureAlunoScopeAccess = async (req: Request, res: Response, alunoId: string) => {
  if (req.user?.role === Roles.ALUNO_CANDIDATO && req.user.id !== alunoId) {
    res.status(403).json({
      success: false,
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Sem permissão para acessar dados de outro aluno.',
    });
    return false;
  }

  if (req.user?.role === Roles.RECRUTADOR) {
    const vagaIds = await recrutadorVagasService.listVagaIds(req.user.id);

    if (vagaIds.length === 0) {
      res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Sem permissão para acessar dados deste aluno.',
      });
      return false;
    }

    const candidaturaEmEscopo = await retryOperation(
      () =>
        prisma.empresasCandidatos.findFirst({
          where: {
            candidatoId: alunoId,
            vagaId: { in: vagaIds },
          },
          select: { id: true },
        }),
      3,
      400,
      6000,
    );

    if (!candidaturaEmEscopo) {
      res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Sem permissão para acessar dados deste aluno.',
      });
      return false;
    }
  }

  return true;
};

const buildEmptyAlunosListResponse = (page: number, limit: number) => ({
  data: [] as any[],
  pagination: {
    page,
    pageSize: limit,
    total: 0,
    totalPages: 0,
  },
});

const getInstrutorAlunoTurmaIds = (scope: InstrutorScope) =>
  Array.from(new Set([...scope.accessibleTurmaIds, ...scope.fullTurmaIds].filter(Boolean)));

const buildCursoTurmaAlunoFilter = (params: {
  turmaIds?: string[];
  cursoId?: string;
  turmaId?: string;
}): Prisma.CursosTurmasWhereInput => {
  const andFilters: Prisma.CursosTurmasWhereInput[] = [];

  if (params.turmaId) {
    andFilters.push({ id: params.turmaId });
  }

  if (params.turmaIds) {
    andFilters.push({ id: { in: params.turmaIds } });
  }

  return {
    deletedAt: null,
    ...(params.cursoId ? { cursoId: params.cursoId } : {}),
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };
};

const buildAlunoInscricaoFilter = (params: {
  turmaIds?: string[];
  status?: StatusInscricao[];
  cursoId?: string;
  turmaId?: string;
}): Prisma.CursosTurmasInscricoesWhereInput => ({
  ...(params.status && params.status.length > 0 ? { status: { in: params.status } } : {}),
  CursosTurmas: buildCursoTurmaAlunoFilter(params),
});

const shouldDeriveConclusaoFromCertificado = (status?: StatusInscricao[]) =>
  !status || status.length === 0 || status.includes(StatusInscricao.CONCLUIDO);

const buildAlunoCertificadoInscricaoFilter = (params: {
  turmaIds?: string[];
  cursoId?: string;
  turmaId?: string;
}): Prisma.CursosTurmasInscricoesWhereInput => ({
  CursosTurmas: buildCursoTurmaAlunoFilter(params),
  CursosCertificadosEmitidos: {
    some: {},
  },
});

const alunosListOrderBy: Prisma.UsuariosOrderByWithRelationInput[] = [
  { criadoEm: 'desc' },
  { codUsuario: 'asc' },
  { id: 'asc' },
];

const compareInscricaoPrioridade = (
  a: { status: StatusInscricao; criadoEm: Date },
  b: { status: StatusInscricao; criadoEm: Date },
) => {
  const getPriority = (status: StatusInscricao) => {
    if (status === StatusInscricao.EM_ANDAMENTO) return 0;
    if (status === StatusInscricao.INSCRITO) return 1;
    return 2;
  };

  const priorityDiff = getPriority(a.status) - getPriority(b.status);
  if (priorityDiff !== 0) return priorityDiff;
  return b.criadoEm.getTime() - a.criadoEm.getTime();
};

const normalizeDescricao = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value === null) {
    return null;
  }

  return undefined;
};

const normalizeConteudoProgramatico = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value === null) {
    return null;
  }

  return undefined;
};

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const CURSOS_INSCRICOES_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_INSCRICOES, 30);
const CURSOS_VISAOGERAL_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_VISAOGERAL, 30);
const CURSOS_VISAOGERAL_FATURAMENTO_CACHE_TTL = resolveTtl(
  process.env.CACHE_TTL_CURSOS_VISAOGERAL_FATURAMENTO,
  30,
);
const CURSOS_LIST_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_LIST, 45);
const CURSOS_GET_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_GET, 45);
const CURSOS_META_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_META, 45);
const CURSOS_AUDITORIA_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_AUDITORIA, 30);

const invalidateCursosAlunosCache = async () => {
  try {
    await Promise.all([
      invalidateCacheByPrefix('cursos:alunos:list'),
      invalidateCacheByPrefix('cursos:alunos:get'),
      invalidateCacheByPrefix('cursos:alunos:inscricoes'),
      invalidateCursosAlunosGetResponseCache(),
    ]);
  } catch {
    // cache é best-effort
  }
};

const invalidateCursosCache = async () => {
  try {
    await Promise.all([
      invalidateCacheByPrefix('cursos:list:'),
      invalidateCacheByPrefix('cursos:get:'),
      invalidateCacheByPrefix('cursos:meta:'),
      invalidateCacheByPrefix('cursos:auditoria:'),
      invalidateCacheByPrefix('cursos:historico-inscricoes-curso:'),
      invalidateCacheByPrefix('cursos:notas:list-curso:'),
      invalidateCursosAlunosCache(),
    ]);
  } catch {
    // cache é best-effort
  }
};

type InscricaoProgressoInput = {
  id: string;
  CursosTurmas: {
    id: string;
    dataInicio: Date | null;
    dataFim: Date | null;
  };
};

const calcularProgressoCursoBatch = async (inscricoes: InscricaoProgressoInput[]) => {
  const progressoMap: Record<string, number> = {};

  if (inscricoes.length === 0) {
    return progressoMap;
  }

  const inscricaoIds = inscricoes.map((inscricao) => inscricao.id);
  const turmaIds = Array.from(new Set(inscricoes.map((inscricao) => inscricao.CursosTurmas.id)));

  try {
    const [totalAulasPorTurma, totalProvasPorTurma, frequenciasPorInscricao, enviosPorInscricao] =
      await Promise.all([
        prisma.cursosTurmasAulas.groupBy({
          by: ['turmaId'],
          where: { turmaId: { in: turmaIds } },
          _count: { _all: true },
        }),
        prisma.cursosTurmasProvas.groupBy({
          by: ['turmaId'],
          where: { turmaId: { in: turmaIds } },
          _count: { _all: true },
        }),
        prisma.cursosFrequenciaAlunos.groupBy({
          by: ['inscricaoId'],
          where: {
            inscricaoId: { in: inscricaoIds },
            status: 'PRESENTE',
          },
          _count: { _all: true },
        }),
        prisma.cursosTurmasProvasEnvios.groupBy({
          by: ['inscricaoId'],
          where: { inscricaoId: { in: inscricaoIds } },
          _count: { _all: true },
        }),
      ]);

    const totalAulasMap = new Map<string, number>();
    for (const item of totalAulasPorTurma) {
      if (item.turmaId) {
        totalAulasMap.set(item.turmaId, item._count._all);
      }
    }

    const totalProvasMap = new Map<string, number>();
    for (const item of totalProvasPorTurma) {
      if (item.turmaId) {
        totalProvasMap.set(item.turmaId, item._count._all);
      }
    }

    const frequenciasMap = new Map<string, number>();
    for (const item of frequenciasPorInscricao) {
      frequenciasMap.set(item.inscricaoId, item._count._all);
    }

    const enviosMap = new Map<string, number>();
    for (const item of enviosPorInscricao) {
      enviosMap.set(item.inscricaoId, item._count._all);
    }

    for (const inscricao of inscricoes) {
      const turmaId = inscricao.CursosTurmas.id;
      const totalAulas = totalAulasMap.get(turmaId) ?? 0;
      const totalProvas = totalProvasMap.get(turmaId) ?? 0;
      const aulasComFrequencia = frequenciasMap.get(inscricao.id) ?? 0;
      const provasComEnvio = enviosMap.get(inscricao.id) ?? 0;

      if (totalAulas === 0 && totalProvas === 0) {
        const { dataInicio, dataFim } = inscricao.CursosTurmas;
        if (dataInicio && dataFim) {
          const agora = Date.now();
          const inicio = new Date(dataInicio).getTime();
          const fim = new Date(dataFim).getTime();

          if (fim > inicio) {
            const progressoPorTempo = Math.min(
              100,
              Math.max(0, ((agora - inicio) / (fim - inicio)) * 100),
            );
            progressoMap[inscricao.id] = Math.round(progressoPorTempo);
            continue;
          }
        }

        progressoMap[inscricao.id] = 0;
        continue;
      }

      let progressoAulas = 0;
      let progressoProvas = 0;
      let pesoAulas = 0.6;
      let pesoProvas = 0.4;

      if (totalAulas > 0) {
        progressoAulas = (aulasComFrequencia / totalAulas) * 100;
      }

      if (totalProvas > 0) {
        progressoProvas = (provasComEnvio / totalProvas) * 100;
      }

      if (totalAulas === 0 && totalProvas > 0) {
        pesoAulas = 0;
        pesoProvas = 1;
      } else if (totalAulas > 0 && totalProvas === 0) {
        pesoAulas = 1;
        pesoProvas = 0;
      }

      const progressoTotal = progressoAulas * pesoAulas + progressoProvas * pesoProvas;
      progressoMap[inscricao.id] = Math.round(Math.min(100, Math.max(0, progressoTotal)));
    }

    return progressoMap;
  } catch (error) {
    logger.error(
      {
        inscricoes: inscricoes.length,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      '❌ Erro ao calcular progresso em batch',
    );

    for (const inscricao of inscricoes) {
      progressoMap[inscricao.id] = 0;
    }

    return progressoMap;
  }
};

export class CursosController {
  static meta = (_req: Request, res: Response) => {
    res.json({
      message: 'Cursos Module API',
      version: 'v1',
      timestamp: new Date().toISOString(),
      endpoints: {
        cursos: '/',
        turmas: '/:cursoId/turmas',
        inscricoes: '/:cursoId/turmas/:turmaId/inscricoes',
      },
      status: 'operational',
    });
  };

  static metaCurso = async (req: Request, res: Response) => {
    const cursoId = parseCourseId(req.params.cursoId);
    if (!cursoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const cacheKey = generateCacheKey(
        'cursos:meta',
        {
          cursoId,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const meta = await getCachedOrFetch(
        cacheKey,
        () => cursosService.metaCurso(cursoId),
        CURSOS_META_CACHE_TTL,
      );
      res.json({ success: true, data: meta });
    } catch (error: any) {
      if (error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSO_META_ERROR',
        message: 'Erro ao buscar metadados do curso',
        error: error?.message,
      });
    }
  };

  static list = async (req: Request, res: Response) => {
    try {
      const params = listCoursesQuerySchema.parse(req.query);
      const cacheKey = generateCacheKey(
        'cursos:list',
        {
          page: params.page,
          pageSize: params.pageSize,
          search: params.search ?? '',
          statusPadrao: params.statusPadrao?.join(',') ?? '',
          categoriaId: params.categoriaId ?? '',
          subcategoriaId: params.subcategoriaId ?? '',
          instrutorId: params.instrutorId ?? '',
          includeTurmas: params.includeTurmas ? '1' : '0',
          includeExcluidos: params.includeExcluidos ? '1' : '0',
          role: req.user?.role ?? '',
          userId: req.user?.id ?? '',
        },
        { excludeKeys: [] },
      );

      const canViewDeletedRoles: Roles[] = [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO];
      const canViewDeleted = canViewDeletedRoles.includes(req.user?.role as Roles);
      const includeExcluidos = canViewDeleted && params.includeExcluidos === true;

      const result = await getCachedOrFetch(
        cacheKey,
        () =>
          cursosService.list({
            page: params.page,
            pageSize: params.pageSize,
            search: params.search,
            statusPadrao: params.statusPadrao,
            categoriaId: params.categoriaId,
            subcategoriaId: params.subcategoriaId,
            instrutorId: params.instrutorId,
            includeTurmas: params.includeTurmas,
            includeExcluidos,
            viewer: {
              userId: req.user?.id ?? null,
              role: req.user?.role ?? null,
            },
          }),
        CURSOS_LIST_CACHE_TTL,
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message || 'Sem permissão para listar cursos',
        });
      }

      if (error?.code === 'INSTRUTOR_SCOPE_ERROR') {
        return res.status(500).json({
          success: false,
          code: 'INSTRUTOR_SCOPE_ERROR',
          message: 'Erro ao montar o escopo do instrutor',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSOS_LIST_ERROR',
        message: 'Erro ao listar cursos',
        error: error?.message,
      });
    }
  };

  static vincularTemplates = async (req: Request, res: Response) => {
    try {
      const payload = vincularTemplatesSchema.parse(req.body);
      const result = await cursosService.vincularTemplates(payload);
      await invalidateCursosCache();
      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Payload inválido',
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

      if (error?.code === 'TEMPLATES_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TEMPLATES_NOT_FOUND',
          message: 'Templates informados não encontrados ou não são templates válidos (sem turma).',
          details: error?.details,
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSOS_VINCULAR_TEMPLATES_ERROR',
        message: 'Erro ao vincular templates ao curso',
        error: error?.message,
      });
    }
  };

  static publicList = async (_req: Request, res: Response) => {
    try {
      const cursos = await cursosService.listPublic();
      res.json({ data: cursos });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CURSOS_PUBLIC_LIST_ERROR',
        message: 'Erro ao listar cursos públicos',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const role = req.user?.role;
      const userId = req.user?.id ?? null;
      let instrutorTurmaIds: string[] | undefined;

      if (role === Roles.ALUNO_CANDIDATO) {
        return res.status(403).json({
          success: false,
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Sem permissão para acessar detalhes administrativos do curso.',
        });
      }

      if (role === Roles.INSTRUTOR) {
        if (!userId) {
          return res.status(403).json({
            success: false,
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Sem permissão para acessar detalhes deste curso.',
          });
        }

        const scope = await buildInstrutorScope(prisma, userId);

        if (!hasInstrutorScope(scope) || !canAccessCursoInScope(scope, id)) {
          return res.status(403).json({
            success: false,
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Sem permissão para acessar detalhes deste curso.',
          });
        }

        instrutorTurmaIds = Array.from(scope.accessibleTurmaIds);
      }

      const cacheKey = generateCacheKey(
        'cursos:get',
        {
          cursoId: id,
          role: role ?? '',
          userId: role === Roles.INSTRUTOR ? userId : '',
        },
        { excludeKeys: [] },
      );

      const course = await getCachedOrFetch(
        cacheKey,
        () =>
          cursosService.getById(id, {
            viewer:
              role === Roles.INSTRUTOR
                ? { role, userId, turmaIds: instrutorTurmaIds ?? [] }
                : { role, userId },
          }),
        CURSOS_GET_CACHE_TTL,
      );
      if (!course) {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      res.json(course);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CURSO_GET_ERROR',
        message: 'Erro ao buscar curso',
        error: error?.message,
      });
    }
  };

  static publicGet = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const course = await cursosService.getPublicById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado ou indisponível',
        });
      }

      res.json(course);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CURSO_PUBLIC_GET_ERROR',
        message: 'Erro ao buscar curso público',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const data = createCourseSchema.parse(req.body);
      const userId = req.user?.id;
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      const course = await cursosService.create(
        {
          ...data,
          descricao: normalizeDescricao(data.descricao),
          conteudoProgramatico: normalizeConteudoProgramatico(data.conteudoProgramatico),
        },
        userId,
        ip,
        userAgent,
      );

      await invalidateCursosCache();
      res.status(201).json(course);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do curso',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor informado não foi encontrado',
        });
      }

      if (error?.code === 'INSTRUTOR_INVALID_ROLE') {
        return res.status(400).json({
          success: false,
          code: 'INSTRUTOR_INVALID_ROLE',
          message: 'Instrutor deve possuir a role INSTRUTOR',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSO_CREATE_ERROR',
        message: 'Erro ao criar curso',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const data = updateCourseSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização do curso',
        });
      }

      const userId = req.user?.id;
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      const course = await cursosService.update(
        id,
        {
          ...data,
          descricao: normalizeDescricao(data.descricao),
          conteudoProgramatico: normalizeConteudoProgramatico(data.conteudoProgramatico),
        },
        userId,
        ip,
        userAgent,
      );

      await invalidateCursosCache();
      res.json(course);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do curso',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor informado não foi encontrado',
        });
      }

      if (error?.code === 'INSTRUTOR_INVALID_ROLE') {
        return res.status(400).json({
          success: false,
          code: 'INSTRUTOR_INVALID_ROLE',
          message: 'Instrutor deve possuir a role INSTRUTOR',
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSO_UPDATE_ERROR',
        message: 'Erro ao atualizar curso',
        error: error?.message,
      });
    }
  };

  static archive = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const course = await cursosService.archive(id);
      await invalidateCursosCache();
      res.json(course);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      if (error?.code === 'CURSO_DESPUBLICAR_TURMAS_NAO_CONCLUIDAS') {
        return res.status(409).json({
          success: false,
          code: 'CURSO_DESPUBLICAR_TURMAS_NAO_CONCLUIDAS',
          message:
            'Não é possível despublicar curso com turmas não concluídas. Conclua todas as turmas antes de despublicar.',
          details: error?.details ?? [],
        });
      }

      res.status(500).json({
        success: false,
        code: 'CURSO_ARCHIVE_ERROR',
        message: 'Erro ao despublicar curso',
        error: error?.message,
      });
    }
  };

  static deleteDefinitivo = async (req: Request, res: Response) => {
    const id = parseCourseId(req.params.cursoId ?? req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de curso inválido',
      });
    }

    try {
      const userId = req.user?.id;
      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.get('user-agent') || undefined;

      const result = await cursosService.deleteDefinitivo(id, userId, ip, userAgent);
      await invalidateCursosCache();
      return res.json(result);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
        });
      }

      if (error?.code === 'CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS') {
        return res.status(409).json({
          success: false,
          code: 'CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS',
          message: 'Não é possível excluir curso com turmas vinculadas. Use despublicar/arquivar.',
          details: error?.details ?? [],
        });
      }

      return res.status(500).json({
        success: false,
        code: 'CURSO_DELETE_ERROR',
        message: 'Erro ao excluir curso',
        error: error?.message,
      });
    }
  };

  /**
   * Listar alunos com inscrições em cursos
   * ✅ OTIMIZADO: Cache, remoção de N+1 queries, query otimizada
   */
  static listAlunosComInscricoes = async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      // Validar e parsear query params usando schema Zod
      const params = listAlunosComInscricoesQuerySchema.parse(req.query);
      const page = params.page;
      const limit = params.limit;
      const skip = (page - 1) * limit;

      // Parâmetros de filtro (já validados pelo schema)
      const cidade = params.cidade;
      const statusInscricao = params.status;
      const cursoIdParam = params.cursoId;
      const turmaIdParam = params.turmaId || params.turma;
      const search = params.search;
      const incluirCertificados = params.incluirCertificados !== false;
      let instrutorScope: InstrutorScope | null = null;
      let instrutorTurmaIds: string[] | null = null;

      if (req.user?.role === Roles.INSTRUTOR) {
        if (!req.user.id) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Instrutor sem contexto de autenticação válido.',
          });
        }

        instrutorScope = await buildInstrutorScope(prisma, req.user.id);
        if (!hasInstrutorScope(instrutorScope)) {
          return res.json(buildEmptyAlunosListResponse(page, limit));
        }

        instrutorTurmaIds = getInstrutorAlunoTurmaIds(instrutorScope);
        if (instrutorTurmaIds.length === 0) {
          return res.json(buildEmptyAlunosListResponse(page, limit));
        }
      }

      // ✅ Gerar chave de cache baseada nos parâmetros
      const cacheKey = generateCacheKey('cursos:alunos:list', {
        page,
        limit,
        cidade: cidade?.join(',') || '',
        status: statusInscricao?.join(',') || '',
        cursoId: cursoIdParam || '',
        turmaId: turmaIdParam || '',
        search: search || '',
        incluirCertificados,
        role: req.user?.role ?? '',
        userId: req.user?.id ?? '',
      });

      // Validar UUID do curso antes de buscar
      if (cursoIdParam) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(cursoIdParam)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_CURSO_ID',
            message: 'Curso ID deve ser um UUID válido',
            error: `O ID "${cursoIdParam}" não é um UUID válido`,
          });
        }
      }

      // ✅ Buscar do cache ou executar query
      const result = await getCachedOrFetch(
        cacheKey,
        async () => {
          const statusIncluiConclusaoPorCertificado =
            shouldDeriveConclusaoFromCertificado(statusInscricao);
          const scopeFilter = {
            turmaIds: instrutorTurmaIds ?? undefined,
            cursoId: cursoIdParam,
            turmaId: turmaIdParam,
          };
          const inscricaoFilter = buildAlunoInscricaoFilter({
            ...scopeFilter,
            status: statusInscricao,
          });
          const certificadoInscricaoFilter =
            incluirCertificados && statusIncluiConclusaoPorCertificado
              ? buildAlunoCertificadoInscricaoFilter(scopeFilter)
              : null;

          const inscricaoEligibilityFilters: Prisma.UsuariosWhereInput[] = [
            {
              CursosTurmasInscricoes: {
                some: inscricaoFilter,
              },
            },
          ];

          if (certificadoInscricaoFilter) {
            inscricaoEligibilityFilters.push({
              CursosTurmasInscricoes: {
                some: certificadoInscricaoFilter,
              },
            });
          }

          const andFilters: Prisma.UsuariosWhereInput[] = [
            {
              OR: inscricaoEligibilityFilters,
            },
          ];

          // Filtro por cidade (já normalizado como array pelo schema)
          if (cidade && cidade.length > 0) {
            andFilters.push({
              UsuariosEnderecos: {
                some: {
                  cidade: {
                    in: cidade,
                    mode: 'insensitive',
                  },
                },
              },
            });
          }

          const where: Prisma.UsuariosWhereInput = {
            role: Roles.ALUNO_CANDIDATO,
            AND: andFilters,
          };

          // ✅ Filtro por busca otimizado (usar startsWith quando possível)
          if (search) {
            const searchClean = search.trim();
            const cpfClean = search.replace(/\D/g, '');
            const certificadoCodigoFilter = {
              CursosCertificadosEmitidos: {
                some: {
                  codigo: {
                    contains: searchClean,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            };

            // Se busca parece ser CPF (apenas números), priorizar busca por CPF
            if (cpfClean.length >= 3 && /^\d+$/.test(searchClean)) {
              andFilters.push({
                OR: [
                  { cpf: { contains: cpfClean } },
                  { codUsuario: { contains: searchClean, mode: Prisma.QueryMode.insensitive } },
                  ...(incluirCertificados
                    ? [
                        {
                          CursosTurmasInscricoes: {
                            some: {
                              ...inscricaoFilter,
                              ...certificadoCodigoFilter,
                            },
                          },
                        },
                        ...(certificadoInscricaoFilter
                          ? [
                              {
                                CursosTurmasInscricoes: {
                                  some: {
                                    ...certificadoInscricaoFilter,
                                    ...certificadoCodigoFilter,
                                  },
                                },
                              },
                            ]
                          : []),
                      ]
                    : []),
                ],
              });
            } else {
              // Busca geral por nome, email ou código
              andFilters.push({
                OR: [
                  { nomeCompleto: { contains: searchClean, mode: Prisma.QueryMode.insensitive } },
                  { email: { contains: searchClean, mode: Prisma.QueryMode.insensitive } },
                  { codUsuario: { contains: searchClean, mode: Prisma.QueryMode.insensitive } },
                  ...(cpfClean.length >= 3 ? [{ cpf: { contains: cpfClean } }] : []),
                  ...(incluirCertificados
                    ? [
                        {
                          CursosTurmasInscricoes: {
                            some: {
                              ...inscricaoFilter,
                              ...certificadoCodigoFilter,
                            },
                          },
                        },
                        ...(certificadoInscricaoFilter
                          ? [
                              {
                                CursosTurmasInscricoes: {
                                  some: {
                                    ...certificadoInscricaoFilter,
                                    ...certificadoCodigoFilter,
                                  },
                                },
                              },
                            ]
                          : []),
                      ]
                    : []),
                ],
              });
            }
          }

          // ✅ Buscar alunos com retry logic
          const [alunos, total] = await retryOperation(
            async () => {
              const [alunosResult, totalResult] = await Promise.all([
                prisma.usuarios.findMany({
                  where,
                  select: {
                    id: true,
                    codUsuario: true,
                    nomeCompleto: true,
                    email: true,
                    cpf: true,
                    status: true,
                    criadoEm: true,
                    ultimoLogin: true,
                    UsuariosInformation: {
                      select: {
                        avatarUrl: true,
                      },
                    },
                    UsuariosEnderecos: {
                      select: {
                        cidade: true,
                        estado: true,
                      },
                      take: 1,
                      orderBy: {
                        criadoEm: 'desc',
                      },
                    },
                  },
                  skip,
                  take: limit,
                  orderBy: alunosListOrderBy,
                }),
                prisma.usuarios.count({ where }),
              ]);

              return [alunosResult, totalResult];
            },
            3, // 3 tentativas
            1500, // 1.5s entre tentativas
          );

          const alunoIds = alunos.map((aluno) => aluno.id);
          const inscricoes = await retryOperation(
            async () => {
              if (alunoIds.length === 0) return [];

              const inscricaoSelectionFilters: Prisma.CursosTurmasInscricoesWhereInput[] = [
                inscricaoFilter,
              ];

              if (certificadoInscricaoFilter) {
                inscricaoSelectionFilters.push(certificadoInscricaoFilter);
              }

              return prisma.cursosTurmasInscricoes.findMany({
                where: {
                  alunoId: { in: alunoIds },
                  OR: inscricaoSelectionFilters,
                },
                select: {
                  id: true,
                  alunoId: true,
                  status: true,
                  criadoEm: true,
                  CursosCertificadosEmitidos: {
                    select: {
                      id: true,
                      codigo: true,
                      emitidoEm: true,
                    },
                    orderBy: {
                      emitidoEm: 'desc',
                    },
                    take: 1,
                  },
                  CursosTurmas: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                      status: true,
                      dataInicio: true,
                      dataFim: true,
                      Cursos: {
                        select: {
                          id: true,
                          nome: true,
                          codigo: true,
                        },
                      },
                    },
                  },
                },
                orderBy: [{ criadoEm: 'desc' }],
              });
            },
            3,
            1500,
          );

          const inscricoesPorAluno = new Map<string, typeof inscricoes>();
          for (const inscricao of inscricoes) {
            const bucket = inscricoesPorAluno.get(inscricao.alunoId) ?? [];
            bucket.push(inscricao);
            inscricoesPorAluno.set(inscricao.alunoId, bucket);
          }

          // ✅ Processar dados SEM calcular progresso (evita N+1 queries)
          // O progresso pode ser calculado no frontend ou em um endpoint separado se necessário
          const data = alunos.map((aluno) => {
            const searchLower = search?.trim().toLowerCase() ?? '';
            const statusFilterSet = new Set(statusInscricao ?? []);
            const hasStatusFilter = statusFilterSet.size > 0;
            const inscricoesAluno = (inscricoesPorAluno.get(aluno.id) ?? [])
              .map((inscricao) => {
                const certificado = inscricao.CursosCertificadosEmitidos?.[0] ?? null;
                const matchesInscricaoStatus =
                  !hasStatusFilter || statusFilterSet.has(inscricao.status);
                const statusInscricaoExibicao =
                  incluirCertificados &&
                  certificado &&
                  !matchesInscricaoStatus &&
                  statusFilterSet.has(StatusInscricao.CONCLUIDO)
                    ? StatusInscricao.CONCLUIDO
                    : inscricao.status;
                const criadoEmReferencia =
                  statusInscricaoExibicao === StatusInscricao.CONCLUIDO &&
                  !matchesInscricaoStatus &&
                  certificado
                    ? certificado.emitidoEm
                    : inscricao.criadoEm;

                return {
                  ...inscricao,
                  certificado,
                  statusInscricaoExibicao,
                  criadoEmReferencia,
                  certificadoCodigoMatch:
                    searchLower.length > 0 &&
                    Boolean(certificado?.codigo?.toLowerCase().includes(searchLower)),
                };
              })
              .sort((a, b) => {
                if (a.certificadoCodigoMatch !== b.certificadoCodigoMatch) {
                  return a.certificadoCodigoMatch ? -1 : 1;
                }

                return compareInscricaoPrioridade(
                  { status: a.statusInscricaoExibicao, criadoEm: a.criadoEmReferencia },
                  { status: b.statusInscricaoExibicao, criadoEm: b.criadoEmReferencia },
                );
              });
            const inscricaoAtiva = inscricoesAluno[0] ?? null;

            return {
              id: aluno.id,
              codigo: aluno.codUsuario,
              nomeCompleto: aluno.nomeCompleto,
              email: aluno.email,
              cpf: aluno.cpf,
              status: aluno.status,
              cidade: aluno.UsuariosEnderecos?.[0]?.cidade || null,
              estado: aluno.UsuariosEnderecos?.[0]?.estado || null,
              avatarUrl: aluno.UsuariosInformation?.avatarUrl || null,
              ultimoLogin: aluno.ultimoLogin,
              criadoEm: aluno.criadoEm,
              ultimoCurso: inscricaoAtiva
                ? {
                    inscricaoId: inscricaoAtiva.id,
                    statusInscricao: inscricaoAtiva.statusInscricaoExibicao,
                    dataInscricao: inscricaoAtiva.criadoEm,
                    // ✅ Removido progresso para evitar N+1 queries
                    // Progresso pode ser calculado em batch ou endpoint separado se necessário
                    turma: {
                      id: inscricaoAtiva.CursosTurmas.id,
                      nome: inscricaoAtiva.CursosTurmas.nome,
                      codigo: inscricaoAtiva.CursosTurmas.codigo,
                      status: inscricaoAtiva.CursosTurmas.status,
                    },
                    curso: {
                      id: inscricaoAtiva.CursosTurmas.Cursos.id,
                      nome: inscricaoAtiva.CursosTurmas.Cursos.nome,
                      codigo: inscricaoAtiva.CursosTurmas.Cursos.codigo,
                    },
                    ...(inscricaoAtiva.certificado
                      ? {
                          certificado: {
                            id: inscricaoAtiva.certificado.id,
                            codigo: inscricaoAtiva.certificado.codigo,
                            status: 'EMITIDO',
                            emitidoEm: inscricaoAtiva.certificado.emitidoEm,
                          },
                        }
                      : {}),
                  }
                : null,
            };
          });

          return {
            data,
            pagination: {
              page,
              pageSize: limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          };
        },
        30, // ✅ Cache de 30 segundos
      );

      // Log de performance
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logger.warn({ duration, params, cacheKey }, '⚠️ Busca de alunos demorou mais de 1s');
      }

      res.json(result);
    } catch (error: any) {
      // Tratar erros de validação Zod
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'INSTRUTOR_SCOPE_ERROR') {
        return res.status(500).json({
          success: false,
          code: 'INSTRUTOR_SCOPE_ERROR',
          message: 'Não foi possível montar o escopo do instrutor.',
        });
      }

      // Logging detalhado do erro
      logger.error('❌ Erro ao listar alunos:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 3),
      });

      // Verificar se é erro de timeout
      if (error?.message?.includes('timeout')) {
        return res.status(504).json({
          success: false,
          code: 'QUERY_TIMEOUT',
          message: 'A consulta demorou muito tempo. Tente filtrar por cidade ou curso específico.',
          error: error?.message,
        });
      }

      // Verificar se é erro de conexão
      if (error?.message?.includes('database server') || error?.message?.includes('connection')) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message:
            'Problema temporário de conexão com o banco de dados. Tente novamente em alguns segundos.',
          error: error?.message,
        });
      }

      // Erro genérico
      res.status(500).json({
        success: false,
        code: 'ALUNOS_LIST_ERROR',
        message: 'Erro ao listar alunos com inscrições',
        error: error?.message,
      });
    }
  };

  /**
   * Buscar detalhes completos de um aluno específico com TODAS as inscrições
   */
  static getAlunoById = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      let instrutorScope: InstrutorScope | null = null;
      let instrutorTurmaIds: string[] | null = null;

      // Validar UUID
      if (!parseAlunoId(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
        });
      }

      if (!(await ensureAlunoScopeAccess(req, res, alunoId))) {
        return;
      }

      if (req.user?.role === Roles.INSTRUTOR) {
        if (!req.user.id) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Instrutor sem contexto de autenticação válido.',
          });
        }

        instrutorScope = await buildInstrutorScope(prisma, req.user.id);
        if (!hasInstrutorScope(instrutorScope)) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Você não possui acesso a este aluno.',
          });
        }

        instrutorTurmaIds = getInstrutorAlunoTurmaIds(instrutorScope);
        if (instrutorTurmaIds.length === 0) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Você não possui acesso a este aluno.',
          });
        }
      }

      // Buscar aluno com TODAS as inscrições
      const aluno = await retryOperation(
        async () => {
          return await prisma.usuarios.findUnique({
            where: {
              id: alunoId,
              role: 'ALUNO_CANDIDATO',
            },
            select: {
              id: true,
              codUsuario: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
              status: true,
              criadoEm: true,
              atualizadoEm: true,
              ultimoLogin: true,
              UsuariosInformation: {
                select: {
                  telefone: true,
                  genero: true,
                  dataNasc: true,
                  descricao: true,
                  avatarUrl: true,
                },
              },
              UsuariosRedesSociais: {
                select: {
                  linkedin: true,
                  instagram: true,
                  facebook: true,
                  youtube: true,
                  twitter: true,
                  tiktok: true,
                },
              },
              UsuariosEnderecos: {
                select: {
                  id: true,
                  logradouro: true,
                  numero: true,
                  bairro: true,
                  cidade: true,
                  estado: true,
                  cep: true,
                  criadoEm: true,
                },
                orderBy: {
                  criadoEm: 'desc',
                },
              },
              CursosTurmasInscricoes: {
                where: instrutorTurmaIds
                  ? {
                      CursosTurmas: {
                        id: { in: instrutorTurmaIds },
                        deletedAt: null,
                      },
                    }
                  : undefined,
                select: {
                  id: true,
                  status: true,
                  criadoEm: true,
                  CursosTurmas: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                      status: true,
                      dataInicio: true,
                      dataFim: true,
                      Cursos: {
                        select: {
                          id: true,
                          nome: true,
                          codigo: true,
                          descricao: true,
                          cargaHoraria: true,
                          imagemUrl: true,
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  criadoEm: 'desc',
                },
              },
              UsuariosCurriculos: {
                select: {
                  id: true,
                  principal: true,
                },
                orderBy: [{ principal: 'desc' }, { criadoEm: 'asc' }],
              },
            },
          });
        },
        3,
        1500,
      );

      // Verificar se aluno existe
      if (!aluno) {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado ou não possui role de ALUNO_CANDIDATO.',
        });
      }

      if (instrutorScope && aluno.CursosTurmasInscricoes.length === 0) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a este aluno.',
        });
      }

      const progressoMap = await calcularProgressoCursoBatch(
        aluno.CursosTurmasInscricoes.map((inscricao) => ({
          id: inscricao.id,
          CursosTurmas: {
            id: inscricao.CursosTurmas.id,
            dataInicio: inscricao.CursosTurmas.dataInicio,
            dataFim: inscricao.CursosTurmas.dataFim,
          },
        })),
      );

      // Formatar resposta
      const response = {
        id: aluno.id,
        codigo: aluno.codUsuario,
        nomeCompleto: aluno.nomeCompleto,
        email: aluno.email,
        cpf: aluno.cpf,
        telefone: (aluno as any).UsuariosInformation?.telefone || null,
        status: aluno.status,
        genero: (aluno as any).UsuariosInformation?.genero || null,
        dataNasc: (aluno as any).UsuariosInformation?.dataNasc || null,
        descricao: (aluno as any).UsuariosInformation?.descricao || null,
        avatarUrl: (aluno as any).UsuariosInformation?.avatarUrl || null,
        criadoEm: aluno.criadoEm,
        atualizadoEm: aluno.atualizadoEm,
        ultimoLogin: aluno.ultimoLogin,
        enderecos: (aluno as any).UsuariosEnderecos || [],
        redesSociais: mapSocialLinks((aluno as any).UsuariosRedesSociais),
        inscricoes: aluno.CursosTurmasInscricoes.map((inscricao) => ({
          id: inscricao.id,
          statusInscricao: inscricao.status,
          criadoEm: inscricao.criadoEm,
          progresso: progressoMap[inscricao.id] ?? 0,
          turma: {
            id: inscricao.CursosTurmas.id,
            nome: inscricao.CursosTurmas.nome,
            codigo: inscricao.CursosTurmas.codigo,
            status: inscricao.CursosTurmas.status,
            dataInicio: inscricao.CursosTurmas.dataInicio,
            dataFim: inscricao.CursosTurmas.dataFim,
          },
          curso: {
            id: inscricao.CursosTurmas.Cursos.id,
            nome: inscricao.CursosTurmas.Cursos.nome,
            codigo: inscricao.CursosTurmas.Cursos.codigo,
            descricao: inscricao.CursosTurmas.Cursos.descricao,
            cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
            imagemUrl: inscricao.CursosTurmas.Cursos.imagemUrl,
          },
        })),
        totalInscricoes: aluno.CursosTurmasInscricoes.length,
        curriculosResumo: {
          total: aluno.UsuariosCurriculos.length,
          principalId:
            aluno.UsuariosCurriculos.find((curriculo) => curriculo.principal)?.id ?? null,
        },
        estatisticas: {
          cursosAtivos: aluno.CursosTurmasInscricoes.filter((i) =>
            ['INSCRITO', 'EM_ANDAMENTO'].includes(i.status),
          ).length,
          cursosConcluidos: aluno.CursosTurmasInscricoes.filter((i) => i.status === 'CONCLUIDO')
            .length,
          cursosCancelados: aluno.CursosTurmasInscricoes.filter((i) =>
            ['CANCELADO', 'TRANCADO'].includes(i.status),
          ).length,
        },
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      if (error?.code === 'INSTRUTOR_SCOPE_ERROR') {
        return res.status(500).json({
          success: false,
          code: 'INSTRUTOR_SCOPE_ERROR',
          message: 'Não foi possível montar o escopo do instrutor.',
        });
      }

      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao buscar detalhes do aluno',
      );

      res.status(500).json({
        success: false,
        code: 'ALUNO_DETAILS_ERROR',
        message: 'Não foi possível carregar os detalhes do aluno.',
        error: error?.message,
      });
    }
  };

  static listAlunoEntrevistas = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      if (!parseAlunoId(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
        });
      }

      if (!(await ensureAlunoScopeAccess(req, res, alunoId))) {
        return;
      }

      const query = alunoEntrevistasQuerySchema.parse(req.query);
      const result = await alunosEntrevistasService.list({
        alunoId,
        viewerId: req.user!.id,
        viewerRole: req.user!.role as Roles,
        filters: query,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'INTERVIEWS_INVALID_FILTERS',
          message: 'Os filtros informados para entrevistas são inválidos.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof AlunoNotFoundError || error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }

      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao listar entrevistas do aluno',
      );

      return res.status(500).json({
        success: false,
        code: 'STUDENT_INTERVIEWS_ERROR',
        message: 'Não foi possível carregar as entrevistas do aluno.',
        error: error?.message,
      });
    }
  };

  static listAlunoEntrevistasOpcoes = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      if (!parseAlunoId(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
        });
      }

      const result = await alunosEntrevistasService.listCreateOptions({
        alunoId,
        viewerId: req.user!.id,
        viewerRole: req.user!.role as Roles,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof AlunoNotFoundError || error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }

      if (error?.status === 403 || error?.code === 'INSUFFICIENT_PERMISSIONS') {
        return res.status(403).json({
          success: false,
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error?.message ?? 'Sem permissão para criar entrevista para este aluno.',
        });
      }

      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao listar opções de entrevistas do aluno',
      );

      return res.status(500).json({
        success: false,
        code: 'STUDENT_INTERVIEW_OPTIONS_ERROR',
        message: 'Não foi possível carregar as opções de entrevista do aluno.',
        error: error?.message,
      });
    }
  };

  static createAlunoEntrevista = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      if (!parseAlunoId(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
        });
      }

      const payload = alunoCriarEntrevistaSchema.parse(req.body);
      const result = await alunosEntrevistasService.createForAluno({
        alunoId,
        viewerId: req.user!.id,
        viewerRole: req.user!.role as Roles,
        payload,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'INTERVIEW_INVALID_PAYLOAD',
          message: 'Os dados informados para criar a entrevista são inválidos.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof AlunoNotFoundError || error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }

      if (error?.status === 404) {
        return res.status(404).json({
          success: false,
          code: error?.code ?? 'NOT_FOUND',
          message: error?.message ?? 'Recurso não encontrado.',
        });
      }

      if (error?.status === 403 || error?.code === 'INSUFFICIENT_PERMISSIONS') {
        return res.status(403).json({
          success: false,
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error?.message ?? 'Sem permissão para criar entrevista para este aluno.',
        });
      }

      if (error?.status === 409) {
        return res.status(409).json({
          success: false,
          code: error?.code ?? 'INTERVIEW_ALREADY_EXISTS',
          message: error?.message ?? 'Já existe uma entrevista ativa para esta candidatura.',
        });
      }

      if (error?.status === 400) {
        return res.status(400).json({
          success: false,
          code: error?.code ?? 'INTERVIEW_INVALID_PAYLOAD',
          message: error?.message ?? 'Os dados informados para criar a entrevista são inválidos.',
        });
      }

      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao criar entrevista no contexto do aluno',
      );

      return res.status(500).json({
        success: false,
        code: error?.code ?? 'STUDENT_INTERVIEW_CREATE_ERROR',
        message: error?.message ?? 'Não foi possível criar a entrevista no contexto do aluno.',
      });
    }
  };

  /**
   * Listar histórico de inscrições de um aluno
   * Similar ao histórico de empresas (/api/v1/empresas/{id}/vagas)
   */
  static listHistoricoInscricoes = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
        });
      }

      // Validar e parsear query params
      const query = alunoHistoricoInscricoesQuerySchema.parse(req.query);
      const { page, pageSize, status } = query;
      const skip = (page - 1) * pageSize;

      // Verificar se aluno existe e é do tipo ALUNO_CANDIDATO
      const alunoExiste = await prisma.usuarios.findUnique({
        where: {
          id: alunoId,
          role: 'ALUNO_CANDIDATO',
        },
        select: { id: true },
      });

      if (!alunoExiste) {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado ou não possui role de ALUNO_CANDIDATO.',
        });
      }

      // Construir filtro
      const where: any = {
        alunoId,
      };

      // Filtro por status se fornecido
      if (status && status.length > 0) {
        where.status = { in: status };
      }

      // Buscar inscrições com paginação
      const [total, inscricoes] = await Promise.all([
        prisma.cursosTurmasInscricoes.count({ where }),
        prisma.cursosTurmasInscricoes.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { criadoEm: 'desc' },
          select: {
            id: true,
            status: true,
            criadoEm: true,
            CursosTurmas: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                status: true,
                dataInicio: true,
                dataFim: true,
                Cursos: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    descricao: true,
                    cargaHoraria: true,
                    imagemUrl: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const progressoMap = await calcularProgressoCursoBatch(
        inscricoes.map((inscricao) => ({
          id: inscricao.id,
          CursosTurmas: {
            id: inscricao.CursosTurmas.id,
            dataInicio: inscricao.CursosTurmas.dataInicio,
            dataFim: inscricao.CursosTurmas.dataFim,
          },
        })),
      );

      const data = inscricoes.map((inscricao) => ({
        id: inscricao.id,
        statusInscricao: inscricao.status,
        criadoEm: inscricao.criadoEm,
        progresso: progressoMap[inscricao.id] ?? 0,
        turma: {
          id: inscricao.CursosTurmas.id,
          nome: inscricao.CursosTurmas.nome,
          codigo: inscricao.CursosTurmas.codigo,
          status: inscricao.CursosTurmas.status,
          dataInicio: inscricao.CursosTurmas.dataInicio,
          dataFim: inscricao.CursosTurmas.dataFim,
        },
        curso: {
          id: inscricao.CursosTurmas.Cursos.id,
          nome: inscricao.CursosTurmas.Cursos.nome,
          codigo: inscricao.CursosTurmas.Cursos.codigo,
          descricao: inscricao.CursosTurmas.Cursos.descricao,
          cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
          imagemUrl: inscricao.CursosTurmas.Cursos.imagemUrl,
        },
      }));

      res.json({
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao buscar histórico de inscrições do aluno',
      );

      res.status(500).json({
        success: false,
        code: 'ALUNOS_HISTORICO_ERROR',
        message: 'Erro ao buscar histórico de inscrições do aluno',
        error: error?.message,
      });
    }
  };

  /**
   * Listar histórico de inscrições de um curso
   * Similar ao histórico de alunos, mas filtrado por cursoId
   */
  static listHistoricoInscricoesPorCurso = async (req: Request, res: Response) => {
    try {
      const { cursoId } = req.params;

      // Validar UUID do curso
      const cursoIdValidado = parseCourseId(cursoId);
      if (!cursoIdValidado) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CURSO_ID',
          message: 'ID do curso inválido. Deve ser um UUID válido.',
        });
      }

      // Validar e parsear query params
      const query = cursoHistoricoInscricoesQuerySchema.parse(req.query);
      const { page, pageSize, status, turmaId, statusPagamento, includeProgress } = query;
      const skip = (page - 1) * pageSize;
      const cacheKey = generateCacheKey(
        'cursos:historico-inscricoes-curso',
        {
          cursoId: cursoIdValidado,
          page,
          pageSize,
          status: status?.join(',') || '',
          statusPagamento: statusPagamento?.join(',') || '',
          includeProgress: includeProgress ? '1' : '0',
          turmaId: turmaId || '',
          role: req.user?.role || '',
        },
        { excludeKeys: [] },
      );

      const result = await getCachedOrFetch(
        cacheKey,
        async () => {
          // Construir filtro
          const where: any = {
            CursosTurmas: {
              cursoId: cursoIdValidado,
            },
          };

          // Filtro por turma se fornecido
          if (turmaId) {
            where.turmaId = turmaId;
          }

          // Filtro por status se fornecido
          if (status && status.length > 0) {
            where.status = { in: status };
          }

          // Filtro por status de pagamento se fornecido
          if (statusPagamento && statusPagamento.length > 0) {
            where.statusPagamento = { in: statusPagamento };
          }

          // Buscar inscrições com paginação
          const [total, inscricoes] = await Promise.all([
            prisma.cursosTurmasInscricoes.count({ where }),
            prisma.cursosTurmasInscricoes.findMany({
              where,
              skip,
              take: pageSize,
              orderBy: { criadoEm: 'desc' },
              select: {
                id: true,
                status: true,
                statusPagamento: true,
                criadoEm: true,
                alunoId: true,
                CursosTurmas: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    status: true,
                    dataInicio: true,
                    dataFim: true,
                    Cursos: {
                      select: {
                        id: true,
                        nome: true,
                        codigo: true,
                        descricao: true,
                        cargaHoraria: true,
                        imagemUrl: true,
                      },
                    },
                  },
                },
                Usuarios: {
                  select: {
                    id: true,
                    nomeCompleto: true,
                    email: true,
                    codUsuario: true,
                    cpf: true,
                    status: true,
                    UsuariosInformation: {
                      select: {
                        avatarUrl: true,
                      },
                    },
                    UsuariosEnderecos: {
                      select: {
                        cidade: true,
                        estado: true,
                      },
                      take: 1,
                      orderBy: {
                        criadoEm: 'desc',
                      },
                    },
                  },
                },
              },
            }),
          ]);

          // Só valida existência do curso quando não há inscrições
          if (total === 0) {
            const cursoExiste = await prisma.cursos.findUnique({
              where: { id: cursoIdValidado },
              select: { id: true },
            });

            if (!cursoExiste) {
              const error: any = new Error('Curso não encontrado.');
              error.code = 'CURSO_NOT_FOUND';
              throw error;
            }
          }

          const progressoMap = includeProgress ? await calcularProgressoCursoBatch(inscricoes) : {};

          const data = inscricoes.map((inscricao) => ({
            id: inscricao.id,
            statusInscricao: inscricao.status,
            statusPagamento: inscricao.statusPagamento,
            criadoEm: inscricao.criadoEm,
            progresso: includeProgress ? (progressoMap[inscricao.id] ?? 0) : null,
            aluno: {
              id: inscricao.Usuarios.id,
              nomeCompleto: inscricao.Usuarios.nomeCompleto,
              email: inscricao.Usuarios.email,
              codigo: inscricao.Usuarios.codUsuario,
              cpf: inscricao.Usuarios.cpf,
              status: inscricao.Usuarios.status,
              avatarUrl: inscricao.Usuarios.UsuariosInformation?.avatarUrl || null,
              cidade: inscricao.Usuarios.UsuariosEnderecos?.[0]?.cidade || null,
              estado: inscricao.Usuarios.UsuariosEnderecos?.[0]?.estado || null,
            },
            turma: {
              id: inscricao.CursosTurmas.id,
              nome: inscricao.CursosTurmas.nome,
              codigo: inscricao.CursosTurmas.codigo,
              status: inscricao.CursosTurmas.status,
              dataInicio: inscricao.CursosTurmas.dataInicio,
              dataFim: inscricao.CursosTurmas.dataFim,
            },
            curso: {
              id: inscricao.CursosTurmas.Cursos.id,
              nome: inscricao.CursosTurmas.Cursos.nome,
              codigo: inscricao.CursosTurmas.Cursos.codigo,
              descricao: inscricao.CursosTurmas.Cursos.descricao,
              cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
              imagemUrl: inscricao.CursosTurmas.Cursos.imagemUrl,
            },
          }));

          return {
            data,
            pagination: {
              page,
              pageSize,
              total,
              totalPages: Math.ceil(total / pageSize),
            },
          };
        },
        CURSOS_INSCRICOES_CACHE_TTL,
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado.',
        });
      }

      logger.error(
        {
          cursoId: req.params.cursoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao buscar histórico de inscrições do curso',
      );

      res.status(500).json({
        success: false,
        code: 'CURSO_HISTORICO_ERROR',
        message: 'Erro ao buscar histórico de inscrições do curso',
        error: error?.message,
      });
    }
  };

  /**
   * Atualizar informações de um aluno específico (ADMIN/MODERADOR apenas)
   */
  static atualizarAlunoById = async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(alunoId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do aluno inválido. Deve ser um UUID válido.',
        });
      }

      // Extrair dados da requisição
      const {
        nomeCompleto,
        email,
        telefone,
        genero,
        dataNasc,
        descricao,
        avatarUrl,
        redesSociais,
        endereco,
        senha,
        confirmarSenha,
      } = req.body;

      // Validar senha se fornecida
      if (senha !== undefined || confirmarSenha !== undefined) {
        if (senha === undefined || confirmarSenha === undefined) {
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_CONFIRMATION_REQUIRED',
            message: 'Informe senha e confirmarSenha para redefinir a senha',
          });
        }

        if (senha !== confirmarSenha) {
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_MISMATCH',
            message: 'Senha e confirmarSenha devem ser iguais',
          });
        }

        if (senha.length < 8) {
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_TOO_SHORT',
            message: 'Senha deve ter pelo menos 8 caracteres',
          });
        }
      }

      // Validar email se fornecido
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_EMAIL',
            message: 'Informe um e-mail válido',
          });
        }
      }

      // Sanitizar redes sociais
      const redesSociaisSanitizado = sanitizeSocialLinks(redesSociais);
      const redesSociaisUpdate = buildSocialLinksUpdateData(redesSociaisSanitizado);

      // Atualizar aluno com transação
      const alunoAtualizado = await retryOperation(
        async () => {
          return await prisma.$transaction(async (tx) => {
            // Verificar se aluno existe e é do tipo ALUNO_CANDIDATO
            const alunoExistente = await tx.usuarios.findUnique({
              where: { id: alunoId },
              select: {
                id: true,
                role: true,
                UsuariosInformation: true, // Buscar a relação completa
                UsuariosRedesSociais: true, // Buscar a relação completa
              },
            });

            if (!alunoExistente) {
              throw Object.assign(new Error('Aluno não encontrado'), {
                code: 'ALUNO_NOT_FOUND',
                statusCode: 404,
              });
            }

            if (alunoExistente.role !== 'ALUNO_CANDIDATO') {
              throw Object.assign(new Error('Usuário não é um aluno'), {
                code: 'INVALID_USER_TYPE',
                statusCode: 400,
              });
            }

            // Verificar se email já existe
            if (email !== undefined) {
              const emailJaExiste = await tx.usuarios.findFirst({
                where: {
                  email: email.trim().toLowerCase(),
                  id: { not: alunoId },
                },
              });

              if (emailJaExiste) {
                throw Object.assign(new Error('Este e-mail já está em uso por outro usuário'), {
                  code: 'EMAIL_ALREADY_EXISTS',
                  statusCode: 409,
                });
              }
            }

            // Preparar dados de atualização
            const dadosAtualizacao: any = {};
            if (nomeCompleto !== undefined) {
              dadosAtualizacao.nomeCompleto = nomeCompleto.trim();
            }
            if (email !== undefined) {
              dadosAtualizacao.email = email.trim().toLowerCase();
            }
            if (senha !== undefined) {
              dadosAtualizacao.senha = await bcrypt.hash(senha, 12);
            }
            if (Object.keys(dadosAtualizacao).length > 0) {
              dadosAtualizacao.atualizadoEm = new Date();
            }

            // Atualizar dados básicos do usuário
            if (Object.keys(dadosAtualizacao).length > 0) {
              await tx.usuarios.update({
                where: { id: alunoId },
                data: dadosAtualizacao,
              });
            }

            // Preparar dados de informações
            const dadosInformacoes: any = {};
            if (telefone !== undefined) dadosInformacoes.telefone = telefone?.trim() || null;
            if (genero !== undefined) dadosInformacoes.genero = genero || null;
            if (dataNasc !== undefined)
              dadosInformacoes.dataNasc = dataNasc ? new Date(dataNasc) : null;
            if (descricao !== undefined) dadosInformacoes.descricao = descricao?.trim() || null;
            if (avatarUrl !== undefined) dadosInformacoes.avatarUrl = avatarUrl?.trim() || null;

            // Atualizar ou criar informações
            if (Object.keys(dadosInformacoes).length > 0) {
              if (alunoExistente.UsuariosInformation) {
                await tx.usuariosInformation.update({
                  where: { usuarioId: alunoId },
                  data: dadosInformacoes,
                });
              } else {
                await tx.usuariosInformation.create({
                  data: {
                    usuarioId: alunoId,
                    ...dadosInformacoes,
                  },
                });
              }
            }

            // Atualizar ou criar redes sociais
            if (redesSociaisUpdate) {
              if (alunoExistente.UsuariosRedesSociais) {
                await tx.usuariosRedesSociais.update({
                  where: { usuarioId: alunoId },
                  data: {
                    ...redesSociaisUpdate,
                    updatedAt: new Date(),
                  },
                });
              } else {
                await tx.usuariosRedesSociais.create({
                  data: {
                    usuarioId: alunoId,
                    ...redesSociaisUpdate,
                    updatedAt: new Date(),
                  },
                });
              }
            }

            // Atualizar endereço se fornecido
            if (endereco && typeof endereco === 'object') {
              const dadosEndereco: any = {};
              if (endereco.logradouro !== undefined)
                dadosEndereco.logradouro = endereco.logradouro?.trim() || null;
              if (endereco.numero !== undefined)
                dadosEndereco.numero = endereco.numero?.trim() || null;
              if (endereco.bairro !== undefined)
                dadosEndereco.bairro = endereco.bairro?.trim() || null;
              if (endereco.cidade !== undefined)
                dadosEndereco.cidade = endereco.cidade?.trim() || null;
              if (endereco.estado !== undefined)
                dadosEndereco.estado = endereco.estado?.trim() || null;
              if (endereco.cep !== undefined)
                dadosEndereco.cep = endereco.cep?.replace(/\D/g, '') || null;

              // Atualizar timestamp
              dadosEndereco.atualizadoEm = new Date();

              // Se tem algum campo preenchido, atualizar endereço
              if (Object.keys(dadosEndereco).length > 1) {
                // Buscar endereço mais recente do aluno
                const enderecoExistente = await tx.usuariosEnderecos.findFirst({
                  where: { usuarioId: alunoId },
                  orderBy: { criadoEm: 'desc' },
                });

                if (enderecoExistente) {
                  // Atualizar endereço existente
                  await tx.usuariosEnderecos.update({
                    where: { id: enderecoExistente.id },
                    data: dadosEndereco,
                  });
                } else {
                  // Criar novo endereço
                  await tx.usuariosEnderecos.create({
                    data: {
                      usuarioId: alunoId,
                      ...dadosEndereco,
                    },
                  });
                }
              }
            }

            // Buscar dados completos atualizados
            const alunoCompleto = await tx.usuarios.findUnique({
              where: { id: alunoId },
              select: {
                id: true,
                codUsuario: true,
                nomeCompleto: true,
                email: true,
                cpf: true,
                status: true,
                criadoEm: true,
                atualizadoEm: true,
                ultimoLogin: true,
                UsuariosInformation: {
                  select: {
                    telefone: true,
                    genero: true,
                    dataNasc: true,
                    descricao: true,
                    avatarUrl: true,
                  },
                },
                UsuariosRedesSociais: {
                  select: {
                    linkedin: true,
                    instagram: true,
                    facebook: true,
                    youtube: true,
                    twitter: true,
                    tiktok: true,
                  },
                },
                UsuariosEnderecos: {
                  select: {
                    id: true,
                    logradouro: true,
                    numero: true,
                    bairro: true,
                    cidade: true,
                    estado: true,
                    cep: true,
                    criadoEm: true,
                  },
                  orderBy: {
                    criadoEm: 'desc',
                  },
                },
              },
            });

            return alunoCompleto!;
          });
        },
        3,
        1500,
      );

      // Invalidar cache do usuário
      await invalidateUserCache(alunoAtualizado);
      await invalidateCursosAlunosCache();

      logger.info(
        {
          alunoId,
          nomeCompleto: req.body.nomeCompleto,
          camposAtualizados: Object.keys(req.body).filter((k) => req.body[k] !== undefined),
        },
        '✅ Informações do aluno atualizadas com sucesso',
      );

      // Retornar resposta formatada
      const response = {
        id: alunoAtualizado.id,
        codigo: alunoAtualizado.codUsuario,
        nomeCompleto: alunoAtualizado.nomeCompleto,
        email: alunoAtualizado.email,
        cpf: alunoAtualizado.cpf,
        telefone: alunoAtualizado.UsuariosInformation?.telefone || null,
        status: alunoAtualizado.status,
        genero: alunoAtualizado.UsuariosInformation?.genero || null,
        dataNasc: alunoAtualizado.UsuariosInformation?.dataNasc || null,
        descricao: alunoAtualizado.UsuariosInformation?.descricao || null,
        avatarUrl: alunoAtualizado.UsuariosInformation?.avatarUrl || null,
        criadoEm: alunoAtualizado.criadoEm,
        atualizadoEm: alunoAtualizado.atualizadoEm,
        ultimoLogin: alunoAtualizado.ultimoLogin,
        enderecos: (alunoAtualizado as any).UsuariosEnderecos || [],
        redesSociais: mapSocialLinks(alunoAtualizado.UsuariosRedesSociais),
      };

      res.json({
        success: true,
        message: 'Informações do aluno atualizadas com sucesso',
        data: response,
      });
    } catch (error: any) {
      logger.error(
        {
          alunoId: req.params.alunoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao atualizar informações do aluno',
      );

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado ou não possui role de ALUNO_CANDIDATO.',
        });
      }

      if (error?.code === 'INVALID_USER_TYPE') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_USER_TYPE',
          message: 'O usuário especificado não é um aluno.',
        });
      }

      if (error?.code === 'EMAIL_ALREADY_EXISTS') {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Este e-mail já está em uso por outro usuário',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ALUNO_UPDATE_ERROR',
        message: 'Erro ao atualizar informações do aluno',
        error: error?.message,
      });
    }
  };

  /**
   * Visão geral de cursos com métricas e faturamento
   * Acesso restrito a ADMIN e MODERADOR
   */
  /**
   * Obter histórico de auditoria de um curso
   */
  static getHistoricoAuditoria = async (req: Request, res: Response) => {
    try {
      const { cursoId } = req.params;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;

      // Validar UUID do curso
      const cursoIdValidado = parseCourseId(cursoId);
      if (!cursoIdValidado) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CURSO_ID',
          message: 'ID do curso inválido. Deve ser um UUID válido.',
        });
      }

      const cacheKey = generateCacheKey(
        'cursos:auditoria',
        {
          cursoId: cursoIdValidado,
          page,
          pageSize,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const response = await getCachedOrFetch(
        cacheKey,
        async () => {
          const cursoExiste = await prisma.cursos.findUnique({
            where: { id: cursoIdValidado },
            select: { id: true, nome: true },
          });

          if (!cursoExiste) {
            const error: any = new Error('Curso não encontrado');
            error.code = 'CURSO_NOT_FOUND';
            throw error;
          }

          const historico = await cursosAuditoriaService.obterHistoricoAlteracoes(
            cursoIdValidado,
            page,
            pageSize,
          );

          return {
            success: true,
            data: historico.items,
            pagination: {
              page: historico.page,
              pageSize: historico.pageSize,
              total: historico.total,
              totalPages: historico.totalPages,
            },
          };
        },
        CURSOS_AUDITORIA_CACHE_TTL,
      );

      res.json(response);
    } catch (error: any) {
      if (error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado.',
        });
      }

      logger.error(
        {
          cursoId: req.params.cursoId,
          error: error?.message,
          code: error?.code,
        },
        '❌ Erro ao buscar histórico de auditoria do curso',
      );

      res.status(500).json({
        success: false,
        code: 'CURSO_AUDITORIA_ERROR',
        message: 'Erro ao buscar histórico de auditoria do curso',
        error: error?.message,
      });
    }
  };

  static visaogeral = async (req: Request, res: Response) => {
    try {
      const cacheKey = generateCacheKey(
        'cursos:visaogeral',
        {
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const response = await getCachedOrFetch(
        cacheKey,
        async () => {
          const visaoGeral = await buscarVisaoGeralCursos();
          return {
            success: true,
            data: visaoGeral,
          };
        },
        CURSOS_VISAOGERAL_CACHE_TTL,
      );

      res.json(response);
    } catch (error: any) {
      // ✅ Tratar erros de conexão do Prisma (P1001) como 503 Service Unavailable
      const errorCode = (error as any)?.code;
      const errorMessage = String((error as any)?.message || '').toLowerCase();
      const isPrismaConnectionError =
        (error instanceof PrismaClientKnownRequestError &&
          (error.code === 'P1001' || error.code === 'P2024')) ||
        errorCode === 'P1001' ||
        errorCode === 'P2024' ||
        errorMessage.includes("can't reach database") ||
        errorMessage.includes('database server') ||
        errorMessage.includes('connection') ||
        errorMessage.includes("can't reach");

      if (isPrismaConnectionError) {
        logger.warn(
          {
            error: error?.message,
            code: errorCode,
          },
          '⚠️ Erro de conexão ao buscar visão geral de cursos',
        );

        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      logger.error(
        {
          error: error?.message,
          stack: error?.stack,
        },
        'Erro ao buscar visão geral de cursos',
      );

      res.status(500).json({
        success: false,
        code: 'CURSOS_VISAOGERAL_ERROR',
        message: 'Erro ao buscar visão geral de cursos',
        error: error?.message,
      });
    }
  };

  static visaogeralFaturamento = async (req: Request, res: Response) => {
    try {
      const pickFirst = (value: unknown) => (Array.isArray(value) ? value[0] : value);

      const period = String(pickFirst(req.query.period) ?? 'month');
      const startDate = pickFirst(req.query.startDate);
      const endDate = pickFirst(req.query.endDate);
      const tz = pickFirst(req.query.tz);
      const top = pickFirst(req.query.top);
      const parsedTop =
        typeof top === 'string' ? Number(top) : typeof top === 'number' ? top : undefined;

      const cacheKey = generateCacheKey(
        'cursos:visaogeral:faturamento',
        {
          role: req.user?.role ?? '',
          period,
          startDate: typeof startDate === 'string' ? startDate : '',
          endDate: typeof endDate === 'string' ? endDate : '',
          tz: typeof tz === 'string' ? tz : '',
          top: Number.isFinite(parsedTop) ? parsedTop : '',
        },
        { excludeKeys: [] },
      );

      const result = await getCachedOrFetch(
        cacheKey,
        () =>
          buscarFaturamentoTendenciasCursos({
            period: period as any,
            startDate: typeof startDate === 'string' ? startDate : undefined,
            endDate: typeof endDate === 'string' ? endDate : undefined,
            tz: typeof tz === 'string' ? tz : undefined,
            top: parsedTop,
          }),
        CURSOS_VISAOGERAL_FATURAMENTO_CACHE_TTL,
      );

      res.json(result);
    } catch (error: any) {
      const status = typeof error?.status === 'number' ? error.status : 500;

      if (status === 400) {
        return res.status(400).json({
          success: false,
          code: error?.code ?? 'VALIDATION_ERROR',
          message: error?.message ?? 'Parâmetros inválidos',
        });
      }

      // ✅ Tratar erros de conexão do Prisma (P1001) como 503 Service Unavailable
      const errorCode = (error as any)?.code;
      const errorMessage = String((error as any)?.message || '').toLowerCase();
      const isPrismaConnectionError =
        (error instanceof PrismaClientKnownRequestError &&
          (error.code === 'P1001' || error.code === 'P2024')) ||
        errorCode === 'P1001' ||
        errorCode === 'P2024' ||
        errorMessage.includes("can't reach database") ||
        errorMessage.includes('database server') ||
        errorMessage.includes('connection') ||
        errorMessage.includes("can't reach");

      if (isPrismaConnectionError) {
        logger.warn(
          {
            error: error?.message,
            code: errorCode,
          },
          '⚠️ Erro de conexão ao buscar faturamento de cursos (tendências)',
        );

        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      logger.error(
        {
          error: error?.message,
          stack: error?.stack,
        },
        'Erro ao buscar faturamento de cursos (tendências)',
      );

      res.status(500).json({
        success: false,
        code: 'CURSOS_VISAOGERAL_FATURAMENTO_ERROR',
        message: 'Erro ao buscar faturamento de cursos',
        error: error?.message,
      });
    }
  };
}
