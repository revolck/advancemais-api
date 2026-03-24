import type { Express } from 'express';
import { Prisma, Roles } from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { prisma } from '@/config/prisma';

import {
  cleanupTestUsers,
  createTestAdmin,
  createTestModerator,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Notas visão geral (/cursos/:cursoId/notas e /cursos/notas)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let moderador: TestUser;
  let pedagogico: TestUser;
  let instrutor: TestUser;
  let alunoSemPermissao: TestUser;
  let alunoA: TestUser;
  let alunoB: TestUser;
  let alunoC: TestUser;

  let cursoId: string;
  let turmaId: string;
  let inscricaoAId: string;
  let inscricaoBId: string;
  let inscricaoCId: string;
  let provaId: string;
  let atividadeId: string;
  let aulaId: string;
  let notaSistemaId: string;
  const notasCriadasViaApi: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    moderador = await createTestModerator();
    pedagogico = await createTestUser({
      role: Roles.PEDAGOGICO,
      email: `ped-${randomUUID()}@test.com`,
      nomeCompleto: 'Pedagógico Test',
    });
    instrutor = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `inst-${randomUUID()}@test.com`,
      nomeCompleto: 'Instrutor Test',
    });
    alunoSemPermissao = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-np-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno Sem Permissão',
    });
    alunoA = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-a-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno A',
    });
    alunoB = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-b-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno B',
    });
    alunoC = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-c-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno C',
    });

    testUsers.push(
      admin,
      moderador,
      pedagogico,
      instrutor,
      alunoSemPermissao,
      alunoA,
      alunoB,
      alunoC,
    );

    const suffix = Date.now().toString().slice(-6);

    const curso = await prisma.cursos.create({
      data: {
        codigo: `NTS${suffix}`,
        nome: `Curso Notas ${suffix}`,
        cargaHoraria: 40,
        valor: new Prisma.Decimal(150),
        gratuito: false,
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `NT-${suffix}`,
        nome: `Turma Notas ${suffix}`,
        vagasTotais: 50,
        vagasDisponiveis: 50,
      },
    });
    turmaId = turma.id;

    const [prova, atividade, aula] = await Promise.all([
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          tipo: 'PROVA',
          titulo: `Prova Notas ${suffix}`,
          etiqueta: `P-${suffix.slice(-4)}`,
          peso: new Prisma.Decimal(1),
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          tipo: 'ATIVIDADE',
          titulo: `Atividade Notas ${suffix}`,
          etiqueta: `A-${suffix.slice(-4)}`,
          peso: new Prisma.Decimal(1),
        },
      }),
      prisma.cursosTurmasAulas.create({
        data: {
          cursoId,
          turmaId,
          codigo: `AU${suffix.slice(-6)}`,
          nome: `Aula Notas ${suffix}`,
        },
      }),
    ]);

    provaId = prova.id;
    atividadeId = atividade.id;
    aulaId = aula.id;

    const [inscricaoA, inscricaoB, inscricaoC] = await Promise.all([
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId,
          alunoId: alunoA.id,
          codigo: `INSC-NTA-${suffix}`,
          statusPagamento: 'APROVADO',
        },
      }),
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId,
          alunoId: alunoB.id,
          codigo: `INSC-NTB-${suffix}`,
          statusPagamento: 'APROVADO',
        },
      }),
      prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId,
          alunoId: alunoC.id,
          codigo: `INSC-NTC-${suffix}`,
          statusPagamento: 'APROVADO',
        },
      }),
    ]);

    inscricaoAId = inscricaoA.id;
    inscricaoBId = inscricaoB.id;
    inscricaoCId = inscricaoC.id;

    await prisma.cursosNotas.createMany({
      data: [
        {
          turmaId,
          inscricaoId: inscricaoAId,
          tipo: 'BONUS',
          provaId: null,
          referenciaExterna: `AULA:${randomUUID()}`,
          titulo: 'Participação em aula',
          descricao: 'Aula ao vivo',
          nota: new Prisma.Decimal(7.5),
          dataReferencia: new Date(),
        },
        {
          turmaId,
          inscricaoId: inscricaoAId,
          tipo: 'BONUS',
          provaId: null,
          referenciaExterna: `ATIVIDADE:${randomUUID()}`,
          titulo: 'Atividade complementar',
          descricao: 'Atividade bônus',
          nota: new Prisma.Decimal(1.0),
          dataReferencia: new Date(),
        },
        {
          turmaId,
          inscricaoId: inscricaoBId,
          tipo: 'BONUS',
          provaId: null,
          referenciaExterna: 'OUTRO',
          titulo: 'Ajuste manual',
          descricao: 'Ajuste por participação',
          nota: new Prisma.Decimal(2.0),
          dataReferencia: new Date(),
        },
      ],
    });

    const notaSistema = await prisma.cursosNotas.create({
      data: {
        turmaId,
        inscricaoId: inscricaoAId,
        tipo: 'PROVA',
        provaId,
        referenciaExterna: `PROVA:${provaId}`,
        titulo: 'Nota automática da prova',
        descricao: 'Gerada automaticamente pelo sistema',
        nota: new Prisma.Decimal(6),
        dataReferencia: new Date(),
      },
    });

    notaSistemaId = notaSistema.id;
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

    await prisma.cursosTurmasAulas.deleteMany({
      where: { id: aulaId },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: { id: { in: [provaId, atividadeId] } },
    });
    await prisma.cursosNotas.deleteMany({
      where: { inscricaoId: { in: [inscricaoAId, inscricaoBId, inscricaoCId] } },
    });
    await prisma.cursosTurmasInscricoes.deleteMany({
      where: { id: { in: [inscricaoAId, inscricaoBId, inscricaoCId] } },
    });
    await prisma.cursosTurmas.deleteMany({ where: { id: turmaId } });
    await prisma.cursos.deleteMany({ where: { id: cursoId } });
    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve permitir acesso para ADMIN, MODERADOR, PEDAGOGICO e INSTRUTOR', async () => {
    const allowed = [admin, moderador, pedagogico, instrutor];

    for (const user of allowed) {
      const response = await request(app)
        .get(`/api/v1/cursos/${cursoId}/notas`)
        .set('Authorization', `Bearer ${user.token}`)
        .query({ turmaIds: turmaId, page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('pagination');
    }
  });

  it('deve bloquear perfil fora da lista permitida com 403', async () => {
    await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${alunoSemPermissao.token}`)
      .query({ turmaIds: turmaId, page: 1, pageSize: 10 })
      .expect(403);
  });

  it('deve retornar contrato estável de items[] e pagination', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        turmaIds: turmaId,
        page: 1,
        pageSize: 10,
        orderBy: 'nota',
        order: 'desc',
      })
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data).toHaveProperty('pagination');

    const { items, pagination } = response.body.data;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(pagination).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(typeof pagination.total).toBe('number');
    expect(typeof pagination.totalPages).toBe('number');

    const item = items[0];
    expect(item).toEqual(
      expect.objectContaining({
        cursoId,
        cursoNome: expect.any(String),
        turmaId,
        turmaNome: expect.any(String),
        turmaCodigo: expect.any(String),
        inscricaoId: expect.any(String),
        alunoId: expect.any(String),
        alunoNome: expect.any(String),
        nota: expect.any(Number),
        atualizadoEm: expect.anything(),
        notaId: expect.anything(),
        historicoNotaId: expect.anything(),
        historicoDisponivel: expect.any(Boolean),
        origem: expect.objectContaining({
          tipo: expect.any(String),
          id: expect.anything(),
          titulo: expect.anything(),
        }),
        motivo: expect.any(String),
        isManual: expect.any(Boolean),
        history: expect.any(Array),
      }),
    );
    expect(item).toHaveProperty('avatarUrl');
    expect(item).toHaveProperty('cpf');
    expect(item).toHaveProperty('matricula');
    expect(Array.isArray(item.history)).toBe(true);
    expect(item.history.length).toBeGreaterThan(0);

    expect(items[0].nota).toBeGreaterThanOrEqual(items[1].nota);
  });

  it('deve aplicar filtro de busca por aluno/cpf/código inscrição', async () => {
    const responseByNome = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ turmaIds: turmaId, search: 'Aluno A', page: 1, pageSize: 10 })
      .expect(200);

    expect(responseByNome.body.data.items).toHaveLength(1);
    expect(responseByNome.body.data.items[0].alunoNome).toContain('Aluno A');

    const cpfPrefixo = (alunoB.cpf ?? '').slice(0, 6);
    const responseByCpf = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ turmaIds: turmaId, search: cpfPrefixo, page: 1, pageSize: 10 })
      .expect(200);

    expect(responseByCpf.body.data.items).toHaveLength(1);
    expect(responseByCpf.body.data.items[0].alunoId).toBe(alunoB.id);
  });

  it('deve rejeitar pageSize acima de 200 com 400', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ turmaIds: turmaId, page: 1, pageSize: 201 })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('deve permitir listagem global sem filtros obrigatórios', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('deve filtrar endpoint global por cursoId e turmaIds', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    const items = response.body.data.items as { cursoId: string; turmaId: string }[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((item) => item.cursoId === cursoId)).toBe(true);
    expect(items.every((item) => item.turmaId === turmaId)).toBe(true);
  });

  it('deve permitir filtrar endpoint global apenas por turmaIds', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        turmaIds: turmaId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    const items = response.body.data.items as { turmaId: string }[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((item) => item.turmaId === turmaId)).toBe(true);
  });

  it('deve rejeitar turmaIds inválidas para o curso no endpoint global', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: randomUUID(),
        page: 1,
        pageSize: 10,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'INVALID_TURMA_FILTER',
    });
  });

  it('deve exigir turmaIds no endpoint por curso', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 10 })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('deve rejeitar turmaIds inválidas para o curso', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ turmaIds: randomUUID(), page: 1, pageSize: 10 })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'INVALID_TURMA_FILTER',
    });
  });

  it('deve retornar defaultTurmaId na listagem de turmas do curso', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 200 })
      .expect(200);

    expect(response.body).toHaveProperty('defaultTurmaId', turmaId);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('deve exigir cursoId + turmaIds na rota de notas por aluno', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/alunos/${alunoA.id}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 10 })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'TURMA_FILTER_REQUIRED',
      data: {
        requires: ['cursoId', 'turmaIds'],
      },
    });
  });

  it('deve listar somente as notas do aluno na rota /alunos/:alunoId/notas', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/alunos/${alunoA.id}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaId,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    const items = response.body.data.items as {
      alunoId: string;
      turmaId: string;
      cursoId: string;
    }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.every((item) => item.alunoId === alunoA.id)).toBe(true);
    expect(items.every((item) => item.cursoId === cursoId)).toBe(true);
    expect(items.every((item) => item.turmaId === turmaId)).toBe(true);
  });

  it('deve exigir item de origem para PROVA/ATIVIDADE/AULA', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoA.id,
        nota: 7.5,
        motivo: 'Ajuste manual',
        origem: { tipo: 'PROVA' },
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('deve criar nota manual com origem PROVA e auditar usuário/data', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoA.id,
        nota: 1.0,
        motivo: 'Recuperação de prova',
        origem: { tipo: 'PROVA', id: provaId },
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('referenciaExterna', `PROVA:${provaId}`);
    expect(response.body).toHaveProperty('titulo', 'Recuperação de prova');

    const notaId = response.body.id as string;
    notasCriadasViaApi.push(notaId);

    const log = await prisma.auditoriaLogs.findFirst({
      where: {
        entidadeId: notaId,
        acao: 'NOTA_MANUAL_ADICIONADA',
      },
      orderBy: { criadoEm: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.usuarioId).toBe(admin.id);
    expect(log?.metadata).toBeTruthy();

    const listResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ turmaIds: turmaId, search: 'Aluno A', page: 1, pageSize: 10 })
      .expect(200);

    const itemAlunoA = (listResponse.body.data.items as any[]).find(
      (item) => item.alunoId === alunoA.id,
    );
    expect(itemAlunoA).toBeTruthy();

    const historyEntry = (itemAlunoA.history as any[]).find((entry) => entry.id === notaId);
    expect(historyEntry).toBeTruthy();
    expect(historyEntry).toEqual(
      expect.objectContaining({
        origem: expect.stringContaining('Administrador'),
        alteradoPor: expect.objectContaining({
          id: admin.id,
          nome: admin.nomeCompleto,
          role: Roles.ADMIN,
          roleLabel: 'Administrador',
        }),
      }),
    );

    const historicoResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaId}/historico`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historicoResponse.body).toMatchObject({
      success: true,
      data: {
        notaId,
      },
    });
    expect(historicoResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        acao: 'NOTA_MANUAL_ADICIONADA',
        ator: expect.objectContaining({
          id: admin.id,
          nome: admin.nomeCompleto,
          role: Roles.ADMIN,
          roleLabel: 'Administrador',
        }),
      }),
    );
  });

  it('deve criar nota manual com origem ATIVIDADE e AULA', async () => {
    const resAtividade = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoB.id,
        nota: 6.5,
        motivo: 'Atividade extra',
        origem: { tipo: 'ATIVIDADE', id: atividadeId },
      })
      .expect(201);

    const resAula = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoB.id,
        nota: 1,
        motivo: 'Participação em aula',
        origem: { tipo: 'AULA', id: aulaId },
      })
      .expect(201);

    notasCriadasViaApi.push(resAtividade.body.id as string, resAula.body.id as string);
    expect(resAtividade.body.referenciaExterna).toBe(`ATIVIDADE:${atividadeId}`);
    expect(resAula.body.referenciaExterna).toBe(`AULA:${aulaId}`);
  });

  it('deve bloquear lançamento manual quando exceder o limite de 10', async () => {
    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoB.id,
        nota: 0.6,
        motivo: 'Tentativa acima do limite',
        origem: { tipo: 'OUTRO', titulo: 'Ajuste' },
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'NOTA_EXCEDE_LIMITE',
      data: expect.objectContaining({
        maximoPermitido: 10,
      }),
    });
  });

  it('deve bloquear lançamento manual quando nota máxima já foi atingida', async () => {
    const reachMax = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoB.id,
        nota: 0.5,
        motivo: 'Fechamento em 10',
        origem: { tipo: 'OUTRO', titulo: 'Ajuste final' },
      })
      .expect(201);

    notasCriadasViaApi.push(reachMax.body.id as string);

    const response = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoB.id,
        nota: 0.1,
        motivo: 'Tentativa após 10',
        origem: { tipo: 'OUTRO', titulo: 'Ajuste extra' },
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'NOTA_MAXIMA_ATINGIDA',
      data: expect.objectContaining({
        notaAtual: 10,
        disponivelParaAdicionar: 0,
      }),
    });

    await prisma.cursosNotas.delete({
      where: { id: reachMax.body.id as string },
    });
  });

  it('deve bloquear update de nota automática do sistema', async () => {
    const response = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaSistemaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 9.5,
        observacoes: 'tentativa de edição',
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'NOTA_SYSTEM_LOCKED',
    });
  });

  it('deve bloquear delete de nota automática do sistema', async () => {
    const response = await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaSistemaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'NOTA_SYSTEM_LOCKED',
    });
  });

  it('deve bloquear edição manual quando a atualização ultrapassa 10', async () => {
    const created = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoA.id,
        nota: 0.2,
        motivo: 'Ajuste para teste de edição',
        origem: { tipo: 'OUTRO', titulo: 'Ajuste' },
      })
      .expect(201);

    const notaManualId = created.body.id as string;
    notasCriadasViaApi.push(notaManualId);

    const response = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaManualId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 0.6,
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'NOTA_EXCEDE_LIMITE',
      data: expect.objectContaining({
        maximoPermitido: 10,
      }),
    });
  });

  it('deve permitir delete de nota manual', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoA.id,
        nota: 0.3,
        motivo: 'Remoção manual',
        origem: { tipo: 'OUTRO', titulo: 'Ajuste temporário' },
      })
      .expect(201);

    const notaManualId = createResponse.body.id as string;
    notasCriadasViaApi.push(notaManualId);

    const deleteResponse = await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaManualId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(deleteResponse.body).toMatchObject({ success: true });
  });

  it('deve registrar histórico de edição da nota manual', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoA.id,
        nota: 0.1,
        motivo: 'Ajuste para histórico',
        origem: { tipo: 'OUTRO', titulo: 'Histórico' },
      })
      .expect(201);

    const notaManualId = createResponse.body.id as string;
    notasCriadasViaApi.push(notaManualId);

    await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaManualId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        nota: 0.2,
        observacoes: 'Ajuste confirmado',
      })
      .expect(200);

    const historicoResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaManualId}/historico`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historicoResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'NOTA_MANUAL_ATUALIZADA',
          dadosAnteriores: expect.objectContaining({ nota: 0.1 }),
          dadosNovos: expect.objectContaining({ nota: 0.2, observacoes: 'Ajuste confirmado' }),
        }),
        expect.objectContaining({
          acao: 'NOTA_MANUAL_ADICIONADA',
        }),
      ]),
    );

    await prisma.cursosNotas.delete({
      where: { id: notaManualId },
    });
  });

  it('deve manter histórico disponível após exclusão da nota manual', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoA.id,
        nota: 0.2,
        motivo: 'Nota para exclusão auditada',
        origem: { tipo: 'OUTRO', titulo: 'Exclusão' },
      })
      .expect(201);

    const notaManualId = createResponse.body.id as string;
    notasCriadasViaApi.push(notaManualId);

    await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaManualId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const historicoResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaManualId}/historico`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historicoResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'NOTA_MANUAL_EXCLUIDA',
          dadosAnteriores: expect.objectContaining({ notaId: notaManualId, nota: 0.2 }),
          dadosNovos: null,
        }),
        expect.objectContaining({
          acao: 'NOTA_MANUAL_ADICIONADA',
        }),
      ]),
    );
  });

  it('deve registrar histórico individual ao limpar lançamentos manuais em lote', async () => {
    const [nota1, nota2] = await Promise.all([
      request(app)
        .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          alunoId: alunoB.id,
          nota: 0.1,
          motivo: 'Lote 1',
          origem: { tipo: 'OUTRO', titulo: 'Lote' },
        })
        .expect(201),
      request(app)
        .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          alunoId: alunoB.id,
          nota: 0.1,
          motivo: 'Lote 2',
          origem: { tipo: 'OUTRO', titulo: 'Lote' },
        })
        .expect(201),
    ]);

    const nota1Id = nota1.body.id as string;
    const nota2Id = nota2.body.id as string;
    notasCriadasViaApi.push(nota1Id, nota2Id);

    const clearResponse = await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas?alunoId=${alunoB.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(clearResponse.body).toMatchObject({
      success: true,
      deletedCount: expect.any(Number),
    });
    expect(clearResponse.body.deletedCount).toBeGreaterThanOrEqual(2);

    const historicoResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${nota1Id}/historico`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historicoResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'NOTA_MANUAL_EXCLUIDA',
          descricao: expect.stringContaining('em lote'),
        }),
      ]),
    );

    const logExclusao = await prisma.auditoriaLogs.findFirst({
      where: {
        entidadeId: nota2Id,
        acao: 'NOTA_MANUAL_EXCLUIDA',
      },
      orderBy: { criadoEm: 'desc' },
    });

    expect(logExclusao).not.toBeNull();
  });

  it('deve expor historicoNotaId na listagem mesmo após exclusão da nota manual', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        alunoId: alunoC.id,
        nota: 0.4,
        motivo: 'Nota temporária com histórico',
        origem: { tipo: 'OUTRO', titulo: 'Histórico oficial' },
      })
      .expect(201);

    const notaManualId = createResponse.body.id as string;
    notasCriadasViaApi.push(notaManualId);

    await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${notaManualId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const listResponse = await request(app)
      .get('/api/v1/cursos/notas')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        cursoId,
        turmaIds: turmaId,
        search: 'Aluno C',
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    const itemAlunoC = (listResponse.body.data.items as any[]).find(
      (item) => item.alunoId === alunoC.id,
    );

    expect(itemAlunoC).toEqual(
      expect.objectContaining({
        alunoId: alunoC.id,
        notaId: null,
        historicoNotaId: notaManualId,
        historicoDisponivel: true,
      }),
    );

    const historicoResponse = await request(app)
      .get(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${itemAlunoC.historicoNotaId}/historico`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(historicoResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'NOTA_MANUAL_EXCLUIDA',
        }),
      ]),
    );
  });
});
