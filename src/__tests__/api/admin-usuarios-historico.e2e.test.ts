import request from 'supertest';
import { Express } from 'express';
import { Roles, Status } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(40000);

describe('API - Histórico completo de usuário no painel', () => {
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

    await prisma.auditoriaLogs.deleteMany({
      where: {
        OR: [{ usuarioId: { in: userIds } }, { entidadeId: { in: userIds } }],
      },
    });

    await prisma.usuariosEmBloqueiosLogs.deleteMany({
      where: {
        OR: [
          { criadoPorId: { in: userIds } },
          { UsuariosEmBloqueios: { usuarioId: { in: userIds } } },
        ],
      },
    });

    await prisma.usuariosEmBloqueios.deleteMany({
      where: {
        usuarioId: { in: userIds },
      },
    });

    await prisma.usuariosSessoes.deleteMany({
      where: {
        usuarioId: { in: userIds },
      },
    });

    await prisma.usuarios.deleteMany({
      where: {
        id: { in: userIds },
      },
    });
  });

  it('ADMIN deve obter timeline paginada e estável do usuário', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      emailVerificado: false,
    });

    await prisma.usuarios.update({
      where: { id: target.id },
      data: {
        status: Status.PENDENTE,
      },
    });

    await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-acesso`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        motivo: 'Liberacao manual para teste de histórico',
      })
      .expect(200);

    const loginResponse = await request(app)
      .post('/api/v1/usuarios/login')
      .set('X-Forwarded-For', '10.0.0.5')
      .send({
        documento: target.cpf,
        senha: target.password,
      })
      .expect(200);

    await request(app)
      .post('/api/v1/usuarios/logout')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .set('X-Forwarded-For', '10.0.0.6')
      .expect(200);

    await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        status: Status.PENDENTE,
        motivo: 'Fluxo de validação interna',
      })
      .expect(200);

    const historyResponse = await request(app)
      .get(`/api/v1/usuarios/usuarios/${target.id}/historico?page=1&pageSize=20`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historyResponse.body.success).toBe(true);
    expect(historyResponse.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );
    expect(historyResponse.body.data.resumo).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
      }),
    );

    const tipos = historyResponse.body.data.items.map((item: any) => item.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining([
        'USUARIO_CRIADO',
        'USUARIO_ACESSO_LIBERADO',
        'USUARIO_LOGIN',
        'USUARIO_LOGOUT',
        'USUARIO_STATUS_ALTERADO',
      ]),
    );

    const acessoLiberado = historyResponse.body.data.items.find(
      (item: any) => item.tipo === 'USUARIO_ACESSO_LIBERADO',
    );
    expect(acessoLiberado).toEqual(
      expect.objectContaining({
        categoria: 'ACESSO',
        ator: expect.objectContaining({
          id: admin.id,
          nome: admin.nomeCompleto,
          role: Roles.ADMIN,
          roleLabel: 'Administrador',
        }),
        alvo: expect.objectContaining({
          id: target.id,
          email: target.email,
        }),
        dadosAnteriores: expect.objectContaining({
          status: 'PENDENTE',
          emailVerificado: false,
        }),
        dadosNovos: expect.objectContaining({
          status: 'ATIVO',
          emailVerificado: true,
        }),
      }),
    );
  });

  it('deve filtrar histórico por tipo e ator', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({
      role: Roles.INSTRUTOR,
      emailVerificado: false,
    });

    await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-email`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        motivo: 'Filtro por histórico',
      })
      .expect(200);

    const filteredResponse = await request(app)
      .get(
        `/api/v1/usuarios/usuarios/${target.id}/historico?tipos=USUARIO_EMAIL_LIBERADO&atorId=${admin.id}`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(filteredResponse.body.data.items).toHaveLength(1);
    expect(filteredResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        tipo: 'USUARIO_EMAIL_LIBERADO',
        ator: expect.objectContaining({
          id: admin.id,
        }),
      }),
    );
  });

  it('PEDAGOGICO não deve acessar histórico de usuário fora do seu escopo', async () => {
    const pedagogico = await registerUser({ role: Roles.PEDAGOGICO });
    const forbiddenTarget = await registerUser({ role: Roles.ADMIN });

    const response = await request(app)
      .get(`/api/v1/usuarios/usuarios/${forbiddenTarget.id}/historico`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN_USER_ROLE');
  });
});
