import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { generateCacheKey, getCachedOrFetch, invalidateCacheByPrefix } from '@/utils/cache';
import { categoriasService } from '../services/categorias.service';
import {
  createCategoriaSchema,
  createSubcategoriaSchema,
  updateCategoriaSchema,
  updateSubcategoriaSchema,
} from '../validators/categorias.schema';

const parseIdParam = (raw: string | undefined) => {
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
};

const parsePositiveIntegerQuery = (raw: unknown, fallback: number) => {
  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
};

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isForeignKeyConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const CURSOS_CATEGORIAS_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_CATEGORIAS, 60);

const invalidateCategoriasCache = async () => {
  try {
    await Promise.all([
      invalidateCacheByPrefix('cursos:categorias:list:'),
      invalidateCacheByPrefix('cursos:categorias:get:'),
      invalidateCacheByPrefix('cursos:categorias:subcategorias:'),
      invalidateCacheByPrefix('cursos:list:'),
      invalidateCacheByPrefix('cursos:get:'),
    ]);
  } catch {
    // cache é best-effort
  }
};

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

  if (error?.code === 'CATEGORIA_IN_USE') {
    return res.status(409).json({
      success: false,
      code: 'CATEGORIA_IN_USE',
      message: 'Não é possível remover a categoria pois existem cursos vinculados',
    });
  }

  if (error?.code === 'SUBCATEGORIA_IN_USE') {
    return res.status(409).json({
      success: false,
      code: 'SUBCATEGORIA_IN_USE',
      message: 'Não é possível remover a subcategoria pois existem cursos vinculados',
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

export class CategoriasController {
  static list = async (req: Request, res: Response) => {
    try {
      const cacheKey = generateCacheKey(
        'cursos:categorias:list',
        {
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const data = await getCachedOrFetch(
        cacheKey,
        () => categoriasService.list(),
        CURSOS_CATEGORIAS_CACHE_TTL,
      );
      res.json(data);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'CATEGORIAS_LIST_ERROR',
        message: 'Erro ao listar categorias',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    const categoriaId = parseIdParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      const cacheKey = generateCacheKey(
        'cursos:categorias:get',
        {
          categoriaId,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const categoria = await getCachedOrFetch(
        cacheKey,
        () => categoriasService.get(categoriaId),
        CURSOS_CATEGORIAS_CACHE_TTL,
      );
      res.json(categoria);
    } catch (error: any) {
      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'CATEGORIA_GET_ERROR',
        message: 'Erro ao buscar categoria',
        error: error?.message,
      });
    }
  };

  static listSubcategorias = async (req: Request, res: Response) => {
    const categoriaId = parseIdParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    const page = parsePositiveIntegerQuery(req.query.page, 1);
    if (!page) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetro page inválido',
      });
    }

    const pageSizeRaw = parsePositiveIntegerQuery(req.query.pageSize, 50);
    if (!pageSizeRaw) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Parâmetro pageSize inválido',
      });
    }

    const pageSize = Math.min(pageSizeRaw, 100);

    try {
      const cacheKey = generateCacheKey(
        'cursos:categorias:subcategorias',
        {
          categoriaId,
          page,
          pageSize,
          role: req.user?.role ?? '',
        },
        { excludeKeys: [] },
      );

      const result = await getCachedOrFetch(
        cacheKey,
        () => categoriasService.listSubcategorias(categoriaId, { page, pageSize }),
        CURSOS_CATEGORIAS_CACHE_TTL,
      );
      res.json(result);
    } catch (error: any) {
      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'SUBCATEGORIAS_LIST_ERROR',
        message: 'Erro ao listar subcategorias da categoria',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const payload = createCategoriaSchema.parse(req.body);
      const categoria = await categoriasService.create(payload);
      await invalidateCategoriasCache();
      res.status(201).json(categoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da categoria',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'CATEGORIA_CREATE_ERROR',
        message: 'Erro ao criar categoria',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    const categoriaId = parseIdParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      const payload = updateCategoriaSchema.parse(req.body);
      const categoria = await categoriasService.update(categoriaId, payload);
      await invalidateCategoriasCache();
      res.json(categoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da categoria',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'CATEGORIA_UPDATE_ERROR',
        message: 'Erro ao atualizar categoria',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    const categoriaId = parseIdParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      await categoriasService.remove(categoriaId);
      await invalidateCategoriasCache();
      res.status(204).send();
    } catch (error: any) {
      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'CATEGORIA_DELETE_ERROR',
        message: 'Erro ao remover categoria',
        error: error?.message,
      });
    }
  };

  static createSubcategoria = async (req: Request, res: Response) => {
    const categoriaId = parseIdParam(req.params.categoriaId);
    if (!categoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de categoria inválido',
      });
    }

    try {
      const payload = createSubcategoriaSchema.parse(req.body);
      const subcategoria = await categoriasService.createSubcategoria(categoriaId, payload);
      await invalidateCategoriasCache();
      res.status(201).json(subcategoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da subcategoria',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'SUBCATEGORIA_CREATE_ERROR',
        message: 'Erro ao criar subcategoria',
        error: error?.message,
      });
    }
  };

  static updateSubcategoria = async (req: Request, res: Response) => {
    const subcategoriaId = parseIdParam(req.params.subcategoriaId);
    if (!subcategoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de subcategoria inválido',
      });
    }

    try {
      const payload = updateSubcategoriaSchema.parse(req.body);
      const subcategoria = await categoriasService.updateSubcategoria(subcategoriaId, payload);
      await invalidateCategoriasCache();
      res.json(subcategoria);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da subcategoria',
          issues: error.flatten().fieldErrors,
        });
      }

      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'SUBCATEGORIA_UPDATE_ERROR',
        message: 'Erro ao atualizar subcategoria',
        error: error?.message,
      });
    }
  };

  static removeSubcategoria = async (req: Request, res: Response) => {
    const subcategoriaId = parseIdParam(req.params.subcategoriaId);
    if (!subcategoriaId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Identificador de subcategoria inválido',
      });
    }

    try {
      await categoriasService.removeSubcategoria(subcategoriaId);
      await invalidateCategoriasCache();
      res.status(204).send();
    } catch (error: any) {
      if (handleKnownErrors(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        code: 'SUBCATEGORIA_DELETE_ERROR',
        message: 'Erro ao remover subcategoria',
        error: error?.message,
      });
    }
  };
}
