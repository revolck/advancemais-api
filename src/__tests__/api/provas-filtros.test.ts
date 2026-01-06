import request from 'supertest';
import type { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import {
  createTestUser,
  createTestAdmin,
  cleanupTestUsers,
  type TestUser,
} from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

describe('API - Provas/Atividades - Filtros', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testCursoId: string | null = null;
  let testTurmaId: string | null = null;
  const testProvasIds: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testUsers.push(testAdmin);

    // Criar curso de teste
    const curso = await prisma.cursos.create({
      data: {
        codigo: `TEST-${Date.now()}`,
        nome: 'Curso de Teste - Filtros',
        cargaHoraria: 40,
        valor: new Prisma.Decimal(100),
        gratuito: false,
      },
    });
    testCursoId = curso.id;

    // Criar turma de teste
    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId: curso.id,
        nome: 'Turma de Teste - Filtros',
        vagasTotais: 30,
        dataInicio: new Date(),
        dataFim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    testTurmaId = turma.id;

    // Criar provas/atividades de teste
    const provas = [
      {
        cursoId: curso.id,
        turmaId: turma.id,
        titulo: 'Prova de Matemática',
        etiqueta: 'MAT-001',
        peso: new Prisma.Decimal(10),
        ativo: true,
        tipo: 'PROVA' as const,
      },
      {
        cursoId: curso.id,
        turmaId: turma.id,
        titulo: 'Atividade de Português',
        etiqueta: 'PT-001',
        peso: new Prisma.Decimal(5),
        ativo: true,
        tipo: 'ATIVIDADE' as const,
      },
      {
        cursoId: curso.id,
        turmaId: turma.id,
        titulo: 'Prova de História',
        etiqueta: 'HIST-001',
        peso: new Prisma.Decimal(8),
        ativo: false,
        tipo: 'PROVA' as const,
      },
      {
        cursoId: curso.id,
        turmaId: turma.id,
        titulo: 'Atividade de Geografia',
        etiqueta: 'GEO-001',
        peso: new Prisma.Decimal(7),
        ativo: true,
        tipo: 'ATIVIDADE' as const,
      },
    ];

    for (const provaData of provas) {
      const prova = await prisma.cursosTurmasProvas.create({
        data: provaData,
      });
      testProvasIds.push(prova.id);
    }
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (testProvasIds.length > 0) {
      await prisma.cursosTurmasProvas.deleteMany({
        where: { id: { in: testProvasIds } },
      });
    }
    if (testTurmaId) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: testTurmaId },
      });
    }
    if (testCursoId) {
      await prisma.cursos.deleteMany({
        where: { id: testCursoId },
      });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('GET /api/v1/cursos/:cursoId/turmas/:turmaId/provas - Filtros', () => {
    it('deve listar todas as provas/atividades sem filtros', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('deve filtrar por busca (título)', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ search: 'Matemática' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0]).toHaveProperty('titulo');
      expect(response.body.data[0].titulo).toContain('Matemática');
    });

    it('deve filtrar por status ATIVO', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ status: 'ATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((prova: any) => {
        expect(prova.status).toBe('ATIVO');
        expect(prova.ativo).toBe(true);
      });
    });

    it('deve filtrar por status INATIVO', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ status: 'INATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((prova: any) => {
        expect(prova.status).toBe('INATIVO');
        expect(prova.ativo).toBe(false);
      });
    });

    it('deve filtrar por turmaId específico', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ turmaId: testTurmaId })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((prova: any) => {
        expect(prova.turmaId).toBe(testTurmaId);
      });
    });

    it('deve combinar múltiplos filtros (busca + status)', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ search: 'Atividade', status: 'ATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((prova: any) => {
        expect(prova.titulo.toLowerCase()).toContain('atividade');
        expect(prova.status).toBe('ATIVO');
      });
    });

    it('deve retornar erro 400 com status inválido', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ status: 'INVALIDO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('deve retornar erro 400 com turmaId inválido (não UUID)', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ turmaId: 'invalid-uuid' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('deve filtrar por tipo PROVA', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ tipo: 'PROVA' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((prova: any) => {
        expect(prova.tipo).toBe('PROVA');
      });
    });

    it('deve filtrar por tipo ATIVIDADE', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ tipo: 'ATIVIDADE' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((prova: any) => {
        expect(prova.tipo).toBe('ATIVIDADE');
      });
    });

    it('deve retornar erro 400 com tipo inválido', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ tipo: 'INVALIDO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('deve combinar filtro de tipo com outros filtros', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .query({ tipo: 'ATIVIDADE', status: 'ATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((prova: any) => {
        expect(prova.tipo).toBe('ATIVIDADE');
        expect(prova.status).toBe('ATIVO');
      });
    });

    it('deve retornar campos de visão geral na resposta', async () => {
      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      if (response.body.data.length > 0) {
        const prova = response.body.data[0];
        expect(prova).toHaveProperty('nome');
        expect(prova).toHaveProperty('curso');
        expect(prova).toHaveProperty('status');
        expect(prova).toHaveProperty('data');
        expect(prova).toHaveProperty('pesoNota');
        expect(prova).toHaveProperty('valePonto');
        expect(prova).toHaveProperty('criadoEm');
        expect(prova).toHaveProperty('criadoPor');
      }
    });
  });
});
