import request from 'supertest';
import type { Express } from 'express';
import { Roles, TiposDeUsuarios } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(60000);

describe('API - Admin listagem de usuários com paginação real', () => {
  let app: Express;
  const createdUsers: TestUser[] = [];

  const registerUser = async (
    overrides: Parameters<typeof createTestUser>[0] = {},
  ): Promise<TestUser> => {
    const user = await createTestUser(overrides);
    createdUsers.push(user);
    return user;
  };

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    const userIds = createdUsers.map((user) => user.id);
    if (userIds.length === 0) return;

    await prisma.usuariosCurriculos.deleteMany({ where: { usuarioId: { in: userIds } } });
    await prisma.usuariosEnderecos.deleteMany({ where: { usuarioId: { in: userIds } } });
    await prisma.usuariosSessoes.deleteMany({ where: { usuarioId: { in: userIds } } });
    await prisma.usuariosVerificacaoEmail.deleteMany({ where: { usuarioId: { in: userIds } } });
    await prisma.usuarios.deleteMany({ where: { id: { in: userIds } } });
  });

  it('deve retornar total real com paginação usando search', async () => {
    const moderador = await registerUser({ role: Roles.MODERADOR });
    const marker = `PAGINACAO_REAL_${Date.now()}`;

    for (let i = 0; i < 23; i++) {
      await registerUser({
        role: i % 2 === 0 ? Roles.EMPRESA : Roles.ALUNO_CANDIDATO,
        tipoUsuario: i % 2 === 0 ? TiposDeUsuarios.PESSOA_JURIDICA : TiposDeUsuarios.PESSOA_FISICA,
        nomeCompleto: `${marker}_USER_${i}`,
        email: `${marker.toLowerCase()}_${i}@test.com`,
      });
    }

    const response = await request(app)
      .get('/api/v1/usuarios/usuarios')
      .query({ page: 1, limit: 10, search: marker })
      .set('Authorization', `Bearer ${moderador.token}`)
      .expect(200);

    expect(response.body.usuarios).toHaveLength(10);
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
        total: 23,
        pages: 3,
      }),
    );
  });

  it('deve aplicar os mesmos filtros em dados e contagem sem inflar total por múltiplos endereços', async () => {
    const moderador = await registerUser({ role: Roles.MODERADOR });
    const marker = `PAGINACAO_FILTRO_${Date.now()}`;

    const matchingUsers: TestUser[] = [];

    for (let i = 0; i < 5; i++) {
      const user = await registerUser({
        role: Roles.EMPRESA,
        tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
        nomeCompleto: `${marker}_MATCH_${i}`,
        email: `${marker.toLowerCase()}_match_${i}@test.com`,
      });
      matchingUsers.push(user);

      await prisma.usuariosEnderecos.create({
        data: {
          usuarioId: user.id,
          cidade: 'Maceió',
          estado: 'AL',
          logradouro: `Rua Match ${i}`,
          numero: `${100 + i}`,
          bairro: 'Centro',
          cep: `5700000${i}`,
        },
      });
    }

    await prisma.usuariosEnderecos.create({
      data: {
        usuarioId: matchingUsers[0].id,
        cidade: 'Maceió',
        estado: 'AL',
        logradouro: 'Rua Duplicada',
        numero: '999',
        bairro: 'Centro',
        cep: '57000999',
      },
    });

    for (let i = 0; i < 3; i++) {
      const user = await registerUser({
        role: Roles.EMPRESA,
        tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
        nomeCompleto: `${marker}_OUT_CITY_${i}`,
        email: `${marker.toLowerCase()}_outcity_${i}@test.com`,
      });

      await prisma.usuariosEnderecos.create({
        data: {
          usuarioId: user.id,
          cidade: 'Recife',
          estado: 'PE',
          logradouro: `Rua Out ${i}`,
          numero: `${200 + i}`,
          bairro: 'Boa Viagem',
          cep: `5100000${i}`,
        },
      });
    }

    const response = await request(app)
      .get('/api/v1/usuarios/usuarios')
      .query({
        page: 1,
        limit: 10,
        role: Roles.EMPRESA,
        tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
        status: 'ATIVO',
        cidade: 'Maceió',
        estado: 'AL',
        search: marker,
      })
      .set('Authorization', `Bearer ${moderador.token}`)
      .expect(200);

    expect(response.body.usuarios).toHaveLength(5);
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
        total: 5,
        pages: 1,
      }),
    );
  });
});
