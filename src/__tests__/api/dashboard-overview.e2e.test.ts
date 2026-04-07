import type { Express } from 'express';
import request from 'supertest';
import { Roles } from '@prisma/client';

import { createTestUser, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

describe('API - Dashboard Overview', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  it('deve manter totalUsuarios do overview consistente com pagination.total de /usuarios/usuarios para MODERADOR', async () => {
    const moderador = await createTestUser({ role: Roles.MODERADOR });
    testUsers.push(moderador);

    const [overviewResponse, usuariosResponse] = await Promise.all([
      request(app)
        .get('/api/v1/dashboard/overview')
        .set('Authorization', `Bearer ${moderador.token}`)
        .expect(200),
      request(app)
        .get('/api/v1/usuarios/usuarios?page=1&limit=10')
        .set('Authorization', `Bearer ${moderador.token}`)
        .expect(200),
    ]);

    expect(overviewResponse.body?.success).toBe(true);
    expect(overviewResponse.body?.data?.metricasGerais?.totalUsuarios).toBe(
      usuariosResponse.body?.pagination?.total,
    );
    expect(overviewResponse.body?.data?.usuariosPorTipo?.total).toBe(
      overviewResponse.body?.data?.metricasGerais?.totalUsuarios,
    );
    expect(overviewResponse.body?.data?.statusPorCategoria?.usuarios?.total).toBe(
      overviewResponse.body?.data?.metricasGerais?.totalUsuarios,
    );
  });
});
