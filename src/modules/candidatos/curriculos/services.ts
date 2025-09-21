import { Roles } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type { CurriculoCreateInput, CurriculoUpdateInput } from './validators';

const MAX_CURRICULOS = 5;

export const curriculosService = {
  listOwn: async (usuarioId: string) => {
    return prisma.usuariosCurriculos.findMany({
      where: { usuarioId },
      orderBy: [
        { principal: 'desc' },
        { atualizadoEm: 'desc' },
      ],
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
    const { principal, ...rest } = data;
    const shouldBePrincipal = total === 0 || principal === true;

    return prisma.$transaction(async (tx) => {
      if (shouldBePrincipal) {
        await tx.usuariosCurriculos.updateMany({
          where: { usuarioId, principal: true },
          data: { principal: false },
        });
      }

      const created = await tx.usuariosCurriculos.create({
        data: {
          usuarioId,
          ...rest,
          principal: shouldBePrincipal,
        },
      });

      if (!shouldBePrincipal) {
        const principalExists = await tx.usuariosCurriculos.count({
          where: { usuarioId, principal: true },
        });

        if (principalExists === 0) {
          return tx.usuariosCurriculos.update({
            where: { id: created.id },
            data: { principal: true, ultimaAtualizacao: new Date() },
          });
        }
      }

      return created;
    });
  },

  update: async (usuarioId: string, id: string, data: CurriculoUpdateInput) => {
    const exists = await prisma.usuariosCurriculos.findFirst({ where: { id, usuarioId } });
    if (!exists) throw Object.assign(new Error('Currículo não encontrado'), { code: 'NOT_FOUND' });
    const { principal, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      if (principal === true) {
        await tx.usuariosCurriculos.updateMany({
          where: { usuarioId, principal: true, id: { not: id } },
          data: { principal: false },
        });
      }

      if (principal === false) {
        const otherPrincipal = await tx.usuariosCurriculos.count({
          where: { usuarioId, principal: true, id: { not: id } },
        });
        if (otherPrincipal === 0) {
          throw Object.assign(new Error('É necessário manter ao menos um currículo principal'), {
            code: 'CURRICULO_PRINCIPAL_REQUIRED',
          });
        }
      }

      const updated = await tx.usuariosCurriculos.update({
        where: { id },
        data: {
          ...rest,
          ...(principal !== undefined ? { principal } : {}),
          ultimaAtualizacao: new Date(),
        },
      });

      const principalExists = await tx.usuariosCurriculos.count({
        where: { usuarioId, principal: true },
      });

      if (principalExists === 0) {
        return tx.usuariosCurriculos.update({
          where: { id },
          data: { principal: true, ultimaAtualizacao: new Date() },
        });
      }

      return updated;
    });
  },

  remove: async (usuarioId: string, id: string) => {
    const exists = await prisma.usuariosCurriculos.findFirst({ where: { id, usuarioId } });
    if (!exists) throw Object.assign(new Error('Currículo não encontrado'), { code: 'NOT_FOUND' });
    await prisma.$transaction(async (tx) => {
      await tx.usuariosCurriculos.delete({ where: { id } });

      if (exists.principal) {
        const nextPrincipal = await tx.usuariosCurriculos.findFirst({
          where: { usuarioId },
          orderBy: [
            { principal: 'desc' },
            { atualizadoEm: 'desc' },
          ],
        });

        if (nextPrincipal) {
          await tx.usuariosCurriculos.update({
            where: { id: nextPrincipal.id },
            data: { principal: true, ultimaAtualizacao: new Date() },
          });
        }
      }
    });
  },
};
