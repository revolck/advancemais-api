import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { frequenciaService } from '../services/frequencia.service';
import {
  createFrequenciaSchema,
  listFrequenciaHistoricoAlunoNaturalQuerySchema,
  listFrequenciaHistoricoNaturalQuerySchema,
  listFrequenciaGeralQuerySchema,
  listFrequenciaQuerySchema,
  upsertFrequenciaAlunoLancamentoSchema,
  upsertFrequenciaLancamentoSchema,
  updateFrequenciaSchema,
} from '../validators/frequencia.schema';

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

const parseFrequenciaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseSyntheticFrequenciaId = (raw: string) => {
  if (!raw.startsWith('pendente:')) return null;
  const parts = raw.split(':');
  if (parts.length !== 5) return null;
  const [, turmaId, inscricaoId, tipoOrigem, origemId] = parts;
  if (!turmaId || !inscricaoId || !tipoOrigem || !origemId) return null;
  if (!['AULA', 'PROVA', 'ATIVIDADE'].includes(tipoOrigem)) return null;
  return {
    turmaId,
    inscricaoId,
    tipoOrigem: tipoOrigem as 'AULA' | 'PROVA' | 'ATIVIDADE',
    origemId,
  };
};

const parseInscricaoId = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseAlunoId = (raw: string): string | null => {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw.trim())) {
    return null;
  }
  return raw.trim();
};

const parseDateQuery = (raw: unknown) => {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const canManageFrequencia = (role?: string) =>
  ['ADMIN', 'MODERADOR', 'PEDAGOGICO', 'INSTRUTOR'].includes(role ?? '');

const buildAcaoFrequencia = (item: any, role?: string) => {
  const canManage = canManageFrequencia(role);
  let bloqueado = !canManage;
  let motivoBloqueio: string | null = canManage
    ? null
    : 'Usuário sem permissão para lançar ou editar frequência.';

  if (!bloqueado && !item?.isPersisted && !item?.naturalKey?.origemId) {
    bloqueado = true;
    motivoBloqueio = 'Origem da frequência indisponível para lançamento.';
  }

  return {
    podeMarcarPresente: canManage && !bloqueado,
    podeMarcarAusente: canManage && !bloqueado,
    podeEditar: canManage && !bloqueado,
    podeVerHistorico: canManage && (!bloqueado || !!item?.id || !!item?.naturalKey?.origemId),
    bloqueado,
    motivoBloqueio,
  };
};

const withAcaoFrequencia = (payload: any, role?: string) => {
  if (!payload || !Array.isArray(payload.items)) {
    return payload;
  }

  return {
    ...payload,
    items: payload.items.map((item: any) => ({
      ...item,
      acaoFrequencia: item?.acaoFrequencia ?? buildAcaoFrequencia(item, role),
    })),
  };
};

export class FrequenciaController {
  static listGeral = async (req: Request, res: Response) => {
    try {
      const query = listFrequenciaGeralQuerySchema.parse({
        ...req.query,
        origemId: req.query.origemId ?? req.query.aulaId,
      });

      const frequencias = await frequenciaService.listGeral(
        {
          cursoId: query.cursoId ?? undefined,
          turmaIds: query.turmaIds ?? undefined,
          inscricaoId: query.inscricaoId ?? undefined,
          tipoOrigem: query.tipoOrigem ?? undefined,
          origemId: query.origemId ?? undefined,
          status: query.status ?? undefined,
          search: query.search ?? undefined,
          page: query.page,
          pageSize: query.pageSize,
          orderBy: query.orderBy ?? undefined,
          order: query.order ?? undefined,
          dataInicio: query.dataInicio ?? undefined,
          dataFim: query.dataFim ?? undefined,
        },
        {
          userId: req.user?.id,
          role: req.user?.role,
        },
      );

      res.json({ success: true, data: withAcaoFrequencia(frequencias, req.user?.role) });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem geral de frequências',
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
        code: 'FREQUENCIA_GERAL_LIST_ERROR',
        message: 'Erro ao listar frequências',
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
        message: 'Selecione curso e ao menos uma turma para listar frequências.',
        data: {
          requires: ['cursoId', 'turmaIds'],
        },
      });
    }

    try {
      const query = listFrequenciaGeralQuerySchema.parse({
        ...req.query,
        origemId: req.query.origemId ?? req.query.aulaId,
      });

      if (!query.cursoId || !query.turmaIds || query.turmaIds.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'TURMA_FILTER_REQUIRED',
          message: 'Selecione curso e ao menos uma turma para listar frequências.',
          data: {
            requires: ['cursoId', 'turmaIds'],
          },
        });
      }

      const frequencias = await frequenciaService.listGeral(
        {
          cursoId: query.cursoId,
          turmaIds: query.turmaIds,
          alunoId,
          inscricaoId: query.inscricaoId ?? undefined,
          tipoOrigem: query.tipoOrigem ?? undefined,
          origemId: query.origemId ?? undefined,
          status: query.status ?? undefined,
          search: query.search ?? undefined,
          page: query.page,
          pageSize: query.pageSize,
          orderBy: query.orderBy ?? undefined,
          order: query.order ?? undefined,
          dataInicio: query.dataInicio ?? undefined,
          dataFim: query.dataFim ?? undefined,
        },
        {
          userId: req.user?.id,
          role: req.user?.role,
        },
      );

      return res.json({ success: true, data: withAcaoFrequencia(frequencias, req.user?.role) });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de frequências do aluno',
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

      return res.status(500).json({
        success: false,
        code: 'FREQUENCIA_ALUNO_LIST_ERROR',
        message: 'Erro ao listar frequências do aluno',
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

    try {
      const query = listFrequenciaQuerySchema.parse({
        ...req.query,
        // compat legado
        origemId: req.query.origemId ?? req.query.aulaId,
      });

      const frequencias = await frequenciaService.list(cursoId, turmaId, {
        inscricaoId: query.inscricaoId ?? undefined,
        tipoOrigem: query.tipoOrigem ?? undefined,
        origemId: query.origemId ?? undefined,
        status: query.status ?? undefined,
        search: query.search ?? undefined,
        page: query.page,
        pageSize: query.pageSize,
        dataInicio: query.dataInicio ?? undefined,
        dataFim: query.dataFim ?? undefined,
      });

      const isLegacyRequest =
        req.query.page === undefined &&
        req.query.pageSize === undefined &&
        req.query.search === undefined &&
        req.query.tipoOrigem === undefined &&
        req.query.origemId === undefined &&
        req.query.aulaId === undefined;

      if (isLegacyRequest) {
        return res.json({
          data: withAcaoFrequencia({ items: frequencias.items }, req.user?.role).items,
        });
      }

      const dataWithActions = withAcaoFrequencia(
        { items: frequencias.items, pagination: frequencias.pagination },
        req.user?.role,
      );
      res.json({ data: dataWithActions.items, pagination: dataWithActions.pagination });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listagem de frequências',
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

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Origem não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_LIST_ERROR',
        message: 'Erro ao listar registros de frequência da turma',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const frequenciaId = parseFrequenciaId(req.params.frequenciaId);

    if (!cursoId || !turmaId || !frequenciaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou frequência inválidos',
      });
    }

    try {
      const frequencia = await frequenciaService.get(cursoId, turmaId, frequenciaId);
      res.json(frequencia);
    } catch (error: any) {
      if (error?.code === 'FREQUENCIA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'FREQUENCIA_NOT_FOUND',
          message: 'Registro de frequência não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_GET_ERROR',
        message: 'Erro ao buscar registro de frequência da turma',
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
      const data = createFrequenciaSchema.parse(req.body);
      const frequencia = await frequenciaService.create(
        cursoId,
        turmaId,
        {
          ...data,
          aulaId: data.aulaId ?? null,
          tipoOrigem: data.tipoOrigem,
          origemId: data.origemId ?? undefined,
          origemTitulo: data.origemTitulo ?? undefined,
          modoLancamento: data.modoLancamento,
          minutosPresenca: data.minutosPresenca,
          minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
          dataReferencia: data.dataReferencia ?? undefined,
          justificativa: data.justificativa ?? null,
          observacoes: data.observacoes ?? null,
        },
        {
          lancadoPorId: req.user?.id,
          ip: req.ip,
          userAgent: Array.isArray(req.headers['user-agent'])
            ? req.headers['user-agent'].join(' | ')
            : req.headers['user-agent'],
        },
      );
      res.status(201).json(frequencia);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do registro de frequência',
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

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Origem não encontrada para a turma informada',
        });
      }

      if (error?.code === 'DUPLICATE_FREQUENCIA' || error?.code === 'FREQUENCIA_JA_LANCADA') {
        return res.status(409).json({
          success: false,
          code: 'FREQUENCIA_JA_LANCADA',
          message: 'Já existe uma frequência registrada para os parâmetros informados',
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
        code: 'FREQUENCIA_CREATE_ERROR',
        message: 'Erro ao registrar frequência para a turma',
        error: error?.message,
      });
    }
  };

  static upsertLancamento = async (req: Request, res: Response) => {
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
      const data = upsertFrequenciaLancamentoSchema.parse(req.body);
      const frequencia = await frequenciaService.upsertLancamento(
        cursoId,
        turmaId,
        {
          inscricaoId: data.inscricaoId,
          tipoOrigem: data.tipoOrigem,
          origemId: data.origemId,
          origemTitulo: data.origemTitulo ?? null,
          status: data.status,
          modoLancamento: data.modoLancamento,
          minutosPresenca: data.minutosPresenca,
          minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
          justificativa: data.justificativa ?? null,
          observacoes: data.observacoes ?? null,
        },
        {
          lancadoPorId: req.user?.id,
          ip: req.ip,
          userAgent: Array.isArray(req.headers['user-agent'])
            ? req.headers['user-agent'].join(' | ')
            : req.headers['user-agent'],
        },
      );
      res.json({
        success: true,
        data: {
          ...frequencia,
          acaoFrequencia: buildAcaoFrequencia(frequencia, req.user?.role),
        },
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para lançamento de frequência',
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

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Origem não encontrada para a turma informada',
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        const isJustificativa =
          typeof error?.message === 'string' &&
          error.message.toLowerCase().includes('justificativa');
        return res.status(400).json({
          success: false,
          code: isJustificativa ? 'JUSTIFICATIVA_OBRIGATORIA' : 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_UPSERT_ERROR',
        message: 'Erro ao lançar frequência para a turma',
        error: error?.message,
      });
    }
  };

  static upsertLancamentoAluno = async (req: Request, res: Response) => {
    const alunoId = parseAlunoId(req.params.alunoId);
    if (!alunoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de aluno inválido',
      });
    }

    try {
      const data = upsertFrequenciaAlunoLancamentoSchema.parse(req.body);
      const frequencia = await frequenciaService.upsertLancamentoByAluno(
        alunoId,
        {
          cursoId: data.cursoId,
          turmaId: data.turmaId,
          inscricaoId: data.inscricaoId,
          tipoOrigem: data.tipoOrigem,
          origemId: data.origemId,
          origemTitulo: data.origemTitulo ?? null,
          status: data.status,
          modoLancamento: data.modoLancamento,
          minutosPresenca: data.minutosPresenca,
          minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
          justificativa: data.justificativa ?? null,
          observacoes: data.observacoes ?? null,
        },
        {
          lancadoPorId: req.user?.id,
          ip: req.ip,
          userAgent: Array.isArray(req.headers['user-agent'])
            ? req.headers['user-agent'].join(' | ')
            : req.headers['user-agent'],
        },
      );

      return res.json({
        success: true,
        data: {
          ...frequencia,
          acaoFrequencia: buildAcaoFrequencia(frequencia, req.user?.role),
        },
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para lançamento de frequência no contexto do aluno',
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
          message: 'Inscrição não encontrada para o aluno na turma informada',
        });
      }

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Origem não encontrada para a turma informada',
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        const isJustificativa =
          typeof error?.message === 'string' &&
          error.message.toLowerCase().includes('justificativa');
        return res.status(400).json({
          success: false,
          code: isJustificativa ? 'JUSTIFICATIVA_OBRIGATORIA' : 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'FREQUENCIA_UPSERT_ALUNO_ERROR',
        message: 'Erro ao lançar frequência no contexto do aluno',
        error: error?.message,
      });
    }
  };

  static listHistorico = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const frequenciaId = parseFrequenciaId(req.params.frequenciaId);

    if (!cursoId || !turmaId || !frequenciaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou frequência inválidos',
      });
    }

    try {
      const historico = await frequenciaService.listHistoricoByFrequencia(
        cursoId,
        turmaId,
        frequenciaId,
      );
      res.json({ success: true, data: historico });
    } catch (error: any) {
      if (error?.code === 'FREQUENCIA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'FREQUENCIA_NOT_FOUND',
          message: 'Registro de frequência não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_HISTORICO_ERROR',
        message: 'Erro ao consultar histórico de frequência',
        error: error?.message,
      });
    }
  };

  static listHistoricoAluno = async (req: Request, res: Response) => {
    const alunoId = parseAlunoId(req.params.alunoId);
    const frequenciaId = parseFrequenciaId(req.params.frequenciaId);

    if (!alunoId || !frequenciaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de aluno ou frequência inválidos',
      });
    }

    try {
      const historico = await frequenciaService.listHistoricoByFrequenciaForAluno(
        alunoId,
        frequenciaId,
      );
      return res.json({ success: true, data: historico });
    } catch (error: any) {
      if (error?.code === 'FREQUENCIA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'FREQUENCIA_NOT_FOUND',
          message: 'Registro de frequência não encontrado para o aluno informado',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'FREQUENCIA_HISTORICO_ALUNO_ERROR',
        message: 'Erro ao consultar histórico de frequência no contexto do aluno',
        error: error?.message,
      });
    }
  };

  static listHistoricoByNaturalKey = async (req: Request, res: Response) => {
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
      const query = listFrequenciaHistoricoNaturalQuerySchema.parse(req.query);
      const historico = await frequenciaService.listHistoricoByNaturalKey(cursoId, turmaId, {
        inscricaoId: query.inscricaoId,
        tipoOrigem: query.tipoOrigem,
        origemId: query.origemId,
      });
      res.json({ success: true, data: historico });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para histórico de frequência',
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

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Origem não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_HISTORICO_ERROR',
        message: 'Erro ao consultar histórico de frequência',
        error: error?.message,
      });
    }
  };

  static listHistoricoByNaturalKeyAluno = async (req: Request, res: Response) => {
    const alunoId = parseAlunoId(req.params.alunoId);
    if (!alunoId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de aluno inválido',
      });
    }

    try {
      const query = listFrequenciaHistoricoAlunoNaturalQuerySchema.parse(req.query);
      const historico = await frequenciaService.listHistoricoByNaturalKeyForAluno(alunoId, {
        cursoId: query.cursoId,
        turmaId: query.turmaId,
        inscricaoId: query.inscricaoId,
        tipoOrigem: query.tipoOrigem,
        origemId: query.origemId,
      });
      return res.json({ success: true, data: historico });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para histórico de frequência no contexto do aluno',
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
          message: 'Inscrição não encontrada para o aluno na turma informada',
        });
      }

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Origem não encontrada para a turma informada',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'FREQUENCIA_HISTORICO_ALUNO_ERROR',
        message: 'Erro ao consultar histórico de frequência no contexto do aluno',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const frequenciaId = parseFrequenciaId(req.params.frequenciaId);

    if (!cursoId || !turmaId || !frequenciaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou frequência inválidos',
      });
    }

    try {
      const data = updateFrequenciaSchema.parse(req.body);
      const syntheticId = parseSyntheticFrequenciaId(frequenciaId);

      if (syntheticId) {
        if (syntheticId.turmaId !== turmaId) {
          return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'Identificador de frequência temporário inválido para a turma informada',
          });
        }

        if (!data.status) {
          return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'status é obrigatório para lançar frequência pendente',
          });
        }

        const frequencia = await frequenciaService.upsertLancamento(
          cursoId,
          turmaId,
          {
            inscricaoId: syntheticId.inscricaoId,
            tipoOrigem: syntheticId.tipoOrigem,
            origemId: syntheticId.origemId,
            status: data.status,
            modoLancamento: data.modoLancamento ?? 'MANUAL',
            minutosPresenca: data.minutosPresenca,
            minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
            justificativa: data.justificativa ?? null,
            observacoes: data.observacoes ?? null,
          },
          {
            lancadoPorId: req.user?.id,
            ip: req.ip,
            userAgent: Array.isArray(req.headers['user-agent'])
              ? req.headers['user-agent'].join(' | ')
              : req.headers['user-agent'],
          },
        );
        return res.json(frequencia);
      }

      const frequencia = await frequenciaService.update(
        cursoId,
        turmaId,
        frequenciaId,
        {
          aulaId: data.aulaId === undefined ? undefined : data.aulaId,
          tipoOrigem: data.tipoOrigem,
          origemId: data.origemId,
          origemTitulo: data.origemTitulo,
          modoLancamento: data.modoLancamento,
          minutosPresenca: data.minutosPresenca,
          minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
          dataReferencia: data.dataReferencia ?? undefined,
          status: data.status,
          justificativa: data.justificativa === undefined ? undefined : data.justificativa,
          observacoes: data.observacoes === undefined ? undefined : data.observacoes,
        },
        {
          lancadoPorId: req.user?.id,
          ip: req.ip,
          userAgent: Array.isArray(req.headers['user-agent'])
            ? req.headers['user-agent'].join(' | ')
            : req.headers['user-agent'],
        },
      );
      res.json(frequencia);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do registro de frequência',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'FREQUENCIA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'FREQUENCIA_NOT_FOUND',
          message: 'Registro de frequência não encontrado para a turma informada',
        });
      }

      if (error?.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'ATIVIDADE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ORIGEM_NOT_FOUND',
          message: 'Origem não encontrada para a turma informada',
        });
      }

      if (error?.code === 'VALIDATION_ERROR') {
        const isJustificativa =
          typeof error?.message === 'string' &&
          error.message.toLowerCase().includes('justificativa');
        return res.status(400).json({
          success: false,
          code: isJustificativa ? 'JUSTIFICATIVA_OBRIGATORIA' : 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_UPDATE_ERROR',
        message: 'Erro ao atualizar registro de frequência da turma',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const frequenciaId = parseFrequenciaId(req.params.frequenciaId);

    if (!cursoId || !turmaId || !frequenciaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou frequência inválidos',
      });
    }

    try {
      const result = await frequenciaService.remove(cursoId, turmaId, frequenciaId);
      res.json(result);
    } catch (error: any) {
      if (error?.code === 'FREQUENCIA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'FREQUENCIA_NOT_FOUND',
          message: 'Registro de frequência não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_DELETE_ERROR',
        message: 'Erro ao remover registro de frequência da turma',
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
      const resultado = await frequenciaService.listByInscricao(inscricaoId, undefined, {
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
        code: 'FREQUENCIA_INSCRICAO_ERROR',
        message: 'Erro ao consultar frequência da inscrição',
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
      const resultado = await frequenciaService.listByInscricao(inscricaoId, usuarioId);
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
          message: 'Você não tem permissão para visualizar a frequência desta inscrição',
        });
      }

      res.status(500).json({
        success: false,
        code: 'FREQUENCIA_ME_INSCRICAO_ERROR',
        message: 'Erro ao consultar frequência da inscrição do aluno',
        error: error?.message,
      });
    }
  };

  /**
   * Retorna resumo de frequência por aluno para uma turma
   * GET /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/resumo
   * Query params: periodo (TOTAL|DIA|SEMANA|MES), anchorDate (YYYY-MM-DD), search, page, pageSize
   */
  static resumo = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);

    if (!cursoId || !turmaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso ou turma inválidos',
      });
    }

    // Parse query params
    const periodo = req.query.periodo as 'TOTAL' | 'DIA' | 'SEMANA' | 'MES' | undefined;
    if (periodo && !['TOTAL', 'DIA', 'SEMANA', 'MES'].includes(periodo)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Período inválido. Use: TOTAL, DIA, SEMANA ou MES',
      });
    }

    const anchorDate = parseDateQuery(req.query.anchorDate);
    if (anchorDate === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Data âncora inválida',
      });
    }

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = parseInt(String(req.query.page || '1'), 10);
    const pageSize = parseInt(String(req.query.pageSize || '10'), 10);

    if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetros de paginação inválidos',
      });
    }

    try {
      const resultado = await frequenciaService.resumo(cursoId, turmaId, {
        periodo,
        anchorDate,
        search,
        page,
        pageSize,
      });
      res.json({ success: true, data: resultado });
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
        code: 'FREQUENCIA_RESUMO_ERROR',
        message: 'Erro ao gerar resumo de frequência da turma',
        error: error?.message,
      });
    }
  };
}
