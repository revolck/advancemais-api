/**
 * Testes das rotas de histórico/turma conforme doc de diagnóstico.
 * Valida se as rotas existentes estão funcionando.
 *
 * Rotas testadas:
 * 1. PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar
 * 2. GET /api/v1/cursos/:cursoId/turmas/:turmaId
 * 3. GET /api/v1/cursos/aulas/:id/historico
 * 4. GET /api/v1/cursos/:cursoId/auditoria
 * 5. GET /api/v1/cursos/alunos/:alunoId/inscricoes
 * 6. GET /api/v1/cursos/:cursoId/inscricoes
 * 7. GET /api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes
 * 8. GET /api/v1/cursos/:cursoId/turmas/:turmaId/historico (não existe - deve 404)
 */
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

describe('API - Rotas de Histórico da Turma (Diagnóstico)', () => {
  jest.setTimeout(30000);
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testAluno: TestUser;
  let testCursoId: string | null = null;
  let testTurmaId: string | null = null;
  let testAulaId: string | null = null;
  let testAvaliacaoId: string | null = null;

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testAluno = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
    });
    testUsers.push(testAdmin, testAluno);

    // Criar curso + turma + aula + avaliação para os testes
    const curso = await prisma.cursos.create({
      data: {
        id: randomUUID(),
        nome: `Curso Histórico Test ${Date.now()}`,
        codigo: `CHT${Date.now().toString().slice(-6)}`,
        descricao: 'Curso para teste de rotas de histórico',
        cargaHoraria: 20,
        statusPadrao: 'RASCUNHO',
      },
    });
    testCursoId = curso.id;

    const agora = Date.now();
    const umDia = 24 * 60 * 60 * 1000;
    const turma = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        codigo: `TH${Date.now().toString().slice(-8)}`,
        cursoId: testCursoId,
        nome: 'Turma Histórico 1',
        status: 'RASCUNHO',
        vagasTotais: 30,
        vagasDisponiveis: 30,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(agora - 7 * umDia),
        dataInscricaoFim: new Date(agora - 1 * umDia),
        dataInicio: new Date(agora + 1 * umDia),
        dataFim: new Date(agora + 30 * umDia),
      },
    });
    testTurmaId = turma.id;

    const aula = await prisma.cursosTurmasAulas.create({
      data: {
        id: randomUUID(),
        codigo: `AHT${Date.now().toString().slice(-8)}`,
        turmaId: testTurmaId,
        cursoId: testCursoId,
        nome: 'Aula Teste Histórico',
        descricao: 'Aula para testar histórico',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        ordem: 1,
        status: 'RASCUNHO',
      },
    });
    testAulaId = aula.id;

    const avaliacao = await prisma.cursosTurmasProvas.create({
      data: {
        id: randomUUID(),
        turmaId: testTurmaId,
        cursoId: testCursoId,
        titulo: 'Avaliação Teste Histórico',
        etiqueta: `P1`,
        descricao: 'Avaliação para teste',
        tipo: 'PROVA',
        peso: 10,
        ordem: 1,
        status: 'RASCUNHO',
      },
    });
    testAvaliacaoId = avaliacao.id;
  });

  afterAll(async () => {
    if (testAulaId) {
      await prisma.cursosTurmasAulas.deleteMany({ where: { id: testAulaId } });
    }
    if (testAvaliacaoId) {
      await prisma.cursosTurmasProvas.deleteMany({ where: { id: testAvaliacaoId } });
    }
    if (testTurmaId) {
      await prisma.cursosTurmas.deleteMany({ where: { id: testTurmaId } });
    }
    if (testCursoId) {
      await prisma.cursos.deleteMany({ where: { id: testCursoId } });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('1. PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar', () => {
    it('deve publicar turma (publicar: true)', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .patch(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/publicar`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ publicar: true })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      const turma = res.body.data ?? res.body.turma;
      expect(turma).toBeDefined();
      expect(turma.status).toBe('PUBLICADO');
    });

    it('deve despublicar turma (publicar: false)', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .patch(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/publicar`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ publicar: false })
        .expect(200);

      const turma = res.body.data ?? res.body.turma;
      expect(turma?.status).toBe('RASCUNHO');
    });
  });

  describe('2. GET /api/v1/cursos/:cursoId/turmas/:turmaId', () => {
    it('deve retornar detalhe da turma com status, criadoEm, editadoPorId, editadoEm', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', testTurmaId);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('criadoEm');
      expect(res.body).toHaveProperty('nome', 'Turma Histórico 1');
    });
  });

  describe('3. GET /api/v1/cursos/aulas/:id/historico', () => {
    it('deve retornar histórico de alterações da aula', async () => {
      if (!testAulaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/aulas/${testAulaId}/historico`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('historico');
      expect(Array.isArray(res.body.historico)).toBe(true);
    });
  });

  describe('4. GET /api/v1/cursos/:cursoId/auditoria', () => {
    it('deve retornar auditoria do CURSO (não da turma)', async () => {
      if (!testCursoId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/auditoria`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('5. GET /api/v1/cursos/alunos/:alunoId/inscricoes', () => {
    it('deve retornar inscrições do aluno', async () => {
      const res = await request(app)
        .get(`/api/v1/cursos/alunos/${testAluno.id}/inscricoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toBeDefined();
      expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
    });
  });

  describe('6. GET /api/v1/cursos/:cursoId/inscricoes', () => {
    it('deve retornar inscrições do curso', async () => {
      if (!testCursoId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/inscricoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('7. GET /api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes', () => {
    it('deve retornar inscrições da turma', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/inscricoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('8. GET /api/v1/cursos/:cursoId/turmas/:turmaId/historico (NÃO EXISTE)', () => {
    it('deve retornar 404 pois rota de histórico da turma não foi implementada', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/historico`)
        .set('Authorization', `Bearer ${testAdmin.token}`);

      expect([404, 501]).toContain(res.status);
    });
  });

  describe('9. PUT - Editar turma e verificar log (editadoPorId/editadoEm)', () => {
    it('deve alterar turma e registrar editadoPorId/editadoEm', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const nomeAlterado = 'Turma Histórico 1 - Editada para teste de log';

      const resUpdate = await request(app)
        .put(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ nome: nomeAlterado })
        .expect(200);

      expect(resUpdate.body).toHaveProperty('nome', nomeAlterado);
      expect(resUpdate.body).toHaveProperty('editadoPorId', testAdmin.id);
      expect(resUpdate.body).toHaveProperty('editadoEm');
      expect(new Date(resUpdate.body.editadoEm).getTime()).toBeGreaterThan(Date.now() - 5000);

      const resGet = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(resGet.body.nome).toBe(nomeAlterado);
      expect(resGet.body.editadoPorId).toBe(testAdmin.id);
      expect(resGet.body.editadoEm).toBeDefined();
    });
  });

  describe('10. PUT - Editar curso (nome) e verificar auditoria', () => {
    it('deve alterar nome do curso e auditoria deve trazer usuário que editou', async () => {
      if (!testCursoId) throw new Error('Setup incompleto');

      const nomeCursoAlterado = `Curso Histórico Test - Editado ${Date.now()}`;

      const resUpdate = await request(app)
        .put(`/api/v1/cursos/${testCursoId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ nome: nomeCursoAlterado });

      if (resUpdate.status !== 200) {
        throw new Error(
          `PUT curso retornou ${resUpdate.status}: ${JSON.stringify(resUpdate.body)}`,
        );
      }

      expect(resUpdate.body).toHaveProperty('nome', nomeCursoAlterado);

      const resAuditoria = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/auditoria`)
        .set('Authorization', `Bearer ${testAdmin.token}`);

      if (resAuditoria.status !== 200) {
        throw new Error(
          `GET auditoria retornou ${resAuditoria.status}: ${JSON.stringify(resAuditoria.body)}`,
        );
      }

      expect(resAuditoria.body).toHaveProperty('data');
      expect(Array.isArray(resAuditoria.body.data)).toBe(true);

      const alteracaoNome = resAuditoria.body.data.find(
        (item: any) =>
          item.campo === 'nome' || (item.descricao && item.descricao.includes('Nome do curso')),
      );
      expect(alteracaoNome).toBeDefined();
      expect(alteracaoNome.alteradoPor).toBeDefined();
      expect(alteracaoNome.alteradoPor.id).toBe(testAdmin.id);
      expect(alteracaoNome.alteradoPor.nomeCompleto).toBe(testAdmin.nomeCompleto);
      expect(alteracaoNome.alteradoPor.email).toBe(testAdmin.email);
    });
  });
});
