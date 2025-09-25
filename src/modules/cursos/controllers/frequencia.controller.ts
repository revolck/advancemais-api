import { Request, Response } from 'express';
import { CursosFrequenciaStatus } from '@prisma/client';
import { ZodError } from 'zod';

import { frequenciaService } from '../services/frequencia.service';
import { createFrequenciaSchema, updateFrequenciaSchema } from '../validators/frequencia.schema';

const parseCursoId = (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
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

const parseInscricaoId = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseAulaId = (raw: unknown) => {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return raw;
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

const parseStatusQuery = (raw: unknown): CursosFrequenciaStatus | undefined | null => {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.toUpperCase();
  const values = Object.values(CursosFrequenciaStatus);
  return values.includes(normalized as CursosFrequenciaStatus)
    ? (normalized as CursosFrequenciaStatus)
    : null;
};

export class FrequenciaController {
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
    if (inscricaoId === null && req.query.inscricaoId !== undefined) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da inscrição inválido',
      });
    }

    const aulaId = parseAulaId(req.query.aulaId);
    if (aulaId === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da aula inválido',
      });
    }

    const status = parseStatusQuery(req.query.status);
    if (status === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Status de frequência inválido',
      });
    }

    const dataInicio = parseDateQuery(req.query.dataInicio);
    const dataFim = parseDateQuery(req.query.dataFim);

    if (dataInicio === null || dataFim === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Período informado é inválido',
      });
    }

    try {
      const frequencias = await frequenciaService.list(cursoId, turmaId, {
        inscricaoId: inscricaoId ?? undefined,
        aulaId,
        status,
        dataInicio,
        dataFim,
      });

      res.json({ data: frequencias });
    } catch (error: any) {
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
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
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
      const frequencia = await frequenciaService.create(cursoId, turmaId, {
        ...data,
        aulaId: data.aulaId ?? null,
        dataReferencia: data.dataReferencia ?? undefined,
        justificativa: data.justificativa ?? null,
        observacoes: data.observacoes ?? null,
      });
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
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'DUPLICATE_FREQUENCIA') {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_FREQUENCIA',
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
      const frequencia = await frequenciaService.update(cursoId, turmaId, frequenciaId, {
        aulaId: data.aulaId === undefined ? undefined : data.aulaId,
        dataReferencia: data.dataReferencia ?? undefined,
        status: data.status,
        justificativa: data.justificativa === undefined ? undefined : data.justificativa,
        observacoes: data.observacoes === undefined ? undefined : data.observacoes,
      });
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
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
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
}
