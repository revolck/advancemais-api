import request from 'supertest';
import { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import {
  createTestUser,
  createTestAdmin,
  cleanupTestUsers,
  type TestUser,
} from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';
import { randomUUID } from 'crypto';

describe('API - Aulas: POST e PUT', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testInstrutor: TestUser;
  let testCursoId: string | null = null;
  let testTurmaId: string | null = null;
  let testInstrutorId: string | null = null;
  let testAulaId: string | null = null;

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testInstrutor = await createTestUser({ role: 'INSTRUTOR' });
    testUsers.push(testAdmin, testInstrutor);
    testInstrutorId = testInstrutor.id;

    // Criar curso de teste
    const timestamp = Date.now().toString().slice(-6);
    const curso = await prisma.cursos.create({
      data: {
        nome: `Curso Teste Aulas ${timestamp}`,
        codigo: `CT${timestamp}`,
        descricao: 'Curso para testes de aulas POST/PUT',
        categoriaId: null,
        valor: 0,
        valorPromocional: 0,
        gratuito: true,
        statusPadrao: 'PUBLICADO',
        cargaHoraria: 40,
        estagioObrigatorio: false,
      },
    });
    testCursoId = curso.id;

    // Criar turma de teste
    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId: curso.id,
        codigo: `TRM${timestamp}`,
        nome: 'Turma Teste Aulas',
        metodo: 'ONLINE',
        instrutorId: testInstrutorId,
        vagasTotais: 30,
        vagasDisponiveis: 30,
        dataInicio: new Date('2026-02-01'),
        dataFim: new Date('2026-06-30'),
        status: 'INSCRICOES_ABERTAS',
      },
    });
    testTurmaId = turma.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (testAulaId) {
      await prisma.cursosTurmasAulas.deleteMany({
        where: { id: testAulaId },
      });
    }
    if (testTurmaId) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: testTurmaId },
      });
    }
    if (testCursoId) {
      await prisma.cursos.delete({
        where: { id: testCursoId },
      });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('POST /api/v1/cursos/aulas - Criar aula', () => {
    it('deve criar aula rascunho sem turma (template)', async () => {
      const aulaData = {
        titulo: 'Aula Template',
        descricao: 'Descrição da aula template',
        modalidade: 'ONLINE',
        youtubeUrl: 'https://www.youtube.com/watch?v=test123', // Necessário para modalidade ONLINE
        duracaoMinutos: 60,
        obrigatoria: true,
        status: 'RASCUNHO',
        // Não enviar turmaId e instrutorId (undefined) ao invés de null
        materiais: [
          'https://example.com/arquivo-1.pdf',
          { url: 'https://example.com/arquivo-2.pdf', titulo: 'Apostila' },
        ],
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData);

      if (response.status !== 201) {
        console.log('Erro ao criar aula:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);

      expect(response.body.success).toBe(true);
      expect(response.body.aula).toHaveProperty('id');
      expect(response.body.aula.titulo || response.body.aula.nome).toBe(aulaData.titulo);
      expect(response.body.aula.status).toBe('RASCUNHO');
      expect(response.body.aula.turmaId).toBeNull();

      // Limpar
      if (response.body.aula.id) {
        await prisma.cursosTurmasAulas.deleteMany({
          where: { id: response.body.aula.id },
        });
      }
    });

    it('deve criar aula com turma vinculada', async () => {
      if (!testTurmaId) {
        console.log('⚠️  Pulando teste: turma não encontrada');
        return;
      }

      const aulaData = {
        titulo: 'Aula 01',
        descricao: 'Descrição da aula',
        modalidade: 'AO_VIVO',
        duracaoMinutos: 90,
        obrigatoria: false,
        turmaId: testTurmaId,
        instrutorId: testInstrutorId,
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.aula).toHaveProperty('id');
      expect(response.body.aula.titulo || response.body.aula.nome).toBe(aulaData.titulo);
      expect(response.body.aula.turmaId).toBe(testTurmaId);
      expect(response.body.aula.status).toBe('RASCUNHO'); // Sempre RASCUNHO na criação

      testAulaId = response.body.aula.id;
    });

    it('deve validar campos obrigatórios', async () => {
      const aulaData = {
        titulo: 'AB', // Muito curto
        descricao: '', // Vazio
        modalidade: 'INVALIDO', // Inválido
        duracaoMinutos: -1, // Inválido
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.issues).toBeDefined();
    });

    it('deve validar regra: cursoId requer turmaId', async () => {
      if (!testCursoId) {
        console.log('⚠️  Pulando teste: curso não encontrado');
        return;
      }

      const aulaData = {
        titulo: 'Aula com cursoId sem turmaId',
        descricao: 'Deve falhar validação',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        cursoId: testCursoId,
        // turmaId não informado - deve falhar
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.issues.turmaId).toBeDefined();
    });

    it('deve aceitar obrigatoria como string/boolean/number', async () => {
      if (!testTurmaId) {
        console.log('⚠️  Pulando teste: turma não encontrada');
        return;
      }

      // Testar com string "sim"
      const aulaData1 = {
        titulo: 'Aula Obrigatória String',
        descricao: 'Teste com string',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: 'sim',
        turmaId: testTurmaId,
      };

      const response1 = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData1)
        .expect(201);

      expect(response1.body.success).toBe(true);
      expect(response1.body.aula.obrigatoria).toBe(true);

      // Limpar
      await prisma.cursosTurmasAulas.deleteMany({
        where: { id: response1.body.aula.id },
      });

      // Testar com number 0
      const aulaData2 = {
        titulo: 'Aula Não Obrigatória Number',
        descricao: 'Teste com number',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: 0,
        turmaId: testTurmaId,
      };

      const response2 = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData2)
        .expect(201);

      expect(response2.body.success).toBe(true);
      expect(response2.body.aula.obrigatoria).toBe(false);

      // Limpar
      await prisma.cursosTurmasAulas.deleteMany({
        where: { id: response2.body.aula.id },
      });
    });

    it('deve validar máximo de 3 materiais', async () => {
      if (!testTurmaId) {
        console.log('⚠️  Pulando teste: turma não encontrada');
        return;
      }

      const aulaData = {
        titulo: 'Aula com muitos materiais',
        descricao: 'Deve falhar',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        turmaId: testTurmaId,
        materiais: [
          'https://example.com/1.pdf',
          'https://example.com/2.pdf',
          'https://example.com/3.pdf',
          'https://example.com/4.pdf', // Excede o máximo
        ],
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/v1/cursos/aulas/:id - Atualizar aula', () => {
    jest.setTimeout(20000); // Timeout de 20 segundos para todos os testes deste describe
    let aulaParaEditarId: string | null = null;

    beforeEach(async () => {
      if (!testTurmaId) return;

      // Criar aula para editar
      const timestamp = Date.now().toString().slice(-6);
      const aula = await prisma.cursosTurmasAulas.create({
        data: {
          codigo: `T${timestamp}`,
          nome: 'Aula para Editar',
          descricao: 'Aula criada para testar PUT',
          modalidade: 'ONLINE',
          urlVideo: 'https://www.youtube.com/watch?v=test',
          duracaoMinutos: 60,
          obrigatoria: true,
          status: 'RASCUNHO',
          turmaId: testTurmaId,
        },
      });

      aulaParaEditarId = aula.id;
    });

    afterEach(async () => {
      if (aulaParaEditarId) {
        await prisma.cursosTurmasAulas.deleteMany({
          where: { id: aulaParaEditarId },
        });
        aulaParaEditarId = null;
      }
    });

    it('deve atualizar aula com payload completo', async () => {
      if (!aulaParaEditarId || !testTurmaId) {
        console.log('⚠️  Pulando teste: aula ou turma não encontrada');
        return;
      }

      const updateData = {
        titulo: 'Aula Atualizada',
        descricao: 'Descrição atualizada (máx 5000 caracteres)',
        modalidade: 'ONLINE',
        duracaoMinutos: 90,
        obrigatoria: false,
        status: 'RASCUNHO',
        turmaId: testTurmaId,
        instrutorId: testInstrutorId,
        materiais: [
          'https://example.com/arquivo-1.pdf',
          { url: 'https://example.com/arquivo-2.pdf', titulo: 'Apostila Atualizada' },
        ],
      };

      const response = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.aula).toHaveProperty('id');
      expect(response.body.aula.titulo || response.body.aula.nome).toBe(updateData.titulo);
      expect(response.body.aula.descricao).toBe(updateData.descricao);
      expect(response.body.aula.duracaoMinutos).toBe(updateData.duracaoMinutos);
      expect(response.body.aula.obrigatoria).toBe(updateData.obrigatoria);
    });

    it('deve substituir materiais ao atualizar', async () => {
      if (!aulaParaEditarId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      // Primeiro, adicionar materiais iniciais
      await prisma.cursosTurmasAulasMateriais.createMany({
        data: [
          {
            aulaId: aulaParaEditarId,
            titulo: 'Material Antigo 1',
            tipo: 'VIDEOAULA',
            ordem: 1,
            url: 'https://example.com/antigo-1.pdf',
          },
          {
            aulaId: aulaParaEditarId,
            titulo: 'Material Antigo 2',
            tipo: 'APOSTILA',
            ordem: 2,
            url: 'https://example.com/antigo-2.pdf',
          },
        ],
      });

      // Atualizar com novos materiais
      const updateData = {
        titulo: 'Aula com Materiais',
        descricao: 'Descrição',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        materiais: ['https://example.com/novo-1.pdf'],
      };

      const response = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar se materiais antigos foram removidos e novos foram adicionados
      const materiais = await prisma.cursosTurmasAulasMateriais.findMany({
        where: { aulaId: aulaParaEditarId },
      });

      expect(materiais.length).toBe(1);
      expect(materiais[0].url).toBe('https://example.com/novo-1.pdf');
    });

    it('deve validar campos obrigatórios no PUT', async () => {
      if (!aulaParaEditarId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      const updateData = {
        titulo: 'AB', // Muito curto
        descricao: '', // Vazio
        modalidade: 'INVALIDO', // Inválido
        duracaoMinutos: -1, // Inválido
        obrigatoria: true,
      };

      const response = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.issues).toBeDefined();
    });

    it('deve validar regra: cursoId requer turmaId no PUT', async () => {
      if (!aulaParaEditarId || !testCursoId) {
        console.log('⚠️  Pulando teste: aula ou curso não encontrado');
        return;
      }

      const updateData = {
        titulo: 'Aula Atualizada',
        descricao: 'Descrição',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        cursoId: testCursoId,
        // turmaId não informado - deve falhar
      };

      const response = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.issues.turmaId).toBeDefined();
    });

    it('deve forçar status RASCUNHO quando turmaId é null', async () => {
      if (!aulaParaEditarId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      // Tentar atualizar removendo turmaId (não precisa publicar primeiro)
      const updateData = {
        titulo: 'Aula Sem Turma',
        descricao: 'Descrição',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        turmaId: null,
        status: 'PUBLICADA', // Tentar manter publicada
      };

      const response = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Backend deve forçar RASCUNHO quando turmaId é null
      expect(response.body.aula.status).toBe('RASCUNHO');
      expect(response.body.aula.turmaId).toBeNull();
    });

    it('deve atualizar com materiais vazios (remover todos)', async () => {
      if (!aulaParaEditarId) {
        console.log('⚠️  Pulando teste: aula não encontrada');
        return;
      }

      // Adicionar materiais iniciais
      await prisma.cursosTurmasAulasMateriais.createMany({
        data: [
          {
            aulaId: aulaParaEditarId,
            titulo: 'Material 1',
            tipo: 'VIDEOAULA',
            ordem: 1,
            url: 'https://example.com/1.pdf',
          },
        ],
      });

      // Atualizar com array vazio
      const updateData = {
        titulo: 'Aula Sem Materiais',
        descricao: 'Descrição',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        materiais: [],
      };

      const response = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar se materiais foram removidos
      const materiais = await prisma.cursosTurmasAulasMateriais.findMany({
        where: { aulaId: aulaParaEditarId },
      });

      expect(materiais.length).toBe(0);
    });

    it('deve aceitar obrigatoria como string/boolean/number no PUT', async () => {
      if (!aulaParaEditarId || !testTurmaId) {
        console.log('⚠️  Pulando teste: aula ou turma não encontrada');
        return;
      }

      // Não precisa publicar a aula para este teste - apenas atualizar
      // Testar com string "nao"
      const updateData1 = {
        titulo: 'Aula Atualizada',
        descricao: 'Descrição',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: 'nao',
        turmaId: testTurmaId,
      };

      const response1 = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData1)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response1.body.aula.obrigatoria).toBe(false);

      // Testar com boolean true
      const updateData2 = {
        titulo: 'Aula Atualizada',
        descricao: 'Descrição',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        turmaId: testTurmaId,
      };

      const response2 = await request(app)
        .put(`/api/v1/cursos/aulas/${aulaParaEditarId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData2)
        .expect(200);

      expect(response2.body.success).toBe(true);
      expect(response2.body.aula.obrigatoria).toBe(true);
    });
  });
});
