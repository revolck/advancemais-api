import request from 'supertest';
import type { Express } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';

import { getTestApp } from '../helpers/test-setup';
import { cleanupTestUsers, createTestAdmin, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(45000);

describe('API - Provas - Fallback para templates no GET por turma', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;

  let cursoAId: string;
  let cursoBId: string;
  let turmaAId: string;
  let turmaBId: string;

  let templateGlobalId: string;
  let templateCursoAId: string;
  let templateCursoBId: string;
  let provaTurmaBId: string;

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testUsers.push(testAdmin);

    const suffix = Date.now().toString().slice(-6);

    const [cursoA, cursoB] = await Promise.all([
      prisma.cursos.create({
        data: {
          codigo: `PFA${suffix}`,
          nome: `Curso A ${suffix}`,
          cargaHoraria: 40,
          valor: new Prisma.Decimal(100),
          gratuito: false,
        },
      }),
      prisma.cursos.create({
        data: {
          codigo: `PFB${suffix}`,
          nome: `Curso B ${suffix}`,
          cargaHoraria: 40,
          valor: new Prisma.Decimal(100),
          gratuito: false,
        },
      }),
    ]);

    cursoAId = cursoA.id;
    cursoBId = cursoB.id;

    const [turmaA, turmaB] = await Promise.all([
      prisma.cursosTurmas.create({
        data: {
          cursoId: cursoAId,
          codigo: `TFA${suffix}`,
          nome: `Turma A ${suffix}`,
          vagasTotais: 20,
          vagasDisponiveis: 20,
        },
      }),
      prisma.cursosTurmas.create({
        data: {
          cursoId: cursoBId,
          codigo: `TFB${suffix}`,
          nome: `Turma B ${suffix}`,
          vagasTotais: 20,
          vagasDisponiveis: 20,
        },
      }),
    ]);

    turmaAId = turmaA.id;
    turmaBId = turmaB.id;

    const [templateGlobal, templateCursoA, templateCursoB, provaTurmaB] = await Promise.all([
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId: null,
          turmaId: null,
          titulo: `Template global ${suffix}`,
          etiqueta: `TG-${suffix}`,
          tipo: 'ATIVIDADE',
          peso: new Prisma.Decimal(1),
          ativo: true,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId: cursoAId,
          turmaId: null,
          titulo: `Template curso A ${suffix}`,
          etiqueta: `TA-${suffix}`,
          tipo: 'PROVA',
          peso: new Prisma.Decimal(2),
          ativo: true,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId: cursoBId,
          turmaId: null,
          titulo: `Template curso B ${suffix}`,
          etiqueta: `TB-${suffix}`,
          tipo: 'PROVA',
          peso: new Prisma.Decimal(2),
          ativo: true,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId: cursoBId,
          turmaId: turmaBId,
          titulo: `Prova turma B ${suffix}`,
          etiqueta: `PB-${suffix}`,
          tipo: 'PROVA',
          peso: new Prisma.Decimal(3),
          ativo: true,
        },
      }),
    ]);

    templateGlobalId = templateGlobal.id;
    templateCursoAId = templateCursoA.id;
    templateCursoBId = templateCursoB.id;
    provaTurmaBId = provaTurmaB.id;
  });

  afterAll(async () => {
    await prisma.cursosTurmasProvas.deleteMany({
      where: { id: { in: [templateGlobalId, templateCursoAId, templateCursoBId, provaTurmaBId] } },
    });
    await prisma.cursosTurmas.deleteMany({ where: { id: { in: [turmaAId, turmaBId] } } });
    await prisma.cursos.deleteMany({ where: { id: { in: [cursoAId, cursoBId] } } });

    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  it('deve retornar template global mesmo em rota de turma', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoAId}/turmas/${turmaAId}/provas/${templateGlobalId}`)
      .set('Authorization', `Bearer ${testAdmin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', templateGlobalId);
    expect(response.body).toHaveProperty('turmaId', null);
    expect(response.body).toHaveProperty('cursoId', null);
  });

  it('deve retornar template do mesmo curso em rota de turma', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoAId}/turmas/${turmaAId}/provas/${templateCursoAId}`)
      .set('Authorization', `Bearer ${testAdmin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', templateCursoAId);
    expect(response.body).toHaveProperty('turmaId', null);
    expect(response.body).toHaveProperty('cursoId', cursoAId);
  });

  it('deve manter 404 para template de outro curso', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoAId}/turmas/${turmaAId}/provas/${templateCursoBId}`)
      .set('Authorization', `Bearer ${testAdmin.token}`)
      .expect(404);

    expect(response.body).toHaveProperty('code', 'PROVA_NOT_FOUND');
  });

  it('deve manter 404 para prova de outra turma', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoAId}/turmas/${turmaAId}/provas/${provaTurmaBId}`)
      .set('Authorization', `Bearer ${testAdmin.token}`)
      .expect(404);

    expect(response.body).toHaveProperty('code', 'PROVA_NOT_FOUND');
  });
});
