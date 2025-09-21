import { Roles } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type { CurriculoCreateInput, CurriculoUpdateInput } from './validators';

const MAX_CURRICULOS = 5;

export const curriculosService = {
  listOwn: async (usuarioId: string) => {
    return prisma.usuariosCurriculos.findMany({
      where: { usuarioId },
      orderBy: { atualizadoEm: 'desc' },
    });
  },

  getOwn: async (usuarioId: string, id: string) => {
    return prisma.usuariosCurriculos.findFirst({ where: { id, usuarioId } });
  },

  create: async (usuarioId: string, role: Roles, data: CurriculoCreateInput) => {
    if (role !== Roles.ALUNO_CANDIDATO) {
      throw Object.assign(new Error('Apenas candidatos podem criar currículos'), {
        code: 'FORBIDDEN',
      });
    }
    const total = await prisma.usuariosCurriculos.count({ where: { usuarioId } });
    if (total >= MAX_CURRICULOS) {
      throw Object.assign(new Error('Limite de 5 currículos atingido'), {
        code: 'CURRICULO_LIMIT',
      });
    }
    return prisma.usuariosCurriculos.create({ data: { usuarioId, ...data } });
  },

  update: async (usuarioId: string, id: string, data: CurriculoUpdateInput) => {
    const exists = await prisma.usuariosCurriculos.findFirst({ where: { id, usuarioId } });
    if (!exists) throw Object.assign(new Error('Currículo não encontrado'), { code: 'NOT_FOUND' });
    return prisma.usuariosCurriculos.update({
      where: { id },
      data: { ...data, ultimaAtualizacao: new Date() },
    });
  },

  remove: async (usuarioId: string, id: string) => {
    const exists = await prisma.usuariosCurriculos.findFirst({ where: { id, usuarioId } });
    if (!exists) throw Object.assign(new Error('Currículo não encontrado'), { code: 'NOT_FOUND' });
    await prisma.usuariosCurriculos.delete({ where: { id } });
  },
};
