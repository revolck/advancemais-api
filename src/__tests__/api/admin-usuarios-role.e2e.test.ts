import request from 'supertest';
import { Express } from 'express';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(40000);

describe('API - Admin alterar função de usuário', () => {
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

  it('ADMIN deve alterar função e refletir no histórico do usuário', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({ role: Roles.ALUNO_CANDIDATO });

    const response = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        role: Roles.INSTRUTOR,
        motivo: 'Ajuste administrativo pelo painel',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        code: 'USER_ROLE_UPDATED',
        data: expect.objectContaining({
          id: target.id,
          roleAnterior: Roles.ALUNO_CANDIDATO,
          role: Roles.INSTRUTOR,
          status: 'ATIVO',
          emailVerificado: true,
        }),
      }),
    );

    const historyResponse = await request(app)
      .get(`/api/v1/usuarios/usuarios/${target.id}/historico?tipos=USUARIO_ROLE_ALTERADA`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historyResponse.body.data.items).toHaveLength(1);
    expect(historyResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        tipo: 'USUARIO_ROLE_ALTERADA',
        categoria: 'ADMINISTRATIVO',
        dadosAnteriores: expect.objectContaining({
          role: Roles.ALUNO_CANDIDATO,
        }),
        dadosNovos: expect.objectContaining({
          role: Roles.INSTRUTOR,
        }),
        meta: expect.objectContaining({
          motivo: 'Ajuste administrativo pelo painel',
        }),
      }),
    );
  });

  it('MODERADOR não deve alterar usuário ADMIN nem promover para ADMIN/MODERADOR', async () => {
    const moderador = await registerUser({ role: Roles.MODERADOR });
    const adminTarget = await registerUser({ role: Roles.ADMIN });
    const candidateTarget = await registerUser({ role: Roles.ALUNO_CANDIDATO });

    const forbiddenTargetResponse = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${adminTarget.id}/role`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({
        role: Roles.INSTRUTOR,
        motivo: 'Teste de restrição',
      })
      .expect(403);

    expect(forbiddenTargetResponse.body.code).toBe('FORBIDDEN_USER_ROLE');

    const forbiddenPromotionResponse = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${candidateTarget.id}/role`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({
        role: Roles.ADMIN,
        motivo: 'Tentativa de promoção bloqueada',
      })
      .expect(403);

    expect(forbiddenPromotionResponse.body.code).toBe('FORBIDDEN_USER_ROLE');
  });

  it('PEDAGOGICO só pode alterar entre ALUNO_CANDIDATO e INSTRUTOR', async () => {
    const pedagogico = await registerUser({ role: Roles.PEDAGOGICO });
    const allowedTarget = await registerUser({ role: Roles.ALUNO_CANDIDATO });
    const forbiddenTarget = await registerUser({ role: Roles.ADMIN });

    await request(app)
      .patch(`/api/v1/usuarios/usuarios/${allowedTarget.id}/role`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        role: Roles.INSTRUTOR,
        motivo: 'Troca pedagógica válida',
      })
      .expect(200);

    const forbiddenTargetResponse = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${forbiddenTarget.id}/role`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        role: Roles.INSTRUTOR,
        motivo: 'Tentativa inválida',
      })
      .expect(403);

    expect(forbiddenTargetResponse.body.code).toBe('FORBIDDEN_USER_ROLE');

    const forbiddenRoleResponse = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${allowedTarget.id}/role`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        role: Roles.FINANCEIRO,
        motivo: 'Tentativa inválida',
      })
      .expect(403);

    expect(forbiddenRoleResponse.body.code).toBe('FORBIDDEN_USER_ROLE');
  });

  it('não deve permitir autoalteração de função', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });

    const response = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${admin.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        role: Roles.MODERADOR,
        motivo: 'Tentativa de autoalteração',
      })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN_SELF_ROLE_CHANGE');
  });

  it('deve bloquear alteração quando a função de destino já for a atual', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const target = await registerUser({ role: Roles.INSTRUTOR });

    const response = await request(app)
      .patch(`/api/v1/usuarios/usuarios/${target.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        role: Roles.INSTRUTOR,
        motivo: 'Sem mudança real',
      })
      .expect(409);

    expect(response.body.code).toBe('USER_ROLE_UPDATE_BLOCKED');
  });
});
