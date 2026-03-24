import request from 'supertest';
import { Express } from 'express';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(40000);

describe('API - Admin liberar validacao de email', () => {
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

  it('ADMIN deve liberar validacao de email e permitir login do usuario', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      emailVerificado: false,
    });

    const loginAntes = await request(app)
      .post('/api/v1/usuarios/login')
      .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 200) + 1}`)
      .send({
        documento: target.cpf,
        senha: target.password,
      })
      .expect(403);

    expect(loginAntes.body.code).toBe('EMAIL_NOT_VERIFIED');

    const response = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-email`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        motivo: 'Liberacao manual pelo painel administrativo',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.code).toBe('EMAIL_VALIDATION_BYPASSED');
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: target.id,
        emailVerificado: true,
        alreadyVerified: false,
        statusPermiteLogin: true,
      }),
    );

    const verification = await prisma.usuariosVerificacaoEmail.findUnique({
      where: { usuarioId: target.id },
      select: {
        emailVerificado: true,
        emailVerificadoEm: true,
        emailVerificationToken: true,
        emailVerificationTokenExp: true,
        emailVerificationAttempts: true,
        ultimaTentativaVerificacao: true,
      },
    });

    expect(verification).toEqual(
      expect.objectContaining({
        emailVerificado: true,
        emailVerificationToken: null,
        emailVerificationTokenExp: null,
        emailVerificationAttempts: 0,
        ultimaTentativaVerificacao: null,
      }),
    );
    expect(verification?.emailVerificadoEm).toBeInstanceOf(Date);

    const loginDepois = await request(app)
      .post('/api/v1/usuarios/login')
      .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 200) + 1}`)
      .send({
        documento: target.cpf,
        senha: target.password,
      })
      .expect(200);

    expect(loginDepois.body.success).toBe(true);
  });

  it('MODERADOR deve conseguir liberar validacao de email', async () => {
    const moderator = await registerUser({ role: Roles.MODERADOR });
    const target = await registerUser({
      role: Roles.INSTRUTOR,
      emailVerificado: false,
    });

    const response = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-email`)
      .set('Authorization', `Bearer ${moderator.token}`)
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: target.id,
        emailVerificado: true,
      }),
    );
  });

  it('PEDAGOGICO deve conseguir liberar apenas ALUNO_CANDIDATO ou INSTRUTOR', async () => {
    const pedagogico = await registerUser({ role: Roles.PEDAGOGICO });
    const allowedTarget = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      emailVerificado: false,
    });
    const forbiddenTarget = await registerUser({
      role: Roles.ADMIN,
      emailVerificado: false,
    });

    await request(app)
      .patch(`/api/v1/usuarios/usuarios/${allowedTarget.id}/liberar-email`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({})
      .expect(200);

    const forbiddenResponse = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${forbiddenTarget.id}/liberar-email`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({})
      .expect(403);

    expect(forbiddenResponse.body.code).toBe('FORBIDDEN_USER_ROLE');
  });

  it('SETOR_DE_VAGAS nao deve conseguir liberar validacao de email', async () => {
    const setorDeVagas = await registerUser({ role: Roles.SETOR_DE_VAGAS });
    const target = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      emailVerificado: false,
    });

    await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/liberar-email`)
      .set('Authorization', `Bearer ${setorDeVagas.token}`)
      .send({})
      .expect(403);
  });

  it('detalhe do usuario deve expor resumo da verificacao de email', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      emailVerificado: false,
    });

    const response = await request(app)
      .get(`/api/v1/usuarios/usuarios/${target.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.usuario).toEqual(
      expect.objectContaining({
        id: target.id,
        emailVerificado: false,
        UsuariosVerificacaoEmail: expect.objectContaining({
          verified: false,
        }),
      }),
    );
  });
});
