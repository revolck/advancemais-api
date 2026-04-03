import { prisma } from '@/config/prisma';
import { getVagaStatusLabel } from '@/modules/entrevistas/utils/presentation';
import { Prisma, Roles, StatusDeVagas } from '@prisma/client';

import type { RecruiterLinkCreateBody } from '../validators/recruiter-links.schema';
import { recordUserAuditEvent } from '../utils/user-history';

const OPERABLE_STATUS_FILTER = {
  not: StatusDeVagas.RASCUNHO,
} as const;

const appError = (status: number, code: string, message: string) =>
  Object.assign(new Error(message), {
    status,
    code,
  });

const buildEmpresaPayload = (empresa: {
  id: string;
  nomeCompleto: string | null;
  codUsuario: string | null;
  cnpj: string | null;
}) => ({
  id: empresa.id,
  nomeExibicao: empresa.nomeCompleto,
  codigo: empresa.codUsuario,
  cnpj: empresa.cnpj ?? null,
});

const buildEscopoPayload = (tipoVinculo: 'EMPRESA' | 'VAGA') => ({
  label: tipoVinculo === 'EMPRESA' ? 'Acesso completo à empresa' : 'Acesso restrito à vaga',
  permiteVagasPublicadas: true,
  permiteVagasDespublicadas: true,
  permiteCandidatos: true,
});

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

type RecruiterLinkAuditContext = {
  actorId?: string | null;
  actorRole?: string | null;
  actorNome?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

type EmpresaAuditPayloadInput = {
  id: string;
  nomeCompleto: string | null;
  codUsuario: string | null;
};

type VagaAuditPayloadInput = {
  id: string;
  titulo: string | null;
  codigo: string | null;
};

const getEmpresaAuditLabel = (empresa: EmpresaAuditPayloadInput) =>
  empresa.nomeCompleto?.trim() || empresa.codUsuario?.trim() || 'empresa selecionada';

const getVagaAuditLabel = (vaga: VagaAuditPayloadInput) =>
  vaga.titulo?.trim() || vaga.codigo?.trim() || 'vaga selecionada';

const buildRecruiterLinkAuditPayload = (params: {
  tipoVinculo: 'EMPRESA' | 'VAGA';
  empresa: EmpresaAuditPayloadInput;
  vaga?: VagaAuditPayloadInput | null;
}) => ({
  tipoVinculo: params.tipoVinculo,
  empresaId: params.empresa.id,
  empresaNome: params.empresa.nomeCompleto ?? null,
  empresaCodigo: params.empresa.codUsuario ?? null,
  ...(params.tipoVinculo === 'VAGA'
    ? {
        vagaId: params.vaga?.id ?? null,
        vagaTitulo: params.vaga?.titulo ?? null,
        vagaCodigo: params.vaga?.codigo ?? null,
      }
    : {}),
});

const buildRecruiterLinkNotificationPayload = (params: {
  tipoVinculo: 'EMPRESA' | 'VAGA';
  actor: Pick<RecruiterLinkAuditContext, 'actorId' | 'actorRole' | 'actorNome'>;
  empresa: EmpresaAuditPayloadInput;
  vaga?: VagaAuditPayloadInput | null;
}) => ({
  evento: 'RECRUTADOR_VINCULO_CRIADO',
  tipoVinculo: params.tipoVinculo,
  empresaId: params.empresa.id,
  empresaNome: params.empresa.nomeCompleto ?? null,
  empresaCodigo: params.empresa.codUsuario ?? null,
  ...(params.tipoVinculo === 'VAGA'
    ? {
        vagaId: params.vaga?.id ?? null,
        vagaTitulo: params.vaga?.titulo ?? null,
        vagaCodigo: params.vaga?.codigo ?? null,
      }
    : {}),
  atorId: params.actor.actorId ?? null,
  atorNome: params.actor.actorNome ?? null,
  atorRole: params.actor.actorRole ?? null,
  origem: 'PAINEL_ADMIN',
});

const createRecruiterLinkNotification = async (params: {
  client: PrismaClientOrTx;
  targetUserId: string;
  tipoVinculo: 'EMPRESA' | 'VAGA';
  actor: Pick<RecruiterLinkAuditContext, 'actorId' | 'actorRole' | 'actorNome'>;
  empresa: EmpresaAuditPayloadInput;
  vaga?: VagaAuditPayloadInput | null;
}) => {
  const dados = buildRecruiterLinkNotificationPayload({
    tipoVinculo: params.tipoVinculo,
    actor: params.actor,
    empresa: params.empresa,
    vaga: params.vaga,
  });

  const isCompanyLink = params.tipoVinculo === 'EMPRESA';

  await params.client.notificacoes.create({
    data: {
      usuarioId: params.targetUserId,
      tipo: 'SISTEMA',
      prioridade: 'NORMAL',
      titulo: 'Novo acesso liberado',
      mensagem: isCompanyLink
        ? `Você agora pode operar a empresa ${getEmpresaAuditLabel(
            params.empresa,
          )} e as vagas vinculadas a ela.`
        : `Você agora pode operar a vaga ${getVagaAuditLabel(params.vaga!)} da empresa ${getEmpresaAuditLabel(
            params.empresa,
          )}.`,
      linkAcao: isCompanyLink
        ? '/dashboard/empresas'
        : `/dashboard/empresas/vagas/${params.vaga!.id}`,
      vagaId: isCompanyLink ? null : params.vaga!.id,
      dados,
    },
  });
};

const recordRecruiterLinkAuditEvent = async (params: {
  client: PrismaClientOrTx;
  targetUserId: string;
  action:
    | 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO'
    | 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_REMOVIDO'
    | 'USUARIO_RECRUTADOR_VINCULO_VAGA_CRIADO'
    | 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO';
  descricao: string;
  context?: RecruiterLinkAuditContext;
  dadosAnteriores?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}) =>
  recordUserAuditEvent({
    client: params.client,
    actorId: params.context?.actorId ?? null,
    actorRole: params.context?.actorRole ?? null,
    targetUserId: params.targetUserId,
    action: params.action,
    descricao: params.descricao,
    dadosAnteriores: params.dadosAnteriores,
    dadosNovos: params.dadosNovos,
    meta: {
      ...(params.meta ?? {}),
      origem: 'PAINEL_ADMIN',
    },
    ip: params.context?.ip ?? null,
    userAgent: params.context?.userAgent ?? null,
  });

const ensureRecruiterTarget = async (userId: string) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      nomeCompleto: true,
    },
  });

  if (!usuario) {
    throw appError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
  }

  if (usuario.role !== Roles.RECRUTADOR) {
    throw appError(
      409,
      'USER_IS_NOT_RECRUITER',
      'O usuário informado não possui a função de recrutador.',
    );
  }

  return usuario;
};

const ensureEmpresa = async (empresaUsuarioId: string) => {
  const empresa = await prisma.usuarios.findUnique({
    where: { id: empresaUsuarioId },
    select: {
      id: true,
      role: true,
      nomeCompleto: true,
      codUsuario: true,
      cnpj: true,
    },
  });

  if (!empresa || empresa.role !== Roles.EMPRESA) {
    throw appError(404, 'EMPRESA_NOT_FOUND', 'Empresa não encontrada.');
  }

  return empresa;
};

const ensureVaga = async (vagaId: string) => {
  const vaga = await prisma.empresasVagas.findUnique({
    where: { id: vagaId },
    select: {
      id: true,
      usuarioId: true,
      titulo: true,
      codigo: true,
      status: true,
    },
  });

  if (!vaga) {
    throw appError(404, 'VAGA_NOT_FOUND', 'Vaga não encontrada.');
  }

  if (vaga.status === StatusDeVagas.RASCUNHO) {
    throw appError(404, 'VAGA_NOT_FOUND', 'Vaga não encontrada.');
  }

  return vaga;
};

export const recrutadorLinksAdminService = {
  list: async (userId: string) => {
    await ensureRecruiterTarget(userId);

    const [empresaLinks, vagaLinks] = await prisma.$transaction([
      prisma.usuariosEmpresasVinculos.findMany({
        where: { recrutadorId: userId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          empresaUsuarioId: true,
          criadoEm: true,
          Usuarios_UsuariosEmpresasVinculos_empresaUsuarioIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              codUsuario: true,
              cnpj: true,
            },
          },
        },
      }),
      prisma.usuariosVagasVinculos.findMany({
        where: { recrutadorId: userId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          criadoEm: true,
          EmpresasVagas: {
            select: {
              id: true,
              titulo: true,
              codigo: true,
              status: true,
              usuarioId: true,
              Usuarios: {
                select: {
                  id: true,
                  nomeCompleto: true,
                  codUsuario: true,
                  cnpj: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const linkedEmpresaIds = new Set(empresaLinks.map((item) => item.empresaUsuarioId));

    const items = [
      ...empresaLinks.map((item) => ({
        id: item.id,
        tipoVinculo: 'EMPRESA' as const,
        ativo: true,
        criadoEm: item.criadoEm.toISOString(),
        empresa: buildEmpresaPayload(
          item.Usuarios_UsuariosEmpresasVinculos_empresaUsuarioIdToUsuarios,
        ),
        vaga: null,
        escopo: buildEscopoPayload('EMPRESA'),
      })),
      ...vagaLinks
        .filter((item) => !linkedEmpresaIds.has(item.EmpresasVagas.usuarioId))
        .map((item) => ({
          id: item.id,
          tipoVinculo: 'VAGA' as const,
          ativo: true,
          criadoEm: item.criadoEm.toISOString(),
          empresa: buildEmpresaPayload(item.EmpresasVagas.Usuarios),
          vaga: {
            id: item.EmpresasVagas.id,
            titulo: item.EmpresasVagas.titulo,
            codigo: item.EmpresasVagas.codigo,
            status: item.EmpresasVagas.status,
          },
          escopo: buildEscopoPayload('VAGA'),
        })),
    ].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));

    return { items };
  },

  listEmpresaOptions: async (userId: string) => {
    await ensureRecruiterTarget(userId);

    const directEmpresaIds = new Set(
      await prisma.usuariosEmpresasVinculos
        .findMany({
          where: { recrutadorId: userId },
          select: { empresaUsuarioId: true },
        })
        .then((rows) => rows.map((row) => row.empresaUsuarioId)),
    );

    const empresas = await prisma.usuarios.findMany({
      where: {
        role: Roles.EMPRESA,
        EmpresasVagas: {
          some: {
            status: OPERABLE_STATUS_FILTER,
          },
        },
      },
      orderBy: { nomeCompleto: 'asc' },
      select: {
        id: true,
        nomeCompleto: true,
        codUsuario: true,
        cnpj: true,
        EmpresasVagas: {
          where: {
            status: OPERABLE_STATUS_FILTER,
          },
          select: { id: true },
        },
      },
    });

    return {
      items: empresas.map((empresa) => ({
        id: empresa.id,
        nomeExibicao: empresa.nomeCompleto,
        codigo: empresa.codUsuario,
        cnpj: empresa.cnpj,
        totalVagasOperaveis: empresa.EmpresasVagas.length,
        jaVinculadoPorEmpresa: directEmpresaIds.has(empresa.id),
      })),
    };
  },

  listVagaOptions: async (userId: string, empresaUsuarioId: string) => {
    await ensureRecruiterTarget(userId);
    await ensureEmpresa(empresaUsuarioId);

    const [directCompanyLink, directVagaIds, vagas] = await prisma.$transaction([
      prisma.usuariosEmpresasVinculos.findUnique({
        where: {
          recrutadorId_empresaUsuarioId: {
            recrutadorId: userId,
            empresaUsuarioId,
          },
        },
        select: { id: true },
      }),
      prisma.usuariosVagasVinculos.findMany({
        where: {
          recrutadorId: userId,
          EmpresasVagas: { usuarioId: empresaUsuarioId },
        },
        select: { vagaId: true },
      }),
      prisma.empresasVagas.findMany({
        where: {
          usuarioId: empresaUsuarioId,
          status: OPERABLE_STATUS_FILTER,
        },
        orderBy: [{ inseridaEm: 'desc' }, { titulo: 'asc' }],
        select: {
          id: true,
          titulo: true,
          codigo: true,
          status: true,
          usuarioId: true,
        },
      }),
    ]);

    if (directCompanyLink) {
      return { items: [] };
    }

    const linkedVagaIds = new Set(directVagaIds.map((row) => row.vagaId));

    return {
      items: vagas.map((vaga) => ({
        id: vaga.id,
        titulo: vaga.titulo,
        codigo: vaga.codigo,
        status: vaga.status,
        statusLabel: getVagaStatusLabel(vaga.status),
        empresaUsuarioId: vaga.usuarioId,
        jaVinculadoNestaVaga: linkedVagaIds.has(vaga.id),
      })),
    };
  },

  create: async (
    userId: string,
    payload: RecruiterLinkCreateBody,
    context?: RecruiterLinkAuditContext,
  ) => {
    await ensureRecruiterTarget(userId);
    const empresa = await ensureEmpresa(payload.empresaUsuarioId);

    if (payload.tipoVinculo === 'EMPRESA') {
      const existingCompanyLink = await prisma.usuariosEmpresasVinculos.findUnique({
        where: {
          recrutadorId_empresaUsuarioId: {
            recrutadorId: userId,
            empresaUsuarioId: payload.empresaUsuarioId,
          },
        },
        select: { id: true },
      });

      if (existingCompanyLink) {
        throw appError(
          409,
          'RECRUITER_LINK_ALREADY_EXISTS',
          'O recrutador já possui vínculo com esta empresa.',
        );
      }

      const vinculo = await prisma.$transaction(async (tx) => {
        const companyAuditPayload = buildRecruiterLinkAuditPayload({
          tipoVinculo: 'EMPRESA',
          empresa,
        });

        const created = await tx.usuariosEmpresasVinculos.create({
          data: {
            recrutadorId: userId,
            empresaUsuarioId: payload.empresaUsuarioId,
          },
          select: {
            id: true,
            criadoEm: true,
          },
        });

        await recordRecruiterLinkAuditEvent({
          client: tx,
          targetUserId: userId,
          action: 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO',
          descricao: `O recrutador recebeu acesso operacional à empresa ${getEmpresaAuditLabel(
            empresa,
          )}.`,
          context,
          dadosAnteriores: null,
          dadosNovos: companyAuditPayload,
          meta: companyAuditPayload,
        });

        const redundantVagaLinks = await tx.usuariosVagasVinculos.findMany({
          where: {
            recrutadorId: userId,
            EmpresasVagas: {
              usuarioId: payload.empresaUsuarioId,
            },
          },
          select: {
            id: true,
            EmpresasVagas: {
              select: {
                id: true,
                titulo: true,
                codigo: true,
              },
            },
          },
        });

        if (redundantVagaLinks.length > 0) {
          await tx.usuariosVagasVinculos.deleteMany({
            where: {
              id: { in: redundantVagaLinks.map((item) => item.id) },
            },
          });

          for (const redundantLink of redundantVagaLinks) {
            const redundantAuditPayload = buildRecruiterLinkAuditPayload({
              tipoVinculo: 'VAGA',
              empresa,
              vaga: redundantLink.EmpresasVagas,
            });

            await recordRecruiterLinkAuditEvent({
              client: tx,
              targetUserId: userId,
              action: 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO',
              descricao: `O recrutador perdeu o acesso restrito à vaga ${getVagaAuditLabel(
                redundantLink.EmpresasVagas,
              )}.`,
              context,
              dadosAnteriores: redundantAuditPayload,
              dadosNovos: null,
              meta: redundantAuditPayload,
            });
          }
        }

        await createRecruiterLinkNotification({
          client: tx,
          targetUserId: userId,
          tipoVinculo: 'EMPRESA',
          actor: {
            actorId: context?.actorId ?? null,
            actorNome: context?.actorNome ?? null,
            actorRole: context?.actorRole ?? null,
          },
          empresa,
        });

        return created;
      });

      return {
        id: vinculo.id,
        tipoVinculo: 'EMPRESA' as const,
        ativo: true,
        empresa: buildEmpresaPayload(empresa),
        vaga: null,
        criadoEm: vinculo.criadoEm.toISOString(),
      };
    }

    const vaga = await ensureVaga(payload.vagaId!);

    if (vaga.usuarioId !== payload.empresaUsuarioId) {
      throw appError(
        400,
        'VALIDATION_ERROR',
        'A vaga informada não pertence à empresa selecionada.',
      );
    }

    const [companyLink, existingVagaLink] = await prisma.$transaction([
      prisma.usuariosEmpresasVinculos.findUnique({
        where: {
          recrutadorId_empresaUsuarioId: {
            recrutadorId: userId,
            empresaUsuarioId: payload.empresaUsuarioId,
          },
        },
        select: { id: true },
      }),
      prisma.usuariosVagasVinculos.findUnique({
        where: {
          recrutadorId_vagaId: {
            recrutadorId: userId,
            vagaId: vaga.id,
          },
        },
        select: { id: true },
      }),
    ]);

    if (companyLink) {
      throw appError(
        409,
        'RECRUITER_LINK_REDUNDANT',
        'O recrutador já possui acesso completo a esta empresa.',
      );
    }

    if (existingVagaLink) {
      throw appError(
        409,
        'RECRUITER_LINK_ALREADY_EXISTS',
        'O recrutador já possui vínculo com esta vaga.',
      );
    }

    const vinculo = await prisma.$transaction(async (tx) => {
      const created = await tx.usuariosVagasVinculos.create({
        data: {
          recrutadorId: userId,
          vagaId: vaga.id,
        },
        select: {
          id: true,
          criadoEm: true,
        },
      });

      const vagaAuditPayload = buildRecruiterLinkAuditPayload({
        tipoVinculo: 'VAGA',
        empresa,
        vaga,
      });

      await recordRecruiterLinkAuditEvent({
        client: tx,
        targetUserId: userId,
        action: 'USUARIO_RECRUTADOR_VINCULO_VAGA_CRIADO',
        descricao: `O recrutador recebeu acesso restrito à vaga ${getVagaAuditLabel(vaga)}.`,
        context,
        dadosAnteriores: null,
        dadosNovos: vagaAuditPayload,
        meta: vagaAuditPayload,
      });

      await createRecruiterLinkNotification({
        client: tx,
        targetUserId: userId,
        tipoVinculo: 'VAGA',
        actor: {
          actorId: context?.actorId ?? null,
          actorNome: context?.actorNome ?? null,
          actorRole: context?.actorRole ?? null,
        },
        empresa,
        vaga,
      });

      return created;
    });

    return {
      id: vinculo.id,
      tipoVinculo: 'VAGA' as const,
      ativo: true,
      empresa: buildEmpresaPayload(empresa),
      vaga: {
        id: vaga.id,
        titulo: vaga.titulo,
        codigo: vaga.codigo,
        status: vaga.status,
      },
      criadoEm: vinculo.criadoEm.toISOString(),
    };
  },

  remove: async (userId: string, vinculoId: string, context?: RecruiterLinkAuditContext) => {
    await ensureRecruiterTarget(userId);

    const [empresaLink, vagaLink] = await prisma.$transaction([
      prisma.usuariosEmpresasVinculos.findFirst({
        where: {
          id: vinculoId,
          recrutadorId: userId,
        },
        select: {
          id: true,
          empresaUsuarioId: true,
          Usuarios_UsuariosEmpresasVinculos_empresaUsuarioIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              codUsuario: true,
            },
          },
        },
      }),
      prisma.usuariosVagasVinculos.findFirst({
        where: {
          id: vinculoId,
          recrutadorId: userId,
        },
        select: {
          id: true,
          EmpresasVagas: {
            select: {
              id: true,
              titulo: true,
              codigo: true,
              Usuarios: {
                select: {
                  id: true,
                  nomeCompleto: true,
                  codUsuario: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!empresaLink && !vagaLink) {
      throw appError(404, 'RECRUITER_LINK_NOT_FOUND', 'Vínculo do recrutador não encontrado.');
    }

    if (empresaLink) {
      const companyAuditPayload = buildRecruiterLinkAuditPayload({
        tipoVinculo: 'EMPRESA',
        empresa: empresaLink.Usuarios_UsuariosEmpresasVinculos_empresaUsuarioIdToUsuarios,
      });

      await prisma.$transaction(async (tx) => {
        await tx.usuariosEmpresasVinculos.delete({
          where: { id: empresaLink.id },
        });

        await recordRecruiterLinkAuditEvent({
          client: tx,
          targetUserId: userId,
          action: 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_REMOVIDO',
          descricao: `O recrutador perdeu o acesso operacional à empresa ${getEmpresaAuditLabel(
            empresaLink.Usuarios_UsuariosEmpresasVinculos_empresaUsuarioIdToUsuarios,
          )}.`,
          context,
          dadosAnteriores: companyAuditPayload,
          dadosNovos: null,
          meta: companyAuditPayload,
        });
      });

      return;
    }

    const vagaAuditPayload = buildRecruiterLinkAuditPayload({
      tipoVinculo: 'VAGA',
      empresa: vagaLink!.EmpresasVagas.Usuarios,
      vaga: vagaLink!.EmpresasVagas,
    });

    await prisma.$transaction(async (tx) => {
      await tx.usuariosVagasVinculos.delete({
        where: { id: vagaLink!.id },
      });

      await recordRecruiterLinkAuditEvent({
        client: tx,
        targetUserId: userId,
        action: 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO',
        descricao: `O recrutador perdeu o acesso restrito à vaga ${getVagaAuditLabel(
          vagaLink!.EmpresasVagas,
        )}.`,
        context,
        dadosAnteriores: vagaAuditPayload,
        dadosNovos: null,
        meta: vagaAuditPayload,
      });
    });
  },
};
