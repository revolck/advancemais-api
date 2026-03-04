import { Request, Response } from 'express';
import { CursosEstagioProgramaStatus } from '@prisma/client';
import { ZodError } from 'zod';

import { Roles } from '@/modules/usuarios/enums/Roles';

import { estagiosService } from '../services/estagios.service';
import { estagiosProgramasService } from '../services/estagios-programas.service';
import {
  alocarAlunoGrupoEstagioSchema,
  confirmarEstagioSchema,
  concluirEstagioAlunoSchema,
  createEstagioProgramaSchema,
  createEstagioSchema,
  listEstagiosAlunoQuerySchema,
  listFrequenciaHistoricoEstagioQuerySchema,
  listFrequenciasEstagioAlunoPeriodoQuerySchema,
  listFrequenciasEstagioAlunoQuerySchema,
  listEstagiosProgramasQuerySchema,
  listFrequenciasEstagioQuerySchema,
  listFrequenciasEstagioPeriodoQuerySchema,
  reenviarConfirmacaoSchema,
  upsertFrequenciaEstagioSchema,
  updateEstagioProgramaSchema,
  updateEstagioSchema,
  updateEstagioStatusSchema,
  vincularAlunosEstagioSchema,
} from '../validators/estagios.schema';

const parseCursoId = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  // Cursos.id agora é UUID (String), não mais Int
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value.trim())) {
    return null;
  }
  return value.trim();
};

const parseUuid = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value;
};

const resolveClientIp = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.trim() ?? null;
  }
  return req.ip ?? null;
};

const resolveRequestOrigin = (req: Request): 'WEB' | 'MOBILE' | 'API' => {
  const explicitOrigin = req.headers['x-client-origin'] ?? req.headers['x-origin'];
  if (typeof explicitOrigin === 'string') {
    const normalized = explicitOrigin.trim().toUpperCase();
    if (normalized === 'WEB' || normalized === 'MOBILE' || normalized === 'API') {
      return normalized;
    }
  }

  const userAgent = (req.headers['user-agent'] ?? '').toString().toLowerCase();
  if (
    userAgent.includes('postman') ||
    userAgent.includes('insomnia') ||
    userAgent.includes('curl')
  ) {
    return 'API';
  }
  if (/android|iphone|ipad|mobile/u.test(userAgent)) {
    return 'MOBILE';
  }
  return userAgent ? 'WEB' : 'API';
};

const ensureAlunoScopeAccess = (req: Request, res: Response, alunoId: string) => {
  if (req.user?.role === Roles.ALUNO_CANDIDATO && req.user.id !== alunoId) {
    res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para acessar dados de outro aluno.',
    });
    return false;
  }
  return true;
};

export class EstagiosController {
  static async list(req: Request, res: Response) {
    try {
      const query = listEstagiosProgramasQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.list(query);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de estágios',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIOS_LIST_ERROR',
        message: 'Erro ao listar estágios',
        error: error?.message,
      });
    }
  }

  static async listAluno(req: Request, res: Response) {
    const alunoId = parseUuid(req.params.alunoId);
    if (!alunoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de aluno inválido',
      });
    }

    if (!ensureAlunoScopeAccess(req, res, alunoId)) {
      return;
    }

    try {
      const query = listEstagiosAlunoQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.listByAluno(alunoId, query);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de estágios do aluno',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIOS_ALUNO_LIST_ERROR',
        message: 'Erro ao listar estágios do aluno',
        error: error?.message,
      });
    }
  }

  static async getAlunoById(req: Request, res: Response) {
    const alunoId = parseUuid(req.params.alunoId);
    const estagioId = parseUuid(req.params.estagioId);
    if (!alunoId || !estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos',
      });
    }

    if (!ensureAlunoScopeAccess(req, res, alunoId)) {
      return;
    }

    try {
      const result = await estagiosProgramasService.getByIdForAluno(alunoId, estagioId);
      return res.json(result);
    } catch (error: any) {
      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }
      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_ALUNO_DETAIL_ERROR',
        message: 'Erro ao buscar estágio no contexto do aluno',
        error: error?.message,
      });
    }
  }

  static async createPrograma(req: Request, res: Response) {
    try {
      const payload = createEstagioProgramaSchema.parse(req.body);
      const result = await estagiosProgramasService.create(payload, req.user?.id);
      return res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para cadastro de estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_CURSO_INVALIDOS') {
        return res.status(400).json({
          success: false,
          code: 'TURMA_CURSO_INVALIDOS',
          message: 'Turma não pertence ao curso informado',
        });
      }

      if (error?.code === 'ESTAGIO_VALIDO_VIGENTE') {
        return res.status(409).json({
          success: false,
          code: 'ESTAGIO_VALIDO_VIGENTE',
          message: 'Existe estágio válido vigente para um ou mais alunos',
          data: error?.data ?? null,
        });
      }

      if (error?.code === 'CAPACIDADE_GRUPOS_INSUFICIENTE') {
        return res.status(400).json({
          success: false,
          code: 'CAPACIDADE_GRUPOS_INSUFICIENTE',
          message:
            'A capacidade total dos grupos é insuficiente para a quantidade de alunos da turma. Ajuste as capacidades ou crie novos grupos.',
        });
      }

      if (error?.code === 'GRUPO_OBRIGATORIO_PARA_ALOCACAO') {
        return res.status(400).json({
          success: false,
          code: 'GRUPO_OBRIGATORIO_PARA_ALOCACAO',
          message: 'Informe grupo para alocação de alunos neste estágio',
        });
      }

      if (error?.code === 'HORARIO_INVALIDO') {
        return res.status(400).json({
          success: false,
          code: 'HORARIO_INVALIDO',
          message: error?.message ?? 'Horário inválido',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_CREATE_ERROR',
        message: 'Erro ao cadastrar estágio',
        error: error?.message,
      });
    }
  }

  static async getPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const result = await estagiosProgramasService.getById(estagioId);
      return res.json(result);
    } catch (error: any) {
      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_GET_ERROR',
        message: 'Erro ao buscar detalhe do estágio',
        error: error?.message,
      });
    }
  }

  static async updatePrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = updateEstagioProgramaSchema.parse(req.body);
      const result = await estagiosProgramasService.update(estagioId, payload, req.user?.id);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para edição de estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      if (error?.code === 'TURMA_CURSO_INVALIDOS') {
        return res.status(400).json({
          success: false,
          code: 'TURMA_CURSO_INVALIDOS',
          message: 'Turma não pertence ao curso informado',
        });
      }

      if (error?.code === 'CAPACIDADE_GRUPOS_INSUFICIENTE') {
        return res.status(400).json({
          success: false,
          code: 'CAPACIDADE_GRUPOS_INSUFICIENTE',
          message:
            'A capacidade total dos grupos é insuficiente para a quantidade de alunos da turma. Ajuste as capacidades ou crie novos grupos.',
        });
      }

      if (error?.code === 'GRUPO_OBRIGATORIO_PARA_ALOCACAO') {
        return res.status(400).json({
          success: false,
          code: 'GRUPO_OBRIGATORIO_PARA_ALOCACAO',
          message: 'Informe grupo para alocação de alunos neste estágio',
        });
      }

      if (error?.code === 'HORARIO_INVALIDO') {
        return res.status(400).json({
          success: false,
          code: 'HORARIO_INVALIDO',
          message: error?.message ?? 'Horário inválido',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_UPDATE_ERROR',
        message: 'Erro ao atualizar estágio',
        error: error?.message,
      });
    }
  }

  static async vincularAlunosPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = vincularAlunosEstagioSchema.parse(req.body);
      const result = await estagiosProgramasService.vincularAlunos(
        estagioId,
        payload,
        req.user?.id,
      );
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para vínculo de alunos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      if (error?.code === 'ESTAGIO_VALIDO_VIGENTE') {
        return res.status(409).json({
          success: false,
          code: 'ESTAGIO_VALIDO_VIGENTE',
          message: 'Existe estágio válido vigente para um ou mais alunos',
          data: error?.data ?? null,
        });
      }

      if (error?.code === 'GRUPO_OBRIGATORIO_PARA_ALOCACAO') {
        return res.status(400).json({
          success: false,
          code: 'GRUPO_OBRIGATORIO_PARA_ALOCACAO',
          message: 'Informe grupo para alocação de alunos neste estágio',
        });
      }

      if (error?.code === 'CAPACIDADE_GRUPOS_INSUFICIENTE') {
        return res.status(400).json({
          success: false,
          code: 'CAPACIDADE_GRUPOS_INSUFICIENTE',
          message:
            'A capacidade total dos grupos é insuficiente para a quantidade de alunos da turma. Ajuste as capacidades ou crie novos grupos.',
        });
      }

      if (error?.code === 'ALUNO_EM_GRUPOS_DUPLICADOS') {
        return res.status(400).json({
          success: false,
          code: 'ALUNO_EM_GRUPOS_DUPLICADOS',
          message: 'Um ou mais alunos já estão alocados em outro grupo deste estágio',
          data: error?.data ?? null,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_VINCULAR_ERROR',
        message: 'Erro ao vincular alunos ao estágio',
        error: error?.message,
      });
    }
  }

  static async alocarAlunoGrupoPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    const estagioAlunoId = parseUuid(req.params.estagioAlunoId);

    if (!estagioId || !estagioAlunoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para alocação do aluno',
      });
    }

    try {
      const payload = alocarAlunoGrupoEstagioSchema.parse(req.body);
      const result = await estagiosProgramasService.alocarGrupo(
        estagioId,
        estagioAlunoId,
        payload.grupoId,
        req.user?.id,
      );
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para alocação do aluno',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_ALUNO_NOT_FOUND',
          message: 'Aluno não está vinculado ao estágio',
        });
      }

      if (error?.code === 'GRUPO_OBRIGATORIO_PARA_ALOCACAO') {
        return res.status(400).json({
          success: false,
          code: 'GRUPO_OBRIGATORIO_PARA_ALOCACAO',
          message: 'Este estágio não utiliza grupos para alocação manual',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_GRUPO_ERROR',
        message: 'Erro ao alocar aluno no grupo',
        error: error?.message,
      });
    }
  }

  static async listFrequenciasPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const query = listFrequenciasEstagioQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.listFrequencias(estagioId, query);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de frequência',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_LIST_ERROR',
        message: 'Erro ao listar frequências do estágio',
        error: error?.message,
      });
    }
  }

  static async listFrequenciasPeriodoPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const query = listFrequenciasEstagioPeriodoQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.listFrequenciasPeriodo(estagioId, query);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de frequência por período',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_PERIODO_LIST_ERROR',
        message: 'Erro ao listar frequências do estágio por período',
        error: error?.message,
      });
    }
  }

  static async listFrequenciasProgramaAluno(req: Request, res: Response) {
    const alunoId = parseUuid(req.params.alunoId);
    const estagioId = parseUuid(req.params.estagioId);
    if (!alunoId || !estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para listagem de frequências',
      });
    }

    if (!ensureAlunoScopeAccess(req, res, alunoId)) {
      return;
    }

    try {
      const query = listFrequenciasEstagioAlunoQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.listFrequenciasByAluno(alunoId, estagioId, {
        ...query,
        grupoId: undefined,
      });
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de frequências do aluno',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_ALUNO_LIST_ERROR',
        message: 'Erro ao listar frequências do estágio no contexto do aluno',
        error: error?.message,
      });
    }
  }

  static async listFrequenciasPeriodoProgramaAluno(req: Request, res: Response) {
    const alunoId = parseUuid(req.params.alunoId);
    const estagioId = parseUuid(req.params.estagioId);
    if (!alunoId || !estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para listagem de frequência por período',
      });
    }

    if (!ensureAlunoScopeAccess(req, res, alunoId)) {
      return;
    }

    try {
      const query = listFrequenciasEstagioAlunoPeriodoQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.listFrequenciasPeriodoByAluno(
        alunoId,
        estagioId,
        {
          ...query,
          grupoId: undefined,
        },
      );
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de frequência por período do aluno',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_PERIODO_ALUNO_LIST_ERROR',
        message: 'Erro ao listar frequência por período no contexto do aluno',
        error: error?.message,
      });
    }
  }

  static async upsertFrequenciaPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = upsertFrequenciaEstagioSchema.parse(req.body);
      const result = await estagiosProgramasService.upsertFrequencia(
        estagioId,
        payload,
        req.user?.id,
        {
          ip: resolveClientIp(req),
          userAgent: req.get('user-agent') ?? null,
          origem: resolveRequestOrigin(req),
        },
      );
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const hasMotivoError = error.issues.some((issue) => issue.path.includes('motivo'));
        return res.status(400).json({
          success: false,
          code: hasMotivoError ? 'JUSTIFICATIVA_OBRIGATORIA' : 'VALIDATION_ERROR',
          message: hasMotivoError
            ? 'Motivo é obrigatório para ausência'
            : 'Dados inválidos para lançamento de frequência',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_ALUNO_NOT_FOUND',
          message: 'Aluno não vinculado ao estágio',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_UPSERT_ERROR',
        message: 'Erro ao lançar frequência do estágio',
        error: error?.message,
      });
    }
  }

  static async upsertFrequenciaProgramaAluno(req: Request, res: Response) {
    const alunoId = parseUuid(req.params.alunoId);
    const estagioId = parseUuid(req.params.estagioId);
    if (!alunoId || !estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para lançamento de frequência',
      });
    }

    if (!ensureAlunoScopeAccess(req, res, alunoId)) {
      return;
    }

    try {
      const payload = upsertFrequenciaEstagioSchema.parse(req.body);
      const result = await estagiosProgramasService.upsertFrequenciaByAluno(
        alunoId,
        estagioId,
        payload,
        req.user?.id,
        {
          ip: resolveClientIp(req),
          userAgent: req.get('user-agent') ?? null,
          origem: resolveRequestOrigin(req),
        },
      );
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const hasMotivoError = error.issues.some((issue) => issue.path.includes('motivo'));
        return res.status(400).json({
          success: false,
          code: hasMotivoError ? 'JUSTIFICATIVA_OBRIGATORIA' : 'VALIDATION_ERROR',
          message: hasMotivoError
            ? 'Motivo é obrigatório para ausência'
            : 'Dados inválidos para lançamento de frequência',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if (error?.code === 'ESTAGIO_ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_ALUNO_NOT_FOUND',
          message: 'Aluno não vinculado ao estágio',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_ALUNO_UPSERT_ERROR',
        message: 'Erro ao lançar frequência no contexto do aluno',
        error: error?.message,
      });
    }
  }

  static async listFrequenciaHistoricoPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    const frequenciaId = parseUuid(req.params.frequenciaId);
    if (!estagioId || !frequenciaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para histórico',
      });
    }

    try {
      const hasPaginationQuery = req.query.page != null || req.query.pageSize != null;
      const query = listFrequenciaHistoricoEstagioQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.listFrequenciaHistorico(
        estagioId,
        frequenciaId,
        query,
      );

      if (!hasPaginationQuery) {
        return res.json({
          success: true,
          data: result.data.items,
        });
      }

      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para histórico',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      if (error?.code === 'FREQUENCIA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'FREQUENCIA_NOT_FOUND',
          message: 'Frequência não encontrada',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_HISTORICO_ERROR',
        message: 'Erro ao listar histórico da frequência',
        error: error?.message,
      });
    }
  }

  static async listFrequenciaHistoricoProgramaAluno(req: Request, res: Response) {
    const alunoId = parseUuid(req.params.alunoId);
    const estagioId = parseUuid(req.params.estagioId);
    const frequenciaId = parseUuid(req.params.frequenciaId);
    if (!alunoId || !estagioId || !frequenciaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para histórico',
      });
    }

    if (!ensureAlunoScopeAccess(req, res, alunoId)) {
      return;
    }

    try {
      const hasPaginationQuery = req.query.page != null || req.query.pageSize != null;
      const query = listFrequenciaHistoricoEstagioQuerySchema.parse(req.query);
      const result = await estagiosProgramasService.listFrequenciaHistoricoByAluno(
        alunoId,
        estagioId,
        frequenciaId,
        query,
      );

      if (!hasPaginationQuery) {
        return res.json({
          success: true,
          data: result.data.items,
        });
      }

      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para histórico',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      if (error?.code === 'FREQUENCIA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'FREQUENCIA_NOT_FOUND',
          message: 'Frequência não encontrada',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_FREQUENCIA_HISTORICO_ALUNO_ERROR',
        message: 'Erro ao listar histórico da frequência no contexto do aluno',
        error: error?.message,
      });
    }
  }

  static async concluirAlunoPrograma(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);
    const estagioAlunoId = parseUuid(req.params.estagioAlunoId);
    if (!estagioId || !estagioAlunoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para conclusão do aluno',
      });
    }

    try {
      concluirEstagioAlunoSchema.parse(req.body ?? {});
      const result = await estagiosProgramasService.concluirAluno(
        estagioId,
        estagioAlunoId,
        req.user?.id,
      );
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para conclusão do aluno',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_ALUNO_NOT_FOUND',
          message: 'Aluno não vinculado ao estágio',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_CONCLUSAO_ERROR',
        message: 'Erro ao concluir estágio do aluno',
        error: error?.message,
      });
    }
  }

  static async create(req: Request, res: Response) {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseUuid(req.params.turmaId);
    const inscricaoId = parseUuid(req.params.inscricaoId);

    if (!cursoId || !turmaId || !inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores inválidos para criação de estágio',
      });
    }

    try {
      const payload = createEstagioSchema.parse(req.body);
      const usuarioId = req.user?.id;

      const estagio = await estagiosService.create(
        cursoId,
        turmaId,
        inscricaoId,
        payload,
        usuarioId,
      );

      return res.status(201).json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação de estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: 'Turma ou inscrição não encontrada para o curso informado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_CREATE_ERROR',
        message: 'Erro ao criar estágio para a inscrição informada',
        error: error?.message,
      });
    }
  }

  static async listByInscricao(req: Request, res: Response) {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseUuid(req.params.turmaId);
    const inscricaoId = parseUuid(req.params.inscricaoId);

    if (!cursoId || !turmaId || !inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros inválidos para listagem de estágios',
      });
    }

    try {
      const estagios = await estagiosService.listByInscricao(cursoId, turmaId, inscricaoId);
      return res.json({ data: estagios });
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: 'Turma ou inscrição não encontrada',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_LIST_ERROR',
        message: 'Erro ao listar estágios da inscrição',
        error: error?.message,
      });
    }
  }

  static async listMe(req: Request, res: Response) {
    const usuarioId = req.user?.id;
    const inscricaoId = parseUuid(req.params.inscricaoId);

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuário não autenticado',
      });
    }

    if (!inscricaoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da inscrição inválido',
      });
    }

    try {
      const estagios = await estagiosService.listForAluno(inscricaoId, usuarioId);
      return res.json({ data: estagios });
    } catch (error: any) {
      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Inscrição não encontrada para o usuário autenticado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_LIST_ERROR',
        message: 'Erro ao listar estágios do aluno',
        error: error?.message,
      });
    }
  }

  static async get(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const estagio = await estagiosService.getById(estagioId, req.user?.id, { allowAdmin: true });
      return res.json(estagio);
    } catch (error: any) {
      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Usuário sem permissão para acessar este estágio',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_GET_ERROR',
        message: 'Erro ao buscar estágio',
        error: error?.message,
      });
    }
  }

  static async update(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = updateEstagioSchema.parse(req.body);
      const usuarioId = req.user?.id;
      const estagio = await estagiosService.update(estagioId, payload, usuarioId);
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_UPDATE_ERROR',
        message: 'Erro ao atualizar estágio',
        error: error?.message,
      });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = updateEstagioStatusSchema.parse(req.body);
      const usuarioId = req.user?.id;
      const statusPrograma = Object.values(CursosEstagioProgramaStatus).includes(
        payload.status as CursosEstagioProgramaStatus,
      );

      const estagio = statusPrograma
        ? await estagiosProgramasService.update(
            estagioId,
            { status: payload.status as CursosEstagioProgramaStatus },
            usuarioId,
          )
        : await estagiosService.updateStatus(estagioId, payload as any, usuarioId);
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização de status',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_STATUS_ERROR',
        message: 'Erro ao atualizar status do estágio',
        error: error?.message,
      });
    }
  }

  static async reenviarConfirmacao(req: Request, res: Response) {
    const estagioId = parseUuid(req.params.estagioId);

    if (!estagioId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de estágio inválido',
      });
    }

    try {
      const payload = reenviarConfirmacaoSchema.parse(req.body ?? {});
      const usuarioId = req.user?.id;
      const estagio = await estagiosService.reenviarConfirmacao(
        estagioId,
        usuarioId,
        payload.destinatarioAlternativo,
      );
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para reenvio de confirmação',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'ESTAGIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ESTAGIO_NOT_FOUND',
          message: 'Estágio não encontrado para reenvio',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_REENVIAR_ERROR',
        message: 'Erro ao reenviar confirmação do estágio',
        error: error?.message,
      });
    }
  }

  static async confirmar(req: Request, res: Response) {
    const token = parseUuid(req.params.token);

    if (!token) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Token de confirmação inválido',
      });
    }

    try {
      const payload = confirmarEstagioSchema.parse(req.body ?? {});
      const estagio = await estagiosService.confirmar(token, {
        ...payload,
        ip: payload.ip ?? req.ip,
        userAgent: req.headers['user-agent']?.toString(),
      });
      return res.json(estagio);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para confirmação do estágio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'CONFIRMACAO_INVALIDA') {
        return res.status(404).json({
          success: false,
          code: 'CONFIRMACAO_INVALIDA',
          message: 'Confirmação de estágio inválida ou já utilizada',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ESTAGIO_CONFIRM_ERROR',
        message: 'Erro ao confirmar ciência do estágio',
        error: error?.message,
      });
    }
  }
}
