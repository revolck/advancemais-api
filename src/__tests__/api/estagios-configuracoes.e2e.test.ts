import type { Express } from 'express';
import { Prisma, Roles } from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { prisma } from '@/config/prisma';

import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(120000);

describe('API - Estágios (configurações diversas)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  const estagioIds: string[] = [];
  const inscricoes: { id: string; alunoId: string }[] = [];

  let admin: TestUser;
  let cursoId: string;
  let turmaId: string;

  beforeAll(async () => {
    app = await getTestApp();
    admin = await createTestAdmin();
    testUsers.push(admin);

    for (let index = 0; index < 4; index += 1) {
      const aluno = await createTestUser({
        role: Roles.ALUNO_CANDIDATO,
        email: `aluno-estagio-cfg-${index}-${randomUUID()}@test.com`,
        nomeCompleto: `Aluno Config ${index + 1}`,
      });
      testUsers.push(aluno);
    }

    const suffix = Date.now().toString().slice(-6);
    const curso = await prisma.cursos.create({
      data: {
        codigo: `ECFG${suffix}`,
        nome: `Curso Estágio Config ${suffix}`,
        cargaHoraria: 60,
        valor: new Prisma.Decimal(0),
        gratuito: true,
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `TE${suffix}`,
        nome: `Turma Estágio Config ${suffix}`,
        vagasTotais: 30,
        vagasDisponiveis: 30,
      },
    });
    turmaId = turma.id;

    for (const [index, user] of testUsers.slice(1).entries()) {
      const inscricao = await prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId,
          alunoId: user.id,
          codigo: `INSC-ECFG-${suffix}-${index + 1}`,
          statusPagamento: 'APROVADO',
        },
        select: { id: true, alunoId: true },
      });
      inscricoes.push(inscricao);
    }
  });

  afterAll(async () => {
    if (estagioIds.length > 0) {
      await prisma.cursosEstagiosProgramasFrequencias.deleteMany({
        where: { estagioId: { in: estagioIds } },
      });
      await prisma.cursosEstagiosProgramasAlunos.deleteMany({
        where: { estagioId: { in: estagioIds } },
      });
      await prisma.cursosEstagiosProgramasGrupos.deleteMany({
        where: { estagioId: { in: estagioIds } },
      });
      await prisma.cursosEstagiosProgramas.deleteMany({
        where: { id: { in: estagioIds } },
      });
    }

    if (inscricoes.length > 0) {
      await prisma.cursosTurmasInscricoes.deleteMany({
        where: { id: { in: inscricoes.map((item) => item.id) } },
      });
    }

    if (turmaId) {
      await prisma.cursosTurmas.deleteMany({ where: { id: turmaId } });
    }

    if (cursoId) {
      await prisma.cursos.deleteMany({ where: { id: cursoId } });
    }

    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve criar estágio TODOS sem grupos', async () => {
    const response = await request(app)
      .post('/api/v1/cursos/estagios')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        titulo: 'Estágio CFG - Todos sem grupos',
        descricao: 'Teste E2E configuração sem grupos',
        cursoId,
        turmaId,
        obrigatorio: true,
        modoAlocacao: 'TODOS',
        usarGrupos: false,
        horarioPadrao: {
          horaInicio: '08:00',
          horaFim: '12:00',
        },
        periodo: {
          periodicidade: 'DIAS_SEMANA',
          diasSemana: ['SEG', 'QUA', 'SEX'],
          dataInicio: '2026-03-02',
          dataFim: '2026-03-13',
          incluirSabados: false,
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBeTruthy();
    expect(response.body.data.usarGrupos).toBe(false);
    expect(response.body.data.grupos).toHaveLength(0);

    estagioIds.push(response.body.data.id);
  });

  it('deve criar estágio TODOS com grupos e distribuir alunos por capacidade', async () => {
    const response = await request(app)
      .post('/api/v1/cursos/estagios')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        titulo: 'Estágio CFG - Todos com grupos',
        descricao: 'Teste E2E com distribuição automática',
        cursoId,
        turmaId,
        obrigatorio: true,
        modoAlocacao: 'TODOS',
        usarGrupos: true,
        periodo: {
          periodicidade: 'INTERVALO',
          dataInicio: '2026-03-16',
          dataFim: '2026-03-16',
          incluirSabados: true,
        },
        grupos: [
          {
            nome: 'Grupo A',
            turno: 'MANHA',
            capacidade: 2,
            horaInicio: '08:00',
            horaFim: '12:00',
          },
          {
            nome: 'Grupo B',
            turno: 'TARDE',
            capacidade: 2,
            horaInicio: '13:00',
            horaFim: '17:00',
          },
        ],
      });

    expect(response.status).toBe(201);
    const estagioId = response.body.data.id;
    estagioIds.push(estagioId);
    expect(response.body.data.grupos).toHaveLength(2);

    const detalhe = await request(app)
      .get(`/api/v1/cursos/estagios/${estagioId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(detalhe.status).toBe(200);
    expect(detalhe.body.data.alunos).toHaveLength(4);
    expect(detalhe.body.data.alunos.every((aluno: any) => Boolean(aluno.grupo?.id))).toBe(true);
  });

  it('deve criar estágio ESPECIFICOS com grupos e vincular alunos por grupo', async () => {
    const create = await request(app)
      .post('/api/v1/cursos/estagios')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        titulo: 'Estágio CFG - Específicos com grupos',
        descricao: 'Teste E2E com vínculo por grupo',
        cursoId,
        turmaId,
        obrigatorio: true,
        modoAlocacao: 'ESPECIFICOS',
        usarGrupos: true,
        periodo: {
          periodicidade: 'INTERVALO',
          dataInicio: '2026-03-20',
          dataFim: '2026-03-20',
          incluirSabados: true,
        },
        grupos: [
          {
            nome: 'Grupo Manhã',
            turno: 'MANHA',
            capacidade: 2,
            horaInicio: '08:00',
            horaFim: '12:00',
          },
          {
            nome: 'Grupo Noite',
            turno: 'NOITE',
            capacidade: 2,
            horaInicio: '18:00',
            horaFim: '22:00',
          },
        ],
      });

    expect(create.status).toBe(201);
    const estagioId = create.body.data.id;
    estagioIds.push(estagioId);

    const grupo1 = create.body.data.grupos[0].id;
    const grupo2 = create.body.data.grupos[1].id;

    const vinculo1 = await request(app)
      .post(`/api/v1/cursos/estagios/${estagioId}/alunos/vincular`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        modo: 'ESPECIFICOS',
        inscricaoIds: [inscricoes[0].id, inscricoes[1].id],
        grupoIdDefault: grupo1,
        tipoParticipacao: 'INICIAL',
      });

    expect(vinculo1.status).toBe(200);
    expect(vinculo1.body.data.vinculados).toBe(2);

    const vinculo2 = await request(app)
      .post(`/api/v1/cursos/estagios/${estagioId}/alunos/vincular`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        modo: 'ESPECIFICOS',
        inscricaoIds: [inscricoes[2].id, inscricoes[3].id],
        grupoIdDefault: grupo2,
        tipoParticipacao: 'INICIAL',
      });

    expect(vinculo2.status).toBe(200);
    expect(vinculo2.body.data.vinculados).toBe(2);

    const detalhe = await request(app)
      .get(`/api/v1/cursos/estagios/${estagioId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(detalhe.status).toBe(200);
    expect(detalhe.body.data.alunos).toHaveLength(4);
  });
});
