import request from 'supertest';
import { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import {
  createTestUser,
  createTestAdmin,
  createTestModerator,
  cleanupTestUsers,
  type TestUser,
} from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';
import { randomUUID } from 'crypto';

describe('API - Aulas: Publicação e Exclusão', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testModerator: TestUser;
  let testInstrutor: TestUser;
  let testTurmaId: string | null = null;
  let testAulaId: string | null = null;
  let testInstrutorId: string | null = null;

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testModerator = await createTestModerator();
    testInstrutor = await createTestUser({ role: 'INSTRUTOR' });
    testUsers.push(testAdmin, testModerator, testInstrutor);

    // Buscar ou criar uma turma para testes
    const turma = await prisma.cursosTurmas.findFirst({
      include: { Cursos: true },
    });

    if (turma) {
      testTurmaId = turma.id;
      testInstrutorId = turma.instrutorId || testInstrutor.id;
    }
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (testAulaId) {
      await prisma.cursosTurmasAulas.deleteMany({
        where: { id: testAulaId },
      });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('POST /api/v1/cursos/aulas - Criar aula em RASCUNHO', () => {
    it('deve criar aula em RASCUNHO com campos mínimos', async () => {
      if (!testTurmaId) {
        console.log('⚠️  Pulando teste: turma não encontrada');
        return;
      }

      const aulaData = {
        titulo: 'Aula de Teste - Publicação',
        descricao: 'Descrição da aula de teste para validação de publicação',
        modalidade: 'ONLINE',
        youtubeUrl: 'https://www.youtube.com/watch?v=test123',
        duracaoMinutos: 60,
        status: 'RASCUNHO',
        turmaId: testTurmaId,
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.aula).toHaveProperty('id');
      expect(response.body.aula.status).toBe('RASCUNHO');
      testAulaId = response.body.aula.id;
    });
  });

  describe('PATCH /api/v1/cursos/aulas/:id/publicar - Publicar aula', () => {
    it('deve bloquear publicação se campos obrigatórios faltarem (PRESENCIAL)', async () => {
      if (!testTurmaId || !testAulaId) {
        console.log('⚠️  Pulando teste: turma ou aula não encontrada');
        return;
      }

      // Criar aula PRESENCIAL sem turma/instrutor
      const aulaData = {
        titulo: 'Aula Presencial - Sem Turma',
        descricao: 'Aula presencial sem turma e instrutor',
        modalidade: 'PRESENCIAL',
        dataInicio: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        duracaoMinutos: 60,
        status: 'RASCUNHO',
      };

      const createResponse = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(201);

      const aulaIdSemTurma = createResponse.body.aula.id;

      // Tentar publicar
      const response = await request(app)
        .patch(`/api/v1/cursos/aulas/${aulaIdSemTurma}/publicar`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ publicar: true })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CAMPOS_OBRIGATORIOS_FALTANDO');
      expect(response.body.camposFaltando).toContain('turmaId');

      // Limpar
      await prisma.cursosTurmasAulas.delete({ where: { id: aulaIdSemTurma } });
    });

    it('deve bloquear publicação de AO_VIVO com data no passado', async () => {
      if (!testTurmaId || !testInstrutorId) {
        console.log('⚠️  Pulando teste: turma ou instrutor não encontrado');
        return;
      }

      const aulaData = {
        titulo: 'Aula AO_VIVO - Data Passada',
        descricao: 'Aula ao vivo com data no passado',
        modalidade: 'AO_VIVO',
        dataInicio: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        duracaoMinutos: 60,
        status: 'RASCUNHO',
        turmaId: testTurmaId,
        instrutorId: testInstrutorId,
      };

      const createResponse = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(201);

      const aulaIdDataPassada = createResponse.body.aula.id;

      // Tentar publicar
      const response = await request(app)
        .patch(`/api/v1/cursos/aulas/${aulaIdDataPassada}/publicar`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ publicar: true })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('DATA_INVALIDA');

      // Limpar
      await prisma.cursosTurmasAulas.delete({ where: { id: aulaIdDataPassada } });
    });

    it('deve permitir publicação de aula ONLINE com YouTube URL', async () => {
      if (!testTurmaId || !testAulaId) {
        console.log('⚠️  Pulando teste: turma ou aula não encontrada');
        return;
      }

      // Atualizar aula para ONLINE
      await prisma.cursosTurmasAulas.update({
        where: { id: testAulaId },
        data: {
          modalidade: 'ONLINE',
          urlVideo: 'https://www.youtube.com/watch?v=test123',
        },
      });

      const response = await request(app)
        .patch(`/api/v1/cursos/aulas/${testAulaId}/publicar`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ publicar: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.aula.status).toBe('PUBLICADA');
    });
  });

  describe('PATCH /api/v1/cursos/aulas/:id/publicar - Despublicar aula', () => {
    it('deve bloquear despublicação de aula EM_ANDAMENTO', async () => {
      if (!testAulaId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      // Atualizar para EM_ANDAMENTO
      await prisma.cursosTurmasAulas.update({
        where: { id: testAulaId },
        data: { status: 'EM_ANDAMENTO' },
      });

      const response = await request(app)
        .patch(`/api/v1/cursos/aulas/${testAulaId}/publicar`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ publicar: false })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('STATUS_INVALIDO');

      // Reverter
      await prisma.cursosTurmasAulas.update({
        where: { id: testAulaId },
        data: { status: 'PUBLICADA' },
      });
    });

    it('deve permitir despublicação de aula PUBLICADA', async () => {
      if (!testAulaId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      // Garantir que está PUBLICADA
      await prisma.cursosTurmasAulas.update({
        where: { id: testAulaId },
        data: { status: 'PUBLICADA' },
      });

      const response = await request(app)
        .patch(`/api/v1/cursos/aulas/${testAulaId}/publicar`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ publicar: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.aula.status).toBe('RASCUNHO');
    });
  });

  describe('DELETE /api/v1/cursos/aulas/:id - Excluir aula', () => {
    let aulaParaExcluirId: string | null = null;

    beforeEach(async () => {
      if (!testTurmaId) return;

      // Criar aula para exclusão
      const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos
      const aula = await prisma.cursosTurmasAulas.create({
        data: {
          codigo: `T${timestamp}`, // Máximo 7 caracteres
          nome: 'Aula para Exclusão',
          descricao: 'Aula criada para testar exclusão',
          modalidade: 'ONLINE',
          urlVideo: 'https://www.youtube.com/watch?v=test',
          duracaoMinutos: 60,
          status: 'RASCUNHO',
          turmaId: testTurmaId,
          dataInicio: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 dias no futuro
        },
      });

      aulaParaExcluirId = aula.id;
    });

    afterEach(async () => {
      if (aulaParaExcluirId) {
        await prisma.cursosTurmasAulas.deleteMany({
          where: { id: aulaParaExcluirId },
        });
        aulaParaExcluirId = null;
      }
    });

    it('deve bloquear exclusão por INSTRUTOR', async () => {
      if (!aulaParaExcluirId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      const response = await request(app)
        .delete(`/api/v1/cursos/aulas/${aulaParaExcluirId}`)
        .set('Authorization', `Bearer ${testInstrutor.token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('deve bloquear exclusão com prazo menor que 5 dias', async () => {
      if (!aulaParaExcluirId || !testTurmaId) {
        console.log('⚠️  Pulando teste: aula ou turma não encontrada');
        return;
      }

      // Atualizar para 3 dias no futuro
      await prisma.cursosTurmasAulas.update({
        where: { id: aulaParaExcluirId },
        data: {
          dataInicio: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/cursos/aulas/${aulaParaExcluirId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PRAZO_INSUFICIENTE');
      expect(response.body.diasRestantes).toBeLessThan(5);
    });

    it('deve bloquear exclusão de aula já realizada', async () => {
      if (!aulaParaExcluirId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      // Atualizar para data no passado
      await prisma.cursosTurmasAulas.update({
        where: { id: aulaParaExcluirId },
        data: {
          dataInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/cursos/aulas/${aulaParaExcluirId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AULA_JA_REALIZADA');
    });

    it('deve permitir exclusão com prazo adequado (ADMIN)', async () => {
      if (!aulaParaExcluirId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      // Garantir 10 dias no futuro
      await prisma.cursosTurmasAulas.update({
        where: { id: aulaParaExcluirId },
        data: {
          dataInicio: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/cursos/aulas/${aulaParaExcluirId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('excluída');
      expect(response.body).toHaveProperty('dadosRemovidos');

      aulaParaExcluirId = null; // Já foi excluída
    });

    it('deve permitir exclusão de aula ONLINE sem data', async () => {
      if (!testTurmaId) {
        console.log('⚠️  Pulando teste: turma não encontrada');
        return;
      }

      // Criar aula ONLINE sem data
      const timestamp2 = Date.now().toString().slice(-6); // Últimos 6 dígitos
      const aula = await prisma.cursosTurmasAulas.create({
        data: {
          codigo: `T${timestamp2}`, // Máximo 7 caracteres
          nome: 'Aula ONLINE Sem Data',
          descricao: 'Aula online sem data para exclusão',
          modalidade: 'ONLINE',
          urlVideo: 'https://www.youtube.com/watch?v=test',
          duracaoMinutos: 60,
          status: 'RASCUNHO',
          turmaId: testTurmaId,
          dataInicio: null,
        },
      });

      const response = await request(app)
        .delete(`/api/v1/cursos/aulas/${aula.id}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Limpeza de dados na exclusão', () => {
    it('deve remover materiais complementares ao excluir', async () => {
      if (!testTurmaId) {
        console.log('⚠️  Pulando teste: turma não encontrada');
        return;
      }

      // Criar aula com materiais
      const timestamp3 = Date.now().toString().slice(-6); // Últimos 6 dígitos
      const aula = await prisma.cursosTurmasAulas.create({
        data: {
          codigo: `T${timestamp3}`, // Máximo 7 caracteres
          nome: 'Aula com Materiais',
          descricao: 'Aula com materiais para testar limpeza',
          modalidade: 'ONLINE',
          urlVideo: 'https://www.youtube.com/watch?v=test',
          duracaoMinutos: 60,
          status: 'RASCUNHO',
          turmaId: testTurmaId,
          dataInicio: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
      });

      // Criar materiais
      await prisma.cursosTurmasAulasMateriais.createMany({
        data: [
          {
            aulaId: aula.id,
            titulo: 'Material 1',
            tipo: 'VIDEOAULA', // CursosMateriais enum
            ordem: 1,
          },
          {
            aulaId: aula.id,
            titulo: 'Material 2',
            tipo: 'APOSTILA', // CursosMateriais enum
            ordem: 2,
          },
        ],
      });

      // Excluir aula
      await request(app)
        .delete(`/api/v1/cursos/aulas/${aula.id}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      // Verificar se materiais foram removidos
      const materiais = await prisma.cursosTurmasAulasMateriais.findMany({
        where: { aulaId: aula.id },
      });

      expect(materiais.length).toBe(0);
    });
  });
});

