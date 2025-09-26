import { CandidatosAreasInteresse, CandidatosSubareasInteresse } from '@prisma/client';

import { prisma } from '@/config/prisma';

export type CreateAreaInteresseData = {
  categoria: string;
  subareas: string[];
};

export type UpdateAreaInteresseData = Partial<CreateAreaInteresseData>;

export type CreateSubareaInteresseData = { nome: string };

export type UpdateSubareaInteresseData = Partial<CreateSubareaInteresseData>;

const baseInclude = {
  subareas: {
    orderBy: { nome: 'asc' as const },
    include: {
      vagas: {
        select: { id: true },
      },
    },
  },
  vagas: {
    select: { id: true },
  },
} as const;

type SubareaWithRelations = CandidatosSubareasInteresse & { vagas: { id: string }[] };

type AreaWithRelations = CandidatosAreasInteresse & {
  subareas: SubareaWithRelations[];
  vagas: { id: string }[];
};

const serializeSubarea = (subarea: SubareaWithRelations) => ({
  id: subarea.id,
  areaId: subarea.areaId,
  nome: subarea.nome,
  vagasRelacionadas: subarea.vagas.map((vaga) => vaga.id),
  criadoEm: subarea.criadoEm,
  atualizadoEm: subarea.atualizadoEm,
});

const serialize = (area: AreaWithRelations) => ({
  id: area.id,
  categoria: area.categoria,
  subareas: area.subareas.map(serializeSubarea),
  vagasRelacionadas: area.vagas.map((vaga) => vaga.id),
  criadoEm: area.criadoEm,
  atualizadoEm: area.atualizadoEm,
});

const normalizeCategoria = (categoria: string) => categoria.trim();

const normalizeSubareaNome = (nome: string) => nome.trim();

const normalizeSubareas = (subareas: string[]) =>
  Array.from(new Set(subareas.map(normalizeSubareaNome).filter(Boolean)));

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

  async createSubarea(areaId: number, data: CreateSubareaInteresseData) {
    const nome = normalizeSubareaNome(data.nome);

    return prisma.$transaction(async (tx) => {
      await tx.candidatosAreasInteresse.findUniqueOrThrow({ where: { id: areaId } });

      const subarea = await tx.candidatosSubareasInteresse.create({
        data: { areaId, nome },
        include: {
          vagas: {
            select: { id: true },
          },
        },
      });

      return serializeSubarea(subarea);
    });
  },

  async updateSubarea(id: number, data: UpdateSubareaInteresseData) {
    const updateData: { nome?: string } = {};

    if (data.nome !== undefined) {
      updateData.nome = normalizeSubareaNome(data.nome);
    }

    const subarea = await prisma.candidatosSubareasInteresse.update({
      where: { id },
      data: updateData,
      include: {
        vagas: {
          select: { id: true },
        },
      },
    });

    return serializeSubarea(subarea);
  },

  async removeSubarea(id: number) {
    await prisma.candidatosSubareasInteresse.delete({ where: { id } });
  },
};
