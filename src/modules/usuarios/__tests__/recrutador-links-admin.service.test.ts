import { Roles, StatusDeVagas } from '@prisma/client';

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    usuariosEmpresasVinculos: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    usuariosVagasVinculos: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    empresasVagas: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    auditoriaLogs: {
      create: jest.fn(),
    },
    notificacoes: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '@/config/prisma';
import { recrutadorLinksAdminService } from '../services/recrutador-links-admin.service';

describe('recrutadorLinksAdminService audit history', () => {
  const prismaMock = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }

      const tx = {
        usuariosEmpresasVinculos: {
          create: jest.fn(),
          delete: jest.fn(),
        },
        usuariosVagasVinculos: {
          findMany: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
        },
        auditoriaLogs: {
          create: jest.fn(),
        },
        notificacoes: {
          create: jest.fn(),
        },
      };

      return arg(tx);
    });
  });

  it('registra histórico de criação por empresa e remoção automática de vagas redundantes', async () => {
    prismaMock.usuarios.findUnique
      .mockResolvedValueOnce({
        id: 'recrutador-id',
        role: Roles.RECRUTADOR,
        nomeCompleto: 'Ana Recrutadora',
      })
      .mockResolvedValueOnce({
        id: 'empresa-id',
        role: Roles.EMPRESA,
        nomeCompleto: 'Consultoria RH Plus',
        codUsuario: 'EMP-001',
        cnpj: '12345678000199',
      });

    prismaMock.usuariosEmpresasVinculos.findUnique.mockResolvedValue(null);

    prismaMock.$transaction.mockImplementationOnce(async (callback: any) => {
      const tx = {
        usuariosEmpresasVinculos: {
          create: jest.fn().mockResolvedValue({
            id: 'link-empresa-id',
            criadoEm: new Date('2026-04-01T16:10:00.000Z'),
          }),
        },
        usuariosVagasVinculos: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'link-vaga-antigo',
              EmpresasVagas: {
                id: 'vaga-id',
                titulo: 'Estagiário de Recursos Humanos',
                codigo: 'V51760',
              },
            },
          ]),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        auditoriaLogs: {
          create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
        },
        notificacoes: {
          create: jest.fn().mockResolvedValue({ id: 'notificacao-id' }),
        },
      };

      const result = await callback(tx);

      expect(tx.auditoriaLogs.create).toHaveBeenCalledTimes(2);
      expect(tx.notificacoes.create).toHaveBeenCalledTimes(1);
      expect(tx.auditoriaLogs.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO',
            acao: 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO',
            entidadeId: 'recrutador-id',
            descricao: 'O recrutador recebeu acesso operacional à empresa Consultoria RH Plus.',
            dadosAnteriores: null,
            dadosNovos: expect.objectContaining({
              tipoVinculo: 'EMPRESA',
              empresaId: 'empresa-id',
              empresaNome: 'Consultoria RH Plus',
              empresaCodigo: 'EMP-001',
            }),
            metadata: expect.objectContaining({
              tipoVinculo: 'EMPRESA',
              empresaId: 'empresa-id',
              empresaNome: 'Consultoria RH Plus',
              empresaCodigo: 'EMP-001',
              actorRole: Roles.ADMIN,
              origem: 'PAINEL_ADMIN',
            }),
          }),
        }),
      );
      expect(tx.notificacoes.create).toHaveBeenCalledWith({
        data: {
          usuarioId: 'recrutador-id',
          tipo: 'SISTEMA',
          prioridade: 'NORMAL',
          titulo: 'Novo acesso liberado',
          mensagem:
            'Você agora pode operar a empresa Consultoria RH Plus e as vagas vinculadas a ela.',
          linkAcao: '/dashboard/empresas',
          vagaId: null,
          dados: {
            evento: 'RECRUTADOR_VINCULO_CRIADO',
            tipoVinculo: 'EMPRESA',
            empresaId: 'empresa-id',
            empresaNome: 'Consultoria RH Plus',
            empresaCodigo: 'EMP-001',
            atorId: 'admin-id',
            atorNome: null,
            atorRole: Roles.ADMIN,
            origem: 'PAINEL_ADMIN',
          },
        },
      });
      expect(tx.auditoriaLogs.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO',
            acao: 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO',
            entidadeId: 'recrutador-id',
            descricao:
              'O recrutador perdeu o acesso restrito à vaga Estagiário de Recursos Humanos.',
            dadosAnteriores: expect.objectContaining({
              tipoVinculo: 'VAGA',
              empresaId: 'empresa-id',
              empresaNome: 'Consultoria RH Plus',
              empresaCodigo: 'EMP-001',
              vagaId: 'vaga-id',
              vagaTitulo: 'Estagiário de Recursos Humanos',
              vagaCodigo: 'V51760',
            }),
            dadosNovos: null,
          }),
        }),
      );

      return result;
    });

    const result = await recrutadorLinksAdminService.create(
      'recrutador-id',
      {
        tipoVinculo: 'EMPRESA',
        empresaUsuarioId: 'empresa-id',
      },
      {
        actorId: 'admin-id',
        actorRole: Roles.ADMIN,
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    );

    expect(result).toEqual({
      id: 'link-empresa-id',
      tipoVinculo: 'EMPRESA',
      ativo: true,
      empresa: {
        id: 'empresa-id',
        nomeExibicao: 'Consultoria RH Plus',
        codigo: 'EMP-001',
        cnpj: '12345678000199',
      },
      vaga: null,
      criadoEm: '2026-04-01T16:10:00.000Z',
    });
  });

  it('registra histórico ao remover vínculo por vaga', async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce({
      id: 'recrutador-id',
      role: Roles.RECRUTADOR,
      nomeCompleto: 'Ana Recrutadora',
    });

    prismaMock.usuariosEmpresasVinculos.findFirst.mockResolvedValue(null);
    prismaMock.usuariosVagasVinculos.findFirst.mockResolvedValue({
      id: 'link-vaga-id',
      EmpresasVagas: {
        id: 'vaga-id',
        titulo: 'Analista de Recrutamento',
        codigo: 'V51386',
        Usuarios: {
          id: 'empresa-id',
          nomeCompleto: 'Tech Innovations LTDA',
          codUsuario: 'EMP-009',
        },
      },
    });

    prismaMock.$transaction
      .mockImplementationOnce(async (arg: any) => Promise.all(arg))
      .mockImplementationOnce(async (callback: any) => {
        const tx = {
          usuariosVagasVinculos: {
            delete: jest.fn().mockResolvedValue({ id: 'link-vaga-id' }),
          },
          auditoriaLogs: {
            create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
          },
          notificacoes: {
            create: jest.fn().mockResolvedValue({ id: 'notificacao-id' }),
          },
        };

        const result = await callback(tx);

        expect(tx.auditoriaLogs.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tipo: 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO',
              acao: 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO',
              entidadeId: 'recrutador-id',
              descricao: 'O recrutador perdeu o acesso restrito à vaga Analista de Recrutamento.',
              dadosAnteriores: expect.objectContaining({
                tipoVinculo: 'VAGA',
                empresaId: 'empresa-id',
                empresaNome: 'Tech Innovations LTDA',
                empresaCodigo: 'EMP-009',
                vagaId: 'vaga-id',
                vagaTitulo: 'Analista de Recrutamento',
                vagaCodigo: 'V51386',
              }),
              dadosNovos: null,
              metadata: expect.objectContaining({
                tipoVinculo: 'VAGA',
                empresaId: 'empresa-id',
                empresaNome: 'Tech Innovations LTDA',
                empresaCodigo: 'EMP-009',
                vagaId: 'vaga-id',
                vagaTitulo: 'Analista de Recrutamento',
                vagaCodigo: 'V51386',
                actorRole: Roles.MODERADOR,
                origem: 'PAINEL_ADMIN',
              }),
            }),
          }),
        );

        return result;
      });

    await recrutadorLinksAdminService.remove('recrutador-id', 'link-vaga-id', {
      actorId: 'moderador-id',
      actorRole: Roles.MODERADOR,
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
  });

  it('registra histórico ao remover vínculo por empresa', async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce({
      id: 'recrutador-id',
      role: Roles.RECRUTADOR,
      nomeCompleto: 'Ana Recrutadora',
    });

    prismaMock.usuariosEmpresasVinculos.findFirst.mockResolvedValue({
      id: 'link-empresa-id',
      empresaUsuarioId: 'empresa-id',
      Usuarios_UsuariosEmpresasVinculos_empresaUsuarioIdToUsuarios: {
        id: 'empresa-id',
        nomeCompleto: 'Consultoria RH Plus',
        codUsuario: 'EMP-001',
      },
    });
    prismaMock.usuariosVagasVinculos.findFirst.mockResolvedValue(null);

    prismaMock.$transaction
      .mockImplementationOnce(async (arg: any) => Promise.all(arg))
      .mockImplementationOnce(async (callback: any) => {
        const tx = {
          usuariosEmpresasVinculos: {
            delete: jest.fn().mockResolvedValue({ id: 'link-empresa-id' }),
          },
          auditoriaLogs: {
            create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
          },
        };

        const result = await callback(tx);

        expect(tx.auditoriaLogs.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tipo: 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_REMOVIDO',
              acao: 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_REMOVIDO',
              entidadeId: 'recrutador-id',
              descricao: 'O recrutador perdeu o acesso operacional à empresa Consultoria RH Plus.',
              dadosAnteriores: expect.objectContaining({
                tipoVinculo: 'EMPRESA',
                empresaId: 'empresa-id',
                empresaNome: 'Consultoria RH Plus',
                empresaCodigo: 'EMP-001',
              }),
              dadosNovos: null,
              metadata: expect.objectContaining({
                tipoVinculo: 'EMPRESA',
                empresaId: 'empresa-id',
                empresaNome: 'Consultoria RH Plus',
                empresaCodigo: 'EMP-001',
                actorRole: Roles.ADMIN,
                origem: 'PAINEL_ADMIN',
              }),
            }),
          }),
        );

        return result;
      });

    await recrutadorLinksAdminService.remove('recrutador-id', 'link-empresa-id', {
      actorId: 'admin-id',
      actorRole: Roles.ADMIN,
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
  });

  it('cria notificação para o recrutador ao criar vínculo por vaga', async () => {
    prismaMock.usuarios.findUnique
      .mockResolvedValueOnce({
        id: 'recrutador-id',
        role: Roles.RECRUTADOR,
        nomeCompleto: 'Ana Recrutadora',
      })
      .mockResolvedValueOnce({
        id: 'empresa-id',
        role: Roles.EMPRESA,
        nomeCompleto: 'Consultoria RH Plus',
        codUsuario: 'EMP-001',
        cnpj: '12345678000199',
      });

    prismaMock.empresasVagas.findUnique.mockResolvedValue({
      id: 'vaga-id',
      usuarioId: 'empresa-id',
      titulo: 'Estagiário de Recursos Humanos',
      codigo: 'V51760',
      status: StatusDeVagas.PUBLICADO,
    });

    prismaMock.usuariosEmpresasVinculos.findUnique.mockResolvedValue(null);
    prismaMock.usuariosVagasVinculos.findUnique.mockResolvedValue(null);

    prismaMock.$transaction
      .mockImplementationOnce(async (arg: any) => Promise.all(arg))
      .mockImplementationOnce(async (callback: any) => {
        const tx = {
          usuariosVagasVinculos: {
            create: jest.fn().mockResolvedValue({
              id: 'link-vaga-id',
              criadoEm: new Date('2026-04-01T16:15:00.000Z'),
            }),
          },
          auditoriaLogs: {
            create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
          },
          notificacoes: {
            create: jest.fn().mockResolvedValue({ id: 'notificacao-id' }),
          },
        };

        const result = await callback(tx);

        expect(tx.notificacoes.create).toHaveBeenCalledWith({
          data: {
            usuarioId: 'recrutador-id',
            tipo: 'SISTEMA',
            prioridade: 'NORMAL',
            titulo: 'Novo acesso liberado',
            mensagem:
              'Você agora pode operar a vaga Estagiário de Recursos Humanos da empresa Consultoria RH Plus.',
            linkAcao: '/dashboard/empresas/vagas/vaga-id',
            vagaId: 'vaga-id',
            dados: {
              evento: 'RECRUTADOR_VINCULO_CRIADO',
              tipoVinculo: 'VAGA',
              empresaId: 'empresa-id',
              empresaNome: 'Consultoria RH Plus',
              empresaCodigo: 'EMP-001',
              vagaId: 'vaga-id',
              vagaTitulo: 'Estagiário de Recursos Humanos',
              vagaCodigo: 'V51760',
              atorId: 'moderador-id',
              atorNome: 'Maria Souza',
              atorRole: Roles.MODERADOR,
              origem: 'PAINEL_ADMIN',
            },
          },
        });

        return result;
      });

    const result = await recrutadorLinksAdminService.create(
      'recrutador-id',
      {
        tipoVinculo: 'VAGA',
        empresaUsuarioId: 'empresa-id',
        vagaId: 'vaga-id',
      },
      {
        actorId: 'moderador-id',
        actorNome: 'Maria Souza',
        actorRole: Roles.MODERADOR,
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    );

    expect(result).toMatchObject({
      id: 'link-vaga-id',
      tipoVinculo: 'VAGA',
      empresa: {
        id: 'empresa-id',
        nomeExibicao: 'Consultoria RH Plus',
        codigo: 'EMP-001',
      },
      vaga: {
        id: 'vaga-id',
        titulo: 'Estagiário de Recursos Humanos',
        codigo: 'V51760',
      },
    });
  });

  it('mantém título específico para os novos tipos no histórico do usuário', async () => {
    const { getUserHistoryConfig } = await import('../utils/user-history');

    expect(getUserHistoryConfig('USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO')).toMatchObject({
      tipo: 'USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO',
      categoria: 'ADMINISTRATIVO',
      titulo: 'Vínculo por empresa adicionado',
    });
    expect(getUserHistoryConfig('USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO')).toMatchObject({
      tipo: 'USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO',
      categoria: 'ADMINISTRATIVO',
      titulo: 'Vínculo por vaga removido',
    });
  });
});
