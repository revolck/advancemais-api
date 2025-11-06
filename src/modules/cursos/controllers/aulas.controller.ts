import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { aulasService } from '../services/aulas.service';
import { createAulaSchema, updateAulaSchema } from '../validators/aulas.schema';

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

const parseAulaId = (raw: string) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return raw;
};

export class AulasController {
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
      const aulas = await aulasService.list(cursoId, turmaId);
      res.json({ data: aulas });
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
        code: 'AULAS_LIST_ERROR',
        message: 'Erro ao listar aulas da turma',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const aulaId = parseAulaId(req.params.aulaId);

    if (!cursoId || !turmaId || !aulaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou aula inválidos',
      });
    }

    try {
      const aula = await aulasService.get(cursoId, turmaId, aulaId);
      res.json(aula);
    } catch (error: any) {
      if (error?.code === 'AULA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AULA_GET_ERROR',
        message: 'Erro ao buscar aula da turma',
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
      const data = createAulaSchema.parse(req.body);
      const aula = await aulasService.create(cursoId, turmaId, data);
      res.status(201).json(aula);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da aula',
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

      if (error?.code === 'INVALID_DELIVERY_FIELDS') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DELIVERY_FIELDS',
          message: error.message ?? 'Configurações de entrega inválidas para a aula',
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
        code: 'AULA_CREATE_ERROR',
        message: 'Erro ao criar aula para a turma',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const aulaId = parseAulaId(req.params.aulaId);

    if (!cursoId || !turmaId || !aulaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou aula inválidos',
      });
    }

    try {
      const data = updateAulaSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da aula',
        });
      }

      const aula = await aulasService.update(cursoId, turmaId, aulaId, data);
      res.json(aula);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da aula',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'AULA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      if (error?.code === 'MODULO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'MODULO_NOT_FOUND',
          message: 'Módulo não encontrado para a turma informada',
        });
      }

      if (error?.code === 'INVALID_DELIVERY_FIELDS') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DELIVERY_FIELDS',
          message: error.message ?? 'Configurações de entrega inválidas para a aula',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AULA_UPDATE_ERROR',
        message: 'Erro ao atualizar aula da turma',
        error: error?.message,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const cursoId = parseCursoId(req.params.cursoId);
    const turmaId = parseTurmaId(req.params.turmaId);
    const aulaId = parseAulaId(req.params.aulaId);

    if (!cursoId || !turmaId || !aulaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificadores de curso, turma ou aula inválidos',
      });
    }

    try {
      await aulasService.remove(cursoId, turmaId, aulaId);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.code === 'AULA_NOT_FOUND' || error?.code === 'TURMA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'AULA_NOT_FOUND',
          message: 'Aula não encontrada para a turma informada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AULA_DELETE_ERROR',
        message: 'Erro ao remover aula da turma',
        error: error?.message,
      });
    }
  };
}
