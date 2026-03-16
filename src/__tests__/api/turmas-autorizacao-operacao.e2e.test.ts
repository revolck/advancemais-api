import request from 'supertest';
import { Express } from 'express';
import { randomUUID } from 'crypto';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';

describe('API - Turmas: autorização e operação em andamento', () => {
  jest.setTimeout(40000);

  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let pedagogico: TestUser;
  let instrutorJoao: TestUser;
  let instrutorMaria: TestUser;
  let aluno: TestUser;
  let alunoTardio: TestUser;

  let cursoId: string;
  let turmaJoaoId: string;
  let turmaMariaId: string;
  let turmaIniciadaId: string;
  let turmaComInscritoId: string;
  let turmaRemovivelId: string;
  let aulaJoaoId: string;
  let aulaMariaId: string;

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    pedagogico = await createTestUser({
      role: Roles.PEDAGOGICO,
      email: `pedagogico-${Date.now()}@test.com`,
      nomeCompleto: 'Pedagógico Teste',
    });
    instrutorJoao = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `joao-${Date.now()}@test.com`,
      nomeCompleto: 'João Instrutor',
    });
    instrutorMaria = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `maria-${Date.now()}@test.com`,
      nomeCompleto: 'Maria Instrutora',
    });
    aluno = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-${Date.now()}@test.com`,
      nomeCompleto: 'Aluno da Turma',
    });
    alunoTardio = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-tardio-${Date.now()}@test.com`,
      nomeCompleto: 'Aluno Tardio',
    });

    testUsers.push(admin, pedagogico, instrutorJoao, instrutorMaria, aluno, alunoTardio);

    const agora = Date.now();
    const umDia = 24 * 60 * 60 * 1000;

    const curso = await prisma.cursos.create({
      data: {
        id: randomUUID(),
        nome: `Curso Turmas PRD ${Date.now()}`,
        codigo: `CTP${Date.now().toString().slice(-6)}`,
        descricao: 'Curso para validar regras de turmas',
        cargaHoraria: 40,
        statusPadrao: 'PUBLICADO',
      },
    });
    cursoId = curso.id;

    const turmaJoao = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        codigo: `TJ${Date.now().toString().slice(-6)}`,
        cursoId,
        nome: 'Turma vinculada ao João',
        status: 'PUBLICADO',
        instrutorId: instrutorJoao.id,
        vagasTotais: 30,
        vagasDisponiveis: 29,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(agora - 5 * umDia),
        dataInscricaoFim: new Date(agora + 5 * umDia),
        dataInicio: new Date(agora + 7 * umDia),
        dataFim: new Date(agora + 37 * umDia),
      },
    });
    turmaJoaoId = turmaJoao.id;

    const turmaMaria = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        codigo: `TM${Date.now().toString().slice(-6)}`,
        cursoId,
        nome: 'Turma da Maria',
        status: 'PUBLICADO',
        instrutorId: instrutorMaria.id,
        vagasTotais: 30,
        vagasDisponiveis: 30,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(agora - 5 * umDia),
        dataInscricaoFim: new Date(agora + 5 * umDia),
        dataInicio: new Date(agora + 10 * umDia),
        dataFim: new Date(agora + 40 * umDia),
      },
    });
    turmaMariaId = turmaMaria.id;

    const turmaIniciada = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        codigo: `TI${Date.now().toString().slice(-6)}`,
        cursoId,
        nome: 'Turma já iniciada',
        status: 'EM_ANDAMENTO',
        instrutorId: instrutorJoao.id,
        vagasTotais: 25,
        vagasDisponiveis: 24,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(agora - 15 * umDia),
        dataInscricaoFim: new Date(agora - 6 * umDia),
        dataInicio: new Date(agora - 2 * umDia),
        dataFim: new Date(agora + 20 * umDia),
      },
    });
    turmaIniciadaId = turmaIniciada.id;

    const turmaComInscrito = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        codigo: `TCI${Date.now().toString().slice(-6)}`,
        cursoId,
        nome: 'Turma futura com inscrito',
        status: 'PUBLICADO',
        instrutorId: instrutorJoao.id,
        vagasTotais: 20,
        vagasDisponiveis: 19,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(agora - 3 * umDia),
        dataInscricaoFim: new Date(agora + 10 * umDia),
        dataInicio: new Date(agora + 12 * umDia),
        dataFim: new Date(agora + 42 * umDia),
      },
    });
    turmaComInscritoId = turmaComInscrito.id;

    const turmaRemovivel = await prisma.cursosTurmas.create({
      data: {
        id: randomUUID(),
        codigo: `TR${Date.now().toString().slice(-6)}`,
        cursoId,
        nome: 'Turma removível',
        status: 'RASCUNHO',
        instrutorId: instrutorJoao.id,
        vagasTotais: 15,
        vagasDisponiveis: 15,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(agora - umDia),
        dataInscricaoFim: new Date(agora + 10 * umDia),
        dataInicio: new Date(agora + 14 * umDia),
        dataFim: new Date(agora + 44 * umDia),
      },
    });
    turmaRemovivelId = turmaRemovivel.id;

    aulaJoaoId = randomUUID();
    aulaMariaId = randomUUID();

    await prisma.cursosTurmasAulas.createMany({
      data: [
        {
          id: aulaJoaoId,
          codigo: `AJ${Date.now().toString().slice(-6)}`,
          turmaId: turmaJoaoId,
          cursoId,
          nome: 'Aula do João',
          descricao: 'Conteúdo do João',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 1,
          status: 'PUBLICADA',
          instrutorId: instrutorJoao.id,
        },
        {
          id: aulaMariaId,
          codigo: `AM${Date.now().toString().slice(-6)}`,
          turmaId: turmaJoaoId,
          cursoId,
          nome: 'Aula da Maria',
          descricao: 'Conteúdo da Maria',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 2,
          status: 'PUBLICADA',
          instrutorId: instrutorMaria.id,
        },
        {
          id: randomUUID(),
          codigo: `AUX${Date.now().toString().slice(-6)}`,
          turmaId: turmaMariaId,
          cursoId,
          nome: 'Aula da Maria - turma própria',
          descricao: 'Conteúdo da Maria',
          modalidade: 'ONLINE',
          duracaoMinutos: 50,
          obrigatoria: true,
          ordem: 1,
          status: 'PUBLICADA',
          instrutorId: instrutorMaria.id,
        },
        {
          id: randomUUID(),
          codigo: `ATI${Date.now().toString().slice(-6)}`,
          turmaId: turmaIniciadaId,
          cursoId,
          nome: 'Aula já existente da turma iniciada',
          descricao: 'Conteúdo liberado por adaptação',
          modalidade: 'ONLINE',
          duracaoMinutos: 45,
          obrigatoria: true,
          ordem: 1,
          status: 'PUBLICADA',
          instrutorId: instrutorJoao.id,
          dataInicio: new Date(agora - 4 * umDia),
          dataFim: new Date(agora - 4 * umDia),
        },
      ],
    });

    await prisma.cursosTurmasProvas.createMany({
      data: [
        {
          id: randomUUID(),
          turmaId: turmaJoaoId,
          cursoId,
          titulo: 'Prova do João',
          etiqueta: `PJ${Date.now().toString().slice(-5)}`,
          descricao: 'Prova vinculada ao João',
          tipo: 'PROVA',
          peso: 10,
          ordem: 1,
          status: 'RASCUNHO',
          instrutorId: instrutorJoao.id,
          ativo: true,
        },
        {
          id: randomUUID(),
          turmaId: turmaMariaId,
          cursoId,
          titulo: 'Prova da Maria',
          etiqueta: `PM${Date.now().toString().slice(-5)}`,
          descricao: 'Prova vinculada à Maria',
          tipo: 'PROVA',
          peso: 10,
          ordem: 1,
          status: 'RASCUNHO',
          instrutorId: instrutorMaria.id,
          ativo: true,
        },
        {
          id: randomUUID(),
          turmaId: turmaIniciadaId,
          cursoId,
          titulo: 'Atividade já encerrada da turma iniciada',
          etiqueta: `PT${Date.now().toString().slice(-5)}`,
          descricao: 'Atividade para adaptação tardia',
          tipo: 'ATIVIDADE',
          peso: 5,
          ordem: 1,
          status: 'RASCUNHO',
          instrutorId: instrutorJoao.id,
          ativo: true,
          dataInicio: new Date(agora - 5 * umDia),
          dataFim: new Date(agora - umDia),
        },
      ],
    });

    await prisma.cursosTurmasInscricoes.createMany({
      data: [
        { turmaId: turmaJoaoId, alunoId: aluno.id },
        { turmaId: turmaIniciadaId, alunoId: aluno.id },
        { turmaId: turmaComInscritoId, alunoId: aluno.id },
      ],
    });
  });

  afterAll(async () => {
    await prisma.notificacoesEnviadas.deleteMany({
      where: { usuarioId: { in: testUsers.map((user) => user.id) } },
    });
    await prisma.notificacoes.deleteMany({
      where: { usuarioId: { in: testUsers.map((user) => user.id) } },
    });
    await prisma.cursosTurmasInscricoesAulasAcesso.deleteMany({
      where: {
        CursosTurmasInscricoes: {
          turmaId: {
            in: [
              turmaJoaoId,
              turmaMariaId,
              turmaIniciadaId,
              turmaComInscritoId,
              turmaRemovivelId,
            ].filter(Boolean),
          },
        },
      },
    });
    await prisma.cursosTurmasInscricoesProvasAcesso.deleteMany({
      where: {
        CursosTurmasInscricoes: {
          turmaId: {
            in: [
              turmaJoaoId,
              turmaMariaId,
              turmaIniciadaId,
              turmaComInscritoId,
              turmaRemovivelId,
            ].filter(Boolean),
          },
        },
      },
    });
    await prisma.cursosTurmasInscricoes.deleteMany({
      where: {
        turmaId: {
          in: [
            turmaJoaoId,
            turmaMariaId,
            turmaIniciadaId,
            turmaComInscritoId,
            turmaRemovivelId,
          ].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasAulas.deleteMany({
      where: {
        turmaId: {
          in: [
            turmaJoaoId,
            turmaMariaId,
            turmaIniciadaId,
            turmaComInscritoId,
            turmaRemovivelId,
          ].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: {
        turmaId: {
          in: [
            turmaJoaoId,
            turmaMariaId,
            turmaIniciadaId,
            turmaComInscritoId,
            turmaRemovivelId,
          ].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmas.deleteMany({
      where: {
        id: {
          in: [
            turmaJoaoId,
            turmaMariaId,
            turmaIniciadaId,
            turmaComInscritoId,
            turmaRemovivelId,
          ].filter(Boolean),
        },
      },
    });
    if (cursoId) {
      await prisma.cursos.deleteMany({ where: { id: cursoId } });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  it('INSTRUTOR lista apenas turmas com vínculo em conteúdo', async () => {
    const res = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas?page=1&pageSize=20`)
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .expect(200);

    const ids = (res.body.data ?? []).map((turma: any) => turma.id);
    expect(ids).toContain(turmaJoaoId);
    expect(ids).not.toContain(turmaMariaId);
  });

  it('INSTRUTOR não acessa turma sem vínculo', async () => {
    const res = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaMariaId}`)
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('INSTRUTOR acessa turma vinculada e visualiza alunos e apenas conteúdos próprios em detalhe', async () => {
    const res = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaJoaoId}?includeAlunos=true`)
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .expect(200);

    expect(res.body.id).toBe(turmaJoaoId);
    expect(Array.isArray(res.body.alunos)).toBe(true);
    expect(res.body.alunos).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: aluno.id, nome: aluno.nomeCompleto })]),
    );
    expect(Array.isArray(res.body.aulas)).toBe(true);
    expect(res.body.aulas).toHaveLength(1);
    expect(res.body.aulas[0]).toEqual(
      expect.objectContaining({ id: aulaJoaoId, instrutorId: instrutorJoao.id }),
    );
  });

  it('INSTRUTOR não acessa detalhe de aula de outro instrutor na mesma turma', async () => {
    const res = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaJoaoId}/aulas/${aulaMariaId}`)
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('INSTRUTOR acessa inscrições de turma vinculada', async () => {
    const res = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaJoaoId}/inscricoes`)
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ alunoId: aluno.id })]),
    );
  });

  it('INSTRUTOR não pode editar turma', async () => {
    const res = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaJoaoId}`)
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .send({ nome: 'Nome bloqueado para instrutor' })
      .expect(403);

    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('INSTRUTOR não pode criar aula em turma já iniciada', async () => {
    const res = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaIniciadaId}/aulas`)
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .send({
        nome: 'Aula tardia do instrutor',
        descricao: 'Tentativa bloqueada',
        urlVideo: 'https://example.com/aula-tardia',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA');
  });

  it('INSTRUTOR não pode criar avaliação em turma já iniciada', async () => {
    const res = await request(app)
      .post('/api/v1/cursos/avaliacoes')
      .set('Authorization', `Bearer ${instrutorJoao.token}`)
      .send({
        cursoId,
        turmaId: turmaIniciadaId,
        tipo: 'PROVA',
        titulo: 'Prova tardia do instrutor',
        peso: 5,
        modalidade: 'ONLINE',
        dataInicio: '2026-09-01',
        dataFim: '2026-09-01',
        horaInicio: '10:00',
        horaTermino: '12:00',
        questoes: [
          {
            enunciado: 'Pergunta',
            tipo: 'MULTIPLA_ESCOLHA',
            alternativas: [
              { texto: 'A', correta: true },
              { texto: 'B', correta: false },
            ],
          },
        ],
      })
      .expect(409);

    expect(res.body.code).toBe('INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA');
  });

  it('PEDAGOGICO pode alterar turma iniciada', async () => {
    const res = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaIniciadaId}`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({ nome: 'Turma iniciada ajustada pelo pedagógico' })
      .expect(200);

    expect(res.body.nome).toBe('Turma iniciada ajustada pelo pedagógico');
  });

  it('PEDAGOGICO pode salvar outros campos mantendo o mesmo período da turma iniciada', async () => {
    const turmaAtual = await prisma.cursosTurmas.findUniqueOrThrow({
      where: { id: turmaIniciadaId },
      select: {
        dataInicio: true,
        dataFim: true,
        dataInscricaoInicio: true,
        dataInscricaoFim: true,
      },
    });

    const res = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaIniciadaId}`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        nome: 'Turma iniciada com período preservado',
        dataInicio: turmaAtual.dataInicio?.toISOString(),
        dataFim: turmaAtual.dataFim?.toISOString(),
        dataInscricaoInicio: turmaAtual.dataInscricaoInicio?.toISOString(),
        dataInscricaoFim: turmaAtual.dataInscricaoFim?.toISOString(),
      })
      .expect(200);

    expect(res.body.nome).toBe('Turma iniciada com período preservado');
  });

  it('PEDAGOGICO não pode alterar período de turma já iniciada', async () => {
    const turmaAtual = await prisma.cursosTurmas.findUniqueOrThrow({
      where: { id: turmaIniciadaId },
      select: {
        dataInicio: true,
        dataFim: true,
        dataInscricaoInicio: true,
        dataInscricaoFim: true,
      },
    });

    const novaDataFim = new Date(turmaAtual.dataFim!);
    novaDataFim.setDate(novaDataFim.getDate() + 5);

    const res = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaIniciadaId}`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        dataFim: novaDataFim.toISOString(),
      })
      .expect(409);

    expect(res.body.code).toBe('TURMA_PERIODO_BLOQUEADO_APOS_INICIO');
    expect(res.body.details?.fields).toContain('dataFim');

    const turmaDepois = await prisma.cursosTurmas.findUniqueOrThrow({
      where: { id: turmaIniciadaId },
      select: { dataFim: true },
    });

    expect(turmaDepois.dataFim?.toISOString()).toBe(turmaAtual.dataFim?.toISOString());
  });

  it('PEDAGOGICO pode adicionar aula em turma iniciada e gera notificação para alunos', async () => {
    const antes = await prisma.notificacoes.count({
      where: {
        usuarioId: aluno.id,
        tipo: 'NOVA_AULA',
      },
    });

    const res = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaIniciadaId}/aulas`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        nome: 'Aula adicionada pelo pedagógico',
        descricao: 'Conteúdo extra para turma iniciada',
        urlVideo: 'https://example.com/aula-pedagogico',
        instrutorId: instrutorJoao.id,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        nome: 'Aula adicionada pelo pedagógico',
      }),
    );

    const depois = await prisma.notificacoes.count({
      where: {
        usuarioId: aluno.id,
        tipo: 'NOVA_AULA',
      },
    });

    expect(depois).toBeGreaterThan(antes);
  });

  it('não despublica turma com inscritos ativos', async () => {
    const res = await request(app)
      .patch(`/api/v1/cursos/${cursoId}/turmas/${turmaComInscritoId}/publicar`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ publicar: false })
      .expect(409);

    expect(res.body.code).toBe('TURMA_DESPUBLICACAO_BLOQUEADA_COM_INSCRITOS');
  });

  it('não exclui turma já iniciada', async () => {
    const res = await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaIniciadaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(res.body.code).toBe('TURMA_EXCLUSAO_BLOQUEADA_JA_INICIADA');
  });

  it('não exclui turma com inscritos', async () => {
    const res = await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaComInscritoId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(res.body.code).toBe('TURMA_EXCLUSAO_BLOQUEADA_COM_INSCRITOS');
  });

  it('remove turma elegível via soft delete e ela some das consultas padrão', async () => {
    const res = await request(app)
      .delete(`/api/v1/cursos/${cursoId}/turmas/${turmaRemovivelId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: turmaRemovivelId,
        removidoPorId: admin.id,
      }),
    );

    const turmaRemovida = await prisma.cursosTurmas.findUnique({
      where: { id: turmaRemovivelId },
      select: { deletedAt: true, status: true },
    });

    expect(turmaRemovida?.deletedAt).not.toBeNull();
    expect(turmaRemovida?.status).toBe('CANCELADO');

    await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaRemovivelId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    const listRes = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas?page=1&pageSize=20`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const ids = (listRes.body.data ?? []).map((turma: any) => turma.id);
    expect(ids).not.toContain(turmaRemovivelId);
  });

  it('inscrição tardia cria janelas individuais mínimas para aulas e avaliações existentes', async () => {
    const res = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaIniciadaId}/inscricoes`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        alunoId: alunoTardio.id,
        prazoAdaptacaoDias: 10,
      })
      .expect(201);

    expect(res.body.id).toBe(turmaIniciadaId);

    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: {
        turmaId_alunoId: {
          turmaId: turmaIniciadaId,
          alunoId: alunoTardio.id,
        },
      },
      select: { id: true },
    });

    expect(inscricao).not.toBeNull();

    const [acessosAulas, acessosProvas] = await Promise.all([
      prisma.cursosTurmasInscricoesAulasAcesso.findMany({
        where: { inscricaoId: inscricao!.id },
        select: { aulaId: true, origem: true, disponivelAte: true },
      }),
      prisma.cursosTurmasInscricoesProvasAcesso.findMany({
        where: { inscricaoId: inscricao!.id },
        select: { provaId: true, origem: true, disponivelAte: true },
      }),
    ]);

    expect(acessosAulas.length).toBeGreaterThan(0);
    expect(acessosProvas.length).toBeGreaterThan(0);
    expect(acessosAulas.every((item) => item.origem === 'ENTRADA_TARDIA')).toBe(true);
    expect(acessosProvas.every((item) => item.origem === 'ENTRADA_TARDIA')).toBe(true);
    expect(acessosProvas.some((item) => item.disponivelAte !== null)).toBe(true);
  });
});
