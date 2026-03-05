import { randomUUID } from 'crypto';

import { CursoStatus, Prisma, Roles } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';

import { prisma } from '@/config/prisma';

import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(120000);

describe('API - Exclusão lógica de cursos', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let instrutor: TestUser;

  let cursoSemTurmasId: string;
  let cursoSemTurmasCodigo: string;
  let cursoComTurmaConcluidaId: string;
  let turmaConcluidaId: string;
  let cursoComTurmaAndamentoId: string;
  let turmaAndamentoId: string;

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    instrutor = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-delete-curso-${randomUUID()}@test.com`,
      nomeCompleto: 'Instrutor Delete Curso',
    });
    testUsers.push(admin, instrutor);

    const suffix = Date.now().toString().slice(-6);

    const cursoSemTurmas = await prisma.cursos.create({
      data: {
        codigo: `DEL0${suffix}`,
        nome: `Curso Delete Sem Turmas ${suffix}`,
        descricao: 'Curso para validar exclusão sem turmas',
        cargaHoraria: 40,
        valor: new Prisma.Decimal(0),
        gratuito: true,
      },
    });
    cursoSemTurmasId = cursoSemTurmas.id;
    cursoSemTurmasCodigo = cursoSemTurmas.codigo;

    const cursoConcluido = await prisma.cursos.create({
      data: {
        codigo: `DEL1${suffix}`,
        nome: `Curso Delete Com Turma Concluída ${suffix}`,
        descricao: 'Curso com turma concluída',
        cargaHoraria: 50,
        valor: new Prisma.Decimal(0),
        gratuito: true,
      },
    });
    cursoComTurmaConcluidaId = cursoConcluido.id;

    const turmaConcluida = await prisma.cursosTurmas.create({
      data: {
        cursoId: cursoComTurmaConcluidaId,
        codigo: `TDC${suffix}`,
        nome: `Turma Concluída ${suffix}`,
        status: CursoStatus.CONCLUIDO,
        vagasTotais: 20,
        vagasDisponiveis: 20,
      },
    });
    turmaConcluidaId = turmaConcluida.id;

    const cursoAndamento = await prisma.cursos.create({
      data: {
        codigo: `DEL2${suffix}`,
        nome: `Curso Delete Com Turma Em Andamento ${suffix}`,
        descricao: 'Curso com turma em andamento',
        cargaHoraria: 60,
        valor: new Prisma.Decimal(0),
        gratuito: true,
      },
    });
    cursoComTurmaAndamentoId = cursoAndamento.id;

    const turmaAndamento = await prisma.cursosTurmas.create({
      data: {
        cursoId: cursoComTurmaAndamentoId,
        codigo: `TDA${suffix}`,
        nome: `Turma Em Andamento ${suffix}`,
        status: CursoStatus.EM_ANDAMENTO,
        vagasTotais: 20,
        vagasDisponiveis: 20,
      },
    });
    turmaAndamentoId = turmaAndamento.id;
  });

  afterAll(async () => {
    if (turmaConcluidaId || turmaAndamentoId) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: { in: [turmaConcluidaId, turmaAndamentoId].filter(Boolean) } },
      });
    }

    await prisma.cursos.deleteMany({
      where: {
        id: {
          in: [cursoSemTurmasId, cursoComTurmaConcluidaId, cursoComTurmaAndamentoId].filter(
            Boolean,
          ),
        },
      },
    });

    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve excluir logicamente curso sem turmas vinculadas', async () => {
    const response = await request(app)
      .delete(`/api/v1/cursos/${cursoSemTurmasId}/exclusao-definitiva`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.id).toBe(cursoSemTurmasId);
    expect(response.body.data?.excluidoEm).toBeTruthy();
    expect(response.body.data?.excluidoPorId).toBe(admin.id);

    const cursoNoBanco = await prisma.cursos.findUnique({
      where: { id: cursoSemTurmasId },
      select: { deletedAt: true, deletedById: true },
    });
    expect(cursoNoBanco?.deletedAt).toBeTruthy();
    expect(cursoNoBanco?.deletedById).toBe(admin.id);

    const detalhe = await request(app)
      .get(`/api/v1/cursos/${cursoSemTurmasId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(detalhe.status).toBe(404);
    expect(detalhe.body.code).toBe('CURSO_NOT_FOUND');

    const list = await request(app)
      .get('/api/v1/cursos')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 100, search: cursoSemTurmasCodigo });

    expect(list.status).toBe(200);
    const item = (list.body?.data ?? []).find((curso: any) => curso.id === cursoSemTurmasId);
    expect(item).toBeUndefined();
  });

  it('deve bloquear exclusão de curso com turma concluída', async () => {
    const response = await request(app)
      .delete(`/api/v1/cursos/${cursoComTurmaConcluidaId}/exclusao-definitiva`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: turmaConcluidaId,
          status: CursoStatus.CONCLUIDO,
        }),
      ]),
    );
  });

  it('deve bloquear exclusão de curso com turma em andamento', async () => {
    const response = await request(app)
      .delete(`/api/v1/cursos/${cursoComTurmaAndamentoId}/exclusao-definitiva`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: turmaAndamentoId,
          status: CursoStatus.EM_ANDAMENTO,
        }),
      ]),
    );
  });

  it('deve retornar 403 para perfil sem permissão', async () => {
    const response = await request(app)
      .delete(`/api/v1/cursos/${cursoComTurmaConcluidaId}/exclusao-definitiva`)
      .set('Authorization', `Bearer ${instrutor.token}`);

    expect(response.status).toBe(403);
  });
});
