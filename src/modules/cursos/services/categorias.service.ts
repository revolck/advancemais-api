import { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { generateUniqueCategoryCode, generateUniqueSubcategoryCode } from '../utils/code-generator';

const categoriasLogger = logger.child({ module: 'CursosCategoriasService' });

const categoriaInclude = {
  CursosSubcategorias: {
    orderBy: { nome: 'asc' },
  },
} satisfies Prisma.CursosCategoriasInclude;

const mapSubcategoria = (
  subcategoria: Prisma.CursosSubcategoriasGetPayload<{ include?: undefined }>,
) => ({
  id: subcategoria.id,
  codSubcategoria: subcategoria.codSubcategoria,
  nome: subcategoria.nome,
  descricao: subcategoria.descricao ?? null,
  criadoEm: subcategoria.criadoEm.toISOString(),
  atualizadoEm: subcategoria.atualizadoEm.toISOString(),
});

const mapCategoria = (
  categoria: Prisma.CursosCategoriasGetPayload<{ include: typeof categoriaInclude }>,
) => ({
  id: categoria.id,
  codCategoria: categoria.codCategoria,
  nome: categoria.nome,
  descricao: categoria.descricao ?? null,
  criadoEm: categoria.criadoEm.toISOString(),
  atualizadoEm: categoria.atualizadoEm.toISOString(),
  subcategorias: (categoria.CursosSubcategorias ?? []).map(mapSubcategoria),
});

const fetchCategoria = async (id: number) => {
  const categoria = await prisma.cursosCategorias.findUnique({
    where: { id },
    include: categoriaInclude,
  });

  if (!categoria) {
    const error = new Error('Categoria não encontrada');
    (error as any).code = 'CATEGORIA_NOT_FOUND';
    throw error;
  }

  return mapCategoria(categoria);
};

const fetchSubcategoria = async (id: number) => {
  const subcategoria = await prisma.cursosSubcategorias.findUnique({
    where: { id },
  });

  if (!subcategoria) {
    const error = new Error('Subcategoria não encontrada');
    (error as any).code = 'SUBCATEGORIA_NOT_FOUND';
    throw error;
  }

  return mapSubcategoria(subcategoria);
};

const handlePrismaNotFound = (error: unknown, code: string, message: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    const notFound = new Error(message);
    (notFound as any).code = code;
    throw notFound;
  }

  throw error;
};

export const categoriasService = {
  async list() {
    const categorias = await prisma.cursosCategorias.findMany({
      orderBy: { nome: 'asc' },
      include: categoriaInclude,
    });

    return categorias.map(mapCategoria);
  },

  async get(id: number) {
    return fetchCategoria(id);
  },

  async listSubcategorias(categoriaId: number, options: { page: number; pageSize: number }) {
    const categoria = await prisma.cursosCategorias.findUnique({
      where: { id: categoriaId },
      select: { id: true },
    });

    if (!categoria) {
      const error = new Error('Categoria não encontrada');
      (error as any).code = 'CATEGORIA_NOT_FOUND';
      throw error;
    }

    const skip = (options.page - 1) * options.pageSize;

    const [subcategorias, total] = await prisma.$transaction([
      prisma.cursosSubcategorias.findMany({
        where: { categoriaId },
        orderBy: { nome: 'asc' },
        skip,
        take: options.pageSize,
      }),
      prisma.cursosSubcategorias.count({
        where: { categoriaId },
      }),
    ]);

    return {
      items: subcategorias.map(mapSubcategoria),
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        totalItems: total,
        totalPages: total === 0 ? 0 : Math.ceil(total / options.pageSize),
      },
    };
  },

  async create(data: { nome: string; descricao?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const codCategoria = await generateUniqueCategoryCode(tx, categoriasLogger);

      const created = await tx.cursosCategorias.create({
        data: {
          nome: data.nome,
          descricao: data.descricao ?? null,
          codCategoria,
        },
        include: categoriaInclude,
      });

      categoriasLogger.info({ categoriaId: created.id }, 'Categoria criada com sucesso');

      return mapCategoria(created);
    });
  },

  async update(id: number, data: { nome?: string; descricao?: string | null }) {
    try {
      const updated = await prisma.cursosCategorias.update({
        where: { id },
        data: {
          nome: data.nome ?? undefined,
          descricao: data.descricao ?? undefined,
        },
        include: categoriaInclude,
      });

      categoriasLogger.info({ categoriaId: id }, 'Categoria atualizada com sucesso');

      return mapCategoria(updated);
    } catch (error) {
      handlePrismaNotFound(error, 'CATEGORIA_NOT_FOUND', 'Categoria não encontrada');
      throw error;
    }
  },

  async remove(id: number) {
    try {
      await prisma.cursosCategorias.delete({ where: { id } });

      categoriasLogger.info({ categoriaId: id }, 'Categoria removida com sucesso');

      return { success: true } as const;
    } catch (error) {
      handlePrismaNotFound(error, 'CATEGORIA_NOT_FOUND', 'Categoria não encontrada');
      throw error;
    }
  },

  async createSubcategoria(categoriaId: number, data: { nome: string; descricao?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const categoria = await tx.cursosCategorias.findUnique({
        where: { id: categoriaId },
        select: { id: true },
      });

      if (!categoria) {
        const error = new Error('Categoria não encontrada');
        (error as any).code = 'CATEGORIA_NOT_FOUND';
        throw error;
      }

      const codSubcategoria = await generateUniqueSubcategoryCode(tx, categoriasLogger);

      const created = await tx.cursosSubcategorias.create({
        data: {
          categoriaId,
          nome: data.nome,
          descricao: data.descricao ?? null,
          codSubcategoria,
        },
      });

      categoriasLogger.info(
        { categoriaId, subcategoriaId: created.id },
        'Subcategoria criada com sucesso',
      );

      return mapSubcategoria(created);
    });
  },

  async updateSubcategoria(
    subcategoriaId: number,
    data: { nome?: string; descricao?: string | null },
  ) {
    try {
      await prisma.cursosSubcategorias.update({
        where: { id: subcategoriaId },
        data: {
          nome: data.nome ?? undefined,
          descricao: data.descricao ?? undefined,
        },
      });

      categoriasLogger.info({ subcategoriaId }, 'Subcategoria atualizada com sucesso');

      return fetchSubcategoria(subcategoriaId);
    } catch (error) {
      handlePrismaNotFound(error, 'SUBCATEGORIA_NOT_FOUND', 'Subcategoria não encontrada');
      throw error;
    }
  },

  async removeSubcategoria(subcategoriaId: number) {
    try {
      await prisma.cursosSubcategorias.delete({ where: { id: subcategoriaId } });

      categoriasLogger.info({ subcategoriaId }, 'Subcategoria removida com sucesso');

      return { success: true } as const;
    } catch (error) {
      handlePrismaNotFound(error, 'SUBCATEGORIA_NOT_FOUND', 'Subcategoria não encontrada');
      throw error;
    }
  },
};
