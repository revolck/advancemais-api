import request from 'supertest';
import type { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';
import { Roles } from '@prisma/client';

describe('API - Dashboard Métricas Setor de Vagas', () => {
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

  describe('GET /api/v1/dashboard/setor-de-vagas/metricas', () => {
    it('deve permitir acesso para RECRUTADOR', async () => {
      const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
      testUsers.push(recruiter);

      const response = await request(app)
        .get('/api/v1/dashboard/setor-de-vagas/metricas')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('metricasGerais');
      expect(response.body.metricasGerais).toHaveProperty('totalEmpresas');
      expect(response.body.metricasGerais).toHaveProperty('totalVagas');
      expect(response.body.metricasGerais).toHaveProperty('totalCandidatos');
    });

    it('deve negar acesso para ALUNO_CANDIDATO', async () => {
      const aluno = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
      testUsers.push(aluno);

      const response = await request(app)
        .get('/api/v1/dashboard/setor-de-vagas/metricas')
        .set('Authorization', `Bearer ${aluno.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });
  });
});
