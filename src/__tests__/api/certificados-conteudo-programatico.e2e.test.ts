import { randomUUID } from 'crypto';

import { CursoStatus, CursosStatusPadrao, Prisma, Roles } from '@prisma/client';
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

describe('API - Certificados e conteúdo programático do curso', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let aluno1: TestUser;
  let aluno2: TestUser;

  let cursoId: string;
  let cursoCodigo: string;
  let turmaId: string;
  let inscricaoId1: string;
  let inscricaoId2: string;
  const certificadoIds: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    aluno1 = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-cert-1-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno Certificado Um',
    });
    aluno2 = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-cert-2-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno Certificado Dois',
    });
    testUsers.push(admin, aluno1, aluno2);

    const suffix = Date.now().toString().slice(-6);
    cursoCodigo = `CRT${suffix}`;
    const curso = await prisma.cursos.create({
      data: {
        codigo: cursoCodigo,
        nome: `Curso Certificado ${suffix}`,
        descricao: 'Curso para validar emissão de certificados',
        cargaHoraria: 48,
        valor: new Prisma.Decimal(0),
        gratuito: true,
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `T-CRT-${suffix}`,
        nome: `Turma Certificado ${suffix}`,
        vagasTotais: 30,
        vagasDisponiveis: 30,
      },
    });
    turmaId = turma.id;

    const inscricao1 = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId,
        alunoId: aluno1.id,
        codigo: `INSC-C1-${suffix}`,
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoId1 = inscricao1.id;

    const inscricao2 = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId,
        alunoId: aluno2.id,
        codigo: `INSC-C2-${suffix}`,
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoId2 = inscricao2.id;
  });

  afterAll(async () => {
    if (certificadoIds.length > 0) {
      await prisma.cursosCertificadosEmitidos.deleteMany({
        where: { id: { in: certificadoIds } },
      });
    }

    if (inscricaoId1 || inscricaoId2) {
      await prisma.cursosTurmasInscricoes.deleteMany({
        where: { id: { in: [inscricaoId1, inscricaoId2].filter(Boolean) } },
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

  it('deve emitir 2 certificados e listar ambos na rota global', async () => {
    const body1 = {
      cursoId,
      turmaId,
      alunoId: aluno1.id,
      modeloId: 'advance-plus-v1',
      conteudoProgramatico:
        '<h2>Módulo 1</h2><p><strong>Introdução</strong> ao curso</p><p><em>Boas práticas</em></p>',
    };
    const body2 = {
      cursoId,
      turmaId,
      alunoId: aluno2.id,
      modeloId: 'advance-plus-v1',
      conteudoProgramatico:
        '<h2>Módulo 2</h2><ul><li>Tópico A</li><li>Tópico B</li></ul><p><u>Encerramento</u></p>',
    };

    const emit1 = await request(app)
      .post('/api/v1/cursos/certificados')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body1);
    expect(emit1.status).toBe(201);
    expect(emit1.body.success).toBe(true);
    expect(emit1.body.data?.id).toBeTruthy();
    certificadoIds.push(emit1.body.data.id);

    const emit2 = await request(app)
      .post('/api/v1/cursos/certificados')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body2);
    expect(emit2.status).toBe(201);
    expect(emit2.body.success).toBe(true);
    expect(emit2.body.data?.id).toBeTruthy();
    certificadoIds.push(emit2.body.data.id);

    const list = await request(app)
      .get('/api/v1/cursos/certificados')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ cursoId, turmaId, page: 1, pageSize: 20, sortBy: 'emitidoEm', sortDir: 'desc' });

    expect(list.status).toBe(200);
    const ids = (list.body?.data?.items ?? []).map((item: any) => item.id);
    expect(ids).toEqual(expect.arrayContaining(certificadoIds));

    const preview = await request(app)
      .get(`/api/v1/cursos/certificados/${certificadoIds[0]}/preview`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(preview.status).toBe(200);
    expect(preview.headers['content-type']).toContain('text/html');
    expect(preview.text).toContain('cert-page-verso');
    expect(preview.text).toContain('Conteúdo Programático');
    expect(preview.text).toContain('Módulo 1');
  });

  it('deve retornar e persistir conteudoProgramatico em GET/PUT/GET de cursos', async () => {
    const conteudoProgramatico =
      '<h2>Ementa</h2><p><strong>Parte prática</strong> e <em>teórica</em>.</p>';

    const update = await request(app)
      .put(`/api/v1/cursos/${cursoId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ conteudoProgramatico });

    expect(update.status).toBe(200);
    expect(update.body.id).toBe(cursoId);
    expect(update.body.conteudoProgramatico).toBe(conteudoProgramatico);

    const detalhe = await request(app)
      .get(`/api/v1/cursos/${cursoId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.id).toBe(cursoId);
    expect(detalhe.body.conteudoProgramatico).toBe(conteudoProgramatico);

    const list = await request(app)
      .get('/api/v1/cursos')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 20, search: cursoCodigo });
    expect(list.status).toBe(200);
    const curso = (list.body?.data ?? []).find((item: any) => item.id === cursoId);
    expect(curso).toBeTruthy();
    expect(curso.conteudoProgramatico).toBe(conteudoProgramatico);

    // Validar consistência no endpoint público do curso
    await prisma.cursos.update({
      where: { id: cursoId },
      data: { statusPadrao: CursosStatusPadrao.PUBLICADO },
    });
    await prisma.cursosTurmas.update({
      where: { id: turmaId },
      data: {
        status: CursoStatus.PUBLICADO,
        dataInscricaoFim: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    const publico = await request(app).get(`/api/v1/cursos/publico/cursos/${cursoId}`);
    expect(publico.status).toBe(200);
    expect(publico.body.id).toBe(cursoId);
    expect(publico.body.conteudoProgramatico).toBe(conteudoProgramatico);
  });

  it('deve manter consistência para certificados por inscrição (2 gerados)', async () => {
    const response1 = await request(app)
      .get(`/api/v1/cursos/inscricoes/${inscricaoId1}/certificados`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(response1.status).toBe(200);
    expect(response1.body?.certificados?.length).toBeGreaterThanOrEqual(1);

    const response2 = await request(app)
      .get(`/api/v1/cursos/inscricoes/${inscricaoId2}/certificados`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(response2.status).toBe(200);
    expect(response2.body?.certificados?.length).toBeGreaterThanOrEqual(1);
  });
});
