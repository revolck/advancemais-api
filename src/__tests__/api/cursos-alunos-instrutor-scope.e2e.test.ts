import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { Roles } from '@prisma/client';
import request from 'supertest';

import { prisma } from '@/config/prisma';

import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Cursos Alunos escopados para INSTRUTOR', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let instrutorEscopo: TestUser;
  let instrutorSemVinculo: TestUser;
  let alunoMultiEscopo: TestUser;
  let alunoTurmaEscopo: TestUser;
  let alunoForaEscopo: TestUser;

  let cursoTurmaEscopoId: string;
  let cursoAulaEscopoId: string;
  let cursoForaEscopoId: string;
  let turmaTurmaEscopoId: string;
  let turmaAulaEscopoId: string;
  let turmaForaEscopoId: string;
  let inscricaoTurmaEscopoId: string;
  let inscricaoAulaEscopoId: string;
  let inscricaoForaEscopoId: string;

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const buildCodigo = (prefix: string) =>
    `${prefix}${randomUUID().replace(/-/g, '').slice(0, 8)}`.toUpperCase();

  beforeAll(async () => {
    app = await getTestApp();

    instrutorEscopo = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-alunos-${suffix}@test.com`,
      nomeCompleto: `Instrutor Alunos ${suffix}`,
    });
    instrutorSemVinculo = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-sem-alunos-${suffix}@test.com`,
      nomeCompleto: `Instrutor Sem Vínculo ${suffix}`,
    });
    alunoMultiEscopo = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-multi-${suffix}@test.com`,
      nomeCompleto: `Aluno Multi Escopo ${suffix}`,
    });
    alunoTurmaEscopo = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-turma-${suffix}@test.com`,
      nomeCompleto: `Aluno Turma Escopo ${suffix}`,
    });
    alunoForaEscopo = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-fora-${suffix}@test.com`,
      nomeCompleto: `Aluno Fora Escopo ${suffix}`,
    });
    testUsers.push(
      instrutorEscopo,
      instrutorSemVinculo,
      alunoMultiEscopo,
      alunoTurmaEscopo,
      alunoForaEscopo,
    );

    const [cursoTurmaEscopo, cursoAulaEscopo, cursoForaEscopo] = await Promise.all([
      prisma.cursos.create({
        data: {
          id: randomUUID(),
          codigo: buildCodigo('CAE'),
          nome: `Curso Turma Escopo ${suffix}`,
          descricao: 'Curso com turma diretamente vinculada ao instrutor',
          cargaHoraria: 40,
          statusPadrao: 'PUBLICADO',
        },
      }),
      prisma.cursos.create({
        data: {
          id: randomUUID(),
          codigo: buildCodigo('CAA'),
          nome: `Curso Aula Escopo ${suffix}`,
          descricao: 'Curso com aula diretamente vinculada ao instrutor',
          cargaHoraria: 40,
          statusPadrao: 'PUBLICADO',
        },
      }),
      prisma.cursos.create({
        data: {
          id: randomUUID(),
          codigo: buildCodigo('CAF'),
          nome: `Curso Fora Escopo ${suffix}`,
          descricao: 'Curso fora do escopo do instrutor',
          cargaHoraria: 40,
          statusPadrao: 'PUBLICADO',
        },
      }),
    ]);

    cursoTurmaEscopoId = cursoTurmaEscopo.id;
    cursoAulaEscopoId = cursoAulaEscopo.id;
    cursoForaEscopoId = cursoForaEscopo.id;

    const [turmaTurmaEscopo, turmaAulaEscopo, turmaForaEscopo] = await Promise.all([
      prisma.cursosTurmas.create({
        data: {
          id: randomUUID(),
          cursoId: cursoTurmaEscopoId,
          codigo: buildCodigo('TTE'),
          nome: `Turma Escopo ${suffix}`,
          status: 'PUBLICADO',
          instrutorId: instrutorEscopo.id,
          vagasTotais: 30,
          vagasDisponiveis: 28,
          vagasIlimitadas: false,
        },
      }),
      prisma.cursosTurmas.create({
        data: {
          id: randomUUID(),
          cursoId: cursoAulaEscopoId,
          codigo: buildCodigo('TAE'),
          nome: `Turma Aula Escopo ${suffix}`,
          status: 'PUBLICADO',
          vagasTotais: 30,
          vagasDisponiveis: 28,
          vagasIlimitadas: false,
        },
      }),
      prisma.cursosTurmas.create({
        data: {
          id: randomUUID(),
          cursoId: cursoForaEscopoId,
          codigo: buildCodigo('TFE'),
          nome: `Turma Fora Escopo ${suffix}`,
          status: 'PUBLICADO',
          vagasTotais: 30,
          vagasDisponiveis: 28,
          vagasIlimitadas: false,
        },
      }),
    ]);

    turmaTurmaEscopoId = turmaTurmaEscopo.id;
    turmaAulaEscopoId = turmaAulaEscopo.id;
    turmaForaEscopoId = turmaForaEscopo.id;

    await prisma.cursosTurmasAulas.create({
      data: {
        id: randomUUID(),
        cursoId: cursoAulaEscopoId,
        turmaId: turmaAulaEscopoId,
        codigo: buildCodigo('AUL'),
        nome: `Aula Escopo ${suffix}`,
        descricao: 'Aula vinculada diretamente ao instrutor',
        modalidade: 'ONLINE',
        duracaoMinutos: 60,
        obrigatoria: true,
        ordem: 1,
        status: 'PUBLICADA',
        instrutorId: instrutorEscopo.id,
      },
    });

    const [inscricaoTurmaEscopo, inscricaoAulaEscopo, inscricaoForaEscopo] = await Promise.all([
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId: turmaTurmaEscopoId,
          alunoId: alunoMultiEscopo.id,
          codigo: buildCodigo('ITE'),
          status: 'INSCRITO',
          statusPagamento: 'APROVADO',
          criadoEm: new Date('2026-01-10T10:00:00.000Z'),
        },
      }),
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId: turmaAulaEscopoId,
          alunoId: alunoMultiEscopo.id,
          codigo: buildCodigo('IAE'),
          status: 'EM_ANDAMENTO',
          statusPagamento: 'APROVADO',
          criadoEm: new Date('2026-02-10T10:00:00.000Z'),
        },
      }),
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId: turmaForaEscopoId,
          alunoId: alunoMultiEscopo.id,
          codigo: buildCodigo('IFE'),
          status: 'EM_ANDAMENTO',
          statusPagamento: 'APROVADO',
          criadoEm: new Date('2026-03-10T10:00:00.000Z'),
        },
      }),
    ]);

    inscricaoTurmaEscopoId = inscricaoTurmaEscopo.id;
    inscricaoAulaEscopoId = inscricaoAulaEscopo.id;
    inscricaoForaEscopoId = inscricaoForaEscopo.id;

    await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId: turmaTurmaEscopoId,
        alunoId: alunoTurmaEscopo.id,
        codigo: buildCodigo('ITS'),
        status: 'EM_ANDAMENTO',
        statusPagamento: 'APROVADO',
      },
    });

    await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId: turmaForaEscopoId,
        alunoId: alunoForaEscopo.id,
        codigo: buildCodigo('IFS'),
        status: 'EM_ANDAMENTO',
        statusPagamento: 'APROVADO',
      },
    });
  });

  afterAll(async () => {
    await prisma.cursosTurmasInscricoes.deleteMany({
      where: {
        turmaId: {
          in: [turmaTurmaEscopoId, turmaAulaEscopoId, turmaForaEscopoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasAulas.deleteMany({
      where: {
        turmaId: {
          in: [turmaAulaEscopoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmas.deleteMany({
      where: {
        id: {
          in: [turmaTurmaEscopoId, turmaAulaEscopoId, turmaForaEscopoId].filter(Boolean),
        },
      },
    });
    await prisma.cursos.deleteMany({
      where: {
        id: {
          in: [cursoTurmaEscopoId, cursoAulaEscopoId, cursoForaEscopoId].filter(Boolean),
        },
      },
    });

    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  it('lista apenas alunos dentro do escopo do instrutor e calcula ultimoCurso dentro do proprio escopo', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/alunos')
      .set('Authorization', `Bearer ${instrutorEscopo.token}`)
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });

    const alunosIds = response.body.data.map((item: any) => item.id);
    expect(alunosIds).toContain(alunoMultiEscopo.id);
    expect(alunosIds).toContain(alunoTurmaEscopo.id);
    expect(alunosIds).not.toContain(alunoForaEscopo.id);

    const alunoMultiPayload = response.body.data.find(
      (item: any) => item.id === alunoMultiEscopo.id,
    );
    expect(alunoMultiPayload).toEqual(
      expect.objectContaining({
        id: alunoMultiEscopo.id,
        ultimoCurso: expect.objectContaining({
          inscricaoId: inscricaoAulaEscopoId,
          statusInscricao: 'EM_ANDAMENTO',
          turma: expect.objectContaining({
            id: turmaAulaEscopoId,
          }),
          curso: expect.objectContaining({
            id: cursoAulaEscopoId,
          }),
        }),
      }),
    );
    expect(alunoMultiPayload.ultimoCurso.inscricaoId).not.toBe(inscricaoForaEscopoId);
  });

  it('retorna detalhe apenas com inscricoes em escopo e bloqueia aluno fora do escopo do instrutor', async () => {
    const detailResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${alunoMultiEscopo.id}`)
      .set('Authorization', `Bearer ${instrutorEscopo.token}`)
      .expect(200);

    expect(detailResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: alunoMultiEscopo.id,
          totalInscricoes: 2,
          estatisticas: {
            cursosAtivos: 2,
            cursosConcluidos: 0,
            cursosCancelados: 0,
          },
        }),
      }),
    );

    const inscricaoIds = detailResponse.body.data.inscricoes.map((item: any) => item.id);
    expect(inscricaoIds).toContain(inscricaoTurmaEscopoId);
    expect(inscricaoIds).toContain(inscricaoAulaEscopoId);
    expect(inscricaoIds).not.toContain(inscricaoForaEscopoId);

    const forbiddenResponse = await request(app)
      .get(`/api/v1/cursos/alunos/${alunoForaEscopo.id}`)
      .set('Authorization', `Bearer ${instrutorEscopo.token}`)
      .expect(403);

    expect(forbiddenResponse.body).toEqual({
      success: false,
      code: 'FORBIDDEN',
      message: 'Você não possui acesso a este aluno.',
    });
  });

  it('retorna lista vazia para instrutor sem vinculo ativo', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/alunos')
      .set('Authorization', `Bearer ${instrutorSemVinculo.token}`)
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });
});
