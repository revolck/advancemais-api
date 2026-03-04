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

jest.setTimeout(90000);

describe('API - Estágios (programas + frequência)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let aluno: TestUser;
  let cursoId: string;
  let turmaId: string;
  let inscricaoId: string;
  let estagioId: string;
  let estagioAlunoId: string;
  let frequenciaId: string;
  let grupoId: string;

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    aluno = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-estagio-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno Estagio E2E',
    });
    testUsers.push(admin, aluno);

    const suffix = Date.now().toString().slice(-6);
    const curso = await prisma.cursos.create({
      data: {
        codigo: `EST${suffix}`,
        nome: `Curso Estágio ${suffix}`,
        cargaHoraria: 40,
        valor: new Prisma.Decimal(0),
        gratuito: true,
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `T-EST-${suffix}`,
        nome: `Turma Estágio ${suffix}`,
        vagasTotais: 30,
        vagasDisponiveis: 30,
      },
    });
    turmaId = turma.id;

    const inscricao = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId,
        alunoId: aluno.id,
        codigo: `INSC-EST-${suffix}`,
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoId = inscricao.id;
  });

  afterAll(async () => {
    if (frequenciaId) {
      await prisma.cursosEstagiosProgramasFrequenciasHistorico.deleteMany({
        where: { frequenciaId },
      });
      await prisma.cursosEstagiosProgramasFrequencias.deleteMany({
        where: { id: frequenciaId },
      });
    }

    if (estagioId) {
      await prisma.cursosEstagiosProgramasAlunos.deleteMany({ where: { estagioId } });
      await prisma.cursosEstagiosProgramasGrupos.deleteMany({ where: { estagioId } });
      await prisma.cursosEstagiosProgramas.deleteMany({ where: { id: estagioId } });
    }

    if (inscricaoId) {
      await prisma.cursosTurmasInscricoes.deleteMany({ where: { id: inscricaoId } });
    }

    if (turmaId) {
      await prisma.cursosTurmas.deleteMany({ where: { id: turmaId } });
    }

    if (cursoId) {
      await prisma.cursos.deleteMany({ where: { id: cursoId } });
    }

    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve cadastrar estágio e listar na visão geral', async () => {
    const createResponse = await request(app)
      .post('/api/v1/cursos/estagios')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        titulo: 'Estágio Supervisionado E2E',
        descricao: 'Fluxo de teste automatizado',
        cursoId,
        turmaId,
        obrigatorio: true,
        modoAlocacao: 'ESPECIFICOS',
        usarGrupos: true,
        periodo: {
          periodicidade: 'INTERVALO',
          dataInicio: '2026-02-21',
          dataFim: '2026-02-21',
          incluirSabados: true,
        },
        grupos: [
          {
            nome: 'Grupo Manhã',
            turno: 'MANHA',
            capacidade: 20,
            horaInicio: '08:00',
            horaFim: '12:00',
          },
        ],
      });

    expect(createResponse.status).toBe(201);
    estagioId = createResponse.body.data.id;
    grupoId = createResponse.body.data.grupos?.[0]?.id;
    expect(createResponse.body.data.titulo).toBe('Estágio Supervisionado E2E');
    expect(createResponse.body.data.grupos).toHaveLength(1);

    const listResponse = await request(app)
      .get('/api/v1/cursos/estagios')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ cursoId, turmaIds: turmaId, page: 1, pageSize: 10 });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items.some((item: any) => item.id === estagioId)).toBe(true);
  });

  it('deve vincular aluno, lançar frequência e concluir estágio', async () => {
    const vincularResponse = await request(app)
      .post(`/api/v1/cursos/estagios/${estagioId}/alunos/vincular`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        modo: 'ESPECIFICOS',
        inscricaoIds: [inscricaoId],
        grupoIdDefault: grupoId,
        tipoParticipacao: 'INICIAL',
      });

    expect(vincularResponse.status).toBe(200);
    expect(vincularResponse.body.data.vinculados).toBeGreaterThanOrEqual(1);

    const detalheResponse = await request(app)
      .get(`/api/v1/cursos/estagios/${estagioId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(detalheResponse.status).toBe(200);
    const alunoVinculado = detalheResponse.body.data.alunos.find(
      (item: any) => item.inscricaoId === inscricaoId,
    );
    expect(alunoVinculado).toBeTruthy();
    estagioAlunoId = alunoVinculado.id;

    const semMotivoResponse = await request(app)
      .post(`/api/v1/cursos/estagios/${estagioId}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        estagioAlunoId,
        dataReferencia: '2026-02-21',
        status: 'AUSENTE',
      });

    expect(semMotivoResponse.status).toBe(400);
    expect(semMotivoResponse.body.code).toBe('JUSTIFICATIVA_OBRIGATORIA');

    const frequenciaResponse = await request(app)
      .post(`/api/v1/cursos/estagios/${estagioId}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        estagioAlunoId,
        dataReferencia: '2026-02-21',
        status: 'PRESENTE',
      });

    expect(frequenciaResponse.status).toBe(200);
    frequenciaId = frequenciaResponse.body.data.id;
    expect(frequenciaResponse.body.data.status).toBe('PRESENTE');

    const periodoResponse = await request(app)
      .get(`/api/v1/cursos/estagios/${estagioId}/frequencias/periodo`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        dataInicio: '2026-02-21',
        dataFim: '2026-02-21',
        page: 1,
        pageSize: 10,
      });

    expect(periodoResponse.status).toBe(200);
    expect(periodoResponse.body.data.gruposPorData).toHaveLength(1);
    expect(periodoResponse.body.data.gruposPorData[0].data).toBe('2026-02-21');
    expect(periodoResponse.body.data.gruposPorData[0].items.length).toBeGreaterThan(0);
    expect(periodoResponse.body.data.gruposPorData[0].items[0].status).toBe('PRESENTE');

    const historicoResponse = await request(app)
      .get(`/api/v1/cursos/estagios/${estagioId}/frequencias/${frequenciaId}/historico`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(historicoResponse.status).toBe(200);
    expect(historicoResponse.body.data.length).toBeGreaterThan(0);

    const concluirResponse = await request(app)
      .post(`/api/v1/cursos/estagios/${estagioId}/alunos/${estagioAlunoId}/concluir`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});

    expect(concluirResponse.status).toBe(200);
    expect(concluirResponse.body.data.status).toBe('CONCLUIDO');
    expect(concluirResponse.body.data.elegivelCertificado).toBe(true);
    expect(concluirResponse.body.data.validadeAte).toBeTruthy();
  });
});
