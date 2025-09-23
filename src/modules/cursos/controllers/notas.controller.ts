import { Request, Response } from 'express';
import { CursosNotasTipo } from '@prisma/client';
import { ZodError } from 'zod';

import { notasService } from '../services/notas.service';
import { createNotaSchema, updateNotaSchema } from '../validators/notas.schema';

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

const parseNotaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

const parseMatriculaId = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

export class NotasController {
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

    const matriculaId = parseMatriculaId(req.query.matriculaId);

    try {
      const notas = await notasService.list(cursoId, turmaId, {
        matriculaId: matriculaId ?? undefined,
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
      const data = createNotaSchema.parse(req.body);
      const nota = await notasService.create(cursoId, turmaId, {
        ...data,
        tipo: data.tipo as CursosNotasTipo,
      });
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

      if (error?.code === 'MATRICULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MATRICULA_NOT_FOUND',
          message: 'Matrícula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'PROVA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'PROVA_NOT_FOUND',
          message: 'Prova não encontrada para a turma informada',
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
      res.json(result);
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
        code: 'NOTA_DELETE_ERROR',
        message: 'Erro ao remover nota da turma',
        error: error?.message,
      });
    }
  };

  static listByMatricula = async (req: Request, res: Response) => {
    const matriculaId = parseMatriculaId(req.params.matriculaId);

    if (!matriculaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da matrícula inválido',
      });
    }

    try {
      const resultado = await notasService.listByMatricula(matriculaId, undefined, { permitirAdmin: true });
      res.json(resultado);
    } catch (error: any) {
      if (error?.code === 'MATRICULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MATRICULA_NOT_FOUND',
          message: 'Matrícula não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_MATRICULA_ERROR',
        message: 'Erro ao consultar notas da matrícula',
        error: error?.message,
      });
    }
  };

  static listMy = async (req: Request, res: Response) => {
    const matriculaId = parseMatriculaId(req.params.matriculaId);

    if (!matriculaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador da matrícula inválido',
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
      const resultado = await notasService.listByMatricula(matriculaId, usuarioId);
      res.json(resultado);
    } catch (error: any) {
      if (error?.code === 'MATRICULA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MATRICULA_NOT_FOUND',
          message: 'Matrícula não encontrada',
        });
      }

      if (error?.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar as notas desta matrícula',
        });
      }

      res.status(500).json({
        success: false,
        code: 'NOTAS_ME_MATRICULA_ERROR',
        message: 'Erro ao consultar notas da matrícula do aluno',
        error: error?.message,
      });
    }
  };
}
