import { CandidatoLogTipo, Prisma, Roles } from '@prisma/client';
import { prisma } from '@/config/prisma';
import type { CurriculoCreateInput, CurriculoUpdateInput } from './validators';
import { candidatoLogsService } from '@/modules/candidatos/logs/service';
import { candidaturasService } from '@/modules/candidatos/candidaturas/services';

const MAX_CURRICULOS = 5;

export interface CurriculosFiltros {
  busca?: string; // Busca em título ou resumo
  principal?: boolean; // Se é principal (true/false)
  autorizaContato?: boolean; // Se autoriza contato (true/false)
  salarioMinimo?: number; // Pretensão salarial mínima (filtra preferencias.salarioMinimo >= valor)
  salarioMaximo?: number; // Pretensão salarial máxima (filtra preferencias.salarioMinimo <= valor)
}

export const curriculosService = {
  listOwn: async (usuarioId: string, filtros?: CurriculosFiltros) => {
    // Construir where clause
    const where: Prisma.UsuariosCurriculosWhereInput = {
      usuarioId,
    };

    // Filtro: busca textual em título ou resumo
    if (filtros?.busca) {
      const buscaTerm = filtros.busca.trim();
      where.OR = [
        { titulo: { contains: buscaTerm, mode: 'insensitive' } },
        { resumo: { contains: buscaTerm, mode: 'insensitive' } },
      ];
    }

    // Filtro: principal
    if (filtros?.principal !== undefined) {
      where.principal = filtros.principal;
    }

    // Filtros que envolvem campos JSON precisam ser aplicados após buscar
    const curriculos = await prisma.usuariosCurriculos.findMany({
      where,
      include: {
        Usuarios: {
          select: {
            UsuariosInformation: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: [{ principal: 'desc' }, { atualizadoEm: 'desc' }],
    });

    // Mapear e aplicar filtros de campos JSON
    let curriculosMapeados = curriculos.map((curriculo) => {
      const { Usuarios, ...rest } = curriculo;
      return {
        ...rest,
        avatarUrl: Usuarios?.UsuariosInformation?.avatarUrl || null,
      };
    });

    // Filtro: autorizaContato (campo JSON consentimentos.autorizarContato)
    if (filtros?.autorizaContato !== undefined) {
      curriculosMapeados = curriculosMapeados.filter((curriculo) => {
        const consentimentos = curriculo.consentimentos as any;
        if (!consentimentos) return false;
        return consentimentos.autorizarContato === filtros.autorizaContato;
      });
    }

    // Filtro: salarioMinimo (campo JSON preferencias.salarioMinimo)
    if (filtros?.salarioMinimo !== undefined) {
      curriculosMapeados = curriculosMapeados.filter((curriculo) => {
        const preferencias = curriculo.preferencias as any;
        if (!preferencias || preferencias.salarioMinimo === undefined) return false;
        return Number(preferencias.salarioMinimo) >= filtros.salarioMinimo!;
      });
    }

    // Filtro: salarioMaximo (campo JSON preferencias.salarioMinimo)
    if (filtros?.salarioMaximo !== undefined) {
      curriculosMapeados = curriculosMapeados.filter((curriculo) => {
        const preferencias = curriculo.preferencias as any;
        if (!preferencias || preferencias.salarioMinimo === undefined) return false;
        return Number(preferencias.salarioMinimo) <= filtros.salarioMaximo!;
      });
    }

    return curriculosMapeados;
  },

  getOwn: async (usuarioId: string, id: string) => {
    const curriculo = await prisma.usuariosCurriculos.findFirst({
      where: { id, usuarioId },
      include: {
        Usuarios: {
          select: {
            UsuariosInformation: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!curriculo) return null;

    // Mapear para incluir avatarUrl no nível raiz
    const { Usuarios, ...rest } = curriculo;
    return {
      ...rest,
      avatarUrl: Usuarios?.UsuariosInformation?.avatarUrl || null,
    };
  },

  findById: async (id: string) => {
    const curriculo = await prisma.usuariosCurriculos.findUnique({
      where: { id },
      include: {
        Usuarios: {
          select: {
            UsuariosInformation: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!curriculo) return null;

    // Mapear para incluir avatarUrl no nível raiz
    const { Usuarios, ...rest } = curriculo;
    return {
      ...rest,
      avatarUrl: Usuarios?.UsuariosInformation?.avatarUrl || null,
    };
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

      await candidatoLogsService.create(
        {
          usuarioId,
          tipo: CandidatoLogTipo.CURRICULO_CRIADO,
          metadata: {
            curriculoId: created.id,
            principal: created.principal,
          },
        },
        tx,
      );

      if (total === 0) {
        await candidatoLogsService.create(
          {
            usuarioId,
            tipo: CandidatoLogTipo.CANDIDATO_ATIVADO,
            metadata: {
              motivo: 'PRIMEIRO_CURRICULO',
              curriculoId: created.id,
            },
          },
          tx,
        );
      }

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

      await candidatoLogsService.create(
        {
          usuarioId,
          tipo: CandidatoLogTipo.CURRICULO_ATUALIZADO,
          metadata: {
            curriculoId: updated.id,
            principal: updated.principal,
          },
        },
        tx,
      );

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

  setPrincipal: async (usuarioId: string, id: string) => {
    const exists = await prisma.usuariosCurriculos.findFirst({ where: { id, usuarioId } });
    if (!exists) throw Object.assign(new Error('Currículo não encontrado'), { code: 'NOT_FOUND' });

    // Se já é principal, não precisa fazer nada
    if (exists.principal) {
      return exists;
    }

    return prisma.$transaction(async (tx) => {
      // Desmarcar todos os outros currículos principais do usuário
      await tx.usuariosCurriculos.updateMany({
        where: { usuarioId, principal: true, id: { not: id } },
        data: { principal: false },
      });

      // Marcar este currículo como principal
      const updated = await tx.usuariosCurriculos.update({
        where: { id },
        data: {
          principal: true,
          ultimaAtualizacao: new Date(),
        },
        include: {
          Usuarios: {
            select: {
              UsuariosInformation: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      // Log de auditoria
      await candidatoLogsService.create(
        {
          usuarioId,
          tipo: CandidatoLogTipo.CURRICULO_ATUALIZADO,
          metadata: {
            curriculoId: updated.id,
            principal: true,
            acao: 'DEFINIDO_COMO_PRINCIPAL',
          },
        },
        tx,
      );

      // Mapear para incluir avatarUrl no nível raiz
      const { Usuarios, ...rest } = updated;
      return {
        ...rest,
        avatarUrl: Usuarios?.UsuariosInformation?.avatarUrl || null,
      };
    });
  },

  remove: async (usuarioId: string, id: string) => {
    const exists = await prisma.usuariosCurriculos.findFirst({ where: { id, usuarioId } });
    if (!exists) throw Object.assign(new Error('Currículo não encontrado'), { code: 'NOT_FOUND' });
    await prisma.$transaction(async (tx) => {
      await candidaturasService.cancelForCandidato({
        usuarioId,
        curriculoId: id,
        motivo: 'CURRICULO_REMOVIDO',
        tx,
      });

      await tx.usuariosCurriculos.delete({ where: { id } });

      if (exists.principal) {
        const nextPrincipal = await tx.usuariosCurriculos.findFirst({
          where: { usuarioId },
          orderBy: [{ principal: 'desc' }, { atualizadoEm: 'desc' }],
        });

        if (nextPrincipal) {
          await tx.usuariosCurriculos.update({
            where: { id: nextPrincipal.id },
            data: { principal: true, ultimaAtualizacao: new Date() },
          });
        }
      }

      await candidatoLogsService.create(
        {
          usuarioId,
          tipo: CandidatoLogTipo.CURRICULO_REMOVIDO,
          metadata: {
            curriculoId: id,
            principal: exists.principal,
          },
        },
        tx,
      );

      const remaining = await tx.usuariosCurriculos.count({ where: { usuarioId } });

      if (remaining === 0) {
        await candidatoLogsService.create(
          {
            usuarioId,
            tipo: CandidatoLogTipo.CANDIDATO_DESATIVADO,
            metadata: {
              motivo: 'SEM_CURRICULOS_ATIVOS',
            },
          },
          tx,
        );
      }
    });
  },
};
