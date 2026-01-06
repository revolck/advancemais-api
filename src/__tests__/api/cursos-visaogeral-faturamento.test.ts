import request from 'supertest';
import type { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import { createTestAdmin, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';

describe('API - Cursos (Tendências de Faturamento)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  const createdCursoIds: string[] = [];
  const createdTransacaoIds: string[] = [];

  beforeAll(async () => {
    jest.setTimeout(30000);
    app = await getTestApp();
  });

  afterAll(async () => {
    if (createdTransacaoIds.length > 0) {
      await prisma.auditoriaTransacoes.deleteMany({
        where: { id: { in: createdTransacaoIds } },
      });
    }

    if (createdCursoIds.length > 0) {
      await prisma.cursos.deleteMany({
        where: { id: { in: createdCursoIds } },
      });
    }

    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('GET /api/v1/cursos/visaogeral/faturamento', () => {
    it('deve retornar tendências de faturamento com period=custom', async () => {
      const admin = await createTestAdmin();
      testUsers.push(admin);

      const curso = await prisma.cursos.create({
        data: {
          codigo: `T${Date.now().toString().slice(-11)}`,
          nome: 'Curso Test Faturamento',
          descricao: 'Curso para teste de tendências de faturamento',
          cargaHoraria: 10,
          statusPadrao: 'PUBLICADO',
          atualizadoEm: new Date(),
        },
      });
      createdCursoIds.push(curso.id);

      const aprovada = await prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'PAGAMENTO',
          status: 'APROVADA',
          valor: 100.0,
          moeda: 'BRL',
          referencia: 'checkout curso',
          metadata: { cursoId: curso.id },
          criadoEm: new Date('2099-01-15T12:00:00Z'),
        },
      });
      createdTransacaoIds.push(aprovada.id);

      const pendente = await prisma.auditoriaTransacoes.create({
        data: {
          tipo: 'PAGAMENTO',
          status: 'PENDENTE',
          valor: 50.0,
          moeda: 'BRL',
          referencia: 'checkout curso',
          metadata: { cursoId: curso.id },
          criadoEm: new Date('2099-01-16T15:00:00Z'),
        },
      });
      createdTransacaoIds.push(pendente.id);

      const response = await request(app)
        .get(
          '/api/v1/cursos/visaogeral/faturamento?period=custom&startDate=2099-01-01&endDate=2099-01-31&tz=UTC&top=10',
        )
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      expect(response.body.data).toMatchObject({
        period: 'custom',
        startDate: '2099-01-01',
        endDate: '2099-01-31',
        totalTransacoes: 2,
        transacoesAprovadas: 1,
      });

      expect(response.body.data.faturamentoMesAtual).toBeCloseTo(100.0, 2);
      expect(response.body.data.faturamentoMesAnterior).toBeCloseTo(0.0, 2);
      expect(typeof response.body.data.cursosAtivos).toBe('number');

      expect(Array.isArray(response.body.data.historicalData)).toBe(true);
      expect(response.body.data.historicalData.length).toBeGreaterThan(0);
      expect(response.body.data.historicalData.some((row: any) => row.date === '2099-01-15')).toBe(
        true,
      );

      expect(Array.isArray(response.body.data.topCursosFaturamento)).toBe(true);
      expect(response.body.data.topCursosFaturamento.length).toBeGreaterThan(0);

      const top = response.body.data.topCursosFaturamento[0];
      expect(top).toMatchObject({
        cursoId: curso.id,
        cursoNome: curso.nome,
        totalFaturamento: 100,
        totalTransacoes: 2,
        transacoesAprovadas: 1,
        transacoesPendentes: 1,
      });

      expect(response.body.data.cursoMaiorFaturamento).toHaveProperty('cursoId', curso.id);
    });

    it('deve retornar 400 quando period=custom sem endDate', async () => {
      const admin = await createTestAdmin();
      testUsers.push(admin);

      const response = await request(app)
        .get('/api/v1/cursos/visaogeral/faturamento?period=custom&startDate=2099-01-01&tz=UTC')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });
});
