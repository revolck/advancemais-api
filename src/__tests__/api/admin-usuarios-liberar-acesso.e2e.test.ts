import request from 'supertest';
import { Express } from 'express';
import { Roles, Status } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(40000);

describe('API - Admin liberar acesso completo de usuário', () => {
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

  it('ADMIN deve liberar acesso completo de usuário pendente e permitir login imediato', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      emailVerificado: false,
    });

    await prisma.usuarios.update({
      where: { id: target.id },
      data: { status: Status.PENDENTE },
    });

    const loginAntes = await request(app)
      .post('/api/v1/usuarios/login')
      .set('X-Forwarded-For', `127.0.1.${Math.floor(Math.random() * 200) + 1}`)
      .send({
        documento: target.cpf,
        senha: target.password,
      })
      .expect(403);

    expect(loginAntes.body.code).toBe('ACCOUNT_INACTIVE');
    expect(loginAntes.body.status).toBe(Status.PENDENTE);

    const response = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-acesso`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        motivo: 'Liberação completa de acesso pelo painel',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.code).toBe('USER_ACCESS_RELEASED');
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: target.id,
        statusAnterior: Status.PENDENTE,
        status: Status.ATIVO,
        emailVerificado: true,
        alreadyVerified: false,
        statusPermiteLogin: true,
        acessoLiberado: true,
      }),
    );

    const usuarioAtualizado = await prisma.usuarios.findUnique({
      where: { id: target.id },
      select: {
        status: true,
      },
    });

    expect(usuarioAtualizado?.status).toBe(Status.ATIVO);

    const verification = await prisma.usuariosVerificacaoEmail.findUnique({
      where: { usuarioId: target.id },
      select: {
        emailVerificado: true,
        emailVerificadoEm: true,
        emailVerificationToken: true,
      },
    });

    expect(verification).toEqual(
      expect.objectContaining({
        emailVerificado: true,
        emailVerificationToken: null,
      }),
    );
    expect(verification?.emailVerificadoEm).toBeInstanceOf(Date);

    const loginDepois = await request(app)
      .post('/api/v1/usuarios/login')
      .set('X-Forwarded-For', `127.0.2.${Math.floor(Math.random() * 200) + 1}`)
      .send({
        documento: target.cpf,
        senha: target.password,
      })
      .expect(200);

    expect(loginDepois.body.success).toBe(true);
  });

  it('deve ativar usuário pendente mesmo quando o email já estiver verificado', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({
      role: Roles.INSTRUTOR,
      emailVerificado: true,
    });

    await prisma.usuarios.update({
      where: { id: target.id },
      data: { status: Status.PENDENTE },
    });

    const response = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-acesso`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: target.id,
        statusAnterior: Status.PENDENTE,
        status: Status.ATIVO,
        emailVerificado: true,
        alreadyVerified: true,
        statusPermiteLogin: true,
        acessoLiberado: true,
      }),
    );
  });

  it.each([Status.BLOQUEADO, Status.INATIVO, Status.SUSPENSO])(
    'deve bloquear liberação completa quando o usuário estiver com status %s',
    async (blockedStatus) => {
      const admin = await registerUser({ role: Roles.ADMIN });
      const target = await registerUser({
        role: Roles.ALUNO_CANDIDATO,
        emailVerificado: false,
      });

      await prisma.usuarios.update({
        where: { id: target.id },
        data: { status: blockedStatus },
      });

      const response = await request(app)
        .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-acesso`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          motivo: 'Tentativa de liberar acesso para usuário bloqueado por status',
        })
        .expect(409);

      expect(response.body.code).toBe('USER_ACCESS_RELEASE_BLOCKED_BY_STATUS');
      expect(response.body.details).toEqual(
        expect.objectContaining({
          statusAtual: blockedStatus,
        }),
      );
    },
  );

  it('PEDAGOGICO deve conseguir liberar acesso apenas para ALUNO_CANDIDATO ou INSTRUTOR', async () => {
    const pedagogico = await registerUser({ role: Roles.PEDAGOGICO });
    const allowedTarget = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      emailVerificado: false,
    });
    const forbiddenTarget = await registerUser({
      role: Roles.ADMIN,
      emailVerificado: false,
    });

    await prisma.usuarios.update({
      where: { id: allowedTarget.id },
      data: { status: Status.PENDENTE },
    });

    await prisma.usuarios.update({
      where: { id: forbiddenTarget.id },
      data: { status: Status.PENDENTE },
    });

    await request(app)
      .patch(`/api/v1/usuarios/usuarios/${allowedTarget.id}/liberar-acesso`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({})
      .expect(200);

    const forbiddenResponse = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${forbiddenTarget.id}/liberar-acesso`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({})
      .expect(403);

    expect(forbiddenResponse.body.code).toBe('FORBIDDEN_USER_ROLE');
  });
});
