import type { Express } from 'express';
import { Roles } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';

import { prisma } from '@/config/prisma';

import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Frequencia escopada para INSTRUTOR', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let instrutorParcial: TestUser;
  let instrutorTurma: TestUser;
  let instrutorSemVinculo: TestUser;
  let aluno: TestUser;

  let cursoId: string;
  let turmaEscopoId: string;
  let turmaForaEscopoId: string;
  let inscricaoId: string;

  let aulaPermitidaId: string;
  let aulaBloqueadaId: string;
  let provaPermitidaId: string;
  let atividadeBloqueadaId: string;

  let frequenciaBloqueadaId: string;

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const courseSearch = `Curso Freq Instrutor ${suffix}`;

  beforeAll(async () => {
    app = await getTestApp();

    instrutorParcial = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-parcial-${suffix}@test.com`,
      nomeCompleto: `Instrutor Parcial ${suffix}`,
    });
    instrutorTurma = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-turma-${suffix}@test.com`,
      nomeCompleto: `Instrutor Turma ${suffix}`,
    });
    instrutorSemVinculo = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-sem-vinculo-${suffix}@test.com`,
      nomeCompleto: `Instrutor Sem Vinculo ${suffix}`,
    });
    aluno = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-freq-instrutor-${suffix}@test.com`,
      nomeCompleto: `Aluno Frequencia ${suffix}`,
    });
    testUsers.push(instrutorParcial, instrutorTurma, instrutorSemVinculo, aluno);

    const curso = await prisma.cursos.create({
      data: {
        id: randomUUID(),
        codigo: `CFI${suffix}`.toUpperCase(),
        nome: courseSearch,
        descricao: 'Curso para validar escopo de frequencia do instrutor',
        cargaHoraria: 40,
        statusPadrao: 'PUBLICADO',
      },
    });
    cursoId = curso.id;

    const turmaEscopo = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        cursoId,
        codigo: `TFE${suffix}`.toUpperCase(),
        nome: `Turma Escopo ${suffix}`,
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
        codigo: `TFF${suffix}`.toUpperCase(),
        nome: `Turma Fora Escopo ${suffix}`,
        status: 'PUBLICADO',
        vagasTotais: 30,
        vagasDisponiveis: 30,
        vagasIlimitadas: false,
      },
    });
    turmaForaEscopoId = turmaForaEscopo.id;

    const [aulaPermitida, aulaBloqueada, provaPermitida, atividadeBloqueada] = await Promise.all([
      prisma.cursosTurmasAulas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaEscopoId,
          codigo: `AUP${suffix}`.toUpperCase(),
          nome: `Aula Permitida ${suffix}`,
          descricao: 'Aula diretamente vinculada ao instrutor',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 1,
          status: 'PUBLICADA',
          instrutorId: instrutorParcial.id,
        },
      }),
      prisma.cursosTurmasAulas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaEscopoId,
          codigo: `AUB${suffix}`.toUpperCase(),
          nome: `Aula Bloqueada ${suffix}`,
          descricao: 'Aula fora do escopo direto do instrutor',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 2,
          status: 'PUBLICADA',
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaEscopoId,
          titulo: `Prova Permitida ${suffix}`,
          etiqueta: `PP${suffix}`.toUpperCase(),
          descricao: 'Prova diretamente vinculada ao instrutor',
          tipo: 'PROVA',
          peso: 10,
          ordem: 1,
          status: 'PUBLICADA',
          ativo: true,
          instrutorId: instrutorParcial.id,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          id: randomUUID(),
          cursoId,
          turmaId: turmaEscopoId,
          titulo: `Atividade Bloqueada ${suffix}`,
          etiqueta: `AB${suffix}`.toUpperCase(),
          descricao: 'Atividade fora do escopo direto do instrutor',
          tipo: 'ATIVIDADE',
          peso: 5,
          ordem: 2,
          status: 'PUBLICADA',
          ativo: true,
        },
      }),
    ]);

    aulaPermitidaId = aulaPermitida.id;
    aulaBloqueadaId = aulaBloqueada.id;
    provaPermitidaId = provaPermitida.id;
    atividadeBloqueadaId = atividadeBloqueada.id;

    const inscricao = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId: turmaEscopoId,
        alunoId: aluno.id,
        codigo: `IFI${suffix}`.toUpperCase(),
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoId = inscricao.id;

    const [, frequenciaBloqueada] = await Promise.all([
      prisma.cursosFrequenciaAlunos.create({
        data: {
          turmaId: turmaEscopoId,
          inscricaoId,
          aulaId: aulaPermitidaId,
          dataReferencia: new Date(),
          status: 'PRESENTE',
        },
      }),
      prisma.cursosFrequenciaAlunos.create({
        data: {
          turmaId: turmaEscopoId,
          inscricaoId,
          aulaId: aulaBloqueadaId,
          dataReferencia: new Date(),
          status: 'AUSENTE',
          justificativa: 'Registro fora do escopo do instrutor parcial',
        },
      }),
    ]);

    frequenciaBloqueadaId = frequenciaBloqueada.id;
  });

  afterAll(async () => {
    await prisma.cursosFrequenciaAlunos.deleteMany({
      where: { turmaId: { in: [turmaEscopoId, turmaForaEscopoId].filter(Boolean) } },
    });
    await prisma.cursosTurmasInscricoes.deleteMany({
      where: { turmaId: { in: [turmaEscopoId, turmaForaEscopoId].filter(Boolean) } },
    });
    await prisma.cursosTurmasAulas.deleteMany({
      where: { turmaId: { in: [turmaEscopoId, turmaForaEscopoId].filter(Boolean) } },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: { turmaId: { in: [turmaEscopoId, turmaForaEscopoId].filter(Boolean) } },
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

  it('escopa cursos e turmas para o instrutor com vinculo parcial', async () => {
    const cursosResponse = await request(app)
      .get('/api/v1/cursos')
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .query({
        search: courseSearch,
        includeTurmas: true,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(Array.isArray(cursosResponse.body.data)).toBe(true);
    expect(cursosResponse.body.data).toHaveLength(1);
    expect(cursosResponse.body.data[0]).toEqual(
      expect.objectContaining({
        id: cursoId,
        nome: courseSearch,
        turmasCount: 1,
      }),
    );
    expect(cursosResponse.body.data[0].turmas).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: turmaEscopoId })]),
    );
    expect(cursosResponse.body.data[0].turmas).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: turmaForaEscopoId })]),
    );

    const turmasResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas`)
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    const turmaIds = (turmasResponse.body.data ?? []).map((turma: any) => turma.id);
    expect(turmaIds).toContain(turmaEscopoId);
    expect(turmaIds).not.toContain(turmaForaEscopoId);
  });

  it('escopa selects de aulas e provas para o instrutor com vinculo parcial', async () => {
    const aulasResponse = await request(app)
      .get('/api/v1/cursos/aulas')
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .query({
        turmaId: turmaEscopoId,
        page: 1,
        pageSize: 20,
      })
      .expect(200);

    const aulaIds = (aulasResponse.body.data ?? []).map((aula: any) => aula.id);
    expect(aulaIds).toContain(aulaPermitidaId);
    expect(aulaIds).not.toContain(aulaBloqueadaId);

    const provasResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/provas`)
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .expect(200);

    const provaIds = (provasResponse.body.data ?? []).map((prova: any) => prova.id);
    expect(provaIds).toContain(provaPermitidaId);
    expect(provaIds).not.toContain(atividadeBloqueadaId);
  });

  it('escopa listagem geral e resumo de frequencia ao proprio vinculo do instrutor', async () => {
    const listagemResponse = await request(app)
      .get('/api/v1/cursos/frequencias')
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .query({
        cursoId,
        turmaIds: turmaEscopoId,
        page: 1,
        pageSize: 50,
      })
      .expect(200);

    expect(listagemResponse.body.success).toBe(true);
    expect(Array.isArray(listagemResponse.body.data.items)).toBe(true);

    const originIds = new Set(
      listagemResponse.body.data.items.map((item: any) => `${item.tipoOrigem}:${item.origemId}`),
    );
    expect(originIds.has(`AULA:${aulaPermitidaId}`)).toBe(true);
    expect(originIds.has(`PROVA:${provaPermitidaId}`)).toBe(true);
    expect(originIds.has(`AULA:${aulaBloqueadaId}`)).toBe(false);
    expect(originIds.has(`ATIVIDADE:${atividadeBloqueadaId}`)).toBe(false);

    const resumoResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/frequencias/resumo`)
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    expect(resumoResponse.body.success).toBe(true);
    expect(resumoResponse.body.data.totalAulasNoPeriodo).toBe(1);
    expect(resumoResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alunoId: aluno.id,
          alunoNome: aluno.nomeCompleto,
          totalAulas: 1,
          presencas: 1,
          ausencias: 0,
          justificadas: 0,
          atrasados: 0,
          taxaPresencaPct: 100,
        }),
      ]),
    );
  });

  it('instrutor da turma nao interfere em origem com instrutor dono diferente', async () => {
    const aulasResponse = await request(app)
      .get('/api/v1/cursos/aulas')
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .query({
        turmaId: turmaEscopoId,
        page: 1,
        pageSize: 20,
      })
      .expect(200);

    const aulaIds = (aulasResponse.body.data ?? []).map((aula: any) => aula.id);
    expect(aulaIds).toContain(aulaBloqueadaId);
    expect(aulaIds).not.toContain(aulaPermitidaId);

    const provasResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/provas`)
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .expect(200);

    const provaIds = (provasResponse.body.data ?? []).map((prova: any) => prova.id);
    expect(provaIds).toContain(atividadeBloqueadaId);
    expect(provaIds).not.toContain(provaPermitidaId);

    const listagemResponse = await request(app)
      .get('/api/v1/cursos/frequencias')
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .query({
        cursoId,
        turmaIds: turmaEscopoId,
        page: 1,
        pageSize: 50,
      })
      .expect(200);

    const originIds = new Set(
      listagemResponse.body.data.items.map((item: any) => `${item.tipoOrigem}:${item.origemId}`),
    );
    expect(originIds.has(`AULA:${aulaBloqueadaId}`)).toBe(true);
    expect(originIds.has(`ATIVIDADE:${atividadeBloqueadaId}`)).toBe(true);
    expect(originIds.has(`AULA:${aulaPermitidaId}`)).toBe(false);
    expect(originIds.has(`PROVA:${provaPermitidaId}`)).toBe(false);

    const resumoResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/frequencias/resumo`)
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    expect(resumoResponse.body.data.totalAulasNoPeriodo).toBe(1);
    expect(resumoResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alunoId: aluno.id,
          totalAulas: 1,
          presencas: 0,
          ausencias: 1,
          justificadas: 0,
          atrasados: 0,
          taxaPresencaPct: 0,
        }),
      ]),
    );

    await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'PROVA',
        origemId: provaPermitidaId,
        status: 'PRESENTE',
      })
      .expect(403);

    const lancamentoNeutroResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${instrutorTurma.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'ATIVIDADE',
        origemId: atividadeBloqueadaId,
        status: 'PRESENTE',
      })
      .expect(200);

    expect(lancamentoNeutroResponse.body.success).toBe(true);
    expect(lancamentoNeutroResponse.body.data).toEqual(
      expect.objectContaining({
        tipoOrigem: 'ATIVIDADE',
        origemId: atividadeBloqueadaId,
        status: 'PRESENTE',
      }),
    );
  });

  it('permite lancamento dentro do escopo e bloqueia edicao fora do escopo', async () => {
    const lancamentoResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'PROVA',
        origemId: provaPermitidaId,
        status: 'PRESENTE',
        modoLancamento: 'MANUAL',
      })
      .expect(200);

    expect(lancamentoResponse.body.success).toBe(true);
    expect(lancamentoResponse.body.data).toEqual(
      expect.objectContaining({
        tipoOrigem: 'PROVA',
        origemId: provaPermitidaId,
        status: 'PRESENTE',
      }),
    );

    const blockedUpdateResponse = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaEscopoId}/frequencias/${frequenciaBloqueadaId}`)
      .set('Authorization', `Bearer ${instrutorParcial.token}`)
      .send({
        status: 'JUSTIFICADO',
        justificativa: 'Tentativa fora do escopo',
      })
      .expect(403);

    expect(blockedUpdateResponse.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });

  it('retorna estado vazio valido para instrutor sem vinculo ativo', async () => {
    const cursosResponse = await request(app)
      .get('/api/v1/cursos')
      .set('Authorization', `Bearer ${instrutorSemVinculo.token}`)
      .query({
        search: courseSearch,
        includeTurmas: true,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(cursosResponse.body.data).toEqual([]);
    expect(cursosResponse.body.meta).toEqual(
      expect.objectContaining({
        empty: true,
      }),
    );

    const frequenciasResponse = await request(app)
      .get('/api/v1/cursos/frequencias')
      .set('Authorization', `Bearer ${instrutorSemVinculo.token}`)
      .query({
        cursoId,
        turmaIds: turmaEscopoId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(frequenciasResponse.body.success).toBe(true);
    expect(frequenciasResponse.body.data.items).toEqual([]);
    expect(frequenciasResponse.body.data.pagination).toEqual(
      expect.objectContaining({
        total: 0,
        page: 1,
        pageSize: 10,
      }),
    );
  });
});
