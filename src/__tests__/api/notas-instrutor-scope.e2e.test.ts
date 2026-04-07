import type { Express } from 'express';
import { Prisma, Roles } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';

import { prisma } from '@/config/prisma';

import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Notas escopadas para INSTRUTOR', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  const notasCriadasViaApi: string[] = [];

  let instrutorTurma: TestUser;
  let instrutorProva: TestUser;
  let instrutorAula: TestUser;
  let instrutorSemVinculo: TestUser;
  let alunoEscopo: TestUser;
  let alunoForaEscopo: TestUser;

  let cursoId: string;
  let turmaEscopoId: string;
  let turmaForaEscopoId: string;
  let inscricaoEscopoId: string;
  let inscricaoForaEscopoId: string;

  let provaNeutraId: string;
  let provaInstrutorId: string;
  let provaForaEscopoId: string;
  let aulaInstrutorId: string;

  let notaManualNeutraId: string;
  let notaManualProvaInstrutorId: string;
  let notaManualAulaInstrutorId: string;

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);

  beforeAll(async () => {
    app = await getTestApp();

    instrutorTurma = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-turma-notas-${suffix}@test.com`,
      nomeCompleto: `Instrutor Turma Notas ${suffix}`,
    });
    instrutorProva = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-prova-notas-${suffix}@test.com`,
      nomeCompleto: `Instrutor Prova Notas ${suffix}`,
    });
    instrutorAula = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-aula-notas-${suffix}@test.com`,
      nomeCompleto: `Instrutor Aula Notas ${suffix}`,
    });
    instrutorSemVinculo = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-sem-vinculo-notas-${suffix}@test.com`,
      nomeCompleto: `Instrutor Sem Vinculo Notas ${suffix}`,
    });
    alunoEscopo = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-escopo-notas-${suffix}@test.com`,
      nomeCompleto: `Aluno Escopo Notas ${suffix}`,
    });
    alunoForaEscopo = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-fora-notas-${suffix}@test.com`,
      nomeCompleto: `Aluno Fora Notas ${suffix}`,
    });

    testUsers.push(
      instrutorTurma,
      instrutorProva,
      instrutorAula,
      instrutorSemVinculo,
      alunoEscopo,
      alunoForaEscopo,
    );

    const curso = await prisma.cursos.create({
      data: {
        id: randomUUID(),
        codigo: `CNI${suffix}`.toUpperCase(),
        nome: `Curso Notas Instrutor ${suffix}`,
        descricao: 'Curso para validar escopo de notas do instrutor',
        cargaHoraria: 40,
        statusPadrao: 'PUBLICADO',
      },
    });
    cursoId = curso.id;

    const turmaEscopo = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        cursoId,
        codigo: `TNI${suffix}`.toUpperCase(),
        nome: `Turma Escopo Notas ${suffix}`,
        status: 'PUBLICADO',
        instrutorId: instrutorTurma.id,
        vagasTotais: 30,
        vagasDisponiveis: 29,
        vagasIlimitadas: false,
      },
    });
    turmaEscopoId = turmaEscopo.id;

    const turmaForaEscopo = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        cursoId,
        codigo: `TNF${suffix}`.toUpperCase(),
        nome: `Turma Fora Escopo Notas ${suffix}`,
        status: 'PUBLICADO',
        vagasTotais: 30,
        vagasDisponiveis: 29,
        vagasIlimitadas: false,
      },
    });
    turmaForaEscopoId = turmaForaEscopo.id;

    const [inscricaoEscopo, inscricaoForaEscopo] = await Promise.all([
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId: turmaEscopoId,
          alunoId: alunoEscopo.id,
          codigo: `INE${suffix}`.toUpperCase(),
          statusPagamento: 'APROVADO',
        },
      }),
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId: turmaForaEscopoId,
          alunoId: alunoForaEscopo.id,
          codigo: `INF${suffix}`.toUpperCase(),
          statusPagamento: 'APROVADO',
        },
      }),
    ]);
    inscricaoEscopoId = inscricaoEscopo.id;
    inscricaoForaEscopoId = inscricaoForaEscopo.id;

    const [provaNeutra, provaInstrutor, provaForaEscopo, aulaInstrutor] = await Promise.all([
      prisma.cursosTurmasProvas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaEscopoId,
          tipo: 'PROVA',
          titulo: `Prova Neutra ${suffix}`,
          etiqueta: `PN${suffix}`.toUpperCase(),
          peso: new Prisma.Decimal(1),
          ativo: true,
          status: 'PUBLICADA',
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaEscopoId,
          tipo: 'PROVA',
          titulo: `Prova Instrutor ${suffix}`,
          etiqueta: `PI${suffix}`.toUpperCase(),
          peso: new Prisma.Decimal(1),
          ativo: true,
          status: 'PUBLICADA',
          instrutorId: instrutorProva.id,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaForaEscopoId,
          tipo: 'PROVA',
          titulo: `Prova Fora Escopo ${suffix}`,
          etiqueta: `PF${suffix}`.toUpperCase(),
          peso: new Prisma.Decimal(1),
          ativo: true,
          status: 'PUBLICADA',
        },
      }),
      prisma.cursosTurmasAulas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaEscopoId,
          codigo: `ANI${suffix}`.toUpperCase(),
          nome: `Aula Instrutor ${suffix}`,
          descricao: 'Aula diretamente vinculada ao instrutor responsável',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 1,
          status: 'PUBLICADA',
          instrutorId: instrutorAula.id,
        },
      }),
    ]);
    provaNeutraId = provaNeutra.id;
    provaInstrutorId = provaInstrutor.id;
    provaForaEscopoId = provaForaEscopo.id;
    aulaInstrutorId = aulaInstrutor.id;

    await prisma.cursosTurmasProvasEnvios.createMany({
      data: [
        {
          provaId: provaNeutraId,
          inscricaoId: inscricaoEscopoId,
          nota: new Prisma.Decimal(4),
          realizadoEm: new Date('2026-04-01T10:00:00.000Z'),
        },
        {
          provaId: provaInstrutorId,
          inscricaoId: inscricaoEscopoId,
          nota: new Prisma.Decimal(8),
          realizadoEm: new Date('2026-04-02T10:00:00.000Z'),
        },
        {
          provaId: provaForaEscopoId,
          inscricaoId: inscricaoForaEscopoId,
          nota: new Prisma.Decimal(9),
          realizadoEm: new Date('2026-04-03T10:00:00.000Z'),
        },
      ],
    });

    const notaManualNeutra = await prisma.cursosNotas.create({
      data: {
        turmaId: turmaEscopoId,
        inscricaoId: inscricaoEscopoId,
        tipo: 'BONUS',
        provaId: null,
        referenciaExterna: 'OUTRO',
        titulo: 'Bônus de participação geral',
        descricao: 'Origem neutra da turma',
        nota: new Prisma.Decimal(0.3),
        dataReferencia: new Date('2026-04-03T12:00:00.000Z'),
      },
    });
    notaManualNeutraId = notaManualNeutra.id;

    const notaManualProvaInstrutor = await prisma.cursosNotas.create({
      data: {
        turmaId: turmaEscopoId,
        inscricaoId: inscricaoEscopoId,
        tipo: 'BONUS',
        provaId: null,
        referenciaExterna: `PROVA:${provaInstrutorId}`,
        titulo: 'Bônus da prova do instrutor',
        descricao: 'Origem protegida por instrutor dono',
        nota: new Prisma.Decimal(1.5),
        dataReferencia: new Date('2026-04-04T12:00:00.000Z'),
      },
    });
    notaManualProvaInstrutorId = notaManualProvaInstrutor.id;

    const notaManualAulaInstrutor = await prisma.cursosNotas.create({
      data: {
        turmaId: turmaEscopoId,
        inscricaoId: inscricaoEscopoId,
        tipo: 'BONUS',
        provaId: null,
        referenciaExterna: `AULA:${aulaInstrutorId}`,
        titulo: 'Bônus da aula do instrutor',
        descricao: 'Origem protegida pela aula vinculada',
        nota: new Prisma.Decimal(0.5),
        dataReferencia: new Date('2026-04-05T12:00:00.000Z'),
      },
    });
    notaManualAulaInstrutorId = notaManualAulaInstrutor.id;
  });

  afterAll(async () => {
    if (notasCriadasViaApi.length > 0) {
      await prisma.auditoriaLogs.deleteMany({
        where: {
          entidadeId: { in: notasCriadasViaApi },
          acao: {
            in: ['NOTA_MANUAL_ADICIONADA', 'NOTA_MANUAL_ATUALIZADA', 'NOTA_MANUAL_EXCLUIDA'],
          },
        },
      });
    }

    await prisma.cursosNotas.deleteMany({
      where: {
        id: {
          in: [
            notaManualNeutraId,
            notaManualProvaInstrutorId,
            notaManualAulaInstrutorId,
            ...notasCriadasViaApi,
          ].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasProvasEnvios.deleteMany({
      where: {
        provaId: { in: [provaNeutraId, provaInstrutorId, provaForaEscopoId].filter(Boolean) },
      },
    });
    await prisma.cursosTurmasAulas.deleteMany({
      where: { id: aulaInstrutorId },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: { id: { in: [provaNeutraId, provaInstrutorId, provaForaEscopoId].filter(Boolean) } },
    });
    await prisma.cursosTurmasInscricoes.deleteMany({
      where: { id: { in: [inscricaoEscopoId, inscricaoForaEscopoId].filter(Boolean) } },
    });
    await prisma.cursosTurmas.deleteMany({
      where: { id: { in: [turmaEscopoId, turmaForaEscopoId].filter(Boolean) } },
    });
    if (cursoId) {
      await prisma.cursos.deleteMany({ where: { id: cursoId } });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  it('retorna lista vazia para instrutor sem vinculo ativo', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${instrutorSemVinculo.token}`)
      .query({
        cursoId,
        turmaIds: turmaEscopoId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination).toEqual(
      expect.objectContaining({
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      }),
    );
  });

  it('escopa listagem global e por curso conforme o vinculo e o dono da origem', async () => {
    const geralTurmaResponse = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .query({ page: 1, pageSize: 50 })
      .expect(200);

    expect(geralTurmaResponse.body.success).toBe(true);
    expect(geralTurmaResponse.body.data.items).toHaveLength(1);
    expect(geralTurmaResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        cursoId,
        turmaId: turmaEscopoId,
        alunoId: alunoEscopo.id,
        alunoNome: alunoEscopo.nomeCompleto,
        nota: 4.3,
      }),
    );
    expect(geralTurmaResponse.body.data.items[0].origem).toEqual(
      expect.objectContaining({
        tipo: 'OUTRO',
      }),
    );

    const cursoProvaResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${instrutorProva.token}`)
      .query({
        turmaIds: turmaEscopoId,
        page: 1,
        pageSize: 50,
      })
      .expect(200);

    expect(cursoProvaResponse.body.success).toBe(true);
    expect(cursoProvaResponse.body.data.items).toHaveLength(1);
    expect(cursoProvaResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        cursoId,
        turmaId: turmaEscopoId,
        alunoId: alunoEscopo.id,
      }),
    );
    expect(cursoProvaResponse.body.data.items[0].nota).toBeCloseTo(9.5, 5);
    expect(cursoProvaResponse.body.data.items[0].origem).toEqual(
      expect.objectContaining({
        tipo: 'PROVA',
        id: provaInstrutorId,
      }),
    );

    const geralAulaResponse = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${instrutorAula.token}`)
      .query({
        cursoId,
        turmaIds: turmaEscopoId,
        page: 1,
        pageSize: 50,
      })
      .expect(200);

    expect(geralAulaResponse.body.success).toBe(true);
    expect(geralAulaResponse.body.data.items).toHaveLength(1);
    expect(geralAulaResponse.body.data.items[0].nota).toBeCloseTo(0.5, 5);
    expect(geralAulaResponse.body.data.items[0].origem).toEqual(
      expect.objectContaining({
        tipo: 'AULA',
        id: aulaInstrutorId,
      }),
    );
  });

  it('bloqueia instrutor da turma em origem protegida por outro instrutor', async () => {
    const blockedLaunchResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/notas`)
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .send({
        alunoId: alunoEscopo.id,
        nota: 0.2,
        motivo: 'Tentativa fora do escopo',
        origem: { tipo: 'PROVA', id: provaInstrutorId },
      })
      .expect(403);

    expect(blockedLaunchResponse.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
      message: 'Você não possui acesso a esta nota.',
    });

    const blockedHistoricoResponse = await request(app)
      .get(
        `/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/notas/${notaManualProvaInstrutorId}/historico`,
      )
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .expect(403);

    expect(blockedHistoricoResponse.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });

    const blockedClearResponse = await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/notas`)
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .query({ alunoId: alunoEscopo.id })
      .expect(403);

    expect(blockedClearResponse.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });

  it('permite lancar nota apenas dentro do proprio escopo e consultar o historico correspondente', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/notas`)
      .set('Authorization', `Bearer ${instrutorProva.token}`)
      .send({
        alunoId: alunoEscopo.id,
        nota: 0.2,
        motivo: 'Ajuste da prova do instrutor',
        origem: { tipo: 'PROVA', id: provaInstrutorId },
      })
      .expect(201);

    const notaId = createResponse.body.id as string;
    notasCriadasViaApi.push(notaId);

    expect(createResponse.body).toEqual(
      expect.objectContaining({
        id: notaId,
        referenciaExterna: `PROVA:${provaInstrutorId}`,
        titulo: 'Ajuste da prova do instrutor',
      }),
    );

    const historicoResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/notas/${notaId}/historico`)
      .set('Authorization', `Bearer ${instrutorProva.token}`)
      .expect(200);

    expect(historicoResponse.body.success).toBe(true);
    expect(historicoResponse.body.data).toEqual(
      expect.objectContaining({
        notaId,
      }),
    );
    expect(historicoResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        acao: 'NOTA_MANUAL_ADICIONADA',
        ator: expect.objectContaining({
          id: instrutorProva.id,
          nome: instrutorProva.nomeCompleto,
          role: Roles.INSTRUTOR,
          roleLabel: 'Instrutor',
        }),
      }),
    );
  });
});
