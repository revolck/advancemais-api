import request from 'supertest';
import { app } from '@/index';
import { prisma } from '@/config/prisma';
import { CursosAvaliacaoTipo } from '@prisma/client';
import { createTestUser, cleanupTestUsers } from '../helpers/test-helpers';

describe('GET /api/v1/cursos/avaliacoes - Listagem Global', () => {
  let testAdmin: { id: string; token: string };
  let testCurso1Id: string;
  let testCurso2Id: string;
  let testTurma1Id: string;
  let testTurma2Id: string;
  let testAvaliacaoIds: string[] = [];
  let testUsers: { id: string; token: string }[] = [];

  beforeAll(async () => {
    // Criar usuário admin de teste
    testAdmin = await createTestUser('ADMIN');
    testUsers.push(testAdmin);

    // Criar cursos de teste
    const curso1 = await prisma.cursos.create({
      data: {
        codigo: `TESTE-C1-${Date.now()}`,
        nome: 'Curso Teste 1 - Matemática',
        descricao: 'Curso para testes',
        cargaHoraria: 40,
        vagasDisponiveis: 30,
        preco: 100,
        ativo: true,
      },
    });
    testCurso1Id = curso1.id;

    const curso2 = await prisma.cursos.create({
      data: {
        codigo: `TESTE-C2-${Date.now()}`,
        nome: 'Curso Teste 2 - Programação',
        descricao: 'Curso para testes',
        cargaHoraria: 60,
        vagasDisponiveis: 25,
        preco: 150,
        ativo: true,
      },
    });
    testCurso2Id = curso2.id;

    // Criar turmas de teste
    const turma1 = await prisma.cursosTurmas.create({
      data: {
        cursoId: testCurso1Id,
        codigo: `TURMA-T1-${Date.now()}`,
        nome: 'Turma 1',
        vagas: 30,
      },
    });
    testTurma1Id = turma1.id;

    const turma2 = await prisma.cursosTurmas.create({
      data: {
        cursoId: testCurso2Id,
        codigo: `TURMA-T2-${Date.now()}`,
        nome: 'Turma 2',
        vagas: 25,
      },
    });
    testTurma2Id = turma2.id;

    // Criar avaliações de teste
    // Templates (sem turma)
    const template1 = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId: testCurso1Id,
        turmaId: null,
        titulo: 'Template Prova de Matemática',
        etiqueta: 'TEMP-MAT',
        tipo: CursosAvaliacaoTipo.PROVA,
        peso: 10,
        ativo: true,
        ordem: 1,
      },
    });
    testAvaliacaoIds.push(template1.id);

    const template2 = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId: testCurso2Id,
        turmaId: null,
        titulo: 'Template Atividade de Programação',
        etiqueta: 'TEMP-PROG',
        tipo: CursosAvaliacaoTipo.ATIVIDADE,
        peso: 5,
        ativo: true,
        ordem: 1,
      },
    });
    testAvaliacaoIds.push(template2.id);

    // Avaliações vinculadas a turmas
    const prova1 = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId: testCurso1Id,
        turmaId: testTurma1Id,
        titulo: 'Prova Final de Matemática',
        etiqueta: 'PROVA-MAT-FINAL',
        tipo: CursosAvaliacaoTipo.PROVA,
        peso: 10,
        ativo: true,
        ordem: 1,
      },
    });
    testAvaliacaoIds.push(prova1.id);

    const atividade1 = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId: testCurso2Id,
        turmaId: testTurma2Id,
        titulo: 'Atividade Prática JavaScript',
        etiqueta: 'ATIV-JS',
        tipo: CursosAvaliacaoTipo.ATIVIDADE,
        peso: 5,
        ativo: true,
        ordem: 1,
      },
    });
    testAvaliacaoIds.push(atividade1.id);

    const prova2 = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId: testCurso1Id,
        turmaId: testTurma1Id,
        titulo: 'Prova Intermediária',
        etiqueta: 'PROVA-MAT-INT',
        tipo: CursosAvaliacaoTipo.PROVA,
        peso: 8,
        ativo: false,
        ordem: 2,
      },
    });
    testAvaliacaoIds.push(prova2.id);
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (testAvaliacaoIds.length > 0) {
      await prisma.cursosTurmasProvas.deleteMany({
        where: { id: { in: testAvaliacaoIds } },
      });
    }
    if (testTurma1Id) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: { in: [testTurma1Id, testTurma2Id] } },
      });
    }
    if (testCurso1Id) {
      await prisma.cursos.deleteMany({
        where: { id: { in: [testCurso1Id, testCurso2Id] } },
      });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('Listagem sem filtros (global)', () => {
    it('deve listar todas as avaliações sem parâmetros', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('pageSize', 10);
    });

    it('deve retornar campos de visão geral', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      if (response.body.data.length > 0) {
        const avaliacao = response.body.data[0];
        expect(avaliacao).toHaveProperty('id');
        expect(avaliacao).toHaveProperty('titulo');
        expect(avaliacao).toHaveProperty('tipo');
        expect(avaliacao).toHaveProperty('nome');
        expect(avaliacao).toHaveProperty('cursoNome');
        expect(avaliacao).toHaveProperty('turmaNome');
        expect(avaliacao).toHaveProperty('status');
        expect(avaliacao).toHaveProperty('data');
        expect(avaliacao).toHaveProperty('pesoNota');
        expect(avaliacao).toHaveProperty('criadoPor');
      }
    });
  });

  describe('Filtros individuais', () => {
    it('deve filtrar por tipo PROVA', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ tipo: 'PROVA' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.tipo).toBe('PROVA');
      });
    });

    it('deve filtrar por tipo ATIVIDADE', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ tipo: 'ATIVIDADE' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.tipo).toBe('ATIVIDADE');
      });
    });

    it('deve filtrar por status ATIVO', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ status: 'ATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.status).toBe('ATIVO');
      });
    });

    it('deve filtrar por status INATIVO', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ status: 'INATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.status).toBe('INATIVO');
      });
    });

    it('deve buscar por título', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ search: 'matemática' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        const matchesTitulo = av.titulo.toLowerCase().includes('matemática');
        const matchesEtiqueta = av.etiqueta?.toLowerCase().includes('matemática');
        expect(matchesTitulo || matchesEtiqueta).toBe(true);
      });
    });

    it('deve filtrar por curso específico', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ cursoId: testCurso1Id })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.cursoId).toBe(testCurso1Id);
      });
    });

    it('deve filtrar por turma específica', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ turmaId: testTurma1Id })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.turmaId).toBe(testTurma1Id);
      });
    });

    it('deve filtrar apenas templates (sem turma)', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ semTurma: 'true' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.turmaId).toBeNull();
      });
    });

    it('deve filtrar apenas avaliações com turma', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ semTurma: 'false' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.turmaId).not.toBeNull();
      });
    });
  });

  describe('Combinação de filtros', () => {
    it('deve combinar tipo + status', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ tipo: 'PROVA', status: 'ATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.tipo).toBe('PROVA');
        expect(av.status).toBe('ATIVO');
      });
    });

    it('deve combinar busca + tipo + status', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ search: 'prova', tipo: 'PROVA', status: 'ATIVO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((av: any) => {
        expect(av.tipo).toBe('PROVA');
        expect(av.status).toBe('ATIVO');
        const matchesTitulo = av.titulo.toLowerCase().includes('prova');
        const matchesEtiqueta = av.etiqueta?.toLowerCase().includes('prova');
        expect(matchesTitulo || matchesEtiqueta).toBe(true);
      });
    });
  });

  describe('Paginação', () => {
    it('deve respeitar pageSize', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ pageSize: 2 })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.pagination).toHaveProperty('pageSize', 2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it('deve navegar entre páginas', async () => {
      const response1 = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ page: 1, pageSize: 2 })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      const response2 = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ page: 2, pageSize: 2 })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response1.body.data).toBeDefined();
      expect(response2.body.data).toBeDefined();

      if (response1.body.data.length > 0 && response2.body.data.length > 0) {
        expect(response1.body.data[0].id).not.toBe(response2.body.data[0].id);
      }
    });
  });

  describe('Validação de parâmetros', () => {
    it('deve retornar erro 400 para tipo inválido', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ tipo: 'INVALIDO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('deve retornar erro 400 para status inválido', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ status: 'INVALIDO' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('deve retornar erro 400 para cursoId inválido', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ cursoId: 'not-a-uuid' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('deve retornar erro 400 para turmaId inválido', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ turmaId: 'not-a-uuid' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Autenticação e autorização', () => {
    it('deve retornar erro 401 sem token', async () => {
      await request(app).get('/api/v1/cursos/avaliacoes').expect(401);
    });

    it('deve retornar erro 401 com token inválido', async () => {
      await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
    });
  });

  describe('Ordenação', () => {
    it('deve ordenar por criadoEm desc (padrão)', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      if (response.body.data.length > 1) {
        const datas = response.body.data.map((av: any) => new Date(av.criadoEm).getTime());
        for (let i = 1; i < datas.length; i++) {
          expect(datas[i - 1]).toBeGreaterThanOrEqual(datas[i]);
        }
      }
    });

    it('deve ordenar por titulo asc', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ orderBy: 'titulo', order: 'asc' })
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      if (response.body.data.length > 1) {
        const titulos = response.body.data.map((av: any) => av.titulo);
        for (let i = 1; i < titulos.length; i++) {
          expect(titulos[i - 1].localeCompare(titulos[i])).toBeLessThanOrEqual(0);
        }
      }
    });
  });
});
