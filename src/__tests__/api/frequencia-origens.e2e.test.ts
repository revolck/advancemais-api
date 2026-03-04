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

jest.setTimeout(60000);

describe('API - Frequência por origem (AULA, PROVA, ATIVIDADE)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let aluno: TestUser;
  let cursoId: string;
  let turmaId: string;
  let inscricaoId: string;
  let aulaId: string;
  let provaId: string;
  let atividadeId: string;
  let turmaSecundariaId: string;
  let aulaSecundariaId: string;
  let inscricaoSecundariaId: string;
  let frequenciaSecundariaId: string;
  let frequenciaAulaId: string;
  let frequenciaProvaId: string;
  let frequenciaAtividadeId: string;

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    aluno = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-freq-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno Frequencia',
    });
    testUsers.push(admin, aluno);

    const suffix = Date.now().toString().slice(-6);
    const curso = await prisma.cursos.create({
      data: {
        codigo: `FREQ${suffix}`,
        nome: `Curso Frequencia ${suffix}`,
        cargaHoraria: 40,
        valor: new Prisma.Decimal(100),
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `TF-${suffix}`,
        nome: `Turma Frequencia ${suffix}`,
        vagasTotais: 30,
        vagasDisponiveis: 30,
      },
    });
    turmaId = turma.id;

    const turmaSecundaria = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `TF2-${suffix}`,
        nome: `Turma Frequencia 2 ${suffix}`,
        vagasTotais: 30,
        vagasDisponiveis: 30,
      },
    });
    turmaSecundariaId = turmaSecundaria.id;

    const [aula, prova, atividade] = await Promise.all([
      prisma.cursosTurmasAulas.create({
        data: {
          cursoId,
          turmaId,
          codigo: `AUL${suffix}`,
          nome: `Aula Frequencia ${suffix}`,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          tipo: 'PROVA',
          titulo: `Prova Frequencia ${suffix}`,
          etiqueta: `PF-${suffix.slice(-4)}`,
          peso: new Prisma.Decimal(1),
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          tipo: 'ATIVIDADE',
          titulo: `Atividade Frequencia ${suffix}`,
          etiqueta: `AF-${suffix.slice(-4)}`,
          peso: new Prisma.Decimal(1),
        },
      }),
    ]);

    aulaId = aula.id;
    provaId = prova.id;
    atividadeId = atividade.id;

    const aulaSecundaria = await prisma.cursosTurmasAulas.create({
      data: {
        cursoId,
        turmaId: turmaSecundariaId,
        codigo: `AUL2${suffix}`,
        nome: `Aula Frequencia 2 ${suffix}`,
      },
    });
    aulaSecundariaId = aulaSecundaria.id;

    const inscricao = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId,
        alunoId: aluno.id,
        codigo: `INSC-FREQ-${suffix}`,
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoId = inscricao.id;

    const inscricaoSecundaria = await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId: turmaSecundariaId,
        alunoId: aluno.id,
        codigo: `INSC-FREQ2-${suffix}`,
        statusPagamento: 'APROVADO',
      },
    });
    inscricaoSecundariaId = inscricaoSecundaria.id;

    await prisma.cursosAulasProgresso.create({
      data: {
        aulaId,
        turmaId,
        inscricaoId,
        alunoId: aluno.id,
        tempoAssistidoSegundos: 2400,
        iniciadoEm: new Date('2026-02-20T10:00:00.000Z'),
      },
    });

    await prisma.cursosAulasProgresso.create({
      data: {
        aulaId: aulaSecundariaId,
        turmaId: turmaSecundariaId,
        inscricaoId: inscricaoSecundariaId,
        alunoId: aluno.id,
        tempoAssistidoSegundos: 1200,
        iniciadoEm: new Date('2026-02-20T12:00:00.000Z'),
      },
    });

    const envio = await prisma.cursosTurmasProvasEnvios.create({
      data: {
        provaId,
        inscricaoId,
        realizadoEm: new Date('2026-02-20T11:00:00.000Z'),
      },
    });

    const questao = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        provaId,
        enunciado: 'Questão teste',
        tipo: 'TEXTO',
        ordem: 1,
      },
    });

    await prisma.cursosTurmasProvasRespostas.create({
      data: {
        questaoId: questao.id,
        inscricaoId,
        envioId: envio.id,
        respostaTexto: 'Resposta',
      },
    });
  });

  afterAll(async () => {
    await prisma.cursosFrequenciaAlunos.deleteMany({
      where: { turmaId: { in: [turmaId, turmaSecundariaId] } },
    });
    await prisma.cursosTurmasProvasRespostas.deleteMany({ where: { inscricaoId } });
    await prisma.cursosTurmasProvasQuestoes.deleteMany({
      where: { provaId: { in: [provaId, atividadeId] } },
    });
    await prisma.cursosTurmasProvasEnvios.deleteMany({
      where: { provaId: { in: [provaId, atividadeId] }, inscricaoId },
    });
    await prisma.cursosAulasProgresso.deleteMany({
      where: {
        OR: [
          { inscricaoId, aulaId },
          { inscricaoId: inscricaoSecundariaId, aulaId: aulaSecundariaId },
        ],
      },
    });
    await prisma.cursosTurmasAulas.deleteMany({
      where: { id: { in: [aulaId, aulaSecundariaId] } },
    });
    await prisma.cursosTurmasProvas.deleteMany({ where: { id: { in: [provaId, atividadeId] } } });
    await prisma.cursosTurmasInscricoes.deleteMany({
      where: { id: { in: [inscricaoId, inscricaoSecundariaId] } },
    });
    await prisma.cursosTurmas.deleteMany({ where: { id: { in: [turmaId, turmaSecundariaId] } } });
    await prisma.cursos.deleteMany({ where: { id: cursoId } });
    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve listar pendências automáticas quando ainda não há frequência persistida', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/frequencias')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaId,
        status: 'PENDENTE',
        page: 1,
        pageSize: 20,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(3);
    const pendenteAula = response.body.data.items.find(
      (item: any) => item.tipoOrigem === 'AULA' && item.origemId === aulaId,
    );
    expect(pendenteAula).toBeTruthy();
    expect(pendenteAula.id).toBeNull();
    expect(pendenteAula.isPersisted).toBe(false);
    expect(pendenteAula.syntheticId).toContain('pendente:');
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipoOrigem: 'AULA', origemId: aulaId, status: 'PENDENTE' }),
        expect.objectContaining({ tipoOrigem: 'PROVA', origemId: provaId, status: 'PENDENTE' }),
        expect.objectContaining({
          tipoOrigem: 'ATIVIDADE',
          origemId: atividadeId,
          status: 'PENDENTE',
        }),
      ]),
    );
  });

  it('deve listar frequências por aluno com filtro obrigatório de curso e turma', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/alunos/${aluno.id}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaId,
        page: 1,
        pageSize: 20,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination.total).toBeGreaterThan(0);
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alunoId: aluno.id,
          cursoId,
          turmaId,
          cursoNome: expect.any(String),
          turmaNome: expect.any(String),
          acaoFrequencia: expect.objectContaining({
            podeMarcarPresente: true,
            podeMarcarAusente: true,
            podeEditar: true,
            podeVerHistorico: true,
            bloqueado: false,
          }),
        }),
      ]),
    );
  });

  it('deve retornar TURMA_FILTER_REQUIRED na frequência por aluno sem curso/turma', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/alunos/${aluno.id}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 10 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('TURMA_FILTER_REQUIRED');
  });

  it('deve aplicar search por contexto (curso/turma/origem) na frequência por aluno', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/alunos/${aluno.id}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaId,
        search: 'Prova Frequencia',
        page: 1,
        pageSize: 20,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.items.every((item: any) => item.tipoOrigem === 'PROVA')).toBe(true);
  });

  it('deve fazer upsert pela rota de lancamentos e retornar id persistido', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaSecundariaId}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId: inscricaoSecundariaId,
        tipoOrigem: 'AULA',
        origemId: aulaSecundariaId,
        status: 'PRESENTE',
        modoLancamento: 'MANUAL',
      })
      .expect(200);

    expect(createResponse.body.success).toBe(true);
    const created = createResponse.body.data;
    frequenciaSecundariaId = created.id;
    expect(created).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        tipoOrigem: 'AULA',
        origemId: aulaSecundariaId,
        status: 'PRESENTE',
        isPersisted: true,
      }),
    );

    const updateResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaSecundariaId}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId: inscricaoSecundariaId,
        tipoOrigem: 'AULA',
        origemId: aulaSecundariaId,
        status: 'AUSENTE',
        justificativa: 'Aluno não compareceu',
      })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data).toEqual(
      expect.objectContaining({
        id: created.id,
        status: 'AUSENTE',
        justificativa: 'Aluno não compareceu',
      }),
    );
  });

  it('deve retornar histórico por frequenciaId e por chave natural', async () => {
    const historicoById = await request(app)
      .get(
        `/api/v1/cursos/${cursoId}/turmas/${turmaSecundariaId}/frequencias/${frequenciaSecundariaId}/historico`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historicoById.body.success).toBe(true);
    expect(Array.isArray(historicoById.body.data)).toBe(true);
    expect(historicoById.body.data.length).toBeGreaterThan(0);
    expect(historicoById.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        changedAt: expect.any(String),
      }),
    );

    const historicoByNaturalKey = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaSecundariaId}/frequencias/historico`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        inscricaoId: inscricaoSecundariaId,
        tipoOrigem: 'AULA',
        origemId: aulaSecundariaId,
      })
      .expect(200);

    expect(historicoByNaturalKey.body.success).toBe(true);
    expect(Array.isArray(historicoByNaturalKey.body.data)).toBe(true);
    expect(historicoByNaturalKey.body.data.length).toBeGreaterThan(0);
  });

  it('deve fazer upsert de frequência no contexto do aluno', async () => {
    const startedAt = Date.now();
    const response = await request(app)
      .post(`/api/v1/cursos/alunos/${aluno.id}/frequencias/lancamentos`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        cursoId,
        turmaId: turmaSecundariaId,
        inscricaoId: inscricaoSecundariaId,
        tipoOrigem: 'AULA',
        origemId: aulaSecundariaId,
        status: 'PRESENTE',
        modoLancamento: 'MANUAL',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: frequenciaSecundariaId,
        status: 'PRESENTE',
        acaoFrequencia: expect.objectContaining({
          podeEditar: true,
          bloqueado: false,
        }),
      }),
    );
    expect(Date.now() - startedAt).toBeLessThan(20000);
  });

  it('deve listar histórico no contexto do aluno por ID e por chave natural', async () => {
    const historicoById = await request(app)
      .get(`/api/v1/cursos/alunos/${aluno.id}/frequencias/${frequenciaSecundariaId}/historico`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historicoById.body.success).toBe(true);
    expect(Array.isArray(historicoById.body.data)).toBe(true);
    expect(historicoById.body.data.length).toBeGreaterThan(0);

    const historicoByNatural = await request(app)
      .get(`/api/v1/cursos/alunos/${aluno.id}/frequencias/historico`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaId: turmaSecundariaId,
        inscricaoId: inscricaoSecundariaId,
        tipoOrigem: 'AULA',
        origemId: aulaSecundariaId,
      })
      .expect(200);

    expect(historicoByNatural.body.success).toBe(true);
    expect(Array.isArray(historicoByNatural.body.data)).toBe(true);
    expect(historicoByNatural.body.data.length).toBeGreaterThan(0);
  });

  it('deve registrar frequência de AULA com evidência automática', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'AULA',
        origemId: aulaId,
        status: 'PRESENTE',
      })
      .expect(201);

    frequenciaAulaId = response.body.id;
    expect(response.body).toEqual(
      expect.objectContaining({
        cursoId,
        turmaId,
        inscricaoId,
        tipoOrigem: 'AULA',
        origemId: aulaId,
        modoLancamento: 'MANUAL',
      }),
    );
    expect(response.body.evidencia).toEqual(
      expect.objectContaining({
        acessou: true,
        minutosEngajados: 40,
        statusSugerido: 'PRESENTE',
      }),
    );
  });

  it('deve registrar frequência de PROVA com evidência de envio/resposta', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'PROVA',
        origemId: provaId,
        status: 'PRESENTE',
      })
      .expect(201);

    frequenciaProvaId = response.body.id;
    expect(response.body).toEqual(
      expect.objectContaining({
        tipoOrigem: 'PROVA',
        origemId: provaId,
      }),
    );
    expect(response.body.evidencia).toEqual(
      expect.objectContaining({
        acessou: true,
        respondeu: true,
        statusSugerido: 'PRESENTE',
      }),
    );
  });

  it('deve registrar frequência de ATIVIDADE e manter evidência coerente', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'ATIVIDADE',
        origemId: atividadeId,
        status: 'AUSENTE',
        justificativa: 'Aluno não compareceu à atividade',
      })
      .expect(201);

    frequenciaAtividadeId = response.body.id;
    expect(response.body).toEqual(
      expect.objectContaining({
        tipoOrigem: 'ATIVIDADE',
        origemId: atividadeId,
      }),
    );
    expect(response.body.evidencia).toEqual(
      expect.objectContaining({
        acessou: false,
        respondeu: false,
      }),
    );
  });

  it('deve exigir justificativa para AUSENTE', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'ATIVIDADE',
        origemId: atividadeId,
        status: 'AUSENTE',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('deve bloquear duplicidade de frequência para mesma origem', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        inscricaoId,
        tipoOrigem: 'PROVA',
        origemId: provaId,
        status: 'PRESENTE',
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FREQUENCIA_JA_LANCADA',
    });
  });

  it('deve manter frequência persistida em segunda turma para listagem sem filtro obrigatório', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaSecundariaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        tipoOrigem: 'AULA',
        origemId: aulaSecundariaId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: frequenciaSecundariaId,
          tipoOrigem: 'AULA',
          origemId: aulaSecundariaId,
          turmaId: turmaSecundariaId,
        }),
      ]),
    );
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
      }),
    );
  });

  it('deve listar com filtros e paginação no formato novo', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        tipoOrigem: 'PROVA',
        origemId: provaId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        id: frequenciaProvaId,
        cursoId,
        cursoNome: expect.any(String),
        turmaId,
        turmaNome: expect.any(String),
        tipoOrigem: 'PROVA',
        origemId: provaId,
      }),
    );
    expect(response.body.pagination).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 1,
    });
  });

  it('deve manter compatibilidade legada sem paginação explícita', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    expect(response.body.pagination).toBeUndefined();
  });

  it('deve listar frequências globais sem filtro obrigatório', async () => {
    const startedAt = Date.now();
    const response = await request(app)
      .get('/api/v1/cursos/frequencias')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        page: 1,
        pageSize: 50,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(4);
    expect(response.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 50,
      }),
    );

    const ids = new Set(response.body.data.items.map((item: any) => item.id));
    expect(ids.has(frequenciaAulaId)).toBe(true);
    expect(ids.has(frequenciaSecundariaId)).toBe(true);

    const persistedItem = response.body.data.items.find(
      (item: any) => item.id === frequenciaAulaId,
    );
    expect(persistedItem).toEqual(
      expect.objectContaining({
        cursoId,
        cursoNome: expect.any(String),
        turmaId,
        turmaNome: expect.any(String),
        acaoFrequencia: expect.objectContaining({
          podeEditar: true,
          bloqueado: false,
        }),
      }),
    );
    expect(
      persistedItem.turmaCodigo === null || typeof persistedItem.turmaCodigo === 'string',
    ).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(20000);
  });

  it('deve responder listagem por aluno em tempo aceitável', async () => {
    const startedAt = Date.now();
    const response = await request(app)
      .get(`/api/v1/cursos/alunos/${aluno.id}/frequencias`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(20000);
  });

  it('deve aceitar filtros vazios e tipoOrigem=Todos sem quebrar listagem global', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/frequencias')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId: '',
        turmaIds: '',
        tipoOrigem: 'Todos',
        origemId: '',
        inscricaoId: '',
        status: 'Todos',
        page: 1,
        pageSize: 20,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(4);
  });

  it('deve filtrar listagem global por curso e turmaIds quando informado', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/frequencias')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaSecundariaId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toEqual(
      expect.objectContaining({
        id: frequenciaSecundariaId,
        turmaId: turmaSecundariaId,
      }),
    );
  });

  it('deve validar justificativa obrigatória para JUSTIFICADO', async () => {
    const response = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias/${frequenciaAulaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        status: 'JUSTIFICADO',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('deve atualizar frequência preservando contrato enriquecido', async () => {
    const response = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias/${frequenciaAtividadeId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        status: 'JUSTIFICADO',
        justificativa: 'Aluno apresentou atestado',
        observacoes: 'Ajuste manual',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: frequenciaAtividadeId,
        tipoOrigem: 'ATIVIDADE',
        origemId: atividadeId,
        status: 'JUSTIFICADO',
        justificativa: 'Aluno apresentou atestado',
      }),
    );
    expect(response.body.evidencia).toEqual(
      expect.objectContaining({
        acessou: false,
      }),
    );
  });

  it('deve aceitar update com id sintético pendente e fazer upsert', async () => {
    const syntheticId = `pendente:${turmaId}:${inscricaoId}:PROVA:${provaId}`;
    const response = await request(app)
      .put(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/frequencias/${encodeURIComponent(syntheticId)}`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        status: 'AUSENTE',
        justificativa: 'Aluno não compareceu na prova',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        tipoOrigem: 'PROVA',
        origemId: provaId,
        status: 'AUSENTE',
      }),
    );
  });
});
