import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { provasService } from '../services/provas.service';
import { createProvaSchema, registrarNotaSchema, updateProvaSchema } from '../validators/provas.schema';

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

const parseProvaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

export class ProvasController {
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
      const provas = await provasService.list(cursoId, turmaId);
      res.json({ data: provas });
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
        code: 'PROVAS_LIST_ERROR',
        message: 'Erro ao listar provas da turma',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);

    if (!cursoId || !turmaId || !provaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou prova inválidos',
      });
    }

    try {
      const prova = await provasService.get(cursoId, turmaId, provaId);
      res.json(prova);
    } catch (error: any) {
      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PROVA_GET_ERROR',
        message: 'Erro ao buscar prova da turma',
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
      const data = createProvaSchema.parse(req.body);
      const prova = await provasService.create(cursoId, turmaId, data);
      res.status(201).json(prova);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da prova',
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

      if (error?.code === 'MODULO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PROVA_CREATE_ERROR',
        message: 'Erro ao criar prova para a turma',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);

    if (!cursoId || !turmaId || !provaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou prova inválidos',
      });
    }

    try {
      const data = updateProvaSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da prova',
        });
      }

      const prova = await provasService.update(cursoId, turmaId, provaId, data);
      res.json(prova);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da prova',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      if (error?.code === 'MODULO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PROVA_UPDATE_ERROR',
        message: 'Erro ao atualizar prova da turma',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);

    if (!cursoId || !turmaId || !provaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou prova inválidos',
      });
    }

    try {
      const result = await provasService.remove(cursoId, turmaId, provaId);
      res.json(result);
    } catch (error: any) {
      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PROVA_DELETE_ERROR',
        message: 'Erro ao remover prova da turma',
        error: error?.message,
      });
    }
  };

  static registrarNota = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const provaId = parseProvaId(req.params.provaId);

    if (!cursoId || !turmaId || !provaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou prova inválidos',
      });
    }

    try {
      const data = registrarNotaSchema.parse(req.body);
      const prova = await provasService.registrarNota(cursoId, turmaId, provaId, {
        ...data,
        realizadoEm: data.realizadoEm ?? undefined,
      });
      res.status(200).json(prova);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para registro de nota',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
        });
      }

      if (error?.code === 'MATRICULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MATRICULA_NOT_FOUND',
          message: 'Matrícula não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PROVA_REGISTRAR_NOTA_ERROR',
        message: 'Erro ao registrar nota da prova',
        error: error?.message,
      });
    }
  };
}
