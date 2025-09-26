import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { areasInteresseService } from '../services/areas-interesse.service';
import {
  createAreaInteresseSchema,
  createSubareaInteresseSchema,
  updateAreaInteresseSchema,
  updateSubareaInteresseSchema,
} from '../validators/areas-interesse.schema';

const parseId = (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

export class AreasInteresseController {
  static list = async (_req: Request, res: Response) => {
    try {
      const areas = await areasInteresseService.list();
      res.json(areas);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_LIST_ERROR',
        message: 'Erro ao listar áreas de interesse',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador inválido para área de interesse',
      });
    }

    try {
      const area = await areasInteresseService.get(id);

      if (!area) {
        return res.status(404).json({
          success: false,
          code: 'AREAS_INTERESSE_NOT_FOUND',
          message: 'Área de interesse não encontrada',
        });
      }

      res.json(area);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_GET_ERROR',
        message: 'Erro ao buscar área de interesse',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const data = createAreaInteresseSchema.parse(req.body);
      const area = await areasInteresseService.create(data);

      res.status(201).json(area);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da área de interesse',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_CREATE_ERROR',
        message: 'Erro ao criar área de interesse',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador inválido para área de interesse',
      });
    }

    try {
      const data = updateAreaInteresseSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da área de interesse',
        });
      }

      const area = await areasInteresseService.update(id, data);
      res.json(area);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da área de interesse',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'AREAS_INTERESSE_NOT_FOUND',
          message: 'Área de interesse não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_UPDATE_ERROR',
        message: 'Erro ao atualizar área de interesse',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador inválido para área de interesse',
      });
    }

    try {
      await areasInteresseService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'AREAS_INTERESSE_NOT_FOUND',
          message: 'Área de interesse não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_DELETE_ERROR',
        message: 'Erro ao remover área de interesse',
        error: error?.message,
      });
    }
  };

  static createSubarea = async (req: Request, res: Response) => {
    const areaId = parseId(req.params.areaId);
    if (!areaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador inválido para área de interesse',
      });
    }

    try {
      const data = createSubareaInteresseSchema.parse(req.body);
      const subarea = await areasInteresseService.createSubarea(areaId, data);

      res.status(201).json(subarea);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da subárea de interesse',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'AREAS_INTERESSE_NOT_FOUND',
          message: 'Área de interesse não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_SUBAREA_CREATE_ERROR',
        message: 'Erro ao criar subárea de interesse',
        error: error?.message,
      });
    }
  };

  static updateSubarea = async (req: Request, res: Response) => {
    const subareaId = parseId(req.params.subareaId);
    if (!subareaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador inválido para subárea de interesse',
      });
    }

    try {
      const data = updateSubareaInteresseSchema.parse(req.body);
      const subarea = await areasInteresseService.updateSubarea(subareaId, data);
      res.json(subarea);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da subárea de interesse',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'AREAS_INTERESSE_SUBAREA_NOT_FOUND',
          message: 'Subárea de interesse não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_SUBAREA_UPDATE_ERROR',
        message: 'Erro ao atualizar subárea de interesse',
        error: error?.message,
      });
    }
  };

  static removeSubarea = async (req: Request, res: Response) => {
    const subareaId = parseId(req.params.subareaId);
    if (!subareaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador inválido para subárea de interesse',
      });
    }

    try {
      await areasInteresseService.removeSubarea(subareaId);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'AREAS_INTERESSE_SUBAREA_NOT_FOUND',
          message: 'Subárea de interesse não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'AREAS_INTERESSE_SUBAREA_DELETE_ERROR',
        message: 'Erro ao remover subárea de interesse',
        error: error?.message,
      });
    }
  };
}
