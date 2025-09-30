import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError, z } from 'zod';

import { vagasCategoriasService } from '../services/categorias.service';
import {
  createVagaCategoriaSchema,
  createVagaSubcategoriaSchema,
  updateVagaCategoriaSchema,
  updateVagaSubcategoriaSchema,
} from '../validators/categorias.schema';

const uuidSchema = z.string().uuid();

const parseUuidParam = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
};

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isForeignKeyConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

const handleKnownErrors = (res: Response, error: any) => {
  if (error?.code === 'CATEGORIA_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      code: 'CATEGORIA_NOT_FOUND',
      message: 'Categoria não encontrada',
    });
  }

  if (error?.code === 'SUBCATEGORIA_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      code: 'SUBCATEGORIA_NOT_FOUND',
      message: 'Subcategoria não encontrada',
    });
  }

  if (isUniqueConstraintError(error)) {
    return res.status(409).json({
      success: false,
      code: 'CATEGORIA_DUPLICATE',
      message: 'Já existe um registro com os dados informados',
    });
  }

  if (isForeignKeyConstraintError(error)) {
    return res.status(409).json({
      success: false,
      code: 'CATEGORIA_IN_USE',
      message: 'Não é possível remover o registro pois existem vínculos ativos',
    });
  }

  return null;
};

export class VagasCategoriasController {
  static list = async (_req: Request, res: Response) => {
    try {
      const data = await vagasCategoriasService.list();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'VAGAS_CATEGORIAS_LIST_ERROR',
        message: 'Erro ao listar categorias de vagas',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const categoriaId = parseUuidParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      const categoria = await vagasCategoriasService.get(categoriaId);
      res.json(categoria);
    } catch (error: any) {
      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_CATEGORIA_GET_ERROR',
        message: 'Erro ao buscar categoria de vaga',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const payload = createVagaCategoriaSchema.parse(req.body);
      const categoria = await vagasCategoriasService.create(payload);
      res.status(201).json(categoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da categoria de vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_CATEGORIA_CREATE_ERROR',
        message: 'Erro ao criar categoria de vaga',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const categoriaId = parseUuidParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      const payload = updateVagaCategoriaSchema.parse(req.body);
      const categoria = await vagasCategoriasService.update(categoriaId, payload);
      res.json(categoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da categoria de vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_CATEGORIA_UPDATE_ERROR',
        message: 'Erro ao atualizar categoria de vaga',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    const categoriaId = parseUuidParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      await vagasCategoriasService.remove(categoriaId);
      res.status(204).send();
    } catch (error: any) {
      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_CATEGORIA_DELETE_ERROR',
        message: 'Erro ao remover categoria de vaga',
        error: error?.message,
      });
    }
  };

  static createSubcategoria = async (req: Request, res: Response) => {
    const categoriaId = parseUuidParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      const payload = createVagaSubcategoriaSchema.parse(req.body);
      const subcategoria = await vagasCategoriasService.createSubcategoria(categoriaId, payload);
      res.status(201).json(subcategoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da subcategoria de vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_SUBCATEGORIA_CREATE_ERROR',
        message: 'Erro ao criar subcategoria de vaga',
        error: error?.message,
      });
    }
  };

  static updateSubcategoria = async (req: Request, res: Response) => {
    const subcategoriaId = parseUuidParam(req.params.subcategoriaId);
    if (!subcategoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de subcategoria inválido',
      });
    }

    try {
      const payload = updateVagaSubcategoriaSchema.parse(req.body);
      const subcategoria = await vagasCategoriasService.updateSubcategoria(subcategoriaId, payload);
      res.json(subcategoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da subcategoria de vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_SUBCATEGORIA_UPDATE_ERROR',
        message: 'Erro ao atualizar subcategoria de vaga',
        error: error?.message,
      });
    }
  };

  static removeSubcategoria = async (req: Request, res: Response) => {
    const subcategoriaId = parseUuidParam(req.params.subcategoriaId);
    if (!subcategoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de subcategoria inválido',
      });
    }

    try {
      await vagasCategoriasService.removeSubcategoria(subcategoriaId);
      res.status(204).send();
    } catch (error: any) {
      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_SUBCATEGORIA_DELETE_ERROR',
        message: 'Erro ao remover subcategoria de vaga',
        error: error?.message,
      });
    }
  };
}
