import { CandidatosAreasInteresse, CandidatosSubareasInteresse } from '@prisma/client';

import { prisma } from '@/config/prisma';

export type CreateAreaInteresseData = {
  categoria: string;
  subareas: string[];
};

export type UpdateAreaInteresseData = Partial<CreateAreaInteresseData>;

const baseInclude = {
  subareas: {
    orderBy: { nome: 'asc' as const },
  },
};

const serialize = (
  area: CandidatosAreasInteresse & { subareas: CandidatosSubareasInteresse[] },
) => ({
  id: area.id,
  categoria: area.categoria,
  subareas: area.subareas.map((subarea) => subarea.nome),
  criadoEm: area.criadoEm,
  atualizadoEm: area.atualizadoEm,
});

const normalizeCategoria = (categoria: string) => categoria.trim();

const normalizeSubareas = (subareas: string[]) =>
  Array.from(new Set(subareas.map((nome) => nome.trim()).filter(Boolean)));

export const areasInteresseService = {
  async list() {
    const areas = await prisma.candidatosAreasInteresse.findMany({
      include: baseInclude,
      orderBy: { categoria: 'asc' },
    });

    return areas.map(serialize);
  },

  async get(id: number) {
    const area = await prisma.candidatosAreasInteresse.findUnique({
      where: { id },
      include: baseInclude,
    });

    return area ? serialize(area) : null;
  },

  async create(data: CreateAreaInteresseData) {
    const categoria = normalizeCategoria(data.categoria);
    const subareas = normalizeSubareas(data.subareas);

    const area = await prisma.candidatosAreasInteresse.create({
      data: {
        categoria,
        subareas: {
          create: subareas.map((nome) => ({ nome })),
        },
      },
      include: baseInclude,
    });

    return serialize(area);
  },

  async update(id: number, data: UpdateAreaInteresseData) {
    const updateData: { categoria?: string } = {};

    if (data.categoria !== undefined) {
      updateData.categoria = normalizeCategoria(data.categoria);
    }

    return prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.candidatosAreasInteresse.update({
          where: { id },
          data: updateData,
        });
      } else {
        await tx.candidatosAreasInteresse.findUniqueOrThrow({ where: { id } });
      }

      if (data.subareas !== undefined) {
        const sanitizedSubareas = normalizeSubareas(data.subareas);
        const currentSubareas = await tx.candidatosSubareasInteresse.findMany({
          where: { areaId: id },
        });

        const currentMap = new Map(currentSubareas.map((subarea) => [subarea.nome, subarea.id]));
        const nextSet = new Set(sanitizedSubareas);

        const toDelete = currentSubareas
          .filter((subarea) => !nextSet.has(subarea.nome))
          .map((subarea) => subarea.id);

        if (toDelete.length > 0) {
          await tx.candidatosSubareasInteresse.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        const toCreate = sanitizedSubareas.filter((nome) => !currentMap.has(nome));

        if (toCreate.length > 0) {
          await tx.candidatosSubareasInteresse.createMany({
            data: toCreate.map((nome) => ({ areaId: id, nome })),
          });
        }
      }

      const area = await tx.candidatosAreasInteresse.findUniqueOrThrow({
        where: { id },
        include: baseInclude,
      });

      return serialize(area);
    });
  },

  async remove(id: number) {
    await prisma.candidatosAreasInteresse.delete({ where: { id } });
  },
};
