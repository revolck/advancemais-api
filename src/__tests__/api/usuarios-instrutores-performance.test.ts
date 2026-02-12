import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@/config/prisma';

import { getTestApp } from '../helpers/test-setup';
import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';
import { Roles } from '@prisma/client';
import { invalidateInstrutoresGetResponseCache } from '@/modules/usuarios/middlewares/instrutores-response-cache';

jest.setTimeout(40000);

describe('API - Usuários Instrutores (Performance)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await invalidateInstrutoresGetResponseCache();
  });

  afterAll(async () => {
    if (testUsers.length > 0) {
      const userIds = testUsers.map((u) => u.id);

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
          OR: [{ usuarioId: { in: userIds } }, { aplicadoPorId: { in: userIds } }],
        },
      });

      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  it('deve aplicar cache HTTP na listagem de instrutores', async () => {
    const admin = await createTestAdmin();
    const instrutor = await createTestUser({
      role: Roles.INSTRUTOR,
      nomeCompleto: 'Instrutor Cache Lista',
      email: `instrutor-lista-${Date.now()}@test.com`,
    });
    testUsers.push(admin, instrutor);

    const url = '/api/v1/usuarios/instrutores?page=1&limit=10';

    const first = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.body.success).toBe(true);

    const second = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(second.headers['x-cache']).toBe('HIT');
  });

  it('deve invalidar cache de detalhe após PUT do instrutor', async () => {
    const admin = await createTestAdmin();
    const instrutor = await createTestUser({
      role: Roles.INSTRUTOR,
      nomeCompleto: 'Instrutor Cache Detalhe',
      email: `instrutor-detalhe-${Date.now()}@test.com`,
    });
    testUsers.push(admin, instrutor);

    const url = `/api/v1/usuarios/instrutores/${instrutor.id}`;

    const warm1 = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(warm1.headers['x-cache']).toBe('MISS');

    const warm2 = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(warm2.headers['x-cache']).toBe('HIT');

    await request(app)
      .put(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ descricao: 'Descrição atualizada para invalidar cache' })
      .expect(200);

    const afterMutation = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(afterMutation.headers['x-cache']).toBe('MISS');
  });

  it('deve invalidar cache de bloqueios após aplicar bloqueio', async () => {
    const admin = await createTestAdmin();
    const instrutor = await createTestUser({
      role: Roles.INSTRUTOR,
      nomeCompleto: 'Instrutor Cache Bloqueio',
      email: `instrutor-bloqueio-${Date.now()}@test.com`,
    });
    testUsers.push(admin, instrutor);

    const bloqueiosUrl = `/api/v1/usuarios/instrutores/${instrutor.id}/bloqueios?page=1&pageSize=10`;

    const first = await request(app)
      .get(bloqueiosUrl)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(first.headers['x-cache']).toBe('MISS');

    const second = await request(app)
      .get(bloqueiosUrl)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(second.headers['x-cache']).toBe('HIT');

    await request(app)
      .post(`/api/v1/usuarios/instrutores/${instrutor.id}/bloqueios`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        tipo: 'TEMPORARIO',
        motivo: 'OUTROS',
        dias: 1,
        observacoes: 'Teste de invalidação de cache',
      })
      .expect(201);

    const afterBlock = await request(app)
      .get(bloqueiosUrl)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(afterBlock.headers['x-cache']).toBe('MISS');

    await request(app)
      .post(`/api/v1/usuarios/instrutores/${instrutor.id}/bloqueios/revogar`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ observacoes: 'Revogação para limpeza do cenário' })
      .expect(200);
  });
});
