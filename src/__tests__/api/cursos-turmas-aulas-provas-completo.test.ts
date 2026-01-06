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
import { CursosMetodos, CursosTurnos, CursoStatus } from '@prisma/client';

describe('API - Cursos, Turmas, Aulas, Provas, Notas e Estágios (Completo)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testModerator: TestUser;
  let testAluno: TestUser;
  let testInstrutor: TestUser;

  // IDs para cleanup
  let testCursoId: string | null = null;
  let testTurmaId: string | null = null;
  const testAulaTemplateIds: string[] = [];
  const testAvaliacaoTemplateIds: string[] = [];
  const testInscricaoIds: string[] = [];
  const testNotaIds: string[] = [];
  const testEstagioIds: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testModerator = await createTestModerator();
    testInstrutor = await createTestUser({
      role: 'INSTRUTOR',
      emailVerificado: true,
    });
    testAluno = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
    });
    testUsers.push(testAdmin, testModerator, testInstrutor, testAluno);
  });

  afterAll(async () => {
    // Limpar dados de teste (ordem importa devido às foreign keys)
    if (testNotaIds.length > 0) {
      await prisma.cursosNotas.deleteMany({
        where: { id: { in: testNotaIds } },
      });
    }
    if (testEstagioIds.length > 0) {
      await prisma.cursosEstagios.deleteMany({
        where: { id: { in: testEstagioIds } },
      });
    }
    if (testInscricaoIds.length > 0) {
      await prisma.cursosTurmasInscricoes.deleteMany({
        where: { id: { in: testInscricaoIds } },
      });
    }
    if (testTurmaId) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: testTurmaId },
      });
    }
    if (testAulaTemplateIds.length > 0) {
      await prisma.cursosTurmasAulas.deleteMany({
        where: { id: { in: testAulaTemplateIds } },
      });
    }
    if (testAvaliacaoTemplateIds.length > 0) {
      await prisma.cursosTurmasProvas.deleteMany({
        where: { id: { in: testAvaliacaoTemplateIds } },
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

  describe('1. Criação de Curso', () => {
    it('deve criar um curso como ADMIN', async () => {
      const timestamp = Date.now().toString().slice(-6);
      const cursoData = {
        nome: `Curso Test Completo ${timestamp}`,
        descricao: 'Descrição do curso de teste completo',
        cargaHoraria: 40,
        statusPadrao: 'RASCUNHO',
      };

      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(cursoData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('nome', cursoData.nome);
      expect(response.body).toHaveProperty('codigo');

      testCursoId = response.body.id;
      expect(testCursoId).toBeTruthy();
    });
  });

  describe('2. Criação de Aulas Templates (semTurma=true)', () => {
    it('deve criar uma aula template (sem turma)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const aulaData = {
        titulo: 'Aula Template 1',
        descricao: 'Aula template de teste completo para validação',
        cursoId: testCursoId,
        modalidade: 'ONLINE',
        obrigatoria: true,
        duracaoMinutos: 60,
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('aula');
      expect(response.body.aula).toHaveProperty('id');
      expect(response.body.aula.titulo || response.body.aula.nome).toBe(aulaData.titulo);
      expect(response.body.aula.cursoId).toBe(testCursoId);
      expect(response.body.aula.turmaId).toBeNull();

      testAulaTemplateIds.push(response.body.aula.id);
    });

    it('deve listar aulas templates do curso (semTurma=true)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/aulas?cursoId=${testCursoId}&semTurma=true&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);

      // Verificar que são templates (turmaId null)
      const templates = response.body.items.filter((a: any) => a.turmaId === null);
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('3. Criação de Avaliações Templates (Provas/Atividades)', () => {
    it('deve criar uma avaliação template do tipo PROVA', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const avaliacaoData = {
        cursoId: testCursoId,
        tipo: 'PROVA',
        titulo: 'Prova Template 1',
        descricao: 'Prova template de teste',
        etiqueta: 'P1',
        peso: 10.0,
        valePonto: true,
        ativo: true,
      };

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(avaliacaoData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('avaliacao');
      expect(response.body.avaliacao).toHaveProperty('id');
      expect(response.body.avaliacao.titulo).toBe(avaliacaoData.titulo);
      expect(response.body.avaliacao.tipo).toBe('PROVA');
      expect(response.body.avaliacao.cursoId).toBe(testCursoId);
      expect(response.body.avaliacao.turmaId).toBeNull();

      testAvaliacaoTemplateIds.push(response.body.avaliacao.id);
    });

    it('deve criar uma avaliação template do tipo ATIVIDADE', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const avaliacaoData = {
        cursoId: testCursoId,
        tipo: 'ATIVIDADE',
        titulo: 'Atividade Template 1',
        descricao: 'Atividade template de teste',
        etiqueta: 'AT1',
        peso: 5.0,
        valePonto: true,
        ativo: true,
      };

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(avaliacaoData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('avaliacao');
      expect(response.body.avaliacao.tipo).toBe('ATIVIDADE');
      expect(response.body.avaliacao.turmaId).toBeNull();

      testAvaliacaoTemplateIds.push(response.body.avaliacao.id);
    });

    it('deve listar avaliações templates do curso (semTurma=true)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/avaliacoes?cursoId=${testCursoId}&semTurma=true&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);

      // Verificar que são templates (turmaId null)
      const templates = response.body.items.filter((a: any) => a.turmaId === null);
      expect(templates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('4. Validação TURMA_PREREQUISITOS_NAO_ATENDIDOS', () => {
    it('deve retornar erro ao tentar criar turma sem templates mínimos', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      // Criar um curso temporário sem templates
      const cursoSemTemplates = await prisma.cursos.create({
        data: {
          nome: `Curso Sem Templates ${Date.now()}`,
          codigo: `ST${Date.now()}`,
          descricao: 'Teste',
          cargaHoraria: 40,
          statusPadrao: 'RASCUNHO',
          atualizadoEm: new Date(),
        },
      });

      const turmaData = {
        nome: 'Turma Test',
        turno: 'NOITE',
        metodo: 'LIVE',
        vagasTotais: 30,
        dataInicio: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dataFim: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        dataInscricaoInicio: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        dataInscricaoFim: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [],
            },
          ],
          standaloneItems: [],
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${cursoSemTemplates.id}/turmas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(turmaData)
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'TURMA_PREREQUISITOS_NAO_ATENDIDOS');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('templatesAulasCount', 0);
      expect(response.body.details).toHaveProperty('templatesAvaliacoesCount', 0);

      // Limpar curso temporário
      await prisma.cursos.delete({ where: { id: cursoSemTemplates.id } });
    });
  });

  describe('5. Criação de Turma com Estrutura (Builder) + Clonagem', () => {
    it('deve criar turma com estrutura completa (módulos + standalone items)', async () => {
      if (
        !testCursoId ||
        testAulaTemplateIds.length === 0 ||
        testAvaliacaoTemplateIds.length === 0
      ) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const turmaData = {
        nome: 'Turma Completa Test',
        instrutorId: testInstrutor.id,
        turno: 'NOITE',
        metodo: 'LIVE',
        vagasTotais: 30,
        dataInicio: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dataFim: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        dataInscricaoInicio: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        dataInscricaoFim: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [
                {
                  type: 'AULA',
                  title: 'Aula Clonada 1',
                  templateId: testAulaTemplateIds[0],
                  strategy: 'CLONE',
                  ordem: 1,
                },
                {
                  type: 'PROVA',
                  title: 'Prova Clonada',
                  templateId: testAvaliacaoTemplateIds[0],
                  strategy: 'CLONE',
                  ordem: 2,
                },
              ],
            },
          ],
          standaloneItems: [
            {
              type: 'ATIVIDADE',
              title: 'Atividade Standalone',
              templateId: testAvaliacaoTemplateIds[1],
              strategy: 'CLONE',
              ordem: 1,
            },
          ],
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(turmaData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('nome', turmaData.nome);
      expect(response.body).toHaveProperty('codigo');
      expect(response.body).toHaveProperty('mapping');
      expect(Array.isArray(response.body.mapping)).toBe(true);
      expect(response.body.mapping.length).toBeGreaterThan(0);

      // Verificar mapping (templates -> instâncias clonadas)
      const mapping = response.body.mapping;
      expect(
        mapping.some((m: any) => m.tipo === 'AULA' && m.templateId === testAulaTemplateIds[0]),
      ).toBe(true);
      expect(
        mapping.some(
          (m: any) => m.tipo === 'PROVA' && m.templateId === testAvaliacaoTemplateIds[0],
        ),
      ).toBe(true);
      expect(
        mapping.some(
          (m: any) => m.tipo === 'ATIVIDADE' && m.templateId === testAvaliacaoTemplateIds[1],
        ),
      ).toBe(true);

      // Verificar que as instâncias têm IDs diferentes dos templates
      mapping.forEach((m: any) => {
        expect(m.instanceId).not.toBe(m.templateId);
        expect(m.strategy).toBe('CLONE');
      });

      testTurmaId = response.body.id;
    });

    it('deve retornar estrutura da turma com itens ordenados (módulos + standalone)', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Turma não foi criada');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('modulos');
      expect(Array.isArray(response.body.modulos)).toBe(true);
      expect(response.body.modulos.length).toBeGreaterThan(0);

      // Verificar que módulos têm itens ordenados
      const modulo = response.body.modulos[0];
      expect(modulo).toHaveProperty('itens');
      expect(Array.isArray(modulo.itens)).toBe(true);
      expect(modulo.itens.length).toBeGreaterThan(0);

      // Verificar ordenação
      for (let i = 1; i < modulo.itens.length; i++) {
        expect(modulo.itens[i].ordem).toBeGreaterThanOrEqual(modulo.itens[i - 1].ordem);
      }

      // Verificar itens standalone
      expect(response.body).toHaveProperty('itens');
      expect(Array.isArray(response.body.itens)).toBe(true);
    });
  });

  describe('6. Notas - Listagem Consolidada', () => {
    it('deve listar notas consolidadas do curso (vazio inicialmente)', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/notas?turmaIds=${testTurmaId}&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
  });

  describe('7. Notas - Lançamento Manual', () => {
    it('deve inscrever aluno na turma primeiro', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/inscricoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ alunoId: testAluno.id })
        .expect(201);

      expect(response.body).toHaveProperty('id');

      // Encontrar inscrição criada
      const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
        where: {
          turmaId: testTurmaId,
          alunoId: testAluno.id,
        },
      });
      if (inscricao) {
        testInscricaoIds.push(inscricao.id);
      }
    });

    it('deve criar lançamento manual de nota por alunoId', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const notaData = {
        alunoId: testAluno.id,
        nota: 1.5,
        motivo: 'Bônus de participação',
        origem: {
          tipo: 'OUTRO',
          titulo: 'Trabalho extra',
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/notas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(notaData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('tipo', 'BONUS');
      expect(response.body).toHaveProperty('titulo', notaData.motivo);
      expect(response.body).toHaveProperty('nota');

      if (response.body.id) {
        testNotaIds.push(response.body.id);
      }
    });

    it('deve listar notas consolidadas após lançamento manual', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/notas?turmaIds=${testTurmaId}&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');

      const items = response.body.data.items;
      if (items.length > 0) {
        const alunoItem = items.find((item: any) => item.alunoId === testAluno.id);
        if (alunoItem) {
          expect(alunoItem).toHaveProperty('ajustesManuais');
          expect(alunoItem).toHaveProperty('notaFinalOriginal');
          expect(alunoItem).toHaveProperty('history');
        }
      }
    });

    it('deve remover lançamentos manuais do aluno', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .delete(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/notas?alunoId=${testAluno.id}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('8. Estágios - Listagem', () => {
    it('deve listar estágios (vazio inicialmente)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/estagios?cursoId=${testCursoId}&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('pageSize', 10);
    });

    it('deve filtrar estágios por status', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/estagios?cursoId=${testCursoId}&status=PENDENTE&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
    });

    it('deve filtrar estágios por turmaId', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .get(
          `/api/v1/cursos/estagios?cursoId=${testCursoId}&turmaId=${testTurmaId}&page=1&pageSize=10`,
        )
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
    });
  });

  describe('9. Validações e Edge Cases', () => {
    it('deve validar estrutura da turma (mínimo 1 AULA e 1 PROVA/ATIVIDADE)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const turmaDataInvalida = {
        nome: 'Turma Inválida',
        vagasTotais: 30,
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [
                {
                  type: 'AULA',
                  title: 'Aula única',
                  templateId: testAulaTemplateIds[0],
                  strategy: 'CLONE',
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(turmaDataInvalida)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 404 para curso inexistente ao criar turma', async () => {
      const fakeCursoId = randomUUID();
      const turmaData = {
        nome: 'Turma Test',
        vagasTotais: 30,
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [
                {
                  type: 'AULA',
                  title: 'Aula',
                  templateId: testAulaTemplateIds[0],
                  strategy: 'CLONE',
                },
                {
                  type: 'PROVA',
                  title: 'Prova',
                  templateId: testAvaliacaoTemplateIds[0],
                  strategy: 'CLONE',
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${fakeCursoId}/turmas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(turmaData)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'CURSO_NOT_FOUND');
    });

    it('deve retornar erro 403 para usuário sem permissão ao criar turma', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const turmaData = {
        nome: 'Turma Test',
        vagasTotais: 30,
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [
                {
                  type: 'AULA',
                  title: 'Aula',
                  templateId: testAulaTemplateIds[0],
                  strategy: 'CLONE',
                },
                {
                  type: 'PROVA',
                  title: 'Prova',
                  templateId: testAvaliacaoTemplateIds[0],
                  strategy: 'CLONE',
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas`)
        .set('Authorization', `Bearer ${testAluno.token}`)
        .send(turmaData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
