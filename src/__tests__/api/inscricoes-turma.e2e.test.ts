/**
 * E2E - Inscrições da turma (aba de inscrições)
 * Conforme FRONTEND_INSCRICOES_TURMA_DIAGNOSTICO.md
 *
 * Testa:
 * 1. POST inscrição (enroll)
 * 2. GET /api/v1/cursos/:cursoId/inscricoes?turmaId=X - campos statusPagamento, aluno.avatarUrl, progresso, cpf
 * 3. GET /api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes - lista básica
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

describe('API - Inscrições da Turma (E2E)', () => {
  jest.setTimeout(30000);
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testAluno: TestUser;
  let testCursoId: string | null = null;
  let testTurmaId: string | null = null;
  let testAulaId: string | null = null;
  let testAvaliacaoId: string | null = null;
  let testInscricaoId: string | null = null;

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testAluno = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
    });
    testUsers.push(testAdmin, testAluno);

    const agora = Date.now();
    const umDia = 24 * 60 * 60 * 1000;

    const curso = await prisma.cursos.create({
      data: {
        id: randomUUID(),
        nome: `Curso Inscrições E2E ${Date.now()}`,
        codigo: `CIE${Date.now().toString().slice(-6)}`,
        descricao: 'Curso para teste E2E de inscrições',
        cargaHoraria: 20,
        statusPadrao: 'RASCUNHO',
      },
    });
    testCursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        codigo: `TIE${Date.now().toString().slice(-8)}`,
        cursoId: testCursoId,
        nome: 'Turma Inscrições E2E',
        status: 'RASCUNHO',
        vagasTotais: 30,
        vagasDisponiveis: 30,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(agora - 7 * umDia),
        dataInscricaoFim: new Date(agora + 15 * umDia),
        dataInicio: new Date(agora + 20 * umDia),
        dataFim: new Date(agora + 50 * umDia),
      },
    });
    testTurmaId = turma.id;

    const aula = await prisma.cursosTurmasAulas.create({
      data: {
        id: randomUUID(),
        codigo: `AIE${Date.now().toString().slice(-8)}`,
        turmaId: testTurmaId,
        cursoId: testCursoId,
        nome: 'Aula E2E Inscrições',
        descricao: 'Aula para teste',
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
        titulo: 'Avaliação E2E',
        etiqueta: 'P1',
        descricao: 'Avaliação para teste',
        tipo: 'PROVA',
        peso: 10,
        ordem: 1,
        status: 'RASCUNHO',
      },
    });
    testAvaliacaoId = avaliacao.id;

    await prisma.cursosTurmas.update({
      where: { id: testTurmaId },
      data: { status: 'PUBLICADO' },
    });
  });

  afterAll(async () => {
    if (testInscricaoId) {
      await prisma.cursosTurmasInscricoes.deleteMany({ where: { id: testInscricaoId } });
    }
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

  describe('1. POST - Inscrição (enroll)', () => {
    it('deve inscrever aluno na turma via POST /inscricoes', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .post(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/inscricoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({ alunoId: testAluno.id })
        .expect(201);

      expect(res.body).toBeDefined();
      const turmaRes = res.body.turma ?? res.body;
      expect(turmaRes).toBeDefined();
      expect(turmaRes.id ?? res.body.id).toBe(testTurmaId);

      const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
        where: { turmaId: testTurmaId, alunoId: testAluno.id },
      });
      expect(inscricao).toBeTruthy();
      if (inscricao) testInscricaoId = inscricao.id;
    });
  });

  describe('2. GET /cursos/:cursoId/inscricoes?turmaId=X', () => {
    it('deve retornar inscrições com statusPagamento, aluno.avatarUrl e cpf (default sem progresso)', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/inscricoes?turmaId=${testTurmaId}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.find((i: any) => i.aluno?.id === testAluno.id);
      expect(item).toBeDefined();

      expect(item).toHaveProperty('statusInscricao');
      expect(item).toHaveProperty('statusPagamento');
      expect(item).toHaveProperty('criadoEm');
      expect(item).toHaveProperty('progresso', null);

      expect(item).toHaveProperty('aluno');
      expect(item.aluno).toHaveProperty('id', testAluno.id);
      expect(item.aluno).toHaveProperty('nomeCompleto');
      expect(item.aluno).toHaveProperty('email');
      expect(item.aluno).toHaveProperty('cpf');
      expect(item.aluno).toHaveProperty('avatarUrl');

      expect(item).toHaveProperty('turma');
      expect(item.turma).toHaveProperty('id', testTurmaId);
      expect(item.turma).toHaveProperty('nome');

      expect(item).toHaveProperty('curso');
    });

    it('deve retornar progresso null quando includeProgress=false', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(
          `/api/v1/cursos/${testCursoId}/inscricoes?turmaId=${testTurmaId}&page=1&pageSize=20&includeProgress=false`,
        )
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.find((i: any) => i.aluno?.id === testAluno.id);
      expect(item).toBeDefined();
      expect(item).toHaveProperty('progresso', null);
    });

    it('deve retornar progresso numérico quando includeProgress=true', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(
          `/api/v1/cursos/${testCursoId}/inscricoes?turmaId=${testTurmaId}&page=1&pageSize=20&includeProgress=true`,
        )
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.find((i: any) => i.aluno?.id === testAluno.id);
      expect(item).toBeDefined();
      expect(typeof item.progresso).toBe('number');
      expect(item.progresso).toBeGreaterThanOrEqual(0);
      expect(item.progresso).toBeLessThanOrEqual(100);
    });
  });

  describe('3. GET /cursos/:cursoId/turmas/:turmaId/inscricoes', () => {
    it('deve retornar lista de inscrições da turma', async () => {
      if (!testCursoId || !testTurmaId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/turmas/${testTurmaId}/inscricoes`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. GET inscricoes por curso (sem turmaId)', () => {
    it('deve retornar inscrições do curso quando não filtra por turma', async () => {
      if (!testCursoId) throw new Error('Setup incompleto');

      const res = await request(app)
        .get(`/api/v1/cursos/${testCursoId}/inscricoes?page=1&pageSize=20`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      const doCurso = res.body.data.filter((i: any) => i.turma?.id === testTurmaId);
      expect(doCurso.length).toBeGreaterThanOrEqual(1);
    });
  });
});
