import type { Express } from 'express';
import request from 'supertest';
import { EmpresasPlanoModo, EmpresasPlanoStatus, Roles, TiposDeUsuarios } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Listagem de empresas elegiveis para cadastro de vaga', () => {
  let app: Express;
  const createdUsers: TestUser[] = [];
  const createdPlanoModeloIds: string[] = [];

  const registerUser = async (
    overrides: Parameters<typeof createTestUser>[0] = {},
  ): Promise<TestUser> => {
    const user = await createTestUser(overrides);
    createdUsers.push(user);
    return user;
  };

  const createPlanoModelo = async (suffix: string) => {
    const plano = await prisma.planosEmpresariais.create({
      data: {
        icon: 'briefcase',
        nome: `Plano Vagas ${suffix}`,
        descricao: 'Plano criado para teste de elegibilidade de vagas',
        valor: '99.90',
        quantidadeVagas: 10,
      },
    });
    createdPlanoModeloIds.push(plano.id);
    return plano;
  };

  const assignPlano = async (
    usuarioId: string,
    planosEmpresariaisId: string,
    modo: EmpresasPlanoModo,
    status: EmpresasPlanoStatus = EmpresasPlanoStatus.ATIVO,
  ) => {
    const inicio = new Date();
    const fim =
      modo === EmpresasPlanoModo.TESTE
        ? new Date(inicio.getTime() + 14 * 24 * 60 * 60 * 1000)
        : null;

    return prisma.empresasPlano.create({
      data: {
        usuarioId,
        planosEmpresariaisId,
        modo,
        status,
        inicio,
        fim,
      },
    });
  };

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (createdPlanoModeloIds.length > 0) {
      await prisma.empresasPlano.deleteMany({
        where: { planosEmpresariaisId: { in: createdPlanoModeloIds } },
      });
      await prisma.planosEmpresariais.deleteMany({
        where: { id: { in: createdPlanoModeloIds } },
      });
    }

    if (createdUsers.length > 0) {
      await cleanupTestUsers(createdUsers.map((user) => user.id));
    }
  });

  it('filtra empresas elegiveis antes da paginacao e combina com search', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const marker = `EMP_ELEGIVEL_${Date.now()}`;
    const planoModelo = await createPlanoModelo(marker);

    const cliente = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `${marker} Cliente Ativo`,
    });
    const parceiro = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `${marker} Parceiro Ativo`,
    });
    const teste = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `${marker} Teste Ativo`,
    });
    const suspensa = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `${marker} Suspensa`,
    });
    await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `${marker} Sem Plano`,
    });

    await assignPlano(cliente.id, planoModelo.id, EmpresasPlanoModo.CLIENTE);
    await assignPlano(parceiro.id, planoModelo.id, EmpresasPlanoModo.PARCEIRO);
    await assignPlano(teste.id, planoModelo.id, EmpresasPlanoModo.TESTE);
    await assignPlano(
      suspensa.id,
      planoModelo.id,
      EmpresasPlanoModo.CLIENTE,
      EmpresasPlanoStatus.SUSPENSO,
    );

    const filteredFirstPage = await request(app)
      .get('/api/v1/empresas')
      .query({ page: 1, pageSize: 1, search: marker, elegivelCadastroVaga: true })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(filteredFirstPage.body.data).toHaveLength(1);
    expect(filteredFirstPage.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1,
        total: 3,
        totalPages: 3,
      }),
    );
    expect(filteredFirstPage.body.data[0].plano).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        status: EmpresasPlanoStatus.ATIVO,
      }),
    );

    const filteredSearch = await request(app)
      .get('/api/v1/empresas')
      .query({
        page: 1,
        pageSize: 10,
        search: `${marker} Cliente`,
        elegivelCadastroVaga: true,
      })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(filteredSearch.body.pagination.total).toBe(1);
    expect(filteredSearch.body.data[0]).toEqual(
      expect.objectContaining({
        id: cliente.id,
        nome: `${marker} Cliente Ativo`,
      }),
    );

    const unfiltered = await request(app)
      .get('/api/v1/empresas')
      .query({ page: 1, pageSize: 10, search: marker })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(unfiltered.body.pagination.total).toBe(5);
  });
});
