import type { Express } from 'express';
import { Prisma } from '@prisma/client';
import request from 'supertest';

import { prisma } from '@/config/prisma';

import { cleanupTestUsers, createTestAdmin, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Avaliações/Provas - Regras de edição (já iniciada/realizada)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let admin: TestUser;

  let cursoId: string;
  let turmaId: string;
  let provaRascunhoId: string;
  let provaPublicadaId: string;

  beforeAll(async () => {
    app = await getTestApp();
    admin = await createTestAdmin();
    testUsers.push(admin);

    const suffix = Date.now().toString().slice(-6);
    const inicioFuturo = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fimFuturo = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const inicioPassado = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fimPassado = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const curso = await prisma.cursos.create({
      data: {
        codigo: `AEL${suffix}`,
        nome: `Curso Lock Edição ${suffix}`,
        cargaHoraria: 30,
        valor: new Prisma.Decimal(100),
        gratuito: false,
      },
    });
    cursoId = curso.id;

    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        codigo: `TLE${suffix}`,
        nome: `Turma Lock Edição ${suffix}`,
        vagasTotais: 20,
        vagasDisponiveis: 20,
      },
    });
    turmaId = turma.id;

    const [provaRascunho, provaPublicada] = await Promise.all([
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          tipo: 'PROVA',
          titulo: `Prova Rascunho ${suffix}`,
          etiqueta: `PR-${suffix}`,
          peso: new Prisma.Decimal(5),
          valePonto: true,
          status: 'RASCUNHO',
          modalidade: 'ONLINE',
          obrigatoria: true,
          dataInicio: inicioFuturo,
          dataFim: fimFuturo,
          horaInicio: '08:00',
          horaTermino: '18:00',
          ativo: true,
        },
      }),
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          tipo: 'PROVA',
          titulo: `Prova Publicada ${suffix}`,
          etiqueta: `PP-${suffix}`,
          peso: new Prisma.Decimal(5),
          valePonto: true,
          status: 'PUBLICADA',
          modalidade: 'ONLINE',
          obrigatoria: true,
          dataInicio: inicioPassado,
          dataFim: fimPassado,
          horaInicio: '08:00',
          horaTermino: '18:00',
          ativo: true,
        },
      }),
    ]);

    provaRascunhoId = provaRascunho.id;
    provaPublicadaId = provaPublicada.id;

    await Promise.all([
      prisma.cursosTurmasProvasQuestoes.create({
        data: {
          provaId: provaRascunhoId,
          enunciado: 'Questão base rascunho',
          tipo: 'TEXTO',
          ordem: 1,
          peso: new Prisma.Decimal(1),
          obrigatoria: true,
        },
      }),
      prisma.cursosTurmasProvasQuestoes.create({
        data: {
          provaId: provaPublicadaId,
          enunciado: 'Questão base publicada',
          tipo: 'TEXTO',
          ordem: 1,
          peso: new Prisma.Decimal(1),
          obrigatoria: true,
        },
      }),
    ]);
  });

  afterAll(async () => {
    const provaIds = [provaRascunhoId, provaPublicadaId].filter(Boolean);

    await prisma.cursosTurmasProvasQuestoes.deleteMany({
      where: { provaId: { in: provaIds } },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: { id: { in: provaIds } },
    });
    await prisma.cursosTurmas.deleteMany({ where: { id: turmaId } });
    await prisma.cursos.deleteMany({ where: { id: cursoId } });
    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve permitir editar avaliação futura vinculada à turma', async () => {
    const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const fim = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const response = await request(app)
      .put(`/api/v1/cursos/avaliacoes/${provaRascunhoId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        tipo: 'PROVA',
        titulo: 'Prova Rascunho Editada',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: true,
        peso: 5,
        status: 'RASCUNHO',
        cursoId,
        turmaId,
        instrutorId: null,
        recuperacaoFinal: false,
        tipoAtividade: null,
        etiqueta: 'PR-EDIT',
        descricao: 'Atualização permitida em rascunho',
        dataInicio: inicio,
        dataFim: fim,
        horaInicio: '08:00',
        horaTermino: '18:00',
        questoes: [
          {
            enunciado: 'Questão mantida',
            tipo: 'TEXTO',
            ordem: 1,
            peso: 1,
            obrigatoria: true,
          },
        ],
      })
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.avaliacao).toHaveProperty('id', provaRascunhoId);
    expect(response.body.avaliacao).toHaveProperty('status', 'RASCUNHO');
  });

  it('deve bloquear edição de avaliação que já aconteceu', async () => {
    const inicio = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fim = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const response = await request(app)
      .put(`/api/v1/cursos/avaliacoes/${provaPublicadaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        tipo: 'PROVA',
        titulo: 'Prova Publicada Editada',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: true,
        peso: 5,
        status: 'PUBLICADA',
        cursoId,
        turmaId,
        instrutorId: null,
        recuperacaoFinal: false,
        tipoAtividade: null,
        etiqueta: 'PP-EDIT',
        descricao: 'Não deveria editar',
        dataInicio: inicio,
        dataFim: fim,
        horaInicio: '08:00',
        horaTermino: '18:00',
        questoes: [
          {
            enunciado: 'Questão publicada',
            tipo: 'TEXTO',
            ordem: 1,
            peso: 1,
            obrigatoria: true,
          },
        ],
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'AVALIACAO_JA_INICIADA_OU_REALIZADA',
    });
  });

  it('deve permitir edição de prova em RASCUNHO e bloquear em PUBLICADA', async () => {
    const updateRascunho = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaRascunhoId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        titulo: 'Rascunho atualizado via rota de prova',
        etiqueta: 'PR-UPD',
        descricao: 'Atualização de prova rascunho',
        peso: 5,
        valePonto: true,
        moduloId: null,
        ativo: true,
        ordem: 1,
      });

    expect(updateRascunho.status).toBe(200);

    expect(updateRascunho.body).toHaveProperty('id', provaRascunhoId);
    expect(updateRascunho.body).toHaveProperty('titulo', 'Rascunho atualizado via rota de prova');

    const updatePublicada = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaPublicadaId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        titulo: 'Publicada não pode editar',
        etiqueta: 'PP-UPD',
        descricao: 'Tentativa de atualização em publicada',
        peso: 5,
        valePonto: true,
        moduloId: null,
        ativo: true,
        ordem: 1,
      });

    expect(updatePublicada.status).toBe(409);

    expect(updatePublicada.body).toMatchObject({
      success: false,
      code: 'PROVA_PUBLICADA_LOCKED',
    });
  });
});
