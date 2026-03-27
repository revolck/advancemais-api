import request from 'supertest';
import type { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';
import { Roles } from '@prisma/client';

describe('API - Dashboard Métricas Setor de Vagas', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  const emptyPayload = {
    metricasGerais: {
      totalEmpresas: 0,
      empresasAtivas: 0,
      totalVagas: 0,
      vagasAbertas: 0,
      vagasPendentes: 0,
      vagasEncerradas: 0,
      totalCandidatos: 0,
      candidatosEmProcesso: 0,
      candidatosContratados: 0,
      solicitacoesPendentes: 0,
      solicitacoesAprovadasHoje: 0,
      solicitacoesRejeitadasHoje: 0,
    },
  };

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('GET /api/v1/dashboard/setor-de-vagas/metricas', () => {
    it('deve permitir acesso para SETOR_DE_VAGAS e retornar payload estável', async () => {
      const setorDeVagas = await createTestUser({ role: Roles.SETOR_DE_VAGAS });
      testUsers.push(setorDeVagas);

      const response = await request(app)
        .get('/api/v1/dashboard/setor-de-vagas/metricas')
        .set('Authorization', `Bearer ${setorDeVagas.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('metricasGerais');
      expect(response.body.metricasGerais).toEqual(
        expect.objectContaining({
          totalEmpresas: expect.any(Number),
          empresasAtivas: expect.any(Number),
          totalVagas: expect.any(Number),
          vagasAbertas: expect.any(Number),
          vagasPendentes: expect.any(Number),
          vagasEncerradas: expect.any(Number),
          totalCandidatos: expect.any(Number),
          candidatosEmProcesso: expect.any(Number),
          candidatosContratados: expect.any(Number),
          solicitacoesPendentes: expect.any(Number),
          solicitacoesAprovadasHoje: expect.any(Number),
          solicitacoesRejeitadasHoje: expect.any(Number),
        }),
      );
    });

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

    it('deve retornar zeros para RECRUTADOR sem vínculos de vaga', async () => {
      const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
      testUsers.push(recruiter);

      const response = await request(app)
        .get('/api/v1/dashboard/setor-de-vagas/metricas')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .expect(200);

      expect(response.body).toEqual(emptyPayload);
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
