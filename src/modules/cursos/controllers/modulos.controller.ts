import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { modulosService } from '../services/modulos.service';
import { createModuloSchema, updateModuloSchema } from '../validators/modulos.schema';

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

const parseModuloId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw;
};

export class ModulosController {
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
      const modulos = await modulosService.list(cursoId, turmaId);
      res.json({ data: modulos });
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
        code: 'MODULOS_LIST_ERROR',
        message: 'Erro ao listar módulos da turma',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const moduloId = parseModuloId(req.params.moduloId);

    if (!cursoId || !turmaId || !moduloId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou módulo inválidos',
      });
    }

    try {
      const modulo = await modulosService.get(cursoId, turmaId, moduloId);
      res.json(modulo);
    } catch (error: any) {
      if (error?.code === 'MODULO_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'MODULO_GET_ERROR',
        message: 'Erro ao buscar módulo da turma',
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
      const data = createModuloSchema.parse(req.body);
      const modulo = await modulosService.create(cursoId, turmaId, data);
      res.status(201).json(modulo);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do módulo',
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

      res.status(500).json({
        success: false,
        code: 'MODULO_CREATE_ERROR',
        message: 'Erro ao criar módulo para a turma',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const moduloId = parseModuloId(req.params.moduloId);

    if (!cursoId || !turmaId || !moduloId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou módulo inválidos',
      });
    }

    try {
      const data = updateModuloSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização do módulo',
        });
      }

      const modulo = await modulosService.update(cursoId, turmaId, moduloId, data);
      res.json(modulo);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do módulo',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'MODULO_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'MODULO_UPDATE_ERROR',
        message: 'Erro ao atualizar módulo da turma',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const moduloId = parseModuloId(req.params.moduloId);

    if (!cursoId || !turmaId || !moduloId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou módulo inválidos',
      });
    }

    try {
      const result = await modulosService.remove(cursoId, turmaId, moduloId);
      res.json(result);
    } catch (error: any) {
      if (error?.code === 'MODULO_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'MODULO_DELETE_ERROR',
        message: 'Erro ao remover módulo da turma',
        error: error?.message,
      });
    }
  };
}
