import { prisma } from '@/config/prisma';
import { CandidatoLogTipo, Roles, OrigemVagas, Prisma } from '@prisma/client';
import { candidatoLogsService } from '@/modules/candidatos/logs/service';

export const candidaturasService = {
  listMine: async (params: { usuarioId: string; vagaId?: string; statusIds?: string[] }) => {
    const where: any = { candidatoId: params.usuarioId };
    if (params.vagaId) where.vagaId = params.vagaId;
    if (params.statusIds && params.statusIds.length > 0) where.statusId = { in: params.statusIds };

    return prisma.empresasCandidatos.findMany({
      where,
      orderBy: { aplicadaEm: 'desc' },
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        curriculoId: true,
        empresaUsuarioId: true,
        statusId: true,
        status_processo: {
          select: { id: true, nome: true, descricao: true, ativo: true, isDefault: true },
        },
        origem: true,
        aplicadaEm: true,
        atualizadaEm: true,
        consentimentos: true,
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
          },
        },
        UsuariosCurriculos: {
          select: { id: true, titulo: true, resumo: true, ultimaAtualizacao: true },
        },
      },
    });
  },

  listReceived: async (params: {
    empresaUsuarioId: string;
    vagaId?: string;
    statusIds?: string[];
  }) => {
    const where: any = { empresaUsuarioId: params.empresaUsuarioId };
    if (params.vagaId) where.vagaId = params.vagaId;
    if (params.statusIds && params.statusIds.length > 0) {
      where.statusId = { in: params.statusIds };
    } else {
      // Excluir status de desistente (por nome, case-insensitive)
      const desistenteStatus = await prisma.status_processo.findFirst({
        where: { nome: { equals: 'Desistente', mode: 'insensitive' } },
      });
      if (desistenteStatus) {
        where.statusId = { not: desistenteStatus.id };
      }
    }

    return prisma.empresasCandidatos.findMany({
      where,
      orderBy: { aplicadaEm: 'desc' },
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        curriculoId: true,
        empresaUsuarioId: true,
        statusId: true,
        status_processo: {
          select: { id: true, nome: true, descricao: true, ativo: true, isDefault: true },
        },
        origem: true,
        aplicadaEm: true,
        atualizadaEm: true,
        consentimentos: true,
        Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            status: true,
            role: true,
            tipoUsuario: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        },
        UsuariosCurriculos: {
          select: { id: true, titulo: true, resumo: true, ultimaAtualizacao: true },
        },
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
          },
        },
      },
    });
  },

  getById: async (id: string) => {
    return prisma.empresasCandidatos.findUnique({
      where: { id },
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        curriculoId: true,
        empresaUsuarioId: true,
        statusId: true,
        status_processo: {
          select: { id: true, nome: true, descricao: true, ativo: true, isDefault: true },
        },
        origem: true,
        aplicadaEm: true,
        atualizadaEm: true,
        consentimentos: true,
        Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            status: true,
            role: true,
            tipoUsuario: true,
            criadoEm: true,
            atualizadoEm: true,
            UsuariosInformation: {
              select: {
                telefone: true,
                genero: true,
                dataNasc: true,
                avatarUrl: true,
                descricao: true,
              },
            },
            UsuariosEnderecos: {
              orderBy: { criadoEm: 'asc' },
              take: 1,
              select: {
                cidade: true,
                estado: true,
              },
            },
          },
        },
        UsuariosCurriculos: {
          select: {
            id: true,
            usuarioId: true,
            titulo: true,
            resumo: true,
            objetivo: true,
            principal: true,
            areasInteresse: true,
            preferencias: true,
            habilidades: true,
            idiomas: true,
            experiencias: true,
            formacao: true,
            cursosCertificacoes: true,
            premiosPublicacoes: true,
            acessibilidade: true,
            consentimentos: true,
            ultimaAtualizacao: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        },
        EmpresasVagas: {
          select: {
            id: true,
            codigo: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
            descricao: true,
            localizacao: true,
            modalidade: true,
            regimeDeTrabalho: true,
            senioridade: true,
            Usuarios: {
              select: {
                id: true,
                nomeCompleto: true,
                UsuariosInformation: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  apply: async (params: {
    usuarioId: string;
    role: Roles;
    vagaId: string;
    curriculoId?: string;
    consentimentos?: any;
  }) => {
    // Verificar se já existe candidatura
    const existingCandidatura = await prisma.empresasCandidatos.findFirst({
      where: {
        vagaId: params.vagaId,
        candidatoId: params.usuarioId,
        curriculoId: params.curriculoId,
      },
    });

    if (existingCandidatura) {
      throw new Error('Você já se candidatou para esta vaga com este currículo.');
    }

    // Buscar status padrão
    const statusPadrao = await prisma.status_processo.findFirst({
      where: { isDefault: true, ativo: true },
    });

    if (!statusPadrao) {
      throw new Error('Nenhum status padrão encontrado.');
    }

    // Buscar vaga para descobrir o usuário da empresa responsável
    const vaga = await prisma.empresasVagas.findUnique({ where: { id: params.vagaId } });
    if (!vaga) {
      throw new Error('Vaga não encontrada.');
    }

    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: params.vagaId,
        candidatoId: params.usuarioId,
        curriculoId: params.curriculoId,
        empresaUsuarioId: vaga.usuarioId,
        statusId: statusPadrao.id,
        origem: OrigemVagas.SITE,
        consentimentos: params.consentimentos as Prisma.InputJsonValue,
      },
      include: {
        status_processo: {
          select: { id: true, nome: true, descricao: true, ativo: true, isDefault: true },
        },
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
          },
        },
        UsuariosCurriculos: {
          select: { id: true, titulo: true, resumo: true, ultimaAtualizacao: true },
        },
      },
    });

    // Log da candidatura
    await candidatoLogsService.create({
      usuarioId: params.usuarioId,
      tipo: CandidatoLogTipo.CANDIDATURA_CRIADA,
      metadata: {
        acao: 'CANDIDATURA_CRIADA',
        vagaId: params.vagaId,
        curriculoId: params.curriculoId ?? null,
        statusId: statusPadrao.id,
        statusNome: statusPadrao.nome,
      },
    });

    return candidatura;
  },

  update: async (params: {
    id: string;
    statusId?: string;
    observacoes?: string;
    usuarioId: string;
    role: Roles;
  }) => {
    const candidatura = await prisma.empresasCandidatos.findUnique({
      where: { id: params.id },
    });

    if (!candidatura) {
      throw new Error('Candidatura não encontrada.');
    }

    // Verificar se o usuário pode atualizar esta candidatura
    const isAdmin = params.role === Roles.ADMIN || params.role === Roles.MODERADOR;
    const isEmpresaDonaVaga =
      params.role === Roles.EMPRESA && candidatura.empresaUsuarioId === params.usuarioId;
    const isSetorVagas = params.role === Roles.SETOR_DE_VAGAS || params.role === Roles.RECRUTADOR;
    const isProprioCandidato =
      params.role === Roles.ALUNO_CANDIDATO && candidatura.candidatoId === params.usuarioId;

    if (!isAdmin && !isEmpresaDonaVaga && !isSetorVagas && !isProprioCandidato) {
      throw new Error('Você não tem permissão para atualizar esta candidatura.');
    }

    // Verificar se o status existe
    if (params.statusId) {
      const status = await prisma.status_processo.findUnique({
        where: { id: params.statusId },
      });

      if (!status) {
        throw new Error('Status não encontrado.');
      }
    }

    const updatedCandidatura = await prisma.empresasCandidatos.update({
      where: { id: params.id },
      data: {
        statusId: params.statusId,
        // Adicionar observações se necessário
      },
      include: {
        status_processo: {
          select: { id: true, nome: true, descricao: true, ativo: true, isDefault: true },
        },
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
          },
        },
        UsuariosCurriculos: {
          select: { id: true, titulo: true, resumo: true, ultimaAtualizacao: true },
        },
      },
    });

    // Sem log específico para atualização (tipos disponíveis não incluem atualização)

    return updatedCandidatura;
  },

  cancel: async (params: { id: string; usuarioId: string; role: Roles }) => {
    const candidatura = await prisma.empresasCandidatos.findUnique({
      where: { id: params.id },
    });

    if (!candidatura) {
      throw new Error('Candidatura não encontrada.');
    }

    // Verificar se o usuário pode cancelar esta candidatura
    if (params.role !== Roles.ADMIN && params.role !== Roles.MODERADOR) {
      if (candidatura.candidatoId !== params.usuarioId) {
        throw new Error('Você não tem permissão para cancelar esta candidatura.');
      }
    }

    // Buscar status de desistente
    const desistenteStatus = await prisma.status_processo.findFirst({
      where: { nome: { equals: 'Desistente', mode: 'insensitive' }, ativo: true },
    });

    if (!desistenteStatus) {
      throw new Error('Status de desistente não encontrado.');
    }

    // Verificar se já está cancelada
    if (candidatura.statusId === desistenteStatus.id) {
      throw new Error('Esta candidatura já foi cancelada.');
    }

    const updatedCandidatura = await prisma.empresasCandidatos.update({
      where: { id: params.id },
      data: {
        statusId: desistenteStatus.id,
      },
      include: {
        status_processo: {
          select: { id: true, nome: true, descricao: true, ativo: true, isDefault: true },
        },
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
          },
        },
        UsuariosCurriculos: {
          select: { id: true, titulo: true, resumo: true, ultimaAtualizacao: true },
        },
      },
    });

    // Log do cancelamento
    await candidatoLogsService.create({
      usuarioId: params.usuarioId,
      tipo: CandidatoLogTipo.CANDIDATURA_CANCELADA_CURRICULO,
      metadata: {
        acao: 'CANDIDATURA_CANCELADA',
        candidaturaId: params.id,
        statusId: desistenteStatus.id,
        statusNome: desistenteStatus.nome,
      },
    });

    return updatedCandidatura;
  },

  cancelForCandidato: async (params: {
    usuarioId: string;
    curriculoId?: string;
    motivo?: string;
    tx?: Prisma.TransactionClient;
  }) => {
    const client = params.tx ?? prisma;

    const desistenteStatus = await client.status_processo.findFirst({
      where: { nome: { equals: 'Desistente', mode: 'insensitive' }, ativo: true },
    });

    if (!desistenteStatus) {
      throw new Error('Status de desistente não encontrado.');
    }

    const where: Prisma.EmpresasCandidatosWhereInput = {
      candidatoId: params.usuarioId,
      NOT: { statusId: desistenteStatus.id },
      ...(params.curriculoId ? { curriculoId: params.curriculoId } : {}),
    };

    const result = await client.empresasCandidatos.updateMany({
      where: {
        ...where,
      },
      data: { statusId: desistenteStatus.id },
    });

    await candidatoLogsService.create(
      {
        usuarioId: params.usuarioId,
        tipo: CandidatoLogTipo.CANDIDATURA_CANCELADA_CURRICULO,
        metadata: {
          acao: 'CANDIDATURAS_CANCELADAS_POR_EXCLUSAO_CURRICULO',
          curriculoId: params.curriculoId ?? null,
          afetadas: result.count,
          motivo: params.motivo ?? null,
        },
      },
      client,
    );

    return { count: result.count };
  },

  getOverview: async (params: { usuarioId: string }) => {
    const candidaturas = await prisma.empresasCandidatos.findMany({
      where: { candidatoId: params.usuarioId },
      select: {
        id: true,
        statusId: true,
        status_processo: {
          select: { id: true, nome: true, descricao: true, ativo: true, isDefault: true },
        },
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
          },
        },
        aplicadaEm: true,
        atualizadaEm: true,
      },
      orderBy: { aplicadaEm: 'desc' },
    });

    // Agrupar por status
    const porStatus = candidaturas.reduce(
      (acc, candidatura) => {
        const statusNome = candidatura.status_processo.nome;
        if (!acc[statusNome]) {
          acc[statusNome] = [];
        }
        acc[statusNome].push(candidatura);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    return {
      total: candidaturas.length,
      porStatus,
      candidaturas,
    };
  },
};
