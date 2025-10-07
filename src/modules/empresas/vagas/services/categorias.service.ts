import { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import {
  generateUniqueVagaCategoryCode,
  generateUniqueVagaSubcategoryCode,
} from '../utils/code-generator';

const vagasCategoriasLogger = logger.child({ module: 'EmpresasVagasCategoriasService' });

const mapSubcategoria = (
  subcategoria: Prisma.EmpresasVagasSubcategoriasGetPayload<{ include?: undefined }>,
) => ({
  id: subcategoria.id,
  codSubcategoria: subcategoria.codSubcategoria,
  nome: subcategoria.nome,
  descricao: subcategoria.descricao,
  categoriaId: subcategoria.categoriaId,
  criadoEm: subcategoria.criadoEm,
  atualizadoEm: subcategoria.atualizadoEm,
});

const mapCategoria = (
  categoria: Prisma.EmpresasVagasCategoriasGetPayload<{
    include: { subcategorias: true };
  }>,
) => ({
  id: categoria.id,
  codCategoria: categoria.codCategoria,
  nome: categoria.nome,
  descricao: categoria.descricao,
  criadoEm: categoria.criadoEm,
  atualizadoEm: categoria.atualizadoEm,
  subcategorias: (categoria.subcategorias ?? [])
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map(mapSubcategoria),
});

const findCategoriaOrThrow = async (id: string) => {
  const categoria = await prisma.empresasVagasCategorias.findUnique({ where: { id } });
  if (!categoria) {
    throw Object.assign(new Error('Categoria não encontrada'), {
      code: 'CATEGORIA_NOT_FOUND',
    });
  }
  return categoria;
};

const findSubcategoriaOrThrow = async (id: string) => {
  const subcategoria = await prisma.empresasVagasSubcategorias.findUnique({ where: { id } });
  if (!subcategoria) {
    throw Object.assign(new Error('Subcategoria não encontrada'), {
      code: 'SUBCATEGORIA_NOT_FOUND',
    });
  }
  return subcategoria;
};

export const vagasCategoriasService = {
  list: async () => {
    const categorias = await prisma.empresasVagasCategorias.findMany({
      include: { subcategorias: true },
      orderBy: { nome: 'asc' },
    });

    return categorias.map(mapCategoria);
  },

  get: async (id: string) => {
    const categoria = await prisma.empresasVagasCategorias.findUnique({
      where: { id },
      include: { subcategorias: true },
    });

    if (!categoria) {
      throw Object.assign(new Error('Categoria não encontrada'), {
        code: 'CATEGORIA_NOT_FOUND',
      });
    }

    return mapCategoria(categoria);
  },

  create: async (payload: { nome: string; descricao?: string | null }) => {
    const categoria = await prisma.$transaction(async (tx) => {
      const codCategoria = await generateUniqueVagaCategoryCode(tx, vagasCategoriasLogger);
      const created = await tx.empresasVagasCategorias.create({
        data: {
          codCategoria,
          nome: payload.nome,
          descricao: payload.descricao ?? null,
        },
      });

      vagasCategoriasLogger.info(
        { categoriaId: created.id },
        'Categoria de vagas criada com sucesso',
      );
      return created;
    });

    return vagasCategoriasService.get(categoria.id);
  },

  update: async (id: string, payload: { nome?: string; descricao?: string | null }) => {
    await findCategoriaOrThrow(id);

    const categoria = await prisma.empresasVagasCategorias.update({
      where: { id },
      data: {
        ...(payload.nome !== undefined ? { nome: payload.nome } : {}),
        ...(payload.descricao !== undefined ? { descricao: payload.descricao } : {}),
      },
      include: { subcategorias: true },
    });

    vagasCategoriasLogger.info({ categoriaId: id }, 'Categoria de vagas atualizada com sucesso');
    return mapCategoria(categoria);
  },

  remove: async (id: string) => {
    await findCategoriaOrThrow(id);

    await prisma.empresasVagasCategorias.delete({ where: { id } });
    vagasCategoriasLogger.info({ categoriaId: id }, 'Categoria de vagas removida com sucesso');
  },

  createSubcategoria: async (
    categoriaId: string,
    payload: { nome: string; descricao?: string | null },
  ) => {
    await findCategoriaOrThrow(categoriaId);

    const subcategoria = await prisma.$transaction(async (tx) => {
      const codSubcategoria = await generateUniqueVagaSubcategoryCode(tx, vagasCategoriasLogger);
      const created = await tx.empresasVagasSubcategorias.create({
        data: {
          categoriaId,
          codSubcategoria,
          nome: payload.nome,
          descricao: payload.descricao ?? null,
        },
      });

      vagasCategoriasLogger.info(
        { categoriaId, subcategoriaId: created.id },
        'Subcategoria de vagas criada com sucesso',
      );
      return created;
    });

    return mapSubcategoria(subcategoria);
  },

  updateSubcategoria: async (
    subcategoriaId: string,
    payload: { nome?: string; descricao?: string | null },
  ) => {
    await findSubcategoriaOrThrow(subcategoriaId);

    const subcategoria = await prisma.empresasVagasSubcategorias.update({
      where: { id: subcategoriaId },
      data: {
        ...(payload.nome !== undefined ? { nome: payload.nome } : {}),
        ...(payload.descricao !== undefined ? { descricao: payload.descricao } : {}),
      },
    });

    vagasCategoriasLogger.info({ subcategoriaId }, 'Subcategoria de vagas atualizada com sucesso');

    return mapSubcategoria(subcategoria);
  },

  removeSubcategoria: async (subcategoriaId: string) => {
    await findSubcategoriaOrThrow(subcategoriaId);

    await prisma.empresasVagasSubcategorias.delete({ where: { id: subcategoriaId } });
    vagasCategoriasLogger.info({ subcategoriaId }, 'Subcategoria de vagas removida com sucesso');
  },
};
