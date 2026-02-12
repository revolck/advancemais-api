import request from 'supertest';
import type { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import { cleanupTestUsers, createTestAdmin, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(30000);

describe('API - Cursos (Visão Geral)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  it('deve retornar visão geral de cursos para ADMIN', async () => {
    const admin = await createTestAdmin();
    testUsers.push(admin);

    const response = await request(app)
      .get('/api/v1/cursos/visaogeral')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('metricasGerais');
    expect(response.body.data).toHaveProperty('cursosProximosInicio');
    expect(response.body.data).toHaveProperty('faturamento');
    expect(response.body.data).toHaveProperty('performance');
  });
});
