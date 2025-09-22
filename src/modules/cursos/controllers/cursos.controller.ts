import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { cursosService } from '../services/cursos.service';
import {
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
} from '../validators/cursos.schema';

const parseCourseId = (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
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

export class CursosController {
  static meta = (_req: Request, res: Response) => {
    res.json({
      message: 'Cursos Module API',
      version: 'v1',
      timestamp: new Date().toISOString(),
      endpoints: {
        cursos: '/',
        turmas: '/:cursoId/turmas',
        matriculas: '/:cursoId/turmas/:turmaId/enrollments',
      },
      status: 'operational',
    });
  };

  static list = async (req: Request, res: Response) => {
    try {
      const params = listCoursesQuerySchema.parse(req.query);
      const result = await cursosService.list({
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        statusPadrao: params.statusPadrao,
        instrutorId: params.instrutorId,
        includeTurmas: params.includeTurmas,
      });

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

      res.status(500).json({
        success: false,
        code: 'CURSOS_LIST_ERROR',
        message: 'Erro ao listar cursos',
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
      const course = await cursosService.getById(id);
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

  static create = async (req: Request, res: Response) => {
    try {
      const data = createCourseSchema.parse(req.body);
      const course = await cursosService.create({
        ...data,
        descricao: normalizeDescricao(data.descricao),
      });

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
          message: 'Instrutor deve possuir a role PROFESSOR',
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

      const course = await cursosService.update(id, {
        ...data,
        descricao: normalizeDescricao(data.descricao),
      });

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
          message: 'Instrutor deve possuir a role PROFESSOR',
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
      res.json(course);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'CURSO_NOT_FOUND',
          message: 'Curso não encontrado',
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
}
