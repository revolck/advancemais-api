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
import {
  CursosMetodos,
  CursosTurnos,
  CursoStatus,
  CursosFrequenciaStatus,
  CursosModelosRecuperacao,
} from '@prisma/client';

describe('API - Cursos Integração Completa (Turmas, Aulas, Provas, Frequência, Estágios, Recuperações)', () => {
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
  const testFrequenciaIds: string[] = [];
  const testRecuperacaoIds: string[] = [];

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
    if (testRecuperacaoIds.length > 0) {
      await prisma.cursosTurmasRecuperacoes.deleteMany({
        where: { id: { in: testRecuperacaoIds } },
      });
    }
    if (testFrequenciaIds.length > 0) {
      await prisma.cursosFrequenciaAlunos.deleteMany({
        where: { id: { in: testFrequenciaIds } },
      });
    }
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

  describe('1. Setup - Criação de Curso Base', () => {
    it('deve criar um curso como ADMIN', async () => {
      const timestamp = Date.now().toString().slice(-6);
      const cursoData = {
        nome: `Curso Test Integração Completa ${timestamp}`,
        descricao: 'Descrição do curso de teste completo para integração',
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

  describe('2. Aulas Templates - Criação e Listagem', () => {
    it('deve criar uma aula template (sem turma)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const aulaData = {
        titulo: 'Aula Template 1',
        descricao: 'Aula template de teste completo para validação',
        cursoId: testCursoId,
        modalidade: 'ONLINE',
        youtubeUrl: 'https://www.youtube.com/watch?v=test123',
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

    it('deve criar uma segunda aula template', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const aulaData = {
        titulo: 'Aula Template 2',
        descricao: 'Segunda aula template de teste',
        cursoId: testCursoId,
        modalidade: 'ONLINE',
        youtubeUrl: 'https://www.youtube.com/watch?v=test456',
        obrigatoria: false,
        duracaoMinutos: 90,
      };

      const response = await request(app)
        .post('/api/v1/cursos/aulas')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(aulaData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
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
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      const templates = response.body.data.filter((a: any) => a.turmaId === null);
      expect(templates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Avaliações Templates - Criação (PROVA e ATIVIDADE)', () => {
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
        recuperacaoFinal: false,
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
        recuperacaoFinal: false,
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

    it('deve criar uma prova template de recuperação final (recuperacaoFinal: true)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      const avaliacaoData = {
        cursoId: testCursoId,
        tipo: 'PROVA',
        titulo: 'Prova Recuperação Final',
        descricao: 'Prova de recuperação final única para todos os alunos',
        etiqueta: 'REC',
        peso: 10.0,
        valePonto: true,
        ativo: true,
        recuperacaoFinal: true,
      };

      const response = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(avaliacaoData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('avaliacao');
      expect(response.body.avaliacao).toHaveProperty('recuperacaoFinal', true);

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
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);

      const templates = response.body.data.filter((a: any) => a.turmaId === null);
      expect(templates.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('4. Validação TURMA_PREREQUISITOS_NAO_ATENDIDOS', () => {
    it('deve retornar erro ao tentar criar turma sem templates mínimos', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      // Criar um curso temporário sem templates
      const timestamp = Date.now().toString().slice(-6);
      const cursoSemTemplates = await prisma.cursos.create({
        data: {
          nome: `Curso Sem Templates ${timestamp}`,
          codigo: `ST${timestamp}`,
          descricao: 'Teste',
          cargaHoraria: 40,
          statusPadrao: 'RASCUNHO',
          atualizadoEm: new Date(),
        },
      });

      // Estrutura válida (schema exige min 1 AULA + 1 PROVA/ATIVIDADE)
      // Mas o service detecta que não há templates no banco (ensureTemplatesExistForTurmaCreate)
      const fakeTemplateId1 = randomUUID();
      const fakeTemplateId2 = randomUUID();

      const dataInicio = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const dataFim = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const dataInscricaoInicio = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const dataInscricaoFim = new Date(dataInicio.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 dia depois de dataInicio

      const turmaData = {
        nome: 'Turma Test',
        turno: 'NOITE',
        metodo: 'LIVE',
        vagasTotais: 30,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        dataInscricaoInicio: dataInscricaoInicio.toISOString(),
        dataInscricaoFim: dataInscricaoFim.toISOString(),
        estrutura: {
          modules: [
            {
              title: 'Módulo 1',
              items: [
                {
                  type: 'AULA',
                  title: 'Aula Test',
                  templateId: fakeTemplateId1,
                  strategy: 'CLONE',
                  ordem: 1,
                },
                {
                  type: 'PROVA',
                  title: 'Prova Test',
                  templateId: fakeTemplateId2,
                  strategy: 'CLONE',
                  ordem: 2,
                },
              ],
            },
          ],
          standaloneItems: [],
        },
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${cursoSemTemplates.id}/turmas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(turmaData);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'TURMA_PREREQUISITOS_NAO_ATENDIDOS');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('templatesAulasCount', 0);
      expect(response.body.details).toHaveProperty('templatesAvaliacoesCount', 0);

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

      const dataInicio = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const dataFim = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const dataInscricaoInicio = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const dataInscricaoFim = new Date(dataInicio.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 dia depois de dataInicio

      const turmaData = {
        nome: 'Turma Completa Test',
        instrutorId: testInstrutor.id,
        turno: 'NOITE',
        metodo: 'LIVE',
        vagasTotais: 30,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        dataInscricaoInicio: dataInscricaoInicio.toISOString(),
        dataInscricaoFim: dataInscricaoFim.toISOString(),
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

      const modulo = response.body.modulos[0];
      expect(modulo).toHaveProperty('itens');
      expect(Array.isArray(modulo.itens)).toBe(true);
      expect(modulo.itens.length).toBeGreaterThan(0);

      for (let i = 1; i < modulo.itens.length; i++) {
        expect(modulo.itens[i].ordem).toBeGreaterThanOrEqual(modulo.itens[i - 1].ordem);
      }

      expect(response.body).toHaveProperty('itens');
      expect(Array.isArray(response.body.itens)).toBe(true);
    });
  });

  describe('6. Prova de Recuperação Final - Criação e Vinculação', () => {
    it('deve criar prova de recuperação final na turma', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      // Buscar template de recuperação
      const templateRecuperacao = testAvaliacaoTemplateIds.find(async (id) => {
        const avaliacao = await prisma.cursosTurmasProvas.findUnique({
          where: { id },
          select: { recuperacaoFinal: true },
        });
        return avaliacao?.recuperacaoFinal === true;
      });

      const provaData = {
        titulo: 'Prova Recuperação Final',
        etiqueta: 'REC',
        descricao: 'Prova de recuperação final única para todos os alunos',
        peso: 10.0,
        valePonto: true,
        ativo: true,
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(provaData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('titulo', provaData.titulo);
    });

    it('deve listar provas da turma incluindo recuperação', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/provas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('7. Inscrições', () => {
    it('deve inscrever aluno na turma', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/inscricoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ alunoId: testAluno.id })
        .expect(201);

      expect(response.body).toHaveProperty('id');

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
  });

  describe('8. Frequência - Criação, Listagem e Filtros', () => {
    let testAulaId: string | null = null;

    beforeAll(async () => {
      if (testTurmaId) {
        const aula = await prisma.cursosTurmasAulas.findFirst({
          where: { turmaId: testTurmaId },
        });
        if (aula) {
          testAulaId = aula.id;
        }
      }
    });

    it('deve criar registro de frequência', async () => {
      if (!testCursoId || !testTurmaId || testInscricaoIds.length === 0) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const frequenciaData = {
        inscricaoId: testInscricaoIds[0],
        aulaId: testAulaId,
        status: 'PRESENTE',
        dataReferencia: new Date().toISOString(),
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/frequencias`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(frequenciaData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'PRESENTE');
      testFrequenciaIds.push(response.body.id);
    });

    it('deve criar frequência com status AUSENTE e justificativa', async () => {
      if (!testCursoId || !testTurmaId || testInscricaoIds.length === 0) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const frequenciaData = {
        inscricaoId: testInscricaoIds[0],
        status: 'JUSTIFICADO',
        justificativa: 'Atestado médico',
        dataReferencia: new Date().toISOString(),
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/frequencias`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(frequenciaData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'JUSTIFICADO');
      expect(response.body).toHaveProperty('justificativa', 'Atestado médico');
      testFrequenciaIds.push(response.body.id);
    });

    it('deve listar frequências da turma', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 7);
      const dataFim = new Date();
      dataFim.setDate(dataFim.getDate() + 7);

      const response = await request(app)
        .get(
          `/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/frequencias?dataInicio=${dataInicio.toISOString()}&dataFim=${dataFim.toISOString()}&aulaId=${testAulaId || ''}&status=PRESENTE`,
        )
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('deve filtrar frequências por inscrição', async () => {
      if (!testCursoId || !testTurmaId || testInscricaoIds.length === 0) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 7);
      const dataFim = new Date();
      dataFim.setDate(dataFim.getDate() + 7);

      const response = await request(app)
        .get(
          `/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/frequencias?inscricaoId=${testInscricaoIds[0]}&dataInicio=${dataInicio.toISOString()}&dataFim=${dataFim.toISOString()}&aulaId=${testAulaId || ''}&status=PRESENTE`,
        )
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('9. Notas - Listagem Consolidada e Lançamento Manual', () => {
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

    it('deve criar lançamento manual de nota por alunoId', async () => {
      if (!testCursoId || !testTurmaId || testInscricaoIds.length === 0) {
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

  describe('10. Estágios - Listagem e Filtros', () => {
    it('deve listar estágios (vazio inicialmente)', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      // Verificar se testCursoId é UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(testCursoId)) {
        throw new Error(`testCursoId não é um UUID válido: ${testCursoId}`);
      }

      const response = await request(app)
        .get(`/api/v1/cursos/estagios?cursoId=${testCursoId}&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`);

      // Se retornar 400, logar o erro para debug
      if (response.status !== 200) {
        console.log('Erro na listagem de estágios:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('deve filtrar estágios por status', async () => {
      if (!testCursoId) {
        throw new Error('testCursoId não foi criado');
      }

      // Verificar se testCursoId é UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(testCursoId)) {
        throw new Error(`testCursoId não é um UUID válido: ${testCursoId}`);
      }

      const response = await request(app)
        .get(`/api/v1/cursos/estagios?cursoId=${testCursoId}&status=PENDENTE&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${testAdmin.token}`);

      // Se retornar 400, logar o erro para debug
      if (response.status !== 200) {
        console.log('Erro ao filtrar estágios por status:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
    });

    it('deve filtrar estágios por turmaId', async () => {
      if (!testCursoId || !testTurmaId) {
        throw new Error('Pré-requisitos não atendidos');
      }

      // Verificar se testCursoId e testTurmaId são UUIDs válidos
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(testCursoId)) {
        throw new Error(`testCursoId não é um UUID válido: ${testCursoId}`);
      }
      if (!uuidRegex.test(testTurmaId)) {
        throw new Error(`testTurmaId não é um UUID válido: ${testTurmaId}`);
      }

      const response = await request(app)
        .get(
          `/api/v1/cursos/estagios?cursoId=${testCursoId}&turmaId=${testTurmaId}&page=1&pageSize=10`,
        )
        .set('Authorization', `Bearer ${testAdmin.token}`);

      // Se retornar 400, logar o erro para debug
      if (response.status !== 200) {
        console.log(
          'Erro ao filtrar estágios por turmaId:',
          JSON.stringify(response.body, null, 2),
        );
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
    });
  });

  describe('11. Recuperações - Registrar e Calcular Notas', () => {
    it('deve registrar recuperação para aluno', async () => {
      if (!testCursoId || !testTurmaId || testInscricaoIds.length === 0) {
        throw new Error('Pré-requisitos não atendidos');
      }

      // Buscar prova da turma (pode ser a de recuperação se criada)
      const provas = await prisma.cursosTurmasProvas.findMany({
        where: { turmaId: testTurmaId },
        take: 1,
      });

      const recuperacaoData = {
        inscricaoId: testInscricaoIds[0],
        provaId: provas.length > 0 ? provas[0].id : null,
        notaRecuperacao: 7.5,
        modeloAplicado: 'PROVA_FINAL_UNICA' as CursosModelosRecuperacao,
        observacoes: 'Recuperação aplicada',
      };

      const response = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/recuperacoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(recuperacaoData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('inscricaoId', testInscricaoIds[0]);
      testRecuperacaoIds.push(response.body.id);
    });

    it('deve calcular notas da inscrição com recuperação', async () => {
      if (!testInscricaoIds.length) {
        throw new Error('Pré-requisitos não atendidos');
      }

      const response = await request(app)
        .get(`/api/v1/cursos/inscricoes/${testInscricaoIds[0]}/notas`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('inscricao');
      expect(response.body).toHaveProperty('provas');
      expect(response.body).toHaveProperty('recuperacao');
      expect(response.body).toHaveProperty('resultadoFinal');
      expect(response.body.resultadoFinal).toHaveProperty('media');
      expect(response.body.resultadoFinal).toHaveProperty('status');
    });
  });

  describe('12. Validações e Edge Cases', () => {
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
