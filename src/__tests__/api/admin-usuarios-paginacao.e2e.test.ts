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

  it('deve retornar páginas distintas e não reutilizar cache entre page/limit', async () => {
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

    const fetchPage = (page: number) =>
      request(app)
        .get('/api/v1/usuarios/usuarios')
        .query({ page, limit: 10, search: marker })
        .set('Authorization', `Bearer ${moderador.token}`)
        .expect(200);

    const page1 = await fetchPage(1);
    const page2 = await fetchPage(2);
    const page3 = await fetchPage(3);
    const page1Cached = await fetchPage(1);

    expect(page1.body.usuarios).toHaveLength(10);
    expect(page2.body.usuarios).toHaveLength(10);
    expect(page3.body.usuarios).toHaveLength(3);
    expect(page1.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
        total: 23,
        pages: 3,
      }),
    );
    expect(page2.body.pagination).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 10,
        total: 23,
        pages: 3,
      }),
    );
    expect(page3.body.pagination).toEqual(
      expect.objectContaining({
        page: 3,
        limit: 10,
        total: 23,
        pages: 3,
      }),
    );

    const idsPage1 = page1.body.usuarios.map((usuario: { id: string }) => usuario.id);
    const idsPage2 = page2.body.usuarios.map((usuario: { id: string }) => usuario.id);
    const idsPage3 = page3.body.usuarios.map((usuario: { id: string }) => usuario.id);

    expect(idsPage1).toEqual(
      page1Cached.body.usuarios.map((usuario: { id: string }) => usuario.id),
    );
    expect(idsPage1).not.toEqual(idsPage2);
    expect(idsPage1.some((id: string) => idsPage2.includes(id))).toBe(false);
    expect(idsPage1.some((id: string) => idsPage3.includes(id))).toBe(false);
    expect(idsPage2.some((id: string) => idsPage3.includes(id))).toBe(false);
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

  it('deve preservar escopo de visualização por role do ator', async () => {
    const pedagogico = await registerUser({ role: Roles.PEDAGOGICO });
    const setorDeVagas = await registerUser({ role: Roles.SETOR_DE_VAGAS });
    const marker = `PAGINACAO_ROLE_${Date.now()}`;

    await registerUser({
      role: Roles.ADMIN,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      nomeCompleto: `${marker}_ADMIN`,
      email: `${marker.toLowerCase()}_admin@test.com`,
    });

    await registerUser({
      role: Roles.INSTRUTOR,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      nomeCompleto: `${marker}_INSTRUTOR`,
      email: `${marker.toLowerCase()}_instrutor@test.com`,
    });

    const alunoComCurriculo = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      nomeCompleto: `${marker}_ALUNO_COM_CURRICULO`,
      email: `${marker.toLowerCase()}_aluno_curriculo@test.com`,
    });

    await prisma.usuariosCurriculos.create({
      data: {
        usuarioId: alunoComCurriculo.id,
        titulo: 'Currículo para escopo setor de vagas',
        principal: true,
      },
    });

    await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      nomeCompleto: `${marker}_ALUNO_SEM_CURRICULO`,
      email: `${marker.toLowerCase()}_aluno_sem_curriculo@test.com`,
    });

    await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `${marker}_EMPRESA`,
      email: `${marker.toLowerCase()}_empresa@test.com`,
    });

    const pedagogicoResponse = await request(app)
      .get('/api/v1/usuarios/usuarios')
      .query({ page: 1, limit: 10, search: marker })
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .expect(200);

    expect(
      pedagogicoResponse.body.usuarios.map((usuario: { role: Roles }) => usuario.role),
    ).toEqual(expect.arrayContaining([Roles.INSTRUTOR, Roles.ALUNO_CANDIDATO]));
    expect(
      pedagogicoResponse.body.usuarios.every((usuario: { role: Roles }) =>
        [Roles.INSTRUTOR, Roles.ALUNO_CANDIDATO].includes(usuario.role),
      ),
    ).toBe(true);

    const setorResponse = await request(app)
      .get('/api/v1/usuarios/usuarios')
      .query({ page: 1, limit: 10, search: marker })
      .set('Authorization', `Bearer ${setorDeVagas.token}`)
      .expect(200);

    const setorNames = setorResponse.body.usuarios.map(
      (usuario: { nomeCompleto: string }) => usuario.nomeCompleto,
    );

    expect(setorNames).toEqual(
      expect.arrayContaining([`${marker}_EMPRESA`, `${marker}_ALUNO_COM_CURRICULO`]),
    );
    expect(setorNames).not.toContain(`${marker}_ALUNO_SEM_CURRICULO`);
    expect(
      setorResponse.body.usuarios.every((usuario: { role: Roles }) =>
        [Roles.EMPRESA, Roles.ALUNO_CANDIDATO].includes(usuario.role),
      ),
    ).toBe(true);
  });
});
