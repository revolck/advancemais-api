import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { turmasService } from '../services/turmas.service';
import {
  createTurmaSchema,
  turmaEnrollmentSchema,
  updateTurmaSchema,
} from '../validators/turmas.schema';

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
      const turmas = await turmasService.list(cursoId);
      res.json({ data: turmas });
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
      const turma = await turmasService.get(cursoId, turmaId);
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

      const turma = await turmasService.create(cursoId, {
        ...data,
        dataInicio: data.dataInicio ?? undefined,
        dataFim: data.dataFim ?? undefined,
        dataInscricaoInicio: data.dataInscricaoInicio ?? undefined,
        dataInscricaoFim: data.dataInscricaoFim ?? undefined,
      });

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

      const turma = await turmasService.update(cursoId, turmaId, {
        ...data,
        dataInicio: data.dataInicio ?? undefined,
        dataFim: data.dataFim ?? undefined,
        dataInscricaoInicio: data.dataInscricaoInicio ?? undefined,
        dataInscricaoFim: data.dataInscricaoFim ?? undefined,
      });

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

      if (error?.code === 'INVALID_VAGAS_TOTAIS') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_VAGAS_TOTAIS',
          message: 'Vagas totais não podem ser menores que matrículas ativas',
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
      const data = turmaEnrollmentSchema.parse(req.body);
      const turma = await turmasService.enroll(cursoId, turmaId, data.alunoId);
      res.status(201).json(turma);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para matrícula na turma',
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

      if (error?.code === 'ALUNO_JA_MATRICULADO') {
        return res.status(409).json({
          success: false,
          code: 'ALUNO_JA_MATRICULADO',
          message: 'Aluno já está matriculado nesta turma',
        });
      }

      if (error?.code === 'ALUNO_INFORMATION_NOT_FOUND') {
        return res.status(400).json({
          success: false,
          code: 'ALUNO_INFORMATION_NOT_FOUND',
          message: 'Informações do aluno não encontradas para geração da matrícula',
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_ENROLL_ERROR',
        message: 'Erro ao matricular aluno na turma',
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
      res.json(turma);
    } catch (error: any) {
      if (error?.code === 'TURMA_NOT_FOUND' || error?.code === 'CURSO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada para o curso informado',
        });
      }

      if (error?.code === 'ALUNO_NAO_MATRICULADO') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NAO_MATRICULADO',
          message: 'Aluno não está matriculado nesta turma',
        });
      }

      res.status(500).json({
        success: false,
        code: 'TURMA_UNENROLL_ERROR',
        message: 'Erro ao remover matrícula do aluno na turma',
        error: error?.message,
      });
    }
  };
}
