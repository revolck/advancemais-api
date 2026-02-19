import type { Express } from 'express';
import { Prisma } from '@prisma/client';
import request from 'supertest';

import { prisma } from '@/config/prisma';

import { createTestAdmin, type TestUser, cleanupTestUsers } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Avaliações detalhe com questões (E2E)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let admin: TestUser;

  let cursoId: string;
  let turmaId: string;
  let provaId: string;
  let provaTurmaId: string;
  let atividadeQuestoesId: string;
  let atividadeTextoId: string;
  let questaoMultiplaId: string;
  let questaoTextoId: string;
  let questaoTurmaMultiplaId: string;

  beforeAll(async () => {
    app = await getTestApp();
    admin = await createTestAdmin();
    testUsers.push(admin);

    const suffix = Date.now().toString().slice(-6);

    const curso = await prisma.cursos.create({
      data: {
        codigo: `AVQ${suffix}`,
        nome: `Curso Avaliações Questões ${suffix}`,
        cargaHoraria: 20,
        valor: new Prisma.Decimal(10),
        gratuito: false,
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `TQ-${suffix}`,
        nome: `Turma Questões ${suffix}`,
        vagasTotais: 30,
        vagasDisponiveis: 30,
      },
    });
    turmaId = turma.id;

    const [prova, provaTurma, atividadeQuestoes, atividadeTexto] = await Promise.all([
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId: null,
          tipo: 'PROVA',
          titulo: `Prova Template ${suffix}`,
          etiqueta: `PT-${suffix}`,
          peso: new Prisma.Decimal(3),
          valePonto: true,
          ativo: true,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          tipo: 'PROVA',
          titulo: `Prova Turma ${suffix}`,
          etiqueta: `PTU-${suffix}`,
          peso: new Prisma.Decimal(10),
          valePonto: true,
          status: 'RASCUNHO',
          modalidade: 'ONLINE',
          obrigatoria: true,
          ativo: true,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId: null,
          tipo: 'ATIVIDADE',
          tipoAtividade: 'QUESTOES',
          titulo: `Atividade Questões ${suffix}`,
          etiqueta: `AQ-${suffix}`,
          peso: new Prisma.Decimal(2),
          valePonto: true,
          ativo: true,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId: null,
          tipo: 'ATIVIDADE',
          tipoAtividade: 'PERGUNTA_RESPOSTA',
          titulo: `Atividade Texto ${suffix}`,
          etiqueta: `AT-${suffix}`,
          peso: new Prisma.Decimal(1),
          valePonto: true,
          ativo: true,
        },
      }),
    ]);

    provaId = prova.id;
    provaTurmaId = provaTurma.id;
    atividadeQuestoesId = atividadeQuestoes.id;
    atividadeTextoId = atividadeTexto.id;

    const [questaoOrdem2, questaoOrdem1] = await Promise.all([
      prisma.cursosTurmasProvasQuestoes.create({
        data: {
          provaId,
          enunciado: 'Questão ordem 2',
          tipo: 'TEXTO',
          ordem: 2,
          peso: new Prisma.Decimal(1),
          obrigatoria: true,
        },
      }),
      prisma.cursosTurmasProvasQuestoes.create({
        data: {
          provaId,
          enunciado: 'Questão ordem 1',
          tipo: 'MULTIPLA_ESCOLHA',
          ordem: 1,
          peso: new Prisma.Decimal(2),
          obrigatoria: true,
        },
      }),
    ]);

    questaoTextoId = questaoOrdem2.id;
    questaoMultiplaId = questaoOrdem1.id;

    const questaoTurmaMultipla = await prisma.cursosTurmasProvasQuestoes.create({
      data: {
        provaId: provaTurmaId,
        enunciado: 'Questão turma objetiva',
        tipo: 'MULTIPLA_ESCOLHA',
        ordem: 1,
        peso: new Prisma.Decimal(1),
        obrigatoria: true,
      },
    });
    questaoTurmaMultiplaId = questaoTurmaMultipla.id;

    await Promise.all([
      prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          questaoId: questaoMultiplaId,
          texto: 'Alternativa ordem 2',
          ordem: 2,
          correta: false,
        },
      }),
      prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          questaoId: questaoMultiplaId,
          texto: 'Alternativa ordem 1',
          ordem: 1,
          correta: true,
        },
      }),
      prisma.cursosTurmasProvasQuestoes.create({
        data: {
          provaId: atividadeQuestoesId,
          enunciado: 'Questão atividade',
          tipo: 'TEXTO',
          ordem: 1,
          peso: new Prisma.Decimal(1),
          obrigatoria: true,
        },
      }),
      prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          questaoId: questaoTurmaMultiplaId,
          texto: 'Turma alt ordem 2 (marcada)',
          ordem: 2,
          correta: true,
        },
      }),
      prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          questaoId: questaoTurmaMultiplaId,
          texto: 'Turma alt ordem 1 (também marcada)',
          ordem: 1,
          correta: true,
        },
      }),
      prisma.cursosTurmasProvasQuestoesAlternativas.create({
        data: {
          questaoId: questaoTurmaMultiplaId,
          texto: 'Turma alt ordem 3',
          ordem: 3,
          correta: false,
        },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.cursosTurmasProvasQuestoesAlternativas.deleteMany({
      where: {
        questaoId: { in: [questaoMultiplaId, questaoTextoId, questaoTurmaMultiplaId] },
      },
    });
    await prisma.cursosTurmasProvasQuestoes.deleteMany({
      where: { provaId: { in: [provaId, provaTurmaId, atividadeQuestoesId, atividadeTextoId] } },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: { id: { in: [provaId, provaTurmaId, atividadeQuestoesId, atividadeTextoId] } },
    });
    await prisma.cursosTurmas.deleteMany({ where: { id: turmaId } });
    await prisma.cursos.deleteMany({ where: { id: cursoId } });
    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve retornar questoes em data e avaliacao para PROVA sem turma (ordenado)', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${provaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('avaliacao');
    expect(response.body.data).toHaveProperty('turmaId', null);
    expect(response.body.avaliacao).toHaveProperty('turmaId', null);

    const questoesData = response.body.data.questoes;
    const questoesAvaliacao = response.body.avaliacao.questoes;

    expect(Array.isArray(questoesData)).toBe(true);
    expect(Array.isArray(questoesAvaliacao)).toBe(true);
    expect(questoesData.length).toBe(2);
    expect(questoesAvaliacao.length).toBe(2);
    expect(questoesData[0].ordem).toBe(1);
    expect(questoesData[1].ordem).toBe(2);
    expect(questoesData[0].tipo).toBe('MULTIPLA_ESCOLHA');
    expect(questoesData[0].alternativas[0].ordem).toBe(1);
    expect(questoesData[0].alternativas[1].ordem).toBe(2);
    expect(questoesData[0].alternativas.filter((alt: any) => alt.correta)).toHaveLength(1);
  });

  it('deve retornar questoes para ATIVIDADE tipo QUESTOES sem turma', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${atividadeQuestoesId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('tipo', 'ATIVIDADE');
    expect(response.body.data).toHaveProperty('tipoAtividade', 'QUESTOES');
    expect(Array.isArray(response.body.data.questoes)).toBe(true);
    expect(response.body.data.questoes.length).toBe(1);
  });

  it('deve retornar questoes vazio para ATIVIDADE tipo PERGUNTA_RESPOSTA', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${atividadeTextoId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('tipoAtividade', 'PERGUNTA_RESPOSTA');
    expect(Array.isArray(response.body.data.questoes)).toBe(true);
    expect(response.body.data.questoes).toHaveLength(0);
  });

  it('deve listar questoes no endpoint dedicado', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/avaliacoes/${provaId}/questoes`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].ordem).toBe(1);
    expect(response.body.data[1].ordem).toBe(2);
    expect(response.body.data[0].alternativas[0].ordem).toBe(1);
  });

  it('deve retornar questões completas no detalhe de prova vinculada à turma', async () => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaTurmaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', provaTurmaId);
    expect(Array.isArray(response.body.questoes)).toBe(true);
    expect(response.body.questoes).toHaveLength(1);

    const questao = response.body.questoes[0];
    expect(questao).toMatchObject({
      id: questaoTurmaMultiplaId,
      enunciado: 'Questão turma objetiva',
      tipo: 'MULTIPLA_ESCOLHA',
      ordem: 1,
      obrigatoria: true,
    });

    expect(Array.isArray(questao.alternativas)).toBe(true);
    expect(questao.alternativas.map((alt: any) => alt.ordem)).toEqual([1, 2, 3]);
    expect(questao.alternativas.filter((alt: any) => alt.correta)).toHaveLength(1);
  });
});
